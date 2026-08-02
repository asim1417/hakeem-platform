import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { getServiceProfitability } from "@/lib/modules/billing/profitability";

export const dynamic = "force-dynamic";

/** GET /api/admin/billing/profitability?days=30 — ربحية كل خدمة (داخلي). */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const days = Number(new URL(request.url).searchParams.get("days")) || 0;
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
  const overview = await getServiceProfitability(since);
  return NextResponse.json(overview);
}
