/**
 * تحقق خفيف من شكل توقيع hakeem_session — آمن للاستخدام في middleware (Edge).
 * لا يستورد Prisma ولا server-only.
 */
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "hakeem_session";

function resolveSecret(): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") return null;
  return "hakeem-dev-only-insecure-secret";
}

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** يتحقق من التوقيع وانتهاء الصلاحية دون تحميل المستخدم من القاعدة. */
export function isValidOwnerSessionToken(value?: string | null): boolean {
  if (!value) return false;
  const secret = resolveSecret();
  if (!secret) return false;
  const [body, signature] = value.split(".");
  if (!body || !signature) return false;
  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
    };
    if (!payload.userId || typeof payload.exp !== "number") return false;
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function hasValidOwnerSessionCookie(
  cookieHeader: string | null | undefined
): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(/(?:^|;\s*)hakeem_session=([^;]*)/);
  if (!match?.[1]) return false;
  try {
    return isValidOwnerSessionToken(decodeURIComponent(match[1]));
  } catch {
    return false;
  }
}

export { COOKIE_NAME as OWNER_SESSION_COOKIE_NAME };
