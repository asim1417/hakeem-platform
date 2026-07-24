/**
 * راية: تنفيذ «اسأل حكيم» داخل الصفحة الرئيسية دون تحويل إلى /dashboard/ask.
 * التعطيل الطارئ: NEXT_PUBLIC_HOME_INLINE_ASK=0 أو HOME_INLINE_ASK_ENABLED=0
 * الافتراضي: مفعّل.
 */
export function isHomeInlineAskEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_HOME_INLINE_ASK;
  if (pub === "0") return false;
  if (pub === "1") return true;
  if (typeof window === "undefined") {
    const srv = process.env.HOME_INLINE_ASK_ENABLED;
    if (srv === "0") return false;
    if (srv === "1") return true;
  }
  return true;
}

/** حد طول السؤال متوافق مع /api/ai/agent-search */
export const HAKEEM_ASK_MAX_CHARS = 8000;

export const HOME_ASK_DRAFT_KEY = "hakeem-home-ask-draft";
export const HOME_ASK_HANDOFF_KEY = "hakeem-home-ask-handoff";
