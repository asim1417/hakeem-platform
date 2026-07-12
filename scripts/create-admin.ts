/**
 * create-admin.ts — إنشاء/إعادة تعيين مستخدم أدمن في قاعدة البيانات (فكّ قفل الدخول).
 *
 * يقرأ البريد وكلمة المرور من متغيّرات البيئة (تُمرَّر كأسرار GitHub — مُقنّعة في السجلّ):
 *   ADMIN_EMAIL     (أو INITIAL_ADMIN_EMAIL)     — بريد الدخول.
 *   ADMIN_PASSWORD  (أو INITIAL_ADMIN_PASSWORD)  — كلمة المرور (لا تُطبع أبدًا).
 *
 * السلوك: upsert — ينشئ الأدمن إن غاب، ويُعيد تعيين كلمة مروره + يُفعّله + يرفعه
 * SYSTEM_ADMIN إن وُجد. لا يطبع كلمة المرور إطلاقًا (المستودع عام). قراءةٌ آمنة لكل شيء عداه.
 *
 * التشغيل عبر workflow: create-admin.yml (يملك NEON_DATABASE_URL + الأسرار).
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "مدير منصة حكيم";

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

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SYSTEM_ADMIN", isActive: true },
    create: { name, email, passwordHash, role: "SYSTEM_ADMIN", isActive: true },
    select: { id: true, email: true, role: true, isActive: true }
  });

  // لا نطبع كلمة المرور أبدًا — فقط تأكيد العملية.
  console.log(`✅ ${existing ? "أُعيد تعيين" : "أُنشئ"} أدمن: ${user.email} | role=${user.role} | active=${user.isActive}`);
  console.log("سجّل الدخول بهذا البريد وكلمة المرور التي ضبطتها في السرّ ADMIN_PASSWORD.");
}

main()
  .catch((e) => {
    console.error("::error::فشل إنشاء الأدمن:", e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
