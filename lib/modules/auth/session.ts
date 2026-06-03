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

const cookieName = "hakeem_session";
const maxAgeSeconds = 60 * 60 * 8;

type SessionPayload = {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  exp: number;
  nonce: string;
};

export type SafeUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "hakeem-mvp-development-secret-change-me";
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

export async function createLoginSession(user: SafeUser) {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    exp: Date.now() + maxAgeSeconds * 1000,
    nonce: randomBytes(12).toString("hex")
  };
  cookies().set(cookieName, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
    path: "/"
  });
}

export function clearLoginSession() {
  cookies().set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const payload = decodeSession(cookies().get(cookieName)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
  if (!user?.isActive) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
  const payload = decodeSession(cookieValue);
  if (!payload) return null;
  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
}

export async function requireApiPermission(permission: Permission, request?: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return { user: null, response: NextResponse.json({ message: "يلزم تسجيل الدخول للوصول إلى هذه العملية." }, { status: 401 }) };
  }
  const allowed = await canUser(user.id, permission);
  if (!allowed) {
    await auditEvent({
      actorId: user.id,
      subject: "AUTH",
      action: "ACCESS_DENIED",
      metadata: { permission, path: request?.nextUrl.pathname }
    }).catch(() => undefined);
    return { user, response: NextResponse.json({ message: "لا تملك الصلاحية المطلوبة لهذه العملية." }, { status: 403 }) };
  }
  return { user, response: null };
}
