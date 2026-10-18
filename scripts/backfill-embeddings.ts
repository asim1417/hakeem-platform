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
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { prisma } from "@/lib/prisma";

/**
 * pg ليس من تبعيات المشروع (القفل)، والأداة جُرّبت عليه محليًا. في المسار يُثبَّت مؤقتًا بالنسخة نفسها
 * بلا حفظ ولا سكربتات تثبيت، ثم يُستورد. لا يمس package.json ولا القفل.
 */
const PG_VERSION = "8.23.1";
function ensurePg(): void {
  const req = createRequire(`${process.cwd()}/package.json`);
  try {
    req.resolve("pg");
    req.resolve("pg-connection-string");
    return;
  } catch {
    execFileSync("npm", ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", `pg@${PG_VERSION}`], { stdio: "inherit" });
    req.resolve("pg");
    req.resolve("pg-connection-string");
  }
}

/** سجلات المسار لا تُقرأ من جلسة التطوير، والتعليقات التوضيحية تُقرأ عبر API: ملخص بلا نصوص ولا أسرار. */
const sanitize = (s: string) => s.replace(/postgres(?:ql)?:\/\/\S+/gi, "[رابط]").replace(/\bsk-[A-Za-z0-9_-]+/g, "[مفتاح]").slice(0, 900);

async function main() {
  const libPath = "./hkm-029/embed-lib.mjs";
  const toolPath = "./hkm-029/embed-articles.mjs";
  const argv = process.argv.slice(2);
  // قبل استيراد الأداة: embed-lib يستورد drift-lib الذي يستورد pg-connection-string.
  if (argv[argv.indexOf("--target") + 1] === "articles" && argv.includes("--target")) ensurePg();
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
