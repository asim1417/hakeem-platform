-- ════════════════════════════════════════════════════════════════════════
-- فحص صحّة حيّ (قراءة فقط) — يجيب: قاعدة الأنظمة نظيفة؟ العلاقات صحّية؟
-- يُشغَّل عبر health-check.yml على Neon. ON_ERROR_STOP=0: جدول مفقود لا يوقف البقية.
-- ════════════════════════════════════════════════════════════════════════

\echo '=== ① الجرد ==='
SELECT 'systems'  AS entity, count(*) FROM legal_systems
UNION ALL SELECT 'articles', count(*) FROM legal_articles
UNION ALL SELECT 'judicial_cases', count(*) FROM judicial_cases
UNION ALL SELECT 'principles', count(*) FROM judicial_principles;

\echo '=== ② نظافة قاعدة الأنظمة ==='
-- أنظمة مكرّرة بالاسم
SELECT 'أنظمة مكرّرة بالاسم' AS check, count(*) AS n FROM (
  SELECT "name" FROM legal_systems GROUP BY "name" HAVING count(*) > 1
) d
UNION ALL
-- أنظمة بلا اسم
SELECT 'أنظمة بلا اسم', count(*) FROM legal_systems WHERE "name" IS NULL OR trim("name") = ''
UNION ALL
-- مواد يتيمة (نظامها غير موجود)
SELECT 'مواد يتيمة (systemId مفقود)', count(*) FROM legal_articles a
  WHERE a."legalSystemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM legal_systems s WHERE s.id = a."legalSystemId")
UNION ALL
-- مواد بلا نصّ
SELECT 'مواد بلا نصّ (content فارغ)', count(*) FROM legal_articles WHERE content IS NULL OR trim(content) = ''
UNION ALL
-- مواد بلا اسم نظام (lawName)
SELECT 'مواد بلا اسم نظام', count(*) FROM legal_articles WHERE "lawName" IS NULL OR trim("lawName") = ''
UNION ALL
-- مواد بلا ربط بمعرّف نظام ثابت (تعتمد الاسم النصّي الهشّ فقط)
SELECT 'مواد بلا legalSystemId (ربط هشّ)', count(*) FROM legal_articles WHERE "legalSystemId" IS NULL;

\echo '=== ③ تغطية البحث/الفهرسة ==='
SELECT 'مواد بمتّجه دلالي (embeddings)' AS check,
       (SELECT count(*) FROM embeddings WHERE owner_type='article') AS n
UNION ALL
SELECT 'مواد بنصّ تطبيع البحث (search_norm)',
       (SELECT count(*) FROM legal_articles WHERE search_norm IS NOT NULL AND trim(search_norm) <> '');

\echo '=== ④ صحّة العلاقات (Knowledge Graph) ==='
SELECT 'إجمالي العلاقات' AS check, count(*) AS n FROM legal_relations
UNION ALL
SELECT 'علاقات ذاتية (source=target)', count(*) FROM legal_relations WHERE source_id = target_id
UNION ALL
SELECT 'علاقات يتيمة: مصدر مادة مفقود',
       count(*) FROM legal_relations r WHERE r.source_type='article'
         AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = r.source_id)
UNION ALL
SELECT 'علاقات يتيمة: هدف مادة مفقود',
       count(*) FROM legal_relations r WHERE r.target_type='article'
         AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id = r.target_id)
UNION ALL
SELECT 'مصادر متمايزة', count(DISTINCT source_id) FROM legal_relations;
