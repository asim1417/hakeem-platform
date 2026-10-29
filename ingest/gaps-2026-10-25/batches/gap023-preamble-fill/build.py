#!/usr/bin/env python3
"""gap023 (HKM-052): ديباجات الأنظمة التي تعرض للمستخدم تاريخ صدور نائبًا، ونظامان بلا نص.

1. 78 نظامًا ديباجتها في حكيم سطر الأداة وحده ثم «تاريخ الإصدار (هجريّ): yyyy-01-01». هذا التاريخ نائب نقلته لقطة هيئة الخبراء
   (أول محرم حين لا تعرف التاريخ)، وسطر الأداة فوقه في الديباجة نفسها يذكر التاريخ الحقيقي («أمر ملكي رقم أ/212 بتاريخ 27 / 9 / 1420»).
   يُستبدل سطرا التاريخ بتاريخ الأداة الأولى في ذلك السطر، محوّلًا بتقويم أم القرى. لا يُمس غير السطرين.
   يُستثنى ما لا تاريخ في سطر أداته، أو سنة أداته تخالف السنة النائبة (أداته تعديل لاحق)، أو تاريخه الحقيقي أول محرم (مكافحة التستر 1442/1/1).
2. تنظيم المجلس الأعلى لشؤون البترول والمعادن، ونظام رسوم وأجور خدمات الموانئ: لا مواد لهما في حكيم ولا في الهيئة،
   ونصهما في كتل نص الهيئة (boe.text_block): الأمر الملكي (أ/212) ببنوده وتعديلاه، والمرسوم (م/42) ببنوده. يُلحق النص بالديباجة كما هو
   بعد حذف وصف الهيئة الموجز («يتضمن التنظيم: …») الذي ليس من النص.
الكتابة: تحديث الديباجة محروس ببصمتها القديمة (نمط جديد في apply-statements.py)، وصف legal_text_provenance بالنص السابق كاملًا.
لا يُمس تاريخ النفاذ هنا (gap021 بقارئين).

    python3 batches/gap023-preamble-fill/build.py
"""
import hashlib, json, re, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = Path(__file__).parent
BY = 'gap023-preamble-fill-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
HEAD = re.compile(r'^أداة الإصدار:\n([^\n]+)\nتاريخ الإصدار \(هجريّ\): (\d{4})-01-01\nتاريخ الإصدار \(ميلاديّ\): (\d{4}-\d{2}-\d{2})')
D1 = re.compile(r'(?:بتاريخ|وتاريخ)\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})')
D2 = re.compile(r'(?:بتاريخ|وتاريخ)\s*(\d{4})-(\d{2})-(\d{2})')
J = json.load(open(D / 'placeholder_preambles.json', encoding='utf-8'))
SRC = json.load(open(D / 'source.json', encoding='utf-8'))
PK = {r['id']: r for r in json.load(open(D.parent / 'gap021-placeholder-dates' / 'packet.json', encoding='utf-8'))['items']}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def boe_text(sid):
    """نص الهيئة للنظامين الفارغين: من «بعون الله تعالى» في الكتلة الأولى، ثم بقية الكتل (عدا العنوان والبسملة المكررة) كما هي."""
    parts = []
    for b in SRC[sid]['blocks']:
        body = b['body'].replace('\xa0', ' ')
        if b['kind'] == 'title':
            continue
        if b['kind'] == 'preamble_other' and not parts:
            i = body.index('بعون الله تعالى')
            body = body[i:]
        lines = [l.rstrip() for l in body.split('\n')]
        txt = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
        if txt:
            parts.append(txt)
    return '\n\n'.join(parts)


plan, skipped = [], []
for r in J:
    old = r['pre']
    m = HEAD.match(old or '')
    if not m:
        skipped.append((r['id'], r['name'], 'no_head'))
        continue
    line = m.group(1)
    found = [x for x in (D1.search(line), D2.search(line)) if x]
    if not found:
        skipped.append((r['id'], r['name'], 'no_date_in_instrument'))
        continue
    x = min(found, key=lambda t: t.start())
    dd, mm, yy = map(int, x.groups()) if x.re is D1 else map(int, reversed(x.groups()))
    if yy != int(m.group(2)):
        skipped.append((r['id'], r['name'], f'year_differs:{yy}!={m.group(2)}'))
        continue
    if (mm, dd) == (1, 1):
        skipped.append((r['id'], r['name'], 'real_1_muharram'))
        continue
    g = Hijri(yy, mm, dd).to_gregorian().isoformat()
    head_new = f"أداة الإصدار:\n{line}\nتاريخ الإصدار (هجريّ): {yy}-{mm:02d}-{dd:02d}\nتاريخ الإصدار (ميلاديّ): {g}"
    new = head_new + old[m.end():]
    action = f"preamble_issue_date_corrected:{m.group(2)}-01-01->{yy}-{mm:02d}-{dd:02d}"
    if r['id'] in SRC:
        assert old[m.end():].strip() == '', r['id']
        new = head_new + '\n\n' + boe_text(r['id'])
        action += '+text:boe.text_block'
    url = (SRC.get(r['id']) or {}).get('url') or ((PK.get(r['id']) or {}).get('boe') or [{}])[0].get('url') or 'hakeem:legal_systems.preamble'
    plan.append(dict(sid=r['id'], name=r['name'], old=old, old_md5=r['md5'], new=new, action=action, url=url, issue=f'{yy}-{mm:02d}-{dd:02d}'))
    assert md5(old) == r['md5'] and new != old

st = [f"SELECT CASE WHEN {' AND '.join('(SELECT md5(coalesce(preamble, ' + chr(39) * 2 + ')) FROM legal_systems WHERE id=' + lit(p['sid']) + ')=' + lit(p['old_md5']) for p in plan)}"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g23p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for p in plan:
    note = (f"HKM-052 {BY}: تاريخ الإصدار في الديباجة كان نائبًا من لقطة الهيئة، وصُحح إلى تاريخ الأداة في سطر الأداة نفسه ({p['issue']})"
            + ("؛ وأُلحق نص الأمر/المرسوم من كتل نص الهيئة" if p['sid'] in SRC else '') + ". النص السابق كاملًا في previous_text")
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit('g23p-' + h(BY, p['sid']))}, 'system', {lit(p['sid'])}, {lit(p['name'])}, NULL, 'boe', {lit(BY)}, {lit(p['url'])}, {lit(md5(p['new']))}, DATE '2026-10-29', "
              f"{lit(p['action'])}, {lit(p['old'])} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit('g23p-' + h(BY, p['sid']))})")
for p in plan:
    st.append(f"UPDATE legal_systems SET preamble = {lit(p['new'])}, preamble_updated_at = now() WHERE id = {lit(p['sid'])} AND md5(coalesce(preamble, '')) = {lit(p['old_md5'])}")
st.append(f"SELECT CASE WHEN {' AND '.join('(SELECT md5(preamble) FROM legal_systems WHERE id=' + lit(p['sid']) + ')=' + lit(md5(p['new'])) for p in plan)}"
          f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g23p-%')={len(plan)} THEN 'ok' ELSE {FAIL} END AS guard_after")
m5 = md5('\n'.join(st))
json.dump({'by': BY, 'md5': m5, 'count': len(st), 'expect_delta': {}, 'report': {'preambles': len(plan), 'with_text': sum(p['sid'] in SRC for p in plan),
           'new_articles': 0, 'changed_text': 0, 'skipped': skipped, 'plan': [dict(name=p['name'], issue=p['issue'], action=p['action']) for p in plan]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(m5, len(st), 'preambles', len(plan), 'skipped', skipped)
for p in plan:
    if p['sid'] in SRC:
        print('----', p['name']); print(p['new'][:900]); print('...'); print(p['new'][-400:])
