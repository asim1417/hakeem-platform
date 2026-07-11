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

const guestEmail = "guest@hakeem.local";

// وضع «بدون تسجيل دخول»: مغلق افتراضيًا (المصادقة إلزامية). في الإنتاج لا يُسمح به إطلاقًا
// مهما كانت قيمة DISABLE_AUTH. خارج الإنتاج يُفعَّل صراحةً فقط بـ DISABLE_AUTH=true|1|on
// (لراحة التطوير المحلّي). [إصلاح تدقيق SEC-001: كان مفعّلاً افتراضيًا يرفع الزائر لأدمن.]
export function isAuthDisabled() {
  if (process.env.NODE_ENV === "production") return false;
  const flag = (process.env.DISABLE_AUTH ?? "").toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

// مستخدم تطوير محلّي بأدنى صلاحية (TRAINEE) — لا يُنشأ إلا خارج الإنتاج عبر isAuthDisabled.
// [إصلاح تدقيق SEC-001: كان يُنشأ بدور SYSTEM_ADMIN → تصعيد صلاحية كامل للزائر.]
async function getGuestUser(): Promise<SafeUser> {
  return prisma.user.upsert({
    where: { email: guestEmail },
    update: { isActive: true, role: "TRAINEE" },
    create: {
      name: "زائر التطوير",
      email: guestEmail,
      passwordHash: "not-for-login",
      role: "TRAINEE",
      isActive: true
    },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
}

type SessionPayload = {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  exp: number;
  nonce: string;
};

export type SafeUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

// [إصلاح تدقيق SEC-006: كان يعود لسرّ ثابت مكتوب → تزوير أي جلسة عند غياب المتغيّر.]
// في الإنتاج: سرّ إلزامي (يفشل الإقلاع/التوقيع بدونه). خارج الإنتاج: سرّ تطوير غير آمن.
function authSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET غير مضبوط — إلزامي في الإنتاج لتوقيع جلسات المستخدمين.");
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
  if (!payload) {
    if (isAuthDisabled()) return getGuestUser();
    return null;
  }
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
  if (!payload) {
    if (isAuthDisabled()) return getGuestUser();
    return null;
  }
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
