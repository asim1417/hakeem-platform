// جدولة توازٍ متكيّفة (AIMD) — نواة الإنتاجية العالية، محايدة البيئة (متصفح + خادم).
//
// المبدأ (كما في المنصّات العالمية): لا توازيَ ثابت. نبدأ بتوازٍ معتدل ونرفعه تدريجياً
// (زيادة جمعية) كلّما تتابع النجاح، فإذا لامسنا حدّ المعدل (429) نخفضه للنصف (تناقص
// ضربي) ونطبّق تهدئةً قصيرة مشتركة، ثم نتعافى. فنُشبع أقصى معدلٍ يسمح به المفتاح
// تلقائياً — نظير تحكّم ازدحام TCP. العنق الوحيد هو حدّ مفتاحك، والبرمجيات تُشبعه.
//
// نقيّة وحتمية بنيوياً: المُنفّذ (runner) مُحقَن، والزمن عبر now() قابل للحقن للاختبار.

export interface AttemptResult<O> {
  /** القيمة عند النجاح (أو null لفشلٍ نهائي غير متعلّق بالمعدل). */
  value: O | null;
  /** حدّ المعدل (429) — يُعاد جدولة العنصر مع خفض التوازي والتهدئة. */
  rateLimited: boolean;
}

export interface AdaptiveOptions {
  /** أدنى توازٍ لا ننزل تحته (افتراضي 2). */
  min?: number;
  /** أقصى توازٍ (سقف أمان — افتراضي 24؛ ارفعه للمفاتيح عالية الحدّ). */
  max?: number;
  /** التوازي الابتدائي (افتراضي 6). */
  start?: number;
  /** عدد النجاحات المتتالية قبل رفع التوازي +1 (افتراضي 6). */
  rampAfter?: number;
  /** أقصى إعادات محاولةٍ لعنصرٍ يُرفض بالمعدل قبل الاستسلام (افتراضي 6). */
  maxRetries?: number;
  /** تهدئة مشتركة متدرّجة عند 429 (مللي ثانية). */
  cooldownMs?: number[];
  /** إلغاء تعاوني. */
  signal?: () => boolean;
  /** تقدّم: (منجز, الكلّ, التوازي الحالي). */
  onProgress?: (done: number, total: number, concurrency: number) => void;
  /** حاقن الزمن (للاختبار الحتمي). */
  now?: () => number;
  /** حاقن النوم (للاختبار الحتمي). */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * يشغّل عناصر عبر runner بتوازٍ متكيّف، ويعيد النتائج مرتّبةً بترتيب المدخلات.
 * العنصر المرفوض بالمعدل يُعاد جدولته (حتى maxRetries) لا يُفقَد؛ والفشل النهائي
 * (rateLimited=false, value=null) يُحسب منجزاً بقيمة null فلا تعليق.
 */
export async function runAdaptive<I, O>(
  items: I[],
  runner: (item: I, index: number) => Promise<AttemptResult<O>>,
  opts: AdaptiveOptions = {}
): Promise<(O | null)[]> {
  const min = Math.max(1, opts.min ?? 2);
  const max = Math.max(min, opts.max ?? 24);
  const rampAfter = Math.max(1, opts.rampAfter ?? 6);
  const maxRetries = Math.max(0, opts.maxRetries ?? 6);
  const cooldowns = opts.cooldownMs ?? [1_000, 3_000, 8_000];
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const n = items.length;
  const results: (O | null)[] = new Array(n).fill(null);
  if (n === 0) return results;

  const queue: number[] = items.map((_, i) => i); // ترتيب المعالجة (يُلحَق به المعادُ جدولته)
  const attempts = new Array<number>(n).fill(0);
  let head = 0;
  let done = 0;
  let inFlight = 0;
  let target = Math.min(max, Math.max(min, opts.start ?? 6));
  let streak = 0;
  let cdLevel = 0;
  let pauseUntil = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (opts.signal?.()) return;
      if (done >= n) return;

      // تهدئة مشتركة (بعد 429)
      const wait = pauseUntil - now();
      if (wait > 0) {
        await sleep(Math.min(wait, 250));
        continue;
      }
      // بوّابة التوازي — لا await بين الفحص والحجز فلا فرط اشتراك (JS أحادي الخيط)
      if (inFlight >= target) {
        await sleep(30);
        continue;
      }
      if (head >= queue.length) {
        if (inFlight > 0) {
          await sleep(30);
          continue;
        } // قد يُعاد جدولة عنصرٍ طائر
        return; // لا شيء متبقٍّ ولا طائر
      }
      const i = queue[head];
      head += 1;
      inFlight += 1;
      let r: AttemptResult<O>;
      try {
        r = await runner(items[i], i);
      } catch {
        r = { value: null, rateLimited: false };
      } finally {
        inFlight -= 1;
      }

      if (r.rateLimited) {
        attempts[i] += 1;
        // تناقص ضربي + تهدئة مشتركة متدرّجة
        target = Math.max(min, Math.floor(target / 2));
        pauseUntil = now() + cooldowns[Math.min(cdLevel, cooldowns.length - 1)];
        cdLevel = Math.min(cdLevel + 1, cooldowns.length - 1);
        streak = 0;
        if (attempts[i] > maxRetries) {
          results[i] = null;
          done += 1; // استسلامٌ نهائي — لا تعليق
          opts.onProgress?.(done, n, target);
        } else {
          queue.push(i); // أعِد الجدولة
        }
      } else {
        results[i] = r.value;
        done += 1;
        streak += 1;
        cdLevel = Math.max(0, cdLevel - 1); // تعافي التهدئة
        // زيادة جمعية عند تتابع النجاح
        if (streak % rampAfter === 0) target = Math.min(max, target + 1);
        opts.onProgress?.(done, n, target);
      }
    }
  };

  // نطلق max عاملاً؛ البوّابة (inFlight<target) تحدّ الطائر فعلياً للتوازي المتكيّف.
  await Promise.all(Array.from({ length: Math.min(max, n) }, () => worker()));
  return results;
}
