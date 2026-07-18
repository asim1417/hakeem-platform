import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { generateEasyPassword, isValidUsername } from "@/lib/modules/auth/credentials";
import { ROLE_PERMISSIONS } from "@/lib/modules/auth/role-permissions";
import { PERMISSION_CATALOG, ROLE_LABELS } from "@/lib/modules/auth/role-admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  username: z.string().min(3).max(32).optional().or(z.literal("")),
  temporaryPassword: z.string().min(8).optional(),
  regeneratePassword: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;
  const actor = gate.user!;

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات التحديث غير صالحة." }, { status: 400 });
  }

  const data: {
    role?: UserRole;
    isActive?: boolean;
    passwordHash?: string;
    username?: string | null;
  } = {};
  if (payload.role) data.role = payload.role;
  if (payload.status) data.isActive = payload.status === "ACTIVE";

  let issuedPassword: string | undefined;
  if (payload.regeneratePassword) {
    issuedPassword = generateEasyPassword();
    data.passwordHash = await bcrypt.hash(issuedPassword, 12);
  } else if (payload.temporaryPassword) {
    issuedPassword = payload.temporaryPassword;
    data.passwordHash = await bcrypt.hash(payload.temporaryPassword, 12);
  }

  if (payload.username !== undefined) {
    const u = payload.username.trim().toLowerCase();
    if (u && !isValidUsername(u)) {
      return NextResponse.json({ message: "اسم المستخدم غير صالح." }, { status: 400 });
    }
    data.username = u || null;
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
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
        username: payload.username,
        passwordReset: Boolean(issuedPassword),
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        roleLabel: ROLE_LABELS[user.role],
        permissions: ROLE_PERMISSIONS[user.role].map((key) => ({
          key,
          label: PERMISSION_CATALOG.find((p) => p.key === key)?.label ?? key,
        })),
        temporaryPassword: issuedPassword,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ message: "اسم المستخدم مستخدم مسبقًا." }, { status: 409 });
    }
    return NextResponse.json({ message: "تعذّر تحديث المستخدم." }, { status: 500 });
  }
}
