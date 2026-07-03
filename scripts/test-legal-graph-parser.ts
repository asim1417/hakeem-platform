/**
 * test-legal-graph-parser.ts — اختبارات محلّل الإشارات (منقولة من حزمة hakeem-bylaw-linking).
 * يخرج برمز غير صفري عند أي فشل. التشغيل: npx tsx scripts/test-legal-graph-parser.ts
 */
import { parseOrdinal, extractSystemRefs } from "@/lib/legal-graph/reference-parser";

const ORDINALS: Record<string, number> = {
  "الأولى": 1, "السادسة": 6, "التاسعة": 9, "العاشرة": 10, "الحادية عشرة": 11,
  "الثانية عشرة": 12, "التاسعة عشرة": 19, "العشرون": 20, "الحادية والعشرون": 21,
  "الخامسة والعشرون": 25, "الثلاثون": 30, "الرابعة والثلاثون": 34, "المائة": 100,
  "الحادية بعد المائة": 101, "الثانية والعشرون بعد المائة": 122, "(6)": 6, "(٦)": 6,
  "المائتان": 200, "الحادية بعد المائتين": 201,
};

let failed = 0;
console.log("① اختبار الأعداد الترتيبية:");
for (const [phrase, expected] of Object.entries(ORDINALS)) {
  const got = parseOrdinal(phrase);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`   ${ok ? "✓" : "✗"} ${phrase} → ${got} (توقع ${expected})`);
}

console.log("\n② اختبار استخراج الإشارات:");
const sample =
  "يجب على الجهة المختصة وفقاً للحكم الوارد في المادة (السادسة) من النظام أن تتخذ الإجراءات، " +
  "مع مراعاة المادتين (التاسعة) و(العاشرة) من النظام.";
const refs = extractSystemRefs(sample).map((r) => r.number);
const expectedRefs = [6, 9, 10];
const refsOk = JSON.stringify(refs) === JSON.stringify(expectedRefs);
if (!refsOk) failed++;
console.log(`   ${refsOk ? "✓" : "✗"} ${JSON.stringify(refs)} (توقع ${JSON.stringify(expectedRefs)})`);

// إشارة سلبية: نصّ بلا «من النظام» يجب ألا يُنتج شيئًا
const negative = "تطبّق أحكام المادة (الخامسة) من هذه اللائحة.";
const negOk = extractSystemRefs(negative).length === 0;
if (!negOk) failed++;
console.log(`   ${negOk ? "✓" : "✗"} نصّ بلا «من النظام» → لا إشارات`);

console.log(failed ? `\n⚠️ فشل ${failed} اختبار.` : "\n✓ كل الاختبارات نجحت.");
process.exit(failed ? 1 : 0);
