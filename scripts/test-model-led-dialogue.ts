/**
 * اختبار قبول إعادة هندسة الحوار (المرحلة ٧) — مصفوفة سيناريوهات على البوابات
 * الحتمية ومراجع الجودة. يثبت أن نصف الحوكمة يبقى صارمًا مهما قال النموذج.
 * (السلاسة اللغوية نفسها تتطلّب مفتاحًا حيًّا؛ هنا نتحقّق من الحراسة الحتمية.)
 * التشغيل: npm run test:dialogue-acceptance
 */
import { allowRetrieval, evaluateReportGate } from "@/lib/modules/legal-chat/policy-gate";
import { finalizeReply, verifyReply, countQuestions } from "@/lib/modules/legal-chat/response-verifier";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

// محاكاة مخرَج النموذج (view للبوابة) لكل سيناريو.
const brain = (intent: string, isLegal: boolean, needsLegalTools: boolean) => ({ intent, isLegal, needsLegalTools });

function main() {
  console.log("🧪 اختبار قبول الحوار الموجَّه بالنموذج (الحوكمة)");
  console.log("=".repeat(60));

  console.log("\n— خارج النطاق والهوية: لا أدوات —");
  check(!allowRetrieval(brain("out_of_scope", false, false)), "«وش اخبار البطاطس» → لا استرجاع");
  check(!allowRetrieval(brain("out_of_scope", false, true)), "«وش جديد المكياج» → لا استرجاع");
  check(!allowRetrieval(brain("identity", false, false)), "«ما اسمك» → لا استرجاع");
  check(!allowRetrieval(brain("greeting", false, false)), "«السلام عليكم» → لا استرجاع");
  check(!allowRetrieval(brain("smalltalk", false, true)), "دردشة ولو ادّعى النموذج حاجة أداة → لا استرجاع");

  console.log("\n— الوقائع القانونية: استرجاع مسموح فقط بالشروط —");
  check(allowRetrieval(brain("legal_request", true, true)), "«اشتريت شقة وفيها عيب وأريد حلًّا» → استرجاع مسموح");
  check(allowRetrieval(brain("legal_incident", true, true)), "واقعة قانونية تحتاج أداة → مسموح");
  check(!allowRetrieval(brain("legal_request", true, false)), "قانوني لكن بلا حاجة أداة → لا استرجاع");

  console.log("\n— بوّابة التقرير: لا تقرير قبل اكتمال الوقائع والموافقة —");
  check(!evaluateReportGate({ readyForReport: true, approved: false, readinessScore: 0.9 }).allowed, "بلا موافقة صريحة → لا تقرير");
  check(!evaluateReportGate({ readyForReport: false, approved: true, readinessScore: 0.9 }).allowed, "وقائع غير مكتملة → لا تقرير");
  check(!evaluateReportGate({ readyForReport: true, approved: true, readinessScore: 0.4 }).allowed, "جاهزية منخفضة → لا تقرير");
  check(evaluateReportGate({ readyForReport: true, approved: true, readinessScore: 0.8 }).allowed, "اكتمال + موافقة + جاهزية → يُعرض");

  console.log("\n— منع الهلوسة: أي رقم مادة/حكم من النموذج يُجرَّد —");
  const hallucinated = finalizeReply("في مثل حالتك تنطبق المادة (77) من نظام العمل، والحكم رقم 123.");
  check(!hallucinated.includes("77") && !hallucinated.includes("123"), "المادة/الحكم المهلوسان يُجرَّدان");
  check(hallucinated.includes("ملاحظة"), "يُضاف تنويه عند التجريد");

  console.log("\n— سؤال واحد لا عدّة —");
  check(countQuestions(finalizeReply("هل أنت المدّعى عليه؟ وهل لديك صحيفة الدعوى؟")) === 1, "يُفرَض سؤال واحد");

  console.log("\n— قابلية الفحص العامة —");
  check(verifyReply("أنا «حكيم»، مساعد قانوني سعودي. عن أي موضوع نبدأ؟").ok, "ردّ هوية سليم يمرّ");
  check(!verifyReply("راجع المادة (5) والمادة (9) والمادة (12).").ok, "ردّ مشحون باستشهادات غير مُسنَدة يُرفض");

  console.log("\n" + "=".repeat(60));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار قبول الحوكمة في الحوار الموجَّه بالنموذج.");
}

main();
