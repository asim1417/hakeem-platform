#!/usr/bin/env python3
"""gap025 — الدور الثاني للبنود المعلّقة بعبارة غير مباشرة ولها بطاقة هيئة صالحة: أنماط محددة تُحسب بلا اجتهاد.
  next_day:  «من اليوم التالي لنشره / لتاريخ نشره»                    → النشر + يوم
  approval:  «من تاريخ الموافقة عليه/عليها» أو «من تاريخ اعتماده» (أداة مجلس الوزراء) → تاريخ الأداة (صدور البطاقة)
  issue_next:«من اليوم التالي لتاريخ صدوره»                           → الصدور + يوم
  issue_decree: «ويعمل به من تاريخ صدور هذا المرسوم»                  → الصدور
  plus_digits: «بعد تسعين 90 يوما من تاريخ نشره»                      → النشر + 90
  explicit:  «ينفذ هذا النظام اعتبارا من 1 /7 /1393»                  → التاريخ المنصوص
ويبقى معلّقًا: نفاذ معلّق على إقرار المجلس الأعلى لدول الخليج، أو على لائحة، أو «أول الشهر التالي»، أو تاريخ يحدده المجلس.
المخرج extra_plan.json بالحقول نفسها في plan.json.
"""
import datetime, json, re, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri
D = Path(__file__).parent
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
P = json.load(open(D / 'plan.json', encoding='utf-8'))
U = {x['id']: x for x in json.load(open(D / 'unbacked.json', encoding='utf-8'))}


def hij(s):
    n = [int(x) for x in re.findall(r'\d+', (s or '').translate(AR))][:3]
    return tuple(n) if len(n) == 3 and 1300 < n[0] < 1500 else None


def g(t):
    return Hijri(*t).to_gregorian()


out = []
for x in P:
    u = U[x['id']]
    if x['class'] != 'hold' or not x['why'].startswith('عبارة') or not u.get('guid'):
        continue
    if re.search(r'/0?1/0?1$', u.get('ph') or ''):
        continue
    q = re.sub(r'\s+', ' ', x['quote'].translate(AR))
    pub, iss = hij(u['ph']), hij(u['ih'])
    eff = basis = None
    if re.search(r'من اليوم التالي (?:ل)?(?:تاريخ )?نشره|من اليوم التالي لنشره', q):
        eff, basis = g(pub) + datetime.timedelta(days=1), 'من اليوم التالي للنشر'
    elif re.search(r'من اليوم التالي لتاريخ صدوره', q):
        eff, basis = g(iss) + datetime.timedelta(days=1), 'من اليوم التالي للصدور'
    elif re.search(r'(?:يعمل|ينفذ|يسري)\s+\S+\s+(?:من تاريخ الموافقة عليه|من تاريخ الموافقة عليها|من تاريخ اعتماده)$|(?:يعمل|ينفذ|يسري)\s+\S+\s+(?:من تاريخ الموافقة عليه|من تاريخ الموافقة عليها|من تاريخ اعتماده)[،,]', q) and 'المجلس الأعلى' not in q:
        eff, basis = g(iss), 'من تاريخ الموافقة (تاريخ الأداة)'
    elif re.search(r'ويعمل به من تاريخ صدور هذا المرسوم', q):
        eff, basis = g(iss), 'من تاريخ صدور المرسوم'
    elif re.search(r'بعد تسعين 90 يوما من تاريخ نشره', q):
        eff, basis = g(pub) + datetime.timedelta(days=90), 'النشر + 90 يومًا'
    else:
        m = re.search(r'(?:ينفذ|يعمل|يسري) هذا النظام اعتبارا من (\d{1,2}) ?/(\d{1,2}) ?/(\d{4})', q)
        if m:
            eff, basis = g((int(m.group(3)), int(m.group(2)), int(m.group(1)))), 'تاريخ منصوص'
    if not eff:
        continue
    if iss and pub and not (0 <= (g(pub) - g(iss)).days <= 120):
        continue
    y = dict(x)
    y.update(new=eff.isoformat(), basis=basis, src='boe', pub=pub, issue=iss, rule='extra')
    y['class'] = 'confirm' if y['stored'] == y['new'] else 'correct'
    out.append(y)
json.dump(out, open(D / 'extra_plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for y in out:
    print(y['class'], y['name'][:45], y['stored'], '->', y['new'], '|', y['basis'])
print(len(out))
