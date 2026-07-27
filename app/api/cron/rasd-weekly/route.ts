import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runScheduledWeeklyIfDue } from "@/lib/modules/rasd/scheduler/weekly";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.RASD_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = request.headers.get("x-cron-secret");
  const auth = request.headers.get("authorization");
  return Boolean((headerSecret && safeEqual(headerSecret, secret)) || (auth && safeEqual(auth, `Bearer ${secret}`)));
}

function schedulerDisabled(): string | undefined {
  if (process.env.VERCEL_ENV === "preview" && process.env.RASD_ALLOW_PREVIEW_CRON !== "true") {
    return "preview_cron_disabled";
  }
  if (process.env.RASD_SCHEDULER_ENABLED === "false") {
    return "RASD_SCHEDULER_ENABLED=false";
  }
  return undefined;
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ message: "غير مصرح." }, { status: 401 });
  }
  const disabledReason = schedulerDisabled();
  if (disabledReason) {
    return NextResponse.json({ ran: false, reason: disabledReason });
  }
  const result = await runScheduledWeeklyIfDue(new Date());
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
