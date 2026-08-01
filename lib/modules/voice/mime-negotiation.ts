// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §8 — تفاوض صيغة الصوت حسب الجهاز الفعليّ.
// لا نثبّت نوعًا واحدًا. `isSupported` يُحقَن (MediaRecorder.isTypeSupported) فيُختبَر في node.
// ─────────────────────────────────────────────────────────────────────────────

/** ترتيبٌ مُفضَّل (يُتحقَّق منه فعليًّا؛ Safari/iPhone غالبًا MP4/AAC). */
export const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
] as const;

/** الامتداد المطابق للحاوية الحقيقيّة (لا نغيّر الامتداد دون مطابقة الحاوية). */
export function extensionForMime(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
    case "audio/aac":
      return "m4a";
    case "audio/ogg":
      return "ogg";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "bin";
  }
}

/** يستخرج الـcodec إن ورد في نوع MIME. */
export function codecFromMime(mimeType: string): string | undefined {
  const m = /codecs=([^;]+)/i.exec(mimeType);
  return m ? m[1].replace(/["']/g, "").trim() : undefined;
}

export type IsTypeSupported = (mimeType: string) => boolean;

/** يختار أوّل نوعٍ مدعومٍ فعليًّا على الجهاز؛ null إن لم يُدعَم أيّ نوع. */
export function chooseSupportedAudioMimeType(
  isSupported: IsTypeSupported,
  candidates: readonly string[] = PREFERRED_AUDIO_MIME_TYPES,
): string | null {
  for (const type of candidates) {
    try {
      if (isSupported(type)) return type;
    } catch {
      /* تجاهل نوعًا يرمي */
    }
  }
  return null;
}

/** عائلة المتصفّح (تشخيصيّ فقط، من user-agent). */
export function browserFamily(ua: string): string {
  const s = (ua || "").toLowerCase();
  if (/crios|chrome|chromium|edg/.test(s) && !/safari\/.*version/.test(s)) return "chromium";
  if (/firefox|fxios/.test(s)) return "firefox";
  if (/safari/.test(s) || /iphone|ipad|ipod/.test(s)) return "safari";
  return "other";
}
