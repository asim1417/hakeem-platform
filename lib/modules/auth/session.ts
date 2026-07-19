import "server-only";

import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import type { Permission } from "@/lib/modules/auth/rbac";
import { canUser } from "@/lib/modules/auth/rbac";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { ensureLocalUserFromClerk } from "@/lib/modules/auth/clerk-sync";

const guestEmail = "guest@hakeem.local";

export type SafeUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

/**
 * وضع التطوير بلا Clerk: يُسمح بزائر فقط إن لم تُضبط مفاتيح Clerk.
 * بعد ضبط Clerk تصبح المصادقة عبر Clerk حصريًا.
 */
function authRequired(): boolean {
  if (isClerkConfigured()) return true;
  const f = (process.env.REQUIRE_AUTH ?? "").toLowerCase();
  return f === "true" || f === "1" || f === "on";
}

export function isAuthDisabled() {
  return !authRequired();
}

async function getGuestUser(): Promise<SafeUser> {
  return prisma.user.upsert({
    where: { email: guestEmail },
    update: { isActive: true, role: "SYSTEM_ADMIN" },
    create: {
      name: "زائر النظام",
      email: guestEmail,
      passwordHash: "not-for-login",
      role: "SYSTEM_ADMIN",
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
}

async function resolveClerkUser(): Promise<SafeUser | null> {
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return null;

  const cu = await currentUser();
  const email =
    cu?.primaryEmailAddress?.emailAddress ||
    cu?.emailAddresses?.[0]?.emailAddress ||
    "";
  if (!email) return null;

  return ensureLocalUserFromClerk({
    clerkId: userId,
    email,
    name: [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || cu?.username,
  });
}

/** المستخدم الحالي من Clerk → صف Postgres. */
export async function getCurrentUser(): Promise<SafeUser | null> {
  if (isClerkConfigured()) {
    try {
      const user = await resolveClerkUser();
      if (user?.isActive) return user;
    } catch {
      /* Clerk غير جاهز وقت البناء/الإقلاع */
    }
    if (isAuthDisabled()) return getGuestUser();
    return null;
  }

  // بلا Clerk: لا جلسات قديمة — زائر تطوير فقط إن لم تُفرض المصادقة.
  if (isAuthDisabled()) return getGuestUser();
  return null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requirePagePermission(permission: Permission) {
  const user = await requireUser();
  const allowed = await canUser(user.id, permission);
  if (!allowed) redirect("/dashboard");
  return user;
}

export async function getApiUser(_request?: NextRequest) {
  return getCurrentUser();
}

export async function requireApiPermission(permission: Permission, request?: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return {
      user: null,
      response: NextResponse.json({ message: "يلزم تسجيل الدخول للوصول إلى هذه العملية." }, { status: 401 }),
    };
  }
  const allowed = await canUser(user.id, permission);
  if (!allowed) {
    await auditEvent({
      actorId: user.id,
      subject: "AUTH",
      action: "ACCESS_DENIED",
      metadata: { permission, path: request?.nextUrl.pathname },
    }).catch(() => undefined);
    return {
      user,
      response: NextResponse.json({ message: "لا تملك الصلاحية المطلوبة لهذه العملية." }, { status: 403 }),
    };
  }
  return { user, response: null };
}

/** @deprecated أُلغي مع Clerk — لا يُنشئ جلسة hakeem_session. */
export async function createLoginSession(_user: SafeUser) {
  /* no-op: الجلسة يديرها Clerk */
}

/** @deprecated */
export function clearLoginSession() {
  /* no-op */
}

export type { UserRole };
