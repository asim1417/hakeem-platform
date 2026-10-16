-- ═══════════════════════════════════════════════════════════════════
-- 19-dedupe-and-supersede.sql
-- معالجة التكرار ووسم الأنظمة الملغاة — منصة حكيم
--
-- ⛔ لا يُشغَّل القسم (ب) وما بعده إلا بموافقة صريحة.
-- القسم (أ) تشخيص للقراءة فقط وآمن تمامًا.
--
-- المبدأ الحاكم: لا يُحذف نصّ تشريعي. الملغى يُوسم ويبقى، لأنه واجب التطبيق
-- على الوقائع التي نشأت في ظلّه. الحذف مقصور على صفّ لا يحمل نصًّا فريدًا،
-- وبعد نقل كل مراجعه.
-- ═══════════════════════════════════════════════════════════════════

-- ══════════════════ (أ) تشخيص — قراءة فقط ══════════════════

-- ① كل التكرارات النصّية الحقيقية داخل كل نظام (بالنص الكامل لا المقتطع).
SELECT "lawName",
       md5(content)                                        AS text_hash,
       array_agg("articleNumber" ORDER BY "articleNumber")  AS article_numbers,
       array_agg(id ORDER BY "articleNumber")               AS article_ids,
       count(*)                                             AS copies,
       length(min(content))                                 AS text_len
FROM legal_articles
WHERE btrim(content) <> ''
GROUP BY "lawName", md5(content)
HAVING count(*) > 1
ORDER BY count(*) DESC, "lawName";

-- ② الأنظمة المرشّحة للإلغاء (لاحقة سنة هجرية + توأم بالاسم المجرّد).
SELECT s_old.id   AS old_id,   s_old.name AS old_name,   s_old."articleCount" AS old_articles,
       s_new.id   AS new_id,   s_new.name AS new_name,   s_new."articleCount" AS new_articles
FROM legal_systems s_old
JOIN legal_systems s_new
  ON btrim(regexp_replace(s_old.name, '\s*1[34][0-9]{2}\s*هـ?\s*$', '')) = btrim(s_new.name)
 AND s_old.id <> s_new.id
ORDER BY s_old.name;

-- ③ المواد التي تحمل لغة إحلال صريحة — مادة بناء شجرة الإحلال.
SELECT "lawName", "articleNumber", left(content, 220) AS excerpt
FROM legal_articles
WHERE content ~ '(يحل هذا (النظام|التنظيم|اللائحة) محل|يحل التنظيم محل|يلغي هذا النظام نظام)'
ORDER BY "lawName";

-- ④ ★ جرد المراجع قبل أي حذف — شغّله لكل id مرشّح للحذف.
--    إن رجع أي رقم > 0 فالحذف ممنوع قبل نقل المرجع.
WITH candidates(article_id) AS (VALUES ('ضع_المعرّف_هنا'))
SELECT c.article_id,
  (SELECT count(*) FROM legal_article_case_links x WHERE x."articleId" = c.article_id) AS case_links,
  (SELECT count(*) FROM article_versions        x WHERE x."articleId" = c.article_id) AS versions,
  (SELECT count(*) FROM article_amendments      x WHERE x."articleId" = c.article_id) AS amendments,
  (SELECT count(*) FROM embeddings              x WHERE x."ownerType" = 'legal_article' AND x."ownerId" = c.article_id) AS embeddings,
  (SELECT count(*) FROM consultation_citations  x WHERE x."articleId" = c.article_id) AS citations,
  (SELECT count(*) FROM legal_graph_nodes       x WHERE x."articleId" = c.article_id) AS graph_nodes
FROM candidates c;

-- ⑤ الأنظمة المستوردة أكثر من مرة (صفوف بعيدة عن دفعة الاستيراد الأصلية).
SELECT "lawName", count(*) AS rows,
       min("createdAt") AS first_import, max("createdAt") AS last_import,
       max("createdAt") - min("createdAt") AS import_spread
FROM legal_articles
GROUP BY "lawName"
HAVING max("createdAt") - min("createdAt") > interval '1 day'
ORDER BY import_spread DESC;


-- ══════════════════ (ب) ترقية المخطط — تحتاج موافقة ══════════════════
-- تُضاف الحقول التي يوجبها CLAUDE.md ولا يحتويها المخطط المطبَّق حاليًا،
-- وبدونها يستحيل التمييز بين الساري والملغى، وبين النظام ولائحته.
BEGIN;

ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'ساري';
ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS "supersededById"  text REFERENCES legal_systems(id);
ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS "parentSystemId"  text REFERENCES legal_systems(id);
ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS "royalDecree"     text;
ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS "effectiveFrom"   date;
ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS "repealedOn"      date;
ALTER TABLE legal_systems ADD COLUMN IF NOT EXISTS "sourceUrl"       text;

ALTER TABLE legal_systems DROP CONSTRAINT IF EXISTS legal_systems_status_chk;
ALTER TABLE legal_systems ADD  CONSTRAINT legal_systems_status_chk
  CHECK (status IN ('ساري','ملغى','معدل','مستبدل','معلق'));

CREATE INDEX IF NOT EXISTS idx_legal_systems_status    ON legal_systems(status);
CREATE INDEX IF NOT EXISTS idx_legal_systems_parent    ON legal_systems("parentSystemId");
CREATE INDEX IF NOT EXISTS idx_legal_systems_superseded ON legal_systems("supersededById");

-- ⚠️ بعد الاعتماد: أضف الحقول نفسها إلى model LegalSystem في
--    prisma/schema.prisma وولّد هجرة رسمية، وإلا انحرف المخطط عن Prisma.
COMMIT;


-- ══════════════════ (ج) وسم النسخ الملغاة — لا حذف ══════════════════
-- ⚠️ راجع ناتج (أ)② أولًا وتحقّق يدويًا من كل زوج قبل التنفيذ.
BEGIN;

CREATE TABLE IF NOT EXISTS legal_systems_backup_20260911 AS
  SELECT * FROM legal_systems;

WITH pairs AS (
  SELECT s_old.id AS old_id, s_new.id AS new_id
  FROM legal_systems s_old
  JOIN legal_systems s_new
    ON btrim(regexp_replace(s_old.name, '\s*1[34][0-9]{2}\s*هـ?\s*$', '')) = btrim(s_new.name)
   AND s_old.id <> s_new.id
)
UPDATE legal_systems s
SET status = 'ملغى',
    "supersededById" = p.new_id,
    "updatedAt" = now()
FROM pairs p
WHERE s.id = p.old_id;

-- المواد التابعة للنظام الملغى تُوسم كذلك — وتبقى كاملة قابلة للقراءة.
UPDATE legal_articles a
SET status = 'ملغاة', "updatedAt" = now()
FROM legal_systems s
WHERE a."legalSystemId" = s.id AND s.status = 'ملغى' AND a.status <> 'ملغاة';

-- سجّل الواقعة تصحيحَ بيانات لا تعديلًا تشريعيًا.
INSERT INTO audit_logs (id, "userId", action, "entityType", "entityId", metadata, "createdAt")
SELECT gen_random_uuid()::text, NULL, 'LEGAL_DATA_CORRECTION', 'legal_system', s.id,
       jsonb_build_object('kind','mark_superseded','not_a_legislative_amendment',true,
                          'superseded_by', s."supersededById",
                          'report','reports/legal-data-audit-2026-09-11/18-sources-and-duplicates-report.md'),
       now()
FROM legal_systems s WHERE s.status = 'ملغى';

SELECT name, status, "supersededById", "articleCount"
FROM legal_systems WHERE status = 'ملغى' ORDER BY name;

-- راجع الناتج ثم بدّل إلى COMMIT.
ROLLBACK;


-- ══════════════════ (د) ربط اللوائح بأنظمتها ══════════════════
BEGIN;

UPDATE legal_systems child
SET "parentSystemId" = parent.id, "updatedAt" = now()
FROM legal_systems parent
WHERE child.name ~ '^(اللائحة التنفيذية|اللوائح التنفيذية)\s+ل'
  AND child.id <> parent.id
  AND parent.name = btrim(regexp_replace(child.name,
        '^(اللائحة التنفيذية|اللوائح التنفيذية)\s+ل', ''))
  AND child."parentSystemId" IS NULL;

SELECT c.name AS regulation, p.name AS parent_statute
FROM legal_systems c JOIN legal_systems p ON p.id = c."parentSystemId"
ORDER BY p.name;

ROLLBACK; -- راجع ثم COMMIT.


-- ══════════════════ (هـ) حذف صفّ زائد — الحالة الوحيدة المسموحة ══════════════════
-- الشرط: الصفّ لا يحمل نصًّا فريدًا (نسخة حرفية)، وجرد (أ)④ أرجع أصفارًا،
-- أو نُقلت كل مراجعه إلى الصفّ الباقي.
--
-- ⚠️ لا ينطبق هذا على نظام المعاملات المدنية: صفّه ٧٢١ ليس زائدًا —
--    هو موضع المادة الرسمية ٧٢١، ويُصحَّح نصُّه في 11-apply.sql لا يُحذف.
--    حذفه يُفقد النظام مادة رسمية.
--
-- BEGIN;
--   -- ١) انقل المراجع أولًا:
--   -- UPDATE legal_article_case_links SET "articleId" = :keep_id WHERE "articleId" = :drop_id;
--   -- UPDATE consultation_citations   SET "articleId" = :keep_id WHERE "articleId" = :drop_id;
--   -- DELETE FROM embeddings WHERE "ownerType"='legal_article' AND "ownerId" = :drop_id;
--   -- ٢) ثم احذف:
--   -- DELETE FROM legal_articles WHERE id = :drop_id;
-- ROLLBACK;
