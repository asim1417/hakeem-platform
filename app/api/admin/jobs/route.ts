import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { listJobStats, listRecentJobs } from "@/lib/modules/jobs/job-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "40");
  const [stats, jobs] = await Promise.all([listJobStats(), listRecentJobs(limitRaw)]);
  return NextResponse.json({ stats, jobs });
}
