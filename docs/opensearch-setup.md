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

## التفعيل بضغطة زر (workflow) — الأسهل
بدل تشغيل الفهرسة يدويًّا، استعمل الـworkflow الجاهز `Index OpenSearch`:
1. أنشئ العنقود (انظر «مسار Bonsai» أدناه).
2. أضِف في **GitHub → Settings → Secrets and variables → Actions**:
   - `OPENSEARCH_URL` · `OPENSEARCH_USERNAME` · `OPENSEARCH_PASSWORD`
   - (`NEON_DATABASE_URL` موجود سلفًا — لقراءة المحتوى.)
3. **Actions → Index OpenSearch → Run workflow** → اكتب `INDEX` واختر `all`.
4. راجع خطوة «التحقّق» لعدد المستندات المفهرَسة.
5. أضِف نفس الأسرار الثلاثة في **Vercel** (Environment Variables) ليقرأها الموقع، ثم أعِد النشر.

## مسار Bonsai (أسرع بداية مُدارة)
1. أنشئ حسابًا على bonsai.io واختر عنقود OpenSearch (توجد خطة بداية صغيرة).
2. من لوحة العنقود انسخ **Full Access URL** (يحوي user:pass@host) أو المستخدم/السر منفصلَين.
3. `OPENSEARCH_URL=https://<host>` · `OPENSEARCH_USERNAME=<user>` · `OPENSEARCH_PASSWORD=<pass>`.
4. شهادة Bonsai صالحة — لا حاجة لأي تجاوز TLS.

> بديل مؤسّسي: **AWS OpenSearch Service** (أقوى، أعقد إعدادًا وتكلفةً). المبدأ نفسه: URL + اعتماد → نفس الأسرار.

## ملاحظات
- تغيير المحلّل يتطلّب فهرسًا جديدًا (لا يُغيَّر على فهرس قائم) — احذف الفهرس وأعد الفهرسة عند تعديل الإعدادات.
- المتغيّرات غير مضبوطة = لا تغيّر سلوك: البحث يبقى على Postgres.
- الـworkflow يقرأ من Neon ويكتب في العنقود فقط — لا يمسّ قاعدة البيانات.
