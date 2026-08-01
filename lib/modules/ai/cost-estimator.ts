// تقدير تكلفة الاستدعاء — المخطط السيادي §17. نواة نقيّة فوق سجلّ النماذج.
// يكمّل عدّاد الرموز القائم (ai-usage-meter) بتقدير تكلفة نقديّة لكل مزوّد.

import { getModel } from "@/lib/modules/ai/model-registry";
import type { AiProvider } from "@/lib/modules/ai/ai-config";

export interface CostEstimate {
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null; // null إن لم يُسجَّل النموذج
  currency: "USD";
}

/** يقدّر تكلفة استدعاء من عدد الرموز وأسعار النموذج المسجّلة. */
export function estimateCost(
  provider: AiProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): CostEstimate {
  const entry = getModel(provider, model);
  let costUsd: number | null = null;
  if (entry) {
    const cost =
      (inputTokens / 1000) * entry.cost.inputPer1k +
      (outputTokens / 1000) * entry.cost.outputPer1k;
    costUsd = Math.round(cost * 1e6) / 1e6; // 6 منازل
  }
  return { provider, model, inputTokens, outputTokens, costUsd, currency: "USD" };
}
