// ─────────────────────────────────────────────────────────────────────────────
// رابط دخول المالك بالبريد — موقَّع HMAC، صالح لدقائق محدودة.
// يُرسل عبر Resend إن وُجد، وإلا يُعاد الرابط في الاستجابة (للتفعيل دون بريد).
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isOAuthAdminEmail } from "@/lib/modules/auth/oauth-shared";

const TTL_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "hakeem-dev-only-insecure-secret";
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export type MagicPayload = {
  email: string;
  exp: number;
  nonce: string;
};

export function issueMagicToken(email: string): { token: string; exp: number } {
  const payload: MagicPayload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + TTL_MS,
    nonce: randomBytes(8).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, exp: payload.exp };
}

export function verifyMagicToken(token: string): MagicPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MagicPayload;
    if (!payload?.email || !payload.exp || payload.exp < Date.now()) return null;
    if (!isOAuthAdminEmail(payload.email)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** هل يُسمح بطلب رابط سحري لهذا البريد؟ (المالك فقط). */
export function canRequestMagicLink(email: string): boolean {
  return isOAuthAdminEmail(email);
}
