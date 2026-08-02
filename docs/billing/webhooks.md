# دليل Webhooks — المدفوعات

**المرجع:** HKM-BILLING-UX-001 (§7) · معالجة أحداث الدفع المُقوّاة
**المبدأ الحاكم:** لا منح نقاط ولا تفعيل اشتراك قبل تأكيد الدفع خادميًا. العميل لا يمكنه تغيير المبلغ/النقاط.
**نقطة الدخول:** `POST /api/billing/webhooks/moyasar` — `app/api/billing/webhooks/moyasar/route.ts`
**المنطق:** `processPaymentWebhook()` — `lib/modules/billing/webhook-processor.ts`

---

## 1. المسار (Endpoint)

`POST /api/billing/webhooks/moyasar` (`dynamic = "force-dynamic"`):
1. يستدعي `hydrateEnvFromSettings()` (لضمان توفّر `MOYASAR_WEBHOOK_SECRET` من لوحة الإعدادات).
2. يقرأ الجسم **الخام** (`request.text()`) — ضروري لتحقق HMAC.
3. يُطبّع الترويسات إلى أحرف صغيرة ويمرّرها مع الجسم إلى `processPaymentWebhook(rawBody, headers)`.
4. يعيد `{ status, detail }` برمز HTTP من نتيجة المعالجة. عند استثناء غير متوقّع يعيد **200** عمدًا
   (لتفادي إعادة إرسال لا نهائية من البوابة؛ المصالحة اليومية تلتقط ما فات).

> المسار القديم `POST /api/billing/webhook` (`app/api/billing/webhook/route.ts`) يبقى للتوافق الخلفي فقط
> (تحقّق سرّ ناعم + تفعيل الاشتراك القديم). **المسار المعتمد للمنظومة الجديدة هو `/webhooks/moyasar`.**

---

## 2. التدفق المُقوّى — خطوة بخطوة

المصدر: `lib/modules/billing/webhook-processor.ts`. ست مراحل:

### (1) تحقق التوقيع/السرّ — `provider.verifyWebhook(rawBody, headers)`
- التنفيذ في `lib/payments/providers/moyasar.ts:229`. يعيد `{ valid, method, enforced }`.
- **HMAC:** إن وُجدت ترويسة `x-moyasar-signature` / `x-signature` / `moyasar-signature`، يُحسب
  `HMAC-SHA256(rawBody, MOYASAR_WEBHOOK_SECRET)` ويُقارن بمقارنة **ثابتة الزمن** (`crypto.timingSafeEqual`)
  مع القيمة المزوّدة (بعد إزالة بادئة `sha256=`). `method:"hmac"`.
- **سرّ مشترك:** غياب ترويسة التوقيع → يُقارن `body.secret_token`/`body.secret` بالسرّ (نموذج Moyasar الافتراضي)،
  مقارنة ثابتة الزمن. `method:"shared-secret"`.
- **بلا سرّ مضبوط:** `{ valid:false, method:"none", enforced:false }`.
- المعالج يرفض فقط عند `enforced && !valid` → **401 `unverified`**. أي: غياب السرّ يمرّر الحدث (وضع تطوير)،
  لذا **اضبط `MOYASAR_WEBHOOK_SECRET` في الإنتاج دائمًا.**

### (2) التحليل — `provider.parseWebhook(rawBody)`
- يحوّل الجسم إلى `CanonicalWebhookEvent { providerEventId, type, paymentId, status, amountHalalas, currency, metadata }`.
- غياب `providerEventId` → **400 `rejected`**.

### (3) التسجيل الخام + منع التكرار
```ts
prisma.webhookEvent.create({ provider, providerEventId, eventType, signatureVerified, payload, status:"RECEIVED" })
```
- الفريد `UNIQUE(provider, providerEventId)` (`billing_webhook_events_provider_provider_event_id_key`) هو أساس منع التكرار.
- خطأ Prisma `P2002` (تكرار) → **200 `duplicate`** بلا أثر إضافي (استجابة سريعة).
- خطأ كتابة آخر → **200 `ignored`** (لا نُوفي، ولا نطلب إعادة إرسال لا نهائية).

### (4) إعادة التحقق من البوابة — `provider.verifyPayment(paymentId)`
- **لا نثق بجسم الـwebhook.** `verifyPayment` = `getPayment` = جلب الدفعة مباشرة من `api.moyasar.com/v1/payments/{id}`
  (`moyasar.ts:126,142`) — مصدر الحقيقة.
- أحداث غير الدفع الناجح (`status !== "paid"` أو بلا `paymentId`) → تُسجَّل `PROCESSED` وتُتجاهَل (**200 `ignored`**).
- فشل التأكيد من البوابة → `FAILED` (**200 `rejected`**).

### (5) مطابقة المبلغ/العملة (منع تلاعب العميل)
- ربط الطلب من `metadata.orderId` (من الحدث أو من الدفعة المؤكَّدة) — لا من مدخلات العميل. غيابه/عدم وجود الطلب → `FAILED` (**200 `rejected`**).
- إن اختلف `verified.amountHalalas` عن `order.totalHalalas` أو `verified.currency` عن `order.currency`:
  يُكتب `recordBillingAudit({ action:"WEBHOOK_AMOUNT_MISMATCH" })` وتصبح النتيجة `FAILED` (**200 `mismatch`**).

### (6) الإيفاء الـidempotent — `fulfillPaidOrder(...)`
- `lib/modules/billing/fulfillment.ts`. idempotent عبر:
  - تحديث حالة الطلب ذرّيًا بشرط الحالة (`updateMany where status ∈ {PENDING, AWAITING_PAYMENT, FAILED}`)؛
    إن كان `PAID`/`REFUNDED` سلفًا → `alreadyFulfilled` بلا تكرار.
  - مفاتيح منح ثابتة: حزمة النقاط `order:{id}:grant`؛ نقاط الاشتراك `sub:{subId}:{YYYY-MM-DD}:{orderId}`.
- بعده `finalize("PROCESSED")` → **200 `processed`**.

---

## 3. دورة حياة `WebhookEvent`

النوع `WebhookStatus` (`ensure-billing-schema.ts:20`): `RECEIVED · PROCESSED · FAILED · DUPLICATE · DEAD_LETTER`.

```
RECEIVED ──(نجاح الإيفاء)──────────▶ PROCESSED
   │
   ├─(حدث غير دفع ناجح / تجاهل)────▶ PROCESSED (detail=status=...)
   ├─(verifyPayment فشل)───────────▶ FAILED
   ├─(لا orderId / طلب مفقود)──────▶ FAILED
   └─(عدم تطابق المبلغ/العملة)─────▶ FAILED
```
- `processedAt` و`processingError` يُضبطان في `finalize()` (`webhook-processor.ts:59`).
- التكرار (P2002) لا يُنشئ صفًّا ثانيًا — يعاد `duplicate` مباشرة (قيمة enum `DUPLICATE` محجوزة للاستخدام اليدوي/المصالحة).
- `DEAD_LETTER` قيمة enum متاحة لعزل الأحداث الفاشلة المتكررة (يُدار عبر المصالحة/الإدارة — راجع `reconciliation.md`).

نتائج `processPaymentWebhook` (`WebhookOutcome.status`): `processed · duplicate · rejected · ignored · mismatch · unverified`.

---

## 4. إعداد `MOYASAR_WEBHOOK_SECRET`

1. في لوحة Moyasar: أنشئ Webhook يشير إلى `PAYMENT_WEBHOOK_URL` (= `https://<host>/api/billing/webhooks/moyasar`).
2. انسخ سرّ الـwebhook إلى `MOYASAR_WEBHOOK_SECRET` (عبر لوحة إعدادات حكيم — يُخزَّن مشفّرًا AES-256-GCM ويُحقن للبيئة عند الإقلاع).
3. تحقّق: أرسل حدث اختبار؛ يجب أن يعيد `200 processed` مع منح النقاط، أو `401 unverified` إن كان السرّ خاطئًا.

> إن كانت البوابة ترسل توقيع HMAC في ترويسة، يستخدمه المعالج تلقائيًا؛ وإلا يعتمد السرّ المشترك في الجسم.

---

## 5. الحالات الخاصة

| الحالة | المعالجة |
|---|---|
| **إعادة إرسال (Replay) / تكرار** | `UNIQUE(provider, providerEventId)` → `200 duplicate` بلا منح ثانٍ. |
| **ترتيب غير متوقّع (Out-of-order)** | كل حدث يُعاد التحقق منه مستقلًّا عبر `verifyPayment` (حالة البوابة الحالية)؛ الإيفاء idempotent فلا يتأثر بالترتيب. |
| **حدث بمبلغ مزيّف** | يُرفض في المرحلة (5) ويُدقَّق `WEBHOOK_AMOUNT_MISMATCH`. |
| **حدث بلا سرّ في الإنتاج** | إن ضُبط السرّ ولم يطابق → 401؛ إن لم يُضبط السرّ (`enforced:false`) يمرّر — لذا اضبطه دومًا. |
| **فشل داخلي غير متوقّع** | المسار يعيد 200 (تفادي إعادة إرسال لا نهائية)؛ الصف يبقى `RECEIVED`/`FAILED` لالتقاطه في المصالحة. |

---

## 6. إعادة المعالجة من الإدارة

- الأحداث الفاشلة/العالقة تُميَّز بحالتها في `billing_webhook_events` (`FAILED`/`RECEIVED`) مع `processing_error`.
- إعادة المعالجة تُنفَّذ بإعادة استدعاء `fulfillPaidOrder({ orderId, providerPaymentId })` — وهي idempotent
  (لا منح مزدوج بفضل شرط حالة الطلب ومفاتيح المنح الثابتة).
- بديل يدوي: التحقق من الدفعة عبر `provider.verifyPayment(paymentId)` ثم الإيفاء إن تأكّد `paid` وتطابق المبلغ.

> لا سكربت «reprocess» مستقل بعد؛ إعادة التشغيل تعتمد على المصالحة اليومية والإجراءات الإدارية (راجع `reconciliation.md`).
