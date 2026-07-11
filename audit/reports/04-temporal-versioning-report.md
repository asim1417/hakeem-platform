# 04 — تقرير الإصدارات الزمنية (المرحلة الحرجة)

## الخلاصة: النموذج موجود، **الضمان غائب، والبيانات فارغة زمنيًّا**.

توجد نمذجة على طراز Akoma Ntoso (`ArticleVersion`: Work=المادة، Expression=النسخة) مع
`effective_from/to`, `superseded_by`. لكن ثلاث فجوات تُفرغها من قيمتها العملية:

| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| VERSION-001 | **Critical** | **لا قيد قاعدة يفرض «نسخة نافذة واحدة».** المهاجرة تنشئ PK + فهرسين + FK فقط — بلا `UNIQUE(article_id) WHERE effective_to IS NULL` وبلا قيد استبعاد على التداخل | مهاجرة `20260625160000_add_article_versions/migration.sql` |
| VERSION-002 | High | النسخ المشتقّة تُنشأ بـ`effectiveFrom = article.effectiveFrom` (غالبًا null) و`effectiveTo = null` → **كل النسخ بلا تواريخ**، فالاستعلام «النصّ الساري بتاريخ X» يعيد النسخة الوحيدة أيًّا كان التاريخ | `scripts/derive-article-versions.ts:64-69` |
| VERSION-003 | High | الاشتقاق يُنشئ **نسخة واحدة لكل مادة** (يتخطّى ما له نسخة). فلا تعدّد نسخ تاريخي حقيقي مُحمَّل → «الاحتفاظ بكل النسخ» غير مُفعَّل بالبيانات | `derive-article-versions.ts:54` (يتخطّى `versions.take:1`) |
| VERSION-004 | Medium | `status` المادة و`effectiveTo` للنسخة **قد يتناقضان** بلا فرض (مادة "ملغاة" ولها نسخة نافذة) | schema:135, 189؛ استعلام `current-version-conflicts.sql ④` |
| VERSION-005 | Medium | **لا ربط إلزامي بأداة رسمية** لكل تعديل: `royalDecree`/`amending_instrument` اختياري وغالبًا فارغ | schema:190؛ `article_amendments.decreeRef` اختياري |

## الفحوص المطلوبة (على Neon)
- **تعدّد النسخة النافذة:** `audit/current-version-conflicts.sql ①②` (المتوقّع = 0).
- **تداخل/فجوات زمنية:** `audit/temporal-overlaps.sql ①②③`.
- **كم نسخة لها تاريخ فعلي:** `temporal-overlaps.sql ⑤` — إن كان ≈0 فالنمذجة الزمنية **بلا أثر عملي**.
- **مواد بلا أي نسخة:** `current-version-conflicts.sql ⑤`.

## الاختبار المنطقي (موجود، لكن على منطق نقيّ لا على القاعدة)
`scripts/test-article-versions.ts` (7 حالات، **ناجحة**) يثبت أن `selectVersionAt` يختار النسخة الصحيحة بالتاريخ
(حدود from-شامل / to-حصري). **لكنه يختبر الدالّة على بيانات وهميّة** — لا يثبت غياب «نسختين نافذتين» في القاعدة
(لأن لا قيد يمنعه). الثبات المطلوب: «لكل مادة وفي أي تاريخ، نسخة نافذة واحدة» **غير مضمون على مستوى القاعدة**.

## التوصية الجوهرية (للإصلاح لاحقًا — موثّقة في roadmap)
1. فهرس فريد جزئي: `CREATE UNIQUE INDEX ... ON article_versions(article_id) WHERE effective_to IS NULL`.
2. قيد استبعاد GiST على `tstzrange(effective_from, effective_to)` لكل `article_id` لمنع التداخل.
3. تعبئة تواريخ نفاذ حقيقية من `article_amendments`/المراسيم بدل null.
4. فرض ربط كل نسخة بأداة رسمية (`amending_instrument NOT NULL` للنسخ غير الأصلية).
