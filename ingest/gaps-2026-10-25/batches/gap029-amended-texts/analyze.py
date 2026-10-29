#!/usr/bin/env python3
"""gap029 (HKM-052، U3 الطبقة الثالثة): تحليل المواد المعدّلة الباقية التي كل ملاحظاتها «تعديل مادة كاملة» بنص كامل، وتغطية تواريخ أدواتها مما اتفق عليه القراء سابقًا."""
import json, re, sys
from collections import defaultdict, Counter
from pathlib import Path
D = Path(__file__).parent
sys.path.insert(0, str(D.parent / 'gap016b-amended-texts'))
RD = D.parents[1] / 'readers' / 'readings'
J = json.load(open(D / 'u3_notes_2026-10-30.json', encoding='utf-8'))
A = defaultdict(list)
for x in J:
    A[x['aid']].append(x)
PART = re.compile(r'(إضافة فقرة|بإضافة فقرة|إضافة بند|بإضافة بند|تعديل عبارة|بتعديل عبارة|حذف عبارة|بحذف|إضافة عبارة|بإضافة عبارة)')
KIND = [('royal_decree', r'المرسوم الملكي|مرسوم ملكي'), ('cabinet_decision', r'قرار مجلس الوزراء|بقرار مجلس الوزراء'), ('royal_order', r'الأمر الملكي|أمر ملكي|بالأمر الملكي')]
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def parse_instr(note):
    t = note.translate(AR)
    for k, pat in KIND:
        m = re.search(r'(?:' + pat + r')\s*(?:الكريم\s*)?(?:رقم\s*[:：]?\s*)?\(?\s*([أام]?\s*/?\s*\d+)\s*\)?\s*(?:و?بتاريخ|وتاريخ)\s*[:：]?\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', t)
        if m:
            no = re.sub(r'\s+', '', m.group(1)).replace('ا/', 'أ/')
            return f"{k} {no} {int(m.group(4))}/{int(m.group(3))}/{int(m.group(2))}"
    return None


def norm(instr):
    k, no, d = (instr.strip() + '  ').split(' ', 2)
    y = re.findall(r'\d+', d)
    if len(y) < 3:
        return None
    ymd = (y[0], y[1], y[2]) if len(y[0]) == 4 else (y[2], y[1], y[0])
    return f"{k} {no.replace('ا/', 'أ/')} {int(ymd[0])}/{int(ymd[1])}/{int(ymd[2])}"


def load(p):
    return {x['item']: x for x in (json.loads(l) for l in open(p, encoding='utf-8') if l.strip())} if p.exists() else {}


# التواريخ المتفق عليها سابقًا (gap016: m/n/o؛ gap016b: r/s، t/u)
agreed, tried = {}, set()
G16 = D.parent / 'gap016-amended-texts'
m, n, o = (load(RD / 'amend_dates' / f'reader_{r}.jsonl') for r in 'mno')
for x in json.load(open(G16 / 'date_packets.json', encoding='utf-8'))['items']:
    k = norm(x['instrument']); tried.add(k)
    ds = [r.get(x['item'], {}).get('date') for r in (m, n, o)]
    for i in range(3):
        for j in range(i + 1, 3):
            if ds[i] and ds[i] == ds[j]:
                agreed[k] = ds[i]
r, s, t, u = (load(RD / 'amend_dates_b' / f'reader_{q}.jsonl') for q in 'rstu')
for x in json.load(open(D.parent / 'gap016b-amended-texts' / 'date_packets.json', encoding='utf-8'))['items']:
    k = norm(x['instrument']); tried.add(k)
    a, b = ((r, s) if x['half'] == 'A' else (t, u))
    a, b = a.get(x['item']) or {}, b.get(x['item']) or {}
    if a.get('date') and a.get('date') == b.get('date') and 'low' not in (a.get('confidence'), b.get('confidence')):
        agreed[k] = a['date']

if __name__ == '__main__':
    full = [a for a, ns in A.items() if all(n['effect'] == 'amend_article' and (n['new'] or '').strip() and '...' not in n['new'] and '…' not in n['new'] and not PART.search(n['note'][:400]) for n in ns)]
    inst = Counter(); miss = 0
    for a in full:
        for x in A[a]:
            k = (norm(x['instr']) if x['instr'] else None) or parse_instr(x['note'])
            if not k:
                miss += 1; print('NOPARSE', x['law'], x['n'], x['note'][:160].replace('\n', ' '))
                continue
            inst[k] += 1
    print('articles', len(full), 'instruments', len(inst), 'unparsed', miss)
    print('agreed', sum(1 for k in inst if k in agreed), 'tried-not-agreed', sum(1 for k in inst if k in tried and k not in agreed), 'new', sum(1 for k in inst if k not in tried))
    for k, v in inst.most_common():
        print(v, k, 'AGREED ' + agreed[k] if k in agreed else ('tried' if k in tried else 'NEW'))
