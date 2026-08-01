// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §11 — سجلّ المزوّدين واختيارٌ حسب الإعداد والإتاحة (لا رأي).
// لا يُرسِل الصوت لأكثر من مزوّدٍ في الطلب الإنتاجيّ نفسه — يختار واحدًا (+ fallback عند الفشل).
// ─────────────────────────────────────────────────────────────────────────────
import type { SpeechProviderId, SpeechToTextProvider } from "./contracts";
import { azureSpeechProvider } from "./providers/azure-speech-provider";
import { openaiTranscriptionProvider } from "./providers/openai-transcription-provider";
import { googleSpeechProvider } from "./providers/google-speech-provider";
import { VOICE_PROVIDER, VOICE_PROVIDER_FALLBACK } from "@/lib/modules/config/voice";

const REGISTRY: Record<SpeechProviderId, SpeechToTextProvider> = {
  azure: azureSpeechProvider,
  openai: openaiTranscriptionProvider,
  google: googleSpeechProvider,
};

export function getProvider(id: string): SpeechToTextProvider | null {
  return (REGISTRY as Record<string, SpeechToTextProvider>)[id] ?? null;
}

export function allProviders(): SpeechToTextProvider[] {
  return [azureSpeechProvider, openaiTranscriptionProvider, googleSpeechProvider];
}

/**
 * يختار المزوّد المُعدّ (VOICE_PROVIDER) إن كان متاحًا، وإلا الاحتياطيّ (VOICE_PROVIDER_FALLBACK)،
 * وإلا أوّل متاحٍ فعلًا. يعتمد health() لا الرأي. يعيد null إن لا مزوّدَ متاح.
 */
export async function selectAvailableProvider(): Promise<SpeechToTextProvider | null> {
  const order = [VOICE_PROVIDER, VOICE_PROVIDER_FALLBACK, "azure", "openai", "google"];
  const seen = new Set<string>();
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const p = getProvider(id);
    if (!p) continue;
    try {
      const h = await p.health();
      if (h.available) return p;
    } catch {
      /* جرّب التالي */
    }
  }
  return null;
}
