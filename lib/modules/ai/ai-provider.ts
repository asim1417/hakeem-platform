// طبقة المزوّد الموحّدة: تختار مزوّداً واحداً حسب AI_PROVIDER، وتسقط سقوطاً
// منظّماً إلى مزوّد المحاكاة (mock) عند غياب الاختيار أو المفتاح — فلا يكسر
// الخط أو الصفحة أو الـ API أبداً.
import { createClaudeProvider } from "./providers/claude-provider";
import { createGeminiProvider } from "./providers/gemini-provider";
import { createMockProvider } from "./providers/mock-provider";
import { createOpenAiProvider } from "./providers/openai-provider";
import { makeProvider, type AiProvider } from "./providers/base";
import { resolveAiConfig, completeWithConfig, defaultModelFor } from "./ai-config";

export type { AiProvider };
export type { LegalGenInput } from "./legal-prompts";

/** يعيد المزوّد المختار، أو mock إن لم يُختَر مزوّد أو لم يتوفّر مفتاحه. */
export function getAiProvider(): AiProvider {
  const selected = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const mock = createMockProvider();

  let provider: AiProvider | null = null;
  switch (selected) {
    case "claude":
    case "anthropic":
      provider = createClaudeProvider();
      break;
    case "openai":
      provider = createOpenAiProvider();
      break;
    case "gemini":
      provider = createGeminiProvider();
      break;
    case "mock":
    case "offline":
    default:
      return mock;
  }

  // إن لم يتوفّر مفتاح المزوّد المختار → سقوط منظّم إلى mock.
  return provider.available() ? provider : mock;
}

/**
 * المزوّد الفعّال وفق إعدادات الموقع (DB من /admin/ai أولاً ثم البيئة) — غير متزامن.
 * تستعمله كل مسارات التوليد (Legal RAG + محرّكات التمايز) كي يكفي ضبط مفتاح واحد
 * من لوحة الإدارة لتفعيل الذكاء عبر المنصّة كاملةً. سقوط منظّم إلى mock عند offline/غياب المفتاح.
 */
export async function resolveAiProvider(): Promise<AiProvider> {
  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) return createMockProvider();
  return makeProvider(
    { name: cfg.provider, model: cfg.model || defaultModelFor(cfg.provider), available: () => true },
    (system, user, maxTokens) => completeWithConfig(cfg, system, user, maxTokens)
  );
}
