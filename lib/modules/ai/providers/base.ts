// الواجهة الموحّدة لمزوّدي الذكاء + مصنع يبني المزوّد من دالة إكمال واحدة.
// تفصل منطق التوجيه (legal-prompts) عن نداء الشبكة الخاص بكل مزوّد.
import {
  buildAnswerSystemPrompt,
  buildAnswerUserPrompt,
  buildReasoningSystemPrompt,
  buildReasoningUserPrompt,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  type LegalGenInput,
} from "../legal-prompts";

export type { LegalGenInput };

export interface AiProvider {
  name: string;
  model: string;
  available(): boolean;
  generateLegalAnswer(input: LegalGenInput): Promise<string>;
  summarizeLegalContext(input: LegalGenInput): Promise<string>;
  draftLegalReasoning(input: LegalGenInput): Promise<string>;
}

/** دالة الإكمال الخام لكل مزوّد: (تعليمات نظام، رسالة مستخدم، حد رموز) → نصّ. */
export type CompleteFn = (system: string, user: string, maxTokens: number) => Promise<string>;

/** يبني مزوّداً من دالة إكمال؛ كل خطأ يؤول إلى نصّ فارغ (سقوط منظم لا يكسر الخط). */
export function makeProvider(
  meta: { name: string; model: string; available: () => boolean },
  complete: CompleteFn
): AiProvider {
  const guarded: CompleteFn = async (system, user, maxTokens) => {
    try {
      return (await complete(system, user, maxTokens)).trim();
    } catch {
      return "";
    }
  };
  return {
    name: meta.name,
    model: meta.model,
    available: meta.available,
    generateLegalAnswer: (input) => guarded(buildAnswerSystemPrompt(), buildAnswerUserPrompt(input), 900),
    summarizeLegalContext: (input) => guarded(buildSummarySystemPrompt(), buildSummaryUserPrompt(input), 400),
    draftLegalReasoning: (input) => guarded(buildReasoningSystemPrompt(), buildReasoningUserPrompt(input), 700),
  };
}
