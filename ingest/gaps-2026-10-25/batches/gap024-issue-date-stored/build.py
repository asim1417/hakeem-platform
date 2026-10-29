#!/usr/bin/env python3
"""gap024 (HKM-052، صنف جديد M2d): تاريخ النفاذ المخزن = تاريخ الصدور، والنص يجعل النفاذ من النشر أو بعد مدة منه.

وجده عرض HKM-063 (المراجعة المستقلة 29/10): 962 تاريخ نفاذ بلا مصدر، منها 263 = تاريخ الصدور. وفاتت هذه M2b لأمرين:
عبارة «يُعمل» بالتشكيل لا تطابق «يعمل»، و«يعمل به من تاريخ نشره» بلا «بعد» خارج نمطها. منها أنظمة أساسية:
المعاملات المدنية، والإجراءات الجزائية، والمرافعات الشرعية، والمرافعات أمام ديوان المظالم.
المدخل candidates.json (قراءة من الإنتاج): المخزن = صدور بطاقة الهيئة، والنشر في البطاقة بعده وليس نائبًا (لا yyyy/01/01، ولا 1440/03/21 لما قبل 1440)،
وعبارة النفاذ من آخر مادة تذكره (بعد حذف التشكيل)، ولا مصدر سابق لتاريخ نفاذه.
يُكتب إذا: (1) فُهمت المدة من العبارة (أو «من تاريخ نشره»)، (2) النشر بعد الصدور بيوم إلى 120 يومًا، (3) طابق مراجع مستقل الحساب (verify.jsonl).
الحساب: قاعدة HKM-024 (النشر + المدة؛ الأيام ميلادية والأشهر والسنون هجرية بتقويم أم القرى)، كما في gap019 وgap021.
تفويض المالك 29/10: «انهي لي كل ما يتعلق بقاعدة الانظمة … ولاترجع لي».

    python3 batches/gap024-issue-date-stored/build.py            # الخطة (plan.json) للمراجع
    python3 batches/gap024-issue-date-stored/build.py --final    # العبارات بعد verify.jsonl
"""
import datetime, hashlib, json, re, sys, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = Path(__file__).parent
BY = 'gap024-issue-date-stored-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
TASH = re.compile('[ً-ْـ]')
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
WORDS = {'عشرة': 10, 'عشر': 10, 'خمسة عشر': 15, 'عشرين': 20, 'ثلاثين': 30, 'خمسة وأربعين': 45, 'خمسة واربعين': 45, 'ستين': 60, 'تسعين': 90,
         'مائة وعشرين': 120, 'مئة وعشرين': 120, 'مائة وخمسين': 150, 'مائة وثمانين': 180, 'مئة وثمانين': 180, 'مائة وثمانيين': 180,
         'ثلاثمائة وستين': 360, 'ثلاثمائة وخمسة وستين': 365}
MONTHS = {'شهر': 1, 'شهرين': 2, 'ثلاثة أشهر': 3, 'ثلاثة اشهر': 3, 'أربعة أشهر': 4, 'ستة أشهر': 6, 'ستة اشهر': 6, 'تسعة أشهر': 9,
          'ثمانية عشر شهرا': 18, 'ثمانية عشر شهراً': 18, 'اثني عشر شهرا': 12}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def hij(s):
    n = [int(x) for x in re.findall(r'\d+', (s or '').translate(AR))][:3]
    return tuple(n) if len(n) == 3 and n[0] > 1300 else None


def g(t):
    return Hijri(*t).to_gregorian()


def add_months(t, n):
    y, m, d = t
    m0 = m - 1 + n
    y, m = y + m0 // 12, m0 % 12 + 1
    try:
        return Hijri(y, m, d).to_gregorian()
    except ValueError:
        return Hijri(y, m, 29).to_gregorian()


def period(clause):
    """('pub', 0, 'days') أو ('pub', N, 'days'|'months'|'years') أو None إن لم تُفهم."""
    t = TASH.sub('', clause).translate(AR).replace('(', ' ').replace(')', ' ')
    t = re.sub(r'\s+', ' ', t)
    m = re.search(r'(?:يعمل|ينفذ|يسري)[^.]{0,60}?بعد (?:مضي |انقضاء )?(.{1,40}?) من (?:تاريخ )?نشر', t)
    if not m:
        return ('pub', 0, 'days') if re.search(r'(?:يعمل|ينفذ|يسري)[^.]{0,60}(?:من تاريخ نشر|من نشر|اعتبارا من تاريخ نشر)', t) else None
    p = m.group(1).strip()
    if re.fullmatch(r'سنة(?: واحدة)?', p) or p == 'عام':
        return ('pub', 1, 'years')
    if p in ('سنتين', 'عامين'):
        return ('pub', 2, 'years')
    for w, n in sorted(MONTHS.items(), key=lambda kv: -len(kv[0])):
        if p == w:
            return ('pub', n, 'months')
    md = re.fullmatch(r'(\d+) (?:يوما|يوم|أيام)', p)
    if md:
        return ('pub', int(md.group(1)), 'days')
    mw = re.fullmatch(r'(.+?) (?:يوما|يوم)', p)
    if mw and mw.group(1) in WORDS:
        return ('pub', WORDS[mw.group(1)], 'days')
    return None


C = json.load(open(D / 'candidates.json', encoding='utf-8'))
plan, held = [], []
for x in C:
    pr = period(x['clause'])
    ih, ph = hij(x['ih']), hij(x['ph'])
    if not pr:
        held.append(dict(id=x['id'], name=x['name'], why='مدة غير مفهومة: ' + x['seg'][:120]))
        continue
    gap = (g(ph) - g(ih)).days
    if not (1 <= gap <= 120):
        held.append(dict(id=x['id'], name=x['name'], why=f'النشر بعد الصدور بـ{gap} يومًا (خارج 1–120)'))
        continue
    _, n, unit = pr
    eff = g(ph) + datetime.timedelta(days=n) if unit == 'days' else add_months(ph, n if unit == 'months' else 12 * n)
    assert eff.isoformat() > x['eff'][:10], x['name']
    plan.append(dict(item=f"ID-{len(plan) + 1:03d}", sid=x['id'], name=x['name'], old=x['eff'][:10], issued_hijri=x['ih'], published_hijri=x['ph'],
                     n=n, unit=unit, new=eff.isoformat(), clause=x['seg'].strip(), url=x['url']))
json.dump({'plan': plan, 'held': held}, open(D / 'plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('plan', len(plan), 'held', len(held))
for x in held:
    print('HOLD', x['name'][:45], '|', x['why'][:100])
if '--final' not in sys.argv:
    sys.exit(0)

V = {}
for l in open(D / 'verify.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l)
        V[v['item']] = v
ok = [p for p in plan if V.get(p['item'], {}).get('verdict') == 'ok' and V[p['item']].get('effective_gregorian') == p['new']]
dropped = [dict(item=p['item'], name=p['name'], ours=p['new'], verifier=V.get(p['item'], {}).get('effective_gregorian'), notes=(V.get(p['item'], {}).get('notes') or '')[:200])
           for p in plan if p not in ok]
U = {'days': 'يومًا', 'months': 'أشهر هجرية', 'years': 'سنة هجرية'}
st = [f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(p[chr(115) + chr(105) + chr(100)])})={lit(p[chr(111) + chr(108) + chr(100)])}::date' for p in ok)}"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g24p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for p in ok:
    rule = 'من تاريخ النشر' if p['n'] == 0 else f"النشر + {p['n']} {U[p['unit']]}"
    note = (f"HKM-052 {BY}: كان المخزن {p['old']} وهو تاريخ الصدور ({p['issued_hijri']}هـ). عبارة النفاذ: «{p['clause']}» — "
            f"النشر {p['published_hijri']}هـ (بطاقة هيئة الخبراء) ، {rule} = {p['new']} [مراجع مستقل متفق؛ قاعدة HKM-024]")
    pid = 'g24p-' + h(BY, p['sid'])
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(p['sid'])}, {lit(p['name'])}, NULL, 'boe', {lit(BY)}, {lit(p['url'] or 'boe')}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
              f"{lit('effective_from_corrected:' + p['old'] + '->' + p['new'])}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for p in ok:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(p['new'])}::timestamptz WHERE id = {lit(p['sid'])} AND preamble_effective_from::date = {lit(p['old'])}::date")
st.append(f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(p[chr(115) + chr(105) + chr(100)])})={lit(p[chr(110) + chr(101) + chr(119)])}::date' for p in ok)}"
          f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g24p-%')={len(ok)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'corrected': len(ok), 'dropped': dropped, 'held': held, 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(name=p['name'], old=p['old'], new=p['new']) for p in ok]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'corrected', len(ok), 'dropped', len(dropped))
