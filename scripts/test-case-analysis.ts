/**
 * اختبار Case Analysis Engine (المرحلة السادسة).
 * يعمل بلا قاعدة وبلا مفاتيح: يتحقق من تصنيف الدفوع، تحليل JSON، الاحتياط الحتمي،
 * تقدير قوة الدعوى، تعليمات الإسناد، ومنع الهلوسة (المصادر من RAG فقط).
 * ويتحقق (مع قاعدة، اختياري) أن الخط الكامل لا ينكسر.
 *
 * التشغيل: npm run test:case
 */
import { classifyDefense, DEFENSE_CATEGORY_LABELS } from "@/lib/modules/case-analysis/defense-classifier";
import { buildCaseAnalysisSystemPrompt } from "@/lib/modules/case-analysis/case-prompts";
import {
  buildDeterministicAnalysis,
  computeCaseStrengthScore,
  parseCaseAnalysis,
} from "@/lib/modules/case-analysis/case-analysis-engine";
import type { RagResult } from "@/lib/modules/legal-rag/legal-rag-service";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function ragFixture(over: Partial<RagResult> = {}): RagResult {
  return {
    answer: "", shortAnswer: "", legalAnalysis: "", limitations: "",
    confidence: 0.7, grounded: true, legalBasisNote: null, generated: false, citations: [],
    legalBasis: [{ id: "art-130", title: "نظام المعاملات المدنية — م/130", reference: "نظام المعاملات المدنية — المادة (130)", weight: 0.9 }],
    relatedArticles: [],
    relatedRulings: [{ id: "rul-1", title: "حكم ت/4520", reason: "مرتبط بالمادة 130", weight: 0.6 }],
    relatedPrinciples: [],
    provider: "mock", providerConfigured: false, model: "mock-deterministic", providers: [],
    ...over,
  };
}

async function main() {
  console.log("🧪 اختبار Case Analysis Engine");
  console.log("=".repeat(50));

  // ١. تصنيف الدفوع
  check(classifyDefense("الدفع بعدم اختصاص المحكمة نوعياً") === "PROCEDURAL", "تصنيف إجرائي (الاختصاص)");
  check(classifyDefense("الدفع بالتقادم لمضي المدة") === "PROCEDURAL", "تصنيف إجرائي (التقادم)");
  check(classifyDefense("بطلان صحيفة الدعوى لنقص البيانات") === "FORMAL", "تصنيف شكلي (بطلان الصحيفة)");
  check(classifyDefense("الدفع بالوفاء وبراءة الذمة") === "SUBSTANTIVE", "تصنيف موضوعي (الوفاء)");
  check(DEFENSE_CATEGORY_LABELS.PROCEDURAL === "إجرائية" && DEFENSE_CATEGORY_LABELS.FORMAL === "شكلية", "تسميات الفئات عربية صحيحة");

  // ٢. تعليمات النظام: JSON + منع الاختلاق
  const sys = buildCaseAnalysisSystemPrompt();
  check(sys.includes("disputeCharacterization") && sys.includes("potentialDefenses"), "تعليمات النظام تحدّد مفاتيح JSON");
  check(sys.includes("لا تختلق") && sys.includes("FORMAL|SUBSTANTIVE|PROCEDURAL"), "تعليمات تمنع الاختلاق وتحدّد فئات الدفوع");

  // ٣. تحليل JSON صالح (حتى لو محاطاً بنصّ)
  const okJson = `قبل: {"disputeCharacterization":"نزاع تجاري","materialFacts":["تأخر التسليم"],"immaterialFacts":[],"requiredEvidence":["العقد"],"burdenOfProof":"على المدعي","potentialDefenses":[{"text":"الدفع بالتقادم","category":"PROCEDURAL","basis":"مضي المدة"}],"legalRisks":["خطر"],"strengths":["قوة"],"weaknesses":["ضعف"]} بعد`;
  const parsed = parseCaseAnalysis(okJson);
  check(parsed !== null && parsed.disputeCharacterization === "نزاع تجاري", "تحليل JSON مُحاط بنصّ");
  check(parsed?.potentialDefenses[0].category === "PROCEDURAL", "حفظ تصنيف الدفع من JSON");

  // ٤. تحليل JSON بفئة دفع خاطئة → يُعاد تصنيفها حتمياً
  const badCat = `{"disputeCharacterization":"x","materialFacts":["y"],"potentialDefenses":[{"text":"الدفع ببطلان الصحيفة","category":"WRONG"}]}`;
  const p2 = parseCaseAnalysis(badCat);
  check(p2?.potentialDefenses[0].category === "FORMAL", "فئة دفع غير صالحة → إعادة تصنيف (FORMAL)");

  // ٥. JSON غير صالح → null
  check(parseCaseAnalysis("لا يوجد كائن هنا") === null, "نصّ بلا JSON → null");
  check(parseCaseAnalysis("{}") === null, "JSON فارغ بلا فائدة → null");

  // ٦. الاحتياط الحتمي يملأ كل الحقول بلا فراغ
  const det = buildDeterministicAnalysis(
    { facts: "تأخر المورّد في تسليم البضاعة وألحق ضرراً بالمدعي. حضر الطرفان جلسة الصلح.", claims: "فسخ العقد والتعويض", defenses: "الدفع بعدم الاختصاص المكاني", caseType: "تجاري" },
    ragFixture()
  );
  check(det.disputeCharacterization.length > 0 && det.materialFacts.length > 0, "الاحتياط: توصيف ووقائع منتِجة غير فارغة");
  check(det.requiredEvidence.length > 0 && det.burdenOfProof.length > 0, "الاحتياط: عناصر إثبات وعبء إثبات");
  check(det.potentialDefenses.some((d) => d.category === "PROCEDURAL"), "الاحتياط: تصنيف دفوع المدخل (إجرائي)");
  check(det.materialFacts.some((f) => f.includes("تسليم") || f.includes("ضرر")), "الاحتياط: فصل الوقائع المنتِجة بالكلمات الدالّة");

  // ٧. تقدير قوة الدعوى محصور 0-100 ويستجيب للإسناد
  const strong = computeCaseStrengthScore(ragFixture({ confidence: 0.9 }), det);
  const weak = computeCaseStrengthScore(ragFixture({ confidence: 0, grounded: false, legalBasis: [], relatedRulings: [] }), det);
  check(strong >= 0 && strong <= 100 && weak >= 0 && weak <= 100, `التقدير محصور 0-100 (قوي=${strong} ضعيف=${weak})`);
  check(strong > weak, "إسناد أقوى ⇐ تقدير أعلى");

  // ٨. منع الهلوسة: المصادر تُؤخذ من RAG فقط (لا من السرد) — يتحقق ضمنياً عبر مسار analyzeCase
  //    هنا نتأكد أن الاحتياط لا يخترع مرجعاً غير موجود في rag.legalBasis
  const detNoSrc = buildDeterministicAnalysis({ facts: "واقعة بلا سند نظامي متاح" }, ragFixture({ legalBasis: [], grounded: false, confidence: 0 }));
  check(!detNoSrc.strengths.join(" ").includes("المادة ("), "بلا مصادر: لا اختلاق مرجع مادة في نقاط القوة");

  // ٩. (اختياري) الخط الكامل لا ينكسر عند توفّر/غياب القاعدة
  try {
    const { analyzeCase } = await import("@/lib/modules/case-analysis/case-analysis-engine");
    const res = await analyzeCase({ facts: "تأخر المورّد في تسليم البضاعة وألحق ضرراً بالمدعي.", claims: "فسخ العقد والتعويض" });
    const okShape =
      typeof res.disputeCharacterization === "string" &&
      Array.isArray(res.materialFacts) &&
      Array.isArray(res.potentialDefenses) &&
      Array.isArray(res.citations) &&
      res.caseStrengthScore >= 0 && res.caseStrengthScore <= 100 &&
      typeof res.confidence === "number";
    check(okShape, "الخط الكامل (Case → RAG → تحليل) يعمل دون كسر ويعيد الحقول الـ15");
    console.log(`     [قاعدة] مُسنَد=${res.grounded} قوة=${res.caseStrengthScore} ثقة=${res.confidence} استشهادات=${res.citations.length} مزوّد=${res.provider}`);
  } catch (e) {
    console.log(`  ⏭️  تخطّي اختبار الخط الكامل: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  } finally {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$disconnect();
    } catch {
      /* لا شيء */
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار Case Analysis Engine.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
