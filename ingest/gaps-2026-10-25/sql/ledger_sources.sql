-- سجل النواقص — الجزء الثاني: كل ما في مصادرنا المخزنة ولا يقابله شيء في حكيم (HKM-047) — قراءة فقط.
-- المصادر: لقطة الهيئة (boe.*)، ولقطة أم القرى (uqn_stage.*)، وطابور تصحيحها (uqn_fix.*).
-- (nezams وملفات وزارة العدل في المستودع تُقابل في scripts/ledger.py.)
-- الأعمدة كما في ledger.sql: gap, route, prio, sid, law, aid, art, ref, detail
WITH
lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
core AS (SELECT unnest(ARRAY['نظام المرافعات الشرعية','نظام الإجراءات الجزائية','نظام الإثبات','نظام التنفيذ','نظام المحاكم التجارية',
  'نظام ديوان المظالم','نظام المرافعات أمام ديوان المظالم','نظام القضاء','نظام المحاماة','نظام التحكيم','نظام التوثيق',
  'نظام الأحوال الشخصية','نظام المعاملات المدنية','نظام العمل','نظام الإفلاس']) AS name),
sys AS (SELECT s.id, s.name, s.preamble, coalesce(lw.verified_status, '') ws,
          CASE WHEN s.name IN (SELECT name FROM core) THEN 1 WHEN s.instrument_kind = 'نظام' THEN 2 ELSE 3 END prio
        FROM legal_systems s LEFT JOIN lw ON lw.object_id = s.id),
dead AS (SELECT unnest(ARRAY['مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض']) AS st),
-- كل بطاقات الهيئة المطابَقة (السارية والقديمة)
mt AS (SELECT m.hakeem_system_id sid, l.id law_id, l.guid, l.url, l.status_at_source FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid WHERE m.hakeem_system_id IS NOT NULL),
ha AS (SELECT x.id, x."legalSystemId" sid, x."articleNumber" n, (x."articleBis" > 0) b, x.content, coalesce(x.chapter, '') chapter FROM legal_articles x WHERE x."articleBis" < 100),
-- أعمال أم القرى المُدخلة: نظام حكيم ← مصدره
us AS (SELECT DISTINCT p.entity_id sid, p.source_id FROM legal_text_provenance p WHERE p.source = 'uqn' AND p.entity_type = 'system'),
-- نص أم القرى بلا تذييل الموقع (أزاله HKM-045d من حكيم بالعبارة نفسها)
uu AS (SELECT us.sid, u.source_id, u.seq, u.unit_type, u.number,
              regexp_replace(u.body, '(\s*(تنزيل الملف|تم نسخ الرابط))*\s*جميع الحقوق محفوظة لجريدة أم القرى © \d{4}\s*$', '') body,
              coalesce(u.chapter, '') || coalesce(u.section, '') chap FROM us JOIN uqn_stage.unit u ON u.source_id = us.source_id),
g AS (
  -- P1: ديباجة/أداة إصدار في الهيئة ونظام حكيم بلا ديباجة
  SELECT 'P1' gap, 'build' route, sys.prio, sys.id sid, sys.name law, NULL::text aid, NULL::int art, mt.url ref,
         jsonb_build_object('source', 'boe', 'blocks', (SELECT jsonb_agg(DISTINCT b.kind) FROM boe.text_block b WHERE b.law_id = mt.law_id AND b.kind IN ('royal_decree', 'royal_order', 'cabinet_decision', 'preamble_other'))) detail
  FROM mt JOIN sys ON sys.id = mt.sid
  WHERE coalesce(length(sys.preamble), 0) < 40 AND EXISTS (SELECT 1 FROM boe.text_block b WHERE b.law_id = mt.law_id AND b.kind IN ('royal_decree', 'royal_order', 'cabinet_decision', 'preamble_other'))
  UNION ALL
  -- P1u: ديباجة/أداة في أم القرى ونظام حكيم بلا ديباجة
  SELECT 'P1u', 'build', sys.prio, sys.id, sys.name, NULL, NULL, 'https://www.uqn.gov.sa/details?p=' || replace(min(uu.source_id), 'uqn:', ''),
         jsonb_build_object('source', 'uqn', 'units', count(*), 'types', jsonb_agg(DISTINCT uu.unit_type))
  FROM uu JOIN sys ON sys.id = uu.sid
  WHERE uu.unit_type IN ('preamble', 'enacting_instrument', 'approval_instrument') AND coalesce(length(sys.preamble), 0) < 40
  GROUP BY sys.prio, sys.id, sys.name
  UNION ALL
  -- P2: عناوين أبواب وفصول في الهيئة ونظام حكيم بلا أي علامة تقسيم
  SELECT 'P2', 'build', sys.prio, sys.id, sys.name, NULL, NULL, mt.url, jsonb_build_object('source', 'boe', 'units_with_headings', count(*))
  FROM mt JOIN sys ON sys.id = mt.sid JOIN boe.unit u ON u.law_id = mt.law_id
  WHERE u.body_html ~ '(الباب|الفصل)' AND NOT EXISTS (SELECT 1 FROM ha WHERE ha.sid = sys.id AND ha.chapter <> '')
  GROUP BY sys.prio, sys.id, sys.name, mt.url
  UNION ALL
  -- P2u: الشيء نفسه من أم القرى
  SELECT 'P2u', 'build', sys.prio, sys.id, sys.name, NULL, NULL, NULL, jsonb_build_object('source', 'uqn', 'units_with_headings', count(*))
  FROM uu JOIN sys ON sys.id = uu.sid
  WHERE uu.chap <> '' AND NOT EXISTS (SELECT 1 FROM ha WHERE ha.sid = sys.id AND ha.chapter <> '')
  GROUP BY sys.prio, sys.id, sys.name
  UNION ALL
  -- U1h: مادة في بطاقة هيئة قديمة/ملغاة مطابَقة، غائبة من سجلها في حكيم (للعرض «كما في تاريخ»)
  SELECT 'U1h', 'build', 3, sys.id, sys.name, NULL, coalesce(u.article_number, f.article_number), mt.url,
         jsonb_build_object('boe_law_id', mt.law_id, 'seq', u.seq, 'status_at_source', mt.status_at_source, 'hakeem_status', sys.ws)
  FROM mt JOIN sys ON sys.id = mt.sid JOIN boe.unit u ON u.law_id = mt.law_id
  LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq
  WHERE (sys.ws IN (SELECT st FROM dead) OR mt.status_at_source = 'لاغي') AND coalesce(u.article_number, f.article_number) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ha WHERE ha.sid = sys.id AND ha.n = coalesce(u.article_number, f.article_number)
                    AND ha.b = CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END)
  UNION ALL
  -- U1u: مادة في أم القرى غائبة من النظام المُدخل منها
  SELECT 'U1u', 'build', sys.prio, sys.id, sys.name, NULL, uu.number, 'https://www.uqn.gov.sa/details?p=' || replace(uu.source_id, 'uqn:', ''),
         jsonb_build_object('uqn', uu.source_id, 'seq', uu.seq)
  FROM uu JOIN sys ON sys.id = uu.sid
  WHERE uu.unit_type = 'article' AND uu.number IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ha WHERE ha.sid = uu.sid AND ha.n = uu.number)
  UNION ALL
  -- U5u: نص المادة في حكيم يخالف نصها في أم القرى (بعد التطبيع) ولا نسخة لها
  SELECT 'U5u', 'reader', sys.prio, sys.id, sys.name, ha.id, ha.n, 'https://www.uqn.gov.sa/details?p=' || replace(uu.source_id, 'uqn:', ''),
         jsonb_build_object('uqn', uu.source_id, 'seq', uu.seq, 'sim', round(similarity(uqn_fix.hkm30_norm(uu.body), uqn_fix.hkm30_norm(ha.content))::numeric, 2),
           'hakeem_edit', EXISTS (SELECT 1 FROM legal_text_provenance p WHERE p.entity_id = ha.id AND p.source = 'hakeem'))
  FROM uu JOIN sys ON sys.id = uu.sid JOIN ha ON ha.sid = uu.sid AND ha.n = uu.number AND NOT ha.b
  WHERE uu.unit_type = 'article' AND uqn_fix.hkm30_norm(uu.body) <> uqn_fix.hkm30_norm(ha.content)
    AND NOT EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = ha.id)
    AND NOT EXISTS (SELECT 1 FROM legal_text_provenance p WHERE p.entity_id = ha.id AND p.action LIKE 'boe_equiv_reviewed:%')
  UNION ALL
  -- E1: أثر تعديل أو إلغاء رصده التقاط أم القرى ولم يتحول إلى عملية في الطابور
  SELECT 'E1', 'reader', 2, e.resolved_work_id, e.target_title_as_cited, NULL, NULL, e.source_url,
         jsonb_build_object('effect', e.effect_id, 'type', e.effect_type, 'match', e.target_match_status, 'instrument', concat_ws(' ', e.instrument_kind, e.instrument_no, e.instrument_date_hijri), 'published', e.published_hijri)
  FROM uqn_stage.effect e
  WHERE e.effect_type <> 'enact' AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_op o WHERE o.effect_id = e.effect_id)
    AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_manual m WHERE m.effect_id = e.effect_id)
  UNION ALL
  -- E2: إحلال مثبت (أم القرى) والنظام القديم في حكيم ما زال بلا حالة إحلال أو إلغاء
  SELECT 'E2', 'reader', 2, s.id, se.old_title, NULL, NULL, se.evidence_url,
         jsonb_build_object('new_title', se.new_title, 'relation', se.relation, 'evidence_status', se.status, 'hakeem_status', sys.ws)
  FROM uqn_fix.supersession_evidence se LEFT JOIN legal_systems s ON s.code = se.old_hakeem_code OR s.id = se.old_hakeem_code LEFT JOIN sys ON sys.id = s.id
  WHERE coalesce(sys.ws, '') NOT IN (SELECT st FROM dead)
  UNION ALL
  -- E3: نظام جديد في طابور التصحيح غير موجود في حكيم بالاسم
  SELECT 'E3', 'identity', 2, NULL, nl.title, NULL, NULL, coalesce(nl.official_url, nl.text_source_url),
         jsonb_build_object('status', nl.status, 'text_verification', nl.text_verification, 'units', (SELECT count(*) FROM uqn_fix.new_law_unit u WHERE u.title = nl.title))
  FROM uqn_fix.new_law nl WHERE NOT EXISTS (SELECT 1 FROM legal_systems s WHERE s.name = nl.title OR s.name LIKE nl.title || ' %')
  UNION ALL
  -- R1: وثيقتان مرتبطتان في صفحة الهيئة، وكلتاهما في حكيم، ولا علاقة بينهما
  SELECT 'R1', 'reader', 3, a.sid, (SELECT name FROM legal_systems WHERE id = a.sid), NULL, NULL, NULL,
         jsonb_build_object('related_sid', b.sid, 'label', r.label)
  FROM boe.related_doc r JOIN mt a ON a.law_id = r.law_id JOIN mt b ON b.guid = r.target_guid
  WHERE a.sid <> b.sid AND NOT EXISTS (SELECT 1 FROM legal_relations x WHERE (x.source_id = a.sid AND x.target_id = b.sid) OR (x.source_id = b.sid AND x.target_id = a.sid))
  UNION ALL
  -- A1: مرفق في الهيئة لم يُقرأ نصه بعد (قد يحوي أداة تعديل أو جدولًا)
  SELECT 'A1', 'fetch', 3, (SELECT m.hakeem_system_id FROM boe.current_match m WHERE m.guid = ap.law_guid), ap.label, NULL, NULL, ap.href,
         jsonb_build_object('kind', ap.kind, 'priority', ap.priority)
  FROM boe.attachment_pending ap
)
SELECT gap, route, prio, sid, law, aid, art, ref, detail FROM g ORDER BY gap, prio, law, art NULLS FIRST;
