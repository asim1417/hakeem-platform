#!/usr/bin/env python3
"""gap028 (HKM-052): خطة تواريخ النفاذ الباقية من قراءة ثلاثة قراء مستقلين (readers/REMAINING_DATES_RULES.md)، بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية».

يُحسب ما ثقته عالية أو متوسطة وتاريخ نشره مقروء من مصدر رسمي (أم القرى، أو جهة رسمية، أو نظما ما لم يخالفها الأعلى):
  publication/silent (للنظام والتنظيم) = النشر؛ publication_plus = النشر + المدة (الأيام ميلاديًا، والأشهر والسنون هجريًا، HKM-024)؛
  issue = تاريخ الأداة؛ explicit = المنصوص؛ with_law = نفاذ النظام الأم الموثق، ولا يسبق نشر الصك نفسه.
ضوابط: النشر لا يسبق الصدور؛ ومن نظما وحدها لا يتأخر النشر عن الصدور بأكثر من 120 يومًا؛ وتاريخ البطاقة المساوي للصدور في غير جمعة لا يُعدّ مخالفة لنظما.
يُعلّق: ثقة دنيا، other، الصفحة لأداة أخرى، والسجلات ذات الهوية المشكلة (HOLD).
"""
import datetime, json, re, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri
D = Path(__file__).parent
RD = D.parents[1] / 'readers' / 'readings' / 'remaining_dates'
PK = {x['item']: x for x in json.load(open(D / 'packet.json', encoding='utf-8'))['items']}
READ = {}
for f in ('r1', 'r2', 'r3'):
    for l in open(RD / f'{f}.jsonl', encoding='utf-8'):
        if l.strip():
            x = json.loads(l); READ[x['item']] = x
LAW_KINDS = {'نظام', 'تنظيم', 'ترتيبات تنظيمية'}
BACKED = {'نظام التكاليف القضائية': '2022-03-16'}  # موثق في حكيم (legal_text_provenance effective_from_corrected)
HOLD = {
    'R-012': 'سجل مخلوط مخفي (سجل مخلوط — لا يُعرض): المواد 1–65 من نظام 1447 و66–98 من نظام 1433',
    'R-046': 'سجل مخلوط مخفي (سجل مخلوط — لا يُعرض)',
    'R-045': 'هوية: المواد المخزنة لنظام الشركات المهنية 1441 (م/17) والديباجة وأداة الإصدار لنظام 1412 (م/4)',
    'R-141': 'هوية: صفحة أم القرى للملحق (4) وحده، والسجل باسم اللائحة كاملة',
    'R-048': 'هوية: أداة الإصدار المخزنة (م/2 لعام 1390) لا تطابق نظام 1350، والتاريخ المخزن لا يطابق الصدور ولا النشر',
    'R-127': 'نفاذه تابع لتطبيق مرسوم ضريبة الدخل 1370، وتاريخه غير موثق',
    'R-054': 'تابع لنفاذ نظام المنافسات 1440 ولا تاريخ نشر مقروء للائحة نفسها',
    'R-037': 'عبارة معدّلة: قرار مجلس الوزراء 307 (1445/4/16) جعل المدة 360 يومًا «بعد انقضاء …» ونُشر بعد مضي المدة الأصلية، والنص المخزن ما زال 180 يومًا',
}


def hij(s):
    n = [int(x) for x in re.findall(r'\d+', s or '')][:3]
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
    r = READ[item]
    why, eff, basis = HOLD.get(item), None, None
    pub = hij(r.get('pub_hijri'))
    card_iss = p.get('boe_card_issue') if p.get('boe_card_issue') and not re.search(r'/0?1/0?1$', p['boe_card_issue']) else None
    iss = hij(r.get('issue_hijri')) or hij(card_iss)
    if why:
        pass
    elif r.get('confidence') not in ('high', 'medium'):
        why = 'ثقة القارئ دنيا'
    elif r.get('page_is_instrument') is False:
        why = 'الصفحة لأداة أخرى'
    elif r['rule'] == 'other':
        why = 'عبارة نفاذ غير مباشرة: ' + (r.get('notes') or '')[:200]
    elif r['rule'] in ('publication', 'publication_plus', 'silent', 'with_law') and not pub:
        why = 'لا تاريخ نشر مقروء'
    elif pub and r.get('pub_greg_on_page') and g(pub).isoformat() != r['pub_greg_on_page']:
        why = f"تاريخا الصفحة لا يتطابقان ({r['pub_hijri']} / {r['pub_greg_on_page']})"
    elif pub and iss and g(pub) < g(iss):
        why = 'النشر قبل الصدور'
    elif pub and iss and r.get('pub_source') == 'nezams' and (g(pub) - g(iss)).days > 120:
        why = f'النشر بعد الصدور بـ{(g(pub) - g(iss)).days} يومًا ومصدره نظما وحدها'
    else:
        rule = r['rule']
        if rule == 'publication' or (rule == 'silent' and p['kind'] in LAW_KINDS):
            eff, basis = g(pub), ('من تاريخ النشر' if rule == 'publication' else 'سكت النص: من النشر (م71 من النظام الأساسي)')
        elif rule == 'silent':
            why = 'لا عبارة نفاذ، وليس نظامًا (لا يلزم)'
        elif rule == 'publication_plus' and r.get('n'):
            n, unit = int(r['n']), r.get('unit') or 'days'
            if unit == 'days':
                eff = g(pub) + datetime.timedelta(days=n); basis = f'النشر + {n} يومًا'
            else:
                k = n * 12 if unit == 'years' else n
                eff = add_months(pub, k); basis = f"النشر + {n} {'سنة هجرية' if unit == 'years' else 'أشهر هجرية'}"
        elif rule == 'issue' and hij(r.get('issue_hijri')):
            eff, basis = g(hij(r['issue_hijri'])), 'من تاريخ الصدور/الموافقة'
        elif rule == 'explicit' and hij(r.get('explicit_hijri')):
            eff, basis = g(hij(r['explicit_hijri'])), 'تاريخ منصوص'
        elif rule == 'with_law' and r.get('law'):
            law = re.sub(r'\s*\(.*?\)\s*', ' ', r['law']).strip()
            hit = BACKED.get(law)
            if hit:
                le = datetime.date.fromisoformat(hit)
                eff, basis = (g(pub), f'من تاريخ نفاذ {law} ({hit})، وقد نُشر بعده فمن تاريخ نشره') if g(pub) > le else (le, f'من تاريخ نفاذ {law} (موثق في حكيم)')
            else:
                why = f'تابع لنفاذ «{law}» وتاريخه غير موثق'
        else:
            why = f"قاعدة {rule} بلا بيانات كافية"
    if why or not eff:
        held.append(dict(item=item, id=p['id'], name=p['name'], why=why or 'لا حساب'))
        continue
    cp = p.get('boe_card_pub')
    conflict = None
    if cp and not re.search(r'/0?1/0?1$', cp) and cp != p.get('boe_card_issue') and not cp.startswith('1440/03/21') and pub and hij(cp) != pub:
        conflict = f'بطاقة الهيئة: النشر {cp}، والقارئ: {r.get("pub_hijri")} ({r.get("pub_source")})'
    plan.append(dict(item=item, conflict=conflict, id=p['id'], name=p['name'], kind=p['kind'], stored=p['stored'], new=eff.isoformat(), basis=basis,
                     pub_hijri=r.get('pub_hijri'), pub_source=r.get('pub_source'), pub_url=r.get('pub_url'), uqn_issue_no=r.get('uqn_issue_no'),
                     clause=(r.get('clause_quote') or '')[:300], boe_card_issue=p.get('boe_card_issue'), boe_card_pub=p.get('boe_card_pub'),
                     confidence=r['confidence'], held_before=p['held_because'][:200], cls='confirm' if p['stored'] == eff.isoformat() else 'correct'))
json.dump({'plan': plan, 'held': held}, open(D / 'plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print('plan', len(plan), Counter(x['cls'] for x in plan), Counter(x['pub_source'] for x in plan), 'held', len(held))
print(Counter(h['why'][:28] for h in held).most_common())
