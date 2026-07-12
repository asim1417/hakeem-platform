// يُنفَّذ مرّة واحدة عند إقلاع الخادم (Next.js instrumentation). نُحمّل هنا إعدادات
// لوحة التحكم من قاعدة البيانات إلى process.env — فتعمل كل قرّاء المفاتيح دون تعديل.
// آمن تمامًا: أي فشل (جدول غير مُهاجَر/لا اتصال) يُتجاهَل وتبقى متغيّرات البيئة هي المصدر.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // القاعدة/التشفير في وقت Node فقط، لا edge.
  try {
    const { hydrateEnvFromSettings } = await import("@/lib/modules/settings/settings-service");
    const n = await hydrateEnvFromSettings();
    if (n > 0) console.log(`[settings] حُمِّل ${n} مفتاحًا من لوحة الإعدادات إلى البيئة.`);
  } catch (e) {
    console.warn("[settings] تعذّر تحميل الإعدادات (تبقى متغيّرات البيئة هي المصدر):", (e as Error)?.message);
  }
}
