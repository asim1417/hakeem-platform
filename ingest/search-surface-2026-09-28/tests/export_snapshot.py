"""يصدّر من المختبر المحلي ما يحتاجه اختبار القبول (السجل، الوجه، المواد) إلى JSON. قراءة فقط."""
import json, os, sys
import psycopg
url = os.environ["DATABASE_URL"]
assert url.split("@")[-1].split("/")[0].split(":")[0] in ("127.0.0.1", "localhost")
out = {}
with psycopg.connect(url) as con, con.cursor() as cur:
    cur.execute("SELECT id, name FROM legal_systems ORDER BY name")
    out["registry"] = [{"id": i, "name": n} for i, n in cur.fetchall()]
    cur.execute("SELECT id, work_key, surface_system_id, valid_on::text, created_at FROM search_surface")
    out["rows"] = [{"id": a, "workKey": b, "surfaceSystemId": c, "validOn": d, "createdAt": e.isoformat()} for a, b, c, d, e in cur.fetchall()]
    cur.execute("SELECT work_key, system_id FROM search_surface_member")
    out["members"] = [{"workKey": a, "systemId": b} for a, b in cur.fetchall()]
    cur.execute('SELECT id, "legalSystemId", "lawName", "articleNumber", status, content FROM legal_articles')
    out["articles"] = [{"id": a, "legalSystemId": b, "lawName": c, "articleNumber": d, "status": e, "content": f} for a, b, c, d, e, f in cur.fetchall()]
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False)
print("exported", {k: len(v) for k, v in out.items()})
