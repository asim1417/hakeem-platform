#!/usr/bin/env python3
"""gap028 (HKM-052): حزمة قراءة لما بقي بلا مصدر لتاريخ نفاذه بعد gap025/gap025b/gap027، بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية واكمل شي».
تشمل: (أ) ما علّقه مراجع gap025 (بطاقة هيئة تاريخ نشرها = صدورها في غير جمعة، وغيرها)؛ (ب) ما علّقه classify.py لنظام أو تنظيم أو صك له عبارة نفاذ:
لا تاريخ نشر رسمي غير نائب، أو عبارة نفاذ غير مباشرة، أو نشر بعيد عن الصدور. ويُستثنى ما قرأه gap021 وgap027 من قبل، وما لا يلزمه تاريخ نفاذ (skip).
ولكل بند تاريخ نظما (نشر/صدور/نفاذ) إن طابق الاسم، مرجعًا للمقارنة.
"""
import json, re, sqlite3, sys
from pathlib import Path
D = Path(__file__).parent
B = D.parent
S = '/tmp/claude-0/-home-claude/e6641569-58ff-5c36-a0d3-bebaf1376bc8/scratchpad'
ids = set(json.load(open(sys.argv[1])))  # الباقي بلا مصدر من الإنتاج (unbacked542.json)
U = {x['id']: x for x in json.load(open(B / 'gap025-confirm-all/unbacked.json', encoding='utf-8'))}
P = {p['id']: p for p in json.load(open(B / 'gap025-confirm-all/plan.json', encoding='utf-8'))}
DC = json.load(open(B / 'gap025-confirm-all/decree_clauses.json', encoding='utf-8'))
VP = {x['item']: x for x in json.load(open(B / 'gap025-confirm-all/verify_packet.json', encoding='utf-8'))['items']}
V25 = {}
for l in open(B / 'gap025-confirm-all/verify.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l); V25[VP[v['item']]['id']] = v
VX = {}
for l in open(B / 'gap025-confirm-all/verify_extra.jsonl', encoding='utf-8'):
    if l.strip():
        v = json.loads(l); VX[v['id']] = v
g21 = {i['id'] for i in json.load(open(B / 'gap021-placeholder-dates/packet.json', encoding='utf-8'))['items']}
g27 = json.load(open(B / 'gap027-uqn-effective/plan.json', encoding='utf-8'))
g27 = {h['id'] for h in g27['held']} | {p['id'] for p in g27['plan']}
LAW = {'نظام', 'تنظيم', 'ترتيبات تنظيمية'}


def norm(s):
    s = re.sub(r'[ً-ْـ]', '', s or '')
    s = re.sub('[أإآ]', 'ا', s).replace('ة', 'ه').replace('ى', 'ي')
    s = re.sub(r'\s*\(.*?\)\s*', ' ', s)
    s = re.sub(r'\b(ال)?(صادر|الصادر)\b.*$', '', s)
    return re.sub(r'\s+', ' ', s).strip()


c = sqlite3.connect(f'{S}/nezams_legal_db_v3_2_3.sqlite')
NZ = {}
for lid, off, title, url in c.execute('select law_id, official_name, page_title, source_url from laws'):
    for n in {norm(off), norm(title)}:
        if n:
            NZ.setdefault(n, []).append((lid, url))
DATES = {}
for lid, dt, hj, gr, raw, note in c.execute('select law_id, date_type, hijri, greg, raw, note from law_dates'):
    DATES.setdefault(lid, {})[dt] = dict(hijri=hj, greg=gr, raw=raw, note=(note or '')[:300])
items = []
for i in sorted(ids):
    p, u = P.get(i), U.get(i)
    if not p or not u:
        continue
    why = None
    if p['class'] in ('confirm', 'correct'):
        v = V25.get(i) or VX.get(i)
        why = 'علّقه مراجع gap025: ' + ((v or {}).get('notes') or 'غير مؤكد')[:400]
    elif p['class'] == 'hold' and i not in g21 and i not in g27 and (p['kind'] in LAW or p['rule']):
        why = 'علّقه المصنّف: ' + p['why']
    if not why:
        continue
    nz = []
    for lid, url in NZ.get(norm(p['name']), [])[:2]:
        nz.append(dict(url=url, **{k: DATES.get(lid, {}).get(k) for k in ('issued', 'published', 'effective')}))
    dc = DC.get(i) or {}
    items.append(dict(id=i, name=p['name'], kind=p['kind'], stored=p['stored'], decree=u.get('rd'), boe_url=u.get('url'),
                      boe_card_issue=u.get('ih'), boe_card_pub=u.get('ph'), held_because=why,
                      clause_articles=(u.get('cl') or '')[:1200] or None, clause_decree_boe=(dc.get('boe') or '')[:800] or None,
                      clause_decree_preamble=(dc.get('pre') or '')[:800] or None, nezams=nz))
for k, x in enumerate(items, 1):
    x['item'] = f'R-{k:03d}'
json.dump({'items': items}, open(D / 'packet.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(items), Counter(x['held_because'][:22] for x in items).most_common(), 'with nezams', sum(1 for x in items if x['nezams']),
      'with nezams pub', sum(1 for x in items if any(n.get('published') for n in x['nezams'])))
