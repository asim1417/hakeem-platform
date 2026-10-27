#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045i): نفاذ نظام التنفيذ الجديد (م/237) في 2026-10-28 وإحلاله محل نظام التنفيذ (م/53).

ملاحظة المراقب run-2026-10-24-f29 (مقبولة): النشر 1447/11/14هـ (2026-05-01) + 180 يومًا = 2026-10-28.
- ed25-c2a4c0ce70ba0e7eee683d32 (م/237): «ساري» بدل «صادر لم يسرِ بعد».
- ed25-d62948bc9ac1a3c3fb813076 (م/53): «مستبدل» بدل «ساري».
الاقتباس يُقطع داخل القاعدة من لقطة أم القرى بحارس strpos، ولا يُكتب في هذا الملف. علاقة SUPERSEDES (hk43r-ae3218ff…) قائمة ومعتمدة.

    python3 data/review/hkm045i-enforcement-effective-2026-10-28/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm045i-enforcement-effective-2026-10-28'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
URL = 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869'
CLAUSE = 'يحل النظام محل نظام التنفيذ، الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ، وتعديلاته'
NEW, OLD = 'ed25-c2a4c0ce70ba0e7eee683d32', 'ed25-d62948bc9ac1a3c3fb813076'
PREV = {NEW: ('vf26-cc99cb0641cccde1dd0370b3', 'صادر لم يسرِ بعد'), OLD: ('vf26-73ef602d3a8d1629851d36bf', 'ساري')}
TARGET = {NEW: 'ساري', OLD: 'مستبدل'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def latest(sid):
    return f"(SELECT {{c}} FROM verification WHERE object_type = 'work' AND object_id = {lit(sid)} ORDER BY verified_at DESC, id DESC LIMIT 1)"


def build():
    snap = f"(SELECT body FROM uqn_fix.source_snapshot WHERE url = {lit(URL)} LIMIT 1)"
    quote = (f"(substr({snap}, strpos({snap}, {lit(CLAUSE)}), length({lit(CLAUSE)})) || "
             f"{lit(' — النفاذ 2026-10-28: النشر 1447/11/14هـ (2026-05-01) + 180 يومًا (ملاحظة المراقب run-2026-10-24-f29).')})")
    pre = [f"strpos({snap}, {lit(CLAUSE)}) > 0", "now() >= '2026-10-27T21:00:00Z'::timestamptz"]
    for sid, (vid, st) in PREV.items():
        pre.append(f"{latest(sid).format(c='id')} = {lit(vid)}")
        pre.append(f"{latest(sid).format(c='verified_status')} = {lit(st)}")
    stmts = [f"SELECT CASE WHEN {' AND '.join(pre)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"]
    post = []
    for sid, status in TARGET.items():
        vf = 'vf45i-' + hashlib.sha256(f'{BY}|{sid}|{status}'.encode()).hexdigest()[:24]
        instr = "(SELECT evidence_instrument FROM verification WHERE id = " + lit(PREV[NEW][0]) + ")"
        stmts.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vf)}, 'work', {lit(sid)}, {lit(status)}, {instr}, {lit(URL)}, {quote}, 'rule', {lit(BY)}, now(), {lit(PREV[sid][0])}
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vf)})""")
        post.append(f"{latest(sid).format(c='verified_status')} = {lit(status)}")
    stmts.append(f"SELECT CASE WHEN {' AND '.join(post)} AND (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = 2 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(stmts).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(stmts), 'report': {'verification': 2}, 'statements': stmts}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(stmts), md5)


if __name__ == '__main__':
    build()
