-- سجل نواقص قاعدة أنظمة حكيم (HKM-051) — قراءة فقط.
-- يُشغَّل داخل معاملة READ ONLY: scripts/ledger.py يضبطها، أو يدويًا:
--   BEGIN; SET TRANSACTION READ ONLY; \i ledger.sql ; ROLLBACK;
-- كل صف نقص واحد: الرمز، المسار المقترح، الأولوية، النظام، المادة، المرجع الرسمي، تفاصيل.
-- الرموز معرّفة في ../taxonomy.json. التسويات السابقة تُستبعد في scripts/ledger.py من ../exceptions.jsonl لا هنا.
WITH
lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
lv AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'unit' ORDER BY object_id, verified_at DESC, id DESC),
core AS (SELECT unnest(ARRAY['نظام المرافعات الشرعية','نظام الإجراءات الجزائية','نظام الإثبات','نظام التنفيذ','نظام المحاكم التجارية',
  'نظام ديوان المظالم','نظام المرافعات أمام ديوان المظالم','نظام القضاء','نظام المحاماة','نظام التحكيم','نظام التوثيق',
  'نظام الأحوال الشخصية','نظام المعاملات المدنية','نظام العمل','نظام الإفلاس']) AS name),
sys AS (SELECT s.id, s.name, s.instrument_kind, s.classification, s.preamble_effective_from, coalesce(lw.verified_status, '') ws,
          CASE WHEN s.name IN (SELECT name FROM core) THEN 1 WHEN s.instrument_kind = 'نظام' THEN 2 ELSE 3 END prio
        FROM legal_systems s LEFT JOIN lw ON lw.object_id = s.id),
-- صفحة الهيئة السارية لكل نظام في حكيم (كما في scripts/db-health.sql)
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id, l.guid, l.url
       FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid
       WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cur AS (SELECT mt.*, sys.name, sys.prio FROM mt JOIN sys ON sys.id = mt.sid WHERE sys.ws NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')),
bu AS (SELECT cur.sid, cur.name, cur.prio, cur.url, u.law_id, u.seq, u.css_class, u.body,
              coalesce(u.article_number, f.article_number) n,
              CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b
       FROM cur JOIN boe.unit u ON u.law_id = cur.law_id
       LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq),
ha AS (SELECT x.id, x."legalSystemId" sid, x."articleNumber" n, (x."articleBis" > 0) b, x.content FROM legal_articles x WHERE x."articleBis" < 100),
g AS (
  -- W1a/W2a: بطاقة هيئة بلا ربط بحكيم؛ قد يكون للعمل سجل قديم في حكيم فالمسار هوية
  SELECT CASE WHEN l.status_at_source = 'لاغي' THEN 'W2a' ELSE 'W1a' END gap, 'identity' route, 3 prio, NULL::text sid, l.name law, NULL::text aid, NULL::int art,
         l.url ref, jsonb_build_object('boe_law_id', l.id, 'guid', l.guid, 'issued', l.issued_hijri, 'units', (SELECT count(*) FROM boe.unit u WHERE u.law_id = l.id),
           'nearest', (SELECT jsonb_build_object('id', s.id, 'name', s.name, 'sim', round(similarity(s.name, l.name)::numeric, 2)) FROM legal_systems s ORDER BY similarity(s.name, l.name) DESC LIMIT 1)) detail
  FROM boe.law l WHERE NOT EXISTS (SELECT 1 FROM boe.current_match m WHERE m.guid = l.guid AND m.hakeem_system_id IS NOT NULL)
  UNION ALL
  -- W1b: عمل من لقطة أم القرى لم يُدخل؛ بلا نص مستخرج ← جلب/قراءة
  SELECT 'W1b', CASE WHEN w.parse_status = 'complete' THEN 'identity' ELSE 'fetch' END, 3, NULL, w.title, NULL, NULL, w.source_url,
         jsonb_build_object('uqn', w.source_id, 'type', w.work_type, 'parse', w.parse_status, 'units', w.article_count, 'published', w.published_hijri)
  FROM uqn_stage.work w WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance p WHERE p.source = 'uqn' AND p.entity_type = 'system' AND p.source_id = w.source_id)
  UNION ALL
  -- W3: نظام بلا مواد
  SELECT 'W3', 'fetch', sys.prio, sys.id, sys.name, NULL, NULL, NULL, jsonb_build_object('status', sys.ws, 'kind', sys.instrument_kind)
  FROM sys WHERE NOT EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId" = sys.id)
  UNION ALL
  -- U1: وحدة رسمية (الهيئة) لا مادة لها في حكيم
  SELECT 'U1', 'build', bu.prio, bu.sid, bu.name, NULL, bu.n, bu.url, jsonb_build_object('boe_law_id', bu.law_id, 'seq', bu.seq, 'bis', bu.b, 'css', bu.css_class)
  FROM bu WHERE bu.n IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ha WHERE ha.sid = bu.sid AND ha.n = bu.n AND ha.b = bu.b)
  UNION ALL
  -- U2: مادة في حكيم بلا وحدة رسمية مقابلة (مراجعة؛ لا حذف)
  SELECT 'U2', 'reader', cur.prio, cur.sid, cur.name, ha.id, ha.n, cur.url, jsonb_build_object('bis', ha.b)
  FROM cur JOIN ha ON ha.sid = cur.sid WHERE NOT EXISTS (SELECT 1 FROM bu WHERE bu.sid = cur.sid AND bu.n = ha.n AND bu.b = ha.b)
  UNION ALL
  -- U3: ملاحظة تعديل في الهيئة على مادة لا نسخة لها ولا تحقق — قد يعرض حكيم النص الأصلي
  SELECT 'U3', 'reader', bu.prio, bu.sid, bu.name, ha.id, bu.n, 'boe.amendment_note:' || n.id,
         jsonb_build_object('note', n.id, 'same_as_boe_body', uqn_fix.hkm30_norm(bu.body) = uqn_fix.hkm30_norm(ha.content),
           'has_new_text', coalesce(n.new_text, '') <> '', 'css', bu.css_class, 'instrument', concat_ws(' ', n.instrument_kind, n.instrument_no, n.instrument_date_hijri))
  FROM boe.amendment_note n JOIN bu ON bu.law_id = n.law_id AND bu.seq = n.unit_seq
  JOIN ha ON ha.sid = bu.sid AND ha.n = bu.n AND ha.b = bu.b
  WHERE NOT EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = ha.id) AND NOT EXISTS (SELECT 1 FROM verification v WHERE v.object_id = ha.id)
  UNION ALL
  -- U4a: مادة مشطوبة في الهيئة ولا حالة إلغاء لها في حكيم
  SELECT 'U4a', 'reader', bu.prio, bu.sid, bu.name, ha.id, bu.n, bu.url, jsonb_build_object('boe_law_id', bu.law_id, 'seq', bu.seq, 'status', lv.verified_status)
  FROM bu JOIN ha ON ha.sid = bu.sid AND ha.n = bu.n AND ha.b = bu.b LEFT JOIN lv ON lv.object_id = ha.id
  WHERE bu.css_class LIKE '%canceled%' AND coalesce(lv.verified_status, '') NOT IN ('ملغاة', 'ملغى', 'مستبدل')
  UNION ALL
  -- U4b: مادة في حكيم تلغي مواد أو أبوابًا من نظام آخر — يحلّها scripts/ledger.py (الهوية والمدى) ثم تُبنى
  SELECT 'U4b', 'resolve', sys.prio, sys.id, sys.name, x.id, x."articleNumber", NULL,
         jsonb_build_object('clauses', (SELECT jsonb_agg(m[1]) FROM regexp_matches(x.content, '([^.؛]{0,60}(?:يلغي|يُلغي|يلغى|يُلغى|تلغى|تُلغى|تلغي|تُلغي)[^.؛]{0,250}[^.؛]{0,250})', 'g') m))
  FROM legal_articles x JOIN sys ON sys.id = x."legalSystemId"
  WHERE x."articleBis" < 100 AND sys.ws NOT IN ('سجل مخلوط — لا يُعرض')
    AND x.content ~ '(يلغي|يُلغي|يلغى|يُلغى|تلغى|تُلغى|تلغي|تُلغي)'
    AND x.content ~ '(الباب|الفصل|المواد|المادة|المادتين|الفقرة|البند|الفقرات)'
    AND x.content ~ '(من نظام|من اللائحة|من لائحة|من تنظيم|من قواعد|من النظام)'
  UNION ALL
  SELECT 'M1', 'reader', prio, id, name, NULL, NULL, NULL, '{}'::jsonb FROM sys WHERE ws = ''
  UNION ALL
  -- M2: النظام يلزمه تاريخ نفاذ دائمًا (م71 من النظام الأساسي). وغير النظام (لائحة، قواعد، …) لا يُعد ناقصًا إلا إذا نص على نفاذه،
  -- لأن ليس كل لائحة تتطلب تاريخ نفاذ (ملاحظة المالك 29/10)
  SELECT 'M2', 'reader', prio, id, name, NULL, NULL, NULL, jsonb_build_object('status', ws, 'kind', instrument_kind) FROM sys WHERE preamble_effective_from IS NULL
    AND (instrument_kind = 'نظام' OR EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId" = sys.id
         AND x.content ~ '(يعمل|يُعمل|تسري|يسري|تنفذ|ينفذ)[^.]{0,40}(من تاريخ|بعد)'))
  UNION ALL
  -- M2b: تاريخ النفاذ المخزن يساوي تاريخ الصدور، والنظام نفسه ينص على نفاذ مؤجل بعد النشر
  SELECT 'M2b', 'code', cur.prio, cur.sid, cur.name, NULL, NULL, cur.url,
         jsonb_build_object('stored', s.preamble_effective_from::date, 'issued', l.issued_gregorian::date, 'published', l.published_gregorian::date,
           'clause', (SELECT left(x.content, 200) FROM legal_articles x WHERE x."legalSystemId" = cur.sid AND x.content ~ 'يعمل ب[^.]{0,40}بعد[^.]{0,40}(يوم|يومًا|يوماً|سنة)[^.]{0,30}نشر' ORDER BY x."articleNumber" DESC LIMIT 1))
  FROM cur JOIN legal_systems s ON s.id = cur.sid JOIN boe.law l ON l.id = cur.law_id
  WHERE s.preamble_effective_from::date = l.issued_gregorian::date AND l.published_gregorian::date > l.issued_gregorian::date
    AND EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId" = cur.sid AND x.content ~ 'يعمل ب[^.]{0,40}بعد[^.]{0,40}(يوم|يومًا|يوماً|سنة)[^.]{0,30}نشر')
  UNION ALL
  -- M2c: تاريخ النفاذ المخزن منقول من تاريخ نائب في بطاقة الهيئة (أول محرم: yyyy/01/01)، وليس تاريخًا حقيقيًا (gap021)
  SELECT 'M2c', 'reader', s.prio, s.id, s.name, NULL, NULL, l.url,
         jsonb_build_object('stored', s.preamble_effective_from::date, 'boe_issued', l.issued_hijri, 'boe_published', l.published_hijri)
  FROM sys s JOIN boe.match m ON m.hakeem_system_id = s.id JOIN boe.law l ON l.guid = m.guid
  WHERE l.issued_hijri ~ '/0?1/0?1$' AND s.preamble_effective_from::date = l.issued_gregorian::date
  UNION ALL
  SELECT 'M3', 'reader', prio, id, name, NULL, NULL, NULL, jsonb_build_object('kind', instrument_kind) FROM sys WHERE coalesce(classification, '') IN ('', 'غير مصنف', 'غير مصنّف')
  UNION ALL
  SELECT 'M4', 'build', cur.prio, cur.sid, cur.name, NULL, NULL, cur.url, jsonb_build_object('guid', cur.guid)
  FROM cur WHERE NOT EXISTS (SELECT 1 FROM law_card c WHERE c.system_id = cur.sid)
  UNION ALL
  -- L1: لائحة/قواعد/ضوابط بلا علاقة IMPLEMENTS؛ النظام الأم المرشح من الاسم («… لنظام X»)
  SELECT 'L1', CASE WHEN p.id IS NOT NULL THEN 'build' ELSE 'reader' END, s.prio, s.id, s.name, NULL, NULL, NULL,
         jsonb_build_object('kind', s.instrument_kind, 'parent_id', p.id, 'parent_name', p.name)
  FROM sys s LEFT JOIN LATERAL (
    SELECT q.id, q.name FROM legal_systems q
    WHERE s.name ~ 'لنظام ' AND q.name = 'نظام ' || btrim(regexp_replace(substring(s.name FROM 'لنظام (.*)$'), '\s*(الصادر|ولائحته|ولوائحه|ضمن|الخاصة|المتعلقة|فيما).*$', ''))
    ORDER BY (SELECT verified_status FROM lw WHERE lw.object_id = q.id) = 'ساري' DESC NULLS LAST LIMIT 1) p ON true
  WHERE s.instrument_kind IN ('لائحة', 'قواعد', 'ضوابط', 'دليل') AND s.ws NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')
    AND NOT EXISTS (SELECT 1 FROM legal_relations r WHERE r.relation::text = 'IMPLEMENTS' AND (r.source_id = s.id OR r.target_id = s.id))
  UNION ALL
  -- Q1: عمليات تعديل أم القرى بلا قرار
  SELECT 'Q1', 'owner', 2, NULL, o.target_law_title, NULL, o.article_number, o.source_url, jsonb_build_object('op', o.op_id, 'type', o.op_type)
  FROM uqn_fix.amendment_op o WHERE NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_decision d WHERE d.op_id = o.op_id)
  UNION ALL
  -- Q2: ملاحظات المراقب اليومي المفتوحة
  SELECT 'Q2', 'owner', 2, f.hakeem_system_id, f.law_name, NULL, f.article_number, f.source_url, jsonb_build_object('finding', f.id, 'check', f.check_name, 'severity', f.severity)
  FROM monitor.finding f WHERE f.status = 'مفتوح'
)
SELECT gap, route, prio, sid, law, aid, art, ref, detail FROM g ORDER BY gap, prio, law, art NULLS FIRST;
