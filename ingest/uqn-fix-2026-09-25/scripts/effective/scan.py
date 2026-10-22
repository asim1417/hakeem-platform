import json,re,collections,sys
B='/home/claude/hakeem-platform/ingest/uqn-fix-2026-09-25/data/'
ops=[json.loads(l) for l in open(B+'amendment_operations.jsonl')]
snap=json.load(open(B+'source_snapshots.json'))
inst=collections.OrderedDict()
for o in ops:
    inst.setdefault((o['instrument_kind'],o['instrument_no'],o['source_url']),[]).append(o)
KW=re.compile(r'(نفاذ|يُ?عمل ب|يُعمل|يسري|تسري|سريان|العمل به|من تاريخ نشر|بعد مضي|بمضي|اعتبار[اًا]ً? من|من تاريخ صدور|يبدأ العمل|ينفذ|تنفذ)')
out={}
for i,(k,v) in enumerate(inst.items()):
    t=snap[k[2]]
    head=t[:300].split('\n')
    # page date
    m=re.search(r'\n(1[34]\d\d-\d{1,2}-\d{1,2})\nالموافق',t)
    pd=m.group(1) if m else None
    paras=[p.strip() for p in re.split(r'\n+',t) if p.strip()]
    hits=[p for p in paras if KW.search(p)]
    out[i]=dict(key=k,page_date=pd,pub=sorted({o['published_hijri'] for o in v}),also=sorted({a for o in v for a in o.get('also_in',[])}),ops=[o['op_type'] for o in v],targets=sorted({o['target_law_title'] for o in v}),hits=hits,len=len(t))
json.dump(out,open('scan.json','w'),ensure_ascii=False,indent=1)
for i,d in out.items():
    print(f"#{i} {d['key'][0]} {d['key'][1]} pd={d['page_date']} pub={d['pub']} len={d['len']} also={d['also']}")
    print('  T:',' | '.join(d['targets'])[:150],'ops:',collections.Counter(d['ops']))
    for h in d['hits']: print('   >',h[:300])
