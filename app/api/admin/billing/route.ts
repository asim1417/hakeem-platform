import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { getBillingAdminOverview } from "@/lib/modules/billing/admin-overview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const overview = await getBillingAdminOverview();
  return NextResponse.json(overview);
}
