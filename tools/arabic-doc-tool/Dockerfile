# أداة معالجة الوثائق العربية — حاوية مستقلة (رفع → استخراج → تطبيع → فهرسة → بحث)
FROM python:3.11-slim

# حزم النظام لتفعيل OCR للـPDF الممسوح والصور (tesseract عربي + poppler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-ara \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements_tool.txt /app/requirements_tool.txt
RUN pip install --no-cache-dir -r /app/requirements_tool.txt \
    && pip install --no-cache-dir pytesseract>=0.3.10 pdf2image>=1.17 Pillow>=10.0

# كل وحدات الخدمة: الواجهة/الـAPI + العقل + المهام الخلفية + مزوّد Gemini
COPY tool_app.py doc_reader.py jobs.py gemini_provider.py /app/

# قاعدة بيانات الوثائق + ملفات المهام على قرص دائم
ENV TOOL_DB=/data/tool_docs.db
ENV JOBS_UPLOAD_DIR=/data/job_uploads
ENV PYTHONUNBUFFERED=1
# اختياري: فعّل مزوّد Gemini الإضافي بتمرير المفتاح عند التشغيل: -e GEMINI_API_KEY=...
# اختياري: اقفل الأداة بكلمة مرور: -e APP_PASSWORD=...
# اختياري: سرعة الدفعات الكبيرة — توازي معالجة الملفات: -e JOBS_CONCURRENCY=6 (الافتراضي 3)
ENV JOBS_CONCURRENCY=3
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8080
CMD ["uvicorn", "tool_app:app", "--host", "0.0.0.0", "--port", "8080"]
