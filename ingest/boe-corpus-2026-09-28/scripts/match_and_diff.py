"""يربط أنظمة الهيئة بأنظمة حكيم ويقارن المواد، ويكتب boe.match وboe.diff (إضافة فقط) وملف Excel للمالك.

قراءة فقط من جداول حكيم. الكتابة في boe.* فقط.
الربط الآلي: المساواة بعد التطبيع (normalize_system_name) مع مرشح واحد، أو فكّ التعدد برقم أداة الإصدار.
ما سوى ذلك يذهب لورقة قرار المالك ولا يُربط.
  python3 scripts/match_and_diff.py --target staging|branch|production [--preview] --xlsx out.xlsx
"""
import argparse
import json
import pathlib
import re

from common import require_approval, connect, guards, normalize_arabic_text, normalize_system_name, sid, stats, totals, ws

ROOT = pathlib.Path(__file__).resolve().parents[1]
BY = "auto:boe-match-2026-09-28"


def decree_tokens(texts: list[str]) -> set[str]:
    out = set()
    for t in texts:
        for m in re.finditer(r"م\s*/\s*(\d+)", t or ""):
            out.add("م/" + m.group(1))
    return out


def title_keys(title: str) -> set[str]:
    """مفاتيح العنوان لربط عمليات أم القرى: الجوهر المطبَّع، ومع حذف ما بين القوسين، وما بين القوسين وحده."""
    t = title or ""
    keys = {normalize_system_name(t), normalize_system_name(re.sub(r"\([^)]*\)", " ", t))}
    for inner in re.findall(r"\(([^)]*)\)", t):
        keys.add(normalize_system_name(inner))
    return {k for k in keys if len(k) >= 3}


def norm_no(x) -> str:
    """رقم الأداة للمقارنة: «م / 134» = «م/134»، و«(57)» = «57»."""
    return re.sub(r"[\s()\[\]]", "", str(x or "")).replace("م/", "م")


SAME = {"identical", "whitespace_only", "normalization_only"}
HEAD = re.compile(r"^\(?\s*(?:المادة|مادة)\s+[^\s:]+(?:\s+(?:و|بعد)\S*)*(?:\s+\S+)?\s*[:：\-–]?\s*")


def head_window(text: str, size: int = 40) -> str:
    """مطلع النص مطبَّعًا بلا رأس «المادة …» — يُبحث عنه في مادة أخرى."""
    return normalize_arabic_text(ws(HEAD.sub("", ws(text), count=1)))[:size]


def reclassify(recs: list[dict], hk: dict) -> None:
    """بعد مقارنة مواد النظام بالرقم:
    - shifted: نص الهيئة موجود في حكيم تحت رقم مجاور (±1..3) — انزياح ترقيم لا اختلاف لفظ.
    - version_mismatch: أغلب المواد مختلفة بلا انزياح — حكيم يحمل نسخة أخرى من النظام (إصدار أقدم أو أحدث).
    """
    for r in recs:
        if r["verdict"] not in ("wording", "missing_in_hakeem") or r["num"] is None or r["bis"]:
            continue
        w = head_window(r["body"])
        if len(w) < 20:
            continue
        for d in (1, -1, 2, -2, 3, -3):
            other = hk.get(r["num"] + d)
            if other and w in normalize_arabic_text(ws(other[1]))[:400 + len(w)]:
                r["verdict"], r["detail"] = "shifted", f"نص الهيئة في حكيم برقم {r['num'] + d}"
                break
    compared = [r for r in recs if r["verdict"] in SAME | {"wording", "shifted"}]
    same = sum(r["verdict"] in SAME for r in compared)
    shifted = sum(r["verdict"] == "shifted" for r in compared)
    if len(compared) >= 5 and same < 0.3 * len(compared) and shifted < 0.5 * len(compared):
        for r in compared:
            if r["verdict"] == "wording":
                r["verdict"] = "version_mismatch"
                r["detail"] = f"{same}/{len(compared)} مادة فقط تطابق — نسخة أخرى من النظام؛ {r['detail'] or ''}".strip("؛ ")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["staging", "branch", "production"], required=True)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--xlsx", default=str(ROOT / "reports" / "مطابقة_هيئة_الخبراء_بحكيم.xlsx"))
    a = ap.parse_args()
    con = connect(a.target)
    rep = {"matched": 0, "ambiguous": 0, "no_candidate": 0, "diff": {}}
    rows_amb, rows_missing, rows_wording, rows_status, rows_notes = [], [], [], [], []
    rows_uqn_only = []
    with con.cursor() as cur:
        before = stats(cur)
        g0 = guards(cur, a.target == "production")
        t0 = totals(cur)
        cur.execute("SELECT id, name FROM legal_systems")
        systems = cur.fetchall()
        by_norm: dict[str, list[tuple[str, str]]] = {}
        for sid_, name in systems:
            by_norm.setdefault(normalize_system_name(name), []).append((sid_, name))
        mixed_ids, edition_ids = set(), set()
        cur.execute("SELECT to_regclass('work_edition') IS NOT NULL")
        if cur.fetchone()[0]:
            cur.execute("SELECT mixed_system_id, edition_system_id FROM work_edition")
            for mx, ed in cur.fetchall():
                mixed_ids.add(mx)
                edition_ids.add(ed)
        cur.execute("SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification WHERE object_type='work' ORDER BY object_id, verified_at DESC, id DESC")
        verified = dict(cur.fetchall())
        # عمليات أم القرى (إن وُجدت منطقة uqn_fix) للاتحاد: قراءة فقط
        uqn: dict[str, list] = {}
        cur.execute("SELECT to_regclass('uqn_fix.amendment_op') IS NOT NULL")
        if cur.fetchone()[0]:
            cur.execute("SELECT op_id, target_law_title, article_number, op_type, instrument_no, instrument_date_hijri, source_url FROM uqn_fix.amendment_op")
            for r in cur.fetchall():
                for k in title_keys(r[1]):
                    uqn.setdefault(k, []).append(r)
        cur.execute("SELECT id, guid, name, instruments, status_at_source, url, category_path FROM boe.current_law")
        laws = cur.fetchall()
        for law_id, guid, name, instruments, status_src, url, cat in laws:
            key = normalize_system_name(name or "")
            # السجل المخلوط لا يُربط أبدًا: يُستبعد إن وُجدت إصدارات، ثم يُفك التعدد برقم المرسوم.
            cands = [c for c in by_norm.get(key, []) if c[0] not in mixed_ids]
            chosen, method = None, None
            toks = decree_tokens([i.get("text", "") for i in (instruments or [])])
            if len(cands) > 1 and toks:
                narrowed = [c for c in cands if any(t.replace(" ", "") in c[1].replace(" ", "") for t in toks)]
                if len(narrowed) == 1:
                    chosen, method = narrowed[0], "normalized_name"
            if not chosen:
                exact = [c for c in cands if c[1] == name]
                if len(cands) == 1:
                    chosen, method = cands[0], ("exact_name" if cands[0][1] == name else "normalized_name")
                elif len(exact) == 1 and not any(c[0] in edition_ids for c in cands):
                    chosen, method = exact[0], "exact_name"
            if not chosen:
                if cands:
                    rep["ambiguous"] += 1
                    rows_amb.append([name, url, " | ".join(f"{c[1]} ({c[0]})" for c in cands), "", ""])
                else:
                    rep["no_candidate"] += 1
                    rows_missing.append([name, " › ".join(cat or []), status_src, url, "", ""])
                continue
            rep["matched"] += 1
            mid = sid("boe26-", "match", guid, chosen[0], method)
            cur.execute(
                """INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by)
                   SELECT %s,%s,%s,%s,%s::jsonb,%s WHERE NOT EXISTS (SELECT 1 FROM boe.match WHERE id=%s)""",
                (mid, guid, chosen[0], method, json.dumps([c[0] for c in cands]), BY, mid),
            )
            # الحالة: المصدر مقابل آخر تحقق في حكيم — الاختلاف فقط
            v = verified.get(chosen[0])
            src_map = {"ساري": "ساري", "لاغي": "ملغى"}
            if (src_map.get(status_src or "") or status_src) != v:
                rows_status.append([chosen[1], status_src, v or "بلا تحقق", url, "", "", ""])
            # المواد
            cur.execute("SELECT seq, heading, article_number, is_bis, body, css_class FROM boe.unit WHERE law_id=%s ORDER BY seq", (law_id,))
            units = cur.fetchall()
            cur.execute(
                """SELECT id, "articleNumber", content FROM legal_articles
                   WHERE "legalSystemId"=%s OR ("legalSystemId" IS NULL AND "lawName"=%s)""",
                (chosen[0], chosen[1]),
            )
            hk = {}
            for aid, num, content in cur.fetchall():
                hk.setdefault(num, (aid, content))
            cur.execute("SELECT unit_seq, effect, new_text, note_text, instrument_kind, instrument_no, instrument_date_hijri, needs_review FROM boe.amendment_note WHERE law_id=%s", (law_id,))
            notes: dict[int, list] = {}
            for r in cur.fetchall():
                notes.setdefault(r[0], []).append(r)
            seen_nums = set()
            law_ops = list({op[0]: op for k in (title_keys(chosen[1]) | title_keys(name or "")) for op in uqn.get(k, [])}.values())
            boe_instr = {(norm_no(x[5]), x[0]) for lst in notes.values() for x in lst if x[5]}
            for op in law_ops:
                if not any(norm_no(op[4]) == b[0] and (op[2] is None or op[2] == next((u[2] for u in units if u[0] == b[1]), op[2])) for b in boe_instr):
                    rows_uqn_only.append([chosen[1], op[2], op[3], op[4], op[5], op[6], op[0], ""])
            recs = []
            for seq, heading, num, bis, body, cls in units:
                has_notes = seq in notes
                for nt in notes.get(seq, []):
                    in_uqn = [op[0] for op in law_ops if norm_no(op[4]) == norm_no(nt[5]) and (op[2] is None or op[2] == num)]
                    rows_notes.append([chosen[1], heading, nt[1], f"{nt[4] or ''} {nt[5] or ''} {nt[6] or ''}".strip(), "نعم" if nt[7] else "",
                                       "، ".join(in_uqn) if in_uqn else "لا", nt[3][:1500], (nt[2] or "")[:1500], "", ""])
                if num is None:
                    verdict, detail, aid = "unnumbered_unit", "وحدة بلا رقم مادة (باب أو فصل أو جدول أو بند) — مراجعة", None
                elif bis:
                    verdict, detail, aid = "missing_in_hakeem", "مادة مكرر — مكانها legal_article_bis", None
                elif num not in hk:
                    verdict, detail, aid = "missing_in_hakeem", None, None
                else:
                    seen_nums.add(num)
                    aid, content = hk[num]
                    detail = None
                    if content.strip() == body.strip():
                        verdict, detail = "identical", None
                    elif ws(content) == ws(body):
                        verdict, detail = "whitespace_only", None
                    elif normalize_arabic_text(content) == normalize_arabic_text(body):
                        verdict, detail = "normalization_only", None
                    else:
                        verdict = "wording"
                        amended = [x[2] for x in notes.get(seq, []) if x[2]]
                        if any(ws(t) == ws(content) for t in amended):
                            detail = "نص حكيم = النص المعدل في ملاحظة الهيئة"
                        else:
                            x, y = ws(content), ws(body)
                            i = next((k for k in range(min(len(x), len(y))) if x[k] != y[k]), min(len(x), len(y)))
                            detail = f"أول فرق عند الحرف {i}: حكيم «{x[max(0, i - 15):i + 25]}» / الهيئة «{y[max(0, i - 15):i + 25]}»"
                recs.append(dict(seq=seq, heading=heading, num=num, bis=bis, body=body, cls=cls, has_notes=has_notes, aid=aid, verdict=verdict, detail=detail))
            reclassify(recs, hk)
            for r in recs:
                verdict, num = r["verdict"], r["num"]
                if verdict in ("wording", "shifted", "version_mismatch"):
                    content = hk[num][1] if num in hk else ""
                    rows_wording.append([chosen[1], r["heading"], num, r["cls"], "نعم" if r["has_notes"] else "", f"{verdict}: {r['detail'] or ''}", content[:3000], r["body"][:3000], ""])
                rep["diff"][verdict] = rep["diff"].get(verdict, 0) + 1
                did = sid("boe26-", "diff", law_id, str(r["seq"]), chosen[0])
                cur.execute(
                    """INSERT INTO boe.diff (id, law_id, hakeem_system_id, article_number, is_bis, hakeem_article_id, verdict, boe_has_notes, detail)
                       SELECT %s,%s,%s,%s,%s,%s,%s,%s,%s WHERE NOT EXISTS (SELECT 1 FROM boe.diff WHERE id=%s)""",
                    (did, law_id, chosen[0], num if num is not None else -r["seq"], r["bis"], r["aid"], verdict, r["has_notes"], r["detail"], did),
                )
            for num, (aid, _) in hk.items():
                if num not in seen_nums and num > 0 and not any(u[2] == num for u in units):
                    rep["diff"]["missing_in_boe"] = rep["diff"].get("missing_in_boe", 0) + 1
                    did = sid("boe26-", "diff-hk", law_id, str(num), chosen[0])
                    cur.execute(
                        """INSERT INTO boe.diff (id, law_id, hakeem_system_id, article_number, is_bis, hakeem_article_id, verdict, boe_has_notes, detail)
                           SELECT %s,%s,%s,%s,false,%s,'missing_in_boe',false,NULL WHERE NOT EXISTS (SELECT 1 FROM boe.diff WHERE id=%s)""",
                        (did, law_id, chosen[0], num, aid, did),
                    )
        g1 = guards(cur, a.target == "production")
        t1 = totals(cur)
        if g0 != g1 or t0 != t1:
            con.rollback()
            raise SystemExit("تغيّر حارس أو عدد — أُلغيت")
        cur.execute("SELECT count(*) FROM legal_systems")
        rep["hakeem_systems"] = cur.fetchone()[0]
        cur.execute("SELECT (SELECT count(*) FROM boe.match WHERE decided_by=%s)+(SELECT count(*) FROM boe.diff)", (BY,))
        try:
            require_approval(a.target, cur.fetchone()[0], a.preview)
        except SystemExit:
            con.rollback()
            raise
        if a.preview:
            con.rollback()
        else:
            con.commit()
    with con.cursor() as cur:
        after = stats(cur)
    con.close()
    rep["stat_delta"] = {k: (after[k][0] - before[k][0], after[k][1] - before[k][1]) for k in before if k in after}
    rep["uqn_only"] = len(rows_uqn_only)
    write_xlsx(pathlib.Path(a.xlsx), rep, rows_amb, rows_missing, rows_wording, rows_status, rows_notes, rows_uqn_only)
    print(json.dumps(rep, ensure_ascii=False))


def write_xlsx(path, rep, amb, missing, wording, status, notes, uqn_only) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    path.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    yellow = PatternFill("solid", fgColor="FFF2CC")
    head = Font(name="Arial", bold=True)
    body = Font(name="Arial")

    def sheet(title, headers, rows, owner_cols):
        ws_ = wb.create_sheet(title)
        ws_.sheet_view.rightToLeft = True
        ws_.append(headers)
        for c in ws_[1]:
            c.font = head
        for r in rows:
            ws_.append(r)
        for col_idx, h in enumerate(headers, start=1):
            letter = ws_.cell(row=1, column=col_idx).column_letter
            ws_.column_dimensions[letter].width = 60 if h.startswith("نص") or h in ("الفرق", "الملاحظة") else 28
            if h in owner_cols:
                for row in ws_.iter_rows(min_row=1, min_col=col_idx, max_col=col_idx):
                    for c in row:
                        c.fill = yellow
        for row in ws_.iter_rows(min_row=2):
            for c in row:
                c.font = body
                c.alignment = Alignment(wrap_text=True, vertical="top")
        ws_.freeze_panes = "A2"

    summary = wb.active
    summary.title = "ملخص"
    summary.sheet_view.rightToLeft = True
    lines = [
        ["البند", "العدد"],
        ["أنظمة حكيم", rep.get("hakeem_systems")],
        ["أنظمة الهيئة المربوطة آليًا", rep["matched"]],
        ["ربط ملتبس (قرار المالك)", rep["ambiguous"]],
        ["في الهيئة وليست في حكيم", rep["no_candidate"]],
    ] + [[f"مواد: {k}", v] for k, v in sorted(rep["diff"].items())] + [
        ["", ""],
        ["الأعمدة الصفراء يعبّئها المالك. الصف الفارغ لا يُحقن.", ""],
        ["لا يُعدَّل نص مادة قائمة في حكيم. المعتمد يُضاف نسخة جديدة.", ""],
    ]
    for r in lines:
        summary.append(r)
    for c in summary[1]:
        c.font = head
    summary.column_dimensions["A"].width = 60
    summary.column_dimensions["B"].width = 14
    sheet("ربط ملتبس", ["اسم الهيئة", "رابط الهيئة", "مرشحو حكيم", "قرارك: معرّف حكيم", "ملاحظتك"], amb, {"قرارك: معرّف حكيم", "ملاحظتك"})
    sheet("ناقص في حكيم", ["اسم الهيئة", "التصنيف", "الحالة في الهيئة", "رابط الهيئة", "قرارك: يُضاف؟", "ملاحظتك"], missing, {"قرارك: يُضاف؟", "ملاحظتك"})
    sheet("مواد مختلفة لفظًا", ["نظام حكيم", "المادة", "رقم", "صنف الهيئة", "عليها ملاحظة", "الفرق", "نص حكيم", "نص الهيئة (الأصل)", "قرارك"], wording, {"قرارك"})
    sheet("الحالة", ["نظام حكيم", "الحالة في الهيئة", "آخر تحقق في حكيم", "رابط الهيئة", "حالتك المعتمدة", "أداة الإصدار/الإلغاء", "ملاحظتك"], status, {"حالتك المعتمدة", "أداة الإصدار/الإلغاء", "ملاحظتك"})
    sheet("تعديلات الهيئة", ["نظام حكيم", "المادة", "نوع الأثر", "الأداة", "تحتاج مراجعة", "في أم القرى (op_id)", "الملاحظة", "النص الجديد", "قرارك: تُطبَّق/تُرفض/تُؤجَّل", "ملاحظتك"], notes, {"قرارك: تُطبَّق/تُرفض/تُؤجَّل", "ملاحظتك"})
    sheet("في أم القرى لا في الهيئة", ["نظام حكيم", "المادة", "نوع العملية", "رقم الأداة", "تاريخها", "رابط أم القرى", "op_id", "قرارك"], uqn_only, {"قرارك"})
    wb.save(path)


if __name__ == "__main__":
    main()
