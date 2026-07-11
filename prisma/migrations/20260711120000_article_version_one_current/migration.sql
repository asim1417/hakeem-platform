-- ═══════════════════════════════════════════════════════════════════════════
-- [إصلاح تدقيق VERSION-001] فرض «نسخة نافذة واحدة كحدّ أقصى لكل مادة» على مستوى القاعدة.
--
-- الخلفية: article_versions.effective_to = NULL تعني «النسخة النافذة حاليًا». لم يكن
-- هناك قيد يمنع وجود أكثر من نسخة نافذة لنفس المادة — الضمان كان بمنطق السكربت فقط.
--
-- ⚠️ قبل التطبيق: شغّل audit/current-version-conflicts.sql وأصلح أي تعارض قائم،
--    وإلا سيفشل إنشاء الفهرس الفريد (وهذا مقصود — يمنع إخفاء بيانات متضاربة).
--
-- idempotent: يُنشأ فقط إن لم يوجد. لا يحذف بيانات.
-- ملاحظة تشغيل: يُطبَّق عبر workflow مُقفَل على Neon (لا يُشغَّل تلقائيًا عند النشر).
-- ═══════════════════════════════════════════════════════════════════════════

-- فهرس فريد جزئي: مادة واحدة لا يمكن أن تملك أكثر من نسخة effective_to IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "article_versions_one_current_per_article"
  ON "article_versions" ("article_id")
  WHERE "effective_to" IS NULL;

-- (لاحقًا/اختياري) لمنع تداخل الفترات الزمنية بالكامل، يُوصى بقيد استبعاد GiST:
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
--   ALTER TABLE "article_versions" ADD CONSTRAINT article_versions_no_overlap
--     EXCLUDE USING gist (
--       "article_id" WITH =,
--       tstzrange(COALESCE("effective_from", '-infinity'), COALESCE("effective_to", 'infinity')) WITH &&
--     );
-- (غير مُفعَّل هنا لأنه يتطلّب تعبئة تواريخ نفاذ حقيقية أولًا — انظر VERSION-002.)
