# أداة معالجة الوثائق العربية — دليل النشر على خادم «حكيم»

أداة **عامة قابلة للتداول**: يرفع المستخدم وثائقه (نص / Word / PDF / صور) فتُستخرَج
وتُنظَّف (تطبيع عربي: إزالة علامات الاتجاه، توحيد الحروف الفارسية الشبيهة، تحويل الأرقام
الفارسية) وتُفهرَس للبحث الفوري وتُعرَض مع تظليل مواضع المطابقة.

> **لا تحتوي الأداة أي بيانات قضية.** كل وثيقة يعالجها المستخدم تُخزَّن في قاعدة بيانات
> محلية على خادمك فقط. آمنة للنشر والمشاركة.

الملف: `tools/arabic-doc-tool/tool_app.py` — تطبيق FastAPI بملف واحد، بلا اعتماد على أي ملف بيانات.

---

## 1) التشغيل محلياً (تجربة سريعة)

```bash
npm run tool:docs:install   # مرة واحدة: تثبيت متطلبات Python
npm run tool:docs           # تشغيل الأداة على المنفذ 8080
```

أو مباشرة:

```bash
cd tools/arabic-doc-tool
python3 -m pip install -r requirements_tool.txt
uvicorn tool_app:app --host 0.0.0.0 --port 8080
```

ثم افتح: `http://localhost:8080`

## 1-ب) التشغيل عبر Docker Compose (مُدمَج مع بقية المنصّة)

الأداة مُعرَّفة كخدمة `doc-tool` في `docker-compose.yml` بجذر المشروع، وتُبنى من
`tools/arabic-doc-tool/Dockerfile` مع OCR عربي جاهز (tesseract-ara + poppler)
وقاعدة بيانات دائمة على volume باسم `hakeem-doc-tool-data`:

```bash
DOC_TOOL_PASSWORD="كلمة-مرور-قوية" docker compose up -d doc-tool
```

بدون `DOC_TOOL_PASSWORD` تعمل الأداة مفتوحة (مناسب للشبكة الداخلية فقط).

## 1-ج) على نفس دومين حكيم — المسار `/doc-tool`

عند ضبط `DOC_TOOL_URL` في بيئة تطبيق Next.js وإعادة تشغيله، تُقدَّم الأداة
**مباشرةً على نفس الدومين** تحت المسار `/doc-tool` (بروكسي مُعرَّف في
`next.config.mjs` يمرّر `/doc-tool/*` إلى خدمة FastAPI) — بلا iframe وبلا
منفذ ظاهر للمستخدم:

```
https://دومين-حكيم/doc-tool        ← واجهة الأداة كاملة
https://دومين-حكيم/doc-tool/api/…  ← نقاط الـ API عبر البروكسي نفسه
```

رابط «معالجة الوثائق» في قائمة التنقّل يشير إلى هذا المسار. الموقع الرئيسي
لا يتأثر — كل ما عدا `/doc-tool` يبقى كما هو. مسارات الأداة الداخلية
(الواجهة وتسجيل الدخول) نسبية، فتعمل على الجذر مباشرةً (منفذ 8080) أو خلف
البادئة `/doc-tool` دون أي إعداد إضافي.

## 2) قفل الأداة بكلمة مرور (اختياري لكن مُوصى به للنشر العام)

```bash
export APP_PASSWORD="اختر-كلمة-مرور-قوية"
export SESSION_SECRET="سلسلة-عشوائية-طويلة"     # اختياري: لتوقيع الجلسة
uvicorn tool_app:app --host 0.0.0.0 --port 8080
```

بدون `APP_PASSWORD` تكون الأداة مفتوحة للجميع (مناسب خلف شبكة داخلية فقط).

## 3) النشر على خادم «حكيم» (خادم Python تملكه)

### أ. تشغيل دائم عبر systemd (مُستحسَن)
أنشئ `/etc/systemd/system/hakeem-tool.service`:

```ini
[Unit]
Description=Arabic Documents Tool
After=network.target

[Service]
WorkingDirectory=/opt/hakeem/tools/arabic-doc-tool
Environment=APP_PASSWORD=ضع-كلمة-المرور
Environment=TOOL_DB=/opt/hakeem/data/tool_docs.db
ExecStart=/usr/bin/uvicorn tool_app:app --host 127.0.0.1 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now hakeem-tool
```

### ب. الواجهة الخلفية عبر Nginx (HTTPS + نطاقك)
```nginx
location /tool/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    client_max_body_size 50M;      # للسماح برفع ملفات كبيرة
}
```

## 4) تفعيل OCR للـPDF الممسوح والصور (اختياري)
```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-ara poppler-utils
python3 -m pip install pytesseract pdf2image Pillow
```
بدونها: النص و‏Word و‏PDF النصّي تعمل؛ الصور والـPDF الممسوح تُقبل لكن دون استخراج.

## 5) الصيغ المدعومة
| الصيغة | الاستخراج | يحتاج |
|---|---|---|
| `.txt .md .csv .json` | مباشر | — |
| `.docx` | python-docx | أساسي |
| `.pdf` (نصّي) | pdfminer.six | أساسي |
| `.pdf` (ممسوح) | OCR | tesseract + poppler |
| `.png .jpg .tif …` | OCR | tesseract + Pillow |

## 6) نقاط الوصول (API)
- `GET  /` — الواجهة (رفع + بحث + عرض)
- `POST /api/upload` — رفع ملفات (multipart) → استخراج + فهرسة
- `GET  /api/docs` — قائمة الوثائق
- `GET  /api/search?q=` — بحث FTS مع مقتطفات
- `GET  /api/doc/{id}` — وثيقة كاملة
- `POST /api/clear` — مسح كل الوثائق
- `GET  /healthz` — فحص الحالة

## 7) ملاحظات
- قاعدة البيانات في `TOOL_DB` (افتراضياً في مجلد مؤقت). حدِّد مساراً دائماً عند النشر.
- الرفع والبحث يعملان بلا اتصال خارجي؛ لا تُرسَل بيانات لأي خدمة.
- لإعادة الضبط من الصفر: احذف ملف `TOOL_DB`.

---

## العقل المستقل: `doc_reader.py`

منطق القراءة كله في وحدة بايثون خالصة — بلا واجهة ولا خادم — وخدمة `tool_app.py` تستورد منها (لا تكرار):

| الدالة | الوظيفة |
|---|---|
| `read_file(path)` / `read_bytes(name, data)` | استخراج النص → `(نص, نوع)` |
| `clean_text(t)` | تنظيف للعرض: علامات الاتجاه الخفية، الحروف الفارسية الشبيهة، الأرقام الفارسية |
| `norm(s)` | تطبيع للبحث: إسقاط التشكيل والتطويل، توحيد الهمزات/التاء المربوطة/الألف المقصورة |
| `extract(path)` | `{title, kind, text, search, chars, ok}` |
| `walk(folder)` | يمشي على مجلد كامل (مولِّد) |

**مزية عن النسخة السابقة**: يلتقط **جداول Word** أيضاً — كثير من الوثائق القانونية جداول.

```bash
# كمكتبة في أي مشروع بايثون:
from doc_reader import extract
r = extract("قرار.pdf"); print(r["text"])

# من الطرفية:
python doc_reader.py ملف.pdf                    # يطبع النص المنظف
python doc_reader.py مجلد/ --json out.jsonl     # دفعة كاملة → JSONL
```
