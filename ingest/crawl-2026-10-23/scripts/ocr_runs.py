#!/usr/bin/env python3
"""HKM-037 — نص آلي (tesseract ara) لصور تشغيلات الزحف (runs/<run>/manifest.jsonl + attachments/<viewer>/<name>.jpg).

  python3 ocr_runs.py --runs <dir-with-runs>/* --out <dir> [--workers 4]

المخرج: <out>/ocr_cache.json (بصمة الصورة ← النص)، و<out>/attachments.jsonl وpages.jsonl بصيغة boe.attachment / boe.attachment_page
(المعرّف boe26-<sha256("att|"+href)[:24]> كما في ingest_attachments.py حتى لا يتكرر ما زُحف قبلًا).
النص الآلي تقريبي: الأرقام والتواريخ تُقرأ خطأً أحيانًا؛ لا يُعتمد نصًّا قانونيًّا إلا بعد مطابقته بالصورة.
"""
import argparse, hashlib, json, os, pathlib, subprocess, time
from concurrent.futures import ThreadPoolExecutor

# tesseract يفتح خيوط OpenMP لكل عملية؛ مع عدة عمال يتزاحم على الأنوية ويبطؤ أضعافًا، فنقيّده بخيط واحد لكل عملية
ENV = {**os.environ, "OMP_THREAD_LIMIT": "1"}

KIND = {"issuance_instrument": "amending_instrument", "amending_instrument": "amending_instrument", "original_document": "original_document", "article_attachment": "article_attachment"}


def aid(href: str) -> str:
    return "boe26-" + hashlib.sha256(("att|" + href).encode()).hexdigest()[:24]


def ocr(path: pathlib.Path) -> str:
    try:
        r = subprocess.run(["tesseract", str(path), "-", "-l", "ara", "--psm", "6"], capture_output=True, text=True, timeout=600, env=ENV)
        return r.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""  # تُترك فارغة وتُعدّ في empty_ocr؛ لا تُسقط الدفعة


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--targets", nargs="*", default=[], help="ملفات الأهداف لاستكمال akind/label")
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    meta = {}
    for tf in a.targets:
        for l in open(tf, encoding="utf-8"):
            if l.strip():
                t = json.loads(l)
                if t.get("href"):
                    meta[t["href"]] = t
    recs = []  # (run, rec, dir)
    for rd in a.runs:
        rd = pathlib.Path(rd)
        mf = rd / "manifest.jsonl"
        if not mf.exists():
            continue
        for l in open(mf, encoding="utf-8"):
            r = json.loads(l)
            if r.get("kind") == "attachment" and r.get("pages"):
                recs.append((rd.name, r, rd / "attachments" / r["viewer_id"]))
    jobs = {}
    for _, r, d in recs:
        for p in r["pages"]:
            jobs[p["sha256"]] = d / p["name"]
    cache_p = out / "ocr_cache.json"
    cache = json.loads(cache_p.read_text(encoding="utf-8")) if cache_p.exists() else {}
    todo = [s for s in jobs if s not in cache]
    print(f"attachments={len(recs)} images={len(jobs)} todo={len(todo)}", flush=True)
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        for i, (s, txt) in enumerate(zip(todo, ex.map(lambda s: ocr(jobs[s]), todo)), start=1):
            cache[s] = txt
            if i % 100 == 0:
                cache_p.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
                print(f"ocr {i}/{len(todo)} {time.time()-t0:.0f}s", flush=True)
    cache_p.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    n_att = n_pg = 0
    with open(out / "attachments.jsonl", "w", encoding="utf-8") as fa, open(out / "pages.jsonl", "w", encoding="utf-8") as fp:
        for run, r, d in recs:
            href = r["href"]; t = meta.get(href, {})
            a_ = {"id": aid(href), "href": href, "kind": KIND.get(t.get("akind") or "", "attachment"), "law_guid": r.get("law_guid") or t.get("law_guid"),
                  "unit_seq": t.get("unit_seq"), "label": r.get("label") or t.get("label"), "page_count": len(r["pages"]), "retrieved_at": r["retrieved_at"], "run": run}
            fa.write(json.dumps(a_, ensure_ascii=False) + "\n"); n_att += 1
            for i, p in enumerate(r["pages"], start=1):
                fp.write(json.dumps({"attachment_id": a_["id"], "page_no": i, "image_url": f"https://laws.boe.gov.sa/BoeLaws/Laws/GetViewerImage/?imageFileName={p['name']}",
                                     "image_sha256": p["sha256"], "image_bytes": p["bytes"], "ocr_text": cache.get(p["sha256"]), "ocr_engine": "tesseract-5 ara psm6"}, ensure_ascii=False) + "\n")
                n_pg += 1
    empty = sum(1 for s in jobs if not cache.get(s))
    print(json.dumps({"attachments": n_att, "pages": n_pg, "empty_ocr": empty, "seconds": round(time.time() - t0)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
