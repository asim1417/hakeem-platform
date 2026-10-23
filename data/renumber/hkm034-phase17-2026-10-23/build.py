#!/usr/bin/env python3
"""HKM-034 (23/10/2026) — المرحلتان 1 و7 من HKM-030 بأمر المالك «نفذها كلها»، من بيانات لقطة الهيئة الموجودة (boe.*) بلا زحف ولا نص من الذاكرة.

  g1_supersede   12 نظامًا قديمًا مطابقًا لصفحة «لاغي» وإصداره الجديد مدخل عندنا: تحقق «مستبدل» (يلحق «ملغى») بنص مادة الإحلال أو بند الأداة عند الهيئة، وسطحا بحث (قديم/جديد).
  g2_unit_numbers توسيع قيد boe.unit_number_fix بطريقة neighbor_gap (الرقم السابق +1 = الرقم التالي −1، بلا وحدات بلا رقم بينهما)؛ 4 وحدات، ووحدة مرفق (المرور 101) «ليست مادة».
  g3_dup_base    5 مواد أساس (الخدمة المدنية 15 و25 و36 و37، خدمة الأفراد 14) متنها نسخة من «مكرر» التالية لها حرفيًّا؛ يُستبدل بمتن الأساس عند الهيئة مع provenance.
  g4_missing     مواد ساقطة من أنظمة سارية مطابقة (بعد g2): تُدرج من وحدة الهيئة إن لم يوجد صف بالرقم نفسه بأي درجة ومتنها غير مغلّف.
  g5_regs        اللائحة المالية (74) واللائحة الإدارية (47) لهيئات تطوير المناطق والمدن مدخلتان منذ HKM-028 (hkm28-*)؛ يُضاف ربطهما بالتنظيم (IMPLEMENTS).
"""
import hashlib, json
from pathlib import Path

OUT = Path(__file__).parent
BY = "owner-inject-hkm034-2026-10-23"
SRC = "hkm034-2026-10-23"
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
LS, AB, AN = '"legalSystemId"', '"articleBis"', '"articleNumber"'
WS = "'\\s+'"  # نمط الفراغات في SQL


def h(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def lit(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    assert "$hk$" not in v
    return f"$hk${v}$hk$"


groups: dict[str, list[dict]] = {}


def add(group: str, name: str, sql: str) -> None:
    groups.setdefault(group, []).append({"name": name, "sql": sql.strip()})


# ───────────── g1: الإحلال ─────────────
# (old_sid, old_name, new_sid, new_law_id, quote)؛ quote: ("art", n, must) أو ("block", kind, regex)
PAIRS = [
    ("cmpz5ragp00bjcwg2ugwrmnrc", "تنظيم إعانة البحث عن عمل 1432هـ", "cmpz5rgqf00c4cwg22mpjae0e", "boe26-d3e49e1ab3739513688f95c4", ("art", 12, "يحل التنظيم محل تنظيم إعانة البحث عن عمل")),
    ("cmpz5p16y000jcwg2anizr5s9", "تنظيم وكالة الأنباء السعودية1433هـ", "cmpz5p2xv000scwg2nhz32vnx", "boe26-35826f6ddc33daffb3de07ac", ("art", 16, "يحل محل تنظيم وكالة الأنباء السعودية")),
    ("cmpz5q46u0061cwg26dmscyu6", "نظام إدارة النفايات البلدية الصلبة", "cmpz5q6pi006ecwg2ucqkh1a3", "boe26-8813a70b163f1c04314867e1", ("art", 37, "يحل هذا النظام محل نظام إدارة النفايات البلدية الصلبة")),
    ("cmpz5rs6j00d2cwg2y2xak3bx", "نظام البريد 1406هـ", "cmpz5rzn500dlcwg2izh9vm6v", "boe26-0a50eab43c5835efd66280d4", ("art", 37, "يحل النظام محل نظام البريد")),
    ("cmpz5q37y005wcwg29m2vyweq", "نظام التسجيل العيني للعقار 1423هـ", "cmpz5q73g006gcwg211uev9pu", "boe26-ebc181f10631754ae894a10b", ("art", 39, "يحل النظام محل نظام التسجيل العيني للعقار")),
    ("cmpz5rlje00chcwg2afi55268", "نظام المنافسات والمشتريات الحكومية", "cmpz5pp91003xcwg2wx5rgsnx", "boe26-a1bb07e3cd0f65b44cf7dd28", ("art", 98, "يحل هذا النظام محل نظام المنافسات والمشتريات الحكومية")),
    ("cmpz5q292005rcwg2psbdluqz", "نظام صندوق التنمية العقارية1394هـ", "cmpz5q6bk006ccwg2i8hrah97", "boe26-107978050345392a865abe29", ("art", 18, "يحل هذا النظام محل نظام صندوق التنمية العقارية")),
    ("cmpz5q30z005vcwg2x4d1f0xs", "نظام ملكية الوحدات العقارية وفرزها", "cmpz5q7vd006kcwg2uaelgo7l", "boe26-38f13efaa2bd365a44a868ba", ("art", 32, "يحل النظام محل نظام ملكية الوحدات العقارية وفرزها")),
    ("cmpz5pw89004xcwg2mdbv957p", "نظام مدينة الملك عبد العزيز للعلوم والتقنية", "cmpz5pzbz005ccwg2bo3zoxrz", "boe26-bfedd0ca47bafdfebfbe13a5", ("block", "cabinet_decision", r"ثاني[^:]{0,3}: أن يحل التنظيم[^.]+\.")),
    ("cmpz5qehg007hcwg2jr47h1fg", "نظام الزراعة العضوية", "cmpz5qhe2007wcwg2e9oyrkyh", "boe26-5200f4827ca96ac62fa11fd0", ("block", "royal_decree", r"ثاني[^:]{0,3}: يلغي نظام الزراعة[^:]*:|نظام الزراعة العضوية، الصادر[^.]*\.")),
    ("cmpz5qcj80077cwg2b3yc32or", "نظام صيد واستثمار وحماية الثروات المائية الحية في المياه الاقليمية للمملكة العربية السعودية", "cmpz5qhe2007wcwg2e9oyrkyh", "boe26-5200f4827ca96ac62fa11fd0", ("block", "royal_decree", r"ثاني[^:]{0,3}: يلغي نظام الزراعة[^:]*:|نظام صيد واستثمار وحماية الثروات المائية الحية[^.]*\.")),
    ("cmpz5qcc80076cwg2b12ttz0m", "نظام الثروة الحيوانية", "cmpz5qhe2007wcwg2e9oyrkyh", "boe26-5200f4827ca96ac62fa11fd0", ("block", "royal_decree", r"ثاني[^:]{0,3}: يلغي نظام الزراعة[^:]*:|نظام الثروة الحيوانية، الصادر[^.]*\.")),
]
INSTR = "(l.instruments->0->>'text')"


def quote_expr(lid: str, q) -> str:
    if q[0] == "art":
        return f"""(SELECT 'المادة ('||{q[1]}||') من '||l.name||': «'||btrim(u.body)||'»' FROM boe.unit u WHERE u.law_id={lit(lid)} AND coalesce(u.article_number,u.seq)={q[1]} AND NOT u.is_bis AND position({lit(q[2])} in u.body)>0)"""
    # block: regex may hold alternatives joined by | ؛ تُجمع كل المقاطع المطابقة بالترتيب
    return f"""(SELECT {INSTR}||'، '||b.kind||': «'||(SELECT string_agg(btrim(m[1]), ' … ' ORDER BY ord) FROM regexp_matches(regexp_replace(b.body,'\\s+',' ','g'), '('||{lit(q[2])}||')', 'g') WITH ORDINALITY AS t(m, ord))||'»' FROM boe.text_block b WHERE b.law_id=l.id AND b.kind={lit(q[1])} AND regexp_replace(b.body,'\\s+',' ','g') ~ {lit(q[2])} LIMIT 1)"""


add("g1_supersede", "guard_before", f"""
SELECT CASE WHEN
  {" AND ".join(f"(SELECT count(*) FROM legal_systems o WHERE o.id={lit(o)} AND o.name={lit(on)} AND o.preamble_effective_from IS NOT NULL)=1 AND (SELECT verified_status FROM verification v WHERE v.object_type='work' AND v.object_id={lit(o)} ORDER BY v.verified_at DESC LIMIT 1)='ملغى' AND (SELECT count(*) FROM boe.current_match cm JOIN boe.law l ON l.guid=cm.guid WHERE cm.hakeem_system_id={lit(o)} AND l.status_at_source='لاغي')=1 AND (SELECT count(*) FROM boe.current_match cm JOIN boe.law l ON l.guid=cm.guid WHERE cm.hakeem_system_id={lit(n)} AND l.id={lit(lid)} AND l.status_at_source='ساري')=1 AND (SELECT verified_status FROM verification v WHERE v.object_type='work' AND v.object_id={lit(n)} ORDER BY v.verified_at DESC LIMIT 1)='ساري' AND (SELECT count(*) FROM legal_systems n WHERE n.id={lit(n)} AND n.preamble_effective_from IS NOT NULL AND n.preamble_royal_decree IS NOT NULL)=1 AND (SELECT {quote_expr(lid, q)} FROM boe.law l WHERE l.id={lit(lid)}) IS NOT NULL AND (SELECT count(*) FROM search_surface WHERE surface_system_id IN ({lit(o)},{lit(n)}))=0 AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND object_id={lit(o)})=0" for o, on, n, lid, q in PAIRS)}
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
for o, on, n, lid, q in PAIRS:
    vid = "vf34-" + h(SRC, "work", o, "مستبدل")[:24]
    add("g1_supersede", f"verification:{on}", f"""
INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT {lit(vid)}, 'work', {lit(o)}, 'مستبدل', {INSTR}, l.url, {quote_expr(lid, q)}, 'rule', {lit(BY)}, (SELECT v.id FROM verification v WHERE v.object_type='work' AND v.object_id={lit(o)} ORDER BY v.verified_at DESC LIMIT 1)
FROM boe.law l WHERE l.id={lit(lid)}""")
    wk = f"we:{o}"
    old_s, new_s = "ss34-" + h(SRC, wk, "old")[:24], "ss34-" + h(SRC, wk, "new")[:24]
    add("g1_supersede", f"surface:{on}", f"""
INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
SELECT {lit(old_s)}, {lit(wk)}, o.id, o.preamble_effective_from::date, 'work_edition:old '||coalesce(o.preamble_royal_decree,'')||' valid_from='||o.preamble_effective_from::date||' valid_to='||n.preamble_effective_from::date, NULL, {lit(BY)} FROM legal_systems o, legal_systems n WHERE o.id={lit(o)} AND n.id={lit(n)}
UNION ALL
SELECT {lit(new_s)}, {lit(wk)}, n.id, n.preamble_effective_from::date, 'work_edition:new '||n.preamble_royal_decree||' valid_from='||n.preamble_effective_from::date, {lit(old_s)}, {lit(BY)} FROM legal_systems n WHERE n.id={lit(n)}""")
    add("g1_supersede", f"members:{on}", f"""
INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
({lit('sm34-' + h(SRC, wk, o)[:24])}, {lit(wk)}, {lit(o)}, 'edition_old', {lit(BY)}),
({lit('sm34-' + h(SRC, wk, n)[:24])}, {lit(wk)}, {lit(n)}, 'edition_new', {lit(BY)})""")
add("g1_supersede", "guard_after", f"""
SELECT CASE WHEN (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND verified_status='مستبدل' AND evidence_quote IS NOT NULL AND supersedes_verification_id IS NOT NULL)={len(PAIRS)}
  AND (SELECT count(*) FROM search_surface WHERE created_by={lit(BY)})={2*len(PAIRS)} AND (SELECT count(*) FROM search_surface_member WHERE created_by={lit(BY)})={2*len(PAIRS)}
  AND (SELECT count(*) FROM search_surface s WHERE s.created_by={lit(BY)} AND s.valid_on IS NULL)=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g1_supersede", "report", f"""SELECT md5(string_agg(v.object_id||'|'||v.evidence_quote, '|' ORDER BY v.object_id)) fp, count(*) n, json_agg(json_build_object('old', s.name, 'instr', v.evidence_instrument, 'quote', v.evidence_quote) ORDER BY s.name) rows FROM verification v JOIN legal_systems s ON s.id=v.object_id WHERE v.verified_by={lit(BY)}""")

# ───────────── g2: الوحدات بلا رقم ─────────────
GAP_CTE = """WITH m AS (SELECT cm.hakeem_system_id sid, l.id law_id, l.name FROM boe.current_match cm JOIN boe.law l ON l.guid=cm.guid WHERE cm.hakeem_system_id IS NOT NULL AND l.status_at_source='ساري'),
un AS (SELECT m.sid, m.name, u.law_id, u.seq, u.heading, length(u.body) len FROM m JOIN boe.unit u ON u.law_id=m.law_id WHERE u.article_number IS NULL AND NOT EXISTS (SELECT 1 FROM boe.unit_number_fix f WHERE f.law_id=u.law_id AND f.seq=u.seq)),
nb AS (SELECT un.*,
  (SELECT coalesce(f.article_number,u2.article_number) FROM boe.unit u2 LEFT JOIN boe.unit_number_fix f ON f.law_id=u2.law_id AND f.seq=u2.seq WHERE u2.law_id=un.law_id AND u2.seq<un.seq AND coalesce(f.article_number,u2.article_number) IS NOT NULL AND coalesce(f.method,'')<>'not_article' AND NOT coalesce(f.is_bis,u2.is_bis) ORDER BY u2.seq DESC LIMIT 1) prev_n,
  (SELECT coalesce(f.article_number,u2.article_number) FROM boe.unit u2 LEFT JOIN boe.unit_number_fix f ON f.law_id=u2.law_id AND f.seq=u2.seq WHERE u2.law_id=un.law_id AND u2.seq>un.seq AND coalesce(f.article_number,u2.article_number) IS NOT NULL AND coalesce(f.method,'')<>'not_article' AND NOT coalesce(f.is_bis,u2.is_bis) ORDER BY u2.seq LIMIT 1) next_n,
  (SELECT count(*) FROM boe.unit u3 WHERE u3.law_id=un.law_id AND u3.seq>un.seq AND u3.article_number IS NULL AND NOT EXISTS (SELECT 1 FROM boe.unit_number_fix f WHERE f.law_id=u3.law_id AND f.seq=u3.seq) AND u3.seq < (SELECT min(u4.seq) FROM boe.unit u4 LEFT JOIN boe.unit_number_fix f4 ON f4.law_id=u4.law_id AND f4.seq=u4.seq WHERE u4.law_id=un.law_id AND u4.seq>un.seq AND coalesce(f4.article_number,u4.article_number) IS NOT NULL)) unnumbered_between
 FROM un),
gap AS (SELECT nb.*, CASE WHEN next_n = prev_n + 2 AND unnumbered_between=0 AND len>=20 THEN prev_n+1 WHEN prev_n IS NULL AND next_n=2 AND unnumbered_between=0 AND len>=20 THEN 1 END gap_n FROM nb)"""
N_GAP, FP_GAP = 4, "802f94f9bcffcad700da53adf12e64d0"
add("g2_unit_numbers", "guard_before", f"""{GAP_CTE}
SELECT CASE WHEN (SELECT count(*) FROM gap WHERE gap_n IS NOT NULL)={N_GAP}
  AND (SELECT count(*) FROM gap g WHERE g.gap_n IS NOT NULL AND EXISTS (SELECT 1 FROM boe.unit u LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE u.law_id=g.law_id AND coalesce(f.article_number,u.article_number)=g.gap_n AND NOT coalesce(f.is_bis,u.is_bis) AND coalesce(f.method,'')<>'not_article'))=0
  AND (SELECT count(*) FROM boe.unit u JOIN boe.law l ON l.id=u.law_id WHERE l.name='نظام المرور' AND u.seq=101 AND u.article_number IS NULL AND u.heading='إشارات وعلامات مناطق العمل والمؤقتة' AND u.seq=(SELECT max(seq) FROM boe.unit WHERE law_id=u.law_id))=1
  AND (SELECT count(*) FROM pg_constraint WHERE conrelid='boe.unit_number_fix'::regclass AND conname IN ('unit_number_fix_check','unit_number_fix_method_check'))=2
  AND (SELECT count(*) FROM boe.unit_number_fix WHERE decided_by={lit(BY)})=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g2_unit_numbers", "widen_check_1", "ALTER TABLE boe.unit_number_fix DROP CONSTRAINT unit_number_fix_check, ADD CONSTRAINT unit_number_fix_check CHECK ((method IN ('body_match','neighbor_gap') AND article_number IS NOT NULL) OR (method='not_article' AND article_number IS NULL))")
add("g2_unit_numbers", "widen_check_2", "ALTER TABLE boe.unit_number_fix DROP CONSTRAINT unit_number_fix_method_check, ADD CONSTRAINT unit_number_fix_method_check CHECK (method IN ('body_match','neighbor_gap','not_article'))")
add("g2_unit_numbers", "comment", "COMMENT ON TABLE boe.unit_number_fix IS 'HKM-030/034: رقم المادة الفعلي للوحدات التي أسقط الزاحف رقمها (body_match: مطابقة المتن بمادة حكيم؛ neighbor_gap: الرقم السابق +1 = الرقم التالي −1 بلا وحدات بلا رقم بينهما) أو علامة «ليست مادة» للجداول والمرفقات. إضافة فقط.'")
add("g2_unit_numbers", "insert_neighbor_gap", f"""{GAP_CTE}
INSERT INTO boe.unit_number_fix (law_id, seq, article_number, is_bis, method, evidence, decided_by)
SELECT law_id, seq, gap_n, false, 'neighbor_gap', jsonb_build_object('prev_numbered', prev_n, 'next_numbered', next_n, 'heading', heading, 'body_length', len), {lit(BY)} FROM gap WHERE gap_n IS NOT NULL""")
add("g2_unit_numbers", "insert_not_article", f"""
INSERT INTO boe.unit_number_fix (law_id, seq, article_number, is_bis, method, evidence, decided_by)
SELECT u.law_id, u.seq, NULL, false, 'not_article', jsonb_build_object('heading', u.heading, 'body_length', length(u.body), 'basis', 'آخر وحدة في الصفحة وعنوانها مرفق إشارات لا مادة'), {lit(BY)}
FROM boe.unit u JOIN boe.law l ON l.id=u.law_id WHERE l.name='نظام المرور' AND u.seq=101 AND u.article_number IS NULL""")
add("g2_unit_numbers", "guard_after", f"""SELECT CASE WHEN (SELECT count(*) FROM boe.unit_number_fix WHERE decided_by={lit(BY)} AND method='neighbor_gap')={N_GAP} AND (SELECT count(*) FROM boe.unit_number_fix WHERE decided_by={lit(BY)} AND method='not_article')=1
  AND (SELECT count(*) FROM (SELECT f.law_id, f.article_number, f.is_bis FROM boe.unit_number_fix f WHERE f.article_number IS NOT NULL GROUP BY 1,2,3 HAVING count(*)>1) d)=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g2_unit_numbers", "report", f"""SELECT md5(string_agg(f.law_id||'#'||f.seq||'='||coalesce(f.article_number::text,'-'), '|' ORDER BY f.law_id, f.seq)) fp, count(*) n, json_agg(json_build_object('law', (SELECT name FROM boe.law WHERE id=f.law_id), 'seq', f.seq, 'n', f.article_number, 'method', f.method, 'ev', f.evidence) ORDER BY f.law_id, f.seq) rows FROM boe.unit_number_fix f WHERE f.decided_by={lit(BY)}""")

# ───────────── g3: متن الأساس المكرر ─────────────
DUP_CTE = """WITH d AS (
  SELECT a.id, a."legalSystemId" sid, a."lawName" law, a."articleNumber" n, a.content previous_text, b.id bis_id, u.body new_text, l.url
  FROM legal_articles a
  JOIN legal_articles b ON b."lawName"=a."lawName" AND b."articleNumber"=a."articleNumber" AND b."articleBis" BETWEEN 1 AND 9 AND uqn_fix.hkm30_norm(b.content)=uqn_fix.hkm30_norm(a.content)
  JOIN boe.current_match cm ON cm.hakeem_system_id=a."legalSystemId" JOIN boe.law l ON l.guid=cm.guid
  JOIN boe.unit u ON u.law_id=l.id AND coalesce((SELECT f.article_number FROM boe.unit_number_fix f WHERE f.law_id=u.law_id AND f.seq=u.seq), u.article_number)=a."articleNumber" AND NOT coalesce((SELECT f.is_bis FROM boe.unit_number_fix f WHERE f.law_id=u.law_id AND f.seq=u.seq), u.is_bis)
  WHERE a."articleBis"=0 AND length(u.body)>=20 AND uqn_fix.hkm30_norm(u.body)<>uqn_fix.hkm30_norm(a.content)
    AND u.body !~ '^\\s*-?\\s*(أُ?ضيفت هذه المادة|أضيفت هذه المادة|إضافة مادة تحمل الرقم|تم تعديل هذه المادة|عُدلت هذه المادة|استُبدلت)')"""
N_DUP = 5
add("g3_dup_base", "guard_before", f"""{DUP_CTE}
SELECT CASE WHEN (SELECT count(*) FROM d)={N_DUP} AND (SELECT count(DISTINCT id) FROM d)={N_DUP}
  AND (SELECT count(*) FROM d WHERE law='نظام الخدمة المدنية' AND n IN (15,25,36,37))=4 AND (SELECT count(*) FROM d WHERE law='نظام خدمة الأفراد' AND n=14)=1
  AND (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(SRC + '-dup-base')})=0
  AND (SELECT count(*) FROM d WHERE EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id=d.id))=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g3_dup_base", "provenance", f"""{DUP_CTE}
INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)
SELECT 'hkm34p-'||left(encode(sha256(convert_to('dup-base|'||id,'UTF8')),'hex'),24), 'article', id, law, n, 'boe', {lit(SRC + '-dup-base')}, url, encode(sha256(convert_to(previous_text,'UTF8')),'hex'), '2026-09-28'::date, 'replace_duplicated_bis_text', previous_text, now() FROM d""")
add("g3_dup_base", "content", f"""{DUP_CTE}
UPDATE legal_articles a SET content = d.new_text, "updatedAt" = now() FROM d WHERE a.id=d.id""")
add("g3_dup_base", "search_norm", f"""UPDATE legal_articles a SET search_norm = uqn_fix.hkm30_search_norm(a."lawName", a.title, a.content, a.keywords, a.classification, a.chapter) WHERE a.id IN (SELECT entity_id FROM legal_text_provenance WHERE source_id={lit(SRC + '-dup-base')})""")
add("g3_dup_base", "guard_after", f"""SELECT CASE WHEN (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(SRC + '-dup-base')})={N_DUP}
  AND (SELECT count(*) FROM legal_articles a JOIN legal_articles b ON b."lawName"=a."lawName" AND b."articleNumber"=a."articleNumber" AND b."articleBis" BETWEEN 1 AND 9 AND uqn_fix.hkm30_norm(b.content)=uqn_fix.hkm30_norm(a.content) WHERE a."articleBis"=0 AND a.id IN (SELECT entity_id FROM legal_text_provenance WHERE source_id={lit(SRC + '-dup-base')}))=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g3_dup_base", "report", f"""SELECT md5(string_agg(a.id||'|'||a.content, '|' ORDER BY a.id)) fp, count(*) n, json_agg(json_build_object('law', a."lawName", 'n', a."articleNumber", 'new', a.content, 'prev', left(p.previous_text,80)) ORDER BY a."lawName", a."articleNumber") rows FROM legal_articles a JOIN legal_text_provenance p ON p.entity_id=a.id AND p.source_id={lit(SRC + '-dup-base')}""")

# ───────────── g4: المواد الساقطة ─────────────
MISS_CTE = """WITH m AS (SELECT cm.hakeem_system_id sid, l.id law_id, l.url, l.name boe_name FROM boe.current_match cm JOIN boe.law l ON l.guid=cm.guid WHERE cm.hakeem_system_id IS NOT NULL AND l.status_at_source='ساري' AND l.id<>'boe26-04d6ad221b2a7ef079b67a64'),
u0 AS (SELECT m.sid, m.url, m.boe_name, u.law_id, u.seq, u.heading, u.body, coalesce(f.article_number, u.article_number) n, coalesce(f.is_bis, u.is_bis) bis
      FROM m JOIN boe.unit u ON u.law_id=m.law_id LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq
      WHERE coalesce(f.article_number, u.article_number) IS NOT NULL AND coalesce(f.article_number, u.article_number)>0 AND coalesce(f.method,'') <> 'not_article'),
u AS (SELECT u0.*, count(*) OVER (PARTITION BY law_id, n, bis) dup FROM u0),
miss AS (SELECT u.*, s.name law, s.classification, s.preamble_royal_decree instr FROM u JOIN legal_systems s ON s.id=u.sid
   WHERE u.dup=1 AND length(u.body)>=20
     AND u.body !~ '^\\s*-?\\s*(أُ?ضيفت هذه المادة|أضيفت هذه المادة|إضافة مادة تحمل الرقم|تم تعديل هذه المادة|عُدلت هذه المادة|استُبدلت|ألغيت هذه المادة|أُلغيت هذه المادة)'
     AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a."legalSystemId"=u.sid AND a."articleNumber"=u.n))"""
N_MISS, FP_MISS = 2, "f4f0330abb74d303307eb9f784d6b981"  # الخدمة المدنية 16 و22 (بعد neighbor_gap)
add("g4_missing", "guard_before", f"""{MISS_CTE}
SELECT CASE WHEN (SELECT count(*) FROM miss)={N_MISS} AND (SELECT count(*) FROM miss WHERE bis)=0
  AND (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(SRC + '-missing')})=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g4_missing", "insert", f"""{MISS_CTE}
INSERT INTO legal_articles (id, {LS}, "lawName", classification, {AN}, {AB}, title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT 'hkm34a-'||left(encode(sha256(convert_to('missing|'||sid||'|'||n||'|'||bis::int,'UTF8')),'hex'),24), sid, law, classification, n, CASE WHEN bis THEN 1 ELSE 0 END, 'المادة '||n, body, instr, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm(law, 'المادة '||n, body, ARRAY[]::text[], classification, NULL)
FROM miss ORDER BY law, n""")
add("g4_missing", "provenance", f"""
INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)
SELECT 'hkm34p-'||left(encode(sha256(convert_to('missing|'||a.id,'UTF8')),'hex'),24), 'article', a.id, a."lawName", a."articleNumber", 'boe', {lit(SRC + '-missing')}, l.url, encode(sha256(convert_to(a.content,'UTF8')),'hex'), '2026-09-28'::date, 'insert_from_boe', NULL, now()
FROM legal_articles a JOIN boe.current_match cm ON cm.hakeem_system_id=a.{LS} JOIN boe.law l ON l.guid=cm.guid WHERE a.id LIKE 'hkm34a-%' AND a."createdAt" >= now() - interval '1 hour'""")
add("g4_missing", "verification", f"""
INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vf34-'||left(encode(sha256(convert_to('unit|'||a.id||'|ساري','UTF8')),'hex'),24), 'unit', a.id, 'ساري', a."royalDecree", l.url, 'نص المادة كما في بوابة هيئة الخبراء (لقطة 28/9/2026)، رقمها من الجوار (neighbor_gap) أو من الصفحة', 'rule', {lit(BY)}, NULL
FROM legal_articles a JOIN boe.current_match cm ON cm.hakeem_system_id=a.{LS} JOIN boe.law l ON l.guid=cm.guid WHERE a.id LIKE 'hkm34a-%' AND a."createdAt" >= now() - interval '1 hour'""")
add("g4_missing", "guard_after", f"""SELECT CASE WHEN (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(SRC + '-missing')})={N_MISS} AND (SELECT count(*) FROM legal_articles WHERE id LIKE 'hkm34a-%' AND search_norm<>'')={N_MISS} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND object_type='unit')={N_MISS} THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g4_missing", "report", f"""SELECT md5(string_agg(a.id||'|'||a.content, '|' ORDER BY a.id)) fp, count(*) n, json_agg(json_build_object('law', a."lawName", 'n', a."articleNumber", 'bis', a.{AB}, 'text', a.content) ORDER BY a."lawName", a."articleNumber") rows FROM legal_articles a WHERE a.id LIKE 'hkm34a-%'""")

# ───────────── g5: لائحتا هيئات تطوير المناطق والمدن ─────────────
# البروفة كشفت أنهما مدخلتان منذ HKM-028 (17/10) بمعرّفين hkm28-*؛ فالمطلوب فقط ربطهما بالتنظيم (IMPLEMENTS) — لا إدخال.
PARENT = "cmpz5q6wh006fcwg26khgt4yb"
REGS = [dict(id="hkm28-27c1c4b75bd421a0f26b8b4f", name="اللائحة المالية لهيئات تطوير المناطق والمدن", n=74), dict(id="hkm28-1e4ef6eae384dd0f8d45fb43", name="اللائحة الإدارية لهيئات تطوير المناطق والمدن", n=47)]
add("g5_regs", "guard_before", f"""
SELECT CASE WHEN {" AND ".join(f"(SELECT count(*) FROM legal_systems WHERE id={lit(R['id'])} AND name={lit(R['name'])})=1 AND (SELECT count(*) FROM legal_articles WHERE {LS}={lit(R['id'])} AND {AB}<100)={R['n']} AND (SELECT count(*) FROM legal_relations WHERE source_id={lit(R['id'])} AND relation::text='IMPLEMENTS')=0" for R in REGS)}
  AND (SELECT count(*) FROM legal_systems WHERE id={lit(PARENT)} AND instrument_kind='تنظيم')=1
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
for R in REGS:
    add("g5_regs", f"relation:{R['name']}", f"""
INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation, strength, description, created_at, status)
VALUES ({lit('hkm34r-' + h(SRC, 'rel', R['id'])[:24])}, 'system', {lit(R['id'])}, 'system', {lit(PARENT)}, 'IMPLEMENTS', 1, 'HKM-034 2026-10-23: اللائحة صادرة بقرار مجلس الوزراء رقم (475) وتاريخ 1439/9/7هـ مع التنظيم في وثيقة واحدة عند هيئة الخبراء (البند أولًا/2: الموافقة على اللائحة المالية واللائحة الإدارية لهيئات تطوير المناطق والمدن)', now(), 'PROPOSED')""")
add("g5_regs", "guard_after", f"""SELECT CASE WHEN (SELECT count(*) FROM legal_relations WHERE id LIKE 'hkm34r-%' AND target_id={lit(PARENT)} AND relation::text='IMPLEMENTS')=2 THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g5_regs", "report", f"""SELECT md5(string_agg(r.source_id, '|' ORDER BY r.source_id)) fp, count(*) n FROM legal_relations r WHERE r.id LIKE 'hkm34r-%'""")

doc = {"batch": SRC, "by": BY, "groups": groups, "expected": {"g1_fp": "fff3e99d2771d7055b4bb8468f65ed5e", "g1_n": 12, "g2_fp": FP_GAP, "g2_n": 5, "g3_fp": "cee561e40ce12c0df596118210b146dc", "g3_n": 5, "g4_candidates_fp": FP_MISS, "g4_n": N_MISS, "g5_fp": "acb0495f134b959d0b7fd9d1b1f451ea", "g5_n": 2, "order": ["g1_supersede", "g2_unit_numbers", "g3_dup_base", "g4_missing", "g5_regs"]}, "regs": REGS,
       "notes": "g1 تحقق إلحاقي (verification append-only) بسند نص الإحلال عند الهيئة؛ g2 DDL توسيع قيد CHECK على جدول أُنشئ 23/10 (boe.unit_number_fix) لا حذف بيانات؛ g3 وg4 تُطبَّقان بعد g2؛ g5 اللائحتان مدخلتان منذ HKM-028؛ يُضاف ربط IMPLEMENTS فقط."}
(OUT / "statements.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
print({g: len(v) for g, v in groups.items()})
