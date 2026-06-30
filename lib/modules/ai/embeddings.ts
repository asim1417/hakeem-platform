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
 * هل البحث الدلالي مُفعّل ومتاح؟
 * مُفعَّل افتراضياً متى توفّر مفتاح التضمين (opt-out): لا يلزم ضبط SEMANTIC_SEARCH=true.
 * يُعطَّل صراحةً بـ SEMANTIC_SEARCH=false|0|off. وبلا مفتاح يبقى مُعطَّلاً (سقوط آمن للمعجمي).
 */
export function semanticSearchEnabled(): boolean {
  const flag = (process.env.SEMANTIC_SEARCH ?? "").toLowerCase().trim();
  const off = flag === "0" || flag === "false" || flag === "off";
  return !off && Boolean(embeddingApiKey());
}

/**
 * يولّد متجهاً لنصّ واحد عبر OpenAI embeddings (متوافق مع المزوّدات المشابهة).
 * يعيد null عند غياب المفتاح أو أي فشل (سقوط آمن).
 */
export async function embedText(text: string): Promise<number[] | null> {
  const key = embeddingApiKey();
  if (!key) return null;
  const input = (text || "").replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!input) return null;

  const baseUrl = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input })
    });
    if (!response.ok) {
      console.error("[embeddings] HTTP", response.status);
      return null;
    }
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = payload.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length ? vector : null;
  } catch (error) {
    console.error("[embeddings] error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** يولّد متجهات لدفعة نصوص (للـ backfill). يعيد مصفوفة بنفس الترتيب (null لكل فشل). */
export async function embedBatch(texts: string[]): Promise<Array<number[] | null>> {
  const key = embeddingApiKey();
  if (!key) return texts.map(() => null);
  const inputs = texts.map((t) => (t || "").replace(/\s+/g, " ").trim().slice(0, 8000));
  const baseUrl = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs })
    });
    if (!response.ok) {
      console.error("[embeddings:batch] HTTP", response.status);
      return texts.map(() => null);
    }
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
    const out: Array<number[] | null> = texts.map(() => null);
    for (const item of payload.data ?? []) {
      if (typeof item.index === "number" && Array.isArray(item.embedding)) out[item.index] = item.embedding;
    }
    return out;
  } catch (error) {
    console.error("[embeddings:batch] error:", error instanceof Error ? error.message : error);
    return texts.map(() => null);
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
