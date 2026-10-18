/**
 * الكتابة على جدول embeddings موقوفة.
 * المتجه الجديد يُضاف في embedding_version عبر scripts/backfill-embedding-versions.ts
 * والصف القائم لا يُستبدل.
 *
 * فرع التشغيل aman/hkm-029-embeddings وحده (هذا الالتزام لا يُدمج، ويُرجع بعد التشغيل): مسار
 * backfill-embeddings.yml بـ target=articles يشغّل أداة HKM-029 المحصورة (scripts/hkm-029/embed-articles.mjs)
 * بقائمتها المجمّدة: scope=missing تجريب بلا كتابة، وscope=all مع limit = العدد المعتمد كتابة في
 * embedding_version فقط. أي هدف آخر موقوف كما كان.
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const libPath = "./hkm-029/embed-lib.mjs";
  const toolPath = "./hkm-029/embed-articles.mjs";
  const { workflowArgsToRun } = await import(libPath);
  const run = workflowArgsToRun(process.argv.slice(2));
  if (run) {
    const { main: embedArticles } = await import(toolPath);
    await embedArticles([], run);
    return;
  }
  console.error("الكتابة على جدول embeddings موقوفة. المتجه الجديد يُضاف في embedding_version، والصف القائم لا يُستبدل.");
  console.error("التشغيل التجريبي: npx tsx scripts/dry-run-verification-layer.ts");
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "فشل");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
