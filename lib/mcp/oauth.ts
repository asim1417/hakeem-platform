/**
 * تسجيل دخول موصل حكيم لعملاء MCP (Claude).
 * الخادم لا يملك حسابات مستخدمين هنا: المفتاح المشترك HAKEEM_MCP_KEY هو سرّ الربط.
 * كلود يرفض «Couldn't start sign-in» إن لم يجد بيانات OAuth بعد رفض الطلب.
 * الرموز موقّعة (HMAC) بلا تخزين، لأن بيئة التشغيل بلا حالة بين الطلبات.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isMcpOauthPublicPath } from "@/lib/mcp/oauth-paths";

export { isMcpOauthPublicPath };

const CODE_TTL_SEC = 10 * 60;
const ACCESS_TTL_SEC = 7 * 24 * 60 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

const CLAUDE_REDIRECTS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://www.claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  "https://www.claude.com/api/mcp/auth_callback",
]);

const URL_CLIENT_HOSTS = new Set(["claude.ai", "www.claude.ai", "claude.com", "www.claude.com"]);

type TokenTyp = "access" | "refresh" | "code";

type TokenBody = {
  typ: TokenTyp;
  exp: number;
  cid: string;
  aud: string;
  ru?: string;
  cc?: string;
};

export type TokenSuccess = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  scope: "mcp:read";
};

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || url.host;
  const proto = (forwardedProto || url.protocol.replace(":", "")).replace(/:$/, "");
  return `${proto}://${host}`;
}

export function mcpResourceUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/mcp`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: ["mcp:read"],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    scopes_supported: ["mcp:read"],
  };
}

export function mcpUnauthorized(request: Request): Response {
  const origin = publicOrigin(request);
  const metadata = `${origin}/.well-known/oauth-protected-resource/mcp`;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "WWW-Authenticate": `Bearer realm="hakeem", resource_metadata="${metadata}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function mcpCredentialAccepted(request: Request, expectedKey: string): boolean {
  const headerKey = request.headers.get("x-api-key")?.trim() ?? "";
  if (headerKey && safeEqual(headerKey, expectedKey)) return true;
  const presented = bearerToken(request);
  if (!presented) return false;
  if (safeEqual(presented, expectedKey)) return true;
  const access = readToken(expectedKey, presented, "access");
  if (!access) return false;
  return access.aud === mcpResourceUrl(publicOrigin(request));
}

export function isAllowedRedirect(uri: string): boolean {
  if (CLAUDE_REDIRECTS.has(uri)) return true;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol !== "http:") return false;
  if (url.username || url.password || url.search || url.hash) return false;
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") return false;
  return url.pathname === "/callback" || url.pathname === "/oauth/callback";
}

export function isAllowedClientId(clientId: string): boolean {
  if (clientId.length < 8 || clientId.length > 512) return false;
  if (/^hkc_[A-Za-z0-9_-]{16,}$/.test(clientId)) return true;
  if (/^[A-Za-z0-9._~-]{8,128}$/.test(clientId)) return true;
  try {
    const url = new URL(clientId);
    return url.protocol === "https:" && URL_CLIENT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function issueClientId(): string {
  return `hkc_${randomBytes(24).toString("base64url")}`;
}

export function createAuthorizationCode(input: {
  secret: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  now?: number;
}): string {
  const now = input.now ?? nowSec();
  return signToken(input.secret, {
    typ: "code",
    exp: now + CODE_TTL_SEC,
    cid: input.clientId,
    aud: input.resource,
    ru: input.redirectUri,
    cc: input.codeChallenge,
  });
}

export function exchangeAuthorizationCode(input: {
  secret: string;
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  now?: number;
}): TokenSuccess | { error: "invalid_grant" | "invalid_client" } {
  if (!isAllowedClientId(input.clientId) || !isAllowedRedirect(input.redirectUri)) {
    return { error: "invalid_client" };
  }
  if (!isPkceVerifier(input.codeVerifier)) return { error: "invalid_grant" };
  const code = readToken(input.secret, input.code, "code");
  if (!code || code.cid !== input.clientId || code.ru !== input.redirectUri || !code.cc) {
    return { error: "invalid_grant" };
  }
  if (s256(input.codeVerifier) !== code.cc) return { error: "invalid_grant" };
  return issueTokenPair(input.secret, code.cid, code.aud, input.now);
}

export function exchangeRefreshToken(input: {
  secret: string;
  refreshToken: string;
  clientId?: string;
  now?: number;
}): TokenSuccess | { error: "invalid_grant" } {
  const refresh = readToken(input.secret, input.refreshToken, "refresh");
  if (!refresh) return { error: "invalid_grant" };
  if (input.clientId && input.clientId !== refresh.cid) return { error: "invalid_grant" };
  return issueTokenPair(input.secret, refresh.cid, refresh.aud, input.now);
}

export function keysMatch(provided: string, expected: string): boolean {
  return safeEqual(provided, expected);
}

export function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function oauthJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

export function oauthPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    },
  });
}

function issueTokenPair(secret: string, clientId: string, resource: string, now = nowSec()): TokenSuccess {
  const access = signToken(secret, {
    typ: "access",
    exp: now + ACCESS_TTL_SEC,
    cid: clientId,
    aud: resource,
  });
  const refresh = signToken(secret, {
    typ: "refresh",
    exp: now + REFRESH_TTL_SEC,
    cid: clientId,
    aud: resource,
  });
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: ACCESS_TTL_SEC,
    token_type: "Bearer",
    scope: "mcp:read",
  };
}

function signToken(secret: string, body: TokenBody): string {
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `hk1.${payload}.${sig}`;
}

function readToken(secret: string, token: string, typ: TokenTyp): TokenBody | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "hk1") return null;
  const payload = parts[1] ?? "";
  const sig = parts[2] ?? "";
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  let body: TokenBody;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenBody;
  } catch {
    return null;
  }
  if (!body || body.typ !== typ || typeof body.exp !== "number" || typeof body.cid !== "string" || typeof body.aud !== "string") {
    return null;
  }
  if (body.exp < nowSec()) return null;
  return body;
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

function isPkceVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
