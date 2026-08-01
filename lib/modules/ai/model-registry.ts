// واجهة سجلّ النماذج — §17. قراءة نقيّة فوق config/ai-models.ts (بلا آثار جانبية).
import { AI_MODEL_REGISTRY, type ModelEntry, type ModelTask } from "@/config/ai-models";
import type { AiProvider } from "@/lib/modules/ai/ai-config";

export type { ModelEntry, ModelTask } from "@/config/ai-models";

/** كل النماذج المسجّلة. */
export function listModels(): ModelEntry[] {
  return AI_MODEL_REGISTRY;
}

/** نموذج مزوّدٍ ونصّ محدّدان، إن وُجدا. */
export function getModel(provider: AiProvider, model: string): ModelEntry | null {
  return AI_MODEL_REGISTRY.find((m) => m.provider === provider && m.model === model) ?? null;
}

/**
 * النموذج الافتراضيّ المسجَّل لمزوّد — يُستعمل كطبقة وسطى في defaultModelFor.
 * يعيد null عند غياب تسجيل، فيسقط المستدعي إلى ثابته القديم (سلوكٌ مطابق).
 */
export function registryDefaultModel(provider: AiProvider): string | null {
  return AI_MODEL_REGISTRY.find((m) => m.provider === provider && m.isProviderDefault)?.model ?? null;
}

/** أفضل نموذج معتمد لمهمّة معيّنة لدى مزوّد (للحوكمة/التوجيه المستقبليّ). */
export function resolveModelForTask(provider: AiProvider, task: ModelTask): ModelEntry | null {
  const candidates = AI_MODEL_REGISTRY.filter(
    (m) => m.provider === provider && m.approvedTasks.includes(task)
  );
  if (candidates.length === 0) return null;
  return candidates.find((m) => m.isProviderDefault) ?? candidates[0];
}

/** هل هذا النموذج معتمدٌ لهذه المهمّة؟ (حوكمة §17). */
export function isTaskApproved(provider: AiProvider, model: string, task: ModelTask): boolean {
  return getModel(provider, model)?.approvedTasks.includes(task) ?? false;
}
