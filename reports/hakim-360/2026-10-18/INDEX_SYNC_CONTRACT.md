# عقد مزامنة الفهرس — HKM-031

`index_sync` كان 0 صفوف في 11:44 UTC. الكود في `lib/modules/editorial/service.ts` يدرج صفًا داخل معاملة النشر فقط (`enqueueIndexSync`: `INSERT ... ON CONFLICT DO NOTHING`). لا cron في `vercel.json`، ولا workflow باسم العامل، ولا مُحدِّث لـ `attempts` أو الأقفال أو `search_norm_at` أو `opensearch_at` أو `vectors_at` أو `page_revalidated_at` ظهر في جرد المكتب.

العقد الفعلي اليوم: النشر يترك أثرًا في الطابور ثم لا يستهلكه أحد في هذه الشجرة. امتلاء الطابور بصفر يعني أنه لم يُنشر عبر المكتب، لا أن الفهارس الخارجية طازجة.

مسار الفهرسة الآخر، `POST /api/admin/legal-core/reindex`، يكتب `search_norm` مباشرة ولا يمر بهذا الجدول. انظر [SQL_DDL_LINEAGE.md](SQL_DDL_LINEAGE.md).

لا عامل يُشغَّل من هذا التدقيق.
