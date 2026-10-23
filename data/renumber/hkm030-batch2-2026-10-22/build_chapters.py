#!/usr/bin/env python3
"""HKM-030 دفعة 23/10 (ج) — عناوين الأبواب والفصول إلى عمود legal_articles.chapter (بإذن المالك: «نعم بس ابني الآلية والطريقة بشكل صحيح بحيث لا تضيف شي غير صحيح»).

الآلية (لا يُكتب عنوان إلا بأحد ثلاثة أدلة، وبأولوية ثابتة عند التعارض):
  1. وحدة عنوان في صفحة هيئة الخبراء (وحدة بلا رقم مادة وعنوانها ليس «المادة …») ومتنها = نص مادتنا (تطابق بعد التطبيع أو تشابه ≥ 0.9) ← العنوان لتلك المادة.
  2. عنوان سابق لـ«المادة …:» في وحدة مرقمة في صفحة الهيئة ← العنوان لمادتنا بالرقم نفسه.
  3. ذيل حُذف في دفعة 22/10 (ب) من آخر المادة N يبدأ بـ(الباب|الفصل|القسم|الجزء) ← عنوان المادة التالية N+1، فقط إذا كانت صفحة الهيئة بلا عناوين أصلًا (وإلا وجب أن يثبته الدليل 1 أو 2).
قيود: لا كتابة على مادة لها عنوان؛ عنوان واحد لكل مادة؛ تُستبعد التذييلات ونصوص المواد وعناوين الجداول والمرفقات؛ صف legal_text_provenance لكل كتابة.
"""
import hashlib, json
from pathlib import Path

OUT = Path(__file__).parent
SRC_ID = "hkm030-chapter-2026-10-23"
EXPECTED_N, EXPECTED_FP = 135, "0f087568ae2b8a672f70459f8658d503"
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"

STAGE = r"""
CREATE TEMP TABLE hkm30_chapter ON COMMIT DROP AS
WITH st AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type='work' ORDER BY object_id, verified_at DESC, id DESC),
m AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id, l.url FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid LEFT JOIN st ON st.object_id=m.hakeem_system_id WHERE m.hakeem_system_id IS NOT NULL AND l.status_at_source='ساري' AND coalesce(st.verified_status,'') NOT IN ('مستبدل','ملغى','ملغاة','سجل مخلوط — لا يُعرض') ORDER BY m.hakeem_system_id, l.issued_gregorian DESC NULLS LAST),
pv AS (SELECT p.entity_id aid, a."legalSystemId" sid, a."articleNumber" an, regexp_replace(btrim(substr(p.previous_text, length(a.content)+1), E' \n\t\r.،؛:ًٌٍ'), '\s+', ' ', 'g') suffix FROM legal_text_provenance p JOIN legal_articles a ON a.id=p.entity_id WHERE p.source_id='hkm030-tail-strip-2026-10-22'),
ta AS (SELECT pv.*, t.id tid, t."articleNumber" tn, t.content tcontent, coalesce(t.chapter,'') tchap FROM pv JOIN LATERAL (SELECT * FROM legal_articles a2 WHERE a2."legalSystemId"=pv.sid AND a2."articleBis"<100 AND a2."articleNumber">pv.an ORDER BY a2."articleNumber", a2."articleBis" LIMIT 1) t ON true WHERE pv.suffix !~ 'حقوق محفوظة|عرض كل المواد' AND pv.suffix !~ '^المادة\s'),
a_rows AS (SELECT 3 pri, 'tail' src, 'internal:hakeem/legal_articles/'||ta.aid||'#tail' srcurl, ta.tid, ta.sid, ta.suffix heading,
  CASE WHEN EXISTS (SELECT 1 FROM m JOIN boe.unit h ON h.law_id=m.law_id WHERE m.sid=ta.sid AND h.article_number IS NULL AND uqn_fix.hkm30_norm(h.heading)=uqn_fix.hkm30_norm(ta.suffix) AND (uqn_fix.hkm30_norm(h.body)=uqn_fix.hkm30_norm(ta.tcontent) OR similarity(uqn_fix.hkm30_norm(h.body), uqn_fix.hkm30_norm(ta.tcontent))>=0.9)) THEN 'boe_unit_body'
       WHEN EXISTS (SELECT 1 FROM m JOIN boe.unit h ON h.law_id=m.law_id AND h.article_number=ta.tn WHERE m.sid=ta.sid AND position(uqn_fix.hkm30_norm(ta.suffix) in uqn_fix.hkm30_norm(h.heading))=1) THEN 'boe_prefix'
       WHEN ta.suffix ~ '^\(?(الباب|الفصل|القسم|الجزء)\s' AND NOT EXISTS (SELECT 1 FROM m JOIN boe.unit h ON h.law_id=m.law_id WHERE m.sid=ta.sid AND ((h.article_number IS NULL AND coalesce(h.heading,'')<>'' AND h.heading !~ '^المادة') OR h.heading ~ '\S\s+المادة\s')) THEN 'keyword_no_boe_headings'
       ELSE 'unverified' END k, ta.tchap FROM ta),
hu AS (SELECT m.sid, m.url, h.law_id, h.seq, btrim(h.heading) heading, h.body FROM m JOIN boe.unit h ON h.law_id=m.law_id WHERE h.article_number IS NULL AND coalesce(h.heading,'')<>'' AND h.heading !~ '^المادة'),
b_rows AS (SELECT 1 pri, 'unit' src, hu.url||'#unit-'||hu.seq srcurl, t.id tid, hu.sid, hu.heading, CASE WHEN t.id IS NULL THEN 'no_body_match' ELSE 'boe_unit_body' END k, coalesce(t.chapter,'') tchap
  FROM hu LEFT JOIN LATERAL (SELECT a.* FROM legal_articles a WHERE a."legalSystemId"=hu.sid AND a."articleBis"<100 AND (uqn_fix.hkm30_norm(a.content)=uqn_fix.hkm30_norm(hu.body) OR similarity(uqn_fix.hkm30_norm(a.content), uqn_fix.hkm30_norm(hu.body))>=0.9) ORDER BY similarity(uqn_fix.hkm30_norm(a.content), uqn_fix.hkm30_norm(hu.body)) DESC LIMIT 1) t ON true),
ph AS (SELECT 2 pri, 'prefix' src, m.url||'#unit-'||u.seq srcurl, a.id tid, m.sid, btrim(regexp_replace(u.heading, '\s*المادة\s.*$', '')) heading, 'boe_prefix' k, coalesce(a.chapter,'') tchap FROM m JOIN boe.unit u ON u.law_id=m.law_id LEFT JOIN legal_articles a ON a."legalSystemId"=m.sid AND a."articleNumber"=u.article_number AND a."articleBis"=0 WHERE u.article_number IS NOT NULL AND u.heading ~ '\S\s+المادة\s'),
allr AS (SELECT * FROM a_rows UNION ALL SELECT * FROM b_rows UNION ALL SELECT * FROM ph)
SELECT DISTINCT ON (tid) tid, sid, src, k, srcurl, heading FROM allr WHERE tid IS NOT NULL AND k IN ('boe_unit_body','boe_prefix','keyword_no_boe_headings') AND tchap='' AND length(heading) BETWEEN 3 AND 160 ORDER BY tid, pri
"""

stmts = [
    {"name": "stage", "sql": STAGE.strip()},
    {"name": "guard_before", "sql": f"""
SELECT CASE WHEN (SELECT count(*) FROM hkm30_chapter)={EXPECTED_N}
  AND (SELECT md5(string_agg(tid||'|'||heading, '|' ORDER BY tid)) FROM hkm30_chapter)='{EXPECTED_FP}'
  AND (SELECT count(*) FROM hkm30_chapter h JOIN legal_articles a ON a.id=h.tid WHERE coalesce(a.chapter,'')<>'')=0
  AND (SELECT count(*) FROM hkm30_chapter h WHERE EXISTS (SELECT 1 FROM legal_text_provenance p WHERE p.entity_id=h.tid AND p.source_id='{SRC_ID}'))=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""".strip()},
    {"name": "provenance", "sql": f"""
INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)
SELECT 'hkm30p-'||left(encode(sha256(convert_to('{SRC_ID}|'||h.tid,'UTF8')),'hex'),24), 'article', h.tid, a."lawName", a."articleNumber", CASE WHEN h.src='tail' THEN 'hakeem' ELSE 'boe' END, '{SRC_ID}', h.srcurl, encode(sha256(convert_to(h.heading,'UTF8')),'hex'), '2026-10-23'::date, 'chapter_set:'||h.k, coalesce(a.chapter,''), now()
FROM hkm30_chapter h JOIN legal_articles a ON a.id=h.tid""".strip()},
    {"name": "set_chapter", "sql": """UPDATE legal_articles a SET chapter = h.heading, "updatedAt" = now() FROM hkm30_chapter h WHERE a.id = h.tid AND coalesce(a.chapter,'')=''"""},
    {"name": "search_norm", "sql": """UPDATE legal_articles a SET search_norm = uqn_fix.hkm30_search_norm(a."lawName", a.title, a.content, a.keywords, a.classification, a.chapter) FROM hkm30_chapter h WHERE a.id = h.tid AND NOT EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = a.id AND v.valid_from <= now())"""},
    {"name": "guard_after", "sql": f"""
SELECT CASE WHEN (SELECT count(*) FROM legal_articles a JOIN hkm30_chapter h ON h.tid=a.id WHERE a.chapter=h.heading)={EXPECTED_N}
  AND (SELECT count(*) FROM legal_text_provenance WHERE source_id='{SRC_ID}')={EXPECTED_N}
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""".strip()},
    {"name": "report", "sql": """SELECT md5(string_agg(tid||'|'||heading, '|' ORDER BY tid)) fp, count(*) n, json_agg(json_build_object('sys', (SELECT name FROM legal_systems WHERE id=h.sid), 'an', (SELECT "articleNumber" FROM legal_articles WHERE id=h.tid), 'src', h.src, 'k', h.k, 'heading', h.heading) ORDER BY h.sid, (SELECT "articleNumber" FROM legal_articles WHERE id=h.tid)) rows FROM hkm30_chapter h"""},
]
json.dump({"batch": SRC_ID, "groups": {"g5_chapter": stmts}}, open(OUT / "statements_chapters.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(stmts), "statements")
