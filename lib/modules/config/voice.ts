// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §17 — أعلام إتاحة المسجّل الصوتي. كلّها مطفأة افتراضيًّا ⇒
// صفر تغيير على المستخدم حتى التفعيل الصريح. لا Mark Ready قبل اختبار iPhone الفعليّ.
// ─────────────────────────────────────────────────────────────────────────────

function on(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}
function intOr(v: string | undefined, dflt: number): number {
  const n = Number.parseInt((v ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/** واجهة التسجيل الجديدة (عميل) — NEXT_PUBLIC كي تُقرأ في المتصفّح. */
export function isVoiceNoteV2Enabled(): boolean {
  return on(process.env.NEXT_PUBLIC_HAKEEM_VOICE_NOTE_V2);
}
/** التفريغ الخادميّ (خادم). */
export function isVoiceTranscriptionV2Enabled(): boolean {
  return on(process.env.HAKEEM_VOICE_TRANSCRIPTION_V2);
}
/** قصّ التسجيل (خلف علمٍ مستقل §7). */
export function isVoiceTrimmingV1Enabled(): boolean {
  return on(process.env.VOICE_TRIMMING_V1);
}

export const VOICE_PROVIDER = (process.env.HAKEEM_VOICE_PROVIDER ?? "azure").trim().toLowerCase();
export const VOICE_PROVIDER_FALLBACK = (process.env.HAKEEM_VOICE_PROVIDER_FALLBACK ?? "openai").trim().toLowerCase();
export const VOICE_MAX_DURATION_SECONDS = intOr(process.env.HAKEEM_VOICE_MAX_DURATION_SECONDS, 300);
export const VOICE_MAX_BYTES = intOr(process.env.HAKEEM_VOICE_MAX_BYTES, 25_000_000);
