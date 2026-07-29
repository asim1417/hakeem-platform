// ─────────────────────────────────────────────────────────────────────────────
// ensure-owner — تفعيل حساب المالك تلقائيًا داخل المنصة (بلا Vercel).
// يُستدعى عند إقلاع الخادم: ينشئ/يحدّث aasemalfarsi@gmail.com كـ SUPER_ADMIN.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";

/**
 * كلمة مرور أولية عند الإنشاء فقط — لا تُعاد كتابتها عند كل إقلاع.
 * الإنتاج: يلزم OWNER_BOOTSTRAP_PASSWORD صريح عند إنشاء الحساب لأول مرة.
 * إعادة التعيين لاحقًا فقط عبر OWNER_FORCE_PASSWORD_RESET=true + OWNER_BOOTSTRAP_PASSWORD.
 */
export const OWNER_DEFAULT_PASSWORD = "Qalam-1703!";
export const OWNER_DEFAULT_EMAIL = PLATFORM_OWNER_EMAILS[0];
export const OWNER_DEFAULT_USERNAME = "aasem.alfarsi";
export const OWNER_DEFAULT_NAME = "عاصم الفارسي";

function flagOn(raw: string | undefined): boolean {
  const f = (raw ?? "").toLowerCase();
  return f === "true" || f === "1" || f === "on";
}

/**
 * يضمن وجود حساب المالك في القاعدة بصلاحية SUPER_ADMIN.
 * لا يطبع كلمة المرور. لا يعيد ضبط كلمة المرور في كل إقلاع.
 */
export async function ensurePlatformOwner(): Promise<{
  email: string;
  username: string;
  created: boolean;
  updated: boolean;
}> {
  const email = OWNER_DEFAULT_EMAIL;
  const username = OWNER_DEFAULT_USERNAME;
  const bootstrap = (process.env.OWNER_BOOTSTRAP_PASSWORD || "").trim();
  const forceReset = flagOn(process.env.OWNER_FORCE_PASSWORD_RESET);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true, username: true, passwordHash: true },
  });

  // تجنّب تصادم اسم المستخدم.
  let finalUsername = username;
  const taken = await prisma.user.findFirst({
    where: { username: finalUsername, NOT: { email } },
    select: { id: true },
  });
  if (taken) finalUsername = `${username}.owner`;

  if (!existing) {
    const password =
      bootstrap ||
      (process.env.NODE_ENV === "production" ? "" : OWNER_DEFAULT_PASSWORD);
    if (password.length < 8) {
      throw new Error(
        "OWNER_BOOTSTRAP_PASSWORD مطلوبة لإنشاء حساب المالك (٨ أحرف على الأقل)."
      );
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        name: OWNER_DEFAULT_NAME,
        email,
        username: finalUsername,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    return { email, username: finalUsername, created: true, updated: false };
  }

  const data: {
    name: string;
    role: "SUPER_ADMIN";
    isActive: boolean;
    username: string;
    passwordHash?: string;
  } = {
    name: OWNER_DEFAULT_NAME,
    role: "SUPER_ADMIN",
    isActive: true,
    username: existing.username || finalUsername,
  };

  // إعادة ضبط كلمة المرور فقط بقرار صريح — لا عند كل إقلاع.
  if (forceReset) {
    if (bootstrap.length < 8) {
      throw new Error("OWNER_FORCE_PASSWORD_RESET يتطلّب OWNER_BOOTSTRAP_PASSWORD (≥٨).");
    }
    data.passwordHash = await bcrypt.hash(bootstrap, 12);
  }

  await prisma.user.update({ where: { email }, data });

  return { email, username: existing.username || finalUsername, created: false, updated: true };
}
