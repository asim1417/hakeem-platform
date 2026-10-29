#!/usr/bin/env python3
"""gap027 (HKM-052): توثيق تاريخ نفاذ 125 صكًّا أُدخلت من أم القرى، بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية واكمل شي».

المدخل: plan.json (126 بندًا من plan.py، من قراءة قارئين مستقلين لصفحات أم القرى)، وverify.jsonl (مراجع مستقل فتح كل صفحة بنفسه وأعاد الحساب:
125 «ok» و1 «unsure» و0 «differs»).
يُكتب «ok» فقط والمحسوب = حساب المراجع: المحسوب = المخزن → صف مصدر (effective_from_confirmed)؛ يخالفه → تحديث محروس بالقيمة القديمة + صف مصدر.
يُعلّق: UQ-029 (النظام الأساس لشركة الصحة القابضة: ليس نظامًا بمرسوم، ولا عبارة نفاذ؛ النشر أم موافقة مجلس الوزراء؟ قرار للمالك)، و34 بندًا علّقها plan.py.
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap027-uqn-effective-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


P = json.load(open(D / 'plan.json', encoding='utf-8'))['plan']
V = {}
for l in open(D / 'verify.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l); V[v['item']] = v
rows = [p for p in P if V.get(p['item'], {}).get('verdict') == 'ok' and V[p['item']].get('effective_gregorian') == p['new']]
held = [dict(item=p['item'], name=p['name'], verdict=V.get(p['item'], {}).get('verdict')) for p in P if p not in rows]
chg = [r for r in rows if r['stored'] != r['new']]
assert all(r['stored'] for r in rows)
g_before = [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['id'])})={lit(r['stored'])}::date" for r in rows]
st = [f"SELECT CASE WHEN {' AND '.join(g_before)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g27p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
vals = []
for r in rows:
    act = ('effective_from_corrected:' + r['stored'] + '->' + r['new']) if r['stored'] != r['new'] else ('effective_from_confirmed:' + r['new'])
    note = (f"HKM-052 {BY}: {r['basis']}" + (f" — «{r['clause'].strip()[:250]}»" if r['clause'] else '')
            + f"؛ صفحة أم القرى المنشور فيها الصك ({r['page_pub_hijri']}هـ)؛ النفاذ = {r['new']}"
            + (f"؛ وكان المخزن {r['stored']}" if r['stored'] != r['new'] else '؛ وهو المخزن نفسه') + ' [قارئ مستقل + مراجع مستقل فتح الصفحة]')
    vals.append(f"({lit('g27p-' + h(BY, r['id']))}, 'system', {lit(r['id'])}, {lit(r['name'])}, NULL, 'uqn', {lit(BY)}, {lit(r['url'])}, "
                f"{lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-30', {lit(act)}, {lit(note)})")
st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) VALUES\n" + ',\n'.join(vals))
for r in chg:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['id'])} AND preamble_effective_from::date = {lit(r['stored'])}::date")
g_after = [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['id'])})={lit(r['new'])}::date" for r in rows]
st.append(f"SELECT CASE WHEN {' AND '.join(g_after)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g27p-%')={len(rows)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'documented': len(rows), 'confirmed': len(rows) - len(chg), 'corrected': len(chg),
           'held': held, 'new_articles': 0, 'changed_text': 0, 'plan': [dict(item=r['item'], name=r['name'], old=r['stored'], new=r['new']) for r in chg]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'documented', len(rows), 'corrected', len(chg), 'held', held)
for r in chg:
    print(r['item'], r['name'][:50], r['stored'], '->', r['new'], '|', r['basis'][:60])
