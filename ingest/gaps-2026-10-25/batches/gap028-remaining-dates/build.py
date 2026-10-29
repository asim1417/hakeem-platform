#!/usr/bin/env python3
"""gap028 (HKM-052): توثيق تاريخ النفاذ لما بقي بلا مصدر، بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية واكمل شي».

المدخل: plan.json (63 بندًا من plan.py عن قراءة ثلاثة قراء مستقلين)، وverify.jsonl (مراجع مستقل أعاد قراءة العبارة والنشر لكل بند: 61 ok، 1 differs، 1 unsure).
يُكتب «ok» والمحسوب = المخزن: صف مصدر (effective_from_confirmed)؛ ويخالفه: تحديث محروس بالقيمة القديمة + صف مصدر.
تعارض بطاقة هيئة الخبراء وأم القرى (boe_live.json، قُرئت حيّة في كروم 30/10):
  R-020: بطاقة الهيئة 1445/05/10 = 2023-11-24، وأكدها المراجع (صفحة أم القرى p=24103 مؤرخة بأثر رجعي ونُشرت مع p=24104 في 1445/5/10، وخبر الاقتصادية 2023-11-24) ← 2023-11-24.
  R-085: بطاقة الهيئة 1444/05/29 (العدد 4962) وأم القرى نشرته إلكترونيًا 1444/05/26؛ يُقدَّم تاريخ الهيئة بترتيب المالك للمصادر ← 2022-12-23.
يُعلّق: R-010 (الهيئة 1446/08/15 والمخزن مثلها، وأم القرى 1446/04/24 للتنظيم نفسه — قرار للمالك)، R-035 (الهيئة 1440/09/13 سبت، ونظما 1440/09/19 جمعة)، R-145 (نظما خميس).
"""
import hashlib, json
from pathlib import Path
D = Path(__file__).parent
BY = 'gap028-remaining-dates-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
OVERRIDE = {'R-020': ('2023-11-24', 'بطاقة هيئة الخبراء: النشر 1445/05/10هـ = 2023-11-24 (قُرئت حيّة 30/10)، وأكدها المراجع: صفحة أم القرى p=24103 نُشرت مع p=24104 في 1445/5/10، وخبر الاقتصادية 24/11/2023؛ «يعمل به من تاريخ نشره»'),
            'R-085': ('2022-12-23', 'بطاقة هيئة الخبراء: النشر 1444/05/29هـ = 2022-12-23، العدد 4962 (قُرئت حيّة 30/10)؛ ونشرته أم القرى إلكترونيًا 1444/05/26؛ يُقدَّم تاريخ الهيئة بترتيب المالك للمصادر؛ «من تاريخ النشر»')}
HOLD = {'R-010': 'تعارض: بطاقة الهيئة 1446/08/15 (= المخزن 2025-02-14) وأم القرى نشرت التنظيم نفسه 1446/04/24 (2024-10-27) — قرار للمالك',
        'R-035': 'تعارض: بطاقة الهيئة 1440/09/13 (سبت) ونظما 1440/09/19 (جمعة)',
        'R-145': 'نشر نظما خميس 1433/11/25؛ الأرجح العدد التالي'}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


P = {x['item']: x for x in json.load(open(D / 'plan.json', encoding='utf-8'))['plan']}
K = {x['item']: x for x in json.load(open(D / 'packet.json', encoding='utf-8'))['items']}
V = {}
for l in open(D / 'verify.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l); V[v['item']] = v
rows, held = [], []
for item, p in sorted(P.items()):
    v = V.get(item, {})
    if item in HOLD:
        held.append(dict(item=item, name=p['name'], why=HOLD[item])); continue
    if item in OVERRIDE:
        new, basis = OVERRIDE[item]
    elif v.get('verdict') == 'ok' and v.get('effective_gregorian') == p['new']:
        new, basis = p['new'], p['basis'] + (f" — «{p['clause'].strip()[:220]}»" if p['clause'] else '')
    else:
        held.append(dict(item=item, name=p['name'], why=f"المراجع: {v.get('verdict')}")); continue
    src = 'uqn' if p['pub_source'] == 'uqn' else ('boe' if item in OVERRIDE else 'nezams' if p['pub_source'] == 'nezams' else 'official')
    rows.append(dict(item=item, sid=p['id'], name=p['name'], old=p['stored'], new=new, basis=basis, src=src, url=(K[item]['boe_url'] if item in OVERRIDE else p.get('pub_url')) or 'nezams',
                     pub=p['pub_hijri'], change=p['stored'] != new))
chg = [r for r in rows if r['change']]
assert all(r['old'] for r in rows)
g_before = [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['sid'])})={lit(r['old'])}::date" for r in rows]
st = [f"SELECT CASE WHEN {' AND '.join(g_before)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g28p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
vals = []
SRC = {'uqn': 'صفحة أم القرى', 'boe': 'بطاقة هيئة الخبراء', 'nezams': 'نظما (مصدر معتمد ما لم يخالفه الأعلى)', 'official': 'نسخة رسمية'}
for r in rows:
    act = ('effective_from_corrected:' + r['old'] + '->' + r['new']) if r['change'] else ('effective_from_confirmed:' + r['new'])
    note = (f"HKM-052 {BY}: {r['basis']}؛ النشر {r['pub'] or ''}هـ من {SRC[r['src']]}؛ النفاذ = {r['new']}"
            + (f"؛ وكان المخزن {r['old']}" if r['change'] else '؛ وهو المخزن نفسه') + ' [قارئ مستقل + مراجع مستقل]')
    vals.append(f"({lit('g28p-' + h(BY, r['sid']))}, 'system', {lit(r['sid'])}, {lit(r['name'])}, NULL, {lit(r['src'])}, {lit(BY)}, {lit(r['url'])}, "
                f"{lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-30', {lit(act)}, {lit(note)})")
st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) VALUES\n" + ',\n'.join(vals))
for r in chg:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['sid'])} AND preamble_effective_from::date = {lit(r['old'])}::date")
g_after = [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['sid'])})={lit(r['new'])}::date" for r in rows]
st.append(f"SELECT CASE WHEN {' AND '.join(g_after)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g28p-%')={len(rows)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'documented': len(rows), 'confirmed': len(rows) - len(chg), 'corrected': len(chg),
           'held': held, 'new_articles': 0, 'changed_text': 0, 'plan': [dict(item=r['item'], name=r['name'], old=r['old'], new=r['new']) for r in chg]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'documented', len(rows), 'corrected', len(chg), 'held', len(held))
