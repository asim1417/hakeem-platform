import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const payload = schema.parse(await request.json());
  const email = payload.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, isActive: true }
  });

  const passwordOk = user?.passwordHash ? await bcrypt.compare(payload.password, user.passwordHash).catch(() => false) : false;
  if (!user || !user.isActive || !passwordOk) {
    await auditEvent({
      actorId: user?.id,
      subject: "AUTH",
      action: "LOGIN_FAILED",
      metadata: { email, reason: !user ? "USER_NOT_FOUND" : !user.isActive ? "USER_INACTIVE" : "BAD_PASSWORD" }
    }).catch(() => undefined);
    return NextResponse.json({ message: "بيانات الدخول غير صحيحة أو أن المستخدم غير نشط." }, { status: 401 });
  }

  await createLoginSession(user);
  await auditEvent({ actorId: user.id, subject: "AUTH", action: "LOGIN_SUCCESS", metadata: { email: user.email, role: user.role } });
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
