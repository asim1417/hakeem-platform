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
import { buildCitationBlock, noLegalArticleMessage, type LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

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

/**
 * يشغّل وكيل الأنظمة على استعلام (وقائع قضية/سؤال) ويعيد سياقًا مؤرَّضًا موحّدًا.
 * سقوط آمن في كل خطوة إلى سياق فارغ/جزئيّ — فلا يكسر الخدمة أبدًا، وعدم التأريض يُفصَح لا يُلفَّق.
 */
export async function runCaseAgent(query: string): Promise<AgentGroundedContext> {
  const q = (query || "").trim();
  if (!q) return emptyContext();

  // ① نقطة دخول الوكيل: فهم النظام الحاكم (resolve-scope) + الاسترجاع المقيّد بالنطاق.
  //    وضع «سريع»: نتجنّب توليد تحليل الوكيل (نموذج) لأنّ كل خدمة تصوغ إخراجها بوضعها الخاص.
  const result = await orchestrate(q, { mode: "quick", skipBreadth: true }).catch(() => null);
  const articles = result?.articles ?? [];
  if (!articles.length) return emptyContext();

  // ② المظانّ (حتميّ، بلا نموذج): ترتيب الأنظمة الحاكمة من المواد المسترجَعة.
  const governingSystems = rankGoverningSystems(articles, inferSpecialization(q));

  // ③ التحقّق (نطاق · نفاذ · تأريض): يقصر السند على مواد النظام الحاكم السارية المُتحقَّق ورودها.
  const report = await runVerification({ articles, plan: result?.plan, targets: [] }).catch(() => null);
  const verified = report?.verified ?? [];

  // ④ السوابق الداعمة (أحكام · مبادئ) — أدوات الوكيل نفسها.
  const [rul, prin] = await Promise.all([
    search_rulings(q, 6).catch(() => ({ ok: false as const, data: [] as MergedResult[] })),
    search_principles(q, 6).catch(() => ({ ok: false as const, data: [] as MergedResult[] })),
  ]);
  const rulings = rul.ok ? rul.data : [];
  const principles = prin.ok ? prin.data : [];

  // السياق النصّي للنموذج: نصّ المواد المُتحقَّقة (أو المسترجَعة) + القاعدة الإلزامية ضدّ الاختلاق.
  const verifiedIds = new Set(verified.map((v) => v.articleId));
  const groundedArticles = verified.length ? articles.filter((a) => verifiedIds.has(a.articleId)) : articles;
  const grounded = groundedArticles.length > 0;
  const groundingText = grounded
    ? [
        "السياق النظامي المسترجع من النواة القانونية الموحدة عبر وكيل الأنظمة:",
        buildCitationBlock(groundedArticles.slice(0, 8)),
        "قاعدة إلزامية: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد.",
      ].join("\n")
    : noLegalArticleMessage;

  // ثقة الإسناد: من نسبة تغطية المسائل (إن توفّرت) وإلا من وجود سند مُتحقَّق.
  const answered = report?.coverage.answered ?? 0;
  const totalIssues = report?.coverage.issues.length ?? 0;
  const coverageRatio = totalIssues ? answered / totalIssues : verified.length ? 1 : 0;
  const confidence = grounded ? Math.max(0.35, Math.min(0.95, 0.4 + 0.55 * coverageRatio)) : 0;

  return {
    articles: groundedArticles,
    verified,
    governingSystems,
    rulings,
    principles,
    coverage: report?.coverage,
    grounded,
    confidence,
    groundingText,
  };
}
