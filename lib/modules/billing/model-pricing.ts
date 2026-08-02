// تسعير النماذج وحساب تكلفة المزوّد الفعلية — HKM-BILLING-UX-001 (§6، المرحلة A).
// تكلفة داخلية لقياس الربحية فقط (لا تُعرض للمستخدم العادي). بالـ micros USD (عدد صحيح).
// المصدر: جدول billing_model_prices (مؤرّخ)، مع سقوط إلى بذور config/billing-plans.

import { SEED_MODEL_PRICES } from "@/config/billing-plans";

/** استخدام توكنات كامل من ردّ Anthropic. */
export interface TokenUsageFull {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  webSearchCount: number;
}

/** أسعار نموذج (USD لكل مليون توكن؛ web search لكل طلب). */
export interface ModelRate {
  provider: string;
  model: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cacheWriteUsdPerMillion: number;
  cacheReadUsdPerMillion: number;
  webSearchUsdPerRequest: number;
}

const MICROS_PER_USD = 1_000_000;

/**
 * حساب تكلفة المزوّد بالـ micros USD (عدد صحيح، لا كسور عائمة للتخزين).
 * cost = Σ(tokens / 1e6 × ratePerMillion) + webSearchCount × ratePerRequest.
 */
export function computeProviderCostMicrosUsd(usage: TokenUsageFull, rate: ModelRate): number {
  const usd =
    (Math.max(0, usage.inputTokens) / 1_000_000) * rate.inputUsdPerMillion +
    (Math.max(0, usage.outputTokens) / 1_000_000) * rate.outputUsdPerMillion +
    (Math.max(0, usage.cacheCreationTokens) / 1_000_000) * rate.cacheWriteUsdPerMillion +
    (Math.max(0, usage.cacheReadTokens) / 1_000_000) * rate.cacheReadUsdPerMillion +
    Math.max(0, usage.webSearchCount) * rate.webSearchUsdPerRequest;
  return Math.round(usd * MICROS_PER_USD);
}

/** استخراج الاستخدام الكامل من كائن usage الخاص بـ Anthropic (بأمان). */
export function extractAnthropicUsage(usage: unknown): TokenUsageFull {
  const u = (usage || {}) as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const serverTool = (u.server_tool_use || {}) as Record<string, unknown>;
  return {
    inputTokens: num(u.input_tokens),
    outputTokens: num(u.output_tokens),
    cacheCreationTokens: num(u.cache_creation_input_tokens),
    cacheReadTokens: num(u.cache_read_input_tokens),
    webSearchCount: num(serverTool.web_search_requests) || num(u.web_search_requests),
  };
}

/** سقوط افتراضي إن لم يوجد سعر (يتجنّب صفر تكلفة صامت). */
const DEFAULT_RATE: ModelRate = {
  provider: "anthropic",
  model: "unknown",
  inputUsdPerMillion: 3,
  outputUsdPerMillion: 15,
  cacheWriteUsdPerMillion: 3.75,
  cacheReadUsdPerMillion: 0.3,
  webSearchUsdPerRequest: 0.01,
};

/** مطابقة مرنة لاسم النموذج مع بذور الأسعار. */
export function resolveSeedRate(model: string): ModelRate {
  const m = (model || "").toLowerCase();
  const exact = SEED_MODEL_PRICES.find((p) => p.model.toLowerCase() === m);
  if (exact) return { ...exact };
  // مطابقة بالعائلة (opus/sonnet/haiku).
  const family = m.includes("opus") ? "opus" : m.includes("haiku") ? "haiku" : m.includes("sonnet") ? "sonnet" : "";
  if (family) {
    const byFamily = SEED_MODEL_PRICES.find((p) => p.model.toLowerCase().includes(family));
    if (byFamily) return { ...byFamily, model };
  }
  return { ...DEFAULT_RATE, model: model || "unknown" };
}

/**
 * جلب سعر النموذج الفعّال من billing_model_prices، مع السقوط إلى البذور.
 * لا يكسر مسار الذكاء إن غاب الجدول.
 */
export async function getModelRate(model: string, provider = "anthropic"): Promise<ModelRate> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "provider","model","input_usd_per_million" AS input, "output_usd_per_million" AS output,
              "cache_write_usd_per_million" AS cw, "cache_read_usd_per_million" AS cr,
              "web_search_usd_per_request" AS ws
         FROM "billing_model_prices"
        WHERE "provider" = $1 AND "model" = $2 AND "is_active" = true
          AND ("effective_to" IS NULL OR "effective_to" > NOW())
        ORDER BY "effective_from" DESC
        LIMIT 1`,
      provider,
      model
    )) as Array<{ input: number; output: number; cw: number; cr: number; ws: number }>;
    if (rows.length) {
      const r = rows[0];
      return {
        provider,
        model,
        inputUsdPerMillion: Number(r.input),
        outputUsdPerMillion: Number(r.output),
        cacheWriteUsdPerMillion: Number(r.cw),
        cacheReadUsdPerMillion: Number(r.cr),
        webSearchUsdPerRequest: Number(r.ws),
      };
    }
  } catch {
    /* الجدول غير موجود بعد — سقوط للبذور */
  }
  return resolveSeedRate(model);
}

/** تكلفة كاملة من الاستخدام واسم النموذج (يجمع الجلب والحساب). */
export async function costFromUsage(
  usage: TokenUsageFull,
  model: string,
  provider = "anthropic"
): Promise<{ rate: ModelRate; costMicrosUsd: number }> {
  const rate = await getModelRate(model, provider);
  return { rate, costMicrosUsd: computeProviderCostMicrosUsd(usage, rate) };
}
