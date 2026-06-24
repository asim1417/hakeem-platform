/**
 * content-separation.ts — ضوابط الفصل بين النص النظامي والمحتوى المساند.
 *
 * مبدأ حاكم: لا يجوز خلط النص الفقهي/المساند بالنص النظامي. هذه الثوابت
 * والدوال تضمن أن كل إسناد فقهي يحمل تنبيه «غير ملزم» وأن صيغ الإسناد
 * النظامية والفقهية متمايزة بنيويًا (يتحقّق منها اختبار الوحدة).
 */

export const STATUTORY_LABEL = "النص النظامي الرسمي";

export const FIQH_NONBINDING_NOTICE =
  "هذه النصوص فقهية مساندة للفهم والتأصيل، ولا تُعدّ بديلاً عن النص النظامي ولا مصدرًا ملزمًا بذاتها.";

/** صيغة إسناد فقهي تحمل دائمًا تنويه عدم الإلزام (تمييزًا عن النظامي). */
export function buildFiqhCitation(title: string, reference: string): string {
  return `${title} — مواءمة موضوعية مع ${reference}، تأصيل مساند غير ملزم ولا يعد نصًا نظاميًا.`;
}

/** هل النصّ إسناد فقهي مساند (يحمل تنويه عدم الإلزام)؟ */
export function isFiqhCitation(s: string): boolean {
  return /غير ملزم|لا يعد نصًا نظاميًا|مساند/.test(s);
}

/** هل النصّ إسناد نظامي رسمي (مادة + نظام، بلا تنويه عدم إلزام)؟ */
export function isStatutoryCitation(s: string): boolean {
  return /المادة\s*\(/.test(s) && !isFiqhCitation(s);
}

/**
 * يتحقّق من عدم خلط الإسنادين: النظامي نظاميٌّ صرف، والفقهي مساندٌ موسوم،
 * وهما متمايزان. يُستخدم في اختبار منع الخلط.
 */
export function assertSeparated(statutory: string, fiqh: string): boolean {
  return isStatutoryCitation(statutory) && isFiqhCitation(fiqh) && !isStatutoryCitation(fiqh) && statutory !== fiqh;
}
