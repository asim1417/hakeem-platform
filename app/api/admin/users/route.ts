import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "اسم المستخدم مطلوب."),
  email: z.string().email("البريد الإلكتروني غير صالح."),
  role: z.nativeEnum(UserRole).default("TRAINEE"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  temporaryPassword: z.string().min(8, "كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف.").optional()
});

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true }
  });

  return NextResponse.json({ users: users.map((user) => ({ ...user, status: user.isActive ? "ACTIVE" : "INACTIVE" })) });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;
  const actor = gate.user!;
  const payload = schema.parse(await request.json());
  const temporaryPassword = payload.temporaryPassword || `Hakeem-${Math.random().toString(36).slice(2, 10)}!`;
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email.toLowerCase().trim(),
      role: payload.role,
      isActive: payload.status === "ACTIVE",
      passwordHash
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true }
  });

  await auditEvent({
    actorId: actor.id,
    subject: "ADMIN",
    action: "USER_CREATED",
    entityId: user.id,
    metadata: {
      description: `تم إنشاء مستخدم: ${user.name}`,
      email: user.email,
      role: user.role,
      status: user.isActive ? "ACTIVE" : "INACTIVE",
      temporaryPasswordIssued: true
    }
  });

  return NextResponse.json({ user: { ...user, status: user.isActive ? "ACTIVE" : "INACTIVE", temporaryPassword } }, { status: 201 });
}
