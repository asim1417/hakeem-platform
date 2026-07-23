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

/**
 * يضمن صفًا محليًا لمستخدم Clerk.
 * مالك المنصة بالبريد → SUPER_ADMIN. مدراء OAUTH_ADMIN_EMAILS → SYSTEM_ADMIN عند الإنشاء.
 */
export async function ensureLocalUserFromClerk(identity: ClerkIdentity): Promise<LocalUser> {
  const email = identity.email.toLowerCase().trim();
  const clerkId = identity.clerkId.trim();
  if (!email || !clerkId) {
    throw new Error("هوية Clerk غير مكتملة (بريد أو clerkId).");
  }

  const existingByClerk = await prisma.user.findFirst({
    where: { clerkId },
    select: { id: true, name: true, email: true, role: true, isActive: true, clerkId: true },
  });

  const existingByEmail = existingByClerk
    ? null
    : await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, role: true, isActive: true, clerkId: true },
      });

  const existing = existingByClerk ?? existingByEmail;
  const isOwner = isPlatformOwnerEmail(email);
  const isDelegatedAdmin = !isOwner && isOAuthAdminEmail(email);
  const role: UserRole = isOwner
    ? "SUPER_ADMIN"
    : existing?.role ?? (isDelegatedAdmin ? "SYSTEM_ADMIN" : "TRAINEE");
  const displayName =
    identity.name?.trim() ||
    existing?.name ||
    (isOwner ? "عاصم الفارسي" : email.split("@")[0] || "مستخدم");

  if (!existing) {
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
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      clerkId,
      email,
      name: displayName,
      role,
      isActive: true,
      passwordHash: "clerk:no-password",
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  return updated;
}

export async function deactivateLocalUserByClerkId(clerkId: string): Promise<void> {
  await prisma.user
    .updateMany({
      where: { clerkId },
      data: { isActive: false },
    })
    .catch(() => undefined);
}
