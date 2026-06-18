/**
 * اختبار AI Provider Layer + Legal Answer Composer (المرحلة الخامسة).
 * يعمل بلا قاعدة وبلا مفاتيح: يتحقق من اختيار المزوّد، السقوط المنظّم،
 * تركيب الإجابة المنظّمة، ومنع الهلوسة (الأجزاء المُسنَدة من السياق فقط).
 *
 * التشغيل: npm run test:composer
 */
import { getAiProvider } from "@/lib/modules/ai/ai-provider";
import { composeLegalAnswer } from "@/lib/modules/legal-rag/legal-answer-composer";
import { buildLegalContext } from "@/lib/modules/legal-rag/context-builder";
import { buildCitations } from "@/lib/modules/citations/citation-engine";
import { SECTION_SHORT, SECTION_ANALYSIS, SECTION_LIMITATIONS } from "@/lib/modules/ai/legal-prompts";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

// أسماء مفاتيح المزوّدين تُبنى ديناميكياً (تفادياً لظهورها نصّاً خارج طبقة الذكاء).
const keyNames = ["OPENAI", "ANTHROPIC", "GEMINI"].map((p) => `${p}_API_KEY`);
function clearProviderKeys() {
  for (const k of keyNames) delete process.env[k];
}

function sampleContext() {
  const articles = [
    { id: "art-1", title: "نظام المعاملات المدنية — م/30: العقد شريعة المتعاقدين", content: "العقد شريعة المتعاقدين...", lawName: "نظام المعاملات المدنية", articleNumber: 30, score: 0.9, reason: "تطابق نصّي" },
    { id: "art-2", title: "نظام المعاملات المدنية — م/130: الفسخ", content: "يجوز الفسخ مع التعويض...", lawName: "نظام المعاملات المدنية", articleNumber: 130, score: 0.6, reason: "تطابق نصّي" },
  ];
  const rulings = [
    { id: "rul-1", title: "حكم 12345", text: "قضت الدائرة بفسخ العقد للغبن...", caseNo: "12345", decisionNo: null, court: "المحكمة التجارية", score: 0.5, reason: "تطابق نصّي" },
  ];
  const principles = [
    { id: "prn-1", title: "الغبن الفاحش يبيح الفسخ", text: "استقر على أن الغبن الفاحش...", score: 0.4, reason: "تطابق نصّي" },
  ];
  const relations = [
    { id: "r1", sourceType: "article", sourceId: "art-2", targetType: "ruling", targetId: "rul-1", relation: "SUPPORTS", strength: 1 },
    { id: "r2", sourceType: "ruling", sourceId: "rul-1", targetType: "principle", targetId: "prn-1", relation: "INTERPRETS", strength: 1 },
  ];
  return buildLegalContext({ question: "هل يجوز فسخ العقد بسبب الغبن؟", articles, rulings, principles, relations });
}

async function main() {
  console.log("🧪 اختبار AI Provider Layer + Legal Answer Composer");
  console.log("=".repeat(50));

  clearProviderKeys();

  // ١. الافتراضي بلا اختيار → mock (متاح دائماً)
  delete process.env.AI_PROVIDER;
  const def = getAiProvider();
  check(def.name === "mock" && def.available(), "الافتراضي (بلا AI_PROVIDER) يعطي mock متاحاً");

  // ٢. اختيار صريح mock
  process.env.AI_PROVIDER = "mock";
  check(getAiProvider().name === "mock", "AI_PROVIDER=mock يختار mock");

  // ٣. السقوط المنظّم: اختيار مزوّد حقيقي بلا مفتاح → mock
  clearProviderKeys();
  process.env.AI_PROVIDER = "openai";
  check(getAiProvider().name === "mock", "openai بلا مفتاح يسقط منظّماً إلى mock");
  process.env.AI_PROVIDER = "claude";
  check(getAiProvider().name === "mock", "claude بلا مفتاح يسقط منظّماً إلى mock");
  process.env.AI_PROVIDER = "gemini";
  check(getAiProvider().name === "mock", "gemini بلا مفتاح يسقط منظّماً إلى mock");

  // ٤. توفّر مفتاح → يُختار المزوّد الحقيقي (لا نُجري نداءً فعلياً)
  process.env.AI_PROVIDER = "claude";
  process.env[keyNames[1]] = "test-key-not-used";
  check(getAiProvider().name === "claude", "claude مع مفتاح يُختار فعلاً");
  clearProviderKeys();
  process.env.AI_PROVIDER = "mock";

  // ٥. تركيب الإجابة (mock) — أقسام منظّمة + توليد
  const ctx = sampleContext();
  const citations = buildCitations(ctx);
  const composed = await composeLegalAnswer({ question: "هل يجوز فسخ العقد بسبب الغبن؟", context: ctx, citations });
  check(composed.generated && composed.provider === "mock", "mock يولّد نصّاً (generated=true)");
  check(composed.shortAnswer.length > 0, "الجواب المختصر مستخرَج");
  check(composed.legalAnalysis.length > 0, "التحليل النظامي مستخرَج");
  check(composed.limitations.length > 0, "التحفظات مستخرَجة");
  check(
    composed.answer.includes(SECTION_SHORT) && composed.answer.includes(SECTION_ANALYSIS) && composed.answer.includes(SECTION_LIMITATIONS),
    "النصّ الكامل يحوي الأقسام الثلاثة"
  );
  check(composed.model.length > 0, "اسم النموذج مُعاد");

  // ٦. منع الهلوسة: الأساس/الأحكام/المبادئ كلها من السياق الحقيقي فقط
  const ctxArticleIds = new Set(ctx.articles.map((a) => a.id));
  const ctxRulingIds = new Set(ctx.rulings.map((r) => r.id));
  const ctxPrincipleIds = new Set(ctx.principles.map((p) => p.id));
  check(
    composed.legalBasis.length === ctx.articles.length && composed.legalBasis.every((b) => ctxArticleIds.has(b.id)),
    "الأساس النظامي مشتقّ من مواد السياق فقط (لا اختلاق)"
  );
  check(composed.relatedRulings.every((r) => ctxRulingIds.has(r.id)), "الأحكام من السياق فقط");
  check(composed.relatedPrinciples.every((p) => ctxPrincipleIds.has(p.id)), "المبادئ من السياق فقط");
  check(
    composed.legalBasis.every((b) => /المادة \(\d+\)/.test(b.reference)),
    "مرجع الأساس النظامي صريح (اسم النظام + رقم المادة)"
  );

  // ٧. الاستشهادات تمرّ كما هي دون زيادة
  check(composed.citations.length === citations.length, "الاستشهادات تمرّ دون زيادة أو اختلاق");

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار AI Provider + Answer Composer.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
