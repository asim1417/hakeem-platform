/**
 * محتوى «العرض الحي» في الرئيسية — سؤال واحد وجوابه.
 *
 * لا يُنشر إلا بعد مراجعة المالك لنصه: المكوّن خلف HOME_LIVE_DEMO_ENABLED (معطّل افتراضيًا).
 * نص المادة لا يُكتب هنا يدويًا: يُسحب بلفظه من مدونة حكيم (data/legal_articles_export.json)
 * عبر loadLiveDemoArticle() في الخادم، ولا يظهر العرض إن لم يوجد النص في المدونة.
 */

export type LiveDemoArticleRef = {
  /** اسم النظام كما في المدونة */
  lawName: string;
  articleNumber: number;
};

export type LiveDemoChip = {
  /** نص الشارة على سطح المكتب */
  label: string;
  /** نص مختصر على الجوال (م 107) */
  short: string;
  /** مرجع غير موجود في المدونة — يُراجع قبل التفعيل */
  needsOwnerReview?: boolean;
};

export const LIVE_DEMO_ARTICLE: LiveDemoArticleRef = {
  lawName: "نظام المعاملات المدنية",
  articleNumber: 107,
};

export const LIVE_DEMO_QUESTION = "مستأجر تأخر في سداد الأجرة ثلاثة أشهر، هل يحق لي فسخ العقد وإخلاؤه؟";

export const LIVE_DEMO_STEPS = ["البحث في الأنظمة", "مطابقة الأحكام القضائية", "توسيع المصطلحات"] as const;

export const LIVE_DEMO_LINES = [
  "التأخر في سداد الأجرة إخلال من المستأجر بالتزامه في عقد ملزم للجانبين.",
  "يحق لك بعد إعذاره أن تطلب تنفيذ العقد أو فسخه، مع التعويض إن كان له مقتضٍ.",
  "للمحكمة أن ترفض الفسخ إن كان ما لم يوفَ به قليل الأهمية.",
  "وإن كان العقد موثقًا في منصة إيجار فهو سند تنفيذي يُنفَّذ أمام محكمة التنفيذ.",
] as const;

export const LIVE_DEMO_CHIPS: readonly LiveDemoChip[] = [
  { label: "نظام المعاملات المدنية — المادة 107", short: "نظام المعاملات المدنية — م 107" },
  {
    label: "قرار مجلس الوزراء رقم 131 وتاريخ 3/4/1435هـ",
    short: "قرار مجلس الوزراء 131 — 3/4/1435هـ",
    // سند السطر الرابع (عقد إيجار سند تنفيذي) — غير موجود في مدونة حكيم بعد
    needsOwnerReview: true,
  },
];

/** عدد الأحكام المشابهة من المدونة — null يخفي الشارة حتى يُضبط رقم حقيقي. */
export const LIVE_DEMO_SIMILAR_RULINGS: number | null = null;

export const LIVE_DEMO_DISCLAIMER = "عرض توضيحي — إجابات حكيم مسندة إلى نصوص المدونة";
export const LIVE_DEMO_DISCLAIMER_SHORT = "عرض توضيحي من مدونة حكيم";

export type LiveDemoArticle = { lawName: string; title: string; content: string; articleNumber: number };

/** كل ما يحتاجه المكوّن — يُجمع في الخادم ويمرَّر للعميل. */
export type LiveDemoPayload = {
  question: string;
  steps: readonly string[];
  lines: readonly string[];
  article: LiveDemoArticle;
  chips: readonly LiveDemoChip[];
  disclaimer: string;
  disclaimerShort: string;
};

export function buildLiveDemoPayload(article: LiveDemoArticle): LiveDemoPayload {
  const chips: LiveDemoChip[] = [...LIVE_DEMO_CHIPS];
  if (typeof LIVE_DEMO_SIMILAR_RULINGS === "number" && LIVE_DEMO_SIMILAR_RULINGS > 0) {
    chips.push({
      label: `أحكام مشابهة — ${LIVE_DEMO_SIMILAR_RULINGS.toLocaleString("ar-SA")}`,
      short: `أحكام مشابهة — ${LIVE_DEMO_SIMILAR_RULINGS.toLocaleString("ar-SA")}`,
    });
  }
  return {
    question: LIVE_DEMO_QUESTION,
    steps: LIVE_DEMO_STEPS,
    lines: LIVE_DEMO_LINES,
    article,
    chips,
    disclaimer: LIVE_DEMO_DISCLAIMER,
    disclaimerShort: LIVE_DEMO_DISCLAIMER_SHORT,
  };
}
