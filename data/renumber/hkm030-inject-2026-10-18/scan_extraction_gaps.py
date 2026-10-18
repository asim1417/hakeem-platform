"""HKM-030 — فحص شامل لفجوات الاستخراج (قراءة فقط): يقسم منطوق كل أداة في source_snapshots.json إلى بنود تعديل،
ويعدّ البند مغطًّى إذا تقاطع موضعه مع اقتباس عملية مستخرجة (amendment_operations.jsonl) أو بند في طابور المعالجة اليدوية
(amendment_manual_queue.jsonl) للأداة نفسها، أو وُجد نصه في اقتباس عملية لأداة مرافقة. الناتج مرشحون للمراجعة لا حكم نهائي.
  python3 data/renumber/hkm030-inject-2026-10-18/scan_extraction_gaps.py"""
import json, re, collections
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
QT = str.maketrans({c: '"' for c in "“”„«»"})  # توحيد علامات التنصيص بين اللقطة والاقتباسات
ws = lambda s: re.sub(r"\s+", " ", s.translate(QT)).strip()
src = {u: ws(t) for u, t in json.load(open(D + "source_snapshots.json", encoding="utf-8")).items()}
ops = [json.loads(l) for l in open(D + "amendment_operations.jsonl", encoding="utf-8")]
mq = [json.loads(l) for l in open(D + "amendment_manual_queue.jsonl", encoding="utf-8")]
# ما حُقن يدويًّا خارج الحزمة (المرحلة 4)
manual_done = {"https://www.uqn.gov.sa/details?p=20298": ["تعديل المادة (الرابعة)", "تعديل المادة (الثامنة)", "تعديل المادة (العاشرة)"]}

quotes = collections.defaultdict(list)
for o in ops: quotes[o["source_url"]].append(("op", o["op_id"], ws(o["evidence_quote"])))
for m in mq:
    for it in m.get("unparsed_items", []): quotes[m["source_url"]].append(("manual", m["effect_id"], ws(re.sub(r"^\[[^\]]*\]\s*", "", it))))
for u, qs in manual_done.items():
    for q in qs: quotes[u].append(("phase4", "HKM-030-p4", q))
all_quotes = [q for qs in quotes.values() for _, _, q in qs]

def span(text, q):
    for n in (len(q), 120, 60, 30):
        k = q[:n]
        if len(k) >= 12 and (i := text.find(k)) >= 0: return i, i + len(q)
    return None

VERB = re.compile(r"(?<![\w])(?:و|ب)?(تعديل|إضافة|حذف|إلغاء|إحلال|استبدال|يُحذف|يحذف|تُضاف|تضاف|يُضاف|يضاف|تُعدّل|تُعدل|تعدل|يُستبدل|يستبدل|تُلغى|تلغى|يُلغى|يلغى)(?![\w])")
TARGET = re.compile(r"الماد(?:ة|تين|تان|تي)|الفقر(?:ة|ات|تين|تان)|البند|البنود|تعريف|عبارة|كلمة|مادة|فقرة|فقرات|مواد")
START = re.compile(r"يقرر ما يلي|يقرر ما يأتي|يقرر:|رسمنا بما هو آت|نرسم بما هو آت|قرر ما يلي|قرر ما يأتي")
rows = []
for u, t in src.items():
    m = START.search(t); b = m.end() if m else 0
    # الفعل المسبوق بواو أو باء («بإحلال»، «وحذف») تكملة للبند نفسه لا بند جديد
    starts = [x.start() for x in VERB.finditer(t, b) if t[x.start()] not in "وب"]
    segs = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else min(len(t), s + 600)
        seg = t[s:e]
        pre = t[max(0, s - 20):s]
        if "الموافقة على" in pre or "الموافقة على" in seg[:5]: continue
        if not TARGET.search(seg[:90]): continue
        segs.append([s, e, seg])
    # دمج الرؤوس القصيرة («تعديل المادة (س) على النحو الآتي:») مع ما بعدها
    merged = []
    for s, e, seg in segs:
        if merged and merged[-1][3]: merged[-1][1] = e; merged[-1][2] += seg; merged[-1][3] = False; continue
        hdr = len(seg) < 140 and re.search(r"(على النحو|بما يأتي|بما يلي|الآتي)\s*:?\s*\S{0,3}$", seg.strip()) is not None
        merged.append([s, e, seg, hdr])
    if not merged: continue
    sp = [(k, i, span(t, q)) for k, i, q in quotes.get(u, [])]
    for s, e, seg, _ in merged:
        cov = [i for k, i, x in sp if x and x[0] < e and x[1] > s]
        if not cov:
            key = seg[:80]
            if any(key[:50] in q for q in all_quotes): cov = ["companion"]
        rows.append(dict(url=u, pos=s, covered=bool(cov), by=cov[:3], seg=seg[:300]))
gaps = [r for r in rows if not r["covered"]]
by_url = collections.Counter(r["url"] for r in gaps)
tot = collections.Counter(r["url"] for r in rows)
json.dump(dict(urls_scanned=len(src), urls_with_items=len(tot), items=len(rows), gaps=len(gaps), urls_with_gaps=len(by_url),
               gap_rows=gaps), open(OUT + "extraction_gaps.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("urls", len(src), "with items", len(tot), "items", len(rows), "gaps", len(gaps), "urls with gaps", len(by_url))
for u, n in by_url.most_common(15): print(n, "/", tot[u], u)
