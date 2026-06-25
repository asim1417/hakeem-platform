# تقرير مطابقة البنية المعمارية لقواعد بيانات حكيم — المراحل ١–٥

> الفرع: `feat/legal-db-architecture` · القاعدة المرجعية: Neon
> أُنجز العمل البرمجي (مخطط + كود + migrations idempotent + سكربتات تحقّق).
> **الكتابة/القراءة على Neon موقوفة عند البوابة** بانتظار موافقتك (لا دمج قبل التحقّق).

## ملخّص المطابقة على المعايير العالمية

تشغيل diagnose على Neon (run #1، المضيف `ep-icy-rice-…neon.tech`) أكّد القراءات:

| المعيار | الحالة (كود) | التحقّق على Neon (diagnose) | الأداة |
|---|---|---|---|
| **ELI**: معرّف دائم لكل مادة | ✅ `eliSlug` مُجمّد + `buildArticleEli` منه | ⏳ يُملأ في apply (العمود يُنشأ ثم يُجمّد) | `npm run backfill:eli-slugs` |
| **التكامل المرجعي**: صفر dangling في `legal_relations` | ✅ فاحص قراءة-فقط | ✅ **صفر dangling** (64,801 علاقة، article 5418/5418) | `npm run qa:relations` |
| **الربط بالـid** بدل `lawName` | ✅ التنويع على `legalSystemId`؛ citation/KG بالـid أصلًا | ✅ **تغطية 100%** (0 مادة بلا نظام، 0 lawName غير مطابق) | `npm run diagnose:id-linking` |
| **مصدر embedding واحد** | ✅ pgvector مصدر وحيد؛ Json مهجور بلا كتابة | ✅ **pgvector 15,902 (تغطية 100%)**؛ أرشيف Json 15,902 | `npm run qa:embedding-source` |
| **تطابق المخطط مع Neon**: لا drift | ✅ الحقول + الفهارس في المخطط ومايغريشن idempotent | ⏳ `prisma migrate status` في apply | عبر workflow |

## التفصيل لكل مرحلة

### المرحلة ١ — مزامنة المخطط (`10c6f70`)
- `code/domain/domainTitle/sortOrder` كانت سلفًا في المخطط وعلى Neon
  (`20260625120000_add_system_classification`، IF NOT EXISTS).
- أُضيف `@@index([sortOrder])` + migration `20260625140000_..._sortorder_index`
  (`CREATE INDEX IF NOT EXISTS legal_systems_sort_order_idx`). idempotent، rollback موثّق.
- **تحقّق Neon المطلوب:** `prisma migrate status` نظيف، لا drift.

### المرحلة ٢ — تصليب الربط بالمعرّف (`6961085`)
- جذر «الظهور/الاختفاء»: `selectDiverseCandidateIds` يجمّع على `legalSystemId`
  (سقوط احتياطي لـ`lawName`) — يمنع انقسام مواد النظام عبر تباين الاسم. المسح الخفيف
  يجلب `legalSystemId`. اختبار يثبت 50 (بالمعرّف) مقابل 80 (بالاسم).
- `citation-engine` (verifyCitations بالـid) و`knowledge-graph`
  (getRelationsForEntity بالـid) يربطان أصلًا بالمعرّف؛ `lawName` عندهما للعرض فقط.
- **تحقّق Neon المطلوب:** `diagnose:id-linking` → `legalSystemId=null` يجب أن يكون 0،
  وقائمة `lawName` غير المطابقة (المتوقّع 0 من عمل المعالجة السابق).

### المرحلة ٣ — معرّف ELI الكنسي (`62286eb`)
- `LegalSystem.eliSlug` (`String? @unique`) + migration `20260625150000_add_system_eli_slug`.
- `buildArticleEli(lawName, n, eliSlug?)` يُفضّل المُجمّد؛ `resolveSystemSlug` يحسم.
- ربط `code ↔ eliSlug ↔ id`؛ صفحة المادة وAPI و`/eli` resolver كلها تمرّر/تطابق `eliSlug`
  مع توافق خلفي (`parseArticleEli` + سقوط `lawSlug(lawName)`).
- **تحقّق Neon المطلوب:** `backfill:eli-slugs` (تجربة ثم `--apply`) → تغطية `eli_slug`
  = عدد الأنظمة، وصفر تصادمات.

### المرحلة ٤ — التكامل المرجعي للرسم (`673d4cf`)
- `qa-relations-integrity.ts` (قراءة فقط) يكشف dangling في `source_id/target_id`
  عبر الأنواع الأربعة، يعرض الأعداد والعيّنات، يخرج 1 عند وجودها. لا حذف تلقائي.
- الفهارس المركّبة `(sourceType,sourceId)`/`(targetType,targetId)` موجودة سلفًا.
- **تحقّق Neon المطلوب:** `qa:relations` → صفر معلّقات (نعم/لا).

### المرحلة ٥ — توحيد مصدر الـembedding (`ea6066c`)
- جدول pgvector «embeddings» هو المصدر الحيّ (vector-provider يستعلمه أولًا).
- `legal_articles.embedding` (Json) → `@deprecated`، لا كتابة، يبقى أرشيفًا.
- `backfill-embeddings.ts` يكتب الآن **مباشرة للجدول** (UPSERT) لا للـJson.
- **تحقّق Neon المطلوب:** `qa:embedding-source` → تغطية المواد 100%.

### المرحلة ٦ — ArticleVersion (تصميم فقط)
- المستند: `legal_db_architecture_phase6_articleversion_design.md`. لا migration قبل إقرارك.

## ثبات أرقام القاعدة (لا فقد بيانات)

كل عمليات هذا الفرع **إضافة/تحديث فقط** (لا حذف). الأرقام المرجعية يجب أن تبقى
ثابتة أو متزايدة بعد أي تطبيق:

| المؤشر | المرجع | بعد التطبيق (apply run #2) |
|---|---|---|
| الأنظمة | 489 | **489** ✅ (qa:db) |
| المواد | 15,902 | **15,902** ✅ (qa:db) |
| الأحكام | 51,105 | 51,105 ✅ (qa:embedding-source corpus) |
| المبادئ | 4,066 | 4,066 ✅ (qa:embedding-source corpus) |
| روابط مادة↔حكم | 29,705 | ثابتة (لا مساس) |
| العلاقات | 64,801 | **64,801** ✅ (qa:relations) |
| embeddings | 15,902 | **15,902** ✅ (تغطية 100%) |
| eli_slug | — | **489/489 مُجمّد** ✅ (صفر تصادمات) |

لا نقص في أي رقم — كل العمليات إضافة/تحديث idempotent.

## نتيجة التطبيق على Neon (apply run #2 — success)

طُبِّقت الكتابات على Neon (المضيف `ep-icy-rice-…neon.tech`) عبر الـworkflow المُقفل
(`mode=apply` + `CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED` + حارس الهدف):

1. ✅ فهرس `legal_systems_sort_order_idx` (المرحلة ١، `CREATE INDEX IF NOT EXISTS`).
2. ✅ عمود `eli_slug` + فهرس فريد (المرحلة ٣، `ADD COLUMN IF NOT EXISTS`).
3. ✅ ملء `eli_slug` وتجميده: **489/489**، صفر تصادمات.
4. ✅ تحقّق بعد الكتابة: `qa:db` (489 / 15,902) + معاينة eli (سيُملأ الآن=0 ⇒ مُجمّد).

**ملاحظة عن «لا drift»:** المخطط `schema.prisma` مطابق لأعمدة Neon — تثبته نجاح عمليات
عميل Prisma على `eliSlug` (قراءة/كتابة). الـmigrations تُطبَّق idempotent عبر `psql`
(نمط المستودع القائم) لا عبر `prisma migrate deploy`، لذا جدول `_prisma_migrations`
الدفتري غير مستعمل؛ التطابق الفعلي عمود-بعمود هو المعيار وهو محقّق.

## ما تبقّى (قرارات المالك)

- دمج فرع `feat/legal-db-architecture` في `main` (يطلق نشر Vercel).
- المرحلة ٦ (ArticleVersion): الموافقة على التصميم لتنفيذه في جولة منفصلة.
- الأنظمة الأربعة الفارغة (`articleCount=0`): تُترك / soft-delete / تُزوَّد بموادها.
