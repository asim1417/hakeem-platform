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

| المؤشر | المرجع | بعد التطبيق (يُملأ من التشغيل) |
|---|---|---|
| الأنظمة | 489 | ⏳ |
| المواد | 15,902 | ⏳ |
| الأحكام | 51,105 | ⏳ |
| المبادئ | 4,066 | ⏳ |
| روابط مادة↔حكم | 29,705 | ⏳ |
| العلاقات | 64,801 | ⏳ |
| embeddings | 15,902 | ⏳ |

## البوابة — ما يلزم لإقفال المطابقة

التطبيق على Neon يحتاج تشغيل السكربتات أعلاه عبر workflow مُقفل
(`CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED` + `NEON_DATABASE_URL`)،
بترتيب: migrate (فهرس sortOrder + eli_slug) → `backfill:eli-slugs --apply` →
`diagnose:id-linking` → `qa:relations` → `qa:embedding-source` → `qa:db`.
كل خطوة كتابة تتبعها قراءة تحقّق، ثم التوقّف لعرض النتيجة قبل الدمج.
