"use client";

// ─────────────────────────────────────────────────────────────────────────────
// خطّاف قفل بقاء الشاشة (Screen Wake Lock) — يمنع نوم الجهاز أثناء البحث/الإنتاج الحيّ،
// فلا يتوقّف البثّ في متصفّح الجوال حين تخفت الشاشة. يُعاد طلب القفل تلقائيًّا عند العودة
// للواجهة (بعض المتصفّحات تُحرّره عند التغييب). يُحرَّر عند انتهاء العمل أو تفكيك المكوّن.
// سقوطٌ صامت على المتصفّحات غير الداعمة (لا يكسر شيئًا).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";

type Sentinel = { release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

/** يُبقي الشاشة يقظةً ما دام `active` صحيحًا (أثناء البحث/التوليد الحيّ). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel) return;
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) { void s.release().catch(() => {}); return; }
        sentinel = s;
        // إن حُرِّر تلقائيًّا (تغييب) نُصفّر المرجع كي يُعاد طلبه عند العودة.
        s.addEventListener?.("release", () => { sentinel = null; });
      } catch { /* غير مدعوم/مرفوض — تجاهل */ }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      const s = sentinel;
      sentinel = null;
      if (s) void s.release().catch(() => {});
    };
  }, [active]);
}
