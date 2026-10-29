/**
 * HKM-048 — دمج نتائج hakeem_search: اللفظي النادر + الدلالي بتغطية الألفاظ.
 *
 * العلة: الدمج الهجين القديم (RRF بأربعة مزوّدين) كان يقدّم مواد غير ذات صلة («الغبن» ← م1 قبل م69،
 * و«ما هو التغرير في العقد» لا تظهر فيه م61) بينما المسار الدلالي والحصر اللفظي كلٌّ منهما صحيح وحده.
 * الترتيب هنا يعتمد دليلين مستقلين يمكن فحصهما: تغطية ألفاظ السؤال في نص المادة، وتشابه المعنى.
 * دالة صرفة بلا قاعدة بيانات حتى تُختبر وحدها.
 */

export interface FusionCandidate {
  id: string;
  /** نسبة ألفاظ السؤال الموجودة كلمات كاملة في النص الساري (0..1). */
  coverage: number;
  /** تشابه المتجه (0..1)؛ 0 إن لم يأت المرشح من المسار الدلالي. */
  similarity: number;
  /** جاء من حصر لفظي للفظ نادر. */
  lexicalHit: boolean;
  /** سمّى السؤال النظام باسمه. */
  lawNamed: boolean;
}

export const W_COVERAGE = 0.55;
export const W_SIMILARITY = 0.35;
export const W_LEXICAL = 0.1;
export const W_LAW_NAMED = 0.08;

export function fusionScore(c: FusionCandidate): number {
  const clamp = (x: number) => (Number.isFinite(x) ? Math.min(Math.max(x, 0), 1) : 0);
  const s = W_COVERAGE * clamp(c.coverage) + W_SIMILARITY * clamp(c.similarity) + (c.lexicalHit ? W_LEXICAL : 0) + (c.lawNamed ? W_LAW_NAMED : 0);
  return Math.round(s * 1000) / 1000;
}

/** يدمج مرشحين مكرّرين بالمعرّف (يأخذ الأعلى لكل حقل) ويرتّبهم تنازليًا؛ التعادل بالتشابه ثم بالمعرّف (ثبات). */
export function rankFused(candidates: FusionCandidate[], limit: number): Array<FusionCandidate & { score: number }> {
  const byId = new Map<string, FusionCandidate>();
  for (const c of candidates) {
    const prev = byId.get(c.id);
    byId.set(
      c.id,
      prev
        ? {
            id: c.id,
            coverage: Math.max(prev.coverage, c.coverage),
            similarity: Math.max(prev.similarity, c.similarity),
            lexicalHit: prev.lexicalHit || c.lexicalHit,
            lawNamed: prev.lawNamed || c.lawNamed,
          }
        : c,
    );
  }
  return [...byId.values()]
    .map((c) => ({ ...c, score: fusionScore(c) }))
    .sort((a, b) => b.score - a.score || b.similarity - a.similarity || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

/** أقصى عدد نتائج لفظ نادر يُعدّ دليلًا (ما زاد لفظ شائع لا يميّز مادة). */
export const RARE_TERM_MAX = 50;

/**
 * HKM-053: صفحة الحصر اللفظي دليلٌ إن خلت من الشائع. الندرة تُقاس على المدونة؛ داخل نظام واحد اللفظ المتكرر هو موضوع
 * السؤال («التصفية» في 59 مادة من الإفلاس) فتُقبل صفحته (وهي محصورة في النظام أصلًا).
 */
export function lexicalPageUsable(total: number, scopedToLaw: boolean): boolean {
  if (!Number.isFinite(total) || total <= 0) return false;
  return scopedToLaw || total <= RARE_TERM_MAX;
}

/** HKM-049: أدنى تغطية لألفاظ السؤال لتُقبل مادة جاءت من تكملة المحرك الهجين (ما دونها ضجيج لا يطابق السؤال). */
export const FILL_MIN_COVERAGE = 0.75;

/** تُقبل مادة التكملة إن غطّت ثلاثة أرباع ألفاظ السؤال فأكثر (سؤال من لفظين يلزمه اللفظان)؛ سؤال بلا ألفاظ يُقبل (لا دليل على الرفض). */
export function acceptFill(coverage: number, keywordCount: number): boolean {
  if (keywordCount <= 0) return true;
  return Number.isFinite(coverage) && coverage >= FILL_MIN_COVERAGE;
}

/** HKM-051: مرشح بلا دعم دلالي ولا قرب كافٍ بين الألفاظ يُسقَط (لا مقعد لمطابقة لفظية متباعدة في مادة طويلة). */
export const MIN_WINDOW_COVERAGE = 0.75;
export const SEMANTIC_SUPPORT_MIN = 0.5;

export function keepCandidate(c: { coverage: number; similarity: number }, keywordCount: number): boolean {
  if (keywordCount <= 1) return true;
  if (Number.isFinite(c.similarity) && c.similarity >= SEMANTIC_SUPPORT_MIN) return true;
  return Number.isFinite(c.coverage) && c.coverage >= MIN_WINDOW_COVERAGE;
}
