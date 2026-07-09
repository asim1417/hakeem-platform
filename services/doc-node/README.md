# خادم معالجة الوثائق (Node) — المرحلة 2

خادمٌ خلفيٌّ يعيد استخدام **الدماغ الموحّد** نفسه الذي يعمل في المتصفح
(`lib/modules/document-inspection`) — فمخرَج الخادم بجودة الويب تماماً، بلا محرّكٍ
ثانٍ يتباعد. يعالج في الخلفية: يرفع المستخدم دفعته، يغلق الصفحة، ويعود فيجد النتيجة.

## لماذا Node لا Python؟

المنطق الذكي (فصل الترويسات، كشف العطب، عزل الشعار، إصلاح الانعكاس، قياس الدقّة)
مكتوبٌ في TypeScript ومُختبَر (67 اختباراً). خادم Node يستورده **حرفياً** — مصدر
حقيقة واحد. خدمة Python كانت تعيد تطبيقه (مصدر تباعد) — هذه الخدمة تحلّ ذلك.

## التشغيل محلياً

```bash
npm run doc-node          # المنفذ 8090 (أو PORT)
npm run test:doc-node     # الاختبارات الحتمية
```

## الواجهة البرمجية

| الطريق | الوظيفة |
|---|---|
| `GET /healthz` | فحص الصحّة |
| `GET /api/providers` | المحرّكات المتاحة + تفاصيل (needs_gpu/remote) |
| `POST /api/jobs` | رفع (`files`) + `provider` + `model` → `{job_id,total}` — مهمّة خلفية |
| `GET /api/jobs/{id}?text=1` | حالة المهمّة وتقدّمها والنصوص |
| `GET /api/jobs` | آخر المهام |

المعالجة تعمل في خيطٍ من الأحداث على الخادم؛ إغلاق المتصفح لا يوقفها. وإن أُعيد
تشغيل الخادم تُستأنف المهام غير المكتملة من القرص تلقائياً.

## المحرّكات (سجلّ قابل للتوصيل)

| المحرّك | التفعيل | الملاحظة |
|---|---|---|
| `local` | دائماً | نص/Word/PDF نصّي — النواة المشتركة، خصوصية كاملة |
| `gemini` | `GEMINI_API_KEY` | رؤية سحابية للممسوح والخطّ اليدوي |
| `qari` | `QARI_ENDPOINT` | QARI-OCR عربي على GPU — أعلى دقّة (يحتاج مضيف GPU) |

الممسوح/الصور تُوجَّه تلقائياً لأوّل محرّك بعيد متاح (Gemini ثم QARI)، وإلا رسالة
واضحة بلا فشلٍ صامت.

## النشر (Docker — أي مضيف Node)

```bash
# من جذر المستودع (يحتاج lib/ والنواة المشتركة):
docker build -f services/doc-node/Dockerfile -t hakeem-doc-node .

docker run -d -p 8090:8090 -v hakeem_doc_node:/data \
  -e GEMINI_API_KEY="مفتاحك" \
  -e APP_PASSWORD="كلمة-مرور" \
  hakeem-doc-node
```

Railway/Render/Fly: أشِر لهذا الـ Dockerfile، وأبقِ حجماً دائماً على `/data`.

### أقرب ما يكون للنقرة الواحدة

- **Render (Blueprint):** المستودع فيه `render.yaml` جاهز. افتح
  `https://render.com/deploy?repo=https://github.com/asim1417/hakeem-platform`،
  اربط المستودع، الصق `GEMINI_API_KEY` و`APP_PASSWORD` — ويُنشأ الخادم تلقائياً.
- **Google Cloud Run** (يقبل الحاوية، يضبط `PORT` تلقائياً):
  ```bash
  gcloud run deploy hakeem-doc-node \
    --source . --dockerfile services/doc-node/Dockerfile \
    --region me-central1 --allow-unauthenticated \
    --set-env-vars GEMINI_API_KEY=مفتاحك,GEMINI_MAX_CONCURRENCY=32,DOC_NODE_DATA=/tmp
  ```
  (`me-central1` = الدوحة، الأقرب للسعودية — أو `me-central2` جدّة.)

## متغيّرات البيئة

| المتغيّر | الوظيفة |
|---|---|
| `PORT` | المنفذ (افتراضي 8090) |
| `DOC_NODE_DATA` | مجلّد البيانات الدائم (افتراضي مؤقّت النظام) |
| `GEMINI_API_KEY` | يفعّل محرّك Gemini |
| `GEMINI_CHUNK_PAGES` | صفحات كل قطعة PDF (افتراضي 4) — أصغر = نداءات أكثر أخفّ |
| `GEMINI_MAX_CONCURRENCY` | أقصى نداءات Gemini متوازية للـ PDF (افتراضي 16؛ ارفعه لمفاتيح الطبقات العليا) |
| `QARI_ENDPOINT` / `QARI_TOKEN` | يفعّل محرّك QARI-OCR على GPU |
| `APP_PASSWORD` | قفل بترويسة `x-app-password` |
| `JOBS_CONCURRENCY` | توازي المهام (1–8، افتراضي 3) |

### الإنتاجية العالية (1000 صفحة)

الـ PDF الكبير يُقسَّم إلى قطعٍ (`GEMINI_CHUNK_PAGES` صفحة) تُعالَج متوازيةً بجدولةٍ
متكيّفة (AIMD) تُشبع حدّ معدل مفتاحك تلقائياً وتتراجع عند 429 ثم تتعافى — بلا بترٍ
للوثائق الكبيرة. **السقف الفعلي = طبقة مفتاح Gemini** (RPM): الطبقات العليا تبلغ
1000 صفحة في دقائق؛ المفاتيح المجانية محدودة بشدّة. ارفع `GEMINI_MAX_CONCURRENCY`
لمفاتيح الطبقات العليا.

## الربط بمنصّة حكيم (Vercel)

اضبط `DOC_TOOL_URL` على رابط هذه الخدمة — فتُقدَّم على `/doc-tool` عبر بروكسي
`next.config.mjs` داخل دومين حكيم نفسه.
