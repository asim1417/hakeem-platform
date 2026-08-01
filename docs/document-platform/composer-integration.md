# تكامل HakeemComposer مع منصة الوثائق

المرجع: HKM-COMPOSER-DOCUMENTS-004  
Stacked: PR #594 فوق #593 فوق #592

## التدفق المستهدف

```
HakeemComposer
 → رفع آمن POST /api/attachments (ATTACHMENTS_V2)
 → Attachment QUEUED
 → POST /api/attachments/{id}/process → doc-node Job
 → GET/POST sync → processExtractedText → READY|PARTIAL|FAILED
 → agent-search { attachmentIds }
 → read_attachment({ attachmentIds }) + effectivePolicy
```

## الأعلام

| علم | الوظيفة |
|---|---|
| `HAKEEM_COMPOSER_ATTACHMENTS_V2` | رفع محمّى + قراءة بالمعرّف |
| `HAKEEM_DOCUMENT_PROCESSING_V2` | Adapter → doc-node / fallback محلي خفيف |
| `HAKEEM_COMPOSER_DOCUMENTS_V1` | جسر سابق (client extract + /extraction) |
| `HAKEEM_DOC_NODE_CALLBACK_V1` | محجوز لـ Webhook؛ المزامنة الحالية Polling |

## الصفحات

تُحفظ في `Attachment.metadata.pages` دون جدول منفصل في هذه المرحلة.  
`extractedText` يبقى النص المجمّع المتوافق.

## توافق خلفي

عند تعطيل الأعلام: مسار `document` inline + `extractFile` كما قبل.
