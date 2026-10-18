/**
 * HKM-028: قائمة الأنظمة المزاحة (data/shifted-systems.json) — بلا قاعدة.
 * كل نظام في pendingOfficialCorrection يبقى استشهاده غير متحقَّق حتى يُصحَّح، والمُصحَّح خارجها.
 *   npx tsx scripts/test-shifted-systems.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { isNumberingShifted, normalizeSystemName } from "../lib/modules/legal-core/resolve-law";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

const file = JSON.parse(readFileSync(path.join(process.cwd(), "data/shifted-systems.json"), "utf8")) as {
  corrected: string[];
  pendingOfficialCorrection: string[];
  verifiedNotShifted: Array<{ name: string }>;
};
const pending = file.pendingOfficialCorrection.map(normalizeSystemName);
const corrected = file.corrected.map(normalizeSystemName);
const verified = file.verifiedNotShifted.map((v) => normalizeSystemName(v.name));

ok(isNumberingShifted("نظام المحاكم التجارية"), "نظام المحاكم التجارية مزاح بانتظار التصحيح (الأمر ٠٨)");
ok(isNumberingShifted("نظام المحاكم التجاريّة"), "يُطابَق الاسم بعد التطبيع (التشكيل)");
ok(isNumberingShifted("نظام النقل بالخطوط الحديدية"), "النقل بالخطوط الحديدية مزاح بانتظار التصحيح");
ok(!isNumberingShifted("نظام المعاملات المدنية"), "المعاملات المدنية مُصحَّح فليس مزاحًا");
ok(!isNumberingShifted("نظام العمل"), "نظام العمل مُصحَّح فليس مزاحًا");
ok(!isNumberingShifted("نظام الشركات"), "نظام غير مدرج ليس مزاحًا");
ok(new Set(pending).size === pending.length, "لا تكرار في قائمة الانتظار");
ok(!pending.some((n) => corrected.includes(n)), "لا نظام في القائمتين (الانتظار والمُصحَّح) معًا");
ok(!pending.some((n) => verified.includes(n)), "لا نظام في الانتظار وثبت أنه غير مزاح معًا");

console.log(failed === 0 ? "✓ قائمة الأنظمة المزاحة" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
