import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { removeWorkspaceMember } from "@/lib/modules/billing/workspace";

export const dynamic = "force-dynamic";

/** DELETE /api/billing/workspace/members/[userId] — إزالة عضو من مساحة عمل المالك. */
export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const result = await removeWorkspaceMember({ ownerId: user.id, memberUserId: params.userId });
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
