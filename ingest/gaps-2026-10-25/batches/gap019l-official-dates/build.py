#!/usr/bin/env python3
"""gap019l (HKM-052): تواريخ نفاذ أعلنتها الجهة المختصة نصًا، بعد حكم القياس المستقل 29/10 على gap019j وgap021.

على نهج gap019k (نظام الشركات): التاريخ الذي أعلنته الجهة الرسمية المختصة نصًا يُعتمد بدل الحساب (النشر + المدة)، ويُذكر الحساب في الدليل.
1. نظام المنافسات والمشتريات الحكومية 1440: وزارة المالية (الأسئلة الشائعة الرسمية): «فقد نفذ النظام بتاريخ 1441/4/4هـ (الأول من ديسمبر 2019م)».
   والمخزن 2019-11-29 (نشر الهيئة 1440/11/29 + 120 يومًا).
2. نظاما الأسماء التجارية والسجل التجاري (م/83 لعام 1446): «أعلنت وزارة التجارة عن بدء تطبيق نظامي السجل التجاري والأسماء التجارية الجديدين
   اعتبارًا من يوم الخميس الموافق 3 ابريل» 2025. وفي حكيم ثلاثة سجلات: سجل الأسماء التجارية المخلوط (2025-04-02 من gap021)،
   وإصداراه الجديدان للنظامين (2024-10-04، وهو تاريخ النشر لا النفاذ).
الكتابة محروسة بالقيمة القديمة، وصف legal_text_provenance لكل سجل. تفويض المالك 29/10.
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap019l-official-dates-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
MOF = 'https://mof.gov.sa/Knowledgecenter/newGovTendandProcLow/Documents/FAQ.pdf'
MOC = 'https://www.eyeofriyadh.com/ar/news/details/new-commercial-register-trade-names-laws-effective-as-of-april-3'
Q_MOF = '«فقد نفذ النظام بتاريخ 1441/4/4هـ (الأول من ديسمبر 2019م)» (وزارة المالية، الأسئلة الشائعة عن النظام)'
Q_MOC = '«أعلنت وزارة التجارة عن بدء تطبيق نظامي السجل التجاري والأسماء التجارية الجديدين اعتبارًا من يوم الخميس الموافق 3 ابريل» 2025'
ROWS = [
    ('cmpz5pp91003xcwg2wx5rgsnx', 'نظام المنافسات و المشتريات الحكومية', '2019-11-29', '2019-12-01', MOF, Q_MOF, 'النشر 1440/11/29هـ في بطاقة الهيئة + 120 يومًا = 2019-11-29'),
    ('cmpz5phhp002ucwg2v6b7zln6', 'نظام الأسماء التجارية', '2025-04-02', '2025-04-03', MOC, Q_MOC, 'النشر 1446/04/01هـ (أم القرى) + 180 يومًا = 2025-04-02'),
    ('ed25-fc1bd01b88ecdf6cbcf1e250', 'نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ', '2024-10-04', '2025-04-03', MOC, Q_MOC, 'المخزن تاريخ النشر 1446/04/01هـ، والنص «بعد (مائة وثمانين) يومًا من تاريخ نشره»'),
    ('ed25-71b37d1ec31a497747ed643c', 'نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ', '2024-10-04', '2025-04-03', MOC, Q_MOC, 'المخزن تاريخ النشر 1446/04/01هـ، والنفاذ بعد مائة وثمانين يومًا من النشر'),
]


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


st = [f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[0])})={lit(r[2])}::date' for r in ROWS)}"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19lp-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for sid, name, old, new, url, q, calc in ROWS:
    note = f"HKM-052 {BY}: الجهة المختصة أعلنت النفاذ نصًا: {q}. {calc}؛ والمعتمد التاريخ الرسمي المعلن {new}؛ وكان المخزن {old} [قياس مستقل 29/10، تفويض المالك]"
    pid = 'g19lp-' + hashlib.sha256(f'{BY}|{sid}'.encode()).hexdigest()[:24]
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(sid)}, {lit(name)}, NULL, 'official', {lit(BY)}, {lit(url)}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
              f"{lit('effective_from_corrected:' + old + '->' + new)}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for sid, name, old, new, *_ in ROWS:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(new)}::timestamptz WHERE id = {lit(sid)} AND preamble_effective_from::date = {lit(old)}::date")
st.append(f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[0])})={lit(r[3])}::date' for r in ROWS)}"
          f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19lp-%')={len(ROWS)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'corrected': len(ROWS), 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(name=r[1], old=r[2], new=r[3]) for r in ROWS]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
