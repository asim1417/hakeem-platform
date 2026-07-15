/**
 * خدمة المتجهات الدلالية (Embeddings) للنواة القانونية.
 *
 * تُستخدم لإعادة ترتيب نتائج البحث دلالياً (بالمعنى لا بالحروف) فتتجاوز
 * اختلاف الصرف والمرادفات. مُصمَّمة بسقوط آمن: إن غاب المفتاح أو فشل المزوّد
 * تُعيد null فيعود الاسترجاع للترتيب المعجمي دون أي تعطّل.
 *
 * التخزين: حقل LegalArticle.embedding (Json) كمصفوفة أرقام.
 * التفعيل يتطلب: مفتاح مزوّد + تشغيل scripts/backfill-embeddings.ts لملء المتجهات.
 */

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
export const EMBEDDING_DIMS = Number(process.env.EMBEDDING_DIMS || 1536);

function embeddingApiKey(): string | null {
  return process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || null;
}

/**
 * نداء واجهة التضمين مع إعادة محاولة عند 429 (حدّ المعدّل) و5xx — تراجع أُسّي
 * يحترم رأس Retry-After. بدون هذا، أي 429 يُسقط الدفعة صامتة (كما حدث للأحكام).
 * يعيد آخر استجابة بعد استنفاد المحاولات (ليسجّلها المتصل)، أو null عند خطأ شبكة.
 */
async function fetchEmbeddingsWithRetry(body: string, key: string, attempts = 5): Promise<Response | null> {
  const baseUrl = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
  const url = `${baseUrl.replace(/\/$/, "")}/embeddings`;
  let delayMs = 1000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body
      });
    } catch (error) {
      if (attempt === attempts - 1) {
        console.error("[embeddings] network error:", error instanceof Error ? error.message : error);
        return null;
      }
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 16000);
      continue;
    }
    // ناجح أو خطأ عميل غير قابل لإعادة المحاولة (≠429 و<500) → أعِد الاستجابة فورًا.
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt === attempts - 1) return res; // استُنفدت المحاولات — يسجّلها المتصل.
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delayMs;
    await new Promise((r) => setTimeout(r, waitMs));
    delayMs = Math.min(delayMs * 2, 16000);
  }
  return null;
}

/**
 * هل البحث الدلالي مُفعّل ومتاح؟
 * مُفعَّل افتراضياً متى توفّر مفتاح التضمين (opt-out): لا يلزم ضبط SEMANTIC_SEARCH=true.
 * يُعطَّل صراحةً بـ SEMANTIC_SEARCH=false|0|off. وبلا مفتاح يبقى مُعطَّلاً (سقوط آمن للمعجمي).
 */
export function semanticSearchEnabled(): boolean {
  const flag = (process.env.SEMANTIC_SEARCH ?? "").toLowerCase().trim();
  const off = flag === "0" || flag === "false" || flag === "off";
  return !off && Boolean(embeddingApiKey());
}

// تخزين مؤقّت (في الذاكرة) لمتجه الاستعلام. مفتاحه = النموذج + النصّ المُطبَّع، فالمتجه
// المُعاد **مطابق تمامًا** لِما ستعيده الشبكة → لا فرق في الترتيب أو النتائج (تحسين سرعة بحت).
// الفائدتان: (١) توحيد النداءات **المتزامنة** المتطابقة (النواة + الهجين في الطلب الواحد
// يشتركان بنداء شبكي واحد بدل اثنين)، (٢) خدمة الاستعلامات المكرّرة فورًا دون شبكة.
// نُخزّن الوعد نفسه (لتوحيد النداءات الطائرة)، ولا نُخزّن الفشل (نسمح بإعادة المحاولة).
type EmbedCacheEntry = { at: number; promise: Promise<number[] | null> };
const EMBED_CACHE = new Map<string, EmbedCacheEntry>();
const EMBED_TTL_MS = 5 * 60_000;
const EMBED_CACHE_MAX = 500;

/**
 * يولّد متجهاً لنصّ واحد عبر OpenAI embeddings (متوافق مع المزوّدات المشابهة).
 * يعيد null عند غياب المفتاح أو أي فشل (سقوط آمن). مُخزَّن مؤقتًا (نفس المتجه بالضبط).
 */
export async function embedText(text: string): Promise<number[] | null> {
  const key = embeddingApiKey();
  if (!key) return null;
  const input = (text || "").replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!input) return null;

  const cacheKey = `${EMBEDDING_MODEL}:${input}`;
  const now = Date.now();
  const cached = EMBED_CACHE.get(cacheKey);
  if (cached && now - cached.at < EMBED_TTL_MS) return cached.promise;

  const promise = (async (): Promise<number[] | null> => {
    const response = await fetchEmbeddingsWithRetry(JSON.stringify({ model: EMBEDDING_MODEL, input }), key);
    if (!response || !response.ok) {
      if (response) console.error("[embeddings] HTTP", response.status);
      EMBED_CACHE.delete(cacheKey); // لا نُخزّن الفشل
      return null;
    }
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = payload.data?.[0]?.embedding;
    if (!(Array.isArray(vector) && vector.length)) {
      EMBED_CACHE.delete(cacheKey);
      return null;
    }
    return vector;
  })();

  if (EMBED_CACHE.size >= EMBED_CACHE_MAX) {
    const oldest = EMBED_CACHE.keys().next().value; // إزالة الأقدم (حدّ حجم بسيط)
    if (oldest !== undefined) EMBED_CACHE.delete(oldest);
  }
  EMBED_CACHE.set(cacheKey, { at: now, promise });
  return promise;
}

/** يولّد متجهات لدفعة نصوص (للـ backfill). يعيد مصفوفة بنفس الترتيب (null لكل فشل). */
export async function embedBatch(texts: string[]): Promise<Array<number[] | null>> {
  const key = embeddingApiKey();
  const out: Array<number[] | null> = texts.map(() => null);
  if (!key) return out;

  const cleaned = texts.map((t) => (t || "").replace(/\s+/g, " ").trim().slice(0, 8000));
  // استبعاد المدخلات الفارغة قبل النداء: واجهة OpenAI ترفض أي إدخال فارغ (400)
  // فتُفشل الدفعة كاملة — فيسقط نصّ فارغ واحد معه بقية الدفعة الصالحة. نُبقيها null.
  const nonEmpty = cleaned.map((t, i) => ({ t, i })).filter((x) => x.t.length > 0);
  if (!nonEmpty.length) return out;

  try {
    const response = await fetchEmbeddingsWithRetry(
      JSON.stringify({ model: EMBEDDING_MODEL, input: nonEmpty.map((x) => x.t) }),
      key
    );
    if (!response || !response.ok) {
      if (response) console.error("[embeddings:batch] HTTP", response.status);
      return out;
    }
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
    for (const item of payload.data ?? []) {
      // item.index موضعٌ ضمن المدخلات غير الفارغة — نُعيده لموضعه الأصلي.
      if (typeof item.index === "number" && Array.isArray(item.embedding)) {
        const original = nonEmpty[item.index]?.i;
        if (typeof original === "number") out[original] = item.embedding;
      }
    }
    return out;
  } catch (error) {
    console.error("[embeddings:batch] error:", error instanceof Error ? error.message : error);
    return out;
  }
}

/** تشابه جيب التمام بين متجهين (يفترض أبعاداً متطابقة). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** يحوّل القيمة المخزّنة (Json) إلى مصفوفة أرقام، أو null إن لم تكن متجهاً صالحاً. */
export function parseStoredEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length && typeof value[0] === "number") return value as number[];
  return null;
}

/** نصّ التضمين القياسي لمادة (اسم النظام + العنوان + النص). */
export function buildEmbeddingText(parts: { systemName?: string | null; title?: string | null; content?: string | null }): string {
  return [parts.systemName, parts.title, parts.content].filter(Boolean).join("\n").slice(0, 8000);
}
