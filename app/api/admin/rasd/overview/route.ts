import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getRasdOverview } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  return NextResponse.json({ overview: await getRasdOverview() });
}
