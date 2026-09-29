"""مراجع ملاحظات التعديل (needs_review) — يقترح لكل ملاحظة قرارًا مسندًا بدليل حرفي، ولا يكتب على أي قاعدة.

  python3 scripts/review_amendments.py            → data/review/proposals.jsonl + reports/مراجعة_ملاحظات_التعديل.xlsx

القواعد:
- النص الجديد يُنقل حرفيًا من الملاحظة (بلا تطبيع ولا تصحيح). ما لا نص له في الملاحظة لا يُكتب له نص جديد.
- النص الآلي من صور الأدوات (OCR) دليل مساعد فقط، ولا يُنقل نصًا جديدًا؛ يُعطى رابط الصفحة لمطابقته.
- الثقة: مؤكد (أثر صريح + أداة مقروءة + نص جديد حرفي أو أثر لا يحتاج نصًا)، مرجّح (أثر مستنتج بقاعدة، أو أداة من المرفق)،
  يحتاج قرار المالك (أي نقص في الدليل).
"""
import collections
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from parse_snapshots import AR_DIGITS  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
P = ROOT / "data" / "parsed"
ATT = ROOT / "data" / "attachments"
BOE = "https://laws.boe.gov.sa"
OVERRIDES = ROOT / "data" / "review" / "overrides.json"
VISION = ROOT / "data" / "review" / "vision" / "final.jsonl"   # قراءة بصرية لصور الأدوات + تحقق مستقل (الفئة 3)
VERDICT_AR = {"exact": "مطابق", "minor": "فروق شكل حروف صُحّحت", "wrong": "فروق كلمات صُحّحت بعد التحقق", None: "لم يُتحقق منه"}   # قراءة يدوية: {note_id: {effect, confidence, reason}}

TASHKEEL = re.compile("[\u0610-\u061A\u064B-\u065F\u0670\u0640]")
MAPC = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي"}


def norm_map(raw: str):
    """نص مطبَّع مع خريطة موضع كل حرف في الأصل، ليُقطع الأصل حرفيًا عند موضع يُكتشف في المطبَّع."""
    out, idx = [], []
    for i, ch in enumerate(raw):
        if TASHKEEL.match(ch):
            continue
        ch = MAPC.get(ch, ch).translate(AR_DIGITS)
        out.append(ch)
        idx.append(i)
    return "".join(out), idx


# ── الأداة ──
DATE_RE = r"(?:\s*(?:و\s*)?(?:ب?تاريخ|وتارخ|في)\s*[:：]?\s*(\d{1,4}\s*[-/ ]\s*\d{1,2}\s*[-/ ]\s*\d{1,4}(?:\s*-\s*\d{1,2})?))?"
INSTR = [
    ("مرسوم ملكي", re.compile(r"مرسوم\s+(?:ال)?ملكي\s*(?:الكريم\s*)?(?:رقم\s*[:：]?)?\s*[\(\[]?\s*(م\s*/?\s*\d+|(?<=رقم)\s*\d+|(?<=رقم\s)\d+|(?<=رقم\s\()\s*\d+|(?<=رقم\()\d+|(?<=رقم :\s\()\s*\d+)\s*[\)\]]?" + DATE_RE)),
    ("قرار مجلس الوزراء", re.compile(r"(?:قرار|قراري)\s+مجلس\s+(?:الوزراء|الوزار|الوزاء)\s*(?:الموقر\s*)?(?:</\d>\s*)?(?:رقم)?\s*[:：]?\s*[\(\[]?\s*(\d+)\s*[\)\]]?" + DATE_RE)),
    ("قرار مجلس الوزراء", re.compile(r"(?<=\s)ورقم\s*[\(\[]?\s*(\d+)\s*[\)\]]?" + DATE_RE)),
    ("أمر ملكي", re.compile(r"(?:ال)?امر\s+(?:ال)?ملكي\s*(?:الكريم\s*)?رقم\s*[:：]?\s*[\(\[]?\s*((?:ا\s*/?\s*)?\d+)\s*[\)\]]?" + DATE_RE)),
    ("أمر سامي", re.compile(r"(?:ال)?امر\s+(?:ال)?سامي\s*(?:الكريم\s*)?رقم\s*[\(\[]?\s*([\w/ ]{0,6}\d+)\s*[\)\]]?" + DATE_RE)),
    ("قرار (الجهة غير مذكورة)", re.compile(r"(?<!\S)القرار\s+رقم\s*[:：]?\s*[\(\[]?\s*(\d+)\s*[\)\]]?" + DATE_RE)),
    ("برقية", re.compile(r"(?:ال)?برقيه\s*(?:ال)?(?:ملكيه|ساميه)?\s*(?:الكريمه\s*)?رقم\s*[\(\[]?\s*([\w/ ]{0,6}\d+)\s*[\)\]]?" + DATE_RE)),
]


def fmt_date(d: str | None) -> str | None:
    if not d:
        return None
    nums = re.findall(r"\d+", d)
    if len(nums) < 3:
        return None
    if len(nums) == 4:  # «7-8 / 9 / 1388» يوم مزدوج
        nums = [nums[1], nums[2], nums[3]] if len(nums[3]) == 4 else nums[:3]
    a, b, c = nums[:3]
    if len(a) == 4:
        return f"{a}/{int(b):02d}/{int(c):02d}"
    if len(c) == 4:
        return f"{c}/{int(b):02d}/{int(a):02d}"
    return None


def instruments(t: str):
    found, seen = [], set()
    for kind, rx in INSTR:
        for m in rx.finditer(t):
            no = re.sub(r"\s+", "", m.group(1))
            if kind == "مرسوم ملكي" and not no.startswith("م"):
                no = no  # مراسيم قديمة بلا «م/»
            elif kind == "مرسوم ملكي" and "/" not in no:
                no = "م/" + no[1:]
            if kind == "أمر ملكي" and no.startswith("ا"):
                no = "أ/" + no.lstrip("ا/")
            key = (kind, no)
            if key in seen:
                continue
            seen.add(key)
            found.append({"kind": kind, "no": no, "date": fmt_date(m.group(2)), "pos": m.start()})
    return sorted(found, key=lambda x: x["pos"])


# ── النص الجديد ──
NEWTEXT = re.compile(
    r"(?:(?:ل|و)(?:ت|ي)(?:صبح|كون)(?:ان)?|اصبح|ونصها|ليصبح|لتصبح)[^:\n\"“«(]{0,45}?(?:[:：]|(?=\s*[\"“«]))"
    r"|(?:بالنص|بالنصوص|بالصيغه)\s+(?:الاتي|التالي|الاتيه|التاليه)\s*[:：]?"
    r"|(?:كالتالي|كالاتي|كما\s*يلي|علي\s+النحو\s+(?:الاتي|التالي))\s*[:：]?"
)
QUOTES = "\"“”«»'"


def new_text(raw: str):
    t, idx = norm_map(raw)
    m = None
    for m in NEWTEXT.finditer(t):
        break
    if not m:
        return None, raw
    cut = idx[m.end() - 1] + 1 if m.end() - 1 < len(idx) else len(raw)
    nt = raw[cut:].strip()
    nt = re.sub(r"^[:：\s/]+", "", nt).strip()
    if len(nt) >= 2 and nt[0] in QUOTES and nt.rstrip(".، ").endswith(tuple(QUOTES)) and sum(nt.count(q) for q in QUOTES) == 2:
        nt = nt.rstrip(".، ")[1:-1].strip()
    elif len(nt) >= 2 and nt[0] == "(" and nt.rstrip(".").endswith(")") and nt.count("(") == 1:
        nt = nt.rstrip(".")[1:-1].strip()
    if len(re.sub(r"\W", "", nt)) < 8:  # ليس نصًا، مثل «هـ.»
        return None, raw
    return nt, raw[:cut]


# ── الأثر ──
EFFECTS = [
    ("تفسير", r"تفسير|عدم وجود تعارض|مبينا"),
    ("دمج مواد", r"دمج|لتكون في مادتين|لتكون في ماده واحده"),
    ("إلغاء مادة", r"(حذف|بحذف|الغاء|الغيت|الغي)\s+(هذه\s+)?الماده(?!\s+ما)"),
    ("إعادة ترقيم", r"تغيير ترتيب|اعاده ترتيب|يعاد ترتيب"),
    ("إلغاء فقرة", r"(الغيت|الغي|الغاء|حذف|حذفت)\s+(هذه\s+)?(الفقره|الفقرتين|البند|البندين|الفقرات|التعريفات|التعريف)"),
    ("إلغاء باب أو فصل", r"(الغيت|الغي|الغاء|حذف)\s+(هذا\s+)?(الباب|الفصل)"),
    ("حذف عبارة", r"(الغاء|حذف|حذفت)\s+(ال)?(عباره|كلمه)"),
    ("إحلال عبارة", r"(تعديل|عدل|عدلت)\s+(اسم|مسمي|عباره|العباره)|حل\s+اسم|احلال|استبدال|اينما ورد"),
    ("تعديل جدول", r"جدول"),
    ("تعديل تعريف", r"(تعديل|عدل|عدلت)\s+(هذا\s+)?(التعريف|تعريف)"),
    ("إجراء إداري لا يمس النص", r"اعاده تشكيل|تعديل تشكيل|زياده راس|زيد راس|فصل وزاره|تطبيق\s+نظام|تمديد المده|اعمال احكام|ايكال|تعديل المده"),
    ("إضافة فقرة أو مادة", r"(^|\s|-)(يضاف|تضاف|اضافه|اضيفت|اضيف)\s"),
    ("تعديل فقرة", r"(عدلت|عدل|تعديل|تعديلات)\s+(صدر\s+|اخر\s+لهذه\s+)?(هذه\s+)?(ال)?(فقره|فقرات|بند|العنوان|عنوان)|الفقر[هات]+\s.{0,60}عدلت|تعديل\s+اخر\s+لهذه\s+الفقره"),
    ("تعديل مادة", r"(عدلت|عدل|تعديل|تعديلات|يعدل|ليعدل)\b.{0,40}(الماده|المواد)|صدر\s+تعديل|ديباجه|عدل\s+بدل|عدلت\s+مده"),
]
EFFECTS = [(n, re.compile(r)) for n, r in EFFECTS]
TEXT_EFFECTS = {"تعديل مادة", "تعديل فقرة", "تعديل تعريف", "تعديل جدول", "إضافة فقرة أو مادة", "دمج مواد"}


PHRASE_EFFECTS = {"إحلال عبارة", "حذف عبارة", "إضافة فقرة أو مادة"}
QUOTED = re.compile(r"[\"“«]([^\"”»“«]{1,600})[\"”»]|\(([^()]{1,300})\)")


def phrase_of(eff: str, raw: str):
    """العبارة الجديدة حرفيًا لأثر عبارة: في الإحلال ما قبل «محل/بدلا من»، وفي «تعديل عبارة X لتكون Y» الثانية، وفي الإضافة الأولى."""
    t = norm_map(raw)[0]
    q = [m.group(1) or m.group(2) for m in QUOTED.finditer(raw)]
    q = [x.strip() for x in q if x and not re.fullmatch(r"[\s\dا-ي/]{0,4}", norm_map(x)[0])]
    if not q:
        return None
    if eff == "إحلال عبارة":
        if re.search(r"(تعديل|عدل|عدلت)\s+(عباره|العباره|اسم|مسمي).{0,400}(لتكون|ليكون|ليصبح|لتصبح|الي)", t) and len(q) >= 2:
            return q[1]
        return q[0]
    if eff == "إضافة فقرة أو مادة" and re.search(r"اضافه\s+(ال)?(عباره|كلمه)|يضاف\s+(ال)?(عباره|كلمه)", t):
        return q[0]
    return None


def effects_all(head_norm: str):
    names = [name for name, rx in EFFECTS if rx.search(head_norm)]
    if len(names) > 1 and "تعديل مادة" in names:
        names.remove("تعديل مادة")
    return names


def effect_of(head_norm: str, has_text: bool, whole_norm: str):
    if re.search(r"تغيير\s+ترتيب\s+هذه\s+الماده", head_norm):
        return "إعادة ترقيم", "قاعدة: تغيير ترتيب هذه المادة (والدمج سياق)"
    names = effects_all(head_norm)
    if not has_text and any(x in names for x in ("إحلال عبارة", "حذف عبارة")):
        names = [x for x in names if x not in ("تعديل فقرة", "تعديل تعريف")]  # «تعديل الفقرة… وذلك بإحلال عبارة» أثر واحد
    if len(names) > 1 and "إجراء إداري لا يمس النص" not in names and "تفسير" not in names:
        return " + ".join(names), "قاعدة: عدة آثار في ملاحظة واحدة"
    for name, rx in EFFECTS:
        if name in names and rx.search(head_norm):
            if name == "إجراء إداري لا يمس النص" and has_text and re.search(r"لتصبح\s+الماده|اصبح\s+نص\s+الماده|لتكون\s+الماده", whole_norm):
                return "تعديل مادة", "قاعدة: إجراء نصّت الملاحظة على أنه غيّر نص المادة"
            return name, f"قاعدة: {rx.pattern[:60]}"
    if re.search(r"(^|\s)(الغي|الغيت)\s+من\s+هذه\s+الماده\s+ما", head_norm):
        return "إلغاء جزئي", "قاعدة: إلغاء جزء من المادة"
    if re.search(r"^\s*[-•]?\s*صدر", head_norm):
        return "قرار صادر بشأن المادة", "قاعدة: «صدر بشأن»"
    if not re.search(r"عدل|تعديل|الغ|حذف|اضاف|يضاف|صدر|بموجب", whole_norm):
        return "نص مادة معروض بلا صيغة تعديل", "لا فعل تعديل في الملاحظة"
    return "غير مصنف", "لا قاعدة"


# ── التقسيم إلى بنود ──
ITEM_VERB = re.compile(r"(?:^|[\s\-–])(?:ب?احلال|ب?حذف|ب?اضافه|ب?تعديل|عدلت|عدل|ب?الغاء|الغي|الغيت)(?=\s)")
ITEM_HEAD = re.compile(r"^\s*(?:[-•]|[ابجدهوزحطي]\s*[-–)]|\d{1,2}\s*[-–)])\s*\S")


def split_effect_list(raw: str):
    """«…على النحو الآتي:» تليه بنود كل منها أثر مستقل (أ- إضافة… ب- حذف…)."""
    t, idx = norm_map(raw)
    m = re.search(r"علي\s+النحو\s+(?:الاتي|التالي)\s*[:：]?|كما\s*يلي\s*[:：]?|(?:يتضمن|المتضمن|ويتضمن|والمتضمن)\s+الاتي\s*[:：]?|وذلك\s*[:：]", t)
    if not m:
        return None
    cut = idx[m.end() - 1] + 1
    pre, rest = raw[:cut], raw[cut:]
    lines = rest.split("\n")
    heads = [i for i, ln in enumerate(lines) if ITEM_HEAD.match(norm_map(ln)[0]) and ITEM_VERB.search(norm_map(ln)[0][:40])]
    if len(heads) < 2:
        return None
    parts = []
    for k, i in enumerate(heads):
        j = heads[k + 1] if k + 1 < len(heads) else len(lines)
        parts.append((pre.strip(), "\n".join(lines[i:j]).strip()))
    return parts


def split_items(raw: str):
    """البنود المرقّمة بشرطة في رأس الملاحظة (قبل النص الجديد) لا داخله."""
    lines = raw.split("\n")
    heads = [i for i, ln in enumerate(lines) if re.match(r"^\s*[-•]\s*\S", ln)]
    if len(heads) < 2:
        return [raw]
    parts = []
    for k, i in enumerate(heads):
        j = heads[k + 1] if k + 1 < len(heads) else len(lines)
        parts.append("\n".join(lines[i:j]).strip())
    pre = "\n".join(lines[:heads[0]]).strip()
    if pre:
        parts[0] = pre + "\n" + parts[0]
    return parts


# ── المرفقات ──
def load_attachments():
    att = {}
    for ln in open(ATT / "attachments.jsonl", encoding="utf-8"):
        a = json.loads(ln)
        att[a["id"]] = a
    pages = collections.defaultdict(list)
    for ln in open(ATT / "pages.jsonl", encoding="utf-8"):
        p = json.loads(ln)
        pages[p["attachment_id"]].append(p)
    by_unit = collections.defaultdict(list)
    by_law = collections.defaultdict(list)
    for a in att.values():
        a["pages"] = sorted(pages[a["id"]], key=lambda p: p["page_no"])
        by_law[a["law_guid"]].append(a)
        if a["unit_seq"] is not None:
            by_unit[(a["law_guid"], a["unit_seq"])].append(a)
    return by_unit, by_law


def ocr_hit(a, ins):
    """موضع مرشح للأداة في النص الآلي لصور المرفق: رقمها بصيغتها (م/NN أو «رقم (NN)») وسنتها في الصفحة نفسها.
    يعيد (رقم الصفحة، مقتطف، رابط الصورة) أو None. الأرقام في النص الآلي غير موثوقة؛ الموضع للمطابقة بالصورة لا للاعتماد."""
    if not ins:
        return None
    num = re.sub(r"\D", "", ins["no"])
    year = (ins.get("date") or "")[:4]
    if not num:
        return None
    if ins["kind"] == "مرسوم ملكي" and ins["no"].startswith("م"):
        rx = re.compile(rf"م\s*[/\\]\s*{num}(?!\d)")
    elif ins["kind"] == "أمر ملكي" and ins["no"].startswith("أ"):
        rx = re.compile(rf"[اأ]\s*[/\\]\s*{num}(?!\d)")
    else:
        rx = re.compile(rf"رقم\s*[:：]?\s*[\(\[]?\s*{num}(?!\d)")
    for p in a["pages"]:
        t = (p["ocr_text"] or "").translate(AR_DIGITS)
        m = rx.search(t)
        if m and (not year or year[1:] in t):
            s = max(0, m.start() - 120)
            return p["page_no"], re.sub(r"\s+", " ", t[s:m.end() + 220]), BOE + p["image_url"]
    return None


def ordinal_rx(heading: str | None):
    """نمط يطابق عنوان المادة في النص الآلي: «الثامنة والستون» بصيغتي الرفع والجر، أو رقمها."""
    if not heading:
        return None
    h = norm_map(heading)[0]
    h = re.sub(r"^\s*الماده\s*", "", h).strip(" :：")
    m = re.fullmatch(r"\(?(\d+)\)?", h)
    if m:
        return re.compile(rf"الماده\s*[\(\[]?\s*{m.group(1)}(?!\d)")
    words = [w for w in h.split() if w]
    if not words or len(words) > 6:
        return None
    parts = []
    for w in words:
        w = re.sub(r"(ون|ين)$", "(?:ون|ين)", re.escape(w))
        parts.append(w)
    return re.compile(r"الماده\s*[\(\[]?\s*" + r"\s*".join(parts))


def ocr_article(a, heading):
    """أرجح موضع لعنوان المادة في النص الآلي لصفحات المرفق. يُقدَّم الموضع المسبوق بفعل تعديل أو المتبوع بـ«لتكون بالنص».
    يعيد (رقم الصفحة، مقتطف حتى 900 حرف من النص الآلي الأصلي، رابط الصورة، بصمة الصورة، سياق: أداة تعديل | نص نظام)."""
    rx = ordinal_rx(heading)
    if not rx:
        return None
    best = None
    for p in a["pages"]:
        raw = p["ocr_text"] or ""
        t, idx = norm_map(raw)
        for m in rx.finditer(t):
            before, after = t[max(0, m.start() - 60):m.start()], t[m.end():m.end() + 80]
            score = (2 if re.search(r"تعديل|عدل|اضافه|حذف|الغاء", before) else 0) + (1 if re.search(r"لتكون|ليكون|بالنص|لتصبح", after) else 0)
            if best is None or score > best[0]:
                st = idx[m.start()]
                nl = raw.rfind("\n", max(0, st - 100), st)
                st = nl + 1 if nl >= 0 else max(0, st - 40)  # من أول السطر: «تعديل عجز المادة…»
                best = (score, p["page_no"], re.sub(r"[ \t]+", " ", raw[st:st + 900]).strip(), BOE + p["image_url"], p["image_sha256"])
    if not best:
        return None
    return best[1], best[2], best[3], best[4], ("أداة تعديل" if best[0] >= 2 else "نص نظام أو سياق غير صريح")


def main():
    laws = {json.loads(l)["id"]: json.loads(l) for l in open(P / "law.jsonl", encoding="utf-8")}
    units = {}
    for l in open(P / "unit.jsonl", encoding="utf-8"):
        u = json.loads(l)
        units[(u["law_id"], u["seq"])] = u
    notes = [json.loads(l) for l in open(P / "amendment_note.jsonl", encoding="utf-8")]
    todo = [n for n in notes if n["needs_review"]]
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    by_unit, by_law = load_attachments()
    vision = {}
    if VISION.exists():
        for l in open(VISION, encoding="utf-8"):
            v = json.loads(l)
            vision[v["note_id"]] = v
    sha_url = {}
    for l in open(ATT / "pages.jsonl", encoding="utf-8"):
        pg = json.loads(l)
        sha_url[pg["image_sha256"]] = BOE + pg["image_url"]
    law_instr = collections.defaultdict(set)   # أدوات كل نظام من كل ملاحظاته (للاستدلال على أداة غير مذكورة)
    for n in notes:
        for i in instruments(norm_map(n["note_text"])[0]):
            law_instr[n["law_id"]].add((i["kind"], i["no"], i["date"]))
    rows = []
    for n in todo:
        raw = n["note_text"]
        law = laws[n["law_id"]]
        unit = units.get((n["law_id"], n["unit_seq"]), {})
        nt_all, head_all = new_text(raw)
        head_all_norm = norm_map(head_all)[0]
        ins_all = instruments(norm_map(raw if nt_all is None else head_all)[0]) or instruments(norm_map(raw)[0])
        items = split_items(head_all) if nt_all is None else split_items(head_all)
        # الفئة الأصلية (سبب الإحالة للمراجعة)
        bullets_head = len(re.findall(r"(?m)^\s*[-•]\s", head_all))
        if len({(i["kind"], i["no"]) for i in ins_all}) > 1 or bullets_head > 1:
            cat = 1
        elif not ins_all:
            cat = 2
        elif n["effect"] in ("amend_article", "amend_paragraph", "amend_definition") and not n["new_text"]:
            cat = 3
        else:
            cat = 4
        eff_list = split_effect_list(raw)
        if eff_list:
            cat = 1
        pieces = eff_list or [(None, x) for x in (items if (cat == 1 and len(items) > 1 and nt_all is None) else [raw])]
        for k, (pre, piece) in enumerate(pieces, start=1):
            nt, head = new_text(piece)
            hn = norm_map(head)[0]
            ins = instruments(hn) or instruments(norm_map(piece)[0]) or (instruments(norm_map(pre)[0]) if pre else []) or (ins_all if len(pieces) == 1 else [])
            eff, why = effect_of(hn, nt is not None, norm_map(piece)[0])
            if nt is None and eff in PHRASE_EFFECTS:
                nt = phrase_of(eff, piece)
            if pre:
                piece = pre + "\n" + piece
            ov = overrides.get(n["id"] if len(pieces) == 1 else f"{n['id']}#{k}")
            # الدليل من المرفقات: أداة المادة أولًا، ثم أي مرفق في النظام نفسه يذكر رقم الأداة
            att_hit = None
            cands = by_unit.get((law["guid"], n["unit_seq"]), [])
            for a in cands + [a for a in by_law.get(law["guid"], []) if a not in cands and a["kind"] == "amending_instrument"]:
                h = ocr_hit(a, ins[0] if ins else None)
                if h:
                    att_hit = (a, *h)
                    break
            unit_att = cands[0] if cands else None
            art_hit = None
            if nt is None and eff in TEXT_EFFECTS:
                for a in cands:
                    art_hit = ocr_article(a, unit.get("heading"))
                    if art_hit:
                        break
            conf, reason = "مؤكد", ""
            if eff in ("غير مصنف", "نص مادة معروض بلا صيغة تعديل", "إلغاء جزئي", "قرار صادر بشأن المادة"):
                conf, reason = "يحتاج قرار المالك", {"غير مصنف": "الأثر غير صريح في الملاحظة",
                                                      "نص مادة معروض بلا صيغة تعديل": "الملاحظة نص مادة بلا أداة ولا فعل تعديل",
                                                      "إلغاء جزئي": "الإلغاء لجزء غير محدد نصًا من المادة",
                                                      "قرار صادر بشأن المادة": "الملاحظة تذكر قرارًا صادرًا بشأن المادة ولا تذكر أثره"}[eff]
            elif not ins:
                cand = sorted(law_instr.get(n["law_id"], set()), key=lambda x: x[2] or "")
                if len(cand) == 1:
                    k0, no0, d0 = cand[0]
                    ins = [{"kind": k0, "no": no0, "date": d0}]
                    conf, reason = "مرجّح", "الأداة غير مذكورة في الملاحظة؛ استُنتجت لأنها الأداة الوحيدة في ملاحظات النظام نفسه"
                    if eff in TEXT_EFFECTS and nt is None:
                        conf = "يحتاج قرار المالك"
                else:
                    conf = "يحتاج قرار المالك"
                    reason = "الأداة غير مذكورة في الملاحظة" + (("؛ أدوات النظام المرشحة: " + "، ".join(f"{a} {b} {c or ''}".strip() for a, b, c in cand[-4:])) if cand else "، ولا أداة في ملاحظات النظام")
            elif eff in TEXT_EFFECTS and nt is None:
                conf = "يحتاج قرار المالك"
                reason = (("النص الجديد غير مذكور في الملاحظة؛ عنوان المادة في صورة المرفق (ص " + str(art_hit[0]) + "، السياق: " + art_hit[4] + ")، والمقتطف الآلي مسودة تُطابق بالصورة ثم يُنقل النص حرفيًا") if art_hit else
                          ("النص الجديد غير مذكور في الملاحظة؛ موضع مرشح للأداة في صورة المرفق (ص " + str(att_hit[1]) + ")، ويُنقل النص حرفيًا بعد المطابقة بالصورة"
                          if att_hit else ("النص الجديد غير مذكور؛ للمادة مرفق أداة يلزم قراءته" if unit_att else "النص الجديد غير مذكور، ولا مرفق للأداة")))
            elif eff == "إحلال عبارة" and nt is None:
                conf, reason = "مرجّح", "العبارة الجديدة غير محاطة بعلامات تنصيص؛ تُقرأ من الدليل"
            elif "+" in eff or eff in ("إجراء إداري لا يمس النص", "تفسير", "دمج مواد", "إعادة ترقيم", "تعديل جدول"):
                conf = "مرجّح"
            if ov:
                eff = ov.get("effect", eff)
                conf = ov.get("confidence", conf)
                reason = ov.get("reason", reason)
                why = "قراءة يدوية"
            vis = vision.get(n["id"] if len(pieces) == 1 else f"{n['id']}#{k}")
            vision_cols = {}
            if vis and nt is None:
                img = [sha_url.get(x.split(".")[0]) for x in vis["images"]]
                img = [u for u in img if u]
                pages_s = "، ".join(str(x) for x in (vis["pages"] or []))
                vision_cols = {"vision_status": vis["status"], "instrument_seen": vis["instrument_seen"], "vision_verify": VERDICT_AR.get(vis["verify"], vis["verify"]),
                               "vision_lead_in": vis["lead_in"], "vision_fixes": "؛ ".join(vis["fixes_applied"]), "vision_notes": vis["notes"]}
                if img:
                    art_hit = (vis["pages"][0] if vis["pages"] else None, None, img[0], None)
                if vis["status"] in ("found", "partial") and vis["instrument_match"] and vis["new_text"]:
                    nt = vis["new_text"]
                    conf = "مرجّح"
                    reason = (f"منقول من صورة الأداة (ص {pages_s}) قراءةً بصرية، وتحقق منه قارئ مستقل: {VERDICT_AR.get(vis['verify'], 'لم يُتحقق منه')}"
                              + ("؛ النص جزء من المادة لا المادة كلها" if vis["status"] == "partial" or "جزء" in (vis["notes"] or "") else "")
                              + "؛ يطابقه المالك بالصورة قبل الاعتماد")
                elif vis["status"] == "not_applicable":
                    eff, conf, reason = "قرار تطبيق لا يعدّل النص", "مرجّح", vis["notes"]
                elif vis["status"] == "wrong_article":
                    conf, reason = "يحتاج قرار المالك", vis["notes"]
                    vision_cols["vision_other_text"] = vis["new_text"]
                elif vis["instrument_match"] is False:
                    conf = "يحتاج قرار المالك"
                    reason = f"مرفق الهيئة لهذه المادة أداة أخرى ({vis['instrument_seen']})، فلا يُنسب نصها لأداة الملاحظة؛ نص الأداة الأخرى في عمود «نص من الصورة»"
                    vision_cols["vision_other_text"] = vis["new_text"]
                else:
                    conf = "يحتاج قرار المالك"
                    reason = "قُرئت صورة الأداة ولم يوجد فيها نص جديد للمادة: " + (vis["notes"] or "")
                    vision_cols["vision_other_text"] = vis["new_text"]
            first = ins[0] if ins else {}
            rows.append({
                "note_id": n["id"] if len(pieces) == 1 else f"{n['id']}#{k}",
                "category": cat, "law": law["name"], "law_url": law["url"], "unit": unit.get("heading"),
                "effect": eff, "effect_basis": why,
                "instrument": (f"{first.get('kind')} رقم ({first.get('no')})" if first else None),
                "instrument_date": first.get("date"),
                "all_instruments": "؛ ".join(f"{i['kind']} {i['no']} {i['date'] or ''}".strip() for i in ins),
                "new_text": nt, "evidence": piece[:1500], "source": law["url"],
                "attachment_url": (BOE + unit_att["href"]) if unit_att else (BOE + att_hit[0]["href"] if att_hit else None),
                "ocr_page": att_hit[1] if att_hit else None, "ocr_excerpt": att_hit[2] if att_hit else None,
                "page_image": att_hit[3] if att_hit else None,
                "draft_page": art_hit[0] if art_hit else None, "draft_ocr": art_hit[1] if art_hit else None,
                "draft_image": art_hit[2] if art_hit else None, "draft_sha": art_hit[3] if art_hit else None,
                "confidence": conf, "reason": reason, **vision_cols,
                "old_effect": n["effect"],
            })
    out = ROOT / "data" / "review"
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "proposals.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    c = collections.Counter((r["category"], r["confidence"]) for r in rows)
    print(len(todo), "ملاحظة →", len(rows), "صف")
    for k in sorted(c):
        print(k, c[k])
    print(collections.Counter(r["effect"] for r in rows).most_common())
    return rows


if __name__ == "__main__":
    main()
