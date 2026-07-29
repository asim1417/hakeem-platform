// عميلٌ خام لواجهة Anthropic Messages مع دعم الأدوات (tool_use/tool_result). لقطةٌ واحدة
// لكلّ نداء؛ الحلقة في runtime.ts. Claude حصريًّا (قاعدة CLAUDE.md) — لا مزوّد آخر.
import { resolveAiConfig } from "@/lib/modules/ai/ai-config";
import { recordAiUsageFromContext } from "@/lib/modules/billing/ai-usage-meter";
import { hakeemAgentModel } from "./flag";

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface AnthropicResult {
  ok: boolean;
  stopReason: string | null;
  content: AnthropicContentBlock[];
  error?: string;
}

/** هل مزوّد Claude مفعّلٌ فعلًا؟ الوكيل الأصيل يعمل به حصريًّا. */
export async function claudeProviderActive(): Promise<boolean> {
  const cfg = await resolveAiConfig().catch(() => null);
  return Boolean(cfg && cfg.provider === "anthropic" && cfg.apiKey);
}

/**
 * نداءٌ واحدٌ لـ Anthropic مع الأدوات. يعيد كتل المحتوى (نصّ + tool_use) وسبب التوقّف.
 * لا يرمي: يعيد ok=false مع الخطأ فيتصرّف المستدعي (سقوطٌ آمن).
 */
export async function callAnthropicWithTools(input: {
  system: string;
  messages: AnthropicMessage[];
  tools: AnthropicToolDef[];
  maxTokens?: number;
}): Promise<AnthropicResult> {
  const cfg = await resolveAiConfig().catch(() => null);
  if (!cfg || cfg.provider !== "anthropic" || !cfg.apiKey) {
    return { ok: false, stopReason: null, content: [], error: "مزوّد Claude غير مفعّل (لا مفتاح Anthropic)." };
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: hakeemAgentModel(cfg.model),
        max_tokens: Math.min(Math.max(input.maxTokens ?? 4096, 512), 8192),
        system: input.system,
        tools: input.tools,
        messages: input.messages,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, stopReason: null, content: [], error: `Anthropic ${response.status}: ${body.slice(0, 300)}` };
    }
    const json = (await response.json()) as {
      stop_reason?: string;
      content?: AnthropicContentBlock[];
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const inputTokens = Number(json.usage?.input_tokens) || 0;
    const outputTokens = Number(json.usage?.output_tokens) || 0;
    if (inputTokens > 0 || outputTokens > 0) {
      void recordAiUsageFromContext(
        { inputTokens, outputTokens },
        {
          provider: "anthropic",
          model: json.model || hakeemAgentModel(cfg.model),
          serviceKey: "ask",
          streamed: false,
        }
      );
    }
    return { ok: true, stopReason: json.stop_reason ?? null, content: Array.isArray(json.content) ? json.content : [] };
  } catch (e) {
    return { ok: false, stopReason: null, content: [], error: e instanceof Error ? e.message : "خطأ في نداء Anthropic" };
  }
}
