# سجل المشكلات الكامل | PRE-LAUNCH-AUDIT-001

| ID | الصفحة/الخدمة | وصف المشكلة | السبب الجذري | الخطورة | أثرها | الإصلاح | الاختبار | الحالة |
|---|---|---|---|---|---|---|---|---|
| SEC-001 | session | guest SYSTEM_ADMIN | auth معطّل افتراضيًا | P0 | إدارة كاملة | إنتاج يفرض auth + TRAINEE | test-pre-launch-security | تم الاختبار |
| SEC-002 | ensure-owner | reset كلمة كل boot | hash يُكتب دائمًا | P0 | كلمة معروفة | FORCE فقط | static | تم الاختبار |
| SEC-003 | owner-login | plaintext fallback | مقارنة ثابتة | P0 | دخول | حذف | static | تم الاختبار |
| SEC-004 | LoginForm | autofill كلمة | UX مطور | P1 | كشف | إزالة | static | تم الاختبار |
| SEC-005 | middleware | cookie دون توقيع | وجود فقط | P1 | تجاوز protect | HMAC verify | unit | تم الاختبار |
| SEC-006 | Moyasar webhook | soft auth | سر اختياري | P0 | اشتراك مزيف | إلزام مع الدفع الحي | musthaves | تم الاختبار |
| SEC-007 | quota | open-fail | catch يسمح | P0 | بلا حد | fail-closed prod | quota | تم الاختبار |
| SEC-008 | legal-chat/JA | بلا بوابة | نقص ربط | P1 | تكلفة | gate/settle | static | تم الاختبار |
| SEC-009 | attachments | بلا حد حجم | نقص تحقق | P1 | DoS | max bytes | مراجعة | تم الإصلاح |
| SEC-010 | admin layout | بلا بوابة دور | layout فارغ | P1 | اعتماد صفحات | requireUser+perm | مراجعة | تم الإصلاح |
| SEC-011 | PDPL | فجوات sanitize | غير مركزي | P1 | PII للمزوّد | central + JA | pdpl | تم الإصلاح جزئيًا |
| SEC-012 | AUTH_SECRET | fallback إنتاج | شرط ناقص | P0 | تزوير جلسة | throw في prod | مراجعة | تم الإصلاح |
| SEC-014 | pricing Team | ميزات وهمية | copy | P1 | ادعاء كاذب | تخفيف | static | تم الاختبار |
| SEC-015 | CSP | unsafe-inline/eval | توافق Next | P2 | XSS أوسع | مؤجل | headers | مؤجلة بقرار |
| UX-01 | legal-core article | أزرار قريبًا | غير مكتمل | P2 | انطباع ناقص | — | — | مؤجلة بقرار |
| UX-02 | lab | تجريبي ظاهر | منتج | P2 | تشويش | قرار منتج | — | تحتاج قرارًا إداريًا |
| UX-04 | أجهزة حقيقية | لم تُختبر هنا | بيئة وكيل | P1 | مخاطر جوال | QA يدوي | — | تحتاج قرارًا إداريًا |
| DB-02 | migrations حصّة | قد تُنسى | خارج Prisma | P1 | حصّة/فتح | تطبيق SQL | health/ops | تحتاج بيانات سرية/Ops |
| DB-03 | backup/restore | غير مثبت | وصول | P0 تشغيلي | فقدان بيانات | Ops | — | تحتاج قرارًا إداريًا |
| PRIV-01 | privacy | ناقصة سابقًا | صياغة | P1 | PDPL | توسيع+typo | حي بعد نشر | تم الإصلاح |
| SEO-01 | robots | ناقص disallow | قائمة قصيرة | P1 | فهرسة خاصة | توسيع | — | تم الإصلاح |
| SEO-02 | sitemap | بلا pricing | سهو | P2 | اكتشاف | إضافة | — | تم الإصلاح |
| BUILD-01 | week export TS | Request≠NextRequest | نوع | P1 | typecheck | إصلاح | typecheck | تم الاختبار |
| DOC-01 | .env.example | تضليل | قديم | P2 | إعداد خاطئ | تحديث | — | تم الإصلاح |
