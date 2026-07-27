/**
 * مقارنة معاينة محدودة: يجلب حتى 10 وثائق UQN حية ويطابقها مع مكتبة Preview المحلية.
 * لا يكتب في legal_* إلا إن وُجدت صفوف تجريبية مُعدّة مسبقًا — هنا قراءة فقط للمكتبة.
 */
import { mkdirSync, writeFileSync } from "fs";
import { prisma } from "@/lib/prisma";
import { getConnector } from "@/lib/modules/rasd/connectors";
import { parseDocumentStructure } from "@/lib/modules/rasd/parse/structure";
import { rankMatches } from "@/lib/modules/rasd/match/engine";
import { dualFingerprints } from "@/lib/modules/rasd/hash";
import { normalizeForCompare } from "@/lib/modules/rasd/normalize/arabic";
import { saveSnapshotLocal } from "@/lib/modules/rasd/snapshot/store";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required for preview compare");

  const systems = await prisma.legalSystem.findMany({
    include: { articles: { select: { articleNumber: true, content: true, royalDecree: true }, take: 20 } },
    take: 200
  });
  const candidates = systems.map((system) => ({
    id: system.id,
    name: system.name,
    royalDecree: system.articles.find((article) => article.royalDecree)?.royalDecree ?? undefined,
    articles: system.articles.map((article) => ({
      articleNumber: article.articleNumber,
      content: article.content
    }))
  }));

  const connector = getConnector("UQN");
  const discovered = await connector.discover({
    limit: 10,
    sitemapUrl: "https://www.uqn.gov.sa/sitemaps/2026/7/sitemap_0.xml?v=1.1"
  });

  const rows = [];
  for (const item of discovered.documents.slice(0, 10)) {
    const fetched = await connector.fetchDocument(item.url, { timeoutMs: 25_000 });
    if (!fetched.ok) {
      rows.push({ url: item.url, error: fetched.error || fetched.status });
      continue;
    }
    const snap = await saveSnapshotLocal({
      runId: "preview-compare",
      sourceCode: "UQN",
      url: item.url,
      body: fetched.bodyText,
      contentType: fetched.headers["content-type"]
    });
    const parsed = parseDocumentStructure(fetched.bodyText, "UQN");
    const fps = dualFingerprints(fetched.bodyText, normalizeForCompare(parsed.normalizedText || parsed.rawText));
    const matches = rankMatches(parsed, candidates);
    const top = matches[0];
    rows.push({
      source: "UQN",
      sourceUrl: item.url,
      officialSourceIdentifier: item.sourceDocumentId,
      title: parsed.metadata.title || parsed.title || item.title || null,
      documentType: parsed.metadata.documentType || null,
      instrumentNumber: parsed.metadata.normalizedInstrumentNumber || parsed.metadata.instrumentNumber || null,
      instrumentDate: parsed.metadata.instrumentDateHijri || parsed.metadata.instrumentDateGregorian || null,
      publicationData: {
        publicationDateHijri: parsed.metadata.publicationDateHijri || null,
        publicationDateGregorian: parsed.metadata.publicationDateGregorian || null
      },
      status: parsed.metadata.status || null,
      rawSnapshotHash: snap.contentHash,
      normalizedTextHash: fps.normalizedHash,
      parseConfidence: parsed.confidence,
      matchCandidateInHakeem: top
        ? { id: top.id, name: top.name, status: top.status, score: top.score, method: top.method, reasons: top.reasons }
        : null,
      matchScore: top?.score ?? null,
      detectedDifferences: top ? [] : ["NO_MATCH_IN_PREVIEW_LIBRARY"],
      warnings: [
        ...(parsed.confidence < 0.5 ? ["low parse confidence"] : []),
        ...(!parsed.metadata.normalizedInstrumentNumber ? ["instrument number missing/low-confidence"] : [])
      ]
    });
  }

  const summary = {
    environment: "local-postgres-rasd_preview",
    librarySystems: systems.length,
    examined: rows.length,
    exactMatches: rows.filter((row) => row.matchCandidateInHakeem?.status === "EXACT_MATCH").length,
    probableMatches: rows.filter((row) => row.matchCandidateInHakeem?.status === "PROBABLE_MATCH").length,
    ambiguousMatches: rows.filter((row) => row.matchCandidateInHakeem?.status === "AMBIGUOUS").length,
    noMatch: rows.filter((row) => !row.matchCandidateInHakeem || row.matchCandidateInHakeem.status === "NO_MATCH").length,
    parserAnomalies: rows.filter((row) => (row.warnings || []).length > 0).length,
    rows
  };

  mkdirSync("docs/rasd/reports", { recursive: true });
  writeFileSync("docs/rasd/reports/preview-live-compare.json", JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        librarySystems: summary.librarySystems,
        examined: summary.examined,
        exactMatches: summary.exactMatches,
        probableMatches: summary.probableMatches,
        ambiguousMatches: summary.ambiguousMatches,
        noMatch: summary.noMatch,
        parserAnomalies: summary.parserAnomalies
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
