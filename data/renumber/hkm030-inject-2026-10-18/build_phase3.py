"""HKM-030 — المرحلة 3: التراكيب اليدوية للعمليات المستبقاة آليًّا — بتفويض المالك 18/10/2026
(«نفذ كل شي حسب ما هو متوافق … التراكيب اليدوية جهزها واحقنها»).
  python3 data/renumber/hkm030-inject-2026-10-18/build_phase3.py <current.json> <extra.json>
current.json: قراءة الإنتاج لكل عملية مستبقاة (op_id, art, eff, cur, cur_vid) — نفس مدخل build_phase2.
extra.json: نصوص أساس لم تشملها القراءة: {unit_id: {"content": ..., "md5": ...}} (العقار م1 وم6).
القاعدة: كل نص جديد منقول حرفيًّا من نص الأداة؛ التركيب استبدال سلسلة قديمة موجودة مرة واحدة بالضبط (يُتحقق آليًّا).
ما لا يتوافق مع النص المخزن (فقرة سابقة ناقصة من تعديل غير موجود في الحزمة) يُستبقى ولا يُخمَّن.
عمليات تكمّل نسخة المرحلة 2 بالتاريخ نفسه تأخذ valid_from = اليوم نفسه 00:00:01 لتكون الأحدث دون التباس
(textAsOf يرتب بـ valid_from فقط، وassertNoVersionOverlap يرفض التساوي)."""
import json, re, sys, hashlib, unicodedata
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
ops = {json.loads(l)["op_id"]: json.loads(l) for l in open(D + "amendment_operations.jsonl", encoding="utf-8")}
cur = {r["op_id"]: r for r in json.load(open(sys.argv[1], encoding="utf-8"))}
extra = json.load(open(sys.argv[2], encoding="utf-8"))
p2 = {r["id"]: r for r in json.load(open(OUT + "plan2.json", encoding="utf-8"))["plan"]}
nfc = lambda s: unicodedata.normalize("NFC", s)

def R(text, old, new):
    n = text.count(old)
    assert n == 1, (old[:60], n)
    return text.replace(old, new)

def ev(op):  # نص الأداة بين علامتي التنصيص في الاقتباس
    return ops[op]["evidence_quote"]

def q_between(s, start, end="»"):
    i = s.index(start) + len(start); return s[i:s.index(end, i)]

def instr(op):
    x = ops[op]
    y, m, d = x["instrument_date_hijri"].split("-"); date = f"{int(y)}/{int(m)}/{int(d)}هـ"
    kind = "مرسوم ملكي" if x["instrument_kind"] == "royal_decree" else "قرار مجلس الوزراء"
    return f"{kind} رقم {x['instrument_no']} وتاريخ {date}"

INSTR = {"OP-bfa865d445": "قرار مجلس الوزراء رقم 749 وتاريخ 1447/10/26هـ"}  # الحقلان فارغان في الحزمة؛ من رأس صفحة الأداة
EFF = {o: ops[o]["effective_from_gregorian"] for o in ops}
for o, r in cur.items(): EFF[o] = r["eff"]
def base(op): return cur[op]["cur"]

V = []  # (unit, valid_from, [ops], body, prev_vid, base_md5)
def add(unit, frm, oplist, body, prev=None, bmd5=None):
    V.append(dict(unit=unit, frm=frm, ops=oplist, body=nfc(body), prev=prev, bmd5=bmd5))

# 1) كود البناء م9 — الأداة: «لتصبح المادة بالنص الآتي» ⇒ استبدال كامل بنصها
o = "OP-bfcae2d3a4"; add(cur[o]["art"], EFF[o], [o], q_between(ev(o), "لتصبح المادة بالنص الآتي: «"))
# 2) الأوقاف م21 — الأداة تورد المادة كاملة بفقرتيها
o = "OP-bc37ace240"; add(cur[o]["art"], EFF[o], [o], q_between(ev(o), "«المادة الحادية والعشرون:"))
# 3) لائحة الإجراءات الجزائية م179 — «لتصبح بالنص الآتي» (ثلاث فقرات)
o = "OP-0e06542554"; t = ev(o); t = t[t.index("1- يرفع طلب الإذن"):t.index("\n\nسلمان")]
add(cur[o]["art"], EFF[o], [o], t)
# 4) مجمع المكتبات الوقفية م5 — عضو جديد في آخر قائمة الفقرة (1)
# أساسه نسخة المرحلة 2 (قرار 391 لعام 1443 استبدل المادة كاملة) لا النص المخزن
o = "OP-44acbbb088"; PM = p2["hkm30u-9eaaa8311e1d6d40ba337608"]
add(PM["unit"], EFF[o], [o], R(PM["body"], "مرة واحدة. أعضاء2- يجب", "مرة واحدة. أعضاء" + q_between(ev(o), "بالنص الآتي: \n«") + " 2- يجب"), prev=PM["id"])
# 5) غير الربحي م5 — حذف الفقرة (8) من (أولاً) وتعديل (ثالثاً)
o = "OP-858fc72a63"; t = R(base(o), "ممثل من الجمعيات التعاونية يرشحه رئيس مجلس إدارة المركز بالتنسيق مع مجلس الجمعيات التعاونية. ", "")
t = R(t, "ثالثاً: يعين الأعضاء المشار إليهم في الفقرات (6) و(7) و(8) و(9) و(10) بقرار من مجلس الوزراء، لمدة ثلاث سنوات قابلة للتجديد مرة واحدة.",
      "ثالثاً: " + q_between(ev(o), "ليكون بالنص الآتي: «") + ".")
add(cur[o]["art"], EFF[o], [o], t)
# 6) اعتماد المنشآت الصحية م3 وم6 — فقرة مضافة في آخر المادة بالرقم التالي
o = "OP-32b96a46c3"; add(cur[o]["art"], EFF[o], [o], base(o).rstrip() + " 3 - " + q_between(ev(o), "“", "”") + ".")
o = "OP-6cae13abd7"; add(cur[o]["art"], EFF[o], [o], base(o).rstrip() + " 11 - " + q_between(ev(o), "“", "”") + ".")
# 7) صندوق الشهداء م6 — الفقرة (16) قبل الحكم الختامي «وللمجلس أن يفوض»
o = "OP-bfa865d445"; add(cur[o]["art"], EFF[o], [o], R(base(o), " وللمجلس أن يفوض", " 16 - " + q_between(ev(o), "“", "”") + ". وللمجلس أن يفوض"))
# 8) المحاسبة م1 — تعريف «الوزير»
o = "OP-53ecc614d7"; add(cur[o]["art"], EFF[o], [o], R(base(o), "الوزير: وزير التجارة.", q_between(ev(o), "ليصبح بالنص الآتي: «") + "."))
# 9) مجلس التنمية السياحي م4 — عضو (16) في آخر قائمة (أ)
o = "OP-bb70ec1a5e"; add(cur[o]["art"], EFF[o], [o], R(base(o), "عضواً ب - يختار", "عضواً " + q_between(ev(o), "بالنص الآتي: «") + " ب - يختار"))
# 10) الإحصاء م1 — التعريفات الخمسة من البند (1) من الأداة (المسوح في البند (هـ) لم يُستخرج عملية مستقلة)
o = "OP-2ad736b634"; e = ev(o); t = base(o)
src = json.load(open(D + "source_snapshots.json", encoding="utf-8"))[ops[o]["source_url"]]
defs = {"المنشآت الخاصة": "OP-b4cdd588f1", "المجالات الإحصائية": "OP-b2fe5649ba", "المؤشرات": "OP-3a39b521e6", "الإحصاء": "OP-2ad736b634", "المسوح": None}
olds = {"المنشآت الخاصة": "جميع الشركات بما فيها الشركات التي تسهم فيها الدولة، والمنشآت الفردية الخاصة، والجمعيات الأهلية.",
        "المجالات الإحصائية": t[t.index("المجالات الإحصائية: ") + len("المجالات الإحصائية: "):t.index(" السجلات الإدارية:")],
        "المؤشرات": t[t.index("المؤشرات: ") + len("المؤشرات: "):t.index(" الإحصاء:")],
        "الإحصاء": t[t.index(" الإحصاء: ") + len(" الإحصاء: "):t.index(" العمل الإحصائي:")],
        "المسوح": t[t.index("المسوح: ") + len("المسوح: "):t.index(" الخدمات الإحصائية:")]}
for term, old in olds.items():
    new = q_between(src, f"«{term}» ليكون بالنص الآتي: «")
    t = R(t, f"{term}: {old}", f"{term}: {new}" + ("" if old.endswith(".") is False else "."))
add(cur[o]["art"], EFF[o], [x for x in defs.values() if x], t)
# 11) الإحصاء م12 — (د) جديدة وإعادة الترتيب
o = "OP-8f46501abe"; t = base(o)
t = R(t, "ز- أي موارد أخرى", "ح- أي موارد أخرى"); t = R(t, "و- ما يقبله", "ز- ما يقبله"); t = R(t, "هـ- الغرامات", "و- الغرامات")
t = R(t, "د - المقابل المالي", "د- عوائد استثمار مواردها المالية.هـ - المقابل المالي")
add(cur[o]["art"], EFF[o], [o], t)
# 12) مركز الإسناد والتصفية م4 — (هـ) جديدة وإعادة الترتيب
o = "OP-2a989bbf04"; t = R(base(o), "هـ- ثلاثة من القطاع الخاص", "هـ - ممثل لديوان المظالم. و- ثلاثة من القطاع الخاص")
add(cur[o]["art"], EFF[o], [o], t)
# 13) الوفود الرسمية م2 — الفقرة الفرعية (أ) من الفقرة (2)
o = "OP-47a74785ed"; t = base(o); i = t.index("أ‌ - الاجتماعات التي تتضمن"); j = t.index("ب‌ - الاجتماعات المتخصصة")
t = t[:i] + "أ‌ - " + q_between(ev(o), "“", "”") + "." + t[j:]
add(cur[o]["art"], EFF[o], [o], t)
# 14) البنك المركزي م8 — (ب) و(1 مكرر)، أداة واحدة وتاريخ واحد
o = "OP-b01c45d860"; t = R(base(o), "ب- نائب المحافظ نائباً للرئيس.", "ب- نائبا المحافظ عضوين.")
t = R(t, "ج - خمسة من غير موظفي الحكومة أعضاء. ", "ج - خمسة من غير موظفي الحكومة أعضاء. " + q_between(ev("OP-b4bf55d8eb"), "“", "”") + ". ")
add(cur[o]["art"], EFF[o], [o, "OP-b4bf55d8eb"], t)
# 15) لائحة الإفلاس م2 — (ج) في آخر الفقرة (1)
o = "OP-00fb8f2de4"; add(cur[o]["art"], EFF[o], [o], R(base(o), " 2- \xa0تحدد", " ‌ج- " + q_between(ev(o), "«ج- ") + ". 2- \xa0تحدد"))
# 16) لائحة الأراضي البيضاء م1 — تعريفا «تنمية عمرانية» و«القرار»
o = "OP-0ada7dc6cc"; t = base(o)
old = t[t.index("تنمية عمرانية: ") + len("تنمية عمرانية: "):t.index(" القرار:")]
t = R(t, "تنمية عمرانية: " + old, "تنمية عمرانية: " + q_between(ev(o), "ليكون بالنص الآتي:«") + ".")
t = R(t, "القرار: القرار الصادر عن الوزير بإخضاع أرض معينة لتطبيق الرسم.", "القرار: " + q_between(ev("OP-6769086b1c"), "ليكون بالنص الآتي:«") + ".")
add(cur[o]["art"], EFF[o], [o, "OP-6769086b1c"], t)
# 17) لائحة الأراضي البيضاء م6 — (ب) ودمج (ج-د)، والفقرة (2)
o = "OP-e9f0569313"; t = base(o); i = t.index("ب - المرحلة الثانية"); j = t.index(" 2 - إذا لم تنطبق")
newbc = q_between(ev(o), "على النحو الآتي:\n\n«").replace("\n\n", " ")
t = t[:i] + newbc + "." + t[j:]
t = t[:t.index("2 - إذا لم تنطبق")] + "2 - " + q_between(ev("OP-f5853037ed"), "«")
add(cur[o]["art"], EFF[o], [o, "OP-f5853037ed"], t)
# 18) السوق المالية م7 — (ب) جديدة وإعادة الترتيب
o = "OP-e575706233"; t = base(o)
t = R(t, "تعويضاتهم.د - يباشر", "تعويضاتهم.هـ - يباشر"); t = R(t, "مهامها.ج - يضع", "مهامها.د - يضع") if "مهامها.ج - يضع" in t else R(t, "إلى أن يتم تعيين خلف له.ج - يضع", "إلى أن يتم تعيين خلف له.د - يضع")
t = R(t, "عند غيابه.ب - مدة العضوية", "عند غيابه.ب - " + q_between(ev(o), "“", "”") + ".ج - مدة العضوية")
add(cur[o]["art"], EFF[o], [o], t)

# 19) تنظيم الهيئة العامة للعقار — يكمّل نسخ المرحلة 2 (قرار 69) ثم قرار 426 (1443/8/5) ثم قرار 63 (1447/1/20)
P3 = p2["hkm30u-765d38cab6ad2ed95f56425d"]; P4 = p2["hkm30u-67f8ec82c3ef7ade861e12d2"]; P5 = p2["hkm30u-0457b9a76b93f3f5194beaac"]
S1 = "2021-09-10T00:00:01Z"
t = R(P3["body"], "6 - اتخاذ ما يلزم من إجراءات لتحديد المنطقة أو المناطق العقارية التي يبدأ فيها تطبيق نظام التسجيل العيني للعقار، وذلك بحسب ما قضى به من أحكام.",
      "6 - " + q_between(ev("OP-9dae0bb92b"), "بالنص الآتي: «") + ".")
t = t.rstrip() + "19 - " + q_between(ev("OP-ca4ee5c00f"), "بالنص الآتي: «") + ".20 - " + q_between(ev("OP-62f6621868"), "بالنص الآتي: «") + "."
add(P3["unit"], S1, ["OP-9dae0bb92b", "OP-ca4ee5c00f", "OP-62f6621868"], t, prev=P3["id"])
t4a = P4["body"].rstrip() + " " + q_between(ev("OP-b44a6f0526"), "بالنص الآتي: «") + "."
add(P4["unit"], S1, ["OP-b44a6f0526"], t4a, prev=P4["id"])
t4b = R(t4a, "أ – المحافظ", q_between(ev("OP-2d48c6ca44"), "“", "”"))
add(P4["unit"], EFF["OP-2d48c6ca44"], ["OP-2d48c6ca44"], t4b)
t = t4b
for a, b in (("\nط - ثلاثة", "\nي - ثلاثة"), ("\nح- ممثل من الهيئة العامة للمساحة", "\nط- ممثل من الهيئة العامة للمساحة"), ("\nز- ممثل من الهيئة العامة لعقارات", "\nح- ممثل من الهيئة العامة لعقارات"),
             ("\nو- ممثل من وزارة الاستثمار", "\nز- ممثل من وزارة الاستثمار"), ("\nهـ - ممثل من وزارة الاقتصاد", "\nو - ممثل من وزارة الاقتصاد"), ("\nد - ممثل من وزارة المالية", "\nهـ - ممثل من وزارة المالية"),
             ("\nج - ممثل من وزارة العدل", "\nد - ممثل من وزارة العدل"), ("\nب- ممثل من وزارة الشؤون البلدية", "\nج- ممثل من وزارة الشؤون البلدية")):
    t = R(t, a, b)
t = R(t, "\nج- ممثل من وزارة الشؤون البلدية", "\n" + q_between(ev("OP-214a5f3acd"), "بالنص الآتي: «") + "\nج- ممثل من وزارة الشؤون البلدية")
add(P4["unit"], EFF["OP-214a5f3acd"], ["OP-214a5f3acd"], t)
t5a = R(P5["body"], "4 - وضع الهيكل التنظيمي للهيئة ورفعه لاعتماده وفق الإجراءات النظامية المتبعة.", "4 - " + q_between(ev("OP-e2d6dd7808"), "بالنص الآتي: «") + ".")
t5a = R(t5a, "6 - إقرار المقابل المالي الذي تتقاضاه الهيئة عن الأعمال والخدمات التي تقدمها.", "6 - " + q_between(ev("OP-fe53d8cfd8"), "بالنص الآتي: «") + ".")
add(P5["unit"], S1, ["OP-e2d6dd7808", "OP-fe53d8cfd8"], t5a, prev=P5["id"])
add(P5["unit"], EFF["OP-d01f6b44a0"], ["OP-d01f6b44a0"], R(t5a, "وتفويض المحافظ بالتوقيع", "وتفويض الرئيس التنفيذي بالتوقيع"))
U1, U6 = "cmpz6ogqx0b4bcwg224ofcsp1", "cmpz6ohjg0b4lcwg2chbwinuu"
add(U1, EFF["OP-8e862f9a9d"], ["OP-8e862f9a9d"], R(extra[U1]["content"], "المحافظ : محافظ الهيئة.", q_between(ev("OP-8e862f9a9d"), "إحلال تعريف (", ")") + "."), bmd5=extra[U1]["md5"])
add(U6, EFF["OP-d01f6b44a0"], ["OP-d01f6b44a0"], R(extra[U6]["content"], "بناء على ترشيح المحافظ،", "بناء على ترشيح الرئيس التنفيذي،"), bmd5=extra[U6]["md5"])

# 20) تنظيم هيئة تنمية الصادرات — «الرئيس التنفيذي» محل «الأمين العام» أينما وردت (بصيغها: المعرفة، وبلام الجر، والنكرة)
o = "OP-b07e1347ca"
for u in ("cmpz64ux404c7cwg2uzgw2ia4", "cmpz64vf004cdcwg28f387vx2", "cmpz64vwv04cjcwg235fowno9", "cmpz64w2t04clcwg2zmq8yubp"):
    t = extra[u]["content"]
    t = t.replace("الأمين العام : أمين عام الهيئة", "الرئيس التنفيذي: الرئيس التنفيذي للهيئة")
    t = t.replace("للأمين العام", "للرئيس التنفيذي").replace("الأمين العام", "الرئيس التنفيذي").replace("أمين عام", "رئيس تنفيذي")
    assert "أمين" not in t, u
    add(u, EFF[o], [o], t, bmd5=extra[u]["md5"])

# مستبقى: الأساس المخزن أقدم من تعديل سابق غير موجود في الحزمة (فقرة سابقة ناقصة)
HELD = {"OP-aaf8d09f12": "نظام المرور م7: النص المخزن ينتهي بالفقرة (7) والأداة تضيف (9)؛ الفقرة (8) من تعديل سابق ليس في الحزمة",
        "OP-7e38c01036": "نظام التأمينات الاجتماعية م62: النص المخزن ينتهي بالفقرة (6) والأداة تضيف (8)؛ الفقرة (7) من تعديل سابق ليس في الحزمة"}

q = lambda v: "'" + v.replace("'", "''") + "'"
rows, mvals, plan = [], [], []
for v in V:
    o0 = v["ops"][0]
    v["id"] = "hkm30u-" + hashlib.sha256(f"{v['unit']}@{v['frm']}@{o0}".encode()).hexdigest()[:24]
    v["md5"] = hashlib.md5(v["body"].encode()).hexdigest()
    frm = v["frm"] if "T" in v["frm"] else v["frm"] + "T00:00:00Z"
    x = ops[o0]; pub = "/".join(str(int(p)) for p in x["published_hijri"].split("-"))
    lim = 600 // len(set(v["ops"]))
    e = " | ".join(s if len(s) <= lim else s[:lim].rstrip() + "…" for s in (re.sub(r"\s+", " ", ops[k]["evidence_quote"]).strip() for k in dict.fromkeys(v["ops"])))
    v["instrument"] = INSTR.get(o0) or instr(o0)
    v["quote"] = nfc(e + f"؛ نُشر في أم القرى {pub}هـ (" + "، ".join(dict.fromkeys(v["ops"])) + ")")
    rows.append(v)
json.dump({"plan": rows, "held": HELD}, open(OUT + "plan3.json", "w"), ensure_ascii=False, indent=1)
print("versions", len(rows), "ops", len({o for v in rows for o in v["ops"]}), "held", len(HELD))
print("expected fp", hashlib.md5(",".join(f"{v['id']}:{v['md5']}" for v in sorted(rows, key=lambda v: v["id"])).encode()).hexdigest())

# ── SQL: تمهيد على دفعات + معاملة ذرّية واحدة (كالمرحلة 2) ──
STAGE = "uqn_fix.inject_p3_stage"
EDU = "1a924709d8ab4930b121cd9275170d14"  # نظام التعليم العام (م/36 وتاريخ 1448/1/27هـ) — يسري 2027-01-20
EDU_INS = "مرسوم ملكي رقم م/36 بتاريخ 1448-01-27"
EDU_URL = "https://www.uqn.gov.sa/decisions-and-regulations/4001465"
EDU_Q = "يُعمل بالنظام بعد (مائة وثمانين) يومًا من تاريخ نشره في الجريدة الرسمية، ويُلغي جميع ما يتعارض معه من أحكام. — نُشر في أم القرى 1448/2/10هـ (2026-07-24)، فيسري من 2027-01-20"
NEW_DEC = {"OP-8e862f9a9d", "OP-2d48c6ca44", "OP-d01f6b44a0"}  # قرار 426 بلا قرار سابق؛ سليمة في الفحص المسبق
DEC_NOTE = "تفويض المالك 18/10/2026 («نفذ كل شي حسب ما هو متوافق»): قرار مجلس الوزراء 426 (1443/8/5هـ) — إحلال «الرئيس التنفيذي» محل «المحافظ» في تنظيم الهيئة العامة للعقار؛ سليمة في الفحص المسبق؛ حُقنت في المرحلة 3 (build_phase3.py)"
cmd5 = {r["art"]: r["cmd5"] for r in cur.values()}
stage = [f"CREATE TABLE IF NOT EXISTS {STAGE} (id text PRIMARY KEY, unit_id text NOT NULL, body text NOT NULL, valid_from timestamptz NOT NULL, evidence_instrument text NOT NULL, evidence_url text NOT NULL, evidence_quote text NOT NULL, md5 text NOT NULL)"]
vals = [f"({q(v['id'])}, {q(v['unit'])}, {q(v['body'])}, {q(v['frm'] if 'T' in v['frm'] else v['frm'] + 'T00:00:00Z')}, {q(v['instrument'])}, {q(ops[v['ops'][0]]['source_url'])}, {q(v['quote'])}, {q(v['md5'])})" for v in rows]
for i in range(0, len(rows), 5):
    ids_c = ",".join(q(v["id"]) for v in rows[i:i + 5])
    stage.append([f"INSERT INTO {STAGE} (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, md5) VALUES\n" + ",\n".join(vals[i:i + 5]),
                  f"SELECT 1/(CASE WHEN (SELECT count(*) FROM {STAGE} WHERE id IN ({ids_c}) AND md5(body)=md5)={len(rows[i:i + 5])} THEN 1 ELSE 0 END) AS chunk_ok"])
units = list(dict.fromkeys(v["unit"] for v in rows))
first = {}
for v in rows: first.setdefault(v["unit"], v)
conds = []
for u, v in first.items():
    if v["prev"]: conds.append(f"(SELECT string_agg(id, ',' ORDER BY valid_from) FROM unit_version WHERE unit_id={q(u)})={q(v['prev'])}")
    else:
        conds.append(f"NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id={q(u)})")
        conds.append(f"(SELECT md5(content) FROM legal_articles WHERE id={q(u)})={q(v['bmd5'] or cmd5[u])}")
ids = ",".join(q(v["id"]) for v in rows)
mvals = ",".join(f"({q(v['id'])},{q(v['md5'])})" for v in rows)
dec_ids = ",".join(q(o) for o in sorted(NEW_DEC))
apply_st = [
    "SELECT 1/(CASE WHEN " + " AND ".join(conds) + f" AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id IN ({ids}))"
    f" AND NOT EXISTS (SELECT 1 FROM verification v WHERE v.object_id={q(EDU)} OR v.object_id IN (SELECT id FROM legal_articles WHERE \"legalSystemId\"={q(EDU)}))"
    f" AND (SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={q(EDU)})=68"
    f" AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review WHERE op_id IN ({dec_ids})) THEN 1 ELSE 0 END) AS guard_before",
    f"SELECT 1/(CASE WHEN (SELECT count(*) FROM {STAGE} s JOIN (VALUES {mvals}) e(id,m) ON e.id=s.id AND s.md5=e.m AND md5(s.body)=e.m)={len(rows)} THEN 1 ELSE 0 END) AS stage_ok",
    f"INSERT INTO uqn_fix.amendment_review (op_id, decision, corrected, reviewer, note, decided_at) SELECT o, 'approved', NULL, 'Claude بتفويض المالك', {q(DEC_NOTE)}, now() FROM unnest(ARRAY[{dec_ids}]) o",
    f"INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) SELECT id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, now() FROM {STAGE} WHERE id IN ({ids})",
    f"INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) "
    f"SELECT 'hkm30v-' || left(md5(x.t || '@' || x.i || '@edu-pending'), 24), x.t, x.i, 'صادر لم يسرِ بعد', {q(EDU_INS)}, {q(EDU_URL)}, {q(EDU_Q)}, 'manual', 'hkm030-uqn-inject-2026-10-18', now() "
    f"FROM (SELECT 'work' t, {q(EDU)} i UNION ALL SELECT 'unit', id FROM legal_articles WHERE \"legalSystemId\"={q(EDU)}) x",
    f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id IN ({','.join(q(u) for u in units)}))={len(rows) + sum(1 for v in first.values() if v['prev'])}"
    f" AND (SELECT count(*) FROM verification WHERE verified_status='صادر لم يسرِ بعد' AND (object_id={q(EDU)} OR object_id IN (SELECT id FROM legal_articles WHERE \"legalSystemId\"={q(EDU)})))=69"
    f" AND (SELECT count(*) FROM uqn_fix.amendment_decision WHERE op_id IN ({dec_ids}) AND decision='approved')=3 THEN 1 ELSE 0 END) AS guard_after",
    f"SELECT md5(string_agg(id||':'||md5(body), ',' ORDER BY id)) fp FROM unit_version WHERE id IN ({ids})",
]
json.dump({"stage": stage, "apply": apply_st}, open(OUT + "statements3.json", "w"), ensure_ascii=False, indent=1)
print("stage chunks", [len(json.dumps(c, ensure_ascii=False)) for c in stage[1:]], "apply", sum(len(s) for s in apply_st))

# ── تمهيد مضغوط: النص يُبنى داخل القاعدة من أساسه (بادئة مشتركة + الوسط المتغير + لاحقة مشتركة)
#    فلا يُنقل إلا الجزء المتغير؛ وبصمة كل صف تُطابق محليًّا قبل القبول.
def _base_text(v, prevbody):
    if prevbody is not None: return prevbody
    if v["prev"]: return p2[v["prev"]]["body"]
    return nfc(extra[v["unit"]]["content"] if v["unit"] in extra else next(r["cur"] for r in cur.values() if r["art"] == v["unit"]))
def _base_sql(v, previd):
    if previd: return f"(SELECT body FROM {STAGE} WHERE id={q(previd)})"
    if v["prev"]: return f"(SELECT body FROM unit_version WHERE id={q(v['prev'])})"
    return f"(SELECT normalize(content, NFC) FROM legal_articles WHERE id={q(v['unit'])})"
lastv, compact = {}, []
for v in rows:
    pv = lastv.get(v["unit"]); b = _base_text(v, pv["body"] if pv else None); t = v["body"]
    p = 0
    while p < min(len(b), len(t)) and b[p] == t[p]: p += 1
    s = 0
    while s < min(len(b), len(t)) - p and b[-1 - s] == t[-1 - s]: s += 1
    mid = t[p:len(t) - s]
    assert b[:p] + mid + (b[len(b) - s:] if s else "") == t
    frm = v["frm"] if "T" in v["frm"] else v["frm"] + "T00:00:00Z"
    expr = f"left(x.b, {p}) || {q(mid)} || right(x.b, {s})"
    compact.append([f"INSERT INTO {STAGE} (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, md5) "
                    f"SELECT {q(v['id'])}, {q(v['unit'])}, {expr}, {q(frm)}, {q(v['instrument'])}, {q(ops[v['ops'][0]]['source_url'])}, {q(v['quote'])}, {q(v['md5'])} "
                    f"FROM (SELECT {_base_sql(v, pv['id'] if pv else None)} b) x WHERE length(x.b)={len(b)} AND NOT EXISTS (SELECT 1 FROM {STAGE} WHERE id={q(v['id'])})", v["id"]])
    lastv[v["unit"]] = v
json.dump(compact, open(OUT + "stage3_compact.json", "w"), ensure_ascii=False, indent=1)
print("compact rows", len(compact), "max stmt", max(len(c[0]) for c in compact))
