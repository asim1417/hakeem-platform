/**
 * تشفير تصاريح الربط بالحساب (نقيّ، بلا قاعدة، قابل للاختبار).
 *  - تصريح وصول  hk2.<payload>.<sig>  موقّع HMAC بسرّ MCP_TOKEN_SECRET، قصير العمر.
 *  - رمز تجديد   hkr_<عشوائي>         يُخزَّن بصمته فقط ويُستبدل في كل تجديد.
 *  - رمز تفويض   hka_<عشوائي>         لمرة واحدة، تُخزَّن بصمته فقط.
 *  - طلب معلّق   hkp.<payload>.<sig>  يحمل معاملات طلب الربط بين صفحة التفويض وشاشة الموافقة.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCESS_TTL_SEC = 60 * 60;
export const AUTH_CODE_TTL_SEC = 5 * 60;
export const PENDING_TTL_SEC = 10 * 60;
export const GRANT_IDLE_TTL_SEC = 30 * 24 * 60 * 60;
/** نافذة سماح لتجديدين متزامنين من العميل نفسه قبل اعتبار الرمز القديم مسروقًا. */
export const REFRESH_REUSE_GRACE_SEC = 60;

export type AccessClaims = {
  v: 2;
  typ: "access";
  sub: string; // المستخدم
  gid: string; // الربط
  cid: string; // العميل
  aud: string; // المورد (/mcp)
  exp: number;
};

export type PendingAuthorization = {
  cid: string; // client_id
  ru: string; // redirect_uri
  st: string; // state
  cc: string; // code_challenge (S256)
  res: string; // resource
  sc: string; // scope المطلوب (للعرض فقط)
  n: string; // nonce يربط النموذج بالطلب (CSRF)
  exp: number;
};

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newRefreshToken(): string {
  return `hkr_${randomBytes(32).toString("base64url")}`;
}

export function newAuthCode(): string {
  return `hka_${randomBytes(32).toString("base64url")}`;
}

export function newNonce(): string {
  return randomBytes(18).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(secret: string, prefix: string, body: object): string {
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", `${prefix}:${secret}`).update(payload).digest("base64url");
  return `${prefix}.${payload}.${sig}`;
}

function verify(secret: string, prefix: string, token: string): unknown | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== prefix) return null;
  const payload = parts[1] ?? "";
  const expected = createHmac("sha256", `${prefix}:${secret}`).update(payload).digest("base64url");
  if (!safeEqual(parts[2] ?? "", expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function signAccessToken(secret: string, claims: Omit<AccessClaims, "v" | "typ">): string {
  return sign(secret, "hk2", { v: 2, typ: "access", ...claims });
}

export function readAccessToken(secret: string, token: string, now = nowSec()): AccessClaims | null {
  const body = verify(secret, "hk2", token) as Partial<AccessClaims> | null;
  if (!body || body.v !== 2 || body.typ !== "access") return null;
  if (typeof body.sub !== "string" || typeof body.gid !== "string" || typeof body.cid !== "string") return null;
  if (typeof body.aud !== "string" || typeof body.exp !== "number" || body.exp < now) return null;
  return body as AccessClaims;
}

export function signPending(secret: string, pending: PendingAuthorization): string {
  return sign(secret, "hkp", pending);
}

export function readPending(secret: string, token: string | undefined | null, now = nowSec()): PendingAuthorization | null {
  if (!token) return null;
  const body = verify(secret, "hkp", token) as Partial<PendingAuthorization> | null;
  if (!body) return null;
  const fields: Array<keyof PendingAuthorization> = ["cid", "ru", "st", "cc", "res", "sc", "n"];
  if (fields.some((f) => typeof body[f] !== "string")) return null;
  if (typeof body.exp !== "number" || body.exp < now) return null;
  return body as PendingAuthorization;
}

export function isPkceVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}
