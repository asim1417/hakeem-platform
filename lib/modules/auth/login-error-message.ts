const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_oauth_state: "انتهت محاولة الدخول أو تعذّر التحقق منها. أعد المحاولة.",
  google_profile_failed: "تعذّر قراءة بيانات الحساب من Google. أعد المحاولة.",
  session_establish_failed: "تم التحقق من الحساب، لكن تعذّر فتح جلسة حكيم. أعد المحاولة.",
  google_not_configured: "الدخول باستخدام Google غير متاح مؤقتًا.",
};

/** رسالة عربية مختصرة وآمنة لأخطاء OAuth المعروفة. */
export function loginErrorMessage(code?: string | null): string | undefined {
  const normalized = (code || "").trim();
  if (!normalized) return undefined;
  return LOGIN_ERROR_MESSAGES[normalized] || "تعذّر إكمال الدخول. أعد المحاولة.";
}
