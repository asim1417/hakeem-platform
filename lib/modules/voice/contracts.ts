// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §5/§8/§11 — عقود مسجّل حكيم الصوتي (أنواع + آلة حالات + مزوّد).
// نقيّ بلا DOM — قابل للاختبار في node. لا أسرار، لا نداءات شبكة هنا.
// ─────────────────────────────────────────────────────────────────────────────

/** §5 — حالات المسجّل الصريحة (مصدر حالةٍ واحد؛ لا booleans متعارضة). */
export type VoiceState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "PRESS_RECORDING"
  | "LOCKED_RECORDING"
  | "PAUSED"
  | "STOPPING"
  | "RECORDED"
  | "PLAYING"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "TRANSCRIBED"
  | "CANCELLED"
  | "PERMISSION_DENIED"
  | "DEVICE_NOT_FOUND"
  | "UNSUPPORTED"
  | "ERROR";

/** §5 — أحداث تُحرّك الآلة (الانتقالات غير القانونيّة ممنوعة). */
export type VoiceEvent =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED" }
  | { type: "DEVICE_NOT_FOUND" }
  | { type: "UNSUPPORTED" }
  | { type: "LOCK" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" } // إفلات/إنهاء ⇒ يبدأ الإيقاف
  | { type: "STOPPED" } // اكتمل الإيقاف ووُجدت بياناتٌ صالحة
  | { type: "TOO_SHORT" } // أقصر من الحدّ ⇒ يُلغى
  | { type: "CANCEL" }
  | { type: "PLAY" }
  | { type: "PLAYBACK_ENDED" }
  | { type: "TRANSCRIBE" }
  | { type: "UPLOAD_STARTED" }
  | { type: "TRANSCRIBED" }
  | { type: "DELETE" } // حذف التسجيل ⇒ العودة إلى IDLE
  | { type: "RESET" }
  | { type: "ERROR" };

/** §8 — بيانات التسجيل الوصفيّة (بلا محتوى صوتيّ). */
export interface RecordingMeta {
  mimeType: string;
  extension: string;
  codec?: string;
  browserFamily?: string;
  durationMs: number;
  byteSize: number;
}

/** حدود قابلة للضبط (§6/§9) — قيمٌ أوّليّة. */
export const VOICE_THRESHOLDS = {
  VOICE_CANCEL_DISTANCE_PX: 90,
  VOICE_LOCK_DISTANCE_PX: 80,
  VOICE_MIN_RECORDING_MS: 500,
  VOICE_MAX_DURATION_SECONDS: 300,
  VOICE_MAX_BYTES: 25_000_000,
} as const;

// ── §11 — مزوّد تحويل الكلام إلى نصّ ──────────────────────────────────────────
export type SpeechProviderId = "azure" | "openai" | "google";

export interface SpeechProviderHealth {
  available: boolean;
  reason?: string;
}

export interface TranscribeInput {
  bytes: Buffer;
  mimeType: string;
  locale: "ar-SA";
  hints?: string[];
  punctuation?: boolean;
}

export interface TranscribeWord {
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

export interface TranscribeResult {
  text: string;
  confidence?: number;
  words?: TranscribeWord[];
  detectedLocale?: string;
  provider: string;
  model: string;
  warnings: string[];
}

export interface SpeechToTextProvider {
  id: SpeechProviderId;
  health(): Promise<SpeechProviderHealth>;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

/** استجابة /api/voice/transcribe (§14). لا مفاتيح ولا endpoints داخليّة. */
export interface TranscribeApiResponse {
  ok: boolean;
  rawTranscript?: string;
  normalizedTranscript?: string;
  locale?: "ar-SA";
  durationMs?: number;
  provider?: string;
  model?: string;
  confidence?: number;
  warnings?: string[];
  error?: string;
  code?: string;
}
