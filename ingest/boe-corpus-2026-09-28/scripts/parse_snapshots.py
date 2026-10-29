"""يحلّل لقطات صفحات هيئة الخبراء (HTML كما ورد) إلى جداول boe. لا شبكة ولا قاعدة.

المدخل: data/boe_snapshots.jsonl.gz — سطر لكل صفحة {guid,url,status,retrieved_at,sha256,known_shape,html}
        data/boe_catalog.json — فهرس صفحة المجلدات
المخرج: data/parsed/*.jsonl (law, text_block, unit, amendment_note, related_doc) + data/parsed/report.json
حتمي: يعطي النتيجة نفسها من اللقطات نفسها. النص حرفي: لا تصحيح ولا توحيد مسافات داخل السطر.
"""
import gzip
import hashlib
import json
import pathlib
import re
import sys

from lxml import html as lh

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "parsed"
BLOCK_TAGS = {"p", "div", "li", "ul", "ol", "tr", "table", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "blockquote"}
CARD_LABELS = {"الاسم": "name", "تاريخ الإصدار": "issued", "تاريخ النشر": "published", "الحالة": "status", "أدوات إصدار النظام": "instruments"}
HEAD_RE = re.compile(r"^\s*(مرسوم ملكي|قرار مجلس الوزراء|أمر ملكي|أمر سامي)\s*رقم")
KIND = {"مرسوم ملكي": "royal_decree", "قرار مجلس الوزراء": "cabinet_decision", "أمر ملكي": "royal_order", "أمر سامي": "royal_order"}
BASMALA_RE = re.compile(r"^\s*بسم الله الرحمن الرحيم\s*$")
AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def sid(*parts: str) -> str:
    return "boe26-" + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


# ── تحويل HTML إلى نص بأسطر، مثل عرض المتصفح (بلا تعديل داخل السطر) ──
def to_text(el) -> str:
    out: list[str] = []

    def walk(node):
        tag = node.tag if isinstance(node.tag, str) else ""
        if tag in ("script", "style"):
            if node.tail:
                out.append(node.tail)
            return
        if tag == "br":
            out.append("\n")
        elif tag in BLOCK_TAGS:
            out.append("\n")
        if node.text and tag not in ("script", "style"):
            out.append(node.text)
        for ch in node:
            walk(ch)
        if tag in BLOCK_TAGS:
            out.append("\n")
        if node.tail:
            out.append(node.tail)

    if el.text:
        out.append(el.text)
    for ch in el:
        walk(ch)
    raw = "".join(out).replace("\r\n", "\n").replace("\r", "\n").replace("\xa0", " ")
    lines = [ln.strip(" \t") for ln in raw.split("\n")]
    # طيّ الأسطر الفارغة المتتالية إلى سطر فارغ واحد، وحذف الفارغ في الطرفين
    res: list[str] = []
    for ln in lines:
        if ln == "" and (not res or res[-1] == ""):
            continue
        res.append(ln)
    while res and res[-1] == "":
        res.pop()
    return "\n".join(res)


# ── أرقام المواد من «المادة الحادية والعشرون بعد المائة» ──
UNITS = {
    "الاولي": 1, "الاولى": 1, "الحاديه": 1, "الحادي": 1, "الثانيه": 2, "الثاني": 2, "الثالثه": 3, "الثالث": 3,
    "الرابعه": 4, "الرابع": 4, "الخامسه": 5, "الخامس": 5, "السادسه": 6, "السادس": 6, "السابعه": 7, "السابع": 7,
    "الثامنه": 8, "الثامن": 8, "التاسعه": 9, "التاسع": 9, "العاشره": 10, "العاشر": 10,
}
TENS = {"العشرون": 20, "العشرين": 20, "الثلاثون": 30, "الثلاثين": 30, "الاربعون": 40, "الاربعين": 40, "الخمسون": 50, "الخمسين": 50,
        "الستون": 60, "الستين": 60, "السبعون": 70, "السبعين": 70, "الثمانون": 80, "الثمانين": 80, "التسعون": 90, "التسعين": 90}
HUNDREDS = {"المائه": 100, "المئه": 100, "المائتين": 200, "المئتين": 200, "المائتان": 200, "الثلاثمائه": 300, "الثلاثمئه": 300,
            "الاربعمائه": 400, "الاربعمئه": 400, "الخمسمائه": 500, "الخمسمئه": 500, "الستمائه": 600, "الستمئه": 600,
            "السبعمائه": 700, "السبعمئه": 700, "الثمانمائه": 800, "الثمانمئه": 800, "التسعمائه": 900, "التسعمئه": 900}


def norm(s: str) -> str:
    s = re.sub(r"[ؐ-ًؚ-ٰٟـ]", "", s)
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    return s


ORDINAL_ITEMS = {
    "اولا": 1, "ثانيا": 2, "ثالثا": 3, "رابعا": 4, "خامسا": 5, "سادسا": 6, "سابعا": 7, "ثامنا": 8, "تاسعا": 9, "عاشرا": 10,
}
ORDINAL_TEENS = {"حادي": 1, "ثاني": 2, "ثالث": 3, "رابع": 4, "خامس": 5, "سادس": 6, "سابع": 7, "ثامن": 8, "تاسع": 9}
HUNDREDS.update({"المئتان": 200, "المائتان": 200})


def infer_unit_numbers(units: list[dict], flags: list[str]) -> None:
    """وحدات بلا رقم بين وحدتين مرقمتين: إن ساوى عددها فجوة الترقيم فهي مواد متتابعة فقدت أرقامها لأن عنوان الباب
    أخذ مكان «المادة …» (أول مادة في كل باب). تُرقَّم بالتتابع وتُعلَّم number_inferred، ولا يُستنتج رقم لوحدة عنوانها
    جدول/مرفق/ملحق/نموذج أو متنها أقصر من 20 حرفًا، ولا عند فجوة لا تطابق العدد. (HKM-030، 23/10/2026)"""
    skip = re.compile(r"جدول|مرفق|ملحق|نموذج|إشارات|الاشارات")
    i, n = 0, len(units)
    while i < n:
        if units[i]["article_number"] is not None or units[i]["is_bis"]:
            i += 1
            continue
        j = i
        while j < n and units[j]["article_number"] is None and not units[j]["is_bis"]:
            j += 1
        run = units[i:j]
        prev_n = next((u["article_number"] for u in reversed(units[:i]) if u["article_number"] is not None and not u["is_bis"]), 0)
        next_n = next((u["article_number"] for u in units[j:] if u["article_number"] is not None and not u["is_bis"]), None)
        expected = (next_n - prev_n - 1) if next_n is not None else len(run)
        if expected == len(run) and all(not skip.search(u["heading"] or "") and len(u["body"]) >= 20 for u in run):
            for k, u in enumerate(run, start=1):
                u["article_number"] = prev_n + k
                u["number_inferred"] = True
                flags.append(f"inferred:{u['seq']}={prev_n + k}")
        i = j


def article_number(heading: str) -> tuple[int | None, bool]:
    """رقم المادة الأساسي من عنوانها. يقف عند أول كلمة ليست عددًا (ما بعدها عنوان فرعي)."""
    h = norm(heading.translate(AR_DIGITS))
    if re.fullmatch(r"\s*[\(\[]\s*(?:ال)?ماد[هة][^\)\]]*[\)\]]\s*[:：.]?\s*", h):
        h = re.sub(r"[\(\)\[\]]", " ", h)  # «(المادة الأولى)»: الأقواس زينة لا بنية
    bis = bool(re.search(r"مكرر", h))
    m = re.search(r"(?:ال)?ماد[هة]\s*(?:رقم\s*)?[\(\[]?\s*(\d+)", h)
    if m:
        return int(m.group(1)), bis
    # بنود مرقمة بالترتيب: «أولاً:»، «حادي عشر:»
    w = re.sub(r"[^\u0600-\u06FF ]", " ", h).split()
    if w and w[0].rstrip("ًا") + "ا" in ORDINAL_ITEMS and not re.search(r"ماد", h):
        return ORDINAL_ITEMS[w[0].rstrip("ًا") + "ا"], bis
    if len(w) >= 2 and w[0] in ORDINAL_TEENS and w[1] in ("عشر", "عشره"):
        return 10 + ORDINAL_TEENS[w[0]], bis
    bare = not re.search(r"(?:ال)?ماد[هة]", h)
    if bare:
        d = re.fullmatch(r"\s*[\(\[]?\s*(\d+)\s*[\)\]]?\s*[:：.]?\s*", h)
        if d:
            return int(d.group(1)), bis
    body = re.sub(r"^.*?(?:ال)?ماد[هة]\s*", "", h) if not bare else re.sub(r"مكرر", " ", h).replace("(", " ").replace(")", " ")
    body = re.split(r"[:：\(\[]|\s[-–—]\s", body)[0]
    words = [x for x in re.split(r"\s+", body.strip()) if x]
    hundred = 0
    rest = 0
    seen = False
    for x in words:
        x0 = x[1:] if x.startswith("و") and (x[1:] in UNITS or x[1:] in TENS or x[1:] in HUNDREDS) else x
        if x0 == "بعد":
            continue
        if x0 in HUNDREDS:
            hundred = HUNDREDS[x0]; seen = True
        elif x0 in TENS:
            rest += TENS[x0]; seen = True
        elif x0 in UNITS:
            rest += UNITS[x0]; seen = True
        elif x0 in ("عشره", "عشر"):
            rest += 10; seen = True
        elif seen and not bare:
            break  # عنوان فرعي بعد الرقم: «المادة الأولى تعريفات»
        else:
            return None, bis
    total = hundred + rest
    return (total or None), bis


# ── ملاحظات التعديل ──
EFFECT_PATTERNS = [
    # تُطبَّق على نص مطبَّع (بلا تشكيل ولا تطويل، والهمزات ألفًا). الأخص أولًا.
    ("repeal", re.compile(r"(الغيت|الغي|الغاء)\s+(هذه\s+|هذا\s+)?(الماده|الفقره|الفقرتين|البند|المادتين|الباب|الفصل)")),
    ("delete", re.compile(r"(الغاء)\s+(العباره|عباره|الكلمه|كلمه)")),
    ("delete", re.compile(r"(^|\s|-)(حذف|حذفت)\s")),
    ("amend_definition", re.compile(r"(عدل|تعديل)\s+(التعريف|تعريف)")),
    ("amend_paragraph", re.compile(r"(عدلت|تعديل|تم\s+تعديل\s+نص|تم\s+تعديل\s+هذه|تصحيح)\s+(ال)?(فقر|بند)")),
    ("amend_article", re.compile(r"(عدلت|عدل|تم\s+تعديل|تعديل)\s+(نص\s+|احكام\s+|صدر\s+|عجز\s+|نهايه\s+)?(هذه\s+)?(الماده)")),
    ("amend_table", re.compile(r"(تعديل|عدل)\s+(جدول|الجدول)")),
    ("renumber_merge", re.compile(r"(تغيير\s+ترتيب|دمج\s+المادتين|دمج\s+الماد)")),
    ("add", re.compile(r"(اضافه|اضيفت|اضيف)\s")),
    ("substitute_phrase", re.compile(r"(احلال|استبدال|حلت\s+عباره)\s?")),
    ("general", re.compile(r"^\s*[-–•/]?\s*صدر\s")),
]
EFFECTS = ("amend_article", "amend_paragraph", "amend_definition", "amend_table", "renumber_merge", "repeal", "delete", "add", "substitute_phrase", "general", "unclassified")
INSTR_RE = [
    ("royal_decree", re.compile(r"(?:المرسوم\s+الملكي|مرسوم\s+ملكي)\s+رقم\s*[\(\[]?\s*(م\s*/\s*\d+)\s*[\)\]]?\s*(?:و?\s*ب?تاريخ)\s*([\d/ ]+)")),
    ("cabinet_decision", re.compile(r"قرار\s+مجلس\s+الوزراء\s+رقم\s*[\(\[]?\s*(\d+)\s*[\)\]]?\s*(?:و?\s*ب?تاريخ)\s*([\d/ ]+)")),
    ("royal_order", re.compile(r"(?:الامر|امر)\s+(?:الملكي|ملكي|السامي|سامي)\s+رقم\s*[\(\[]?\s*(ا?\s*/?\s*\d+)\s*[\)\]]?\s*(?:و?\s*ب?تاريخ)\s*([\d/ ]+)")),
]
NEWTEXT_RE = re.compile(r"(?:بالنص\s+(?:الآتي|الاتي|التالي|التالى)|كما\s+يلي|كما\s+يلى)\s*[:：]?\s*([\s\S]+)$")


def classify_note(text: str) -> list[dict]:
    t = norm(text.translate(AR_DIGITS))
    effect = "unclassified"
    for name, rx in EFFECT_PATTERNS:
        if rx.search(t):
            effect = name
            break
    instr = []
    for kind, rx in INSTR_RE:
        for m in rx.finditer(t):
            instr.append({"kind": kind, "no": re.sub(r"\s+", "", m.group(1)), "date": re.sub(r"\s+", "", m.group(2)).strip("/")})
    new_text = None
    if effect in ("amend_article", "amend_paragraph", "amend_definition", "amend_table", "add", "delete", "general", "unclassified"):
        m = NEWTEXT_RE.search(text)
        if m:
            nt = m.group(1).strip()
            if len(nt) >= 2 and nt[0] in "\"“«" and nt[-1] in "\"”»":
                nt = nt[1:-1].strip()
            elif len(nt) >= 3 and nt[0] in "\"“«" and nt[-2] in "\"”»" and nt[-1] == ".":
                nt = nt[1:-2].strip()
            new_text = nt or None
    # ملاحظة بأكثر من أداة أو بعدة بنود تحتاج مراجعة
    many = len({(i["kind"], i["no"]) for i in instr}) > 1 or len(re.findall(r"(?m)^\s*[-•]\s", text)) > 1
    needs_review = (
        effect in ("unclassified", "general", "renumber_merge", "amend_table")
        or not instr
        or many
        or (effect in ("amend_article", "amend_paragraph", "amend_definition") and new_text is None)
    )
    first = instr[0] if instr else {}
    return [{
        "effect": effect,
        "new_text": new_text,
        "instrument_kind": first.get("kind"),
        "instrument_no": first.get("no"),
        "instrument_date_hijri": first.get("date"),
        "all_instruments": instr,
        "needs_review": needs_review,
    }]


def split_date(raw: str | None):
    if not raw:
        return None, None
    h = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})\s*هـ", raw)
    g = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})\s*مـ", raw)
    return (f"{h.group(1)}/{int(h.group(2)):02d}/{int(h.group(3)):02d}" if h else None,
            f"{g.group(3)}-{int(g.group(2)):02d}-{int(g.group(1)):02d}" if g else None)


def is_placeholder_hijri(h: str | None) -> bool:
    """HKM-056: تاريخ إصدار ينتهي بـ /01/01 وهمي في الهيئة (يوم غير معروف)، فلا يُعتمد."""
    return bool(h) and h.endswith("/01/01")


def instrument_date_hijri(instruments: list[str]) -> str | None:
    """تاريخ سند الإصدار: أول أداة (مرسوم/قرار/أمر) فيها تاريخ هجري غير وهمي، بصيغة YYYY/MM/DD.
    الهيئة تكتبه يومًا/شهرًا/سنة («بتاريخ 29 / 3 / 1423») وأحيانًا سنة أولًا («1439/5/28هـ»)."""
    ordered = sorted(instruments, key=lambda x: 0 if HEAD_RE.match(x) else 1)
    for x in ordered:
        t = x.translate(AR_DIGITS)
        m = re.search(r"(?<!\d)(\d{4})\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})(?!\d)", t)
        if m:
            y, mo, d = m.group(1), m.group(2), m.group(3)
        else:
            m = re.search(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})(?!\d)", t)
            if not m:
                continue
            d, mo, y = m.group(1), m.group(2), m.group(3)
        if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 30):
            continue
        h = f"{y}/{int(mo):02d}/{int(d):02d}"
        if not is_placeholder_hijri(h):
            return h
    return None


def card_root(doc):
    """HKM-056: البطاقة من رأس النسخة الحالية (div.system_info)، لا من أول وسم label في الصفحة؛ وبلا رأس فالصفحة كلها."""
    heads = doc.cssselect("div.system_info")
    return heads[0] if heads else doc


def popup_owner(el):
    """أقرب div.article_item يحوي العنصر (المواد المتداخلة: الملاحظة لمادتها الداخلية وحدها)."""
    for p in el.iterancestors():
        if "article_item" in (p.get("class") or "").split():
            return p
    return None


def blocks_from_lines(lines: list[str]) -> list[dict]:
    """كتل ما قبل المواد بترتيب المصدر. الأسطر مجتمعة = النص كاملًا (يُفحص)."""
    blocks: list[dict] = []
    i = 0
    if lines and lines[0].strip():
        blocks.append({"kind": "title", "heading": None, "body": lines[0]}); i = 1
    if i < len(lines) and re.fullmatch(r"\s*\d{4}\s*هـ\s*", lines[i]):
        blocks.append({"kind": "year", "heading": None, "body": lines[i]}); i += 1
    last = len(lines) - 1
    while last >= i and not lines[last].strip():
        last -= 1
    tail = last if (last >= i and not HEAD_RE.match(lines[last]) and len(lines[last].strip()) < 200 and not BASMALA_RE.match(lines[last])) else None
    end = tail if tail is not None else len(lines)
    cur = None
    for j in range(i, end):
        ln = lines[j]
        if BASMALA_RE.match(ln):
            if cur:
                blocks.append(cur); cur = None
            blocks.append({"kind": "basmala", "heading": None, "body": ln})
            continue
        m = HEAD_RE.match(ln)
        if m:
            if cur:
                blocks.append(cur)
            cur = {"kind": KIND[m.group(1)], "heading": ln, "lines": []}
            continue
        if cur is None:
            cur = {"kind": "preamble_other", "heading": None, "lines": []}
        cur["lines"].append(ln)
    if cur:
        blocks.append(cur)
    for b in blocks:
        if "lines" in b:
            b["body"] = "\n".join(b.pop("lines"))
    if tail is not None:
        blocks.append({"kind": "law_title", "heading": None, "body": lines[tail]})
    # فحص الحرفية
    rebuilt: list[str] = []
    for b in blocks:
        if b.get("heading"):
            rebuilt.append(b["heading"])
        if b["kind"] in ("royal_decree", "cabinet_decision", "royal_order", "preamble_other"):
            rebuilt.extend(b["body"].split("\n"))
        else:
            rebuilt.append(b["body"])
    trimmed = lines[: (tail + 1) if tail is not None else len(lines)]
    if rebuilt != trimmed:
        raise ValueError("blocks_not_lossless")
    return blocks


def parse_page(rec: dict, cat: dict | None) -> dict:
    flags: list[str] = []
    if ("العنصر المطلوب غير موجود بالنظام" in rec["html"] or "تاريخ الإصدار" not in rec["html"]) and "article_item" not in rec["html"]:
        raise LookupError("source_not_found")
    doc = lh.fromstring(rec["html"])
    crumbs = [re.sub(r"\s+", " ", li.text_content()).strip() for li in doc.cssselect(".breadcrumb li")]
    crumbs = [c for c in crumbs if c]
    # البطاقة
    card: dict = {}
    for lab in card_root(doc).xpath(".//label"):
        key = CARD_LABELS.get(lab.text_content().strip())
        if not key or key in card:
            continue
        sib = lab.getnext()
        if sib is None:
            continue
        if key == "instruments":
            items = [to_text(li) for li in sib.xpath(".//li")] or [to_text(sib)]
            card[key] = [x for x in items if x]
        else:
            card[key] = to_text(sib)
    en = {}
    for lab in doc.xpath("//label|//strong|//span|//div"):
        t = (lab.text or "").strip()
        if t in ("Law name", "Law description") and t not in en:
            sib = lab.getnext()
            if sib is not None:
                en[t] = re.sub(r"\s+", " ", sib.text_content()).strip()
    # النبذة
    summary = None
    h4s = [h for h in doc.xpath("//h4") if "نبذة عن النظام" in h.text_content()]
    if h4s:
        parts = []
        n = h4s[0].getnext()
        while n is not None and n.tag != "h4" and "Law name" not in n.text_content()[:40]:
            parts.append(to_text(n))
            n = n.getnext()
        if not parts:
            # البنية الأخرى: النص داخل أب العنوان
            parent_text = to_text(h4s[0].getparent())
            parent_text = parent_text.split("Law name")[0]
            parent_text = parent_text.replace("نبذة عن النظام", "", 1)
            parts = [parent_text]
        summary = "\n".join(p for p in parts if p).strip() or None
        if summary and "Law name" in summary:
            summary = summary.split("Law name")[0].strip()
    else:
        flags.append("no_summary")
    # المواد وما قبلها
    arts = doc.cssselect("div.article_item")
    units, notes = [], []
    pre_lines: list[str] = []
    if arts:
        container = arts[0].getparent()
        pre_parts = []
        for ch in container:
            if ch is arts[0]:
                break
            pre_parts.append(to_text(ch))
        pre_text = "\n".join(p for p in pre_parts if p is not None)
        pre_lines = [ln for ln in pre_text.split("\n")]
        while pre_lines and pre_lines[-1] == "":
            pre_lines.pop()
        while pre_lines and pre_lines[0] == "":
            pre_lines.pop(0)
        for seq, a in enumerate(arts, start=1):
            h3 = a.cssselect("h3")
            heading = re.sub(r"\s+", " ", h3[0].text_content()).strip() if h3 else ""
            bodies = [c for c in a.cssselect("div.HTMLContainer") if not any("article_item_popup" in (p.get("class") or "") for p in c.iterancestors())]
            body_el = bodies[0] if bodies else None
            body = to_text(body_el) if body_el is not None else ""
            body_html = lh.tostring(body_el, encoding="unicode") if body_el is not None else ""
            num, bis = article_number(heading)
            if num is None:
                flags.append(f"unnumbered:{seq}")
            cls = " ".join(c for c in (a.get("class") or "").split() if c not in ("article_item", "no_alternate"))
            units.append({"seq": seq, "heading": heading, "article_number": num, "is_bis": bis, "body": body,
                          "body_html": body_html, "body_sha256": hashlib.sha256(body.encode()).hexdigest(), "css_class": cls, "number_inferred": False})
            seen_notes: set[str] = set()
            k = 0
            for pop in a.cssselect(".article_item_popup .HTMLContainer"):
                if popup_owner(pop) is not a:
                    continue  # HKM-056: ملاحظة مادة متداخلة داخل هذه؛ تُسند لمادتها حين يأتي دورها لا للمادة الحاوية
                nt = to_text(pop)
                if not nt or nt in seen_notes:
                    continue  # الصفحة تكرر الملاحظة نفسها أحيانًا؛ تُدوَّن مرة واحدة
                seen_notes.add(nt)
                k += 1
                for c in classify_note(nt):
                    notes.append({"unit_seq": seq, "note_seq": k, "note_text": nt, **c})
        infer_unit_numbers(units, flags)
    else:
        # صفحة نصها كتلة واحدة بلا div.article_item: يُحفظ النص كاملًا كتلًا، وتُوسم للمراجعة ولا تُخمَّن المواد
        conts = [c for c in doc.cssselect("div.HTMLContainer") if not any("article_item_popup" in (p.get("class") or "") for p in c.iterancestors())]
        if conts:
            flags.append("no_article_structure")
            whole = "\n".join(t for t in (to_text(c) for c in conts) if t)
            pre_lines = whole.split("\n")
        else:
            flags.append("no_articles")
    blocks = []
    if pre_lines:
        try:
            blocks = blocks_from_lines(pre_lines)
        except ValueError:
            flags.append("blocks_not_lossless")
            blocks = [{"kind": "preamble_other", "heading": None, "body": "\n".join(pre_lines)}]
    related = []
    seen = set()
    for a in doc.xpath("//a[contains(@href,'LawDetails')]"):
        if any("article_item" in (p.get("class") or "") for p in a.iterancestors()):
            continue
        m = re.search(r"LawDetails/([0-9a-f-]{36})", a.get("href") or "")
        label = re.sub(r"\s+", " ", a.text_content()).strip()
        if m and m.group(1) != rec["guid"] and label and (m.group(1), label) not in seen:
            seen.add((m.group(1), label))
            related.append({"target_guid": m.group(1), "label": label})
    ih, ig = split_date(card.get("issued"))
    if is_placeholder_hijri(ih):
        # HKM-056: اليوم والشهر 01/01 وهميان (والميلادي تحويل الوهمي)؛ التاريخ من سند الإصدار، ويبقى issued_raw كما ورد.
        fixed = instrument_date_hijri(card.get("instruments", []))
        flags.append(f"issued_placeholder:{'from_instrument' if fixed else 'unresolved'}")
        ih, ig = fixed, None
    ph, pg = split_date(card.get("published"))
    law_id = sid(rec["guid"], rec["sha256"])
    law = {
        "id": law_id, "guid": rec["guid"], "snapshot_sha256": rec["sha256"], "url": rec["url"],
        "name": card.get("name") or (cat or {}).get("name"), "name_en": en.get("Law name"), "description_en": en.get("Law description"),
        "summary": summary, "category_path": crumbs[:-1] if crumbs else ([cat["tab"], cat["category"]] if cat else []),
        "issued_raw": card.get("issued"), "issued_hijri": ih, "issued_gregorian": ig,
        "published_raw": card.get("published"), "published_hijri": ph, "published_gregorian": pg,
        "status_at_source": card.get("status"),
        "instruments": [{"kind": KIND[m.group(1)] if (m := HEAD_RE.match(x)) else "other", "text": x} for x in card.get("instruments", [])],
        "article_count": len(units), "parse_flags": flags,
    }
    return {"law": law, "blocks": blocks, "units": units, "notes": notes, "related": related}


def main() -> None:
    snaps = ROOT / "data" / "boe_snapshots.jsonl.gz"
    catalog = {c["guid"]: c for c in json.loads((ROOT / "data" / "boe_catalog.json").read_text(encoding="utf-8"))}
    OUT.mkdir(parents=True, exist_ok=True)
    files = {k: open(OUT / f"{k}.jsonl", "w", encoding="utf-8") for k in ("law", "text_block", "unit", "amendment_note", "related_doc")}
    rep = {"pages": 0, "failed": [], "flags": {}, "effects": {}, "classes": {}, "status": {}, "tabs": {}}
    with gzip.open(snaps, "rt", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec.get("status") != 200 or not rec.get("html"):
                rep["failed"].append([rec.get("guid"), rec.get("status")])
                continue
            try:
                p = parse_page(rec, catalog.get(rec["guid"]))
            except LookupError:
                rep.setdefault("not_found", []).append(rec["guid"])
                continue
            except Exception as e:  # noqa: BLE001 — يُسجَّل ولا يُخمَّن
                rep["failed"].append([rec["guid"], f"parse_error:{type(e).__name__}:{str(e)[:80]}"])
                continue
            rep["pages"] += 1
            law = p["law"]
            files["law"].write(json.dumps(law, ensure_ascii=False) + "\n")
            for seq, b in enumerate(p["blocks"], start=1):
                files["text_block"].write(json.dumps({"law_id": law["id"], "seq": seq, **b}, ensure_ascii=False) + "\n")
            for u in p["units"]:
                files["unit"].write(json.dumps({"law_id": law["id"], **u}, ensure_ascii=False) + "\n")
                rep["classes"][u["css_class"] or "none"] = rep["classes"].get(u["css_class"] or "none", 0) + 1
            for n in p["notes"]:
                nid = sid(law["id"], str(n["unit_seq"]), str(n["note_seq"]), n["effect"])
                files["amendment_note"].write(json.dumps({"id": nid, "law_id": law["id"], **n}, ensure_ascii=False) + "\n")
                rep["effects"][n["effect"]] = rep["effects"].get(n["effect"], 0) + 1
            for r in p["related"]:
                files["related_doc"].write(json.dumps({"law_id": law["id"], **r}, ensure_ascii=False) + "\n")
            for fl in law["parse_flags"]:
                k = fl.split(":")[0]
                rep["flags"][k] = rep["flags"].get(k, 0) + 1
            st = law["status_at_source"] or "—"
            rep["status"][st] = rep["status"].get(st, 0) + 1
            tab = (catalog.get(rec["guid"]) or {}).get("tab", "—")
            rep["tabs"][tab] = rep["tabs"].get(tab, 0) + 1
    for fh in files.values():
        fh.close()
    (OUT / "report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "failed"}, ensure_ascii=False))
    print("failed", len(rep["failed"]))


if __name__ == "__main__":
    sys.exit(main())
