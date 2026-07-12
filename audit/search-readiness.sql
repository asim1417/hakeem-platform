-- ═══════════════════════════════════════════════════════════════════════════
-- search-readiness.sql — جاهزية البيانات للبحث (المرحلة ٦/٩، للقراءة فقط)
-- الغرض: قياس تغطية الفهارس والـembeddings والأعمدة المساعدة للبحث.
-- ═══════════════════════════════════════════════════════════════════════════

-- ① تغطية المتجهات (embeddings) حسب النوع — هل الأحكام/المبادئ لها متجهات؟
--    توقّع التدقيق: article فقط لها متجهات؛ ruling/principle = 0 (بحث دلالي للمواد فقط).
SELECT owner_type, count(*) AS vectors, count(DISTINCT model) AS distinct_models
FROM embeddings
GROUP BY owner_type
ORDER BY vectors DESC;

-- ② نماذج embedding مختلطة في الجدول نفسه (خطر عدم قابلية المقارنة)
SELECT model, count(*) AS n FROM embeddings GROUP BY model ORDER BY n DESC;

-- ③ مواد بلا متجه (فجوة تغطية البحث الدلالي)
SELECT
  (SELECT count(*) FROM legal_articles) AS total_articles,
  (SELECT count(*) FROM embeddings WHERE owner_type='article') AS articles_with_vector,
  (SELECT count(*) FROM legal_articles a
     WHERE NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.owner_type='article' AND e.owner_id=a.id)) AS articles_without_vector;

-- ④ متجهات ليتيمة (تشير لمادة محذوفة) — انظر أيضًا orphan-records.sql ⑪
SELECT count(*) AS orphan_vectors
FROM embeddings e
WHERE e.owner_type='article'
  AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = e.owner_id);

-- ⑤ فحص وجود عمود search_norm والـGIN tsvector (المسار السريع للبحث النصّي)
--    الكود يشير إليهما لكن لا توجد مهاجرة تنشئهما في المستودع → قد يكونان غائبين.
SELECT
  bool_or(column_name = 'search_norm') AS has_search_norm_column
FROM information_schema.columns WHERE table_name = 'legal_articles';

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'legal_articles'
ORDER BY indexname;

-- ⑥ فحص وجود فهرس ANN للمتجهات (HNSW/ivfflat) — مكتوب في سكربت يدوي لا مهاجرة
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'embeddings'
ORDER BY indexname;

-- ⑦ توزيع أطوال النصوص (نصف قطر أثر البتر عند 8000 حرف في توليد المتجهات)
SELECT
  count(*)                                             AS total,
  count(*) FILTER (WHERE length(content) > 8000)       AS over_8000_chars_truncated_in_embedding,
  round(avg(length(content)))                          AS avg_len,
  max(length(content))                                 AS max_len
FROM legal_articles;

-- ⑧ هل جدول legal_relations (Knowledge Graph) مبذور؟ (المزوّد يعطي نتائج فقط إن وُجدت)
SELECT count(*) AS relations, count(DISTINCT source_id) AS distinct_sources FROM legal_relations;
