// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §22 — تحقّق محرّك تتبّع العبارة (نقيّ).
// يفحص: التجزئة، تصنيف النوع/الجزم، وأنّ الإسناد يُثبَت فقط عند مطابقةٍ حقيقيّة.
//   npm run test:jds-trace
// ─────────────────────────────────────────────────────────────────────────────
import { traceStatements, segmentStatements, unsupportedCount } from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

function main() {
  // ① التجزئة تفصل الجمل.
  const segs = segmentStatements("الثابت من المستند أنّ الدين قائم. يدّعي المدعي خلاف ذلك.");
  check("التجزئة تُنتج عبارتين", segs.length === 2);

  // ② عبارةٌ مسنَدة لدليلٍ معروف ⇒ VERIFIED موثَّقة.
  const t1 = traceStatements("d1", "الثابت من عقد الإيجار أنّ الأجرة مستحقّة.", {
    evidence: ["عقد الإيجار"],
  });
  check("عبارة مستند: نوع DOCUMENTED_FACT", t1[0].statementType === "DOCUMENTED_FACT");
  check("عبارة مستند مطابِقة لدليل: VERIFIED", t1[0].verificationStatus === "VERIFIED");
  check("تربط معرّف الدليل", t1[0].evidenceIds.length > 0);

  // ③ إسنادٌ لمادّةٍ غير متاحة ⇒ UNSUPPORTED (لا اختلاق).
  const t2 = traceStatements("d2", "تقضي الدائرة بموجب المادة الخامسة بإلزام المدعى عليه.", { authorities: [] });
  check("حكمٌ/إسنادٌ بلا سند متاح: UNSUPPORTED", t2.some((s) => s.verificationStatus === "UNSUPPORTED"));

  // ④ إسنادٌ لسلطةٍ متاحة ⇒ VERIFIED.
  const t3 = traceStatements("d3", "بموجب المادة 5 يُلزَم المدعى عليه بالأجرة.", { authorities: ["المادة 5"] });
  check("إسنادٌ لسلطةٍ متاحة: VERIFIED", t3.some((s) => s.verificationStatus === "VERIFIED"));

  // ⑤ ادّعاءٌ مجرّد ⇒ ASSERTED / NEEDS_REVIEW.
  const t4 = traceStatements("d4", "يدّعي المدعي أنّ له حقًّا لدى الخصم.", {});
  check("ادّعاء: مستوى ASSERTED", t4[0].assertionLevel === "ASSERTED");
  check("ادّعاءٌ بلا سند: NEEDS_REVIEW", t4[0].verificationStatus === "NEEDS_REVIEW");

  // ⑥ عدّ غير المسنَد.
  check("عدّ UNSUPPORTED يعمل", unsupportedCount(t2) >= 1);

  // ⑦ إزاحاتٌ صحيحة (offsets).
  check("كلّ تتبّعٍ له إزاحةٌ صالحة", t1.every((s) => s.endOffset > s.startOffset));

  console.log(`\nنتيجة §22 (statement-trace): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
