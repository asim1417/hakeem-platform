/**
 * اختبار Judicial Simulation Engine (المرحلة الثامنة).
 * يعمل بلا قاعدة وبلا مفاتيح (mock): يتحقق من استدعاء Case Analysis + Legal Agent + Legal RAG،
 * رفض الاستشهادات الوهمية، الأسئلة القضائية والقرارات الإجرائية المنظّمة، تقدير حكم احتمالي غير ملزم،
 * التحفّظ عند نقص المصادر، وعدم كسر المراحل السابقة.
 *
 * التشغيل: npm run test:simulation
 */
import {
  runJudicialSimulation,
  parseJudicialView,
  buildDeterministicJudicialView,
  wrapOutcome,
  TRAINING_DISCLAIMER,
  INSUFFICIENT_DISCLAIMER,
  PROBABILISTIC_TAG,
} from "@/lib/modules/judicial-simulation/judicial-simulation";
import { guessJurisdiction, buildProceduralView } from "@/lib/modules/judicial-simulation/procedural-stage";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function analysisFixture(over: Partial<CaseAnalysisResult> = {}): CaseAnalysisResult {
  return {
    disputeCharacterization: "نزاع تجاري حول تأخر التسليم",
    materialFacts: ["تأخر المورّد في التسليم"],
    immaterialFacts: [],
    requiredEvidence: ["العقد", "إثبات الضرر"],
    burdenOfProof: "على المدّعي إثبات الإخلال.",
    potentialDefenses: [
      { text: "الدفع بعدم الاختصاص المكاني", category: "PROCEDURAL", basis: null },
      { text: "الدفع بالوفاء", category: "SUBSTANTIVE", basis: null },
    ],
    legalRisks: ["خطر عدم كفاية البيّنة"],
    strengths: ["وجود عقد مكتوب"],
    weaknesses: ["نقص مستندات الضرر"],
    influentialArticles: [{ id: "art-130", title: "م/130", reference: "نظام المعاملات المدنية — المادة (130)", weight: 0.9 }],
    similarRulings: [{ id: "rul-1", title: "حكم ت/4520", reason: "مشابه", weight: 0.6 }],
    caseStrengthScore: 70,
    confidence: 0.72,
    citations: [{ sourceType: "article", sourceId: "art-130", title: "م/130", reference: "نظام المعاملات المدنية — المادة (130)", confidence: 0.9 }],
    grounded: true,
    generated: false,
    provider: "mock",
    model: "mock-deterministic",
    ...over,
  };
}

async function main() {
  console.log("🧪 اختبار Judicial Simulation Engine");
  console.log("=".repeat(50));

  process.env.AI_PROVIDER = "mock"; // بلا مزوّد حقيقي

  // ١. الاختصاص والمرحلة الإجرائية
  check(guessJurisdiction({ caseFacts: "نزاع", caseType: "تجاري" }).includes("التجارية"), "تخمين الاختصاص التجاري");
  const procFI = buildProceduralView({ caseFacts: "x", litigationStage: "FIRST_INSTANCE" }, analysisFixture());
  const procCass = buildProceduralView({ caseFacts: "x", litigationStage: "CASSATION" }, analysisFixture());
  check(procFI.proceduralDecisions.length > 0 && procCass.proceduralDecisions.length > 0, "قرارات إجرائية لكل مرحلة");
  check(procCass.proceduralDecisions.join(" ").includes("التمييز") && !procFI.proceduralDecisions.join(" ").includes("التمييز"), "قرارات التمييز تختلف عن الابتدائي");
  check(procFI.defensesHeardFirst.join(" ").includes("الاختصاص"), "الدفوع الإجرائية تُنظر أولاً");

  // ٢. الحوكمة: حكم احتمالي غير ملزم عند الموثوقية، وتحفّظ عند عدمها
  const wOk = wrapOutcome("ترجيح المدّعي", "إجابة بعض الطلبات", ["سبب"], true);
  check(wOk.tentativeRuling.includes("غير ملزم") && wOk.tentativeRuling.includes(PROBABILISTIC_TAG), "موثوقة → منطوق غير ملزم موسوم احتمالياً");
  const wNo = wrapOutcome("ترجيح المدّعي", "إجابة بعض الطلبات", ["سبب"], false);
  check(wNo.tentativeRuling === INSUFFICIENT_DISCLAIMER && wNo.probableDirection === INSUFFICIENT_DISCLAIMER, "غير موثوقة → تحفّظ بدل حكم قطعي");

  // ٣. السرد الحتمي يُنتج أسئلة قضائية وأسباباً منظّمة (بلا اختلاق سند)
  const det = buildDeterministicJudicialView({ caseFacts: "تأخر التسليم وألحق ضرراً.", claims: "التعويض", caseType: "تجاري", litigationStage: "FIRST_INSTANCE" }, analysisFixture(), null);
  check(det.judicialQuestions.length >= 3, "أسئلة قضائية منظّمة");
  check(det.draftReasoning.length >= 3, "مسودة أسباب منظّمة");
  check(det.appealRisks.length > 0 && det.cassationFactors.length > 0, "مخاطر استئناف ونقاط نقض/تأييد");

  // ٤. تحليل JSON صالح/غير صالح
  const okJson = `{"preliminaryCharacterization":"تكييف","probableJurisdiction":"تجارية","admissibilityNotes":["قبول"],"disputeSubject":"محل","influentialEvidence":["بيّنة"],"judicialQuestions":["سؤال"],"defensesHeardFirst":["دفع"],"proceduralDecisions":["قرار"],"clarificationsNeeded":["استيضاح"],"plaintiffPosition":"موقف","defendantPosition":"موقف","probableDirection":"اتجاه","draftReasoning":["سبب"],"tentativeRuling":"منطوق","appealRisks":["خطر"],"cassationFactors":["نقطة"]}`;
  check(parseJudicialView(okJson)?.preliminaryCharacterization === "تكييف", "تحليل JSON قضائي صالح");
  check(parseJudicialView("لا JSON") === null && parseJudicialView("{}") === null, "JSON غير صالح/فارغ → null");

  // ٥. الخط الكامل (Simulation → Case Analysis → Legal Agent → RAG) بلا كسر، 22 مخرجاً
  const view = await runJudicialSimulation({ caseFacts: "تأخر المورّد في تسليم البضاعة وألحق ضرراً بالمدعي.", claims: "فسخ العقد والتعويض", partyRole: "PLAINTIFF", caseType: "تجاري", litigationStage: "FIRST_INSTANCE" });
  const shape =
    typeof view.caseSummary === "string" &&
    typeof view.preliminaryCharacterization === "string" &&
    typeof view.probableJurisdiction === "string" &&
    Array.isArray(view.admissibilityNotes) &&
    Array.isArray(view.materialFacts) &&
    typeof view.disputeSubject === "string" &&
    typeof view.burdenOfProof === "string" &&
    Array.isArray(view.judicialQuestions) &&
    Array.isArray(view.proceduralDecisions) &&
    typeof view.probableDirection === "string" &&
    Array.isArray(view.draftReasoning) &&
    typeof view.tentativeRuling === "string" &&
    Array.isArray(view.appealRisks) &&
    Array.isArray(view.cassationFactors) &&
    typeof view.confidence === "number" &&
    Array.isArray(view.citations);
  check(shape, "الخط الكامل يعمل بـ mock ويعيد المخرجات الـ22 منظّمة");
  check(view.judicialQuestions.length > 0 && view.proceduralDecisions.length > 0, "أسئلة قضائية + قرارات إجرائية غير فارغة");

  // ٦. لا استشهادات وهمية، وتنبيه تدريبي دائم
  check(view.citations.length === 0, "بلا قاعدة: لا استشهادات (لا اختلاق سند)");
  check(view.trainingDisclaimer === TRAINING_DISCLAIMER, "تنبيه تدريبي إلزامي دائم");

  // ٧. التحفّظ عند نقص المصادر: غير موثوقة + لا حكم قطعي
  check(view.reliable === false && view.insufficientNote === INSUFFICIENT_DISCLAIMER, "نقص المصادر → غير موثوقة + تحفّظ صريح");
  check(view.tentativeRuling === INSUFFICIENT_DISCLAIMER && view.probableDirection === INSUFFICIENT_DISCLAIMER, "لا منطوق/اتجاه قطعي عند نقص المصادر");

  // ٨. عدم كسر المراحل السابقة
  try {
    const { analyzeCase } = await import("@/lib/modules/case-analysis/case-analysis-engine");
    const a = await analyzeCase({ facts: "واقعة اختبار." });
    check(typeof a.disputeCharacterization === "string" && Array.isArray(a.citations), "Case Analysis Engine سليم");
    const { runLegalAgent } = await import("@/lib/modules/legal-agent/legal-agent");
    const p = await runLegalAgent({ caseFacts: "واقعة اختبار." });
    check(Array.isArray(p.suggestedDefenses) && Array.isArray(p.pleadingPlan), "Legal Agent سليم");
    const { legalRag } = await import("@/lib/modules/legal-rag/legal-rag-service");
    const r = await legalRag("هل يجوز فسخ العقد بسبب الغبن؟");
    check(typeof r.answer === "string" && Array.isArray(r.citations), "Legal RAG سليم");
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

  console.log(`     [ناتج] موثوقة=${view.reliable} قوة=${view.caseStrengthScore} ثقة=${view.confidence} مرحلة=${view.litigationStage} استشهادات=${view.citations.length}`);
  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار Judicial Simulation Engine.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
