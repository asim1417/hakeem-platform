/**
 * Embedding fallback helpers — أدوات نقيّة لإعادة الترتيب الدلالي داخل التطبيق.
 *
 * تُستعمل حين لا يتوفّر جدول pgvector (`embeddings`) في قاعدة التشغيل، فيُعاد
 * الاعتماد على متجهات `legal_articles.embedding` (Json) وحساب التشابه داخل التطبيق.
 *
 * كل الدوال هنا نقيّة (بلا قاعدة بيانات) وقابلة للاختبار، وبسقوط آمن:
 *  - parseEmbedding: قراءة آمنة لمتجه مخزَّن (مصفوفة/مصفوفة نصوص/سلسلة JSON).
 *  - hasValidDimension: حارس أبعاد — يتجاهل المتجهات المخالفة دون أن يكسر العملية.
 *  - cosineSimilarity: تشابه جيب التمام (مُعاد تصديره من طبقة الذكاء).
 *  - rankByCosine: ترتيب مرشّحين بالتشابه مع تجاهل ما لا يصلح (لا يرمي أبداً).
 *
 * لا تكتب هذه الوحدة أي بيانات ولا تجري أي backfill — قراءة وحساب فقط.
 */
import { cosineSimilarity } from "@/lib/modules/ai/embeddings";

export { cosineSimilarity };

/**
 * يحوّل قيمة مخزّنة إلى مصفوفة أرقام، أو null إن لم تكن متجهاً صالحاً.
 * يقبل: مصفوفة أرقام، مصفوفة نصوص رقمية، أو سلسلة JSON تمثّل مصفوفة.
 * لا يرمي أبداً — أي شكل غير متوقّع يعيد null (سقوط آمن).
 */
export function parseEmbedding(value: unknown): number[] | null {
  if (value === null || value === undefined) return null;

  let candidate: unknown = value;

  // سلسلة: قد تكون "[0.1, 0.2, ...]" — نحاول قراءتها كـ JSON.
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(candidate) || candidate.length === 0) return null;

  const out: number[] = [];
  for (const element of candidate) {
    const n =
      typeof element === "number"
        ? element
        : typeof element === "string"
          ? Number(element)
          : Number.NaN;
    if (!Number.isFinite(n)) return null; // عنصر غير رقمي ⇒ متجه غير صالح
    out.push(n);
  }
  return out;
}

/**
 * حارس الأبعاد: يَعدّ المتجه صالحاً فقط إن طابق البُعد المتوقّع تماماً.
 * يمنع مقارنة متجهات بأبعاد مختلفة (يتجاهلها المُرتِّب بدل أن يفشل).
 */
export function hasValidDimension(vec: number[] | null, expectedDim: number): vec is number[] {
  return Array.isArray(vec) && vec.length > 0 && vec.length === expectedDim;
}

/**
 * يبني تمثيل pgvector النصّي لمتجه (`[x,y,z]`) لاستعماله في `'...'::vector`.
 * يقصُر القيم على أرقام منتهية (يستبدل غير المنتهي بصفر) — لا يرمي أبداً.
 */
export function buildVectorLiteral(vec: number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? Number(x) : 0)).join(",")}]`;
}

export interface CosineCandidate {
  id: string;
  embedding: unknown; // قيمة خام كما من القاعدة (Json) — تُحلَّل داخلياً
}

export interface RankedCandidate {
  id: string;
  score: number; // تشابه جيب التمام (مقصوص إلى 0..1)
}

/**
 * يرتّب المرشّحين بالتشابه الدلالي مع متجه الاستعلام.
 * - يتجاهل أي مرشّح بمتجه غير قابل للقراءة أو مخالف للأبعاد (حارس الأبعاد).
 * - لا يرمي عند سجلّ واحد فاسد — يتخطّاه فقط.
 * - يعيد النتائج مرتّبة تنازلياً، مع اقتطاع اختياري (limit) وحدّ أدنى (minScore).
 */
export function rankByCosine(
  queryVec: number[],
  candidates: CosineCandidate[],
  opts?: { limit?: number; minScore?: number }
): RankedCandidate[] {
  const dim = queryVec.length;
  if (!dim) return [];

  const scored: RankedCandidate[] = [];
  for (const candidate of candidates) {
    const vec = parseEmbedding(candidate.embedding);
    if (!hasValidDimension(vec, dim)) continue; // أبعاد مخالفة/غير صالحة ⇒ تجاهل
    const raw = cosineSimilarity(queryVec, vec);
    const score = Math.max(0, Math.min(1, raw));
    if (opts?.minScore !== undefined && score < opts.minScore) continue;
    scored.push({ id: candidate.id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return typeof opts?.limit === "number" ? scored.slice(0, opts.limit) : scored;
}
