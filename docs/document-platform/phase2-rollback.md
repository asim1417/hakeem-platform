# Rollback — مرحلة تكامل Composer/الوثائق

## إيقاف فوري

```bash
HAKEEM_COMPOSER_ATTACHMENTS_V2=0
HAKEEM_DOCUMENT_PROCESSING_V2=0
HAKEEM_COMPOSER_DOCUMENTS_V1=0
NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1=0
NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2=0
HAKEEM_DOC_NODE_CALLBACK_V1=0
HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED=0
```

## Rate limiter

الذاكرة الداخلية **ليست** حماية إنتاج. قبل تفعيل V2 إنتاجيًا:

```bash
HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED=1
npx tsx scripts/apply-generic-rate-limit-windows.ts
```

النتيجة: Ask يعود لمسار `document` النصي + `extractFile` المحلي دون الاعتماد على doc-node.

## محاذاة الأعلام

إن بقي `NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2=1` والخادم `HAKEEM_COMPOSER_ATTACHMENTS_V2=0`:
- الواجهة قد تحاول الرفع؛ الخادم لا يفرض مسار V2 (`enforceV2=false`).
- عطّل علم العميل أيضًا لتجنّب تجربة مضلّلة.

## صلاحية ASK_ATTACHMENT_UPLOAD

عند rollback الكامل للرفع عبر API، يمكن إبقاء الصلاحية في البذرة دون أثر طالما مسار الرفع غير مستخدم من الواجهة.

## ما لا يُحذف تلقائيًا

سجلات `Attachment` التي أُنشئت تبقى (بما فيها `metadata.clientPreviewText` و`extractionProvenance`).  
يمكن حذفها يدويًا عبر واجهة المرفقات أو API الحذف.

## لا Migration إلزامية

الصفحات وprovenance في `metadata` — لا يتطلب rollback schema.
