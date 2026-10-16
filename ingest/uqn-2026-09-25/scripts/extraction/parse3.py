import json,re
from parse_articles import clean
from parse2 import parse as parse_mawad, SEC
U={'أول':1,'حادي':1,'ثاني':2,'ثالث':3,'رابع':4,'خامس':5,'سادس':6,'سابع':7,'ثامن':8,'تاسع':9,'عاشر':10}
T={'عشرون':20,'عشرين':20,'ثلاثون':30,'ثلاثين':30,'أربعون':40,'أربعين':40}
def bnum(s):
    s=re.sub(r'[ً-ْ]','',s).replace('اً','').strip().rstrip('ا').strip()
    s=re.sub(r'^ال','',s)
    if s in U: return U[s]
    m=re.fullmatch(r'(\S+?)\s+عشر',s)
    if m and m.group(1).rstrip('ا') in U: return 10+U[m.group(1).rstrip('ا')]
    if s.rstrip('ا') in T: return T[s.rstrip('ا')]
    m=re.fullmatch(r'(\S+?)\s+و(?:ال)?(\S+)',s)
    if m and m.group(1) in U and m.group(2).rstrip('ا') in T: return U[m.group(1)]+T[m.group(2).rstrip('ا')]
    return None
BH=re.compile(r'(?:^|\n|\*\*|[\.:](?=\s*\*\*))\s*\**\s*((?:أول|ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر|حادي|عشر|الحادي|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع)[ء-يً-ْ ]{0,25}?)\s*\**\s*[:：]\s*\**')
def parse_bunud(text):
    t=clean(text); title=t.split('\n')[0].lstrip('# ').strip()
    ms=[]
    for m in BH.finditer(t):
        n=bnum(m.group(1))
        if n is None: continue
        if ms and n!=ms[-1][2]+1: continue   # enforce sequence to avoid inline false hits
        if not ms and n!=1: continue
        ms.append((m.start(),m.end(),n,m.group(1).strip()))
    arts=[]
    for i,(s,e,n,lab) in enumerate(ms):
        end=ms[i+1][0] if i+1<len(ms) else len(t)
        body=re.sub(r'\*\*','',t[e:end]); body=re.sub(r'\n{2,}','\n',body).strip()
        arts.append({'n':n,'label':'البند '+lab,'bab':'','fasl':'','text':body})
    return title,(t[:ms[0][0]] if ms else t).strip(),arts
if __name__=='__main__':
    L=json.load(open('articles66.json'))
    raw={}
    import glob
    for f in glob.glob('raw66/*.txt'):
        for r in json.load(open(f))['results']: raw[r['url']]=r['text']
    for l in L:
        c=l['check']
        if c['n']==0 or c['gaps'] or c['bad']:
            title,pre,arts=parse_bunud(raw[l['url']])
            ns=[a['n'] for a in arts]
            print(l['law'][:45],'| بنود',len(arts),'| آخر:',(arts[-1]['text'][:70].replace('\n',' ') if arts else ''))
            if arts and len(arts)>=max(c['n'],1) and not c['bad'] or (arts and c['n']==0):
                l['articles']=arts; l['pre']=pre; l['mode']='بنود'; l['check']={'n':len(arts),'max':max(ns),'gaps':[],'bad':0}
    json.dump(L,open('articles66.json','w'),ensure_ascii=False,indent=1)
