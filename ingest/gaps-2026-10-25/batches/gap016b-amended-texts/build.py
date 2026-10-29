#!/usr/bin/env python3
"""gap016b (HKM-052، الصنف U3، الطبقة الثانية): نسخ نصية للمواد المعدّلة التي يعرض حكيم نصها الأصلي، من ملاحظات تعديل الهيئة.

ما يدخل:
  1) selection.json: مواد كل ملاحظاتها في لقطة الهيئة «تعديل مادة كاملة» بنص جديد كامل بلا «...» ولا حاجة مراجعة، ولا تتكرر الأداة على المادة،
     ولو تعددت الملاحظات (تعديلات متتابعة) — لكل ملاحظة نسخة بتاريخ نفاذ أداتها؛
  2) المؤجل من gap016: المطبوعات م38 (AD-02) وديوان المراقبة م3 (AD-05) إن اتفق القارئ الثالث (o) مع القارئ m،
     والعقار م13 مكرر (AD-10، articleBis=1) بعد التحقق من أن الصف هو المادة المكررة نفسها.
التاريخ: أول يوم نفاذ للأداة المعدِّلة مما اتفق عليه قارئان مستقلان (amend_dates_b: r/s للنصف A وt/u للنصف B؛ وamend_dates: m/n/o)
بقاعدة HKM-024. المادة التي لم يتفق على تاريخ إحدى ملاحظاتها تُستبعد كلها، وكذا ما خالف ترتيبُ تواريخها ترتيبَ ملاحظاتها.
مستبعد: الخدمة المدنية م37 (ترقيم الصفوف «37 مكرر» ملتبس في حكيم).
الكتابة: unit_version فقط (إضافة)، والنص الأصلي في legal_articles لا يُمس.

    python3 batches/gap016b-amended-texts/build.py
"""
import hashlib, json, re
from pathlib import Path

D = Path(__file__).parent
G16 = D.parent / 'gap016-amended-texts'
RD = D.parents[1] / 'readers' / 'readings'
BY = 'gap016b-amended-texts-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
KIND = {'royal_decree': 'مرسوم ملكي', 'cabinet_decision': 'قرار مجلس الوزراء', 'royal_order': 'أمر ملكي'}
EXCLUDE_ARTICLES = {'cmpz9elyo0cf5ybvvndmq2da0': 'الخدمة المدنية م37: ترقيم «37 مكرر» ملتبس',
                    'cmpzcvb5k0bizvtrkz55p4agm': 'ضريبة الدخل م67: الأداة في الملاحظة م/113 لعام 1438هـ لا م/1 (خطأ استخراج)، والنص الجديد يتضمن حكمًا انتقاليًا خارج المادة'}


def clean(t):
    """قص ما ليس من نص المادة: علامات التنصيص المحيطة، وذيل «وذلك بموجب …» أو ملاحظة إضافة مادة تالية."""
    t = re.split(r'["”]\s*\.?\s*(?:وذلك بموجب|-\s*أُ?ضيفت)', t.strip())[0]
    t = t.strip().strip('"“”').strip()
    assert not re.search(r'وذلك بموجب (المرسوم|الأمر|قرار)', t) and 'ضيفت مادة يكون ترتيبها' not in t and '•' not in t, t[-200:]
    return t
DEAD = "('ملغاة','ملغى','مستبدل')"


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def norm(instr):
    k, no, d = instr.split(' ', 2)
    y = re.findall(r'\d+', d)
    ymd = (y[0], y[1], y[2]) if len(y[0]) == 4 else (y[2], y[1], y[0])
    return f"{k} {no} {int(ymd[0])}/{int(ymd[1])}/{int(ymd[2])}"


def greg(x):
    """توحيد حقل date بالميلادي: بعض القراء كتبه بالهجري (السنة < 1700) فيُحوَّل بتقويم أم القرى."""
    d = x.get('date')
    if d and int(d[:4]) < 1700:
        import warnings
        warnings.filterwarnings('ignore')
        from hijri_converter import Hijri
        y, mo, da = map(int, d.split('-'))
        x = dict(x, date=Hijri(y, mo, da).to_gregorian().isoformat(), date_hijri_as_written=d)
    return x


def load(p):
    return {x['item']: greg(x) for x in (json.loads(l) for l in open(p, encoding='utf-8') if l.strip())} if p.exists() else {}


def agreed(a, b):
    return a if a.get('date') and a.get('date') == b.get('date') else None


dates, open_dates = {}, {}
# gap016 (m، n، والقارئ الثالث o لما لم يتفق عليه m وn)
m, n, o = (load(RD / 'amend_dates' / f'reader_{r}.jsonl') for r in 'mno')
for x in json.load(open(G16 / 'date_packets.json', encoding='utf-8'))['items']:
    a, b, c = m.get(x['item']) or {}, n.get(x['item']) or {}, o.get(x['item']) or {}
    d = agreed(a, b) or agreed(a, c) or agreed(b, c)
    (dates.__setitem__(norm(x['instrument']), dict(d, readers='m/n/o')) if d else open_dates.__setitem__(norm(x['instrument']), {'m': a.get('date'), 'n': b.get('date'), 'o': c.get('date')}))
# gap016b (r، s للنصف A؛ t، u للنصف B)
r, s, t, u = (load(RD / 'amend_dates_b' / f'reader_{q}.jsonl') for q in 'rstu')
for x in json.load(open(D / 'date_packets.json', encoding='utf-8'))['items']:
    a, b = ((r, s) if x['half'] == 'A' else (t, u))
    a, b = a.get(x['item']) or {}, b.get(x['item']) or {}
    d = agreed(a, b)
    (dates.__setitem__(x['instrument'], dict(d, readers='r/s' if x['half'] == 'A' else 't/u')) if d else open_dates.__setitem__(x['instrument'], {'a': a.get('date'), 'b': b.get('date')}))

pre = {x['id']: x for x in json.load(open(D / 'precheck.json', encoding='utf-8'))}
arts = []
for sel in json.load(open(D / 'selection.json', encoding='utf-8')):
    arts.append(dict(article_id=sel['article_id'], system_id=sel['system_id'], law=sel['law'], n=sel['n'],
                     notes=[dict(note_id=z['note_id'], nseq=z['nseq'], instr=norm(z['instr']), new=z['new'], note=z['note']) for z in sel['notes']]))
dp16 = {x['instrument']: x['item'] for x in json.load(open(G16 / 'date_packets.json', encoding='utf-8'))['items']}
for p in json.load(open(G16 / 'pilot.json', encoding='utf-8')):
    if dp16.get(p['instr']) in ('AD-02', 'AD-05', 'AD-10'):
        arts.append(dict(article_id=p['article_id'], system_id=p['system_id'], law=p['law'], n=p['n'],
                         notes=[dict(note_id=p['note_id'], nseq=1, instr=norm(p['instr']), new=p['new'], note=p['note'])]))

rows, skipped = [], []
for a in arts:
    if a['article_id'] in EXCLUDE_ARTICLES:
        skipped.append({'article': a['article_id'], 'law': a['law'], 'n': a['n'], 'why': EXCLUDE_ARTICLES[a['article_id']]}); continue
    pc = pre[a['article_id']]
    assert pc['uv'] == 0 and pc['wst'] == 'ساري' and (pc['ust'] or '') not in ('ملغاة', 'ملغى', 'مستبدل'), pc
    miss = [z['instr'] for z in a['notes'] if z['instr'] not in dates]
    if miss:
        skipped.append({'article': a['article_id'], 'law': a['law'], 'n': a['n'], 'why': 'date_not_agreed', 'instr': miss}); continue
    vs = sorted(a['notes'], key=lambda z: z['nseq'])
    ds = [dates[z['instr']]['date'] for z in vs]
    if ds != sorted(ds) or len(set(ds)) != len(ds):
        skipped.append({'article': a['article_id'], 'law': a['law'], 'n': a['n'], 'why': 'date_order', 'dates': ds}); continue
    for z in vs:
        d = dates[z['instr']]
        body = clean(z['new'])
        assert body and '...' not in body, (a['law'], a['n'])
        kind, no, dh = z['instr'].split(' ', 2)
        no = re.sub(r'^ا/', 'أ/', no)
        ev = f"{KIND[kind]} رقم ({no}) وتاريخ {dh}هـ — من {d['date']}"
        q = (f"ملاحظة هيئة الخبراء على المادة: «{z['note'].strip()}»؛ النفاذ: {d.get('rule')} (النشر {d.get('published_hijri')}هـ، {d.get('pub_source')}) "
             f"← {d['date']} [قارئان مستقلان متفقان ({d['readers']})، HKM-052]")
        rows.append(dict(article_id=a['article_id'], system_id=a['system_id'], law=a['law'], n=a['n'], bis=pc['bis'], md5=pc['md5'], note_id=z['note_id'],
                         body=body, valid_from=d['date'], ev=ev, url=d.get('pub_source') or '', quote=q, uid='g16bu-' + h(BY, a['article_id'], z['note_id'], d['date'])))

g, seen = [], set()
for r_ in rows:
    aid = lit(r_['article_id'])
    if r_['article_id'] not in seen:
        seen.add(r_['article_id'])
        g += [f"(SELECT count(*) FROM legal_articles WHERE id={aid} AND \"legalSystemId\"={lit(r_['system_id'])} AND \"articleNumber\"={int(r_['n'])} AND \"articleBis\"={int(r_['bis'])} AND md5(content)={lit(r_['md5'])})=1",
              f"(SELECT count(*) FROM unit_version WHERE unit_id={aid})=0",
              f"coalesce((SELECT verified_status FROM verification WHERE object_type='unit' AND object_id={aid} ORDER BY verified_at DESC, id DESC LIMIT 1),'') NOT IN {DEAD}",
              f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(r_['system_id'])} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'"]
    g.append(f"(SELECT count(*) FROM boe.amendment_note WHERE id={lit(r_['note_id'])} AND position({lit(r_['body'])} in new_text)>0)=1")
st = [f"SELECT CASE WHEN {' AND '.join(g)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'g16bu-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
if rows:
    st.append("INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES\n" + ',\n'.join(
        f"({lit(r_['uid'])}, {lit(r_['article_id'])}, {lit(r_['body'])}, {lit(r_['valid_from'])}::timestamptz, {lit(r_['ev'])}, {lit(r_['url'])}, {lit(r_['quote'])}, now())" for r_ in rows))
fp = hashlib.md5('|'.join(f"{r_['article_id']}:{r_['valid_from']}:{hashlib.sha256(r_['body'].encode()).hexdigest()}" for r_ in sorted(rows, key=lambda r_: (r_['article_id'], r_['valid_from']))).encode()).hexdigest()
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'g16bu-%')={len(rows)} AND (SELECT md5(string_agg(unit_id||':'||valid_from::date||':'||encode(sha256(convert_to(body,'UTF8')),'hex'), '|' ORDER BY unit_id, valid_from)) FROM unit_version WHERE id LIKE 'g16bu-%')={lit(fp)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {},
           'report': {'versions': len(rows), 'articles': len(seen), 'new_articles': 0, 'changed_text': len(seen), 'skipped': skipped, 'open_dates': open_dates,
                      'plan': [dict(law=r_['law'], n=r_['n'], valid_from=r_['valid_from'], instr=r_['ev']) for r_ in rows]},
           'statements': st, 'diag_guards': g}, open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'versions', len(rows), 'articles', len(seen), 'skipped', len(skipped), 'open dates', len(open_dates))
