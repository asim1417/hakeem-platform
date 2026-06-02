import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { canUser } from "@/lib/modules/auth/rbac";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getSystemUser();
  const allowed = await canUser(actor.id, "USERS_MANAGE");
  if (!allowed) return NextResponse.json({ message: "لا تملك صلاحية إدارة المستخدمين." }, { status: 403 });

  const payload = schema.parse(await request.json());
  const user = payload.role
    ? await prisma.user.update({
        where: { id: params.id },
        data: { role: payload.role },
        select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
      })
    : await prisma.user.findUniqueOrThrow({
        where: { id: params.id },
        select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
      });

  await auditEvent({
    actorId: actor.id,
    subject: "ADMIN",
    action: "USER_UPDATED",
    entityId: user.id,
    metadata: {
      description: `تم تحديث مستخدم: ${user.name}`,
      role: payload.role,
      status: payload.status,
      note: "تحديث الحالة يسجل في التدقيق فقط لأن جدول users لا يحتوي حقل status."
    }
  });

  return NextResponse.json({ user: { ...user, status: payload.status ?? "ACTIVE" } });
}
