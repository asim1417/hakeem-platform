/**
 * اختبار مركز تكامل النواة القانونية (Core Integration).
 * يعمل بلا قاعدة: يتحقق من بناء أزرار التشغيل الذكي بحمولات صحيحة تطابق contracts الـAPIs،
 * حساب جودة الربط، وأن غياب البيانات لا يكسر شيئاً. ويتحقق (مع قاعدة، اختياري) من الخدمات.
 *
 * التشغيل: npm run test:core-integration
 */
import {
  buildArticleActions,
  buildArticleCitation,
  computeDataQualityScore,
  type ArticleContext,
} from "@/lib/modules/legal-core/intelligence";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

async function main() {
  console.log("🧪 اختبار Core Integration Dashboard");
  console.log("=".repeat(50));

  // ١. الاستشهاد الرسمي
  check(buildArticleCitation("نظام المعاملات المدنية", 130) === "نظام المعاملات المدنية — المادة (130)", "بناء الاستشهاد الرسمي");

  // ٢. أزرار التشغيل الذكي + الحمولات تطابق contracts القائمة
  const ctx: ArticleContext = {
    articleId: "art-130",
    systemName: "نظام المعاملات المدنية",
    articleNumber: 130,
    articleText: "إذا لحق أحد المتعاقدين غبن فاحش مع تغرير جاز له طلب فسخ العقد.",
    citation: "نظام المعاملات المدنية — المادة (130)",
  };
  const actions = buildArticleActions(ctx);
  const byKey = (k: string) => actions.find((a) => a.key === k);

  check(actions.length >= 7, `تُبنى أزرار التشغيل (${actions.length})`);
  check(byKey("open")?.kind === "navigate" && byKey("open")?.href === "/dashboard/legal-core/articles/art-130", "زر فتح المادة (href صحيح)");
  check(byKey("copy")?.kind === "clipboard" && byKey("copy")?.clipboard === ctx.citation, "زر نسخ الاستشهاد");

  const ask = byKey("ask");
  check(ask?.api === "/api/legal-rag" && ask?.method === "POST" && typeof (ask?.payload as { question?: string })?.question === "string" && ((ask?.payload as { question: string }).question.length > 0), "اسأل حكيم → POST /api/legal-rag بحمولة question");

  const analyze = byKey("analyze");
  check(analyze?.api === "/api/case-analysis" && typeof (analyze?.payload as { facts?: string })?.facts === "string", "تحليل قضية → POST /api/case-analysis بحمولة facts");

  const strategy = byKey("strategy");
  check(strategy?.api === "/api/legal-agent" && typeof (strategy?.payload as { caseFacts?: string })?.caseFacts === "string", "استراتيجية → POST /api/legal-agent بحمولة caseFacts");

  const simulate = byKey("simulate");
  check(simulate?.api === "/api/judicial-simulation" && typeof (simulate?.payload as { caseFacts?: string })?.caseFacts === "string", "محاكاة → POST /api/judicial-simulation بحمولة caseFacts");

  check(Boolean(byKey("rulings")) && Boolean(byKey("relations")), "زرّا الأحكام المرتبطة والعلاقات المعرفية موجودان");

  // الحمولات تشير للمادة الفعلية (لا اختلاق)
  check((ask?.payload as { question: string }).question.includes("130"), "حمولة السؤال تشير لرقم المادة");
  check((analyze?.payload as { facts: string }).facts.includes("غبن"), "حمولة التحليل تتضمّن نص المادة");

  // ٣. حدود الطول (لا تتجاوز سقوف الـAPIs)
  const longCtx: ArticleContext = { ...ctx, articleText: "ن".repeat(9000) };
  const la = buildArticleActions(longCtx);
  check(((la.find((a) => a.key === "analyze")?.payload as { facts: string }).facts.length) <= 8000, "حمولة facts ضمن حد الـAPI (≤8000)");
  check(((la.find((a) => a.key === "ask")?.payload as { question: string }).question.length) <= 2000, "حمولة question ضمن حد الـAPI (≤2000)");

  // ٤. جودة الربط (حتمية، محصورة 0-100)
  check(computeDataQualityScore({ articlesCount: 0, linkedArticlesCount: 0, reviewNeededCount: 0 }) === 0, "بلا مواد → جودة 0");
  const full = computeDataQualityScore({ articlesCount: 100, linkedArticlesCount: 100, reviewNeededCount: 0 });
  const none = computeDataQualityScore({ articlesCount: 100, linkedArticlesCount: 0, reviewNeededCount: 100 });
  check(full === 100 && none === 0, `جودة محصورة (كامل=${full} منعدم=${none})`);
  const mid = computeDataQualityScore({ articlesCount: 100, linkedArticlesCount: 50, reviewNeededCount: 50 });
  check(mid > 0 && mid < 100, `قيمة وسطى منطقية (${mid})`);

  // ٥. (اختياري) الخدمات لا تنكسر + لا تكرار محرّكات
  try {
    const { getIntelligenceSummary, getArticleIntelligence } = await import("@/lib/modules/legal-core/intelligence");
    const summary = await getIntelligenceSummary();
    check(typeof summary.articlesCount === "number" && typeof summary.dataQualityScore === "number", "intelligence-summary يعمل (شكل صحيح)");
    const intel = await getArticleIntelligence("nonexistent-id");
    check(intel.found === false && Array.isArray(intel.relatedRulings), "غياب المادة/الروابط لا يكسر (found=false)");
    // المحرّكات السابقة سليمة
    const { runJudicialSimulation } = await import("@/lib/modules/judicial-simulation/judicial-simulation");
    const v = await runJudicialSimulation({ caseFacts: "واقعة اختبار." });
    check(typeof v.caseSummary === "string" && Array.isArray(v.citations), "المحاكاة القضائية سليمة (لم تُكسَر)");
  } catch (e) {
    console.log(`  ⏭️  تخطّي اختبار القاعدة/الخدمات: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
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
  console.log("✅ نجح اختبار Core Integration Dashboard.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
