"""المرحلة 1 من خطة الإكمال: صفوف حقن الجاهز من المؤجلات. لا يكتب على أي قاعدة.

  python3 scripts/build_phase1.py <prod_articles.json> <prod_repeal_articles.json>

المدخلات (لقطات قراءة من الإنتاج): id، s (legalSystemId)، n (articleNumber)، content لكل مادة مستهدفة.
المخرج: data/phase1-2026-10-16/{unit_versions,unit_status,work_status,excluded}.jsonl و sql/*.sql و summary.json

القواعد:
- نظام العمل: مواده حتى 228 تُحقن بمطابقة النص (ثبت تطابق الترقيم فيها)، وباب العقوبات (229+) ينتظر المالك.
- المادة تُحقن فقط إن طابق نصها في حكيم نص الهيئة الأصلي (بعد حذف عنوان المادة والمسافات والترقيم)،
  وإلا تُستبعد بسببها. الحارس نفسه داخل SQL: لا يُدرج الصف إلا إن بقي md5(content) كما في اللقطة.
- نسخة لكل خطوة تركيب بتاريخ أداتها؛ والخطوة التي في ملاحظتها عبارة نفاذ صريحة تسري من تاريخ النفاذ.
- حالة النظام: للأنظمة المقترح اعتمادها في ملف الهوية، وليس لها صف تحقق للعمل. «لاغي» ← «ملغى».
- الإلغاء: مادة ملغاة كلها بملاحظة محسومة، ونصها في حكيم يطابق نص الهيئة.
"""
import collections
import hashlib
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from compose_partial import RESOLVED, norm  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "data" / "compose-2026-10-16"
IDENT = ROOT / "data" / "identity-2026-10-16"
OUT = ROOT / "data" / "phase1-2026-10-16"
RUN = "boe-phase1-2026-10-16"
LABOR = "cmpz5r8eo00becwg21qt63wx7"
EFF = "تاريخ النفاذ غير تاريخ الإصدار (ينتظر تحديد تاريخ النفاذ)"
KIND = {"royal_decree": "مرسوم ملكي", "cabinet_decision": "قرار مجلس الوزراء", "royal_order": "أمر ملكي"}
GLOBAL_GUARD = """DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;"""


def jl(p):
    with open(p, encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


def sid(*parts):
    return "boe26-" + hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:24]


def md5(s):
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def core(t):
    """نص للمقارنة فقط: بلا عنوان المادة ولا مسافات ولا ترقيم."""
    t = re.sub(r"^\s*المادة\s+[^\n:]{1,80}:\s*", "", t or "")
    return re.sub(r"[^ء-ي0-9]", "", norm(t))


INSTR_IN_NOTE = re.compile(r"(?:ال)?(مرسوم الملكي|المرسوم الملكي|مرسوم ملكي|الأمر الملكي|أمر ملكي|قرار مجلس الوزراء)\s*(?:رقم\s*)?\(?\s*((?:م\s*/\s*)?\d+)\s*\)?\s*(?:و|ب)تاريخ\s*([\d/ ]+)\s*هـ")


def instr_from_note(text):
    m = INSTR_IN_NOTE.search(text or "")
    if not m:
        return None
    kind = "مرسوم ملكي" if "مرسوم" in m[1] else "أمر ملكي" if "أمر" in m[1] else "قرار مجلس الوزراء"
    no, date = re.sub(r"\s", "", m[2]), re.sub(r"\s", "", m[3])
    return f"{kind} رقم {no} وتاريخ {date}هـ"


def instr(step):
    if not step.get("instrument_no") or not step.get("instrument_hijri"):
        found = instr_from_note(step.get("note_text"))
        if found:
            return found
    k = KIND.get(step.get("instrument") or "", step.get("instrument") or "")
    return f"{k} رقم {step.get('instrument_no') or '?'} وتاريخ {step.get('instrument_hijri')}هـ".strip()


def fmt_boe(ins):
    """أول أداة إصدار من بطاقة الهيئة: [نوع، رقم، تاريخ YYYY-MM-DD]."""
    if not ins:
        return None
    kind, no, date = ins[0]
    k = "مرسوم ملكي" if kind == "royal" else "قرار مجلس الوزراء"
    if date:
        y, m, d = date.split("-")
        return f"{k} رقم {no} وتاريخ {int(y)}/{int(m)}/{int(d)}هـ"
    return f"{k} رقم {no}"


def q(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def main():
    prod = {(r["s"], int(r["n"])): r for p in sys.argv[1:] for r in json.load(open(p, encoding="utf-8"))}
    cands = jl(COMPOSE / "candidates.jsonl")
    eff = {(r["system_id"], r["article"]): r for r in jl(COMPOSE / "effective_dates.jsonl")}
    versions, status, excluded = [], [], []

    for r in cands:
        key = (r["system_id"], r["article"])
        gates = set(r.get("gates") or [])
        e = eff.get(key)
        if r["compose_status"] == "auto":
            ok_gates = not gates or (gates == {EFF} and e and e["basis"] == "explicit")
        elif r["compose_status"] == "repeal":
            ok_gates = gates <= {"تاريخ أداة غير مقروء"} and all(n["confidence"] in RESOLVED for n in r["notes"])
        else:
            continue
        if not ok_gates:
            continue
        why = None
        a = prod.get(key)
        # نظام العمل: ترقيمه مزاح في باب العقوبات (229 فما بعد)؛ مطابقة النص أدناه تحرس هوية كل مادة،
        # وتُستبعد ما بعد 228 صراحةً حتى قرار المالك في جدول الإزاحة.
        if r["system_id"] == LABOR and r["article"] > 228:
            why = "نظام العمل: باب العقوبات مزاح الترقيم — ينتظر قرار المالك"
        elif not a:
            why = "المادة غير موجودة في لقطة حكيم"
        elif core(a["content"]) != core(r["base_body"]):
            why = "نص حكيم لا يطابق نص الهيئة الأصلي"
        if why:
            excluded.append({"law": r["law"], "article": r["article"], "status": r["compose_status"], "reason": why})
            continue
        # البصمة من الاستعلام نفسه إن وُجدت (أدق من إعادة حسابها من نص منقول)
        guard = a.get("md5") or md5(a["content"])
        if r["compose_status"] == "repeal":
            n = r["notes"][-1]
            status.append({"id": sid("unit", a["id"], "ملغاة", n["id"]), "object_type": "unit", "object_id": a["id"],
                           "verified_status": "ملغاة", "evidence_instrument": instr_from_note(n["text"]),
                           "evidence_url": r["boe_url"], "evidence_quote": (n["text"] or "")[:500], "method": "rule",
                           "verified_by": RUN, "_guard_md5": guard, "_law": r["law"], "_article": r["article"]})
            continue
        dates = set()
        for st in r["steps"]:
            d, basis = st["date_g"], "issue"
            if e and e["basis"] == "explicit" and st["note_id"] == e["note_id"]:
                d, basis = e["valid_from"], "explicit"
            if not d or d in dates:
                excluded.append({"law": r["law"], "article": r["article"], "status": "auto", "reason": "تاريخ خطوة مكرر أو ناقص"})
                break
            dates.add(d)
            versions.append({"id": sid("uv", a["id"], d, st["note_id"]), "unit_id": a["id"], "body": st["body"],
                             "valid_from": d, "valid_from_basis": basis, "evidence_instrument": instr(st),
                             "evidence_url": r["boe_url"], "evidence_quote": (st["note_text"] or "")[:500],
                             "_guard_md5": guard, "_law": r["law"], "_article": r["article"]})

    work = []
    for o in jl(IDENT / "unresolved.jsonl"):
        if o["suggestion"] not in ("اعتمد الزوج", "اعتمد المرشح المطابق في العدد") or not o.get("suggested_id"):
            continue
        target = {"لاغي": "ملغى", "ساري": "ساري"}.get(o["boe_status"])
        if not target:
            excluded.append({"law": o["boe_name"], "article": None, "status": "work", "reason": f"حالة الهيئة «{o['boe_status']}» لا تقابل حالة"})
            continue
        work.append({"id": sid("work", o["suggested_id"], target, RUN), "object_type": "work", "object_id": o["suggested_id"],
                     "verified_status": target, "evidence_instrument": fmt_boe(o["boe_instruments"]), "evidence_url": o["boe_url"],
                     "evidence_quote": f"حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: {o['boe_status']} (رُصدت 28/9/2026)",
                     "method": "rule", "verified_by": RUN, "_law": o["boe_name"]})

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "sql").mkdir(exist_ok=True)
    for name, rows in (("unit_versions", versions), ("unit_status", status), ("work_status", work), ("excluded", excluded)):
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    def sql_file(name, rows, insert):
        body = [f"-- {name}: {len(rows)} صفًا — إضافة فقط، كل صف بحارسه", "BEGIN;", GLOBAL_GUARD]
        body += [insert(r) for r in rows]
        body.append(f"""DO $c$ DECLARE k int; BEGIN
  SELECT count(*) INTO k FROM {'unit_version' if name == 'unit_versions' else 'verification'} WHERE id = ANY(ARRAY[{','.join(q(r['id']) for r in rows) or "''"}]);
  IF k <> {len(rows)} THEN RAISE EXCEPTION '{name}: inserted % of {len(rows)}', k; END IF; END $c$;""")
        body.append("COMMIT;")
        (OUT / "sql" / f"{name}.sql").write_text("\n".join(body) + "\n", encoding="utf-8")

    # بصمة الصف: md5 لقيمه كما كُتبت في SQL؛ أي تحريف في النقل يُسقط الصف فيفشل تأكيد العدد وتُلغى الدفعة.
    def row_md5(*vals):
        return md5("\x1f".join("" if v is None else str(v) for v in vals))

    sql_file("unit_versions", versions, lambda r: (
        "INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)\n"
        f"SELECT * FROM (SELECT {q(r['id'])} id,{q(r['unit_id'])} unit_id,{q(r['body'])} body,{q(r['valid_from'])}::timestamptz valid_from,"
        f"{q(r['evidence_instrument'])} ei,{q(r['evidence_url'])} eu,{q(r['evidence_quote'])} eq) v\n"
        f"WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = "
        f"{q(row_md5(r['id'], r['unit_id'], r['body'], r['valid_from'], r['evidence_instrument'] or '', r['evidence_url'] or '', r['evidence_quote'] or ''))}\n"
        f"  AND (SELECT md5(content) FROM legal_articles WHERE id={q(r['unit_id'])}) = {q(r['_guard_md5'])}\n"
        f"  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id={q(r['unit_id'])} AND valid_from={q(r['valid_from'])}::timestamptz);"))
    ver_insert = lambda r: (  # noqa: E731
        "INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)\n"
        f"SELECT * FROM (SELECT {q(r['id'])} id,{q(r['object_type'])} ot,{q(r['object_id'])} oi,{q(r['verified_status'])} vs,{q(r['evidence_instrument'])} ei,"
        f"{q(r['evidence_url'])} eu,{q(r['evidence_quote'])} eq,{q(r['method'])} me,{q(r['verified_by'])} vb) v\n"
        f"WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = "
        f"{q(row_md5(r['id'], r['object_type'], r['object_id'], r['verified_status'], r['evidence_instrument'] or '', r['evidence_url'] or '', r['evidence_quote'] or '', r['method'], r['verified_by']))}\n"
        + (f"  AND (SELECT md5(content) FROM legal_articles WHERE id={q(r['object_id'])}) = {q(r['_guard_md5'])};"
           if r["object_type"] == "unit" else
           f"  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id={q(r['object_id'])});"))
    sql_file("unit_status", status, ver_insert)
    sql_file("work_status", work, ver_insert)

    summary = {"نسخ مواد": len(versions), "مواد بنسخ": len({r["unit_id"] for r in versions}),
               "إلغاء مواد": len(status), "حالة نظام": dict(collections.Counter(r["verified_status"] for r in work)),
               "مستبعد": dict(collections.Counter(x["reason"] for x in excluded)),
               "بصمات": {n: hashlib.md5("\n".join(sorted(json.dumps({k: v for k, v in r.items() if not k.startswith("_")}, ensure_ascii=False, sort_keys=True) for r in rows)).encode()).hexdigest()
                         for n, rows in (("unit_versions", versions), ("unit_status", status), ("work_status", work))}}
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
