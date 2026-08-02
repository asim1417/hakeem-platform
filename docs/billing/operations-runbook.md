# دليل التشغيل — منظومة الفوترة

**المرجع:** HKM-BILLING-UX-001 · دليل العمليات (Operations Runbook)
**النطاق:** تفعيل المراحل، المخطط، البذر، الاختبارات، Moyasar، الاسترجاع (Rollback)، والمهام التشغيلية.
**قاعدة حاكمة:** كل شيء خلف أعلام؛ الوضع الافتراضي كامل `false`. لا تفعيل إنتاجي قبل اكتمال المرحلة واختباراتها.
**كل المبالغ بالهللات (أعداد صحيحة)؛ النقطة = 1000 milli-unit (`POINTS_PER_MILLI`).**

---

## 0. الأعلام والمراحل — نظرة سريعة

الأعلام تُقرأ من `process.env` بنمط `/^(1|true|on)$/i`، وتُحقن من لوحة الإعدادات إلى البيئة عند الإقلاع
عبر `hydrateEnvFromSettings()` (`instrumentation.ts:7`). القيم الافتراضية في `.env.billing.example`.

| العلم | يحكم | يُقرأ في |
|---|---|---|
| `BILLING_ENABLED` | التبديل الرئيسي للطبقة المالية | `lib/modules/billing/checkout.ts:12` (شرط أول لـ`paidCheckoutEnabled`) |
| `CREDITS_ENFORCEMENT_ENABLED` | إنفاذ الخصم الفعلي (فيل-كلوزد) | بوابة الخدمات (تعميم `gateAdvancedUse`) |
| `PAID_CHECKOUT_ENABLED` | شراء الحزم/الاشتراكات | `checkout.ts:14` (شرط ثانٍ لـ`paidCheckoutEnabled`) |
| `SUBSCRIPTIONS_ENABLED` | دورة حياة الاشتراك الكاملة | مسارات `subscription/*` |
| `AUTO_RENEWAL_ENABLED` | التجديد التلقائي بالبطاقات المرمّزة | جدولة التجديد (المرحلة E) |
| `ZATCA_INTEGRATION_ENABLED` | حالة ZATCA على الفواتير | `lib/modules/billing/invoicing.ts:102` (تُعيّن `zatca_status='PENDING'` بدل `NOT_APPLICABLE`) |
| `USAGE_CREDITS_V2` | محرك وحدات الرصيد v2 | `lib/modules/credits/usage-ledger.ts:48` (`usageCreditsEnabled`) |

> ملاحظة: `paidCheckoutEnabled()` يتطلب **كلا** العلمين `BILLING_ENABLED` **و** `PAID_CHECKOUT_ENABLED` معًا.
> و`usageCreditsEnabled()` يقبل إمّا `USAGE_CREDITS_V2=true` أو صفًّا مفعّلًا في جدول `feature_toggles` بالمفتاح `usage_credits_v2`.

### ترتيب تفعيل المراحل (المطابق للتصميم §19)

```
0  الأساس          كل الأعلام false — schema + seed + provider + webhook جاهزة بلا تفعيل
A  Shadow Metering  قياس تكلفة Claude فقط (بلا خصم) — model-pricing + ai_usage_events
B  إنفاذ النقاط     USAGE_CREDITS_V2=true ثم CREDITS_ENFORCEMENT_ENABLED=true
C  شراء النقاط      BILLING_ENABLED=true + PAID_CHECKOUT_ENABLED=true (+ MOYASAR_*)
D  الاشتراكات       SUBSCRIPTIONS_ENABLED=true
E  تجديد + ZATCA    AUTO_RENEWAL_ENABLED=true + ZATCA_INTEGRATION_ENABLED=true
```

### كيف تُفعّل كل مرحلة (خطوات ملموسة)

- **المرحلة A (قياس الظل):** لا علم خاص. تأكّد من تطبيق `20260802120000_billing_core` وبذر `billing_model_prices`
  (`npm run seed:billing`). القياس يعمل عبر `lib/modules/billing/model-pricing.ts` (`getModelRate`/`costFromUsage`)
  دون التأثير على المستخدم. تحقّق بـ `npm run test:billing-cost`.
- **المرحلة B (إنفاذ النقاط):**
  1. اضبط `USAGE_CREDITS_V2=true` (أو فعّل `feature_toggles.usage_credits_v2`).
  2. امنح رصيد التجربة/البذر.
  3. بعد التحقق، اضبط `CREDITS_ENFORCEMENT_ENABLED=true` ليصبح النظام «فيل-كلوزد»
     (لا استخدام مجاني عند خطأ DB). تحقّق بـ `npm run test:billing-buckets` و`npm run test:usage-credits-v2`.
- **المرحلة C (الشراء):** اضبط `BILLING_ENABLED=true` و`PAID_CHECKOUT_ENABLED=true`، واضبط مفاتيح Moyasar
  و`PAYMENT_WEBHOOK_URL`. تحقّق بـ `npm run test:billing-foundation` و`npm run test:billing-invoicing`.
- **المرحلة D (الاشتراكات):** اضبط `SUBSCRIPTIONS_ENABLED=true`. مسارات `subscription/{cancel,resume,change-plan}` تعمل.
  تحقّق بـ `npm run test:billing-proration`.
- **المرحلة E (التجديد + ZATCA):** اضبط `AUTO_RENEWAL_ENABLED=true` و`ZATCA_INTEGRATION_ENABLED=true` بعد
  اعتماد بيانات المنشأة (`COMPANY_*`). **لا تدّعِ توافق ZATCA النهائي قبل الاختبارات النظامية.**

---

## 1. إنشاء المخطط (Schema)

المخطط المالي يُنشأ بطريقتين متكاملتين (idempotent، لا حذف/إعادة تسمية):

1. **DDL عند الإقلاع** — `ensureBillingSchema()` (`lib/modules/billing/ensure-billing-schema.ts:371`) يُستدعى في
   `instrumentation.ts:64` عند كل إقلاع خادم. ينشئ الأنواع (enums)، جداول `billing_*`، الفهارس، المفاتيح الأجنبية،
   طبقة `usage_credit_buckets`، عدّاد `billing_invoice_counters`، ويوسّع جداول v2 القائمة (`V2_EXTENSIONS`).
   هذه هي الآلية الفعلية على Neon/Vercel لأن البناء لا يشغّل `prisma migrate deploy`.
2. **هجرة Prisma** — `prisma/migrations/20260802120000_billing_core` تحمل النماذج نفسها لبيئات تشغّل الهجرات.

> الجداول الخام `usage_credit_*` (المحرك) تأتي من هجرة `20260729130000_usage_credits_v2` وتبقى كما هي؛
> طبقة Buckets تُضاف فوقها. كلا الطريقتين آمنتان للتكرار (`IF NOT EXISTS` / `DO $$ ... duplicate_object`).
> لإعادة التهيئة في الاختبارات: `__resetBillingSchemaMemo()`.

---

## 2. البذر (Seed)

```bash
npm run seed:billing        # tsx prisma/seed-billing.ts
```

- idempotent بمعرّفات حتمية (`seed_<CODE>_<PERIOD>`) — آمن لإعادة التشغيل، لا يفعّل أي دفع/خصم.
- يبذر من `config/billing-plans.ts`:
  - الباقات + الأسعار المؤرّخة (Prisma): `billing_plans` / `billing_plan_prices` (السعر الشامل يُقسَّم صافٍ+ضريبة عبر `splitVatInclusive`).
  - أسعار النماذج (Prisma): `billing_model_prices`.
  - أسعار الخدمات + الحزم (v2 خام): `usage_service_prices` / `usage_credit_packages` (`milliUnits = نقاط × 1000`).
- يستدعي `ensureBillingSchema()` أولًا. إن لم تكن جداول `usage_credits_v2` مطبَّقة، يتخطّى بذر الخدمات/الحزم
  بتحذير بدل الفشل (طبّق هجرة `usage_credits_v2` ثم أعد التشغيل).

قيم البذر المرجعية: الباقات FREE(100)/INDIVIDUAL(500·4900)/PROFESSIONAL(2200·14900)/OFFICE(9000·49900·5 مقاعد)/ENTERPRISE(عرض سعر) ·
الحزم PACK_250@2900 / PACK_700@6900 / PACK_1600@13900 · 12 كود خدمة (ASK_QUICK…PRO_EXPORT).

---

## 3. حزمة الاختبارات

```bash
npm run test:billing-foundation   # scripts/test-billing-foundation.ts  — الأساس (طلبات/مبالغ خادمية)
npm run test:billing-cost         # scripts/test-billing-cost.ts        — حساب تكلفة المزوّد (micros USD)
npm run test:billing-buckets      # scripts/test-billing-buckets.ts     — توزيع الأقرب انتهاءً + منح/انتهاء
npm run test:billing-invoicing    # scripts/test-billing-invoicing.ts   — الترقيم المتسلسل + الضريبة
npm run test:billing-proration    # scripts/test-billing-proration.ts   — التناسب للترقية/التخفيض
# متصلة بالمنظومة:
npm run test:usage-credits-v2     # محرك الرصيد v2 (حجز/تثبيت/تحرير)
npm run test:credits              # النقاط والـonboarding
npm run test:quota                # الحصة المجانية
```

نقيّة بلا قاعدة بيانات حيثما أمكن (مثل `test:billing-cost`/`test:billing-proration`). شغّلها كلها قبل ترقية أي علم.

---

## 4. Moyasar: من الاختبار (Sandbox) إلى الإنتاج

المزوّد مجرّد خلف `lib/payments/payment-provider.ts`؛ التنفيذ `lib/payments/providers/moyasar.ts`.
الاختيار عبر `PAYMENT_PROVIDER=moyasar` (`getPaymentProvider`, `payment-provider.ts:144`).

**متغيّرات مطلوبة:**
```
PAYMENT_PROVIDER=moyasar
MOYASAR_SECRET_KEY=          # sk_test_... (sandbox) → sk_live_... (إنتاج)
MOYASAR_PUBLISHABLE_KEY=     # pk_test_... → pk_live_...
MOYASAR_WEBHOOK_SECRET=      # سرّ webhook (HMAC/سرّ مشترك) — إلزامي في الإنتاج
PAYMENT_WEBHOOK_URL=         # https://<host>/api/billing/webhooks/moyasar
BILLING_CURRENCY=SAR
VAT_RATE_BPS=1500
```

**خطوات الانتقال:**
1. **Sandbox:** استخدم مفاتيح `sk_test_/pk_test_`. `isLive()` يصبح true بمجرد ضبط `MOYASAR_SECRET_KEY`
   (`moyasar.ts:84`). نفّذ دفعة تجريبية عبر `POST /api/billing/checkout/start`.
2. **Webhook:** سجّل `PAYMENT_WEBHOOK_URL` في لوحة Moyasar واضبط `MOYASAR_WEBHOOK_SECRET` (راجع `webhooks.md`).
   بدون هذا السرّ يكون التحقق غير مُنفَّذ (`enforced:false`) — ممنوع في الإنتاج.
3. **إنتاج:** بدّل المفاتيح إلى `live`، وفعّل `BILLING_ENABLED` + `PAID_CHECKOUT_ENABLED`، وتحقّق من التسويات
   عبر `provider.getSettlement(...)`.

> الأسرار تُدار عبر لوحة الإعدادات (AES-256-GCM، `MANAGED_KEYS` في `settings-service.ts`) ولا تُطبع في السجلات.

---

## 5. متغيّرات البيئة (المرجع الكامل)

انسخ من `.env.billing.example`. الأساسية:

```
PAYMENT_PROVIDER · MOYASAR_SECRET_KEY · MOYASAR_PUBLISHABLE_KEY · MOYASAR_WEBHOOK_SECRET
PAYMENT_CALLBACK_URL · PAYMENT_WEBHOOK_URL
BILLING_CURRENCY=SAR · VAT_RATE_BPS=1500 · POINTS_PER_MILLI=1000
COMPANY_VAT_NUMBER · COMPANY_LEGAL_NAME_AR · COMPANY_LEGAL_NAME_EN · COMPANY_CR_NUMBER · COMPANY_ADDRESS_JSON
LEGACY_USER_GRANT_POINTS=0
BILLING_ENABLED · CREDITS_ENFORCEMENT_ENABLED · PAID_CHECKOUT_ENABLED
SUBSCRIPTIONS_ENABLED · AUTO_RENEWAL_ENABLED · ZATCA_INTEGRATION_ENABLED · USAGE_CREDITS_V2
```

`COMPANY_*` تُستخدم في لقطة البائع للفواتير (`sellerSnapshot`, `invoicing.ts:21`).

---

## 6. خطة الاسترجاع (Rollback) لكل مرحلة

الاسترجاع في هذه المنظومة **بإطفاء الأعلام** لا بحذف بيانات — الجداول idempotent والدفتر append-only.

| المرحلة | الاسترجاع | الأثر |
|---|---|---|
| E (تجديد/ZATCA) | `AUTO_RENEWAL_ENABLED=false`, `ZATCA_INTEGRATION_ENABLED=false` | يتوقف التجديد؛ الفواتير الجديدة تصبح `zatca_status=NOT_APPLICABLE`. الفواتير الصادرة لا تُعدَّل. |
| D (اشتراكات) | `SUBSCRIPTIONS_ENABLED=false` | تتوقف مسارات الاشتراك؛ الاشتراكات القائمة تبقى في DB. |
| C (شراء) | `PAID_CHECKOUT_ENABLED=false` (أو `BILLING_ENABLED=false`) | يرفض `startCheckout` أي طلب جديد. الطلبات المدفوعة سلفًا لا تتأثر. |
| B (إنفاذ) | `CREDITS_ENFORCEMENT_ENABLED=false` ثم `USAGE_CREDITS_V2=false` | يعود النظام «فيل-أوبن»؛ يتوقف الخصم. الأرصدة/الدفتر تبقى سليمة. |
| A (قياس) | لا أثر مستخدم — يمكن ترك القياس أو تعطيل بذر الأسعار | القياس داخلي فقط. |

**بعد أي استرجاع:** لا تحذف صفوف `usage_credit_ledger` (يمنعها Trigger append-only). الحجوزات المعلّقة تُحرَّر
تلقائيًا بانتهاء TTL (15 دقيقة) عبر `expireHeldReservations`.

---

## 7. المهام التشغيلية الشائعة (المسارات الفعلية)

كل المسارات الإدارية محميّة بـ`requireSuperAdminApi` وتكتب تدقيقًا عبر `recordBillingAudit` (§12).

### منح/سحب نقاط لمستخدم
`POST /api/admin/billing/users/[id]/grant` — `app/api/admin/billing/users/[id]/grant/route.ts`
```json
{ "points": 500, "reason": "تعويض عطل" }   // موجب = منح ADMIN_GRANT ، سالب = سحب/تعديل
```
- السبب إلزامي؛ `points` صفر مرفوض. المنح عبر `grantCredits(sourceType:"ADMIN_GRANT")`، السحب عبر `adjustCredits` (لا رصيد سالب).

### تعديل سعر خدمة
`GET/POST /api/admin/billing/service-rates` — `app/api/admin/billing/service-rates/route.ts`
```json
{ "serviceCode": "ASK_SOURCED", "points": 15, "reason": "مراجعة تسعير", "active": true }
```
- يرفع `version` ولا يؤثر رجعيًا على السجلات السابقة (تحفظ إصدارها). السبب إلزامي. التخزين `milliUnits = points × 1000`.

### الموافقة على استرداد
1. المستخدم: `POST /api/billing/refunds/request` `{ paymentId, reason }` → ينشئ `Refund` بحالة `PENDING` (لا تنفيذ فوري).
2. الإدارة: `POST /api/admin/billing/refunds/[id]/approve` — ينفّذ عبر `provider.refundPayment`، يعكس النقاط الممنوحة
   ما أمكن (`adjustCredits` سالب، دون رصيد سالب)، ويحدّث حالات Refund/Payment/Order (كامل → `REFUNDED`، جزئي → `PARTIALLY_REFUNDED`).

### إدارة الاشتراك/الحصّة (المسار القديم المتوافق)
`POST /api/admin/billing/subscription` `{ userId, action: "activate"|"revoke"|"reset_quota" }` — يعمل على أعمدة
`users.subscriptionStatus`/الحصّة المجانية (توافق خلفي)، ويكتب `audit_logs` بـ`subject:"ADMIN"`.

### مهام دورية (رصيد)
- انتهاء الأرصدة: `expireCredits(userId?)` (`credit-engine.ts:327` → `expireBuckets`) — تُجدوَل يوميًا (المرحلة E).
- تحرير الحجوزات العالقة: `expireHeldReservations` يُنفَّذ ضمنيًا في كل `reserveUsageCredits`؛ لا سكربت جدولة مستقل بعد (مخطّط).
