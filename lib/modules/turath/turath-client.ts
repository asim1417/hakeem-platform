import "server-only";

/**
 * عميل تكامل مكتبة تراث (turath.io) — بحث حيّ في كتب التراث الإسلامي/الفقهي.
 *
 * تصميم دفاعي ومعزول: كل ما يعتمد على شكل واجهة تراث محصور في هذا الملف،
 * في الدالتين fetchRaw + normalize، كي يكفي تصحيح نقطة واحدة عند التحقق الحيّ.
 * أي تعذّر (شبكة/حالة/شكل) يسقط بهدوء إلى نتائج فارغة — لا يكسر الصفحة أبداً.
 *
 * ملاحظة شبكة: يتطلّب إضافة api.turath.io إلى allowlist الخروج (egress) في
 * بيئة التشغيل، وإلا تعود النتائج فارغة مع note توضيحية.
 *
 * ⚠️ TODO (تحقّق حيّ): تأكيد مسار البحث وأسماء الحقول مقابل واجهة تراث الفعلية
 * بعد فتح الشبكة، ثم ضبط SEARCH_PATH/normalize إن لزم.
 */

const BASE = (process.env.TURATH_API_BASE || "https://api.turath.io").replace(/\/$/, "");
const APP_BASE = (process.env.TURATH_APP_BASE || "https://app.turath.io").replace(/\/$/, "");
// مسار البحث قابل للضبط من البيئة لتسهيل التصحيح دون تعديل الكود.
const SEARCH_PATH = process.env.TURATH_SEARCH_PATH || "/search?q={q}&precision=2";

export interface TurathResult {
  id: string;
  bookTitle: string;
  author?: string;
  snippet?: string;
  page?: string;
  url: string; // رابط عميق لصفحة الكتاب في تراث (مع نسب المصدر)
}

export interface TurathSearchResponse {
  ok: boolean;
  query: string;
  results: TurathResult[];
  source: "turath";
  configured: boolean; // هل الشبكة/الواجهة متاحة فعلاً؟
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
    // تمييز حالة حجب الشبكة (allowlist) عن غيرها لرسالة أوضح.
    const blocked = /allowlist|ENOTFOUND|EAI_AGAIN|fetch failed|forbidden/i.test(msg);
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
/** محوّل دفاعي: يدعم عدّة أشكال محتملة لاستجابة تراث. يُضبط عند التحقق الحيّ. */
function normalize(data: any, limit: number): TurathResult[] {
  const rows: any[] = Array.isArray(data)
    ? data
    : data?.data ?? data?.results ?? data?.hits ?? data?.matches ?? data?.items ?? [];
  if (!Array.isArray(rows)) return [];

  return rows
    .slice(0, limit)
    .map((r: any, i: number): TurathResult => {
      const bookId = r?.book_id ?? r?.bookId ?? r?.book?.id ?? r?.meta?.book_id ?? r?.id;
      const page = r?.page ?? r?.pg ?? r?.page_num ?? r?.pageNumber;
      const bookTitle =
        r?.book_name ?? r?.bookName ?? r?.book?.name ?? r?.book?.title ?? r?.title ?? r?.name ?? "كتاب من تراث";
      const author = r?.author_name ?? r?.author ?? r?.book?.author ?? r?.book?.author_name;
      const snippet = stripHtml(r?.snippet ?? r?.text ?? r?.matn ?? r?.body ?? r?.highlight ?? "");
      return {
        id: String(r?.id ?? `${bookId ?? "b"}:${page ?? i}`),
        bookTitle: String(bookTitle),
        author: author ? String(author) : undefined,
        snippet: snippet || undefined,
        page: page != null ? String(page) : undefined,
        url: bookId ? `${APP_BASE}/book/${bookId}${page ? `/${page}` : ""}` : APP_BASE,
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
