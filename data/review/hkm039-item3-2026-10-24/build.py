#!/usr/bin/env python3
"""HKM-039 البند 3: الإلغاءات القديمة غير المسجلة (221) — الحالات التي لها دليل نصي في الهيئة.

النص يُستخرج داخل القاعدة من boe.amendment_note وboe.unit (لا يُعاد كتابته هنا):
- المحاماة م25 والمرافعات الشرعية م217: «ملغاة» بنص ملاحظة الهيئة (م/191).
- المرافعات الشرعية م211: إلغاء عبارة في عجزها → نسخة نص جديدة = النص الحالي محذوفًا منه «، » + العبارة المقتبسة في ملاحظة الهيئة.
- المحاماة م24: سجل الإلغاء في article_amendments منسوب إليها خطأً (المرسوم يلغي المادة الخامسة والعشرين، والهيئة تعرض م24 بلا ملاحظة) → «ساري».
لا تُمس الأنظمة المستبدلة (166 مادة لها «مستبدل»)، ولا نظام التنفيذ (سجل مخلوط)، ولا مدينة الملك عبدالله (إحلال غير مثبت، للمالك).

    python3 data/review/hkm039-item3-2026-10-24/build.py <md5 نص م211 الحالي>
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'rule-item3-2026-10-24'
MUH = ('boe26-7f8f53c1b08ed35c951275ed', 'cmpz5qjiu0087cwg2yhgd8twm')   # المحاماة: law_id, system
MUR = ('boe26-eefebbe684b518fb578331ef', 'cmpwi0cw90024nxff1u02k8rn')   # المرافعات الشرعية
A24, A25 = 'cmpzcuxfd07l1vtrks2pni2ym', 'cmpzcuxfd07l2vtrkarl3462j'
A211, A217 = 'cmpwibpf901yhnxffsxmllv7m', 'cmpwibrek01ytnxffw28acmmf'
CIVIL = 'boe26-18804cb8b1d8b64f98293028'  # نظام المعاملات المدنية: م/191 «يلغى اعتباراً من تاريخ العمل بنظام المعاملات المدنية»، وم721 «بعد مضي (مائة وثمانين) يومًا من تاريخ نشره»
VALID_FROM = f"(SELECT (l.published_gregorian + 180)::timestamptz FROM boe.law l WHERE l.id = $hk${CIVIL}$hk$)"
# مقسوم عليه غير ثابت: (1/0) الثابت يطويه المخطط فيفشل الحارس دائمًا
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
INSTR = 'مرسوم ملكي رقم م/191 وتاريخ 1444/11/29هـ'


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def note(law, art):
    return (f"(SELECT n.note_text FROM boe.amendment_note n JOIN boe.unit u ON u.law_id = n.law_id AND u.seq = n.unit_seq "
            f"WHERE n.law_id = {lit(law)} AND u.article_number = {art} AND NOT u.is_bis)")


def url(law):
    return f"(SELECT l.url FROM boe.law l WHERE l.id = {lit(law)})"


def vid(*p):
    return 'vf39-' + hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


PH = f"substring({note(MUR[0], 211)} from 'عبارة \"([^\"]+)\"')"
NEW211 = f"replace(a.content, '، ' || {PH}, '')"


def build(md5_211):
    st = []
    # حارس قبلي: نص م211 الحالي كما رُوجع، والعبارة في عجزه مرة واحدة، وملاحظات الإلغاء قائمة
    st.append(f"""SELECT CASE WHEN
  (SELECT md5(content) FROM legal_articles WHERE id = {lit(A211)}) = {lit(md5_211)}
  AND (SELECT content FROM legal_articles WHERE id = {lit(A211)}) LIKE '%، ' || {PH} || '.'
  AND (SELECT (length(content) - length(replace(content, {PH}, ''))) / length({PH}) FROM legal_articles WHERE id = {lit(A211)}) = 1
  AND {note(MUH[0], 25)} LIKE '%أُلغيت هذه المادة%م/191%'
  AND {note(MUR[0], 217)} LIKE '%أُلغيت هذه المادة%م/191%'
  AND {note(MUH[0], 24)} IS NULL
  AND (SELECT body FROM boe.unit WHERE law_id = {lit(CIVIL)} AND body LIKE '%يُعمل بهذا النظام بعد مضي (مائة وثمانين) يومًا من تاريخ نشره%') IS NOT NULL
  AND (SELECT published_gregorian FROM boe.law WHERE id = {lit(CIVIL)}) IS NOT NULL
  AND (SELECT "articleNumber" FROM legal_articles WHERE id = {lit(A25)}) = 25
  AND (SELECT "articleNumber" FROM legal_articles WHERE id = {lit(A24)}) = 24
  AND (SELECT "articleNumber" FROM legal_articles WHERE id = {lit(A217)}) = 217
  THEN 'ok' ELSE {GUARD_FAIL} END""")
    # «ملغاة» لـ م25 وم217
    for law, aid in ((MUH[0], A25), (MUR[0], A217)):
        art = 25 if aid == A25 else 217
        st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vid(aid, 'ملغاة'))}, 'unit', {lit(aid)}, 'ملغاة', {lit(INSTR)}, {url(law)}, {note(law, art)}, 'rule', {lit(BY)}, now(), NULL
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vid(aid, 'ملغاة'))})""")
    # م211: نسخة النص بعد إلغاء العبارة + تحقق «ساري» بنص الملاحظة
    uv = 'uv39-' + hashlib.sha256(f'{A211}|civil+180'.encode()).hexdigest()[:24]
    st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(uv)}, a.id, {NEW211}, {VALID_FROM}, {lit(INSTR)}, {url(MUR[0])}, {note(MUR[0], 211)}, now()
FROM legal_articles a WHERE a.id = {lit(A211)} AND md5(a.content) = {lit(md5_211)} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(uv)})""")
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vid(A211, 'ساري'))}, 'unit', {lit(A211)}, 'ساري', {lit(INSTR)}, {url(MUR[0])}, {note(MUR[0], 211)}, 'rule', {lit(BY)}, now(), NULL
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vid(A211, 'ساري'))})""")
    # م24: الإلغاء منسوب إليها خطأً — «ساري» بنص الأداة نفسه (تلغي الخامسة والعشرين)
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vid(A24, 'ساري'))}, 'unit', {lit(A24)}, 'ساري', {lit(INSTR)}, {url(MUH[0])}, aa.summary, 'manual', {lit(BY)}, now(), NULL
FROM article_amendments aa WHERE aa."articleId" = {lit(A24)} AND aa."changeType" = 'repealed' AND aa.summary LIKE '%المادة (الخامسة والعشرون) من نظام المحاماة%'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vid(A24, 'ساري'))})""")
    # حارس بعدي
    st.append(f"""SELECT CASE WHEN
  (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = 4
  AND (SELECT count(*) FROM unit_version WHERE unit_id = {lit(A211)}) = 1
  AND (SELECT body FROM unit_version WHERE unit_id = {lit(A211)}) LIKE '%تحت يد حائزه.'
  AND (SELECT length(a.content) - length(v.body) FROM legal_articles a JOIN unit_version v ON v.unit_id = a.id WHERE a.id = {lit(A211)}) = length({PH}) + 2
  THEN 'ok' ELSE {GUARD_FAIL} END""")
    return st


if __name__ == '__main__':
    import sys
    md5_211 = sys.argv[1]
    st = build(md5_211)
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5)
