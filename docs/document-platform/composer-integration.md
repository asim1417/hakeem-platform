# تكامل HakeemComposer مع منصة الوثائق

المرجع: HKM-COMPOSER-DOCUMENTS-004 · إغلاق تحصين PR #594  
Stacked: PR #594 فوق #593 فوق #592

## التدفق المستهدف

```
HakeemComposer
 → قرار أعلام موحّد (ATTACHMENTS_V2 client بدون اشتراط DOCUMENTS_V1)
 → رفع آمن POST /api/attachments (جلسة → Content-Length → Rate limit → FormData)
 → صلاحية ASK_ATTACHMENT_UPLOAD لمرفقات Ask (LIMITED = عرض/تنزيل فقط)
 → Attachment QUEUED + docNodeGeneration
 → Adapter → doc-node Job (مصدر حقيقة عند PROCESSING_V2)
 → browser /extraction = CLIENT_PREVIEW أو CLIENT_FALLBACK فقط
 → sync → processExtractedText → READY|PARTIAL|FAILED + provenance
 → agent-search { attachmentIds } + تصنيف أخطاء مرتّب
 → read_attachment({ attachmentIds, pageRange, queryHint })
```

## الأعلام (موحّدة)

| علم | الوظيفة |
|---|---|
| `HAKEEM_COMPOSER_ATTACHMENTS_V2` / `NEXT_PUBLIC_…` | مسار V2 الحالي — الرفع بالمعرّف |
| `HAKEEM_COMPOSER_DOCUMENTS_V1` / `NEXT_PUBLIC_…` | توافق خلفي فقط — ليس شرطًا لـ V2 |
| `HAKEEM_DOCUMENT_PROCESSING_V2` | Adapter → doc-node / fallback محلي |
| `HAKEEM_DOC_NODE_CALLBACK_V1` | محجوز Webhook؛ المزامنة Polling |

`isComposerAttachmentClientPersistEnabled()` = عميل V2 **أو** عميل V1.  
عند عميل V2 وخادم بلا V2 → `alignClientServerDocumentFlags` يضع `misaligned` ويمنع `enforceV2`.

## مصدر الحقيقة (browser ↔ doc-node)

- PROCESSING_V2 + doc-node متاح → **doc-node** نهائي؛ المتصفح `CLIENT_PREVIEW` في metadata فقط.
- doc-node غير متاح → `CLIENT_FALLBACK` / `CLIENT_UNVERIFIED` مع سبب مسجّل.
- وصول Job لاحق يرقّي ويُستبدل؛ Job قديم يُرفض عبر `docNodeJobId` / generation.

## Provenance

`SERVER_LOCAL` | `SERVER_GEMINI` | `SERVER_QARI` | `CLIENT_PREVIEW` | `CLIENT_FALLBACK`  
الخادم وحده يقرر engine / provider / model / confidence / verificationStatus.

## الصفحات

`metadata.pages` — `read_attachment` يطبّق `pageRange` ويتحقق from/to.  
بلا بنية صفحات → نص مجمّع مع `NO_PAGE_STRUCTURE_FALLBACK_FULL_TEXT` ودون ادّعاء رقم صفحة.

## صلاحيات الرفع

- `ATTACHMENTS_LIMITED`: عرض/تنزيل (المعنى التاريخي).
- `ASK_ATTACHMENT_UPLOAD`: رفع Ask اليتيم + `/extraction` لـ Ask.
- `ATTACHMENTS_FULL`: قضايا + يغطي ASK عبر RBAC.
