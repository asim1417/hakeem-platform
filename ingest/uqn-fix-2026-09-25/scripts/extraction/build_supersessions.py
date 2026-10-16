import json, re, datetime, warnings
warnings.filterwarnings('ignore')
from hijri_converter import Hijri, Gregorian
D='/home/claude/pkg/hakeem-uqn-ingest/data/'
laws={json.loads(l)['title']:json.loads(l) for l in open(D+'laws.jsonl')}
cm={r['url']:r['text'] for r in json.load(open('raw/cm_approvals.txt'))['results']}
def h2g(h):
    y,m,d=map(int,h.split('-')); return Hijri(y,m,d).to_gregorian()
def g2h(g):
    h=Gregorian(g.year,g.month,g.day).to_hijri(); return f"{h.year:04d}-{h.month:02d}-{h.day:02d}"
AR={'ثلاثين':30,'تسعين':90,'مائة وعشرين':120,'مائة وثمانين':180,'180':180}
def eff(pub, clause):
    m=re.search(r'بعد\s*(?:مضي\s*)?\(?\s*(\d+)?\s*\)?\s*\(?(ثلاثين|تسعين|مائة وعشرين|مائة وثمانين)?\)?\s*يوم|بمضي\s*\((مائة وثمانين|تسعين)\)',clause or '')
    g=h2g(pub)
    if m:
        n=int(m.group(1)) if m.group(1) else AR[m.group(2) or m.group(3)]
        e=g+datetime.timedelta(days=n); return g2h(e), e.isoformat(), f'النشر + {n} يومًا (محسوب)'
    return pub, g.isoformat(), 'من تاريخ النشر'
def law_quote(title, num):
    w=laws[title]; u=[u for u in w['units'] if u['unit_type'] in('article','clause') and u['number']==num][0]
    lines=[l.strip() for l in u['text'].split('\n') if re.search('محل|يُ?لغِ?ي',l)]
    return (lines[0] if lines else u['text'].strip()), w['source_url'], f'المادة {num}'
def cm_quote(url, start):
    t=cm[url]; i=t.index(start); j=t.find('.',i); q=t[i:j+1]
    no=re.search(r'قرار رقم \((\d+)\) وتاريخ ([\d /]+)هـ',t)
    return q, url, f"قرار مجلس الوزراء رقم ({no.group(1)}) وتاريخ {no.group(2).replace(' ','')}هـ — البند {start.split(':')[0]}"
def decree_quote(title, start):
    w=laws[title]; u=[u for u in w['units'] if u['unit_type']=='enacting_instrument'][0]; t=u['text']; i=t.index(start); j=t.find('.',i)
    return t[i:j+1], w['source_url'], 'المرسوم الملكي — البند '+start.split(':')[0]
R=[]
def add(old_title, old_code, old_instr, new_title, q, kind='replace', notes='', eff_override=None):
    w=laws.get(new_title); pub=w['published_hijri'] if w else None
    ef = eff_override or eff(pub, w.get('effective_clause') if w else '')
    R.append(dict(old_title=old_title, old_hakeem_code=old_code, old_instrument=old_instr, new_title=new_title,
        new_source_url=w['source_url'] if w else None, relation=kind, evidence_quote=q[0], evidence_url=q[1], evidence_location=q[2],
        published_hijri=pub, effective_from_hijri=ef[0], effective_from_gregorian=ef[1], effective_rule=ef[2],
        status='proven', notes=notes))
add('نظام التنفيذ','ENF-002','م/53 وتاريخ 1433/8/13هـ','نظام التنفيذ',law_quote('نظام التنفيذ',65),notes='الربط بالنسخة القديمة في حكيم؛ النظام الجديد عمل مستقل')
add('نظام السجل التجاري','COM-014','م/1 وتاريخ 1416/2/21هـ','نظام السجل التجاري',law_quote('نظام السجل التجاري',29))
add('نظام الأسماء التجارية','COM-015','م/15 وتاريخ 1420/8/12هـ','نظام الأسماء التجارية',law_quote('نظام الأسماء التجارية',23))
add('نظام نزع ملكية العقارات للمنفعة العامة ووضع اليد المؤقت على العقار','RES-008','م/15 وتاريخ 1424/3/11هـ','نظام نزع ملكية العقارات للمصلحة العامة ووضع اليد المؤقت على العقارات',law_quote('نظام نزع ملكية العقارات للمصلحة العامة ووضع اليد المؤقت على العقارات',37),notes='لائحته التنفيذية ENF-007 لا تُلغى بهذا النص؛ حالتها تحتاج دليلًا مستقلًا')
add('نظام تملك غير السعوديين للعقار واستثماره','RES-016','م/15 وتاريخ 1421/4/17هـ','نظام تملك غير السعوديين للعقار',law_quote('نظام تملك غير السعوديين للعقار',14))
add('نظام الاستثمار الأجنبي','REG-097','م/1 وتاريخ 1421/1/5هـ','نظام الاستثمار',law_quote('نظام الاستثمار',16),kind='repeal')
add('نظام حماية حقوق المؤلف','IPR-003','م/41 وتاريخ 1424/7/2هـ','نظام حقوق المؤلف',law_quote('نظام حقوق المؤلف',59))
add('نظام النقل بالخطوط الحديدية','REG-027','م/33 وتاريخ 1433/5/24هـ','نظام الخطوط الحديدية',decree_quote('نظام الخطوط الحديدية','ثانياً:'))
add('نظام الإحصاءات العامة للدولة','REG-112','رقم (23) وتاريخ 1379/12/7هـ','نظام الإحصاء',law_quote('نظام الإحصاء',21))
add('نظام تعداد السكان العام','REG-254','م/13 وتاريخ 1391/4/23هـ','نظام الإحصاء',law_quote('نظام الإحصاء',21))
add('تنظيم الهيئة الوطنية لمكافحة الفساد','CRM-012','قرار مجلس الوزراء رقم (165) وتاريخ 1432/5/28هـ','نظام هيئة الرقابة ومكافحة الفساد',cm_quote('https://www.uqn.gov.sa/details?p=25316','تاسعاً:'),kind='repeal')
add('نظام تأديب الموظفين',None,'م/7 وتاريخ 1391/2/1هـ','نظام هيئة الرقابة ومكافحة الفساد',cm_quote('https://www.uqn.gov.sa/details?p=25316','سادساً:'),kind='repeal_with_saving',notes='تبقى المادة 47 سارية إلى صدور اللائحة الإدارية — لا تُوسم ملغاة')
add('نظام مكتبة الملك فهد الوطنية','ADM-044','م/9 وتاريخ 1410/5/13هـ','تنظيم مكتبة الملك فهد الوطنية',cm_quote('https://www.uqn.gov.sa/decisions-and-regulations/council-of-ministers-decisions/4000668','ثانياً:'))
_t=cm['https://www.uqn.gov.sa/decisions-and-regulations/4001668']; _m=re.search(r'قرار رقم \((\d+)\) وتاريخ ([\d /]+)هـ',_t); _p=[int(x) for x in re.findall(r'\d+',_m.group(2))]
_ad=f"{_p[2]:04d}-{_p[1]:02d}-{_p[0]:02d}" if _p[0]<100 else f"{_p[0]:04d}-{_p[1]:02d}-{_p[2]:02d}"
add('الترتيبات التنظيمية للهيئة العامة للطرق',None,'قرار مجلس الوزراء رقم (14) وتاريخ 1444/1/4هـ','تنظيم الهيئة العامة للطرق',cm_quote('https://www.uqn.gov.sa/decisions-and-regulations/4001668','ثانيًا:'),eff_override=(_ad,h2g(_ad).isoformat(),'من تاريخ الموافقة (تاريخ قرار مجلس الوزراء)'))
add('الترتيبات التنظيمية لهيئة الصحة العامة','HLT-024','قرار مجلس الوزراء رقم (401) وتاريخ 1442/7/18هـ','تنظيم هيئة الصحة العامة',cm_quote('https://www.uqn.gov.sa/details?p=24964','ثانياً:'))
add('الترتيبات التنظيمية للمركز الوطني لسلامة النقل','REG-203','قرار مجلس الوزراء رقم (340) وتاريخ 1444/5/5هـ','تنظيم المركز الوطني لسلامة النقل',cm_quote('https://www.uqn.gov.sa/details?p=27462','ثانياً:'))
R.append(dict(old_title='نظام مدينة الملك عبدالله للطاقة الذرية والمتجددة', old_hakeem_code='REG-120', old_instrument=None,
    new_title='تنظيم مدينة الملك عبدالله للطاقة الذرية والمتجددة', new_source_url=laws['تنظيم مدينة الملك عبدالله للطاقة الذرية والمتجددة']['source_url'],
    relation='replace', evidence_quote=None, evidence_url='https://www.uqn.gov.sa/details?p=19806', evidence_location='قرار مجلس الوزراء رقم (628) وتاريخ 1443/11/15هـ — لا يتضمن نص إلغاء أو إحلال',
    published_hijri='1443-12-30', effective_from_hijri=None, effective_from_gregorian=None, effective_rule=None,
    status='not_proven', notes='لا نص صريح في قرار الموافقة ولا في التنظيم. لا يوسم النظام القديم ولا مواده «ملغى» أو «مستبدل». يُعرض التنظيم الجديد بجانبه مع تنبيه، ويُرفع للمالك.'))
TODAY=datetime.date.today()
for r in R:
    if r.get('effective_from_gregorian'):
        r['in_force_as_of_build']= datetime.date.fromisoformat(r['effective_from_gregorian'])<=TODAY
        r['build_date']=TODAY.isoformat()
with open('data/supersessions_verified.jsonl','w',encoding='utf-8') as f:
    for r in R: f.write(json.dumps(r,ensure_ascii=False)+'\n')
for r in R: print(r.get('in_force_as_of_build'),r['status'],r['relation'],'|',r['old_title'][:40],'→',r['new_title'][:35],'|',r['effective_from_hijri'],r['effective_rule'],'|',(r['evidence_quote'] or '')[:90])
