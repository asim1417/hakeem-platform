# Rollback — مرحلة تكامل Composer/الوثائق

## إيقاف فوري

```bash
HAKEEM_COMPOSER_ATTACHMENTS_V2=0
HAKEEM_DOCUMENT_PROCESSING_V2=0
HAKEEM_COMPOSER_DOCUMENTS_V1=0
NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1=0
NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2=0
HAKEEM_DOC_NODE_CALLBACK_V1=0
```

النتيجة: Ask يعود لمسار `document` النصي + `extractFile` المحلي دون الاعتماد على doc-node.

## ما لا يُحذف تلقائيًا

سجلات `Attachment` التي أُنشئت تبقى. يمكن حذفها يدويًا عبر واجهة المرفقات أو API الحذف.

## لا Migration إلزامية

الصفحات في `metadata.pages` — لا يتطلب rollback schema.
