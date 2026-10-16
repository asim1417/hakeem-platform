"""يقسم ملفات الحقن إلى دفعات (كل دفعة معاملة: حارس ثم إدراج ثم حارس) لتُنفَّذ عبر أداة Neon. لا يتصل بقاعدة.
  python3 scripts/emit_injection_chunks.py <injection_dir> [max_bytes]
"""
import json, pathlib, re, sys
D = pathlib.Path(sys.argv[1]); MAX = int(sys.argv[2]) if len(sys.argv) > 2 else 45000
out = D / 'chunks'; out.mkdir(exist_ok=True)
for f in out.glob('*.json'): f.unlink()
for name in ['work_status', 'unit_status', 'unit_versions']:
    sql = (D / 'sql' / f'{name}.sql').read_text(encoding='utf-8')
    guard = re.search(r'DO \$g\$.*?END \$g\$;', sql, re.S).group(0)
    head = re.search(r'INSERT INTO [^\n]+ VALUES\n', sql).group(0)
    vals = re.search(r'VALUES\n(.*)\nON CONFLICT', sql, re.S).group(1)
    rows = re.split(r'\),\n\(', vals); rows = [('(' if i else '') + r + (')' if i < len(rows) - 1 else '') for i, r in enumerate(rows)]
    batch, n, size = [], 0, 0
    def flush():
        global n
        if batch:
            n += 1
            stmt = head + ',\n'.join(batch) + '\nON CONFLICT (id) DO NOTHING'
            (out / f'{name}_{n:02d}.json').write_text(json.dumps([guard, stmt, guard], ensure_ascii=False), encoding='utf-8')
    n = 0
    for r in rows:
        if batch and size + len(r) > MAX:
            flush(); batch, size = [], 0
        batch.append(r); size += len(r)
    flush()
    print(name, len(rows), 'rows in', n, 'chunks')
