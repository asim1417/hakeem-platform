# 06 — تقرير الأداء | PRE-LAUNCH-AUDIT-001

## قياسات فعلية (شبكة)

| الهدف | المقياس | القيمة |
|---|---|---|
| `GET /api/health` (vercel.app) | latencyMs داخل الاستجابة | ~9ms (وقت الفحص) |
| `GET /` hakeemsa.com | HTTP | 200، ~23KB HTML أولي |
| `GET /pricing` | HTTP | 200، ~20KB |
| بناء الإنتاج المحلي | مدة | ~47s |
| Middleware bundle | حجم التقرير | ~129 kB |

## First Load JS (من `next build`)

- مشترك لكل الصفحات: ~88.2 kB
- `/dashboard/ask`: ~170 kB first load (أكبر سطح تفاعلي)
- `/documents/app`: ~130 kB

## صفحات أثقل نسبيًا

1. `/dashboard/ask` — محادثة + بث
2. `/documents/app` — منصة وثائق
3. `/dashboard/judicial-assistant/cases/[caseId]` — ~169 kB

## أسباب / ملاحظات

- لا يوجد Lighthouse كامل من هذه البيئة.
- OpenSearch غير مطلوب للإطلاق (PostgreSQL/pgvector حسب المعمارية).
- الضغط و`poweredByHeader: false` مفعّلان في `next.config.mjs`.
- صور AVIF/WebP مفعّلة.

## تحسينات منفَّذة في هذا التدقيق

- لا تغييرات أداء واسعة (تجنّب إعادة بناء غير لازمة).
- حد حجم المرفقات يقلل ضغط التخزين/المعالجة.

## توصيات لاحقة (P2/P3)

- قياس LCP/INP على hakeemsa.com عبر PageSpeed بعد الدمج.
- تقسيم حزم Ask إن زاد First Load فوق الميزانية.
- مراقبة زمن استجابة Anthropic ومهلات Vercel (maxDuration على JA stream = 300s).
