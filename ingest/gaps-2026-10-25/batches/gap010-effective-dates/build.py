#!/usr/bin/env python3
"""gap010 (HKM-051، الصنف M2): تاريخ نفاذ الأنظمة والأدوات التي بلا تاريخ (46).

المصدر: صفحة أم القرى لكل أداة (رقم القرار وتاريخه وعبارة النفاذ)، أو البوابة القانونية لوزارة العدل، أو بطاقة نظما
(قرار المالك 28/10/2026: نظما معتمد ما لم تخالفه الهيئة أو أم القرى؛ والهيئة وأم القرى ساكتتان في الصفين).
القاعدة (HKM-024): تاريخ الأساس + أيام الإضافة = أول يوم نفاذ.
يُكتب ما وافقه المراجع المستقل فقط (verify.jsonl، الحكم ok والتاريخ نفسه)، وما عداه يبقى فارغًا وموثقًا في OPEN.

الدفعة: سجل مصدر لكل أداة في legal_text_provenance، ثم ملء preamble_effective_from حيث هو فارغ فقط.

    python3 batches/gap010-effective-dates/build.py
"""
import datetime, hashlib, json
from pathlib import Path
from hijri_converter import Hijri
from readings import ROWS, OPEN

D = Path(__file__).parent
BY = 'gap010-effective-dates-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def eff(r):
    y, m, d = map(int, r[6].split('-'))
    return (Hijri(y, m, d).to_gregorian() + datetime.timedelta(days=r[8])).isoformat()


ver = {}
vf = D / 'verify.jsonl'
if vf.exists():
    for line in vf.read_text(encoding='utf-8').splitlines():
        if line.strip():
            v = json.loads(line)
            ver[v['system_id']] = v
ok, dropped = [], []
for r in ROWS:
    v = ver.get(r[0])
    if v and v['verdict'] == 'ok' and v.get('effective_gregorian') == eff(r):
        ok.append(r)
    else:
        dropped.append((r[0], r[1], (v or {}).get('verdict', 'no_review'), (v or {}).get('notes', '')))
ids = ','.join(lit(r[0]) for r in ok)
st = [f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({ids}) AND preamble_effective_from IS NULL) = {len(ok)} "
      f"AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g10p-%') = 0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for r in ok:
    sid, name, src, url, inst, clause, base, kind, days = r
    rule = ('من تاريخ الصدور' if kind == 'issue' else 'من تاريخ النشر') + (f' + {days} يومًا' if days else '')
    action = f"effective_from_set:{eff(r)}"
    note = f"HKM-051 {BY}: {inst} — عبارة النفاذ: «{clause}» — القاعدة: {rule} ({base}هـ) = {eff(r)}"
    pid = 'g10p-' + hashlib.sha256(f'{BY}|{sid}'.encode()).hexdigest()[:24]
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(sid)}, {lit(name)}, NULL, {lit(src)}, NULL, {lit(url)}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-28', {lit(action)}, {lit(note)} "
              f"WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for r in ok:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(eff(r))}::timestamptz WHERE id = {lit(r[0])} AND preamble_effective_from IS NULL")
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({ids}) AND preamble_effective_from IS NOT NULL) = {len(ok)} "
          f"AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g10p-%') = {len(ok)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': {'updated': len(ok), 'dropped': dropped, 'open': OPEN},
                                               'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
print(md5, len(st), 'ok', len(ok), 'dropped', len(dropped), 'open', len(OPEN))
for x in dropped:
    print('  dropped:', *x)
