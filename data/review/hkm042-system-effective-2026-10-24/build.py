#!/usr/bin/env python3
"""HKM-042 (البند 9): تاريخ نفاذ الأنظمة التي بلا تاريخ (165).

قرأ قارئ عبارة النفاذ في كل نظام وتاريخ نشره من المصادر المخزنة (readings.jsonl). تملأ الدفعة
legal_systems.preamble_effective_from للمحسوم بثقة عالية أو متوسطة فقط، وتحرس ألا يُستبدل تاريخ قائم.
الباقي (تاريخ الصدور غير مخزن 29، بلا مصدر 14، بلا تاريخ نشر 2، ثقة منخفضة 1) يبقى فارغًا وموثقًا في readings.jsonl.

    python3 data/review/hkm042-system-effective-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


rows = [json.loads(l) for l in (D / 'readings.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
assert len(rows) == 165
ok = [x for x in rows if x['verdict'] == 'resolved' and x.get('confidence') in ('high', 'medium') and x.get('effective_gregorian')]
ids = ','.join(lit(x['system_id']) for x in ok)
st = [f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({ids}) AND preamble_effective_from IS NULL) = {len(ok)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"]
for x in ok:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(x['effective_gregorian'])}::timestamptz WHERE id = {lit(x['system_id'])} AND preamble_effective_from IS NULL")
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({ids}) AND preamble_effective_from IS NOT NULL) = {len(ok)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': 'hkm042-system-effective-2026-10-24', 'md5': md5, 'count': len(st), 'report': {'updated': len(ok)}, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(st), md5, len(ok))
