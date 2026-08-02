import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getOwnedWorkspaceMembers } from "@/lib/modules/billing/workspace";

export const dynamic = "force-dynamic";

/** GET /api/billing/workspace — أعضاء مساحة العمل التي يملكها المستخدم. */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const ws = await getOwnedWorkspaceMembers(user.id);
  return NextResponse.json(ws);
}
