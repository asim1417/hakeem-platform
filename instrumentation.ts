// يُنفَّذ مرّة واحدة عند إقلاع الخادم (Next.js instrumentation).
//
// RUN-001: هذا الملف **لا ينفّذ DDL ولا يعدّل المخطط ولا يزوّد حسابات** عند الإقلاع.
// تشغيل ALTER/CREATE أو تزويد المالك في مسار serverless يربط صحة الطلب العام ببنية
// تحتية، ويسبب تأخيرًا وسباقات وأخطاء enum. جميع تلك العمليات انتقلت إلى أمر إداري
// صريح: `npm run db:ensure-schema` (scripts/db-ensure-schema.ts) يُشغَّل ضمن نافذة
// صيانة/ترحيل مراجَعة. هنا نكتفي بتحميل الإعدادات (قراءة) فقط.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { hydrateEnvFromSettings } = await import("@/lib/modules/settings/settings-service");
    const n = await hydrateEnvFromSettings();
    if (n > 0) console.log(`[settings] حُمِّل ${n} مفتاحًا من لوحة الإعدادات إلى البيئة.`);
  } catch (e) {
    console.warn("[settings] تعذّر تحميل الإعدادات:", (e as Error)?.message);
  }
}
