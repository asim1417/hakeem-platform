# مراجعة نهائية PR-1 (#536) — HKM-DOCUMENTS-UPGRADE-003

**تاريخ المراجعة:** 2026-07-28  
**قرار:** اعتماد بعد إصلاحات مراجعة (انظر أدناه)

## حالة PR عند بدء المراجعة

| البند | القيمة |
|---|---|
| الحالة | OPEN · Draft |
| قابل للدمج | MERGEABLE · CLEAN |
| base | main |
| head | `cursor/documents-platform-pr1-audit-dfcc` |
| SHA الأصلي | `8b4e1fb40a0caad791eddbc9fa196a8a8583f36d` |
| Actions | readiness ✅ · Vercel ✅ |
| التأخر عن main | 4 commits (دُمجت قبل الاعتماد) |

## جدول مراجعة الملفات

| الملف | الغرض | الخطورة | غير كاسر؟ | ملاحظات | القرار |
|---|---|---|---|---|---|
| `prisma/schema.prisma` | أعمدة/enums اختيارية | متوسطة | نعم | defaults فقط | قبول |
| `.../migration.sql` | SQL إضافي | عالية | نعم | أُزيلت UPDATEs الزائدة | قبول بعد تنظيف |
| `attachment-metadata.ts` | decoder + DTO | عالية | نعم | أولوية metadata الصريح | قبول |
| `attachments/route.ts` | رفع جديد | عالية | نعم | لا JSON في extractedText | قبول |
| `[id]/route.ts` | GET/DELETE | حرجة | نعم | ownsAttachment موحّد | قبول بعد إصلاح |
| `[id]/download/route.ts` | تنزيل | حرجة | نعم | نفس قاعدة الملكيّة | قبول بعد إصلاح |
| `ownership.ts` | عزل | حرجة | نعم | قضية > uploadedBy | قبول بعد تقوية |
| `migrate-attachment-metadata.ts` | ترحيل اختياري | متوسطة | نعم | دفعات + dry-run | قبول بعد تحسين |
| `test-attachments-regression.ts` | حماية | منخفضة | نعم | وسّعت لمصفوفة الملكيّة | قبول |
| `.eslintrc.json` | lint | منخفضة | نعم | next/core-web-vitals + plugin | قبول |
| `docs/document-platform/*` | تدقيق | منخفضة | نعم | — | قبول |

## عيوب مكتشفة وأُصلحت في جولة المراجعة

1. **ملكيّة موحّدة:** استخراج `ownsAttachment` إلى `ownership.ts` مع قاعدة: إن وُجد `caseId` تعتمد ملكيّة القضية فقط؛ `uploadedBy` لليتيم فقط؛ قضية محذوفة → رفض لغير المدير.
2. **سكربت الترحيل:** دفعات (100)، أعداد `scanned/eligible/migrated/skipped/failed`، عدم تسريب قيم، منطق قرار قابل للاختبار، exit code عند فشل.
3. **migration SQL:** إزالة UPDATEs الزائدة على كل الصفوف.
4. **JSON عام:** لا يُعامل كـ metadata في `parseAttachmentMetadata`.
5. **اختبارات:** مصفوفة ملكيّة + SharePoint قديم + ترحيل idempotent (28 اختبارًا).

## أولوية التعارض metadata

`metadata` العمود الصريح **يتفوّق** على JSON داخل `extractedText` (دمج: legacy ثم explicit).

## ترحيل البيانات

- `--apply` **لم يُشغَّل**.
- dry-run على قاعدة حقيقية: غير متاح في بيئة الوكيل (لا `DATABASE_URL`) — وُثّق؛ يُنفَّذ على staging قبل الإنتاج.

## بوابات بعد الإصلاح

تُسجَّل في commit المراجعة ووصف PR المحدَّث.
