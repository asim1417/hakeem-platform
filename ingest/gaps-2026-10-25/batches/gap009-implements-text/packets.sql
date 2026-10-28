-- gap009 (HKM-051، الصنف L1): حزم القراءة للوائح بلا علاقة IMPLEMENTS — قراءة فقط.
WITH lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type='work' ORDER BY object_id, verified_at DESC, id DESC),
L AS (SELECT s.id, s.name, s.instrument_kind, s.preamble FROM legal_systems s LEFT JOIN lw ON lw.object_id=s.id
  WHERE s.instrument_kind IN ('لائحة','قواعد','ضوابط','دليل') AND coalesce(lw.verified_status,'') NOT IN ('مستبدل','ملغى','ملغاة','سجل مخلوط — لا يُعرض')
    AND NOT EXISTS (SELECT 1 FROM legal_relations r WHERE r.relation::text='IMPLEMENTS' AND (r.source_id=s.id OR r.target_id=s.id)))
SELECT json_agg(json_build_object(
  'id', L.id, 'name', L.name, 'kind', L.instrument_kind, 'preamble', left(L.preamble, 6000),
  'uqn', (SELECT json_agg(json_build_object('source_id', w.source_id, 'title', w.title, 'url', w.source_url, 'published', w.published_hijri))
          FROM legal_text_provenance p JOIN uqn_stage.work w ON w.source_id=p.source_id WHERE p.entity_id=L.id AND p.entity_type='system' AND p.source='uqn'),
  'boe', (SELECT json_agg(json_build_object('url', b.url, 'name', b.name)) FROM boe.current_match m JOIN boe.law b ON b.guid=m.guid WHERE m.hakeem_system_id=L.id),
  'arts', (SELECT json_agg(json_build_object('n', a."articleNumber", 'bis', a."articleBis", 'id', a.id, 't', left(a.content, 1800)) ORDER BY a."articleBis" > 0, a."articleNumber")
           FROM legal_articles a WHERE a."legalSystemId"=L.id AND a."articleBis"<100 AND (a."articleNumber" <= 3
             OR a.content ~ '(اللائحة التنفيذية ل|تنفيذًا ل|تنفيذاً ل|تنفيذا ل|استنادًا إلى|استناداً إلى|بناءً على|بناء على|المشار إليه في المادة|الصادر بالمرسوم الملكي)')),
  'art_count', (SELECT count(*) FROM legal_articles a WHERE a."legalSystemId"=L.id AND a."articleBis"<100)
) ORDER BY L.id) AS packets FROM L;
