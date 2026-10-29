#!/usr/bin/env python3
"""gap011 (HKM-051، نقص جوهري): إضافة نظام المنافسات والمشتريات الحكومية الجديد (م/76 وتاريخ 1448/02/27هـ) من أم القرى.

المصدر الرسمي (رتبة 2): صفحة النظام https://www.uqn.gov.sa/decisions-and-regulations/4001762 (نُشر 1448/03/22هـ = 2026-09-04)،
والمرسوم الملكي (4001759) وقرار مجلس الوزراء رقم (199) وتاريخ 1448/02/21هـ (4001760)، جُلبت 28/10/2026.
- المادة (الأولى بعد المائة): «يعمل بالنظام بعد مضي (مائة وعشرين) يومًا من تاريخ نشره» ← النشر + 120 = 2027-01-02 (قاعدة HKM-024).
- المادة (المائة): يحل محل نظام م/128 لعام 1440هـ (في حكيم cmpz5pp91003xcwg2wx5rgsnx «ساري»).
على نمط HKM-028 وHKM-030 دفعة 22/10 (ب): إضافة فقط. الحالة «صادر لم يسرِ بعد» للنظام ومواده، ووجه بحث للعمل نفسه
(we:cmpz5rlje00chcwg2afi55268، وفيه إصدارا 1427 و1440) بتاريخ 2027-01-02 يخلف وجه 1440، فينتقل البحث والحالة تلقائيًا يوم النفاذ
(workStatusAsOf: الجديد «ساري» و1440 «مستبدل») بلا كتابة لاحقة. لا UPDATE ولا DELETE.

    python3 batches/gap011-gtpl-1448/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap011-gtpl-1448-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
URL = 'https://www.uqn.gov.sa/decisions-and-regulations/4001762'
SRC = 'uqn:4001762'
OLD = 'cmpz5pp91003xcwg2wx5rgsnx'          # نظام 1440 في حكيم
OLD_NAME = 'نظام المنافسات و المشتريات الحكومية'
WORK = 'we:cmpz5rlje00chcwg2afi55268'      # عمل نظام المنافسات (1427 ثم 1440)
OLD_SURFACE = 'ss34-8eb2c4e77febe6dfbaa3ac68'
NAME = 'نظام المنافسات والمشتريات الحكومية الصادر بالمرسوم الملكي رقم (م/76) وتاريخ 1448/02/27هـ'
SLUG = 'نظام-المنافسات-والمشتريات-الحكوميه-الصادر-بالمرسوم-الملكي-رقم-م-76-وتاريخ-1448-02-27ه'  # lawSlug(NAME) من lib/modules/legal-core/eli.ts
INSTR = 'مرسوم ملكي رقم (م/76) وتاريخ 1448/02/27هـ قرار مجلس الوزراء رقم (199) وتاريخ 1448/02/21هـ'
EFFECTIVE = '2027-01-02'
PREAMBLE = ('أداة الإصدار:\n' + INSTR + '\nتاريخ الإصدار (هجريّ): 1448-02-27\nتاريخ الإصدار (ميلاديّ): 2026-08-10'
            '\nتاريخ النشر: 1448/03/22هـ (2026-09-04)')
NOT_YET = 'صادر لم يسرِ بعد'


def lit(v):
    if v is None:
        return 'NULL'
    if isinstance(v, int):
        return str(v)
    assert '$hk$' not in v
    return f'$hk${v}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


arts = json.loads((D / 'articles.json').read_text(encoding='utf-8'))
assert [a['n'] for a in arts] == list(range(1, 102))
SID = 'uqn26-' + h(SRC, 'system')
aid = {a['n']: 'uqn26-' + h(SID, 'article', str(a['n'])) for a in arts}
page_sha = hashlib.sha256((D / 'source' / 'uqn-4001762.md').read_bytes()).hexdigest()
eff_quote = (f"المادة (الأولى بعد المائة): «{arts[100]['content']}» — نُشر في أم القرى 1448/03/22هـ (2026-09-04)، فيسري من {EFFECTIVE}؛ "
             f"والمادة (المائة): «{arts[99]['content']}»")

st = []
st.append(f"""SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id={lit(SID)} OR name={lit(NAME)} OR eli_slug={lit(SLUG)})=0
 AND (SELECT count(*) FROM legal_articles WHERE "lawName"={lit(NAME)} OR id IN ({','.join(lit(x) for x in aid.values())}))=0
 AND (SELECT count(*) FROM legal_systems WHERE id={lit(OLD)} AND name={lit(OLD_NAME)} AND classification IS NOT NULL)=1
 AND (SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(OLD)} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'
 AND (SELECT count(*) FROM search_surface WHERE id={lit(OLD_SURFACE)} AND work_key={lit(WORK)} AND surface_system_id={lit(OLD)})=1
 AND (SELECT count(*) FROM search_surface WHERE work_key={lit(WORK)} AND valid_on>'2019-07-16')=0
 AND (SELECT count(*) FROM search_surface_member WHERE work_key={lit(WORK)})=2
 AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0
 AND (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(SRC)})=0
THEN 'ok' ELSE {FAIL} END AS guard_before""")
st.append(f"""INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind)
SELECT {lit(SID)}, {lit(NAME)}, o.classification, 101, now(), now(), o.domain, o.domain_title, 0, {lit(SLUG)}, {lit(PREAMBLE)}, {lit(INSTR)}, {lit(EFFECTIVE)}::timestamp, now(), 'نظام'
FROM legal_systems o WHERE o.id={lit(OLD)} AND o.name={lit(OLD_NAME)}""")
vals = ',\n'.join(f"({lit(aid[a['n']])}, {a['n']}, {lit(a['title'])}, {lit(a['chapter'])}, {lit(a['content'])})" for a in arts)
st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT v.id, s.id, s.name, s.classification, v.n, 0, v.title, v.content, v.chapter, {lit(INSTR)}, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm(s.name, v.title, v.content, ARRAY[]::text[], s.classification, v.chapter)
FROM (VALUES
{vals}
) AS v(id, n, title, chapter, content) JOIN legal_systems s ON s.id={lit(SID)}""")
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES ({lit('vfg11-' + h(BY, 'work', SID))}, 'work', {lit(SID)}, {lit(NOT_YET)}, {lit('مرسوم ملكي رقم (م/76) وتاريخ 1448/02/27هـ — من ' + EFFECTIVE)}, {lit(URL)}, {lit(eff_quote)}, 'rule', {lit(BY)}, NULL)""")
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vfg11-'||left(encode(sha256(convert_to({lit(BY)}||'|unit|'||a.id,'UTF8')),'hex'),24), 'unit', a.id, {lit(NOT_YET)}, {lit('مرسوم ملكي رقم (م/76) وتاريخ 1448/02/27هـ — من ' + EFFECTIVE)}, {lit(URL)},
  {lit('نص المادة كما في أم القرى (نُشر 1448/03/22هـ)؛ يسري النظام من ' + EFFECTIVE)}, 'rule', {lit(BY)}, NULL
FROM legal_articles a WHERE a."legalSystemId"={lit(SID)}""")
st.append(f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text)
VALUES ({lit('g11p-' + h(BY, 'system'))}, 'system', {lit(SID)}, {lit(NAME)}, NULL, 'uqn', {lit(SRC)}, {lit(URL)}, {lit(page_sha)}, DATE '2026-10-28', 'insert:uqn_page', NULL)""")
pv = ',\n'.join(f"({lit('g11p-' + h(BY, 'article', str(a['n'])))}, 'article', {lit(aid[a['n']])}, {lit(NAME)}, {a['n']}, 'uqn', {lit(SRC)}, {lit(URL)}, {lit(a['sha256'])}, DATE '2026-10-28', 'insert:uqn_page', NULL)" for a in arts)
st.append(f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text)
VALUES
{pv}""")
SS = 'ssg11-' + h(BY, WORK, 'new')
st.append(f"""INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
VALUES ({lit(SS)}, {lit(WORK)}, {lit(SID)}, {lit(EFFECTIVE)}::date, {lit('work_edition:new ' + INSTR + ' valid_from=' + EFFECTIVE + ' (يحل محل م/128 لعام 1440هـ بالمادة المائة)')}, {lit(OLD_SURFACE)}, {lit(BY)})""")
st.append(f"""INSERT INTO search_surface_member (id, work_key, system_id, role, created_by)
VALUES ({lit('smg11-' + h(BY, WORK, SID))}, {lit(WORK)}, {lit(SID)}, 'edition_new', {lit(BY)})""")
sha_list = ','.join(a['sha256'] for a in arts)
st.append(f"""SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id={lit(SID)} AND "articleCount"=101 AND preamble_effective_from::date={lit(EFFECTIVE)}::date AND classification IS NOT NULL)=1
 AND (SELECT count(*) FROM legal_articles WHERE "legalSystemId"={lit(SID)} AND "articleBis"=0 AND coalesce(search_norm,'')<>'' AND coalesce(chapter,'')<>'')=101
 AND (SELECT string_agg(encode(sha256(convert_to(content,'UTF8')),'hex'), ',' ORDER BY "articleNumber") FROM legal_articles WHERE "legalSystemId"={lit(SID)})={lit(sha_list)}
 AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND verified_status={lit(NOT_YET)})=102
 AND (SELECT count(*) FROM legal_text_provenance WHERE source_id={lit(SRC)})=102
 AND (SELECT count(*) FROM search_surface WHERE work_key={lit(WORK)})=3 AND (SELECT count(*) FROM search_surface_member WHERE work_key={lit(WORK)})=3
THEN 'ok' ELSE {FAIL} END AS guard_after""")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'system_id': SID,
                                               'expect_delta': {'public.legal_articles': 101, 'public.legal_systems': 1}, 'statements': st},
                                              ensure_ascii=False, indent=1), encoding='utf-8')
print(md5, len(st), SID)
