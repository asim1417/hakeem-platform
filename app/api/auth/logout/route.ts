import { NextResponse } from "next/server";
import { auditEvent } from "@/lib/modules/audit/audit";
import { clearLoginSession, getCurrentUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  clearLoginSession();
  if (user) {
    await auditEvent({ actorId: user.id, subject: "AUTH", action: "LOGOUT", metadata: { email: user.email } }).catch(() => undefined);
  }
  return NextResponse.json({ message: "تم تسجيل الخروج." });
}
