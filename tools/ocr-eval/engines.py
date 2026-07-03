#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
engines.py — واجهة موحّدة لمحرّكات الاستخراج النصي، قابلة للتوصيل.

عقد كل محرّك: recognize(image_path) -> str
سمة .tables = True للمحرّكات التي تسترجع بنية الجداول (مهم للقوائم المالية).

الحالة (صريحة):
  - Mock / Tesseract / Azure / Google : كما سبق.
  - EasyOCR / PaddleOCR / Surya / Docling : محوّلات حقيقية بنمط lazy-import،
    تُكتشف تلقائياً عند تثبيت المكتبة. كُتبت بنيوياً وتتحقق من التوفّر بلا تنزيل
    أوزان؛ لم تُشغَّل end-to-end في بيئة الإعداد (النماذج ثقيلة/محجوبة). ثبِّت
    المكتبة (requirements-ocr.txt) لتفعيلها على جهازك.
"""
import os
import random
import subprocess
from importlib.util import find_spec
from shutil import which


def _installed(pkg):
    try:
        return find_spec(pkg) is not None
    except Exception:
        return False


class BaseEngine:
    name = "base"
    available = False
    tables = False

    def recognize(self, image_path: str) -> str:
        raise NotImplementedError

    def __repr__(self):
        return f"<{self.name} available={self.available} tables={self.tables}>"


# ============ محرّكات مرجعية/سحابية (كما سبق) ============
class MockEngine(BaseEngine):
    name = "mock"; available = True

    def __init__(self, error_rate=0.06, seed=7):
        self.error_rate = error_rate; self.rng = random.Random(seed)

    def recognize(self, image_path):
        gt = _sibling_gt(image_path)
        if gt is None:
            return ""
        out, swaps = [], {"ة": "ه", "ى": "ي", "أ": "ا", "إ": "ا"}
        for ch in gt:
            r = self.rng.random()
            if r < self.error_rate * 0.5 and ch in swaps:
                out.append(swaps[ch])
            elif r < self.error_rate * 0.65:
                continue
            else:
                out.append(ch)
        return "".join(out)


class TesseractEngine(BaseEngine):
    name = "tesseract"

    def __init__(self, lang="ara", psm=6, oem=1):
        self.lang, self.psm, self.oem = lang, psm, oem
        self.available = which("tesseract") is not None

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("tesseract غير مثبّت")
        r = subprocess.run(["tesseract", image_path, "stdout", "-l", self.lang,
                            "--oem", str(self.oem), "--psm", str(self.psm)],
                           capture_output=True, text=True)
        return r.stdout or ""


class TesseractPrepEngine(BaseEngine):
    """Tesseract مع المعالجة المسبقة نفسها المطبَّقة في منصّة الوثائق:
    تدرّج رمادي + تكبير الصور الصغيرة + عتبة Otsu ثنائية. يقيس مكسب المعالجة."""
    name = "tesseract_prep"

    MIN_WIDTH = 1400

    def __init__(self, lang="ara", psm=6, oem=1):
        self.lang, self.psm, self.oem = lang, psm, oem
        self.available = which("tesseract") is not None and _installed("PIL")

    def _preprocess(self, image_path):
        from PIL import Image  # type: ignore
        import tempfile

        img = Image.open(image_path).convert("L")  # تدرّج رمادي
        if img.width < self.MIN_WIDTH:  # تكبير الصور الصغيرة إلى ~300DPI
            scale = min(3.0, self.MIN_WIDTH / img.width)
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
        # عتبة Otsu (نفس خوارزمية المنصّة)
        hist = img.histogram()
        total = img.width * img.height
        sum_all = sum(i * hist[i] for i in range(256))
        sumB = wB = 0
        max_var = 0.0
        thr = 127
        for t in range(256):
            wB += hist[t]
            if wB == 0:
                continue
            wF = total - wB
            if wF == 0:
                break
            sumB += t * hist[t]
            mB = sumB / wB
            mF = (sum_all - sumB) / wF
            between = wB * wF * (mB - mF) ** 2
            if between > max_var:
                max_var = between
                thr = t
        bin_img = img.point(lambda p: 255 if p > thr else 0, mode="1")
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        bin_img.save(tmp.name)
        return tmp.name

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("tesseract أو PIL غير مثبّت")
        import os as _os

        prepped = self._preprocess(image_path)
        try:
            r = subprocess.run(["tesseract", prepped, "stdout", "-l", self.lang,
                                "--oem", str(self.oem), "--psm", str(self.psm)],
                               capture_output=True, text=True)
            return r.stdout or ""
        finally:
            try:
                _os.unlink(prepped)
            except OSError:
                pass


class AzureEngine(BaseEngine):
    name = "azure_di"

    def __init__(self):
        self.endpoint = os.environ.get("AZURE_DI_ENDPOINT", "")
        self.key = os.environ.get("AZURE_DI_KEY", "")
        self.model = os.environ.get("AZURE_DI_MODEL", "prebuilt-read")
        self.available = bool(self.endpoint and self.key)
        self.tables = True

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("Azure DI غير مهيّأ")
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.core.credentials import AzureKeyCredential
        cli = DocumentIntelligenceClient(self.endpoint, AzureKeyCredential(self.key))
        with open(image_path, "rb") as f:
            poller = cli.begin_analyze_document(self.model, body=f, content_type="application/octet-stream")
        return poller.result().content or ""


class GoogleEngine(BaseEngine):
    name = "google_docai"

    def __init__(self):
        self.proc = os.environ.get("GCP_DOCAI_PROCESSOR", "")
        self.creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        self.available = bool(self.proc and self.creds)
        self.tables = True

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("Google Document AI غير مهيّأ")
        from google.cloud import documentai
        client = documentai.DocumentProcessorServiceClient()
        raw = open(image_path, "rb").read()
        doc = documentai.RawDocument(content=raw, mime_type="image/png")
        res = client.process_document(request=documentai.ProcessRequest(name=self.proc, raw_document=doc))
        return res.document.text or ""


# ============ محرّكات مفتوحة عالية الجودة (محلية) ============
class EasyOCREngine(BaseEngine):
    """EasyOCR — نص عربي/إنجليزي، محلي. رخصة Apache-2.0."""
    name = "easyocr"

    def __init__(self, langs=("ar", "en"), gpu=False):
        self.langs, self.gpu = list(langs), gpu
        self.available = _installed("easyocr")
        self._reader = None

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("easyocr غير مثبّت: pip install easyocr")
        import easyocr
        if self._reader is None:
            self._reader = easyocr.Reader(self.langs, gpu=self.gpu)
        lines = self._reader.readtext(image_path, detail=0, paragraph=True)
        return "\n".join(lines)


class PaddleOCREngine(BaseEngine):
    """PaddleOCR — نص متعدّد اللغات + PP-StructureV3 للجداول. رخصة Apache-2.0.
    structured=True يفعّل استرجاع بنية الجداول (للقوائم المالية)."""
    name = "paddleocr"

    def __init__(self, lang="arabic", structured=False):
        self.lang, self.structured = lang, structured
        self.available = _installed("paddleocr")
        self.tables = structured
        self._eng = None
        if structured:
            self.name = "paddleocr_structure"

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("paddleocr غير مثبّت: pip install paddleocr paddlepaddle")
        if self.structured:
            # PP-StructureV3: تخطيط + جداول → Markdown/JSON
            try:
                from paddleocr import PPStructureV3
                if self._eng is None:
                    self._eng = PPStructureV3()
                res = self._eng.predict(image_path)
                parts = []
                for r in res:
                    md = getattr(r, "markdown", None) or (r.get("markdown") if isinstance(r, dict) else None)
                    if md:
                        parts.append(md if isinstance(md, str) else str(md))
                return "\n".join(parts) if parts else str(res)
            except Exception as ex:
                raise RuntimeError(f"PP-Structure غير متاح بهذا الإصدار: {ex}")
        else:
            from paddleocr import PaddleOCR
            if self._eng is None:
                self._eng = PaddleOCR(lang=self.lang)
            res = self._eng.predict(image_path)
            out = []
            for page in res:
                texts = (page.get("rec_texts") if isinstance(page, dict) else getattr(page, "rec_texts", None)) or []
                out.extend(texts)
            return "\n".join(out)


class SuryaEngine(BaseEngine):
    """Surya — كشف نص + تخطيط + جداول، 90+ لغة (منها العربية). رخصة GPL-3.0.
    ملاحظة: واجهة Surya تتغيّر بين الإصدارات؛ هذا المحوّل يجرّب المسار الحديث ثم يتراجع."""
    name = "surya"

    def __init__(self, langs=("ar", "en")):
        self.langs = list(langs)
        self.available = _installed("surya")
        self.tables = True

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("surya غير مثبّت: pip install surya-ocr")
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        # المسار الحديث (surya>=0.6): FoundationPredictor + RecognitionPredictor + DetectionPredictor
        try:
            from surya.recognition import RecognitionPredictor
            from surya.detection import DetectionPredictor
            rec = RecognitionPredictor()
            det = DetectionPredictor()
            preds = rec([img], det_predictor=det)
            lines = []
            for p in preds:
                for tl in getattr(p, "text_lines", []):
                    lines.append(getattr(tl, "text", ""))
            return "\n".join(lines)
        except Exception as ex:
            raise RuntimeError(f"واجهة Surya مختلفة في هذا الإصدار: {ex}")


class DoclingEngine(BaseEngine):
    """Docling (IBM) — تخطيط DocLayNet + جداول TableFormer + OCR، ومناسب للبيئات المعزولة.
    الأقوى للقوائم المالية: يُخرج Markdown يحفظ بنية الجداول. رخصة MIT."""
    name = "docling"

    def __init__(self):
        self.available = _installed("docling")
        self.tables = True
        self._conv = None

    def recognize(self, image_path):
        if not self.available:
            raise RuntimeError("docling غير مثبّت: pip install docling")
        from docling.document_converter import DocumentConverter
        if self._conv is None:
            self._conv = DocumentConverter()
        result = self._conv.convert(image_path)
        return result.document.export_to_markdown()


# ---- أدوات مساعدة ----
def _sibling_gt(image_path):
    import pathlib
    p = pathlib.Path(image_path)
    gt = p.parent / (p.stem + ".gt.txt")
    return gt.read_text(encoding="utf-8") if gt.exists() else None


REGISTRY = {
    "mock": MockEngine,
    "tesseract": TesseractEngine,
    "tesseract_prep": TesseractPrepEngine,
    "azure_di": AzureEngine,
    "google_docai": GoogleEngine,
    "easyocr": EasyOCREngine,
    "paddleocr": PaddleOCREngine,
    "paddleocr_structure": lambda: PaddleOCREngine(structured=True),
    "surya": SuryaEngine,
    "docling": DoclingEngine,
}


def build_engines(names):
    out = []
    for n in names:
        f = REGISTRY.get(n)
        if not f:
            print(f"تحذير: محرّك غير معروف: {n}"); continue
        out.append(f())
    return out


def list_engines():
    """يعرض كل المحرّكات وحالة توفّرها وقدرتها على الجداول."""
    rows = []
    for n, f in REGISTRY.items():
        try:
            e = f()
            rows.append((n, e.available, getattr(e, "tables", False)))
        except Exception as ex:
            rows.append((n, False, f"خطأ: {ex}"))
    return rows


if __name__ == "__main__":
    print(f"{'المحرّك':<20}{'متوفّر':<10}{'جداول'}")
    for n, av, tb in list_engines():
        print(f"{n:<20}{('نعم' if av else 'لا'):<10}{('نعم' if tb is True else ('لا' if tb is False else tb))}")
