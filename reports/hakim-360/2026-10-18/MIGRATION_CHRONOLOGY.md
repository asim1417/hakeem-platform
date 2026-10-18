# تسلسل الهجرات — HKM-031

**القياس:** 2026-10-18T11:41:39Z. **القاعدة:** `neondb` على فرع الإنتاج `br-rapid-salad-aq782ea2`. **الكود:** `main@d4ee69a`.

## ما هو مطبّق حسب Prisma

`_prisma_migrations` يحوي صفًا واحدًا:

| migration_name | المعنى |
|---|---|
| `20260604120000_add_judicial_cases` | السجل الوحيد الذي تعرفه أداة Prisma |

الملف: `evidence/prisma_migrations_applied.csv`. لم تُضف صفوف شكلية إلى هذا الجدول.

## ما هو موجود في المستودع ولم يُسجَّل هناك

`prisma/migrations` فيه 39 دليلًا (`evidence/prisma_migration_dirs.txt`). من أسمائها الظاهرة في هذه الشجرة، وهي ليست دليل تطبيق:

- `20261016150000_ruling_segment_embeddings`
- `20261016180000_mcp_account_linking`
- `20261016180000_ruling_meta_segments`
- `20261016200000_embeddings_partial_hnsw`
- `20261017090000_editorial_desk_phase0`
- `20261017120000_article_bis`
- `20261017130000_hkm023b_preamble_units`

وجود جداول المكتب والمقاطع في الإنتاج دليل أن DDL المقابل وُجد في القاعدة، لا أن Prisma سجّله. سجل المتابعة يقول إن ترحيل المكتب طُبق في 2026-10-17 بمعاملة SQL. هذا التدقيق أكد وجود الجداول والقيود، ولم يعد قراءة سجل Neon للتطبيق.

## ملفات SQL خارج Prisma

175 ملف `.sql` في المستودع. التجمعات الأكبر: أجزاء حقن الهيئة تحت `ingest/boe-corpus-2026-09-28/` (نصوص base64 وchunks)، ثم `audit/`، ثم `scripts/sql` والمعجم. هذه ملفات مصدر أو حمولة بيانات، وليست كلها هجرات مخطط.

التصنيف المعتمد هنا:

| الصنف | المثال | الحالة |
|---|---|---|
| tracked_by_prisma | الصف الوحيد أعلاه | CONFIRMED |
| tracked_by_sql | ملفات `prisma/migrations/*/migration.sql` غير المسجلة | الكود موجود؛ وقت التطبيق على الإنتاج UNKNOWN لكل ملف على حدة |
| manual_with_evidence | ترحيل المكتب ومقدمات HKM-023-B كما في `docs/PROJECT_STATUS.md` | HISTORICAL في السجل، والجداول CONFIRMED الآن |
| untracked | أعمدة `search_norm` و`norm_*` و`instrument_kind` وأعمدة `users` التسعة عشر | الأعمدة CONFIRMED؛ ملف الإنشاء لكل عمود لم يُربط واحدًا واحدًا |
| unknown | أي DDL نُفذ من workflow قديم ثم اختفى من السجل | لا يُنفى |

يُفرَّق بين هجرة مخطط، وملء بيانات، وإعادة فهرسة، وحقن نصوص. نجاح workflow ليس دليلًا أن الملف داخل `prisma/migrations` هو الذي نُفذ.

## ما لم يُفعل

لم يُشغَّل `migrate diff` ضد قاعدة فارغة. ذلك اختبار البناء المعزول في [SCHEMA_REBUILD_PLAN.md](SCHEMA_REBUILD_PLAN.md)، وهو متوقف على الإذن.
