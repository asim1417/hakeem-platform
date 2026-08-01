// عدّادات ومؤقّتات في الذاكرة — المخطط السيادي §23. خفيفة، بلا تبعيات خارجيّة.
// لقطة للقراءة عبر /api/metrics (محميّة). ليست بديلًا عن OTel، بل أساسٌ محليّ.

type Counter = { name: string; value: number };
type Timer = { name: string; count: number; totalMs: number; maxMs: number };

const counters = new Map<string, number>();
const timers = new Map<string, { count: number; totalMs: number; maxMs: number }>();

export function increment(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

/** يسجّل زمن عملية (ms). durationMs يُمرَّر محسوبًا من المستدعي. */
export function observeDuration(name: string, durationMs: number): void {
  const t = timers.get(name) ?? { count: 0, totalMs: 0, maxMs: 0 };
  t.count += 1;
  t.totalMs += durationMs;
  t.maxMs = Math.max(t.maxMs, durationMs);
  timers.set(name, t);
}

export function snapshot(): { counters: Counter[]; timers: Array<Timer & { avgMs: number }> } {
  return {
    counters: [...counters.entries()].map(([name, value]) => ({ name, value })),
    timers: [...timers.entries()].map(([name, t]) => ({
      name,
      count: t.count,
      totalMs: t.totalMs,
      maxMs: t.maxMs,
      avgMs: t.count > 0 ? Math.round(t.totalMs / t.count) : 0,
    })),
  };
}

/** يصفّر العدّادات — للاختبار فقط. */
export function __resetMetrics(): void {
  counters.clear();
  timers.clear();
}
