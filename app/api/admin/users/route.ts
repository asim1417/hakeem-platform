import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { canUser } from "@/lib/modules/auth/rbac";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "اسم المستخدم مطلوب."),
  email: z.string().email("البريد الإلكتروني غير صالح."),
  role: z.nativeEnum(UserRole).default("TRAINEE"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
  });

  return NextResponse.json({ users: users.map((user) => ({ ...user, status: "ACTIVE" })) });
}

export async function POST(request: NextRequest) {
  const actor = await getSystemUser();
  const allowed = await canUser(actor.id, "USERS_MANAGE");
  if (!allowed) return NextResponse.json({ message: "لا تملك صلاحية إدارة المستخدمين." }, { status: 403 });

  const payload = schema.parse(await request.json());
  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      role: payload.role,
      passwordHash: "not-for-login"
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
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
      status: payload.status,
      note: "الحالة لا تحفظ في schema الحالي. المستخدم تنظيمي فقط إلى حين تفعيل Auth."
    }
  });

  return NextResponse.json({ user: { ...user, status: payload.status } }, { status: 201 });
}
