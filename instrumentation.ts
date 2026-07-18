// يُنفَّذ مرّة واحدة عند إقلاع الخادم (Next.js instrumentation). نُحمّل هنا إعدادات
// لوحة التحكم من قاعدة البيانات إلى process.env — فتعمل كل قرّاء المفاتيح دون تعديل.
// كذلك نُفعّل حساب المالك تلقائيًا داخل المنصة (بلا الحاجة لـ Vercel).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // القاعدة/التشفير في وقت Node فقط، لا edge.

  try {
    const { hydrateEnvFromSettings } = await import("@/lib/modules/settings/settings-service");
    const n = await hydrateEnvFromSettings();
    if (n > 0) console.log(`[settings] حُمِّل ${n} مفتاحًا من لوحة الإعدادات إلى البيئة.`);
  } catch (e) {
    console.warn("[settings] تعذّر تحميل الإعدادات (تبقى متغيّرات البيئة هي المصدر):", (e as Error)?.message);
  }

  // تفعيل المالك aasemalfarsi@gmail.com تلقائيًا في القاعدة.
  try {
    const { ensurePlatformOwner } = await import("@/lib/modules/auth/ensure-owner");
    // عمود username قد يغيب قبل أول migration — نحاول إضافته بهدوء.
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username")`);
    } catch {
      // الجدول غير جاهز بعد — يُعاد عند الإقلاع التالي.
    }
    const owner = await ensurePlatformOwner();
    console.log(
      `[owner] حساب المالك جاهز: ${owner.email}` +
        (owner.created ? " (أُنشئ)" : owner.updated ? " (حُدّث)" : "")
    );
  } catch (e) {
    console.warn("[owner] تعذّر تفعيل حساب المالك عند الإقلاع:", (e as Error)?.message);
  }
}
