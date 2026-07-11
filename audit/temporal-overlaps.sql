-- ═══════════════════════════════════════════════════════════════════════════
-- temporal-overlaps.sql — سلامة النسخ الزمنية للمواد (المرحلة ٥، للقراءة فقط)
-- الغرض: كشف تداخل/فجوات الفترات الزمنية بين نسخ المادة نفسها.
-- خلفية: article_versions يحوي (effective_from, effective_to)؛ effective_to=null
--        تعني «النسخة النافذة الآن». لا يوجد قيد استبعاد (EXCLUDE) يمنع التداخل،
--        فالتحقّق منطقي عبر هذه الاستعلامات.
-- المتوقّع الصحّي: كل الأعداد = 0.
-- ═══════════════════════════════════════════════════════════════════════════

-- ① فترتان متداخلتان لنفس المادة: [from_a, to_a) تتقاطع مع [from_b, to_b)
--    (nulls: effective_from=null → منذ الأزل؛ effective_to=null → إلى الأبد)
SELECT a.article_id,
       a.id AS version_a, b.id AS version_b,
       a.effective_from AS from_a, a.effective_to AS to_a,
       b.effective_from AS from_b, b.effective_to AS to_b
FROM article_versions a
JOIN article_versions b
  ON a.article_id = b.article_id
 AND a.id < b.id
 AND COALESCE(a.effective_from, '-infinity'::timestamp) < COALESCE(b.effective_to, 'infinity'::timestamp)
 AND COALESCE(b.effective_from, '-infinity'::timestamp) < COALESCE(a.effective_to, 'infinity'::timestamp)
ORDER BY a.article_id
LIMIT 200;

-- ② عدّ المواد التي بها أي تداخل زمني
SELECT count(DISTINCT a.article_id) AS articles_with_temporal_overlap
FROM article_versions a
JOIN article_versions b
  ON a.article_id = b.article_id AND a.id < b.id
 AND COALESCE(a.effective_from, '-infinity'::timestamp) < COALESCE(b.effective_to, 'infinity'::timestamp)
 AND COALESCE(b.effective_from, '-infinity'::timestamp) < COALESCE(a.effective_to, 'infinity'::timestamp);

-- ③ فجوات زمنية: مادة لها نسخة منتهية (effective_to) لكن لا نسخة تبدأ عندها
--    (نهاية نسخة بلا نسخة تالية تُكمل الخطّ الزمني)
SELECT v.article_id, v.id AS ended_version, v.effective_to AS gap_starts_at
FROM article_versions v
WHERE v.effective_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM article_versions n
    WHERE n.article_id = v.article_id
      AND n.effective_from = v.effective_to
  )
  -- استثنِ الحالة الشرعية: النسخة المنتهية هي آخر نسخة (لا يُفترض وجود تالٍ)
  AND EXISTS (
    SELECT 1 FROM article_versions later
    WHERE later.article_id = v.article_id
      AND COALESCE(later.effective_from,'-infinity'::timestamp) > v.effective_to
  )
ORDER BY v.article_id
LIMIT 200;

-- ④ توزيع عدد النسخ لكل مادة (كم مادة لها 1 نسخة، 2، ...؟)
--    ملاحظة تدقيق: إن كانت الأغلبية الساحقة «1 نسخة» فالنمذجة الزمنية موجودة
--    لكنها غير مُفعّلة بالبيانات (لا تعديلات تاريخية محمّلة فعلاً).
SELECT version_count, count(*) AS articles
FROM (
  SELECT article_id, count(*) AS version_count
  FROM article_versions
  GROUP BY article_id
) t
GROUP BY version_count
ORDER BY version_count;

-- ⑤ كم نسخة تحمل تاريخ نفاذ فعلي أصلاً؟ (إن كان ~0 فالاستعلام الزمني بلا معنى عملي)
SELECT
  count(*)                                        AS total_versions,
  count(*) FILTER (WHERE effective_from IS NOT NULL) AS with_effective_from,
  count(*) FILTER (WHERE effective_to   IS NOT NULL) AS with_effective_to
FROM article_versions;
