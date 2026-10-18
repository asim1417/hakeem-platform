"""HKM-030 — حقن المرحلة 2 (فقرات وإدراج وتعريفات وإلحاق واستبدال عبارات) — بتفويض المالك 18/10/2026.
  python3 data/renumber/hkm030-inject-2026-10-18/build_phase2.py <current.json>
current.json: قراءة من الإنتاج لكل عملية: op_id, art, eff, cur (النص الساري الأحدث)، cur_vid.
القاعدة: النص الجديد من لقطة صفحة الأداة (بين علامتي التنصيص) كما ورد. ما لا يُحدَّد موضعه يقينًا يُستبقى (held) ولا يُخمَّن.
العمليات على مادة واحدة تُطبّق متتابعة بتاريخ السريان؛ لكل عملية نسخة."""
import json, re, sys, hashlib, collections
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
ops = {json.loads(l)["op_id"]: json.loads(l) for l in open(D + "amendment_operations.jsonl", encoding="utf-8")}
snap = json.load(open(D + "source_snapshots.json", encoding="utf-8"))
cur = {r["op_id"]: r for r in json.load(open(sys.argv[1], encoding="utf-8"))}
OPEN, CLOSE = "«“\"", {"«": "»", "“": "”", "\"": "\""}
def clean(s): return "\n".join(l.rstrip() for l in s.replace("\xa0", " ").strip().split("\n"))
def quoted(x):
    """النص المنقول من الأداة بين علامتي التنصيص، بالموضع في اللقطة؛ أو None."""
    t = (x.get("new_text") or "").strip().lstrip(OPEN)
    if not t: return None
    page = snap.get(x["source_url"], "").replace("\xa0", " ")
    for n in (160, 80, 40):
        m = re.search(r"\s+".join(re.escape(w) for w in t[:n].split()), page)
        if m: break
    else: return None
    i = m.start(); j = i - 1
    while j >= 0 and page[j] in " \n\t": j -= 1
    cl = CLOSE[page[j]] if j >= 0 and page[j] in OPEN else "»"
    k = page.find(cl, i)
    return clean(page[i:k]) if k > 0 else None
AR_ORD = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ"
def lab_re(lab):
    l = re.escape(lab)
    # «هـ» و«جـ» تُكتبان بالتطويل أحيانًا
    return re.compile(rf"(?:(?<=^)|(?<=\n)|(?<=\.\s)|(?<=:\s)|(?<=\.)|(?<=:)|(?<=؛\s))\(?{l}ـ?\)?\s*[-–)]", re.M)
ANY_LAB = re.compile(r"(?:^|\n|\.\s|:\s|؛\s)\(?(?:[0-9]+|[أ-ي]ـ?)\)?\s*[-–]\s*")
def find_lab(text, lab):
    return [m.start() for m in lab_re(lab).finditer(text)]
def next_lab(lab):
    if lab.isdigit(): return str(int(lab) + 1)
    if lab in AR_ORD and AR_ORD.index(lab) + 1 < len(AR_ORD): return AR_ORD[AR_ORD.index(lab) + 1]
    return None
def prev_lab(lab):
    if lab.isdigit(): return str(int(lab) - 1) if int(lab) > 1 else None
    if lab in AR_ORD and AR_ORD.index(lab) > 0: return AR_ORD[AR_ORD.index(lab) - 1]
    return None
def apply(op, x, text, new):
    t = x["op_type"]; lab = (x.get("paragraph_label") or "").strip()
    if t == "replace_article_text": return new, "استبدال المادة كاملة"
    if t == "append_text":
        add = re.sub(r"^[.…\s]+", "", new)
        return text.rstrip() + " " + add, "إلحاق في عجز المادة"
    if t == "substitute_phrase":
        old, nw = x["old_phrase"], x["new_phrase"]
        if len(old) < 8:  # عبارة قصيرة: كلمة كاملة فقط
            pat = re.compile(rf"(?<![\w]){re.escape(old)}(?![\w])")
        else: pat = re.compile(re.escape(old))
        n = len(pat.findall(text))
        if n == 0: return None, "العبارة القديمة غير موجودة"
        return pat.sub(nw, text), f"استبدال عبارة ({n} موضع)"
    if t in ("replace_paragraph_text", "delete_paragraph"):
        if not lab: return None, "بلا وسم فقرة"
        pos = find_lab(text, lab)
        if len(pos) != 1: return None, f"وسم ({lab}) يتكرر {len(pos)} مرة"
        s = pos[0]; nl = next_lab(lab); e = None
        if nl:
            nx = [p for p in find_lab(text, nl) if p > s]
            if nx: e = nx[0]
        if e is None:
            # آخر فقرة: إلى نهاية المادة، بشرط ألا يليها وسم آخر لم يُتعرَّف عليه
            if ANY_LAB.search(text, s + 2): return None, f"بعد الفقرة ({lab}) وسم آخر غير متوقع: الحدّ غير مؤكد"
            e = len(text)
        seg = text[s:e]
        sep = "" if e == len(text) else (re.search(r"\s*$", seg).group(0) or " ")
        if t == "delete_paragraph": return (text[:s].rstrip() + ("\n" if "\n" in text else " ") + text[e:].lstrip()).strip(), f"حذف الفقرة ({lab})"
        if not re.match(rf"\(?{re.escape(lab)}ـ?\)?\s*[-–)]", new):
            # النص في الأداة بلا الوسم: يبقى وسم الفقرة القائم ويُستبدل ما بعده
            m = re.match(rf"\(?{re.escape(lab)}ـ?\)?\s*[-–)]\s*", seg)
            new = m.group(0) + new
        return text[:s] + new + sep + text[e:], f"استبدال الفقرة ({lab})"
    if t == "insert_paragraph":
        q = x.get("evidence_quote") or ""
        if "فقرة فرعية" in q or "فقرتين فرعيتين" in q or "إعادة ترقيم" in q or "وإعادة" in q:
            return None, "إدراج فقرة فرعية داخل فقرة أو مع إعادة ترقيم: الموضع يحتاج مراجعة"
        m = re.match(r"\(?([0-9]+|[أ-ي])ـ?\)?\s*[-–)]", new)
        has_lab = bool(m)
        if not lab:
            lab = m.group(1) if m else ""
        if not lab:
            mq = re.search(r"(?:تحمل الرقم|ترتيبها|يكون ترتيبها|رقم)\s*\(([0-9]+|[أ-ي])\)", q)
            lab = mq.group(1) if mq else ""
        numbered = bool(ANY_LAB.search("\n" + text))
        if lab and not has_lab:
            if numbered: new = f"{lab}- {new}"
        elif not lab and numbered:
            return None, "الأداة لا تحدد رقم الفقرة والمادة مرقّمة"
        if lab and find_lab(text, lab): return None, f"الفقرة ({lab}) موجودة أصلًا"
        if lab and numbered and prev_lab(lab) and not find_lab(text, prev_lab(lab)): return None, f"الفقرة السابقة ({prev_lab(lab)}) غير موجودة"
        nl = next_lab(lab) if lab else None
        if nl and find_lab(text, nl): return None, f"يوجد ({nl}) بعدها: موضع الإدراج يحتاج مراجعة"
        sep = "\n" if "\n" in text else " "
        return text.rstrip() + sep + new, f"إدراج الفقرة ({lab or 'بلا وسم'}) في آخر المادة"
    if t == "replace_definition":
        return None, "تعريف: يحتاج مراجعة يدوية"
    return None, t
# مستبقاة بعد مراجعة النتيجة يدويًّا (18/10/2026): البناء الآلي أعطى نصًّا غير صحيح.
REVIEW_HOLD = {
    "OP-bc37ace240": "الأداة أعادت نص المادة كاملًا (1 و2) لا فقرة مضافة: الإدراج يكرر الفقرة (1)",
    "OP-47a74785ed": "النص الجديد هو الفقرة الفرعية (أ) من الفقرة (2) لا الفقرة كلها",
    "OP-e9f0569313": "الأداة تعدّل الفقرتين الفرعيتين (ب) و(ج) من الفقرة (1) لا الفقرة كلها",
    "OP-bfcae2d3a4": "النص المخزن فيه «شرطاً أساساً لإيصال الخدمات» وليس في النص الكامل الذي أوردته الأداة: تعديل آخر غير مؤرخ",
}
def _apply(op, x, text, new):
    if op in REVIEW_HOLD: return None, REVIEW_HOLD[op]
    return apply(op, x, text, new)
by_art = collections.defaultdict(list)
for op, r in cur.items():
    if r["art"]: by_art[r["art"]].append(op)
plan, held = [], []
for art, lst in by_art.items():
    lst.sort(key=lambda o: (cur[o]["eff"], o))
    text = clean(cur[lst[0]]["cur"])
    for op in lst:
        x = ops[op]
        new = quoted(x) if x["op_type"] not in ("substitute_phrase", "delete_paragraph") else ""
        if new is None: held.append((op, "النص غير موجود في اللقطة")); break
        body, why = _apply(op, x, text, new)
        if body is None:
            held.append((op, why)); held += [(o, "يتبع عملية مستبقاة على المادة نفسها") for o in lst[lst.index(op) + 1:]]; break
        plan.append({"op": op, "unit": art, "from": cur[op]["eff"], "how": why, "before": text, "body": body})
        text = body
for op, r in cur.items():
    if not r["art"]: held.append((op, "بلا مادة (نطاق النظام كله)"))
import unicodedata
q = lambda v: "'" + v.replace("'", "''") + "'"
def instrument(x):
    y, m, d = x["instrument_date_hijri"].split("-"); date = f"{int(y)}/{int(m)}/{int(d)}هـ"
    return (f"مرسوم ملكي رقم {x['instrument_no']} وتاريخ {date}" if x["instrument_kind"] == "royal_decree"
            else f"قرار مجلس الوزراء رقم {x['instrument_no']} وتاريخ {date}")
# عمليات الأداة الواحدة على المادة نفسها بتاريخ واحد تُدمج في نسخة واحدة بالنص النهائي،
# لأن تساوي valid_from يجعل «أحدث نسخة» غير محددة.
merged = []
for r in plan:
    m = merged[-1] if merged else None
    if m and m["unit"] == r["unit"] and m["from"] == r["from"]:
        assert ops[m["op"]]["source_url"] == ops[r["op"]]["source_url"], (m["op"], r["op"])
        m["ops"].append(r["op"]); m["body"] = r["body"]
    else:
        merged.append(dict(r, ops=[r["op"]]))
plan = merged
rows, mvals = [], []
for r in plan:
    x = ops[r["op"]]
    r["body"] = unicodedata.normalize("NFC", r["body"])  # أداة النقل تطبّع النص إلى NFC
    r["id"] = "hkm30u-" + hashlib.sha256(f"{r['unit']}@{r['from']}@{r['op']}".encode()).hexdigest()[:24]
    r["md5"] = hashlib.md5(r["body"].encode()).hexdigest()
    pub = "/".join(str(int(v)) for v in x["published_hijri"].split("-"))
    lim = 600 // len(r["ops"])
    ev = " | ".join(e if len(e) <= lim else e[:lim].rstrip() + "…" for e in (clean(ops[o]["evidence_quote"]) for o in r["ops"]))
    rows.append(f"({q(r['id'])}, {q(r['unit'])}, {q(r['body'])}, {q(r['from'] + 'T00:00:00Z')}, {q(instrument(x))}, {q(x['source_url'])}, {q(ev + f'؛ نُشر في أم القرى {pub}هـ (' + '، '.join(r['ops']) + ')')}, now())")
    mvals.append(f"({q(r['id'])},{q(r['md5'])})")
first = {}
for r in plan: first.setdefault(r["unit"], r)
prev = [(u, cur[r["op"]]["cur_vid"]) for u, r in first.items()]
ids = ",".join(q(r["id"]) for r in plan); units = ",".join(q(u) for u in first)
pv = " AND ".join(f"(SELECT id FROM unit_version WHERE unit_id={q(u)} ORDER BY valid_from DESC LIMIT 1) IS NOT DISTINCT FROM {q(v) if v else 'NULL'}" for u, v in prev)
n_before = sum(int(cur[r["op"]]["uv"]) for r in first.values())
# المرحلة 3: المادة (7) من اللائحة التنفيذية لنظام التحكيم حُذفت بقرار مجلس الوزراء 249 (لا سجل تحقق لها).
ARB = ("cmpzcuzgm089xvtrkqgqcluzy", "OP-079bbf4175")
vid = "hkm30v-" + hashlib.sha256(f"{ARB[0]}@{ARB[1]}".encode()).hexdigest()[:24]
ver = (f"INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) VALUES ({q(vid)}, 'unit', {q(ARB[0])}, 'ملغاة', 'قرار مجلس الوزراء رقم 249 وتاريخ 1444/4/7هـ', 'https://www.uqn.gov.sa/details?p=20840', "
       f"{q('حذف المادة (السابعة) من اللائحة التنفيذية لنظام التحكيم الصادرة بقرار مجلس الوزراء رقم (541) وتاريخ 26 /8/ 1438هـ؛ نُشر في أم القرى 1444/4/17هـ؛ نافذ من 2022-11-11 (OP-079bbf4175)')}, 'manual', 'hkm030-uqn-inject-2026-10-18', now())")
st = [
 f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id IN ({units}))={n_before} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id IN ({ids})) AND {pv} AND NOT EXISTS (SELECT 1 FROM verification WHERE object_id={q(ARB[0])}) THEN 1 ELSE 0 END) AS guard_before",
 *["INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES\n" + ",\n".join(rows[i:i + 10]) for i in range(0, len(rows), 10)],
 ver,
 f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id IN ({units}))={n_before + len(plan)} AND (SELECT count(*) FROM unit_version v JOIN (VALUES {','.join(mvals)}) e(id,m) ON e.id=v.id AND md5(v.body)=e.m)={len(plan)} AND (SELECT count(*) FROM verification WHERE object_id={q(ARB[0])} AND verified_status='ملغاة')=1 THEN 1 ELSE 0 END) AS guard_after",
 f"SELECT md5(string_agg(id||':'||md5(body), ',' ORDER BY id)) fp FROM unit_version WHERE id IN ({ids})",
]
json.dump(st, open(OUT + "statements2.json", "w"), ensure_ascii=False, indent=1)
print("expected fp", hashlib.md5(",".join(f"{r['id']}:{r['md5']}" for r in sorted(plan, key=lambda r: r["id"])).encode()).hexdigest())
json.dump({"plan": plan, "held": held}, open(OUT + "plan2.json", "w"), ensure_ascii=False, indent=1)
print("planned", len(plan), "held", len(held))
for h in held: print(" held", h)

# ── التنفيذ عبر جدول تمهيد: الصفوف تُنقل على دفعات صغيرة ويُتحقق من بصمة كل صف عند وصوله،
#    ثم معاملة واحدة ذرّية تنسخ من التمهيد إلى unit_version (تُجرَّب على فرع ثم الإنتاج).
STAGE = "uqn_fix.inject_p2_stage"
stage = [f"CREATE TABLE IF NOT EXISTS {STAGE} (id text PRIMARY KEY, unit_id text NOT NULL, body text NOT NULL, valid_from timestamptz NOT NULL, evidence_instrument text NOT NULL, evidence_url text NOT NULL, evidence_quote text NOT NULL, md5 text NOT NULL)"]
for i in range(0, len(rows), 5):
    chunk = rows[i:i + 5]; ids_c = [r["id"] for r in plan[i:i + 5]]
    vals = [c[:-len(", now())")] + f", {q(r['md5'])})" for c, r in zip(chunk, plan[i:i + 5])]
    stage.append([
        f"INSERT INTO {STAGE} (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, md5) VALUES\n" + ",\n".join(vals),
        f"SELECT 1/(CASE WHEN (SELECT count(*) FROM {STAGE} WHERE id IN ({','.join(q(x) for x in ids_c)}) AND md5(body)=md5)={len(ids_c)} THEN 1 ELSE 0 END) AS chunk_ok",
    ])
apply_st = [st[0],
    f"SELECT 1/(CASE WHEN (SELECT count(*) FROM {STAGE} s JOIN (VALUES {','.join(mvals)}) e(id,m) ON e.id=s.id AND s.md5=e.m AND md5(s.body)=e.m)={len(plan)} THEN 1 ELSE 0 END) AS stage_ok",
    f"INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) SELECT id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, now() FROM {STAGE} WHERE id IN ({ids})",
    ver, *st[-2:]]
json.dump({"stage": stage, "apply": apply_st}, open(OUT + "statements2.json", "w"), ensure_ascii=False, indent=1)
print("stage chunks", [len(json.dumps(c, ensure_ascii=False)) for c in stage[1:]])
