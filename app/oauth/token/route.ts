import { exchangeAuthorizationCode, exchangeRefreshToken, oauthJson, oauthPreflight } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.HAKEEM_MCP_KEY?.trim();
  if (!secret) return oauthJson({ error: "invalid_client" }, 401);

  const fields = await readFields(request);
  const grant = fields.get("grant_type") ?? "";
  const clientId = fields.get("client_id") ?? "";

  if (grant === "authorization_code") {
    const result = exchangeAuthorizationCode({
      secret,
      code: fields.get("code") ?? "",
      clientId,
      redirectUri: fields.get("redirect_uri") ?? "",
      codeVerifier: fields.get("code_verifier") ?? "",
    });
    if ("error" in result) return oauthJson({ error: result.error }, 400);
    return oauthJson(result);
  }

  if (grant === "refresh_token") {
    const result = exchangeRefreshToken({
      secret,
      refreshToken: fields.get("refresh_token") ?? "",
      clientId: clientId || undefined,
    });
    if ("error" in result) return oauthJson({ error: result.error }, 400);
    return oauthJson(result);
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
