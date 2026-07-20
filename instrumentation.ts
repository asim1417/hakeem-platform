// يُنفَّذ مرّة واحدة عند إقلاع الخادم (Next.js instrumentation).
// يحمّل إعدادات اللوحة + يضمن عمود clerk_id. المصادقة عبر Clerk فقط.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { hydrateEnvFromSettings } = await import("@/lib/modules/settings/settings-service");
    const n = await hydrateEnvFromSettings();
    if (n > 0) console.log(`[settings] حُمِّل ${n} مفتاحًا من لوحة الإعدادات إلى البيئة.`);
  } catch (e) {
    console.warn("[settings] تعذّر تحميل الإعدادات:", (e as Error)?.message);
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_id" TEXT`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_key" ON "users" ("clerk_id")`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT`);
  } catch (e) {
    console.warn("[clerk] تعذّر تجهيز عمود clerk_id:", (e as Error)?.message);
  }

  // يضمن حساب المالك لدخول الطوارئ (قبل Clerk).
  try {
    const { ensurePlatformOwner } = await import("@/lib/modules/auth/ensure-owner");
    const owner = await ensurePlatformOwner();
    console.log(`[owner] جاهز للدخول الطارئ: ${owner.email}`);
  } catch (e) {
    console.warn("[owner] تعذّر تجهيز المالك:", (e as Error)?.message);
  }
}
