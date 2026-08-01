// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §14 (8) — تحقّق الصوت على الخادم عبر Magic Bytes.
// لا نثق بامتداد/نوع MIME من العميل وحده — نتحقّق من توقيع الحاوية الفعليّ. نقيّ.
// ─────────────────────────────────────────────────────────────────────────────

export type DetectedContainer = "webm" | "mp4" | "ogg" | "wav" | "mp3" | "unknown";

/** يكتشف الحاوية من أوائل البايتات (توقيعاتٌ معروفة). */
export function detectAudioContainer(bytes: Uint8Array): DetectedContainer {
  if (bytes.length < 12) return "unknown";
  // WebM / Matroska: 1A 45 DF A3 (EBML)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  // OGG: "OggS"
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";
  // WAV: "RIFF"...."WAVE"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  )
    return "wav";
  // MP4 / M4A: "ftyp" at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "mp4";
  // MP3: ID3 tag or frame sync 0xFFEx
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  return "unknown";
}

/** يوافق نوع MIME المُعلَن حاويةً مكتشفة؟ (نمنع تزييف الامتداد). */
export function mimeMatchesContainer(mimeType: string, container: DetectedContainer): boolean {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  const map: Record<DetectedContainer, string[]> = {
    webm: ["audio/webm", "video/webm"],
    mp4: ["audio/mp4", "audio/aac", "video/mp4"],
    ogg: ["audio/ogg", "application/ogg"],
    wav: ["audio/wav", "audio/x-wav"],
    mp3: ["audio/mpeg", "audio/mp3"],
    unknown: [],
  };
  return map[container]?.includes(base) ?? false;
}

export interface AudioValidationInput {
  bytes: Uint8Array;
  declaredMimeType: string;
  maxBytes: number;
}
export interface AudioValidationResult {
  ok: boolean;
  container: DetectedContainer;
  code?: "EMPTY" | "TOO_LARGE" | "UNKNOWN_CONTAINER" | "MIME_MISMATCH";
  message?: string;
}

/** تحقّقٌ شامل: غير فارغ، ضمن الحجم، حاويةٌ معروفة، ومطابقةٌ للنوع المُعلَن. */
export function validateAudioBytes(input: AudioValidationInput): AudioValidationResult {
  const { bytes, declaredMimeType, maxBytes } = input;
  if (!bytes || bytes.length === 0) return { ok: false, container: "unknown", code: "EMPTY", message: "ملفٌّ فارغ." };
  if (bytes.length > maxBytes)
    return { ok: false, container: "unknown", code: "TOO_LARGE", message: "حجم الصوت يتجاوز الحدّ." };
  const container = detectAudioContainer(bytes);
  if (container === "unknown")
    return { ok: false, container, code: "UNKNOWN_CONTAINER", message: "حاوية صوتٍ غير معروفة." };
  if (!mimeMatchesContainer(declaredMimeType, container))
    return { ok: false, container, code: "MIME_MISMATCH", message: "نوع الملفّ لا يطابق محتواه." };
  return { ok: true, container };
}
