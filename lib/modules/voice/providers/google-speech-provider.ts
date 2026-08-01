// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §11 — مزوّد Google Speech (ar-SA، Chirp عند توفّره، punctuation).
// واجهةٌ مطابِقة للعقد الآن؛ الوصل الحقيقيّ في الدفعة التالية خلف العلم.
// ─────────────────────────────────────────────────────────────────────────────
import type { SpeechProviderHealth, SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../contracts";

function configured(): boolean {
  return Boolean(process.env.GOOGLE_SPEECH_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export const googleSpeechProvider: SpeechToTextProvider = {
  id: "google",
  async health(): Promise<SpeechProviderHealth> {
    return configured()
      ? { available: true }
      : { available: false, reason: "GOOGLE_SPEECH_KEY/CREDENTIALS غير مضبوطة" };
  },
  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    if (!configured()) throw new Error("google-not-configured");
    // TODO(next-phase): استدعاء Google Speech v2 (ar-SA, Chirp, automatic punctuation).
    throw new Error("google-transcribe-not-implemented");
  },
};
