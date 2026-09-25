import json,re
ONES={'الأولى':1,'الحادية':1,'الثانية':2,'الثالثة':3,'الرابعة':4,'الخامسة':5,'السادسة':6,'السابعة':7,'الثامنة':8,'التاسعة':9,'العاشرة':10}
TENS={'العشرون':20,'الثلاثون':30,'الأربعون':40,'الخمسون':50,'الستون':60,'السبعون':70,'الثمانون':80,'التسعون':90}
def ordnum(s):
    s=re.sub(r'[ً-ْ]','',s).strip().replace('أ','أ')
    s=s.replace('بعد المائة','بعد المائة').strip()
    base=0
    if 'بعد المائتين' in s: base=200; s=s.replace('بعد المائتين','').strip()
    elif 'بعد المائة' in s: base=100; s=s.replace('بعد المائة','').strip()
    if s in ('المائة',): return 100
    if s in ('المائتان','المائتين'): return 200
    if s=='' and base: return base
    m=re.fullmatch(r'(\S+)\s+عشرة',s)
    if m and m.group(1) in ONES: return base+10+ONES[m.group(1)]
    if s in ONES: return base+ONES[s]
    if s in TENS: return base+TENS[s]
    m=re.fullmatch(r'(\S+)\s+و(\S+)',s)
    if m and m.group(1) in ONES and ('ال'+m.group(2)[2:] if m.group(2).startswith('ال') else m.group(2)) in TENS:
        return base+ONES[m.group(1)]+TENS[m.group(2)]
    m2=re.fullmatch(r'(\S+)\s+و(ال\S+)',s)
    if m2 and m2.group(1) in ONES and m2.group(2) in TENS: return base+ONES[m2.group(1)]+TENS[m2.group(2)]
    return None
HEAD=re.compile(r'^\s*\**\s*(?:ال)?مادة\s*(?:\(\s*([0-9٠-٩]+)\s*\)|([0-9٠-٩]+)|([^:\*\n]{2,40}?))\s*\**\s*[:：]?\s*\**\s*(.*)$')
def clean(t):
    t=t.replace('\\_','_')
    # cut boilerplate
    i=t.find('\n# '); t=t[i+1:] if i>=0 else t
    j=t.find('{{'); t=t[:j] if j>=0 else t
    return t
def parse(text):
    lines=clean(text).split('\n')
    title=lines[0].lstrip('# ').strip()
    arts=[];cur=None;bab='';fasl='';pre=[]
    for ln in lines[1:]:
        s=ln.strip().strip('*').strip()
        if not s: continue
        if re.match(r'^(الباب|الفصل|الفرع|القسم)\s',s) and len(s)<120:
            if s.startswith('الباب'): bab=s; fasl=''
            else: fasl=s
            if cur: pass
            continue
        m=HEAD.match(ln.strip())
        if m and (m.group(1) or m.group(2) or (m.group(3) and ordnum(m.group(3)) is not None)):
            n=m.group(1) or m.group(2)
            n=int(n.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789'))) if n else ordnum(m.group(3))
            cur={'n':n,'label':s.split(':')[0].strip(),'bab':bab,'fasl':fasl,'text':[m.group(4).strip()] if m.group(4).strip() else []}
            arts.append(cur); continue
        if cur: cur['text'].append(s)
        else: pre.append(s)
    for a in arts: a['text']='\n'.join(a['text']).strip()
    return title,pre,arts
if __name__=='__main__':
    out=[]
    for f in ['raw1.txt','raw2.txt']:
        for r in json.load(open(f))['results']:
            title,pre,arts=parse(r['text'])
            ns=[a['n'] for a in arts]
            gaps=[i for i in range(1,max(ns)+1) if i not in ns] if ns else []
            dup=len(ns)-len(set(ns))
            print(f"{title[:45]:45} | مواد {len(arts):3} | أعلى {max(ns) if ns else 0:3} | فجوات {gaps[:8]} | مكرر {dup} | مقدمة {len(pre)}")
            out.append({'law':title,'url':r['url'],'preamble':pre,'articles':arts})
    json.dump(out,open('articles15.json','w'),ensure_ascii=False,indent=1)
