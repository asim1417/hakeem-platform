#!/usr/bin/env python3
"""gap025 (HKM-052): توثيق تاريخ النفاذ لكل نظام بلا مصدر، بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية واكمل شي».

المدخل: verify_packet.json (221 بندًا صنّفها classify.py من بطاقة هيئة الخبراء أو صفحة أم القرى، وعبارة النفاذ من النص الساري أو أداة الإصدار)،
وverify.jsonl (مراجع مستقل قرأ النص الساري وأداة الإصدار لكل بند، وفتح 29 صفحة من أم القرى، وأعاد الحساب).
يُكتب:
  - «ok» والمحسوب = المخزن: صف legal_text_provenance فقط (effective_from_confirmed) يوثق التاريخ القائم ومصدره، فيُعرض في الصفحة (HKM-063).
  - «ok» والمحسوب يخالف المخزن: تحديث محروس بالقيمة القديمة + صف المصدر.
  - «differs» حيث قرأ المراجع عبارة صريحة فاتت الباني أو تاريخًا رسميًا معلنًا (ACCEPT أدناه): تاريخ المراجع، بنصه في الدليل.
ويبقى معلّقًا: «unsure» (منها 41 بطاقة تاريخ نشرها = تاريخ صدورها، ونفاذ معلّق على تصديق دول الخليج أو على النشر في موقع الجهة)، وCA-136.
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap025-confirm-all-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
ACCEPT = {  # البند: سبب اعتماد تاريخ المراجع
    'CA-140': 'م391 «(ي)عمل بالنظام بعد مائة وثمانين يوماً من تاريخ نشره» (سقطت الياء في النص المخزن)',
    'CA-171': 'م36 «ويكون نافذاً بعد (مائة وثمانين) يوماً من تاريخ نشره»؛ والنشر مؤكد في أم القرى details?p=18475',
    'CA-179': 'م30 «ويعد نافذاً بعد ثلاثين يوماً من تاريخ نشره»',
    'CA-184': 'م81 «ويطبق بعد مائة وعشرين يومًا من تاريخ نشره»',
    'CA-206': 'أعلنت الهيئة العامة للعقار بدء النفاذ «ابتداءً من اليوم 3 شعبان 1447هـ الموافق 22 يناير 2026م»',
    'CA-219': 'المرسوم الملكي، رابعًا: «يسري نظام الخدمة المدنية اعتبارا من 1/8/1397هـ»',
}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


P = {x['item']: x for x in json.load(open(D / 'verify_packet.json', encoding='utf-8'))['items']}
V = {}
for l in open(D / 'verify.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l)
        V[v['item']] = v
rows, held = [], []
for item, p in sorted(P.items()):
    v = V.get(item, {})
    if v.get('verdict') == 'ok' and v.get('effective_gregorian') == p['new']:
        new, basis = p['new'], p['basis']
    elif v.get('verdict') == 'differs' and item in ACCEPT and v.get('effective_gregorian'):
        new, basis = v['effective_gregorian'], ACCEPT[item]
    else:
        held.append(dict(item=item, name=p['name'], verdict=v.get('verdict'), notes=(v.get('notes') or '')[:200]))
        continue
    rows.append(dict(item=item, sid=p['id'], name=p['name'], old=p['stored'], new=new, basis=basis, src=p['src'] or 'boe', url=p.get('url') or 'boe',
                     quote=(p.get('quote') or '').strip()[:300], change=(p['stored'] != new)))
chg = [r for r in rows if r['change']]
g_before = [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['sid'])})={lit(r['old'])}::date" if r['old']
            else f"(SELECT count(*) FROM legal_systems WHERE id={lit(r['sid'])} AND preamble_effective_from IS NULL)=1" for r in rows]
st = [f"SELECT CASE WHEN {' AND '.join(g_before)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g25p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
vals = []
for r in rows:
    act = ('effective_from_corrected:' + (r['old'] or 'null') + '->' + r['new']) if r['change'] else ('effective_from_confirmed:' + r['new'])
    note = (f"HKM-052 {BY}: {r['basis']}" + (f" — «{r['quote']}»" if r['quote'] and r['item'] not in ACCEPT else '')
            + f"؛ المصدر الرسمي للنشر: {'بطاقة هيئة الخبراء' if r['src'] == 'boe' else 'صفحة أم القرى'} = {r['new']}"
            + (f"؛ وكان المخزن {r['old']}" if r['change'] else '؛ وهو المخزن نفسه') + " [مراجع مستقل قرأ النص الساري وأداة الإصدار]")
    vals.append(f"({lit('g25p-' + h(BY, r['sid']))}, 'system', {lit(r['sid'])}, {lit(r['name'])}, NULL, {lit(r['src'])}, {lit(BY)}, {lit(r['url'])}, "
                f"{lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-30', {lit(act)}, {lit(note)})")
st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) VALUES\n" + ',\n'.join(vals))
for r in chg:
    if r['old']:
        st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['sid'])} AND preamble_effective_from::date = {lit(r['old'])}::date")
    else:
        st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['sid'])} AND preamble_effective_from IS NULL")
g_after = [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r['sid'])})={lit(r['new'])}::date" for r in rows]
st.append(f"SELECT CASE WHEN {' AND '.join(g_after)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g25p-%')={len(rows)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'documented': len(rows), 'confirmed': len(rows) - len(chg), 'corrected': len(chg),
           'held': held, 'new_articles': 0, 'changed_text': 0, 'plan': [dict(item=r['item'], name=r['name'], old=r['old'], new=r['new']) for r in chg]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'documented', len(rows), 'corrected', len(chg), 'held', len(held))
for r in chg:
    print(r['item'], r['name'][:40], r['old'], '->', r['new'])
