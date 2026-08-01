import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { snapshot } from "@/lib/modules/observability/metrics";

export const dynamic = "force-dynamic";

/** GET /api/metrics — لقطة العدّادات/المؤقّتات (§23). محميّة بصلاحية الحوكمة. */
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("GOVERNANCE_AUDIT_VIEW", request);
  if (gate.response) return gate.response;
  return NextResponse.json({ metrics: snapshot(), at: new Date().toISOString() });
}
