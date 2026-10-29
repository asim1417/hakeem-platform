#!/usr/bin/env python3
"""gap029: اختيار المواد القابلة للبناء — كل ملاحظاتها «تعديل مادة كاملة» بنص كامل، ولكل ملاحظة أداة معيّنة وتاريخ نفاذ اتفق عليه قارئان."""
import datetime, json, re, sys, warnings
from collections import defaultdict
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri
from analyze import A, PART, norm, parse_instr, agreed as AGREED16
D = Path(__file__).parent
RC = D.parents[1] / 'readers' / 'readings' / 'amend_dates_c'
# من gap016b: ما اتفق عليه القارئان لكنه معلّق لسبب موضوعي
EXCLUDE_ARTICLES = {'cmpz9elyo0cf5ybvvndmq2da0': 'الخدمة المدنية م37: ترقيم «37 مكرر» ملتبس (كما في gap016b)',
                    'cmpzcvb5k0bizvtrkz55p4agm': 'ضريبة الدخل م67: الأداة في الملاحظة م/113 لعام 1438هـ لا م/1، والنص الجديد يتضمن حكمًا انتقاليًا (كما في gap016b)'}
HOLD_INSTR = {'royal_decree م/244 1446/11/7': 'رسوم الأراضي البيضاء: المرسوم يعلّق العمل بأحكام الرسوم على نفاذ لائحتها (BD-34)'}
KINDN = {'cm_decision': 'cabinet_decision', 'council_of_ministers_decision': 'cabinet_decision', 'cabinet_decision': 'cabinet_decision',
         'royal_decree': 'royal_decree', 'royal_order': 'royal_order'}


def h2g(s):
    n = [int(x) for x in re.findall(r'\d+', s or '')][:3]
    if len(n) == 3 and 1300 < n[0] < 1500:
        return Hijri(*n).to_gregorian()
    return None


def ninstr(s):
    if not s:
        return None
    m = re.match(r'^(\w+)\s+(\S+)\s+(\d{4})/(\d{1,2})/(\d{1,2})$', s.strip())
    if not m or m.group(1) not in KINDN:
        return None
    return f"{KINDN[m.group(1)]} {m.group(2).replace('ا/', 'أ/')} {int(m.group(3))}/{int(m.group(4))}/{int(m.group(5))}"


def load(r):
    return {x['item']: x for x in (json.loads(l) for l in open(RC / f'reader_{r}.jsonl', encoding='utf-8') if l.strip())}


def date_of(x):
    if x.get('base') == 'explicit' and x.get('explicit_hijri'):
        return h2g(x['explicit_hijri'])
    if x.get('base') in ('publication', None) and x.get('published_hijri') and x.get('rule_quote') is not None or (x.get('base') == 'publication' and x.get('published_hijri')):
        p = h2g(x['published_hijri'])
        n = int(x.get('n') or 0)
        if p and (x.get('unit') or 'days') == 'days':
            return p + datetime.timedelta(days=n)
    return None


R = {r: load(r) for r in ('c1', 'c2', 'c3', 'c4')}
CD = {x['item']: x for x in json.load(open(D / 'date_packets.json', encoding='utf-8'))['items']}
CI = {x['item']: x for x in json.load(open(D / 'ident_packets.json', encoding='utf-8'))['items']}
dates = {}  # instrument -> (date, evidence)
for k, v in AGREED16.items():
    g = h2g(v) if int(v[:4]) < 1700 else datetime.date.fromisoformat(v)
    dates[k] = (g, 'قارئان متفقان سابقًا (gap016/gap016b)')
ci_instr = {}
for a, b in (('c1', 'c2'), ('c3', 'c4')):
    for it in set(R[a]) | set(R[b]):
        x, y = R[a].get(it) or {}, R[b].get(it) or {}
        if it.startswith('CI-'):
            ix, iy = ninstr(x.get('instrument')), ninstr(y.get('instrument'))
            if ix and ix == iy:
                ci_instr[it] = ix
        if 'low' in (x.get('confidence'), y.get('confidence')) or not x or not y:
            continue
        dx, dy = date_of(x), date_of(y)
        k = CD[it]['instrument'] if it in CD else ci_instr.get(it)
        if k and dx and dx == dy:
            dates[k] = (dx, f"قارئان مستقلان متفقان ({a}/{b}): النشر {x.get('published_hijri')}هـ ({x.get('pub_source')})، {x.get('rule_quote') or 'سكتت الأداة: م71'}")
# ملاحظات بلا أداة: الأداة التي اتفق عليها القارئان
note_instr = {CI[it]['note_id']: k for it, k in ci_instr.items()}

ORD = None
sys.path.insert(0, str(D.parents[1] / 'scripts'))
from arabic import masc_ordinal_word  # noqa: E402


def mapping_ok(n, note):
    t = note[:120]
    m = re.search(r'المادة\s*\(\s*(\d+)\s*\)', t)
    if m:
        return int(m.group(1)) == int(n)
    words = re.findall(r'المادة\s+((?:ال\S+)(?:\s+و?ال\S+){0,2})', t)
    if words:
        w = re.sub(r'\s+', ' ', words[0]).strip()
        cands = {masc_ordinal_word(k).replace('ة', 'ه') for k in range(1, 400) if masc_ordinal_word(k)}
        target = (masc_ordinal_word(int(n)) or '').replace('ة', 'ه')
        ww = w.replace('ة', 'ه')
        if any(ww.startswith(c) for c in cands):
            return ww.startswith(target)
    return True


PART2 = re.compile(r'(إعادة صياغة|صياغة الفقرة|الفقرة\s*\(|البند\s*\(|الفقرتين|البندين)')
full = [a for a, ns in A.items() if all(n['effect'] == 'amend_article' and (n['new'] or '').strip() and '...' not in n['new'] and '…' not in n['new'] and not PART.search(n['note'][:400]) and not PART2.search(n['note'][:600]) for n in ns)]
sel, skipped = [], []
for a in full:
    ns = sorted(A[a], key=lambda z: z['nseq'])
    law, n = ns[0]['law'], ns[0]['n']
    why = None
    if a in EXCLUDE_ARTICLES:
        why = EXCLUDE_ARTICLES[a]
    elif law.startswith('نظام القضاء'):
        why = 'ملاحظات نظام القضاء مسندة لغير موادها (م72 تحت م9 وم73)'
    elif not all(mapping_ok(n, z['note']) for z in ns):
        why = 'الملاحظة تسمي مادة أخرى'
    if not why:
        ins = []
        for z in ns:
            k = (norm(z['instr']) if z['instr'] else None) or parse_instr(z['note']) or note_instr.get(z['note_id'])
            ins.append(k)
        if None in ins:
            why = 'أداة غير معيّنة'
        elif any(k in HOLD_INSTR for k in ins):
            why = HOLD_INSTR[next(k for k in ins if k in HOLD_INSTR)]
        elif any(k not in dates for k in ins):
            why = 'تاريخ غير متفق عليه: ' + ', '.join(k for k in ins if k not in dates)
        else:
            ds = [dates[k][0] for k in ins]
            if ds != sorted(ds) or len(set(ds)) != len(ds):
                why = f'ترتيب التواريخ لا يطابق ترتيب الملاحظات {ds}'
    if why:
        skipped.append(dict(article=a, law=law, n=n, why=why)); continue
    sel.append(dict(article_id=a, system_id=ns[0]['sid'], law=law, n=n, bis=ns[0]['bis'], md5=ns[0]['md5'],
                    notes=[dict(note_id=z['note_id'], nseq=z['nseq'], instr=k, date=dates[k][0].isoformat(), ev=dates[k][1], new=z['new'], note=z['note']) for z, k in zip(ns, ins)]))
json.dump({'selected': sel, 'skipped': skipped}, open(D / 'selection.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print('selected', len(sel), 'skipped', len(skipped)); print(Counter(s['why'][:40] for s in skipped).most_common())
for s in sel:
    print(s['law'][:45], 'م', s['n'], [(z['instr'], z['date']) for z in s['notes']])
