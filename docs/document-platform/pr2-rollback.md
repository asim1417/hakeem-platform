# PR-2 Rollback

## Feature flag

اضبط فورًا:

```
DOCUMENT_DIRECT_URL_IMPORT_ENABLED=false
```

المسارات الجديدة تعيد 404 دون كشف الميزة. رفع الملفات الحالي يبقى يعمل.

## إزالة الكود (إن لزم)

احذف:

- `app/api/attachments/inspect-url/`
- `app/api/attachments/import-url/`
- `lib/modules/documents/**` (ما عدا ما يُعاد استخدامه لاحقًا)

`uploadAttachmentFromPath` إضافة غير كاسرة لـ `blob-storage.ts` — يمكن إبقاؤها.

## قاعدة البيانات

لا migration مدمرة في PR-2. سجلات `sourceProvider=DIRECT_URL` تبقى قابلة للقراءة كأي Attachment.
