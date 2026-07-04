# أداة معالجة الوثائق العربية — الدليل المتكامل للتشغيل والدمج

> **الفرع:** `claude/arabic-document-processing-vaqc31`
> **المصدر الأصلي:** مستودع `asim1417/zaini-case-audit` — فرع `claude/zaini-case-audit-system-79pdof` — مجلد `service/`
> **الموقع في حكيم:** `tools/arabic-doc-tool/`
> **المسار العام:** `https://دومين-حكيم/doc-tool` — على نفس الدومين، والموقع الرئيسي لا يتأثر

---

## 1) ما هي الأداة؟

أداة عامة قابلة للتداول: يرفع المستخدم وثائقه (نص / Word / PDF / صور) فتُعالَج بالكامل على خادمك:

```
رفع الملف → استخراج النص → تنظيف وتطبيع عربي → فهرسة بحث فوري (FTS5) → عرض مع تظليل المطابقات
```

- **التطبيع العربي:** إزالة علامات الاتجاه الخفية، توحيد الحروف الفارسية الشبيهة (ک→ك، ی→ي، ھ→ه)، تحويل الأرقام الفارسية للعربية، إسقاط التشكيل والتطويل عند البحث، توحيد الهمزات (أ/إ/آ→ا) والتاء المربوطة (ة→ه).
- **لا تحتوي أي بيانات قضية** — كل وثيقة تُخزَّن في قاعدة SQLite محلية على خادمك فقط، ولا يُرسَل شيء لأي خدمة خارجية.
- تطبيق FastAPI **بملف واحد** (`tool_app.py`) بلا اعتماد على أي ملف بيانات.

## 2) ملخص ما نُفِّذ (4 التزامات على الفرع)

| الالتزام | المحتوى |
|---|---|
| `72e23a6` | نقل الملفات الثلاثة من المستودع المصدر إلى `tools/arabic-doc-tool/` + كتابة `Dockerfile` مخصص بـ OCR عربي + خدمة `doc-tool` في `docker-compose.yml` + سكربتا npm |
| `b846f09` | ربط الأداة بلوحة حكيم (صفحة ورابط تنقّل وترجمة) |
| `f2203db` | نقلها لصفحة مستقلة على مسار جذري |
| `02ce96d` | **الصيغة النهائية:** تقديم الأداة على نفس دومين حكيم تحت `/doc-tool` عبر بروكسي — بلا iframe وبلا منفذ ظاهر، مع جعل مسارات الأداة الداخلية نسبية |

## 3) الملفات

```
hakeem-platform/
├── tools/arabic-doc-tool/
│   ├── tool_app.py            ← التطبيق كاملاً (FastAPI بملف واحد)
│   ├── requirements_tool.txt  ← متطلبات Python
│   ├── Dockerfile             ← حاوية جاهزة تشمل OCR عربي (tesseract-ara + poppler)
│   └── README_TOOL.md         ← دليل الأداة التفصيلي
├── app/doc-tool/page.tsx      ← صفحة احتياطية: تعليمات الإعداد عند غياب DOC_TOOL_URL
├── next.config.mjs            ← البروكسي: /doc-tool/* → خدمة الأداة (beforeFiles)
├── docker-compose.yml         ← خدمة doc-tool بجانب postgres
├── components/AppShell.tsx    ← رابط «معالجة الوثائق» في قائمة التنقّل
├── lib/i18n/dictionaries.ts   ← الترجمة nav.docTool (عربي/إنجليزي)
└── .env.example               ← DOC_TOOL_URL / DOC_TOOL_PASSWORD / DOC_TOOL_SESSION_SECRET
```

## 4) التشغيل — ثلاث طرق

### أ. Docker Compose (المُستحسَن — يشمل OCR كاملاً)

```bash
# في جذر المشروع
DOC_TOOL_PASSWORD="كلمة-مرور-قوية" docker compose up -d doc-tool
```

يبني الحاوية من `tools/arabic-doc-tool/Dockerfile` وتشمل تلقائياً:
`tesseract-ocr` + `tesseract-ocr-ara` + `poppler-utils` (أي أن OCR للصور والـPDF الممسوح يعمل فوراً)، مع قاعدة بيانات دائمة على volume باسم `hakeem-doc-tool-data`.

### ب. محلياً عبر npm

```bash
npm run tool:docs:install   # مرة واحدة: تثبيت متطلبات Python
npm run tool:docs           # تشغيل على المنفذ 8080
```

لتفعيل OCR محلياً (اختياري):

```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-ara poppler-utils
python3 -m pip install pytesseract pdf2image Pillow
```

### ج. تشغيل دائم عبر systemd

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

## 4-ب) النسخة المدمجة (serverless) — تعمل فور النشر بلا أي إعداد ⭐

المسار `/doc-tool` يعمل الآن **مباشرةً على نشر حكيم (Vercel)** دون أي خدمة خارجية:

- **الواجهة**: `components/doc-tool/DocToolApp.tsx` — استخراج النص (نص + Word/docx بفك zip
  أصلي في المتصفح) والتطبيع العربي والبحث والتظليل كلها في متصفح المستخدم.
- **الحفظ**: `app/api/doc-tool/route.ts` — يخزّن النصوص المستخرَجة في قاعدة PostgreSQL
  عبر جداول منصة الوثائق القائمة (`doc_workspaces`/`doc_cases`) بمساحة عمل مربوطة
  بكوكي المتصفح (بلا حساب) — **لا يحتاج migration**؛ الجداول منشأة أصلاً.
- **القيد**: ‏PDF الممسوح والصور (OCR) غير مدعومة في هذه النسخة — لها نسخة الخادم أدناه.
- عند ضبط `DOC_TOOL_URL` تحل نسخة الخادم الكاملة محل هذه الصفحة تلقائياً (البروكسي أولوية).

## 4-ج) نشر نسخة الخادم (OCR) على Render بضغطة واحدة

ملف `render.yaml` في جذر المشروع يجعل نشر خدمة FastAPI الكاملة بضغطة واحدة:

1. افتح: `https://render.com/deploy?repo=https://github.com/asim1417/hakeem-platform`
2. سجّل الدخول بحساب GitHub، أدخل `APP_PASSWORD`، واضغط Deploy
3. خذ الرابط الناتج (مثل `https://hakeem-doc-tool.onrender.com`) وضعه في `DOC_TOOL_URL`
   على Vercel — فتظهر نسخة OCR الكاملة على `دومين-حكيم/doc-tool`

## 5) التفعيل على نفس دومين حكيم (`/doc-tool`)

بعد تشغيل الخدمة بأي طريقة أعلاه، أضِف في `.env` الخاص بتطبيق حكيم (Next.js):

```bash
DOC_TOOL_URL="http://localhost:8080"
```

ثم أعد تشغيل التطبيق (`npm run build && npm run start` أو إعادة النشر). النتيجة:

```
https://دومين-حكيم/doc-tool        ← واجهة الأداة كاملة على نفس الدومين
https://دومين-حكيم/doc-tool/api/…  ← نقاط الـ API عبر البروكسي نفسه
```

- البروكسي مُعرَّف في `next.config.mjs` (`rewrites → beforeFiles`) ويمرّر `/doc-tool` و`/doc-tool/*` إلى `DOC_TOOL_URL`.
- **الموقع الرئيسي لا يتأثر** — كل ما عدا `/doc-tool` يبقى كما هو.
- رابط «معالجة الوثائق» في قائمة تنقّل اللوحة يشير إلى المسار نفسه.
- إن لم يُضبط `DOC_TOOL_URL` تظهر على `/doc-tool` صفحة تعليمات إعداد (وليس خطأ).
- مسارات الأداة الداخلية **نسبية**: تعمل على منفذها مباشرةً (8080) أو خلف البادئة `/doc-tool` دون أي إعداد إضافي.

## 6) متغيّرات البيئة

| المتغيّر | أين يُضبط | الوظيفة |
|---|---|---|
| `DOC_TOOL_URL` | بيئة تطبيق حكيم (Next.js) | عنوان خدمة الأداة الداخلي — يفعّل البروكسي على `/doc-tool` |
| `DOC_TOOL_PASSWORD` | بيئة docker-compose | يُمرَّر للخدمة كـ `APP_PASSWORD` — يقفل الأداة بكلمة مرور |
| `DOC_TOOL_SESSION_SECRET` | بيئة docker-compose | يُمرَّر كـ `SESSION_SECRET` — سر توقيع كوكي الجلسة |
| `APP_PASSWORD` | بيئة الخدمة مباشرةً | كلمة مرور الدخول (بدونها الأداة مفتوحة — مناسب للشبكة الداخلية فقط) |
| `SESSION_SECRET` | بيئة الخدمة مباشرةً | سر توقيع الجلسة (اختياري) |
| `TOOL_DB` | بيئة الخدمة مباشرةً | مسار ملف قاعدة SQLite (في الحاوية: `/data/tool_docs.db` على volume دائم) |

## 7) الصيغ المدعومة

| الصيغة | الاستخراج | يحتاج |
|---|---|---|
| `.txt .md .csv .json` | مباشر | — |
| `.docx` | python-docx | أساسي |
| `.pdf` نصّي | pdfminer.six | أساسي |
| `.pdf` ممسوح | OCR | tesseract + poppler (مضمّنة في الحاوية) |
| `.png .jpg .tif …` | OCR | tesseract + Pillow (مضمّنة في الحاوية) |

## 8) نقاط الوصول (API)

كلها تعمل مباشرةً على منفذ الخدمة، وعبر البروكسي بإضافة البادئة `/doc-tool`:

| المسار | الطريقة | الوظيفة |
|---|---|---|
| `/` | GET | الواجهة الكاملة (رفع + بحث + عرض) |
| `/api/upload` | POST | رفع ملفات (multipart) → استخراج + فهرسة |
| `/api/docs` | GET | قائمة الوثائق |
| `/api/search?q=` | GET | بحث FTS مطبَّع مع مقتطفات مظلَّلة |
| `/api/doc/{id}` | GET | نص وثيقة كاملاً |
| `/api/clear` | POST | مسح كل الوثائق |
| `/login` / `/logout` | POST / GET | الدخول والخروج (عند تفعيل كلمة المرور) |
| `/healthz` | GET | فحص الحالة `{"ok": true}` |

## 9) الأمان

- **كلمة المرور:** عند ضبط `APP_PASSWORD` تُقفل كل نقاط الوصول (عدا `/healthz`) خلف تسجيل دخول بكوكي HMAC-SHA256 موقَّع (`HttpOnly` + `SameSite=lax`، صلاحية أسبوع). المقارنة بـ `hmac.compare_digest` (مقاومة لهجمات التوقيت).
- **الخصوصية (PDPL):** المعالجة كلها محلية — لا يُرسَل أي محتوى لأي API خارجي.
- مسار `/doc-tool` خارج حماية middleware حكيم عمداً (صفحة مستقلة)؛ الحماية مسؤولية `APP_PASSWORD` الخاص بالأداة.
- في النشر العام يُستحسن: كلمة مرور قوية + `SESSION_SECRET` عشوائي طويل + HTTPS على الدومين (يتوفر تلقائياً لأن الأداة خلف دومين حكيم نفسه).

## 10) الاختبارات المُنفَّذة فعلياً (كلها نجحت)

عبر البروكسي على نفس الدومين (خدمة على 8080 + Next.js على 3100 مع `DOC_TOOL_URL`):

1. `GET /doc-tool` → واجهة الأداة الكاملة (HTML عربي RTL).
2. `GET /doc-tool/healthz` → `{"ok": true}`.
3. رفع ملف نصّي عربي عبر `POST /doc-tool/api/upload` → استُخرج النص (60 حرفاً، `ok: true`).
4. بحث `GET /doc-tool/api/search?q=العقود` → أعاد الوثيقة مع مقتطف مطبَّع ومطابقة مظلَّلة، رغم أن النص الأصلي مشكول («تُطبَّق أحكام هذا النظام على العقود التجارية»).
5. `GET /doc-tool/api/doc/1` → النص الكامل بتشكيله الأصلي محفوظاً.
6. تسجيل الدخول بكلمة مرور مفعّلة: صفحة الدخول تظهر بدون جلسة، الدخول الصحيح يعيد `303` بـ`Location` نسبي وكوكي سليم، الكوكي يمرّ عبر البروكسي ويفتح الـAPI، وكلمة خاطئة تعيد `401`.
7. الصفحة الرئيسية لحكيم `/` بقيت تعمل (200) — لا تأثير على الموقع.
8. `npm run typecheck` نظيف، وصياغة Python سليمة.

## 11) استكشاف الأخطاء

| العرض | السبب والحل |
|---|---|
| `/doc-tool` يعرض صفحة «الخدمة غير مضبوطة» | `DOC_TOOL_URL` غير مضبوط في بيئة تطبيق حكيم، أو لم يُعَد تشغيل/بناء التطبيق بعد ضبطه |
| `/doc-tool` يعطي 502/تعليق | الخدمة نفسها متوقفة — تحقق: `curl http://localhost:8080/healthz` ثم `docker compose logs doc-tool` |
| الصور/PDF الممسوح تُرفع «دون استخراج» | OCR غير مثبَّت (يحدث فقط في التشغيل المحلي؛ الحاوية تشمله) — ثبّت الحزم في §4-ب |
| أريد إعادة الضبط من الصفر | احذف ملف قاعدة البيانات: `docker volume rm hakeem-doc-tool-data` أو احذف ملف `TOOL_DB` |
| كلمة المرور لا تُطلب | `APP_PASSWORD` (أو `DOC_TOOL_PASSWORD` في compose) غير مضبوط — الأداة تعمل مفتوحة عمداً بدونه |
