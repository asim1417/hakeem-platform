/**
 * أعلام أداة الوثائق (‏/documents/tool) — مطفأة افتراضيًا.
 *
 * تُشغَّل extract.ts في المتصفح، فيجب أن يكون علم العميل NEXT_PUBLIC_ ويُشار إليه
 * كثابتٍ حرفيّ لا كبحثٍ ديناميكيّ process.env[name] — إذ لا يُضمّن Next.js في حزمة
 * المتصفح إلا الإشارات الحرفيّة الثابتة.
 */

function on(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

/**
 * توجيه OCR على مستوى الصفحة في أداة الوثائق: تُقرأ الصفحات النظيفة من طبقة النصّ،
 * ولا تُرسل إلى OCR إلا الصفحات الفارغة/المعطوبة/المُفسَدة دلاليًّا — بدل قرارٍ واحدٍ
 * على مستوى المستند يُرسِل الكتاب كلّه إلى OCR لأجل صفحةٍ واحدةٍ رديئة.
 *
 * مطفأ افتراضيًا؛ عند الإطفاء يبقى السلوك القديم كما هو تمامًا.
 */
export function isPageLevelOcrV1Enabled(): boolean {
  return on(process.env.NEXT_PUBLIC_HAKEEM_PAGE_LEVEL_OCR_V1);
}
