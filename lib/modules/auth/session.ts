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

function flagOn(raw: string | undefined): boolean {
  const f = (raw ?? "").toLowerCase();
  return f === "true" || f === "1" || f === "on";
}

/**
 * المصادقة إلزامية عندما:
 * - مفاتيح Clerk مضبوطة، أو
 * - REQUIRE_AUTH=true، أو
 * - بيئة الإنتاج (إلا بمخرج طوارئ صريح ALLOW_UNAUTHENTICATED_GUEST=true).
 * التطوير المحلي يبقى مفتوحًا ما لم يُضبط REQUIRE_AUTH.
 */
function authRequired(): boolean {
  if (isClerkConfigured()) return true;
  if (flagOn(process.env.REQUIRE_AUTH)) return true;
  if (process.env.NODE_ENV === "production") {
    if (flagOn(process.env.ALLOW_UNAUTHENTICATED_GUEST)) return false;
    return true;
  }
  return false;
}

export function isAuthDisabled() {
  return !authRequired();
}

function authSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
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

/**
 * زائر التطوير فقط (عند تعطيل المصادقة محليًا).
 * دور TRAINEE بأدنى صلاحية — لا SYSTEM_ADMIN أبدًا.
 * إن وُجد صف قديم بدور أعلى يُخفَّض عند كل upsert.
 */
async function getGuestUser(): Promise<SafeUser> {
  return prisma.user.upsert({
    where: { email: guestEmail },
    update: { isActive: true, role: "TRAINEE" },
    create: {
      name: "زائر النظام",
      email: guestEmail,
      passwordHash: "not-for-login",
      role: "TRAINEE",
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

/**
 * جلسة أولى الطرف (hakeem_session) أولًا — مسار Google الأصلي ومالك المنصة.
 * ثم Clerk إن وُجد. هذا يمنع فشل مزامنة Clerk من حجب دخول المالك بعد OAuth ناجح.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const fromCookie = await userFromOwnerCookie(cookies().get(cookieName)?.value).catch(() => null);
  if (fromCookie) return fromCookie;

  if (isClerkConfigured()) {
    try {
      const user = await resolveClerkUser();
      if (user?.isActive) return user;
    } catch {
      /* */
    }
  }

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
  const cookieValue = request?.cookies.get(cookieName)?.value ?? cookies().get(cookieName)?.value;
  const fromCookie = await userFromOwnerCookie(cookieValue).catch(() => null);
  if (fromCookie) return fromCookie;

  if (isClerkConfigured()) {
    try {
      const user = await resolveClerkUser();
      if (user?.isActive) return user;
    } catch {
      /* */
    }
  }
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

function buildSessionToken(user: SafeUser): string {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    exp: Date.now() + maxAgeSeconds * 1000,
    nonce: randomBytes(12).toString("hex"),
  };
  return encodeSession(payload);
}

function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge: maxAgeSeconds,
    path: "/",
  };
}

/** جلسة طوارئ للمالك (قبل ضبط Clerk أو كبديل). */
export async function createLoginSession(user: SafeUser) {
  const secure = process.env.NODE_ENV === "production";
  cookies().set(cookieName, buildSessionToken(user), sessionCookieOptions(secure));
}

/**
 * يُرفِق hakeem_session على استجابة Redirect صراحةً —
 * لا تعتمد فقط على cookies().set مع NextResponse.redirect (سباق بعد Google).
 */
export function attachLoginSessionCookie(
  res: NextResponse,
  user: SafeUser,
  opts?: { secure?: boolean }
) {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  res.cookies.set(cookieName, buildSessionToken(user), sessionCookieOptions(secure));
}

/** ينسخ الكوكي الحالية من مخزن الطلب إلى استجابة التحويل إن وُجدت. */
export function mirrorLoginSessionCookie(res: NextResponse, opts?: { secure?: boolean }) {
  const value = cookies().get(cookieName)?.value;
  if (!value) return false;
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  res.cookies.set(cookieName, value, sessionCookieOptions(secure));
  return true;
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
