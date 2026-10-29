-- لقطة الأنظمة لآلية النواقص (قراءة فقط): [id, name, preamble_royal_decree, آخر حالة عمل, instrument_kind, عدد المواد, "صدور الهيئة|أداتها|حالتها", preamble_effective_from]
WITH lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC)
SELECT 'SYSTEMS' tag, json_agg(json_build_array(s.id, s.name, s.preamble_royal_decree, coalesce(lw.verified_status, ''), s.instrument_kind,
  (SELECT count(*) FROM legal_articles x WHERE x."legalSystemId" = s.id AND x."articleBis" < 100),
  (SELECT l.issued_hijri || '|' || coalesce(l.instruments->0->>'text', '') || '|' || l.status_at_source FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid
     WHERE m.hakeem_system_id = s.id ORDER BY (l.status_at_source = 'ساري') DESC LIMIT 1),
  s.preamble_effective_from::date) ORDER BY s.name)
FROM legal_systems s LEFT JOIN lw ON lw.object_id = s.id;
