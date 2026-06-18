// قوالب التوجيه القانوني للمرحلة الخامسة: تُبنى فوق حارس الإسناد (grounding-guard)
// لتُلزم المزوّد بإجابة عربية مُسنَدة، منسّقة في ثلاثة أقسام ثابتة يقرؤها المُركّب.
import type { LegalContext } from "@/lib/modules/legal-rag/context-builder";
import { buildGroundingSystemPrompt, buildGroundedUserPrompt } from "@/lib/modules/legal-rag/grounding-guard";

// عناوين الأقسام الثابتة — يعتمد عليها legal-answer-composer في التحليل.
export const SECTION_SHORT = "### الجواب المختصر";
export const SECTION_ANALYSIS = "### التحليل النظامي";
export const SECTION_LIMITATIONS = "### التحفظات";

export interface LegalGenInput {
  question: string;
  context: LegalContext;
}

/** تعليمات النظام للإجابة الكاملة: إسناد صارم + تنسيق الأقسام الثلاثة. */
export function buildAnswerSystemPrompt(): string {
  return [
    buildGroundingSystemPrompt(),
    "",
    "نسّق إجابتك حصراً بهذه الأقسام الثلاثة، كلٌّ بعنوانه كما هو وبهذا الترتيب:",
    SECTION_SHORT,
    "جملة أو جملتان تجيبان السؤال مباشرةً مع الإشارة لأبرز مصدر (نظام/مادة أو حكم أو مبدأ).",
    SECTION_ANALYSIS,
    "تحليل نظامي موجز، كل نقطة فيه مقرونة بمصدرها (اسم النظام + رقم المادة، أو رقم الحكم، أو اسم المبدأ).",
    SECTION_LIMITATIONS,
    "حدود الإجابة وما لا تغطّيه المصادر المرفقة، بإيجاز.",
  ].join("\n");
}

/** تعليمات النظام للتلخيص فقط (سياق → ملخّص مُسنَد). */
export function buildSummarySystemPrompt(): string {
  return [
    buildGroundingSystemPrompt(),
    "",
    "لخّص المصادر المرفقة في فقرة عربية واحدة موجزة، كل جملة فيها مقرونة بمصدرها الصريح، دون استنتاجات خارج النص.",
  ].join("\n");
}

/** تعليمات النظام لصياغة التسبيب القانوني. */
export function buildReasoningSystemPrompt(): string {
  return [
    buildGroundingSystemPrompt(),
    "",
    "اكتب تسبيباً قانونياً متسلسلاً (مقدمات ← نتيجة)، كل خطوة مستندة إلى مصدر مرفق صراحةً، بلا تعميمات غير مُسنَدة.",
  ].join("\n");
}

export function buildAnswerUserPrompt(input: LegalGenInput): string {
  return buildGroundedUserPrompt(input.question, input.context);
}

export function buildSummaryUserPrompt(input: LegalGenInput): string {
  return buildGroundedUserPrompt(input.question, input.context);
}

export function buildReasoningUserPrompt(input: LegalGenInput): string {
  return buildGroundedUserPrompt(input.question, input.context);
}
