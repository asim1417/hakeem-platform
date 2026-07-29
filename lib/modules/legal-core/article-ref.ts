// ─────────────────────────────────────────────────────────────────────────────
// مرجع «الديباجة» في النواة — دعم ديباجة/مرسوم كلّ نظام كمحتوًى قابلٍ للبحث والاستشهاد.
//
// القرار المعماريّ: تُخزَّن الديباجة **مادّةً رقمها صفر** (articleNumber = 0) في جدول
// legal_articles نفسه، بعنوان «الديباجة». بهذا تركب خطّ الأنابيب القائم كاملًا بلا هجرة سكيمة:
// البحث المعجميّ والدلاليّ (embeddings) والاسترجاع والاستشهاد وأدوات الوكيل — كلّها تعمل تلقائيًّا،
// لأنّ الديباجة صارت «مادّة». الفرق الوحيد: عند العرض نُظهر «الديباجة» لا «المادة ٠».
//
// حارس الإسناد يتجاهل الرقم صفر أصلًا (يشترط n>0)، فلا تعارض مع تأريض أرقام المواد.
// ─────────────────────────────────────────────────────────────────────────────

/** رقم المادة المخصَّص للديباجة (تمهيد النظام/المرسوم) — ليست مادّةً موضوعيّة مرقّمة. */
export const PREAMBLE_ARTICLE_NUMBER = 0;

/** العنوان القياسيّ لمادّة الديباجة. */
export const PREAMBLE_TITLE = "الديباجة";

/** هل هذا الرقم يمثّل ديباجةً (لا مادّةً موضوعيّة)؟ */
export function isPreamble(articleNumber: number | string | null | undefined): boolean {
  return Number(articleNumber) === PREAMBLE_ARTICLE_NUMBER;
}

/** وحدة الإشارة: «الديباجة» للرقم صفر، وإلّا «المادة {رقم}» (بأرقامٍ عربيّة). */
export function articleUnitLabel(articleNumber: number | string | null | undefined): string {
  if (isPreamble(articleNumber)) return PREAMBLE_TITLE;
  const n = typeof articleNumber === "number" ? articleNumber : Number(articleNumber);
  const shown = Number.isFinite(n) ? n.toLocaleString("ar-SA") : String(articleNumber ?? "");
  return `المادة ${shown}`;
}

/**
 * مرجع استنادٍ كامل: «{النظام}{sep}{الوحدة}». sep الافتراضيّ «، » (فاصلة عربيّة) كما في
 * buildSingleCitationLabel؛ ومرّر « · » لصيغة الحواشي.
 */
export function formatArticleRef(
  systemName: string | null | undefined,
  articleNumber: number | string | null | undefined,
  sep: string = "، "
): string {
  const sys = (systemName ?? "").trim();
  const unit = articleUnitLabel(articleNumber);
  return sys ? `${sys}${sep}${unit}` : unit;
}
