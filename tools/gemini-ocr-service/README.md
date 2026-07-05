# خدمة استخراج النصوص العربية (Gemini OCR Service)

هذه الخدمة مصممة لتُدمج كإضافة مستقلة (Module) في موقعك لقراءة وتحويل الوثائق العربية (صور و PDF) إلى نصوص بدقة فائقة باستخدام ذكاء Gemini الاصطناعي.

## محتويات الملف:
1. `GeminiOcrService.js`: ملف الخدمة الأساسي.
2. `test-ocr.js`: ملف تجريبي لتشغيل الخدمة.
3. `package.json`: ملف إعدادات المشروع لتثبيت المكتبة الرسمية المطلوبة.

---

## تعليمات التشغيل والتركيب:

### 1. تثبيت المكتبات المطلوبة
```bash
npm install
```

### 2. إعداد مفتاح الـ API لـ Gemini
* **على نظام ويندوز (CMD):**
  ```cmd
  set GEMINI_API_KEY="ضع_مفتاح_الـ_api_الخاص_بجوجل_هنا"
  ```
* **على أنظمة لينكس/ماك (Linux/macOS):**
  ```bash
  export GEMINI_API_KEY="ضع_مفتاح_الـ_api_الخاص_بجوجل_هنا"
  ```

### 3. تجربة الخدمة
1. ضع أي صورة لوثيقة عربية باسم `sample.png`.
2. قم بتشغيل ملف التجربة:
   ```bash
   node test-ocr.js
   ```

---

## المعالجة الجماعية (Bulk): تحويل مجلد كامل (مثل 220 وثيقة) إلى نصوص خام

الملف: `processDriveDocuments.js` — وضعان للتشغيل:

### الوضع الأول: مباشرة من Google Drive (بلا تنزيل يدوي)

**التجهيز (مرة واحدة):**
1. مفتاح Gemini من Google AI Studio → `export GEMINI_API_KEY="..."`
2. في Google Cloud Console: فعّل **Google Drive API** → أنشئ **Service Account**
   → نزّل مفتاح JSON باسم `credentials.json` وضعه في هذا المجلد
3. **الخطوة المهمة:** خذ بريد حساب الخدمة (ينتهي بـ `gserviceaccount.com`)
   وشارك معه مجلد الوثائق في Drive (صلاحية «مشاهد» تكفي)
4. `npm install` في هذا المجلد

**التشغيل:**
```bash
DRIVE_FOLDER_ID="معرف_المجلد_من_رابط_درايف" node processDriveDocuments.js
```

### الوضع الثاني: مجلد محلي على الجهاز/الخادم

```bash
DOCUMENTS_FOLDER="./my-drive-documents" node processDriveDocuments.js
```

### ما يفعله السكربت
- يجلب كل الوثائق (PNG/JPG/PDF) مهما بلغ عددها (ترقيم صفحات تلقائي)
- يرسل كل وثيقة لـ Gemini (`gemini-2.5-flash` افتراضياً؛ بدّل بـ `GEMINI_MODEL=gemini-2.5-pro` للخط اليدوي)
- يحفظ النص الخام في `extracted-arabic-texts/اسم_الوثيقة.txt`
- **استئناف تلقائي**: أعد تشغيله بعد أي انقطاع — يتخطى ما اكتمل ويعالج الباقي فقط
- إعادة محاولة تلقائية عند حدود المعدل (429) وملخص نهائي بالناجح والفاشل

### خيارات إضافية (متغيرات بيئة)
| المتغير | الافتراضي | الوظيفة |
|---|---|---|
| `OUTPUT_FOLDER` | `./extracted-arabic-texts` | مجلد المخرجات |
| `GEMINI_MODEL` | `gemini-2.5-flash` | النموذج (`gemini-2.5-pro` للمعقد) |
| `CONCURRENCY` | `1` | عدد الوثائق المعالَجة معاً — ارفعه (مثلاً `6`) للمفاتيح المدفوعة لتسريع الدفعات الكبيرة؛ أبقِه `1` للمفاتيح المجانية |
| `DELAY_MS` | `1200` | مهلة بين الوثائق (تُطبَّق في الوضع المتسلسل `CONCURRENCY=1` فقط) |
| `GOOGLE_CREDENTIALS_FILE` | `./credentials.json` | مسار ملف حساب الخدمة |

> **السرعة:** على flash يُعطَّل «التفكير» تلقائياً (OCR لا يحتاجه) فتصير كل قراءةٍ أسرع وأدقّ وأأمن. للدفعات الضخمة بمفتاحٍ مدفوع، `CONCURRENCY=6` يختصر الزمن إلى نحو السُّدس مقارنةً بالتسلسل:
> ```bash
> CONCURRENCY=6 DOCUMENTS_FOLDER="./my-drive-documents" node processDriveDocuments.js
> ```
