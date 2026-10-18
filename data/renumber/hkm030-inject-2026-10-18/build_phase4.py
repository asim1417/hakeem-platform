"""HKM-030 — المرحلة 4: بنود قرار مجلس الوزراء 169 (1444/3/1هـ) لتنظيم الهيئة العامة للإحصاء التي لم يستخرجها الحزمة عمليات
(البند 2 للمادة الرابعة، والبند 4 للمادة الثامنة، والبند 5 للمادة العاشرة) — بموافقة المالك 18/10/2026 («نعم»).
  python3 data/renumber/hkm030-inject-2026-10-18/build_phase4.py
النص الجديد مقتطع حرفيًّا من لقطة صفحة القرار (source_snapshots.json)؛ الأساس نص المادة المخزن (phase4_base.json، بصمته مطابقة للإنتاج).
إعادة ترقيم فقرات المادة العاشرة تنفيذ لعبارة القرار «وإعادة ترتيب باقي الفقرات تبعاً لذلك»."""
import json, re, hashlib, unicodedata
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
URL = "https://www.uqn.gov.sa/details?p=20298"
INS = "قرار مجلس الوزراء رقم 169 وتاريخ 1444/3/1هـ"
FROM = "2022-10-07T00:00:00Z"  # تاريخ سريان عمليات القرار نفسه في الحزمة (OP-2ad736b634 وأخواتها)
src = json.load(open(D + "source_snapshots.json", encoding="utf-8"))[URL]
base = json.load(open(OUT + "phase4_base.json", encoding="utf-8"))
nfc = lambda s: unicodedata.normalize("NFC", s)
for u, b in base.items(): assert hashlib.md5(b["content"].encode()).hexdigest() == b["md5"], u

def Q(start, end="»"):  # النص بعد علامة البداية حتى علامة الإغلاق، من صفحة القرار
    assert src.count(start) == 1, start
    i = src.index(start) + len(start); return src[i:src.index(end, i)]
def R(t, old, new):
    assert t.count(old) == 1, (old[:50], t.count(old)); return t.replace(old, new)
item = lambda a, b: src[src.index(a):src.index(b)]

V = []
# البند 2: المادة الرابعة
u = "cmpz6b7d806gvcwg2li7xemjv"; t = base[u]["content"]
t = R(t, "5 - إعداد النشرات والتقارير الإحصائية للمسوح والبحوث، ونشرها.", "5 - " + Q("أ- تعديل الفقرة (5) لتكون بالنص الآتي: «5- ") + ".")
t = R(t, "10 - تزويد الجهات العامة والمنشآت الخاصة والأفراد والهيئات الدولية بالإحصاءات الرسمية، وفق الإجراءات النظامية.", "10 - " + Q("ب- تعديل الفقرة (10) لتكون بالنص الآتي: «10- ") + ".")
t = t.rstrip() + " " + Q("ج- إضافة فقرة بالنص الآتي: «") + "."
V.append((u, "169-2", t, item("2- تعديل المادة (الرابعة)", "3- تعديل المادة (السادسة)")))
# البند 4: المادة الثامنة (الديباجة والفقرة 8)
u = "cmpz6b80606h3cwg2iph1rc0v"; t = base[u]["content"]
pre = Q("أ- تعديل ديباجة المادة لتكون بالنص الآتي: «"); assert pre.endswith(": ..."); pre = pre[:-len(" ...")]
t = R(t, "المجلس هو السلطة المهيمنة على إدارة شؤون الهيئة وتصريف أمورها، ويتخذ جميع القرارات اللازمة لتحقيق أغراضها في حدود أحكام التنظيم، وله على وجه خاص ما يأتي:", pre)
t = R(t, "8 - إقرار آليات العمل التنفيذية المتعلقة بالمقابل المالي والتكاليف للعمل الإحصائي الذي تُنفذه الهيئة للمنشآت الخاصة، وكذلك للتزويد بالبيانات بالاتفاق مع وزارة المالية.",
      "8 - " + Q("ب- تعديل الفقرة (8) لتكون بالنص الآتي: «8- ") + ".")
V.append((u, "169-4", t, item("4- تعديل المادة (الثامنة)", "5- تعديل المادة (العاشرة)")))
# البند 5: المادة العاشرة (الفقرة 2، وفقرة 3 جديدة، وإعادة الترتيب)
u = "cmpz6b8bm06h7cwg2xs9w6wlu"; t = base[u]["content"]
for n in range(16, 2, -1):  # 3..16 ← 4..17 (من الأكبر حتى لا يتكرر)
    pat = re.compile(rf"(\.\s?){n}(\s?-\s)")
    assert len(pat.findall(t)) == 1, n
    t = pat.sub(lambda m: f"{m.group(1)}{n + 1}{m.group(2)}", t)
t = R(t, "2 - الإشراف على أعمال الهيئة الفنية والإدارية والمالية.", "2 - " + Q("أ- تعديل الفقرة (2) لتكون بالنص الآتي: «2- ") + ".")
new3 = Q("ب- إضافة فقرة تنص على الآتي: «")
t = R(t, "للجهات العامة.4 - اقتراح خطط", "للجهات العامة." + new3 + ".4 - اقتراح خطط")
V.append((u, "169-5", t, item("5- تعديل المادة (العاشرة)", "6- تعديل المادة (الثانية عشرة)")))

rows = []
for u, key, body, ev in V:
    body = nfc(body)
    vid = "hkm30u-" + hashlib.sha256(f"{u}@{FROM[:10]}@{key}".encode()).hexdigest()[:24]
    quote = nfc(re.sub(r"\s+", " ", ev).strip()[:560] + f"؛ نُشر في أم القرى 1444/3/11هـ (البند {key.split('-')[1]} من القرار؛ لم يُستخرج عملية في الحزمة)")
    rows.append(dict(id=vid, unit=u, body=body, md5=hashlib.md5(body.encode()).hexdigest(), base_md5=base[u]["md5"], base_len=len(nfc(base[u]["content"])), base=nfc(base[u]["content"]), quote=quote))
json.dump([{k: v for k, v in r.items() if k != "base"} for r in rows], open(OUT + "plan4.json", "w"), ensure_ascii=False, indent=1)
q = lambda s: "'" + s.replace("'", "''") + "'"
st = []
for r in rows:
    b, t = r["base"], r["body"]; p = 0
    while p < min(len(b), len(t)) and b[p] == t[p]: p += 1
    s = 0
    while s < min(len(b), len(t)) - p and b[-1 - s] == t[-1 - s]: s += 1
    mid = t[p:len(t) - s]; assert b[:p] + mid + (b[len(b) - s:] if s else "") == t
    st.append(f"INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) "
              f"SELECT {q(r['id'])}, {q(r['unit'])}, left(x.b, {p}) || {q(mid)} || right(x.b, {s}), {q(FROM)}, {q(INS)}, {q(URL)}, {q(r['quote'])}, now() "
              f"FROM (SELECT normalize(content, NFC) b FROM legal_articles WHERE id={q(r['unit'])} AND md5(content)={q(r['base_md5'])}) x "
              f"WHERE length(x.b)={r['base_len']} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id={q(r['unit'])})")
ids = ",".join(q(r["id"]) for r in rows); m = ",".join(f"({q(r['id'])},{q(r['md5'])})" for r in rows)
st.append(f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version v JOIN (VALUES {m}) e(id,m) ON e.id=v.id AND md5(v.body)=e.m)={len(rows)} THEN 1 ELSE 0 END) AS guard_after")
st.append(f"SELECT md5(string_agg(id||':'||md5(body), ',' ORDER BY id)) fp FROM unit_version WHERE id IN ({ids})")
json.dump(st, open(OUT + "statements4.json", "w"), ensure_ascii=False, indent=1)
print("versions", len(rows), "expected fp", hashlib.md5(",".join(f"{r['id']}:{r['md5']}" for r in sorted(rows, key=lambda r: r["id"])).encode()).hexdigest())
