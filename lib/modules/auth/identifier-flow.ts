/**
 * منطق نموذج الدخول العربي (بريد / جوال برمز) — خالٍ من Clerk ليُختبر وحده.
 * الواجهة في components/auth/AuthIdentifierFlowInner.tsx تستدعي Clerk وتعتمد على هذه الدوال.
 */

export type ParsedIdentifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string }
  | { kind: "invalid"; message: string };

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** يحوّل الأرقام العربية الهندية والفارسية إلى لاتينية — لوحة المفاتيح العربية تكتبها افتراضيًا. */
export function toLatinDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) {
      out += String(a);
      continue;
    }
    const e = EASTERN_ARABIC_INDIC.indexOf(ch);
    out += e >= 0 ? String(e) : ch;
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * جوال سعودي بأي صيغة شائعة ← E.164:
 * 05XXXXXXXX · 5XXXXXXXX · 9665XXXXXXXX · +9665XXXXXXXX · 009665XXXXXXXX
 * وأي رقم دولي يبدأ بـ + أو 00 (8–15 رقمًا) يُقبل كما هو.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = toLatinDigits(raw).replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  const hadInternationalPrefix = cleaned.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (hadInternationalPrefix && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}

export function parseIdentifier(raw: string): ParsedIdentifier {
  const value = toLatinDigits(raw).trim();
  if (!value) return { kind: "invalid", message: "أدخل بريدك الإلكتروني أو رقم جوالك." };

  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL_RE.test(email)
      ? { kind: "email", value: email }
      : { kind: "invalid", message: "صيغة البريد الإلكتروني غير صحيحة." };
  }

  const phone = normalizePhone(value);
  if (phone) return { kind: "phone", value: phone };
  return {
    kind: "invalid",
    message: "أدخل رقم جوال صحيحًا مثل 05XXXXXXXX، أو بريدًا إلكترونيًا.",
  };
}

/** يخفي أغلب الرقم/البريد عند عرض «أرسلنا الرمز إلى…». */
export function maskIdentifier(id: { kind: "email" | "phone"; value: string }): string {
  if (id.kind === "phone") {
    const v = id.value;
    return `${v.slice(0, 4)} ••• ${v.slice(-3)}`;
  }
  const [user, domain] = id.value.split("@");
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}•••@${domain}`;
}

/** رمز التحقق: أرقام فقط (مع تحويل العربية)، حتى 8 خانات. */
export function sanitizeCode(raw: string): string {
  return toLatinDigits(raw).replace(/\D/g, "").slice(0, 8);
}

/** طول رموز Clerk (بريد/جوال/تطبيق مصادقة). */
export const CODE_LENGTH = 6;

/**
 * خانات الرمز المنفصلة: يوزّع ما كُتب أو لُصق على الخانات.
 * لصق رمز كامل في أي خانة يملأ من الأولى؛ وحرف واحد يملأ الخانة الحالية وينقل التركيز للتالية.
 */
export function fillCodeBoxes(
  current: ReadonlyArray<string>,
  index: number,
  raw: string,
  length: number = CODE_LENGTH
): { digits: string[]; focus: number } {
  const digits = Array.from({ length }, (_, i) => current[i] ?? "");
  const incoming = sanitizeCode(raw).slice(0, length);
  if (!incoming) {
    digits[index] = "";
    return { digits, focus: index };
  }
  let i = incoming.length >= length ? 0 : index;
  for (const ch of incoming) {
    if (i >= length) break;
    digits[i++] = ch;
  }
  return { digits, focus: Math.min(i, length - 1) };
}

// ── أخطاء Clerk ← رسائل عربية ──
// لا تكشف الرسائل إن كان البريد أو الرقم مسجّلًا (منع تعداد الحسابات).

type ClerkApiError = { code?: string; message?: string; longMessage?: string; meta?: { paramName?: string } };

export function clerkErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const list = (err as { errors?: ClerkApiError[] }).errors;
    if (Array.isArray(list) && list[0]?.code) return String(list[0].code);
  }
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 429) return "too_many_requests";
  }
  return "";
}

const ERROR_MESSAGES: Record<string, string> = {
  form_identifier_not_found: "تعذّرت المتابعة بهذا البريد أو الرقم. تحقّق منه وأعد المحاولة.",
  form_identifier_exists: "تعذّر استخدام هذا البريد أو الرقم هنا. تحقّق منه أو جرّب غيره.",
  form_code_incorrect: "الرمز غير صحيح. تحقّق منه وأعد المحاولة.",
  verification_failed: "الرمز غير صحيح. تحقّق منه وأعد المحاولة.",
  verification_expired: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
  form_param_format_invalid: "الصيغة غير صحيحة. راجع ما أدخلته.",
  form_param_nil: "هذا الحقل مطلوب.",
  form_username_invalid_character: "اسم المستخدم يقبل الحروف اللاتينية والأرقام و _ فقط.",
  form_username_invalid_length: "طول اسم المستخدم غير مناسب.",
  form_password_pwned: "كلمة المرور هذه ظهرت في تسريبات سابقة. اختر غيرها.",
  form_password_length_too_short: "كلمة المرور قصيرة جدًا.",
  form_password_not_strong_enough: "كلمة المرور ضعيفة. أضف حروفًا وأرقامًا ورموزًا.",
  phone_number_country_not_supported: "لا ندعم الإرسال إلى هذه الدولة حاليًا. جرّب البريد الإلكتروني.",
  unsupported_country_code: "لا ندعم الإرسال إلى هذه الدولة حاليًا. جرّب البريد الإلكتروني.",
  captcha_invalid: "لم يكتمل التحقق من أنك لست روبوتًا. حدّث الصفحة وأعد المحاولة.",
  captcha_missing_token: "لم يكتمل التحقق من أنك لست روبوتًا. حدّث الصفحة وأعد المحاولة.",
  too_many_requests: "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.",
  user_locked: "أُقفل الحساب مؤقتًا بسبب محاولات كثيرة. حاول لاحقًا.",
  not_allowed_access: "تعذّر استخدام هذا البريد أو الرقم هنا. تحقّق منه أو جرّب غيره.",
  session_exists: "أنت مسجّل الدخول بالفعل.",
  strategy_for_user_invalid: "تعذّرت المتابعة بهذه الوسيلة. جرّب وسيلة دخول أخرى.",
};

export const GENERIC_ERROR = "تعذّر إكمال الطلب. حاول مرة أخرى.";

export function arabicErrorMessage(err: unknown): string {
  const code = clerkErrorCode(err);
  return ERROR_MESSAGES[code] ?? GENERIC_ERROR;
}

// ── التحقق الثنائي ──

export type SecondFactorStrategy = "totp" | "phone_code" | "email_code" | "backup_code";

const SECOND_FACTOR_ORDER: SecondFactorStrategy[] = ["totp", "phone_code", "email_code", "backup_code"];

/** يختار أنسب وسيلة ثانية متاحة: تطبيق المصادقة أولًا، والرموز الاحتياطية أخيرًا. */
export function pickSecondFactor(
  supported: ReadonlyArray<{ strategy: string }> | null | undefined
): SecondFactorStrategy | null {
  const available = new Set((supported ?? []).map((f) => f.strategy));
  return SECOND_FACTOR_ORDER.find((s) => available.has(s)) ?? null;
}

export function secondFactorPrompt(strategy: SecondFactorStrategy): { title: string; hint: string } {
  switch (strategy) {
    case "totp":
      return { title: "التحقق الثنائي", hint: "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة." };
    case "phone_code":
      return { title: "التحقق الثنائي", hint: "أرسلنا رمزًا إلى جوالك المسجّل. أدخله للمتابعة." };
    case "email_code":
      return { title: "تأكيد الجهاز", hint: "أرسلنا رمزًا إلى بريدك المسجّل. أدخله للمتابعة." };
    case "backup_code":
      return { title: "رمز احتياطي", hint: "أدخل أحد الرموز الاحتياطية التي حفظتها عند تفعيل التحقق الثنائي." };
  }
}

// ── إكمال البيانات عند التسجيل ──

export type ProfileField = "first_name" | "last_name" | "email_address" | "username" | "password" | "legal_accepted";

const PROFILE_FIELDS: ProfileField[] = [
  "first_name",
  "last_name",
  "email_address",
  "username",
  "password",
  "legal_accepted",
];

/** الحقول الناقصة التي يستطيع النموذج جمعها، بترتيب العرض. */
export function profileFieldsToCollect(missingFields: ReadonlyArray<string> | null | undefined): ProfileField[] {
  const missing = new Set(missingFields ?? []);
  return PROFILE_FIELDS.filter((f) => missing.has(f));
}

/** حقول مطلوبة لا يعرف النموذج جمعها (مثل حساب اجتماعي) — تُحال لبوابة Clerk. */
export function unsupportedMissingFields(missingFields: ReadonlyArray<string> | null | undefined): string[] {
  const known = new Set<string>([...PROFILE_FIELDS, "phone_number"]);
  return (missingFields ?? []).filter((f) => !known.has(f));
}

export const PROFILE_LABELS: Record<ProfileField, string> = {
  first_name: "الاسم الأول",
  last_name: "اسم العائلة",
  email_address: "البريد الإلكتروني",
  username: "اسم المستخدم",
  password: "كلمة المرور",
  legal_accepted: "أوافق على شروط الاستخدام وسياسة الخصوصية",
};
