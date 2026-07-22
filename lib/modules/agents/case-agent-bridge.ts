// ─────────────────────────────────────────────────────────────────────────────
// جسر وكيل الأنظمة للخدمات المؤرَّضة (تحليل القضايا · الوكيل القانوني · المحاكاة).
// يرفع الخدمات الثلاث من «مؤرَّض» (بحث لقطة واحدة) إلى «وكيل كامل» بإعادة استخدام نقطة
// دخول الوكيل نفسها التي يستعملها «اسأل حكيم» (orchestrate): فهم النظام الحاكم (resolve-scope)
// + الاسترجاع المقيّد بالنطاق، ثم يركّب أدوات الوكيل المنفصلة (تحقّق · مظانّ · سوابق) — بلا
// نموذج إضافي عدا resolve-scope داخل المنسّق. لا يلمس «اسأل حكيم» ولا النواة ولا المصادقة.
//
// توصيل وظيفيّ لا توحيد معماريّ: كل خدمة تبقى في صفحتها، وتمرّر «تعليمة وضعها» (system prompt)
// فوق هذا السياق المؤرَّض — نفس الدماغ، زوايا إخراج مختلفة.
// ─────────────────────────────────────────────────────────────────────────────
import { orchestrate } from "./orchestrator";
import { runVerification, type CoverageState } from "./thinking/verification";
import { rankGoverningSystems, inferSpecialization, type GoverningSystem } from "./thinking/mazann";
import { search_rulings, search_principles } from "./tools";
import type { VerifiedCitation } from "./thinking/verifier";
import type { MergedResult } from "@/lib/modules/legal-search/hybrid-search";
import { buildCitationBlock, noLegalArticleMessage, getArticlesByNumber, type LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";
import { analyzeJudgmentCitations } from "@/lib/modules/legal-core/judgment-citation-extractor";

/** حصيلة الوكيل المؤرَّضة الموحّدة التي تبني عليها الخدمات الثلاث إخراجها. */
export interface AgentGroundedContext {
  /** المواد المسترجَعة مقيّدةً بالنظام الحاكم ومُعاد ترتيبها (من المنسّق). */
  articles: LegalCoreResult[];
  /** المواد بعد التحقّق (نطاق · نفاذ · تأريض) — السند المسموح للصياغة. */
  verified: VerifiedCitation[];
  /** الأنظمة الحاكمة المرتّبة (المظانّ) — فهم النظام الحاكم للعرض/التوجيه. */
  governingSystems: GoverningSystem[];
  rulings: MergedResult[];
  principles: MergedResult[];
  coverage?: CoverageState;
  /** هل تحقّق سندٌ كافٍ من النواة؟ (خلافه ⇒ امتناع صادق لا تلفيق). */
  grounded: boolean;
  /** ثقة الإسناد 0..1 مشتقّة من التغطية والتحقّق. */
  confidence: number;
  /** نصّ السياق النظامي (نصّ المواد + القاعدة الإلزامية) لحقنه في prompt الخدمة. */
  groundingText: string;
}

function emptyContext(): AgentGroundedContext {
  return {
    articles: [],
    verified: [],
    governingSystems: [],
    rulings: [],
    principles: [],
    coverage: undefined,
    grounded: false,
    confidence: 0,
    groundingText: noLegalArticleMessage,
  };
}

/** يزيل تكرار المواد بمعرّفها مع الحفاظ على الترتيب (الأوّل يبقى). */
function dedupeArticlesById(articles: LegalCoreResult[]): LegalCoreResult[] {
  const seen = new Set<string>();
  const out: LegalCoreResult[] = [];
  for (const a of articles) {
    if (a && a.articleId && !seen.has(a.articleId)) { seen.add(a.articleId); out.push(a); }
  }
  return out;
}

/**
 * استرجاعٌ موجَّهٌ بالاستشهاد الصريح: يستخرج إحالات «نظام كذا، المادة N» الواردة في نصّ القضية
 * (مذكّرات الأطراف/الوقائع/الطلبات) ويجلب موادّها **مباشرةً** من النواة برقمها ونظامها. هذا سندٌ
 * حقيقيّ — مواد موجودةٌ في قاعدة البيانات استشهد بها الأطراف — قد لا يُصعِّدها البحث الدلاليّ
 * (المطابقة بالموضوع)، فيُكمِّل الاسترجاع بدل الامتناع الكاذب «غياب السند». لا اختلاق: نجلب النصّ
 * الرسميّ من الجدول فقط، ولا نُضيف رقمًا لم يُحَلّ فعلًا في النواة.
 */
async function citationDrivenArticles(text: string): Promise<LegalCoreResult[]> {
  const analysis = await analyzeJudgmentCitations(text).catch(() => null);
  const resolved = (analysis?.citations ?? []).filter((c) => c.resolvedArticleId && c.articleNumber);
  const out: LegalCoreResult[] = [];
  const seen = new Set<string>();
  for (const c of resolved) {
    const id = c.resolvedArticleId as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const hits = await getArticlesByNumber(c.articleNumber as number, c.systemName ?? undefined).catch(() => [] as LegalCoreResult[]);
    const match = hits.find((h) => h.articleId === id) ?? hits.find((h) => h.articleNumber === c.articleNumber);
    if (match) out.push(match);
  }
  return out;
}

/**
 * يشغّل وكيل الأنظمة على استعلام (وقائع قضية/سؤال) ويعيد سياقًا مؤرَّضًا موحّدًا.
 * سقوط آمن في كل خطوة إلى سياق فارغ/جزئيّ — فلا يكسر الخدمة أبدًا، وعدم التأريض يُفصَح لا يُلفَّق.
 */
export async function runCaseAgent(query: string): Promise<AgentGroundedContext> {
  const q = (query || "").trim();
  if (!q) return emptyContext();

  // ① تأصيلٌ مزدوج متوازٍ:
  //    (أ) نقطة دخول الوكيل بالوضع **العميق** — نفسه الذي يستخدمه «اسأل حكيم» (runJudicialAgent):
  //        فهم النظام الحاكم (resolve-scope) + استرجاعٌ عميقٌ (٧ جولات + مسحة شاملة + تعميقٌ داخل
  //        الأنظمة الحاكمة). الوضع السريع السابق (٣ جولات × ٦) كان يمسح النواة سطحيًّا فتفوته
  //        المواد الحاكمة — فتصل «اسأل حكيم» للنواة ولا تصل الخدمات. skipAnalysis: كلّ خدمة تصوغ
  //        إخراجها بوضعها الخاص فلا نولّد تحليل الوكيل العامّ.
  //    (ب) استرجاعٌ موجَّهٌ بالاستشهاد الصريح: جلبُ المواد المُحال إليها نصًّا مباشرةً من النواة
  //        (يعالج «غياب السند» لموادَّ موجودةٍ فعلًا لكن لم يُصعِّدها الترتيب الدلاليّ).
  const [result, cited] = await Promise.all([
    orchestrate(q, { mode: "deep", skipBreadth: true, skipAnalysis: true }).catch(() => null),
    citationDrivenArticles(q).catch(() => [] as LegalCoreResult[]),
  ]);
  const semantic = result?.articles ?? [];
  // الإحالات الصريحة أولًا (سندٌ مباشرٌ استشهد به الأطراف)، ثمّ نتائج البحث الدلاليّ العميق.
  const articles = dedupeArticlesById([...cited, ...semantic]);
  if (!articles.length) return emptyContext();

  // ② المظانّ: نعيد استخدام مظانّ المنسّق العميق إن توفّرت، وإلا نحسبها (سقوطٌ آمن).
  const governingSystems = result?.governingSystems?.length
    ? result.governingSystems
    : rankGoverningSystems(articles, inferSpecialization(q));

  // ③ التحقّق (نطاق · نفاذ · تأريض): نعيد استخدام تحقّق المنسّق العميق إن توفّر (يشمل المواد
  //    الدلاليّة)، وإلا نُحقّق هنا. لا عملٌ مزدوج في المسار الشائع.
  const report = result?.verified
    ? null
    : await runVerification({ articles, plan: result?.plan, targets: [] }).catch(() => null);
  const verified = result?.verified ?? report?.verified ?? [];
  const coverage = result?.coverage ?? report?.coverage;

  // ④ السوابق الداعمة (أحكام · مبادئ): من المنسّق العميق إن توفّرت، وإلا نبحثها.
  let rulings: MergedResult[] = result?.rulings ?? [];
  let principles: MergedResult[] = result?.principles ?? [];
  if (!rulings.length && !principles.length) {
    const [rul, prin] = await Promise.all([
      search_rulings(q, 6).catch(() => ({ ok: false as const, data: [] as MergedResult[] })),
      search_principles(q, 6).catch(() => ({ ok: false as const, data: [] as MergedResult[] })),
    ]);
    rulings = rul.ok ? rul.data : [];
    principles = prin.ok ? prin.data : [];
  }

  // السياق النصّي للنموذج: نصّ المواد المُتحقَّقة (أو المسترجَعة) + القاعدة الإلزامية ضدّ الاختلاق.
  // الإحالات الصريحة سندٌ مباشرٌ موجودٌ في النواة، فلا يُسقطها التحقّق: تُضمّ دائمًا مع المُتحقَّق.
  const verifiedIds = new Set(verified.map((v) => v.articleId));
  const verifiedArticles = verified.length ? articles.filter((a) => verifiedIds.has(a.articleId)) : articles;
  const groundedArticles = dedupeArticlesById([...cited, ...verifiedArticles]);
  const grounded = groundedArticles.length > 0;
  const groundingText = grounded
    ? [
        "السياق النظامي المسترجع من النواة القانونية الموحدة عبر وكيل الأنظمة:",
        buildCitationBlock(groundedArticles.slice(0, 8)),
        "قاعدة إلزامية: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد.",
      ].join("\n")
    : noLegalArticleMessage;

  // ثقة الإسناد: من نسبة تغطية المسائل (إن توفّرت) وإلا من وجود سند مُتحقَّق.
  const answered = coverage?.answered ?? 0;
  const totalIssues = coverage?.issues.length ?? 0;
  const coverageRatio = totalIssues ? answered / totalIssues : verified.length ? 1 : 0;
  const confidence = grounded ? Math.max(0.35, Math.min(0.95, 0.4 + 0.55 * coverageRatio)) : 0;

  return {
    articles: groundedArticles,
    verified,
    governingSystems,
    rulings,
    principles,
    coverage,
    grounded,
    confidence,
    groundingText,
  };
}
