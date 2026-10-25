-- لقطة المواد لآلية النواقص (قراءة فقط): [id, legalSystemId, articleNumber, articleBis, chapter(80), آخر حالة وحدة, لها نسخة؟]
WITH lv AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'unit' ORDER BY object_id, verified_at DESC, id DESC)
SELECT 'ARTICLES' tag, json_agg(json_build_array(x.id, x."legalSystemId", x."articleNumber", x."articleBis", left(coalesce(x.chapter, ''), 80),
  coalesce(lv.verified_status, ''), EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = x.id)) ORDER BY x."legalSystemId", x."articleNumber", x."articleBis")
FROM legal_articles x LEFT JOIN lv ON lv.object_id = x.id;
