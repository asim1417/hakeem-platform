/**
 * HKM-030 — تصدير بيانات فحص قاعدة الأنظمة (قراءة فقط) إلى ملفات JSON لبناء مصنف الفحص.
 * لا كتابة على القاعدة. لا طباعة لأي سر. يُشغَّل في مسار hkm030-audit-export.yml.
 *
 *   npx tsx scripts/hkm-030/export-audit.ts <out-dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const Q: Record<string, string> = {
  summary: `WITH a AS (SELECT id, "legalSystemId" sid, content, search_norm FROM legal_articles WHERE "articleBis" < 100),
lv AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'unit' ORDER BY object_id, verified_at DESC, id DESC),
lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
ev AS (SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC),
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cm AS (SELECT DISTINCT ON (x.id) x.id aid, x."legalSystemId" sid, u.law_id, u.seq, u.body ubody, coalesce(ev.body, x.content) obody, ev.unit_id IS NOT NULL amended,
   EXISTS (SELECT 1 FROM boe.amendment_note n WHERE n.law_id = u.law_id AND n.unit_seq = u.seq) has_note,
   uqn_fix.hkm30_norm(u.body) = uqn_fix.hkm30_norm(coalesce(ev.body, x.content)) same
  FROM mt JOIN legal_articles x ON x."legalSystemId" = mt.sid AND x."articleBis" < 100
  JOIN boe.unit u ON u.law_id = mt.law_id
  LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq
  JOIN LATERAL (SELECT coalesce(u.article_number, f.article_number) n, CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b) en ON en.n = x."articleNumber" AND en.b = (x."articleBis" > 0)
  LEFT JOIN ev ON ev.unit_id = x.id LEFT JOIN lw ON lw.object_id = mt.sid
  WHERE coalesce(lw.verified_status, '') NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')
  ORDER BY x.id, similarity(uqn_fix.hkm30_norm(u.body), uqn_fix.hkm30_norm(coalesce(ev.body, x.content))) DESC),
cmp AS (SELECT aid, law_id, seq, same, amended, has_note FROM cm),
nm AS (SELECT n.id nid, cm.aid FROM boe.amendment_note n JOIN cm ON cm.law_id = n.law_id AND cm.seq = n.unit_seq),
emb AS (SELECT DISTINCT owner_id FROM (SELECT owner_id FROM embeddings WHERE owner_type = 'article' UNION ALL SELECT owner_id FROM embedding_version WHERE owner_type = 'article') e)
SELECT json_build_object(
  'at', now(),
  'systems', (SELECT count(*) FROM legal_systems),
  'systems_empty', (SELECT count(*) FROM legal_systems s WHERE NOT EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId" = s.id)),
  'articles', (SELECT count(*) FROM a),
  'articles_bis', (SELECT count(*) FROM a JOIN legal_articles x ON x.id=a.id WHERE x."articleBis">0),
  'non_article_rows', (SELECT count(*) FROM legal_articles WHERE "articleBis">=100),
  'text_compared', (SELECT count(*) FROM cmp),
  'text_same', (SELECT count(*) FROM cmp WHERE same),
  'text_diff_amended_expected', (SELECT count(*) FROM cmp WHERE NOT same AND amended),
  'text_diff_note_unapplied', (SELECT count(*) FROM cmp WHERE NOT same AND NOT amended AND has_note),
  'text_diff_unexplained', (SELECT count(*) FROM cmp WHERE NOT same AND NOT amended AND NOT has_note),
  'amended_articles', (SELECT count(DISTINCT unit_id) FROM unit_version),
  'versions', (SELECT count(*) FROM unit_version),
  'boe_notes_matched', (SELECT count(*) FROM nm),
  'boe_notes_handled', (SELECT count(*) FROM nm WHERE EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = nm.aid) OR EXISTS (SELECT 1 FROM verification x WHERE x.object_id = nm.aid)),
  'boe_notes_total', (SELECT count(*) FROM boe.amendment_note),
  'systems_with_status', (SELECT count(*) FROM legal_systems s JOIN lw ON lw.object_id = s.id),
  'systems_with_effective', (SELECT count(*) FROM legal_systems WHERE preamble_effective_from IS NOT NULL),
  'systems_with_kind', (SELECT count(*) FROM legal_systems WHERE coalesce(instrument_kind,'')<>''),
  'systems_with_classification', (SELECT count(*) FROM legal_systems WHERE coalesce(classification,'')<>''),
  'systems_boe_matched', (SELECT count(*) FROM legal_systems s WHERE EXISTS (SELECT 1 FROM boe.current_match m WHERE m.hakeem_system_id=s.id)),
  'systems_uqn_page', (SELECT count(*) FROM legal_systems s WHERE EXISTS (SELECT 1 FROM uqn_stage.work w WHERE w.title=s.name)),
  'systems_no_source', (SELECT count(*) FROM legal_systems s WHERE NOT EXISTS (SELECT 1 FROM boe.current_match m WHERE m.hakeem_system_id=s.id) AND NOT EXISTS (SELECT 1 FROM uqn_stage.work w WHERE w.title=s.name)),
  'regs_linked_to_parent', (SELECT count(*) FROM legal_relations WHERE relation='IMPLEMENTS' AND source_type='system'),
  'articles_with_status', (SELECT count(*) FROM a JOIN lv ON lv.object_id = a.id),
  'articles_repealed', (SELECT count(*) FROM a JOIN lv ON lv.object_id = a.id WHERE lv.verified_status IN ('ملغاة', 'ملغى')),
  'legacy_repeals_unrecorded', (SELECT count(*) FROM article_amendments aa WHERE aa."changeType" = 'repealed' AND NOT EXISTS (SELECT 1 FROM unit_version u WHERE u.unit_id = aa."articleId") AND NOT EXISTS (SELECT 1 FROM verification v WHERE v.object_id = aa."articleId" AND v.verified_status IN ('ملغاة', 'ملغى'))),
  'search_norm_missing', (SELECT count(*) FROM a WHERE coalesce(search_norm, '') = ''),
  'embedded_articles', (SELECT count(*) FROM a JOIN emb ON emb.owner_id = a.id),
  'very_short_articles', (SELECT count(*) FROM a WHERE length(content)<40),
  'boe_laws', (SELECT count(*) FROM boe.law), 'boe_units', (SELECT count(*) FROM boe.unit), 'boe_attachments', (SELECT count(*) FROM boe.attachment), 'boe_attachment_pages', (SELECT count(*) FROM boe.attachment_page), 'boe_attachments_pending', (SELECT count(*) FROM boe.attachment_pending),
  'boe_active_unmatched', (SELECT count(*) FROM boe.law l WHERE NOT EXISTS (SELECT 1 FROM boe.current_match m WHERE m.guid=l.guid AND m.hakeem_system_id IS NOT NULL) AND l.status_at_source ~ 'سار'),
  'uqn_works', (SELECT count(*) FROM uqn_stage.work), 'uqn_effects', (SELECT count(*) FROM uqn_stage.effect), 'uqn_units', (SELECT count(*) FROM uqn_stage.unit), 'uqn_snapshots', (SELECT count(*) FROM uqn_fix.source_snapshot), 'uqn_max_published', (SELECT max(published_gregorian)::date FROM uqn_stage.work),
  'amendment_ops', (SELECT count(*) FROM uqn_fix.amendment_op),
  'rulings', (SELECT count(*) FROM judicial_cases), 'rulings_dated', (SELECT count(*) FROM judicial_cases WHERE "decisionDate" IS NOT NULL), 'ruling_segments', (SELECT count(*) FROM ruling_segments), 'ruling_segment_embeddings', (SELECT count(*) FROM ruling_segment_embeddings), 'principles', (SELECT count(*) FROM judicial_principles), 'case_article_links', (SELECT count(*) FROM legal_article_case_links), 'relations', (SELECT count(*) FROM legal_relations), 'thesaurus_concepts', (SELECT count(*) FROM legal_thesaurus_concepts)
) AS j`,

  systems: `WITH lws AS (SELECT DISTINCT ON (object_id) object_id, verified_status, method, verified_by, evidence_instrument, evidence_url FROM verification WHERE object_type='work' ORDER BY object_id, verified_at DESC, id DESC),
lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
ev AS (SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC),
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cm AS (SELECT DISTINCT ON (x.id) x.id aid, x."legalSystemId" sid, u.law_id, u.seq, u.body ubody, coalesce(ev.body, x.content) obody, ev.unit_id IS NOT NULL amended,
   EXISTS (SELECT 1 FROM boe.amendment_note n WHERE n.law_id = u.law_id AND n.unit_seq = u.seq) has_note,
   uqn_fix.hkm30_norm(u.body) = uqn_fix.hkm30_norm(coalesce(ev.body, x.content)) same
  FROM mt JOIN legal_articles x ON x."legalSystemId" = mt.sid AND x."articleBis" < 100
  JOIN boe.unit u ON u.law_id = mt.law_id
  LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq
  JOIN LATERAL (SELECT coalesce(u.article_number, f.article_number) n, CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b) en ON en.n = x."articleNumber" AND en.b = (x."articleBis" > 0)
  LEFT JOIN ev ON ev.unit_id = x.id LEFT JOIN lw ON lw.object_id = mt.sid
  WHERE coalesce(lw.verified_status, '') NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')
  ORDER BY x.id, similarity(uqn_fix.hkm30_norm(u.body), uqn_fix.hkm30_norm(coalesce(ev.body, x.content))) DESC),
cmp AS (SELECT sid, count(*) FILTER (WHERE NOT same AND NOT amended AND NOT has_note) unexplained, count(*) compared FROM cm GROUP BY 1),
notes AS (SELECT cm.sid, count(*) open FROM boe.amendment_note n JOIN cm ON cm.law_id = n.law_id AND cm.seq = n.unit_seq WHERE NOT (EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = cm.aid) OR EXISTS (SELECT 1 FROM verification x WHERE x.object_id = cm.aid)) GROUP BY 1)
SELECT json_agg(r ORDER BY r.name) AS j FROM (
  SELECT s.id, s.name, s.instrument_kind, s.classification, s.domain_title, s.eli_slug, s."articleCount" declared_articles,
    (SELECT count(*) FROM legal_articles a WHERE a."legalSystemId"=s.id AND a."articleBis"<100) actual_articles,
    (SELECT count(*) FROM legal_articles a JOIN unit_version v ON v.unit_id=a.id WHERE a."legalSystemId"=s.id) amended_articles,
    lws.verified_status status, lws.method status_method, lws.verified_by status_by, lws.evidence_instrument status_evidence, lws.evidence_url status_url,
    s.preamble_royal_decree instrument, s.preamble_effective_from::date effective_from, s.preamble IS NOT NULL AND s.preamble<>'' has_preamble,
    (SELECT l.url FROM mt JOIN boe.law l ON l.id=mt.law_id WHERE mt.sid=s.id) boe_url,
    (SELECT l.status_at_source FROM mt JOIN boe.law l ON l.id=mt.law_id WHERE mt.sid=s.id) boe_status,
    (SELECT w.source_url FROM uqn_stage.work w WHERE w.title=s.name ORDER BY w.published_gregorian DESC NULLS LAST LIMIT 1) uqn_url,
    (SELECT w.published_gregorian::date FROM uqn_stage.work w WHERE w.title=s.name ORDER BY w.published_gregorian DESC NULLS LAST LIMIT 1) uqn_published,
    (SELECT count(*) FROM legal_relations r WHERE r.relation='IMPLEMENTS' AND r.source_id=s.id) parent_links,
    (SELECT p.name FROM legal_relations r JOIN legal_systems p ON p.id=r.target_id WHERE r.relation='IMPLEMENTS' AND r.source_id=s.id LIMIT 1) parent_law,
    coalesce(cmp.compared,0) boe_compared, coalesce(cmp.unexplained,0) boe_unexplained, coalesce(notes.open,0) boe_notes_open,
    (SELECT count(*) FROM legal_articles a JOIN (SELECT DISTINCT owner_id FROM (SELECT owner_id FROM embeddings WHERE owner_type='article' UNION ALL SELECT owner_id FROM embedding_version WHERE owner_type='article') e) emb ON emb.owner_id=a.id WHERE a."legalSystemId"=s.id AND a."articleBis"<100) embedded_articles
  FROM legal_systems s LEFT JOIN lws ON lws.object_id=s.id LEFT JOIN cmp ON cmp.sid=s.id LEFT JOIN notes ON notes.sid=s.id) r`,

  text_diffs: `WITH lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
ev AS (SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC),
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cm AS (SELECT DISTINCT ON (x.id) x.id aid, x."legalSystemId" sid, u.law_id, u.seq, u.body ubody, coalesce(ev.body, x.content) obody, ev.unit_id IS NOT NULL amended,
   EXISTS (SELECT 1 FROM boe.amendment_note n WHERE n.law_id = u.law_id AND n.unit_seq = u.seq) has_note,
   uqn_fix.hkm30_norm(u.body) = uqn_fix.hkm30_norm(coalesce(ev.body, x.content)) same
  FROM mt JOIN legal_articles x ON x."legalSystemId" = mt.sid AND x."articleBis" < 100
  JOIN boe.unit u ON u.law_id = mt.law_id
  LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq
  JOIN LATERAL (SELECT coalesce(u.article_number, f.article_number) n, CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b) en ON en.n = x."articleNumber" AND en.b = (x."articleBis" > 0)
  LEFT JOIN ev ON ev.unit_id = x.id LEFT JOIN lw ON lw.object_id = mt.sid
  WHERE coalesce(lw.verified_status, '') NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')
  ORDER BY x.id, similarity(uqn_fix.hkm30_norm(u.body), uqn_fix.hkm30_norm(coalesce(ev.body, x.content))) DESC)
SELECT json_agg(r ORDER BY r.law, r.article) AS j FROM (
  SELECT x."lawName" law, x."articleNumber" article, x."articleBis" bis, l.status_at_source boe_status,
    round(similarity(uqn_fix.hkm30_norm(cm.ubody), uqn_fix.hkm30_norm(cm.obody))::numeric,3) similarity,
    CASE WHEN position(uqn_fix.hkm30_norm(cm.ubody) in uqn_fix.hkm30_norm(cm.obody))=1 THEN 'ours_has_tail' WHEN position(uqn_fix.hkm30_norm(cm.ubody) in uqn_fix.hkm30_norm(cm.obody))>0 THEN 'ours_contains_boe' WHEN position(uqn_fix.hkm30_norm(cm.obody) in uqn_fix.hkm30_norm(cm.ubody))>0 THEN 'boe_contains_ours' ELSE 'wording' END kind,
    length(cm.obody) our_len, length(cm.ubody) boe_len,
    left(regexp_replace(cm.obody,'\\s+',' ','g'),160) our_text, left(regexp_replace(cm.ubody,'\\s+',' ','g'),160) boe_text, l.url boe_url, x.id article_id
  FROM cm JOIN legal_articles x ON x.id = cm.aid JOIN boe.law l ON l.id = cm.law_id
  WHERE NOT cm.same AND NOT cm.amended AND NOT cm.has_note) r`,

  open_notes: `WITH lw AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type = 'work' ORDER BY object_id, verified_at DESC, id DESC),
ev AS (SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC),
mt AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id FROM boe.current_match m JOIN boe.law l ON l.guid = m.guid WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source = 'ساري') DESC, l.issued_gregorian DESC NULLS LAST),
cm AS (SELECT DISTINCT ON (x.id) x.id aid, x."legalSystemId" sid, u.law_id, u.seq, u.body ubody, coalesce(ev.body, x.content) obody, ev.unit_id IS NOT NULL amended,
   EXISTS (SELECT 1 FROM boe.amendment_note n WHERE n.law_id = u.law_id AND n.unit_seq = u.seq) has_note,
   uqn_fix.hkm30_norm(u.body) = uqn_fix.hkm30_norm(coalesce(ev.body, x.content)) same
  FROM mt JOIN legal_articles x ON x."legalSystemId" = mt.sid AND x."articleBis" < 100
  JOIN boe.unit u ON u.law_id = mt.law_id
  LEFT JOIN boe.unit_number_fix f ON f.law_id = u.law_id AND f.seq = u.seq
  JOIN LATERAL (SELECT coalesce(u.article_number, f.article_number) n, CASE WHEN u.article_number IS NULL THEN coalesce(f.is_bis, false) ELSE u.is_bis END b) en ON en.n = x."articleNumber" AND en.b = (x."articleBis" > 0)
  LEFT JOIN ev ON ev.unit_id = x.id LEFT JOIN lw ON lw.object_id = mt.sid
  WHERE coalesce(lw.verified_status, '') NOT IN ('مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض')
  ORDER BY x.id, similarity(uqn_fix.hkm30_norm(u.body), uqn_fix.hkm30_norm(coalesce(ev.body, x.content))) DESC)
SELECT json_agg(r ORDER BY r.law, r.article) AS j FROM (
  SELECT x."lawName" law, x."articleNumber" article, x."articleBis" bis, n.effect effect_type, concat_ws(' ', n.instrument_kind, n.instrument_no, n.instrument_date_hijri) instrument, coalesce(n.new_text,'')<>'' has_new_text, n.needs_review,
    left(regexp_replace(n.note_text,'\\s+',' ','g'),300) note, l.url boe_url, x.id article_id
  FROM boe.amendment_note n JOIN cm ON cm.law_id = n.law_id AND cm.seq = n.unit_seq JOIN legal_articles x ON x.id = cm.aid JOIN boe.law l ON l.id = n.law_id
  WHERE NOT (EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = cm.aid) OR EXISTS (SELECT 1 FROM verification v2 WHERE v2.object_id = cm.aid))) r`,

  legacy_repeals: `SELECT json_agg(r ORDER BY r.law, r.article) AS j FROM (
  SELECT a."lawName" law, a."articleNumber" article, aa."decreeRef" instrument, aa."hijriDate" hijri_date, aa.source, a.id article_id
  FROM article_amendments aa JOIN legal_articles a ON a.id=aa."articleId"
  WHERE aa."changeType"='repealed' AND NOT EXISTS (SELECT 1 FROM unit_version u WHERE u.unit_id=aa."articleId") AND NOT EXISTS (SELECT 1 FROM verification v WHERE v.object_id=aa."articleId" AND v.verified_status IN ('ملغاة','ملغى'))) r`,

  boe_unmatched: `SELECT json_agg(r ORDER BY r.article_count DESC NULLS LAST) AS j FROM (
  SELECT l.name, l.status_at_source status, l.article_count, l.issued_hijri, l.published_hijri, l.url, l.guid,
    (SELECT s.name FROM legal_systems s ORDER BY similarity(uqn_fix.hkm30_norm(s.name), uqn_fix.hkm30_norm(l.name)) DESC LIMIT 1) nearest_hakeem,
    (SELECT round(max(similarity(uqn_fix.hkm30_norm(s.name), uqn_fix.hkm30_norm(l.name)))::numeric,2) FROM legal_systems s) nearest_sim
  FROM boe.law l WHERE NOT EXISTS (SELECT 1 FROM boe.current_match m WHERE m.guid=l.guid AND m.hakeem_system_id IS NOT NULL)) r`,

  count_mismatch: `SELECT json_agg(r) AS j FROM (
  SELECT s.name, s."articleCount" ours, l.name boe_name, l.article_count boe, l.status_at_source boe_status, l.url
  FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid JOIN legal_systems s ON s.id=m.hakeem_system_id WHERE l.article_count IS DISTINCT FROM s."articleCount") r`,

  rulings: `SELECT json_build_object(
  'total', (SELECT count(*) FROM judicial_cases),
  'by_court', (SELECT json_agg(t) FROM (SELECT coalesce(court_type,'∅') court_type, count(*) n FROM ruling_meta GROUP BY 1 ORDER BY 2 DESC) t),
  'by_year', (SELECT json_agg(t) FROM (SELECT year_h, count(*) n FROM ruling_meta GROUP BY 1 ORDER BY 1) t),
  'by_degree', (SELECT json_agg(t) FROM (SELECT coalesce(degree,'∅') degree, count(*) n FROM ruling_meta GROUP BY 1) t),
  'review', (SELECT json_agg(t) FROM (SELECT coalesce("reviewStatus",'∅') status, count(*) n FROM judicial_cases GROUP BY 1) t),
  'segments', (SELECT json_agg(t) FROM (SELECT part, count(*) n FROM ruling_segments GROUP BY 1 ORDER BY 2 DESC) t),
  'principles', (SELECT json_agg(t) FROM (SELECT coalesce("reviewStatus",'∅') status, count(*) n FROM judicial_principles GROUP BY 1) t),
  'links', (SELECT json_agg(t) FROM (SELECT coalesce("reviewStatus",'∅') status, count(*) n FROM legal_article_case_links GROUP BY 1) t),
  'dated', (SELECT count(*) FROM judicial_cases WHERE "decisionDate" IS NOT NULL),
  'with_appeal', (SELECT count(*) FROM judicial_cases WHERE coalesce("appealText",'')<>'')
) AS j`,

  verifications_today: `SELECT json_agg(t) AS j FROM (SELECT verified_by, object_type, verified_status, method, count(*) n, min(verified_at)::date since FROM verification GROUP BY 1,2,3,4 ORDER BY 6 DESC, 5 DESC) t`,
};

async function main() {
  const out = process.argv[2] || "audit-out";
  mkdirSync(out, { recursive: true });
  for (const [name, sql] of Object.entries(Q)) {
    const rows = (await prisma.$queryRawUnsafe(sql)) as Array<{ j: unknown }>;
    const data = rows[0]?.j ?? null;
    writeFileSync(join(out, `${name}.json`), JSON.stringify(data, null, 0));
    const n = Array.isArray(data) ? data.length : 1;
    console.log(`${name}: ${n}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[رابط]") : "فشل");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
