/**
 * الدخول من الصفحة الرئيسية دون مغادرتها (حوار/لوح سفلي).
 *
 * مفتاح الطوارئ: HOME_INLINE_AUTH_ENABLED=0 (من Vercel أو الإعدادات المُدارة)
 * يعيد روابط /sign-in و/sign-up وسلوك GuestAskComposer كما كانت حرفيًا.
 * الافتراضي: مفعّل.
 */
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

export function isHomeInlineAuthEnabled(): boolean {
  const v = (process.env.HOME_INLINE_AUTH_ENABLED || "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off");
}

/** ما يحدث بعد الدخول من الحوار. لا يُحفظ نص السؤال هنا ولا في أي رابط. */
export type HomeAuthIntent =
  | { kind: "login" }
  | { kind: "ask" }
  | { kind: "navigate"; next: string };

export type HomeAuthMode = "sign-in" | "sign-up";

export const HOME_AUTH_INTENT_KEY = "hakeem-home-auth-intent";
export const HOME_AUTH_INTENT_TTL_MS = 30 * 60 * 1000;

export function serializeHomeAuthIntent(intent: HomeAuthIntent, now: number = Date.now()): string {
  return JSON.stringify({ intent, exp: now + HOME_AUTH_INTENT_TTL_MS });
}

/** يقرأ النيّة المحفوظة — منتهية الصلاحية أو تالفة ← null. وجهة navigate تمر على safeDashboardNext. */
export function parseHomeAuthIntent(raw: string | null | undefined, now: number = Date.now()): HomeAuthIntent | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { intent, exp } = data as { intent?: unknown; exp?: unknown };
  if (typeof exp !== "number" || exp <= now) return null;
  return normalizeHomeAuthIntent(intent);
}

export function normalizeHomeAuthIntent(value: unknown): HomeAuthIntent | null {
  if (!value || typeof value !== "object") return null;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "login" || kind === "ask") return { kind };
  if (kind === "navigate") {
    const next = (value as { next?: unknown }).next;
    return { kind: "navigate", next: safeDashboardNext(typeof next === "string" ? next : null) };
  }
  return null;
}

/** آخر وسيلة دخول — كوكي غير حسّاس (اسم الوسيلة فقط، لا البريد ولا الرقم). */
export const HOME_AUTH_LAST_METHOD_COOKIE = "hakeem_last_auth";
export type HomeAuthMethod = "google" | "microsoft" | "apple" | "identifier";

export function parseLastAuthMethod(cookieHeader: string | null | undefined): HomeAuthMethod | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === HOME_AUTH_LAST_METHOD_COOKIE) {
      return v === "google" || v === "microsoft" || v === "apple" || v === "identifier" ? v : null;
    }
  }
  return null;
}

export function lastAuthMethodCookie(method: HomeAuthMethod, secure: boolean): string {
  return `${HOME_AUTH_LAST_METHOD_COOKIE}=${method}; Path=/; Max-Age=${180 * 24 * 3600}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

/** حدث فتح الحوار ونوافذ التحديث بين المكوّنات (بلا مكتبة حالة). */
export const HOME_AUTH_OPEN_EVENT = "hakeem:home-auth-open";
export const HOME_AUTH_CHANGED_EVENT = "hakeem:auth-changed";
