#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
doc_reader.py — العقل: قراءة الوثائق العربية واستخراج نصّها وتنظيفه.
بلا واجهة ولا خادم — بايثون خالص. استعمله كمكتبة أو من سطر الأوامر.

يدعم:  نص (.txt .md .csv .json) · Word (.docx) · PDF (نصّي وممسوح) · صور (OCR).
يُخرج نصاً منظَّفاً (تطبيع عربي) + صيغة تطبيع للبحث.

استعمال كمكتبة:
    from doc_reader import read_file, read_bytes, clean_text, norm
    text, kind = read_file("قرار.pdf")
    print(clean_text(text))

من سطر الأوامر:
    python doc_reader.py ملف.pdf                 # يطبع النص المنظَّف
    python doc_reader.py مجلد/ --json out.jsonl  # يمشي على كل الوثائق ويكتب JSONL

المتطلبات الأساسية: python-docx · pdfminer.six
اختياري للـPDF الممسوح والصور: pytesseract + pdf2image + Pillow
(وحزم النظام: tesseract-ocr · tesseract-ocr-ara · poppler-utils)
"""
import os
import io
import re
import sys
import json

# ───────────────────────── تنظيف / تطبيع عربي ─────────────────────────
# علامات اتجاه/تحكّم خفيّة تُفسِد النص المستخرَج من OCR والـPDF — تُحذف.
_STRIP = dict.fromkeys([
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f,          # ZWSP/ZWNJ/ZWJ/LRM/RLM
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e,          # LRE/RLE/PDF/LRO/RLO
    0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,          # LRI/RLI/FSI/PDI/BOM
], None)

# حروف فارسية/أردية شبيهة بالعربية تُوحَّد إلى نظيرتها العربية.
_LOOK = {"ھ": "ه", "ہ": "ه", "ۀ": "ه", "ۃ": "ة",
         "ی": "ي", "ۍ": "ي", "ک": "ك"}

# أرقام فارسية (۰-۹) → أرقام عربية (٠-٩).
_PDIG = {0x06F0 + i: chr(0x0660 + i) for i in range(10)}


def clean_text(t):
    """تنظيف يحافظ على شكل النص للعرض: يزيل علامات الاتجاه، ويوحّد الحروف
    الشبيهة والأرقام الفارسية. لا يحذف التشكيل ولا يغيّر الإملاء."""
    if not t:
        return t
    t = t.translate(_STRIP)
    for a, b in _LOOK.items():
        t = t.replace(a, b)
    return t.translate(_PDIG)


def norm(s):
    """تطبيع للبحث/المطابقة: يحذف التشكيل والتطويل، ويوحّد الهمزات والألف
    والتاء المربوطة والألف المقصورة والياء. يُستعمل للفهرسة لا للعرض."""
    out = []
    for ch in s or "":
        c = ord(ch)
        if 0x064B <= c <= 0x0652 or c in (0x0640, 0x0670):   # تشكيل + تطويل + ألف خنجرية
            continue
        out.append({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
                    "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"}.get(ch, ch.lower()))
    return "".join(out)


# ───────────────────────── استخراج النص من الملفات ─────────────────────────
TEXT_EXT = (".txt", ".md", ".csv", ".json")
IMG_EXT = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp")
SUPPORTED = TEXT_EXT + (".docx", ".pdf") + IMG_EXT

_AR_RE = re.compile(r"[؀-ۿ]")   # نطاق الحروف العربية


def read_bytes(name, data):
    """يستخرج النص الخام من محتوى ملف (بايتات) حسب امتداد الاسم.
    يُعيد (نص, نوع). النص منظَّف من الرموز الغريبة والعلامات الخفيّة."""
    ext = os.path.splitext(name)[1].lower()
    try:
        if ext in TEXT_EXT:
            txt = data.decode("utf-8", "ignore")
            return clean_text(txt), "نص"
        if ext == ".docx":
            txt = _read_docx(data)
            return clean_text(txt), "Word"
        if ext == ".pdf":
            txt = _read_pdf_text(data)
            if len(_AR_RE.findall(txt)) > 30:      # نصّي فعلاً؟
                return clean_text(txt), "PDF (نص)"
            return _ocr_pdf(data)                  # وإلا: ممسوح → OCR
        if ext in IMG_EXT:
            return _ocr_image(data)
    except Exception as e:
        return "", "تعذّر (%s)" % str(e)[:60]
    return "", "صيغة غير مدعومة"


def read_file(path):
    """يقرأ ملفاً من القرص ويستخرج نصه. يُعيد (نص, نوع)."""
    with open(path, "rb") as f:
        return read_bytes(os.path.basename(path), f.read())


def _read_docx(data):
    from docx import Document
    d = Document(io.BytesIO(data))
    parts = [p.text for p in d.paragraphs]
    # نلتقط نص الجداول أيضاً (كثير من الوثائق القانونية جداول).
    for tbl in d.tables:
        for row in tbl.rows:
            parts.append("\t".join(c.text for c in row.cells))
    text = "\n".join(parts)
    # تأكد من الترميز وتنظيف الرموز
    if isinstance(text, bytes):
        text = text.decode("utf-8", "ignore")
    return text


def _read_pdf_text(data):
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(io.BytesIO(data)) or ""
        # تأكد من أن النص UTF-8 صحيح
        if isinstance(text, bytes):
            text = text.decode("utf-8", "ignore")
        # نظّف العلامات الخفيّة والرموز الغريبة
        return clean_text(text)
    except Exception:
        return ""


# إعداد Tesseract للعربية: LSTM (oem 1) + كتلة نصٍّ موحّدة (psm 6) — أدقّ للوثائق الكثيفة.
_TESS_CFG = "--oem 1 --psm 6"


def _prep(img):
    """تحسينٌ يرفع دقّة القراءة: تدرّج رمادي + تمديد تباين + حدّة يسيرة (أقوى للحبر الباهت)."""
    from PIL import ImageOps, ImageFilter
    g = ImageOps.grayscale(img)
    g = ImageOps.autocontrast(g, cutoff=1)
    return g.filter(ImageFilter.SHARPEN)


def _ocr_img_obj(img):
    import pytesseract
    text = pytesseract.image_to_string(_prep(img), lang="ara", config=_TESS_CFG)
    # نظّف النص من الرموز الغريبة والعلامات الخفيّة
    return clean_text(text) if text else ""


def _ocr_image(data):
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data)).convert("RGB")
        return _ocr_img_obj(img), "صورة (OCR)"
    except Exception:
        return "", "صورة — تحتاج OCR (ثبّت pytesseract + tesseract-ocr-ara)"


def _ocr_pdf(data):
    try:
        from pdf2image import convert_from_bytes
        # دقّة 300 (بدل 200) تُبرز التشكيل والنقاط في النصّ العربي الكثيف
        pages = convert_from_bytes(data, dpi=300)
        return "\n".join(_ocr_img_obj(p) for p in pages), "PDF ممسوح (OCR)"
    except Exception:
        return "", "PDF ممسوح — تحتاج OCR (pytesseract + pdf2image + poppler)"


# ───────────────────────── واجهة عالية المستوى ─────────────────────────
def extract(path):
    """يقرأ ملفاً ويُعيد قاموساً جاهزاً: العنوان والنوع والنص المنظَّف
    وصيغة التطبيع للبحث وعدد الأحرف."""
    text, kind = read_file(path)
    # النص بالفعل منظَّف من read_file، لا تطبّق clean_text مرتين
    text = text or ""
    return {
        "title": os.path.basename(path),
        "kind": kind,
        "text": text,          # منظَّف للعرض
        "search": norm(text),  # مطبَّع للبحث
        "chars": len(text),
        "ok": bool(text.strip()),
    }


def walk(folder):
    """يمشي على مجلد (بما فيه الفرعية) ويستخرج كل وثيقة مدعومة. مولِّد."""
    for root, _dirs, files in os.walk(folder):
        for fn in sorted(files):
            if os.path.splitext(fn)[1].lower() in SUPPORTED:
                yield extract(os.path.join(root, fn))


# ───────────────────────── سطر الأوامر ─────────────────────────
def _main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    target = argv[0]
    out_json = None
    if "--json" in argv:
        out_json = argv[argv.index("--json") + 1]

    if os.path.isdir(target):
        recs = list(walk(target))
        if out_json:
            with open(out_json, "w", encoding="utf-8") as f:
                for r in recs:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            ok = sum(1 for r in recs if r["ok"])
            print("عولجت %d وثيقة (نجح الاستخراج في %d) → %s" % (len(recs), ok, out_json))
        else:
            for r in recs:
                print("• %-40s [%s] %d حرف %s" % (
                    r["title"][:40], r["kind"], r["chars"], "" if r["ok"] else "⚠"))
    else:
        r = extract(target)
        if out_json:
            with open(out_json, "w", encoding="utf-8") as f:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
            print("→ %s (%s، %d حرف)" % (out_json, r["kind"], r["chars"]))
        else:
            sys.stdout.write(r["text"])
            if not r["ok"]:
                sys.stderr.write("\n[%s: لم يُستخرَج نص]\n" % r["kind"])
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
