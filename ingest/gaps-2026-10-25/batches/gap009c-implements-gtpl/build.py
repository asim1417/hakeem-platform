#!/usr/bin/env python3
"""gap009c (HKM-051، L1): ربط خمس لوائح بنظام المنافسات والمشتريات الحكومية النافذ (م/128 لعام 1440هـ، cmpz5pp91003xcwg2wx5rgsnx).
فاتت المطابقةَ الآلية في gap009 لأن اسم السجل في حكيم «المنافسات و المشتريات» بمسافة، فحُكم فيها «السند ملغى» (سجل 1427).
حكم المراجع المستقل (readers/readings/round3/review_gtpl.jsonl): الأدوات صدرت 1441–1444هـ تحت نظام 1440، والمرسوم م/76 لعام 1448هـ
(البند خامسًا) يسمّي قراري مجلس الوزراء 245 و537 لوائحَ للمادة 96 من نظام 1440. L1-183 مربوط من قبل بنظام الجمارك، فلا يدخل.

    python3 batches/gap009c-implements-gtpl/build.py
"""
import hashlib, json, re
from pathlib import Path
D = Path(__file__).parent
G = D.parents[1]
BY = 'gap009c-implements-gtpl-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
TGT, TGT_NAME = 'cmpz5pp91003xcwg2wx5rgsnx', 'نظام المنافسات و المشتريات الحكومية'
SRC = {p['id']: p for p in json.load(open(G / 'out' / 'l1_packets_2026-10-28.json', encoding='utf-8'))}
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
rows = [json.loads(l) for l in open(G / 'readers' / 'readings' / 'round3' / 'review_gtpl.jsonl', encoding='utf-8')]
rows = [r for r in rows if r['verdict'] == 'implements' and [p['id'] for p in r['parents']] == [TGT]]
assert len(rows) == 5
conds, ins = [], []
for r in rows:
    sid, q = r['system_id'], r['evidence_quote'].strip()
    p = SRC[sid]
    m = re.search(r'\(([^)]+)\)', r.get('evidence_source') or '')
    arts = {a['id']: a['t'] for a in p.get('arts') or []}
    if m and m.group(1) in arts and q in arts[m.group(1)]:
        col, oid, where = 'article', m.group(1), 'مادتها الأولى'
        conds.append(f"(SELECT count(*) FROM legal_articles WHERE id={lit(oid)} AND \"legalSystemId\"={lit(sid)} AND position({lit(q)} IN content)>0)=1")
    else:
        assert q in p['name'], r['item']
        where = 'اسمها'
        conds.append(f"(SELECT count(*) FROM legal_systems WHERE id={lit(sid)} AND position({lit(q)} IN name)>0)=1")
    conds += [f"(SELECT count(*) FROM legal_systems WHERE id={lit(sid)} AND name={lit(p['name'])})=1",
              f"(SELECT count(*) FROM legal_relations WHERE relation::text='IMPLEMENTS' AND source_id={lit(sid)})=0"]
    rid = 'g9c-' + hashlib.sha256(f'{BY}|{sid}|{TGT}'.encode()).hexdigest()[:24]
    desc = (f"HKM-051 2026-10-28: النظام الأم «نظام المنافسات والمشتريات الحكومية» (م/128 لعام 1440هـ) من نص اللائحة نفسها في حكيم ({where}): «{q}» — "
            f"الأداة صدرت في ظل نظام 1440؛ قارئان ثم مراجع مستقل ({r['item']})")
    ins.append("INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation, strength, description, created_at, status) "
               f"SELECT {lit(rid)}, 'system', {lit(sid)}, 'system', {lit(TGT)}, 'IMPLEMENTS', 1, {lit(desc)}, now(), 'VERIFIED' WHERE NOT EXISTS (SELECT 1 FROM legal_relations WHERE id={lit(rid)})")
conds += [f"(SELECT count(*) FROM legal_systems WHERE id={lit(TGT)} AND name={lit(TGT_NAME)})=1",
          f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(TGT)} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'",
          "(SELECT count(*) FROM legal_relations WHERE id LIKE 'g9c-%')=0"]
st = [f"SELECT CASE WHEN {' AND '.join(conds)} THEN 'ok' ELSE {FAIL} END AS guard_before"] + ins + [
      f"SELECT CASE WHEN (SELECT count(*) FROM legal_relations WHERE id LIKE 'g9c-%' AND target_id={lit(TGT)})=5 THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'statements': st}, open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
