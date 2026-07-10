# تفعيل OpenSearch لبحث حكيم (اختياري)

البحث يعمل حاليًا على PostgreSQL. OpenSearch يُحسّن المطابقة اللفظية العربية،
ويُفعَّل تلقائيًا بمجرد توفّر عنقود + فهرسة — دون تغيير كود. عند غيابه يبقى «unavailable»
ويعمل fallback على Postgres (لا تعطّل).

## المكوّنات الجاهزة في المستودع
- **المحلّل العربي** + الفهارس: `scripts/index-opensearch.ts` (`hakeem_arabic` مع تجذيع + `hakeem_arabic_exact` للمطابقة الدقيقة؛ `arabic_normalization` + `decimal_digit` — بلا إضافات خارجية).
- **المزوّد**: `lib/modules/legal-search/providers/opensearch-provider.ts` (قيد النظام+رقم المادة، استبعاد `needs_review`، حقول `.exact`، تظليل).
- **compose** (تطوير محلّي): خدمة `opensearch` تحت بروفايل `search`.

## التفعيل — محلّي
```bash
docker compose --profile search up -d          # يشغّل OpenSearch 3.7 على 9200
export OPENSEARCH_URL="https://localhost:9200"
export OPENSEARCH_USERNAME="admin"
export OPENSEARCH_PASSWORD="Hakeem_Str0ng_Pass!2026"
export NODE_TLS_REJECT_UNAUTHORIZED=0          # للتطوير فقط (شهادة ذاتية)
npm run index:opensearch -- --all              # فهرسة كل المواد والأحكام والمبادئ
```

## التفعيل — الإنتاج (Vercel)
1. جهّز عنقودًا مُدارًا (AWS OpenSearch / Bonsai / OpenSearch.org) — Vercel لا يستضيفه.
2. اضبط في Vercel (Environment Variables):
   - `OPENSEARCH_URL` (https)
   - `OPENSEARCH_USERNAME` / `OPENSEARCH_PASSWORD`
   - (اختياري) `OPENSEARCH_INDEX_LEGAL_ARTICLES` / `OPENSEARCH_INDEX_JUDICIAL_CASES`
3. شغّل الفهرسة مرة واحدة (عبر workflow أو محليًّا موجّهًا للعنقود): `npm run index:opensearch -- --all`.
4. سيظهر المزوّد `opensearch: active` في استجابات البحث تلقائيًا.

## ملاحظات
- تغيير المحلّل يتطلّب فهرسًا جديدًا (لا يُغيَّر على فهرس قائم) — احذف الفهرس وأعد الفهرسة عند تعديل الإعدادات.
- المتغيّرات غير مضبوطة = لا تغيّر سلوك: البحث يبقى على Postgres.
