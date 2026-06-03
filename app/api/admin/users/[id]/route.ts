import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  temporaryPassword: z.string().min(8).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;
  const actor = gate.user!;
  const payload = schema.parse(await request.json());

  const data: { role?: UserRole; isActive?: boolean; passwordHash?: string } = {};
  if (payload.role) data.role = payload.role;
  if (payload.status) data.isActive = payload.status === "ACTIVE";
  if (payload.temporaryPassword) data.passwordHash = await bcrypt.hash(payload.temporaryPassword, 12);

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true }
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
      passwordReset: Boolean(payload.temporaryPassword)
    }
  });

  return NextResponse.json({ user: { ...user, status: user.isActive ? "ACTIVE" : "INACTIVE" } });
}
