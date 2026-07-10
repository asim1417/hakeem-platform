// ─────────────────────────────────────────────────────────────────────────────
// ApiKeys — توليد وتجزئة مفاتيح بوابة API الخارجية (كريبتو نقيّ، قابل للاختبار).
// المفتاح الكامل يُعرض مرة واحدة عند الإنشاء؛ القاعدة تخزّن SHA-256 فقط (لا الخام).
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomBytes } from "crypto";

/** نطاقات الوصول المتاحة للبوابة الخارجية. */
export const API_SCOPES = ["legal:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

const KEY_ENV = "live";
const PREFIX_VISIBLE = 16; // عدد المحارف الظاهرة في key_prefix (للعرض/الإدارة)

/** SHA-256 hex للمفتاح الكامل — هو فهرس البحث السرّي (لا يُخزَّن الخام). */
export function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey.trim()).digest("hex");
}

export interface GeneratedApiKey {
  /** المفتاح الكامل — يُعرض للمستخدم مرة واحدة فقط ثم يُنسى. */
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
}

/** يولّد مفتاحًا جديدًا: hk_live_<عشوائي>، ويعيد الخام + البادئة + التجزئة. */
export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString("base64url"); // ~32 محرفًا عشوائيًا
  const fullKey = `hk_${KEY_ENV}_${secret}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, PREFIX_VISIBLE),
    keyHash: hashApiKey(fullKey),
  };
}

/** يستخرج المفتاح المقدَّم من ترويسة الطلب (Bearer أو x-api-key). */
export function extractPresentedKey(headers: {
  authorization?: string | null;
  apiKey?: string | null;
}): string | null {
  const bearer = (headers.authorization ?? "").trim();
  if (/^Bearer\s+/i.test(bearer)) {
    const token = bearer.replace(/^Bearer\s+/i, "").trim();
    if (token) return token;
  }
  const x = (headers.apiKey ?? "").trim();
  return x || null;
}

/** هل يبدو المفتاح بصيغة حكيم الصحيحة؟ (فحص شكلي رخيص قبل الاستعلام). */
export function looksLikeApiKey(key: string): boolean {
  return /^hk_(live|test)_[A-Za-z0-9_-]{16,}$/.test(key.trim());
}

/** هل يملك المفتاح النطاق المطلوب؟ */
export function keyHasScope(scopes: string[], required: ApiScope): boolean {
  return scopes.includes(required);
}

/** رقم النافذة الزمنية (fixed window بالدقيقة) من طابع زمني بالمللي ثانية. */
export function windowBucket(nowMs: number, windowMs = 60_000): number {
  return Math.floor(nowMs / windowMs);
}
