// legalMetricsService — خدمة العدّ الواحدة للنواة القانونية (HKM-023-A، ل٠-١).
//
// كل عدّاد في صفحات الإدارة القانونية يُقرأ من هنا، بتعريف واحد مكتوب بجوار استعلامه.
// لا يُحسب رقم في صفحتين بطريقتين (المبدأ ٨ في الأمر الموجّه).
//
// - المنفذ SQL ضيق (query بمعاملات مرقّمة) مثل lib/modules/editorial/db.ts: الإنتاج يمرّره عبر Prisma
//   (metrics-server.ts)، والاختبارات المحلية عبر pg؛ فلا تعتمد الخدمة على محرك Prisma.
// - قراءة فقط: كل عبارة هنا SELECT أو WITH. لا كتابة إطلاقًا.
// - العدّاد الذي لا ينطبق يُعاد «لا ينطبق» (ل٠-٤)، والمصدر المتعذّر يُعاد «غير متاح» لا صفرًا.
import { CORE_SYSTEMS } from "./core-systems";
import { VERIFIED_STATUSES } from "./verified-status";

export interface MetricsSql {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

export type MetricValue =
  | { kind: "count"; value: number }
  | { kind: "not_applicable"; reason: string }
  | { kind: "unavailable"; reason: string };

export type MetricGroup = "systems" | "articles" | "explanations" | "judgments" | "citations" | "principles" | "issues" | "fiqh";

export const METRIC_GROUPS: readonly MetricGroup[] = ["systems", "articles", "explanations", "judgments", "citations", "principles", "issues", "fiqh"];

/** معنى العدد الموجب: «attention» يحتاج عملًا، «good» تقدّم، «neutral» حجم. */
export type MetricTone = "attention" | "good" | "neutral";

export interface MetricQueue {
  href: string;
  label: string;
}

export interface MetricDefinition {
  group: MetricGroup;
  label: string;
  /** التعريف المكتوب الوحيد للمقياس. */
  definition: string;
  tone: MetricTone;
  /** الطابور المصفّى الذي يعرض العدد نفسه (ل٠-٢)، أو null إن لم توجد صفحة قائمة بعد. */
  queue: MetricQueue | null;
  /** سبب غياب الطابور، والمرحلة التي تبنيه. */
  queueNote?: string;
}

export const LEGAL_CORE_BASE = "/dashboard/legal-core";
export const PRINCIPLES_QUEUE = `${LEGAL_CORE_BASE}/principles`;
export const JUDGMENTS_QUEUE = `${LEGAL_CORE_BASE}/judgments`;
export const SYSTEMS_QUEUE = `${LEGAL_CORE_BASE}/systems`;
export const ISSUES_PAGE = `${LEGAL_CORE_BASE}/legal-issues`;

/** قيمة مرشح المبادئ التي تعرض كل الحالات (ومنها المرفوض). الفارغ = كل ما عدا المرفوض. */
export const PRINCIPLE_STATUS_ALL = "all";
/** معامل مرشح الأحكام بحسب الروابط في صفحة القائمة. */
export const JUDGMENT_LINKS_PARAM = "links";
export type JudgmentLinksFilter = "none" | "any";

export const KNOWN_PRINCIPLE_STATUSES = ["reviewed", "needs_review", "rejected"] as const;

export function principleStatusLabel(status: string): string {
  if (status === "reviewed") return "معتمد";
  if (status === "needs_review") return "بانتظار المراجعة";
  if (status === "rejected") return "مرفوض";
  return `حالة أخرى: ${status}`;
}

export function principleQueueHref(status: string): string {
  return `${PRINCIPLES_QUEUE}?status=${encodeURIComponent(status)}`;
}

const NO_ARTICLE_QUEUE = "لا توجد بعد صفحة قائمة مواد بمرشحات الجودة؛ تُبنى في م٣ (ورشة الإثراء ل٢-٤).";
const NO_CITATION_QUEUE = "لا توجد بعد صفحة قائمة للروابط؛ يُبنى طابور الاستشهادات في م٢ (ل٤).";
const NO_SYSTEM_FILTER = "قائمة الأنظمة لا تملك بعد مرشح «غير مصنّف/بلا تاريخ/غير موثّق»؛ يُبنى في م٤ (ل١-٨).";
const NO_FIQH_QUEUE = "لا توجد بعد صفحة للطبقة الفقهية؛ تُبنى في م٧ (ل٧).";

export const METRIC_DEFINITIONS = {
  // ── الأنظمة ──
  "systems.total": {
    group: "systems",
    label: "الأنظمة",
    definition: "عدد صفوف legal_systems.",
    tone: "neutral",
    queue: { href: SYSTEMS_QUEUE, label: "قائمة الأنظمة" },
  },
  "systems.unclassified": {
    group: "systems",
    label: "أنظمة غير مصنّفة",
    definition: "نظام بلا مجال: legal_systems.domain فارغ أو NULL (وهو ما يُعرض «غير مصنّف» في قائمة الأنظمة).",
    tone: "attention",
    queue: null,
    queueNote: NO_SYSTEM_FILTER,
  },
  "systems.noIssuanceDate": {
    group: "systems",
    label: "أنظمة بلا تاريخ إصدار من المصدر",
    definition: "نظام لا تاريخ إصدار هجريًا له تعرضه بطاقته: لا تاريخ في الركائز المكتوبة (core-systems)، ولا issued_hijri في آخر صف له في law_card. تاريخ النفاذ نفسه لا عمود له في legal_systems.",
    tone: "attention",
    queue: null,
    queueNote: NO_SYSTEM_FILTER,
  },
  "systems.unverifiedStatus": {
    group: "systems",
    label: "أنظمة بلا حالة موثّقة",
    definition: "نظام آخر سجل تحقق له (verification بنوع work) غائب أو بحالة خارج الحالات الموثّقة (مثل «سجل مخلوط — لا يُعرض»)؛ فتُعرض حالته «قيد التحقق» كما في البطاقة.",
    tone: "attention",
    queue: null,
    queueNote: NO_SYSTEM_FILTER,
  },

  // ── المواد ──
  "articles.total": {
    group: "articles",
    label: "المواد",
    definition: "عدد صفوف legal_articles.",
    tone: "neutral",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.noClassification": {
    group: "articles",
    label: "مواد بلا تصنيف",
    definition: "مادة classification فيها NULL أو نص فارغ بعد حذف المسافات.",
    tone: "attention",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.noKeywords": {
    group: "articles",
    label: "مواد بلا كلمات مفتاحية",
    definition: "مادة لا تحوي keywords عنصرًا غير فارغ (المصفوفة NULL أو فارغة أو كل عناصرها فراغ).",
    tone: "attention",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.noChapter": {
    group: "articles",
    label: "مواد بلا باب أو فصل",
    definition: "مادة chapter فيها NULL (التعريف القائم). البديل المعروض على المالك: عدّ النص الفارغ '' أيضًا (14,164 مادة في 475 نظامًا لا باب لأي مادة فيها) فيصير 25,152؛ ولا يُعتمد قبل قراره.",
    tone: "attention",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.needsReview": {
    group: "articles",
    label: "مواد تحتاج مراجعة",
    definition: "مادة ينقصها واحد على الأقل من: التصنيف، الكلمات المفتاحية، الباب (بالتعريفات الثلاثة أعلاه)، تُعدّ مرة واحدة. هو نفسه في الصفحة الرئيسية ومركز التشغيل الذكي.",
    tone: "attention",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.noRelations": {
    group: "articles",
    label: "مواد بلا علاقات",
    definition: "مادة لا تظهر مصدرًا (source_type='article') لأي صف في legal_relations.",
    tone: "attention",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.relationsTotal": {
    group: "articles",
    label: "علاقات معرفية",
    definition: "عدد صفوف legal_relations.",
    tone: "neutral",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.decreeFilled": {
    group: "articles",
    label: "مواد موثّقة المرسوم",
    definition: "مادة royalDecree فيها نص غير فارغ.",
    tone: "good",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.classifications": {
    group: "articles",
    label: "التصنيفات",
    definition: "عدد قيم classification المميّزة غير الفارغة في legal_articles.",
    tone: "neutral",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },
  "articles.duplicates": {
    group: "articles",
    label: "مواد مكررة",
    definition: "لا تعريف معتمد للتكرار بعد: فحصان سابقان وجدا ١١ و١٣ مجموعة بمنهجين مختلفين (تسويات سجل المتابعة). يُعرض «غير متاح» حتى يعتمد المالك المنهج.",
    tone: "attention",
    queue: null,
    queueNote: "كشف التكرار طابور مستقل في م٦ (ل٣-٣) للأحكام، والمواد بعد اعتماد المنهج.",
  },

  // ── الشروح ──
  "explanations.total": {
    group: "explanations",
    label: "الشروح",
    definition: "لا جدول شروح بمصدر بعد (ل٢-٦ في م٣)، فلا ينطبق. جدول annotations ملاحظات خاصة لكل مستخدم وليس شروحًا، فلا يُعدّ.",
    tone: "neutral",
    queue: null,
    queueNote: "إضافة الشرح بمصدر إلزامي في م٣ (ل٢-٦).",
  },
  "explanations.withoutSource": {
    group: "explanations",
    label: "شروح بلا مصدر",
    definition: "شرح بلا مصدر. لا ينطبق ما دام لا جدول شروح بمصدر (ل٢-٦).",
    tone: "attention",
    queue: null,
    queueNote: "إضافة الشرح بمصدر إلزامي في م٣ (ل٢-٦).",
  },
  "articles.noExplanation": {
    group: "explanations",
    label: "مواد بلا شرح",
    definition: "مادة بلا شرح. لا ينطبق ما دام لا جدول شروح بمصدر (ل٢-٦).",
    tone: "attention",
    queue: null,
    queueNote: NO_ARTICLE_QUEUE,
  },

  // ── الأحكام ──
  "judgments.total": {
    group: "judgments",
    label: "الأحكام",
    definition: "عدد صفوف judicial_cases.",
    tone: "neutral",
    queue: { href: JUDGMENTS_QUEUE, label: "قائمة الأحكام" },
  },
  "judgments.linked": {
    group: "judgments",
    label: "أحكام مرتبطة بمواد",
    definition: "حكم يظهر caseId له في صف واحد على الأقل من legal_article_case_links، بأي حالة مراجعة (عدد caseId المميز؛ القيد الأجنبي caseId → judicial_cases يضمن أنه حكم قائم).",
    tone: "good",
    queue: { href: `${JUDGMENTS_QUEUE}?${JUDGMENT_LINKS_PARAM}=any`, label: "الأحكام المرتبطة" },
  },
  "judgments.unlinked": {
    group: "judgments",
    label: "أحكام بلا رابط",
    definition: "حكم بلا رابط = حكم لا يظهر caseId له في أي صف من legal_article_case_links، بأي حالة مراجعة. (الأحكام − المرتبطة).",
    tone: "attention",
    queue: { href: `${JUDGMENTS_QUEUE}?${JUDGMENT_LINKS_PARAM}=none`, label: "الأحكام بلا رابط" },
  },

  // ── الاستشهادات (روابط مادة↔حكم) ──
  "citations.total": {
    group: "citations",
    label: "روابط المواد بالأحكام",
    definition: "عدد صفوف legal_article_case_links.",
    tone: "neutral",
    queue: null,
    queueNote: NO_CITATION_QUEUE,
  },
  "citations.pending": {
    group: "citations",
    label: "استشهادات بانتظار الاعتماد",
    definition: "رابط reviewStatus فيه 'needs_review' (مسترجع آليًا — يحتاج مراجعة).",
    tone: "attention",
    queue: null,
    queueNote: NO_CITATION_QUEUE,
  },
  "citations.verified": {
    group: "citations",
    label: "استشهادات موثّقة",
    definition: "رابط reviewStatus فيه 'verified'.",
    tone: "good",
    queue: null,
    queueNote: NO_CITATION_QUEUE,
  },
  "citations.rejected": {
    group: "citations",
    label: "استشهادات مرفوضة",
    definition: "رابط reviewStatus فيه 'rejected'.",
    tone: "neutral",
    queue: null,
    queueNote: NO_CITATION_QUEUE,
  },
  "citations.articlesLinked": {
    group: "citations",
    label: "مواد لها روابط",
    definition: "عدد قيم articleId المميّزة في legal_article_case_links.",
    tone: "good",
    queue: null,
    queueNote: NO_CITATION_QUEUE,
  },

  // ── المبادئ ──
  "principles.total": {
    group: "principles",
    label: "المبادئ",
    definition: "عدد صفوف judicial_principles بكل حالاتها.",
    tone: "neutral",
    queue: { href: principleQueueHref(PRINCIPLE_STATUS_ALL), label: "كل المبادئ" },
  },
  "principles.reviewed": {
    group: "principles",
    label: "مبادئ معتمدة",
    definition: "مبدأ reviewStatus فيه 'reviewed'.",
    tone: "good",
    queue: { href: principleQueueHref("reviewed"), label: "المعتمدة" },
  },
  "principles.pending": {
    group: "principles",
    label: "مبادئ بانتظار المراجعة",
    definition: "مبدأ reviewStatus فيه 'needs_review'.",
    tone: "attention",
    queue: { href: principleQueueHref("needs_review"), label: "بانتظار المراجعة" },
  },
  "principles.rejected": {
    group: "principles",
    label: "مبادئ مرفوضة",
    definition: "مبدأ reviewStatus فيه 'rejected' (مخفي من العرض الافتراضي للقائمة).",
    tone: "neutral",
    queue: { href: principleQueueHref("rejected"), label: "المرفوضة" },
  },
  "principles.otherStatus": {
    group: "principles",
    label: "مبادئ بحالة أخرى",
    definition: "مبدأ reviewStatus فيه قيمة غير الثلاث المعروفة؛ تُعرض كل قيمة منها بنفسها في مرشح القائمة.",
    tone: "attention",
    queue: null,
    queueNote: "كل حالة أخرى لها طابورها في مرشح المبادئ (?status=<الحالة>)؛ لا طابور واحد يجمعها.",
  },

  // ── المسائل القانونية (ملف الفهرس في المستودع) ──
  "issues.total": {
    group: "issues",
    label: "المسائل القانونية",
    definition: "عدد المسائل في فهرس المسائل (getLegalIssuesOverview).",
    tone: "neutral",
    queue: { href: ISSUES_PAGE, label: "فهرس المسائل" },
  },
  "issues.linked": {
    group: "issues",
    label: "مسائل مطابقة عالية",
    definition: "مسألة حالتها linked في الفهرس.",
    tone: "good",
    queue: null,
    queueNote: "فهرس المسائل لا يملك مرشح حالة بعد؛ طابور المسائل في م٥ (ل٦-١).",
  },
  "issues.needsReview": {
    group: "issues",
    label: "مسائل تحتاج مراجعة",
    definition: "مسألة حالتها needs_review أو review_nizam في الفهرس.",
    tone: "attention",
    queue: null,
    queueNote: "فهرس المسائل لا يملك مرشح حالة بعد؛ طابور المسائل في م٥ (ل٦-١).",
  },
  "issues.uncodified": {
    group: "issues",
    label: "مسائل غير مقنّنة",
    definition: "مسألة حالتها uncodified_sharia في الفهرس.",
    tone: "neutral",
    queue: null,
    queueNote: "فهرس المسائل لا يملك مرشح حالة بعد؛ طابور المسائل في م٥ (ل٦-١).",
  },

  // ── الطبقة الفقهية ──
  "fiqh.sources": {
    group: "fiqh",
    label: "مصادر فقهية",
    definition: "عدد صفوف fiqh_sources.",
    tone: "neutral",
    queue: null,
    queueNote: NO_FIQH_QUEUE,
  },
  "fiqh.texts": {
    group: "fiqh",
    label: "نصوص فقهية",
    definition: "صف في fiqh_texts غير محذوف (deleted_at فارغ).",
    tone: "neutral",
    queue: null,
    queueNote: NO_FIQH_QUEUE,
  },
  "fiqh.alignmentsPending": {
    group: "fiqh",
    label: "مواءمات فقهية بانتظار المراجعة",
    definition: "صف في fiqh_article_alignments حالته needs_review وغير محذوف. لا ينطبق ما دامت النصوص الفقهية صفرًا.",
    tone: "attention",
    queue: null,
    queueNote: NO_FIQH_QUEUE,
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRIC_DEFINITIONS;

export const METRIC_IDS = Object.keys(METRIC_DEFINITIONS) as MetricId[];

export interface Metric extends MetricDefinition {
  id: MetricId;
  value: MetricValue;
}

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  href: string | null;
}

export type Breakdown = { ok: true; rows: BreakdownRow[]; total: number } | { ok: false; reason: string };

export interface LegalMetricsSnapshot {
  generatedAt: string;
  groups: MetricGroup[];
  metrics: Partial<Record<MetricId, Metric>>;
  breakdowns: {
    principlesByStatus?: Breakdown;
    citationsByStatus?: Breakdown;
    citationsByRelation?: Breakdown;
  };
}

/** عدّاد المسائل من ملف الفهرس (يُحقن ليبقى المنطق قابلًا للاختبار بلا نظام ملفات). */
export interface LegalIssuesCounts {
  total: number;
  byStatus: Record<string, number>;
}

export interface LoadOptions {
  groups?: readonly MetricGroup[];
  legalIssues?: () => LegalIssuesCounts | null;
  now?: () => Date;
  /** للاختبار: أسماء الركائز ذات التاريخ المكتوب (الافتراضي من core-systems.ts). */
  coreIssuedNames?: readonly string[];
}

// ── التعريفات بلغة SQL (المرجع الوحيد) ───────────────────────────────────────

export const SQL_PREDICATES = {
  articleNoClassification: `(a.classification IS NULL OR btrim(a.classification) = '')`,
  articleNoKeywords: `(NOT EXISTS (SELECT 1 FROM unnest(a.keywords) AS k(v) WHERE btrim(k.v) <> ''))`,
  articleNoChapter: `(a.chapter IS NULL)`,
  articleDecreeFilled: `(a."royalDecree" IS NOT NULL AND btrim(a."royalDecree") <> '')`,
  systemUnclassified: `(s.domain IS NULL OR btrim(s.domain) = '')`,
} as const;

const P = SQL_PREDICATES;

const SQL = {
  systemsBase: `SELECT count(*)::int AS total,
      count(*) FILTER (WHERE ${P.systemUnclassified})::int AS unclassified
    FROM legal_systems s`,
  // $1 = أسماء الركائز التي لها تاريخ إصدار مكتوب (تعرضه البطاقة قبل law_card).
  systemsIssuance: `WITH latest AS (
      SELECT DISTINCT ON (c.system_id) c.system_id, c.issued_hijri
      FROM law_card c ORDER BY c.system_id, c.created_at DESC, c.id DESC
    )
    SELECT count(*)::int AS no_issuance FROM legal_systems s
    LEFT JOIN latest ON latest.system_id = s.id
    WHERE (latest.issued_hijri IS NULL OR btrim(latest.issued_hijri) = '') AND NOT (s.name = ANY($1::text[]))`,
  // $1 = الحالات الموثّقة (VERIFIED_STATUSES)؛ كالبطاقة: آخر سجل خارجها = «قيد التحقق».
  systemsVerification: `WITH latest AS (
      SELECT DISTINCT ON (v.object_id) v.object_id, v.verified_status
      FROM verification v WHERE v.object_type = 'work' ORDER BY v.object_id, v.verified_at DESC, v.id DESC
    )
    SELECT count(*)::int AS unverified FROM legal_systems s
    LEFT JOIN latest ON latest.object_id = s.id
    WHERE latest.object_id IS NULL OR NOT (latest.verified_status = ANY($1::text[]))`,
  articlesBase: `SELECT count(*)::int AS total,
      count(*) FILTER (WHERE ${P.articleNoClassification})::int AS no_classification,
      count(*) FILTER (WHERE ${P.articleNoKeywords})::int AS no_keywords,
      count(*) FILTER (WHERE ${P.articleNoChapter})::int AS no_chapter,
      count(*) FILTER (WHERE ${P.articleNoClassification} OR ${P.articleNoKeywords} OR ${P.articleNoChapter})::int AS needs_review,
      count(*) FILTER (WHERE ${P.articleDecreeFilled})::int AS decree_filled,
      count(DISTINCT a.classification) FILTER (WHERE NOT ${P.articleNoClassification})::int AS classifications
    FROM legal_articles a`,
  articlesRelations: `SELECT
      (SELECT count(*) FROM legal_relations)::int AS relations,
      (SELECT count(*) FROM legal_articles a
        WHERE NOT EXISTS (SELECT 1 FROM legal_relations r WHERE r.source_type = 'article' AND r.source_id = a.id))::int AS no_relations`,
  judgmentsBase: `SELECT count(*)::int AS total FROM judicial_cases j`,
  // أسرع من NOT EXISTS على كل حكم (5ms مقابل 140ms في قياس الجودة)، والقيد الأجنبي يضمن التطابق.
  judgmentsLinks: `SELECT count(DISTINCT l."caseId")::int AS linked FROM legal_article_case_links l`,
  citationsGroups: `SELECT "reviewStatus" AS status, "relationType" AS relation, count(*)::int AS c
    FROM legal_article_case_links GROUP BY 1, 2`,
  citationsArticles: `SELECT count(DISTINCT "articleId")::int AS articles FROM legal_article_case_links`,
  principlesGroups: `SELECT "reviewStatus" AS status, count(*)::int AS c FROM judicial_principles GROUP BY 1`,
  fiqhSources: `SELECT count(*)::int AS c FROM fiqh_sources`,
  fiqhTexts: `SELECT count(*)::int AS c FROM fiqh_texts WHERE deleted_at IS NULL`,
  fiqhAlignmentsPending: `SELECT count(*)::int AS c FROM fiqh_article_alignments WHERE review_status = 'needs_review' AND deleted_at IS NULL`,
} as const;

/** كل العبارات التي تنفّذها الخدمة (للاختبار: قراءة فقط). */
export const METRIC_SQL_STATEMENTS: readonly string[] = Object.values(SQL);

// ── أدوات ─────────────────────────────────────────────────────────────────────

const count = (value: number): MetricValue => ({ kind: "count", value });
const unavailable = (reason: string): MetricValue => ({ kind: "unavailable", reason });
const notApplicable = (reason: string): MetricValue => ({ kind: "not_applicable", reason });

const toInt = (v: unknown): number => {
  const n = typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function reasonOf(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/does not exist|42P01|42703/.test(msg)) return "المصدر غير موجود في القاعدة (جدول أو عمود غير مطبَّق).";
  return "تعذّرت قراءة المصدر.";
}

async function probe<T extends Record<string, unknown>>(
  sql: MetricsSql,
  text: string,
  params?: readonly unknown[],
): Promise<{ ok: true; row: T; rows: T[] } | { ok: false; reason: string }> {
  try {
    const rows = await sql.query<T>(text, params);
    return { ok: true, row: (rows[0] ?? {}) as T, rows };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

export function isCount(value: MetricValue): value is { kind: "count"; value: number } {
  return value.kind === "count";
}

/** القيمة العددية أو null (لا ينطبق / غير متاح). لا تُسقط إلى صفر أبدًا. */
export function metricNumber(value: MetricValue): number | null {
  return value.kind === "count" ? value.value : null;
}

/** العرض النصي الموحّد للقيمة. */
export function formatMetricValue(value: MetricValue): string {
  if (value.kind === "count") return value.value.toLocaleString("ar-SA");
  if (value.kind === "not_applicable") return "لا ينطبق";
  return "غير متاح";
}

// ── التحميل ───────────────────────────────────────────────────────────────────

type Values = Partial<Record<MetricId, MetricValue>>;

/** الركائز التي تعرض البطاقة تاريخ إصدارها من الكود (core-systems.ts). */
export const CORE_ISSUED_NAMES: readonly string[] = CORE_SYSTEMS.filter((c) => !!c.issuanceDateH).map((c) => c.lawName);

async function loadSystems(sql: MetricsSql, v: Values, coreIssuedNames: readonly string[]) {
  const [base, issuance, verification] = await Promise.all([
    probe<{ total: number; unclassified: number }>(sql, SQL.systemsBase),
    probe<{ no_issuance: number }>(sql, SQL.systemsIssuance, [[...coreIssuedNames]]),
    probe<{ unverified: number }>(sql, SQL.systemsVerification, [[...VERIFIED_STATUSES]]),
  ]);
  v["systems.total"] = base.ok ? count(toInt(base.row.total)) : unavailable(base.reason);
  v["systems.unclassified"] = base.ok ? count(toInt(base.row.unclassified)) : unavailable(base.reason);
  v["systems.noIssuanceDate"] = issuance.ok ? count(toInt(issuance.row.no_issuance)) : unavailable(issuance.reason);
  v["systems.unverifiedStatus"] = verification.ok ? count(toInt(verification.row.unverified)) : unavailable(verification.reason);
}

type ArticlesRow = {
  total: number;
  no_classification: number;
  no_keywords: number;
  no_chapter: number;
  needs_review: number;
  decree_filled: number;
  classifications: number;
};

async function loadArticles(sql: MetricsSql, v: Values) {
  const [base, relations] = await Promise.all([
    probe<ArticlesRow>(sql, SQL.articlesBase),
    probe<{ relations: number; no_relations: number }>(sql, SQL.articlesRelations),
  ]);
  const fromBase = (key: keyof ArticlesRow): MetricValue => (base.ok ? count(toInt(base.row[key])) : unavailable(base.reason));
  v["articles.total"] = fromBase("total");
  v["articles.noClassification"] = fromBase("no_classification");
  v["articles.noKeywords"] = fromBase("no_keywords");
  v["articles.noChapter"] = fromBase("no_chapter");
  v["articles.needsReview"] = fromBase("needs_review");
  v["articles.decreeFilled"] = fromBase("decree_filled");
  v["articles.classifications"] = fromBase("classifications");
  v["articles.noRelations"] = relations.ok ? count(toInt(relations.row.no_relations)) : unavailable(relations.reason);
  v["articles.relationsTotal"] = relations.ok ? count(toInt(relations.row.relations)) : unavailable(relations.reason);
  v["articles.duplicates"] = unavailable("لا تعريف معتمد للتكرار بعد.");
}

/**
 * الشروح (ع-٢ ومراجعة الجودة م-١): لا جدول شروح بمصدر بعد، فالثلاثة «لا ينطبق».
 * لا تُقرأ annotations: هي ملاحظات خاصة لكل مستخدم، وعدّها «شروحًا» يكشف نشاط المستخدمين في عدّاد عام.
 */
function loadExplanations(v: Values) {
  const reason = "لا جدول شروح بمصدر بعد (ل٢-٦ في م٣).";
  v["explanations.total"] = notApplicable(reason);
  v["explanations.withoutSource"] = notApplicable(reason);
  v["articles.noExplanation"] = notApplicable(reason);
}

async function loadJudgments(sql: MetricsSql, v: Values) {
  const [base, links] = await Promise.all([
    probe<{ total: number }>(sql, SQL.judgmentsBase),
    probe<{ linked: number }>(sql, SQL.judgmentsLinks),
  ]);
  v["judgments.total"] = base.ok ? count(toInt(base.row.total)) : unavailable(base.reason);
  v["judgments.linked"] = links.ok ? count(toInt(links.row.linked)) : unavailable(links.reason);
  v["judgments.unlinked"] =
    base.ok && links.ok ? count(Math.max(0, toInt(base.row.total) - toInt(links.row.linked))) : unavailable(base.ok ? (links as { reason: string }).reason : base.reason);
}

function citationStatusLabel(status: string): string {
  if (status === "verified") return "موثّق رسميًا";
  if (status === "rejected") return "مرفوض";
  if (status === "needs_review") return "مسترجع آليًا — يحتاج مراجعة";
  return `حالة أخرى: ${status}`;
}

async function loadCitations(sql: MetricsSql, v: Values, breakdowns: LegalMetricsSnapshot["breakdowns"], relationLabel: (k: string) => string) {
  const [groups, articles] = await Promise.all([
    probe<{ status: string; relation: string; c: number }>(sql, SQL.citationsGroups),
    probe<{ articles: number }>(sql, SQL.citationsArticles),
  ]);
  v["citations.articlesLinked"] = articles.ok ? count(toInt(articles.row.articles)) : unavailable(articles.reason);
  if (!groups.ok) {
    for (const id of ["citations.total", "citations.pending", "citations.verified", "citations.rejected"] as const) v[id] = unavailable(groups.reason);
    breakdowns.citationsByStatus = { ok: false, reason: groups.reason };
    breakdowns.citationsByRelation = { ok: false, reason: groups.reason };
    return;
  }
  const byStatus = new Map<string, number>();
  const byRelation = new Map<string, number>();
  let total = 0;
  for (const row of groups.rows) {
    const c = toInt(row.c);
    total += c;
    byStatus.set(String(row.status), (byStatus.get(String(row.status)) ?? 0) + c);
    byRelation.set(String(row.relation), (byRelation.get(String(row.relation)) ?? 0) + c);
  }
  v["citations.total"] = count(total);
  v["citations.pending"] = count(byStatus.get("needs_review") ?? 0);
  v["citations.verified"] = count(byStatus.get("verified") ?? 0);
  v["citations.rejected"] = count(byStatus.get("rejected") ?? 0);
  const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  breakdowns.citationsByStatus = {
    ok: true,
    total,
    rows: sorted(byStatus).map(([key, c]) => ({ key, label: citationStatusLabel(key), count: c, href: null })),
  };
  breakdowns.citationsByRelation = {
    ok: true,
    total,
    rows: sorted(byRelation).map(([key, c]) => ({ key, label: relationLabel(key), count: c, href: null })),
  };
}

async function loadPrinciples(sql: MetricsSql, v: Values, breakdowns: LegalMetricsSnapshot["breakdowns"]) {
  const r = await probe<{ status: string; c: number }>(sql, SQL.principlesGroups);
  if (!r.ok) {
    for (const id of ["principles.total", "principles.reviewed", "principles.pending", "principles.rejected", "principles.otherStatus"] as const) {
      v[id] = unavailable(r.reason);
    }
    breakdowns.principlesByStatus = { ok: false, reason: r.reason };
    return;
  }
  const byStatus = new Map<string, number>();
  for (const row of r.rows) byStatus.set(String(row.status), (byStatus.get(String(row.status)) ?? 0) + toInt(row.c));
  const known = new Set<string>(KNOWN_PRINCIPLE_STATUSES);
  let total = 0;
  let other = 0;
  for (const [status, c] of byStatus) {
    total += c;
    if (!known.has(status)) other += c;
  }
  v["principles.total"] = count(total);
  v["principles.reviewed"] = count(byStatus.get("reviewed") ?? 0);
  v["principles.pending"] = count(byStatus.get("needs_review") ?? 0);
  v["principles.rejected"] = count(byStatus.get("rejected") ?? 0);
  v["principles.otherStatus"] = count(other);
  // ل٥-٦: الحالات الثلاث المعروفة تظهر دائمًا (ولو صفرًا)، ثم كل حالة أخرى بنفسها؛ المجموع = الإجمالي.
  const extra = [...byStatus.keys()].filter((s) => !known.has(s)).sort();
  breakdowns.principlesByStatus = {
    ok: true,
    total,
    rows: [...KNOWN_PRINCIPLE_STATUSES, ...extra].map((key) => ({
      key,
      label: principleStatusLabel(key),
      count: byStatus.get(key) ?? 0,
      href: principleQueueHref(key),
    })),
  };
}

function loadIssues(v: Values, source: LoadOptions["legalIssues"]) {
  let counts: LegalIssuesCounts | null = null;
  let reason = "فهرس المسائل غير متاح.";
  try {
    counts = source ? source() : null;
  } catch (error) {
    reason = reasonOf(error);
  }
  if (!counts) {
    for (const id of ["issues.total", "issues.linked", "issues.needsReview", "issues.uncodified"] as const) v[id] = unavailable(reason);
    return;
  }
  const s = counts.byStatus;
  v["issues.total"] = count(toInt(counts.total));
  v["issues.linked"] = count(toInt(s.linked));
  v["issues.needsReview"] = count(toInt(s.needs_review) + toInt(s.review_nizam));
  v["issues.uncodified"] = count(toInt(s.uncodified_sharia));
}

async function loadFiqh(sql: MetricsSql, v: Values) {
  const [sources, texts, pending] = await Promise.all([
    probe<{ c: number }>(sql, SQL.fiqhSources),
    probe<{ c: number }>(sql, SQL.fiqhTexts),
    probe<{ c: number }>(sql, SQL.fiqhAlignmentsPending),
  ]);
  v["fiqh.sources"] = sources.ok ? count(toInt(sources.row.c)) : unavailable(sources.reason);
  v["fiqh.texts"] = texts.ok ? count(toInt(texts.row.c)) : unavailable(texts.reason);
  if (texts.ok && toInt(texts.row.c) === 0) {
    v["fiqh.alignmentsPending"] = notApplicable("لا توجد نصوص فقهية بعد.");
  } else {
    v["fiqh.alignmentsPending"] = pending.ok ? count(toInt(pending.row.c)) : unavailable(pending.reason);
  }
}

/**
 * يحمّل مجموعات المقاييس المطلوبة. كل مجموعة تقرأ مصادرها باستعلامات مستقلة،
 * فتعذّر مصدر واحد يجعل مقاييسه وحدها «غير متاح».
 */
export async function loadLegalMetrics(
  sql: MetricsSql,
  options: LoadOptions & { relationLabel?: (key: string) => string } = {},
): Promise<LegalMetricsSnapshot> {
  const groups = [...new Set(options.groups ?? METRIC_GROUPS)];
  const values: Values = {};
  const breakdowns: LegalMetricsSnapshot["breakdowns"] = {};
  const relationLabel = options.relationLabel ?? ((k: string) => k);
  const tasks: Promise<void>[] = [];
  for (const group of groups) {
    if (group === "systems") tasks.push(loadSystems(sql, values, options.coreIssuedNames ?? CORE_ISSUED_NAMES));
    else if (group === "articles") tasks.push(loadArticles(sql, values));
    else if (group === "explanations") loadExplanations(values);
    else if (group === "judgments") tasks.push(loadJudgments(sql, values));
    else if (group === "citations") tasks.push(loadCitations(sql, values, breakdowns, relationLabel));
    else if (group === "principles") tasks.push(loadPrinciples(sql, values, breakdowns));
    else if (group === "issues") loadIssues(values, options.legalIssues);
    else if (group === "fiqh") tasks.push(loadFiqh(sql, values));
  }
  await Promise.all(tasks);
  const metrics: Partial<Record<MetricId, Metric>> = {};
  for (const id of METRIC_IDS) {
    const value = values[id];
    if (value) metrics[id] = { id, ...METRIC_DEFINITIONS[id], value };
  }
  return { generatedAt: (options.now?.() ?? new Date()).toISOString(), groups, metrics, breakdowns };
}

/**
 * سياق العرض: داخل مكتب التحرير (/admin/legal) يفتح عدّاد «مبادئ بانتظار المراجعة» طابور المكتب الذي
 * يفرض «معتمِد غير المُعِدّ»، لا القائمة القديمة ذات زر الاعتماد المباشر (مراجعة الجودة ع٢ وم-٤).
 * طابور المكتب يعرض «طابوري» و«ينتظر غيري»، ومجموعهما = العدّاد.
 */
export type MetricsContext = "core" | "desk";
export const DESK_QUEUE_OVERRIDES: Partial<Record<MetricId, MetricQueue>> = {
  "principles.pending": { href: "/admin/legal/queue?tab=principles", label: "طابور المكتب" },
};

export function inContext(snapshot: LegalMetricsSnapshot, context: MetricsContext): LegalMetricsSnapshot {
  if (context === "core") return snapshot;
  const metrics: Partial<Record<MetricId, Metric>> = { ...snapshot.metrics };
  for (const [id, queue] of Object.entries(DESK_QUEUE_OVERRIDES) as Array<[MetricId, MetricQueue]>) {
    const m = metrics[id];
    if (m) metrics[id] = { ...m, queue };
  }
  return { ...snapshot, metrics };
}

/** يقرأ مقياسًا محمّلًا. طلب مقياس من مجموعة لم تُحمَّل خطأ برمجي لا صفر. */
export function metric(snapshot: LegalMetricsSnapshot, id: MetricId): Metric {
  const found = snapshot.metrics[id];
  if (!found) throw new Error(`legalMetricsService: المقياس ${id} من مجموعة لم تُحمَّل (${METRIC_DEFINITIONS[id].group}).`);
  return found;
}

// ── طابور المبادئ (ل٠-٢ / ل٥-٦): القائمة تقرأ من الخدمة نفسها فيطابق عددها العدّاد ──

export interface PrincipleFilters {
  q?: string;
  court?: string;
  /** "" = كل ما عدا المرفوض (الافتراضي القائم)، "all" = كل الحالات، غير ذلك = حالة بعينها. */
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PrincipleRow {
  id: string;
  title: string;
  principleText: string;
  court: string | null;
  topic: string | null;
  confidence: number | null;
  reviewStatus: string;
  sourceCaseId: string;
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

function principleWhere(f: PrincipleFilters): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const q = (f.q ?? "").trim();
  const court = (f.court ?? "").trim();
  const status = (f.status ?? "").trim();
  if (q) {
    params.push(likePattern(q));
    parts.push(`(p.title ILIKE $${params.length} OR p."principleText" ILIKE $${params.length})`);
  }
  if (court) {
    params.push(court);
    parts.push(`p.court = $${params.length}`);
  }
  if (!status) parts.push(`p."reviewStatus" <> 'rejected'`);
  else if (status !== PRINCIPLE_STATUS_ALL) {
    params.push(status);
    parts.push(`p."reviewStatus" = $${params.length}`);
  }
  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

export async function countPrinciples(sql: MetricsSql, f: PrincipleFilters): Promise<number> {
  const { clause, params } = principleWhere(f);
  const rows = await sql.query<{ c: number }>(`SELECT count(*)::int AS c FROM judicial_principles p ${clause}`, params);
  return toInt(rows[0]?.c);
}

export async function listPrinciples(sql: MetricsSql, f: PrincipleFilters): Promise<{ total: number; items: PrincipleRow[] }> {
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const { clause, params } = principleWhere(f);
  const [total, items] = await Promise.all([
    countPrinciples(sql, f),
    sql.query<PrincipleRow>(
      `SELECT p.id, p.title, p."principleText", p.court, p.topic, p.confidence, p."reviewStatus", p."sourceCaseId"
       FROM judicial_principles p ${clause}
       ORDER BY p."createdAt" DESC, p.id DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    ),
  ]);
  return { total, items };
}

export async function principleCourts(sql: MetricsSql, limit = 12): Promise<Array<{ court: string; count: number }>> {
  const rows = await sql.query<{ court: string; c: number }>(
    `SELECT court, count(*)::int AS c FROM judicial_principles WHERE court IS NOT NULL AND btrim(court) <> ''
     GROUP BY court ORDER BY c DESC, court ASC LIMIT ${Math.min(60, Math.max(1, limit))}`,
  );
  return rows.map((r) => ({ court: r.court, count: toInt(r.c) }));
}
