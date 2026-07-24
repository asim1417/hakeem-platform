/**
 * راية: الصفحة الرئيسية تتمحور حول «اسأل حكيم».
 * التعطيل: NEXT_PUBLIC_ASK_FIRST_HOME=0 أو ASK_FIRST_HOME_ENABLED=0
 * الافتراضي: مفعّل.
 * عند التعطيل تعود واجهة العمل السابقة دون فقد بيانات.
 */
export function isAskFirstHomeEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_ASK_FIRST_HOME;
  if (pub === "0") return false;
  if (pub === "1") return true;
  if (typeof window === "undefined") {
    const srv = process.env.ASK_FIRST_HOME_ENABLED;
    if (srv === "0") return false;
    if (srv === "1") return true;
  }
  return true;
}

/** بعد الدخول: نفّذ السؤال مرة واحدة تلقائيًا (لا يُوضع نص الواقعة في URL) */
export const HOME_ASK_PENDING_RUN_KEY = "hakeem-home-ask-pending-run";

/** حفظ جلسة المحادثة محليًا داخل المتصفح */
export const HOME_ASK_SESSION_KEY = "hakeem-home-ask-session";

/** تسليم سياق السؤال لإنشاء قضية في المعاون */
export const ASK_TO_CASE_HANDOFF_KEY = "hakeem-ask-to-case";

export const ASK_FIRST_SUGGESTIONS = [
  "حلّل لي هذه الواقعة",
  "ما الإجراء النظامي المناسب؟",
  "لخّص هذا المستند",
  "ابحث عن النصوص ذات الصلة",
  "رتّب دفوعي القانونية",
  "بيّن نقاط القوة والضعف",
] as const;
