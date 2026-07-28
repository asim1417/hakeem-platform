# HKM-DOCUMENTS-UPGRADE-002 — تقرير فحص الحالة الحالية

**المرجع:** PR-1 · مرحلة صفر  
**تاريخ الفحص:** 2026-07-28  
**المستودع:** asim1417/hakeem-platform  
**Commit الأساس:** `1180190ca332aa71cad6ebfd83488421c8d14944`

---

## الخلاصة

منصة الوثائق في حكيم ليست مسارًا واحدًا. توجد **ثلاث طبقات متوازية**:

1. **Prisma `Attachment` + `/api/attachments` + `/dashboard/attachments`** — سجل مرفقات MVP يخزّن JSON metadata داخل `extractedText`.
2. **`/documents` (منصة الوثائق)** — استخراج عربي في المتصفح عبر `doc-tool` / `document-inspection`، مع حفظ اختياري في workspace محلي/حساب.
3. **`services/doc-node`** — خادم Node للاستخراج (local → Gemini → QARI) يمر عبر `processExtractedText`، **غير مربوط** بنموذج `Attachment`.

«اسأل حكيم» يستخدم مسار المتصفح (2) وليس جدول `Attachment`.

---

## ما يعمل

| المسار | الحالة |
|---|---|
| `POST/GET /api/attachments` | يعمل مع RBAC (`ATTACHMENTS_FULL` / `LIMITED`) |
| رفع ملف إلى Azure Blob أو SharePoint أو metadata-only | يعمل حسب متغيرات البيئة |
| ربط المرفق بقضية مملوكة (`assertCaseOwnedForAttachment`) | يعمل (يمنع IDOR على POST) |
| قائمة المرفقات المعزولة بـ `attachmentListWhere` | تعمل (قضية أو `uploadedBy` في JSON) |
| تنزيل Azure عبر SAS + SharePoint عبر `storageUrl` في JSON | يعمل على مستوى API |
| حذف المرفق (صف DB فقط، بلا حذف blob) | يعمل للمرفقات المرتبطة بقضية يملكها المستخدم/المدير |
| `processExtractedText` + اختبارات document-inspection | يعمل (81 اختبارًا) |
| `extractLocal` / `runEngine` في doc-node | يعمل (7 اختبارات) |
| استخراج المرفقات في اسأل حكيم (متصفح + OCR سحابي اختياري) | يعمل مستقلًا عن `Attachment` |
| بناء الإنتاج (`npm run build`) | ينجح |
| `npm run typecheck` | ينجح |

---

## ما لا يعمل / ناقص

| المشكلة | الأثر |
|---|---|
| لا استخراج نص عند رفع `Attachment` | `extractedText` = JSON metadata وليس نص الوثيقة |
| لا عمود `metadata` منفصل | تلوث دلالي لكامل حقل النص |
| لا `processingStatus` على `Attachment` | لا مراحل معالجة مرئية للمرفق المخزَّن |
| لا حد حجم على `POST /api/attachments` | خطر DoS/ذاكرة |
| حذف المرفق لا يحذف blob | تسريب تخزين |
| GET/DELETE للمرفق اليتيم (بلا قضية) | المالك يراه في القائمة عبر `uploadedBy` لكن لا يستطيع GET/DELETE (فقط المدير) |
| واجهة التنزيل تظهر فقط لـ `azure-blob` | روابط SharePoint مخفية في UI رغم دعم API |
| لا ربط حقيقي لـ استشارة/محاكاة | `relationType` يُحفظ في JSON فقط |
| `npm run lint` | يفشل مسبقًا: لا يوجد `.eslintrc` — `next lint` يطلب إعدادًا تفاعليًا |

---

## موجود لكنه غير مربوط بـ Attachment

- `lib/modules/document-inspection/**` بما فيها `processExtractedText`
- `services/doc-node/**` (`extractLocal`, `runEngine`, jobs)
- واجهة `/documents` و`/documents/app` و`/documents/tool`
- مسار اسأل حكيم (`HakeemAskWorkspace` + `doc-tool/extract`)
- مرفقات المساعد القضائي (JSON على `JudicialWorkCase.attachments`)
- `MessageAttachmentRef.processingStatus` (`inline|pending|ready|failed`) — يُستخدم `inline` فقط
- إشارات Google Drive في landing منصة الوثائق (تهيئة جزئية عبر env)

---

## التعارضات

| التعارض | التفصيل |
|---|---|
| معنيان لـ `extractedText` | Attachment = JSON metadata · Ask/JA = نص حقيقي |
| معنيان لـ `runEngine` | doc-node OCR · agent-runtime بحث قانوني |
| منتجان «مرفقات» | Dashboard Attachment vs مرفقات المساعد القضائي JSON |
| واجهة vs تخزين | النص يقول «بلا تخزين دائم» بينما الكود يدعم Azure/SharePoint |
| قائمة vs GET ملكية | القائمة تقبل `uploadedBy`؛ المسارات بالمعرّف تتطلب مالك القضية |

---

## البيانات القديمة

- كل سجلات `Attachment` الحالية (إن وُجدت) يُتوقَّع أن تحتوي JSON داخل `extractedText` بالمفاتيح: `storageMode`, `storageUrl`, `uploadedBy`, `relationType`, `size`, `note`.
- `parseAttachmentMetadata` عند فشل JSON يعيد `{ note: value }` — أي نص حقيقي قديم سيظهر كملاحظة.
- لا يوجد عمود `metadata`؛ أي ترحيل يجب أن يكون script اختياريًا وليس جزءًا من migration النشر.

---

## المسارات الحساسة للكسر

1. `extractedText` JSON → تنزيل SharePoint + قائمة الملكية + DTO الحجم/الوضع.
2. شكل DTO الحالي (`id`, `fileName`, `mimeType`, `storageKey`, `createdAt`, `caseFile`, + metadata spread).
3. `requireApiPermission` و`assertCaseOwnedForAttachment`.
4. `processExtractedText` — مصدر الحقيقة بعد الاستخراج؛ لا يُستبدل ولا يُتجاوز.
5. مسارات API: `/api/attachments`, `/api/attachments/[id]`, `/api/attachments/[id]/download`.
6. واجهة `AttachmentsManager` تعتمد على نفس DTO.

---

## نموذج Attachment الحالي (قبل PR-1)

```
id, caseId?, fileName, mimeType, storageKey, extractedText?, createdAt
```

لا: `metadata`, `processingStatus`, `sourceProvider`, `sha256`, صفحات، كتل.

---

## تدفق الرفع الحالي (POST)

1. صلاحية `ATTACHMENTS_FULL`
2. فحص MIME (PDF/DOCX/TXT/PNG/JPEG) — بلا حد حجم
3. ملكية القضية إن رُبطت
4. `uploadAttachmentBlob`
5. `extractedText = JSON.stringify(metadata)` — **لا OCR**
6. HTTP 201 + DTO

---

## البيئة والنشر

- Frontend/API: Next.js على Vercel (مستنتج من البنية و`next.config`).
- تخزين: Azure Blob أو SharePoint Graph أو metadata-only.
- OCR الثقيل: خارج Vercel Functions عبر Gemini / QARI / doc-node — متوافق مع قاعدة «لا OCR ثقيل في Vercel».
- متغيرات ذات صلة: `AZURE_STORAGE_*`, `SHAREPOINT_*`, `GEMINI_API_KEY`, `DOC_TOOL_*`, `QARI_*`, `DOC_SERVICE_URL`, `GOOGLE_CLIENT_*`.
