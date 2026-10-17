"""نقل صفوف المرحلة 1 عبر مرحلة وسيطة (boe_inject) مرمّزةً base64، ثم نقلها من الوسيط إلى الجداول.

لماذا: نصوص المواد فيها مسافات غير منقسمة (U+00A0) وجدولة ومحارف صفرية العرض لا تظهر في القراءة،
فالنقل النصّي المباشر يفقدها وتردّه بصمة الصف. base64 نصّ ASCII لا يُمسّ في النقل.

  python3 scripts/emit_phase1_b64.py [max_b64_chars]

المخرج (data/phase1-2026-10-16/sql/b64/):
  00_stage_ddl.sql      جداول الوسيط (إضافة فقط في مخطط boe_inject)
  uv_NN.sql / ver_NN.sql إدراج الوسيط (ON CONFLICT DO NOTHING — إعادة الإرسال آمنة)
  check.sql             الصفوف الناقصة أو المخالفة لبصمتها في الوسيط (يجب أن يعيد صفرًا)
  apply.json            عبارات النقل إلى unit_version وverification (معاملة واحدة) بالحرّاس نفسها
"""
import base64
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
D = ROOT / "data" / "phase1-2026-10-16"
OUT = D / "sql" / "b64"
MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 9000
SEP = "\x1f"
UC = ["id", "unit_id", "body", "valid_from", "evidence_instrument", "evidence_url", "evidence_quote"]
VC = ["id", "object_type", "object_id", "verified_status", "evidence_instrument", "evidence_url", "evidence_quote", "method", "verified_by"]
GLOBAL_GUARD = """DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;"""


def jl(p):
    return [json.loads(line) for line in open(p, encoding="utf-8") if line.strip()]


def md5(s):
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def uv_md5(r):
    return md5(SEP.join([r["id"], r["unit_id"], r["body"], r["valid_from"][:10], r["evidence_instrument"] or "",
                         r["evidence_url"] or "", r["evidence_quote"] or ""]))


def ver_md5(r):
    return md5(SEP.join([r["id"], r["object_type"], r["object_id"], r["verified_status"], r["evidence_instrument"] or "",
                         r["evidence_url"] or "", r["evidence_quote"] or "", r["method"], r["verified_by"]]))


def lit(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def emit_chunks(rows, cols, prefix, table):
    n, cur, files = 0, [], []

    def flush(batch):
        nonlocal n
        n += 1
        b = base64.b64encode(json.dumps([{c: r[c] for c in cols} for r in batch], ensure_ascii=False).encode()).decode()
        sql = (f"INSERT INTO boe_inject.{table} ({','.join(cols)}) SELECT {','.join(cols)} FROM "
               f"jsonb_populate_recordset(null::boe_inject.{table}, convert_from(decode('{b}','base64'),'UTF8')::jsonb) "
               f"ON CONFLICT (id) DO NOTHING;")
        f = OUT / f"{prefix}_{n:02d}.sql"
        f.write_text(sql, encoding="utf-8")
        files.append((f.name, len(batch), len(sql)))

    for r in rows:
        trial = cur + [r]
        size = len(base64.b64encode(json.dumps([{c: x[c] for c in cols} for x in trial], ensure_ascii=False).encode()))
        if cur and size > MAX:
            flush(cur)
            cur = [r]
        else:
            cur = trial
    if cur:
        flush(cur)
    return files


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*"):
        f.unlink()
    uv = jl(D / "unit_versions.jsonl")
    us = jl(D / "unit_status.jsonl")
    ws = jl(D / "work_status.jsonl")
    ver = us + ws
    for r in uv:
        r["valid_from"] = r["valid_from"][:10]

    (OUT / "00_stage_ddl.sql").write_text(
        "CREATE TABLE IF NOT EXISTS boe_inject.p1_unit_version (id text PRIMARY KEY, unit_id text, body text, valid_from text, "
        "evidence_instrument text, evidence_url text, evidence_quote text, staged_at timestamptz DEFAULT now());\n"
        "CREATE TABLE IF NOT EXISTS boe_inject.p1_verification (id text PRIMARY KEY, object_type text, object_id text, "
        "verified_status text, evidence_instrument text, evidence_url text, evidence_quote text, method text, verified_by text, "
        "staged_at timestamptz DEFAULT now());\n", encoding="utf-8")
    files = emit_chunks(uv, UC, "uv", "p1_unit_version") + emit_chunks(ver, VC, "ver", "p1_verification")

    uv_exp = ",".join(f"({lit(r['id'])},{lit(uv_md5(r))},{lit(r['_guard_md5'])})" for r in uv)
    ver_exp = ",".join(f"({lit(r['id'])},{lit(ver_md5(r))},{lit(r.get('_guard_md5'))})" for r in ver)
    uv_row = ("md5(concat_ws(chr(31),s.id,s.unit_id,s.body,s.valid_from,coalesce(s.evidence_instrument,''),"
              "coalesce(s.evidence_url,''),coalesce(s.evidence_quote,'')))")
    ver_row = ("md5(concat_ws(chr(31),s.id,s.object_type,s.object_id,s.verified_status,coalesce(s.evidence_instrument,''),"
               "coalesce(s.evidence_url,''),coalesce(s.evidence_quote,''),s.method,s.verified_by))")
    (OUT / "check.sql").write_text(
        f"WITH e(id,rm,bm) AS (VALUES {uv_exp}) SELECT 'uv' t, e.id FROM e LEFT JOIN boe_inject.p1_unit_version s ON s.id=e.id "
        f"WHERE s.id IS NULL OR {uv_row} <> e.rm\nUNION ALL\n"
        f"SELECT 'ver', e.id FROM (VALUES {ver_exp}) e(id,rm,bm) LEFT JOIN boe_inject.p1_verification s ON s.id=e.id "
        f"WHERE s.id IS NULL OR {ver_row} <> e.rm;", encoding="utf-8")

    apply = [
        GLOBAL_GUARD,
        # نسخ المواد: البصمة في الوسيط + نص حكيم الأصلي كما في اللقطة + لا نسخة بالتاريخ نفسه
        f"INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote) "
        f"SELECT s.id,s.unit_id,s.body,s.valid_from::timestamptz,s.evidence_instrument,s.evidence_url,s.evidence_quote "
        f"FROM boe_inject.p1_unit_version s JOIN (VALUES {uv_exp}) e(id,rm,bm) ON e.id=s.id "
        f"WHERE {uv_row} = e.rm AND (SELECT md5(content) FROM legal_articles WHERE id=s.unit_id) = e.bm "
        f"AND NOT EXISTS (SELECT 1 FROM unit_version u WHERE u.unit_id=s.unit_id AND u.valid_from=s.valid_from::timestamptz);",
        # الحالة: إلغاء المادة بحارس نصها، وحالة العمل بلا صف تحقق سابق للعمل
        f"INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by) "
        f"SELECT s.id,s.object_type,s.object_id,s.verified_status,s.evidence_instrument,s.evidence_url,s.evidence_quote,s.method,s.verified_by "
        f"FROM boe_inject.p1_verification s JOIN (VALUES {ver_exp}) e(id,rm,bm) ON e.id=s.id "
        f"WHERE {ver_row} = e.rm AND NOT EXISTS (SELECT 1 FROM verification x WHERE x.id=s.id) "
        f"AND ((s.object_type='unit' AND (SELECT md5(content) FROM legal_articles WHERE id=s.object_id) = e.bm) "
        f"OR (s.object_type='work' AND NOT EXISTS (SELECT 1 FROM verification w WHERE w.object_type='work' AND w.object_id=s.object_id)));",
        f"DO $c$ DECLARE a int; b int; BEGIN "
        f"SELECT count(*) INTO a FROM unit_version WHERE id = ANY(ARRAY[{','.join(lit(r['id']) for r in uv)}]); "
        f"SELECT count(*) INTO b FROM verification WHERE id = ANY(ARRAY[{','.join(lit(r['id']) for r in ver)}]); "
        f"IF a <> {len(uv)} OR b <> {len(ver)} THEN RAISE EXCEPTION 'phase1 apply: uv % of {len(uv)}, ver % of {len(ver)}', a, b; END IF; END $c$;",
    ]
    (OUT / "apply.json").write_text(json.dumps(apply, ensure_ascii=False), encoding="utf-8")
    for name, k, size in files:
        print(name, k, "rows", size, "chars")
    print("uv", len(uv), "ver", len(ver))


if __name__ == "__main__":
    main()
