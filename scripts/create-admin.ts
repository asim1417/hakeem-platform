/**
 * create-admin.ts — إنشاء/إعادة تعيين مستخدم أدمن في قاعدة البيانات (فكّ قفل الدخول).
 *
 * متغيّرات البيئة:
 *   ADMIN_EMAIL / INITIAL_ADMIN_EMAIL
 *   ADMIN_PASSWORD / INITIAL_ADMIN_PASSWORD
 *   ADMIN_NAME (اختياري)
 *   ADMIN_USERNAME (اختياري)
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugifyUsername } from "@/lib/modules/auth/credentials";

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "مدير منصة حكيم";
  let username = (process.env.ADMIN_USERNAME || "").toLowerCase().trim();
  if (!username && email.includes("@")) {
    username = slugifyUsername(email.split("@")[0] || "owner");
  }

  if (!email || !email.includes("@")) {
    console.error("::error::ADMIN_EMAIL غير صالح — اضبط سرّ ADMIN_EMAIL (أو INITIAL_ADMIN_EMAIL).");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("::error::ADMIN_PASSWORD قصيرة (<8) أو غير مضبوطة — اضبط سرّ ADMIN_PASSWORD بقيمة قوية تعرفها.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // تجنّب تصادم username مع مستخدم آخر.
  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { email } },
      select: { id: true },
    });
    if (taken) username = `${username}.${String(1000 + Math.floor(Math.random() * 9000))}`;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "SYSTEM_ADMIN",
      isActive: true,
      name,
      ...(username ? { username } : {}),
    },
    create: {
      name,
      email,
      username: username || null,
      passwordHash,
      role: "SYSTEM_ADMIN",
      isActive: true,
    },
    select: { id: true, email: true, username: true, role: true, isActive: true, name: true },
  });

  console.log(
    `✅ ${existing ? "أُعيد تعيين" : "أُنشئ"} أدمن: ${user.email}` +
      (user.username ? ` | username=${user.username}` : "") +
      ` | role=${user.role} | active=${user.isActive}`
  );
  console.log("سجّل الدخول بهذا البريد (أو اسم المستخدم) وكلمة المرور التي مرّرتها — لا تُطبع هنا.");
}

main()
  .catch((e) => {
    console.error("::error::فشل إنشاء الأدمن:", e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
