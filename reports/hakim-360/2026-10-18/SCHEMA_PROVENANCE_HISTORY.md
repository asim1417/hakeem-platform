# مصدر المخطط — HKM-031

**39** دليلًا تحت `prisma/migrations` كلها على `origin/main`. صف `_prisma_migrations` الوحيد ما زال `20260604120000_add_judicial_cases`. أُعيدت القراءة في هذه الجولة.

الجداول التي تسميها الهجرات موجودة في `public` إلا هجرة واحدة: `20260729130000_usage_credits_v2` تعلن `usage_credit_accounts` و`usage_credit_ledger` و`usage_credit_reservations` و`usage_service_prices` و`usage_credit_packages` و`usage_credit_quotas`، وهذه الأسماء غائبة. يوجد في الإنتاج اسم آخر ظهر في فرق القيود: `usage_credit_buckets`. لا ملف هجرة في المجلد ينشئ `usage_credit_accounts` سوى هذا الملف. التطبيق **غير مثبت**، والأثر **غائب**. وقت أي محاولة غير معروف.

بقية الهجرات: الأثر (الجدول) حاضر، وصف Prisma غائب. التطبيق تم بأداة أخرى: `psql -f` في workflows مثل `apply-rulings-search-norm.yml` و`build-search-vector.yml`، أو SQL استيراد. لا يُستنتج تاريخ التطبيق من وجود الملف. كثير منها يحمل `IF NOT EXISTS` فيُعاد تشغيله على قاعدة فارغة جزئيًا، وبعضها `DROP TABLE` قبل الإنشاء فيعيد كتابة الجدول إن وُجدت بيانات.

ملفات SQL في المستودع 175: `ingest` 104، `prisma` 41، `audit` 13، `scripts` 11، `data` 3، `reports` 3. قطع الاستيراد ليست هجرات. لا تُعاد على الإنتاج من هذا التدقيق.

لا مسار تراجع داخل ملفات الهجرة نفسها. التراجع الموثق للإنتاج هو فرع Neon أو PITR، ونافذة الاحتفاظ غير مقروءة (لا مفتاح Neon API).

تعارض محتمل: تشغيل `prisma migrate diff` ثم تطبيقه يحذف أعمدة أنشأتها هجرات لاحقة غير مسجلة (`search_norm`، `norm_*`، `instrument_kind`). المخطط الرسمي للعميل متأخر عن المخطط الذي يكتبه التطبيق.

البيانات الحساسة: هجرات المستخدمين والائتمان والفواتير تمس جداول حسابات. هجرات المواد والأحكام تمس نصًا قانونيًا. لم يُفتح متن.

الرسم: [REBUILD_DEPENDENCY_GRAPH.mmd](REBUILD_DEPENDENCY_GRAPH.mmd). المصفوفة: [MIGRATION_APPLICATION_MATRIX.csv](MIGRATION_APPLICATION_MATRIX.csv).
