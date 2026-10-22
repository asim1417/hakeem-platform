"""إعادة مطابقة الهوية من الملفات المحللة (بلا قاعدة محلية)، واقتراح قرار لغير المحسوم. قراءة فقط.

  python3 scripts/identity_rematch.py <prod_systems.json>

المدخل: لقطة قراءة من الإنتاج لأنظمة حكيم (id، name، prd، art_decree، n، wstatus).
المخرج: data/identity-2026-10-16/identity.jsonl و unresolved.jsonl، و reports/الهوية_غير_المحسومة.xlsx

الدرجات كما في identity_match.py: 1 اسم + أداة كاملة (رقم وتاريخ)، 2 تاريخ، 3 رقم، 4 اسم فقط،
5 أكثر من مرشح، 9 سنة في الاسم تخالف، None لا مرشح. المحسوم = الدرجة 1 فقط.
"""
import collections
import difflib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from identity_match import instruments, norm_name, year_in_name  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
PARSED = ROOT / "data" / "parsed"
OUT = ROOT / "data" / "identity-2026-10-16"
XLSX = ROOT / "reports" / "الهوية_غير_المحسومة.xlsx"


def jl(p):
    with open(p, encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


def suggest(o):
    g, c = o["grade"], o["candidates"]
    units, art = o["boe_units"], o["hakeem_articles"]
    close = art is not None and units and abs(art - units) <= max(2, round(units * 0.05))
    if g is None:
        return "غير موجود في حكيم", "لا نظام في حكيم بهذا الاسم ولا بقريب منه: مرشح للإدراج من الهيئة"
    if g == 9:
        return "ليس الزوج نفسه", "السنة في اسم الهيئة تخالف السنة في اسم حكيم: نسختان مختلفتان"
    if g in (2, 3):
        why = "تاريخ الأداة متطابق" if g == 2 else "رقم الأداة متطابق"
        return ("اعتمد الزوج" if close else "اعتمد الزوج بعد مراجعة العدد"), f"{why}؛ المواد: الهيئة {units} / حكيم {art}"
    if g == 4:
        if not o["hakeem_instruments"]:
            return ("اعتمد الزوج" if close else "راجع"), f"الاسم متطابق وحكيم بلا أداة مسجلة؛ المواد: الهيئة {units} / حكيم {art}"
        return "راجع", "الاسم متطابق والأداتان مختلفتان: قد تكون نسخة أخرى"
    if g == 5:
        same = [x for x in c if x.get("n") == units]
        if len(same) == 1:
            o["suggested_id"] = same[0]["id"]
            return "اعتمد المرشح المطابق في العدد", f"{same[0]['name']} ({same[0]['id']}) عدد مواده = {units}"
        return "اختر من المرشحين", o.get("conflict") or "أكثر من مرشح بالدرجة نفسها"
    return "محسوم", ""


def main():
    prod = json.load(open(sys.argv[1], encoding="utf-8"))
    units = collections.Counter(u["law_id"] for u in jl(PARSED / "unit.jsonl"))
    laws = {}
    for law in jl(PARSED / "law.jsonl"):
        laws.setdefault(law["guid"], law)  # آخر تحليل واحد لكل guid
    H = collections.defaultdict(list)
    for p in prod:
        p["key"] = norm_name(p["name"])
        p["ins"] = instruments((p["prd"] or "") + " " + (p["art_decree"] or ""))
        H[p["key"]].append(p)
    keys = list(H)
    out = []
    for guid, law in laws.items():
        name = law["name"]
        bi = set()
        for i in law.get("instruments") or []:
            bi |= instruments(i.get("text", "") if isinstance(i, dict) else str(i))
        k = norm_name(name)
        cands, basis = list(H.get(k, [])), "exact_name"
        if not cands:
            close = difflib.get_close_matches(k, keys, n=3, cutoff=0.85)
            cands = [p for c in close for p in H[c]]
            basis = "fuzzy_name" if cands else "none"
        scored = []
        for p in cands:
            nos = {(a, b) for a, b, _ in bi} & {(a, b) for a, b, _ in p["ins"]}
            dates = {c for *_, c in bi if c} & {c for *_, c in p["ins"] if c}
            full = {(a, b, c) for a, b, c in bi if c} & p["ins"]
            g = 1 if full else 2 if dates else 3 if nos else 4
            yb, yh = year_in_name(name), year_in_name(p["name"])
            if yb and yh and yb != yh:
                g = 9
            scored.append((g, p))
        scored.sort(key=lambda t: t[0])
        best = [s for s in scored if s[0] == scored[0][0]] if scored else []
        if len(best) > 1 and year_in_name(name):
            same = [s for s in best if year_in_name(s[1]["name"]) == year_in_name(name)]
            best = same if len(same) == 1 else best
        if len(best) > 1 and not year_in_name(name):
            noyear = [s for s in best if not year_in_name(s[1]["name"])]
            best = noyear if len(noyear) == 1 else best
        if not scored:
            grade, pick = None, None
        elif len(best) > 1:
            grade, pick = 5, None
        else:
            grade, pick = best[0]
        out.append({
            "law_guid": guid, "boe_name": name, "boe_status": law["status_at_source"], "boe_units": units[law["id"]],
            "boe_url": law["url"], "boe_issued_hijri": law.get("issued_hijri"), "boe_instruments": sorted(map(list, bi)),
            "name_basis": basis, "grade": grade,
            "system_id": pick["id"] if pick else None, "hakeem_name": pick["name"] if pick else None,
            "hakeem_articles": int(pick["n"]) if pick else None, "hakeem_status": pick["wstatus"] if pick else None,
            "hakeem_instruments": sorted(map(list, pick["ins"])) if pick else None,
            "candidates": [{"id": p["id"], "name": p["name"], "grade": g, "n": int(p["n"])} for g, p in scored[:4]],
        })
    used = collections.Counter(o["system_id"] for o in out if o["system_id"])
    for o in out:
        if o["system_id"] and used[o["system_id"]] > 1:
            o["grade"], o["conflict"] = 5, "نظام حكيم نفسه مرشح لأكثر من نسخة"
    for o in out:
        o["suggested_id"] = o["system_id"]
        o["suggestion"], o["why"] = suggest(o) if o["grade"] != 1 else ("محسوم", "")
        if o["suggestion"] in ("غير موجود في حكيم", "ليس الزوج نفسه", "اختر من المرشحين"):
            o["suggested_id"] = None
    # نظام حكيم واحد لا يُقترح لنسختين (ولا لنسخة محسومة أصلًا)
    taken = collections.Counter(o["suggested_id"] for o in out if o["suggested_id"])
    for o in out:
        if o["grade"] != 1 and o["suggested_id"] and taken[o["suggested_id"]] > 1:
            o["suggestion"], o["why"], o["suggested_id"] = "اختر من المرشحين", "المرشح نفسه مقترح لنسخة أخرى أو محسوم لها", None
    OUT.mkdir(parents=True, exist_ok=True)
    unresolved = [o for o in out if o["grade"] != 1]
    for name, rows in (("identity", out), ("unresolved", unresolved)):
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    write_xlsx(unresolved)
    print(json.dumps({"أنظمة الهيئة": len(out), "الدرجات": dict(collections.Counter(str(o["grade"]) for o in out)),
                      "غير محسوم": len(unresolved),
                      "الاقتراحات": dict(collections.Counter(o["suggestion"] for o in unresolved))}, ensure_ascii=False, indent=1))


def write_xlsx(rows):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "الهوية"
    ws.sheet_view.rightToLeft = True
    head = ["نظام الهيئة", "حالة الهيئة", "مواد الهيئة", "أدوات الهيئة", "الدرجة", "أساس الاسم", "نظام حكيم المقترح",
            "معرف حكيم", "مواد حكيم", "أدوات حكيم", "المرشحون", "الاقتراح", "المعرف المقترح", "السبب", "رابط الهيئة", "قرار المالك", "معرف يحدده المالك"]
    ws.append(head)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F3A5F")
    yellow = PatternFill("solid", fgColor="FFF2CC")
    fmt = lambda ins: "؛ ".join(f"{'مرسوم/أمر' if k == 'royal' else 'قرار م.و'} {n} {d or ''}" for k, n, d in (ins or []))
    for o in sorted(rows, key=lambda o: (str(o["suggestion"]), o["boe_name"])):
        ws.append([o["boe_name"], o["boe_status"], o["boe_units"], fmt(o["boe_instruments"]), o["grade"], o["name_basis"],
                   o["hakeem_name"], o["system_id"], o["hakeem_articles"], fmt(o["hakeem_instruments"]),
                   "\n".join(f"{c['name']} ({c['id']}) د{c['grade']} م{c['n']}" for c in o["candidates"]),
                   o["suggestion"], o.get("suggested_id"), o["why"], o["boe_url"], "", ""])
        ws.cell(ws.max_row, 16).fill = yellow
        ws.cell(ws.max_row, 17).fill = yellow
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 26
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions
    XLSX.parent.mkdir(parents=True, exist_ok=True)
    wb.save(XLSX)


if __name__ == "__main__":
    main()
