// ─────────────────────────────────────────────────────────────────────────────
// ensure-owner — تفعيل حساب المالك تلقائيًا داخل المنصة (بلا Vercel).
// يُستدعى عند إقلاع الخادم: ينشئ/يحدّث aasemalfarsi@gmail.com كـ SUPER_ADMIN.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";

// AUTH-001: لا كلمة مرور افتراضية مضمّنة في المصدر. المصادقة الرسمية عبر Clerk.
// كلمة مرور اختيارية للتزويد الأولي تُقرأ من البيئة فقط (OWNER_BOOTSTRAP_PASSWORD)،
// وتُستخدم **لإنشاء** حساب المالك أول مرة فقط — ولا تُعيد كتابة كلمة مرور حساب قائم أبدًا.
export const OWNER_DEFAULT_EMAIL = PLATFORM_OWNER_EMAILS[0];
export const OWNER_DEFAULT_USERNAME = "aasem.alfarsi";
export const OWNER_DEFAULT_NAME = "عاصم الفارسي";

/**
 * كلمة مرور التزويد الأولي: من البيئة إن وُجدت (≥ 8)، وإلا قيمة عشوائية غير معروفة
 * (لا يمكن الدخول بها) — لأن الدخول الرسمي عبر Clerk، لا كلمة مرور مضمّنة.
 */
function resolveBootstrapHash(): Promise<string> {
  const fromEnv = (process.env.OWNER_BOOTSTRAP_PASSWORD || "").trim();
  const secret = fromEnv.length >= 8 ? fromEnv : crypto.randomBytes(48).toString("base64url");
  return bcrypt.hash(secret, 12);
}

/**
 * يضمن **وجود** حساب المالك، بلا أي سلوك تدميري:
 *   • لا يُعيد كتابة passwordHash لحساب قائم (إصلاح AUTH-001).
 *   • لا يغيّر دور حساب قائم (يتفادى خطأ enum SUPER_ADMIN — DB-001 — قبل الترحيل المعتمد).
 *   • عند الإنشاء الأول فقط: يستخدم كلمة مرور من البيئة أو قيمة عشوائية غير معروفة.
 *
 * التزويد الفعّال (دور/كلمة مرور) عملية إدارية صريحة عبر scripts/ensure-owner-cli.ts،
 * لا تُنفَّذ تلقائيًّا عند كل إقلاع.
 */
export async function ensurePlatformOwner(opts: { allowRoleWrite?: boolean } = {}): Promise<{
  email: string;
  username: string;
  created: boolean;
  updated: boolean;
}> {
  const email = OWNER_DEFAULT_EMAIL;
  const username = OWNER_DEFAULT_USERNAME;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true, username: true },
  });

  if (!existing) {
    // تجنّب تصادم اسم المستخدم.
    let finalUsername = username;
    const taken = await prisma.user.findFirst({ where: { username: finalUsername, NOT: { email } }, select: { id: true } });
    if (taken) finalUsername = `${username}.owner`;
    await prisma.user.create({
      data: {
        name: OWNER_DEFAULT_NAME,
        email,
        username: finalUsername,
        passwordHash: await resolveBootstrapHash(),
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    return { email, username: finalUsername, created: true, updated: false };
  }

  // حساب قائم: لا نمسّ passwordHash إطلاقًا. نضمن التفعيل فقط، والدور فقط عند طلب صريح.
  const data: { isActive?: boolean; role?: "SUPER_ADMIN" } = {};
  if (!existing.isActive) data.isActive = true;
  if (opts.allowRoleWrite && existing.role !== "SUPER_ADMIN") data.role = "SUPER_ADMIN";
  let updated = false;
  if (Object.keys(data).length) {
    await prisma.user.update({ where: { email }, data });
    updated = true;
  }
  return { email, username: existing.username || username, created: false, updated };
}
