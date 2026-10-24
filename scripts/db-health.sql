-- مقياس صحة قاعدة الأنظمة (HKM-030 المرحلة 0) — قراءة فقط.
-- يُشغَّل على الإنتاج ويُحفظ ناتجه في data/health/<تاريخ>.json ويُقارن قبل/بعد كل دفعة.
-- الأبعاد: النص (مطابقة هيئة الخبراء)، الحداثة (التعديلات)، الحالة (الأنظمة والمواد)، البحث (search_norm والمتجهات).
WITH a AS (SELECT id, "legalSystemId" sid, content, search_norm FROM legal_articles WHERE "articleBis" < 100),
lv AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'unit' ORDER BY object_id, verified_at DESC, id DESC),
lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
ev AS (SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC),
-- مقارنة النص الساري بنص هيئة الخبراء (نفس التطبيع الذي يبني search_norm).
-- منذ 22/10: بالترقيم الحالي لا بجدول boe.diff (لقطة 16/10 سبقت إعادة الترقيم)، وصفحة الهيئة السارية لكل نظام
-- عبر boe.current_match، وأقرب وحدة إذا تكرر رقم المادة في الصفحة (صفحات تجمع أكثر من وثيقة)، ويُستثنى ما حالته عندنا مستبدل/ملغى.
-- الوحدات التي أسقط الزاحف رقمها تأخذ رقمها من boe.unit_number_fix (مطابقة المتن، 23/10).
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id
       FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid
       WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cmp AS (
  SELECT DISTINCT ON (x.id) x.id aid, u.law_id, u.seq,
         -- منذ 24/10 (البند 4): المادة التي رُوجع فرقها فثبت أنه تنسيقي فقط (أرقام فقرات، عنوان، ترقيم) تُعدّ مطابقة.
         (uqn_fix.hkm30_norm(u.body) = uqn_fix.hkm30_norm(coalesce(ev.body, x.content))
          OR EXISTS (SELECT 1 FROM verification fe WHERE fe.object_type = 'unit' AND fe.object_id = x.id AND fe.verified_by IN ('rule-item4-format-equiv-2026-10-24', 'owner-inject-hkm038-item4-2026-10-24'))) AS same,
         ev.unit_id IS NOT NULL AS amended,
         EXISTS (SELECT 1 FROM boe.amendment_note n WHERE n.law_id = u.law_id AND n.unit_seq = u.seq) AS has_note
  FROM mt
  JOIN legal_articles x ON x."legalSystemId" = mt.sid AND x."articleBis" < 100
  JOIN boe.unit u ON u.law_id = mt.law_id
  LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq
  JOIN LATERAL (SELECT coalesce(u.article_number, f.article_number) n, CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b) en ON en.n = x."articleNumber" AND en.b = (x."articleBis" > 0)
  LEFT JOIN ev ON ev.unit_id = x.id
  LEFT JOIN lw ON lw.object_id = mt.sid
  WHERE coalesce(lw.verified_status, '') NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')
  ORDER BY x.id, similarity(uqn_fix.hkm30_norm(u.body), uqn_fix.hkm30_norm(coalesce(ev.body, x.content))) DESC),
emb AS (SELECT DISTINCT owner_id FROM (SELECT owner_id FROM embeddings WHERE owner_type = 'article' UNION ALL SELECT owner_id FROM embedding_version WHERE owner_type = 'article') e)
SELECT json_build_object(
  'at', now(),
  'systems', (SELECT count(*) FROM legal_systems),
  'systems_empty', (SELECT count(*) FROM legal_systems s WHERE NOT EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId" = s.id)),
  'articles', (SELECT count(*) FROM a),
  'text_compared', (SELECT count(*) FROM cmp),
  'text_same', (SELECT count(*) FROM cmp WHERE same),
  'text_diff_amended_expected', (SELECT count(*) FROM cmp WHERE NOT same AND amended),
  'text_diff_note_unapplied', (SELECT count(*) FROM cmp WHERE NOT same AND NOT amended AND has_note),
  'text_diff_unexplained', (SELECT count(*) FROM cmp WHERE NOT same AND NOT amended AND NOT has_note),
  'text_pct', round(100.0 * (SELECT count(*) FROM cmp WHERE same) / nullif((SELECT count(*) FROM cmp), 0), 1),
  'amended_articles', (SELECT count(DISTINCT unit_id) FROM unit_version),
  'versions', (SELECT count(*) FROM unit_version),
  'boe_notes_matched', (SELECT count(*) FROM boe.amendment_note n JOIN cmp ON cmp.law_id = n.law_id AND cmp.seq = n.unit_seq),
  'boe_notes_handled', (SELECT count(*) FROM boe.amendment_note n JOIN cmp ON cmp.law_id = n.law_id AND cmp.seq = n.unit_seq WHERE EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = cmp.aid) OR EXISTS (SELECT 1 FROM verification x WHERE x.object_id = cmp.aid)),
  'systems_with_status', (SELECT count(*) FROM legal_systems s JOIN lw ON lw.object_id = s.id),
  'systems_with_effective', (SELECT count(*) FROM legal_systems WHERE preamble_effective_from IS NOT NULL),
  'articles_with_status', (SELECT count(*) FROM a JOIN lv ON lv.object_id = a.id),
  'articles_repealed', (SELECT count(*) FROM a JOIN lv ON lv.object_id = a.id WHERE lv.verified_status IN ('ملغاة', 'ملغى')),
  'legacy_repeals_unrecorded', (SELECT count(*) FROM article_amendments aa WHERE aa."changeType" = 'repealed' AND NOT EXISTS (SELECT 1 FROM unit_version u WHERE u.unit_id = aa."articleId") AND NOT EXISTS (SELECT 1 FROM verification v WHERE v.object_id = aa."articleId" AND v.verified_status IN ('ملغاة', 'ملغى'))),
  'search_norm_missing', (SELECT count(*) FROM a WHERE coalesce(search_norm, '') = ''),
  'search_norm_stale', (SELECT count(*) FROM a JOIN ev ON ev.unit_id = a.id WHERE a.search_norm IS DISTINCT FROM uqn_fix.hkm30_search_norm((SELECT "lawName" FROM legal_articles x WHERE x.id = a.id), (SELECT title FROM legal_articles x WHERE x.id = a.id), ev.body, (SELECT keywords FROM legal_articles x WHERE x.id = a.id), (SELECT classification FROM legal_articles x WHERE x.id = a.id), (SELECT chapter FROM legal_articles x WHERE x.id = a.id))),
  'embedded_articles', (SELECT count(*) FROM a JOIN emb ON emb.owner_id = a.id),
  'embedded_pct', round(100.0 * (SELECT count(*) FROM a JOIN emb ON emb.owner_id = a.id) / (SELECT count(*) FROM a), 1)
) AS health;
