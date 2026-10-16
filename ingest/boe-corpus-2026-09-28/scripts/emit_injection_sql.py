"""يكتب ملفات SQL للحقن (إضافة فقط، ON CONFLICT DO NOTHING) من ملفات المعاينة. لا يتصل بأي قاعدة.
كل ملف معاملة واحدة تبدأ وتنتهي بفحص الحارسين، ولا تُنفَّذ إلا بعد كلمة المالك «احقن».
  python3 scripts/emit_injection_sql.py <injection_dir>
"""
import json, pathlib, sys

D = pathlib.Path(sys.argv[1]); out = D / 'sql'; out.mkdir(exist_ok=True)
q = lambda v: 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"
GUARD = """DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
"""
def ver(rows):
    return ',\n'.join(f"({q(r['id'])},{q(r['object_type'])},{q(r['object_id'])},{q(r['verified_status'])},{q(r['evidence_instrument'])},{q(r['evidence_url'])},{q(r['evidence_quote'])},{q(r['method'])},{q(r['verified_by'])})" for r in rows)
for name, tbl in [('work_status', 'verification'), ('unit_status', 'verification'), ('unit_versions', 'unit_version')]:
    rows = [json.loads(l) for l in open(D / f'{name}.jsonl', encoding='utf-8')]
    if tbl == 'verification':
        body = f'INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by) VALUES\n{ver(rows)}\nON CONFLICT (id) DO NOTHING;\n'
    else:
        vals = ',\n'.join(f"({q(r['id'])},{q(r['unit_id'])},{q(r['body'])},{q(r['valid_from'])}::timestamptz,{q(r['evidence_instrument'])},{q(r['evidence_url'])},{q(r['evidence_quote'])})" for r in rows)
        body = f'INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote) VALUES\n{vals}\nON CONFLICT (id) DO NOTHING;\n'
    sql = f'-- {name}: {len(rows)} صفًا — إضافة فقط\nBEGIN;\n{GUARD}{body}{GUARD}COMMIT;\n'
    (out / f'{name}.sql').write_text(sql, encoding='utf-8')
    print(name, len(rows), len(sql))
