"use client";
// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §6 — إيماءات WhatsApp عبر Pointer Events (لا Mouse فقط).
// ضغطٌ للتسجيل · سحبٌ أفقيّ للإلغاء · سحبٌ للأعلى للقفل. عتباتٌ قابلة للاختبار.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useRef } from "react";
import { VOICE_THRESHOLDS } from "@/lib/modules/voice/contracts";

export interface VoiceGestureCallbacks {
  /** يبدأ التسجيل (طلب الإذن + start). يُستدعى عند pointerdown. */
  onStart: () => void;
  /** تقدّم السحب للإلغاء 0..1 (لعرضٍ بصريّ). */
  onCancelProgress?: (p: number) => void;
  /** تقدّم السحب للقفل 0..1. */
  onLockProgress?: (p: number) => void;
  onLock: () => void;
  onCancel: () => void;
  /** إفلاتٌ دون قفلٍ ولا إلغاء ⇒ إيقافٌ وفتح المعاينة. */
  onStopRelease: () => void;
  enabled: boolean;
}

export function useVoiceGestures(cb: VoiceGestureCallbacks) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockedRef = useRef(false);
  const endedRef = useRef(false);
  const CANCEL = VOICE_THRESHOLDS.VOICE_CANCEL_DISTANCE_PX;
  const LOCK = VOICE_THRESHOLDS.VOICE_LOCK_DISTANCE_PX;

  const cleanup = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancelEv);
    startRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const s = startRef.current;
      if (!s || lockedRef.current || endedRef.current) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      // إلغاء: مسافةٌ أفقيّة (أيّ اتجاه — يراعي RTL) تتجاوز deadzone.
      const cancelDist = Math.abs(dx);
      cb.onCancelProgress?.(Math.min(1, cancelDist / CANCEL));
      // قفل: حركةٌ للأعلى (dy سالب).
      const lockDist = Math.max(0, -dy);
      cb.onLockProgress?.(Math.min(1, lockDist / LOCK));
      if (lockDist >= LOCK) {
        lockedRef.current = true;
        cb.onLock();
        cleanup();
        return;
      }
      if (cancelDist >= CANCEL) {
        endedRef.current = true;
        cb.onCancel();
        cleanup();
      }
    },
    [CANCEL, LOCK, cb, cleanup],
  );

  const onUp = useCallback(() => {
    if (endedRef.current || lockedRef.current) {
      cleanup();
      return;
    }
    endedRef.current = true;
    cb.onStopRelease();
    cleanup();
  }, [cb, cleanup]);

  const onCancelEv = useCallback(() => {
    if (endedRef.current || lockedRef.current) {
      cleanup();
      return;
    }
    endedRef.current = true;
    cb.onCancel();
    cleanup();
  }, [cb, cleanup]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!cb.enabled) return;
      e.preventDefault();
      lockedRef.current = false;
      endedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* تجاهل */
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancelEv);
      cb.onStart();
    },
    [cb, onMove, onUp, onCancelEv],
  );

  return { onPointerDown };
}
