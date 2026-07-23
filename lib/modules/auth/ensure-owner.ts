// ─────────────────────────────────────────────────────────────────────────────
// ensure-owner — تفعيل حساب المالك تلقائيًا داخل المنصة (بلا Vercel).
// يُستدعى عند إقلاع الخادم: ينشئ/يحدّث aasemalfarsi@gmail.com كـ SUPER_ADMIN.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";

/** كلمة مرور المالك الافتراضية — يمكن تجاوزها بـ OWNER_BOOTSTRAP_PASSWORD في البيئة. */
export const OWNER_DEFAULT_PASSWORD = "Qalam-1703!";
export const OWNER_DEFAULT_EMAIL = PLATFORM_OWNER_EMAILS[0];
export const OWNER_DEFAULT_USERNAME = "aasem.alfarsi";
export const OWNER_DEFAULT_NAME = "عاصم الفارسي";

/**
 * يضمن وجود حساب المالك في القاعدة بصلاحية SUPER_ADMIN.
 * لا يطبع كلمة المرور. آمن عند التكرار (upsert).
 */
export async function ensurePlatformOwner(): Promise<{
  email: string;
  username: string;
  created: boolean;
  updated: boolean;
}> {
  const email = OWNER_DEFAULT_EMAIL;
  const username = OWNER_DEFAULT_USERNAME;
  const password = (process.env.OWNER_BOOTSTRAP_PASSWORD || OWNER_DEFAULT_PASSWORD).trim();
  if (password.length < 8) {
    throw new Error("OWNER_BOOTSTRAP_PASSWORD قصيرة جدًا.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true, username: true, passwordHash: true },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  // تجنّب تصادم اسم المستخدم.
  let finalUsername = username;
  const taken = await prisma.user.findFirst({
    where: { username: finalUsername, NOT: { email } },
    select: { id: true },
  });
  if (taken) finalUsername = `${username}.owner`;

  if (!existing) {
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

  // إعادة فتح قفل المالك: دور سوبر أدمن + كلمة مرور معروفة (تفعيل من داخل المنصة بلا Vercel).
  await prisma.user.update({
    where: { email },
    data: {
      name: OWNER_DEFAULT_NAME,
      role: "SUPER_ADMIN",
      isActive: true,
      username: existing.username || finalUsername,
      passwordHash,
    },
  });

  return { email, username: existing.username || finalUsername, created: false, updated: true };
}
