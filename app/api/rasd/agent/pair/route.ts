import { NextRequest, NextResponse } from "next/server";
import { completePairing } from "@/lib/modules/rasd/bridge/pairing";

export const dynamic = "force-dynamic";

/** Public agent pairing completion — requires one-time pairing code (not long-lived API key). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ errorCode: "INVALID_BODY" }, { status: 400 });
  }
  const result = completePairing({
    code: String((body as { code?: string }).code ?? ""),
    displayName: String((body as { displayName?: string }).displayName ?? "جهاز رصد"),
    publicKeyPem: String((body as { publicKeyPem?: string }).publicKeyPem ?? ""),
    platform: String((body as { platform?: string }).platform ?? "unknown"),
    version: String((body as { version?: string }).version ?? "0.0.0"),
    capabilities: Array.isArray((body as { capabilities?: string[] }).capabilities)
      ? ((body as { capabilities: string[] }).capabilities)
      : undefined
  });
  if (!result.ok) return NextResponse.json({ errorCode: result.errorCode }, { status: 400 });
  return NextResponse.json({
    agentId: result.agent.id,
    displayName: result.agent.displayName,
    approvedSources: result.agent.approvedSources,
    status: result.agent.status
  });
}
