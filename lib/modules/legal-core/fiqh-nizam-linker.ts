/**
 * fiqh-nizam-linker.ts — ربط مسائل الموسوعة الفقهية بمواد الأنظمة السعودية الحقيقية.
 *
 * المدخل: شجرة المسائل (fiqh_issue_tree.json) — كل مسألة تحمل suggested_saudi_nizam (تقديري)
 *         وsuggested_saudi_article_ref = «يُحدَّد بالمراجعة» (نائب).
 * المخرج: لكل مسألة، مواد حقيقية من نظامها عبر BM25 ضمن «حد النظام» (لا تُطابَق إلا بمواد نظامها).
 *
 * مبدأ حكيم: لا اختلاق — كل ربط لمادة موجودة فعلاً (lawName, articleNumber)، والمسائل غير
 * المقنّنة (أحكام شرعية) تُعلَّم بصدق بلا إجبار ربط.
 */
import { createHash } from "node:crypto";
import { bm25Search, bm25SearchWhere } from "./bm25";
import { normalizeArabicText } from "./arabic-morphology";

/** معرّف ثابت حتمي للمسألة من مسارها الفريد (يصمد عبر إعادة التوليد). */
export function issueId(path: string): string {
  return "fiqh-" + createHash("sha1").update(path).digest("hex").slice(0, 12);
}

// ── عُقد الشجرة ──
export interface FiqhTreeNode {
  node_title: string;
  level: number;
  node_type: string;
  suggested_saudi_nizam?: string;
  suggested_saudi_nizam_chapter?: string;
  confidence?: number;
  children?: FiqhTreeNode[];
}

export interface FlatMasala {
  title: string;
  nodeType: string;
  section: string;
  book: string;
  chapter: string;
  suggestedNizam: string;
  suggestedNizamChapter: string;
  confidence: number;
}

/**
 * مُحلِّل الأنظمة المستهدفة من قيمة suggested_saudi_nizam (16 قيمة).
 * targets = أسماء أنظمة مقنّنة دقيقة موجودة في saudi_systems.json (للمطابقة بالتساوي).
 * codified=false ⇒ مسألة فقهية غير مقنّنة (أحكام شرعية) لا مادة نظامية لها.
 */
const NIZAM_RESOLVER: Record<string, string[]> = {
  "نظام المعاملات المدنية": ["نظام المعاملات المدنية"],
  "نظام الأحوال الشخصية": ["نظام الأحوال الشخصية"],
  "نظام الإثبات": ["نظام الإثبات"],
  "نظام المرافعات الشرعية": ["نظام المرافعات الشرعية"],
  "نظام الشركات / نظام المعاملات المدنية": ["نظام الشركات", "نظام المعاملات المدنية"],
  "نظام الإفلاس / نظام المعاملات المدنية": ["نظام الإفلاس", "نظام المعاملات المدنية"],
  "نظام المعاملات المدنية / الأحوال الشخصية": ["نظام المعاملات المدنية", "نظام الأحوال الشخصية"],
  "نظام التحكيم / المرافعات الشرعية": ["نظام التحكيم", "نظام المرافعات الشرعية"],
  "أنظمة خاصة + المعاملات المدنية": ["نظام المعاملات المدنية"],
  "أنظمة الأوقاف": ["نظام الهيئة العامة للأوقاف"],
  "أحكام شرعية + أنظمة جزائية": ["نظام الإجراءات الجزائية"],
  "أنظمة جزائية تعزيرية": ["نظام الإجراءات الجزائية"],
  // غير مقنّنة (لا مادة نظامية مباشرة):
  "أحكام شرعية (حدود)": [],
  "أحكام شرعية + أنظمة": [],
  "أحكام شرعية": [],
  "أحكام شرعية عامة": []
};

export interface ResolvedTargets {
  targets: string[];
  codified: boolean;
}

export function resolveTargets(suggestedNizam: string, knownSystems: Set<string>): ResolvedTargets {
  const mapped = NIZAM_RESOLVER[suggestedNizam?.trim()] ?? [];
  const targets = mapped.filter((name) => knownSystems.has(name));
  return { targets, codified: targets.length > 0 };
}

/**
 * عتبات النسبة المعيارية = (أفضل درجة داخل النظام المُعيَّن) ÷ (أفضل درجة عبر كل الأنظمة).
 * ثابتة بالنسبة لطول الاستعلام، وتتحقّق ضمناً من صحة تعيين النظام:
 *   ratio ≥ linked  ⇒ النظام المُعيَّن يحوي أفضل مطابقة (ثقة عالية).
 *   ratio ≥ review  ⇒ مطابقة معقولة لكن قد توجد أفضل خارج النظام (مراجعة).
 *   أقل من ذلك      ⇒ أفضل مطابقة خارج النظام المُعيَّن غالباً (يُراجَع تعيين النظام).
 */
export const LINK_THRESHOLDS = { linked: 0.9, review: 0.6 };

export interface ArticleLink {
  lawName: string;
  articleNumber: number;
  citation: string;
  score: number;
}

export type LinkStatus = "linked" | "needs_review" | "review_nizam" | "no_match" | "uncodified_sharia";

export interface MasalaLink {
  /** معرّف ثابت حتمي (fiqh-<sha1>) مشتق من المسار الفريد. */
  issueId: string;
  title: string;
  nodeType: string;
  path: string;
  suggestedNizam: string;
  suggestedNizamChapter: string;
  targetSystems: string[];
  /** أفضل درجة BM25 داخل النظام المُعيَّن. */
  nizamScore: number;
  /** أفضل درجة BM25 عبر كل الأنظمة (للمعايرة). */
  globalTopScore: number;
  /** nizamScore ÷ globalTopScore (0..1). */
  nizamRatio: number;
  linkStatus: LinkStatus;
  articleLinks: ArticleLink[];
}

/** يبني نصّ الاستعلام: عنوان المسألة + الكتاب + آخر مقطع من تبويب النظام المقترح (سياق). */
function buildQuery(m: FlatMasala): string {
  const chapterTail = (m.suggestedNizamChapter || "").split(">").pop()?.trim() ?? "";
  return [m.title, m.book, chapterTail].filter(Boolean).join(" ");
}

/** يربط مسألة واحدة بمواد نظامها الحقيقية (ضمن حد النظام). */
export function linkMasala(m: FlatMasala, knownSystems: Set<string>, topK = 3): MasalaLink {
  const path = [m.section, m.book, m.chapter, m.title].filter(Boolean).join(" > ");
  const { targets, codified } = resolveTargets(m.suggestedNizam, knownSystems);

  const base = {
    issueId: issueId(path),
    title: m.title,
    nodeType: m.nodeType,
    path,
    suggestedNizam: m.suggestedNizam,
    suggestedNizamChapter: m.suggestedNizamChapter,
    targetSystems: targets
  };

  if (!codified) {
    return {
      ...base,
      nizamScore: 0,
      globalTopScore: 0,
      nizamRatio: 0,
      linkStatus: "uncodified_sharia",
      articleLinks: []
    };
  }

  const query = buildQuery(m);
  const allow = new Set(targets);
  const hits = bm25SearchWhere(query, (meta) => allow.has(meta.law_name), topK);
  const articleLinks: ArticleLink[] = hits.map((h) => ({
    lawName: h.meta.law_name,
    articleNumber: h.meta.article_number,
    citation: h.meta.citation,
    score: h.score
  }));

  const nizamScore = articleLinks[0]?.score ?? 0;
  const globalTopScore = bm25Search(query, 1)[0]?.score ?? 0;
  const nizamRatio = globalTopScore > 0 ? +(nizamScore / globalTopScore).toFixed(3) : 0;

  const linkStatus: LinkStatus =
    nizamScore === 0
      ? "no_match" // لا مادة داخل النظام المُعيَّن إطلاقاً
      : nizamRatio >= LINK_THRESHOLDS.linked
        ? "linked"
        : nizamRatio >= LINK_THRESHOLDS.review
          ? "needs_review" // مطابقة معقولة داخل النظام
          : "review_nizam"; // وُجدت مادة لكن أفضل مطابقة خارج النظام ⇒ يُراجَع تعيين النظام

  return { ...base, nizamScore, globalTopScore, nizamRatio, linkStatus, articleLinks };
}

/** يُسطّح شجرة المسائل إلى قائمة مسائل (level 4 / *_issue) مع مسارها. */
export function flattenMasail(root: FiqhTreeNode): FlatMasala[] {
  const out: FlatMasala[] = [];
  const walk = (n: FiqhTreeNode, section: string, book: string, chapter: string) => {
    const t = n.node_type || "";
    const nextSection = t === "fiqh_section" ? n.node_title : section;
    const nextBook = t === "fiqh_book" ? n.node_title : book;
    const nextChapter = t === "fiqh_chapter" ? n.node_title : chapter;
    if (/_issue$/.test(t)) {
      out.push({
        title: n.node_title,
        nodeType: t,
        section: nextSection,
        book: nextBook,
        chapter: nextChapter,
        suggestedNizam: n.suggested_saudi_nizam ?? "",
        suggestedNizamChapter: n.suggested_saudi_nizam_chapter ?? "",
        confidence: n.confidence ?? 0
      });
    }
    (n.children ?? []).forEach((c) => walk(c, nextSection, nextBook, nextChapter));
  };
  walk(root, "", "", "");
  return out;
}

export { normalizeArabicText };
