# PR-1 Rollback — Attachment processing / metadata

**Migration:** `20260728120000_attachment_processing_metadata_pr1`  
**طبيعة التغيير:** إضافي فقط — لم تُحذف أعمدة قديمة ولم تُعاد كتابة `extractedText`.

## التراجع الآمن (إن لزم قبل دمج لاحق يعتمد على الأعمدة)

```sql
-- 1) إسقاط الأعمدة الجديدة
ALTER TABLE "attachments"
  DROP COLUMN IF EXISTS "metadata",
  DROP COLUMN IF EXISTS "processingStatus",
  DROP COLUMN IF EXISTS "sourceProvider",
  DROP COLUMN IF EXISTS "sourceExternalId",
  DROP COLUMN IF EXISTS "sourceConnectionId",
  DROP COLUMN IF EXISTS "sourceVersionId",
  DROP COLUMN IF EXISTS "sourceEtag",
  DROP COLUMN IF EXISTS "sourceUrlEncrypted",
  DROP COLUMN IF EXISTS "sha256",
  DROP COLUMN IF EXISTS "fileSize",
  DROP COLUMN IF EXISTS "detectedMimeType",
  DROP COLUMN IF EXISTS "extractionEngine",
  DROP COLUMN IF EXISTS "extractionConfidence",
  DROP COLUMN IF EXISTS "extractionErrorCode",
  DROP COLUMN IF EXISTS "extractionStartedAt",
  DROP COLUMN IF EXISTS "extractionCompletedAt",
  DROP COLUMN IF EXISTS "updatedAt";

-- 2) إسقاط الأنواع (بعد التأكد أن لا عمود يعتمدها)
DROP TYPE IF EXISTS "AttachmentProcessingStatus";
DROP TYPE IF EXISTS "AttachmentSourceProvider";
```

## ملاحظات

- سجلات ما بعد PR-1 تكتب `metadata` صراحةً و`extractedText = null` حتى تكتمل القراءة.
- السجلات القديمة تبقى قابلة للقراءة عبر `decodeLegacyAttachmentPayload`.
- سكربت `npm run migrate:attachment-metadata` **اختياري**؛ التراجع عنه = إعادة JSON إلى `extractedText` من نسخة احتياطية إن كان قد طُبّق `--apply`.
- Feature flags للموصلات/المحركات الجديدة **ليست** في PR-1.
