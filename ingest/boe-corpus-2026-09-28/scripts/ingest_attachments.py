"""يحوّل أجزاء المرفقات (boe_attach_part*.zip) إلى: صور محفوظة باسم بصمتها + نص آلي (tesseract ara) + صفوف boe.attachment/attachment_page.

  python3 scripts/ingest_attachments.py <zip>... --out data/attachments   (بلا قاعدة: يكتب attachments.jsonl وpages.jsonl)
  python3 scripts/ingest_attachments.py --load --target staging|branch|production [--preview]
النص الآلي تقريبي: الأرقام العربية الهندية والتواريخ تُقرأ خطأً أحيانًا؛ يُعتمد النص بعد مطابقته بالصورة.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import zipfile
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(pathlib.Path(__file__).parent))
ROOT = pathlib.Path(__file__).resolve().parents[1]
KIND = {"a": "amending_instrument", "o": "original_document"}


def aid(href: str) -> str:
    return "boe26-" + hashlib.sha256(("att|" + href).encode()).hexdigest()[:24]


def ocr(path: pathlib.Path) -> str:
    r = subprocess.run(["tesseract", str(path), "-", "-l", "ara", "--psm", "6"], capture_output=True, text=True, timeout=120)
    return r.stdout.strip()


def extract(zips, out: pathlib.Path) -> None:
    img_dir = out / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    viewers, images = {}, {}
    for z in zips:
        with zipfile.ZipFile(z) as zf:
            man = json.loads(zf.read("manifest.json"))
            for v in man["viewers"]:
                viewers[v["href"]] = v
            for im in man["images"]:
                data = zf.read(im["file"])
                if hashlib.sha256(data).hexdigest() != im["sha256"]:
                    raise SystemExit(f"بصمة صورة لا تطابق: {im['url']}")
                p = img_dir / f"{im['sha256']}.jpg"
                if not p.exists():
                    p.write_bytes(data)
                images[im["url"]] = im
    shas = sorted({im["sha256"] for im in images.values()})
    cache_p = out / "ocr_cache.json"
    cache = json.loads(cache_p.read_text(encoding="utf-8")) if cache_p.exists() else {}
    todo = [s for s in shas if s not in cache]
    with ThreadPoolExecutor(max_workers=4) as ex:
        for i, (s, t) in enumerate(zip(todo, ex.map(lambda s: ocr(img_dir / f"{s}.jpg"), todo)), start=1):
            cache[s] = t
            if i % 200 == 0:  # حفظ دوري حتى لا يضيع العمل عند الانقطاع
                cache_p.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
                print(f"ocr {i}/{len(todo)}", flush=True)
    cache_p.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    n_att = n_pg = missing = 0
    with open(out / "attachments.jsonl", "w", encoding="utf-8") as fa, open(out / "pages.jsonl", "w", encoding="utf-8") as fp:
        for href, v in viewers.items():
            pages = v.get("images") or []
            have = [u for u in pages if u in images]
            if len(have) != len(pages):
                missing += 1
                continue  # مرفق لم تكتمل صوره بعد: لا يُدوَّن ناقصًا
            a = {"id": aid(href), "href": href, "kind": KIND.get(v["kind"], v["kind"]), "law_guid": v["guid"], "unit_seq": v.get("seq") or None,
                 "label": v.get("label"), "page_count": len(pages), "retrieved_at": v["retrieved_at"]}
            fa.write(json.dumps(a, ensure_ascii=False) + "\n")
            n_att += 1
            for i, u in enumerate(pages, start=1):
                im = images[u]
                fp.write(json.dumps({"attachment_id": a["id"], "page_no": i, "image_url": u, "image_sha256": im["sha256"],
                                     "image_bytes": im["bytes"], "ocr_text": cache.get(im["sha256"]), "ocr_engine": "tesseract-5 ara psm6"},
                                    ensure_ascii=False) + "\n")
                n_pg += 1
    print({"attachments": n_att, "pages": n_pg, "unique_images": len(shas), "incomplete_attachments": missing})


def load(target: str, preview: bool) -> None:
    from common import connect, guards, require_approval, stats, totals
    out = ROOT / "data" / "attachments"
    con = connect(target)
    n = {"attachment": 0, "attachment_page": 0}
    with con.cursor() as cur:
        before = stats(cur); g0 = guards(cur, target == "production"); t0 = totals(cur)
        cur.execute((ROOT / "schema" / "boe_schema.sql").read_text(encoding="utf-8"))
        for line in open(out / "attachments.jsonl", encoding="utf-8"):
            a = json.loads(line)
            cur.execute("""INSERT INTO boe.attachment (id, href, kind, law_guid, unit_seq, label, page_count, retrieved_at)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (a["id"], a["href"], a["kind"], a["law_guid"], a["unit_seq"], a["label"], a["page_count"], a["retrieved_at"]))
            n["attachment"] += cur.rowcount
        for line in open(out / "pages.jsonl", encoding="utf-8"):
            p = json.loads(line)
            cur.execute("""INSERT INTO boe.attachment_page (attachment_id, page_no, image_url, image_sha256, image_bytes, ocr_text, ocr_engine)
                           VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (p["attachment_id"], p["page_no"], p["image_url"], p["image_sha256"], p["image_bytes"], p["ocr_text"], p["ocr_engine"]))
            n["attachment_page"] += cur.rowcount
        if guards(cur, target == "production") != g0 or totals(cur) != t0:
            con.rollback(); raise SystemExit("تغيّر حارس أو عدد — أُلغيت")
        try:
            require_approval(target, sum(n.values()), preview)
        except SystemExit:
            con.rollback(); raise
        con.rollback() if preview else con.commit()
    with con.cursor() as cur:
        after = stats(cur)
    print("INSERTED", n, "committed", not preview, "STAT_DELTA", {k: (after[k][0] - before[k][0], after[k][1] - before[k][1]) for k in before})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("zips", nargs="*")
    ap.add_argument("--out", default=str(ROOT / "data" / "attachments"))
    ap.add_argument("--load", action="store_true")
    ap.add_argument("--target", choices=["staging", "branch", "production"])
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    if a.load:
        load(a.target, a.preview)
    else:
        extract(a.zips, pathlib.Path(a.out))
