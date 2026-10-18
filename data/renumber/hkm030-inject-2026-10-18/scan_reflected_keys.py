"""HKM-030 — مفاتيح فحص الانعكاس (قراءة فقط): لكل بند في طابور المعالجة اليدوية ولكل فجوة استخراج،
يستخرج من النص الجديد المقتبس نافذة 30 حرفًا من الحروف والمسافات فقط، ليُبحث عنها في النص الحالي لحكيم
(legal_articles وunit_version) بعد توحيد التشكيل والمسافات. البند بلا نص جديد مقتبس (حذف، إحلال قصير) يبقى «يحتاج مراجعة».
  python3 data/renumber/hkm030-inject-2026-10-18/scan_reflected_keys.py"""
import json, re, hashlib
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
QT = str.maketrans({c: '"' for c in "“”„«»"})
DIA = re.compile(r"[ً-ْـ]")
norm = lambda s: re.sub(r"\s+", " ", DIA.sub("", s.translate(QT))).strip()
mq = [json.loads(l) for l in open(D + "amendment_manual_queue.jsonl", encoding="utf-8")]
gaps = json.load(open(OUT + "extraction_gaps.json", encoding="utf-8"))["gap_rows"]
NEW = re.compile(r'(?:بالنص الآتي|بالنص التالي|بالنصوص الآتية|نصها الآتي|تنص على الآتي|على الآتي|ليصبح نصها|ليكون|لتكون|لتصبح|ليصبح|إضافة (?:عبارة|كلمة|تعريف)|إحلال (?:عبارة|كلمة|تعريف))[^"]{0,40}"([^"]{12,})"')
def key(s):
    m = NEW.search(s[:650])
    if not m: return None
    t = norm(m.group(1))
    runs = re.findall(r"[ء-ي ]{30,}", t)
    if not runs: return None
    r = max(runs, key=len).strip()
    return r[-40:].strip() if len(r) >= 30 else None  # آخر النص الجديد أخص من أوله
src = {u: norm(t) for u, t in json.load(open(D + "source_snapshots.json", encoding="utf-8")).items()}
def full(url, frag):  # البند كاملًا من لقطة الأداة: من موضع المقطع حتى 700 حرف
    t = src.get(url, ""); f = frag.lstrip(".:،- ")
    for n in (len(f), 80, 40, 20):
        k = f[:n]
        if len(k) >= 15 and (i := t.find(k)) >= 0: return t[i:i + 700]
    return frag
items = []
for m in mq:
    for it in m["unparsed_items"]:
        items.append(dict(layer="manual_queue", ref=m["effect_id"], url=m["source_url"], law=m.get("target_title_as_cited", ""), text=full(m["source_url"], norm(re.sub(r"^\[[^\]]*\]\s*", "", it)))))
for g in gaps:
    items.append(dict(layer="extraction_gap", ref="", url=g["url"], law="", text=full(g["url"], norm(g["seg"]))))
for i, it in enumerate(items):
    it["id"] = i; it["key"] = key(it["text"])
json.dump(items, open(OUT + "reflected_items.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
keys = sorted({it["key"] for it in items if it["key"]})
q = lambda s: "'" + s.replace("'", "''") + "'"
sql = ("WITH k(key) AS (VALUES " + ",".join(f"({q(k)})" for k in keys) + "), "
       "t(b) AS MATERIALIZED (SELECT regexp_replace(regexp_replace(translate(normalize(content, NFC), '“”„«»', '\"\"\"\"\"'), '[\\u064B-\\u0652\\u0640]', '', 'g'), '\\s+', ' ', 'g') FROM legal_articles "
       "UNION ALL SELECT regexp_replace(regexp_replace(translate(normalize(body, NFC), '“”„«»', '\"\"\"\"\"'), '[\\u064B-\\u0652\\u0640]', '', 'g'), '\\s+', ' ', 'g') FROM unit_version) "
       "SELECT md5(string_agg(key, '|' ORDER BY key COLLATE \"C\")) keys_fp, count(*) n, string_agg(CASE WHEN NOT EXISTS (SELECT 1 FROM t WHERE strpos(t.b, k.key) > 0) THEN md5(key) END, ',') missing FROM k")
open(OUT + "reflected_query.sql", "w", encoding="utf-8").write(sql)
print("items", len(items), "with key", sum(1 for i in items if i["key"]), "distinct keys", len(keys), "keys_fp", hashlib.md5("|".join(keys).encode()).hexdigest(), "sql chars", len(sql))
