// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §5 — آلة حالاتٍ صارمة للمسجّل الصوتي.
// مصدر حالةٍ واحد. الانتقالات غير القانونيّة تُرفَض (تعيد الحالة كما هي). نقيّ/قابل للاختبار.
// ─────────────────────────────────────────────────────────────────────────────
import type { VoiceEvent, VoiceState } from "./contracts";

/** جدول الانتقالات القانونيّة: من الحالة → نوع الحدث → الحالة التالية. */
const TRANSITIONS: Partial<Record<VoiceState, Partial<Record<VoiceEvent["type"], VoiceState>>>> = {
  IDLE: {
    REQUEST_PERMISSION: "REQUESTING_PERMISSION",
    UNSUPPORTED: "UNSUPPORTED",
  },
  REQUESTING_PERMISSION: {
    PERMISSION_GRANTED: "PRESS_RECORDING",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
    CANCEL: "CANCELLED",
    ERROR: "ERROR",
  },
  PRESS_RECORDING: {
    LOCK: "LOCKED_RECORDING",
    STOP: "STOPPING",
    CANCEL: "CANCELLED",
    TOO_SHORT: "CANCELLED",
    ERROR: "ERROR",
  },
  LOCKED_RECORDING: {
    PAUSE: "PAUSED",
    STOP: "STOPPING",
    CANCEL: "CANCELLED",
    ERROR: "ERROR",
  },
  PAUSED: {
    RESUME: "LOCKED_RECORDING",
    STOP: "STOPPING",
    CANCEL: "CANCELLED",
    ERROR: "ERROR",
  },
  STOPPING: {
    STOPPED: "RECORDED",
    TOO_SHORT: "CANCELLED",
    ERROR: "ERROR",
  },
  RECORDED: {
    PLAY: "PLAYING",
    TRANSCRIBE: "UPLOADING",
    DELETE: "IDLE",
    CANCEL: "CANCELLED",
    RESET: "IDLE",
  },
  PLAYING: {
    PLAYBACK_ENDED: "RECORDED",
    STOP: "RECORDED",
    DELETE: "IDLE",
    TRANSCRIBE: "UPLOADING",
  },
  UPLOADING: {
    UPLOAD_STARTED: "TRANSCRIBING",
    ERROR: "ERROR",
    CANCEL: "CANCELLED",
  },
  TRANSCRIBING: {
    TRANSCRIBED: "TRANSCRIBED",
    ERROR: "ERROR",
  },
  TRANSCRIBED: {
    RESET: "IDLE",
    DELETE: "IDLE",
    REQUEST_PERMISSION: "REQUESTING_PERMISSION", // إعادة تسجيل
  },
  CANCELLED: { RESET: "IDLE", REQUEST_PERMISSION: "REQUESTING_PERMISSION" },
  PERMISSION_DENIED: { RESET: "IDLE", REQUEST_PERMISSION: "REQUESTING_PERMISSION" },
  DEVICE_NOT_FOUND: { RESET: "IDLE", REQUEST_PERMISSION: "REQUESTING_PERMISSION" },
  UNSUPPORTED: { RESET: "IDLE" },
  ERROR: { RESET: "IDLE", REQUEST_PERMISSION: "REQUESTING_PERMISSION" },
};

/** هل الانتقال قانونيّ؟ */
export function canTransition(state: VoiceState, event: VoiceEvent["type"]): boolean {
  return Boolean(TRANSITIONS[state]?.[event]);
}

/** المُخفِّض: يعيد الحالة التالية إن كان الانتقال قانونيًّا، وإلا يُبقي الحالة (لا انتقال غير قانونيّ). */
export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  return TRANSITIONS[state]?.[event.type] ?? state;
}

/** الحالات التي يكون فيها الميكروفون/المسار نشطًا (يجب تنظيفه عند المغادرة §10). */
export function isCapturing(state: VoiceState): boolean {
  return state === "PRESS_RECORDING" || state === "LOCKED_RECORDING" || state === "PAUSED";
}

/** حالاتٌ نهائيّة لا تُبقي موارد. */
export function isTerminal(state: VoiceState): boolean {
  return (
    state === "IDLE" ||
    state === "TRANSCRIBED" ||
    state === "CANCELLED" ||
    state === "PERMISSION_DENIED" ||
    state === "DEVICE_NOT_FOUND" ||
    state === "UNSUPPORTED" ||
    state === "ERROR"
  );
}

export const INITIAL_VOICE_STATE: VoiceState = "IDLE";
