#!/usr/bin/env python3
"""HKM-030 دفعة 22/10 (ب) — تنفيذ ما لا يحتاج زحفًا من البيانات الموجودة (بإذن المالك «كل البيانات موجودة عندك نفذها وثم ننفذ مراجعة بشرية بعد ذلك»).

المجموعات:
  g1_match  تصحيح مطابقات هيئة الخبراء (boe.match صفوفًا جديدة، فالمخطط append-only وboe.current_match يأخذ الأحدث): الإصدار الجديد ← سجله الجديد، الإصدار الملغى ← بلا سجل، وربط 1421 والمستشفى.
  g2_ingest إدخال 8 أنظمة نصّها كامل في لقطة الهيئة (boe.unit/boe.text_block) على نمط HKM-028، مع الإحلال حيث نصّت الأداة.
  g3_tail   حذف ذيل ملحق بمتن 94 مادة (عنوان باب/فصل أو تذييل موقع) حيث متن الهيئة = بداية متننا حرفيًّا بعد التطبيع، مع صف legal_text_provenance.
  g4_class  تصنيف 52 نظامًا بقاعدة الألفاظ (دقة 94.7% في اختبار الاستبعاد الواحد عند هامش ≥ 1.5) و41 من اسم النظام الأم الوارد في الاسم.
كل عبارة SQL تعمل على بيانات القاعدة نفسها؛ لا نص قانوني مكتوب هنا.
"""
import hashlib, json, os
from pathlib import Path

OUT = Path(__file__).parent
BY = "owner-inject-hkm030-batch2-2026-10-22"
DECIDED = "hkm030-batch2-2026-10-22"
TODAY = "2026-10-22"


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


GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
LS, AB, AN = '"legalSystemId"', '"articleBis"', '"articleNumber"'

# ───────────────────────── g1: boe.match ─────────────────────────
REPOINT = [  # guid → النظام الصحيح (الإصدار الجديد المدخل من قبل، أو الإصدار 1433 للتنفيذ)
    ("eaee8a20-3a54-4aaf-b0d9-b1ad00998962", "cmpz5r6zj00bbcwg225jusnib", "boe26-fc756d56e044a8c0d2272c52", "نظام التأمينات الاجتماعية م/273 1445هـ"),
    ("ad9ed861-70e6-4d31-9268-b20400d68915", "cmpz5pfqt002lcwg2y1viv8vw", "boe26-6d0e7bc2e6cae54816b24981", "نظام القياس والمعايرة م/79 1446هـ"),
    ("7b3d4c04-1816-4c89-bdc7-b32200e54fee", "cmpz5rt6500d5cwg25ey9d89j", "boe26-46303ce06a82154ff9f839bf", "تنظيم الهيئة العامة للطيران المدني (807) 1446هـ"),
    ("831af69c-9bad-4f06-9843-b33100926b3c", "cmpz5qfgb007mcwg2msul8acv", "boe26-d757638789cfefd3fe9c817f", "تنظيم المؤسسة العامة للري (43) 1447هـ"),
    ("c81ba2f1-1bf1-443b-9b1c-a9a700f27110", "cmpwi0c2p001znxffggwph0fg", "ed25-d62948bc9ac1a3c3fb813076", "نظام التنفيذ 1433هـ ← سجل الإصدار م/53 لا السجل المخلوط"),
]
UNLINK = [  # صفحة الهيئة لإصدار ملغى طابقت سجلنا الساري الأحدث
    ("7b6436fd-e7c0-4a51-afcc-a9a700f1ae15", "cmpz5peyx002hcwg2i0z53bv9", "نظام الرهن التجاري 1424هـ (لاغي)"),
    ("6b615a05-f637-41cf-8419-a9a700f1afd7", "cmpz5pf5v002icwg2mt8tagez", "نظام المنافسة 1425هـ (لاغي)"),
    ("2541255e-9e5b-4393-a8b0-a9a700f1a596", "cmpz5pd150027cwg25aec1hlf", "نظام صندوق الاستثمارات العامة 1391هـ (لاغي)"),
]
NEWLINK = [  # صفحة هيئة بلا ربط ونظامها عندنا بنصّه (71/71 و21/21 مطابقة بالمحتوى)
    ("8ff3cd90-e466-4bf9-a071-a9a700f2a70d", "cmpz5r6zj00bbcwg225jusnib", "نظام التأمينات الاجتماعية 1421هـ", 71, 71),
    ("a187d565-1a52-45cc-a1de-b2dc00daae23", "b34f149ba7e54f1ca92e299fb6306460", "النظام الأساس لمستشفى الملك خالد التخصصي للعيون ومركز الأبحاث", 21, 21),
]

add("g1_match", "guard_before", f"""
SELECT CASE WHEN
  {" AND ".join(f"(SELECT count(*) FROM boe.match WHERE guid={lit(g)} AND hakeem_system_id={lit(old)})=1" for g, old, _n, _d in REPOINT)}
  AND {" AND ".join(f"(SELECT count(*) FROM boe.match WHERE guid={lit(g)} AND hakeem_system_id={lit(old)})=1" for g, old, _d in UNLINK)}
  AND {" AND ".join(f"(SELECT count(*) FROM boe.match WHERE guid={lit(g)})=0 AND (SELECT count(*) FROM legal_systems WHERE id={lit(sid)})=1" for g, sid, _n, _a, _b in NEWLINK)}
  AND {" AND ".join(f"(SELECT count(*) FROM legal_systems WHERE id={lit(new)})=1" for _g, _o, new, _d in REPOINT)}
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
for g, old, new, desc in REPOINT:
    add("g1_match", f"repoint:{desc}", f"""
INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('hkm30m-' + h('batch2', 'repoint', g, new)[:20])}, {lit(g)}, {lit(new)}, 'owner',
  jsonb_build_object('repointed_from', {lit(old)}, 'basis', {lit('HKM-030 دفعة 22/10 ب: صفحة الهيئة لهذا الإصدار تخص السجل الذي يحمل نصه، لا السجل القديم/المخلوط — ' + desc)}),
  {lit(DECIDED)}, now())""")
for g, old, desc in UNLINK:
    add("g1_match", f"unlink:{desc}", f"""
INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('hkm30m-' + h('batch2', 'unlink', g)[:20])}, {lit(g)}, NULL, 'owner',
  jsonb_build_object('unlinked_from', {lit(old)}, 'basis', {lit('HKM-030 دفعة 22/10 ب: صفحة الهيئة لإصدار ملغى؛ سجلنا هو الإصدار الساري الأحدث وله صفحته — ' + desc)}),
  {lit(DECIDED)}, now())""")
for g, sid, name, a, b in NEWLINK:
    add("g1_match", f"link:{name}", f"""
INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('hkm30m-' + h('batch2', g, sid)[:20])}, {lit(g)}, {lit(sid)}, 'owner',
  jsonb_build_object('basis', {lit('HKM-030 دفعة 22/10 ب: مطابقة بالمحتوى مادةً مادة (تشابه ≥ 0.95 في كل المواد أو أغلبها) — ' + name)}, 'boe_articles', {a}, 'hakeem_articles', {b}),
  {lit(DECIDED)}, now())""")
add("g1_match", "guard_after", f"""
SELECT CASE WHEN
  {" AND ".join(f"(SELECT count(*) FROM boe.current_match WHERE guid={lit(g)} AND hakeem_system_id={lit(new)})=1" for g, _o, new, _d in REPOINT)}
  AND {" AND ".join(f"(SELECT count(*) FROM boe.current_match WHERE guid={lit(g)} AND hakeem_system_id IS NULL)=1" for g, _o, _d in UNLINK)}
  AND {" AND ".join(f"(SELECT count(*) FROM boe.current_match WHERE guid={lit(g)} AND hakeem_system_id={lit(sid)})=1" for g, sid, _n, _a, _b in NEWLINK)}
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")

# ───────────────────────── g2: الأنظمة الثمانية ─────────────────────────
# (law_id, guid, name, slug, effective_expr(l), effective_article_no, must_contain, supersedes)
LAWS = [
    dict(id="boe26-5bac2a8e68bd1f71d5819a32", guid="7ac1a448-b042-4c73-8164-b2eb00ceb54f", name="نظام الطوارئ", slug="نظام-الطوارئ", n=32,
         eff="l.published_gregorian", eff_art=32, must="من تاريخ نشره"),
    dict(id="boe26-c59a46aed569267373a74421", guid="a73b2b40-64c8-449e-aa8f-b3ca009257ce", name="نظام الرقابة المالية", slug="نظام-الرقابه-الماليه", n=29,
         eff="l.published_gregorian + 120", eff_art=29, must="(مائة وعشرين) يومًا من تاريخ نشره", fix_seq=15),
    dict(id="boe26-e857025ebc3b270d499b886b", guid="48da5c0f-b5a6-4e93-b76c-b33200be0330", name="نظام المواد البترولية والبتروكيماوية", slug="نظام-المواد-البتروليه-والبتروكيماويه", n=22,
         eff="l.published_gregorian + 90", eff_art=22, must="(تسعين) يومًا من تاريخ نشره",
         sup=dict(old="cmpz5r2yb00axcwg2bk2ll57o", old_name="نظام التجارة بالمنتجات البترولية", old_ver=None, old_from="2017-10-18", old_instr="مرسوم ملكي رقم (م/18) وتاريخ 1439/1/28 هـ", quote_art=21, quote_must="يحل النظام محل نظام التجارة بالمنتجات البترولية")),
    dict(id="boe26-7208fdd00b0e59582be85367", guid="479e4f48-d35c-4dac-994b-b2eb00e44c48", name="تنظيم الهيئة الوطنية لإدارة الطوارئ", slug="تنظيم-الهيئه-الوطنيه-لاداره-الطوارئ", n=19,
         eff="l.published_gregorian", eff_art=19, must="من تاريخ نشره"),
    dict(id="boe26-85d11f9b554a191cd72c08cf", guid="46d3b1b2-6455-466d-8942-b13600c0414c", name="تنظيم المعهد الوطني للتطوير المهني التعليمي", slug="تنظيم-المعهد-الوطني-للتطوير-المهني-التعليمي", n=17,
         eff="l.published_gregorian", eff_art=17, must="من تاريخ نشره",
         sup=dict(old="cmpz5pyy1005acwg2shpqkguy", old_name="تنظيم المعهد الوطني للتطوير المهني التعليمي 1441هـ", old_ver="hkm30v-353f34e166cdcda69d689bfc", old_from="2019-11-05", old_instr="قرار مجلس الوزراء رقم (197) وتاريخ 1441/3/8هـ", quote_art=16, quote_must="يحل هذا التنظيم محل تنظيم المعهد الوطني")),
    dict(id="boe26-e8055f9af1cbb7928c204fcd", guid="6d1d7df9-b061-4830-8356-b332009f07ad", name="تنظيم الهيئة العامة للأمن الغذائي", slug="تنظيم-الهيئه-العامه-للامن-الغذائي", n=15,
         eff="l.published_gregorian", eff_art=15, must="من تاريخ نشره",
         sup=dict(old="cmpz5qhz0007zcwg2u08fbiul", old_name="الترتيبات التنظيمية للهيئة العامة للأمن الغذائي", old_ver="boe26-8c06af0e0875821f07a21022", old_from="2023-01-17", old_instr="قرار مجلس الوزراء رقم (440) وتاريخ 1444/6/24هـ", quote_block="cabinet_decision", quote_re=r"ثاني[^:]{0,3}: يحل التنظيم[^.]+\.")),
    dict(id="boe26-970129b497157f8b28961b8d", guid="43151145-3b31-47d1-8a6c-b2db00a871d0", name="تنظيم الهيئة السعودية لتسويق الاستثمار", slug="تنظيم-الهيئه-السعوديه-لتسويق-الاستثمار", n=14,
         eff="l.issued_gregorian", eff_art=14, must="من تاريخ الموافقة عليه",
         sup=dict(old="cmpz5ptwh004lcwg2mlkw3um6", old_name="الترتيبات التنظيمية للهيئة السعودية لتسويق الاستثمار", old_ver="boe26-0b26e5025035be762125ceb9", old_from="2022-08-02", old_instr="قرار مجلس الوزراء رقم (13) وتاريخ 1444/1/4هـ", quote_block="cabinet_decision", quote_re=r"ثاني[^:]{0,3}: يحل التنظيم[^.]+\.")),
    dict(id="boe26-af97940f45cf6622a5eb757d", guid="664d871f-7a44-4a52-b653-b2db00b55732", name="الترتيبات التنظيمية للمركز السعودي لكود البناء", slug="الترتيبات-التنظيميه-للمركز-السعودي-لكود-البناء", n=14,
         eff="l.published_gregorian", eff_art=14, must="من تاريخ نشرها"),
]

add("g2_ingest", "guard_before", f"""
SELECT CASE WHEN
  {" AND ".join(f"(SELECT count(*) FROM boe.law l WHERE l.id={lit(L['id'])} AND l.guid={lit(L['guid'])} AND l.name={lit(L['name'])} AND l.status_at_source='ساري' AND l.article_count={L['n']} AND array_length(l.category_path,1)=3)=1 AND (SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(L['id'])})={L['n']} AND (SELECT count(*) FROM legal_systems WHERE id={lit(L['id'])} OR name={lit(L['name'])} OR eli_slug={lit(L['slug'])})=0 AND (SELECT count(*) FROM boe.current_match WHERE guid={lit(L['guid'])} AND hakeem_system_id IS NOT NULL)=0 AND (SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(L['id'])} AND u.article_number={L['eff_art']} AND position({lit(L['must'])} in u.body)>0)=1" for L in LAWS)}
  AND (SELECT count(*) FROM boe.unit u WHERE u.law_id='boe26-c59a46aed569267373a74421' AND u.article_number IS NULL)=1
  AND (SELECT count(*) FROM boe.unit u WHERE u.law_id='boe26-c59a46aed569267373a74421' AND u.article_number IS DISTINCT FROM u.seq AND u.seq<>15)=0
  AND {" AND ".join(f"(SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(L['id'])} AND (u.article_number IS DISTINCT FROM u.seq OR u.is_bis))=0" for L in LAWS if not L.get('fix_seq'))}
  AND {" AND ".join(f"(SELECT count(*) FROM legal_systems WHERE id={lit(L['sup']['old'])} AND name={lit(L['sup']['old_name'])} AND preamble_effective_from::date={lit(L['sup']['old_from'])}::date)=1" for L in LAWS if L.get('sup'))}
  AND {" AND ".join(f"(SELECT count(*) FROM verification WHERE id={lit(L['sup']['old_ver'])} AND object_id={lit(L['sup']['old'])})=1" for L in LAWS if L.get('sup') and L['sup']['old_ver'])}
  AND (SELECT count(*) FROM verification WHERE object_id='cmpz5r2yb00axcwg2bk2ll57o')=0
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")

for L in LAWS:
    lid, name, slug, n = L["id"], L["name"], L["slug"], L["n"]
    numexpr = "coalesce(u.article_number, u.seq)"
    cls = "'أنظمة '||l.category_path[3]"
    quote = f"""'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: '||l.status_at_source||' (لقطة 28/9/2026). الصدور '||l.issued_hijri||'هـ ('||l.issued_gregorian||') والنشر '||l.published_hijri||'هـ ('||l.published_gregorian||')؛ المادة ('||{L['eff_art']}||'): «'||btrim((SELECT u.body FROM boe.unit u WHERE u.law_id=l.id AND {numexpr}={L['eff_art']}))||'»؛ يُعمل به من '||({L['eff']})::date"""
    instr = "(l.instruments->0->>'text')"
    add("g2_ingest", f"system:{name}", f"""
INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind)
SELECT l.id, {lit(name)}, {cls}, {n}, now(), now(), 'regulatory', 'تنظيمي قطاعي', 0, {lit(slug)},
  'أداة الإصدار:'||chr(10)||{instr}||chr(10)||'تاريخ الإصدار (هجريّ): '||replace(l.issued_hijri,'/','-')||chr(10)||'تاريخ الإصدار (ميلاديّ): '||l.issued_gregorian||chr(10)||'تاريخ النشر: '||l.published_hijri||'هـ ('||l.published_gregorian||')',
  {instr}, ({L['eff']})::timestamp, now(), {lit(name.split(' ')[0] if name.split(' ')[0] in ('نظام','تنظيم') else 'ترتيبات تنظيمية')}
FROM boe.law l WHERE l.id={lit(lid)} AND {cls} IN (SELECT DISTINCT classification FROM legal_systems WHERE classification LIKE 'أنظمة %')""")
    add("g2_ingest", f"articles:{name}", f"""
INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT 'boe26-'||left(encode(sha256(convert_to(l.id||'|article|'||{numexpr},'UTF8')),'hex'),24), l.id, {lit(name)}, s.classification, {numexpr}, 0, coalesce(nullif(u.heading,''), 'المادة '||{numexpr}), u.body, {instr}, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm({lit(name)}, coalesce(nullif(u.heading,''), 'المادة '||{numexpr}), u.body, ARRAY[]::text[], s.classification, NULL)
FROM boe.law l JOIN legal_systems s ON s.id=l.id JOIN boe.unit u ON u.law_id=l.id WHERE l.id={lit(lid)} ORDER BY u.seq""")
    add("g2_ingest", f"verification_work:{name}", f"""
INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT {lit('vf26-' + h('batch2', 'work', lid, 'ساري')[:24])}, 'work', l.id, 'ساري', {instr}, l.url, {quote}, 'rule', {lit(BY)}, NULL FROM boe.law l WHERE l.id={lit(lid)}""")
    add("g2_ingest", f"verification_units:{name}", f"""
INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vf26-'||left(encode(sha256(convert_to('batch2|unit|'||a.id||'|ساري','UTF8')),'hex'),24), 'unit', a.id, 'ساري', {instr}, l.url, 'نص المادة كما في بوابة هيئة الخبراء (لقطة 28/9/2026)؛ يعمل بالنظام من '||s.preamble_effective_from::date, 'rule', {lit(BY)}, NULL
FROM legal_articles a JOIN legal_systems s ON s.id=a."legalSystemId" JOIN boe.law l ON l.id=s.id WHERE a."legalSystemId"={lit(lid)}""")
    add("g2_ingest", f"law_card:{name}", f"""
INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
SELECT {lit('lc26-' + h('batch2', lid)[:24])}, l.id, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri, l.published_gregorian, l.status_at_source, l.category_path, l.instruments,
  coalesce((SELECT jsonb_agg(jsonb_build_object('kind', b.kind, 'text', b.body, 'heading', b.heading) ORDER BY b.seq) FROM boe.text_block b WHERE b.law_id=l.id), '[]'::jsonb), 'هيئة الخبراء بمجلس الوزراء', l.url, '2026-09-28', {lit(BY)}
FROM boe.law l WHERE l.id={lit(lid)}""")
    add("g2_ingest", f"match:{name}", f"""
INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('hkm30m-' + h('batch2', L['guid'], lid)[:20])}, {lit(L['guid'])}, {lit(lid)}, 'owner', jsonb_build_object('basis', 'HKM-030 دفعة 22/10 ب: النظام مُدخل من لقطة الهيئة نفسها (boe.unit)'), {lit(DECIDED)}, now())""")
    sup = L.get("sup")
    if sup:
        if sup.get("quote_art"):
            q = f"""(SELECT 'المادة ('||{sup['quote_art']}||') من '||{lit(name)}||': «'||btrim(u.body)||'»' FROM boe.unit u WHERE u.law_id={lit(lid)} AND coalesce(u.article_number,u.seq)={sup['quote_art']} AND position({lit(sup['quote_must'])} in u.body)>0)"""
        else:
            q = f"""(SELECT {instr}||'، البند: «'||btrim(substring(regexp_replace(b.body,'\\s+',' ','g') from {lit(sup['quote_re'])}))||'»' FROM boe.text_block b WHERE b.law_id=l.id AND b.kind={lit(sup['quote_block'])} AND regexp_replace(b.body,'\\s+',' ','g') ~ {lit(sup['quote_re'])})"""
        add("g2_ingest", f"supersede:{sup['old_name']}", f"""
INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT {lit('vf26-' + h('batch2', 'work', sup['old'], 'مستبدل')[:24])}, 'work', {lit(sup['old'])}, 'مستبدل', {instr}, l.url, {q}, 'rule', {lit(BY)}, {lit(sup['old_ver'])}
FROM boe.law l WHERE l.id={lit(lid)} AND {q} IS NOT NULL""")
        wk = f"we:{sup['old']}"
        old_s, new_s = "ss26-" + h("batch2", wk, "old")[:24], "ss26-" + h("batch2", wk, "new")[:24]
        add("g2_ingest", f"surface:{sup['old_name']}", f"""
INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
SELECT {lit(old_s)}, {lit(wk)}, {lit(sup['old'])}, {lit(sup['old_from'])}::date, 'work_edition:old '||{lit(sup['old_instr'])}||' valid_from={sup['old_from']} valid_to='||s.preamble_effective_from::date, NULL, {lit(BY)} FROM legal_systems s WHERE s.id={lit(lid)}
UNION ALL
SELECT {lit(new_s)}, {lit(wk)}, {lit(lid)}, s.preamble_effective_from::date, 'work_edition:new '||s.preamble_royal_decree||' valid_from='||s.preamble_effective_from::date, {lit(old_s)}, {lit(BY)} FROM legal_systems s WHERE s.id={lit(lid)}""")
        add("g2_ingest", f"members:{sup['old_name']}", f"""
INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
({lit('sm26-' + h('batch2', wk, sup['old'])[:24])}, {lit(wk)}, {lit(sup['old'])}, 'edition_old', {lit(BY)}),
({lit('sm26-' + h('batch2', wk, lid)[:24])}, {lit(wk)}, {lit(lid)}, 'edition_new', {lit(BY)})""")

n_sup = sum(1 for L in LAWS if L.get("sup"))
add("g2_ingest", "guard_after", f"""
SELECT CASE WHEN
  {" AND ".join(f"(SELECT count(*) FROM legal_articles WHERE {LS}={lit(L['id'])} AND {AB}=0 AND search_norm<>'' )={L['n']} AND (SELECT count(DISTINCT {AN}) FROM legal_articles WHERE {LS}={lit(L['id'])})={L['n']} AND (SELECT count(*) FROM legal_systems WHERE id={lit(L['id'])} AND classification IS NOT NULL AND preamble_effective_from IS NOT NULL)=1 AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND (object_id={lit(L['id'])} OR object_id IN (SELECT id FROM legal_articles WHERE {LS}={lit(L['id'])})))={L['n'] + 1} AND (SELECT count(*) FROM law_card WHERE system_id={lit(L['id'])})=1 AND (SELECT count(*) FROM boe.current_match WHERE guid={lit(L['guid'])} AND hakeem_system_id={lit(L['id'])})=1" for L in LAWS)}
  AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND verified_status='مستبدل')={n_sup}
  AND (SELECT count(*) FROM search_surface WHERE created_by={lit(BY)})={2 * n_sup}
  AND (SELECT count(*) FROM search_surface_member WHERE created_by={lit(BY)})={2 * n_sup}
  AND (SELECT string_agg(encode(sha256(convert_to(a.content,'UTF8')),'hex'), ',' ORDER BY a."legalSystemId", a."articleNumber") FROM legal_articles a WHERE a."legalSystemId" IN ({", ".join(lit(L['id']) for L in LAWS)}))
    = (SELECT string_agg(encode(sha256(convert_to(u.body,'UTF8')),'hex'), ',' ORDER BY u.law_id, coalesce(u.article_number,u.seq)) FROM boe.unit u WHERE u.law_id IN ({", ".join(lit(L['id']) for L in LAWS)}))
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")

# ───────────────────────── g3: الذيل الملحق ─────────────────────────
TAIL_SRC = "hkm030-tail-strip-2026-10-22"
TAIL_CTE = """
WITH ev AS (SELECT DISTINCT ON (unit_id) unit_id FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC),
st AS (SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type='work' ORDER BY object_id, verified_at DESC, id DESC),
m AS (SELECT DISTINCT ON (m.hakeem_system_id) m.hakeem_system_id sid, l.id law_id, l.status_at_source boe_status FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id IS NOT NULL ORDER BY m.hakeem_system_id, (l.status_at_source='ساري') DESC, l.issued_gregorian DESC NULLS LAST),
p AS (SELECT DISTINCT ON (x.id) x.id aid, x."lawName" law, x."articleNumber" an, x.content oraw, u.body braw, uqn_fix.hkm30_norm(x.content) o, uqn_fix.hkm30_norm(u.body) b, u.seq useq, u.law_id ulaw
 FROM m JOIN legal_articles x ON x."legalSystemId"=m.sid AND x."articleBis"<100 JOIN boe.unit u ON u.law_id=m.law_id AND u.article_number=x."articleNumber" AND u.is_bis=(x."articleBis">0)
 LEFT JOIN ev ON ev.unit_id=x.id LEFT JOIN st ON st.object_id=m.sid
 WHERE ev.unit_id IS NULL AND m.boe_status='ساري' AND coalesce(st.verified_status,'') NOT IN ('مستبدل','ملغى','ملغاة','سجل مخلوط — لا يُعرض') AND m.sid<>'cmpwi0c2p001znxffggwph0fg'
 ORDER BY x.id, similarity(uqn_fix.hkm30_norm(u.body), uqn_fix.hkm30_norm(x.content)) DESC),
t AS (SELECT * FROM p WHERE o<>b AND position(b in o)=1 AND length(o)-length(b) <= 120 AND NOT EXISTS (SELECT 1 FROM boe.amendment_note n WHERE n.law_id=p.ulaw AND n.unit_seq=p.useq)),
cut AS (SELECT t.aid, t.law, t.an, t.oraw, t.b, (SELECT min(g) FROM generate_series(greatest(1,length(t.braw)-80), length(t.oraw)) g WHERE uqn_fix.hkm30_norm(left(t.oraw,g)) = t.b) L FROM t)
"""
add("g3_tail", "stage", f"""
CREATE TEMP TABLE hkm30_tail ON COMMIT DROP AS
{TAIL_CTE}
SELECT aid, law, an, oraw previous_text, rtrim(left(oraw, L), E' \\t\\n\\r.،؛:') new_text, substr(oraw, L+1) suffix FROM cut WHERE L IS NOT NULL""")
add("g3_tail", "guard_before", f"""
SELECT CASE WHEN (SELECT count(*) FROM hkm30_tail)=94
  AND (SELECT count(*) FROM hkm30_tail WHERE uqn_fix.hkm30_norm(new_text) <> uqn_fix.hkm30_norm(previous_text) AND length(new_text) >= 20)=94
  AND (SELECT count(*) FROM hkm30_tail h WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance pv WHERE pv.entity_id=h.aid AND pv.source_id={lit(TAIL_SRC)}))=94
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g3_tail", "provenance", f"""
INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)
SELECT 'hkm30p-'||left(encode(sha256(convert_to({lit(TAIL_SRC)}||'|'||aid,'UTF8')),'hex'),24), 'article', aid, law, an, 'hakeem', {lit(TAIL_SRC)}, 'internal:hakeem/legal_articles/'||aid, encode(sha256(convert_to(previous_text,'UTF8')),'hex'), {lit(TODAY)}::date, 'tail_strip', previous_text, now() FROM hkm30_tail""")
add("g3_tail", "strip", """
UPDATE legal_articles a SET content = h.new_text, "updatedAt" = now() FROM hkm30_tail h WHERE a.id = h.aid""")
add("g3_tail", "search_norm", """
UPDATE legal_articles a SET search_norm = uqn_fix.hkm30_search_norm(a."lawName", a.title, a.content, a.keywords, a.classification, a.chapter) FROM hkm30_tail h WHERE a.id = h.aid""")
add("g3_tail", "guard_after", f"""
SELECT CASE WHEN (SELECT count(*) FROM legal_articles a JOIN hkm30_tail h ON h.aid=a.id WHERE a.content=h.new_text AND a.search_norm=uqn_fix.hkm30_search_norm(a."lawName", a.title, a.content, a.keywords, a.classification, a.chapter))=94
  AND (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(TAIL_SRC)})=94
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g3_tail", "report", """
SELECT md5(string_agg(aid||'|'||new_text, '|' ORDER BY aid)) fp, count(*) n, json_agg(json_build_object('law', law, 'an', an, 'suffix', suffix) ORDER BY law, an) suffixes FROM hkm30_tail""")

# ───────────────────────── g4: التصنيف ─────────────────────────
pred = json.load(open(OUT / "class_pred.json", encoding="utf-8"))
RULE = [(p["id"], p["c"], p["n"], p["m"]) for p in pred if p["c"] and p["m"] >= 1.5]
assert len(RULE) == 52, len(RULE)
add("g4_class", "guard_before", f"""
SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE coalesce(classification,'')='')=568
  AND (SELECT count(*) FROM legal_systems WHERE id IN ({", ".join(lit(i) for i, _c, _n, _m in RULE)}) AND coalesce(classification,'')='')=52
THEN 'ok' ELSE {GUARD_FAIL} END AS guard""")
add("g4_class", "from_parent_name", """
UPDATE legal_systems s SET classification = x.cls, "updatedAt" = now()
FROM (SELECT DISTINCT ON (s.id) s.id sid, p.classification cls FROM legal_systems s JOIN legal_systems p ON p.classification LIKE 'أنظمة %' AND p.name<>s.name AND length(p.name)>=12 AND position(p.name in s.name)>0
      WHERE coalesce(s.classification,'')='' ORDER BY s.id, length(p.name) DESC) x
WHERE x.sid=s.id AND coalesce(s.classification,'')=''
  AND (SELECT count(DISTINCT p2.classification) FROM legal_systems p2 WHERE p2.classification LIKE 'أنظمة %' AND p2.name<>s.name AND length(p2.name)>=12 AND position(p2.name in s.name)>0)=1""")
add("g4_class", "from_name_tokens", f"""
UPDATE legal_systems s SET classification = v.cls, "updatedAt" = now() FROM (VALUES
{", ".join(f"({lit(i)}, {lit(c)})" for i, c, _n, _m in RULE)}
) AS v(id, cls) WHERE s.id=v.id AND coalesce(s.classification,'')='' AND v.cls IN (SELECT DISTINCT classification FROM legal_systems WHERE classification LIKE 'أنظمة %')""")
add("g4_class", "guard_after", f"""
SELECT (SELECT count(*) FROM legal_systems WHERE coalesce(classification,'')='') still_unclassified, (SELECT count(*) FROM legal_systems WHERE id IN ({", ".join(lit(i) for i, _c, _n, _m in RULE)}) AND coalesce(classification,'')<>'')=52 rule_ok,
  md5((SELECT string_agg(id||'|'||coalesce(classification,''), '|' ORDER BY id) FROM legal_systems)) fp""")

json.dump({"batch": DECIDED, "by": BY, "groups": groups, "rule_classifications": [{"id": i, "name": n, "classification": c, "margin": m} for i, c, n, m in RULE]},
          open(OUT / "statements.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({g: len(v) for g, v in groups.items()})
