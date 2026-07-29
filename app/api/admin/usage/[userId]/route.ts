import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { getUsageUserDetail } from "@/lib/modules/billing/usage-user-detail";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: { userId: string } }
) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const detail = await getUsageUserDetail(decodeURIComponent(context.params.userId));
  if (!detail) {
    return NextResponse.json({ message: "المستخدم غير موجود." }, { status: 404 });
  }
  return NextResponse.json(detail);
}
