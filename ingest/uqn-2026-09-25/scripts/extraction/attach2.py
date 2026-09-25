import json,glob,re
from parse_articles import clean
from normlib import norm
P={}
for f in glob.glob('raw_dec/*.txt'):
    d=json.load(open(f))
    for r in d['results']: P[r['url']]=r
L=json.load(open('articles15.json'))+json.load(open('articles66.json'))
lawurls={l['url'] for l in L}
def body(r):
    t=clean(r['text']); t=re.sub(r'\*\*','',t); t=re.sub(r'جميع الحقوق محفوظة.*$','',t,flags=re.S); return re.sub(r'\n{2,}','\n',t).strip()
pages=[]
for u,r in P.items():
    if u in lawurls: continue
    t=body(r); pages.append((u,r.get('title','').strip(),t,norm(t)))
STOP={'نظام','تنظيم','ترتيبات','تنظيميه','اساس','في','بين','دول','مجلس','تعاون','خليج','عربيه','قانون','موحد','على','لدول','لل'}
res={}
for l in L:
    k=norm(l['law']); toks=[w for w in k.split() if w not in STOP and len(w)>2]
    dec=cm=None;news=None;best={'d':0,'c':0,'n':0}
    full=' '.join(w for w in k.split() if w not in {'نظام','تنظيم'})
    for u,title,t,nt in pages:
        clauses=re.findall(r'موافقه علي ([^\n]{0,220})',nt)
        if title.startswith(('الموافقة','تحويل','مجلس الوزراء يوافق')): clauses.append(norm(title))
        score=0
        for c in clauses:
            c=re.split(r'(?:بالصيغه|وفق الصيغه|المرافقه)',c)[0]
            if c.startswith(k) or c.startswith(full): score=max(score,3)
            elif full and full in c and len(toks)>=2: score=max(score,2)
            else:
                cov=sum(1 for w in toks if w in c)/max(len(toks),1)
                if cov>=0.8 and len(toks)>=3: score=max(score,2)
        pn=int(re.search(r'(\d+)$',l['url']).group(1))
        if 25115<=pn<=25125 and 'تنظيمات الهيئات الثقافية' in title: score=max(score,2)
        if not score: continue
        if '/news/' in u:
            if score>best['n']: news=(u,title,t); best['n']=score
            continue
        if 'مرسوم ملكي' in title or title.startswith('ملكي'):
            if score>best['d']: dec=(u,title,t); best['d']=score
        else:
            if score>best['c']: cm=(u,title,t); best['c']=score
    if not cm and news: cm=(news[0],news[1]+' [خبر جلسة مجلس الوزراء — ليست صفحة القرار]',news[2])
    res[l['url']]={'law':l['law'],'decree':dec,'cm':cm}
for u,v in res.items():
    if v['law']=='نظام الأسماء التجارية' and not v['decree']:
        v['decree']=next(x['decree'] for x in res.values() if x['law']=='نظام السجل التجاري')
print('decree',sum(1 for v in res.values() if v['decree']),'cm',sum(1 for v in res.values() if v['cm']),'none',sum(1 for v in res.values() if not(v['decree'] or v['cm'])))
for u,v in res.items():
    if not (v['decree'] and v['cm']): print(('D' if v['decree'] else '-')+('C' if v['cm'] else '-'),v['law'][:55],'|',(v['decree'][1][:35] if v['decree'] else ''),'|',(v['cm'][1][:45] if v['cm'] else ''))
json.dump(res,open('attach.json','w'),ensure_ascii=False,indent=1)
