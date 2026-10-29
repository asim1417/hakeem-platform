#!/usr/bin/env python3
"""gap017b (HKM-052، الصنف M2): تاريخ نفاذ صكوك قرار وزير العدل رقم (921) وتاريخ 1444/3/16هـ الثلاثة، بقرار المالك 29/10.

القرار، البند (رابعًا): «تنشر الضوابط والقواعد والأدلة الإجرائية المشار إليها في الجريدة الرسمية، ويعمل بها من تاريخ العمل بالنظام.»
نظام الإثبات (م/43 وتاريخ 1443/5/26هـ) نُشر 1443/6/4هـ (2022/1/7م)، ويعمل به بعد 180 يومًا ← 1443/12/7هـ (2022/7/6م).
والصكوك صدرت 1444/3/16هـ (2022/10/12م) ونُشرت في أم القرى 1444/4/3هـ (2022/10/28م).
اختلف القارئان (p: الحرفي 2022-07-06، q: النشر 2022-10-28)، فقرر المالك: «الحرفي 1443/12/7هـ» في خانة التاريخ، مع ذكر التاريخين معًا
في دليل الحالة وسجل المصدر. التحويلات بمكتبة hijri_converter (أم القرى).
الكتابة: preamble_effective_from حيث NULL، وlegal_text_provenance، وصف verification «ساري» جديد لكل صك (إضافة؛ آخر صف هو المعتمد).

    python3 batches/gap017b-decision921/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap017b-decision921-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
URL = 'https://www.uqn.gov.sa/details?p=20766'
EFF = '2022-07-06'
ITEMS = [('SD-03', 'cmr4rvmho008l1j0u71o24tkk', 'القواعد الخاصة بتنظيم شؤون الخبرة أمام المحاكم'),
         ('SD-13', 'cmr4rvlyy004t1j0ukew7yqg7', 'الأدلة الإجرائية لنظام الإثبات'),
         ('SD-17', 'cmr4rvlkz00441j0uj88pwjoe', 'ضوابط إجراءات الإثبات إلكترونياً')]
INS = ('قرار وزير العدل رقم (921) وتاريخ 1444/3/16هـ، البند (رابعًا): «يعمل بها من تاريخ العمل بالنظام» — من 2022-07-06 '
       '(1443/12/7هـ، نفاذ نظام الإثبات)؛ ونُشرت في أم القرى 1444/4/3هـ (2022/10/28م)')
QUOTE = ('البند (رابعًا) من قرار وزير العدل رقم (921) وتاريخ 1444/3/16هـ (2022/10/12م): «تنشر الضوابط والقواعد والأدلة الإجرائية المشار إليها في الجريدة الرسمية، '
         'ويعمل بها من تاريخ العمل بالنظام.»؛ ونظام الإثبات نُشر 1443/6/4هـ (2022/1/7م) ويعمل به بعد 180 يومًا ← 1443/12/7هـ (2022/7/6م)؛ '
         'ونُشرت هذه الصكوك في أم القرى 1444/4/3هـ (2022/10/28م). التاريخ المسجل هو الحرفي بقرار المالك 29/10، والتاريخان مذكوران معًا '
         '[قارئان مستقلان (p: 2022-07-06، q: 2022-10-28) وقرار المالك، HKM-052]')


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


ids = ','.join(lit(sid) for _, sid, _ in ITEMS)
st = [f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({ids}) AND preamble_effective_from IS NULL)=3"
      f" AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0 AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g17bp-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
st.append("INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id) VALUES\n" + ',\n'.join(
    f"({lit('vfg17b-' + h(BY, sid))}, 'work', {lit(sid)}, 'ساري', {lit(INS)}, {lit(URL)}, {lit(QUOTE)}, 'owner_decision', {lit(BY)}, NULL)" for _, sid, _ in ITEMS))
for _, sid, name in ITEMS:
    note = f"HKM-052 {BY}: {INS} — {QUOTE}"
    pid = 'g17bp-' + h(BY, sid)
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(sid)}, {lit(name)}, NULL, 'uqn', {lit(BY)}, {lit(URL)}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', {lit('effective_from_set:' + EFF)}, {lit(note)} "
              f"WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for _, sid, _ in ITEMS:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(EFF)}::timestamptz WHERE id = {lit(sid)} AND preamble_effective_from IS NULL")
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({ids}) AND preamble_effective_from::date={lit(EFF)}::date)=3"
          f" AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=3 AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g17bp-%')=3 THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'dates': 3, 'statuses': 3, 'new_articles': 0, 'changed_text': 0}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
