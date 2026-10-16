import json,re,glob,hashlib,sys
sys.path.insert(0,'/home/claude/rasd_anzima')
import pandas as pd
from normlib import norm
OUT='/home/claude/pkg/hakeem-uqn-ingest/data/'
AR=str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')
def hdate(s):
    """normalize hijri date string to YYYY-MM-DD; returns '' if unparseable"""
    if not s or not isinstance(s,str): return ''
    s=s.translate(AR); nums=re.findall(r'\d+',s)
    if len(nums)<3: return ''
    a,b,c=[int(x) for x in nums[:3]]
    if a>1300: y,m,d=a,b,c
    elif c>1300: y,m,d=c,b,a
    else: return ''
    if not(1<=m<=12 and 1<=d<=30): return ''
    return f'{y:04d}-{m:02d}-{d:02d}'
def pubdate(s):
    s=(s or '').strip(); m=re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})\s*(?:\n|\s)*الموافق\s*(\d{2})-(\d{2})-(\d{4})',s)
    if m: return f'{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}', f'{m.group(6)}-{m.group(5)}-{m.group(4)}'
    m=re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})',s)
    return (f'{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}','') if m else ('','')
def sha(t): return hashlib.sha256(t.encode()).hexdigest()[:16]
def wtype(t):
    for k,v in [('النظام الأساس','basic_statute'),('الترتيبات التنظيمية','org_arrangements'),('تنظيم','organization'),('النظام (القانون)','gcc_unified_law'),('نظام (قانون)','gcc_amending_law'),('نظام','law'),('اللائحة التنفيذية','executive_regulation'),('لائحة','regulation'),('اللائحة','regulation'),('قواعد','rules'),('القواعد','rules'),('ضوابط','controls'),('الضوابط','controls')]:
        if t.startswith(k): return v
    return 'other_instrument'
# ---------- laws 81 ----------
L=json.load(open('الأنظمة_الواحد_والثمانون_مع_أدوات_الإصدار.json'))
X=pd.read_excel('الأنظمة_الواحد_والثمانون_مع_أدوات_الإصدار.xlsx','الأنظمة').fillna('')
meta={r['رابط النص']:r for _,r in X.iterrows()}
B=pd.read_excel('أنظمة_ولوائح_غير_موجودة_في_حكيم.xlsx','إصدارات أحدث')
repl={r['الرابط']:r['ملاحظة'] for _,r in B.iterrows()}
raw={}
for f in ['raw1.txt','raw2.txt']+glob.glob('raw66/*.txt'):
    for r in json.load(open(f))['results']: raw[r['url']]=r
LD={}
for f in ['uqn_rr_part1.jsonl','uqn_rr_part2.jsonl']:
    for ln in open(f):
        o=json.loads(ln); LD[o['url']]=o.get('date','')
laws=[]
for l in L:
    m=meta.get(l['source_url'],{}); pub_h,pub_g=pubdate(LD.get(l['source_url'],''))
    units=[];seq=0
    iss=l['issuance']
    for kind,obj in (('enacting_instrument',iss['royal_decree']),('approval_instrument',iss['cabinet_decision'])):
        if obj.get('text'):
            seq+=1; units.append({'seq':seq,'unit_type':kind,'number':None,'label':'المرسوم الملكي' if kind=='enacting_instrument' else (m.get('أداة الموافقة') or 'قرار مجلس الوزراء'),'heading':'','chapter':'','section':'','text':obj['text'],'source_url':obj.get('url',''),'text_sha':sha(obj['text'])})
    if 'البري الدولي' in l['law']:
        l['articles']=l['articles'][:25]; l['articles'][24]['text']=l['articles'][24]['text'].split('جدول تعديلات فرق العمل')[0].strip()
    numbering='clauses' if any(a['label'].startswith('البند') for a in l['articles']) else 'articles'
    for a in l['articles']:
        seq+=1; units.append({'seq':seq,'unit_type':'clause' if numbering=='clauses' else 'article','number':a['number'],'label':a['label'],'heading':'','chapter':a.get('chapter',''),'section':a.get('section',''),'text':a['text'],'source_url':l['source_url'],'text_sha':sha(a['text'])})
    ns=[a['number'] for a in l['articles']]
    flags=[]
    if not iss['royal_decree'].get('text') and not iss['cabinet_decision'].get('text'): flags.append('missing_issuance_instrument')
    if 'خبر' in str(m.get('أداة الموافقة','')): flags.append('approval_is_news_item_not_decision_text')
    if str(m.get('أداة الموافقة',''))=='أداة أخرى': flags.append('approval_instrument_type_unverified')
    if l.get('note') or m.get('ملاحظة'): flags.append('manual_note')
    laws.append({'source_id':'uqn:'+re.search(r'(\d+)$',l['source_url']).group(1),'title':l['law'],'work_type':wtype(l['law']),
      'published_hijri':pub_h,'published_gregorian':pub_g,'source_url':l['source_url'],
      'issuance':{'royal_decree_no':iss['royal_decree'].get('no',''),'royal_decree_date_hijri':hdate(iss['royal_decree'].get('date_h','')),
                  'approval_instrument_kind':str(m.get('أداة الموافقة','')),'approval_no':str(m.get('رقمها','')).replace('.0',''),'approval_date_hijri':hdate(str(m.get('تاريخها','')))},
      'effective_clause':l.get('effective',''),
      'supersedes_note':repl.get(l['source_url'],''),
      'numbering':numbering,'units':units,
      'quality':{'article_count':len(ns),'sequence_contiguous':ns==list(range(1,len(ns)+1)),'flags':flags,'note':str(m.get('ملاحظة','')).strip()},
      'provenance':{'source':'uqn.gov.sa','retrieved':'2026-09-25','raw_sha':sha(raw.get(l['source_url'],{}).get('text',''))}})
with open(OUT+'laws.jsonl','w') as f:
    for x in laws: f.write(json.dumps(x,ensure_ascii=False)+'\n')
# ---------- regulations ----------
R=json.load(open('اللوائح_والقواعد_من_أم_القرى.json'))
MR=json.load(open('sweep/md_au_regs.json'))
MD=pd.read_pickle('sweep/md_au.pkl'); newurls=set(MD[(MD['التصنيف']=='لائحة/قواعد بمواد')&(MD['موجود في']=='غير موجود')]['الرابط'])
tanz=set(MD[MD['التصنيف'].str.startswith('قرار تنظيمي')]['الرابط'])
regs=[]
def reg_rec(title,url,pub,status,numbering,pre,arts,full,parent,origin,cat):
    ph,pg=pubdate(pub); units=[];seq=0
    if pre and len(pre)>40: seq+=1; units.append({'seq':seq,'unit_type':'preamble','number':None,'label':'الديباجة/أداة الإصدار','text':pre,'text_sha':sha(pre)})
    for a in arts: seq+=1; units.append({'seq':seq,'unit_type':'clause' if numbering=='بنود' else 'article','number':a['n'],'label':a['label'],'chapter':a.get('bab',''),'section':a.get('fasl',''),'text':a['text'],'text_sha':sha(a['text'])})
    if full: seq+=1; units.append({'seq':seq,'unit_type':'unstructured_body','number':None,'label':'النص كاملًا','text':full,'text_sha':sha(full)})
    ns=[a['n'] for a in arts]
    return {'source_id':'uqn:'+re.search(r'(\d+)$',url).group(1),'title':title,'work_type':wtype(title),'category':cat,'published_hijri':ph,'published_gregorian':pg,'source_url':url,
            'parent_law_hint':parent or '','parse_status':status,'numbering':'clauses' if numbering=='بنود' else 'articles','units':units,
            'quality':{'article_count':len(arts),'sequence_contiguous':bool(ns) and ns==list(range(1,len(ns)+1))},'origin_section':origin,'provenance':{'source':'uqn.gov.sa','retrieved':'2026-09-25'}}
for r in R:
    st={'مكتمل':'complete','تسلسل غير منتظم — راجع':'irregular_sequence','نص متصل بلا مواد':'unstructured','بلا نص (صورة/PDF أو قالب فارغ)':'no_text_image_or_pdf'}.get(r['status'],r['status'])
    regs.append(reg_rec(r['title'],r['url'],r['published'],st,r['numbering'],r['preamble'],r['articles'],r['full_text'],r.get('parent_in_hakeem'),'rules-and-regulations','regulation'))
for r in MR:
    if r['url'] in newurls: regs.append(reg_rec(r['title'],r['url'],r['published'],'complete',r['numbering'],'',r['articles'],'',None,'ministerial/authorities','regulation'))
    elif r['url'] in tanz: regs.append(reg_rec(r['title'],r['url'],r['published'],'needs_triage',r['numbering'],'',r['articles'],'',None,'ministerial/authorities','regulatory_decision_needs_triage'))
with open(OUT+'regulations.jsonl','w') as f:
    for x in regs: f.write(json.dumps(x,ensure_ascii=False)+'\n')
# ---------- effects ----------
E1=pd.read_pickle('sweep/analysis.pkl'); E2=MD[MD['التصنيف']=='تعديل/إلغاء']
AM={'تعديل':'amend','إضافة':'insert','حذف':'delete','إلغاء':'repeal','إحلال':'replace','إصدار':'enact'}
eff=[];groups={}
for _,r in E1.iterrows():
    if r['الإجراء'] in ('—',): continue
    rec={'effect_type':AM.get(r['الإجراء'],r['الإجراء']),'instrument_kind':{'قرار مجلس الوزراء':'cabinet_decision','مرسوم ملكي':'royal_decree','أمر ملكي':'royal_order'}[r['القسم']],
         'instrument_no':r['رقم الأداة'],'instrument_date_hijri':hdate(r['تاريخ الأداة']),'published_hijri':pubdate(r['تاريخ النشر'])[0],
         'target_title_as_cited':r['النظام/الأداة المتأثرة'],'target_citation':r['سند النظام المتأثر'],'target_match_hakeem':r['أقرب اسم في حكيم'],'target_match_status':r['في حكيم'],
         'operative_text':r['النص'],'source_url':r['الرابط'],'extraction':'automatic','status':'pending_review'}
    k=(rec['effect_type'],norm(rec['target_title_as_cited'])[:40],norm(rec['operative_text'])[60:200])
    if k in groups: groups[k]['also_published_in'].append({'instrument_kind':rec['instrument_kind'],'instrument_no':rec['instrument_no'],'source_url':rec['source_url']}); continue
    rec['also_published_in']=[]; groups[k]=rec; eff.append(rec)
for _,r in E2.iterrows():
    eff.append({'effect_type':'amend_or_repeal_unclassified','instrument_kind':'ministerial_or_authority_decision','instrument_no':r['الأداة'],'instrument_date_hijri':'','published_hijri':pubdate(r['تاريخ النشر'])[0],
        'target_title_as_cited':r['الأداة المعنية'],'target_citation':'','target_match_hakeem':r['أقرب مقابل'],'target_match_status':r['موجود في'],'operative_text':r['مقتطف'],'source_url':r['الرابط'],'extraction':'automatic','status':'pending_review','also_published_in':[]})
for i,e in enumerate(eff,1): e['effect_id']=f'EFF-{i:05d}'
with open(OUT+'legal_effects.jsonl','w') as f:
    for x in eff: f.write(json.dumps(x,ensure_ascii=False)+'\n')
# ---------- supersessions ----------
sup=[]
for _,r in B.iterrows():
    sup.append({'new_title':r['العنوان'],'new_source_url':r['الرابط'],'published':pubdate(r['التاريخ'])[0],'hakeem_old_work_hint':r['ملاحظة'],'effect_type':'replace','status':'pending_review'})
json.dump(sup,open(OUT+'supersessions.json','w'),ensure_ascii=False,indent=1)
# ---------- issuance audit (50 laws) ----------
A=[x for f in sorted(glob.glob('batch_*.json')) for x in json.load(open(f))]
json.dump(A,open(OUT+'issuance_audit_existing_laws.json','w'),ensure_ascii=False,indent=1)
# ---------- reference lists ----------
H=pd.read_excel('hakeem_list.xlsx','الأنظمة'); H.to_csv(OUT+'hakeem_reference_list_500.csv',index=False)
Lst=[json.loads(l) for l in open('uqn_rr_part1.jsonl')]+[json.loads(l) for l in open('uqn_rr_part2.jsonl')]
S2=json.load(open('sweep/all_listing.json'))+json.load(open('sweep/md_au_listing.json'))
json.dump({'rules-and-regulations':Lst,'other_sections':S2},open(OUT+'uqn_listings_index.json','w'),ensure_ascii=False)
print(len(laws),sum(len(x['units']) for x in laws),'| regs',len(regs),sum(len(x['units']) for x in regs),'| effects',len(eff),'| sup',len(sup),'| audit',len(A))
