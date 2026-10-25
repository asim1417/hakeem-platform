-- حزم القراءة لصنف U3 (ملاحظة تعديل غير مطبقة) — قراءة فقط.
-- لكل ملاحظة: نص حكيم الحالي، ونص وحدة الهيئة، ونص الملاحظة والنص الجديد إن وُجد، وأداتها، ورقم الوحدة وعنوانها، والمادتان المجاورتان في الهيئة.
WITH lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id, l.url, l.name boe_name
       FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid
       WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cur AS (SELECT mt.* FROM mt LEFT JOIN lw ON lw.object_id = mt.sid WHERE coalesce(lw.verified_status, '') NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')),
bu AS (SELECT cur.sid, cur.url, u.law_id, u.seq, u.heading, u.body, u.css_class,
              coalesce(u.article_number, f.article_number) n, CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b
       FROM cur JOIN boe.unit u ON u.law_id = cur.law_id LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq)
SELECT 'U3PACKETS' tag, json_agg(json_build_object(
  'note_id', n.id, 'system_id', bu.sid, 'law', x."lawName", 'article_id', x.id, 'article_number', bu.n, 'bis', bu.b,
  'boe_url', bu.url, 'boe_heading', bu.heading, 'boe_css', bu.css_class,
  'hakeem_text', x.content, 'hakeem_md5', md5(x.content), 'boe_body', bu.body,
  'note_text', n.note_text, 'note_new_text', n.new_text, 'note_effect', n.effect,
  'instrument', concat_ws(' ', n.instrument_kind, n.instrument_no, n.instrument_date_hijri),
  'neighbours', (SELECT json_agg(json_build_object('n', b2.n, 'heading', b2.heading) ORDER BY b2.seq) FROM bu b2 WHERE b2.law_id = bu.law_id AND b2.seq BETWEEN bu.seq - 1 AND bu.seq + 1 AND b2.seq <> bu.seq)
) ORDER BY x."lawName", bu.n) packets
FROM boe.amendment_note n JOIN bu ON bu.law_id = n.law_id AND bu.seq = n.unit_seq
JOIN legal_articles x ON x."legalSystemId" = bu.sid AND x."articleBis" < 100 AND x."articleNumber" = bu.n AND (x."articleBis" > 0) = bu.b
WHERE NOT EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = x.id) AND NOT EXISTS (SELECT 1 FROM verification v WHERE v.object_id = x.id);
