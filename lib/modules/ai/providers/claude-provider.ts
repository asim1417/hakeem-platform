// مزوّد Claude (Anthropic) — يقرأ مفتاحه من البيئة (مسموح داخل طبقة lib/modules/ai).
import { makeProvider, type AiProvider, type CompleteFn } from "./base";

function model(): string {
  return process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}

const complete: CompleteFn = async (system, user, maxTokens) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model(),
      max_tokens: Math.min(Math.max(maxTokens, 1), 4096),
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: user }],
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw new Error(`anthropic ${resp.status}`);
  const data = (await resp.json()) as { content?: Array<{ text?: string }> };
  return data.content?.map((p) => p.text).filter(Boolean).join("\n") || "";
};

export function createClaudeProvider(): AiProvider {
  return makeProvider(
    { name: "claude", model: model(), available: () => Boolean(process.env.ANTHROPIC_API_KEY) },
    complete
  );
}
