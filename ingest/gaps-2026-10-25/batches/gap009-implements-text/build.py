#!/usr/bin/env python3
"""gap009 (HKM-051، الصنف L1): علاقة IMPLEMENTS للوائح من نصها نفسه في حكيم، بحكم قارئين مستقلين ومراجع ثالث.

المدخل:
  readers/readings/round3/reader_{e,f}_part{1,2,3}.jsonl   حكما القارئين
  readers/readings/round3/review_g.jsonl                   حكم المراجع في المختلَف فيه (اختياري)
  batches/gap009-implements-text/packets_part*.jsonl       الحزم (لمطابقة المرشحين والاقتباس)
يُكتب:
  - ما اتفق عليه القارئان «implements» بالمعرّفات نفسها، أو ما حسمه المراجع «implements» بدليل.
  - النظام الأم ساري في حكيم، ولا علاقة IMPLEMENTS بين الاثنين اليوم.
  - الاقتباس حرفي من نص اللائحة في حكيم (اسمها أو ديباجتها أو مادتها)، ويحرسه شرط position() في الدفعة.
المخرجات: statements.json، وdecisions.jsonl (حكم كل بند ومساره)، وexceptions_l1.jsonl (ما لا علاقة له بدليل).

    python3 batches/gap009-implements-text/build.py
"""
import hashlib, json, re
from pathlib import Path

D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'round3'
BY = 'gap009-implements-text-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
NO_LINK = {'mention_only', 'general_power_only', 'no_parent_stated'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def load(p):
    return {x['item']: x for x in (json.loads(l) for l in p.read_text(encoding='utf-8').splitlines() if l.strip())} if p.exists() else {}


packets = {}
for p in sorted(D.glob('packets_part*.jsonl')):
    for l in p.read_text(encoding='utf-8').splitlines():
        it = json.loads(l)
        packets[it['item']] = it
E, F = {}, {}
for k in (1, 2, 3):
    E.update(load(R / f'reader_e_part{k}.jsonl'))
    F.update(load(R / f'reader_f_part{k}.jsonl'))
import sys
STAGE = sys.argv[1] if len(sys.argv) > 1 else 'agreed'   # agreed: المتفق عليه وحده (g9r-)؛ reviewed: ما حسمه المراجع وحده (g9b-)
G = load(R / 'review_g.jsonl') if STAGE == 'reviewed' else {}
PFX = 'g9r-' if STAGE == 'agreed' else 'g9b-'


def pset(x):
    return tuple(sorted(p['id'] for p in (x.get('parents') or [])))


EXTRA = {x['packet']['item']: x['possible_hakeem_parents'] for x in json.loads((D / 'review_input.json').read_text(encoding='utf-8'))
         if x['task'] == 'possible_match'} if (D / 'review_input.json').exists() else {}
SRC = {p['id']: p for p in json.loads((D.parents[1] / 'out' / 'l1_packets_2026-10-28.json').read_text(encoding='utf-8'))}


def where_text(it, src, q):
    """موضع الاقتباس في نص حكيم المصدَّر (packets.sql): (عمود، معرّف). يُبحث فيه حرفيًا بصرف النظر عن وسم القارئ."""
    p = SRC[it['system_id']]
    m = re.search(r'\(([^)]+)\)', src or '')
    arts = {a['id']: a['t'] for a in p.get('arts') or []}
    if m and m.group(1) in arts and q in arts[m.group(1)]:
        return ('article', m.group(1))
    if q in (p.get('name') or ''):
        return ('name', it['system_id'])
    if q in (p.get('preamble') or ''):
        return ('preamble', it['system_id'])
    hit = [aid for aid, t in arts.items() if q in t]
    return ('article', hit[0]) if len(hit) == 1 else (None, None)


decisions, links, exc = [], [], []
for item, it in sorted(packets.items()):
    e, f, g = E.get(item), F.get(item), G.get(item)
    allowed = {m['id']: m for c in it['candidates'] for m in c['hakeem_matches']}
    allowed.update({m['id']: m for m in EXTRA.get(item, [])})
    route, final, reason = 'owner', None, ''
    if g:  # المرحلة reviewed وحدها: حكم المراجع يتقدم (الخلاف، والسند المسمّى باسم آخر في حكيم)
        final, route = g, 'reviewed'
    elif not e or not f:
        route, reason = 'unread', 'قراءة ناقصة'
    elif e['verdict'] == f['verdict'] == 'implements' and pset(e) == pset(f) and pset(e):
        final, route = e, 'agreed'
    elif e['verdict'] == f['verdict'] and e['verdict'] != 'implements':
        final, route = e, 'agreed'
    else:
        route, reason = 'review', f"{e['verdict']}/{f['verdict']} {pset(e)}/{pset(f)}"
    rec = {'item': item, 'system_id': it['system_id'], 'name': it['name'], 'route': route, 'reason': reason,
           'e': e and e['verdict'], 'f': f and f['verdict'], 'g': g and g['verdict'], 'final': final and final['verdict'],
           'parents': final and final.get('parents'), 'named_parent': final and final.get('named_parent')}
    if final and final['verdict'] == 'implements':
        ps = [p for p in final['parents'] if p['id'] in allowed]
        if len(ps) != len(final['parents']) or not ps:
            rec.update(route='owner', reason='نظام أم خارج المرشحين')
        elif any(allowed[p['id']]['status'] != 'ساري' for p in ps):
            rec.update(route='owner', reason='النظام الأم غير ساري')
        else:
            q = (final.get('evidence_quote') or '').strip()
            col, oid = where_text(it, final.get('evidence_source') or '', q)
            if not col and route == 'agreed' and e is not final:
                pass
            if not col and route == 'agreed':  # اقتباس القارئ الآخر إن طابق
                q2 = (f.get('evidence_quote') or '').strip()
                col, oid = where_text(it, f.get('evidence_source') or '', q2)
                q = q2 if col else q
            if not col or len(q) < 8:
                rec.update(route='owner', reason='اقتباس أو موضع ناقص')
            else:
                for p in ps:
                    if (STAGE == 'agreed') == (route == 'agreed'):
                        links.append((it, allowed[p['id']], col, oid, q, route))
    elif final and final['verdict'] in NO_LINK:
        exc.append({'gap': 'L1', 'system_id': it['system_id'], 'reason': f"{final['verdict']}: {(final.get('notes') or '')[:200]}", 'by': BY})
    decisions.append(rec)

conds, ins = [], []
for it, par, col, oid, q, route in links:
    src, tgt = it['system_id'], par['id']
    rid = PFX + hashlib.sha256(f'{BY}|{src}|{tgt}'.encode()).hexdigest()[:24]
    conds += [f"(SELECT count(*) FROM legal_systems WHERE id={lit(src)} AND name={lit(it['name'])})=1",
              f"(SELECT count(*) FROM legal_systems WHERE id={lit(tgt)} AND name={lit(par['name'])})=1",
              f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(tgt)} ORDER BY verified_at DESC, id DESC LIMIT 1)={lit('ساري')}",
              f"(SELECT count(*) FROM legal_relations WHERE relation::text='IMPLEMENTS' AND source_id={lit(src)} AND target_id={lit(tgt)})=0"]
    if col == 'article':
        conds.append(f"(SELECT count(*) FROM legal_articles WHERE id={lit(oid)} AND \"legalSystemId\"={lit(src)} AND position({lit(q)} IN content)>0)=1")
    elif col == 'preamble':
        conds.append(f"(SELECT count(*) FROM legal_systems WHERE id={lit(src)} AND position({lit(q)} IN preamble)>0)=1")
    else:
        conds.append(f"(SELECT count(*) FROM legal_systems WHERE id={lit(src)} AND position({lit(q)} IN name)>0)=1")
    where = {'article': 'مادتها', 'preamble': 'ديباجتها', 'name': 'اسمها'}[col]
    desc = (f"HKM-051 2026-10-28: النظام الأم «{par['name']}» من نص اللائحة نفسها في حكيم ({where}): «{q}» — "
            f"{'قارئان مستقلان متفقان' if route == 'agreed' else 'حسمه المراجع المستقل'}")
    ins.append("INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation, strength, description, created_at, status) "
               f"SELECT {lit(rid)}, 'system', {lit(src)}, 'system', {lit(tgt)}, 'IMPLEMENTS', 1, {lit(desc)}, now(), 'VERIFIED' "
               f"WHERE NOT EXISTS (SELECT 1 FROM legal_relations WHERE id={lit(rid)})")
st = []
if links:
    st = [f"SELECT CASE WHEN {' AND '.join(conds)} AND (SELECT count(*) FROM legal_relations WHERE id LIKE '{PFX}%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"] + ins + [
        f"SELECT CASE WHEN (SELECT count(*) FROM legal_relations WHERE id LIKE '{PFX}%')={len(links)} THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
OUTF = 'statements.json' if STAGE == 'agreed' else 'statements_reviewed.json'
(D / OUTF).write_text(json.dumps({'by': BY + ('' if STAGE == 'agreed' else '-reviewed'), 'md5': md5, 'count': len(st), 'links': len(links), 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
(D / f'decisions_{STAGE}.jsonl').write_text(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in decisions), encoding='utf-8')
(D / f'exceptions_l1_{STAGE}.jsonl').write_text(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in exc), encoding='utf-8')
from collections import Counter
print(md5, len(st), 'links', len(links), 'systems', len({l[0]['system_id'] for l in links}))
print(Counter(d['route'] for d in decisions))
print(Counter((d['route'], d['final']) for d in decisions))
