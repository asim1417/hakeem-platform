"""يرسل الصفوف الحساسة للمسافات (نصوص المواد) مرمّزة base64 حتى لا يُمسّ حرف أو مسافة في النقل.
  python3 scripts/emit_b64_chunks.py <injection_dir> [max_b64_chars]
"""
import base64, json, pathlib, sys
D = pathlib.Path(sys.argv[1]); MAX = int(sys.argv[2]) if len(sys.argv) > 2 else 24000
out = D / 'chunks_b64'; out.mkdir(exist_ok=True)
for f in out.glob('*'): f.unlink()
m = json.load(open(D / 'manifest.json'))
UC = ['id', 'unit_id', 'body', 'valid_from', 'evidence_instrument', 'evidence_url', 'evidence_quote']
VC = ['id', 'object_type', 'object_id', 'verified_status', 'evidence_instrument', 'evidence_url', 'evidence_quote', 'method', 'verified_by']
def chunks(rows, cols, prefix, tbl):
    n, cur = 0, []
    def flush(cur, n):
        b = base64.b64encode(json.dumps([{c: r[c] for c in cols} for r in cur], ensure_ascii=False).encode()).decode()
        sql = (f"insert into boe_inject.{tbl} ({','.join(cols)}) select {','.join(cols)} from "
               f"jsonb_populate_recordset(null::boe_inject.{tbl}, convert_from(decode('{b}','base64'),'UTF8')::jsonb) on conflict (id) do nothing")
        (out / f'{prefix}_{n:02d}.sql').write_text(sql)
        return len(sql)
    for r in rows:
        trial = cur + [r]
        if cur and len(base64.b64encode(json.dumps([{c: x[c] for c in cols} for x in trial], ensure_ascii=False).encode())) > MAX:
            n += 1; print(prefix, n, len(cur), flush(cur, n)); cur = [r]
        else: cur = trial
    if cur: n += 1; print(prefix, n, len(cur), flush(cur, n))
uv = [json.loads(l) for l in open(D / 'unit_versions.jsonl')]
chunks(uv, UC, 'uv', 'unit_version_b64')
fix = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else set()
us = [json.loads(l) for l in open(D / 'unit_status.jsonl') if json.loads(l)['id'] in fix]
if us: chunks(us, VC, 'usfix', 'verification_fix')
