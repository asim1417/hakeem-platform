#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
engines.py — سجلّ محرّكات القراءة القابلة للتوصيل (Pluggable OCR Engines).

الفلسفة (وفق التقرير التقني §4-5): المنصّة قائمة على «مزوّدين». هذا الملف يوحّد
اختيار المحرّك خلف واجهة واحدة، فتصبح إضافة محرّكٍ جديد (QARI-OCR على GPU، أو نموذج
عربي سيادي مثل ALLaM) «توصيلةً» register(...) واحدة — لا إعادة بناء.

كل محرّك يوفّر:
  available() -> bool          هل هو جاهز للاستعمال الآن؟ (مفتاح/نقطة نهاية مضبوطة)
  run(name, data, model)       يعيد (نص, وصف). يرفع استثناءً عند الفشل.
  needs_gpu / remote           سمات للعرض والحوكمة (خصوصية: remote يرسل البيانات خارجاً)

المحرّكات المسجّلة:
  local  : بايثون + Tesseract (محلّي، خصوصية كاملة، لا إنترنت) — متاح دائماً.
  gemini : رؤية سحابية (يتطلّب GEMINI_API_KEY) — قويّ للممسوح والخطّ اليدوي.
  qari   : QARI-OCR عربي على GPU (يتطلّب QARI_ENDPOINT) — أعلى دقّة عربية مفتوحة.
           لا يُفعَّل ما لم تُضبط نقطة نهايته (مضيف GPU: RunPod/Modal/Replicate).
"""
import os
import io
import json
import base64
import urllib.request
import urllib.error


class Engine:
    """محرّك قراءةٍ واحد بواجهة موحّدة."""

    def __init__(self, name, label, available, run, needs_gpu=False, remote=False):
        self.name = name
        self.label = label
        self.available = available  # callable -> bool
        self.run = run  # callable(name, data, model) -> (text, kind)
        self.needs_gpu = needs_gpu
        self.remote = remote  # يرسل البيانات لخادم خارجي (اعتبار خصوصية)


_REGISTRY = {}


def register(engine):
    """يسجّل محرّكاً (أو يستبدل موجوداً بنفس الاسم)."""
    _REGISTRY[engine.name] = engine


def get(name):
    return _REGISTRY.get(name)


def providers_status():
    """حالة كل المزوّدين للعرض في /api/providers — الاسم → متاح؟ (توافقاً مع الواجهة)."""
    return {name: eng.available() for name, eng in _REGISTRY.items()}


def providers_detail():
    """تفاصيل غنيّة لكل مزوّد (للوحة إدارة أو حوكمة الخصوصية)."""
    return [
        {
            "name": e.name,
            "label": e.label,
            "available": e.available(),
            "needs_gpu": e.needs_gpu,
            "remote": e.remote,
        }
        for e in _REGISTRY.values()
    ]


# ───────────────────────── المحرّك المحلّي (افتراضي، متاح دائماً) ─────────────────────────
def _run_local(name, data, model):
    from doc_reader import read_bytes, clean_text

    txt, kind = read_bytes(name, data)
    return clean_text(txt or ""), kind


register(Engine("local", "محلّي (بايثون + Tesseract)", lambda: True, _run_local, remote=False))


# ───────────────────────── محرّك Gemini (سحابي، اختياري) ─────────────────────────
def _gemini_available():
    try:
        from gemini_provider import gemini_available

        return gemini_available()
    except Exception:
        return False


def _run_gemini(name, data, model):
    from gemini_provider import extract_with_gemini
    from doc_reader import clean_text

    txt = extract_with_gemini(name, data, model_type=model or "flash")
    return clean_text(txt or ""), "Gemini %s" % (model or "flash")


register(Engine("gemini", "Gemini (رؤية سحابية)", _gemini_available, _run_gemini, remote=True))


# ───────────────────────── مقبس QARI-OCR (عربي دقيق — GPU) ─────────────────────────
# لا يُفعَّل ما لم تُضبط QARI_ENDPOINT (خدمة مستضافة على GPU تستقبل صورة/PDF وتعيد نصاً).
# التنسيق المتوقّع: POST JSON {file_b64, mime, model} → {text}. عدّله حسب مضيفك.
def _qari_available():
    return bool(os.environ.get("QARI_ENDPOINT", "").strip())


def _run_qari(name, data, model, timeout=180):
    endpoint = os.environ.get("QARI_ENDPOINT", "").strip()
    if not endpoint:
        raise RuntimeError("QARI_ENDPOINT غير مضبوط — فعّل محرّك QARI بنشره على مضيف GPU")
    from doc_reader import clean_text

    ext = os.path.splitext(name or "")[1].lower()
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf"}.get(ext)
    if not mime:
        raise RuntimeError("QARI يقبل PNG/JPG/PDF فقط — استخدم المحلّي لغيرها")
    body = json.dumps(
        {"file_b64": base64.b64encode(data).decode("ascii"), "mime": mime, "model": model or "v0.3"}
    ).encode("utf-8")
    token = os.environ.get("QARI_TOKEN", "").strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer %s" % token
    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError("QARI أعاد %s" % e.code)
    text = (payload.get("text") or "").strip()
    if not text:
        raise RuntimeError("لم يُعِد QARI نصاً — تأكد من وضوح الوثيقة")
    return clean_text(text), "QARI-OCR %s" % (model or "v0.3")


register(Engine("qari", "QARI-OCR (عربي دقيق — GPU)", _qari_available, _run_qari, needs_gpu=True, remote=True))


# ───────────────────────── المُوزِّع الموحّد ─────────────────────────
def _dispatch(provider, model, name, data):
    from doc_reader import read_bytes, clean_text

    eng = get(provider)
    if eng and eng.name != "local":
        if not eng.available():
            txt, kind = read_bytes(name, data)
            return clean_text(txt or ""), (kind + " (المزوّد %s غير مُفعّل — استُعمل المحلّي)" % eng.name)
        try:
            return eng.run(name, data, model)
        except Exception as e:
            txt, kind = read_bytes(name, data)
            note = "(تعذّر %s: %s — استُعمل المحلّي)" % (eng.name, str(e)[:80])
            return clean_text(txt or ""), (kind + " " + note)
    # local (أو مزوّد غير معروف → افتراضي محلّي)
    txt, kind = read_bytes(name, data)
    return clean_text(txt or ""), kind


def process(provider, model, name, data):
    """
    يشغّل المحرّك المطلوب (مع تراجعٍ منظّم للمحلّي)، ثم يحذف أرقام هامش الأسطر
    المتسلسلة عند كل المسارات — محافظ: لا يمسّ أي رقمِ متن.
    """
    from doc_reader import strip_margin_line_numbers, reflow_wrapped_lines

    text, kind = _dispatch(provider, model, name, data)
    text = strip_margin_line_numbers(text or "")
    text = reflow_wrapped_lines(text)
    return text, kind
