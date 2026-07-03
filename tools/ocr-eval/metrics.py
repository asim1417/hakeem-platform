#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
metrics.py — مقاييس دقة الاستخراج النصي، مضبوطة للعربية.

يستخدم مكتبات موثوقة عند توفّرها:
  - rapidfuzz  → مسافة التحرير (أساس CER)، أسرع بكثير من التنفيذ اليدوي.
  - jiwer      → معدّل خطأ الكلمات WER القياسي.
مع **تراجع آمن** إلى تنفيذ بايثون خام إن غابت المكتبتان (فتبقى الأداة عاملة دائماً).

التطبيع العربي (normalize_ar) يبقى من إعدادنا؛ إذ لا مكتبة عامة تعالج التطبيع
القانوني العربي (الهمزات، التاء المربوطة، التشكيل، الأرقام المشرقية) بما نحتاجه.
"""
import re
import unicodedata

# ---- كشف المكتبات الاختيارية ----
try:
    from rapidfuzz.distance import Levenshtein as _RF_LEV
    _HAS_RF = True
except Exception:
    _HAS_RF = False

try:
    import jiwer as _JIWER
    _HAS_JIWER = True
except Exception:
    _HAS_JIWER = False


def backends():
    """يبيّن أي مكتبات قياس مفعّلة."""
    return {"rapidfuzz": _HAS_RF, "jiwer": _HAS_JIWER}


# ---- التطبيع العربي (من إعدادنا) ----
_TASHKEEL = "".join(chr(c) for c in range(0x064B, 0x0653)) + "\u0670\u0640"
_STRIP_DIR = dict.fromkeys(
    [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c,
     0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff], None)
_LOOKALIKE = {"ھ": "ه", "ہ": "ه", "ۀ": "ه", "ۃ": "ة", "ی": "ي", "ک": "ك", "ﻻ": "لا"}
_PDIG = {0x06F0 + i: chr(0x0660 + i) for i in range(10)}
_ADIG = {0x0660 + i: str(i) for i in range(10)}


def normalize_ar(text, level="full"):
    """تطبيع عربي متدرّج: raw (اتجاهي) / mid (+تشكيل ومتشابهات) / full (+توحيد الحروف والأرقام)."""
    t = unicodedata.normalize("NFKC", text or "")
    t = t.translate(_STRIP_DIR)
    if level == "raw":
        return re.sub(r"[ \t]+", " ", t).strip()
    for a, b in _LOOKALIKE.items():
        t = t.replace(a, b)
    t = t.translate(_PDIG)
    t = "".join(ch for ch in t if ch not in _TASHKEEL)
    if level == "mid":
        return re.sub(r"[ \t]+", " ", t).strip()
    t = t.translate(_ADIG)
    trans = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"}
    t = "".join(trans.get(ch, ch) for ch in t)
    return re.sub(r"\s+", " ", t).strip()


# ---- مسافة التحرير: rapidfuzz إن وُجد، وإلا بايثون خام ----
def _edit_distance(a, b):
    if _HAS_RF:
        return _RF_LEV.distance(a, b)
    # تراجع: سطران بذاكرة O(min)
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if la == 0 or lb == 0:
        return la or lb
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i] + [0] * lb
        ai = a[i - 1]
        for j in range(1, lb + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (0 if ai == b[j - 1] else 1))
        prev = cur
    return prev[lb]


def cer(ref, hyp, level="full"):
    """معدّل خطأ الأحرف = مسافة التحرير / أحرف المرجع (0 = مطابقة تامة)."""
    r = normalize_ar(ref, level)
    h = normalize_ar(hyp, level)
    if len(r) == 0:
        return 0.0 if len(h) == 0 else 1.0
    return _edit_distance(r, h) / len(r)


def wer(ref, hyp, level="full"):
    """معدّل خطأ الكلمات — jiwer إن وُجد، وإلا مسافة تحرير على مستوى الكلمات."""
    r = normalize_ar(ref, level)
    h = normalize_ar(hyp, level)
    if not r.split():
        return 0.0 if not h.split() else 1.0
    if _HAS_JIWER:
        try:
            return float(_JIWER.wer(r, h))
        except Exception:
            pass
    rt, ht = r.split(), h.split()
    return _edit_distance(rt, ht) / len(rt)


def accuracy_pct(ref, hyp, level="full"):
    return max(0.0, min(100.0, (1.0 - cer(ref, hyp, level)) * 100.0))


def entity_prf(gold, pred):
    """دقة/استرجاع/F1 على مجموعتَي كيانات (أطراف/مبالغ/صكوك)، بعد التطبيع."""
    g = {normalize_ar(x, "full") for x in gold if str(x).strip()}
    p = {normalize_ar(x, "full") for x in pred if str(x).strip()}
    if not g and not p:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "tp": 0, "fp": 0, "fn": 0}
    tp, fp, fn = len(g & p), len(p - g), len(g - p)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return {"precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4), "tp": tp, "fp": fp, "fn": fn}


if __name__ == "__main__":
    print("المكتبات المفعّلة:", backends())
    ref = "حكمت الدائرة برفض الدعوى المقامة من شركة الأفق التجارية"
    hyp = "حكمت الدائره برفض الدعوي المقامه من شركة الأفق التجاريه"
    print("CER خام :", round(cer(ref, hyp, "raw"), 4))
    print("CER مُطبَّع:", round(cer(ref, hyp, "full"), 4))
    print("WER مُطبَّع:", round(wer(ref, hyp, "full"), 4))
    print("دقة% مُطبَّع:", round(accuracy_pct(ref, hyp, "full"), 2))
    print("كيانات:", entity_prf(["شركة الأفق التجارية", "مؤسسة النخبة"], ["شركة الافق التجاريه", "شركة ثالثة"]))
