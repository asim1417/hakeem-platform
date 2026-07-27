import { NextRequest, NextResponse } from "next/server";
import { runScheduledWeeklyIfDue } from "@/lib/modules/rasd/scheduler/weekly";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.RASD_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = request.headers.get("x-cron-secret");
  const auth = request.headers.get("authorization");
  return headerSecret === secret || auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ message: "غير مصرح." }, { status: 401 });
  }
  const result = await runScheduledWeeklyIfDue(new Date());
  return NextResponse.json(result);
}
