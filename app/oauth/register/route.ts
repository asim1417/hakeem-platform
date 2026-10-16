import { isAllowedRedirect, issueClientId, oauthJson, oauthPreflight } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    redirect_uris?: unknown;
    client_name?: unknown;
    grant_types?: unknown;
    response_types?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return oauthJson({ error: "invalid_client_metadata" }, 400);
  }
  const redirects = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((item): item is string => typeof item === "string") : [];
  if (redirects.length === 0 || redirects.some((uri) => !isAllowedRedirect(uri))) {
    return oauthJson({ error: "invalid_redirect_uri" }, 400);
  }
  return oauthJson(
    {
      client_id: issueClientId(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: typeof body.client_name === "string" ? body.client_name.slice(0, 120) : "حكيم",
      redirect_uris: redirects,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201
  );
}

export function OPTIONS() {
  return oauthPreflight();
}
