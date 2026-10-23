#!/usr/bin/env python3
"""HKM-036 — زحف هيئة الخبراء من شبكة GitHub Actions (بيئة الوكيل محجوبة عن laws.boe.gov.sa).

خام فقط، بلا استخراج ولا OCR (أمر الزحف 2.2: R0 صفحات الأنظمة، R1 المرفقات كما يقدّمها العارض).
المدخل: ملف أهداف JSONL (سطر لكل هدف): {"kind": "law"|"attachment", "guid": ..., "url": ..., "law_guid": ..., "label": ...}
المخرج: <out>/pages/<guid>/<n>.html للأنظمة، و<out>/attachments/<viewer-id>/{viewer.html, Page_001.jpg, ...} للمرفقات،
        و<out>/manifest.jsonl (سطر لكل هدف: الحالة، البصمات، العدد) و<out>/run.json.
  python3 boe_fetch.py --targets targets.jsonl --out ingest/crawl-2026-10-23 --pace-ms 1500 --limit 50
"""
import argparse, hashlib, json, pathlib, re, sys, time, urllib.parse, urllib.request

BASE = "https://laws.boe.gov.sa"
DEADLINE = [0.0]  # وقت مطلق (time.time) يتوقف بعده الزحف بهدوء؛ 0 = بلا حد
MAX_PAGES = [400]


def out_of_time() -> bool:
    return DEADLINE[0] > 0 and time.time() >= DEADLINE[0]


def is_image(ct: str, body: bytes) -> bool:
    return body[:3] == b"\xff\xd8\xff" or body[:8] == b"\x89PNG\r\n\x1a\n" or "image/" in (ct or "").lower()
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 hakeem-crawl/1.0 (+https://hakeemsa.com; respectful, paced)"
IMG_RE = re.compile(r"GetViewerImage/?\?imageFileName=([A-Za-z0-9_\-]+_Page_\d{3}\.(?:jpg|jpeg|png))", re.I)
PAGES_RE = re.compile(r"/BoeLaws/Laws/LawDetails/([0-9a-f\-]{36})/(\d+)", re.I)


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def get(url: str, timeout: int = 60) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ar,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", ""
    except Exception as e:  # شبكة
        return 0, str(e).encode(), ""


def fetch_law(t: dict, out: pathlib.Path, pace: float) -> dict:
    guid = t["guid"]
    d = out / "pages" / guid
    d.mkdir(parents=True, exist_ok=True)
    pages, status = [], 0
    n = 1
    while n <= 50:
        url = f"{BASE}/BoeLaws/Laws/LawDetails/{guid}/{n}"
        status, body, _ = get(url)
        if status != 200:
            break
        (d / f"{n}.html").write_bytes(body)
        pages.append({"n": n, "sha256": sha(body), "bytes": len(body)})
        html = body.decode("utf-8", "replace")
        more = {int(m.group(2)) for m in PAGES_RE.finditer(html) if m.group(1).lower() == guid.lower()}
        if not any(k > n for k in more):
            break
        n += 1
        time.sleep(pace)
    att = sorted(set(re.findall(r"/BoeLaws/Laws/Viewer/[0-9a-f\-]{36}\?[^\"'\s<>]+", (d / "1.html").read_text("utf-8", "replace")))) if pages else []
    return {"kind": "law", "guid": guid, "status": status if not pages else 200, "pages": pages, "attachments_seen": att}


def fetch_attachment(t: dict, out: pathlib.Path, pace: float) -> dict:
    href = t["href"] if t.get("href") else t["url"]
    url = href if href.startswith("http") else BASE + href
    vid = urllib.parse.urlparse(url).path.rstrip("/").split("/")[-1]
    d = out / "attachments" / vid
    d.mkdir(parents=True, exist_ok=True)
    status, body, ctype = get(url)
    rec = {"kind": "attachment", "viewer_id": vid, "law_guid": t.get("law_guid"), "label": t.get("label"), "href": href, "status": status, "content_type": ctype, "pages": []}
    if status != 200:
        return rec
    if "pdf" in ctype.lower() or body[:5] == b"%PDF-":
        (d / "document.pdf").write_bytes(body)
        rec["pdf"] = {"sha256": sha(body), "bytes": len(body)}
        return rec
    (d / "viewer.html").write_bytes(body)
    rec["viewer_sha256"] = sha(body)
    names = []
    for m in IMG_RE.finditer(body.decode("utf-8", "replace")):
        if m.group(1) not in names:
            names.append(m.group(1))
    # العارض قد يحمّل الصور ديناميكيًّا؛ نجرّب الترقيم المتسلسل من الاسم الأول أو من معرّف العارض
    if not names:
        names = [f"{vid}_Page_001.jpg"]
    seen_missing = 0
    i = 0
    while i < len(names) and i < MAX_PAGES[0] and not out_of_time():
        name = names[i]
        st, img, ct = get(f"{BASE}/BoeLaws/Laws/GetViewerImage/?imageFileName={urllib.parse.quote(name)}")
        # صفحة HTML برمز 200 (خطأ أو تحويل) ليست صورة: لا تُحفظ ولا تُعدّ ولا تُطيل الاستنتاج المتسلسل
        if st == 200 and len(img) > 500 and is_image(ct, img):
            (d / name).write_bytes(img)
            rec["pages"].append({"name": name, "sha256": sha(img), "bytes": len(img)})
            seen_missing = 0
            # إن كانت القائمة مستنتجة لا مقروءة من العارض: استمر بالترقيم التالي
            if i == len(names) - 1 and re.search(r"_Page_(\d{3})", name):
                k = int(re.search(r"_Page_(\d{3})", name).group(1)) + 1
                names.append(re.sub(r"_Page_\d{3}", f"_Page_{k:03d}", name))
        else:
            seen_missing += 1
            if seen_missing >= 1 and i >= len(names) - 1:
                break
        i += 1
        time.sleep(pace)
    return rec


def fetch_image(t: dict, out: pathlib.Path, pace: float) -> dict:
    """صورة مفردة باسمها من GetViewerImage (لصفحات مرفقات معروفة سلفًا في boe.attachment_page)."""
    name = t["name"]
    d = out / "images"
    d.mkdir(parents=True, exist_ok=True)
    st, img, ct = get(f"{BASE}/BoeLaws/Laws/GetViewerImage/?imageFileName={urllib.parse.quote(name)}")
    rec = {"kind": "image", "name": name, "expected_sha256": t.get("sha256"), "status": st, "content_type": ct, "pages": []}
    if st == 200 and len(img) > 500 and is_image(ct, img):
        (d / name).write_bytes(img)
        rec["pages"].append({"name": name, "sha256": sha(img), "bytes": len(img)})
        rec["sha_match"] = sha(img) == t.get("sha256") if t.get("sha256") else None
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--pace-ms", type=int, default=1500)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--offset", type=int, default=0, help="تخطّي أول N هدف (للدفعات المتتابعة على الملف نفسه)")
    ap.add_argument("--kind", choices=["law", "attachment", "image", "all"], default="all")
    ap.add_argument("--max-pages", type=int, default=400, help="أقصى عدد صور لكل مرفق")
    ap.add_argument("--deadline-min", type=int, default=0, help="توقف هادئ بعد هذه الدقائق (0 = بلا حد)؛ ما جُلب يبقى محفوظًا")
    a = ap.parse_args()
    MAX_PAGES[0] = a.max_pages
    if a.deadline_min:
        DEADLINE[0] = time.time() + a.deadline_min * 60
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    pace = a.pace_ms / 1000
    targets = [json.loads(l) for l in open(a.targets, encoding="utf-8") if l.strip()]
    if a.kind != "all":
        targets = [t for t in targets if t["kind"] == a.kind]
    if a.offset:
        targets = targets[a.offset :]
    if a.limit:
        targets = targets[: a.limit]
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    ok = failed = done = 0
    def write_run(ended: bool) -> None:
        (out / "run.json").write_text(json.dumps({"started_at": started, "ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "ended": ended, "targets": len(targets), "done": done, "ok": ok, "failed": failed, "pace_ms": a.pace_ms, "offset": a.offset, "limit": a.limit, "max_pages": a.max_pages, "deadline_min": a.deadline_min, "origin": "github-actions"}, ensure_ascii=False, indent=1))
    with open(out / "manifest.jsonl", "a", encoding="utf-8") as mf:
        for t in targets:
            if out_of_time():
                print(f"DEADLINE بعد {done} من {len(targets)} هدفًا", flush=True)
                break
            rec = fetch_law(t, out, pace) if t["kind"] == "law" else fetch_image(t, out, pace) if t["kind"] == "image" else fetch_attachment(t, out, pace)
            rec["retrieved_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            good = rec["status"] == 200 and (rec.get("pages") or rec.get("pdf"))
            ok += 1 if good else 0
            failed += 0 if good else 1
            mf.write(json.dumps(rec, ensure_ascii=False) + "\n")
            mf.flush()
            done += 1
            write_run(False)
            print(("OK " if good else "FAIL ") + (t.get("guid") or t.get("href") or t.get("name") or "?") + f" status={rec['status']} pages={len(rec.get('pages', []))}" + (" pdf" if rec.get("pdf") else ""), flush=True)
            time.sleep(pace)
    write_run(True)
    print(f"targets={len(targets)} done={done} ok={ok} failed={failed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
