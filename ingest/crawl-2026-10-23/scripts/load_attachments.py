#!/usr/bin/env python3
"""HKM-037 — حقن المرفقات ونصها الآلي في boe.attachment / boe.attachment_page (إضافة فقط؛ لا تعديل ولا حذف).

  python3 load_attachments.py --dir ingest/crawl-2026-10-23/ocr/<run> --mode preview|apply

يقرأ DATABASE_URL من البيئة (لا يُطبع أبدًا). preview: ينفّذ داخل معاملة ثم يتراجع ويطبع العدّ. apply: يثبّت.
الحارس: لا يُدرج إلا ما لا يوجد (id أو href للمرفق؛ attachment_id+page_no للصفحة)، ويتحقق أن md5 الملفين يطابق meta.json،
وأن أعداد الجداول الأخرى (articles، unit_version، verification) لم تتغير داخل المعاملة.
"""
import argparse, hashlib, json, os, pathlib, sys

import psycopg2

GUARD_TABLES = ["public.articles", "public.unit_version", "public.verification", "boe.amendment_note"]


def md5(p: pathlib.Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def counts(cur) -> dict:
    out = {}
    for t in GUARD_TABLES + ["boe.attachment", "boe.attachment_page"]:
        cur.execute(f"SELECT count(*) FROM {t}")
        out[t] = cur.fetchone()[0]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--mode", choices=["preview", "apply"], required=True)
    a = ap.parse_args()
    d = pathlib.Path(a.dir)
    meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    for f in ("attachments.jsonl", "pages.jsonl"):
        got = md5(d / f)
        if got != meta["md5"][f]:
            print(f"::error::بصمة {f} لا تطابق meta.json ({got} ≠ {meta['md5'][f]})")
            return 2
    atts = [json.loads(l) for l in open(d / "attachments.jsonl", encoding="utf-8")]
    pages = [json.loads(l) for l in open(d / "pages.jsonl", encoding="utf-8")]
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("::error::DATABASE_URL غير مضبوط")
        return 2
    con = psycopg2.connect(url)
    con.autocommit = False
    try:
        with con.cursor() as cur:
            before = counts(cur)
            n_a = n_p = 0
            for x in atts:
                cur.execute(
                    """INSERT INTO boe.attachment (id, href, kind, law_guid, unit_seq, label, page_count, retrieved_at)
                       SELECT %s,%s,%s,%s,%s,%s,%s,%s::timestamptz
                       WHERE NOT EXISTS (SELECT 1 FROM boe.attachment a WHERE a.id=%s OR a.href=%s)""",
                    (x["id"], x["href"], x["kind"], x["law_guid"], x.get("unit_seq"), x.get("label"), x["page_count"], x["retrieved_at"], x["id"], x["href"]),
                )
                n_a += cur.rowcount
            for p in pages:
                cur.execute(
                    """INSERT INTO boe.attachment_page (attachment_id, page_no, image_url, image_sha256, image_bytes, ocr_text, ocr_engine)
                       SELECT %s,%s,%s,%s,%s,%s,%s
                       WHERE EXISTS (SELECT 1 FROM boe.attachment a WHERE a.id=%s)
                         AND NOT EXISTS (SELECT 1 FROM boe.attachment_page q WHERE q.attachment_id=%s AND q.page_no=%s)""",
                    (p["attachment_id"], p["page_no"], p["image_url"], p["image_sha256"], p["image_bytes"], p["ocr_text"], p["ocr_engine"], p["attachment_id"], p["attachment_id"], p["page_no"]),
                )
                n_p += cur.rowcount
            after = counts(cur)
            for t in GUARD_TABLES:
                if before[t] != after[t]:
                    raise RuntimeError(f"تغيّر عدد {t} داخل المعاملة — أُلغيت")
            report = {"mode": a.mode, "files": {"attachments": len(atts), "pages": len(pages)}, "inserted": {"attachment": n_a, "attachment_page": n_p},
                      "before": before, "after": after, "md5": meta["md5"]}
            print(json.dumps(report, ensure_ascii=False, indent=1))
            if a.mode == "apply":
                con.commit()
                print("COMMITTED")
            else:
                con.rollback()
                print("ROLLED BACK (preview)")
    except Exception as e:
        con.rollback()
        print(f"::error::{e}")
        return 1
    finally:
        con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
