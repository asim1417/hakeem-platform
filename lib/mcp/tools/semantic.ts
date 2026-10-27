/**
 * HKM-044 المرحلة الأولى — hakeem_semantic_search: البحث بالمعنى وحده في المواد.
 * لما لا يُعرف لفظه: «كم مدة الاستئناف» تجد المادة التي تقول «مدة الاعتراض ثلاثون يومًا».
 *
 * الاسترجاع من متجهات المواد (vectorProvider، أعلى 20)، ثم إعادة ترتيب:
 *   0.65 × التشابه + 0.35 × تغطية ألفاظ السؤال (كلمات كاملة بالاشتقاق في النص الساري) + 0.08 إن سمّى السؤال النظام.
 * المرشحات تُطبَّق بعد الاسترجاع (المتجهات لا تُرشَّح بالنظام)، فقد تقل النتائج: الملاحظة تقول ذلك.
 * البحث الدلالي معطّل = نتيجة صريحة disabled لا قائمة فارغة توهم النفي. قراءة فقط.
 */
import type { SqlClient } from "../../modules/legal-core/sql-port";
import { articleLabel, NON_ARTICLE_BIS } from "../../modules/legal-core/article-key";
import { normalizeLawName } from "../../modules/legal-core/law-name-match";
import { compileTerm, matchesNormalized, normalizeAr, type CompiledTerm } from "./word-match";
import { filtersFromArgs, lawScopeForFilters, loadLawCatalog, type LawScope } from "./catalog";
import { snippetAround, type EffectiveFn, type FilterArgs } from "./text-search";

export interface SemanticDeps {
  effective?: EffectiveFn;
  enabled?: () => boolean;
  /** أقرب المواد بالمتجه: معرّف المادة والتشابه (0..1). */
  vectorSearch?: (q: string, limit: number) => Promise<Array<{ id: string; score: number }>>;
}

const QUERY_STOP = new Set(
  [
    "ما", "ماذا", "هل", "كيف", "متي", "كم", "اين", "لماذا", "من", "في", "على", "علي", "الى", "الي", "عن", "او", "و", "ثم", "ان",
    "اذا", "لو", "التي", "الذي", "هذا", "هذه", "ذلك", "تلك", "هو", "هي", "مع", "بين", "عند", "كل", "اي", "لا", "لم", "لن", "قد",
    "بعد", "قبل", "حتي", "غير", "عليه", "فيه", "له", "به", "نظام", "النظام", "الماده", "ماده", "حكم", "يجب", "يحق",
  ].map(normalizeAr),
);

/** ألفاظ السؤال ذات المعنى (بلا أدوات الاستفهام والحروف). */
export function queryKeywords(q: string): string[] {
  const words = normalizeAr(q)
    .split(/[^ء-يa-zA-Z0-9]+/)
    .filter((w) => w.length >= 2 && !QUERY_STOP.has(w));
  return [...new Set(words)].slice(0, 12);
}

/** حد التشابه لهذه الأداة (العتبة العامة 0.6 تقطع الأسئلة القصيرة الحوارية: م84 عمل لا تظهر)؛ التحمية بتغطية الألفاظ في الترتيب. */
export const SEMANTIC_TOOL_MIN_SCORE = 0.5;
export const W_SIM = 0.65;
export const W_COVER = 0.35;
export const LAW_HINT_BOOST = 0.08;

export function rerankScore(similarity: number, coverage: number, lawHinted: boolean): number {
  return Math.round((W_SIM * similarity + W_COVER * coverage + (lawHinted ? LAW_HINT_BOOST : 0)) * 1000) / 1000;
}

/** الأنظمة التي يسمّيها السؤال باسمها الكامل (الأطول يغلب: «نظام العمل البحري» لا «نظام العمل»). */
export function hintedLaws(q: string, laws: Array<{ law_id: string; name: string }>): Set<string> {
  const nq = ` ${normalizeLawName(q)} `;
  const hits = laws
    .map((l) => ({ id: l.law_id, n: normalizeLawName(l.name) }))
    .filter((l) => l.n.split(" ").length >= 2 && nq.includes(` ${l.n} `));
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.n.length > h.n.length && o.n.includes(h.n)));
  return new Set(kept.map((h) => h.id));
}

function inScope(scope: LawScope, lawId: string | null): boolean {
  if (scope.include) return lawId !== null && scope.include.includes(lawId);
  return !(lawId && scope.exclude.includes(lawId));
}

export async function handleSemanticSearch(db: SqlClient, args: FilterArgs & { query: string; limit?: number }, deps: SemanticDeps = {}) {
  const query = String(args.query ?? "").trim();
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 10), 1), 20);
  const enabled = deps.enabled ?? (await import("@/lib/modules/ai/embeddings")).semanticSearchEnabled;
  if (!enabled()) {
    return { status: "disabled", query, results: [], note: "البحث الدلالي غير مفعّل على هذا الخادم الآن؛ هذا ليس نفيًا. استعمل hakeem_search أو hakeem_enumerate." };
  }
  if (!query) return { status: "empty_query", query, results: [], note: "السؤال فارغ." };
  const vectorSearch =
    deps.vectorSearch ??
    (async (q: string, n: number) => {
      const { vectorProvider } = await import("@/lib/modules/legal-search/providers/vector-provider");
      const raw = await vectorProvider.search({ q, limit: n, types: ["article"], minScore: SEMANTIC_TOOL_MIN_SCORE });
      return raw.filter((r) => r.type === "article").map((r) => ({ id: r.id, score: r.score }));
    });
  const hits = await vectorSearch(query, 20);
  const scope = await lawScopeForFilters(db, filtersFromArgs(args));
  if (!hits.length) {
    return { status: "ok", query, results: [], scope: { filters: scope.label }, note: "لا مادة قريبة المعنى فوق عتبة التشابه. جرّب صياغة أخرى أو hakeem_search (لفظي + دلالي)." };
  }
  const sim = new Map(hits.map((h) => [h.id, h.score]));
  const rows = await db.query<{ id: string; article_number: number; article_bis: number; law_id: string | null; law: string; content: string }>(
    `SELECT a."id", a."articleNumber" AS article_number, a."articleBis" AS article_bis, a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law, a."content"
       FROM legal_articles a LEFT JOIN legal_systems l ON l."id" = a."legalSystemId"
      WHERE a."id" = ANY($1::text[]) AND a."articleBis" < ${NON_ARTICLE_BIS}`,
    [hits.map((h) => h.id)],
  );
  const scoped = rows.filter((r) => inScope(scope, r.law_id));
  const eff = deps.effective ?? (async (rs) => (await import("@/lib/modules/legal-core/effective-text")).effectiveArticleTexts(rs));
  const texts = await eff(scoped.map((r) => ({ id: r.id, content: r.content })));
  const keywords = queryKeywords(query);
  const compiled = keywords.map((k) => compileTerm(k, "derivatives")).filter((c): c is CompiledTerm => c !== null);
  const hinted = hintedLaws(query, await loadLawCatalog(db));
  const results = scoped
    .map((r) => {
      const e = texts.get(r.id);
      const text = e?.text ?? r.content;
      const norm = normalizeAr(text);
      const matched = compiled.filter((c) => matchesNormalized(norm, c));
      const coverage = compiled.length ? matched.length / compiled.length : 0;
      const s = sim.get(r.id) ?? 0;
      const hint = Boolean(r.law_id && hinted.has(r.law_id));
      return {
        article_id: r.id,
        law: r.law,
        law_id: r.law_id,
        article: articleLabel(Number(r.article_number), Number(r.article_bis)),
        score: rerankScore(s, coverage, hint),
        similarity: Math.round(s * 1000) / 1000,
        keyword_coverage: Math.round(coverage * 100) / 100,
        matched_keywords: matched.map((c) => c.term),
        law_named_in_query: hint,
        snippet: snippetAround(text, matched.length ? matched : compiled, 450).snippet,
        repealed: e?.repealed ?? false,
        amended: e?.source === "unit_version",
      };
    })
    .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
    .slice(0, limit);
  const dropped = rows.length - scoped.length;
  return {
    status: "ok",
    query,
    keywords,
    results,
    scope: { filters: scope.label, dropped_by_filters: dropped },
    ranking: `score = ${W_SIM}×التشابه + ${W_COVER}×تغطية الألفاظ + ${LAW_HINT_BOOST} إن سُمّي النظام`,
    note:
      "بحث بالمعنى وحده على أعلى 20 مادة بالمتجهات؛ ليس حصرًا ولا نفيًا. للحصر hakeem_enumerate، وللفظ والمعنى معًا hakeem_search." +
      (dropped ? ` أسقطت المرشحات ${dropped} من المرشحين؛ ضيّق السؤال إن قلّت النتائج.` : ""),
  };
}
