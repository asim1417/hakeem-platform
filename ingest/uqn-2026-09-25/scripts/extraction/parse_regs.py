import json,glob,re,sys
sys.path.insert(0,'/home/claude/rasd_anzima')
import pandas as pd
from parse2 import parse as pm
from parse3 import parse_bunud
from parse_articles import clean
P={}
for f in glob.glob('regs/pages/*.json'):
    for r in json.load(open(f))['results']: P[r['url']]=r
R=pd.read_pickle('regs/list.pkl').drop_duplicates('الرابط')
out=[];stat=[]
for _,row in R.iterrows():
    u=row['الرابط']; r=P.get(u)
    if not r: stat.append((row['العنوان'],'لم يُجلب',0)); continue
    t=clean(r['text']); body=re.sub(r'^#.*\n','',t).strip()
    blen=len(re.sub(r'\s','',body))
    best=None
    for mode,fn in (('مواد',pm),('بنود',parse_bunud)):
        title,pre,arts=fn(r['text'])
        ns=[a['n'] for a in arts]
        ok= bool(ns) and ns==list(range(1,len(ns)+1))
        cand=(ok,len(arts),mode,pre,arts)
        if best is None or (cand[0],cand[1])>(best[0],best[1]): best=cand
    ok,n,mode,pre,arts=best
    if blen<300: st='بلا نص (صورة/PDF أو قالب فارغ)'
    elif ok and n>=2: st='مكتمل'
    elif n>=2: st='تسلسل غير منتظم — راجع'
    else: st='نص متصل بلا مواد'
    stat.append((row['العنوان'],st,n))
    out.append({'title':row['العنوان'],'type':row['النوع'],'published':row['التاريخ'],'url':u,'status':st,'numbering':mode,'preamble':pre[:3000],'full_text':body if st!='مكتمل' else '','articles':arts if st!='بلا نص (صورة/PDF أو قالب فارغ)' else [],'parent_in_hakeem':row.get('النظام_الأم_في_حكيم','')})
json.dump(out,open('regs/regs_parsed.json','w'),ensure_ascii=False,indent=1)
S=pd.DataFrame(stat,columns=['العنوان','الحالة','العدد'])
print(S['الحالة'].value_counts().to_dict(), 'مواد/بنود:',S[S['الحالة']=='مكتمل']['العدد'].sum())
print(S[S['الحالة']=='تسلسل غير منتظم — راجع']['العنوان'].str[:60].tolist()[:15])
