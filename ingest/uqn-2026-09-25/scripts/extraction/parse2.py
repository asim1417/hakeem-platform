import json,re
from parse_articles import ordnum,clean
AR=str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')
H=re.compile(r'\**\s*(?<![ء-ي])(?:ال)?مادة\s*(?:\(\s*([0-9٠-٩]+)\s*\)|([0-9٠-٩]+)|([ء-ي ]{3,45}?))\s*\**\s*[:：]\s*\**')
SEC=re.compile(r'(?:^|\n)\s*\**\s*((?:الباب|الفصل|الفرع|القسم)\s+[ء-ي]+(?:\s+[ء-ي]+){0,2})\s*\**\s*[:：]?\s*\**\s*\n+\s*\**([^\n]{2,90})?')
def parse(text):
    t=clean(text)
    title=t.split('\n')[0].lstrip('# ').strip()
    ms=[]
    for m in H.finditer(t):
        n=m.group(1) or m.group(2)
        n=int(n.translate(AR)) if n else ordnum(m.group(3))
        if n is None: continue
        # must be heading-like: at line start or preceded by '**' or '.'/':' inline
        pre=t[max(0,m.start()-3):m.start()]
        g=m.group(0); lead=g[:g.find('مادة')]
        if not (m.start()==0 or '\n' in lead or '*' in lead or '\n' in pre or '*' in t[m.start():m.start()+2] or re.search(r'[\.\:\)]\s*$',pre)): continue
        ms.append((m.start(),m.end(),n,m.group(0).strip('* :')))
    secs=[(m.start(),m.group(1).strip(),(m.group(2) or '').strip('* ')) for m in SEC.finditer(t)]
    arts=[]
    for i,(s,e,n,lab) in enumerate(ms):
        end=ms[i+1][0] if i+1<len(ms) else len(t)
        body=t[e:end]
        # strip trailing section headings that belong to next article
        cut=[sp for sp,_,_ in secs if e<sp<end]
        if cut: body=t[e:min(cut)]
        body=re.sub(r'\*\*','',body); body=re.sub(r'\n{2,}','\n',body).strip()
        bab=fasl=''
        for sp,h,sub in secs:
            if sp<s:
                lab2=h+(' — '+sub if sub and not sub.startswith('المادة') else '')
                if h.startswith('الباب'): bab=lab2; fasl=''
                else: fasl=lab2
        arts.append({'n':n,'label':lab,'bab':bab,'fasl':fasl,'text':body})
    pre=t[:ms[0][0]] if ms else t
    return title,pre.strip(),arts
if __name__=='__main__':
  out=[]
  for f in ['raw1.txt','raw2.txt']:
      for r in json.load(open(f))['results']:
          title,pre,arts=parse(r['text'])
          ns=[a['n'] for a in arts]
          mx=max(ns) if ns else 0
          gaps=[i for i in range(1,mx+1) if i not in ns]
          seq_bad=sum(1 for a,b in zip(ns,ns[1:]) if b!=a+1)
          print(f"{title[:40]:40} | {len(arts):3} مادة | أعلى {mx:3} | فجوات {gaps[:6]} | خلل تسلسل {seq_bad} | أقصر {min((len(a['text']) for a in arts),default=0)}")
          out.append({'law':title,'url':r['url'],'pre':pre,'articles':arts})
  json.dump(out,open('articles15.json','w'),ensure_ascii=False,indent=1)
