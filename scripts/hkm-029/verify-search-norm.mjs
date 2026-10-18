/**
 * HKM-029 — تحقق بالقراءة فقط من نتيجة دفعة rebuild-search-norm عبر اتصال جديد.
 *   npx tsx scripts/hkm-029/verify-search-norm.mjs --target isolated|production
 * المخرج: confirmed (كل الصفوف بالفهرس الجديد) أو not_applied (كلها بالقديم) أو unconfirmed (يمنع المتابعة، رمز خروج 1).
 */
import { pathToFileURL } from "node:url";
import { ledgerPathFor, verifyLedger } from "./rebuild-search-norm.mjs";

async function main() {
  const i = process.argv.indexOf("--target");
  const target = i >= 0 ? process.argv[i + 1] : "";
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  const result = await verifyLedger(url, ledgerPathFor(target));
  console.log(JSON.stringify({ target, ...result }));
  if (result.outcome === "unconfirmed") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "فشل");
    process.exit(2);
  });
}
