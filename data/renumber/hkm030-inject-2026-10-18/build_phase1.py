"""HKM-030 — حقن المرحلة 1 من طابور أم القرى (18/10/2026، بتفويض المالك). يولّد statements.json وplan.json.
  python3 data/renumber/hkm030-inject-2026-10-18/build_phase1.py
المرحلة 1: استبدال مادة كاملة (عملية واحدة على المادة) + استبدال عبارة طويلة في بند واحد.
النص الجديد = النص بين علامتي التنصيص في لقطة صفحة الأداة نفسها (source_snapshots.json) كما ورد؛ لا يُعدَّل إلا
المسافة غير الفاصلة إلى مسافة، وحذف المسافات آخر السطر. valid_from = تاريخ السريان المعتمد في amendment_decision.
مستبعد: OP-39bd36d416 (تعدّل العنوان الفرعي قبل م13 لا نصها)، و9 عمليات مطبّقة سابقًا بالأداة نفسها (نسخة قائمة بتاريخ المرسوم)، وما يمس فقرة أو تعريفًا (المرحلة 2)."""
import json, re, hashlib, unicodedata
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
ops = {json.loads(l)["op_id"]: json.loads(l) for l in open(D + "amendment_operations.jsonl", encoding="utf-8")}
eff = {json.loads(l)["op_id"]: json.loads(l) for l in open(D + "effective_corrections.jsonl", encoding="utf-8")}
snap = json.load(open(D + "source_snapshots.json", encoding="utf-8"))
# العملية ← (معرّف المادة في الإنتاج، عدد النسخ القائمة)؛ من استعلام قراءة على الإنتاج 18/10/2026.
UNITS = {
 "OP-214d4e5bcf": ("cmpz644r4043hcwg2c1etw8fq", 1), "OP-35022dcff5": ("cmpz63jff03w9cwg2qaxo0kre", 0),
 "OP-3cb8a43850": ("cmpz5yl8a02ahcwg2wc758xz2", 0),
 "OP-4b9bd9f45f": ("cmpz6b7op06gzcwg289y7y3tx", 0), "OP-4f30e2eb52": ("cmpz5yuov02dncwg25u27nxnh", 0),
 "OP-577b049dad": ("cmpz5yv6j02dtcwg2bjrupdio", 0), "OP-6007c4c470": ("cmpz6b4ze06g1cwg2e1ymw27y", 0),
 "OP-63f540a336": ("cmpz5yya102etcwg25pzqa130", 0), "OP-66d43965e2": ("cmpz6b55406g3cwg2ut73td36", 0),
 "OP-66e9f7ada1": ("cmpzcvduf0c7svtrku23gpf4s", 0), "OP-6ce303a5d0": ("cmpzcvduf0c7rvtrk6ai5ystz", 0),
 "OP-706d7059f3": ("cmpzcv3hq09dcvtrkfom2k7dv", 0), "OP-855d66005e": ("cmpz5yj40029rcwg2mip31coz", 0),
 "OP-8ceeddb2bc": ("cmpz5xjem01x9cwg281gbjk1o", 0), "OP-a59a7bcb68": ("cmpzcv47a09jkvtrk686rwuke", 0),
 "OP-c23c3db30b": ("cmpzcvduf0c71vtrk1frjdpj4", 0), "OP-c915a0a9a1": ("cmpzcvduf0c6zvtrkp31y9ras", 0),
 "OP-d533fe75c6": ("cmpzcv47a09j8vtrkur82h8tr", 0), "OP-daea65ca6a": ("cmpz66tuz04zpcwg2p69rmvem", 0),
 "OP-e1274be1bd": ("cmpz5v3ks0143cwg2voixje3d", 0), "OP-e8add425e7": ("cmpzcvduf0c7dvtrkbfhiqw87", 0),
 "OP-f31afab64d": ("own26-d4e8a3092747d45a539a6ee8", 0), "OP-f3c7ab1817": ("cmpz6omln0b6bcwg2ux14l53r", 0),
 "OP-f52b220a00": ("cmpwi5h3b00xhnxffkvv8sidq", 0), "OP-a0ddfd28eb": ("737451ebe1694038b3eb95ad4cf1fd9e", 0),
}
OPEN, CLOSE = "«“\"", {"«": "»", "“": "”", "\"": "\""}
def clean(s): return "\n".join(l.rstrip() for l in s.replace("\xa0", " ").strip().split("\n"))
def full_text(x):
    page, t = snap[x["source_url"]], x["new_text"].strip().lstrip(OPEN)
    # أطول بادئة أولًا (نصان في الأداة قد يشتركان في مطلعهما: الأسلحة م12 وم25)، والمسافات بأي عدد.
    i = -1
    for n in (160, 80, 40):
        pat = r"\s+".join(re.escape(w) for w in t[:n].split())
        m = re.search(pat, page.replace("\xa0", " "))
        if m: page = page.replace("\xa0", " "); i = m.start(); break
    if i < 0: raise SystemExit(f"{x['op_id']}: النص غير موجود في اللقطة")
    j = i - 1
    while j >= 0 and page[j] in " \n\t\xa0": j -= 1
    cl = CLOSE[page[j]] if j >= 0 and page[j] in OPEN else "»"
    k = page.find(cl, i)
    if k < 0: raise SystemExit(f"{x['op_id']}: لا علامة إغلاق")
    body = clean(page[i:k]); span = (i, k - i)
    norm = lambda s: re.sub(r"\s+", " ", s.strip().strip(OPEN + "»”\"").strip())
    if not norm(body).startswith(norm(t)[: max(40, len(norm(t)) - 5)]):
        raise SystemExit(f"{x['op_id']}: لا يطابق المستخرج")
    return body, span
def instrument(x):
    y, m, d = x["instrument_date_hijri"].split("-")
    date = f"{int(y)}/{int(m)}/{int(d)}هـ"
    if x["instrument_kind"] == "royal_decree": return f"مرسوم ملكي رقم {x['instrument_no']} وتاريخ {date}"
    if x["instrument_kind"] == "cabinet_decision": return f"قرار مجلس الوزراء رقم {x['instrument_no']} وتاريخ {date}"
    raise SystemExit(x["instrument_kind"])
q = lambda s: "'" + s.replace("'", "''") + "'"
# مكافئ clean() في SQL: مسافة غير فاصلة ← مسافة، وحذف مسافات آخر السطر، وتشذيب الطرفين.
CLEAN = "regexp_replace(regexp_replace(replace({0}, chr(160), ' '), '[ \\t]+(\\n)', '\\1', 'g'), '^\\s+|\\s+$', '', 'g')"
md5 = lambda s: hashlib.md5(unicodedata.normalize("NFC", s).encode()).hexdigest()
plan, ins = [], []
for op, (unit, n_uv) in UNITS.items():
    x = ops[op]; e = eff[op]
    vf = e["effective_from_gregorian"] or x["effective_from_gregorian"]
    vid = "hkm30u-" + hashlib.sha256(f"{unit}@{vf}@{op}".encode()).hexdigest()[:24]
    pub = "/".join(str(int(p)) for p in x["published_hijri"].split("-"))
    ev = clean(x["evidence_quote"]); ev = ev if len(ev) <= 600 else ev[:600].rstrip() + "…"
    quote = ev + f"؛ نُشر في أم القرى {pub}هـ ({op})"
    if x["op_type"] == "replace_article_text":
        body, (st0, ln) = full_text(x)
        # النص يُقتطع داخل القاعدة من uqn_fix.source_snapshot بالموضع نفسه (اللقطة في القاعدة مطابقة للملف: body_sha).
        body_sql = f"(SELECT {CLEAN.format(f'substr(s.body, {st0 + 1}, {ln})')} FROM uqn_fix.source_snapshot s WHERE s.url={q(x['source_url'])})"
        plan.append({"op": op, "unit": unit, "from": vf, "id": vid, "md5": hashlib.md5(body.encode()).hexdigest(), "len": len(body), "url": x["source_url"], "start": st0, "length": ln, "body": body})
    elif x["op_type"] == "substitute_phrase" and x.get("scope") == "item":
        cur = f"(SELECT a.content FROM legal_articles a WHERE a.id={q(unit)})"
        body_sql = f"replace({cur}, {q(x['old_phrase'])}, {q(x['new_phrase'])})"
        plan.append({"op": op, "unit": unit, "from": vf, "id": vid, "md5": None, "old": x["old_phrase"], "new": x["new_phrase"]})
    else: raise SystemExit(op)
    ins.append(f"({q(vid)}, {q(unit)}, {body_sql}, {q(vf + 'T00:00:00Z')}, {q(instrument(x))}, {q(x['source_url'])}, {q(quote)}, now())")
units = ",".join(q(u) for u, _ in UNITS.values()); ids = ",".join(q(p["id"]) for p in plan)
expect_before = sum(n for _, n in UNITS.values())
sub = next(p for p in plan if p["md5"] is None)
mvals = ",".join(f"({q(p['id'])},{q(p['md5'])})" for p in plan if p["md5"]); n_md5 = sum(1 for p in plan if p["md5"])
st = [
 f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id IN ({units}))={expect_before} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id IN ({ids})) AND (SELECT count(*) FROM legal_articles WHERE id IN ({units}))={len(UNITS)} AND (SELECT position({q(sub['old'])} IN content) FROM legal_articles WHERE id={q(sub['unit'])})>0 THEN 1 ELSE 0 END) AS guard_before",
 "INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES\n" + ",\n".join(ins),
 f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id IN ({units}))={expect_before + len(UNITS)} AND (SELECT count(*) FROM unit_version WHERE id IN ({ids}))={len(UNITS)} THEN 1 ELSE 0 END) AS guard_after",
 f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version v JOIN (VALUES {mvals}) e(id,m) ON e.id=v.id AND md5(v.body)=e.m)={n_md5} THEN 1 ELSE 0 END) AS guard_md5",
 f"SELECT md5(string_agg(id||':'||md5(body), ',' ORDER BY id)) fp, (SELECT position({q(sub['new'])} IN body)>0 AND position({q(sub['old'])} IN body)=0 FROM unit_version WHERE id={q(sub['id'])}) sub_ok FROM unit_version WHERE id IN ({ids}) AND id<>{q(sub['id'])}",
]
json.dump(st, open(OUT + "statements.json", "w"), ensure_ascii=False, indent=1)
json.dump(plan, open(OUT + "plan.json", "w"), ensure_ascii=False, indent=1)
exp = hashlib.md5(",".join(f"{p['id']}:{p['md5']}" for p in sorted(plan, key=lambda p: p["id"]) if p["md5"]).encode()).hexdigest()
print(f"statements {len(st)} | versions {len(plan)} | expected fp {exp}")
