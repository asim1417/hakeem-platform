#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gemini_provider.py — مزوّد Gemini الإضافي للخدمة (اختياري).

بلا أي تبعية خارجية (urllib من المكتبة القياسية فقط). يُقرأ المفتاح من البيئة
GEMINI_API_KEY. يطبّق نفس ضبط مسار الويب في المنصّة:
  - flash: تعطيل «التفكير» (thinkingBudget=0) — OCR إدراكٌ لا استدلال، فالتفكير
    يبتلع رصيد المخرجات ويُبطئ ويُرجِع نصّاً فارغاً/مبتوراً.
  - سقف مخرجاتٍ مرتفع يمنع البتر في الصفحات الكثيفة.
  - توجيهٌ بسلامةٍ قانونية: لا تخمين للأرقام/المبالغ/التواريخ/الصكوك/الأعلام.
"""
import os
import json
import base64
import urllib.request
import urllib.error

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

OCR_PROMPT = (
    "أنت محرّك OCR احترافي للمستندات الرسمية والقانونية العربية. استخرج كل النصوص كنصّ خام "
    "بأعلى دقة، محافظاً على ترتيب الأسطر والفقرات والجداول. تنبيه حاسم (وثيقة قانونية): لا "
    "تُصحِّح ولا تُخمِّن الأرقامَ والمبالغَ والتواريخَ الهجرية وأرقامَ الصكوك والأعلامَ وأسماءَ "
    "الأطراف — انقلها حرفياً كما تراها؛ إن تعذّرت قراءة رقم فاكتب [غير واضح] بدل تخمينه. "
    "أخرِج النص مباشرة دون مقدمات أو تعليقات."
)

_MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
}


def gemini_available():
    """هل المفتاح مضبوط؟ (لعرض المزوّد كخيار متاح)"""
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _gen_config(model_type):
    cfg = {"temperature": 0.1, "topP": 0.95, "maxOutputTokens": 16384}
    if model_type != "pro":  # pro لا يقبل تعطيل التفكير — يُترك ديناميكياً
        cfg["thinkingConfig"] = {"thinkingBudget": 0}
    return cfg


def mime_for(name):
    ext = os.path.splitext(name or "")[1].lower()
    return _MIME_BY_EXT.get(ext)


def _img_part(data, mime):
    return {"inline_data": {"data": base64.b64encode(data).decode("ascii"), "mime_type": mime}}


def _gemini_generate(parts, model_type, key, timeout):
    """نداءٌ واحد لـ Gemini على قائمة أجزاء (صورة/نص). يعيد النصّ أو يرفع استثناءً."""
    model = "gemini-2.5-pro" if model_type == "pro" else "gemini-2.5-flash"
    body = {"contents": [{"parts": parts}], "generationConfig": _gen_config(model_type)}
    url = "%s/%s:generateContent?key=%s" % (GEMINI_BASE, model, key)
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", "")
        except Exception:
            pass
        raise RuntimeError("Gemini أعاد %s%s" % (e.code, (" — " + detail) if detail else ""))
    cand = (payload.get("candidates") or [{}])[0]
    parts_out = ((cand.get("content") or {}).get("parts")) or []
    text = "".join(p.get("text", "") for p in parts_out).strip()
    if not text:
        if cand.get("finishReason") == "MAX_TOKENS":
            raise RuntimeError("انقطعت استجابة Gemini قبل النصّ (حدّ المخرجات)")
        raise RuntimeError("لم يُعِد Gemini نصاً — تأكد من وضوح الوثيقة")
    return text


def _render_pdf_to_jpegs(data, dpi=200):
    """يرسم صفحات PDF صوراً JPEG (يتطلّب pdf2image + poppler). يرفع عند تعذّره."""
    import io
    from pdf2image import convert_from_bytes

    out = []
    for im in convert_from_bytes(data, dpi=dpi):
        buf = io.BytesIO()
        im.convert("RGB").save(buf, format="JPEG", quality=90)
        out.append(buf.getvalue())
    return out


def extract_with_gemini(name, data, model_type="flash", timeout=120):
    """
    يرسل ملفاً (صورة/PDF) إلى Gemini ويعيد النصّ. يرفع استثناءً عند الفشل.
    للـ PDF: يرسم الصفحات صوراً ويرسلها (رؤية حقيقية) بدل الـ PDF الخام.
    """
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GEMINI_API_KEY غير مضبوط — فعّل مزوّد Gemini بضبط المفتاح")
    mime = mime_for(name)
    if not mime:
        raise RuntimeError("Gemini يقبل PNG/JPG/PDF فقط — استخدم المزوّد المحلّي لغيرها")

    if mime == "application/pdf":
        # رؤية حقيقية: نرسم كل صفحة صورةً ونرسلها — لا نرسل الـ PDF الخام. طبقات النصّ
        # العربية كثيراً ما تكون بترتيبٍ بصريٍّ معكوس ومُضاعَف (InDesign)، وإرسال الـ PDF
        # الخام يجعل Gemini يقرأ تلك الطبقة المعطوبة فيرث عطبها. الرسم كصورةٍ يُجبره على
        # الرؤية الحقيقية فيقرأ سليماً.
        pages = None
        try:
            pages = _render_pdf_to_jpegs(data)
        except Exception:
            pages = None  # بلا poppler → نتراجع لإرسال الـ PDF الخام
        if pages:
            parts_text = []
            for i, img in enumerate(pages, 1):
                txt = _gemini_generate([_img_part(img, "image/jpeg"), {"text": OCR_PROMPT}], model_type, key, timeout)
                parts_text.append("[صفحة %d]\n%s" % (i, txt))
            return "\n\n".join(parts_text)

    # صورة، أو PDF تعذّر رسمه: أرسل الملف كما هو
    return _gemini_generate([_img_part(data, mime), {"text": OCR_PROMPT}], model_type, key, timeout)
