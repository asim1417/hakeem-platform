#!/usr/bin/env python3
"""gap020 (HKM-052): تصحيح تاريخ نسخ نصية سابقة (unit_version) أُرّخت بتاريخ صدور الأداة المعدِّلة لا بأول يوم نفاذها.

الدليل: عملية الطابور uqn_fix.amendment_op للأداة نفسها (من أم القرى) تحمل تاريخ النفاذ = تاريخ النشر
(«من تاريخ النشر — لم يُنص على مهلة في الأداة»، أي المادة 71 من النظام الأساسي)، والنسخة مؤرخة بتاريخ الصدور حرفيًا.
وأكد القارئ المستقل w (gap018) سبعًا من هذه الأدوات من أم القرى مباشرة (الجنسية م8، والتقاعد العسكري م23 وم28، والتحكيم م10،
والإجراءات الجزائية م25، والأحوال المدنية م16 وم67، والآثار م/67).
لا يُصحَّح ما يخلّ بترتيب نسخ المادة الواحدة أو يكرر تاريخًا (9 مواد فيها نسخ مكررة للأداة نفسها؛ تُترك لدفعة لاحقة).
الكتابة: UPDATE unit_version.valid_from محروس بالقيمة القديمة وبصمة النص، وصف legal_text_provenance لكل نسخة.
تفويض المالك 29/10: «نفذ كل شيء … ولا تنتظر موافقتي».

    python3 batches/gap020-redate-versions/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap020-redate-versions-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


V = {v['id']: v for v in json.load(open(D / 'versions.json', encoding='utf-8'))}
plan = [p for p in json.load(open(D / 'plan.json', encoding='utf-8'))['plan'] if p.get('url')]
g = []
for p in plan:
    v = V[p['id']]
    g.append(f"(SELECT count(*) FROM unit_version WHERE id={lit(p['id'])} AND valid_from::date={lit(p['old'])}::date AND md5(body)={lit(v['md5'])})=1")
st = [f"SELECT CASE WHEN {' AND '.join(g)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g20p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for p in plan:
    note = (f"HKM-052 {BY}: نسخة المادة ({p['id']}) بأداة «{p['ev']}» كانت مؤرخة بتاريخ صدور الأداة {p['old']}، والأداة ساكتة عن النفاذ "
            f"فتنفذ من نشرها (م71 من النظام الأساسي) = {p['new']} (عملية الطابور uqn_fix.amendment_op من أم القرى)")
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit('g20p-' + h(BY, p['id']))}, 'article', {lit(p['unit'])}, NULL, NULL, 'uqn', {lit(BY)}, {lit(p['url'])}, {lit(V[p['id']]['md5'])}, DATE '2026-10-29', "
              f"{lit('unit_version_redated:' + p['id'] + ':' + p['old'] + '->' + p['new'])}, {lit(note)}")
for p in plan:
    st.append(f"UPDATE unit_version SET valid_from = {lit(p['new'])}::timestamptz WHERE id = {lit(p['id'])} AND valid_from::date = {lit(p['old'])}::date AND md5(body) = {lit(V[p['id']]['md5'])}")
after = ' AND '.join(f"(SELECT valid_from::date FROM unit_version WHERE id={lit(p['id'])})={lit(p['new'])}::date" for p in plan)
units = sorted({p['unit'] for p in plan})
order = (f"(SELECT count(*) FROM (SELECT unit_id, valid_from::date d, count(*) c FROM unit_version WHERE unit_id IN ({','.join(lit(u) for u in units)}) GROUP BY 1,2 HAVING count(*)>1) z)=0")
st.append(f"SELECT CASE WHEN {after} AND {order} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g20p-%')={len(plan)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'redated': len(plan), 'units': len(units), 'new_articles': 0, 'changed_text': 0}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'redated', len(plan), 'units', len(units))
