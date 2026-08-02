import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { resumeSubscription } from "@/lib/modules/billing/subscriptions";

export const dynamic = "force-dynamic";

/** POST /api/billing/subscription/resume — استئناف اشتراك مُلغى قبل نهاية الفترة. */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const result = await resumeSubscription(user.id);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
