#!/usr/bin/env python3
"""gap025b (HKM-052): الدور الثاني من gap025 — 17 صكًّا عبارة نفاذها بنمط ثابت (extra_rules.py)، راجعها مراجع مستقل (verify_extra.jsonl).
يُكتب ما حكم فيه «ok» (14)، عدا نظام الإقامة المميزة: تاريخ نشره في البطاقة يوم سبت (1440/9/13) فيحتمل أن العدد صدر الجمعة قبله، فيُعلّق.
ويُعلّق «unsure» (3): نشرها في البطاقة = تاريخ صدورها في غير يوم جمعة.
"""
import hashlib, json
from pathlib import Path
D = Path(__file__).parent
BY = 'gap025b-fixed-patterns-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
SKIP = {'نظام الإقامة المميزة'}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


P = {x['id']: x for x in json.load(open(D / 'extra_plan.json', encoding='utf-8'))}
V = {}
for l in open(D / 'verify_extra.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l); V[v['id']] = v
rows = [P[i] for i, v in V.items() if v['verdict'] == 'ok' and v.get('effective_gregorian') == P[i]['new'] and P[i]['name'] not in SKIP]
chg = [r for r in rows if r['stored'] != r['new']]
st = [f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[chr(105) + chr(100)])})={lit(r[chr(115) + chr(116) + chr(111) + chr(114) + chr(101) + chr(100)])}::date' for r in rows)}"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g25bp-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
vals = []
for r in rows:
    act = ('effective_from_corrected:' + r['stored'] + '->' + r['new']) if r['stored'] != r['new'] else ('effective_from_confirmed:' + r['new'])
    note = (f"HKM-052 {BY}: {r['basis']} — «{r['quote'].strip()[:250]}»؛ بطاقة هيئة الخبراء = {r['new']}"
            + (f"؛ وكان المخزن {r['stored']}" if r['stored'] != r['new'] else '؛ وهو المخزن نفسه') + ' [مراجع مستقل]')
    vals.append(f"({lit('g25bp-' + h(BY, r['id']))}, 'system', {lit(r['id'])}, {lit(r['name'])}, NULL, 'boe', {lit(BY)}, {lit(r.get('url') or 'boe')}, "
                f"{lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-30', {lit(act)}, {lit(note)})")
st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) VALUES\n" + ',\n'.join(vals))
for r in chg:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['id'])} AND preamble_effective_from::date = {lit(r['stored'])}::date")
st.append(f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[chr(105) + chr(100)])})={lit(r[chr(110) + chr(101) + chr(119)])}::date' for r in rows)}"
          f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g25bp-%')={len(rows)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'documented': len(rows), 'corrected': len(chg), 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(name=r['name'], old=r['stored'], new=r['new']) for r in rows]}, 'statements': st},
          open(D / 'statements_extra.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'documented', len(rows), 'corrected', len(chg))
for r in rows: print(r['name'][:45], r['stored'], '->', r['new'])
