/**
 * إعدادات موصل حكيم (MCP) من متغيرات البيئة — تُقرأ لكل طلب لا عند تحميل الوحدة.
 *
 *  HAKEEM_MCP_KEY                   المفتاح المشترك القديم (فريق أمان/الربط القديم).
 *  HAKEEM_MCP_SHARED_KEY_DISABLED=1 إيقاف المفتاح المشترك نهائيًا (المرحلة الخامسة).
 *  MCP_TOKEN_SECRET                 سرّ توقيع تصاريح الربط بالحساب (≥ 32 حرفًا، مستقل لكل بيئة).
 *  MCP_ACCOUNT_LINKING=1            تفعيل الربط بحساب حكيم (بعد تطبيق هجرة الجداول).
 *  MCP_USER_RATE_LIMIT              حدّ الاستدعاءات لكل مستخدم في الدقيقة (افتراضي 60).
 */
type Env = Record<string, string | undefined>;

const MIN_SECRET_LENGTH = 32;

function flag(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

/** المفتاح المشترك إن كان مضبوطًا وغير موقوف. */
export function mcpSharedKey(env: Env = process.env): string | null {
  if (flag(env.HAKEEM_MCP_SHARED_KEY_DISABLED)) return null;
  const key = (env.HAKEEM_MCP_KEY ?? "").trim();
  return key || null;
}

/** سرّ تصاريح الربط بالحساب، أو null إن غاب أو قصر عن الحد الأدنى. */
export function mcpTokenSecret(env: Env = process.env): string | null {
  const secret = (env.MCP_TOKEN_SECRET ?? "").trim();
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/** الربط بالحساب مفعّل: العلم + سرّ صالح. */
export function accountLinkingEnabled(env: Env = process.env): boolean {
  return flag(env.MCP_ACCOUNT_LINKING) && mcpTokenSecret(env) !== null;
}

/** حدّ الاستدعاءات لكل مستخدم في الدقيقة. */
export function mcpUserRateLimit(env: Env = process.env): number {
  const n = Number(env.MCP_USER_RATE_LIMIT);
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? Math.floor(n) : 60;
}
