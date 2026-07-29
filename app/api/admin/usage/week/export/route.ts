import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import {
  getWeekVerifiedReport,
  weekVerifiedToCsv,
} from "@/lib/modules/billing/week-verified-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("ADMIN_REPORTS_VIEW", request);
  if (gate.response) return gate.response;

  const report = await getWeekVerifiedReport();
  const csv = weekVerifiedToCsv(report);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hakeem-week-verified-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
