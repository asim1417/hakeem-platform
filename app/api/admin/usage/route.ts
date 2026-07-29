import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getUsageReport } from "@/lib/modules/billing/usage-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("ADMIN_REPORTS_VIEW", request);
  if (gate.response) return gate.response;

  const sp = request.nextUrl.searchParams;
  const report = await getUsageReport({
    status: sp.get("status") || undefined,
    q: sp.get("q") || undefined,
    sort: sp.get("sort") || undefined,
    limit: Number(sp.get("limit") || 500),
  });
  return NextResponse.json(report);
}
