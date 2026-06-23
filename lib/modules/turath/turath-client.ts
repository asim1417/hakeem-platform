import "server-only";

/**
 * عميل تكامل مكتبة تراث (turath.io) — بحث حيّ في كتب التراث الإسلامي/الفقهي.
 *
 * شكل استجابة تراث (مُتحقَّق حيًّا): { count, data: [ row ] }، وكل صفّ:
 *   { book_id, cat_id, author_id, snip, text, meta: "<JSON-string>" }
 * وحقل meta نصّ JSON يُفكّ ليعطي: book_name, author_name, page, page_id, vol.
 * لا يوجد endpoint منفصل للكتاب (/book/{id} = 404) — كل البطاقة من meta.
 *
 * تصميم دفاعي: كل اعتماد على الشكل محصور في normalizeRows؛ أي تعذّر يسقط بهدوء.
 * ملاحظة شبكة: يتطلّب إضافة api.turath.io إلى allowlist الخروج (egress).
 */

const BASE = (process.env.TURATH_API_BASE || "https://api.turath.io").replace(/\/$/, "");
const APP_BASE = (process.env.TURATH_APP_BASE || "https://app.turath.io").replace(/\/$/, "");
const SEARCH_PATH = process.env.TURATH_SEARCH_PATH || "/search?q={q}&precision=2";
// حقل الصفحة المستعمَل في رابط تراث العميق: page (المطبوعة) افتراضاً، أو page_id.
const URL_PAGE_FIELD = (process.env.TURATH_URL_PAGE_FIELD || "page").trim();

export interface TurathResult {
  id: string;
  bookTitle: string;
  author?: string;
  category?: string;
  snippet?: string;
  page?: string; // الصفحة المطبوعة
  volume?: string; // الجزء
  url: string; // رابط عميق لصفحة الكتاب في تراث
}

export interface TurathSearchResponse {
  ok: boolean;
  query: string;
  results: TurathResult[];
  total?: number; // إجمالي ما طابق في تراث (قد يفوق المعروض)
  source: "turath";
  configured: boolean;
  note?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** يفكّ حقل meta سواء كان نصّ JSON أو كائناً. */
function parseMeta(metaRaw: any): any {
  if (!metaRaw) return {};
  if (typeof metaRaw === "object") return metaRaw;
  if (typeof metaRaw === "string") {
    try {
      return JSON.parse(metaRaw);
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeRows(data: any, limit: number): TurathResult[] {
  const rows: any[] = Array.isArray(data) ? data : data?.data ?? data?.results ?? data?.hits ?? [];
  if (!Array.isArray(rows)) return [];

  return rows
    .slice(0, limit)
    .map((r: any, i: number): TurathResult => {
      const meta = parseMeta(r?.meta);
      const bookId = r?.book_id ?? meta?.book_id ?? r?.bookId;
      const bookTitle = meta?.book_name ?? r?.book_name ?? meta?.title ?? "كتاب من تراث";
      const author = meta?.author_name ?? r?.author_name ?? meta?.author;
      const category = meta?.cat_name ?? meta?.category ?? r?.cat_name; // غالباً غير متوفّر (cat_id فقط)
      const page = meta?.page ?? r?.page;
      const pageId = meta?.page_id ?? r?.page_id;
      const vol = meta?.vol ?? r?.vol ?? meta?.volume;
      const snippet = stripHtml(r?.text ?? r?.snip ?? r?.snippet ?? "");

      // رقم الصفحة في الرابط: page_id افتراضاً (فهرس مطلق فريد)، مع fallback.
      const urlPage = meta?.[URL_PAGE_FIELD] ?? pageId ?? page;
      const url =
        bookId != null
          ? `${APP_BASE}/book/${bookId}${urlPage != null ? `/${urlPage}` : ""}`
          : APP_BASE;

      return {
        id: `${bookId ?? "b"}:${pageId ?? page ?? i}`,
        bookTitle: String(bookTitle),
        author: author ? String(author) : undefined,
        category: category ? String(category) : undefined,
        snippet: snippet || undefined,
        page: page != null ? String(page) : undefined,
        volume: vol != null ? String(vol) : undefined,
        url,
      };
    })
    .filter((x) => x.bookTitle);
}

export async function searchTurath(query: string, limit = 50): Promise<TurathSearchResponse> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, query: q, results: [], source: "turath", configured: true };

  try {
    const path = SEARCH_PATH.replace("{q}", encodeURIComponent(q));
    const resp = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      return { ok: false, query: q, results: [], source: "turath", configured: false, note: `turath HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as any;
    const total = typeof data?.count === "number" ? data.count : typeof data?.total === "number" ? data.total : undefined;
    return { ok: true, query: q, results: normalizeRows(data, limit), total, source: "turath", configured: true };
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

/** تشخيص فقط: يعيد استجابة البحث الخام (مفاتيح + أول صفّ) لضبط المحوّل. */
export async function fetchTurathRaw(query: string): Promise<unknown> {
  const q = (query ?? "").trim();
  const path = SEARCH_PATH.replace("{q}", encodeURIComponent(q));
  try {
    const resp = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    const body: any = await resp.json().catch(() => null);
    const topKeys = body && typeof body === "object" ? Object.keys(body) : [];
    const rows: any[] = Array.isArray(body) ? body : body?.data ?? body?.results ?? [];
    return { status: resp.status, topKeys, firstRow: rows?.[0] ?? null, parsedMeta: parseMeta(rows?.[0]?.meta) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "fetch failed" };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}
