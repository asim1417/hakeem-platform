# PR-2.5 Known Limitations

1. **Memory rate limiter** — مناسب لنسخة واحدة؛ الإنتاج متعدد النسخ يحتاج Redis موصول فعليًا.
2. **ClamAV** — هيكل فقط؛ لا اتصال INSTREAM بعد. عند التفعيل دون محرك: ERROR (fail-closed) وليس CLEAN.
3. **BullMQ** — خلف `DOCUMENT_QUEUE_ENABLED` + Redis + `DOCUMENT_BULLMQ_WIRED=true` فقط؛ وإلا Inline متزامن.
4. **Idempotency** — يتطلب جدول `api_idempotency_records` بعد migrate؛ بدون DB تفشل طلبات ذات المفتاح.
5. **DNS rebinding socket pinning** — قيد متبقٍ من PR-2؛ لم يُغلق كليًا.
6. **لا Google/Microsoft connectors** في هذه المرحلة.
