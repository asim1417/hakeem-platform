#!/usr/bin/env python3
"""gap006 (HKM-048، الصنف L1 بدليل بوابة وزارة العدل): علاقة IMPLEMENTS لأدوات البوابة القانونية لوزارة العدل.
الدليل: حقل parentSystem في بيانات البوابة المخزنة في المستودع (data/moj-regs.json وdata/moj-instruments.json، المصدر
الرسمي للجهة المختصة، الرتبة 3). يُبنى فقط ما كان اسم الأداة فيه وحيدًا في حكيم، والنظام الأم وحيدًا بالاسم وساريًا،
ولا علاقة IMPLEMENTS للأداة اليوم.
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
ROOT = OUT.parents[3]
BY = 'gap006-implements-moj-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
IDS = {  # اسم الأداة → (معرّفها في حكيم، معرّف النظام الأم) من قراءة 28/10
 'آلية الاستعانة بمحام على نفقة الدولة للمتهم في الجرائم الكبيرة': ('cmr4rvn9i009y1j0uzckmk8h8', 'cmpwi0bws001ynxffg7f27mo3'),
 'الأدلة الإجرائية لنظام الإثبات': ('cmr4rvlyy004t1j0ukew7yqg7', 'cmpz5pbv80021cwg2br8calht'),
 'القواعد الخاصة بتنظيم شؤون الخبرة أمام المحاكم': ('cmr4rvmho008l1j0u71o24tkk', 'cmpz5pbv80021cwg2br8calht'),
 'القواعد المنظمة لإجراءات الإفلاس العابرة للحدود': ('cmr4rvofa00bk1j0uicgw1qzq', 'cmpz5pmxa003lcwg2gvi5rlyr'),
 'القواعد المنظمة لإجراءات قضايا الإفلاس في المحاكم التجارية': ('cmr4rvnn800aa1j0u921x9lq8', 'cmpwi0ckf0022nxffiy84kp3o'),
 'اللائحة التنفيذية لإجراءات الاستئناف': ('cmr4rvkrh001d1j0u78q4z84m', 'cmpwi0cw90024nxff1u02k8rn'),
 'اللائحة التنفيذية لطرق الاعتراض على الأحكام': ('cmr4rvl67002d1j0ugcjemx5u', 'cmpwi0cw90024nxff1u02k8rn'),
 'ضوابط إجراءات الإثبات إلكترونياً': ('cmr4rvlkz00441j0uj88pwjoe', 'cmpz5pbv80021cwg2br8calht'),
 'قواعد تحديد أتعاب الخبراء والأمناء في نظام الإفلاس': ('cmr4rvo1300az1j0u2jrawb8o', 'cmpz5pmxa003lcwg2gvi5rlyr'),
 'لائحة التقارير الطبية': ('cmr4rvmvu009k1j0u0tgyngwa', 'cmpwi0bkw001xnxff8zst26lv'),
 'لائحة قسمة الأموال المشتركة': ('cmr4rvk2d00001j0uilrp29ra', 'cmpwi0cw90024nxff1u02k8rn'),
 'لائحة نظام الأحوال الشخصية': ('cmr4qm6tq008q9vd1sm15xz4e', 'cmpwi0bkw001xnxff8zst26lv'),
}
moj = {}
for f in ('data/moj-regs.json', 'data/moj-instruments.json'):
    for it in json.load(open(ROOT / f, encoding='utf-8')):
        moj[it['system']['name']] = it['system']
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
def last_status(i):
    return f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(i)} ORDER BY verified_at DESC, id DESC LIMIT 1)"
conds, ins = [], []
for name, (src, tgt) in IDS.items():
    m = moj[name]; parent = m['parentSystem']
    rid = 'g6r-' + hashlib.sha256(f'{BY}|{src}|{tgt}'.encode()).hexdigest()[:24]
    conds += [f"(SELECT count(*) FROM legal_systems WHERE name={lit(name)})=1",
              f"(SELECT count(*) FROM legal_systems WHERE id={lit(src)} AND name={lit(name)})=1",
              f"(SELECT count(*) FROM legal_systems WHERE name={lit(parent)})=1",
              f"(SELECT count(*) FROM legal_systems WHERE id={lit(tgt)} AND name={lit(parent)})=1",
              f"{last_status(tgt)}={lit('ساري')}",
              f"(SELECT count(*) FROM legal_relations WHERE source_id={lit(src)} AND relation::text='IMPLEMENTS')=0"]
    desc = f"HKM-048 2026-10-28: النظام الأم «{parent}» من البوابة القانونية لوزارة العدل (parentSystem في {m['sourceUrl']})؛ الاسمان وحيدان في حكيم والنظام ساري"
    ins.append(f"INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation, strength, description, created_at, status) "
               f"SELECT {lit(rid)}, 'system', {lit(src)}, 'system', {lit(tgt)}, 'IMPLEMENTS', 1, {lit(desc)}, now(), 'VERIFIED' "
               f"WHERE NOT EXISTS (SELECT 1 FROM legal_relations WHERE id={lit(rid)})")
st = [f"SELECT CASE WHEN {' AND '.join(conds)} THEN 'ok' ELSE {FAIL} END AS guard_before"] + ins + [
      f"SELECT CASE WHEN (SELECT count(*) FROM legal_relations WHERE id LIKE 'g6r-%')={len(IDS)} THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'statements': st}, open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
