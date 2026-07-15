// ─────────────────────────────────────────────────────────────────────────────
// بوّابة النيّة (المرحلة ١) — تُستدعى **قبل أي بحث** فتحلّ خلل «السلام عليكم → مواد عشوائية».
// نواة حتمية سريعة (بلا نداء نموذج، تعمل دون اتصال) تكفي لحالات القبول؛ مع خطّاف اختياري
// لتصنيف النموذج (few-shot) للحالات الغامضة لاحقًا. لا تلمس الأمن ولا المصادقة ولا المحرّك.
// ─────────────────────────────────────────────────────────────────────────────
import type { IntentResult, IntentType } from "./types";

/** تطبيع عربي خفيف: يوحّد الألف/الياء/التاء المربوطة ويزيل التشكيل — لمطابقة أمتن. */
function normalize(s: string): string {
  return (s || "")
    .replace(/[ً-ْٰ]/g, "") // تشكيل
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const GREETING = [
  "السلام عليكم", "سلام عليكم", "وعليكم السلام", "السلام", "مرحبا", "اهلا", "هلا", "هلو", "هاي",
  "صباح الخير", "مساء الخير", "صباح النور", "مساء النور", "تحيه طيبه", "حياك", "حياكم", "يعطيك العافيه",
];
const THANKS = ["شكرا", "مشكور", "يعطيك العافيه", "جزاك الله", "جزاكم الله", "تسلم", "ممتن", "بارك الله فيك", "احسنت"];
const META = [
  "من انت", "ما انت", "وش انت", "مين انت", "ما هو حكيم", "من هو حكيم", "عرف بنفسك", "عرف نفسك",
  "ماذا تفعل", "ايش تسوي", "وش تسوي", "كيف تعمل", "ماذا تستطيع", "وش تقدر", "قدراتك", "ماذا تقدم",
  "كيف استخدمك", "كيف اسالك", "ما فائدتك",
];
// إشارات قانونية: أرقام مواد + أسماء أنظمة + مصطلحات تقاضٍ شائعة (قائمة واسعة، ليست حصرية).
const LEGAL_MARKERS = [
  "ماده", "مادة", "نظام", "لائحه", "مرسوم", "قرار", "عقد", "دعوى", "دعوي", "محكمه", "قاضي", "حكم", "التزام",
  "اثبات", "تعويض", "فسخ", "بطلان", "طلاق", "حضانه", "نفقه", "ميراث", "ارث", "وصيه", "عقوبه", "جريمه", "جزائي",
  "ايجار", "شركه", "شركات", "تحكيم", "استئناف", "نقض", "تمييز", "دفع", "مطالبه", "غرامه", "كفاله", "رهن", "حصص",
  "اسهم", "افلاس", "تصفيه", "عمل", "عامل", "موظف", "اجازه", "فصل تعسفي", "انهاء", "تعاقد", "التزامات", "حقوق",
  "مسؤوليه", "ضمان", "صوري", "توثيق", "اعتراض", "تنفيذ", "شرط جزائي", "بيع", "هبه", "شفعه", "ارتفاق", "قانون",
];
const NON_LEGAL = ["طبخ", "وصفه", "طقس", "الجو", "كوره", "رياضه", "مباراه", "فيلم", "مسلسل", "اغنيه", "سفر", "مطعم", "وزن", "رجيم", "برمجه"];

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

const REPLIES: Record<Exclude<IntentType, "legal_question">, string> = {
  greeting: "وعليكم السلام ورحمة الله، كيف أساعدك في مسألتك القانونية؟",
  thanks: "العفو، سعدتُ بخدمتك. هل لديك سؤال قانوني آخر؟",
  meta: "أنا حكيم، مساعدك في الأنظمة السعودية: أبحث في النواة القانونية الموثّقة وأجيب باستشهادٍ صريح للمواد دون تلفيق. اطرح سؤالك القانوني (مثال: «ما مدة إشعار إنهاء عقد العمل غير محدّد المدة؟»).",
  non_legal: "أعتذر، تخصّصي الأنظمة السعودية والمسائل القانونية فقط. اطرح سؤالًا قانونيًا وسأبحث لك في النصوص الموثّقة.",
  ambiguous: "لم يتّضح لي سؤالك تمامًا. صِف مسألتك القانونية بجملة واضحة (مثال: «ما شروط فسخ عقد الإيجار؟»).",
};

function greetingReply(n: string): string {
  return n.includes("سلام") ? REPLIES.greeting : "أهلًا وسهلًا، كيف أساعدك في مسألتك القانونية؟";
}

/**
 * يصنّف نيّة المدخل حتميًّا (سريع، دون اتصال). القاعدة الحاكمة: أي إشارة قانونية حقيقية
 * (رقم مادة/اسم نظام/مصطلح تقاضٍ) **تمرّ للبحث** ولو سبقتها تحية — فلا نحجب سؤالًا قانونيًا.
 */
export function classifyIntent(input: string): IntentResult {
  const raw = (input || "").trim();
  const n = normalize(raw);
  const words = n.split(" ").filter(Boolean);

  if (!n) return { type: "ambiguous", confidence: 1, reply: REPLIES.ambiguous, source: "deterministic" };

  const hasLegal = /\d{1,4}/.test(n) || includesAny(n, LEGAL_MARKERS);

  // إشارة قانونية موجودة → يمرّ للبحث فورًا (حتى لو بدأ بتحية).
  if (hasLegal) return { type: "legal_question", confidence: 0.9, source: "deterministic" };

  // meta: سؤال عن حكيم نفسه.
  if (includesAny(n, META)) return { type: "meta", confidence: 0.85, reply: REPLIES.meta, source: "deterministic" };

  // شكر خالص (قصير) — نتحقّق قبل التحية لأن «يعطيك العافية» مشترك.
  if (includesAny(n, THANKS) && words.length <= 5) return { type: "thanks", confidence: 0.85, reply: REPLIES.thanks, source: "deterministic" };

  // تحية خالصة (قصيرة، بلا إشارة قانونية).
  if (includesAny(n, GREETING) && words.length <= 6) {
    return { type: "greeting", confidence: 0.9, reply: greetingReply(n), source: "deterministic" };
  }

  // خارج النطاق القانوني بإشارة واضحة.
  if (includesAny(n, NON_LEGAL)) return { type: "non_legal", confidence: 0.7, reply: REPLIES.non_legal, source: "deterministic" };

  // بلا إشارة قانونية ولا غير-قانونية واضحة: القصير جدًا غامض؛ وإلا نمرّره للبحث (منصّة قانونية).
  if (words.length <= 2) return { type: "ambiguous", confidence: 0.5, reply: REPLIES.ambiguous, source: "deterministic" };
  return { type: "legal_question", confidence: 0.5, source: "deterministic" };
}

/** هل النيّة تستدعي بحثًا؟ (legal_question فقط؛ الباقي يُردّ عليه مباشرةً بلا بحث.) */
export function intentNeedsSearch(type: IntentType): boolean {
  return type === "legal_question";
}
