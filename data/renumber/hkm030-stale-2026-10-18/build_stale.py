"""HKM-030 (الخطوة 2 من «كل الخمس خطوات»): أنظمة أساسها المخزن أقدم من الأداة المستبقاة.
يُبنى التعديل الوسيط من ملاحظة هيئة الخبراء (النص الحرفي بين علامتي التنصيص، توحيد المسافات فقط) ثم تُطبَّق
الأداة المستبقاة من لقطة أم القرى بموضعها وبصمتها. التاريخ: تاريخ الأداة محوَّلًا (hijri_converter) لما مصدره
هيئة الخبراء، وتاريخ النشر لما مصدره أم القرى (عرف المرحلة 5).
مستبقى: المرور م23 وم27 (قرار 586 يفترض «وزارة النقل والخدمات اللوجستية» والأساس «وزير النقل»، وأداة الاسم
ليست في الحزمة)، وتبادل المنافع م6 (قرار 419 في مرفق PDF فقط)، والمقيمون المعتمدون (ملاحظات متعددة العمليات
تنتظر قرار المالك في compose-2026-10-16)."""
import json, hashlib, re, sys
from hijri_converter import Hijri

OUT = "data/renumber/hkm030-stale-2026-10-18/"
SRC = json.load(open("ingest/uqn-fix-2026-09-25/data/source_snapshots.json", encoding="utf-8"))
NOTES = [json.loads(l) for l in open("ingest/boe-corpus-2026-09-28/data/parsed/amendment_note.jsonl", encoding="utf-8")]
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()


def snap(p):
    k = [k for k in SRC if k.endswith("p=" + p)]
    assert len(k) == 1, p
    v = SRC[k[0]]
    return k[0], (v if isinstance(v, str) else v["text"])


def frag(p, start, end):
    """جزء حرفي من لقطة أم القرى بين علامتين (تبدأ بالأولى ولا تشمل الثانية)."""
    url, t = snap(p)
    i = t.index(start)
    assert t.count(start) == 1, start
    j = t.index(end, i)
    s = t[i:j]
    return ["@", url, i, len(s), md5(s)], s


def note(law, seq, nseq):
    n = [x for x in NOTES if x["law_id"] == law and x["unit_seq"] == seq and x["note_seq"] == nseq]
    assert len(n) == 1
    return n[0]


def bpart(n, start, end=None, prefix=None):
    """جزء من ملاحظة هيئة الخبراء المخزنة (boe.amendment_note) بموضعه وبصمته، مع توحيد المسافات."""
    s = n["note_text"]
    i = s.index(start)
    j = len(s) if end is None else (s.rindex(end) if end == '"' and prefix is None else s.index(end, i + len(start)))
    raw = s[i:j]
    return ["boe", n["id"], i, len(raw), md5(raw), "clean"], clean(raw)


def bquote(n):
    s = n["note_text"]
    return ["boe", n["id"], 0, len(s), md5(s), "clean"]


def clean(s):
    """توحيد المسافات فقط: المسافة غير المنقسمة مسافة، ولا مسافات زائدة داخل السطر أو في طرفيه."""
    s = s.replace("\xa0", " ")
    s = "\n".join(re.sub(r"[ \t]+", " ", ln).strip() for ln in s.split("\n"))
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def g(h):
    y, m, d = map(int, h.split("/"))
    return Hijri(y, m, d).to_gregorian().isoformat() + "T00:00:00Z"


def quoted(s, after):
    """النص بين أول علامتي تنصيص بعد العبارة."""
    i = s.index(after) + len(after)
    a = s.index('"', i) + 1
    b = s.index('"', a)
    return s[a:b]


V = []  # (uid, tag, vf, instrument, url, quote, base_sql, spec, prev)


def add(uid, tag, vf, ins, url, quote, base_sql, spec, prev):
    V.append(dict(uid=uid, tag=tag, vf=vf, ins=ins, url=url, quote=quote, base=base_sql, spec=spec, prev=prev))


def vid(v):
    return "hkm30u-" + hashlib.sha256(f"{v['uid']}@{v['vf']}@{v['tag']}".encode()).hexdigest()[:24]


# ── نظام تبادل المنافع م3 ──
EX = "boe26-2cdd4e516dca1c5607441e29"
EXU = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ae482429-33b8-4e3f-a3ae-a9a700f23d5c/1"
u = "cmpz9eoqb0cg5ybvvrohobl3g"
n1 = note(EX, 3, 1)
P6, p6 = bpart(n1, "ألا تكون مدد الاشتراك", '"')
assert p6.endswith("نظام التأمينات الاجتماعية"), p6[-40:]
add(u, "m7-1431-p6", g("1431/2/11"), "مرسوم ملكي رقم م/7 وتاريخ 1431/2/11هـ", EXU, bquote(n1),
    f"(SELECT normalize(content, NFC) FROM legal_articles WHERE id='{u}' AND md5(content)='cccf6de4f4ecfc99948305b99650acf9')",
    [["append", [" 6 - ", P6]]], None)
n2 = note(EX, 3, 2)
P5, p5 = bpart(n2, "أن يبدي المشترك", '"')
add(u, "m60-1437-p5", g("1437/9/24"), "مرسوم ملكي رقم م/60 وتاريخ 1437/9/24هـ", EXU, bquote(n2), "PREV",
    [["span", "5 - المشترك الذي لا يزال", " 6 - ", ["5 - ", P5]]], 0)
F, _ = frag("19638", "ألا تكون مدد الاشتراك المضمومة", "”.2- تعديل الفقرة (5) من المادة (السادسة)")
Q118, _ = frag("19638", "1- تعديل الفقرة (6) من المادة (الثالثة)", "2- تعديل الفقرة (5) من المادة (السادسة)")
add(u, "m118-1443-p6", "2022-06-24T00:00:00Z", "المرسوم الملكي رقم م/118 وتاريخ 1443/11/16هـ", "https://www.uqn.gov.sa/details?p=19638",
    [Q118, "؛ نُشر في أم القرى 1443/11/25هـ (HKM-030 الأساس المتقادم)"], "PREV", [["from", " 6 - ", [" 6 - ", F]]], 1)

# ── نظام المرور م75 ──
TR = "boe26-c41910c1611c28ba4172746d"
TRU = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/85364e57-c01e-41ba-8def-a9a700f183e9/1"
u = "cmpz5xjk701xbcwg2xvgf5tgs"
t1 = note(TR, 75, 1)
W115, w115 = bpart(t1, "للمخالف حق الاعتراض")
assert w115.count("\n\n") == 2 and w115.endswith("الغرامات المستحقة عليه."), w115[-60:]
add(u, "m115-1439", g("1439/12/5"), "مرسوم ملكي رقم م/115 وتاريخ 1439/12/5هـ", TRU, bquote(t1),
    f"(SELECT normalize(content, NFC) FROM legal_articles WHERE id='{u}' AND md5(content)='474d737dfefa6c5af2bf1e6da38af7b7')",
    [["whole", W115]], None)
A, _ = frag("19362", "2- مع مراعاة الفقرة (2) من المادة (الثالثة والسبعين)", "فإذا لم يقم المخالف بالسداد")
B, _ = frag("19362", "فإذا لم يقم المخالف بالسداد", "\".2- تعديل الفقرة (3)")
C, _ = frag("19362", "3- تجوز تجزئة سداد", "\".ثانياً:")
url86, s86 = snap("19362")
i86 = s86.index("أولاً: الموافقة على تعديل المادة (الخامسة والسبعين)")
q86 = s86[i86:i86 + 560]
add(u, "m86-1443", "2022-04-25T00:00:00Z", "المرسوم الملكي رقم م/86 وتاريخ 1443/9/14هـ", "https://www.uqn.gov.sa/details?p=19362",
    [["@", url86, i86, 560, md5(q86)], "… ؛ نُشر في أم القرى 1443/9/24هـ (HKM-030 الأساس المتقادم)"], "PREV",
    [["from", "مع مراعاة الفقرة (2) من المادة (الثالثة والسبعين)", [A, "\n\n", B, "\n\n", C]]], 3)

# ── تنظيم هيئة تنمية الصادرات السعودية م4 ──
XP = "boe26-f728667f57fb4635db5d5388"
XPU = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/98642c12-dd48-4148-841d-a9a700f1b3ea/1"
u = "cmpz64vf004cdcwg28f387vx2"
e1 = note(XP, 4, 1)
W105, w105 = bpart(e1, "يكون للهيئة مجلس إدارة", '"')
assert w105.startswith("يكون للهيئة مجلس إدارة برئاسة الوزير، وعضوية كل من:") and "11- ثلاثة من المصد" in w105 and w105.endswith("في حالة غيابه")
add(u, "cm105-1440", g("1440/2/14"), "قرار مجلس الوزراء رقم 105 وتاريخ 1440/2/14هـ", XPU, bquote(e1), "''", [["whole", W105]], None)
e2 = note(XP, 4, 2)
P8, p8 = bpart(e2, "ممثل من وزارة الاستثمار", '"', prefix=True)
assert p8 == "ممثل من وزارة الاستثمار", p8
add(u, "cm594-1442", g("1442/10/13"), "قرار مجلس الوزراء رقم 594 وتاريخ 1442/10/13هـ", XPU, bquote(e2), "PREV",
    [["sub", "11- ثلاثة من المصد", "12- ثلاثة من المصد"], ["sub", "10- ممثل من مجلس الغرف", "11- ممثل من مجلس الغرف"],
     ["sub", "9- ممثل من برنامج الصادرات", "10- ممثل من برنامج الصادرات"],
     ["sub", "8- ممثل من الهيئة العامة للغذاء والدواء.", ["8- ", P8, "\n\n9- ممثل من الهيئة العامة للغذاء والدواء."]]], 5)
P10, _ = frag("19422", "10- ممثل من بنك التصدير والاستيراد السعودي", "\".ب- تعديل الفقرة (11)")
P11, _ = frag("19422", "11- اثنان من القطاع الخاص", "\".ج- حذف الفقرة (12)")
Q1, _ = frag("19422", "1- تعديل عبارة", "2- تعديل المادة")
Q3, _ = frag("19422", "3- تعديل المادة (الرابعة)", "4- تعديل المادة (السادسة)")
add(u, "cm539-1443-full", "2022-05-13T00:00:01Z", "قرار مجلس الوزراء رقم 539 وتاريخ 1443/9/18هـ", "https://www.uqn.gov.sa/details?p=19422",
    [Q1, " … ", Q3, "؛ نُشر في أم القرى 1443/10/12هـ (HKM-030 الأساس المتقادم: يحل محل نسخة 539 المبنية على أساس 1428)"], "PREV",
    [["suball", "الأمين العام", "الرئيس التنفيذي"], ["span", "10- ممثل من برنامج الصادرات", "\n\nوفيما عدا", [P10, "\n\n", P11]]], 6)

EXPECT_LATEST = {"cmpz9eoqb0cg5ybvvrohobl3g": None, "cmpz5xjk701xbcwg2xvgf5tgs": None, "cmpz64vf004cdcwg28f387vx2": "hkm30u-5cd293c2d7c4a57f27454997"}

import base64


def lit(s):
    """نص عربي في SQL بحروف ASCII فقط: base64 مع حارس بصمة (نسخ البيان لا يغيّر الحروف المركّبة)."""
    b = base64.b64encode(s.encode()).decode()
    return f"(SELECT q FROM (SELECT convert_from(decode('{b}', 'base64'), 'UTF8') q) s WHERE md5(q)='{md5(s)}')"


def b64(s):
    return f"convert_from(decode('{base64.b64encode(s.encode()).decode()}', 'base64'), 'UTF8')"


st, ids = [], []
for k, v in enumerate(V):
    v["id"] = vid(v); ids.append(v["id"])
    # المواصفة والاقتباس بـ base64: النقل يفك هروب \\u مرتين فتختل البصمة (ملاحظة المرحلة 5)
    spec = json.dumps(v["spec"], ensure_ascii=False).replace("\xa0", "⍽")
    base = f"(SELECT body FROM unit_version WHERE id='{V[v['prev']]['id']}')" if v["base"] == "PREV" else v["base"]
    # آخر نسخة بالتاريخ قبل الإدراج: السابقة في السلسلة، إلا إذا كانت للوحدة نسخة قائمة أحدث (الصادرات: نسخة 539 القديمة)
    prev = f"'{EXPECT_LATEST[v['uid']]}'" if EXPECT_LATEST[v["uid"]] else (f"'{V[v['prev']]['id']}'" if v["prev"] is not None else "NULL")
    st.append(f"INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) "
              f"SELECT '{v['id']}', '{v['uid']}', uqn_fix.hkm30_compose({base}, {b64(spec)}, '{md5(spec)}'), '{v['vf']}', {lit(v['ins'])}, '{v['url']}', uqn_fix.hkm30_part({b64(json.dumps(v['quote'], ensure_ascii=False))}::jsonb), now() "
              f"WHERE (SELECT id FROM unit_version WHERE unit_id='{v['uid']}' ORDER BY valid_from DESC LIMIT 1) IS NOT DISTINCT FROM {prev}")
uids = ",".join(f"'{x}'" for x in EXPECT_LATEST)
il = ",".join(f"'{x}'" for x in ids)
st.append(f"UPDATE legal_articles a SET search_norm = uqn_fix.hkm30_search_norm(a.\"lawName\", a.title, v.body, a.keywords, a.classification, a.chapter) "
          f"FROM (SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE unit_id IN ({uids}) AND valid_from <= now() ORDER BY unit_id, valid_from DESC) v WHERE a.id=v.unit_id")
st.append(f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE id IN ({il}) AND evidence_quote IS NOT NULL AND evidence_instrument IS NOT NULL)={len(ids)} THEN 1 ELSE 0 END) AS guard_after")
st.append(f"SELECT md5(string_agg(id||':'||md5(body), ',' ORDER BY id)) fp, count(*) n FROM unit_version WHERE id IN ({il})")
DDL = [s.strip().rstrip(";") for s in re.findall(r"(CREATE OR REPLACE FUNCTION.*?(?:\$f\$;|END \$\$;))", open(OUT + "boe_part.sql", encoding="utf-8").read(), re.S)]
assert len(DDL) == 2
st = DDL + st
json.dump(st, open(OUT + "statements.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump([{k: v[k] for k in ("id", "uid", "tag", "vf", "ins")} for v in V], open(OUT + "plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for v in V:
    print(v["id"], v["tag"], v["vf"])
print(len(st), "statements")
