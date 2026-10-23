#!/usr/bin/env python3
"""HKM-030 دفعة 23/10 (د) — الوحدات بلا رقم في لقطة هيئة الخبراء (المرحلة 7) — بإذن المالك («نعم»).

المشكلة: زاحف الهيئة يضع عنوان الباب في خانة عنوان الوحدة ويُسقط رقم المادة، فتخرج أول مادة في كل باب من المقارنة بالرقم.
الحل (إضافة فقط؛ مخطط boe لا يقبل التعديل): جدول boe.unit_number_fix يحمل لكل وحدة بلا رقم:
  - body_match: رقم مادتنا التي متنها = متن الوحدة (تشابه ≥ 0.95، أو ≥ 0.9 مع اتساق الموضع مع الوحدة المرقمة السابقة)، وثاني أفضل مطابقة أدنى بـ 0.1 على الأقل، والرقم غير مشغول بوحدة مرقمة في الصفحة نفسها؛
  - not_article: جداول ومرفقات (عنوانها جدول/مرفق/ملحق/إشارات/نموذج أو متنها أقصر من 20 حرفًا) فلا تُعدّ نقصًا.
المقياس والمقارنة يقرآن الرقم الفعلي coalesce(unit.article_number, fix.article_number).
"""
import json
from pathlib import Path

OUT = Path(__file__).parent
BY = "hkm030-unit-numbers-2026-10-23"
N_FIX, FP_FIX = 100, "fd86c3a0e5781f20a96d2184d28e6e0b"
N_NA, FP_NA = 19, "9f55e0e25299e1ed79cae89de4442534"
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"

CAND = """
WITH st AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type='work' ORDER BY object_id, verified_at DESC, id DESC),
m AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid LEFT JOIN st ON st.object_id=m.hakeem_system_id WHERE m.hakeem_system_id IS NOT NULL AND l.status_at_source='ساري' AND coalesce(st.verified_status,'') NOT IN ('مستبدل','ملغى','ملغاة','سجل مخلوط — لا يُعرض') ORDER BY m.hakeem_system_id, l.issued_gregorian DESC NULLS LAST),
nu AS (SELECT u.law_id, u.seq, u.heading, u.body, m.sid,
  (SELECT max(u2.article_number) FROM boe.unit u2 WHERE u2.law_id=u.law_id AND u2.seq<u.seq AND u2.article_number IS NOT NULL AND NOT u2.is_bis) prev_n,
  (SELECT min(u2.article_number) FROM boe.unit u2 WHERE u2.law_id=u.law_id AND u2.seq>u.seq AND u2.article_number IS NOT NULL AND NOT u2.is_bis) next_n
  FROM boe.unit u JOIN m ON m.law_id=u.law_id WHERE u.article_number IS NULL),
mt AS (SELECT nu.*, t.id aid, t."articleNumber" an, t."articleBis" ab, t.sim, t.sim2 FROM nu LEFT JOIN LATERAL (
   SELECT a.id, a."articleNumber", a."articleBis", similarity(uqn_fix.hkm30_norm(a.content), uqn_fix.hkm30_norm(nu.body)) sim,
     (SELECT max(similarity(uqn_fix.hkm30_norm(b.content), uqn_fix.hkm30_norm(nu.body))) FROM legal_articles b WHERE b."legalSystemId"=nu.sid AND b."articleBis"<100 AND b.id<>a.id) sim2
   FROM legal_articles a WHERE a."legalSystemId"=nu.sid AND a."articleBis"<100 AND length(nu.body)>=20 ORDER BY sim DESC LIMIT 1) t ON true),
ok AS (SELECT law_id, seq, an article_number, (ab>0) is_bis, aid, round(sim::numeric,3) sim, round(sim2::numeric,3) sim2, prev_n, next_n, (an=coalesce(prev_n,0)+1) pos_ok
  FROM mt WHERE sim>=0.9 AND (sim>=0.95 OR an=coalesce(prev_n,0)+1) AND coalesce(sim2,0) < sim - 0.1
   AND NOT EXISTS (SELECT 1 FROM boe.unit u2 WHERE u2.law_id=mt.law_id AND u2.article_number=mt.an AND u2.is_bis=(mt.ab>0))),
na AS (SELECT law_id, seq, heading, length(body) len FROM mt WHERE (sim IS NULL OR sim<0.9) AND (heading ~ 'جدول|مرفق|ملحق|الإشارات|المرفقات|نموذج' OR length(body)<20))
"""

stmts = [
    {"name": "guard_before", "sql": f"""SELECT CASE WHEN (SELECT count(*) FROM information_schema.tables WHERE table_schema='boe' AND table_name='unit_number_fix')=0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard"""},
    {"name": "create_table", "sql": """
CREATE TABLE boe.unit_number_fix (
  law_id text NOT NULL, seq integer NOT NULL, article_number integer, is_bis boolean NOT NULL DEFAULT false,
  method text NOT NULL CHECK (method IN ('body_match','not_article')), evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (law_id, seq), FOREIGN KEY (law_id, seq) REFERENCES boe.unit(law_id, seq),
  CHECK ((method='body_match' AND article_number IS NOT NULL) OR (method='not_article' AND article_number IS NULL)))""".strip()},
    {"name": "append_only_trigger", "sql": "CREATE TRIGGER no_change BEFORE DELETE OR UPDATE ON boe.unit_number_fix FOR EACH ROW EXECUTE FUNCTION boe.forbid_change()"},
    {"name": "comment", "sql": "COMMENT ON TABLE boe.unit_number_fix IS 'HKM-030: رقم المادة الفعلي للوحدات التي أسقط الزاحف رقمها (مطابقة المتن بمادة حكيم) أو علامة «ليست مادة» للجداول والمرفقات. إضافة فقط.'"},
    {"name": "insert_body_match", "sql": CAND.strip() + f"""
INSERT INTO boe.unit_number_fix (law_id, seq, article_number, is_bis, method, evidence, decided_by)
SELECT law_id, seq, article_number, is_bis, 'body_match', jsonb_build_object('hakeem_article_id', aid, 'similarity', sim, 'second_best', sim2, 'prev_numbered', prev_n, 'next_numbered', next_n, 'position_consistent', pos_ok), '{BY}' FROM ok"""},
    {"name": "insert_not_article", "sql": CAND.strip() + f"""
INSERT INTO boe.unit_number_fix (law_id, seq, article_number, is_bis, method, evidence, decided_by)
SELECT law_id, seq, NULL, false, 'not_article', jsonb_build_object('heading', heading, 'body_length', len), '{BY}' FROM na"""},
    {"name": "guard_after", "sql": f"""
SELECT CASE WHEN (SELECT count(*) FROM boe.unit_number_fix WHERE method='body_match')={N_FIX}
  AND (SELECT md5(string_agg(law_id||'#'||seq||'='||article_number||CASE WHEN is_bis THEN 'b' ELSE '' END, '|' ORDER BY law_id, seq)) FROM boe.unit_number_fix WHERE method='body_match')='{FP_FIX}'
  AND (SELECT count(*) FROM boe.unit_number_fix WHERE method='not_article')={N_NA}
  AND (SELECT md5(string_agg(law_id||'#'||seq, '|' ORDER BY law_id, seq)) FROM boe.unit_number_fix WHERE method='not_article')='{FP_NA}'
  AND (SELECT count(*) FROM boe.unit_number_fix f JOIN boe.unit u ON u.law_id=f.law_id AND u.seq=f.seq WHERE u.article_number IS NOT NULL)=0
  AND (SELECT count(*) FROM (SELECT f.law_id, f.article_number, f.is_bis FROM boe.unit_number_fix f WHERE f.method='body_match' GROUP BY 1,2,3 HAVING count(*)>1) d)=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""".strip()},
    {"name": "report", "sql": """SELECT method, count(*) n, count(DISTINCT law_id) laws, json_agg(json_build_object('law', (SELECT name FROM boe.law WHERE id=f.law_id), 'seq', f.seq, 'n', f.article_number, 'ev', f.evidence) ORDER BY f.law_id, f.seq) rows FROM boe.unit_number_fix f GROUP BY method"""},
]
json.dump({"batch": BY, "groups": {"g6_unit_numbers": stmts}}, open(OUT / "statements_unit_numbers.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(stmts), "statements")
