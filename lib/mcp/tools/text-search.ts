/**
 * HKM-044 المرحلة الأولى — البحث النصي الدقيق فوق SqlClient (يُختبر على قاعدة محلية):
 *   hakeem_search_phrase   عبارة بكلماتها بترتيبها (exact / word / derivatives) مع العدد والتوزيع والترقيم.
 *   hakeem_search_boolean  استعلام منطقي: AND / OR / NOT (و، أو، دون) وأقواس وعبارات بين علامتي تنصيص.
 *   hakeem_trace_text      من أين هذا النص؟ حرفي، بتصرف يسير، جزئي، جمل قصيرة، أو غير موجود — مع النص قبل التعديل.
 *
 * المطابقة على النص المحفوظ مطبَّعًا (NORM_LATERAL من enumerate.ts، مثل الحصر)، والمعروض النص الساري، ويُوسم ما عُدّل
 * فلم يعد يحوي اللفظ (term_in_current_text=false). المرشحات المشتركة (catalog.ts): الافتراض استبعاد الأنظمة الملغاة.
 * قراءة فقط.
 */
import type { SqlClient } from "../../modules/legal-core/sql-port";
import { articleLabel, NON_ARTICLE_BIS } from "../../modules/legal-core/article-key";
import type { EffectiveArticleText } from "../../modules/legal-core/effective-text";
import { compileTerm, matchModeLabel, normalizeAr, type CompiledTerm, type MatchMode } from "./word-match";
import { anyTermPrefilterSql, NORM_LATERAL, termConditionSql, termPrefilterSql } from "./enumerate";
import { filtersFromArgs, lawScopeForFilters, lawScopeSql, type LawFilters, type LawScope } from "./catalog";

export type EffectiveFn = (rows: Array<{ id: string; content: string | null }>) => Promise<Map<string, EffectiveArticleText>>;
export interface TextSearchDeps {
  /** النص الساري (الإنتاج: effectiveArticleTexts؛ الاختبار: بديل على القاعدة المحلية). */
  effective?: EffectiveFn;
}

async function effectiveOf(deps: TextSearchDeps): Promise<EffectiveFn> {
  if (deps.effective) return deps.effective;
  const m = await import("@/lib/modules/legal-core/effective-text");
  return (rows) => m.effectiveArticleTexts(rows);
}

export interface FilterArgs {
  law_id?: string;
  law_ids?: string[];
  category?: string;
  kind?: string;
  status?: "in_force" | "all";
  issued_from_h?: number;
  issued_to_h?: number;
}

// ── التطبيع مع خريطة المواضع (لتوسيط المقتطف على موضع المطابقة في النص الخام) ──

const MARK = /[ً-ٰٟـ]/;
/** النص المطبَّع وخريطة كل حرف فيه إلى موضعه في الخام (normalizeAr يبدّل حرفًا بحرف أو يحذفه). */
export function normalizeWithMap(raw: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (MARK.test(ch)) continue;
    const n = normalizeAr(ch);
    if (!n) continue;
    norm += n;
    map.push(i);
  }
  return { norm, map };
}

/** مقتطف حول أول مطابقة لأحد الألفاظ، أو بداية النص إن لم يطابق (النص الساري المعدّل). */
export function snippetAround(text: string, terms: CompiledTerm[], len: number): { snippet: string; matched: boolean; truncated: boolean } {
  const { norm, map } = normalizeWithMap(text);
  let at = -1;
  for (const t of terms) {
    if (!norm.toLowerCase().includes(t.literal.toLowerCase())) continue;
    const m = t.regex ? new RegExp(t.regex, "iu").exec(norm) : { index: norm.toLowerCase().indexOf(t.literal.toLowerCase()) };
    if (m) {
      // حد الكلمة قبلها جزء من المطابقة: تقدّم إلى أول حرف.
      const idx = m.index + (t.regex && m.index > 0 ? 1 : 0);
      if (at < 0 || idx < at) at = idx;
    }
  }
  const matched = at >= 0;
  const rawAt = matched ? map[Math.min(at, map.length - 1)] ?? 0 : 0;
  let start = matched ? Math.max(0, rawAt - Math.floor(len / 3)) : 0;
  if (start > 0) {
    const sp = text.lastIndexOf(" ", start);
    if (sp >= 0 && start - sp < 30) start = sp + 1;
  }
  const end = Math.min(text.length, start + len);
  const body = text.slice(start, end);
  return { snippet: `${start > 0 ? "… " : ""}${body}${end < text.length ? " …" : ""}`, matched, truncated: start > 0 || end < text.length };
}

// ── محرك الاستعلام المشترك ──

interface ArticleRow {
  id: string;
  article_number: number;
  article_bis: number;
  law_id: string | null;
  law: string;
  content: string;
}

export interface TextHit {
  article_id: string;
  law: string;
  law_id: string | null;
  article: string;
  article_number: number;
  article_bis: number;
  snippet: string;
  repealed: boolean;
  amended: boolean;
  /** false = طابق النص المحفوظ لكن النص الساري المعدّل لا يحوي اللفظ. */
  term_in_current_text: boolean;
}

async function runArticleQuery(
  db: SqlClient,
  deps: TextSearchDeps,
  o: { where: string; params: unknown[]; scope: LawScope; cursor?: string; pageSize: number; snippetLen: number; snippetTerms: CompiledTerm[] },
) {
  const scopeParams = [...o.params];
  const scopeCond = lawScopeSql(o.scope, scopeParams);
  const base = `(${o.where}) AND a."articleBis" < ${NON_ARTICLE_BIS}${scopeCond ? ` AND ${scopeCond}` : ""}`;
  const byLaw = await db.query<{ law_id: string | null; law: string; n: number }>(
    `SELECT a."legalSystemId" AS law_id, COALESCE(l."name", a."lawName") AS law, COUNT(*)::int AS n
       FROM legal_articles a ${NORM_LATERAL}
       LEFT JOIN legal_systems l ON l."id" = a."legalSystemId"
      WHERE ${base}
      GROUP BY a."legalSystemId", COALESCE(l."name", a."lawName")
      ORDER BY n DESC, law`,
    scopeParams,
  );
  const pageParams = [...scopeParams];
  let pageWhere = base;
  if (o.cursor) {
    pageParams.push(o.cursor);
    pageWhere += ` AND a."id" > $${pageParams.length}`;
  }
  const rows = await db.query<ArticleRow>(
    `SELECT a."id", a."articleNumber" AS article_number, a."articleBis" AS article_bis, a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law, a."content"
       FROM legal_articles a ${NORM_LATERAL}
       LEFT JOIN legal_systems l ON l."id" = a."legalSystemId"
      WHERE ${pageWhere}
      ORDER BY a."id" ASC
      LIMIT ${o.pageSize + 1}`,
    pageParams,
  );
  const hasMore = rows.length > o.pageSize;
  const page = rows.slice(0, o.pageSize);
  const eff = await (await effectiveOf(deps))(page.map((r) => ({ id: r.id, content: r.content })));
  const hits: TextHit[] = page.map((r) => {
    const e = eff.get(r.id);
    const text = e?.text ?? r.content;
    const s = snippetAround(text, o.snippetTerms, o.snippetLen);
    return {
      article_id: r.id,
      law: r.law,
      law_id: r.law_id,
      article: articleLabel(Number(r.article_number), Number(r.article_bis)),
      article_number: Number(r.article_number),
      article_bis: Number(r.article_bis),
      snippet: s.snippet,
      repealed: e?.repealed ?? false,
      amended: e?.source === "unit_version",
      term_in_current_text: s.matched,
    };
  });
  const total = byLaw.reduce((n, r) => n + Number(r.n), 0);
  return {
    total,
    by_law: byLaw.map((r) => ({ law_id: r.law_id, law: r.law, count: Number(r.n) })),
    page: hits,
    next_cursor: hasMore ? page[page.length - 1].id : null,
    hasMore,
  };
}

function scopeOut(scope: LawScope) {
  return { filters: scope.label, laws_in_scope: scope.include ? scope.include.length : null, excluded_retired_laws: scope.excluded_retired, exhaustive: true as const };
}

function searchNote(total: number, hasMore: boolean, scope: LawScope, what: string): string {
  const retired = scope.excluded_retired ? ` استُبعد ${scope.excluded_retired} نظامًا ملغى (status="all" لإدخالها).` : "";
  if (scope.include && scope.include.length === 0) return `لا نظام يطابق المرشحات (${scope.label})، فلم يُفتَّش شيء. هذا ليس نفيًا.`;
  if (total === 0)
    return `فُتّشت المواد في النطاق (${scope.label}) ${what} فلم توجد مادة. هذا نفي في هذا النطاق وبهذه الصيغة وحدها، لا نفي للحكم.${retired}`;
  if (hasMore) return `total وby_law كاملان في النطاق (${scope.label})؛ الصفحة جزء منها — تابع بـ cursor حتى يرجع next_cursor فارغًا.${retired}`;
  return `هذه كل المواد المطابقة في النطاق (${scope.label}).${retired}`;
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => Math.min(Math.max(Math.floor(Number(v ?? dflt) || dflt), lo), hi);

// ── hakeem_search_phrase ──

export type PhraseMode = Extract<MatchMode, "exact" | "word" | "derivatives">;

export async function handleSearchPhrase(
  db: SqlClient,
  args: FilterArgs & { phrase: string; match?: PhraseMode; page_size?: number; cursor?: string; snippet_len?: number },
  deps: TextSearchDeps = {},
) {
  const mode: PhraseMode = args.match ?? "word";
  const c = compileTerm(String(args.phrase ?? ""), mode);
  const filters: LawFilters = filtersFromArgs(args);
  const scope = await lawScopeForFilters(db, filters);
  const matchOut = { mode, rule: matchModeLabel(mode), truncated: Boolean(c?.truncated), ambiguous_with: c?.ambiguous ?? [] };
  if (!c) {
    return { phrase: args.phrase, match: matchOut, scope: scopeOut(scope), total: 0, by_law: [], page: [], next_cursor: null, note: "العبارة بلا حرف ولا رقم، فلم يُفتَّش شيء. هذا ليس نفيًا." };
  }
  const params: unknown[] = [];
  const where = termConditionSql(c, params);
  const r = await runArticleQuery(db, deps, {
    where,
    params,
    scope,
    cursor: args.cursor,
    pageSize: clampInt(args.page_size, 1, 50, 20),
    snippetLen: clampInt(args.snippet_len, 120, 2000, 400),
    snippetTerms: [c],
  });
  const words = c.term.trim().split(/\s+/).length;
  return {
    phrase: args.phrase,
    match: matchOut,
    scope: scopeOut(scope),
    total: r.total,
    by_law: r.by_law,
    page: r.page,
    next_cursor: r.next_cursor,
    note:
      searchNote(r.total, r.hasMore, scope, `بالعبارة (${matchModeLabel(mode)})`) +
      (c.truncated ? " العبارة جاوزت 16 كلمة فطوبق أولها فقط." : "") +
      (words === 1 ? " لفظ واحد: hakeem_enumerate يحصر عدة ألفاظ معًا." : ""),
  };
}

// ── hakeem_search_boolean ──

export type BoolNode =
  | { t: "term"; text: string; phrase: boolean; c: CompiledTerm }
  | { t: "and" | "or"; kids: BoolNode[] }
  | { t: "not"; kid: BoolNode };

type Tok = { k: "term"; v: string; phrase: boolean } | { k: "and" | "or" | "not" | "lp" | "rp" };

const OP_AND = new Set(["and", "و", "&&", "&"]);
const OP_OR = new Set(["or", "أو", "او", "||", "|"]);
const OP_NOT = new Set(["not", "دون", "بدون", "ليس", "!"]);
export const BOOL_MAX_TERMS = 12;
export const BOOL_MAX_CHARS = 500;

export class BoolParseError extends Error {}

export function tokenizeBoolean(q: string): Tok[] {
  const out: Tok[] = [];
  const s = q.normalize("NFKC");
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      out.push({ k: ch === "(" ? "lp" : "rp" });
      i++;
      continue;
    }
    const close = ch === '"' ? '"' : ch === "«" ? "»" : ch === "“" ? "”" : null;
    if (close) {
      const j = s.indexOf(close, i + 1);
      if (j < 0) throw new BoolParseError(`علامة تنصيص مفتوحة لم تُغلق عند «${s.slice(i, i + 20)}»`);
      const v = s.slice(i + 1, j).trim();
      if (v) out.push({ k: "term", v, phrase: true });
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < s.length && !/[\s()"«»“”]/.test(s[j])) j++;
    let w = s.slice(i, j);
    i = j;
    if (w.startsWith("-") && w.length > 1) {
      out.push({ k: "not" });
      w = w.slice(1);
    } else if (w.startsWith("+") && w.length > 1) w = w.slice(1);
    const lw = w.toLowerCase();
    if (OP_AND.has(lw)) out.push({ k: "and" });
    else if (OP_OR.has(lw)) out.push({ k: "or" });
    else if (OP_NOT.has(lw)) out.push({ k: "not" });
    else if (w) out.push({ k: "term", v: w, phrase: false });
  }
  return out;
}

/** يحلّل الاستعلام إلى شجرة: OR أدنى أولوية، ثم AND (ضمنيٌّ بين المتجاورين)، ثم NOT. */
export function parseBoolean(q: string, mode: MatchMode): BoolNode {
  if (q.length > BOOL_MAX_CHARS) throw new BoolParseError(`الاستعلام أطول من ${BOOL_MAX_CHARS} حرف`);
  const toks = tokenizeBoolean(q);
  let p = 0;
  let leaves = 0;
  const peek = () => toks[p];
  const parseOr = (depth: number): BoolNode => {
    const kids = [parseAnd(depth)];
    while (peek()?.k === "or") {
      p++;
      if (!peek() || peek()!.k === "rp") throw new BoolParseError("«أو» في آخر الاستعلام أو قبل قوس إغلاق بلا لفظ بعدها");
      kids.push(parseAnd(depth));
    }
    return kids.length === 1 ? kids[0] : { t: "or", kids };
  };
  const parseAnd = (depth: number): BoolNode => {
    const kids = [parseNot(depth)];
    for (;;) {
      const t = peek();
      if (!t || t.k === "or" || t.k === "rp") break;
      if (t.k === "and") {
        p++;
        if (!peek() || peek()!.k === "rp" || peek()!.k === "or") throw new BoolParseError("«و/AND» بلا لفظ بعدها");
      }
      kids.push(parseNot(depth));
    }
    return kids.length === 1 ? kids[0] : { t: "and", kids };
  };
  const parseNot = (depth: number): BoolNode => {
    if (peek()?.k === "not") {
      p++;
      if (!peek() || peek()!.k === "rp") throw new BoolParseError("«دون/NOT» بلا لفظ بعدها");
      return { t: "not", kid: parseNot(depth) };
    }
    return parsePrimary(depth);
  };
  const parsePrimary = (depth: number): BoolNode => {
    const t = peek();
    if (!t) throw new BoolParseError("الاستعلام فارغ أو ينتهي بعامل");
    if (t.k === "lp") {
      if (depth >= 6) throw new BoolParseError("الأقواس متداخلة أكثر من 6 مستويات");
      p++;
      if (peek()?.k === "rp") throw new BoolParseError("قوسان فارغان");
      const inner = parseOr(depth + 1);
      if (peek()?.k !== "rp") throw new BoolParseError("قوس مفتوح لم يُغلق");
      p++;
      return inner;
    }
    if (t.k === "term") {
      p++;
      leaves++;
      if (leaves > BOOL_MAX_TERMS) throw new BoolParseError(`أكثر من ${BOOL_MAX_TERMS} لفظًا`);
      const c = compileTerm(t.v, mode);
      if (!c) throw new BoolParseError(`اللفظ «${t.v}» بلا حرف ولا رقم`);
      return { t: "term", text: t.v, phrase: t.phrase, c };
    }
    if (t.k === "rp") throw new BoolParseError("قوس إغلاق بلا قوس فتح");
    throw new BoolParseError(`عامل في غير موضعه (${t.k === "and" ? "و/AND" : t.k === "or" ? "أو/OR" : "دون/NOT"})`);
  };
  const root = parseOr(0);
  if (p < toks.length) throw new BoolParseError(toks[p].k === "rp" ? "قوس إغلاق بلا قوس فتح" : "بقية لم تُفهم في آخر الاستعلام");
  if (!hasPositive(root)) throw new BoolParseError("لا بد من لفظ مثبت: الاستعلام المنفي كله («دون كذا») يطابق المدونة كلها");
  return root;
}

/** هل يُلزم الاستعلامُ لفظًا مثبتًا واحدًا على الأقل في كل فرع؟ */
export function hasPositive(n: BoolNode): boolean {
  if (n.t === "term") return true;
  if (n.t === "not") return false;
  return n.t === "and" ? n.kids.some(hasPositive) : n.kids.every(hasPositive);
}

/**
 * تصفية مسبقة على الخام يلزمها الاستعلام (لا تمسّ nt، فتُدفع إلى المسح): اللفظ ← تصفيته، AND ← ما لأبنائه المثبتة،
 * OR ← OR أبنائه إن كان لكلها تصفية، NOT ← لا شيء. null = لا تصفية (لا يقع للجذر بعد hasPositive).
 */
export function boolPrefilterSql(n: BoolNode, params: unknown[]): string | null {
  if (n.t === "term") return termPrefilterSql(n.c, params);
  if (n.t === "not") return null;
  const kids = n.kids.map((k) => boolPrefilterSql(k, params));
  if (n.t === "and") {
    const kept = kids.filter((k): k is string => k !== null);
    return kept.length ? `(${kept.join(" AND ")})` : null;
  }
  return kids.every((k) => k !== null) ? `(${kids.join(" OR ")})` : null;
}

export function boolToSql(n: BoolNode, params: unknown[]): string {
  if (n.t === "term") return termConditionSql(n.c, params);
  if (n.t === "not") return `NOT ${boolToSql(n.kid, params)}`;
  return `(${n.kids.map((k) => boolToSql(k, params)).join(n.t === "and" ? " AND " : " OR ")})`;
}

export function boolToText(n: BoolNode, top = true): string {
  if (n.t === "term") return n.phrase || /\s/.test(n.text) ? `«${n.text}»` : n.text;
  if (n.t === "not") return `NOT ${boolToText(n.kid, false)}`;
  const s = n.kids.map((k) => boolToText(k, false)).join(n.t === "and" ? " AND " : " OR ");
  return top ? s : `(${s})`;
}

function leavesOf(n: BoolNode, negated = false, out: { pos: BoolNode[]; neg: BoolNode[] } = { pos: [], neg: [] }) {
  if (n.t === "term") (negated ? out.neg : out.pos).push(n);
  else if (n.t === "not") leavesOf(n.kid, !negated, out);
  else for (const k of n.kids) leavesOf(k, negated, out);
  return out;
}

/** تقييم الشجرة على نص مطبَّع (نظير SQL في الكود؛ للاختبار). */
export function evalBoolean(n: BoolNode, normText: string): boolean {
  if (n.t === "term") {
    const lit = n.c.literal.toLowerCase();
    if (!normText.toLowerCase().includes(lit)) return false;
    return n.c.regex ? new RegExp(n.c.regex, "iu").test(normText) : true;
  }
  if (n.t === "not") return !evalBoolean(n.kid, normText);
  return n.t === "and" ? n.kids.every((k) => evalBoolean(k, normText)) : n.kids.some((k) => evalBoolean(k, normText));
}

export async function handleSearchBoolean(
  db: SqlClient,
  args: FilterArgs & { query: string; match?: Exclude<MatchMode, "contains">; page_size?: number; cursor?: string; snippet_len?: number },
  deps: TextSearchDeps = {},
) {
  const mode = args.match ?? "word";
  let root: BoolNode;
  try {
    root = parseBoolean(String(args.query ?? ""), mode);
  } catch (e) {
    if (!(e instanceof BoolParseError)) throw e;
    return {
      query: args.query,
      error: e.message,
      hint: 'الصيغة: ألفاظ متجاورة = AND، و«أو»/OR، و«دون»/NOT أو -لفظ، وأقواس، والعبارة بين "…" أو «…». مثال: (فسخ أو انفساخ) عقد دون تعويض',
    };
  }
  const filters = filtersFromArgs(args);
  const scope = await lawScopeForFilters(db, filters);
  const params: unknown[] = [];
  const pre = boolPrefilterSql(root, params);
  const where = `${pre ? `${pre} AND ` : ""}${boolToSql(root, params)}`;
  const { pos, neg } = leavesOf(root);
  const r = await runArticleQuery(db, deps, {
    where,
    params,
    scope,
    cursor: args.cursor,
    pageSize: clampInt(args.page_size, 1, 50, 20),
    snippetLen: clampInt(args.snippet_len, 120, 2000, 400),
    snippetTerms: pos.map((x) => (x as Extract<BoolNode, { t: "term" }>).c),
  });
  return {
    query: args.query,
    parsed: boolToText(root),
    match: { mode, rule: matchModeLabel(mode) },
    terms: pos.map((x) => (x as Extract<BoolNode, { t: "term" }>).text),
    excluded_terms: neg.map((x) => (x as Extract<BoolNode, { t: "term" }>).text),
    scope: scopeOut(scope),
    total: r.total,
    by_law: r.by_law,
    page: r.page,
    next_cursor: r.next_cursor,
    note: searchNote(r.total, r.hasMore, scope, `بالاستعلام ${boolToText(root)}`) + " parsed يبيّن كيف فُهم الاستعلام؛ إن خالف قصدك فأضف أقواسًا.",
  };
}

// ── hakeem_trace_text ──

const WORD_RUN = /[ء-غف-يٱ-ۓً-ٰٟـA-Za-z0-9٠-٩]+/g;

/** كلمات النص مطبَّعةً بمواضعها في الخام. */
export function wordsWithPos(raw: string): Array<{ w: string; s: number; e: number }> {
  const out: Array<{ w: string; s: number; e: number }> = [];
  for (const m of raw.matchAll(WORD_RUN)) {
    const w = normalizeAr(m[0]);
    if (w) out.push({ w, s: m.index ?? 0, e: (m.index ?? 0) + m[0].length });
  }
  return out;
}

const stripConj = (w: string) => (w.length > 3 && (w[0] === "و" || w[0] === "ف") ? w.slice(1) : w);
const eqWord = (a: string, b: string) => a === b || stripConj(a) === stripConj(b);

/** أطول تتابع متصل وأطول تتابع غير متصل (LCS) بين كلمات الاقتباس وكلمات المادة. O(n·m) بصفّين. */
export function alignWords(q: string[], d: string[]): { run: number; runDocStart: number; lcs: number } {
  const m = d.length;
  let prevRun = new Uint16Array(m + 1);
  let curRun = new Uint16Array(m + 1);
  let prevL = new Uint16Array(m + 1);
  let curL = new Uint16Array(m + 1);
  let run = 0;
  let runEnd = 0;
  for (let i = 1; i <= q.length; i++) {
    curRun[0] = 0;
    curL[0] = 0;
    for (let j = 1; j <= m; j++) {
      if (eqWord(q[i - 1], d[j - 1])) {
        curRun[j] = prevRun[j - 1] + 1;
        if (curRun[j] > run) {
          run = curRun[j];
          runEnd = j;
        }
        curL[j] = prevL[j - 1] + 1;
      } else {
        curRun[j] = 0;
        curL[j] = curL[j - 1] > prevL[j] ? curL[j - 1] : prevL[j];
      }
    }
    [prevRun, curRun] = [curRun, prevRun];
    [prevL, curL] = [curL, prevL];
  }
  return { run, runDocStart: runEnd - run, lcs: prevL[m] };
}

export type TraceClass = "verbatim" | "near_verbatim" | "partial" | "fragment" | "none";
const CLASS_RANK: Record<TraceClass, number> = { verbatim: 4, near_verbatim: 3, partial: 2, fragment: 1, none: 0 };

export function classifyTrace(n: number, run: number, lcs: number): TraceClass {
  if (run >= n) return "verbatim";
  if (lcs >= 0.9 * n && run >= 0.5 * n) return "near_verbatim";
  if (run >= Math.min(8, n) || lcs >= 0.6 * n) return "partial";
  if (run >= 4) return "fragment";
  return "none";
}

const TRACE_MAX_WORDS = 300;
const TRACE_DOC_MAX_WORDS = 20_000;

export type RulingsTraceFn = (phrase: string) => Promise<{ total: number; total_is_lower_bound: boolean; results: Array<Record<string, unknown>> }>;

export async function handleTraceText(
  db: SqlClient,
  args: FilterArgs & { text: string; include_rulings?: boolean; limit?: number },
  deps: TextSearchDeps & { rulings?: RulingsTraceFn } = {},
) {
  const raw = String(args.text ?? "");
  const qWords = wordsWithPos(raw).map((x) => x.w);
  if (qWords.length < 3) {
    return { verdict: "too_short", words: qWords.length, matches: [], note: "النص أقصر من ثلاث كلمات؛ لعبارة قصيرة استعمل hakeem_search_phrase." };
  }
  const incomplete = qWords.length > TRACE_MAX_WORDS;
  const q = qWords.slice(0, TRACE_MAX_WORDS);
  const n = q.length;
  const limit = clampInt(args.limit, 1, 10, 5);
  const filters = filtersFromArgs({ ...args, status: args.status ?? "all" });
  const scope = await lawScopeForFilters(db, filters);

  // مراسٍ: نوافذ من خمس كلمات (البداية، الأرباع، النهاية)؛ ثم ثلاث كلمات إن لم يوجد مرشح.
  const windows = (size: number) => {
    const w = Math.min(size, n);
    const starts = [0, Math.floor((n - w) / 4), Math.floor((n - w) / 2), Math.floor((3 * (n - w)) / 4), n - w];
    return [...new Set(starts)].map((s) => q.slice(s, s + w).join(" "));
  };
  const candidates = async (size: number, mode: MatchMode) => {
    const anchors = windows(size)
      .map((t) => compileTerm(t, mode))
      .filter((c): c is CompiledTerm => c !== null);
    if (!anchors.length) return [] as ArticleRow[];
    const params: unknown[] = [];
    const pre = anchors.length > 1 ? `${anyTermPrefilterSql(anchors, params)} AND ` : "";
    const conds = anchors.map((a) => termConditionSql(a, params));
    const scopeCond = lawScopeSql(scope, params);
    return db.query<ArticleRow>(
      `SELECT a."id", a."articleNumber" AS article_number, a."articleBis" AS article_bis, a."legalSystemId" AS law_id,
              COALESCE(l."name", a."lawName") AS law, a."content"
         FROM legal_articles a ${NORM_LATERAL}
         LEFT JOIN legal_systems l ON l."id" = a."legalSystemId"
        WHERE ${pre}(${conds.join(" OR ")}) AND a."articleBis" < ${NON_ARTICLE_BIS}${scopeCond ? ` AND ${scopeCond}` : ""}
        ORDER BY (${conds.map((c) => `(${c})::int`).join(" + ")}) DESC, a."id"
        LIMIT 30`,
      params,
    );
  };
  let rows = await candidates(5, "exact");
  let anchorsMode = "exact5";
  if (!rows.length) {
    rows = await candidates(3, "word");
    anchorsMode = "word3";
  }

  const eff = await (await effectiveOf(deps))(rows.map((r) => ({ id: r.id, content: r.content })));
  const qSet = new Set(q.map(stripConj));
  const scored = rows.map((r) => {
    const e = eff.get(r.id);
    const current = e && !e.repealed ? e.text : r.content;
    const cw = wordsWithPos(current).slice(0, TRACE_DOC_MAX_WORDS);
    const ac = alignWords(q, cw.map((x) => x.w));
    let best = { ...ac, words: cw, text: current, basis: "current" as "current" | "before_amendment" | "repealed_text" };
    if (e && (e.source === "unit_version" || e.repealed)) {
      const ow = wordsWithPos(r.content).slice(0, TRACE_DOC_MAX_WORDS);
      const ao = alignWords(q, ow.map((x) => x.w));
      if (e.repealed) best = { ...ao, words: ow, text: r.content, basis: "repealed_text" };
      else if (ao.lcs > ac.lcs || ao.run > ac.run) best = { ...ao, words: ow, text: r.content, basis: "before_amendment" };
    }
    const cls = classifyTrace(n, best.run, best.lcs);
    const docSet = new Set(best.words.map((x) => stripConj(x.w)));
    const missing = [...qSet].filter((w) => !docSet.has(w)).slice(0, 12);
    const runWords = best.words.slice(best.runDocStart, best.runDocStart + best.run);
    const excerpt = runWords.length ? best.text.slice(runWords[0].s, runWords[runWords.length - 1].e) : "";
    return {
      article_id: r.id,
      law: r.law,
      law_id: r.law_id,
      article: articleLabel(Number(r.article_number), Number(r.article_bis)),
      class: cls,
      longest_run_words: best.run,
      matched_words: best.lcs,
      coverage: Math.round((best.lcs / n) * 100) / 100,
      matched_on: best.basis,
      repealed: e?.repealed ?? false,
      amended: e?.source === "unit_version",
      matched_excerpt: excerpt.length > 1200 ? `${excerpt.slice(0, 1200)} …` : excerpt,
      words_not_in_article: missing,
    };
  });
  scored.sort((a, b) => CLASS_RANK[b.class] - CLASS_RANK[a.class] || b.longest_run_words - a.longest_run_words || b.matched_words - a.matched_words);
  const matches = scored.filter((s) => s.class !== "none").slice(0, limit);
  const top = matches[0];
  const verdict: TraceClass | "not_found" = top ? top.class : "not_found";

  let rulings: Awaited<ReturnType<RulingsTraceFn>> | null = null;
  if (args.include_rulings) {
    const fn: RulingsTraceFn =
      deps.rulings ??
      (async (phrase) => {
        const m = await import("./rulings");
        const r = (await m.enumerateRulings([phrase], undefined, undefined, false, 5, undefined, 300)) as unknown as {
          total: number;
          total_is_lower_bound: boolean;
          results?: Array<Record<string, unknown>>;
        };
        return { total: r.total, total_is_lower_bound: r.total_is_lower_bound, results: r.results ?? [] };
      });
    rulings = await fn(q.slice(0, Math.min(6, n)).join(" "));
  }

  const where = top ? `${top.law}، المادة ${top.article}` : "";
  const verdictText: Record<typeof verdict, string> = {
    verbatim: `منقول حرفيًّا من ${where}.`,
    near_verbatim: `منقول بتصرّف يسير من ${where} (فروق في كلمات قليلة؛ انظر words_not_in_article).`,
    partial: `جزء منه من ${where}؛ والباقي مختلف أو من مصدر آخر — لا يُعزى كله إليها.`,
    fragment: `تتطابق عبارات قصيرة فقط (${top?.longest_run_words ?? 0} كلمات متصلة) مع ${where} — لا يكفي للعزو.`,
    none: "",
    not_found: `لم يوجد في مواد المدونة في النطاق (${scope.label}). ليس نفيًا لوجوده في مصدر آخر (لائحة غير مدخلة، حكم، شرح).`,
  };
  const warn =
    top?.matched_on === "before_amendment"
      ? " تنبيه: الاقتباس يطابق نص المادة قبل تعديلها، والنص الساري مختلف."
      : top?.matched_on === "repealed_text"
        ? " تنبيه: الاقتباس من مادة ملغاة — لا يُحتجّ به نصًّا قائمًا."
        : "";
  return {
    verdict,
    words: n,
    incomplete,
    matches,
    ...(rulings ? { rulings } : {}),
    scope: scopeOut(scope),
    anchors: anchorsMode,
    note:
      verdictText[verdict] +
      warn +
      (incomplete ? ` فُحصت أول ${TRACE_MAX_WORDS} كلمة فقط.` : "") +
      " المقارنة كلمةً بكلمة بعد تطبيع الإملاء والتشكيل، والمرشحات من مراسٍ في النص (أول 30 مادة)." +
      (rulings ? " الأحكام: مطابقة أول ست كلمات عبارةً فقط." : ""),
  };
}
