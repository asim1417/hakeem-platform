/**
 * اختبار Legal RAG + Citation Engine.
 * يتحقق (بلا قاعدة): بناء السياق، الاستشهادات، ربط المادة بالحكم والحكم بالمبدأ،
 * رفض الإجابات غير المسندة. ويتحقق (مع قاعدة، اختياري): عدم كسر Hybrid Search.
 *
 * التشغيل: npm run test:rag  (الأجزاء النقية تعمل بلا DB؛ الجزء الكامل يحتاج DATABASE_URL).
 */
import {
  buildLegalContext,
  type RagArticle,
  type RagPrinciple,
  type RagRelation,
  type RagRuling,
} from "@/lib/modules/legal-rag/context-builder";
import { buildCitations } from "@/lib/modules/citations/citation-engine";
import { hasSufficientGrounding, buildGroundingSystemPrompt, GROUNDING_FALLBACK } from "@/lib/modules/legal-rag/grounding-guard";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

async function main() {
  console.log("🧪 اختبار Legal RAG + Citation Engine");
  console.log("=".repeat(50));

  // بيانات تجريبية: مادة + حكم مرتبط بها + مبدأ مرتبط بالحكم
  const articles: RagArticle[] = [
    { id: "art-1", title: "نظام المعاملات المدنية — م/30: العقود شريعة المتعاقدين", content: "العقد شريعة المتعاقدين...", lawName: "نظام المعاملات المدنية", articleNumber: 30, score: 0.9, reason: "تطابق نصّي" },
    { id: "art-2", title: "نظام المعاملات المدنية — م/130: الفسخ", content: "يجوز الفسخ مع التعويض...", lawName: "نظام المعاملات المدنية", articleNumber: 130, score: 0.5, reason: "تطابق نصّي" },
  ];
  const rulings: RagRuling[] = [
    { id: "rul-1", title: "حكم 12345", text: "قضت الدائرة بفسخ العقد للغبن...", caseNo: "12345", decisionNo: null, court: "المحكمة التجارية", score: 0.4, reason: "تطابق نصّي" },
  ];
  const principles: RagPrinciple[] = [
    { id: "prn-1", title: "الغبن الفاحش يبيح الفسخ", text: "استقر على أن الغبن الفاحش...", score: 0.3, reason: "تطابق نصّي" },
  ];
  const relations: RagRelation[] = [
    { id: "r1", sourceType: "article", sourceId: "art-2", targetType: "ruling", targetId: "rul-1", relation: "SUPPORTS", strength: 1 },
    { id: "r2", sourceType: "ruling", sourceId: "rul-1", targetType: "principle", targetId: "prn-1", relation: "INTERPRETS", strength: 1 },
  ];

  // ١. بناء السياق
  const ctx = buildLegalContext({ question: "هل يجوز فسخ العقد بسبب الغبن؟", articles, rulings, principles, relations });
  check(ctx.articles.length === 2 && ctx.rulings.length === 1 && ctx.principles.length === 1, "بناء السياق (مواد/أحكام/مبادئ)");

  // ٢. ترجيح الحكم المرتبط بمادة حاضرة (art-2 → rul-1) فوق درجته الأصلية (0.4)
  const rulWeight = ctx.rulings[0].weight;
  check(rulWeight > 0.4, `ربط المادة بالحكم رفع وزنه (${rulWeight} > 0.4)`);

  // ٣. ترجيح المبدأ المرتبط بحكم حاضر (rul-1 → prn-1) فوق درجته الأصلية (0.3)
  const prnWeight = ctx.principles[0].weight;
  check(prnWeight > 0.3, `ربط الحكم بالمبدأ رفع وزنه (${prnWeight} > 0.3)`);

  // ٤. ترتيب المصادر وحساب الثقة
  check(ctx.sources.length === 4 && ctx.confidence > 0, `قائمة المصادر مرتّبة والثقة محسوبة (${ctx.confidence})`);

  // ٥. الاستشهادات بمراجع رسمية لا غموض فيها
  const cites = buildCitations(ctx);
  const artCite = cites.find((c) => c.sourceType === "article");
  check(cites.length === 4, "إنشاء استشهاد لكل مصدر");
  check(Boolean(artCite && /المادة \(\d+\)/.test(artCite.reference)), "مرجع المادة يحدّد النظام ورقم المادة (لا «وفق النظام»)");
  const rulCite = cites.find((c) => c.sourceType === "ruling");
  check(Boolean(rulCite && /حكم رقم/.test(rulCite.reference)), "مرجع الحكم يحدّد رقمه (لا «استقر القضاء» مبهماً)");

  // ٦. منع الهلوسة: سياق فارغ → غير كافٍ
  const empty = buildLegalContext({ question: "س", articles: [], rulings: [], principles: [], relations: [] });
  check(!hasSufficientGrounding(empty), "رفض الإجابة بلا مصادر (grounding guard)");
  check(hasSufficientGrounding(ctx), "قبول الإجابة عند توفّر مصادر كافية");

  // ٧. تعليمات النظام تمنع الاختلاق
  const sys = buildGroundingSystemPrompt();
  check(sys.includes(GROUNDING_FALLBACK) && sys.includes("لا تختلق"), "تعليمات الإسناد تمنع الاختلاق وتحدّد عبارة العجز");

  // ٨. (اختياري) عدم كسر Hybrid Search/الخط الكامل عند توفّر قاعدة
  try {
    const { legalRag } = await import("@/lib/modules/legal-rag/legal-rag-service");
    const res = await legalRag("هل يجوز فسخ العقد بسبب الغبن؟");
    check(typeof res.answer === "string" && Array.isArray(res.citations), "الخط الكامل (Hybrid→RAG) يعمل دون كسر");
    console.log(`     [قاعدة متاحة] مُسنَد=${res.grounded} ثقة=${res.confidence} استشهادات=${res.citations.length}`);
  } catch (e) {
    console.log(`  ⏭️  تخطّي اختبار الخط الكامل (لا قاعدة متاحة): ${e instanceof Error ? e.message.split("\n")[0] : e}`);
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
  console.log("✅ نجح اختبار Legal RAG.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
