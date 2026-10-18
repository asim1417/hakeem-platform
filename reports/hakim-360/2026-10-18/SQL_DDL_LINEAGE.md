# سلالة SQL وDDL — HKM-031

التسلسل المطبق مقابل المستودع في [MIGRATION_CHRONOLOGY.md](MIGRATION_CHRONOLOGY.md): صف واحد في `_prisma_migrations`، و39 دليلًا تحت `prisma/migrations`، و175 ملف SQL في المستودع أغلبها قطع استيراد. إعادة البناء من `prisma migrate` وحده غير مثبتة (H360-001). لم يُنفَّذ بناء معزول.

مسار DDL حي في الكود ولم يُستدعَ هنا: `lib/modules/legal-core/reindex.ts` ينفّذ `ALTER TABLE legal_articles ADD COLUMN IF NOT EXISTS search_norm` ثم `CREATE INDEX IF NOT EXISTS` لفهرس GIN، ثم `UPDATE` لملء العمود. المدخل `POST /api/admin/legal-core/reindex` بصلاحية `LEGAL_CORE_ADMIN`. هذا خارج طابور المكتب (H360-014).

workflows الكتابة اليدوية مقفلة نصيًا بـ `CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED` في 35 ملفًا. لا `schedule` في الشجرة الحالية. النجاح التاريخي لتلك الملفات لا يُعاد تفسيره كسجل ترحيل.

خطة البناء المعزولة تبقى في [SCHEMA_REBUILD_PLAN.md](SCHEMA_REBUILD_PLAN.md) بلا تنفيذ.
