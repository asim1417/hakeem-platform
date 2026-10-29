#!/usr/bin/env python3
"""gap019 (HKM-052، الصنف M2b): تصحيح تاريخ النفاذ المخزن خطأً بتاريخ الصدور، والنص يجعل النفاذ بعد مدة من النشر.

المدخل computed.json: لكل نظام عبارة النفاذ من نصه، وتاريخ نشره في بطاقة هيئة الخبراء (boe.law.published_hijri).
يُكتب التاريخ إذا اجتمع:
  1. تاريخ النشر في بطاقة الهيئة = تاريخ النشر في نظما (مصدران مستقلان)؛
  2. المدة N مستخرجة من عبارة النفاذ نفسها (جملة «يعمل/ينفذ … بعد (N) يومًا من تاريخ نشره»)؛
  3. مراجع مستقل (verify.jsonl) حسبها بكوده فطابق: verdict = ok والتاريخ نفسه.
التاريخ = النشر الهجري محوّلًا بتقويم أم القرى (hijri_converter) + N يومًا (قاعدة HKM-024).
الكتابة: UPDATE legal_systems.preamble_effective_from محروس بالقيمة القديمة نفسها (لا يمس ما تغيّر بعد البناء)، وصف legal_text_provenance
بالقيمة السابقة لكل نظام. تفويض المالك 29/10: «نفذ كل شيء … ولا تنتظر موافقتي».

    python3 batches/gap019-effective-corrections/build.py
"""
import hashlib, json, sys
from pathlib import Path

D = Path(__file__).parent
V = D.parents[1] / 'readers' / 'readings' / 'effective_corrections' / 'verify.jsonl'
BY = 'gap019-effective-corrections-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


R = {r['sid']: r for r in json.load(open(D / 'computed.json', encoding='utf-8'))}
P = {x['item']: x for x in json.load(open(D / 'verify_packet.json', encoding='utf-8'))['items']}
ver = {}
for l in open(V, encoding='utf-8'):
    if l.strip():
        v = json.loads(l)
        ver[v['item']] = v
ok, dropped = [], []
for item, p in P.items():
    r = R[p['system_id']]
    v = ver.get(item, {})
    if v.get('verdict') == 'ok' and v.get('effective_gregorian') == r['eff'] and r['nz_pub_agree'] is True and r['stored']:
        ok.append(r)
    else:
        dropped.append({'item': item, 'name': r['name'], 'ours': r.get('eff'), 'verifier': v.get('effective_gregorian'), 'verdict': v.get('verdict'), 'notes': (v.get('notes') or '')[:200]})
ids = ','.join(lit(r['sid']) for r in ok)
old_ok = ' AND '.join(f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['sid'])})={lit(r['stored'])}::date" for r in ok)
st = [f"SELECT CASE WHEN {old_ok} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for r in ok:
    note = (f"HKM-052 {BY}: عبارة النفاذ: «{r['clause'].strip()}» — النشر {r['pub_h']}هـ (بطاقة هيئة الخبراء، ويطابقها نظما) = {r['pub_g_calc']} + {r['N']} يومًا = {r['eff']}؛ "
            f"وكان المخزن {r['stored']} (تاريخ الصدور {r['issued_h']}هـ) [مراجع مستقل متفق]")
    pid = 'g19p-' + h(BY, r['sid'])
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(r['sid'])}, {lit(r['name'])}, NULL, 'boe', {lit(BY)}, NULL, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
              f"{lit('effective_from_corrected:' + r['stored'] + '->' + r['eff'])}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for r in ok:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['eff'])}::timestamptz WHERE id = {lit(r['sid'])} AND preamble_effective_from::date = {lit(r['stored'])}::date")
new_ok = ' AND '.join(f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['sid'])})={lit(r['eff'])}::date" for r in ok)
st.append(f"SELECT CASE WHEN {new_ok} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19p-%')={len(ok)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {},
           'report': {'corrected': len(ok), 'new_articles': 0, 'changed_text': 0, 'dropped': dropped,
                      'plan': [dict(name=r['name'], old=r['stored'], new=r['eff'], days=r['N']) for r in ok]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'corrected', len(ok), 'dropped', len(dropped))
