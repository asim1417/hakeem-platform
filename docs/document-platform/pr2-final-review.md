# مراجعة نهائية PR-2 (#543) — HKM-DOCUMENTS-UPGRADE-004

**تاريخ:** 2026-07-28  
**قرار:** اعتماد بعد إصلاحات أمنية

## حالة عند المراجعة

| البند | القيمة |
|---|---|
| Draft | نعم → Ready بعد الإصلاح |
| base/head | main / `cursor/documents-pr2-direct-url-dfcc` |
| SHA الأصلي | `13b027c…` |
| مبني على PR-1 | نعم (`87b895d`) |
| Feature flag افتراضي | `false` |
| Actions | readiness ✅ · Vercel ✅ |

## جدول الملفات

| الملف | الغرض | الخطورة | الخلل المحتمل | الاختبار | القرار |
|---|---|---|---|---|---|
| `inspect-url/route.ts` | فحص رابط | عالية | كشف قبل flag | flag-before-network | قبول بعد تعزيز |
| `import-url/route.ts` | استيراد | حرجة | URL خام / فشل تخزين | regression+direct-url | قبول بعد redact + STORAGE_UPLOAD_FAILED |
| `url-security.ts` | SSRF | حرجة | trailing-dot / IP غريب | 37 اختبارًا | قبول بعد تقوية |
| `direct-url.ts` | تنزيل | حرجة | inspect يسحب جسمًا كبيرًا | inspect cap 64KB | قبول بعد drain محدود |
| `mime-sniff.ts` | MIME | عالية | ZIP/EXE متنكر | zip+mz tests | قبول |
| `filename.ts` | أسماء | متوسطة | bidi/devices | sanitize tests | قبول |
| `blob-storage.ts` | رفع مسار | متوسطة | ذاكرة | path upload | قبول |
| `test-direct-url.ts` | حماية | منخفضة | — | 37 | قبول |
| `feature-flags.ts` | حدود | متوسطة | — | env defaults | قبول |

## إصلاحات جولة المراجعة

1. `redactSensitiveUrl` موحّد + مفاتيح SAS/se/sp/sv.
2. طبْع trailing-dot ورفض IP غير معياري (أو التقاطه بعد تطبيع WHATWG كـ loopback).
3. `DOCUMENT_URL_INSPECT_MAX_BYTES=65536` + مهلة inspect أقصر + drain محدود.
4. رموز خطأ أوضح: `URL_REJECTED`, `REMOTE_TIMEOUT`, `UNSUPPORTED_MIME`, `DOWNLOAD_INTERRUPTED`, `STORAGE_UPLOAD_FAILED`.
5. رفض MZ/ELF/ZIP العام.
6. اختبار يثبت فحص العلم قبل أي موصل/شبكة.

## قيد DNS Rebinding (صريح)

لا socket IP pinning كامل على undici/Vercel. الحماية: حل كل العناوين، رفض الخاص والخلط، إعادة الفحص لكل redirect، `redirect:"manual"`.

## Feature Flag

يبقى **معطّلًا** بعد الدمج على الإنتاج.
