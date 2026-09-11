import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { listDueDiligenceSnapshots } from "@/lib/modules/due-diligence/history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
  const snapshots = await listDueDiligenceSnapshots(user.id, limit);

  return NextResponse.json({ snapshots });
}
