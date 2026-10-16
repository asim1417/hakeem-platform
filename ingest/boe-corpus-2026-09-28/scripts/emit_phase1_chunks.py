"""يقسم ملفات SQL للمرحلة 1 إلى دفعات (~22KB) لكل منها حارسها وتأكيد عددها.
  python3 scripts/emit_phase1_chunks.py
"""
import pathlib
import re

D = pathlib.Path(__file__).resolve().parents[1] / "data" / "phase1-2026-10-16" / "sql"
OUT = D / "chunks"
OUT.mkdir(exist_ok=True)
for f in OUT.glob("*.sql"):
    f.unlink()
for name in ("unit_versions", "unit_status", "work_status"):
    s = (D / f"{name}.sql").read_text(encoding="utf-8")
    guard = re.search(r"DO \$g\$.*?END \$g\$;", s, re.S).group(0)
    ins = re.findall(r"INSERT INTO .*?;\n(?=INSERT|DO \$c\$)", s, re.S)
    table = "unit_version" if name == "unit_versions" else "verification"
    chunks, cur, size = [], [], 0
    for i in ins:
        if size + len(i) > 22000 and cur:
            chunks.append(cur)
            cur, size = [], 0
        cur.append(i)
        size += len(i)
    if cur:
        chunks.append(cur)
    for k, ch in enumerate(chunks, 1):
        ids = [re.search(r"SELECT \* FROM \(SELECT '([^']+)'", x).group(1) for x in ch]
        arr = ",".join(f"'{i}'" for i in ids)
        check = (f"DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM {table} WHERE id = ANY(ARRAY[{arr}]); "
                 f"IF k <> {len(ids)} THEN RAISE EXCEPTION '{name} chunk {k}: %% of {len(ids)}', k; END IF; END $c$;").replace("%%", "%")
        (OUT / f"{name}_{k:02d}.sql").write_text("\n".join([guard] + ch + [check]), encoding="utf-8")
    print(name, len(ins), "rows", len(chunks), "chunks")
