-- ═══════════════════════════════════════════════════════════════════════════
-- missing-required-fields.sql — الحقول الجوهرية الناقصة (للقراءة فقط)
-- الغرض: قياس اكتمال المواد النظامية مقابل الحقول التي يتطلّبها العمل القانوني.
-- ملاحظة معماريّة مهمّة: جدول legal_articles لا يملك أصلاً أعمدة:
--   source, source_url, content_hash, issue_date, publish_date, verified_at,
--   verification_status, version_number, amending_instrument.
-- لذا «النقص» هنا نوعان: (أ) حقل موجود لكنه فارغ، (ب) حقل غير موجود في المخطّط أصلاً
--   (يُرصد ببنية information_schema أدناه).
-- ═══════════════════════════════════════════════════════════════════════════

-- ① الحقول الموجودة والفارغة في المواد
SELECT
  count(*)                                                          AS total,
  count(*) FILTER (WHERE title IS NULL OR btrim(title)='')          AS missing_title,
  count(*) FILTER (WHERE content IS NULL OR btrim(content)='')      AS missing_content,
  count(*) FILTER (WHERE "lawName" IS NULL OR btrim("lawName")='')  AS missing_law_name,
  count(*) FILTER (WHERE "legalSystemId" IS NULL)                   AS missing_system_link,
  count(*) FILTER (WHERE "royalDecree" IS NULL)                     AS missing_royal_decree,
  count(*) FILTER (WHERE "effectiveFrom" IS NULL)                   AS missing_effective_date,
  count(*) FILTER (WHERE classification IS NULL)                    AS missing_classification,
  count(*) FILTER (WHERE chapter IS NULL)                           AS missing_chapter,
  count(*) FILTER (WHERE keywords = '{}' OR keywords IS NULL)       AS missing_keywords
FROM legal_articles;

-- ② رصد الأعمدة الجوهرية «غير الموجودة أصلاً» في مخطّط legal_articles.
--    كل صف يظهر بـ present=false يعني أن الحقل غير مُنمذَج (فجوة تصميم، لا فجوة بيانات).
WITH expected(col) AS (
  VALUES ('source'), ('source_url'), ('content_hash'), ('issue_date_g'),
         ('publish_date'), ('verified_at'), ('verification_status'),
         ('version_number'), ('amending_instrument'), ('indexed_at')
)
SELECT e.col AS expected_column,
       (c.column_name IS NOT NULL) AS present
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_name = 'legal_articles' AND c.column_name = e.col
ORDER BY present, e.col;

-- ③ قائمة عيّنة بالمواد التي ينقصها حقل جوهري (للمراجعة اليدوية)
SELECT id, "lawName", "articleNumber", title
FROM legal_articles
WHERE (content IS NULL OR btrim(content)='')
   OR "legalSystemId" IS NULL
   OR (title IS NULL OR btrim(title)='')
ORDER BY "lawName", "articleNumber"
LIMIT 200;

-- ④ الأحكام: اكتمال حقول الإسناد
SELECT
  count(*)                                                     AS total_cases,
  count(*) FILTER (WHERE "judgmentText" IS NULL OR btrim("judgmentText")='') AS missing_text,
  count(*) FILTER (WHERE "sourceLink" IS NULL)                 AS missing_source_link,
  count(*) FILTER (WHERE "decisionDate" IS NULL)               AS missing_decision_date,
  count(*) FILTER (WHERE court IS NULL)                        AS missing_court
FROM judicial_cases;
