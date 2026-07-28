# PR-1 — تقرير قبل / بعد

**المرجع:** HKM-DOCUMENTS-UPGRADE-002 · PR-1 الفحص والحماية  
**الفرع:** `cursor/documents-platform-pr1-audit-dfcc`

## قبل

| الأمر | النتيجة |
|---|---|
| typecheck | ✅ |
| lint | ❌ لا يوجد `.eslintrc` (تفاعلي) |
| test | ✅ |
| test:document-inspection | ✅ 81 |
| accuracy | ✅ CER=0 |
| test:doc-node | ✅ 7 |
| build | ✅ |
| اختبارات Attachment regression | ❌ غير موجودة |

## بعد

| الأمر | النتيجة |
|---|---|
| typecheck | ✅ |
| lint | ✅ (تحذيرات a11y/hooks قديمة غير كاسرة) |
| test | ✅ |
| test:document-inspection | ✅ 81 |
| accuracy | ✅ CER=0 |
| test:doc-node | ✅ 7 |
| test:attachments-regression | ✅ 18 |
| build | ✅ |

## ما تغيّر

- تقارير فحص: `docs/document-platform/*`
- decoder توافق: `decodeLegacyAttachmentPayload`
- أعمدة اختيارية على `Attachment` + enums + migration غير مدمرة
- رفع جديد → `metadata` صريح، `extractedText=null`، `processingStatus=UPLOADED`
- DTO متوافق عبر `toAttachmentDto`
- سكربت ترحيل اختياري: `npm run migrate:attachment-metadata -- --dry-run|--apply`
- اختبارات regression 1–13 (وحدة/ثابتة)
- إعداد ESLint أدنى لتمكين بوابة الدمج + إصلاح تعليق `eslint-disable` معطوب

## ما لم يُنفَّذ (عمدًا — PR لاحق)

- موصلات Google/Microsoft/Dropbox/Box
- SSRF / import-url
- Docling / OCRmyPDF / worker
- جداول pages/blocks
- تبويبات الاستيراد السحابي

## ما اختُبر بحساب حقيقي vs mock

| البند | الطريقة |
|---|---|
| decoder / DTO / MIME / ملكية where | وحدة + fixtures |
| processExtractedText مرجعي | وحدة حتمية |
| extractLocal/runEngine عقد المصدر | فحص ثابت للنص المصدري + test:doc-node |
| رفع/تنزيل فعلي لـ Azure/SharePoint | **غير مختبر بحساب حقيقي في هذه البيئة** |
| ترحيل DB `--apply` | **غير مُشغَّل** (يحتاج DATABASE_URL) |

## المخاطر المتبقية

1. سجلات قديمة تبقى بـ JSON في `extractedText` حتى تشغيل سكربت الترحيل يدويًا.
2. لا حد حجم على POST بعد.
3. حذف المرفق لا يحذف blob.
4. لا معالجة غير متزامنة بعد — الرفع يعيد UPLOADED فقط.
5. منصة `/documents` ما زالت منفصلة عن جدول Attachment.
