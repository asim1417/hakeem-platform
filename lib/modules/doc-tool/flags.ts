/**
 * أعلام أداة الوثائق (‏/documents/tool).
 *
 * تُشغَّل extract.ts في المتصفح، فيجب أن يكون علم العميل NEXT_PUBLIC_ ويُشار إليه
 * كثابتٍ حرفيّ لا كبحثٍ ديناميكيّ process.env[name] — إذ لا يُضمّن Next.js في حزمة
 * المتصفح إلا الإشارات الحرفيّة الثابتة.
 */

/** «مُفعَّل صراحةً»: القيمة من مجموعة الإيجاب. للأعلام الاختياريّة (الافتراض إطفاء). */
function on(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

/** «مُفعَّل ما لم يُطفأ صراحةً»: الافتراض تشغيل، مع مفتاح إيقافٍ طارئ عبر البيئة (0/off). */
function onUnlessDisabled(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return !(s === "0" || s === "false" || s === "off" || s === "no");
}

/**
 * توجيه OCR على مستوى الصفحة في أداة الوثائق: تُقرأ الصفحات النظيفة من طبقة النصّ،
 * ولا تُرسل إلى OCR إلا الصفحات الفارغة/المعطوبة/المُفسَدة دلاليًّا — بدل قرارٍ واحدٍ
 * على مستوى المستند يُرسِل الكتاب كلّه إلى OCR لأجل صفحةٍ واحدةٍ رديئة.
 *
 * مُفعَّل افتراضيًا (المسار نفسه مُجرَّبٌ في /documents/app). للإيقاف الطارئ:
 * NEXT_PUBLIC_HAKEEM_PAGE_LEVEL_OCR_V1=0 ثم إعادة نشر.
 */
export function isPageLevelOcrV1Enabled(): boolean {
  return onUnlessDisabled(process.env.NEXT_PUBLIC_HAKEEM_PAGE_LEVEL_OCR_V1);
}

/**
 * ذاكرة القراءة الضوئية بمفتاح البصمة: الصفحة المتطابقة (بيضاء/ترويسة/ختم مكرّر أو
 * إعادة رفع الملف نفسه) تُستردّ فورًا بلا نداءٍ سحابيّ.
 *
 * مُفعَّلة افتراضيًا (تحسينٌ صرفٌ آمن). للإيقاف الطارئ:
 * NEXT_PUBLIC_HAKEEM_OCR_CACHE_V1=0 ثم إعادة نشر.
 */
export function isOcrCacheV1Enabled(): boolean {
  return onUnlessDisabled(process.env.NEXT_PUBLIC_HAKEEM_OCR_CACHE_V1);
}

/**
 * عرضٌ تدريجيّ للنصّ أثناء القراءة السحابية: تظهر الصفحات في المعاينة فور اكتمالها
 * (أوّل صفحة في ثانية) بدل انتظار الوثيقة كاملةً. لا يغيّر زمن المعالجة الكليّ ولا
 * الناتج النهائيّ — تحسينُ إحساسٍ بالسرعة فقط.
 *
 * يبقى اختياريًّا (مطفأ افتراضيًا): تغييرٌ واجهيّ يستحقّ تحقّقًا بصريًّا قبل التعميم.
 * للتفعيل: NEXT_PUBLIC_HAKEEM_OCR_STREAM_V1=1
 */
export function isOcrStreamV1Enabled(): boolean {
  return on(process.env.NEXT_PUBLIC_HAKEEM_OCR_STREAM_V1);
}
