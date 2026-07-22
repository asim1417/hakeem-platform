import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  ensurePlatformOwner,
  OWNER_DEFAULT_PASSWORD,
} from "@/lib/modules/auth/ensure-owner";
import { createLoginSession } from "@/lib/modules/auth/session";
import { isOAuthAdminEmail } from "@/lib/modules/auth/oauth-shared";
import { isOwnerEmergencyLoginEnabled } from "@/lib/modules/auth/owner-emergency";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

/**
 * POST /api/auth/owner-login — دخول طوارئ للمالك فقط.
 * معطّل ما لم يُفعَّل OWNER_EMERGENCY_LOGIN_ENABLED (+ سماح الإنتاج إن لزم).
 */
export async function POST(request: NextRequest) {
  if (!isOwnerEmergencyLoginEnabled()) {
    return NextResponse.json({ message: "هذا المسار غير متاح." }, { status: 404 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  if (!isOAuthAdminEmail(email)) {
    return NextResponse.json({ message: "تعذّر إكمال الدخول." }, { status: 403 });
  }

  await ensurePlatformOwner().catch(() => undefined);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user?.isActive) {
    return NextResponse.json({ message: "تعذّر إكمال الدخول." }, { status: 401 });
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  const fallback =
    !ok &&
    body.password === (process.env.OWNER_BOOTSTRAP_PASSWORD || OWNER_DEFAULT_PASSWORD).trim();
  if (!ok && !fallback) {
    return NextResponse.json({ message: "تعذّر إكمال الدخول." }, { status: 401 });
  }

  if (fallback && !ok) {
    await ensurePlatformOwner().catch(() => undefined);
  }

  const safe = { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  await createLoginSession(safe);
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { email, provider: "owner_emergency", asOwner: true },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    user: safe,
    message: "تم الدخول.",
  });
}
