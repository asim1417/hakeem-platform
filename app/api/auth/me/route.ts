import { NextResponse } from "next/server";
import { getCurrentUser, isAuthDisabled } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const authDisabled = isAuthDisabled();
  const isGuest = Boolean(user && user.email === "guest@hakeem.local");
  return NextResponse.json({
    user,
    authRequired: !authDisabled,
    authDisabled,
    isGuest,
  });
}
