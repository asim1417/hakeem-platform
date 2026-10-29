#!/usr/bin/env python3
"""gap027 (HKM-052): تاريخ نفاذ 160 صكًّا أُدخلت من أم القرى، بقراءة صفحاتها الرسمية (قارئان مستقلان على نصفين، readers/UQN_EFFECTIVE_RULES.md).
بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية».
يُحسب: pub/silent (للنظام والتنظيم) = تاريخ نشر الصفحة؛ plus = النشر + المدة؛ issue = تاريخ الأداة؛ explicit = المنصوص؛
with_law = تاريخ نفاذ النظام الأم إن كان موثقًا (صف effective_from_*) في حكيم، ولا يسبق نشرَ الصك نفسه.
يُعلّق: الصفحة لأداة أخرى، أو نص موحّد معدَّل (المدة من النشر الأول)، أو ثقة دنيا، أو other، أو ما نبّه القارئ إلى حاجته لقرار.
المخرج plan.json للمراجع المستقل.
"""
import datetime, json, re, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri
D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'uqn_effective'
PK = {x['item']: x for x in json.load(open(D.parent / 'gap025-confirm-all' / 'uqn_packet.json', encoding='utf-8'))['items']}
READ = {}
for f in ('q1.jsonl', 'q2.jsonl'):
    for l in open(R / f, encoding='utf-8'):
        if l.strip():
            x = json.loads(l); READ[x['item']] = x
BACKED = json.load(open(D / 'backed_laws.json', encoding='utf-8'))  # الاسم → تاريخ النفاذ الموثق
HOLD_FLAGS = {'UQ-157': 'نص معدَّل أعيد نشره؛ المدة من النشر الأول أم الثاني', 'UQ-099': 'تاريخ الصدور بعيد عن المخزن ولم يُقرأ نص النفاذ كاملًا',
              'UQ-082': 'ديباجته في حكيم نص لا علاقة له', 'UQ-022': 'نص موحّد معدَّل', 'UQ-050': 'نص موحّد معدَّل', 'UQ-064': 'نص موحّد معدَّل',
              'UQ-069': 'نص موحّد معدَّل', 'UQ-131': 'المدة من النشر في موقع الجهة لا الجريدة', 'UQ-127': 'عبارة «من تاريخه» محتملة',
              'UQ-079': 'عبارة «من تاريخه» محتملة', 'UQ-110': 'تعارض بين العبارة والمخزن يحتاج قراءة ثانية'}
LAW_KINDS = {'نظام', 'تنظيم', 'ترتيبات تنظيمية'}
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def hij(s):
    n = [int(x) for x in re.findall(r'\d+', (s or '').translate(AR))][:3]
    return tuple(n) if len(n) == 3 and 1300 < n[0] < 1500 else None


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


plan, held = [], []
for item, p in sorted(PK.items()):
    r = READ.get(item)
    why, eff, basis = None, None, None
    if not r:
        why = 'لا قراءة'
    elif item in HOLD_FLAGS:
        why = HOLD_FLAGS[item]
    elif r.get('confidence') == 'low':
        why = 'ثقة القارئ دنيا'
    else:
        rule = r['rule']
        pub = hij(r.get('page_pub_hijri'))
        if pub and r.get('page_pub_greg') and g(pub).isoformat() != r['page_pub_greg']:
            why = f"تاريخا الصفحة لا يتطابقان ({r['page_pub_hijri']} / {r['page_pub_greg']})"
        elif rule in ('pub', 'plus', 'silent') and r.get('page_is_instrument') is False:
            why = 'الصفحة لأداة أخرى، فتاريخها ليس نشر الصك'
        elif rule == 'pub' and pub:
            eff, basis = g(pub), 'من تاريخ النشر (صفحة أم القرى)'
        elif rule == 'silent' and pub:
            if p['kind'] in LAW_KINDS:
                eff, basis = g(pub), 'سكت النص: من النشر (م71 من النظام الأساسي)'
            else:
                why = 'لا عبارة نفاذ، وليس نظامًا (لا يلزم)'
        elif rule == 'plus' and pub and r.get('n'):
            n, unit = int(r['n']), r.get('unit') or 'days'
            eff = g(pub) + datetime.timedelta(days=n) if unit == 'days' else add_months(pub, n)
            basis = f"النشر + {n} {'يومًا' if unit == 'days' else 'أشهر هجرية'}"
        elif rule == 'issue' and hij(r.get('issue_hijri')):
            eff, basis = g(hij(r['issue_hijri'])), 'من تاريخ الصدور/الموافقة'
        elif rule == 'explicit' and (hij(r.get('explicit_hijri')) or r.get('explicit_greg')):
            eff = g(hij(r['explicit_hijri'])) if hij(r.get('explicit_hijri')) else datetime.date.fromisoformat(r['explicit_greg'])
            basis = 'تاريخ منصوص'
        elif rule == 'with_law' and r.get('law'):
            law = re.sub(r'\s*\(.*?\)\s*', ' ', r['law']).strip()
            hit = BACKED.get(law) or BACKED.get(r['law'].strip())
            if hit and pub and r.get('page_is_instrument') is not False:
                # لا يسري الصك قبل نشره: إن صدر بعد نفاذ نظامه فمن تاريخ نشره
                le = datetime.date.fromisoformat(hit)
                if g(pub) > le:
                    eff, basis = g(pub), f'من تاريخ نفاذ {law} ({hit})، وقد نُشر بعده فمن تاريخ نشره'
                else:
                    eff, basis = le, f'من تاريخ نفاذ {law} (موثق في حكيم)'
            elif hit:
                why = f'تابع لنفاذ «{law}» ولا تاريخ نشر مقروء للصك'
            else:
                why = f'تابع لنفاذ «{law}» وتاريخه غير موثق في حكيم'
        else:
            why = f"قاعدة {rule} بلا بيانات كافية"
    if why:
        held.append(dict(item=item, id=p['id'], name=p['name'], why=why))
        continue
    plan.append(dict(item=item, id=p['id'], name=p['name'], kind=p['kind'], stored=p['stored'], new=eff.isoformat(), basis=basis,
                     url=r.get('url_read'), clause=(r.get('clause_quote') or '')[:300], page_pub_hijri=r.get('page_pub_hijri'),
                     cls='confirm' if p['stored'] == eff.isoformat() else 'correct'))
json.dump({'plan': plan, 'held': held}, open(D / 'plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print('plan', len(plan), Counter(x['cls'] for x in plan), 'held', len(held))
print(Counter(h['why'][:30] for h in held).most_common())
