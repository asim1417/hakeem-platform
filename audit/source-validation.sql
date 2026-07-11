-- ═══════════════════════════════════════════════════════════════════════════
-- source-validation.sql — تصنيف المواد حسب موثوقية المصدر (للقراءة فقط)
-- الغرض: قياس «من أين جاء النصّ وهل هو موثّق».
-- خلفية حرجة: legal_articles لا يملك أعمدة مصدر (source/source_url/verified)؛
--   أثر المصدر مُهرَّب داخل مصفوفة keywords[] كنصّ حرّ (مثل 'source:hoqoqi_sql').
--   لذا التصنيف أدناه يعتمد على keywords — وهو دليل هشّ لا عمود منظَّم.
-- ═══════════════════════════════════════════════════════════════════════════

-- ① تصنيف المواد حسب وسم المصدر داخل keywords[]
SELECT
  CASE
    WHEN 'source:moj_gateway'  = ANY(keywords) THEN 'OFFICIAL (moj_gateway)'
    WHEN 'source:hoqoqi_sql'   = ANY(keywords) THEN 'SECONDARY (hoqoqi)'
    WHEN EXISTS (SELECT 1 FROM unnest(keywords) k WHERE k LIKE 'source:%') THEN 'OTHER_TAGGED'
    ELSE 'UNKNOWN_SOURCE (no source tag)'
  END AS source_class,
  count(*) AS articles
FROM legal_articles
GROUP BY source_class
ORDER BY articles DESC;

-- ② نسبة المواد بلا أي وسم مصدر إطلاقاً (خطر: نصّ قد يُستشهد به بلا إسناد)
SELECT
  count(*)                                                                          AS total,
  count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM unnest(keywords) k WHERE k LIKE 'source:%')) AS no_source_tag,
  round(100.0 * count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM unnest(keywords) k WHERE k LIKE 'source:%')) / NULLIF(count(*),0), 1) AS pct_no_source
FROM legal_articles;

-- ③ الأحكام: هنا المصدر مُنمذَج بأعمدة حقيقية (نموذج أفضل من المواد)
SELECT
  source,
  count(*)                                            AS n,
  count(*) FILTER (WHERE "sourceLink" IS NOT NULL)    AS with_link,
  count(*) FILTER (WHERE "sourceId"   IS NOT NULL)    AS with_source_id
FROM judicial_cases
GROUP BY source
ORDER BY n DESC;

-- ④ الطبقة الفقهية: حالة التوثيق (verification_status عمود حقيقي هنا)
SELECT verification_status, count(*) AS n
FROM fiqh_sources
GROUP BY verification_status
ORDER BY n DESC;

-- ⑤ رصد وجود/غياب عمود مصدر منظَّم في legal_articles (فجوة تصميم)
SELECT
  bool_or(column_name = 'source')     AS has_source_col,
  bool_or(column_name = 'source_url') AS has_source_url_col,
  bool_or(column_name = 'content_hash') AS has_content_hash_col
FROM information_schema.columns
WHERE table_name = 'legal_articles';
