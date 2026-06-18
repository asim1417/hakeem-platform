// مزوّد OpenAI — يقرأ مفتاحه من البيئة (مسموح داخل طبقة lib/modules/ai).
import { makeProvider, type AiProvider, type CompleteFn } from "./base";

function model(): string {
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
}

const complete: CompleteFn = async (system, user, maxTokens) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "";
  const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }];
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model(), max_tokens: Math.min(Math.max(maxTokens, 1), 4096), messages, temperature: 0.2 }),
  });
  if (!resp.ok) throw new Error(`openai ${resp.status}`);
  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
};

export function createOpenAiProvider(): AiProvider {
  return makeProvider(
    { name: "openai", model: model(), available: () => Boolean(process.env.OPENAI_API_KEY) },
    complete
  );
}
