/**
 * HKM-023-B ع-١٤ — البحث النصي في وحدات المقدمة (جانب البيانات).
 *
 * - المصدر: العرض preamble_unit_current (وحدات أحدث نسخة لكل نظام، بلا الأب)، والعمود text_normalized بنفس تطبيع
 *   legal_articles.search_norm (normalizeArabicText)، وعليه فهرسا tsvector وtrigram في الترحيل.
 * - كل نتيجة موسومة بنوعها (type = "preamble_unit"، unitType = recital/operative_clause/…) ومرساتها.
 * - لا تختلط بالمواد في الترتيب الافتراضي: mergeArticleAndPreambleHits يعيد قائمة المواد كما هي وقائمة المقدمة
 *   منفصلة (separate)، أو يلحقها بعد المواد (append) — لا تداخل أبدًا.
 * - غياب الجدول (قبل تطبيق الترحيل) = لا نتائج (سقوط آمن). التضمين الدلالي ليس هنا: الأمر في
 *   scripts/hkm-023-b/embed-preamble-units.ts (تجريبي، والتطبيق مرفوض حتى اعتماد المالك).
 * الربط بمحرك البحث العام (hybrid-search / hakeem_search) خطوة لاحقة بعد إدخال البيانات، لا في هذا الفرع.
 */
import { normalizeArabicText } from "./arabic-morphology";
import { resolveSystemSlug } from "./eli";
import type { PreambleUnitType } from "./preamble-parser";
import { isMissingRelation, type SqlClient } from "./sql-port";

export interface PreambleSearchHit {
  type: "preamble_unit";
  unitType: PreambleUnitType;
  unitId: string;
  systemId: string;
  systemName: string;
  label: string | null;
  number: string | null;
  anchor: string | null;
  snippet: string;
  /** 1 = العبارة كاملة في الوحدة؛ وإلا رتبة ts_rank. */
  score: number;
  phrase: boolean;
  url: string;
}

const SNIPPET = 300;

function snippetAround(text: string, query: string): string {
  const plain = text.replace(/\s+/g, " ").trim();
  const words = query.split(" ").filter(Boolean);
  const bare = normalizeArabicText(plain);
  const at = words.length ? bare.indexOf(words[0]) : -1;
  if (at < 0 || plain.length <= SNIPPET) return plain.slice(0, SNIPPET);
  const start = Math.max(0, Math.min(at - 60, plain.length - SNIPPET));
  return (start > 0 ? "…" : "") + plain.slice(start, start + SNIPPET);
}

export async function searchPreambleUnits(
  db: SqlClient,
  query: string,
  opts: { limit?: number; systemIds?: string[]; unitTypes?: PreambleUnitType[] } = {},
): Promise<PreambleSearchHit[]> {
  const q = normalizeArabicText(String(query ?? ""));
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  try {
    const rows = await db.query<{
      id: string;
      unit_type: PreambleUnitType;
      system_id: string;
      name: string;
      eli_slug: string | null;
      label_ar: string | null;
      number: string | null;
      anchor: string | null;
      text_raw: string;
      phrase: boolean;
      score: number;
    }>(
      `SELECT u.id, u.unit_type, u.system_id, s.name, s.eli_slug, u.label_ar, u.number, u.anchor, u.text_raw,
              (u.text_normalized LIKE '%' || $1 || '%') AS phrase,
              ts_rank(to_tsvector('simple', coalesce(u.text_normalized, '')), plainto_tsquery('simple', $1)) AS score
         FROM preamble_unit_current u
         JOIN legal_systems s ON s.id = u.system_id
        WHERE (to_tsvector('simple', coalesce(u.text_normalized, '')) @@ plainto_tsquery('simple', $1)
               OR u.text_normalized LIKE '%' || $1 || '%')
          AND ($2::text[] IS NULL OR u.system_id = ANY($2::text[]))
          AND ($3::text[] IS NULL OR u.unit_type = ANY($3::text[]))
          AND u.unit_type <> 'unclassified'
        ORDER BY phrase DESC, score DESC, u.system_id, u.ordinal
        LIMIT $4`,
      [q, opts.systemIds?.length ? opts.systemIds : null, opts.unitTypes?.length ? opts.unitTypes : null, limit],
    );
    return rows.map((r) => {
      const slug = resolveSystemSlug(r.eli_slug, r.name);
      return {
        type: "preamble_unit" as const,
        unitType: r.unit_type,
        unitId: r.id,
        systemId: r.system_id,
        systemName: r.name,
        label: r.label_ar,
        number: r.number,
        anchor: r.anchor,
        snippet: snippetAround(r.text_raw, q),
        score: r.phrase ? 1 : Number(r.score) || 0,
        phrase: Boolean(r.phrase),
        url: `/legal/${encodeURIComponent(slug)}${r.anchor ? `#${r.anchor}` : ""}`,
      };
    });
  } catch (e) {
    if (isMissingRelation(e)) return [];
    throw e;
  }
}

/** يدمج نتائج المقدمة مع نتائج المواد دون أن تختلط بها: المواد أولًا بترتيبها كما هو. */
export function mergeArticleAndPreambleHits<A>(
  articles: A[],
  preamble: PreambleSearchHit[],
  mode: "separate" | "append" = "separate",
): { results: Array<A | PreambleSearchHit>; preamble: PreambleSearchHit[] } {
  return mode === "append" ? { results: [...articles, ...preamble], preamble } : { results: [...articles], preamble };
}
