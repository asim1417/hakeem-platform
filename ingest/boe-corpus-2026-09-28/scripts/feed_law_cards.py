"""يغذّي بطاقات الأنظمة في حكيم (law_card) من قاعدة الهيئة للأنظمة المربوطة. إضافة فقط.

يتطلب هجرة الموجة الأولى (20260928120000_search_surface_law_card).
لا يكتب حالة ولا نصًا ولا تحققًا: البطاقة عرض بمصدرها، والحالة المعروضة تبقى من verification.
  python3 scripts/feed_law_cards.py --target staging|branch|production [--preview]
"""
import argparse
import hashlib
import json

from common import require_approval, connect, guards, sid, stats, totals

BY = "boe-card-2026-09-28"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["staging", "branch", "production"], required=True)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    con = connect(a.target)
    n = 0
    skipped = 0
    with con.cursor() as cur:
        before = stats(cur)
        g0 = guards(cur, a.target == "production")
        t0 = totals(cur)
        cur.execute(
            """SELECT m.hakeem_system_id, l.id, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri,
                      l.published_gregorian, l.status_at_source, l.category_path, l.instruments, l.url, p.retrieved_at
               FROM boe.current_match m
               JOIN boe.current_law l ON l.guid = m.guid
               JOIN boe.page_snapshot p ON p.sha256 = l.snapshot_sha256
               WHERE m.hakeem_system_id IS NOT NULL"""
        )
        for sys_id, law_id, name, summary, ih, ig, ph, pg, st, cat, instr, url, retrieved in cur.fetchall():
            if not name:
                skipped += 1
                continue
            with con.cursor() as c2:
                c2.execute("SELECT kind, heading, body FROM boe.text_block WHERE law_id=%s ORDER BY seq", (law_id,))
                blocks = [{"kind": k, "heading": h, "text": b} for k, h, b in c2.fetchall()]
            payload = json.dumps([name, summary, ih, str(ig), ph, str(pg), st, cat, instr, blocks, url], ensure_ascii=False, sort_keys=True, default=str)
            cid = sid("lc26-", sys_id, hashlib.sha256(payload.encode()).hexdigest())
            with con.cursor() as c3:
                c3.execute(
                    """INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri,
                         published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url,
                         retrieved_on, created_by)
                       SELECT %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,'هيئة الخبراء بمجلس الوزراء',%s,%s,%s
                       WHERE NOT EXISTS (SELECT 1 FROM law_card WHERE id=%s)""",
                    (cid, sys_id, name, summary, ih, ig, ph, pg, st, list(cat or []), json.dumps(instr or [], ensure_ascii=False),
                     json.dumps(blocks, ensure_ascii=False), url, retrieved.date(), BY, cid),
                )
                n += c3.rowcount
        g1 = guards(cur, a.target == "production")
        t1 = totals(cur)
        if g0 != g1 or t0 != t1:
            con.rollback()
            raise SystemExit("تغيّر حارس أو عدد — أُلغيت")
        require_approval(a.target, n, a.preview)
        if a.preview:
            con.rollback()
        else:
            con.commit()
    with con.cursor() as cur:
        after = stats(cur)
    con.close()
    delta = {k: (after[k][0] - before[k][0], after[k][1] - before[k][1]) for k in before if k in after}
    print("LAW_CARDS_INSERTED", n, "skipped_no_name", skipped, "committed", not a.preview, "STAT_DELTA", delta)
    if any(v != (0, 0) for v in delta.values()):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
