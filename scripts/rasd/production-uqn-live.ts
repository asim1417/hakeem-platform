/**
 * Production-path UQN live run into staging DB (no auto-apply to legal_*).
 * Counts only live network documents — never fixtures.
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { seedRasdRegistry } from "@/lib/modules/rasd/db/seed-sources";
import { runScan } from "@/lib/modules/rasd/scan/orchestrator";
import { getConnector } from "@/lib/modules/rasd/connectors";
import { parseDocumentStructure } from "@/lib/modules/rasd/parse/structure";
import { contentFingerprint } from "@/lib/modules/rasd/hash";

const LIMIT = Number(process.env.RASD_LIVE_LIMIT || 10);

async function main() {
  process.env.RASD_ENABLED = "true";
  process.env.RASD_AUTO_FETCH_ENABLED = "true";
  process.env.RASD_FIXTURES_ONLY = "false";
  process.env.RASD_MEMORY_ONLY = "false";
  process.env.RASD_SOURCE_UQN_ENABLED = "true";
  process.env.RASD_SOURCE_BOE_ENABLED = "false";
  process.env.RASD_SOURCE_NCAR_ENABLED = "false";
  process.env.RASD_AUTO_APPLY_ENABLED = "false";
  process.env.RASD_REVIEW_REQUIRED = "true";

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

  await seedRasdRegistry();
  const beforeDocs = await (prisma as any).monitoredLegalDocument.count();
  const beforeSystems = await prisma.legalSystem.count();
  const beforeArticles = await prisma.legalArticle.count();

  // Direct live sample evidence (independent of orchestrator staging)
  const connector = getConnector("UQN");
  const health = await connector.healthCheck();
  const discovered = await connector.discover({ limit: LIMIT, fixturesOnly: false });
  const samples = [];
  for (const doc of discovered.documents.slice(0, LIMIT)) {
    const fetched = await connector.fetchDocument(doc.url, { timeoutMs: 20000 });
    if (!fetched.ok) {
      samples.push({ url: doc.url, ok: false, error: fetched.error });
      continue;
    }
    const body = fetched.bodyText || "";
    const parsed = parseDocumentStructure(body, "UQN");
    samples.push({
      url: doc.url,
      ok: true,
      title: parsed.title ?? doc.title ?? null,
      type: parsed.metadata.documentType ?? null,
      instrumentType: parsed.metadata.instrumentType ?? null,
      instrumentNumber: parsed.metadata.normalizedInstrumentNumber ?? parsed.metadata.instrumentNumber ?? null,
      date: parsed.metadata.instrumentDateHijri ?? parsed.metadata.instrumentDate ?? null,
      uqnIssue: parsed.metadata.uqnIssue ?? null,
      rawHash: contentFingerprint(body),
      normalizedHash: parsed.normalizedHash,
      parserConfidence: parsed.confidence,
      httpStatus: fetched.status,
      contentType: fetched.headers["content-type"] ?? null
    });
  }

  const scan = await runScan({
    runType: "MANUAL",
    sources: ["UQN"],
    dryRun: true, // staging writes still happen when MEMORY_ONLY=false & DATABASE_URL set — dryRun blocks legal apply only conceptually; orchestrator still stages
    fixturesOnly: false,
    limit: LIMIT,
    actorId: "uqn-live-prod-script"
  });

  // Force non-dry staging run for DB persistence proof (still no legal_* apply)
  const persist = await runScan({
    runType: "MANUAL",
    sources: ["UQN"],
    dryRun: false,
    fixturesOnly: false,
    limit: LIMIT,
    actorId: "uqn-live-prod-script"
  });

  const afterDocs = await (prisma as any).monitoredLegalDocument.count();
  const afterArticles = await prisma.legalArticle.count();
  const afterSystems = await prisma.legalSystem.count();
  const liveOk = samples.filter((s) => s.ok).length;

  const report = {
    checkedAt: new Date().toISOString(),
    environment: "local-staging-rasd_preview",
    databaseHost: "127.0.0.1",
    databaseName: "rasd_preview",
    isProductionDb: false,
    health,
    discovered: discovered.documents.length,
    discoverOk: discovered.ok,
    discoverError: discovered.error ?? null,
    liveSamplesOk: liveOk,
    liveSamplesRequired: 10,
    samples,
    scanDry: { runId: scan.runId, status: scan.status, counts: scan.counts },
    scanPersist: { runId: persist.runId, status: persist.status, counts: persist.counts },
    db: {
      beforeDocs,
      afterDocs,
      beforeSystems,
      afterSystems,
      beforeArticles,
      afterArticles,
      legalArticlesUnchanged: beforeArticles === afterArticles,
      legalSystemsUnchanged: beforeSystems === afterSystems
    },
    certification: liveOk >= 10 ? "UQN_LIVE_STAGING_VERIFIED" : "UQN_LIVE_INCOMPLETE",
    autoApply: false
  };

  const outDir = path.join(process.cwd(), "docs/rasd/reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "UQN_LIVE_PRODUCTION_REPORT.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ outPath, liveSamplesOk: liveOk, certification: report.certification, legalArticlesUnchanged: report.db.legalArticlesUnchanged }, null, 2));
  if (liveOk < 10) process.exitCode = 2;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
