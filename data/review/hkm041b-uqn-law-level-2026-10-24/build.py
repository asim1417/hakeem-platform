#!/usr/bin/env python3
"""HKM-041ب (البند 2): عمليات أم القرى على مستوى النظام وغير الموجودة في حكيم (26).

- work_status (2): سجل حالة «مستبدل» للنظام القديم بنص الإحلال من اللقطة، ويُلحق بآخر سجل حالة.
- already_recorded (5): قرار approved (الحالة مسجلة بالأداة نفسها).
- not_applicable (17): قرار rejected بسبب عدم وجود الهدف في حكيم (البحث موثق في readings.jsonl).
مستبقاة: CON-002 (إلغاء معلّق على شرط لم يثبت) وتسمية نظام إدارة المواد الكيميائية (تنتظر توحيد النسختين).

    python3 data/review/hkm041b-uqn-law-level-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm041b-uqn-law-level-2026-10-24'
REVIEWER = 'Claude بتفويض المالك'
MANDATE = 'تفويض المالك 24/10/2026 («سوِّ الأفضل وتكون النتيجة 100%»)'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
HOLD = {'OP-ebb435b67b', 'OP-c87c1a5551'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def instr(op):
    return (f"(SELECT CASE o.instrument_kind WHEN 'royal_decree' THEN 'مرسوم ملكي رقم (' WHEN 'cabinet_decision' THEN 'قرار مجلس الوزراء رقم (' "
            f"WHEN 'royal_order' THEN 'أمر ملكي رقم (' ELSE o.instrument_kind || ' رقم (' END || o.instrument_no || ') وتاريخ ' || replace(o.instrument_date_hijri, '-', '/') || 'هـ' "
            f"FROM uqn_fix.amendment_op o WHERE o.op_id = {lit(op)})")


def review(op, decision, note):
    return (f"INSERT INTO uqn_fix.amendment_review (op_id, decision, corrected, reviewer, note) "
            f"SELECT {lit(op)}, {lit(decision)}, NULL, {lit(REVIEWER)}, {lit((MANDATE + ': ' + note)[:2000])} "
            f"WHERE NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review WHERE op_id = {lit(op)}) AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_decision WHERE op_id = {lit(op)})")


rows = [json.loads(l) for l in (D / 'readings.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
assert len(rows) == 26
url = {o: u for o, u in ((x['op_id'], x['source_url']) for x in rows)}
pre, st, n_ws = [], [], 0
for x in rows:
    op = x['op_id']
    if op in HOLD:
        continue
    v = x['verdict']
    if v == 'work_status':
        sid = x['system_id']
        sn = f"(SELECT body FROM uqn_fix.source_snapshot WHERE url = {lit(x['source_url'])} LIMIT 1)"
        pre.append(f"strpos({sn}, {lit(x['source_quote'])}) > 0")
        pre.append(f"EXISTS (SELECT 1 FROM legal_systems WHERE id = {lit(x['new_system_id'])})")
        vid = 'vf41b-' + hashlib.sha256(f'{sid}|{op}'.encode()).hexdigest()[:24]
        st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vid)}, 'work', {lit(sid)}, {lit(x['status'])}, {instr(op)}, {lit(x['source_url'])}, {lit(x['source_quote'])}, 'rule', {lit(BY)}, now(),
  (SELECT p.id FROM verification p WHERE p.object_type = 'work' AND p.object_id = {lit(sid)} ORDER BY p.verified_at DESC, p.id DESC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vid)})""")
        n_ws += 1
        st.append(review(op, 'approved', f"سُجّل النظام «{x['status']}» ({vid})، والبديل {x['new_system_id']}، السريان {x.get('effective_gregorian')}. {x.get('notes') or ''}"))
    elif v == 'already_recorded':
        st.append(review(op, 'approved', f"الحالة مسجلة سابقًا بالأداة نفسها. {x.get('notes') or ''}"))
    elif v == 'not_applicable':
        st.append(review(op, 'rejected', f"لا ينطبق على حكيم: الهدف غير موجود فيه بعد بحث موثق. {x.get('notes') or ''}"))
    else:
        raise SystemExit(f'حكم غير متوقع {op} {v}')
head = f"SELECT CASE WHEN {' AND '.join(pre)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"
tail = f"SELECT CASE WHEN (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = {n_ws} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after"
st = [head] + st + [tail]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(st), md5, n_ws)
