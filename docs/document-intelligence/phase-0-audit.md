# المرحلة صفر — تقرير تدقيق منصة وثائق حكيم

> HKM-DOCUMENT-INTELLIGENCE-005 · تدقيق قراءةٍ فقط (لا تعديل على الكود). مبنيّ على فحص المستودع الفعلي.
> التاريخ: بعد دمج PR #250 في main.

> **ملاحظة تحقّق (تقدّم main):** بعد إعداد هذا التقرير تقدّم `main` بعمل جلساتٍ أخرى (حتى `2c80a6c`:
> #594 composer-documents، #598/#600 JDS). أُعيد التحقّق من الادّعاءات الجوهرية عليه فصمَدت:
> **العطل ما زال قائماً** (`extract.ts:122`، أُزيح من 119)، و**لا نماذج `DocumentPage/DocumentJob`** أُضيفت
> (فقط `Attachment`، أُزيح إلى `schema.prisma:338`). أرقام الأسطر أدناه بحالة PR #250 وقد تزيح ±بضعة أسطر.
> تحسيناتٌ طرفية أُدخِلت في جلساتٍ أخرى تعالج جزئياً §11/§13: آلية `mechanism` للجودة (`text-usable`/`ocr-required`)،
> وتصعيد تلقائي `lite→flash→pro` في `cloud-ocr.ts`، ودالة `isBrokenExtraction` في `reshape.ts`. تُدمج في الخطة لا تُكرَّر.

---

## ١. ملخّص الواقع الحالي

المنصة تملك **ثلاثة أسطح وثائق منفصلة** ومنطقَ معالجةٍ **مُكرَّراً في ثلاث طبقات**، بلا بنية بيانات دائمة للصفحات أو المهام. القراءة الثقيلة تجري **في المتصفح** (Tesseract.js)، والقرار الحاسم يتخذ **على مستوى الوثيقة كاملةً** لا الصفحة. لا توجد أعلام ميزات منظّمة، ولا يصل مرفقٌ ثنائي (PDF/صورة) إلى «اسأل حكيم» أصلاً.

الأساس صالح للتطوير الإضافي: النواة الموحّدة `processExtractedText` موجودة ومُختبَرة، وخادم `doc-node` يعيد استخدامها (اتجاه صحيح)، والمُخطّط صفحة-بصفحة `planPdfPageOcr` **موجود** لكنه غير مربوط بكل المسارات.

---

## ٢. خريطة المسارات والمكوّنات

| المسار | المكوّن | محرّك الاستخراج | ملاحظة |
|---|---|---|---|
| `/documents` | `app/documents/page.tsx` | — | صفحة هبوط. تعرض بطاقة ثالثة عند ضبط `DOC_SERVICE_URL` (غير موثّق في .env.example) |
| `/documents/tool` | `DocToolApp` | `extractFile` → **`extractPdf` (العطل)** | «البحث السريع» — المسار المعطوب |
| `/documents/app` | `CaseBrowser` | **`planPdfPageOcr` (صفحة-بصفحة)** | «محطة العمل» — المسار الأفضل |
| `/doc-tool` | بروكسي `next.config.mjs` | خدمة خارجية عبر `DOC_TOOL_URL` | يخدم خدمة Python أو doc-node (متبادلان) |
| `/api/doc-tool/ocr` | `app/api/doc-tool/ocr/route.ts` | `lib/modules/ai/gemini-ocr.ts` (خادمي) | مسار Gemini السحابي |
| `/api/legal-chat` | `LegalChatWorkspace` | — | «اسأل حكيم»: يرسل نص المرفق **كاملاً inline** |

**خادم doc-node** (`services/doc-node/`): مستقلّ، **غير مربوط بالتطبيق** إلا عبر بروكسي `DOC_TOOL_URL`. يستورد النواة المشتركة من التطبيق (اتجاه صحيح)، لكن التطبيق لا يناديه. لا يوجد `DOC_NODE_URL`.

---

## ٣. جذر العطل (مؤكَّد بالكود)

```ts
// lib/modules/doc-tool/extract.ts:119-121  (داخل extractPdf، يستدعيه extractFile → DocToolApp)
if (result.emptyPages >= result.pages || result.needsOcr) {
  return ocrPdf(buffer, onProgress);   // → OCR على كل صفحات الوثيقة في المتصفح
}
```

- `needsOcr` عَلَمٌ **عامٌّ للوثيقة** مشتقّ من `cleanPdfTextLayer` على النصّ الكامل (`file-extract.ts:163`). فصفحةٌ واحدة معطوبة تجعل `needsOcr=true` للوثيقة كلها.
- `ocrPdf` (`extract.ts:154`) يشغّل `ocrScannedPdf` على **كامل** الـ buffer عبر Tesseract.js في المتصفح — كارثيّ لكتابٍ من مئات الصفحات.
- **الحلّ الجزئي موجود ولا يُستعمل هنا:** `planPdfPageOcr` (`file-extract.ts:203`) يشخّص كل صفحة ويعيد `needOcrPages` + `baseText`. لكنه مربوطٌ فقط بـ `CaseBrowser` (`CaseBrowser.tsx:932`)، لا بمسار `extractFile`. فالمسار «السريع» يبقى على القرار العام.

**الخلاصة:** لا نبني تشخيصاً جديداً — نُوجّه مسار `extractFile` إلى `planPdfPageOcr` الموجود، ونحوّل `needsOcr` العام إلى ملخّصٍ لا قرارٍ تنفيذي.

---

## ٤. نموذج البيانات (Prisma)

| النموذج | الحالة | ملاحظة حرجة |
|---|---|---|
| `Attachment` (schema.prisma:300-311) | نحيل | `id, caseId, fileName, mimeType, storageKey, extractedText, createdAt` فقط |
| `extractedText` | **مُحمَّل بـ JSON** | `app/api/attachments/route.ts:59` يكتب `JSON.stringify(metadata)` — لا نصّ الوثيقة (مخالفة §8) |
| `DocumentPage` / `DocumentJob` / `DocumentPageAttempt` | **غير موجودة** | لا بنية صفحات/مهام/محاولات إطلاقاً |
| منصة الوثائق (`DocCase.docs`) | JSON inline | المستندات الكاملة كمصفوفة JSON على صفّ القضية |
| مرفقات المحادثة (`ChatMessage.attachments Json?`) | منفصلة | لا مفتاح خارجي إلى `Attachment` |
| `sha256`, `pageCount`, `processingStatus`, `processedPages`, `failedPages` | **غير موجودة** | لا شيء منها في المخطط |
| Enums للوثائق/المعالجة | **غير موجودة** | الحالات نصوصٌ حرّة |

---

## ٥. تكامل «اسأل حكيم» (الوضع الحالي)

- `/api/legal-chat` يرسل **نص المرفق كاملاً inline** في جسم كل رسالة (حتى 60 ألف حرف/ملف، 20 ملفاً) — `chat-orchestrator.ts:324-327`.
- **المرفقات الثنائية (PDF/صور) تصل بلا محتوى** — `LegalChatWorkspace.tsx:199-200` يقرأ النص فقط للملفات النصّية ≤200KB. فالـ PDF لا يُحلَّل في المحادثة أصلاً.
- لا يوجد مسار «ارفع مرّة، أشِر بمعرّف» — وهو ما يطلبه §22.

---

## ٦. الازدواج (دَينٌ تقني حقيقي — يطابق §١٠)

| المنطق | عدد النسخ | المواضع |
|---|---|---|
| `stripMarginLineNumbers` | **4** | `document-inspection/margin-numbers.ts:44` (القانوني) · `ai/gemini-ocr.ts:176` · `arabic-doc-tool/doc_reader.py:140` · `arabic-doc-tool/gemini_provider.py:36` |
| `reflowWrappedLines` | **2** | `document-inspection/line-reflow.ts:34` · `arabic-doc-tool/doc_reader.py:191` |
| `cleanText`/`clean_text` | **3+** | `doc-tool/normalize.ts:19` · `arabic-doc-tool/doc_reader.py:106` · `doc-conversion-engine/scripts/legal_clean.py:40` |
| خط المعالجة الكامل | **2** | `document-inspection/pipeline.ts:45` (TS) · `arabic-doc-tool/engines.py` (Python) |

**مصدر الحقيقة المُرشَّح:** `lib/modules/document-inspection` (TS). Python `tools/arabic-doc-tool` هو النسخة المتباعدة (يعترف بها README doc-node صراحةً).

> شفافية: بعض هذا الازدواج أُدخِل في جلسات سابقة (نقل الحاذف/الربط إلى Python للخدمة الحيّة). §١٠ يوجب اختيار مصدرٍ واحد والهجرة إليه تدريجياً.

---

## ٧. المحرّكات المتوفّرة فعلاً

| المحرّك | الموقع | جهة |
|---|---|---|
| Tesseract.js | `document-inspection/ocr.ts` | متصفح |
| pdfjs (طبقة نص) | `cloud-ocr.ts` / `file-extract.ts` | متصفح |
| Gemini سحابي (من العميل) | `cloud-ocr.ts` → `/api/doc-tool/ocr` | خادم |
| Gemini vision | `ai/gemini-ocr.ts` | خادم |
| pdfjs على Node | `services/doc-node/extract.ts` | doc-node |
| Gemini + QARI (مقبس) | `services/doc-node/engines.ts` | doc-node |
| Tesseract (Python) | `tools/arabic-doc-tool/doc_reader.py` | خدمة Python |
| **Azure DI / Google Document AI** | `tools/ocr-eval/` فقط | **غير مربوطة بالتشغيل** |

Azure وGoogle Document AI موجودان في أداة التقييم فقط — لا في مسار الإنتاج.

---

## ٨. أعلام الميزات والبيئة

- **لا إطار أعلام منظّم.** فحوصٌ نصّية متفرّقة: `DISABLE_AUTH`, `SEMANTIC_SEARCH`, `SEARCH_PROVIDER_MODE`.
- **لا وجود** لأي من `DOC_INTELLIGENCE_V2`, `DOC_PAGE_ROUTING`, `DOC_BACKGROUND_JOBS`… (يجب إنشاؤها مغلقةً — §29).
- `DOC_SERVICE_URL` مُستخدَم في `page.tsx` لكنه **غير موثّق** في `.env.example`.
- متغيّرات موجودة: `GEMINI_API_KEY`, `GEMINI_MODEL`, `DOC_TOOL_URL/PASSWORD/SESSION_SECRET`, ومتغيّرات doc-node (`DOC_NODE_DATA`, `GEMINI_CHUNK_PAGES`, `GEMINI_MAX_CONCURRENCY`, `QARI_*`).

---

## ٩. الملفات التي فُحصت (المرحلة صفر)

```
lib/modules/doc-tool/extract.ts            ← جذر العطل (extractPdf/ocrPdf)
lib/modules/document-inspection/file-extract.ts  ← planPdfPageOcr (الحل الجزئي)
lib/modules/document-inspection/{pipeline,margin-numbers,line-reflow,reshape,ocr,classifier}.ts
lib/modules/doc-tool/{cloud-ocr,normalize}.ts
lib/modules/ai/gemini-ocr.ts
components/{doc-tool/DocToolApp,documents/CaseBrowser}.tsx
components/legal-chat/LegalChatWorkspace.tsx
app/api/legal-chat/route.ts · lib/modules/legal-chat/{chat-orchestrator,document-analysis}.ts
app/api/attachments/route.ts · app/api/doc-tool/ocr/route.ts
prisma/schema.prisma (Attachment, ChatMessage, DocCase, DocWorkspace)
services/doc-node/{engines,extract,store,server,jobs}.ts
tools/arabic-doc-tool/{doc_reader,gemini_provider,engines}.py
next.config.mjs · .env.example · render.yaml
```

---

## ١٠. خطة الـ PRs المقترحة (صغيرة، خلف أعلام، قابلة للتراجع)

| PR | العنوان | النطاق | العَلَم |
|---|---|---|---|
| **PR-1** | إصلاح الاستقرار (المرحلة ١) | توجيه `extractPdf` إلى `planPdfPageOcr` الموجود · تحويل `needsOcr` لملخّص · try/catch/finally لكل ملف · إلغاء + مهلة · إصلاح `cloudHiQ` في deps (stale closure) · منع إعادة إرسال كل الوثائق المخزّنة · **اختبار regression لطبقةٍ عربية معطوبة دلالياً** | `DOC_PAGE_ROUTING` |
| **PR-2** | توحيد الازدواج (§١٠) | مصدر حقيقة واحد = `document-inspection`؛ جعل نسخ Python/gemini-ocr تفوّض أو تُزال تدريجياً | — |
| **PR-3** | كاشف الفساد الدلالي (§١١) | `detectArabicSemanticTextLayerCorruption` + `semanticCorruptionScore` + فحص بصري بالعيّنة | `DOC_PAGE_ROUTING` |
| **PR-4** | البيانات والمهام (المرحلة ٢) | migration إضافية: حقول `Attachment` أو نماذج `DocumentPage/Job/Attempt` · ترحيل اختياري `extractedText JSON→metadata` (كشف السجلات القديمة، بلا تشغيل تلقائي على الإنتاج) · حفظ جزئي واستئناف | `DOC_BACKGROUND_JOBS` |
| **PR-5** | سجل المحرّكات (المرحلة ٣) | واجهة `DocumentEngine` + `DocumentModelRegistry` (أسماء النماذج من البيئة) · ربط doc-node كعامل · health checks | أعلام لكل محرّك |
| **PR-6** | الواجهة (المرحلة ٤) | محرّر المقارنة صورة\|نص · ثقة صفحة-بصفحة · التصدير Word RTL / searchable PDF | `DOC_INTELLIGENCE_V2` |
| **PR-7** | الفهم القانوني + التكامل (المرحلة ٥) | استخراج بنيوي بالاستشهاد بالصفحة · إرسال `attachmentId` إلى «اسأل حكيم» (مرجع لا نصّ) | `DOC_LEGAL_EXTRACTION` |
| **PR-8** | التقييم والفتح التدريجي (المرحلة ٦) | benchmark على مجموعة سعودية · shadow mode · 5%→25%→100% | — |

**البداية المقترحة: PR-1 وحده** (يصلح العطل الفعلي بأقل مخاطرة، ويعيد استخدام الموجود).

---

## ١١. المخاطر والافتراضات

1. **لا اختبار حيّ للسحابة هنا:** الشبكة محجوبة في بيئتي — لا أستطيع تنفيذ Gemini/Azure/Google DI فعلياً. أي ادّعاء نجاحٍ سحابي يحتاج تشغيلك.
2. **الملف الحقيقي «الإجراءات القضائية» غير متوفّر لديّ:** سأبني عيّنة تركيبية تعيد النمط (طبقة عربية سليمة شكلاً معطوبة دلالياً) للاختبار العام، ويبقى الملف الحقيقي في اختبارات القبول الخاصة عندك.
3. **ترحيل Prisma على الإنتاج خطر:** يجب اختباره على staging؛ الترحيل إضافيٌّ فقط، بلا تشغيل تلقائي.
4. **doc-node غير منشور Node:** أنت نشرت خدمة Python. ربطه كعامل قرارٌ لاحق (PR-5).
5. **حجم إعادة الهيكلة:** كل شيء خلف أعلام مغلقة افتراضياً + مسار رجوع — التزاماً بـ §29/§31.

---

## ١٢. ما أحتاجه منك للاختبار

| العنصر | لماذا | الحالة |
|---|---|---|
| `GEMINI_API_KEY` في بيئة اختبار | تشغيل مسار Gemini فعلياً | موجود على Render، لا محلياً |
| الملف الحقيقي أو إذن بعيّنة تركيبية | اختبار regression للطبقة المعطوبة | أحتاج قرارك |
| `DATABASE_URL` لـ staging | اختبار migration بأمان | مطلوب قبل PR-4 |
| شبكة تصل Gemini (أو تشغيلك أنت) | تحقّق end-to-end | محجوبة عندي |
| مفاتيح Azure/Google DI (اختياري) | لو أردت هذين المحرّكين | غير موجودة |

---

## الحدّ — أتوقّف هنا

هذا تقرير المرحلة صفر. **لم يُعدَّل أي كود.** بانتظار اعتمادك لخطة الـ PRs (أو تعديلها) قبل بدء PR-1.
