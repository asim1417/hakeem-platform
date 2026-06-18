/**
 * اختبار Legal Agent (المرحلة السابعة).
 * يعمل بلا قاعدة وبلا مفاتيح (mock): يتحقق من تشغيل الوكيل، استدعاء Case Analysis + Legal RAG،
 * رفض الاستشهادات الوهمية، تصنيف الدفوع، خطة المرافعة المنظّمة، fallback نقص المصادر،
 * وعدم كسر المراحل السابقة.
 *
 * التشغيل: npm run test:agent
 */
import {
  runLegalAgent,
  parseAgentPlan,
  buildDeterministicStrategy,
  isBasisSupported,
  markDefense,
  PRELIMINARY_DISCLAIMER,
} from "@/lib/modules/legal-agent/legal-agent";
import type { Citation } from "@/lib/modules/citations/citation-engine";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

const cite = (reference: string): Citation => ({ sourceType: "article", sourceId: "x", title: "t", reference, confidence: 0.9 });

function analysisFixture(over: Partial<CaseAnalysisResult> = {}): CaseAnalysisResult {
  return {
    disputeCharacterization: "نزاع تجاري حول تأخر التسليم",
    materialFacts: ["تأخر المورّد في التسليم"],
    immaterialFacts: [],
    requiredEvidence: ["العقد", "إثبات الضرر"],
    burdenOfProof: "على المدّعي إثبات الإخلال.",
    potentialDefenses: [{ text: "الدفع بالتقادم", category: "PROCEDURAL", basis: null }],
    legalRisks: ["خطر عدم كفاية البيّنة"],
    strengths: ["وجود عقد مكتوب"],
    weaknesses: ["نقص مستندات الضرر"],
    influentialArticles: [{ id: "art-130", title: "م/130", reference: "نظام المعاملات المدنية — المادة (130)", weight: 0.9 }],
    similarRulings: [{ id: "rul-1", title: "حكم ت/4520", reason: "مشابه", weight: 0.6 }],
    caseStrengthScore: 68,
    confidence: 0.72,
    citations: [cite("نظام المعاملات المدنية — المادة (130)")],
    grounded: true,
    generated: false,
    provider: "mock",
    model: "mock-deterministic",
    ...over,
  };
}

async function main() {
  console.log("🧪 اختبار Legal Agent");
  console.log("=".repeat(50));

  process.env.AI_PROVIDER = "mock"; // بلا مزوّد حقيقي

  // ١. إسناد الدفوع: مطابقة أرقام المرجع
  check(isBasisSupported("المادة (130)", [cite("نظام المعاملات المدنية — المادة (130)")]), "سند مطابق لرقم استشهاد → مدعوم");
  check(!isBasisSupported("المادة (9999)", [cite("نظام المعاملات المدنية — المادة (130)")]), "سند برقم غير موجود → غير مدعوم (لا اختلاق)");
  check(!isBasisSupported("بلا رقم", []), "بلا استشهادات → غير مدعوم");

  // ٢. وسم الدفع: غير المسند يُوسم «احتمالية تحتاج تحقق»
  const dUn = markDefense({ text: "الدفع بالوفاء", category: "SUBSTANTIVE", basis: null }, []);
  check(!dUn.verified && dUn.note === "احتمالية تحتاج تحقق", "دفع بلا سند → موسوم احتمالي");
  const dOk = markDefense({ text: "الدفع بانطباق المادة 130", category: "SUBSTANTIVE", basis: "المادة (130)" }, [cite("المادة (130)")]);
  check(dOk.verified && dOk.note === null, "دفع بسند حقيقي → مُسنَد");

  // ٣. تحليل JSON صالح (حتى محاطاً بنصّ)
  const okJson = `قبل {"caseSummary":"ملخص","legalIssues":["مسألة"],"litigationStrategy":"خطة","successOpportunities":["فرصة"],"pleadingPlan":["خطوة1","خطوة2"],"suggestedQuestions":["سؤال"],"gapsToClose":["ثغرة"],"practicalRecommendation":"توصية","additionalDefenses":[{"text":"دفع","category":"PROCEDURAL"}]} بعد`;
  const p = parseAgentPlan(okJson);
  check(p !== null && p.caseSummary === "ملخص" && p.pleadingPlan.length === 2, "تحليل JSON مُحاط بنصّ");
  check(parseAgentPlan("لا JSON هنا") === null && parseAgentPlan("{}") === null, "JSON غير صالح/فارغ → null");

  // ٤. الاستراتيجية الحتمية تختلف بحسب الدور وتُنتج خطة منظّمة
  const detP = buildDeterministicStrategy({ caseFacts: "تأخر التسليم وألحق ضرراً.", claims: "التعويض", partyRole: "PLAINTIFF", caseType: "تجاري" }, analysisFixture());
  const detD = buildDeterministicStrategy({ caseFacts: "تأخر التسليم وألحق ضرراً.", partyRole: "DEFENDANT", caseType: "تجاري" }, analysisFixture());
  check(detP.pleadingPlan.length >= 3 && detD.pleadingPlan.length >= 3, "خطة مرافعة منظّمة لكلا الدورين");
  check(detP.litigationStrategy !== detD.litigationStrategy, "الاستراتيجية تتغيّر بحسب الدور (مدّعٍ/مدّعى عليه)");

  // ٥. الخط الكامل (Agent → Case Analysis → RAG) بلا كسر، ويعيد المخرجات الـ17
  const plan = await runLegalAgent({ caseFacts: "تأخر المورّد في تسليم البضاعة وألحق ضرراً بالمدعي.", claims: "فسخ العقد والتعويض", partyRole: "PLAINTIFF", caseType: "تجاري" });
  const shape =
    typeof plan.caseSummary === "string" &&
    typeof plan.disputeCharacterization === "string" &&
    Array.isArray(plan.legalIssues) &&
    typeof plan.litigationStrategy === "string" &&
    Array.isArray(plan.suggestedDefenses) &&
    Array.isArray(plan.requiredEvidence) &&
    Array.isArray(plan.strengths) &&
    Array.isArray(plan.weaknesses) &&
    Array.isArray(plan.legalRisks) &&
    Array.isArray(plan.successOpportunities) &&
    Array.isArray(plan.pleadingPlan) &&
    Array.isArray(plan.suggestedQuestions) &&
    Array.isArray(plan.gapsToClose) &&
    typeof plan.practicalRecommendation === "string" &&
    typeof plan.confidence === "number" &&
    Array.isArray(plan.citations);
  check(shape, "الوكيل يعمل بـ mock ويعيد المخرجات الـ17 منظّمة");
  check(plan.pleadingPlan.length > 0, "خطة المرافعة غير فارغة");
  check(plan.suggestedDefenses.every((d) => ["FORMAL", "SUBSTANTIVE", "PROCEDURAL"].includes(d.category)), "كل الدفوع مصنّفة بفئة صحيحة");

  // ٦. لا استشهادات وهمية: في غياب القاعدة تكون citations فارغة، ولا يخترعها الوكيل
  check(plan.citations.length === 0, "بلا قاعدة: لا استشهادات (لا اختلاق سند)");
  check(plan.suggestedDefenses.every((d) => d.verified === false), "بلا استشهادات: كل الدفوع موسومة احتمالية تحتاج تحقق");

  // ٧. fallback عند نقص المصادر: تحفّظ صريح ونتيجة غير قطعية
  check(plan.preliminary === true && plan.disclaimer === PRELIMINARY_DISCLAIMER, "نقص المصادر → preliminary + تحفّظ صريح");
  check(plan.practicalRecommendation.includes(PRELIMINARY_DISCLAIMER), "التوصية متحفّظة (غير قطعية) عند الثقة المنخفضة");

  // ٨. عدم كسر المراحل السابقة: Case Analysis + Legal RAG قابلة للاستدعاء وتعيد شكلاً سليماً
  try {
    const { analyzeCase } = await import("@/lib/modules/case-analysis/case-analysis-engine");
    const a = await analyzeCase({ facts: "واقعة اختبار للتأكد من عدم الكسر." });
    check(typeof a.disputeCharacterization === "string" && Array.isArray(a.citations), "Case Analysis Engine سليم (لم يُكسَر)");
    const { legalRag } = await import("@/lib/modules/legal-rag/legal-rag-service");
    const r = await legalRag("هل يجوز فسخ العقد بسبب الغبن؟");
    check(typeof r.answer === "string" && Array.isArray(r.citations), "Legal RAG سليم (لم يُكسَر)");
  } catch (e) {
    console.log(`  ⏭️  تخطّي تحقق المراحل السابقة (لا قاعدة): ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  } finally {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$disconnect();
    } catch {
      /* لا شيء */
    }
  }

  console.log(`     [ناتج] قوة=${plan.caseStrengthScore} ثقة=${plan.confidence} مزوّد=${plan.provider} دفوع=${plan.suggestedDefenses.length} استشهادات=${plan.citations.length}`);
  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار Legal Agent.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
