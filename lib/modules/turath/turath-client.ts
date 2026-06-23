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
// رابط تراث العميق: /book/{id}?page={page_id} — قيمة page_id (الفهرس المطلق).
const URL_PAGE_FIELD = (process.env.TURATH_URL_PAGE_FIELD || "page_id").trim();
// اسم بارامتر الترقيم في بحث تراث (للتحميل المزيد). قابل للضبط.
const PAGE_PARAM = (process.env.TURATH_PAGE_PARAM || "page").trim();

export interface TurathResult {
  id: string;
  bookTitle: string;
  author?: string;
  category?: string;
  snippet?: string; // مقتطف قصير
  fullText?: string; // نصّ الصفحة كاملاً للاطّلاع داخل المنصّة
  page?: string; // الصفحة المطبوعة
  volume?: string; // الجزء
  url: string; // رابط عميق لصفحة الكتاب في تراث
}

export interface TurathSearchResponse {
  ok: boolean;
  query: string;
  results: TurathResult[];
  total?: number; // إجمالي ما طابق في تراث (قد يفوق المعروض)
  page: number; // رقم الدفعة الحالية
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
      const rawText = r?.text ?? r?.snip ?? r?.snippet ?? "";
      const snippet = stripHtml(rawText, 240);
      const fullText = stripHtml(rawText, 6000);

      // رابط تراث: /book/{id}?page={page_id} (فهرس مطلق فريد عبر query param).
      const urlPage = meta?.[URL_PAGE_FIELD] ?? pageId ?? page;
      const url =
        bookId != null
          ? `${APP_BASE}/book/${bookId}${urlPage != null ? `?page=${encodeURIComponent(String(urlPage))}` : ""}`
          : APP_BASE;

      return {
        id: `${bookId ?? "b"}:${pageId ?? page ?? i}`,
        bookTitle: String(bookTitle),
        author: author ? String(author) : undefined,
        category: category ? String(category) : undefined,
        snippet: snippet || undefined,
        fullText: fullText && fullText.length > snippet.length ? fullText : undefined,
        page: page != null ? String(page) : undefined,
        volume: vol != null ? String(vol) : undefined,
        url,
      };
    })
    .filter((x) => x.bookTitle);
}

export async function searchTurath(
  query: string,
  opts: { limit?: number; page?: number } = {}
): Promise<TurathSearchResponse> {
  const q = (query ?? "").trim();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const page = Math.max(1, opts.page ?? 1);
  if (q.length < 2) return { ok: true, query: q, results: [], page, source: "turath", configured: true };

  try {
    let path = SEARCH_PATH.replace("{q}", encodeURIComponent(q));
    if (page > 1) path += `${path.includes("?") ? "&" : "?"}${PAGE_PARAM}=${page}`;
    const resp = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      return { ok: false, query: q, results: [], page, source: "turath", configured: false, note: `turath HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as any;
    const total = typeof data?.count === "number" ? data.count : typeof data?.total === "number" ? data.total : undefined;
    return { ok: true, query: q, results: normalizeRows(data, limit), total, page, source: "turath", configured: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر الوصول إلى تراث";
    const blocked = /allowlist|ENOTFOUND|EAI_AGAIN|fetch failed|forbidden|timeout|aborted/i.test(msg);
    return {
      ok: false,
      query: q,
      results: [],
      page,
      source: "turath",
      configured: false,
      note: blocked ? "خدمة تراث غير متاحة من الخادم بعد (تتطلب فتح الشبكة)." : msg,
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function stripHtml(s: unknown, max = 240): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}
