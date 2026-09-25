# الرصد الدوري الآمن لمصادر الأنظمة (Phase 6)

> **لا يُفعَّل على الإنتاج ضمن هذا العمل.** هذا توثيق الإعداد المطلوب فقط.

## ما هو موجود فعلًا

المستودع يحتوي مسارَي cron مؤمَّنين بـ `CRON_SECRET` (فشل آمن: بلا السرّ لا تنفيذ):

| المسار | الجدولة (`vercel.json`) | الوظيفة |
|---|---|---|
| `/api/cron/uqn-ingest` | `0 6 * * 0,5` (الأحد والجمعة 06:00) | قراءة RSS أم القرى → منع تكرار بـ `guid` → تصنيف → قارئ → `IngestRun`. التعديل/الإلغاء **يُرفع للمراجعة** ولا يُطبَّق آليًّا. |
| `/api/cron/stale-audit` | `0 7 1 * *` (شهريًّا) | وسم الوحدات غير المتحقَّقة كـ `STALE_UNVERIFIED`. |

خصائص الأمان المتوفّرة:
- **HTTPS + قائمة بيضاء للمضيفات**: `official-source-policy.ts` (`assertOfficialSourceUrl`) يقصر الجلب على `ncar.gov.sa` / `laws.boe.gov.sa` / `uqn.gov.sa`؛ و`article-upsert.ts` (`isOfficialSourceUrl`) يضيف `laws.moj.gov.sa` كمصدر مساعد ويرفض `nezams` وغيره.
- **بصمة SHA-256**: `contentSha256` على `legal_documents` و`legal_articles` لاكتشاف تغيّر النصّ.
- **`IngestRun`**: سجلّ لكل تشغيل (captured/classified/inserted/flagged/raised + notes).
- **بوابة المراجعة**: أي تعديل/استبدال يبقى `needs_review` / `REVIEW_REQUIRED`؛ لا تغيير آليّ للنصّ المعتمد في الإنتاج.

## التوقيت الأسبوعي المقترح (السعودية)

لإضافة رصد أسبوعي لسلامة الترقيم (قراءة فقط) بجانب الالتقاط، أضف إلى `vercel.json`
بعد المراجعة البشرية (غير مُضاف/مُفعَّل هنا):

```jsonc
{ "path": "/api/cron/numbering-audit", "schedule": "0 5 * * 6" } // السبت 05:00 (توقيت السعودية = UTC+3 → 08:00 محليًّا؛ اضبط حسب الحاجة)
```

المسار المقترح `numbering-audit` (لم يُنشأ ضمن هذا العمل) يجب أن:
- يُؤمَّن بـ `CRON_SECRET` (نفس نمط المسارات القائمة، فشل آمن).
- يشغّل منطق `normalize-article-numbering` بوضع **قراءة فقط** ويكتب `IngestRun` +
  تقرير حالة، **دون** تعديل أرقام في الإنتاج.
- يراعي rate limiting / retry / backoff عند أي جلب شبكي (كما في نمط الالتقاط).

## متغيّرات البيئة المطلوبة (بلا قيم)

- `CRON_SECRET` — إلزامي لتشغيل أي مسار cron.
- `UQN_RSS_URL` — اختياري (افتراضي `https://www.uqn.gov.sa/rssFeed/21`).
- وصول صادر إلى المضيفات الرسمية في القائمة البيضاء.

## إعداد Vercel المطلوب (توثيق فقط — لا تنشره)

1. أضِف `CRON_SECRET` في Project → Settings → Environment Variables (Production).
2. تأكّد أن جداول `vercel.json` مضبوطة على التوقيت المطلوب.
3. لا تُشغّل `db:seed` ولا أي backfill داخل build.
4. أي ترقية لحالة مادة إلى `verified` تتطلّب مطابقة مصدر رسمي + مراجعة بشرية.
