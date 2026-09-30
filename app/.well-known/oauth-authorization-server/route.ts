import { authorizationServerMetadata, oauthJson, oauthPreflight, publicOrigin } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(publicOrigin(request)));
}

export function OPTIONS() {
  return oauthPreflight();
}
