-- ═══════════════════════════════════════════════════════════════════
-- 11-apply.sql — إصلاح نظام المعاملات المدنية في Neon الإنتاجية.
--
-- ⛔ لا يُشغَّل هذا الملف إلا بعد:
--    (1) تشغيل 10-dry-run.sql ومراجعة مخرجاته،
--    (2) موافقة صريحة مكتوبة من مالك المنصة،
--    (3) تعبئة الجدول المرحلي official_civil_articles من مصدر رسمي.
--
-- ⚠️ الملف عمدًا لا يحتوي أي إزاحة حسابية للأرقام.
--    الإزاحة الساذجة (articleNumber = articleNumber + 1) ممنوعة: تُسبّب
--    تصادمًا مع قيد @@unique([lawName, articleNumber])، ولا تُنشئ المادة 237
--    المفقودة، ولا تُصلح تكرار 720/721، وتكسر دلالة المعرّفات والعلاقات.
--    التصحيح الصحيح = استبدال العنوان والنص من بيان رسمي، مع تثبيت الـid.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- ① بوابة الهدف: ارفض التنفيذ على أي قاعدة غير Neon الإنتاجية.
DO $$
DECLARE db text; n int;
BEGIN
  SELECT current_database() INTO db;
  IF db <> 'neondb' THEN
    RAISE EXCEPTION 'الهدف غير مطابق: current_database()=% — التنفيذ مسموح على neondb فقط', db;
  END IF;
  SELECT count(*) INTO n FROM legal_articles WHERE "lawName" = 'نظام المعاملات المدنية';
  IF n <> 721 THEN
    RAISE EXCEPTION 'الحالة الابتدائية غير متوقعة: % مادة (المتوقع 721) — أُلغي التنفيذ', n;
  END IF;
END $$;

-- ② نسخة احتياطية كاملة داخل القاعدة قبل أي كتابة.
DROP TABLE IF EXISTS legal_articles_backup_20260911;
CREATE TABLE legal_articles_backup_20260911 AS
SELECT * FROM legal_articles WHERE "lawName" = 'نظام المعاملات المدنية';

-- ③ الجدول المرحلي الرسمي — يجب أن يكون معبّأً مسبقًا من مصدر رسمي موثّق.
CREATE TABLE IF NOT EXISTS official_civil_articles (
  official_article_number  int PRIMARY KEY,
  official_article_title   text NOT NULL,   -- العنوان الترتيبي كما نُشر رسميًا
  official_article_content text NOT NULL,
  official_chapter         text,
  source_authority         text NOT NULL,   -- هيئة الخبراء / أم القرى / وزارة العدل
  source_url               text NOT NULL,
  publication_reference    text,            -- رقم وتاريخ أم القرى
  effective_from           date,
  raw_hash                 text NOT NULL,
  normalized_hash          text NOT NULL,
  retrieved_at             timestamptz NOT NULL
);

-- ④ بوابة اكتمال البيان الرسمي: 721 مادة، بلا فجوة ولا تكرار نصّي.
DO $$
DECLARE n int; gaps int; dups int;
BEGIN
  SELECT count(*) INTO n FROM official_civil_articles;
  IF n <> 721 THEN
    RAISE EXCEPTION 'الجدول المرحلي غير مكتمل: % مادة (المطلوب 721) — عبّئه من المصدر الرسمي أولًا', n;
  END IF;
  SELECT count(*) INTO gaps FROM generate_series(1,721) g
   WHERE NOT EXISTS (SELECT 1 FROM official_civil_articles o WHERE o.official_article_number = g);
  IF gaps > 0 THEN RAISE EXCEPTION 'الجدول المرحلي به % فجوة', gaps; END IF;
  SELECT count(*) INTO dups FROM (
    SELECT normalized_hash FROM official_civil_articles GROUP BY normalized_hash HAVING count(*) > 1
  ) d;
  IF dups > 0 THEN RAISE EXCEPTION 'الجدول المرحلي به % مجموعة نصوص مكررة', dups; END IF;
END $$;

-- ⑤ استبدال العنوان والنص لكل صفّ قائم بالنص الرسمي المقابل لرقمه.
--    الـid يبقى كما هو ⇒ كل العلاقات القائمة (الأحكام، النسخ، التعديلات) تبقى سليمة.
UPDATE legal_articles a
SET title   = o.official_article_title,
    content = o.official_article_content,
    chapter = COALESCE(o.official_chapter, a.chapter),
    "effectiveFrom" = COALESCE(o.effective_from::timestamptz, a."effectiveFrom"),
    "updatedAt" = now()
FROM official_civil_articles o
WHERE a."lawName" = 'نظام المعاملات المدنية'
  AND a."articleNumber" = o.official_article_number
  AND a."articleNumber" BETWEEN 237 AND 721;

-- ⑥ الصف 721 كان نسخة مكررة من 720؛ الخطوة ⑤ أعطته نصّه الرسمي الصحيح.
--    لم تُفقد أي مادة رسمية: المادة 237 كانت غائبة تمامًا وتُستعاد الآن.
--    ملاحظة: لا يوجد صفّ فائض يُحذف — عدد الصفوف كان 721 ويبقى 721.

-- ⑦ حدّث عدّاد النظام.
UPDATE legal_systems s
SET "articleCount" = (SELECT count(*) FROM legal_articles a
                      WHERE a."legalSystemId" = s.id AND a."articleNumber" > 0),
    "updatedAt" = now()
WHERE s.name = 'نظام المعاملات المدنية';

-- ⑧ سجّل الواقعة بوصفها تصحيح خطأ بيانات — لا تعديلًا تشريعيًا.
INSERT INTO audit_logs (id, "userId", action, "entityType", "entityId", metadata, "createdAt")
VALUES (gen_random_uuid()::text, NULL, 'LEGAL_DATA_CORRECTION', 'legal_system',
        (SELECT id FROM legal_systems WHERE name = 'نظام المعاملات المدنية'),
        jsonb_build_object(
          'kind', 'data_error_correction',
          'not_a_legislative_amendment', true,
          'defect', 'off_by_one_shift_237_720_plus_duplicate_721',
          'affected_range', '237-721',
          'report', 'reports/legal-data-audit-2026-09-11/',
          'backup_table', 'legal_articles_backup_20260911'),
        now());

-- ⑨ تحقّق نهائي قبل الاعتماد.
SELECT count(*) AS total_articles,
       count(*) FILTER (WHERE "articleNumber" = 237) AS has_237,
       (SELECT count(*) FROM (
          SELECT md5(content) FROM legal_articles
          WHERE "lawName" = 'نظام المعاملات المدنية'
          GROUP BY md5(content) HAVING count(*) > 1) d) AS duplicate_text_groups
FROM legal_articles WHERE "lawName" = 'نظام المعاملات المدنية' AND "articleNumber" > 0;

-- راجع الناتج: يجب أن يكون 721 / 1 / 0.
-- COMMIT;
ROLLBACK; -- الوضع الافتراضي آمن. غيّره إلى COMMIT بعد التحقق والموافقة.
