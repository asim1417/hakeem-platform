import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import type { Permission } from "@/lib/modules/auth/rbac";
import { canUser } from "@/lib/modules/auth/rbac";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { ensureLocalUserFromClerk } from "@/lib/modules/auth/clerk-sync";

const cookieName = "hakeem_session";
const maxAgeSeconds = 60 * 60 * 8;
const guestEmail = "guest@hakeem.local";

export type SafeUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

type SessionPayload = {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  exp: number;
  nonce: string;
};

function authRequired(): boolean {
  if (isClerkConfigured()) return true;
  const f = (process.env.REQUIRE_AUTH ?? "").toLowerCase();
  return f === "true" || f === "1" || f === "on";
}

export function isAuthDisabled() {
  return !authRequired();
}

function authSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" && authRequired()) {
    throw new Error("AUTH_SECRET غير مضبوط.");
  }
  return "hakeem-dev-only-insecure-secret";
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = base64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function decodeSession(value?: string): SessionPayload | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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

async function userFromOwnerCookie(cookieValue?: string): Promise<SafeUser | null> {
  const payload = decodeSession(cookieValue);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user?.isActive) return null;
  return user;
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

/** Clerk أولًا إن وُجد، ثم جلسة المالك الطارئة (hakeem_session). */
export async function getCurrentUser(): Promise<SafeUser | null> {
  if (isClerkConfigured()) {
    try {
      const user = await resolveClerkUser();
      if (user?.isActive) return user;
    } catch {
      /* */
    }
  }

  const fromCookie = await userFromOwnerCookie(cookies().get(cookieName)?.value).catch(() => null);
  if (fromCookie) return fromCookie;

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

export async function getApiUser(request?: NextRequest) {
  if (isClerkConfigured()) {
    try {
      const user = await resolveClerkUser();
      if (user?.isActive) return user;
    } catch {
      /* */
    }
  }
  const cookieValue = request?.cookies.get(cookieName)?.value ?? cookies().get(cookieName)?.value;
  const fromCookie = await userFromOwnerCookie(cookieValue).catch(() => null);
  if (fromCookie) return fromCookie;
  if (isAuthDisabled()) return getGuestUser();
  return null;
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

/** جلسة طوارئ للمالك (قبل ضبط Clerk أو كبديل). */
export async function createLoginSession(user: SafeUser) {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    exp: Date.now() + maxAgeSeconds * 1000,
    nonce: randomBytes(12).toString("hex"),
  };
  cookies().set(cookieName, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export function clearLoginSession() {
  cookies().set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export const OWNER_SESSION_COOKIE = cookieName;

export type { UserRole };
