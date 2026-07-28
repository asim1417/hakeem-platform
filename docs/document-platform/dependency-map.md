# HKM-DOCUMENTS-UPGRADE-002 — خريطة التبعيات

**المرجع:** PR-1 · مرحلة صفر  
**تاريخ:** 2026-07-28

---

## الرسم المعماري الحالي

```
┌─────────────────────────────────────────────────────────────────┐
│ UI                                                              │
│  /dashboard/attachments  ←── AttachmentsManager ←── /api/attachments │
│  /documents (+ /app /tool) ←── DocWorkspace / doc-tool (browser) │
│  اسأل حكيم ←── HakeemAskWorkspace ←── doc-tool/extract         │
│  المساعد القضائي ←── AttachmentUploader (JSON على القضية)      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   Prisma Attachment    document-inspection    doc-node service
   blob-storage         processExtractedText   extractLocal/runEngine
   ownership/RBAC       (brain post-extract)   jobs (غير مربوط بـ Attachment)
```

---

## رموز حرجة → مستهلكون

| الرمز | الملف | المستدعون |
|---|---|---|
| `parseAttachmentMetadata` | `lib/modules/attachments/attachment-metadata.ts` | `app/api/attachments/route.ts`, `[id]/route.ts`, `dashboard/attachments/page.tsx` |
| `uploadAttachmentBlob` | `lib/modules/attachments/blob-storage.ts` | `app/api/attachments/route.ts`, `app/api/profile/avatar/route.ts` |
| `signedDownloadUrl` | `blob-storage.ts` | `[id]/route.ts`, `[id]/download/route.ts` |
| `attachmentListWhere` | `lib/modules/auth/ownership.ts` | `attachments/route.ts` GET، `dashboard/attachments/page.tsx` |
| `assertCaseOwnedForAttachment` | `ownership.ts` | `attachments/route.ts` POST |
| `requireApiPermission` | `lib/modules/auth/session.ts` | كل مسارات `/api/attachments/**` |
| `extractLocal` | `services/doc-node/extract.ts` | `engines.ts` |
| `runEngine` (doc-node) | `services/doc-node/engines.ts` | `jobs.ts`, `test-doc-node.ts` |
| `runEngine` (agent) | `lib/agent-runtime/live/run-engine.ts` | بحث قانوني — **تصادم اسم فقط** |
| `processExtractedText` | `lib/modules/document-inspection/pipeline.ts` | `doc-node/extract.ts`, `engines.ts`, اختبارات، مسارات doc-tool |

---

## تخزين الملفات

```
uploadAttachmentBlob
  ├─ azureConfigured? → Azure BlockBlob + storageKey + public URL
  ├─ sharePointConfigured? → Graph PUT /content + webUrl
  └─ else → metadata-only/{ts}-{name} (لا بايتات)
```

تنزيل:
- Azure → SAS عبر `signedDownloadUrl(storageKey)`
- SharePoint → `storageUrl` من JSON داخل `extractedText` (حاليًا)
- metadata-only → 404

---

## صلاحيات المرفقات

| الدور | ATTACHMENTS_FULL | ATTACHMENTS_LIMITED |
|---|---|---|
| SUPER/SYSTEM_ADMIN, LAWYER, TRAINER, JUDGE | نعم | ضمنيًا |
| TRAINEE | لا | نعم (قائمة/عرض/تنزيل فقط) |

عزل المستأجر: `caseFile.ownerId` أو `"uploadedBy":"<id>"` داخل `extractedText` للقائمة.

---

## حدود الأحجام (حسب السطح)

| السطح | الحد |
|---|---|
| `/api/attachments` POST | **لا حد** |
| `/api/doc-tool/ocr` | 3.5 MB |
| اسأل حكيم → نص للوكيل | 12 000 حرف |
| اسأل حكيم → حفظ مرفق | 200 000 حرف |
| doc-node HTTP | 200 MB |

---

## الاختبارات الحامية لكل مسار

| المسار | الاختبار |
|---|---|
| ملكية قائمة المرفقات + صفحة SSR | `scripts/test-ownership.ts` |
| `processExtractedText` / reshape / OCR helpers | `npm run test:document-inspection` |
| دقة الحالات المرجعية | `npm run accuracy` |
| `runEngine` / `extractLocal` / jobs | `npm run test:doc-node` |
| storageBackend (Azure/SP/metadata) | `npm run test:admin` |
| اسأل حكيم ↔ doc-tool (ثابت) | `scripts/test-ask-attach-docs.ts` (بلا script npm) |
| عقد Attachment API / decoder | **ناقص قبل PR-1** → يُضاف `test:attachments-regression` |

---

## المعمارية المستهدفة (بعد الترقية — لا تُنفَّذ في PR-1)

```
منصة الوثائق الحالية
  ├── رفع محلي قائم
  ├── لصق رابط (PR-2)
  └── اتصال سحابي (PR-3/4)
           │
    Document Import Service
           │
  Existing Attachment Flow ←── كل المدخلات تنتهي إلى Attachment
           │
     Processing Job (خارج request)
           │
       doc-node الحالي
           │
    processExtractedText
           │
    Blocks / Pages / Citations (PR-5+)
```

**قاعدة:** لا Dashboard موازية باسم جديد. إعادة تسمية UI مسموحة مع alias للمسارات القديمة.
