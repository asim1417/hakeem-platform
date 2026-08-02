# تقرير أمني — منظومة الفوترة

**المرجع:** HKM-BILLING-UX-001 (§14) · مراجعة ضوابط الأمن ومنع الإساءة
**النطاق:** الطبقة المالية (الطلبات/الدفع/الـwebhook/الرصيد/الفواتير/الإدارة) كما هي في الكود.
**الخلاصة:** الضوابط الجوهرية (تسعير خادمي، تحقق HMAC، idempotency، دفتر append-only مُتسلسل بالهاش، RBAC، تدقيق)
**مُنفَّذة**. تبقى فجوات محدودة موثّقة صراحةً في §نهاية التقرير.

---

## 1. تسعير موثوق من الخادم (Server-authoritative pricing)

- **الطلبات:** المبالغ تُحسب في الخادم فقط من `PlanPrice` الفعّال (`createSubscriptionOrder`, `orders.ts:47`) أو من
  `usage_credit_packages` (`createPackageOrder`, `orders.ts:83`). العميل لا يمرّر مبلغًا/نقاطًا إطلاقًا.
- **بدء الدفع:** `startCheckout` (`checkout.ts:36`) يمرّر `order.totalHalalas` فقط إلى المزوّد؛ العميل يختار `type`/`planCode`/`packageCode` لا السعر.
- **تقدير الخدمة:** `POST /api/billing/estimate` يحسب السعر خادميًا عبر `estimateServiceCost`؛ لا يقبل `points` من العميل كسعر.
- **الخصم:** أسعار الخدمات تُقرأ من `usage_service_prices` بالكود لا من الطلب (`reserveUsageCredits`).

## 2. لا تلاعب بالمبلغ/النقاط من العميل

- الـwebhook يربط الطلب من `metadata.orderId` (من البوابة) لا من مدخلات العميل، ويطابق `verified.amountHalalas === order.totalHalalas`
  و`verified.currency === order.currency` قبل أي منح (`webhook-processor.ts:100`). أي تفاوت → `mismatch` + تدقيق.

## 3. تحقق الـWebhook (HMAC + سرّ مشترك)

- `MoyasarProvider.verifyWebhook` (`moyasar.ts:229`): `HMAC-SHA256` للجسم الخام عند وجود ترويسة توقيع، أو سرّ مشترك في الجسم،
  كلاهما بمقارنة **ثابتة الزمن** (`crypto.timingSafeEqual`, `moyasar.ts:74`) لمنع تسريب التوقيت.
- المعالج يرفض عند `enforced && !valid` (`401 unverified`). **ملاحظة:** بلا `MOYASAR_WEBHOOK_SECRET` يكون `enforced=false`
  (وضع تطوير) — يجب ضبط السرّ في الإنتاج (راجع `webhooks.md`).

## 4. إعادة التحقق من البوابة قبل المنح

- لا ثقة بجسم الـwebhook: `provider.verifyPayment(paymentId)` يجلب الدفعة من `/v1/payments/{id}` كمصدر حقيقة قبل الإيفاء
  (`webhook-processor.ts:78`، `moyasar.ts:142`).

## 5. Idempotency عبر مفاتيح فريدة

- `billing_orders.idempotency_key` **UNIQUE** — لا طلب مكرر (`orders.ts:54`).
- `billing_webhook_events` **UNIQUE(provider, provider_event_id)** — لا حدث مكرر (منع Replay).
- الإيفاء idempotent بشرط حالة الطلب الذرّي + مفاتيح منح ثابتة (`fulfillment.ts:33`).
- المنح/التعديل في المحرك idempotent عبر `usage_credit_ledger.idempotencyKey` UNIQUE و`usage_credit_reservations.idempotencyKey`.

## 6. دفتر append-only مُتسلسل بالهاش + Trigger

- `usage_credit_ledger` يمنع التعديل/الحذف عبر Trigger `usage_credit_ledger_no_mutation`
  (`BEFORE UPDATE OR DELETE`, هجرة `20260729130000_usage_credits_v2`) الذي يرفع استثناء `append-only`.
- كل قيد يحمل سلسلة `previousHash → entryHash` بـ`SHA-256` على حمولة (المستخدم/النوع/المبلغ/الرصيد/المفتاح/الوقت)
  (`appendLedger`, `usage-ledger.ts:718`) — يكشف أي عبث لاحق.
- كل خصم داخل `$transaction` مع `SELECT ... FOR UPDATE` وقيود `CHECK` تمنع الرصيد السالب و`reserved > balance`.

## 7. لا تخزين لبيانات البطاقة الخام (PAN/CVC)

- `billing_payment_methods` يخزّن **توكنات فقط**: `provider_token`, `provider_customer_id`, `brand`, `last_four`, `expiry_*`
  (`ensure-billing-schema.ts:133`). لا عمود لـPAN/CVC.
- `tokenizePaymentMethod` (`moyasar.ts:167`) يقبل توكن العميل فقط؛ Moyasar يُنشئ التوكن من جانب العميل.

## 8. المال كأعداد صحيحة (هللات)

- كل المبالغ `Int` بالهللات (`subtotal/vat/total_halalas`)؛ لا أرقام عشرية. الضريبة تُقسَّم عبر `splitVatInclusive`
  (`points.ts:51`) و`VAT_RATE_BPS=1500`. التكلفة الداخلية بالـmicros USD (عدد صحيح، `model-pricing.ts`).

## 9. RBAC للإدارة + تدقيق

- كل مسارات `/api/admin/billing/**` محميّة بـ`requireSuperAdminApi(request)` (دور `SUPER_ADMIN` + علم اللوحة، وتكتب `ACCESS_DENIED` عند الرفض).
- كل إجراء مالي (منح/سحب/تعديل سعر/استرداد/اشتراك/checkout/تفاوت webhook) يُدقَّق عبر `recordBillingAudit`
  (`billing-audit.ts`) في `billing_audit_logs` **ويُعكَس** إلى `audit_logs` بـ`subject:"BILLING"`. المنح/السحب يتطلب سببًا إلزاميًا.

## 10. حماية Replay

- تكرار أي حدث → `P2002` على `UNIQUE(provider, providerEventId)` → `200 duplicate` بلا منح ثانٍ (§5). الطلبات المدفوعة سلفًا لا تُوفى مرتين.

## 11. الفواتير غير قابلة للتلاعب

- أرقام متسلسلة ذرّية لكل سنة عبر `billing_invoice_counters` (`nextInvoiceNumber`, `invoicing.ts:38`)، لقطة بائع/مشتري وقت الإصدار،
  الفاتورة idempotent عبر `order_id` UNIQUE، ولا تعديل بعد الإصدار (الاسترداد عبر إشعار دائن `CREDIT_NOTE`).

---

## الفجوات و«ما زال معلّقًا» (بصراحة)

| البند | الحالة | التوصية |
|---|---|---|
| **تحديد المعدّل على مسارات AI الداخلية** | **معلّق** — Rate limiting موجود لبوابة API الخارجية والمرفقات فقط؛ مسارات AI الداخلية بلا حدّ معدّل (baseline §4). | إضافة حدّ بالمستخدم/IP + حدّ متزامن + حدّ يومي للتجربة قبل الإنفاذ الكامل. |
| **تشفير `provider_token` عند الراحة** | **فجوة** — العمود يُخزَّن نصًّا الآن؛ `MANAGED_KEYS` لا يشمله. | تشفيره بمساعد AES-256-GCM القائم (`encryptValue`/`decryptValue`, `settings-service.ts:84`) وفكّه عند الشحن للبوابة فقط. |
| **تكامل ZATCA** | **غير مُعتمَد** — خلف علم `ZATCA_INTEGRATION_ENABLED`؛ الفاتورة تُعلَّم `zatca_status=PENDING` فقط عند التفعيل (`invoicing.ts:102`)، بلا XML/QR/إبلاغ فعلي. | **لا تدّعِ توافقًا نهائيًا** قبل الاختبارات النظامية والاعتماد. |
| **سرّ webhook في الإنتاج** | **إجرائي** — بلا `MOYASAR_WEBHOOK_SECRET` يمرّ الحدث (`enforced=false`). | فرض ضبط السرّ في الإنتاج (تحقّق نشر). |
| **تصعيد Dead-letter / مصالحة مجدولة** | **مخطّط** — الأدوات جاهزة (`getSettlement`, `attempts`, `DEAD_LETTER`) بلا سكربت جدولة. | تنفيذ `scripts/reconcile-billing.ts` مجدولًا (راجع `reconciliation.md`). |
| **تحرير الحجوزات دوريًا لكل المستخدمين** | **جزئي** — `expireHeldReservations` يعمل عند الحجز فقط؛ لا مسح دوري شامل. | جدولته ضمن المصالحة اليومية. |

---

*كل ما ورد أعلاه مستند إلى الكود الفعلي في `lib/modules/billing/*`، `lib/payments/*`، و`app/api/billing/**` بتاريخ المراجعة.
الفجوات المذكورة يجب إغلاقها قبل رفع أعلام الإنفاذ/الدفع في الإنتاج.*
