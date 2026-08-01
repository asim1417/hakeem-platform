// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §11 — مزوّد OpenAI (gpt-4o-transcribe، language=ar).
// prompt قصيرٌ لقاموس السياق القانونيّ فقط — لا وقائع قضيةٍ كاملة. المفتاح خادميّ فقط.
// ─────────────────────────────────────────────────────────────────────────────
import { extensionForMime } from "../mime-negotiation";
import type { SpeechProviderHealth, SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../contracts";

const MODEL = (process.env.HAKEEM_VOICE_OPENAI_MODEL ?? "gpt-4o-transcribe").trim();
const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

function configured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** يقصّ تلميحات السياق إلى prompt قصير (لا وقائع). */
function hintsPrompt(hints?: string[]): string | undefined {
  if (!hints || !hints.length) return undefined;
  const joined = hints.slice(0, 40).join("، ");
  return joined.slice(0, 800);
}

export const openaiTranscriptionProvider: SpeechToTextProvider = {
  id: "openai",
  async health(): Promise<SpeechProviderHealth> {
    return configured() ? { available: true } : { available: false, reason: "OPENAI_API_KEY غير مضبوط" };
  },
  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("openai-not-configured");

    const ext = extensionForMime(input.mimeType) || "webm";
    const file = new File([new Uint8Array(input.bytes)], `voice.${ext}`, { type: input.mimeType });
    const form = new FormData();
    form.append("file", file);
    form.append("model", MODEL);
    form.append("language", "ar"); // §11 — العربيّة
    form.append("response_format", "json");
    const prompt = hintsPrompt(input.hints);
    if (prompt) form.append("prompt", prompt);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`openai-http-${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
    }
    const data = (await res.json().catch(() => ({}))) as { text?: string };
    const text = String(data.text ?? "").trim();
    if (!text) throw new Error("openai-empty-transcript");
    return {
      text,
      provider: "openai",
      model: MODEL,
      detectedLocale: "ar",
      warnings: [],
    };
  },
};
