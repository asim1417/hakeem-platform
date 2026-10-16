import { exchangeAuthorizationCode, exchangeRefreshToken, oauthJson, oauthPreflight } from "@/lib/mcp/oauth";
import { mcpSharedKey, mcpTokenSecret } from "@/lib/mcp/config";
import { getGrantStore } from "@/lib/mcp/grants/prisma-store";
import {
  exchangeAuthorizationCode as exchangeGrantCode,
  refreshAccessToken as refreshGrantToken,
} from "@/lib/mcp/grants/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * نقطة التصاريح. رموز hk1 القديمة تُخدم بالمفتاح المشترك (انتقالي)، ورموز الربط بالحساب
 * (hka_ للتفويض، hkr_ للتجديد) تُخدم من جدول الروابط بسرّ MCP_TOKEN_SECRET.
 */
export async function POST(request: Request) {
  const shared = mcpSharedKey();
  const secret = mcpTokenSecret();
  if (!shared && !secret) return oauthJson({ error: "invalid_client" }, 401);

  const fields = await readFields(request);
  const grant = fields.get("grant_type") ?? "";
  const clientId = fields.get("client_id") ?? "";

  if (grant === "authorization_code") {
    const code = fields.get("code") ?? "";
    const redirectUri = fields.get("redirect_uri") ?? "";
    const codeVerifier = fields.get("code_verifier") ?? "";
    if (code.startsWith("hk1.")) {
      if (!shared) return oauthJson({ error: "invalid_grant" }, 400);
      const result = exchangeAuthorizationCode({ secret: shared, code, clientId, redirectUri, codeVerifier });
      return "error" in result ? oauthJson({ error: result.error }, 400) : oauthJson(result);
    }
    if (!secret) return oauthJson({ error: "invalid_grant" }, 400);
    try {
      const result = await exchangeGrantCode({ store: getGrantStore(), secret, code, clientId, redirectUri, codeVerifier });
      return "error" in result ? oauthJson({ error: result.error }, 400) : oauthJson(result);
    } catch (e) {
      console.error("[mcp-oauth] code exchange failed", (e as Error)?.message?.slice(0, 160));
      return oauthJson({ error: "server_error" }, 500);
    }
  }

  if (grant === "refresh_token") {
    const refreshToken = fields.get("refresh_token") ?? "";
    if (refreshToken.startsWith("hk1.")) {
      if (!shared) return oauthJson({ error: "invalid_grant" }, 400);
      const result = exchangeRefreshToken({ secret: shared, refreshToken, clientId: clientId || undefined });
      return "error" in result ? oauthJson({ error: result.error }, 400) : oauthJson(result);
    }
    if (!secret) return oauthJson({ error: "invalid_grant" }, 400);
    try {
      const result = await refreshGrantToken({ store: getGrantStore(), secret, refreshToken, clientId: clientId || undefined });
      return "error" in result ? oauthJson({ error: result.error }, 400) : oauthJson(result);
    } catch (e) {
      console.error("[mcp-oauth] refresh failed", (e as Error)?.message?.slice(0, 160));
      return oauthJson({ error: "server_error" }, 500);
    }
  }

  return oauthJson({ error: "unsupported_grant_type" }, 400);
}

export function OPTIONS() {
  return oauthPreflight();
}

async function readFields(request: Request): Promise<Map<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const out = new Map<string, string>();
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body ?? {})) {
        if (typeof value === "string") out.set(key, value);
      }
      return out;
    }
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") out.set(key, value);
    }
  } catch {
    return out;
  }
  return out;
}
