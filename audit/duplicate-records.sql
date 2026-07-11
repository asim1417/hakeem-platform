-- ═══════════════════════════════════════════════════════════════════════════
-- duplicate-records.sql — كشف التكرار (للقراءة فقط)
-- الغرض: مواد/أنظمة/أحكام/علاقات مكرّرة (مباشرة وبعد التطبيع).
-- المتوقّع الصحّي: dup مباشرة = 0 (محميّة بقيود @@unique)؛ لكن تكرار «بعد التطبيع»
--                  قد يكشف ازدواجاً حقيقياً لا يمنعه القيد (مثل فرق مسافة في الاسم).
-- ═══════════════════════════════════════════════════════════════════════════

-- ① مواد مكرّرة بنفس (lawName, articleNumber) — يُفترض أن يمنعها @@unique
SELECT "lawName", "articleNumber", count(*) AS n
FROM legal_articles
GROUP BY "lawName", "articleNumber"
HAVING count(*) > 1
ORDER BY n DESC;

-- ② أنظمة مكرّرة بعد تطبيع الاسم (إزالة المسافات + توحيد الهمزات/التاء/الياء)
--    كشف حالة مثل: «نظام المنافسات و المشتريات» مقابل «نظام المنافسات والمشتريات».
SELECT norm_name, count(*) AS n, array_agg(name) AS variants
FROM (
  SELECT id, name,
    regexp_replace(
      translate(name, 'إأآةى', 'ااااهي'),  -- توحيد الحروف
      '\s+', '', 'g'                          -- إزالة كل المسافات
    ) AS norm_name
  FROM legal_systems
) t
GROUP BY norm_name
HAVING count(*) > 1
ORDER BY n DESC;

-- ③ نصوص متطابقة بمعرّفات مختلفة (تكرار محتوى عبر مواد مختلفة)
--    قد يكون شرعياً (صياغة موحّدة) أو ازدواجاً — يحتاج مراجعة بشرية.
SELECT md5(regexp_replace(btrim(content), '\s+', ' ', 'g')) AS content_key,
       count(*) AS copies,
       array_agg(DISTINCT "lawName") AS across_laws
FROM legal_articles
WHERE length(btrim(content)) >= 30
GROUP BY content_key
HAVING count(*) > 1
ORDER BY copies DESC
LIMIT 100;

-- ④ أحكام مكرّرة بنفس sourceId (محميّ بـ@unique؛ تحقّق تأكيدي) وبنفس (caseNo, decisionNo)
SELECT "caseNo", "decisionNo", count(*) AS n
FROM judicial_cases
WHERE "caseNo" IS NOT NULL
GROUP BY "caseNo", "decisionNo"
HAVING count(*) > 1
ORDER BY n DESC
LIMIT 100;

-- ⑤ نصوص أحكام متطابقة بمعرّفات مختلفة
SELECT md5(regexp_replace(btrim("judgmentText"), '\s+', ' ', 'g')) AS jkey, count(*) AS copies
FROM judicial_cases
WHERE length(btrim("judgmentText")) >= 50
GROUP BY jkey
HAVING count(*) > 1
ORDER BY copies DESC
LIMIT 50;

-- ⑥ علاقات Knowledge Graph مكرّرة (نفس المصدر/الهدف/النوع) — لا قيد فريد يمنعها
SELECT source_type, source_id, target_type, target_id, relation, count(*) AS n
FROM legal_relations
GROUP BY source_type, source_id, target_type, target_id, relation
HAVING count(*) > 1
ORDER BY n DESC
LIMIT 100;

-- ⑦ روابط مادة↔حكم مكرّرة منطقياً (نفس المادة والحكم، citedText مختلف/فارغ)
--    القيد @@unique على (articleId, caseId, citedText) لا يمنع تكرار (article,case)
--    عندما يختلف citedText أو يكون NULL.
SELECT "articleId", "caseId", count(*) AS n
FROM legal_article_case_links
GROUP BY "articleId", "caseId"
HAVING count(*) > 1
ORDER BY n DESC
LIMIT 100;
