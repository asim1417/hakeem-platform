import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePlatformOwner } from "@/lib/modules/auth/ensure-owner";
import { verifyMagicToken } from "@/lib/modules/auth/magic-link";
import { createLoginSession } from "@/lib/modules/auth/session";
import { safeNextPath } from "@/lib/modules/auth/oauth-shared";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/magic/consume?token=…&next=…
 * يتحقق من الرابط السحري ويفتح جلسة المالك.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get("token") || "";
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/dashboard");

  const payload = verifyMagicToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=magic_invalid", origin));
  }

  await ensurePlatformOwner().catch(() => undefined);

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user?.isActive) {
    return NextResponse.redirect(new URL("/login?error=magic_user", origin));
  }

  await createLoginSession(user);
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { email: user.email, provider: "magic_link", asOwner: true },
  }).catch(() => undefined);

  return NextResponse.redirect(new URL(next, origin));
}
