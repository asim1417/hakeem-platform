import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { getUsageReport, usageReportToCsv } from "@/lib/modules/billing/usage-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const sp = request.nextUrl.searchParams;
  const report = await getUsageReport({
    status: sp.get("status") || undefined,
    q: sp.get("q") || undefined,
    sort: sp.get("sort") || undefined,
    limit: Number(sp.get("limit") || 2000),
  });
  const csv = usageReportToCsv(report);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hakeem-usage-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
