-- ═══════════════════════════════════════════════════════════════════════════
-- orphan-records.sql — سجلات يتيمة وعلاقات مكسورة (للقراءة فقط)
-- الغرض: كشف السجلات التي تشير إلى آباء غير موجودين.
-- خطورة خاصة: legal_relations متعدّد الأشكال بلا مفاتيح أجنبية (schema:514-516)،
--             فالتحقّق الوحيد الممكن هو منطقي عبر هذه الاستعلامات.
-- المتوقّع الصحّي: كل الأعداد = 0.
-- ═══════════════════════════════════════════════════════════════════════════

-- ① مواد تشير إلى نظام غير موجود (legalSystemId غير null لكنه لا يطابق نظامًا)
SELECT count(*) AS articles_pointing_to_missing_system
FROM legal_articles a
WHERE a."legalSystemId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM legal_systems s WHERE s.id = a."legalSystemId");

-- ② مواد بلا نظام إطلاقاً (legalSystemId IS NULL) — يتيمة الهوية النظامية
SELECT count(*) AS articles_with_null_system FROM legal_articles WHERE "legalSystemId" IS NULL;

-- ③ روابط مادة↔حكم تشير إلى مادة محذوفة/غير موجودة
SELECT count(*) AS links_missing_article
FROM legal_article_case_links l
WHERE NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = l."articleId");

-- ④ روابط مادة↔حكم تشير إلى حكم غير موجود
SELECT count(*) AS links_missing_case
FROM legal_article_case_links l
WHERE NOT EXISTS (SELECT 1 FROM judicial_cases c WHERE c.id = l."caseId");

-- ⑤ مبدأ قضائي بلا حكم مصدر موجود
SELECT count(*) AS principles_missing_source_case
FROM judicial_principles p
WHERE NOT EXISTS (SELECT 1 FROM judicial_cases c WHERE c.id = p."sourceCaseId");

-- ⑥ نسخ مادة تشير إلى مادة غير موجودة
SELECT count(*) AS versions_missing_article
FROM article_versions v
WHERE NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = v.article_id);

-- ⑦ سلسلة النسخ: superseded_by يشير إلى نسخة غير موجودة
SELECT count(*) AS versions_bad_supersede_ref
FROM article_versions v
WHERE v.superseded_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM article_versions x WHERE x.id = v.superseded_by);

-- ⑧ Knowledge Graph (بلا FK): علاقات مصدرها article غير موجود
SELECT count(*) AS relations_missing_article_source
FROM legal_relations r
WHERE r.source_type = 'article'
  AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = r.source_id);

-- ⑨ Knowledge Graph: علاقات هدفها article غير موجود
SELECT count(*) AS relations_missing_article_target
FROM legal_relations r
WHERE r.target_type = 'article'
  AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = r.target_id);

-- ⑩ Knowledge Graph: علاقات مصدرها/هدفها ruling غير موجود
SELECT
  count(*) FILTER (WHERE r.source_type = 'ruling'
    AND NOT EXISTS (SELECT 1 FROM judicial_cases c WHERE c.id = r.source_id)) AS rel_missing_ruling_source,
  count(*) FILTER (WHERE r.target_type = 'ruling'
    AND NOT EXISTS (SELECT 1 FROM judicial_cases c WHERE c.id = r.target_id)) AS rel_missing_ruling_target
FROM legal_relations r;

-- ⑪ أعمدة embeddings تشير إلى مادة غير موجودة (متجهات ليتيمة)
SELECT count(*) AS embeddings_orphan_article
FROM embeddings e
WHERE e.owner_type = 'article'
  AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = e.owner_id);

-- ⑫ حواف الرسم البياني تشير إلى عقد غير موجودة (رغم وجود FK+Cascade، تحقّق تأكيدي)
SELECT
  count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM legal_graph_nodes n WHERE n.id = ed."sourceId")) AS edge_missing_source,
  count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM legal_graph_nodes n WHERE n.id = ed."targetId")) AS edge_missing_target
FROM legal_graph_edges ed;

-- ⑬ روابط الفقه إلى معرّف مادة غير موجود (articleId مرجع منطقي اختياري)
SELECT count(*) AS fiqh_links_bad_article_ref
FROM fiqh_issue_links fl
WHERE fl.article_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = fl.article_id);
