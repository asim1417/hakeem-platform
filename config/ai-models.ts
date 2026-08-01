// سجلّ النماذج — المخطط السيادي §17 (Model Registry).
// بياناتٌ تصريحيّة تُثري ولا تُقيّد: القدرات، نافذة السياق، التكلفة، الخصوصية،
// والمهام المعتمدة لكل نموذج. مصدر حقيقة واحد بدل ثوابت متناثرة في الكود.

import type { AiProvider } from "@/lib/modules/ai/ai-config";

export type ModelPrivacy = "cloud" | "hybrid" | "local";
export type ModelTask =
  | "chat"
  | "deep-analysis"
  | "embedding"
  | "ocr"
  | "classification";

export interface ModelEntry {
  provider: AiProvider;
  model: string;
  /** نموذج المزوّد الافتراضيّ لهذا المزوّد (يطابق سلوك defaultModelFor القائم). */
  isProviderDefault?: boolean;
  contextWindow: number;
  cost: { inputPer1k: number; outputPer1k: number; currency: "USD" };
  privacy: ModelPrivacy;
  approvedTasks: ModelTask[];
  notes?: string;
}

// القيم الافتراضية هنا تُطابق ثوابت defaultModelFor القائمة — فلا يتغيّر أي سلوك.
export const AI_MODEL_REGISTRY: ModelEntry[] = [
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet-latest",
    isProviderDefault: true,
    contextWindow: 200_000,
    cost: { inputPer1k: 0.003, outputPer1k: 0.015, currency: "USD" },
    privacy: "cloud",
    approvedTasks: ["chat", "deep-analysis"],
    notes: "النموذج الحواريّ/التحليليّ الأساسيّ للمنصّة.",
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    isProviderDefault: true,
    contextWindow: 128_000,
    cost: { inputPer1k: 0.00015, outputPer1k: 0.0006, currency: "USD" },
    privacy: "cloud",
    approvedTasks: ["chat", "classification"],
  },
  {
    provider: "custom",
    model: "gpt-4o-mini",
    isProviderDefault: true,
    contextWindow: 128_000,
    cost: { inputPer1k: 0, outputPer1k: 0, currency: "USD" },
    privacy: "hybrid",
    approvedTasks: ["chat"],
    notes: "مزوّد متوافق مع OpenAI عبر CUSTOM_AI_BASE_URL — قد يكون محليًّا.",
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    isProviderDefault: true,
    contextWindow: 1_000_000,
    cost: { inputPer1k: 0.000075, outputPer1k: 0.0003, currency: "USD" },
    privacy: "cloud",
    approvedTasks: ["chat", "ocr"],
  },
];
