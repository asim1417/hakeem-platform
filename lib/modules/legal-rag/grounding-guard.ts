import type { LegalContext } from "./context-builder";

// طبقة منع الهلوسة: لا إجابة بلا مصدر، ولا مادة/حكم/مبدأ غير موجود.

export const GROUNDING_FALLBACK = "لا توجد مصادر قانونية كافية للإجابة بثقة.";
// يُستعمل حين توجد مصادر (مثل أحكام مرتبطة) لكن لا نصّ نظامي صريح يسند الإجابة.
export const NO_EXPLICIT_TEXT = "لا يوجد نص صريح في المصادر المتاحة.";
export const MIN_SOURCES = 1;
export const MIN_CONFIDENCE = 0.4;

/** هل في السياق إسناد كافٍ للإجابة بثقة؟ */
export function hasSufficientGrounding(context: LegalContext): boolean {
  const total = context.articles.length + context.rulings.length + context.principles.length;
  return total >= MIN_SOURCES && context.confidence >= MIN_CONFIDENCE;
}

/** تعليمات النظام التي تُلزم النموذج بالإسناد وتمنع الاختلاق. */
export function buildGroundingSystemPrompt(): string {
  return [
    "أنت محلّل قانوني سعودي منضبط بالمصادر. أجب **فقط** من «المصادر القانونية المرفقة» أدناه، ولا تستعمل معرفة خارجها.",
    "قواعد إلزامية:",
    "- لكل معلومة اذكر مصدرها صراحةً: اسم النظام + رقم المادة، أو رقم الحكم، أو اسم المبدأ القضائي.",
    "- يُمنع قول «وفق النظام» دون تحديد اسم النظام ورقم المادة.",
    "- يُمنع قول «استقر القضاء» دون رقم حكم أو اسم مبدأ قضائي.",
    "- الأحكام القضائية سوابق ومؤيِّدات للاتجاه القضائي فقط، وليست أساساً نظامياً؛ لا تقدّم حكماً قضائياً على أنه نصّ نظامي.",
    "- اربط كل استنتاج بمصدره من المصادر المرفقة (المسترجعة من قاعدة حكيم)، ولا تستشهد بأي مصدر خارجها.",
    "- لا تختلق مادة أو حكماً أو مبدأً غير موجود في المصادر المرفقة.",
    `- إن وُجدت مصادر لكن بلا نصّ نظامي صريح يسند الإجابة فاكتب: «${NO_EXPLICIT_TEXT}»`,
    `- إن لم تكفِ المصادر للإجابة بثقة فاكتب حرفياً: «${GROUNDING_FALLBACK}»`,
    "اكتب إجابة عربية موجزة ومنضبطة، كل جملة فيها قابلة للإسناد إلى مصدر مرفق.",
  ].join("\n");
}

/** بناء رسالة المستخدم: السؤال + المصادر المرقّمة لإلزام الإسناد. */
export function buildGroundedUserPrompt(question: string, context: LegalContext): string {
  const lines: string[] = [`السؤال القانوني: ${question}`, "", "المصادر القانونية المرفقة:"];

  if (context.articles.length) {
    lines.push("\n[المواد النظامية]");
    context.articles.slice(0, 6).forEach((a, i) =>
      lines.push(`A${i + 1}) ${a.lawName} — المادة (${a.articleNumber}): ${a.content.slice(0, 400)}`)
    );
  }
  if (context.rulings.length) {
    lines.push("\n[الأحكام القضائية]");
    context.rulings.slice(0, 5).forEach((r, i) =>
      lines.push(`R${i + 1}) حكم ${r.decisionNo ?? r.caseNo ?? r.id}: ${r.text.slice(0, 300)}`)
    );
  }
  if (context.principles.length) {
    lines.push("\n[المبادئ القضائية]");
    context.principles.slice(0, 5).forEach((p, i) => lines.push(`P${i + 1}) ${p.title}: ${p.text.slice(0, 300)}`));
  }

  lines.push("\nاكتب الإجابة معتمداً على هذه المصادر فقط، مع الإشارة لمراجعها.");
  return lines.join("\n");
}
