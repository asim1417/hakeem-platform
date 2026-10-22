/**
 * الكتابة على جدول embeddings موقوفة.
 * المتجه الجديد يُضاف في embedding_version عبر scripts/backfill-embedding-versions.ts
 * والصف القائم لا يُستبدل.
 *
 * فرع التشغيل aman/hkm-029-embeddings وحده (هذا الالتزام لا يُدمج، ويُرجع بعد التشغيل): مسار
 * backfill-embeddings.yml بـ target=articles يشغّل أداة HKM-029 المحصورة (scripts/hkm-029/embed-articles.mjs)
 * بقائمتها المجمّدة (HKM-030: كل القديمة والمفقودة بالنص الساري): scope=missing تجريب بلا كتابة يطبع
 * الملخص وتقدير الرموز، وscope=all مع limit = العدد المعتمد كتابة في embedding_version فقط. أي هدف آخر موقوف كما كان.
 */
import { prisma } from "@/lib/prisma";

/** سجلات المسار لا تُقرأ من جلسة التطوير، والتعليقات التوضيحية تُقرأ عبر API: ملخص بلا نصوص ولا أسرار. */
const sanitize = (s: string) => s.replace(/postgres(?:ql)?:\/\/\S+/gi, "[رابط]").replace(/\bsk-[A-Za-z0-9_-]+/g, "[مفتاح]").slice(0, 900);

async function main() {
  const libPath = "./hkm-029/embed-lib.mjs";
  const toolPath = "./hkm-029/embed-articles.mjs";
  const argv = process.argv.slice(2);
  // قبل استيراد الأداة: embed-lib يستورد drift-lib الذي يستورد pg-connection-string.
  if (argv.includes("--target") && argv[argv.indexOf("--target") + 1] === "articles") {
    const pgHelper = "./hkm-029/ensure-pg.mjs";
    const { ensurePg } = await import(pgHelper);
    console.log(`::notice title=HKM-029 pg::${ensurePg()}`);
  }
  const { workflowArgsToRun } = await import(libPath);
  const run = workflowArgsToRun(argv);
  if (run) {
    const { main: embedArticles } = await import(toolPath);
    const result = await embedArticles([], run);
    console.log(`::notice title=HKM-029 embeddings::${sanitize(JSON.stringify(result))}`);
    return;
  }
  console.error("الكتابة على جدول embeddings موقوفة. المتجه الجديد يُضاف في embedding_version، والصف القائم لا يُستبدل.");
  console.error("التشغيل التجريبي: npx tsx scripts/dry-run-verification-layer.ts");
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`::error title=HKM-029 embeddings::${sanitize(error instanceof Error ? error.message : "فشل")}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
