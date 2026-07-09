#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اختبارات سجلّ المحرّكات + التنظيف — تُشغَّل بـ: python3 test_engines.py
حتمية بالكامل: لا شبكة ولا مفاتيح (المحلّي فقط).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

passed = 0


def check(name, fn):
    global passed
    try:
        fn()
        passed += 1
        print("✓ %s" % name)
    except Exception as e:
        print("✗ %s\n   %s" % (name, e))
        raise


import engines
from doc_reader import clean_text, norm


# ── السجلّ ──
def _registry_has_core():
    assert engines.get("local") is not None, "المحرّك المحلّي يجب أن يكون مسجّلاً"
    assert engines.get("gemini") is not None, "محرّك Gemini يجب أن يكون مسجّلاً"
    assert engines.get("qari") is not None, "مقبس QARI يجب أن يكون مسجّلاً"


check("السجلّ: المحرّكات الأساسية مسجّلة (local/gemini/qari)", _registry_has_core)


def _local_always_available():
    assert engines.get("local").available() is True


check("المحلّي متاح دائماً", _local_always_available)


def _remote_flags():
    assert engines.get("local").remote is False, "المحلّي لا يرسل بيانات خارجاً"
    assert engines.get("gemini").remote is True, "Gemini بعيد (خصوصية)"
    assert engines.get("qari").needs_gpu is True, "QARI يحتاج GPU"


check("سمات الخصوصية/العتاد صحيحة", _remote_flags)


def _gemini_disabled_without_key():
    # بلا مفتاح، gemini غير متاح — والتوزيع يتراجع للمحلّي بتنبيه صريح.
    os.environ.pop("GEMINI_API_KEY", None)
    assert engines.get("gemini").available() is False


check("Gemini غير متاح بلا مفتاح", _gemini_disabled_without_key)


def _qari_disabled_without_endpoint():
    os.environ.pop("QARI_ENDPOINT", None)
    assert engines.get("qari").available() is False


check("QARI غير متاح بلا نقطة نهاية", _qari_disabled_without_endpoint)


def _providers_status_shape():
    st = engines.providers_status()
    assert st["local"] is True
    assert "gemini" in st and "qari" in st
    detail = engines.providers_detail()
    assert any(d["name"] == "qari" and d["needs_gpu"] for d in detail)


check("providers_status/detail بالشكل الصحيح", _providers_status_shape)


# ── التوزيع مع التراجع ──
def _process_local_text():
    text, kind = engines.process("local", "flash", "note.txt", "نصّ عربيّ للاختبار".encode("utf-8"))
    assert "نصّ عربيّ" in text
    assert "نص" in kind


check("التوزيع: نصّ محلّي يُستخرَج ويُنظَّف", _process_local_text)


def _process_gemini_falls_back():
    # بلا مفتاح: طلب gemini يتراجع للمحلّي مع تنبيه صريح (لا فشل صامت).
    os.environ.pop("GEMINI_API_KEY", None)
    text, kind = engines.process("gemini", "pro", "note.txt", "محتوى".encode("utf-8"))
    assert "محتوى" in text
    assert "غير مُفعّل" in kind or "المحلّي" in kind


check("التوزيع: gemini بلا مفتاح يتراجع للمحلّي بتنبيه", _process_gemini_falls_back)


def _unknown_provider_defaults_local():
    text, kind = engines.process("nonexistent", None, "note.txt", "افتراضي".encode("utf-8"))
    assert "افتراضي" in text


check("التوزيع: مزوّد غير معروف → محلّي افتراضي", _unknown_provider_defaults_local)


# ── التنظيف العربي (تأكيد سلامة doc_reader بعد التغييرات) ──
def _clean_normalizes():
    assert clean_text("‏كلمة‎") == "كلمة"  # علامات اتجاه تُحذف
    assert norm("المُحكَمة") == "المحكمه"  # تطبيع للبحث


check("التنظيف العربي: علامات خفيّة + تطبيع", _clean_normalizes)


print("\nكل اختبارات المحرّكات ناجحة (%d)" % passed)
