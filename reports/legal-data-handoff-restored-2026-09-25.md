# سجل استعادة حزمة التسليم — 25 سبتمبر 2026 (بعد الإصدار)

المصدر: GitHub Release `legal-db-handoff-2026-09-25`
الأصل: `Hakeem_Complete_Handoff_2026-09-25.zip`
الحجم: 384,476,982 بايت
SHA256: `9d50db38e7061aa65d34a80fddd2a942308505bf2ad638f7291735ff67fbe225` — **مطابق**

## التحقق من MANIFEST
جميع عناصر `MANIFEST.json` (11 ملفًا) طابقت الحجم والبصمة محليًا بعد التنزيل. لا اختلاف.

## فك الأرشيفات (مجلدات منفصلة)
| الأرشيف | المسار المحلي | عناصر |
|---|---|---|
| official collection | `/workspace/handoff/archives/official` | 290 |
| resume delta Work | `/workspace/handoff/archives/resume-delta` | 106 |
| live audit checkpoint | `/workspace/handoff/archives/live-audit` | 29 |
| round7 source resolution | `/workspace/handoff/archives/round7` | 8 |
| db-audit 2026-09-17 | `/workspace/handoff/archives/db-audit-0917` | 67 |

## ما أصبح موجودًا ومثبتًا بالملف
- الحزمة الأصلية + تقرير الجمع + المقدمات.
- حزمة الاستئناف Work + تقريرها.
- فحص حي round6 (`checkpoint.json`, `articles-all.json`, `civil-proposed-diff.json` بطول 720).
- round7: `introduction-source-resolution.json` + صور الصفحات 1–5.
- `madani-original.pdf`: SHA `c6f9df3633a68f79…feacb25e` — **مطابق** للتوقّع.

## حسم مقدمة القرار 820 (معاد إثباته بصريًا هنا)
- الصفحة 3: استناد القرار يذكر **م/59** بتاريخ 14/9/1431.
- الصفحة 4: البند ثانيًا/3 يذكر **م/59** بتاريخ 14/9/1431.
- القرار: اعتماد م/59؛ الإبقاء على م/95 الإلكتروني كاختلاف مصدر خام؛ لا اعتماد شامل لـ721 مادة.

## إعادة تشغيل التدقيق غير المتصل
على الحزمة الأصلية وحدها (`scripts/audit/official-collection.py`):
- بصمات: 0 اختلاف
- فهرس: 6,793 · تصادم هوية: 3 أزواج (لم تُدمج)
- محتوى متحقق في المنifest: 109 + خاصّان = يتوافق مع بنية الحزمة
- PDF: 103 · نصوص: 30
- حزم: 23 STRUCTURALLY_VALID_REVIEW_REQUIRED · 3 BLOCKED
- BM25: 15,902 / 485 · مدنية: same 204 · shift+1 421 · review 96

`pending-catalog.json` في Work: **6,654** سجلًا بلا محتوى محفوظ.

## أمثلة فروق مدنية (من round6، كلها REVIEW_REQUIRED، productionApplied=false)
- 237: العنوان/النص يشيران إلى 238؛ المقترح يصحّح إلى نص 237 من المصدر.
- 465: يحمل نص 466.
- 720: يحمل نص 721 (النفاذ)؛ المقترح لنص 720 مختلف.
- 721: نفس نص النفاذ قديمًا؛ المقترح يبقي نص النفاذ مع بصمة مصدر مختلفة في الملف.

## ما لم يتغيّر بعد الاستعادة
- **لا DATABASE_URL** في الجلسة → لا جرد SQL جديد، لا نسخة احتياطية جديدة، لا تطبيق.
- NCAR/BOE ما زالا بمهلة TLS من هذه البيئة.
- الإنتاج: صفر إدخال / صفر تصحيح دائم (حسب checkpoint والملفات).

## الخطوة التالية فور توفر DATABASE_URL
1. `npm run audit:live-snapshot -- --out=reports/live-snapshot-current.json`
2. مقارنة بصمات الصفوف المدنية في الإنتاج مع `civil-proposed-diff.json` (شرط متفائل).
3. التحقق من فروع Neon backup/test المسجّلة في round6.
4. اختبار دفعة صغيرة على فرع الاختبار فقط بعد أرشفة القيم السابقة.
