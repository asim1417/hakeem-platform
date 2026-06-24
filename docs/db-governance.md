# حوكمة قاعدة البيانات — الأنظمة والمواد والمسائل القانونية

> يعالج توصيتي التقرير: إنهاء انجراف الـ schema، وإبقاء الفهارس المشتقّة متّزنة بعد الاستيراد.

## ١) السكيمة والفهارس (إنهاء الانجراف)

البيئات المُقفلة (مثل **Neon**) تُدير فهارس `pg_trgm`/`pgvector` **خارج Prisma** عبر SQL خام،
لذا **لا تشغّل `prisma db push` عليها** (قد يُسقط تلك الفهارس). الترتيب المعتمد:

```bash
# 1) الفهارس والامتدادات (مرة واحدة / عند التغيير) — آمنة للتكرار
psql "$DATABASE_URL" < scripts/sql/neon-retrieval-pre.sql

# 2) الجداول المُضافة حديثاً (المسائل القانونية) — بديل db push على المقفلة
psql "$DATABASE_URL" < scripts/sql/fiqh-tables.sql
```

### تبنّي Prisma Migrations رسمياً (يتطلّب قاعدة بيانات)
لإنهاء الانجراف نهائياً، يُعتمد خط migration واحد. الخطوات (تُنفَّذ بوجود اتصال + shadow DB):

```bash
# توليد baseline يمثّل السكيمة الحالية كأنها مُطبَّقة (دون إعادة إنشاء الجداول القائمة)
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init        # وسمها مُطبَّقة على الإنتاج القائم

# بعدها أي تغيير سكيمة يمرّ عبر:
npx prisma migrate dev --name <change>             # تطوير
npx prisma migrate deploy                          # إنتاج
```
> ملاحظة: فهارس trigram/pgvector تبقى في SQL الخام (خارج Prisma) لتجنّب إسقاطها — تُوثَّق هنا ولا تُدار بـ migrate.

## ٢) تحديث البيانات المشتقّة بعد الاستيراد

بعد أي `import:hoqoqi` أو `import:judgments`، شغّل:

```bash
npm run sync:systems -- --apply   # مزامنة legal_systems + articleCount من legal_articles
npm run refresh:indexes           # إعادة بناء فهرس BM25 من القاعدة + تصدير الأنظمة + ربط المسائل
```

- `sync:systems` — يعالج تقادم عدّاد المواد وغياب صفوف الأنظمة (idempotent، dry-run افتراضياً).
- `refresh:indexes` — يبقي فهرس BM25 وفهارس المسائل القانونية متّزنة مع المواد الجديدة.
- إبطال كاش الواجهة: كاش `library-service` بعتبة زمنية (10 دقائق)؛ وللإبطال الفوري من مسار خادمي استُخدم `revalidateLegalCoreCache()` (وسم `legal-core`).
