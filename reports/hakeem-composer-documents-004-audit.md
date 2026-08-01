# HKM-COMPOSER-DOCUMENTS-004 — فحص المرفقات ومنصة الوثائق

تاريخ: 2026-08-01  
الفرع: `cursor/composer-documents-da55`  
الأساس: `cursor/composer-source-policy-da55` (PR #593)  
Stacked فوق: PR #592 ثم PR #593  

**لا يُدمج هذا الفرع قبل #592 ثم #593. لا Mark Ready. لا نشر.**

---

## 1) مبدأ الجولة

لا إعادة بناء OCR أو منصة وثائق. الفحص → اعتماد/تطوير/مواءمة/Adapter → تنفيذ محدود → اختبارات → تقرير → Stacked PR.

خارج النطاق: بحث هجين، استشهادات V2، صوت، ربط قضايا، مكتبة مؤسسة، ويب.

---

## 2) المخزون الفعلي

### Ask اليوم
```
File → extractFile (doc-tool + document-inspection OCR)
  → ComposerAttachment (state فقط، UUID محلي)
  → POST agent-search { document: text }
  → MessageAttachmentRef processingStatus:"inline" + نص كامل في JSON
```
لا يستدعي `/api/attachments`. لا Blob. لا `Attachment.id`.

### منصات موجودة (ثلاثية)
| المكدّس | الدور | قرار |
|---|---|---|
| `document-inspection` + `processExtractedText` | دماغ ما بعد الاستخراج | **اعتماد** |
| `doc-tool/extract.ts` + `/api/doc-tool/ocr` | استخراج متصفح + Gemini | **اعتماد** |
| `services/doc-node` (local/Gemini/QARI) | خدمة OCR مستقلة | **مواءمة لاحقًا** — خارج الحد الأدنى |
| Prisma `Attachment` + blob-storage | تخزين/RBAC | **اعتماد + تطوير** ملء `extractedText` |
| `MessageAttachmentRef` | ربط رسالة | **Adapter** → ids حقيقية |

### فجوات
1. `extractedText: null` بعد الرفع (TODO صريح في POST).
2. Ask مسار موازٍ ephemeral.
3. TRAINEE لديه `ATTACHMENTS_LIMITED` فقط — الرفع الحالي يتطلب FULL.
4. استعادة الجلسة لا تعيد تحميل المرفقات للصندوق.

---

## 3) مصفوفة اعتماد / تطوير / مواءمة / Adapter

| الأصل | القرار | ملاحظات التنفيذ |
|---|---|---|
| `extractFile` | اعتماد | يبقى محرك Ask |
| `processExtractedText` | اعتماد | يُطبَّق خادميًا عند إكمال الاستخراج |
| `/api/doc-tool/ocr` + Gemini | اعتماد | لا محرك OCR جديد |
| Tesseract المحلي | اعتماد | كما هو في المتصفح |
| QARI / doc-node | مواءمة مؤجّلة | ليس في الحد الأدنى |
| `POST /api/attachments` | تطوير | السماح لـ LIMITED عند مرفق Ask يتيم؛ `relationType=اسأل` |
| إكمال استخراج | تطوير | `POST /api/attachments/[id]/extraction` |
| `agent-search` | تطوير | قبول `attachmentIds[]` وتحميل نص مملوك |
| `ComposerAttachment` | تطوير | `serverAttachmentId` / `storageKey` |
| `MessageAttachmentRef` | Adapter | id حقيقي + معاينة محدودة بدل inline كامل |
| سياسة المصادر | مواءمة | `hasAttachment` يبقى صادقًا مع ids أو document |
| JA JSON attachments | مواءمة لاحقًا | لا دمج مخازن الآن |

---

## 4) نطاق التنفيذ (الحد الأدنى)

علم: `HAKEEM_COMPOSER_DOCUMENTS_V1=1`

1. رفع Ask → `Attachment` (يتيم، `relationType=اسأل`).
2. إكمال استخراج بنص `extractFile` + `processExtractedText` → `READY`.
3. إرسال `attachmentIds` مع الإبقاء على `document` للتوافق.
4. الخادم يحمّل النص من المرفقات المملوكة عند العلم.
5. Adapter لمراجع الرسائل.
6. سقوط آمن إلى المسار inline عند فشل الرفع/الصلاحية أو تعطيل العلم.

---

## 5) غير منفَّذ هنا

إعادة بناء OCR · Docling · استيراد روابط · ربط caseFiles · هجين · استشهادات · صوت · Playwright مرئي (إن غاب).
