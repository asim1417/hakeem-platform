"""ينقل صفوف الحقن عبر جدولي تجهيز في مخطط جديد (boe_inject) ثم يتحقق ببصمة كل صف قبل النقل الخادمي إلى
verification وunit_version — حتى لا يُعاد كتابة نص قانوني يدويًا في جدول لا يقبل التعديل.
  python3 scripts/emit_stage_chunks.py <injection_dir> [max_bytes]
يكتب: chunks_stage/*.json (جمل كل دفعة)، و manifest.json (بصمة كل صف).
"""
import hashlib, json, pathlib, sys
D = pathlib.Path(sys.argv[1]); MAX = int(sys.argv[2]) if len(sys.argv) > 2 else 60000
out = D / 'chunks_stage'; out.mkdir(exist_ok=True)
for f in out.glob('*.json'): f.unlink()
q = lambda v: 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"
VCOLS = ['id', 'object_type', 'object_id', 'verified_status', 'evidence_instrument', 'evidence_url', 'evidence_quote', 'method', 'verified_by']
UCOLS = ['id', 'unit_id', 'body', 'valid_from', 'evidence_instrument', 'evidence_url', 'evidence_quote']
manifest = {}
def md5(r, cols):
    return hashlib.md5('|'.join(str(r[c]) for c in cols if r[c] is not None).encode()).hexdigest()
for name, tbl, cols in [('work_status', 'verification_stage', VCOLS), ('unit_status', 'verification_stage', VCOLS),
                        ('unit_versions', 'unit_version_stage', UCOLS)]:
    rows = [json.loads(l) for l in open(D / f'{name}.jsonl', encoding='utf-8')]
    n, batch, size = 0, [], 0
    def flush():
        global n
        n += 1
        stmt = f"INSERT INTO boe_inject.{tbl} ({','.join(cols)}) VALUES\n" + ',\n'.join(batch) + '\nON CONFLICT (id) DO NOTHING'
        (out / f'{name}_{n:02d}.json').write_text(json.dumps([stmt], ensure_ascii=False), encoding='utf-8')
    for r in rows:
        manifest[r['id']] = md5(r, cols)
        v = '(' + ','.join(q(r[c]) for c in cols) + ')'
        if batch and size + len(v) > MAX:
            flush(); batch, size = [], 0
        batch.append(v); size += len(v)
    if batch: flush()
    print(name, len(rows), n)
json.dump(manifest, open(D / 'manifest.json', 'w'))
print('manifest', len(manifest))
