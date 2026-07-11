-- ═══════════════════════════════════════════════════════════════════════════
-- rag-readiness.sql — جاهزية البيانات لنظام RAG (المرحلة ١١، للقراءة فقط)
-- الغرض: قياس ما إذا كانت وحدات الاسترجاع تحمل ما يلزم لإجابة مُسنَدة آمنة:
--        مصدر + رقم مادة + اسم نظام + حالة نفاذ + تاريخ نسخة.
-- ═══════════════════════════════════════════════════════════════════════════

-- ① تغطية «حالة النفاذ» على المواد القابلة للاسترجاع
--    خطر RAG: نصّ ملغى/منسوخ قد يُسترجع ويُقتبس بلا وسم (الاسترجاع لا يفلتر status).
SELECT status, count(*) AS articles
FROM legal_articles
GROUP BY status
ORDER BY articles DESC;

-- ② كم مادة «غير سارية» (ملغاة/منسوخة) قابلة للاسترجاع الآن بلا فلترة؟
SELECT count(*) AS non_active_articles_retrievable
FROM legal_articles
WHERE status IS NOT NULL AND status NOT IN ('سارية','ساري','نافذة','نافذ');

-- ③ ربط المادة بنظام (لبناء الاستشهاد «النظام — المادة (رقم)»)
SELECT
  count(*)                                        AS total,
  count(*) FILTER (WHERE "legalSystemId" IS NULL) AS cannot_cite_system,   -- لا نظام → استشهاد ناقص
  count(*) FILTER (WHERE "articleNumber" IS NULL) AS cannot_cite_number
FROM legal_articles;

-- ④ توفّر تاريخ النسخة/النفاذ لوحدة الاسترجاع (لإجابة «النصّ الساري بتاريخ X»)
SELECT
  (SELECT count(*) FROM article_versions)                                  AS versions,
  (SELECT count(*) FROM article_versions WHERE effective_from IS NOT NULL) AS versions_with_date,
  (SELECT count(*) FROM legal_articles a
     WHERE NOT EXISTS (SELECT 1 FROM article_versions v WHERE v.article_id=a.id)) AS articles_without_version;

-- ⑤ الأحكام/المبادئ غير المُراجعة القابلة للاسترجاع (تظهر بمرتبة متساوية مع المُعتمد)
SELECT
  (SELECT count(*) FROM judicial_cases      WHERE "reviewStatus"='needs_review') AS unreviewed_cases,
  (SELECT count(*) FROM judicial_principles WHERE "reviewStatus"='needs_review') AS unreviewed_principles,
  (SELECT count(*) FROM legal_article_case_links WHERE "reviewStatus"='needs_review') AS unreviewed_links;

-- ⑥ توفّر رابط المصدر لوحدات الأحكام (لإسناد قابل للتحقّق في إجابة RAG)
SELECT
  count(*)                                          AS total_cases,
  count(*) FILTER (WHERE "sourceLink" IS NOT NULL)  AS with_source_link,
  round(100.0*count(*) FILTER (WHERE "sourceLink" IS NOT NULL)/NULLIF(count(*),0),1) AS pct_with_link
FROM judicial_cases;
