import { NextResponse } from "next/server";
import { getCurrentUser, isAuthDisabled } from "@/lib/modules/auth/session";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  const authDisabled = isAuthDisabled();
  const isGuest = user?.email === "guest@hakeem.local";
  return NextResponse.json({
    user,
    isGuest,
    authDisabled,
    clerk: isClerkConfigured(),
  });
}
