-- ═══════════════════════════════════════════════════════════════════════════
-- current-version-conflicts.sql — تعدّد النسخة النافذة (المرحلة ٥، حرجة، قراءة فقط)
-- الغرض: إثبات/نفي الثبات المنطقي الحرج:
--   «لكل مادة، وفي أي تاريخ، نسخة نافذة واحدة كحدّ أقصى».
-- خلفية حرجة: لا يوجد قيد قاعدة بيانات (partial unique / EXCLUDE) يفرض هذا —
--   المهاجرة 20260625160000 تنشئ فقط PK + فهرسين + مفاتيح أجنبية، بلا أي قيد
--   على «نسخة نافذة واحدة». الضمان الوحيد اليوم هو منطق سكربت الاشتقاق.
-- المتوقّع الصحّي: multiple_current = 0.
-- ═══════════════════════════════════════════════════════════════════════════

-- ① مواد لها أكثر من نسخة «نافذة الآن» (effective_to IS NULL) — الخرق الحرج المباشر
SELECT article_id, count(*) AS current_versions
FROM article_versions
WHERE effective_to IS NULL
GROUP BY article_id
HAVING count(*) > 1
ORDER BY current_versions DESC;

-- ② عدّ إجمالي للمواد المخالفة
SELECT count(*) AS articles_with_multiple_current_versions
FROM (
  SELECT article_id
  FROM article_versions
  WHERE effective_to IS NULL
  GROUP BY article_id
  HAVING count(*) > 1
) t;

-- ③ تعدّد النسخة النافذة «في تاريخ محدّد» (وليس الآن فقط) — عمّم على :as_of
--    استبدل التاريخ الحرفي بأي نقطة زمنية تريد فحصها.
--    نسخة نافذة عند T ⇔ from ≤ T < to (مع معالجة null).
WITH as_of AS (SELECT TIMESTAMP '2020-01-01' AS t)
SELECT v.article_id, count(*) AS versions_in_force_at_t
FROM article_versions v, as_of
WHERE COALESCE(v.effective_from, '-infinity'::timestamp) <= as_of.t
  AND COALESCE(v.effective_to,   'infinity'::timestamp)  >  as_of.t
GROUP BY v.article_id
HAVING count(*) > 1
ORDER BY versions_in_force_at_t DESC
LIMIT 200;

-- ④ اتساق status المادة مع نسخها: مادة status='ملغاة'/'منسوخة' لكن لها نسخة نافذة (to=null)
--    (تناقض: النصّ يُعدّ نافذاً بينما المادة مُعلَنة ملغاة)
SELECT a.id, a."lawName", a."articleNumber", a.status,
       count(v.id) FILTER (WHERE v.effective_to IS NULL) AS current_versions
FROM legal_articles a
JOIN article_versions v ON v.article_id = a.id
WHERE a.status IS NOT NULL
  AND a.status NOT IN ('سارية','ساري','نافذة','نافذ')
GROUP BY a.id, a."lawName", a."articleNumber", a.status
HAVING count(v.id) FILTER (WHERE v.effective_to IS NULL) > 0
ORDER BY a."lawName"
LIMIT 200;

-- ⑤ مواد بلا أي نسخة إطلاقاً (لا يمكن استرجاع «النصّ الساري» لها عبر جدول النسخ)
SELECT count(*) AS articles_without_any_version
FROM legal_articles a
WHERE NOT EXISTS (SELECT 1 FROM article_versions v WHERE v.article_id = a.id);

-- ═══════════════════════════════════════════════════════════════════════════
-- توصية إصلاح (لا تُنفَّذ هنا — للتوثيق فقط):
--   لفرض الثبات على مستوى القاعدة، أنشئ فهرسًا فريدًا جزئياً:
--     CREATE UNIQUE INDEX CONCURRENTLY article_versions_one_current
--       ON article_versions (article_id) WHERE effective_to IS NULL;
--   ولمنع التداخل الزمني الكامل: قيد استبعاد GiST على tstzrange(from,to).
-- ═══════════════════════════════════════════════════════════════════════════
