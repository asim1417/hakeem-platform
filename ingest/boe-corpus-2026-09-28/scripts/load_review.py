"""يحمّل نتائج المراجعة إلى مخطط boe: اقتراحات المراجعة، وقراءات صور الأدوات، وقائمة المرفقات غير المقروءة.
إضافة فقط، ويعيد التشغيل بأمان (ON CONFLICT DO NOTHING). لا يلمس أي جدول في حكيم.

  python3 scripts/load_review.py --target staging|branch|production [--preview]
"""
import argparse
import json
import pathlib

from common import connect, guards, require_approval, stats, totals

ROOT = pathlib.Path(__file__).resolve().parents[1]
REVIEW = ROOT / "data" / "review"
REVIEW_RUN = "review-2026-09-29"
READ_RUN = "vision-2026-09-29"


def jl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["staging", "branch", "production"], required=True)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    proposals = jl(REVIEW / "proposals.jsonl")
    vision = jl(REVIEW / "vision" / "final.jsonl")
    targets = json.loads((ROOT / "data" / "attachments" / "targets_round2.json").read_text(encoding="utf-8"))
    con = connect(a.target)
    n = {"review_proposal": 0, "vision_reading": 0, "attachment_target": 0}
    with con.cursor() as cur:
        before = stats(cur)
        g0 = guards(cur, a.target == "production")
        t0 = totals(cur)
        cur.execute((ROOT / "schema" / "boe_schema.sql").read_text(encoding="utf-8"))
        for p in proposals:
            note_id, _, piece = p["note_id"].partition("#")
            cur.execute(
                """INSERT INTO boe.review_proposal (id, note_id, piece_no, category, effect, effect_basis, instrument, instrument_date_hijri,
                     all_instruments, new_text, evidence, confidence, reason, attachment_href, image_url, image_page, ocr_draft, parser_effect, review_run)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (p["note_id"], note_id, int(piece or 1), p["category"], p["effect"], p["effect_basis"], p["instrument"], p["instrument_date"],
                 p["all_instruments"], p["new_text"], p["evidence"], p["confidence"], p["reason"] or None, p["attachment_url"],
                 p.get("draft_image") or p.get("page_image"), p.get("draft_page") or p.get("ocr_page"),
                 p.get("vision_other_text") or p.get("draft_ocr") or p.get("ocr_excerpt"), p["old_effect"], REVIEW_RUN))
            n["review_proposal"] += cur.rowcount
        for v in vision:
            cur.execute(
                """INSERT INTO boe.vision_reading (note_id, doc_group, status, instrument_seen, instrument_match, lead_in, new_text, pages,
                     image_sha256, verify_verdict, fixes_applied, notes, read_run)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (v["note_id"], v["doc"], v["status"], v["instrument_seen"], v["instrument_match"], v["lead_in"], v["new_text"],
                 v["pages"] or [], [x.split(".")[0] for x in v["images"]], v["verify"], v["fixes_applied"], v["notes"] or None, READ_RUN))
            n["vision_reading"] += cur.rowcount
        for t in targets:
            cur.execute("""INSERT INTO boe.attachment_target (href, kind, law_guid, label, priority) VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (t["href"], t["kind"], t["guid"], t["label"] or None, t["pri"]))
            n["attachment_target"] += cur.rowcount
        if guards(cur, a.target == "production") != g0 or totals(cur) != t0:
            con.rollback()
            raise SystemExit("تغيّر حارس أو عدد — أُلغيت المعاملة")
        try:
            require_approval(a.target, sum(n.values()), a.preview)
        except SystemExit:
            con.rollback()
            raise
        con.rollback() if a.preview else con.commit()
    with con.cursor() as cur:
        after = stats(cur)
    print("INSERTED", n, "committed", not a.preview,
          "STAT_DELTA", {k: (after[k][0] - before[k][0], after[k][1] - before[k][1]) for k in before})


if __name__ == "__main__":
    main()
