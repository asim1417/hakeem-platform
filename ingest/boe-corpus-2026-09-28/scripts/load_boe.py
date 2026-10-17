"""يحمّل قاعدة هيئة الخبراء (مخطط boe) إلى الهدف. إضافة فقط، ويعيد التشغيل بأمان.

لا يلمس أي جدول في حكيم. يكتب في boe.* فقط.
  python3 scripts/load_boe.py --target staging|branch|production [--preview]
"""
import argparse
import gzip
import json
import pathlib

from common import require_approval, connect, guards, stats, totals

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PARSED = DATA / "parsed"


def jl(path: pathlib.Path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["staging", "branch", "production"], required=True)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    run = json.loads((DATA / "crawl_run.json").read_text(encoding="utf-8"))
    catalog = json.loads((DATA / "boe_catalog.json").read_text(encoding="utf-8"))
    con = connect(a.target)
    n = {k: 0 for k in ("crawl_run", "catalog", "page_snapshot", "law", "text_block", "unit", "amendment_note", "related_doc")}
    with con.cursor() as cur:
        before = stats(cur)
        g0 = guards(cur, a.target == "production")
        t0 = totals(cur)
        cur.execute((ROOT / "schema" / "boe_schema.sql").read_text(encoding="utf-8"))
        cur.execute(
            """INSERT INTO boe.crawl_run (id, started_at, ended_at, operator, origin, pace_ms, pages_ok, pages_failed, stop_reason, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
            (run["id"], run["started_at"], run.get("ended_at"), run["operator"], run["origin"], run["pace_ms"],
             run["pages_ok"], run["pages_failed"], run.get("stop_reason"), run.get("notes")),
        )
        n["crawl_run"] += cur.rowcount
        for c in catalog:
            cur.execute("INSERT INTO boe.catalog (guid, run_id, tab, category, name) VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                        (c["guid"], run["id"], c["tab"], c["category"], c["name"]))
            n["catalog"] += cur.rowcount
        with gzip.open(DATA / "boe_snapshots.jsonl.gz", "rt", encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                raw = r["html"].encode("utf-8")
                cur.execute(
                    """INSERT INTO boe.page_snapshot (sha256, guid, url, run_id, http_status, retrieved_at, html_gz, html_bytes)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (sha256) DO NOTHING""",
                    (r["sha256"], r["guid"], r["url"], run["id"], r["status"], r["retrieved_at"], gzip.compress(raw, 9), len(raw)),
                )
                n["page_snapshot"] += cur.rowcount
        for law in jl(PARSED / "law.jsonl"):
            cur.execute(
                """INSERT INTO boe.law (id, guid, snapshot_sha256, url, name, name_en, description_en, summary, category_path,
                     issued_raw, issued_hijri, issued_gregorian, published_raw, published_hijri, published_gregorian,
                     status_at_source, instruments, article_count, parse_flags)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s) ON CONFLICT (id) DO NOTHING""",
                (law["id"], law["guid"], law["snapshot_sha256"], law["url"], law["name"], law["name_en"], law["description_en"],
                 law["summary"], law["category_path"], law["issued_raw"], law["issued_hijri"], law["issued_gregorian"],
                 law["published_raw"], law["published_hijri"], law["published_gregorian"], law["status_at_source"],
                 json.dumps(law["instruments"], ensure_ascii=False), law["article_count"], law["parse_flags"]),
            )
            n["law"] += cur.rowcount
        for b in jl(PARSED / "text_block.jsonl"):
            cur.execute("INSERT INTO boe.text_block (law_id, seq, kind, heading, body) VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                        (b["law_id"], b["seq"], b["kind"], b.get("heading"), b["body"]))
            n["text_block"] += cur.rowcount
        for u in jl(PARSED / "unit.jsonl"):
            cur.execute(
                """INSERT INTO boe.unit (law_id, seq, heading, article_number, is_bis, body, body_html, body_sha256, css_class)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (u["law_id"], u["seq"], u["heading"], u["article_number"], u["is_bis"], u["body"], u["body_html"], u["body_sha256"], u["css_class"]),
            )
            n["unit"] += cur.rowcount
        for x in jl(PARSED / "amendment_note.jsonl"):
            cur.execute(
                """INSERT INTO boe.amendment_note (id, law_id, unit_seq, note_seq, note_text, effect, new_text,
                     instrument_kind, instrument_no, instrument_date_hijri, needs_review)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                (x["id"], x["law_id"], x["unit_seq"], x["note_seq"], x["note_text"], x["effect"], x["new_text"],
                 x["instrument_kind"], x["instrument_no"], x["instrument_date_hijri"], x["needs_review"]),
            )
            n["amendment_note"] += cur.rowcount
        for r in jl(PARSED / "related_doc.jsonl"):
            cur.execute("INSERT INTO boe.related_doc (law_id, target_guid, label) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (r["law_id"], r["target_guid"], r["label"]))
            n["related_doc"] += cur.rowcount
        g1 = guards(cur, a.target == "production")
        t1 = totals(cur)
        if g0 != g1 or t0 != t1:
            con.rollback()
            raise SystemExit("تغيّر حارس أو عدد في جداول حكيم — أُلغيت")
        try:
            require_approval(a.target, sum(n.values()), a.preview)
        except SystemExit:
            con.rollback()
            raise
        if a.preview:
            con.rollback()
        else:
            con.commit()
    with con.cursor() as cur:
        after = stats(cur)
    con.close()
    delta = {k: (after[k][0] - before[k][0], after[k][1] - before[k][1]) for k in before if k in after}
    print("INSERTED", n, "committed", not a.preview)
    print("HAKEEM_TOTALS", t1, "STAT_DELTA", delta)
    if any(v != (0, 0) for v in delta.values()):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
