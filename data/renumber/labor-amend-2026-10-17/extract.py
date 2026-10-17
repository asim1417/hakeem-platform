"""HKM-028: استخراج نوافذ «تعديلات المادة» لنظام العمل من لقطة الهيئة 28/09/2026 إلى extracted.json.
   python3 -I data/renumber/labor-amend-2026-10-17/extract.py
كل نافذة كما وردت (نص HTML مسطّح)، بترتيب ظهورها في الصفحة، مع عنوانها."""
import gzip, html, json, re

GUID = "08381293-6388-48e2-8ad2-a9a700f2aa94"
SNAP = "ingest/boe-corpus-2026-09-28/data/boe_snapshots.jsonl.gz"


def block(h, start):
    depth = 0
    for m in re.finditer(r"<div\b|</div>", h[start:]):
        depth += 1 if m.group(0).startswith("<div") else -1
        if depth == 0:
            return h[start:start + m.end()]
    return h[start:]


def txt(fragment):
    s = re.sub(r"<br\s*/?>", "\n", fragment)
    s = re.sub(r"</(p|div)>", "\n", s)
    s = html.unescape(re.sub("<[^>]+>", "", s))
    return re.sub(r"\s+", " ", s).strip()


page = next(json.loads(l)["html"] for l in gzip.open(SNAP, "rt") if GUID in l[:2000])
out = []
for m in re.finditer(r'<div class="article_item_popup">', page):
    b = block(page, m.start())
    head = re.search(r"<h3>(.*?)</h3>", b, re.S)
    c = b.find('<div class="HTMLContainer">')
    out.append({"i": len(out), "heading": txt(head.group(1)) if head else "", "text": txt(block(b, c)) if c >= 0 else ""})
json.dump(out, open("data/renumber/labor-amend-2026-10-17/extracted.json", "w"), ensure_ascii=False, indent=1)
print(len(out))
