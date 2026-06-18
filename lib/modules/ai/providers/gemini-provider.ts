// مزوّد Gemini (Google) — يقرأ مفتاحه من البيئة (مسموح داخل طبقة lib/modules/ai).
import { makeProvider, type AiProvider, type CompleteFn } from "./base";

function model(): string {
  return process.env.AI_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-flash";
}

const complete: CompleteFn = async (system, user, maxTokens) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent?key=${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: Math.min(Math.max(maxTokens, 1), 4096), temperature: 0.2 },
    }),
  });
  if (!resp.ok) throw new Error(`gemini ${resp.status}`);
  const data = (await resp.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "";
};

export function createGeminiProvider(): AiProvider {
  return makeProvider(
    { name: "gemini", model: model(), available: () => Boolean(process.env.GEMINI_API_KEY) },
    complete
  );
}
