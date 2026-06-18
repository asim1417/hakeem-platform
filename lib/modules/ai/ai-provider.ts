// طبقة المزوّد الموحّدة: تختار مزوّداً واحداً حسب AI_PROVIDER، وتسقط سقوطاً
// منظّماً إلى مزوّد المحاكاة (mock) عند غياب الاختيار أو المفتاح — فلا يكسر
// الخط أو الصفحة أو الـ API أبداً.
import { createClaudeProvider } from "./providers/claude-provider";
import { createGeminiProvider } from "./providers/gemini-provider";
import { createMockProvider } from "./providers/mock-provider";
import { createOpenAiProvider } from "./providers/openai-provider";
import type { AiProvider } from "./providers/base";

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
