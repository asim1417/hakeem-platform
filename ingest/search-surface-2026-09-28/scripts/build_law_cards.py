"""يبني بطاقات الأنظمة (law_card) من قراءة هيئة الخبراء المحفوظة. لا شبكة. لا كتابة على قاعدة.

المدخل: data/boe_9_laws_raw.json (قُرئ من متصفح المالك في 2026-09-28 بتوجيهه).
المخرج: data/law_cards_boe.jsonl — صف لكل نظام:
  الاسم، تاريخ الإصدار (هـ/م)، تاريخ النشر (هـ/م)، الحالة كما في المصدر، أدوات الإصدار،
  وكتل «نص النظام» مرتّبة كما في المصدر: العنوان، السنة، البسملة، المرسوم، البسملة، قرار المجلس، عنوان النظام.
النص يُحفظ حرفيًا: الكتل مجتمعة = نص الديباجة الأصلي سطرًا بسطر (يُفحص هنا ويفشل البناء إن اختلف).
«نبذة عن النظام» ومسار التصنيف من القراءة الثانية بتوجيه المالك (2026-09-28):
data/boe_card_summary_category.json — مطابق بالبصمة لما في الصفحة (SHA-256). الغائب يبقى فارغًا ولا يُخمَّن.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
RETRIEVED = "2026-09-28"
HEAD_RE = re.compile(r"^\s*(مرسوم ملكي|قرار مجلس الوزراء|أمر ملكي|أمر سامي)\s*رقم")
KIND = {"مرسوم ملكي": "royal_decree", "قرار مجلس الوزراء": "cabinet_decision", "أمر ملكي": "royal_order", "أمر سامي": "royal_order"}
BASMALA = "بسم الله الرحمن الرحيم"


def split_date(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    h = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})\s*هـ", raw)
    g = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})\s*مـ", raw)
    hij = f"{h.group(1)}/{int(h.group(2)):02d}/{int(h.group(3)):02d}" if h else None
    gre = f"{g.group(3)}-{int(g.group(2)):02d}-{int(g.group(1)):02d}" if g else None
    return hij, gre


def blocks_of(preamble: str) -> list[dict]:
    lines = preamble.split("\n")
    blocks: list[dict] = []
    i = 0
    if lines and lines[0].strip():
        blocks.append({"kind": "title", "text": lines[0]})
        i = 1
    if i < len(lines) and re.fullmatch(r"\s*\d{4}\s*هـ\s*", lines[i]):
        blocks.append({"kind": "year", "text": lines[i]})
        i += 1
    # عنوان النظام الختامي: آخر سطر غير فارغ إن لم يكن سطر أداة.
    last = len(lines) - 1
    while last >= i and not lines[last].strip():
        last -= 1
    tail_title = None
    if last >= i and not HEAD_RE.match(lines[last]) and len(lines[last].strip()) < 200:
        tail_title = last
    end = tail_title if tail_title is not None else len(lines)
    cur: dict | None = None
    for j in range(i, end):
        line = lines[j]
        if line.strip() == BASMALA:
            # البسملة كتلة مستقلة إذا تلتها أداة (بعد أسطر فارغة محتملة)
            k = j + 1
            while k < end and not lines[k].strip():
                k += 1
            if k < end and HEAD_RE.match(lines[k]):
                if cur:
                    blocks.append(cur)
                    cur = None
                blocks.append({"kind": "basmala", "text": line})
                continue
        m = HEAD_RE.match(line)
        if m:
            if cur:
                blocks.append(cur)
            cur = {"kind": KIND[m.group(1)], "heading": line, "lines": []}
            continue
        if cur is None:
            cur = {"kind": "preamble_other", "heading": None, "lines": []}
        cur["lines"].append(line)
    if cur:
        blocks.append(cur)
    for b in blocks:
        if "lines" in b:
            b["text"] = "\n".join(b.pop("lines"))
    if tail_title is not None:
        tail_blank = lines[tail_title + 1 :]
        blocks.append({"kind": "law_title", "text": lines[tail_title]})
        if any(x.strip() for x in tail_blank):
            raise SystemExit("سطر بعد العنوان الختامي")
    return blocks


def rebuild(blocks: list[dict]) -> list[str]:
    out: list[str] = []
    for b in blocks:
        if b.get("heading"):
            out.append(b["heading"])
        if b["kind"] in ("royal_decree", "cabinet_decision", "royal_order", "preamble_other"):
            out.extend(b["text"].split("\n"))
        else:
            out.append(b["text"])
    return out


def main() -> None:
    raw = json.loads((ROOT / "data" / "boe_9_laws_raw.json").read_text(encoding="utf-8"))
    extra_path = ROOT / "data" / "boe_card_summary_category.json"
    extra = json.loads(extra_path.read_text(encoding="utf-8")) if extra_path.exists() else {}
    out = []
    for title, law in raw.items():
        h = law["header"]
        blocks = blocks_of(law["preamble"])
        orig = [x for x in law["preamble"].rstrip("\n").split("\n")]
        got = rebuild(blocks)
        # فحص الحرفية: لا سطر مضاف ولا محذوف ولا معدَّل (الأسطر الفارغة في النهاية فقط تُهمل).
        if got != orig:
            raise SystemExit(f"الكتل لا تعيد النص حرفيًا: {title}")
        issued_h, issued_g = split_date(h.get("تاريخ الإصدار"))
        pub_h, pub_g = split_date(h.get("تاريخ النشر"))
        instruments = []
        for ins in h.get("أدوات الإصدار") or []:
            m = HEAD_RE.match(ins)
            instruments.append({"kind": KIND[m.group(1)] if m else "other", "text": ins})
        official_name = blocks[0]["text"].strip() if blocks and blocks[0]["kind"] == "title" else title
        out.append({
            "hakeem_title": title,
            "official_name": official_name,
            "summary": (extra.get(law["url"]) or {}).get("summary") or None,
            "issued_hijri": issued_h,
            "issued_gregorian": issued_g,
            "published_hijri": pub_h,
            "published_gregorian": pub_g,
            "status_at_source": h.get("الحالة"),
            # مسار التصنيف كما في المصدر بلا اسم النظام الأخير.
            "category_path": ((extra.get(law["url"]) or {}).get("crumbs") or [])[:-1],
            "instruments": instruments,
            "text_blocks": blocks,
            "source_name": "هيئة الخبراء بمجلس الوزراء",
            "source_url": law["url"],
            "retrieved_on": RETRIEVED,
        })
    with open(ROOT / "data" / "law_cards_boe.jsonl", "w", encoding="utf-8") as f:
        for row in out:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    for row in out:
        print(row["hakeem_title"], "|", [b["kind"] for b in row["text_blocks"]], "|", row["issued_gregorian"], row["status_at_source"])


if __name__ == "__main__":
    main()
