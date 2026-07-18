import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import {
  emailFromUsername,
  generateEasyPassword,
  generateUsername,
  isValidUsername,
  slugifyUsername,
} from "@/lib/modules/auth/credentials";
import { ROLE_PERMISSIONS } from "@/lib/modules/auth/role-permissions";
import { ROLE_LABELS, PERMISSION_CATALOG } from "@/lib/modules/auth/role-admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "اسم المستخدم مطلوب."),
  email: z.string().email("البريد الإلكتروني غير صالح.").optional().or(z.literal("")),
  username: z.string().min(3).max(32).optional().or(z.literal("")),
  role: z.nativeEnum(UserRole).default("TRAINEE"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  temporaryPassword: z.string().min(8, "كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف.").optional(),
  /** إن true يولّد اسم مستخدم وكلمة مرور سهلة إن لم تُمرَّرا. */
  generateCredentials: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
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

  return NextResponse.json({
    users: users.map((user) => ({ ...user, status: user.isActive ? "ACTIVE" : "INACTIVE" })),
    roles: ROLE_LABELS,
    permissionsByRole: Object.fromEntries(
      (Object.keys(ROLE_LABELS) as UserRole[]).map((role) => [
        role,
        ROLE_PERMISSIONS[role].map((key) => ({
          key,
          label: PERMISSION_CATALOG.find((p) => p.key === key)?.label ?? key,
        })),
      ])
    ),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;
  const actor = gate.user!;

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.errors[0]?.message ?? "بيانات غير صالحة." : "بيانات غير صالحة.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const shouldGenerate = payload.generateCredentials !== false;
  let username = (payload.username || "").trim().toLowerCase();
  if (!username && shouldGenerate) username = generateUsername(payload.name);
  if (username && !isValidUsername(username)) {
    return NextResponse.json({ message: "اسم المستخدم غير صالح (٣–٣٢ حرفًا لاتينيًا/أرقامًا)." }, { status: 400 });
  }

  let email = (payload.email || "").trim().toLowerCase();
  if (!email) {
    if (!username) return NextResponse.json({ message: "يلزم البريد أو اسم المستخدم." }, { status: 400 });
    email = emailFromUsername(username);
  }

  const temporaryPassword =
    payload.temporaryPassword || (shouldGenerate ? generateEasyPassword() : `Hakeem-${Math.random().toString(36).slice(2, 10)}!`);
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  // ضمان فرادة اسم المستخدم.
  if (username) {
    const taken = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
      select: { id: true },
    });
    if (taken) {
      username = `${slugifyUsername(username)}.${String(1000 + Math.floor(Math.random() * 9000))}`;
    }
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email,
        username: username || null,
        role: payload.role,
        isActive: payload.status === "ACTIVE",
        passwordHash,
      },
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
      action: "USER_CREATED",
      entityId: user.id,
      metadata: {
        description: `تم إنشاء مستخدم: ${user.name}`,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        temporaryPasswordIssued: true,
      },
    });

    const permissions = ROLE_PERMISSIONS[user.role].map((key) => ({
      key,
      label: PERMISSION_CATALOG.find((p) => p.key === key)?.label ?? key,
    }));

    return NextResponse.json(
      {
        user: {
          ...user,
          status: user.isActive ? "ACTIVE" : "INACTIVE",
          temporaryPassword,
          permissions,
          roleLabel: ROLE_LABELS[user.role],
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ message: "البريد أو اسم المستخدم مستخدم مسبقًا." }, { status: 409 });
    }
    return NextResponse.json({ message: "تعذّر إنشاء المستخدم." }, { status: 500 });
  }
}
