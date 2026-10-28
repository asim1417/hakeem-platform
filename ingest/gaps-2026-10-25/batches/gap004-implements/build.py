#!/usr/bin/env python3
"""gap004 (HKM-048، الصنف L1 بمسار build): علاقة IMPLEMENTS من اللائحة/القواعد إلى نظامها الأم.

النمط نفسه الذي أدخل 64 علاقة في HKM-030 (22/10): اشتقاق من اسم الأداة «…لنظام X» إلى نظام في حكيم اسمه X حرفيًا،
وحيد بالاسم، وآخر حالته «ساري». خمس أدوات لا علاقة لها اليوم.
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
BY = 'gap004-implements-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
PAIRS = [
    ('f75a928853914a87b8276138097f2c8b', 'القواعد المنظمة لإعادة التأهيل ودفع التعويضات عن الضرر ورد المبالغ لأصحابها وفقاً لنظام السياحة ولوائحه', 'cmpz5qpx60093cwg2s61a70w1', 'نظام السياحة'),
    ('b8518ab305854592bef8f44c285d4470', 'اللائحة التنفيذية لنظام الشركات الخاصة بشركات المساهمة المدرجة', 'cmpwi0cei0021nxff6ei08xis', 'نظام الشركات'),
    ('b5da57af627d479ebc651c0cde220caa', 'اللائحة التنفيذية لنظام الكهرباء الخاصة بمهمات الوزارة', 'cmpz5r4p500b6cwg2t04bq0yd', 'نظام الكهرباء'),
    ('47a36b6cc58e4c7d833cc6d3cb66692d', 'اللائحة التنفيذية لنظام الكهرباء فيما يتعلق بمهمات الهيئة السعودية لتنظيم الكهرباء', 'cmpz5r4p500b6cwg2t04bq0yd', 'نظام الكهرباء'),
    ('9247c6d51ecb4d55a75550783666edd6', 'اللائحة التنفيذية لنظام صندوق التنمية العقارية الصادر بالمرسوم الملكي رقم (م/47) وتاريخ 23 /05/ 1442هـ', 'cmpz5q6bk006ccwg2i8hrah97', 'نظام صندوق التنمية العقارية'),
]
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
def last_status(i):
    return f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(i)} ORDER BY verified_at DESC, id DESC LIMIT 1)"
conds, ins = [], []
for src, sname, tgt, tname in PAIRS:
    rid = 'g4r-' + hashlib.sha256(f'{BY}|{src}|{tgt}'.encode()).hexdigest()[:24]
    conds += [f"(SELECT count(*) FROM legal_systems WHERE id={lit(src)} AND name={lit(sname)})=1",
              f"(SELECT count(*) FROM legal_systems WHERE id={lit(tgt)} AND name={lit(tname)})=1",
              f"(SELECT count(*) FROM legal_systems WHERE name={lit(tname)})=1",
              f"{last_status(tgt)}={lit('ساري')}",
              f"(SELECT count(*) FROM legal_relations WHERE source_id={lit(src)} AND relation::text='IMPLEMENTS')=0"]
    desc = f'HKM-048 2026-10-28: اشتقاق من اسم الأداة «…لنظام X» إلى النظام الأم («{tname}»)؛ مطابقة حرفية للاسم، والنظام وحيد بالاسم وساري (نمط HKM-030)'
    ins.append(f"INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation, strength, description, created_at, status) "
               f"SELECT {lit(rid)}, 'system', {lit(src)}, 'system', {lit(tgt)}, 'IMPLEMENTS', 1, {lit(desc)}, now(), 'VERIFIED' "
               f"WHERE NOT EXISTS (SELECT 1 FROM legal_relations WHERE id={lit(rid)})")
st = [f"SELECT CASE WHEN {' AND '.join(conds)} THEN 'ok' ELSE {FAIL} END AS guard_before"] + ins + [
      f"SELECT CASE WHEN (SELECT count(*) FROM legal_relations WHERE id LIKE 'g4r-%' AND description LIKE 'HKM-048 2026-10-28:%')={len(PAIRS)} THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'statements': st}, open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5); print(json.dumps(st, ensure_ascii=False))
