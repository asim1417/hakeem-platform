import json,glob,re,sys
sys.path.insert(0,'..')
from normlib import norm
import pandas as pd
AR=str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')
P={}
for f in glob.glob('pages/*.json'):
    for r in json.load(open(f))['results']: P[r['url']]=r
U=json.load(open('all_listing.json'))
H=pd.read_excel('../hakeem_list.xlsx','الأنظمة')['اسم النظام / الأداة'].astype(str).tolist()
HN=[(h,norm(h)) for h in H]
NEW=[l['law'] for l in json.load(open('../articles15.json'))+json.load(open('../articles66.json'))]
def body(t):
    t=re.sub(r'\*\*','',t); t=re.sub(r'جميع الحقوق محفوظة.*$','',t,flags=re.S)
    i=t.find('\n# '); t=t[i+1:] if i>=0 else t
    return re.sub(r'\n{2,}','\n',t).strip().translate(AR)
def operative(t):
    m=re.search(r'(رسمنا بما هو آت|يقرر ما يلي|يقرر ما يأتي|يقرر|أمرنا بما هو آت)\s*:?',t)
    return t[m.end():] if m else t
LAW=re.compile(r'((?:النظام|نظام|تنظيم|الترتيبات التنظيمية|اللائحة التنفيذية|لائحة|اللائحة)\s[^،,\n]{3,110}?)(?:،|,)?\s*(?:الصادر|الصادرة|الموافق عليه|الموافق عليها)\s*(?:ب|بموجب\s)?(?:ال)?(?:مرسوم الملكي|أمر الملكي|قرار مجلس الوزراء|مرسوم ملكي|قرار)\s*(?:رقم)?\s*\(?\s*([مأ]?\s*/?\s*\d+)\s*\)?\s*(?:و?بتاريخ|وتاريخ)\s*([\d/ ]+)هـ')
ACT=[('إلغاء',r'إلغاء|يلغي|تلغى|يُلغى'),('إحلال',r'يحل|تحل|إحلال'),('حذف',r'حذف'),('إضافة',r'إضافة|تضاف|يضاف'),('تعديل',r'تعديل|يعدل|تُعدل|استبدال|يستبدل'),('إصدار',r'الموافقة على|نحن .* رسمنا')]
def best_h(name):
    n=norm(name); from difflib import SequenceMatcher
    b=max(((h,SequenceMatcher(None,n,hn).ratio()) for h,hn in HN),key=lambda x:x[1])
    return b
rows=[]
for u in U:
    if u['kind']=='أخرى': continue
    r=P.get(u['url']); 
    if not r: rows.append({'القسم':u['section'],'العنوان':u['title'],'الرابط':u['url'],'ملاحظة':'لم يُجلب'}); continue
    t=body(r['text']); op=operative(t)
    title=r.get('title',u['title'])
    num=re.search(r'(?:قرار|أمر ملكي|مرسوم ملكي)\s*رقم\s*\(\s*([مأ]?\s*/?\s*\d+)\s*\)\s*(?:و?بتاريخ|وتاريخ)\s*([\d/ ‏]+)هـ',(title+'\n'+t[:300]).translate(AR))
    found=[];seen=set()
    L2=re.compile(r'(?:من|على|محل|في)\s+((?:النظام|نظام|تنظيم|الترتيبات التنظيمية|اللائحة التنفيذية|لائحة|اللائحة)\s[^،,\n\(\)«»]{3,100}?)(?=\s*(?:،|,|\s+الصادر|\s+الصادرة|\s+لتكون|\s+ليكون|\s+بالنص|\s+بالصيغة|\s+وفق|\s+على النحو|\.|\n|\s+وذلك|\s+وتعديلاته))')
    for rx in (LAW,L2):
        for m in rx.finditer(op):
            nm=re.sub(r'^(?:من|على)\s+','',m.group(1)).strip()
            nm=re.sub(r'\s+(?:وتعديلاته|المشار إليه.*)$','',nm)
            win=op[max(0,m.start()-160):m.start()]
            # nearest clause start
            cs=max([win.rfind(x) for x in ['أولاً','أولًا','ثانياً','ثانيًا','ثالثاً','ثالثًا','رابعاً','رابعًا','خامساً','خامسًا','سادساً','سادسًا','سابعاً','سابعًا','ثامناً','ثامنًا','\n']]+[0])
            ctx=win[cs:]
            acts=[a for a,p in ACT if re.search(p,ctx)]
            if not acts: continue
            if re.search(r'بعد الاطلاع|وبعد النظر',ctx): continue
            key=(acts[0],norm(nm)[:40])
            if key in seen: continue
            seen.add(key)
            ino=m.group(2).replace(' ','') if rx is LAW else ''; idt=m.group(3).replace(' ','') if rx is LAW else ''
            found.append((acts[0],nm,ino,idt,(ctx+op[m.start():m.end()+250]).strip()[:500]))
    for m in re.finditer(r'الموافقة على ((?:مشروع )?(?:تعديل )?(?:النظام|نظام|تنظيم|الترتيبات التنظيمية|اللائحة|لائحة|قواعد|القواعد)[^،,\n]{3,140}?)(?=،|,|\s+بالصيغة|\s+وفق|\.|\n)',op):
        nm=m.group(1).strip(); a='تعديل' if nm.startswith(('تعديل','مشروع تعديل')) else 'إصدار'
        nm=re.sub(r'^(?:مشروع )?(?:تعديل )?','',nm)
        key=(a,norm(nm)[:40])
        if key in seen: continue
        seen.add(key); found.append((a,nm,'','',op[max(0,m.start()-20):m.end()+200]))
    for act,nm,ino,idt,snip in found or [('—','','','',op[:300])]:
        hb=best_h(nm) if nm else ('',0)
        innew=any(norm(nm)[:25] in norm(x) or norm(x)[:25] in norm(nm) for x in NEW) if nm else False
        rows.append({'القسم':{'council-of-ministers-decisions':'قرار مجلس الوزراء','royal-decrees':'مرسوم ملكي','royal-orders':'أمر ملكي'}[u['section']],
          'رقم الأداة':num.group(1).replace(' ','') if num else '','تاريخ الأداة':re.sub(r'[\s‏]','',num.group(2)) if num else '','تاريخ النشر':u['date'][:10],
          'العنوان':title,'الإجراء':act,'النظام/الأداة المتأثرة':nm,'سند النظام المتأثر':(ino+' '+idt).strip(),
          'في حكيم':('موجود' if hb[1]>=0.9 else 'محتمل' if hb[1]>=0.8 else ('ضمن الـ81 الجديدة' if innew else 'غير موجود')) if nm else '',
          'أقرب اسم في حكيم':hb[0] if nm and hb[1]>=0.8 else '','ضمن الـ81':'نعم' if innew else '','النص':snip,'الرابط':u['url']})
D=pd.DataFrame(rows); D.to_pickle('analysis.pkl')
print(len(D)); print(D['الإجراء'].value_counts().to_dict()); print(D['في حكيم'].value_counts().to_dict())
