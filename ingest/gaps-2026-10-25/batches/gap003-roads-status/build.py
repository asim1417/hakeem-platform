#!/usr/bin/env python3
"""gap003 (HKM-048، صنف جديد S1: حالة نظام من بطاقة هيئة لإصدار آخر).

تنظيم الهيئة العامة للطرق في حكيم (b2b20e39…) هو تنظيم 1448: ديباجته «قرار رقم (219) وتاريخ 1448/02/28هـ»،
ونشرته أم القرى في 1448/03/08هـ (uqn:4001669). آخر حالة له «ملغى» من boe-phase1-2026-10-16، ودليلها بطاقة هيئة
لتنظيم 1441 (قرار مجلس الوزراء رقم 211 وتاريخ 1441/3/15هـ) لا لهذا السجل. والترتيبات التنظيمية 1444 التي حل محلها
مسجلة «مستبدل من 2026-08-11». فيُضاف له صف «ساري» من 2026-08-11 (المادة 15: «يعمل بالتنظيم من تاريخ الموافقة عليه»،
والموافقة 1448/02/28هـ = 2026-08-11 بتقويم أم القرى)، والصف السابق يبقى في السجل (إضافة فقط).
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
BY = 'gap003-roads-status-2026-10-28'
SID = 'b2b20e3951ad444289849b3b07d47afc'
PREV = 'boe26-d0f397bae9fdcff26d83ea96'
URL = 'https://www.uqn.gov.sa/decisions-and-regulations/4001669'
EFF = 'يعمل بالتنظيم من تاريخ الموافقة عليه'
PRE = 'قرار رقم (219) وتاريخ 1448/02/28هـ'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
snap = f"(SELECT body FROM uqn_fix.source_snapshot WHERE url = {lit(URL)} LIMIT 1)"
last = f"(SELECT {{c}} FROM verification WHERE object_type = 'work' AND object_id = {lit(SID)} ORDER BY verified_at DESC, id DESC LIMIT 1)"
vid = 'vfg3-' + hashlib.sha256(f'{BY}|{SID}|ساري'.encode()).hexdigest()[:24]
method = ('[منهج HKM-048: السجل هو تنظيم 1448 (ديباجته قرار مجلس الوزراء رقم 219 وتاريخ 1448/02/28هـ، المنشور في أم القرى 1448/03/08هـ)؛ '
          'حالة «ملغى» السابقة من بطاقة هيئة لتنظيم 1441 (القرار 211 وتاريخ 1441/3/15هـ) لا لهذا السجل؛ '
          'النفاذ من تاريخ الموافقة 1448/02/28هـ = 2026-08-11]')
st = [
    f"SELECT CASE WHEN strpos({snap}, {lit(EFF)}) > 0 AND strpos({snap}, {lit(PRE)}) > 0 "
    f"AND (SELECT count(*) FROM legal_systems WHERE id = {lit(SID)} AND name = {lit('تنظيم الهيئة العامة للطرق')} AND strpos(preamble, {lit(PRE)}) = 1) = 1 "
    f"AND {last.format(c='id')} = {lit(PREV)} AND {last.format(c='verified_status')} = {lit('ملغى')} "
    f"AND (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = 0 THEN 'ok' ELSE {FAIL} END AS guard_before",
    f"INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id) "
    f"SELECT {lit(vid)}, 'work', {lit(SID)}, {lit('ساري')}, {lit('قرار مجلس الوزراء رقم (219) وتاريخ 1448/2/28هـ — من 2026-08-11')}, {lit(URL)}, "
    f"(substr({snap}, strpos({snap}, {lit(EFF)}), length({lit(EFF)})) || {lit(' ' + method)}), 'rule', {lit(BY)}, now(), {lit(PREV)} "
    f"WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vid)})",
    f"SELECT CASE WHEN {last.format(c='verified_status')} = {lit('ساري')} AND (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = 1 THEN 'ok' ELSE {FAIL} END AS guard_after",
]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'statements': st}, open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5)
for s in st: print(s); print('---')
