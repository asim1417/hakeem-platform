import "server-only";

/**
 * عميل تكامل مكتبة تراث (turath.io) — بحث حيّ في كتب التراث الإسلامي/الفقهي.
 *
 * تصميم دفاعي ومعزول: كل ما يعتمد على شكل واجهة تراث محصور في normalize،
 * كي يكفي تصحيح نقطة واحدة عند التحقق الحيّ. أي تعذّر (شبكة/حالة/شكل) يسقط
 * بهدوء إلى نتائج فارغة — لا يكسر الصفحة أبداً.
 *
 * شكل استجابة تراث: قائمة نتائج (data) كل عنصر فيها يحمل book_id + مقتطف،
 * وبيانات الكتب/المؤلفين/الأقسام في جداول بحث منفصلة (books/authors/cats)
 * مفهرسة بالمعرّف — فنربط كل نتيجة ببطاقة كتابها الكاملة.
 *
 * ملاحظة شبكة: يتطلّب إضافة api.turath.io إلى allowlist الخروج (egress).
 */

const BASE = (process.env.TURATH_API_BASE || "https://api.turath.io").replace(/\/$/, "");
const APP_BASE = (process.env.TURATH_APP_BASE || "https://app.turath.io").replace(/\/$/, "");
const SEARCH_PATH = process.env.TURATH_SEARCH_PATH || "/search?q={q}&precision=2";

export interface TurathResult {
  id: string;
  bookTitle: string; // اسم الكتاب
  author?: string; // المؤلف
  category?: string; // القسم / التصنيف الموضوعي للكتاب
  snippet?: string; // مقتطف المطابقة
  page?: string; // الصفحة
  volume?: string; // الجزء
  url: string; // رابط عميق لصفحة الكتاب في تراث (مع نسب المصدر)
}

export interface TurathSearchResponse {
  ok: boolean;
  query: string;
  results: TurathResult[];
  source: "turath";
  configured: boolean;
  note?: string;
}

export async function searchTurath(query: string, limit = 10): Promise<TurathSearchResponse> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, query: q, results: [], source: "turath", configured: true };

  try {
    const path = SEARCH_PATH.replace("{q}", encodeURIComponent(q));
    const resp = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      return { ok: false, query: q, results: [], source: "turath", configured: false, note: `turath HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as unknown;
    return { ok: true, query: q, results: normalize(data, limit), source: "turath", configured: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر الوصول إلى تراث";
    const blocked = /allowlist|ENOTFOUND|EAI_AGAIN|fetch failed|forbidden|timeout|aborted/i.test(msg);
    return {
      ok: false,
      query: q,
      results: [],
      source: "turath",
      configured: false,
      note: blocked ? "خدمة تراث غير متاحة من الخادم بعد (تتطلب فتح الشبكة)." : msg,
    };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** يبني خريطة بحث (id → عنصر) من مجموعة قد تكون مصفوفة [{id,..}] أو كائناً {id: {..}}. */
function buildLookup(coll: any): Map<string, any> {
  const map = new Map<string, any>();
  if (!coll) return map;
  if (Array.isArray(coll)) {
    for (const it of coll) {
      const id = it?.id ?? it?.book_id ?? it?.author_id ?? it?.cat_id;
      if (id != null) map.set(String(id), it);
    }
  } else if (typeof coll === "object") {
    for (const [k, v] of Object.entries(coll)) map.set(String(k), v);
  }
  return map;
}

function pickName(obj: any): string | undefined {
  if (!obj) return undefined;
  if (typeof obj === "string") return obj;
  return obj?.name ?? obj?.title ?? obj?.value ?? obj?.text ?? undefined;
}

/** محوّل دفاعي يربط كل نتيجة ببطاقة كتابها عبر جداول البحث books/authors/cats. */
function normalize(data: any, limit: number): TurathResult[] {
  const rows: any[] = Array.isArray(data)
    ? data
    : data?.data ?? data?.results ?? data?.hits ?? data?.matches ?? data?.items ?? [];
  if (!Array.isArray(rows)) return [];

  const books = buildLookup(data?.books);
  const authors = buildLookup(data?.authors ?? data?.author);
  const cats = buildLookup(data?.cats ?? data?.categories ?? data?.cat ?? data?.sections);

  return rows
    .slice(0, limit)
    .map((r: any, i: number): TurathResult => {
      const bookId = r?.book_id ?? r?.bookId ?? r?.book?.id ?? r?.meta?.book_id ?? r?.id;
      const book = (bookId != null ? books.get(String(bookId)) : null) ?? r?.book ?? {};

      const bookTitle =
        pickName(book) ?? r?.book_name ?? r?.bookName ?? r?.title ?? r?.name ?? "كتاب من تراث";

      const authorId = book?.author_id ?? book?.authorId ?? r?.author_id;
      const author =
        pickName(authorId != null ? authors.get(String(authorId)) : null) ??
        pickName(book?.author) ??
        book?.author_name ??
        r?.author_name ??
        (typeof r?.author === "string" ? r.author : undefined);

      const catId = book?.cat_id ?? book?.category_id ?? book?.section_id ?? r?.cat_id;
      const category =
        pickName(catId != null ? cats.get(String(catId)) : null) ??
        pickName(book?.cat) ??
        book?.cat_name ??
        book?.category ??
        (typeof r?.cat === "string" ? r.cat : undefined);

      const page = r?.page ?? r?.pg ?? r?.page_num ?? r?.pageNumber ?? book?.page;
      const volume = r?.vol ?? r?.volume ?? r?.j ?? r?.part;
      const snippet = stripHtml(r?.snippet ?? r?.text ?? r?.matn ?? r?.body ?? r?.highlight ?? r?.nass ?? "");

      return {
        id: String(r?.id ?? `${bookId ?? "b"}:${page ?? i}`),
        bookTitle: String(bookTitle),
        author: author ? String(author) : undefined,
        category: category ? String(category) : undefined,
        snippet: snippet || undefined,
        page: page != null ? String(page) : undefined,
        volume: volume != null ? String(volume) : undefined,
        url: bookId != null ? `${APP_BASE}/book/${bookId}${page ? `/${page}` : ""}` : APP_BASE,
      };
    })
    .filter((x) => x.bookTitle);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}
