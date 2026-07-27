process.env.RASD_FIXTURES_ONLY = "true";
process.env.RASD_MEMORY_ONLY = "true";

import { prisma } from "@/lib/prisma";
import { runBaselineScan } from "@/lib/modules/rasd/scan/baseline";
import { getRasdMemoryStaging } from "@/lib/modules/rasd/scan/orchestrator";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function countLegalArticles(): Promise<number | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await prisma.legalArticle.count();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const before = await countLegalArticles();
  const result = await runBaselineScan({
    dryRun: true,
    fixturesOnly: true,
    limit: 4
  });
  const after = await countLegalArticles();
  const staging = getRasdMemoryStaging();

  assert(result.fixturesOnly, "scan should run in fixtures mode");
  assert(result.dryRun, "scan should be dry-run");
  assert(result.counts.documentsDiscovered > 0, "fixtures should discover documents");
  assert(staging.documents.length > 0, "memory staging should contain documents");
  assert(staging.changes.length > 0, "memory staging should contain changes");
  if (before !== null && after !== null) {
    assert(before === after, "legal_articles count must not change during scan");
  }
  console.log("PASS Rasd integration fixtures-only baseline dry-run");
  console.log(JSON.stringify({ runId: result.runId, counts: result.counts, changes: staging.changes.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(`FAIL Rasd integration: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
