#!/usr/bin/env python3
"""
تحميل حزمة أم القرى إلى المنطقة الوسيطة uqn_stage في PostgreSQL.
- قابل لإعادة التشغيل: يحذف دفعة batch_id نفسها ثم يعيد تحميلها داخل معاملة واحدة.
- لا يمس الجداول الرئيسية لحكيم.
الاستخدام:
  export DATABASE_URL=postgres://...   (فرع Neon تجريبي أولًا)
  python scripts/load_staging.py --batch uqn-2026-09-25 [--dry-run]
المتطلبات: pip install "psycopg[binary]"
"""
import argparse, json, os, sys, hashlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

def jl(p):
    with open(p, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)

def pkg_sha():
    h = hashlib.sha256()
    for p in sorted(DATA.glob("*")):
        h.update(p.read_bytes())
    return h.hexdigest()[:16]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    works, units, effects = [], [], []
    def files(ds):
        fs = sorted(DATA.glob(f"{ds}_part*.jsonl")) or [DATA / f"{ds}.jsonl"]
        return fs
    for ds in ("laws", "regulations"):
      for fp in files(ds):
        if not fp.exists():
            print(f"تنبيه: {fp.name} غير موجود — تخطٍّ"); continue
        for w in jl(fp):
            iss = w.get("issuance", {})
            q = w.get("quality", {})
            works.append((a.batch, w["source_id"], ds, w["title"], w["work_type"], w.get("category"),
                          w.get("published_hijri") or None, w.get("published_gregorian") or None, w["source_url"],
                          iss.get("royal_decree_no") or None, iss.get("royal_decree_date_hijri") or None,
                          iss.get("approval_instrument_kind") or None, iss.get("approval_no") or None,
                          iss.get("approval_date_hijri") or None, w.get("effective_clause") or None,
                          w.get("supersedes_note") or None, w.get("parent_law_hint") or None, w.get("numbering"),
                          w.get("parse_status", "complete"), q.get("article_count", 0), q.get("sequence_contiguous"),
                          q.get("flags", []), q.get("note"), w.get("provenance", {}).get("raw_sha")))
            for u in w["units"]:
                units.append((a.batch, w["source_id"], u["seq"], u["unit_type"], u.get("number"), u.get("label"),
                              u.get("heading"), u.get("chapter"), u.get("section"), u["text"], u["text_sha"],
                              u.get("source_url") or w["source_url"]))
    for e in jl(DATA / "legal_effects.jsonl"):
        effects.append((a.batch, e["effect_id"], e["effect_type"], e["instrument_kind"], e.get("instrument_no"),
                        e.get("instrument_date_hijri") or None, e.get("published_hijri") or None,
                        e.get("target_title_as_cited"), e.get("target_citation"), e.get("target_match_hakeem"),
                        e.get("target_match_status"), e["operative_text"], e["source_url"],
                        json.dumps(e.get("also_published_in", []), ensure_ascii=False)))
    sups = [(a.batch, s["new_source_url"], s["new_title"], s.get("published"), s.get("hakeem_old_work_hint"))
            for s in json.load(open(DATA / "supersessions.json", encoding="utf-8"))]

    print(f"works={len(works)} units={len(units)} effects={len(effects)} supersessions={len(sups)}")
    if a.dry_run:
        return

    import psycopg
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL غير مضبوط")
    with psycopg.connect(url) as con, con.cursor() as cur:
        cur.execute((ROOT / "schema" / "staging.sql").read_text(encoding="utf-8"))
        for t in ("rejection", "supersession", "effect", "unit", "work"):
            cur.execute(f"DELETE FROM uqn_stage.{t} WHERE batch_id=%s", (a.batch,))
        cur.execute("DELETE FROM uqn_stage.batch WHERE batch_id=%s", (a.batch,))
        cur.execute("INSERT INTO uqn_stage.batch(batch_id,retrieved_on,package_sha,notes) VALUES (%s,'2026-09-25',%s,%s)",
                    (a.batch, pkg_sha(), "أم القرى: لوائح وأنظمة + مراسيم + قرارات مجلس الوزراء + أوامر ملكية + قرارات وزارية + هيئات (1442-1448هـ)"))
        cur.executemany("""INSERT INTO uqn_stage.work(batch_id,source_id,dataset,title,work_type,category,
            published_hijri,published_gregorian,source_url,royal_decree_no,royal_decree_date_hijri,approval_kind,
            approval_no,approval_date_hijri,effective_clause,supersedes_note,parent_law_hint,numbering,parse_status,
            article_count,sequence_contiguous,flags,quality_note,raw_sha)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", works)
        cur.executemany("""INSERT INTO uqn_stage.unit VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", units)
        cur.executemany("""INSERT INTO uqn_stage.effect(batch_id,effect_id,effect_type,instrument_kind,instrument_no,
            instrument_date_hijri,published_hijri,target_title_as_cited,target_citation,target_match_hakeem,
            target_match_status,operative_text,source_url,also_published_in)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""", effects)
        cur.executemany("""INSERT INTO uqn_stage.supersession(batch_id,new_source_url,new_title,published_hijri,hakeem_old_work_hint)
            VALUES (%s,%s,%s,%s,%s)""", sups)
        con.commit()
    print("تم التحميل إلى uqn_stage")

if __name__ == "__main__":
    main()
