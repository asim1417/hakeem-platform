// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §11 — مزوّد Azure Speech (ar-SA + phrase list + punctuation).
// المرحلة الحاليّة: واجهةٌ مطابِقة للعقد + فحص إتاحةٍ من الأسرار. الاستدعاء الحقيقيّ يُوصَل
// في الدفعة التالية خلف العلم. لا مفاتيح في العميل، ولا نداءَ شبكةٍ بلا إعداد.
// ─────────────────────────────────────────────────────────────────────────────
import type { SpeechProviderHealth, SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../contracts";

function configured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export const azureSpeechProvider: SpeechToTextProvider = {
  id: "azure",
  async health(): Promise<SpeechProviderHealth> {
    return configured()
      ? { available: true }
      : { available: false, reason: "AZURE_SPEECH_KEY/REGION غير مضبوطة" };
  },
  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    if (!configured()) throw new Error("azure-not-configured");
    // TODO(next-phase): استدعاء Azure Speech REST مع ar-SA + phraseList + punctuation.
    throw new Error("azure-transcribe-not-implemented");
  },
};
