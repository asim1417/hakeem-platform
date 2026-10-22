"""HKM-030 — مصنف فجوات التعديل للمالك من extraction_gaps.json وreflected_items.json وreflected_result.json (قراءة فقط).
  python3 data/renumber/hkm030-inject-2026-10-18/build_gaps_workbook.py"""
import json, re, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
D = "ingest/uqn-fix-2026-09-25/data/"; OUT = "data/renumber/hkm030-inject-2026-10-18/"
XL = "ingest/uqn-fix-2026-09-25/review/فجوات-التعديل-الفحص-الشامل-2026-10-18.xlsx"
src = json.load(open(D + "source_snapshots.json", encoding="utf-8"))
ops = collections.Counter(json.loads(l)["source_url"] for l in open(D + "amendment_operations.jsonl", encoding="utf-8"))
mqn = collections.Counter(json.loads(l)["source_url"] for l in open(D + "amendment_manual_queue.jsonl", encoding="utf-8"))
items = json.load(open(OUT + "reflected_items.json", encoding="utf-8"))
def title(u):
    t = re.sub(r"\s+", " ", src.get(u, ""))
    m = re.search(r"# (.{5,140}?) \d{4}-\d{1,2}-\d{1,2}", t)
    return m.group(1) if m else t[:100]
def category(i):
    t = i["text"][:160]
    if i["layer"] == "extraction_gap":
        if ops[i["url"]] == 0 and mqn[i["url"]] == 0 and src.get(i["url"], "").lstrip().startswith("بعون") and not re.match(r"(تعديل|حذف|إلغاء) (المادة|الماد|الفقرة)", t):
            return "نص نظام جديد — إيجابية كاذبة محتملة"
        if re.search(r"من (قرار مجلس الوزراء|المرسوم الملكي|الأمر الملكي) رقم", t) and "المادة" not in t[:80]:
            return "تعديل قرار أو مرسوم لا مادة نظام"
        if "أينما ورد" in i["text"][:400] and ("الأنظمة" in i["text"][:400]):
            return "إحلال عام في كل الأنظمة"
    return {"missing": "غير منعكس في حكيم", "present": "منعكس على الأرجح", "no_key": "يحتاج مراجعة بالعين (لا نص جديد مقتبس)"}[i["state"]]
for i in items: i["cat"] = category(i)
LAYER = {"manual_queue": "طابور المعالجة اليدوية", "extraction_gap": "لم يُستخرج أصلًا"}
wb = Workbook(); ws = wb.active; ws.title = "ملخص الأدوات"; ws.sheet_view.rightToLeft = True
H = ["الأداة (عنوان الصفحة)", "الرابط", "عمليات مستخرجة", "آثار في الطابور", "بنود غير منعكسة", "بنود تحتاج مراجعة", "بنود منعكسة", "خارج النطاق أو كاذبة", "الأولوية"]
ws.append(H)
by = collections.defaultdict(list)
for i in items: by[i["url"]].append(i)
rows = []
for u, its in by.items():
    c = collections.Counter(i["cat"] for i in its)
    miss = c["غير منعكس في حكيم"]; rev = c["يحتاج مراجعة بالعين (لا نص جديد مقتبس)"]; ok = c["منعكس على الأرجح"]
    out = sum(v for k, v in c.items() if k not in ("غير منعكس في حكيم", "يحتاج مراجعة بالعين (لا نص جديد مقتبس)", "منعكس على الأرجح"))
    pr = "عالية" if miss else ("متوسطة" if rev else "منخفضة")
    rows.append([title(u), u, ops[u], mqn[u], miss, rev, ok, out, pr])
rows.sort(key=lambda r: ({"عالية": 0, "متوسطة": 1, "منخفضة": 2}[r[8]], -r[4], -r[5]))
for r in rows: ws.append(r)
ws2 = wb.create_sheet("البنود"); ws2.sheet_view.rightToLeft = True
ws2.append(["الأداة", "الرابط", "المصدر", "الأثر", "التصنيف", "مفتاح الفحص", "نص البند من صفحة الأداة (مقتطع)"])
for i in sorted(items, key=lambda i: (i["cat"] != "غير منعكس في حكيم", i["url"], i["id"])):
    ws2.append([title(i["url"]), i["url"], LAYER[i["layer"]], i["ref"], i["cat"], i["key"] or "", i["text"][:500]])
ws3 = wb.create_sheet("المنهج"); ws3.sheet_view.rightToLeft = True
for line in [
    "فحص قراءة فقط على الإنتاج بتاريخ 2026-10-18؛ لا كتابة.",
    "الطبقة 1 (لم يُستخرج أصلًا): بنود تعديل في منطوق الأداة لا يقابلها اقتباس عملية ولا بند في طابور المعالجة اليدوية.",
    "الطبقة 2 (طابور المعالجة اليدوية): 176 أثرًا لم تتحول إلى عمليات.",
    "الانعكاس: من النص الجديد المقتبس في البند تؤخذ آخر 40 حرفًا من الحروف والمسافات، ويُبحث عنها في كل نصوص legal_articles وunit_version بعد توحيد التشكيل والمسافات وعلامات التنصيص. بصمة المفاتيح d9980b56… مطابقة بين المحلي والقاعدة.",
    "«منعكس على الأرجح» قد يكون إيجابية كاذبة إذا كانت العبارة موجودة في النص القديم أيضًا؛ «غير منعكس» قد يكون فرقًا إملائيًّا. البنود بلا نص جديد (حذف، إحلال عبارة قصيرة) تحتاج مراجعة بالعين.",
    "تحقق المنهج: بنود الأداة 169 للإحصاء (المحقونة في المرحلة 4) ظهرت «منعكسة».",
]: ws3.append([line])
for w in (ws, ws2):
    for c in w[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F4E78")
    for row in w.iter_rows(min_row=2):
        for c in row: c.alignment = Alignment(wrap_text=True, vertical="top")
ws.column_dimensions["A"].width = 60; ws.column_dimensions["B"].width = 45
ws2.column_dimensions["A"].width = 40; ws2.column_dimensions["E"].width = 28; ws2.column_dimensions["G"].width = 90
wb.save(XL)
c = collections.Counter(i["cat"] for i in items)
print(XL); print(dict(c)); print("instruments", len(rows), collections.Counter(r[8] for r in rows))
for r in rows[:25]: print(r[8], r[4], r[5], r[2], r[3], r[0][:70], r[1].split("/")[-1])
