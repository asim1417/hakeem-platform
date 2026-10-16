"""نسخة تصفّح من قاعدة boe في ملف SQLite واحد (يفتح في DB Browser for SQLite أو أي أداة).
للتصفح والبحث فقط؛ الحقن في حكيم يكون من dump/boe_full.sql.gz.

  DATABASE_URL=… python3 scripts/export_sqlite.py dump/boe_browse.sqlite
"""
import json
import os
import pathlib
import sqlite3
import sys

import psycopg

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "dump/boe_browse.sqlite")
TABLES = ["crawl_run", "catalog", "page_snapshot", "law", "text_block", "unit", "amendment_note", "related_doc",
          "attachment", "attachment_page", "review_proposal", "vision_reading", "owner_decision", "attachment_target"]
VIEWS = ["v_amendment", "v_coverage", "attachment_pending"]


def conv(v):
    if isinstance(v, (list, dict)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return bytes(v)
    if v is None or isinstance(v, (int, float, str)):
        return v
    return str(v)


def main():
    if OUT.exists():
        OUT.unlink()
    lite = sqlite3.connect(OUT)
    with psycopg.connect(os.environ["DATABASE_URL"]) as pg, pg.cursor() as cur:
        for name in TABLES + VIEWS:
            # لقطات HTML الكاملة في ملف الحقن فقط؛ نسخة التصفح تحمل بصمتها ورابطها
            cur.execute("SELECT sha256, guid, url, run_id, http_status, retrieved_at, html_bytes FROM boe.page_snapshot" if name == "page_snapshot" else f"SELECT * FROM boe.{name}")
            cols = [d.name for d in cur.description]
            lite.execute(f'CREATE TABLE "{name}" ({", ".join(chr(34) + c + chr(34) for c in cols)})')
            rows = [[conv(v) for v in r] for r in cur.fetchall()]
            lite.executemany(f'INSERT INTO "{name}" VALUES ({",".join("?" * len(cols))})', rows)
            print(name, len(rows))
    for ix in ["unit(law_id, seq)", "amendment_note(law_id, unit_seq)", "law(guid)", "attachment(law_guid)",
               "attachment_page(attachment_id)", "review_proposal(note_id)", "v_amendment(law_guid, unit_seq)"]:
        t = ix.split("(")[0]
        lite.execute(f"CREATE INDEX ix_{t}_{len(ix)} ON {ix}")
    # بحث نصي سريع في المواد وفي نص صفحات المرفقات
    lite.execute("CREATE VIRTUAL TABLE unit_fts USING fts5(law_id UNINDEXED, seq UNINDEXED, heading, body)")
    lite.execute("INSERT INTO unit_fts SELECT law_id, seq, heading, body FROM unit")
    lite.execute("CREATE VIRTUAL TABLE attachment_page_fts USING fts5(attachment_id UNINDEXED, page_no UNINDEXED, ocr_text)")
    lite.execute("INSERT INTO attachment_page_fts SELECT attachment_id, page_no, ocr_text FROM attachment_page WHERE ocr_text IS NOT NULL")
    lite.execute("""CREATE TABLE readme (k TEXT, v TEXT)""")
    lite.executemany("INSERT INTO readme VALUES (?,?)", [
        ("المصدر", "موقع هيئة الخبراء بمجلس الوزراء laws.boe.gov.sa — قراءة 28 سبتمبر 2026 من متصفح المالك"),
        ("الغرض", "نسخة تصفح وبحث. الحقن في حكيم من dump/boe_full.sql.gz عبر scripts/load_boe.py وload_review.py"),
        ("v_amendment", "كل ملاحظة تعديل مع النظام والمادة واقتراح المراجعة وقراءة الصورة وقرار المالك"),
        ("الثقة", "محسوم من الملاحظة / مؤكد / مرجّح / يحتاج قرار المالك"),
        ("النص الآلي", "ocr_text وocr_draft مسودة آلية: الأرقام والتواريخ غير موثوقة، والمرجع صورة الصفحة"),
        ("unit.body", "نص المادة كما تعرضه الهيئة، وهو النص الأصلي عند الإصدار؛ التعديلات في amendment_note وreview_proposal"),
    ])
    lite.commit()
    lite.execute("VACUUM")
    lite.close()
    print(OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
