"use client";
// HKM-VOICE-NOTE-SA-007 §6/§21 — مساعدة الإذن (رفض/لا جهاز/غير مدعوم).
import type { VoiceState } from "@/lib/modules/voice/contracts";

export function VoicePermissionHelp({ state, onRetry, onDismiss }: { state: VoiceState; onRetry: () => void; onDismiss: () => void }) {
  const msg =
    state === "PERMISSION_DENIED"
      ? "لم يُسمح باستخدام الميكروفون. فعّل إذن الميكروفون لهذا الموقع من إعدادات المتصفّح ثمّ أعد المحاولة."
      : state === "DEVICE_NOT_FOUND"
        ? "لا يوجد ميكروفون متاح على هذا الجهاز."
        : "التسجيل الصوتي غير مدعوم في هذا المتصفّح.";
  return (
    <div className="hkm-voice__help" role="alert">
      <p>{msg}</p>
      <div className="hkm-voice__help-actions">
        {state !== "UNSUPPORTED" ? (
          <button type="button" className="hkm-voice__pill hkm-voice__pill--primary" onClick={onRetry}>
            إعادة المحاولة
          </button>
        ) : null}
        <button type="button" className="hkm-voice__pill" onClick={onDismiss}>
          إغلاق
        </button>
      </div>
    </div>
  );
}
