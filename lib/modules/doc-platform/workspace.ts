// مساحة عمل منصة الوثائق — هوية متصفح عبر كوكي httpOnly (بلا حساب).
// عند تفعيل مصادقة كاملة لاحقاً تُربط المساحة بالمستخدم بدل الكوكي.

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "docplatform_ws";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // سنة

export interface WorkspaceRef {
  id: string;
  token: string;
}

/** يعيد مساحة العمل الحالية أو ينشئها ويثبّت الكوكي */
export async function getOrCreateWorkspace(): Promise<WorkspaceRef> {
  const store = cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) {
    const ws = await prisma.docWorkspace.findUnique({ where: { token: existing }, select: { id: true, token: true } });
    if (ws) return ws;
  }
  const token = randomBytes(16).toString("hex");
  const ws = await prisma.docWorkspace.create({ data: { token }, select: { id: true, token: true } });
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  });
  return ws;
}

/** يعيد مساحة العمل الحالية دون إنشاء (null إن لم توجد) */
export async function getWorkspace(): Promise<WorkspaceRef | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return prisma.docWorkspace.findUnique({ where: { token }, select: { id: true, token: true } });
}

/** رسالة خطأ ودّية عندما تكون جداول المنصة غير منشأة بعد (قبل db:push) */
export function isMissingTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("does not exist") || (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2021");
}

export const MISSING_TABLE_MESSAGE =
  "جداول منصة الوثائق غير مهيأة بعد — شغّل: npm run db:push (أو workflow doc-platform-db-push)";
