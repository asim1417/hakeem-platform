#!/usr/bin/env python3
"""gap021 (HKM-052، الصنف M2c): تاريخ نفاذ 75 صكًّا مخزن بتاريخ نائب من لقطة هيئة الخبراء (أول محرم من سنة الصدور) أو فارغ.

المدخل: packet.json (عبارة النفاذ، والأداة، وتاريخا زحف نظما)، وقراءتا قارئين مستقلين على نصفين (readers/readings/placeholder/r1.jsonl وr2.jsonl)
بقواعد readers/PLACEHOLDER_RULES.md: كل قارئ قرأ قاعدة النفاذ من النص، وفتح المصادر بترتيب المالك 29/10
(هيئة الخبراء تاريخها نائب هنا، فالمركز الوطني للوثائق، فأم القرى — أرشيفها على الشبكة يبدأ نحو العدد 4460 فلا تبلغه هذه الأنظمة —، فنظما).
يُكتب التاريخ إذا اجتمع:
  1. قاعدة النفاذ من القارئ: `publication` أو `silent` (يعمل به من النشر: م71 من النظام الأساسي، وهو العرف قبله)، أو `publication_plus` بمدة،
     أو `issue` (من تاريخ الصدور، وتاريخ الأداة من سطرها في الهيئة)، أو `explicit` (تاريخ منصوص). و`other` يُعلَّق.
  2. ثقة القارئ ليست دنيا. ولقاعدة النشر: تاريخ نشر قرأه القارئ بنفسه من الصفحة الحية، ويطابق تاريخ زحف نظما في الحزمة (لقطتان للمصدر)، ويقع بعد الصدور بيوم إلى 120 يومًا
     (ما زاد فخطأ محتمل في المصدر فيُعلّق، مثل البند PH-69 بعد سنتين وثمانية أشهر).
  3. المخزن الآن هو القيمة النائبة نفسها (أو فارغ)، والكتابة محروسة بها.
الحساب بالكود: الهجري بتقويم أم القرى (hijri_converter)؛ الأيام تضاف ميلاديًا، والأشهر والسنون هجرية (كما في gap019j).
تفويض المالك 29/10: «انهي لي كل ما يتعلق بقاعدة الانظمة … ولاترجع لي».

    python3 batches/gap021-placeholder-dates/build.py
"""
import datetime, hashlib, json, re, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'placeholder'
BY = 'gap021-placeholder-dates-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
P = {r['item']: r for r in json.load(open(D / 'packet.json', encoding='utf-8'))['items']}
READ = {}
for f in ('r1.jsonl', 'r2.jsonl'):
    for l in open(R / f, encoding='utf-8'):
        if l.strip():
            x = json.loads(l)
            READ[x['item']] = x


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def hij(s):
    """«1420/08/18 هـ» أو «18/ 08/ 1420» أو «1420-08-18» → (y, m, d)."""
    if not s:
        return None
    n = [int(x) for x in re.findall(r'\d+', s.translate(AR))]
    if len(n) < 3:
        return None
    y, m, d = (n[0], n[1], n[2]) if n[0] > 1000 else (n[2], n[1], n[0])
    if not (1300 < y < 1500 and 1 <= m <= 12 and 1 <= d <= 30):
        return None
    return y, m, d


def g(t):
    y, m, d = t
    try:
        return Hijri(y, m, d).to_gregorian()
    except ValueError:
        return Hijri(y, m, d - 1).to_gregorian() + datetime.timedelta(days=1) if d == 30 else None


def add_months(t, n):
    y, m, d = t
    m0 = m - 1 + n
    y, m = y + m0 // 12, m0 % 12 + 1
    try:
        return Hijri(y, m, d).to_gregorian()
    except ValueError:
        return Hijri(y, m, 29).to_gregorian()


NZ_OLD_NAME = {'PH-11': '١٤٢٢/٠٤/٠٨هـ', 'PH-12': '١٤٢٢/٠٤/٠٨هـ'}
ok, held = [], []
for item, p in sorted(P.items()):
    r = READ.get(item)
    why = None
    if not r:
        held.append(dict(item=item, name=p['name'], why='لا قراءة'))
        continue
    rule, n, unit = r['rule'], r.get('n'), r.get('unit')
    issue = hij(r.get('issue_hijri'))
    pub = hij(r.get('pub_hijri'))
    nz = hij((p['nezams'][0]['publish_date'] if p['nezams'] else None))
    if item in NZ_OLD_NAME:  # في الزحف باسمه القديم «تنظيم هيئة الاتصالات السعودية» (نظما 203)، فلم يطابقه الاسم في الحزمة
        nz = hij(NZ_OLD_NAME[item])
    eff, basis = None, None
    if r.get('confidence') == 'low':
        why = 'ثقة القارئ دنيا: ' + (r.get('notes') or '')[:200]
    elif rule in ('publication', 'silent', 'publication_plus'):
        if not pub:
            why = 'لا تاريخ نشر في أي مصدر'
        elif r.get('pub_source') == 'nezams' and nz != pub:
            why = f'تاريخ نشر القارئ {pub} يخالف زحف نظما {nz}'
        elif not issue or not (1 <= (g(pub) - g(issue)).days <= 120):
            why = f'النشر {pub} ليس بعد الصدور {issue} بمدة معقولة (1–120 يومًا)'
        elif rule == 'publication_plus':
            if unit == 'days' and n:
                eff, basis = g(pub) + datetime.timedelta(days=n), f'النشر + {n} يومًا'
            elif unit == 'months' and n:
                eff, basis = add_months(pub, n), f'النشر + {n} أشهر هجرية'
            elif unit == 'years' and n:
                eff, basis = add_months(pub, 12 * n), f'النشر + {n} سنة هجرية'
            else:
                why = f'مدة غير مفهومة {n} {unit}'
        else:
            eff, basis = g(pub), ('من تاريخ النشر' if rule == 'publication' else 'سكت النص: من النشر (م71 من النظام الأساسي)')
    elif rule == 'issue':
        md = re.search(r'(?:بتاريخ|وتاريخ)\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', (p['decree'] or '').translate(AR))
        dec = (int(md.group(3)), int(md.group(2)), int(md.group(1))) if md else None
        if not issue or issue != dec:
            why = f'تاريخ الصدور {issue} لا يطابق سطر الأداة {dec}'
        else:
            eff, basis = g(issue), 'من تاريخ الصدور بنصه'
    elif rule == 'explicit':
        e = hij(r.get('explicit_hijri'))
        if not e:
            why = 'تاريخ منصوص غير مقروء'
        else:
            eff, basis = g(e), 'تاريخ منصوص'
    else:
        why = 'قاعدة نفاذ غير مباشرة: ' + (r.get('notes') or '')[:200]
    if why:
        held.append(dict(item=item, name=p['name'], why=why))
        continue
    eff = eff.isoformat()
    if p['stored'] and eff == p['stored'][:10]:
        held.append(dict(item=item, name=p['name'], why='المحسوب يساوي المخزن'))
        continue
    ok.append(dict(item=item, sid=p['id'], name=p['name'], old=p['stored'][:10] if p['stored'] else None, new=eff, basis=basis, rule=rule,
                   pub=r.get('pub_hijri'), src=(r.get('pub_source') or 'boe') if rule in ('publication', 'silent', 'publication_plus') else 'boe', url=(r.get('pub_url') if rule in ('publication', 'silent', 'publication_plus') else None) or ((p['boe'] or [{}])[0].get('url')) or r.get('pub_url') or 'nezams.com',
                   clause=(r.get('clause_quote') or '').strip(), issue=r.get('issue_hijri')))

cond_old = ' AND '.join(f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(x['sid'])})={lit(x['old'])}::date" if x['old']
                        else f"(SELECT count(*) FROM legal_systems WHERE id={lit(x['sid'])} AND preamble_effective_from IS NULL)=1" for x in ok)
st = [f"SELECT CASE WHEN {cond_old} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g21p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for x in ok:
    note = (f"HKM-052 {BY}: كان المخزن {x['old'] or 'فارغًا'} (تاريخ نائب من لقطة الهيئة). قاعدة النفاذ: {x['basis']}"
            + (f" — «{x['clause']}»" if x['clause'] else '') + (f"؛ الصدور {x['issue']}هـ" if x['issue'] else '')
            + (f"؛ النشر {x['pub']}هـ ({x['src']}، قرأه القارئ من الصفحة الحية وطابق زحف نظما)" if x['pub'] and x['rule'] != 'issue' else '')
            + f" = {x['new']} [قارئ مستقل، ترتيب المصادر بقرار المالك 29/10]")
    pid = 'g21p-' + h(BY, x['sid'])
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(x['sid'])}, {lit(x['name'])}, NULL, {lit(x['src'])}, {lit(BY)}, {lit(x['url'])}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
              f"{lit('effective_from_' + ('corrected:' + x['old'] if x['old'] else 'filled:null') + '->' + x['new'])}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for x in ok:
    if x['old']:
        st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(x['new'])}::timestamptz WHERE id = {lit(x['sid'])} AND preamble_effective_from::date = {lit(x['old'])}::date")
    else:
        st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(x['new'])}::timestamptz WHERE id = {lit(x['sid'])} AND preamble_effective_from IS NULL")
cond_new = ' AND '.join(f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(x['sid'])})={lit(x['new'])}::date" for x in ok)
st.append(f"SELECT CASE WHEN {cond_new} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g21p-%')={len(ok)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'corrected': len(ok), 'held': held, 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(item=x['item'], name=x['name'], old=x['old'], new=x['new'], basis=x['basis']) for x in ok]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'corrected', len(ok), 'held', len(held))
for x in ok:
    print('OK  ', x['item'], x['name'][:40], x['old'], '->', x['new'], '|', x['basis'], '|', x['src'])
for x in held:
    print('HOLD', x['item'], x['name'][:40], '|', x['why'][:120])
