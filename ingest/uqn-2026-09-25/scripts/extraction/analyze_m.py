import json,glob,re,sys
sys.path.insert(0,'/home/claude/rasd_anzima')
import pandas as pd
from normlib import norm
from parse2 import parse as pm
from parse3 import parse_bunud
from parse_articles import clean
from difflib import SequenceMatcher
P={}
for f in glob.glob('pages_m/*.json'):
    for r in json.load(open(f))['results']: P[r['url']]=r
U=json.load(open('md_au_listing.json'))
H=pd.read_excel('../hakeem_list.xlsx','الأنظمة')['اسم النظام / الأداة'].astype(str).tolist()
REG=[x['title'] for x in json.load(open('../regs/regs_parsed.json'))]
REF=[(h,norm(h),'حكيم') for h in H]+[(h,norm(h),'لوائح أم القرى المجلوبة') for h in REG]
def best(nm):
    n=norm(nm); b=max(((h,SequenceMatcher(None,n,hn).ratio(),s) for h,hn,s in REF),key=lambda x:x[1]); return b
rows=[];regs=[]
for u in U:
    r=P.get(u['url'])
    if not r: continue
    t=clean(r['text']); body=re.sub(r'^#.*\n','',t).strip(); b2=re.sub(r'\*\*','',body)
    title=(r.get('title') or u['title']).strip()
    head=b2[:1500]
    # instrument meta
    m=re.search(r'(قرار[^\n]{0,80}?رقم\s*\(?\s*[\d/ ]+\)?\s*(?:و?بتاريخ|وتاريخ|في)\s*[\d/ ‏]+هـ)',(title+'\n'+head).translate(str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')))
    inst=m.group(1) if m else ''
    txt=title+' '+head
    amend=bool(re.search(r'تعديل|إضافة|حذف|إلغاء|استبدال',title)) or bool(re.search(r'(?:يقرر|قرر|يقرر ما يلي)[^\n]{0,40}\n?[^\n]{0,20}(?:أولاً|أولًا)?[:\s-]*(?:تعديل|إضافة|حذف|إلغاء)',head))
    # affected / subject instrument name
    names=re.findall(r'((?:اللائحة|لائحة|قواعد|القواعد|ضوابط|الضوابط|نظام|النظام|تنظيم|الإجراءات|إجراءات|الدليل|دليل|المعايير|معايير|جدول|تعليمات|التعليمات)\s[^،,\n\(\)«»:]{3,110}?)(?=\s*(?:،|,|\s+الصادر|\s+الصادرة|\s+المعتمد|\s+لتكون|\s+ليكون|\s+بالنص|\s+بالصيغة|\s+وفق|\s+على النحو|\.|\n|\s+وذلك|$))',txt)
    subj=''
    for nm in names:
        if len(nm)>12: subj=nm.strip(); break
    arts=[];mode=''
    for md,fn in (('مواد',pm),('بنود',parse_bunud)):
        _,_,a=fn(r['text']); ns=[x['n'] for x in a]
        if ns and ns==list(range(1,len(ns)+1)) and len(a)>len(arts): arts,mode=a,md
    if amend: kind='تعديل/إلغاء'
    elif len(arts)>=3: kind='لائحة/قواعد بمواد'
    elif re.search(r'اعتماد|الموافقة على|إصدار',title) and re.search(r'لائحة|قواعد|ضوابط|دليل|معايير|تعليمات|إجراءات',title): kind='اعتماد لائحة/قواعد (نص بلا مواد مرقمة)'
    elif re.search(r'مواصفة|مواصفات|اللائحة الفنية|لائحة فنية',title): kind='مواصفات ولوائح فنية'
    elif re.search(r'تسجيل عيني|إعلان|تعيين|ترخيص|تصنيف|نزع ملكية|تسمية|تحديد',title): kind='قرار فردي/إعلان'
    else: kind='أخرى'
    b=best(subj) if subj else ('',0,'')
    rows.append({'القسم':'قرار وزاري' if 'ministerial' in u['section'] else 'هيئات','تاريخ النشر':u['date'][:10].strip(),'العنوان':title,'الأداة':inst,'التصنيف':kind,'الأداة المعنية':subj,'أقرب مقابل':b[0] if b[1]>=0.85 else '','موجود في':b[2] if b[1]>=0.85 else ('غير موجود' if subj else ''),'التشابه':round(b[1],2),'عدد المواد':len(arts),'الترقيم':mode,'مقتطف':b2[:500],'الرابط':u['url']})
    if kind=='لائحة/قواعد بمواد':
        regs.append({'title':title,'instrument':inst,'published':u['date'][:10].strip(),'url':u['url'],'numbering':mode,'articles':arts,'in':b[2] if b[1]>=0.85 else 'غير موجود'})
D=pd.DataFrame(rows); D.to_pickle('md_au.pkl'); json.dump(regs,open('md_au_regs.json','w'),ensure_ascii=False)
print(len(D)); print(D['التصنيف'].value_counts().to_dict())
print(pd.crosstab(D['التصنيف'],D['موجود في']))
