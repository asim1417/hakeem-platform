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

COPY tool_app.py /app/tool_app.py

# قاعدة بيانات الوثائق على قرص دائم
ENV TOOL_DB=/data/tool_docs.db
ENV PYTHONUNBUFFERED=1
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8080
CMD ["uvicorn", "tool_app:app", "--host", "0.0.0.0", "--port", "8080"]
