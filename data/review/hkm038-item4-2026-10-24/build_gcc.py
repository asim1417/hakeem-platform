#!/usr/bin/env python3
"""HKM-038 البند 4 — استبدال «التنظيم الصناعي الموحد لدول مجلس التعاون» بإصداره الجديد (م/108 لعام 1447هـ).

النظام الجديد يُدخل من لقطة هيئة الخبراء نفسها (boe.unit) بلا إعادة كتابة، على نمط دفعة 22/10 (ب)،
والقديم (إصدار 2004) يُسجَّل «مستبدل» باقتباس المادة (26) من الجديد: «يُلغى نظام (قانون) التنظيم الصناعي الموحد ... لعام ٢٠٠٤».
  python3 build_gcc.py   → statements-gcc.json
"""
import hashlib, json, pathlib

D = pathlib.Path(__file__).parent
BY = 'owner-inject-hkm038-gcc-2026-10-24'
LID = 'boe26-01d39829f97b076e90a29e0b'
GUID = 'a00f1ac8-0f8c-4b46-86b5-b46500a70504'
NAME = 'نظام (قانون) التنظيم الصناعي الموحد لدول مجلس التعاون لدول الخليج العربية'
SLUG = 'نظام-قانون-التنظيم-الصناعي-الموحد-لدول-مجلس-التعاون-لدول-الخليج-العربيه-1447'
OLD = 'cmpz5r1ef00apcwg2l8lgi371'
OLD_NAME = 'قانون (نظام) التنظيم الصناعي الموحد لدول مجلس التعاون لدول الخليج العربية'
OLD_VER = 'hkm30w-b6ab5f03970312e1cb21205f'
OLD_FROM = '2006-05-02'
OLD_INSTR = 'مرسوم ملكي رقم م/20 بتاريخ 4 / 4 / 1427'
N = 28
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
NUM = 'coalesce(u.article_number, f.article_number, u.seq)'
EFF = "(l.published_gregorian + 90)"  # المرسوم ثانيًا: «ويُعمل بهما بعد (تسعين) يوماً من تاريخ نشرهما»


def lit(s):
    return '$hk$' + str(s).replace('$hk$', '$hk $') + '$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()


st = []
st.append(f"""SELECT CASE WHEN
  (SELECT count(*) FROM boe.law l WHERE l.id={lit(LID)} AND l.guid={lit(GUID)} AND l.name={lit(NAME)} AND l.status_at_source='ساري' AND l.article_count={N})=1
  AND (SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(LID)})={N}
  AND (SELECT count(*) FROM boe.unit u LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE u.law_id={lit(LID)} AND {NUM}<>u.seq)=0
  AND (SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(LID)} AND u.is_bis)=0
  AND (SELECT count(*) FROM legal_systems WHERE id={lit(LID)} OR name={lit(NAME)} OR eli_slug={lit(SLUG)})=0
  AND (SELECT count(*) FROM legal_systems WHERE id={lit(OLD)} AND name={lit(OLD_NAME)} AND preamble_effective_from::date={lit(OLD_FROM)}::date)=1
  AND (SELECT count(*) FROM verification WHERE id={lit(OLD_VER)} AND object_id={lit(OLD)})=1
  AND (SELECT hakeem_system_id FROM boe.current_match WHERE guid={lit(GUID)})={lit(OLD)}
  AND (SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(LID)} AND u.article_number=26 AND position('يٌلغى نظام (قانون) التنظيم الصناعي الموحد' in u.body)>0 AND position('لعام ٢٠٠٤' in u.body)>0)=1
  AND (SELECT count(*) FROM boe.text_block b WHERE b.law_id={lit(LID)} AND b.kind='royal_decree' AND position('ويُعمل بهما بعد (تسعين) يوماً من تاريخ نشرهما' in b.body)>0)=1
THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before""")

instr = "(l.instruments->0->>'text')"
cls = "'أنظمة '||l.category_path[3]"
st.append(f"""INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind)
SELECT l.id, {lit(NAME)}, {cls}, {N}, now(), now(), 'regulatory', 'تنظيمي قطاعي', 0, {lit(SLUG)},
  'أداة الإصدار:'||chr(10)||{instr}||chr(10)||'تاريخ الإصدار (هجريّ): '||replace(l.issued_hijri,'/','-')||chr(10)||'تاريخ الإصدار (ميلاديّ): '||l.issued_gregorian::date||chr(10)||'تاريخ النشر: '||l.published_hijri||'هـ ('||l.published_gregorian::date||')',
  {instr}, {EFF}::timestamp, now(), 'نظام'
FROM boe.law l WHERE l.id={lit(LID)} AND {cls} IN (SELECT DISTINCT classification FROM legal_systems WHERE classification LIKE 'أنظمة %')""")
st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT 'boe26-'||left(encode(sha256(convert_to(l.id||'|article|'||{NUM},'UTF8')),'hex'),24), l.id, {lit(NAME)}, s.classification, {NUM}, 0, coalesce(nullif(u.heading,''), 'المادة '||{NUM}), u.body, {instr}, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm({lit(NAME)}, coalesce(nullif(u.heading,''), 'المادة '||{NUM}), u.body, ARRAY[]::text[], s.classification, NULL)
FROM boe.law l JOIN legal_systems s ON s.id=l.id JOIN boe.unit u ON u.law_id=l.id LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE l.id={lit(LID)} ORDER BY u.seq""")
quote = f"""'حالة النظام في بوابة هيئة الخبراء: '||l.status_at_source||'. الصدور '||l.issued_hijri||'هـ والنشر '||l.published_hijri||'هـ ('||l.published_gregorian::date||')؛ المرسوم ثانيًا: «ويُعمل بهما بعد (تسعين) يوماً من تاريخ نشرهما»؛ يُعمل به من '||({EFF})::date||' (على افتراض نشر اللائحة مع النظام؛ والهيئة تعرضه ساريًا)'"""
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT {lit('vf38-' + h('gcc', 'work', LID, 'ساري')[:24])}, 'work', l.id, 'ساري', {instr}, l.url, {quote}, 'rule', {lit(BY)}, NULL FROM boe.law l WHERE l.id={lit(LID)}""")
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vf38-'||left(encode(sha256(convert_to('gcc|unit|'||a.id||'|ساري','UTF8')),'hex'),24), 'unit', a.id, 'ساري', {instr}, l.url, 'نص المادة كما في بوابة هيئة الخبراء (لقطة 28/9/2026)؛ يعمل بالنظام من '||s.preamble_effective_from::date, 'rule', {lit(BY)}, NULL
FROM legal_articles a JOIN legal_systems s ON s.id=a."legalSystemId" JOIN boe.law l ON l.id=s.id WHERE a."legalSystemId"={lit(LID)}""")
st.append(f"""INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
SELECT {lit('lc38-' + h('gcc', LID)[:24])}, l.id, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri, l.published_gregorian, l.status_at_source, l.category_path, l.instruments,
  coalesce((SELECT jsonb_agg(jsonb_build_object('kind', b.kind, 'text', b.body, 'heading', b.heading) ORDER BY b.seq) FROM boe.text_block b WHERE b.law_id=l.id), '[]'::jsonb), 'هيئة الخبراء بمجلس الوزراء', l.url, '2026-09-28', {lit(BY)}
FROM boe.law l WHERE l.id={lit(LID)}""")
st.append(f"""INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('hkm38m-' + h('gcc', GUID, LID)[:20])}, {lit(GUID)}, {lit(LID)}, 'owner', jsonb_build_object('basis', 'HKM-038 البند 4: الإصدار الجديد مُدخل من لقطة الهيئة (boe.unit)، والقديم 2004 مستبدل بالمادة 26'), {lit(BY)}, now())""")
q = f"""(SELECT 'المادة (26) من '||{lit(NAME)}||': «'||btrim(u.body)||'»' FROM boe.unit u WHERE u.law_id={lit(LID)} AND u.article_number=26)"""
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT {lit('vf38-' + h('gcc', 'work', OLD, 'مستبدل')[:24])}, 'work', {lit(OLD)}, 'مستبدل', {instr}, l.url, {q}, 'rule', {lit(BY)}, {lit(OLD_VER)}
FROM boe.law l WHERE l.id={lit(LID)} AND {q} IS NOT NULL""")
wk = f'we:{OLD}'
old_s, new_s = 'ss38-' + h('gcc', wk, 'old')[:24], 'ss38-' + h('gcc', wk, 'new')[:24]
st.append(f"""INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
SELECT {lit(old_s)}, {lit(wk)}, {lit(OLD)}, {lit(OLD_FROM)}::date, 'work_edition:old '||{lit(OLD_INSTR)}||' valid_from={OLD_FROM} valid_to='||s.preamble_effective_from::date, NULL, {lit(BY)} FROM legal_systems s WHERE s.id={lit(LID)}
UNION ALL
SELECT {lit(new_s)}, {lit(wk)}, {lit(LID)}, s.preamble_effective_from::date, 'work_edition:new '||s.preamble_royal_decree||' valid_from='||s.preamble_effective_from::date, {lit(old_s)}, {lit(BY)} FROM legal_systems s WHERE s.id={lit(LID)}""")
st.append(f"""INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
({lit('sm38-' + h('gcc', wk, OLD)[:24])}, {lit(wk)}, {lit(OLD)}, 'edition_old', {lit(BY)}),
({lit('sm38-' + h('gcc', wk, LID)[:24])}, {lit(wk)}, {lit(LID)}, 'edition_new', {lit(BY)})""")
st.append(f"""SELECT CASE WHEN
  (SELECT count(*) FROM legal_articles WHERE "legalSystemId"={lit(LID)} AND "articleBis"=0 AND search_norm<>'')={N}
  AND (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "legalSystemId"={lit(LID)})={N}
  AND (SELECT count(*) FROM legal_systems WHERE id={lit(LID)} AND classification IS NOT NULL AND preamble_effective_from IS NOT NULL)=1
  AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={N + 2}
  AND (SELECT count(*) FROM law_card WHERE system_id={lit(LID)})=1
  AND (SELECT hakeem_system_id FROM boe.current_match WHERE guid={lit(GUID)})={lit(LID)}
  AND (SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(OLD)} ORDER BY verified_at DESC, id DESC LIMIT 1)='مستبدل'
  AND (SELECT count(*) FROM search_surface WHERE created_by={lit(BY)})=2 AND (SELECT count(*) FROM search_surface_member WHERE created_by={lit(BY)})=2
  AND (SELECT string_agg(encode(sha256(convert_to(a.content,'UTF8')),'hex'), ',' ORDER BY a."articleNumber") FROM legal_articles a WHERE a."legalSystemId"={lit(LID)})
    = (SELECT string_agg(encode(sha256(convert_to(u.body,'UTF8')),'hex'), ',' ORDER BY u.seq) FROM boe.unit u WHERE u.law_id={lit(LID)})
THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after""")

md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements-gcc.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': {'new_system': LID, 'articles': N, 'superseded': OLD}, 'expect_delta': {'public.legal_articles': N, 'public.legal_systems': 1}, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(st), md5)
