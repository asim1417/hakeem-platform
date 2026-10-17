"""
HKM-028: يقارن مواد أنظمة في legal_articles بنسخة هيئة الخبراء (لقطة ingest/boe-corpus-2026-09-28)
مادةً بمادة بالنص، لا بالرقم، ويعطي لكل صف رقمه الرسمي ودرجة «مكرر» عند الهيئة.

المدخل: تصدير READ ONLY من legal_articles بصيغة JSON:
  [[id, lawName, articleNumber, title, md5(نص مطبَّع), طول النص المطبَّع, أول 300 حرف منه], ...]
  التطبيع: إسقاط التشكيل والتطويل، وإبقاء الحروف العربية والأرقام فقط، وتوحيد أ إ آ ٱ ← ا، ى ← ي، ة ← ه.
المخرج: report.json (لكل نظام: الصفوف وموضعها عند الهيئة، والزائد، والناقص) وخلاصة على stdout.

المطابقة: حرفية بالبصمة، ثم ببداية النص (60 حرفًا)، ثم تشابه ≥ 0.75 لأول 120 حرفًا. عند تعدد نسخ
النظام في اللقطة (ملغى ونافذ) تُختار النسخة الأكثر مطابقة. لا يكتب على أي قاعدة.

  python3 -I scripts/audit/compare-with-boe.py <export.json> <out-dir> [boe-parsed-dir]
"""
import collections
import difflib
import hashlib
import json
import re
import sys

DIACRITICS = "[ً-ْٰـ]"


def text_norm(t):
    t = re.sub(DIACRITICS, "", t or "")
    t = re.sub("[^ء-ي0-9٠-٩]", "", t)
    return t.translate(str.maketrans("أإآٱىة", "ااااية"))


def name_norm(s):
    s = re.sub(DIACRITICS, "", s or "")
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"\(.*?\)|[.:،,]", " ", s)
    s = re.sub(r"\d{3,4}\s*ه?", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_rows(path):
    raw = open(path, encoding="utf-8").read()
    if '"j"' in raw:  # ناتج أداة Neon: [[], [{"j": [...]}]]
        raw = raw[raw.index('"j"'):]
        raw = raw[raw.index("["):]
    rows, _ = json.JSONDecoder().raw_decode(raw)
    return rows


def match_law(drows, boe_units):
    B = []
    for u in boe_units:
        t = text_norm(u.get("body", ""))
        B.append(dict(n=u.get("article_number"), bis=1 if u.get("is_bis") else 0, heading=u.get("heading"), t=t,
                      md5=hashlib.md5(t.encode()).hexdigest()))
    used, res = set(), []
    for d in drows:
        best, how = None, None
        for i, b in enumerate(B):
            if i not in used and b["md5"] == d["md5"]:
                best, how = i, "exact"
                break
        if best is None:
            scored = []
            for i, b in enumerate(B):
                if i in used or not b["t"]:
                    continue
                head, bhead = d["head"][:120], b["t"][:300]
                if len(head) >= 40 and (head[:60] in b["t"] or bhead[:60] in d["head"]):
                    scored.append((1.0, i))
                    continue
                r = difflib.SequenceMatcher(None, head, bhead[:120]).ratio()
                if r >= 0.75:
                    scored.append((r, i))
            if scored:
                scored.sort(reverse=True)
                best = scored[0][1]
                how = "prefix" if scored[0][0] == 1.0 else f"fuzzy{scored[0][0]:.2f}"
        if best is None:
            res.append(dict(id=d["id"], cur=d["n"], title=d["title"], boe_n=None, boe_bis=None, how="unmatched"))
        else:
            used.add(best)
            res.append(dict(id=d["id"], cur=d["n"], title=d["title"], boe_n=B[best]["n"], boe_bis=B[best]["bis"], how=how))
    missing = [dict(n=b["n"], bis=b["bis"], heading=b["heading"]) for i, b in enumerate(B) if i not in used]
    return res, missing


def main():
    export, out_dir = sys.argv[1], sys.argv[2]
    boe_dir = sys.argv[3] if len(sys.argv) > 3 else "ingest/boe-corpus-2026-09-28/data/parsed/"
    rows = load_rows(export)
    laws = [json.loads(l) for l in open(boe_dir + "law.jsonl", encoding="utf-8")]
    units = collections.defaultdict(list)
    for line in open(boe_dir + "unit.jsonl", encoding="utf-8"):
        u = json.loads(line)
        units[u["law_id"]].append(u)
    by_name = collections.defaultdict(list)
    for L in laws:
        by_name[name_norm(L["name"])].append(L)
    db = collections.defaultdict(list)
    for r in rows:
        db[r[1]].append(dict(id=r[0], n=r[2], title=r[3], md5=r[4], len=r[5], head=r[6]))

    report = {}
    for law, drows in db.items():
        k = name_norm(law)
        hits = by_name.get(k) or [L for kk, v in by_name.items() for L in v if kk.startswith(k) or k.startswith(kk)]
        best = None
        for L in hits:
            res, missing = match_law(drows, units[L["id"]])
            score = sum(1 for x in res if x["how"] != "unmatched")
            if best is None or score > best[0]:
                best = (score, dict(boe=L["name"], boe_url=L["url"], boe_status=L.get("status_at_source"),
                                    boe_issued=L.get("issued_hijri"), candidates=len(hits), db=len(drows),
                                    boe_units=len(units[L["id"]]), rows=res, missing=missing))
        report[law] = best[1] if best else dict(boe=None, db=len(drows), rows=[], missing=[])

    # report.json يحفظ ما يحتاج إجراءً فقط: صف يتغير رقمه، أو بلا رقم عند الهيئة، أو بلا مقابل.
    compact = {law: {**{k: v for k, v in r.items() if k != "rows"},
                     "rows": [x for x in r["rows"] if x["boe_n"] is None or x["boe_n"] != x["cur"] or x["boe_bis"]]}
               for law, r in report.items()}
    json.dump(compact, open(f"{out_dir}/report.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for law in sorted(report):
        r = report[law]
        if r["boe"] is None:
            print(f"✗ {law} — غير موجود في اللقطة ({r['db']} صفًّا)")
            continue
        rs = r["rows"]
        unmatched = sum(1 for x in rs if x["how"] == "unmatched")
        change = sum(1 for x in rs if x["boe_n"] is not None and (x["boe_n"] != x["cur"] or x["boe_bis"]))
        keys = collections.Counter((x["boe_n"], x["boe_bis"]) for x in rs if x["boe_n"] is not None)
        print(f"{law} | الهيئة: {r['boe_status']} {r['boe_issued']} ({r['candidates']} نسخة) | db {r['db']} boe {r['boe_units']}"
              f" | يتغير {change} | بلا رقم عند الهيئة {sum(1 for x in rs if x['how'] != 'unmatched' and x['boe_n'] is None)}"
              f" | زائد {unmatched} | ناقص {len(r['missing'])} | رقم مكرر {sum(1 for v in keys.values() if v > 1)}")


if __name__ == "__main__":
    main()
