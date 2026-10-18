import json,sys,re,collections
DB=sys.argv[1]; P='/home/user/hakeem-platform/ingest/boe-corpus-2026-09-28/data/parsed'
raw=open(DB).read(); rows=json.loads(raw[raw.index('['):])
def N(s):
    s=re.sub(r'[ً-ْـٰ]','',s or '')
    s=s.translate(str.maketrans('أإآٱىئؤة','ااااييوه'))
    return re.sub(r'[^ء-ي]','',s)
HEAD=re.compile(r'^\(?\s*(?:المادة|مادة)\s+[^\s:]+(?:\s+(?:و|بعد)\S*)*(?:\s+\S+)?\s*[:：\-–]?\s*')
law_by_guid={}; 
for l in open(f'{P}/law.jsonl'):
    d=json.loads(l); law_by_guid[d['guid']]=d
units=collections.defaultdict(dict)
for l in open(f'{P}/unit.jsonl'):
    u=json.loads(l)
    if u.get('article_number') and not u.get('is_bis'):
        units[u['law_id']].setdefault(u['article_number'],N(u.get('body','')))
db=collections.defaultdict(dict); names={}
for r in rows:
    if r['b']!=0: continue
    c=r['c']
    db[r['g']][r['n']]=(N(c), N(HEAD.sub('',c,count=1)) if re.match(r'^\(?\s*(?:المادة|مادة)\s',c) else None)
    names[r['g']]=r['sn']
def found(t,b):
    if not b or len(t)<12: return False
    for off in (0,8,16,30):
        w=t[off:off+18]
        if len(w)>=12 and w in b[:400]: return True
    return False
out=[]
for g,arts in db.items():
    law=law_by_guid.get(g)
    if not law: continue
    bu=units.get(law['id'],{})
    if not bu: continue
    cnt=collections.Counter(); shifts=[]
    for n in sorted(arts):
        t1,t2=arts[n]
        tt=[t for t in (t2,t1) if t]
        if not tt or max(len(t) for t in tt)<12: cnt['short']+=1; continue
        if n in bu and any(found(t,bu[n]) for t in tt): cnt['own']+=1; continue
        d=next((d for d in (1,-1,2,-2,3,-3) if any(found(t,bu.get(n+d,'')) for t in tt)),None)
        if d is not None: cnt['shift']+=1; shifts.append((n,d)); continue
        cnt['nonum' if n not in bu else 'diff']+=1
    out.append(dict(name=names[g],guid=g,db=len(arts),boe=len(bu),**cnt,shifts=shifts))
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
tot=collections.Counter()
for o in out:
    for k in ('own','shift','diff','nonum','short'): tot[k]+=o.get(k,0)
print('laws',len(out),dict(tot))
sus=[o for o in out if o.get('shift',0)>=3]
print('laws with >=3 shifted articles:',len(sus))
for o in sorted(sus,key=lambda o:-o['shift']):
    runs=collections.Counter(d for _,d in o['shifts'])
    first=o['shifts'][0][0]
    print(f"{o['name'][:58]} | db {o['db']} boe {o['boe']} | own {o.get('own',0)} shift {o['shift']} diff {o.get('diff',0)} | offsets {dict(runs)} | from {first}")
