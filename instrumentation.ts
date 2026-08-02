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

  // محرك الجلسات — توسيع chat_conversations / chat_messages على Neon (idempotent).
  try {
    const { ensureConversationSessionSchema } = await import(
      "@/lib/modules/conversations/ensure-schema"
    );
    const ok = await ensureConversationSessionSchema();
    console.log(
      ok
        ? "[conversations.schema] مخطط محرك الجلسات جاهز."
        : "[conversations.schema] تعذّر تجهيز مخطط محرك الجلسات."
    );
  } catch (e) {
    console.warn("[conversations.schema] تعذّر التجهيز:", (e as Error)?.message);
  }

  // عدّاد استهلاك Claude — جدول ai_usage_events (idempotent).
  try {
    const { ensureAiUsageSchema } = await import("@/lib/modules/billing/ai-usage-meter");
    const ok = await ensureAiUsageSchema();
    console.log(
      ok
        ? "[ai.usage] جدول استهلاك Claude جاهز."
        : "[ai.usage] تعذّر تجهيز جدول استهلاك Claude."
    );
  } catch (e) {
    console.warn("[ai.usage] تعذّر التجهيز:", (e as Error)?.message);
  }

  // منظومة الفوترة — جداول الطبقة المالية + طبقة Buckets (idempotent). المرحلة 0.
  try {
    const { ensureBillingSchema } = await import("@/lib/modules/billing/ensure-billing-schema");
    const ok = await ensureBillingSchema();
    console.log(
      ok
        ? "[billing.schema] مخطط الفوترة جاهز."
        : "[billing.schema] تعذّر تجهيز مخطط الفوترة — راجع السجلّ."
    );
  } catch (e) {
    console.warn("[billing.schema] تعذّر التجهيز:", (e as Error)?.message);
  }

  // مواءمة المخطط السيادي — أعمدة/جداول إضافيّة idempotent (يزيل خطر ترتيب الهجرة).
  try {
    const { ensureBlueprintSchema } = await import(
      "@/lib/modules/observability/ensure-blueprint-schema"
    );
    const ok = await ensureBlueprintSchema();
    console.log(
      ok
        ? "[blueprint.schema] مخطط المواءمة جاهز."
        : "[blueprint.schema] بعض العبارات تُخطّيت — راجع السجلّ."
    );
  } catch (e) {
    console.warn("[blueprint.schema] تعذّر التجهيز:", (e as Error)?.message);
  }
}
