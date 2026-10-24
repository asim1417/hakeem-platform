/**
 * HKM-044 المرحلة الأولى — أدوات الفهرس والتشخيص فوق SqlClient (تُختبر على قاعدة محلية):
 *   hakeem_list_categories  التصنيفات وأنواع التشريع بأعدادها.
 *   hakeem_list_laws        تصفّح المدونة بلا كلمة بحث (نوع، تصنيف، حالة، سنة إصدار) بترقيم.
 *   hakeem_resolve          حسم اسم مرسل أو مختصر أو فيه خطأ إملائي إلى معرّف نظام.
 *   hakeem_stats            ما في المدونة فعلًا: الأنظمة بأنواعها وحالاتها، والمواد، والأحكام بمحاكمها وسنواتها.
 *   hakeem_health           حياة الخادم والقاعدة وأعلام البحث.
 * والمرشحات المشتركة (lawIdsForFilters) لبقية أدوات المرحلة. قراءة فقط، لا كتابة.
 *
 * الحالة من آخر سجل تحقق للعمل (verification، object_type='work') بقائمة الهيئة (toBoeStatus)؛ وما لا سجل له «غير مؤكد».
 * سنة الإصدار من بطاقة الهيئة ثم سجل الإصدار ثم حقل أداة الإصدار. الجداول الاختيارية (law_card، verification،
 * legal_system_issuance) يُسأل عن وجودها قبل قراءتها، فتعمل الأدوات على قاعدة لم تُطبَّق عليها ترحيلاتها.
 */
import type { SqlClient } from "../../modules/legal-core/sql-port";
import { relationExists } from "../../modules/legal-core/sql-port";
import { toBoeStatus } from "../../modules/legal-core/law-page-data";
import { normalizeLawName, rankLawNameMatches, type LawCandidate } from "../../modules/legal-core/law-name-match";
import { resolveWorkKind, WORK_KINDS } from "../../modules/legal-core/work-kind";
import { NON_ARTICLE_BIS } from "../../modules/legal-core/article-key";

export interface CatalogLaw {
  law_id: string;
  name: string;
  kind: string | null;
  category: string | null;
  category_code: string | null;
  classification: string | null;
  status: string;
  issued_year_h: number | null;
  issued_h: string | null;
  articles_count: number;
}

/** الحالات كما تُعرض (قائمة الهيئة) وما لا سجل له. */
export const UNKNOWN_STATUS = "غير مؤكد";
const RETIRED = new Set(["لاغي"]);

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** السنة الهجرية من نص تاريخ أو أداة («1444/11/29»، «5 / 1 / 1421»، «مرسوم … 1435»). */
export function hijriYearOf(text: string | null | undefined): number | null {
  const t = toLatin(String(text ?? ""));
  // سنة داخل تاريخ أولًا (يوم/شهر/سنة أو سنة/شهر/يوم): رقم أداة من أربعة أرقام («رقم (1435)») لا يُقرأ سنة.
  const dmy = /(?:^|\D)\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*(1[34]\d{2})(?=\D|$)/.exec(t);
  const ymd = /(?:^|\D)(1[34]\d{2})\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{1,2}(?=\D|$)/.exec(t);
  const dated = [dmy, ymd].filter((m): m is RegExpExecArray => m !== null).sort((a, b) => a.index - b.index)[0];
  if (dated) return Number(dated[1]);
  const m = t.match(/(?:^|\D)(1[34]\d{2})(?=\D|$)/);
  return m ? Number(m[1]) : null;
}

let cache: { at: number; rows: CatalogLaw[] } | null = null;
const CACHE_MS = 5 * 60_000;

/** للاختبارات: يُسقط الفهرس المخزَّن. */
export function resetCatalogCache(): void {
  cache = null;
}

/** فهرس الأنظمة كلها بحالاتها وسنواتها (يُخزَّن 5 دقائق). */
export async function loadLawCatalog(db: SqlClient): Promise<CatalogLaw[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const [hasVer, hasCard, hasIss] = await Promise.all([
    relationExists(db, "verification"),
    relationExists(db, "law_card"),
    relationExists(db, "legal_system_issuance"),
  ]);
  const verSql = hasVer
    ? `(SELECT v.verified_status FROM verification v WHERE v.object_type = 'work' AND v.object_id = s.id ORDER BY v.verified_at DESC, v.id DESC LIMIT 1)`
    : `NULL::text`;
  const cardSql = hasCard ? `(SELECT c.issued_hijri FROM law_card c WHERE c.system_id = s.id ORDER BY c.created_at DESC, c.id DESC LIMIT 1)` : `NULL::text`;
  const issSql = hasIss ? `(SELECT i.issue_date_hijri FROM legal_system_issuance i WHERE i.system_id = s.id ORDER BY i.created_at DESC LIMIT 1)` : `NULL::text`;
  const rows = await db.query<{
    id: string;
    name: string;
    code: string | null;
    domain: string | null;
    domain_title: string | null;
    classification: string | null;
    article_count: number | string;
    instrument_kind: string | null;
    verified_status: string | null;
    card_issued: string | null;
    issuance_date: string | null;
    royal_decree: string | null;
  }>(
    `SELECT s.id, s.name, s.code, s.domain, s.domain_title, s.classification, s."articleCount" AS article_count,
            s.instrument_kind, ${verSql} AS verified_status, ${cardSql} AS card_issued, ${issSql} AS issuance_date,
            s.preamble_royal_decree AS royal_decree
       FROM legal_systems s
      ORDER BY s.name`,
  );
  const out = rows.map((r): CatalogLaw => {
    const issued = r.card_issued ?? r.issuance_date ?? null;
    return {
      law_id: r.id,
      name: r.name,
      kind: resolveWorkKind(r.name, r.instrument_kind),
      category: r.domain_title ?? r.classification ?? null,
      category_code: r.domain ?? null,
      classification: r.classification ?? null,
      status: toBoeStatus(r.verified_status) ?? UNKNOWN_STATUS,
      issued_year_h: hijriYearOf(issued) ?? hijriYearOf(r.royal_decree),
      issued_h: issued,
      articles_count: Number(r.article_count) || 0,
    };
  });
  cache = { at: Date.now(), rows: out };
  return out;
}

// ── المرشحات المشتركة (العقد المشترك، القسم التاسع) ──

export interface LawFilters {
  law_ids?: string[];
  /** رمز التصنيف (domain) أو عنوانه العربي. */
  category?: string;
  /** نوع التشريع: نظام، تنظيم، ترتيبات، لائحة، قواعد، سياسة، استراتيجية. */
  kind?: string;
  /** in_force (الافتراض: يستبعد الملغى بسجل تحقق) أو all. */
  status?: "in_force" | "all";
  issued_from_h?: number;
  issued_to_h?: number;
}

/** هل في المرشحات قيد غير الحالة؟ */
export function hasNarrowingFilters(f: LawFilters): boolean {
  return Boolean(f.law_ids?.length || f.category || f.kind || f.issued_from_h || f.issued_to_h);
}

/** ينطبق نظام على المرشحات؟ نقي. */
export function lawMatchesFilters(l: CatalogLaw, f: LawFilters): boolean {
  if (f.law_ids?.length && !f.law_ids.includes(l.law_id)) return false;
  if (f.category) {
    const c = normalizeLawName(f.category);
    if (l.category_code !== f.category && normalizeLawName(l.category ?? "") !== c && normalizeLawName(l.classification ?? "") !== c) return false;
  }
  if (f.kind && l.kind !== f.kind) return false;
  if ((f.status ?? "in_force") === "in_force" && RETIRED.has(l.status)) return false;
  if (f.issued_from_h && (l.issued_year_h === null || l.issued_year_h < f.issued_from_h)) return false;
  if (f.issued_to_h && (l.issued_year_h === null || l.issued_year_h > f.issued_to_h)) return false;
  return true;
}

/**
 * نطاق الأنظمة للمرشحات: include قائمة الأنظمة المطابقة حين يوجد قيد يضيّق (نظام، تصنيف، نوع، سنة)؛
 * وإلا exclude الأنظمة الملغاة وحدها (الحالة الافتراضية in_force)، فلا تُمرَّر قائمة المدونة كلها معاملًا.
 * المادة اليتيمة (بلا legalSystemId) تدخل في وضع الاستبعاد ولا تدخل في وضع الحصر.
 */
export interface LawScope {
  include: string[] | null;
  exclude: string[];
  /** عدد الأنظمة الملغاة التي استُبعدت من النطاق المطلوب. */
  excluded_retired: number;
  label: string;
}

export async function lawScopeForFilters(db: SqlClient, f: LawFilters): Promise<LawScope> {
  const all = await loadLawCatalog(db);
  const inForce = (f.status ?? "in_force") === "in_force";
  const retiredInScope = inForce ? all.filter((l) => RETIRED.has(l.status) && lawMatchesFilters(l, { ...f, status: "all" })) : [];
  const label = filtersLabel(f);
  if (hasNarrowingFilters(f)) {
    return { include: all.filter((l) => lawMatchesFilters(l, f)).map((l) => l.law_id), exclude: [], excluded_retired: retiredInScope.length, label };
  }
  return { include: null, exclude: retiredInScope.map((l) => l.law_id), excluded_retired: retiredInScope.length, label };
}

/** شرط النطاق على عمود النظام (يضيف معاملاته). "" = بلا قيد. */
export function lawScopeSql(scope: LawScope, params: unknown[], col = `a."legalSystemId"`): string {
  if (scope.include) {
    params.push(scope.include);
    return `${col} = ANY($${params.length}::text[])`;
  }
  if (scope.exclude.length) {
    params.push(scope.exclude);
    return `(${col} IS NULL OR NOT (${col} = ANY($${params.length}::text[])))`;
  }
  return "";
}

/** المرشحات من مدخلات الأداة (law_id يُضم إلى law_ids). */
export function filtersFromArgs(a: {
  law_id?: string;
  law_ids?: string[];
  category?: string;
  kind?: string;
  status?: "in_force" | "all";
  issued_from_h?: number;
  issued_to_h?: number;
}): LawFilters {
  const ids = [...(a.law_ids ?? []), ...(a.law_id ? [a.law_id] : [])].filter(Boolean);
  return {
    ...(ids.length ? { law_ids: [...new Set(ids)] } : {}),
    ...(a.category ? { category: a.category } : {}),
    ...(a.kind ? { kind: a.kind } : {}),
    status: a.status ?? "in_force",
    ...(a.issued_from_h ? { issued_from_h: a.issued_from_h } : {}),
    ...(a.issued_to_h ? { issued_to_h: a.issued_to_h } : {}),
  };
}

/** وصف المرشحات في الملاحظات. */
export function filtersLabel(f: LawFilters): string {
  const parts: string[] = [];
  if (f.law_ids?.length) parts.push(`${f.law_ids.length} نظام محدد`);
  if (f.category) parts.push(`تصنيف «${f.category}»`);
  if (f.kind) parts.push(`نوع «${f.kind}»`);
  if (f.issued_from_h || f.issued_to_h) parts.push(`إصدار ${f.issued_from_h ?? "…"}–${f.issued_to_h ?? "…"}هـ`);
  parts.push((f.status ?? "in_force") === "in_force" ? "بلا الأنظمة الملغاة" : "مع الملغاة");
  return parts.join("، ");
}

// ── hakeem_list_categories ──

export async function handleListCategories(db: SqlClient) {
  const all = await loadLawCatalog(db);
  const byCat = new Map<string, { code: string | null; name: string; laws: number; in_force: number }>();
  for (const l of all) {
    const key = l.category_code ?? l.category ?? "";
    const name = l.category ?? "غير مصنّف";
    const e = byCat.get(key) ?? { code: l.category_code, name, laws: 0, in_force: 0 };
    e.laws++;
    if (!RETIRED.has(l.status)) e.in_force++;
    byCat.set(key, e);
  }
  const kinds = new Map<string, number>();
  for (const l of all) kinds.set(l.kind ?? "غير محدد", (kinds.get(l.kind ?? "غير محدد") ?? 0) + 1);
  return {
    categories: [...byCat.values()].sort((a, b) => b.laws - a.laws),
    kinds: [...WORK_KINDS, "غير محدد"].filter((k) => kinds.has(k)).map((k) => ({ kind: k, laws: kinds.get(k) ?? 0 })),
    total_laws: all.length,
    note: "category يقبل الرمز (code) أو الاسم في hakeem_list_laws وأدوات البحث. «غير مصنّف» أنظمة بلا تصنيف بعد.",
  };
}

// ── hakeem_list_laws ──

export async function handleListLaws(
  db: SqlClient,
  args: LawFilters & { sort?: "issued" | "name"; limit?: number; offset?: number },
) {
  const all = await loadLawCatalog(db);
  const f: LawFilters = { ...args, status: args.status ?? "all" };
  const rows = all.filter((l) => lawMatchesFilters(l, f));
  const sorted =
    args.sort === "issued"
      ? [...rows].sort((a, b) => (b.issued_year_h ?? -1) - (a.issued_year_h ?? -1) || a.name.localeCompare(b.name, "ar"))
      : [...rows].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 200);
  const offset = Math.max(0, Math.floor(args.offset ?? 0));
  const page = sorted.slice(offset, offset + limit);
  const next = offset + page.length < sorted.length ? offset + page.length : null;
  const noYear = rows.filter((l) => l.issued_year_h === null).length;
  return {
    total: sorted.length,
    offset,
    returned: page.length,
    next_offset: next,
    filters: filtersLabel(f),
    laws: page,
    note:
      (sorted.length ? `${sorted.length} نظامًا مطابقًا.` : "لا نظام يطابق هذه المرشحات.") +
      (args.issued_from_h || args.issued_to_h ? ` الأنظمة بلا سنة إصدار معروفة (${noYear} في المطابق قبل قيد السنة) لا تدخل قيد السنة.` : "") +
      ` الافتراض هنا status=all (كل الحالات)؛ «${UNKNOWN_STATUS}» = لا سجل تحقق للحالة.`,
  };
}

// ── hakeem_resolve ──

/** مسافة تحرير (ليفنشتاين) بحدّ؛ لتصويب الخطأ الإملائي في الاسم. */
function editDistance(a: string, b: string, max = 6): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

export async function handleResolve(db: SqlClient, args: { q: string; kind?: string; limit?: number }) {
  const all = await loadLawCatalog(db);
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 1), 20);
  const pool = args.kind ? all.filter((l) => l.kind === args.kind) : all;
  // لا أسماء مستعارة مثبتة: «نظام العمل والعمال» نظام قائم (ملغى) لا اسم آخر لنظام العمل، و«المعاملات» تحتمل المدنية
  // والإلكترونية؛ الترتيب والبدائل يحسمان، والملغى يتأخر داخل درجته.
  const q = String(args.q ?? "").trim();
  const cands: LawCandidate[] = pool.map((l) => ({ id: l.law_id, name: l.name, articleCount: l.articles_count }));
  const retired = new Set(pool.filter((l) => RETIRED.has(l.status)).map((l) => l.law_id));
  const ranked = rankLawNameMatches(cands, q, { retired });
  const byId = new Map(pool.map((l) => [l.law_id, l]));
  type Cand = CatalogLaw & { match: string; score: number };
  let out: Cand[] = [];
  if (ranked.match) {
    const score = ranked.matchType === "exact" ? 1 : ranked.matchType === "prefix" ? 0.85 : 0.7;
    out = [ranked.match, ...ranked.alternatives].map((c, i) => ({ ...byId.get(c.id)!, match: i === 0 ? ranked.matchType : "alternative", score: i === 0 ? score : 0.5 }));
  } else {
    // لا تامة ولا جزئية: أقرب الأسماء بمسافة التحرير على الاسم المطبَّع (خطأ إملائي، كلمة زائدة أو ناقصة).
    const nqq = normalizeLawName(q);
    const scored = pool
      .map((l) => {
        const n = normalizeLawName(l.name);
        const d = Math.min(editDistance(nqq, n), editDistance(`نظام ${nqq}`, n));
        return { l, d, len: Math.max(n.length, nqq.length) };
      })
      .filter((x) => x.d <= Math.max(2, Math.floor(x.len * 0.2)))
      .sort((a, b) => a.d - b.d || b.l.articles_count - a.l.articles_count);
    out = scored.map((x) => ({ ...x.l, match: "fuzzy", score: Math.max(0.3, 1 - x.d / x.len) }));
  }
  out = out.slice(0, limit);
  return {
    q: args.q,
    count: out.length,
    candidates: out,
    note: out.length
      ? out[0].match === "fuzzy"
        ? "لا مطابقة تامة؛ هذه أقرب الأسماء إملائيًّا — تحقّق من الاسم قبل البناء عليه."
        : "المرشح الأول بالمطابقة (تامة ← يبدأ بـ ← احتواء)، والملغى يتأخر داخل درجته."
      : "لا نظام بهذا الاسم ولا قريب منه في المدونة. جرّب اسمًا أقصر أو hakeem_list_laws.",
  };
}

// ── hakeem_stats ──

async function safeQuery<T>(db: SqlClient, table: string, sql: string, fallback: T[]): Promise<T[] | null> {
  if (!(await relationExists(db, table))) return null;
  try {
    return await db.query<T>(sql);
  } catch {
    return fallback;
  }
}

export async function handleStats(db: SqlClient) {
  const all = await loadLawCatalog(db);
  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const l of all) {
    byKind[l.kind ?? "غير محدد"] = (byKind[l.kind ?? "غير محدد"] ?? 0) + 1;
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
  }
  const [articles, versions, rulingsByCourt, rulingsByYear, bylaws, thesaurus, lastUpdate] = await Promise.all([
    safeQuery<{ n: string }>(db, "legal_articles", `SELECT count(*)::text AS n FROM legal_articles WHERE "articleBis" < ${NON_ARTICLE_BIS} AND "articleNumber" > 0`, []),
    safeQuery<{ n: string }>(db, "unit_version", `SELECT count(DISTINCT unit_id)::text AS n FROM unit_version`, []),
    safeQuery<{ court: string | null; n: string }>(db, "judicial_cases", `SELECT court, count(*)::text AS n FROM judicial_cases GROUP BY court ORDER BY count(*) DESC LIMIT 30`, []),
    safeQuery<{ y: string | null; n: string }>(
      db,
      "judicial_cases",
      `SELECT substring(translate(coalesce("decisionDateText", ''), '٠١٢٣٤٥٦٧٨٩', '0123456789') from '(1[34][0-9][0-9])') AS y, count(*)::text AS n
         FROM judicial_cases GROUP BY 1 ORDER BY 1 DESC NULLS LAST LIMIT 40`,
      [],
    ),
    safeQuery<{ n: string }>(db, "legal_relations", `SELECT count(*)::text AS n FROM legal_relations WHERE relation::text = 'IMPLEMENTS'`, []),
    safeQuery<{ n: string }>(db, "legal_thesaurus_concepts", `SELECT count(*)::text AS n FROM legal_thesaurus_concepts`, []),
    safeQuery<{ t: string | null }>(db, "legal_articles", `SELECT max("updatedAt")::text AS t FROM legal_articles`, []),
  ]);
  const num = (r: Array<{ n: string }> | null) => (r && r[0] ? Number(r[0].n) : null);
  const rulingsTotal = rulingsByCourt ? rulingsByCourt.reduce((s, r) => s + Number(r.n), 0) : null;
  const unclassified = all.filter((l) => !l.category).length;
  return {
    laws: { total: all.length, by_kind: byKind, by_status: byStatus, unclassified, without_issue_year: all.filter((l) => l.issued_year_h === null).length },
    articles: { total: num(articles), with_dated_versions: num(versions) },
    rulings: {
      total: rulingsTotal,
      by_court: rulingsByCourt?.map((r) => ({ court: r.court ?? "غير محدد", count: Number(r.n) })) ?? null,
      by_year_h: rulingsByYear?.map((r) => ({ year_h: r.y ? Number(r.y) : null, count: Number(r.n) })) ?? null,
    },
    bylaw_links: num(bylaws),
    thesaurus_concepts: num(thesaurus),
    last_article_update: lastUpdate?.[0]?.t ?? null,
    note: "أعداد من القاعدة لحظة الطلب. null = الجدول غير موجود في هذه القاعدة. الحالة من آخر سجل تحقق، و«غير مؤكد» بلا سجل.",
  };
}

// ── hakeem_health ──

export async function handleHealth(db: SqlClient, info: { tools: number; semantic: boolean }) {
  const t0 = Date.now();
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await db.query(`SELECT 1 AS ok`);
    dbOk = true;
  } catch (e) {
    dbError = String((e as Error)?.message ?? e).slice(0, 120);
  }
  const dbMs = Date.now() - t0;
  let corpus: { laws: number; articles: number } | null = null;
  if (dbOk) {
    try {
      const r = await db.query<{ laws: string; articles: string }>(
        `SELECT (SELECT count(*) FROM legal_systems)::text AS laws, (SELECT count(*) FROM legal_articles WHERE "articleBis" < ${NON_ARTICLE_BIS})::text AS articles`,
      );
      corpus = { laws: Number(r[0]?.laws ?? 0), articles: Number(r[0]?.articles ?? 0) };
    } catch {
      corpus = null;
    }
  }
  return {
    status: dbOk ? "ok" : "degraded",
    server: "hakeem-legal-mcp",
    database: { reachable: dbOk, latency_ms: dbMs, ...(dbError ? { error: dbError } : {}) },
    corpus,
    semantic_search: info.semantic ? "enabled" : "disabled",
    tools_registered: info.tools,
    checked_at: new Date().toISOString(),
  };
}
