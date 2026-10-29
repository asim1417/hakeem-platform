#!/usr/bin/env python3
"""gap029 (HKM-052، U3 الطبقة الثالثة): حزم القراءة.
المرشحون: مواد معدّلة يعرض حكيم نصها الأصلي، وكل ملاحظاتها في الهيئة «تعديل مادة كاملة» بنص جديد كامل (87 مادة، 100 ملاحظة).
- date_packets.json: لكل أداة معدِّلة لم يتفق قارئان على تاريخ نفاذها من قبل (جديدة أو سبقت قراءتها بلا اتفاق).
- ident_packets.json: ملاحظات لا تذكر أداتها، أو ذكرتها بصيغة لم تُقرأ آليًا؛ المطلوب تعيين الأداة ثم تاريخها.
"""
import json
from collections import defaultdict
from pathlib import Path
from analyze import A, PART, norm, parse_instr, agreed, tried
D = Path(__file__).parent
full = [a for a, ns in A.items() if all(n['effect'] == 'amend_article' and (n['new'] or '').strip() and '...' not in n['new'] and '…' not in n['new'] and not PART.search(n['note'][:400]) for n in ns)]
inst, ident = defaultdict(list), []
for a in full:
    for x in A[a]:
        k = (norm(x['instr']) if x['instr'] else None) or parse_instr(x['note'])
        if not k:
            ident.append(dict(law=x['law'], article=x['n'], bis=x['bis'], boe_url=x['url'], note_id=x['note_id'], note=x['note'][:900]))
        elif k not in agreed:
            inst[k].append(f"{x['law']} م{x['n']}")
dp = [dict(item=f'CD-{i:02d}', instrument=k, previously_tried_without_agreement=k in tried, articles=sorted(set(v))[:8]) for i, (k, v) in enumerate(sorted(inst.items()), 1)]
ip = [dict(item=f'CI-{i:02d}', **x) for i, x in enumerate(ident, 1)]
json.dump({'items': dp}, open(D / 'date_packets.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'items': ip}, open(D / 'ident_packets.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(sorted(full), open(D / 'candidates.json', 'w', encoding='utf-8'), indent=0)
print('date items', len(dp), 'ident items', len(ip), 'articles', len(full))
