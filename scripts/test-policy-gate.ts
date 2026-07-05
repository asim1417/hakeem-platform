/**
 * اختبار البوابات الحتمية (policy-gate) — نقيّ، بلا نموذج/قاعدة.
 * يضمن حوكمة الاسترجاع والتقرير وتجريد الاستشهاد غير المُسنَد. التشغيل: npm run test:policy-gate
 */
import {
  allowRetrieval,
  evaluateReportGate,
  stripUnsourcedCitations,
  tagAsSuggestion,
  guardLegalReply,
  SANAD_SUGGESTION_TAG,
} from "@/lib/modules/legal-chat/policy-gate";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار البوابات الحتمية");
  console.log("=".repeat(56));

  // البوّابة ١ — الاسترجاع
  check(allowRetrieval({ intent: "legal_request", isLegal: true, needsLegalTools: true }), "طلب قانوني يحتاج أداة → مسموح");
  check(!allowRetrieval({ intent: "greeting", isLegal: false, needsLegalTools: false }), "تحية → ممنوع");
  check(!allowRetrieval({ intent: "legal_request", isLegal: true, needsLegalTools: false }), "قانوني لكن بلا حاجة أداة → ممنوع");
  check(!allowRetrieval({ intent: "smalltalk", isLegal: true, needsLegalTools: true }), "نيّة غير استرجاعية → ممنوع");

  // البوّابة ٢ — التقرير
  check(evaluateReportGate({ readyForReport: true, approved: true, readinessScore: 0.8 }).allowed, "جاهز+موافقة+جاهزية → يُعرض");
  check(!evaluateReportGate({ readyForReport: true, approved: false, readinessScore: 0.9 }).allowed, "بلا موافقة صريحة → لا يُعرض");
  check(!evaluateReportGate({ readyForReport: false, approved: true, readinessScore: 0.9 }).allowed, "النموذج لم يُقرّ الاكتمال → لا يُعرض");
  check(!evaluateReportGate({ readyForReport: true, approved: true, readinessScore: 0.3 }).allowed, "جاهزية دون الحدّ → لا يُعرض");

  // البوّابة ٣ — تجريد الاستشهاد غير المُسنَد
  const s1 = stripUnsourcedCitations("استنادًا إلى المادة (77) يحق لك ذلك.", new Set());
  check(s1.strippedCount === 1 && !s1.text.includes("77") && s1.text.includes("المادة ذات الصلة"), "مادة بلا مصدر تُجرَّد (حواري)");
  const s2 = stripUnsourcedCitations("بموجب المادة (5) والمادة (99).", new Set([5]));
  check(s2.strippedCount === 1 && s2.text.includes("(5)") && !s2.text.includes("(99)"), "يُبقي المسموح (5) ويجرّد غير المسموح (99)");
  const s3 = stripUnsourcedCitations("راجع الحكم رقم 1234 الصادر ضدك.", new Set());
  check(s3.strippedCount === 1 && !s3.text.includes("1234"), "رقم حكم يُجرَّد");
  const s4 = stripUnsourcedCitations("أنصحك بتقديم بلاغ لدى الشرطة.", new Set());
  check(s4.strippedCount === 0 && !s4.text.includes("ملاحظة"), "ردّ بلا استشهاد لا يتغيّر");

  // البوّابة ٤ — وسم سَنَد
  check(tagAsSuggestion("تحليل مبدئي").includes(SANAD_SUGGESTION_TAG), "يُضاف وسم سَنَد");
  check(tagAsSuggestion(`نص ${SANAD_SUGGESTION_TAG}`).split(SANAD_SUGGESTION_TAG).length === 2, "لا يتكرّر الوسم");

  // التجميع
  const g = guardLegalReply("بموجب المادة (300) لك حق.", { tagSuggestion: true });
  check(g.strippedCount === 1 && g.text.includes(SANAD_SUGGESTION_TAG) && !g.text.includes("300"), "guardLegalReply: تجريد + وسم");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار البوابات الحتمية.");
}

main();
