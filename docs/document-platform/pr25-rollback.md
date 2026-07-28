# PR-2.5 Rollback

1. عطّل الأعلام الجديدة دون حذف الكود:
   - `DOCUMENT_MALWARE_SCAN_ENABLED=false`
   - `DOCUMENT_QUEUE_ENABLED=false`
   - `DOCUMENT_RATE_LIMIT_ENABLED=false` (إن لزم)
2. أبقِ `DOCUMENT_DIRECT_URL_IMPORT_ENABLED=false` في الإنتاج إن لم تُراجع SSRF.
3. Migration `20260728140000_api_idempotency_pr25` **إضافة فقط** — لا تحذف الجدول في الإنتاج إلا بعد التأكد من عدم الاعتماد.
4. رفع الملفات المحلي يبقى يعمل عند تعطيل malware/queue.
5. لا تُفعّل `DOCUMENT_BULLMQ_WIRED` قبل تهيئة Queue حقيقي.
