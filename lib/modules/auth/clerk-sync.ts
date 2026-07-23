// ─────────────────────────────────────────────────────────────────────────────
// مزامنة مستخدم Clerk → جدول users في Postgres + تهيئة onboarding/نقاط.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import { prisma } from "@/lib/prisma";
import { isOAuthAdminEmail, isPlatformOwnerEmail } from "@/lib/modules/auth/oauth-shared";
import { bootstrapNewUser } from "@/lib/modules/onboarding/bootstrap";
import type { UserRole } from "@prisma/client";

export type ClerkIdentity = {
  clerkId: string;
  email: string;
  name?: string | null;
};

type LocalUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

async function roleForEmail(email: string, existingRole?: UserRole | null): Promise<UserRole> {
  const isOwner = isPlatformOwnerEmail(email);
  const isDelegatedAdmin = !isOwner && isOAuthAdminEmail(email);
  if (isOwner) return "SUPER_ADMIN";
  if (existingRole) return existingRole;
  return isDelegatedAdmin ? "SYSTEM_ADMIN" : "TRAINEE";
}

/**
 * يضمن صفًا محليًا لمستخدم Clerk.
 * يحل تعارض clerkId/email (شائع لحساب المالك المُنشأ عبر ensure-owner ثم Clerk).
 */
export async function ensureLocalUserFromClerk(identity: ClerkIdentity): Promise<LocalUser> {
  const email = identity.email.toLowerCase().trim();
  const clerkId = identity.clerkId.trim();
  if (!email || !clerkId) {
    throw new Error("هوية Clerk غير مكتملة (بريد أو clerkId).");
  }

  const [byClerk, byEmail] = await Promise.all([
    prisma.user.findFirst({
      where: { clerkId },
      select: { id: true, name: true, email: true, role: true, isActive: true, clerkId: true },
    }),
    prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, isActive: true, clerkId: true },
    }),
  ]);

  // صفّان مختلفان لنفس الهوية — حرّر clerkId من الصف القديم واربطه بصف البريد.
  if (byClerk && byEmail && byClerk.id !== byEmail.id) {
    await prisma.user
      .update({
        where: { id: byClerk.id },
        data: { clerkId: null },
      })
      .catch(() => undefined);
  } else if (!byEmail && byClerk && byClerk.email.toLowerCase() !== email) {
    // clerkId مربوط ببريد آخر — حرّره قبل الربط بالبريد الحالي.
    await prisma.user
      .update({
        where: { id: byClerk.id },
        data: { clerkId: null },
      })
      .catch(() => undefined);
  } else {
    // أزل أي حامل آخر لنفس clerkId (غير صف البريد).
    await prisma.user
      .updateMany({
        where: {
          clerkId,
          ...(byEmail ? { NOT: { id: byEmail.id } } : {}),
        },
        data: { clerkId: null },
      })
      .catch(() => undefined);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true, clerkId: true },
  });

  const isOwner = isPlatformOwnerEmail(email);
  const role = await roleForEmail(email, existing?.role);
  const displayName =
    identity.name?.trim() ||
    existing?.name ||
    (isOwner ? "عاصم الفارسي" : email.split("@")[0] || "مستخدم");

  if (!existing) {
    try {
      const created = await prisma.user.create({
        data: {
          name: displayName,
          email,
          clerkId,
          passwordHash: "clerk:no-password",
          role,
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      await bootstrapNewUser(created.id, { skipOnboarding: isOwner }).catch(() => undefined);
      return created;
    } catch (err) {
      // إن فشل SUPER_ADMIN (هجرة ناقصة) أعد المحاولة كمدير نظام للمالك فقط.
      if (isOwner && role === "SUPER_ADMIN") {
        const created = await prisma.user.create({
          data: {
            name: displayName,
            email,
            clerkId,
            passwordHash: "clerk:no-password",
            role: "SYSTEM_ADMIN",
            isActive: true,
          },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });
        await bootstrapNewUser(created.id, { skipOnboarding: true }).catch(() => undefined);
        return created;
      }
      throw err;
    }
  }

  try {
    return await prisma.user.update({
      where: { id: existing.id },
      data: {
        clerkId,
        email,
        name: displayName,
        role,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  } catch (err) {
    if (isOwner && role === "SUPER_ADMIN") {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          clerkId,
          email,
          name: displayName,
          role: "SYSTEM_ADMIN",
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
    }
    throw err;
  }
}

export async function deactivateLocalUserByClerkId(clerkId: string): Promise<void> {
  await prisma.user
    .updateMany({
      where: { clerkId },
      data: { isActive: false },
    })
    .catch(() => undefined);
}
