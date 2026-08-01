#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# HKM-JDS-002 §10-11 — مستخرِج الجينوم القضائيّ من المراجع (منهج + صياغة).
# يقرأ data/judicial-references/*.txt (نصّ المراجع، سطرٌ منطقيّ)، يبحث عن الأنماط §4
# بصيغةٍ مطبَّعة، ويُسجّل كلّ نمطٍ بمصدره وصفحته (لا اختلاق) في genome-hits.json،
# ثمّ يولّد lib/modules/judicial/patterns-from-references.ts.
#
# الاستعمال: python3 scripts/extract-judicial-genome.py
# استخراج النصّ الخام من الـ PDF (خطوة سابقة، تتطلّب pdfminer.six):
#   from pdfminer.high_level import extract_text ; يُعكَس كلّ سطر (بصريّ→منطقيّ).
# ─────────────────────────────────────────────────────────────────────────────
import re, json, os

def norm(s: str) -> str:
    s = re.sub(r"[ًٌٍَُِّْـ]", "", s)
    for a, b in [("إ","ا"),("أ","ا"),("آ","ا"),("ٱ","ا"),("ى","ي"),("ة","ه"),("ؤ","و"),("ئ","ي"),("ء","")]:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s)

PATTERNS = {
    "PROCEDURAL_SEQUENCE": ["تسمع الدعوي","يحرر المدعي","تعرض الدعوي","تسمع الاجابه","تسمع الجواب","فتطلب البينه","فان احضر بينه","وان عجز عن البينه","توجه اليمين","فان حلف","وان نكل","يحكم بثبوت","يصرف النظر","تترتب الاثار"],
    "ANSWER_FORMULATION": ["فان اقر","وان انكر","لا يخلو جوابه","او صادق","عدم العلم"],
    "ISSUE_PRESENTATION": ["المسايل","القول الاول","القول الثاني","ثمره الخلاف","والاقرب","وعليه العمل","الفوايد"],
}
FILES = {"khudayri-B": "data/judicial-references/khudayri-B.txt", "ijraat-A": "data/judicial-references/ijraat-A.txt"}


def split_pages(text: str):
    parts = re.split(r"=====\s*صفحة\s*(\d+)\s*=====", text)
    return [(int(parts[i]), parts[i + 1]) for i in range(1, len(parts), 2)]


def main():
    hits = {}
    for fid, path in FILES.items():
        if not os.path.exists(path):
            continue
        pages = split_pages(open(path, encoding="utf-8").read())
        for cls, phrases in PATTERNS.items():
            for ph in phrases:
                nph = norm(ph)
                found = [num for num, body in pages if nph in norm(body)]
                if found:
                    hits.setdefault(cls, {}).setdefault(ph, {})[fid] = {"count": len(found), "firstPage": found[0]}
    os.makedirs("data/judicial-references", exist_ok=True)
    json.dump(hits, open("data/judicial-references/genome-hits.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    total = sum(len(d) for d in hits.values())
    print(f"أنماط مُثبَتة بمصدرٍ وصفحة: {total}")


if __name__ == "__main__":
    main()
