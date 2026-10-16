-- ═══════════════════════════════════════════════════════════════════
-- 10-dry-run.sql — تشخيص للقراءة فقط. لا يكتب شيئًا. آمن على الإنتاج.
-- التاريخ: 2026-09-11
-- شغّله أولًا وأرفق مخرجاته مع طلب الموافقة على 11-apply.sql
-- ═══════════════════════════════════════════════════════════════════

-- ① بصمة الهدف: تأكّد أنك على Neon الإنتاجية قبل أي شيء.
--    لا تطبع رابط الاتصال ولا كلمة المرور.
SELECT current_database()                                   AS db_name,
       current_schema()                                     AS schema_name,
       version()                                            AS pg_version,
       inet_server_addr()::text                             AS host_masked,
       (SELECT count(*) FROM legal_systems)                 AS systems_count,
       (SELECT count(*) FROM legal_articles)                AS articles_count;

-- ② عدد مواد نظام المعاملات المدنية + وجود الديباجة.
SELECT count(*) FILTER (WHERE "articleNumber" > 0)  AS articles,
       count(*) FILTER (WHERE "articleNumber" = 0)  AS preamble_rows,
       min("articleNumber") FILTER (WHERE "articleNumber" > 0) AS min_no,
       max("articleNumber")                          AS max_no
FROM legal_articles WHERE "lawName" = 'نظام المعاملات المدنية';

-- ③ ★ الفحص الحاسم: المواد التي يتعارض رقمها المخزَّن مع العدد الترتيبي في عنوانها.
--    المتوقع قبل الإصلاح: 484 صفًّا (237..720).
--    ملاحظة: هذا فحص تقريبي بـSQL؛ الفحص المرجعي هو
--    scripts/audit/audit-legal-data.ts الذي يحلّل العدد الترتيبي كاملًا.
SELECT "articleNumber", title
FROM legal_articles
WHERE "lawName" = 'نظام المعاملات المدنية' AND "articleNumber" BETWEEN 230 AND 245
ORDER BY "articleNumber";

-- ④ ★ التكرار النصّي: المواد التي تتطابق نصوصها حرفيًا داخل النظام الواحد.
--    المتوقع: المادتان 720 و721 بنفس البصمة.
SELECT md5(content) AS text_hash,
       array_agg("articleNumber" ORDER BY "articleNumber") AS article_numbers,
       count(*) AS copies,
       left(content, 90) AS excerpt
FROM legal_articles
WHERE "lawName" = 'نظام المعاملات المدنية'
GROUP BY md5(content), left(content, 90)
HAVING count(*) > 1;

-- ⑤ التكرار النصّي عبر كامل الكوربوس (كل الأنظمة).
SELECT "lawName", md5(content) AS text_hash,
       array_agg("articleNumber" ORDER BY "articleNumber") AS article_numbers, count(*) AS copies
FROM legal_articles
GROUP BY "lawName", md5(content)
HAVING count(*) > 1
ORDER BY count(*) DESC, "lawName";

-- ⑥ فجوات الترقيم وأرقام المواد الشاذة.
SELECT "lawName", count(*) AS rows, max("articleNumber") AS max_no,
       max("articleNumber") - count(*) FILTER (WHERE "articleNumber" > 0) AS numbering_slack
FROM legal_articles GROUP BY "lawName"
HAVING max("articleNumber") > count(*) FILTER (WHERE "articleNumber" > 0)
ORDER BY numbering_slack DESC LIMIT 40;

-- ⑦ نصوص فارغة أو مبتورة.
SELECT "lawName", "articleNumber", length(content) AS len
FROM legal_articles WHERE content IS NULL OR btrim(content) = '' OR length(content) < 15
ORDER BY "lawName", "articleNumber" LIMIT 100;

-- ⑧ نطاق الأثر: الأحكام والعلاقات المرتبطة بالمواد المزاحة (237..721).
SELECT 'legal_article_case_links' AS relation, count(*) AS affected_rows
FROM legal_article_case_links l
JOIN legal_articles a ON a.id = l."articleId"
WHERE a."lawName" = 'نظام المعاملات المدنية' AND a."articleNumber" BETWEEN 237 AND 721
UNION ALL
SELECT 'article_versions', count(*) FROM article_versions v
JOIN legal_articles a ON a.id = v."articleId"
WHERE a."lawName" = 'نظام المعاملات المدنية' AND a."articleNumber" BETWEEN 237 AND 721
UNION ALL
SELECT 'article_amendments', count(*) FROM article_amendments m
JOIN legal_articles a ON a.id = m."articleId"
WHERE a."lawName" = 'نظام المعاملات المدنية' AND a."articleNumber" BETWEEN 237 AND 721;

-- ⑨ التضمينات المرتبطة بنصوص ستتغيّر (يجب إبطالها بعد الإصلاح).
SELECT count(*) AS embeddings_to_invalidate
FROM embeddings e
WHERE e."ownerType" = 'legal_article'
  AND e."ownerId" IN (SELECT id FROM legal_articles
                      WHERE "lawName" = 'نظام المعاملات المدنية' AND "articleNumber" BETWEEN 237 AND 721);

-- ⑩ الاستشهادات الصادرة للمستخدمين بالمواد المتأثرة (لتحديد الدراسات).
SELECT count(*) AS affected_consultation_citations
FROM consultation_citations c
WHERE c."articleId" IN (SELECT id FROM legal_articles
                        WHERE "lawName" = 'نظام المعاملات المدنية' AND "articleNumber" BETWEEN 237 AND 721);
