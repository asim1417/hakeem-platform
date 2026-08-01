// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §27 — تحقّق محرّك تنفيذ بوّابات الجودة (نقيّ).
// يفحص كشف خلط الأصوات، وخلط طرق الاعتراض، وتجاوز الطلبات، والاتّساق، والوسم،
// ومبدأ الصدق: البوّابات المحتاجة لبياناتٍ خارجيّة تُعلَّم NEEDS_REVIEW لا PASS.
//   npm run test:jds-gates
// ─────────────────────────────────────────────────────────────────────────────
import { executeQualityGates, isReleaseReady } from "@/lib/modules/judicial";

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

function outcome(results: ReturnType<typeof executeQualityGates>, id: string) {
  return results.find((r) => r.gateId === id)?.outcome;
}

function main() {
  // ① JG13 — لفظ حسمٍ محكميّ في مذكّرة طرفٍ = FAIL.
  const partyMix = executeQualityGates({
    documentFunction: "DEFENSE",
    voiceProfile: "JUDICIAL_PARTY",
    draftText: "نطلب رفض الدعوى، وقد حكمت الدائرة بذلك.",
  });
  check("JG13 يكشف خلط صوت المحكمة في مذكّرة طرف", outcome(partyMix, "JG13") === "FAIL");

  // ② JG13 — «ثبت» عند مستوى ASSERTED = FAIL.
  const assertion = executeQualityGates({
    documentFunction: "REASONING",
    voiceProfile: "JUDICIAL_BENCH_RESTRICTED",
    draftText: "…",
    statements: [{ text: "ثبت الدين", assertionLevel: "ASSERTED" }],
    hasNonBindingLabel: true,
  });
  check("JG13 يكشف تجاوز مستوى الجزم", outcome(assertion, "JG13") === "FAIL");

  // ③ JG14 — مصطلح «نقض» في لائحة استئناف = FAIL.
  const route = executeQualityGates({
    documentFunction: "OBJECTION",
    voiceProfile: "JUDICIAL_PARTY",
    draftText: "لائحة اعتراض بالاستئناف… ونطلب نقض الحكم.",
    objectionRoute: "APPEAL",
  });
  check("JG14 يكشف خلط طرق الاعتراض", outcome(route, "JG14") === "FAIL");

  // ④ JG15 — بند منطوقٍ بلا طلبٍ مقابل = FAIL (تجاوز الطلبات).
  const ultra = executeQualityGates({
    documentFunction: "DISPOSITION",
    voiceProfile: "JUDICIAL_BENCH_RESTRICTED",
    draftText: "…",
    hasNonBindingLabel: true,
    requests: ["إلزام المدعى عليه بالمبلغ"],
    dispositionItems: ["إلزام المدعى عليه بالمبلغ", "إلزامه بالحبس"],
  });
  check("JG15 يكشف تجاوز الطلبات", outcome(ultra, "JG15") === "FAIL");

  // ⑤ JG16 — طلبٌ بلا نتيجةٍ في المنطوق = FAIL.
  const inconsistent = executeQualityGates({
    documentFunction: "DISPOSITION",
    voiceProfile: "JUDICIAL_BENCH_RESTRICTED",
    draftText: "…",
    hasNonBindingLabel: true,
    requests: ["إلزام بالمبلغ", "التعويض"],
    dispositionItems: ["إلزام بالمبلغ"],
  });
  check("JG16 يكشف طلبًا بلا نتيجة", outcome(inconsistent, "JG16") === "FAIL");

  // ⑥ JG19 — مخرج محكمةٍ بلا وسمٍ = FAIL.
  const unlabeled = executeQualityGates({
    documentFunction: "DISPOSITION",
    voiceProfile: "JUDICIAL_BENCH_RESTRICTED",
    draftText: "حكمت الدائرة…",
    requests: ["إلزام بالمبلغ"],
    dispositionItems: ["إلزام بالمبلغ"],
    hasNonBindingLabel: false,
  });
  check("JG19 يكشف غياب وسم عدم الإلزام", outcome(unlabeled, "JG19") === "FAIL");

  // ⑦ مبدأ الصدق: JG8 (سريان) وJG9 (استشهاد) لا تُجتاز آليًّا — NEEDS_REVIEW.
  const clean = executeQualityGates({
    documentFunction: "REASONING",
    voiceProfile: "JUDICIAL_BENCH_RESTRICTED",
    draftText: "وحيث إن الثابت من المستند…",
    hasNonBindingLabel: true,
    statements: [{ text: "ثبت الدين بالمستند", assertionLevel: "ESTABLISHED" }],
  });
  check("JG8 (سريان) تُعلَّم NEEDS_REVIEW لا PASS", outcome(clean, "JG8") === "NEEDS_REVIEW");
  check("JG9 (مطابقة استشهاد) تُعلَّم NEEDS_REVIEW لا PASS", outcome(clean, "JG9") === "NEEDS_REVIEW");
  check("JG13 يمرّ لمخرجٍ نظيفٍ متّسق المستوى", outcome(clean, "JG13") === "PASS");

  // ⑧ الجاهزيّة: لا FAIL ⇒ جاهزٌ للمراجعة، مع إبراز بوّابات المراجعة.
  const rr = isReleaseReady(clean);
  check("مخرجٌ نظيفٌ: لا بوّابة مانعة (ready)", rr.ready === true);
  check("مخرجٌ نظيفٌ: توجد بوّابات مراجعة (لا اجتياز مُختلَق)", rr.review.length > 0);
  const rrFail = isReleaseReady(partyMix);
  check("مخرجٌ مخالفٌ: غير جاهز", rrFail.ready === false);

  console.log(`\nنتيجة JDS §27 (gate-executor): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
