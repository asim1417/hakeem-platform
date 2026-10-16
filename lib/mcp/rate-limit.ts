/**
 * محدّد معدّل للمحاولات الفاشلة (نافذة منزلقة، بالذاكرة).
 * أفضل جهد: على بيئة بلا حالة يكون الحد لكل نسخة تشغيل، وهو يرفع كلفة التخمين
 * ولا يغني عن مفتاح طويل عشوائي. الحجم مسقوف حتى لا يصبح هو نفسه ثغرة ذاكرة.
 */
export type FailureLimiter = {
  /** هل المفتاح محجوب الآن؟ يعيد الثواني المتبقية أو 0. */
  blockedFor(key: string): number;
  /** سجّل محاولة فاشلة. */
  recordFailure(key: string): void;
  /** صفّر السجل بعد نجاح. */
  reset(key: string): void;
};

export function createFailureLimiter(opts: {
  max: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): FailureLimiter {
  const { max, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 5000;
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function fresh(key: string, t: number): number[] {
    const list = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  }

  function prune(t: number) {
    if (hits.size <= maxKeys) return;
    for (const key of hits.keys()) {
      fresh(key, t);
      if (hits.size <= maxKeys / 2) break;
    }
    // إن بقي ممتلئًا نُسقط الأقدم إدخالًا.
    while (hits.size > maxKeys) {
      const first = hits.keys().next().value;
      if (first === undefined) break;
      hits.delete(first);
    }
  }

  return {
    blockedFor(key) {
      const t = now();
      const list = fresh(key, t);
      if (list.length < max) return 0;
      return Math.max(1, Math.ceil((list[0] + windowMs - t) / 1000));
    },
    recordFailure(key) {
      const t = now();
      const list = fresh(key, t);
      list.push(t);
      hits.set(key, list);
      prune(t);
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

/** عنوان العميل من ترويسات المنصة (أول قيمة فقط). */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return (fwd || real || "unknown").slice(0, 64);
}
