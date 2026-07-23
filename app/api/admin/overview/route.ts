import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { getPlatformOverview } from "@/lib/modules/admin/platform-overview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const overview = await getPlatformOverview();
  return NextResponse.json({ overview });
}
