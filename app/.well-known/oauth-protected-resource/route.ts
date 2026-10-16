import { oauthJson, oauthPreflight, protectedResourceMetadata, publicOrigin } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return oauthJson(protectedResourceMetadata(publicOrigin(request)));
}

export function OPTIONS() {
  return oauthPreflight();
}
