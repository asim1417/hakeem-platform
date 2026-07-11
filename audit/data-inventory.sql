-- ═══════════════════════════════════════════════════════════════════════════
-- data-inventory.sql — جرد شامل للقراءة فقط (المرحلة ٣)
-- الغرض: عدّ السجلات والحقول الفارغة وغير المُراجعة لكل جدول جوهري.
-- كل ما يلي SELECT فقط. لا يعدّل شيئًا.
-- المتوقّع الصحّي: الأعداد تطابق ما هو معلن (≈489 نظامًا / ≈15,902 مادة)،
--                  و«بلا مراجعة» منخفض قدر الإمكان للمحتوى المنشور.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── جرد الأعداد الأساسية لكل جدول ──
SELECT 'legal_systems'            AS table, count(*) AS rows FROM legal_systems
UNION ALL SELECT 'legal_articles',            count(*) FROM legal_articles
UNION ALL SELECT 'article_versions',          count(*) FROM article_versions
UNION ALL SELECT 'article_amendments',        count(*) FROM article_amendments
UNION ALL SELECT 'judicial_cases',            count(*) FROM judicial_cases
UNION ALL SELECT 'judicial_principles',       count(*) FROM judicial_principles
UNION ALL SELECT 'legal_article_case_links',  count(*) FROM legal_article_case_links
UNION ALL SELECT 'legal_relations',           count(*) FROM legal_relations
UNION ALL SELECT 'legal_graph_nodes',         count(*) FROM legal_graph_nodes
UNION ALL SELECT 'legal_graph_edges',         count(*) FROM legal_graph_edges
UNION ALL SELECT 'embeddings',                count(*) FROM embeddings
UNION ALL SELECT 'fiqh_texts',                count(*) FROM fiqh_texts
UNION ALL SELECT 'fiqh_article_alignments',   count(*) FROM fiqh_article_alignments
UNION ALL SELECT 'users',                     count(*) FROM users
UNION ALL SELECT 'audit_logs',                count(*) FROM audit_logs
ORDER BY table;

-- ── المواد: تفصيل الاكتمال والحالة ──
-- المتوقّع الصحّي: null_system = 0 (لا مادة بلا نظام)، empty_content = 0.
SELECT
  count(*)                                                        AS total_articles,
  count(*) FILTER (WHERE "legalSystemId" IS NULL)                 AS null_system_id,
  count(*) FILTER (WHERE content IS NULL OR btrim(content) = '')  AS empty_content,
  count(*) FILTER (WHERE length(btrim(content)) < 20)             AS very_short_content,
  count(*) FILTER (WHERE "royalDecree" IS NULL)                   AS no_royal_decree,
  count(*) FILTER (WHERE "effectiveFrom" IS NULL)                 AS no_effective_date,
  count(*) FILTER (WHERE status IS NULL OR btrim(status) = '')    AS no_status,
  count(DISTINCT status)                                          AS distinct_status_values,
  count(DISTINCT "lawName")                                       AS distinct_law_names
FROM legal_articles;

-- ── توزيع قيم الحالة (كشف قيم غير منضبطة؛ status نصّ حرّ لا enum) ──
SELECT status, count(*) AS n
FROM legal_articles
GROUP BY status
ORDER BY n DESC;

-- ── الأنظمة: تطابق العدّاد مع الواقع + الأنظمة بلا مواد ──
-- المتوقّع الصحّي: mismatch = 0، systems_zero_articles قليل ومقصود.
SELECT
  count(*)                                                                    AS total_systems,
  count(*) FILTER (WHERE "articleCount" = 0)                                  AS systems_zero_count_field,
  count(*) FILTER (WHERE classification IS NULL)                              AS systems_null_classification,
  count(*) FILTER (WHERE code IS NULL)                                        AS systems_null_code,
  count(*) FILTER (WHERE eli_slug IS NULL)                                    AS systems_null_eli
FROM legal_systems;

-- الأنظمة التي لا تملك مواداً فعلية (يتيمة الاتجاه المعاكس)
SELECT s.id, s.name, s."articleCount"
FROM legal_systems s
LEFT JOIN legal_articles a ON a."legalSystemId" = s.id
WHERE a.id IS NULL
ORDER BY s.name;

-- ── حالة المراجعة عبر الجداول (needs_review = محتوى آلي غير مُعتمد) ──
SELECT 'judicial_cases'           AS table,
       count(*) FILTER (WHERE "reviewStatus" = 'needs_review') AS needs_review,
       count(*)                                                AS total FROM judicial_cases
UNION ALL SELECT 'judicial_principles',
       count(*) FILTER (WHERE "reviewStatus" = 'needs_review'), count(*) FROM judicial_principles
UNION ALL SELECT 'legal_article_case_links',
       count(*) FILTER (WHERE "reviewStatus" = 'needs_review'), count(*) FROM legal_article_case_links
UNION ALL SELECT 'article_amendments',
       count(*) FILTER (WHERE "reviewStatus" = 'needs_review'), count(*) FROM article_amendments
UNION ALL SELECT 'fiqh_article_alignments',
       count(*) FILTER (WHERE review_status = 'needs_review'),  count(*) FROM fiqh_article_alignments;

-- ── أقدم/أحدث سجل (نبض النموّ) ──
SELECT 'legal_articles' AS table, min("createdAt") AS oldest, max("createdAt") AS newest FROM legal_articles
UNION ALL SELECT 'judicial_cases', min("createdAt"), max("createdAt") FROM judicial_cases;
