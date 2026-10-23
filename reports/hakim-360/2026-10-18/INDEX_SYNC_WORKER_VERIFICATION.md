# التحقق من عامل مزامنة الفهرس — HKM-031

بُحث في `*.ts` و`*.yml` عن `search_norm_at` و`opensearch_at` و`vectors_at` و`page_revalidated_at`.

الكتابة الوحيدة إلى `index_sync` هي `enqueueIndexSync` في `lib/modules/editorial/service.ts` عند النشر: `INSERT ... ON CONFLICT DO NOTHING`.

القراءة الوحيدة للأعمدة الزمنية هي عدّ في `lib/modules/editorial/read.ts` للصفوف التي أحد أعمدتها فارغ. لا `UPDATE` يملأ `search_norm_at` أو `opensearch_at` أو `vectors_at` أو `page_revalidated_at`.

لا cron في `vercel.json`. لا workflow باسم العامل. الاختبار `test-editorial-desk.ts` يثبت أن النشر يدرج صفًا على قاعدة اختبار، لا أن عامل إنتاج يفرّغه.

العد الحي: `index_sync` = 0 في هذه الجولة. الصفر يعني عدم النشر عبر المكتب، لا أن الفهارس تُحدَّث من هذا الجدول.

مسارات الفهرسة الفعلية خارج الجدول: `POST /api/admin/legal-core/reindex` وworkflows `build-search-vector` و`index-opensearch` و`apply-rulings-search-norm`.
