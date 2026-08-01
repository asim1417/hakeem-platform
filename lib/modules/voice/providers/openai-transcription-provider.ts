// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §11 — مزوّد OpenAI (gpt-4o-transcribe، language=ar).
// prompt قصيرٌ لقاموس السياق القانونيّ فقط — لا وقائع قضيةٍ كاملة. واجهةٌ الآن؛ الوصل لاحقًا.
// ─────────────────────────────────────────────────────────────────────────────
import type { SpeechProviderHealth, SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../contracts";

const MODEL = "gpt-4o-transcribe";

function configured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export const openaiTranscriptionProvider: SpeechToTextProvider = {
  id: "openai",
  async health(): Promise<SpeechProviderHealth> {
    return configured() ? { available: true } : { available: false, reason: "OPENAI_API_KEY غير مضبوط" };
  },
  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    if (!configured()) throw new Error("openai-not-configured");
    // TODO(next-phase): استدعاء OpenAI audio.transcriptions (model=gpt-4o-transcribe, language=ar).
    void MODEL;
    throw new Error("openai-transcribe-not-implemented");
  },
};
