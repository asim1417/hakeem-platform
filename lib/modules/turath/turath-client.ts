import "server-only";

/**
 * عميل تكامل مكتبة تراث (turath.io) — بحث حيّ في كتب التراث الإسلامي/الفقهي.
 *
 * بنية تراث: استجابة البحث تحوي book_id + مقتطف (نصّ) لكل نتيجة، **دون** اسم الكتاب
 * (تطبيق تراث يحمّل بيانات الكتب منفصلة). لذا نحلّ بطاقة الكتاب (الاسم/المؤلف/القسم)
 * عبر جلب /book/{id} مرّة واحدة لكل كتاب مع تخزين مؤقّت دائم في الذاكرة.
 *
 * تصميم دفاعي: كل اعتماد على شكل تراث محصور في normalizeRows + extractBookMeta،
 * وكل تعذّر (شبكة/حالة/شكل) يسقط بهدوء — لا يكسر الصفحة أبداً.
 * ملاحظة شبكة: يتطلّب إضافة api.turath.io إلى allowlist الخروج (egress).
 */

const BASE = (process.env.TURATH_API_BASE || "https://api.turath.io").replace(/\/$/, "");
const APP_BASE = (process.env.TURATH_APP_BASE || "https://app.turath.io").replace(/\/$/, "");
const SEARCH_PATH = process.env.TURATH_SEARCH_PATH || "/search?q={q}&precision=2";

export interface TurathResult {
  id: string;
  bookTitle: string;
  author?: string;
  category?: string;
  snippet?: string;
  page?: string;
  volume?: string;
  url: string;
}

export interface TurathSearchResponse {
  ok: boolean;
  query: string;
  results: TurathResult[];
  source: "turath";
  configured: boolean;
  note?: string;
}

interface BookMeta {
  name?: string;
  author?: string;
  category?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// تخزين مؤقّت دائم لبطاقات الكتب (الكتب ثابتة) — يتفادى إعادة الجلب لكل بحث.
const bookMetaCache = new Map<string, BookMeta | null>();

function pickName(obj: any): string | undefined {
  if (!obj) return undefined;
  if (typeof obj === "string") return obj.trim() || undefined;
  return (obj.name ?? obj.title ?? obj.value ?? obj.text ?? obj.fullname ?? undefined) || undefined;
}

/** يستخرج بطاقة الكتاب من استجابة /book/{id} بمسارات حقول دفاعية متعددة. */
function extractBookMeta(j: any): BookMeta | null {
  const m = j?.meta ?? j?.book ?? j?.data?.meta ?? j?.data?.book ?? j?.info ?? j?.data ?? j ?? {};
  const name = pickName(m) ?? m?.book_name ?? m?.bookName;
  const author =
    pickName(m?.author) ??
    m?.author_name ??
    m?.authorName ??
    pickName(j?.author) ??
    (typeof m?.author === "string" ? m.author : undefined);
  const category =
    pickName(m?.cat) ??
    pickName(m?.category) ??
    m?.cat_name ??
    m?.category_name ??
    pickName(j?.cat) ??
    pickName(j?.category);
  if (!name && !author && !category) return null;
  return {
    name: name ? String(name) : undefined,
    author: author ? String(author) : undefined,
    category: category ? String(category) : undefined,
  };
}

async function resolveBookMeta(bookId: string): Promise<BookMeta | null> {
  if (bookMetaCache.has(bookId)) return bookMetaCache.get(bookId) ?? null;
  try {
    const resp = await fetch(`${BASE}/book/${encodeURIComponent(bookId)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) {
      bookMetaCache.set(bookId, null);
      return null;
    }
    const j = await resp.json().catch(() => null);
    const meta = extractBookMeta(j);
    bookMetaCache.set(bookId, meta);
    return meta;
  } catch {
    bookMetaCache.set(bookId, null);
    return null;
  }
}

/** صفّ نتيجة بحث خام → معرّف الكتاب + الصفحة + الجزء + المقتطف (بمسارات دفاعية). */
function parseRow(r: any, i: number) {
  const bookId = r?.book_id ?? r?.bookId ?? r?.book?.id ?? r?.meta?.book_id ?? r?.bid ?? r?.id;
  const page =
    r?.page ?? r?.pg ?? r?.page_num ?? r?.pageNumber ?? r?.page_no ?? r?.p ?? r?.page_id ?? r?.pageId ?? r?.meta?.page;
  const volume = r?.vol ?? r?.volume ?? r?.j ?? r?.part ?? r?.meta?.vol;
  const snippet = stripHtml(r?.snippet ?? r?.text ?? r?.matn ?? r?.body ?? r?.highlight ?? r?.nass ?? r?.content ?? "");
  // اسم الكتاب إن كان مضمّناً في الصف (نادراً) — يُستعمل قبل اللجوء لجلب /book.
  const inlineName = pickName(r?.book) ?? r?.book_name ?? r?.bookName;
  return { bookId: bookId != null ? String(bookId) : null, page, volume, snippet, inlineName, idx: i };
}

async function normalizeWithMeta(data: any, limit: number): Promise<TurathResult[]> {
  const rows: any[] = Array.isArray(data)
    ? data
    : data?.data ?? data?.results ?? data?.hits ?? data?.matches ?? data?.items ?? [];
  if (!Array.isArray(rows)) return [];

  const parsed = rows.slice(0, limit).map(parseRow);

  // جلب بطاقات الكتب الفريدة بالتوازي (مع التخزين المؤقّت) — تحلّ اسم/مؤلف/قسم.
  const uniqueIds = Array.from(new Set(parsed.map((p) => p.bookId).filter((x): x is string => Boolean(x))));
  await Promise.all(uniqueIds.map((id) => resolveBookMeta(id)));

  return parsed
    .map((p): TurathResult => {
      const meta = p.bookId ? bookMetaCache.get(p.bookId) ?? null : null;
      const bookTitle = meta?.name ?? p.inlineName ?? "كتاب من تراث";
      return {
        id: `${p.bookId ?? "b"}:${p.page ?? p.idx}`,
        bookTitle: String(bookTitle),
        author: meta?.author,
        category: meta?.category,
        snippet: p.snippet || undefined,
        page: p.page != null ? String(p.page) : undefined,
        volume: p.volume != null ? String(p.volume) : undefined,
        url: p.bookId ? `${APP_BASE}/book/${p.bookId}${p.page != null ? `/${p.page}` : ""}` : APP_BASE,
      };
    })
    .filter((x) => x.bookTitle);
}

export async function searchTurath(query: string, limit = 10): Promise<TurathSearchResponse> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, query: q, results: [], source: "turath", configured: true };

  try {
    const path = SEARCH_PATH.replace("{q}", encodeURIComponent(q));
    const resp = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      return { ok: false, query: q, results: [], source: "turath", configured: false, note: `turath HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as unknown;
    return { ok: true, query: q, results: await normalizeWithMeta(data, limit), source: "turath", configured: true };
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

/**
 * تشخيص فقط: يكشف شكل استجابة البحث الخام + شكل /book/{id} لأول كتاب،
 * لضبط أسماء الحقول بدقّة. عبر /api/turath/debug.
 */
export async function fetchTurathRaw(query: string): Promise<unknown> {
  const q = (query ?? "").trim();
  const path = SEARCH_PATH.replace("{q}", encodeURIComponent(q));
  try {
    const resp = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    const body: any = await resp.json().catch(() => null);
    const topKeys = body && typeof body === "object" ? Object.keys(body) : [];
    const rows: any[] = Array.isArray(body) ? body : body?.data ?? body?.results ?? body?.hits ?? [];
    const firstRow = rows?.[0] ?? null;
    const firstBookId = firstRow?.book_id ?? firstRow?.bookId ?? firstRow?.book?.id ?? firstRow?.id ?? null;

    let bookSample: any = null;
    if (firstBookId != null) {
      try {
        const br = await fetch(`${BASE}/book/${encodeURIComponent(String(firstBookId))}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(6000),
        });
        const bj: any = await br.json().catch(() => null);
        // عيّنة مختصرة من مفاتيح كتاب واحد (بلا النصّ الضخم).
        bookSample = {
          status: br.status,
          topKeys: bj && typeof bj === "object" ? Object.keys(bj) : [],
          meta: bj?.meta ?? bj?.book ?? bj?.data?.meta ?? bj?.info ?? null,
        };
      } catch (e) {
        bookSample = { error: e instanceof Error ? e.message : "book fetch failed" };
      }
    }

    return { status: resp.status, topKeys, firstRow, firstBookId, bookSample };
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
