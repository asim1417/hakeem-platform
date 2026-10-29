#!/usr/bin/env python3
"""gap025 (HKM-052): تصنيف كل نظام بلا مصدر لتاريخ نفاذه (849 في 30/10)، بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية».

المدخلات (قراءة من الإنتاج): unbacked.json (النظام، والمخزن، وبطاقة الهيئة إن وُجدت، وعبارات النفاذ من النص الساري بلا تشكيل)،
وheads.json (رأس الديباجة ومصدر الإدخال للأنظمة بلا بطاقة هيئة).
المصدر الرسمي للنشر: بطاقة هيئة الخبراء إن لم يكن تاريخها نائبًا، وإلا تاريخ صفحة أم القرى في رأس الديباجة («yyyy-m-d الموافق dd-mm-yyyy»)
لما أُدخل من أم القرى. القاعدة من عبارة النفاذ الخاصة بالصك نفسه (لا لائحته ولا قوائمه):
  pub: «من تاريخ نشره/نشرها»، plus: «بعد N … من تاريخ نشره»، issue: «من تاريخ صدوره/صدورها»،
  silent: لا عبارة → للنظام والتنظيم من النشر (م71 من النظام الأساسي)؛ ولغيرهما لا يلزم تاريخ نفاذ (ملاحظة المالك 29/10) فيُترك.
  other: ما سوى ذلك (معلّق على لائحة أو إقرار أو تاريخ منصوص) → قارئ.
المخرج plan.json: confirm (المحسوب = المخزن)، correct (يخالفه)، hold (بسبب)، skip (لا يلزم).
"""
import datetime, json, re, warnings
from collections import Counter
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = Path(__file__).parent
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
WORDS = {'عشرة': 10, 'خمسة عشر': 15, 'عشرين': 20, 'ثلاثين': 30, 'خمسة وأربعين': 45, 'ستين': 60, 'تسعين': 90, 'مائة وعشرين': 120, 'مئة وعشرين': 120,
         'مائة وخمسين': 150, 'مائة وثمانين': 180, 'مئة وثمانين': 180, 'مائة وثمانيين': 180, 'ثلاثمائة وستين': 360, 'ثلاثمائة وخمسة وستين': 365}
MONTHS = {'شهر': 1, 'شهرين': 2, 'ثلاثة أشهر': 3, 'ثلاثة اشهر': 3, 'أربعة أشهر': 4, 'ستة أشهر': 6, 'ستة اشهر': 6, 'تسعة أشهر': 9,
          'ثمانية عشر شهرا': 18, 'اثني عشر شهرا': 12}
# الإشارة إلى الصك نفسه بحسب نوعه، لئلا تُؤخذ عبارة نفاذ النظام المنقولة في لائحته (أو العكس)
SELF_BY_KIND = {
    'نظام': r'(?:بهذا النظام|هذا النظام|بالنظام|به)', 'تنظيم': r'(?:بهذا التنظيم|هذا التنظيم|بالتنظيم|به)',
    'ترتيبات تنظيمية': r'(?:بهذه الترتيبات|بالترتيبات|بها)', 'لائحة': r'(?:بهذه اللائحة|هذه اللائحة|باللائحة|بها)',
    'قواعد': r'(?:بهذه القواعد|بالقواعد|بهذه الضوابط|بالضوابط|بها)', 'دليل': r'(?:بهذا الدليل|بالدليل|به)',
    'سياسة': r'(?:بهذه السياسة|بالسياسة|بها)', 'قرار': r'(?:بهذا القرار|بالقرار|به)',
}
SELF_ANY = r'(?:بهذا النظام|هذا النظام|بالنظام|بهذه اللائحة|هذه اللائحة|باللائحة|بهذا التنظيم|بالتنظيم|بهذه القواعد|بالقواعد|بهذه الضوابط|بالضوابط|بهذا القرار|بالقرار|بالترتيبات|بالدليل|به|بها)'
SELF = SELF_ANY
LAW_KINDS = {'نظام', 'تنظيم', 'ترتيبات تنظيمية'}


def hij(s):
    n = [int(x) for x in re.findall(r'\d+', (s or '').translate(AR))][:3]
    return tuple(n) if len(n) == 3 and 1300 < n[0] < 1500 else None


def g(t):
    try:
        return Hijri(*t).to_gregorian()
    except Exception:
        return None


def add_months(t, n):
    y, m, d = t
    m0 = m - 1 + n
    y, m = y + m0 // 12, m0 % 12 + 1
    try:
        return Hijri(y, m, d).to_gregorian()
    except ValueError:
        return Hijri(y, m, 29).to_gregorian()


def placeholder(ih, ph):
    return bool(re.search(r'/0?1/0?1$', ph or '')) or ((ph or '').startswith('1440/03/21') and (ih or '9999') < '1440')


def rule_of(clauses, kind=None):
    """يعيد (rule, n, unit, quote)؛ rule ∈ pub, plus, issue, other, None."""
    if not clauses:
        return (None, 0, None, '')
    SELF = SELF_BY_KIND.get(kind, SELF_ANY)
    for c in clauses.split(' || '):
        t = re.sub(r'\s+', ' ', c.split(': ', 1)[-1].translate(AR).replace('(', ' ').replace(')', ' '))
        m = re.search(r'(?:يعمل|ينفذ|يسري|تسري)\s+' + SELF + r'[^.]{0,40}?(?:بعد (?:مضي |انقضاء )?|بمضي |بانقضاء )(.{1,40}?) من (?:تاريخ )?نشر', t)
        if m:
            p = m.group(1).strip()
            if re.fullmatch(r'سنة(?: واحدة)?|عام', p):
                return ('plus', 12, 'months', t)
            if p in MONTHS:
                return ('plus', MONTHS[p], 'months', t)
            md = re.fullmatch(r'(\d+) (?:يوما|يوم|أيام)', p)
            if md:
                return ('plus', int(md.group(1)), 'days', t)
            mw = re.fullmatch(r'(.+?) (?:يوما|يوم)', p)
            if mw and mw.group(1) in WORDS:
                return ('plus', WORDS[mw.group(1)], 'days', t)
            return ('other', 0, None, t)
        if re.search(r'(?:يعمل|ينفذ|يسري|تسري)\s+' + SELF + r'[^.]{0,40}?(?:اعتبارا )?من (?:تاريخ|يوم) (?:نشره|نشرها|النشر|نشر)', t):
            return ('pub', 0, 'days', t)
        if re.search(r'(?:يعمل|ينفذ|يسري|تسري)\s+' + SELF + r'[^.]{0,40}?(?:اعتبارا )?من تاريخ (?:صدوره|صدورها)', t):
            return ('issue', 0, 'days', t)
        if re.search(r'(?:يعمل|ينفذ|يسري|تسري)\s+' + SELF, t):
            return ('other', 0, None, t)
    return (None, 0, None, '')


U = json.load(open(D / 'unbacked.json', encoding='utf-8'))
H = json.load(open(D / 'heads.json', encoding='utf-8'))
DC = json.load(open(D / 'decree_clauses.json', encoding='utf-8'))
plan = []
for x in U:
    rule, n, unit, quote = rule_of(x['cl'], x['k'])
    if rule is None:  # لا عبارة في المواد: عبارة الأداة (المرسوم أو القرار) في نص الهيئة أو الديباجة
        dc = DC.get(x['id']) or {}
        for part in (dc.get('boe'), dc.get('pre')):
            if part:
                r2 = rule_of(' || '.join('0: ' + c for c in part.split(' || ')), x['k'])
                if r2[0] is None:
                    r2 = rule_of(' || '.join('0: ' + c for c in part.split(' || ')), None)
                if r2[0]:
                    rule, n, unit, quote = r2[0], r2[1], r2[2], 'الأداة: ' + r2[3]
                    break
    src, pub, iss, url = None, None, None, x.get('url')
    if x.get('guid') and not placeholder(x['ih'], x['ph']):
        src, pub, iss = 'boe', hij(x['ph']), hij(x['ih'])
    elif not x.get('guid'):
        h = H.get(x['id']) or {}
        m = re.search(r'\n\n(\d{4})-(\d{1,2})-(\d{1,2})\nالموافق\n(\d{2})-(\d{2})-(\d{4})', h.get('head') or '')
        su = re.search(r'uqn\|(\S+)', h.get('src') or '')
        if m and su:
            src, pub, url = 'uqn', (int(m.group(1)), int(m.group(2)), int(m.group(3))), su.group(1).rstrip(';')
            gm = datetime.date(int(m.group(6)), int(m.group(5)), int(m.group(4)))
            if g(pub) != gm:
                src = None  # التاريخان في الرأس لا يتطابقان بتقويم أم القرى
    rec = dict(id=x['id'], name=x['name'], kind=x['k'], stored=x['eff'][:10] if x['eff'] else None, src=src, url=url, rule=rule, n=n, unit=unit,
               quote=quote[:300], pub=pub, issue=iss)
    if rule is None and x['k'] not in LAW_KINDS:
        rec['class'] = 'skip'; rec['why'] = 'لا عبارة نفاذ، وليس نظامًا ولا تنظيمًا (لا يلزم تاريخ نفاذ)'
    elif src is None or pub is None:
        rec['class'] = 'hold'; rec['why'] = 'لا تاريخ نشر رسمي غير نائب (لا بطاقة هيئة صالحة ولا صفحة أم القرى في الرأس)'
    elif rule == 'other':
        rec['class'] = 'hold'; rec['why'] = 'عبارة نفاذ غير مباشرة'
    elif rule == 'issue' and not iss:
        rec['class'] = 'hold'; rec['why'] = 'من تاريخ الصدور ولا تاريخ صدور رسمي'
    else:
        if iss and g(pub) and g(iss) and not (0 <= (g(pub) - g(iss)).days <= 120):
            rec['class'] = 'hold'; rec['why'] = f'النشر بعد الصدور بـ{(g(pub) - g(iss)).days} يومًا'
        else:
            if rule == 'issue':
                eff = g(iss)
            elif rule == 'plus':
                eff = g(pub) + datetime.timedelta(days=n) if unit == 'days' else add_months(pub, n)
            else:  # pub أو silent لنظام/تنظيم
                eff = g(pub)
            rec['new'] = eff.isoformat()
            rec['basis'] = {'pub': 'من تاريخ النشر', 'plus': f"النشر + {n} {'يومًا' if unit == 'days' else 'أشهر هجرية'}", 'issue': 'من تاريخ الصدور',
                            None: 'سكت النص: من النشر (م71 من النظام الأساسي)'}[rule]
            rec['class'] = 'confirm' if rec['stored'] == rec['new'] else ('correct' if rec['stored'] else 'fill')
    plan.append(rec)
json.dump(plan, open(D / 'plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(Counter(p['class'] for p in plan))
print(Counter((p['class'], p['src']) for p in plan))
print(Counter((p['class'], p['rule']) for p in plan if p['class'] in ('confirm', 'correct', 'fill')))
print(Counter(p['why'][:40] for p in plan if p['class'] == 'hold').most_common())
