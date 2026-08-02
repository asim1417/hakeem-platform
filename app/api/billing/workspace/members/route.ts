import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { addWorkspaceMember } from "@/lib/modules/billing/workspace";

export const dynamic = "force-dynamic";

/** POST /api/billing/workspace/members — إضافة عضو بالبريد (ضمن حدّ المقاعد). */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  if (!body.email) return NextResponse.json({ message: "البريد مطلوب." }, { status: 400 });
  const result = await addWorkspaceMember({ ownerId: user.id, email: body.email });
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
