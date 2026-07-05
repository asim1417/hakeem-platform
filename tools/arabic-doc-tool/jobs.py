#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jobs.py — معالجة الوثائق في الخلفية عبر «مهام» تعيش على الخادم.

الغرض: يرفع المستخدم وثائقه فتُعالَج على الخادم في خيط مستقلّ — فيُغلق التبويب أو
الجهاز ويعود لاحقاً فيجد النتيجة جاهزة. (خيط الخادم لا يتأثّر بإغلاق المتصفح.)

المزوّدون:
  - local  : محرّك بايثون (doc_reader) — استخراج نصّي/‏Word + OCR عربي (زيني). بلا إنترنت.
  - gemini : مزوّد إضافي اختياري (يتطلّب GEMINI_API_KEY) — رؤية قويّة للممسوح والخطّ اليدوي.

الدوام: تُحفظ ملفات الرفع على القرص وحالة المهمّة في SQLite؛ فإن أُعيد تشغيل الخادم
تُستأنف المهام غير المكتملة تلقائياً.
"""
import os
import io
import json
import time
import uuid
import sqlite3
import threading
import tempfile
from contextlib import contextmanager

DB = os.environ.get("TOOL_DB", os.path.join(tempfile.gettempdir(), "tool_docs.db"))
UPLOAD_DIR = os.environ.get("JOBS_UPLOAD_DIR", os.path.join(os.path.dirname(DB) or ".", "job_uploads"))

_lock = threading.Lock()


@contextmanager
def _con():
    """اتصالٌ يُلزِم الحفظ ويُغلق دائماً (لا تسريب اتصالات عبر المهام)."""
    con = sqlite3.connect(DB, timeout=30)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_jobs_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with _lock, _con() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs(
              id TEXT PRIMARY KEY, provider TEXT, model TEXT, status TEXT,
              total INTEGER, done INTEGER, error TEXT, created REAL
            );
            CREATE TABLE IF NOT EXISTS job_files(
              id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT, idx INTEGER,
              name TEXT, path TEXT, status TEXT, kind TEXT, text TEXT, err TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_jf_job ON job_files(job_id);
            """
        )


def _process_file(provider, model, name, data):
    """يعيد (text, kind). يجرّب المزوّد المطلوب، ويتراجع للمحلّي إن فشل السحابي."""
    from doc_reader import read_bytes, clean_text

    if provider == "gemini":
        try:
            from gemini_provider import extract_with_gemini
            txt = extract_with_gemini(name, data, model_type=model or "flash")
            return clean_text(txt or ""), "Gemini %s" % (model or "flash")
        except Exception as e:
            # تراجعٌ منظّم للمحلّي مع تنبيه (لا فشلٌ صامت)
            txt, kind = read_bytes(name, data)
            note = "(تعذّر Gemini: %s — استُعمل المحلّي)" % str(e)[:80]
            return clean_text(txt or ""), (kind + " " + note)

    txt, kind = read_bytes(name, data)
    return clean_text(txt or ""), kind


def _run(job_id):
    """خيط المعالجة: يمشي على ملفات المهمّة غير المنجزة، يعالجها، ويحدّث الحالة."""
    with _lock, _con() as con:
        row = con.execute("SELECT provider,model FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            return
        provider, model = row["provider"], row["model"]
        con.execute("UPDATE jobs SET status='running' WHERE id=?", (job_id,))

    while True:
        with _lock, _con() as con:
            f = con.execute(
                "SELECT id,name,path FROM job_files WHERE job_id=? AND status='pending' ORDER BY idx LIMIT 1",
                (job_id,),
            ).fetchone()
        if not f:
            break
        try:
            with open(f["path"], "rb") as fh:
                data = fh.read()
            text, kind = _process_file(provider, model, f["name"], data)
            ok = bool((text or "").strip())
            with _lock, _con() as con:
                con.execute(
                    "UPDATE job_files SET status=?, kind=?, text=?, err=NULL WHERE id=?",
                    ("done" if ok else "empty", kind, text, f["id"]),
                )
                con.execute("UPDATE jobs SET done=done+1 WHERE id=?", (job_id,))
        except Exception as e:
            with _lock, _con() as con:
                con.execute("UPDATE job_files SET status='error', err=? WHERE id=?", (str(e)[:200], f["id"]))
                con.execute("UPDATE jobs SET done=done+1 WHERE id=?", (job_id,))
        finally:
            try:
                os.remove(f["path"])
            except OSError:
                pass

    with _lock, _con() as con:
        con.execute("UPDATE jobs SET status='done' WHERE id=?", (job_id,))


def start_job(files, provider="local", model="flash"):
    """
    files: قائمة (name, bytes). يحفظها على القرص، ينشئ المهمّة، ويطلق خيط المعالجة.
    يعيد job_id فوراً (لا ينتظر الاكتمال).
    """
    init_jobs_db()
    job_id = uuid.uuid4().hex[:16]
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    with _lock, _con() as con:
        con.execute(
            "INSERT INTO jobs(id,provider,model,status,total,done,error,created) VALUES(?,?,?,?,?,?,?,?)",
            (job_id, provider, model, "queued", len(files), 0, None, time.time()),
        )
        for i, (name, data) in enumerate(files):
            p = os.path.join(job_dir, "%03d_%s" % (i, os.path.basename(name or "file")))
            with open(p, "wb") as fh:
                fh.write(data)
            con.execute(
                "INSERT INTO job_files(job_id,idx,name,path,status,kind,text,err) VALUES(?,?,?,?,?,?,?,?)",
                (job_id, i, name, p, "pending", None, None, None),
            )
    threading.Thread(target=_run, args=(job_id,), daemon=True).start()
    return job_id


def get_job(job_id, include_text=True):
    with _lock, _con() as con:
        j = con.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not j:
            return None
        cols = "id,idx,name,status,kind,err" + (",text" if include_text else "")
        files = con.execute(
            "SELECT %s FROM job_files WHERE job_id=? ORDER BY idx" % cols, (job_id,)
        ).fetchall()
    out = dict(j)
    out["files"] = [dict(f) for f in files]
    return out


def list_jobs(limit=50):
    with _lock, _con() as con:
        rows = con.execute(
            "SELECT id,provider,model,status,total,done,created FROM jobs ORDER BY created DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def resume_pending():
    """عند إقلاع الخادم: أعد إطلاق المهام التي لم تكتمل (لها ملفات pending)."""
    try:
        init_jobs_db()
        with _lock, _con() as con:
            ids = [
                r["job_id"]
                for r in con.execute(
                    "SELECT DISTINCT job_id FROM job_files WHERE status='pending'"
                ).fetchall()
            ]
        for jid in ids:
            threading.Thread(target=_run, args=(jid,), daemon=True).start()
    except Exception:
        pass
