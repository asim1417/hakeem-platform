# دليل المصالحة — الفوترة

**المرجع:** HKM-BILLING-UX-001 (§7/§8/§18) · مهمة المصالحة اليومية ومعالجة ما فات
**الهدف:** ضمان تطابق الطلبات مع المدفوعات مع النقاط الممنوحة مع الفواتير مع تسوية البوابة، ورصد أي انحراف.
**الحالة:** الأدوات الأساسية (getSettlement، expireBuckets، expireHeldReservations، BillingAuditLog) **مُنفَّذة**؛
مهمة المصالحة المجدولة نفسها **مخطّطة** (لا سكربت `scripts/` مستقل بعد — انظر §5).

---

## 1. فحوص المصالحة اليومية المقصودة

لكل يوم (أو نافذة `from/to`)، تُطابَق السلاسل الخمس:

```
Orders ── Payments ── Granted Points (Ledger) ── Invoices ── Gateway Settlement
```

| # | الفحص | المصدران | الأداة الفعلية |
|---|---|---|---|
| 1 | كل طلب `PAID` له دفعة `PAID` بنفس المبلغ | `billing_orders` ↔ `billing_payments` | استعلام مباشر |
| 2 | كل دفعة ناجحة أوفت طلبها (نقاط/اشتراك) | `billing_payments` ↔ `usage_credit_ledger` (`source=grant:*` بمرجع `order/subscription`) | `getUsageCreditStatus` / استعلام دفتر |
| 3 | كل طلب مدفوع له فاتورة | `billing_orders` ↔ `billing_invoices` (`order_id` فريد) | `issueInvoiceForOrder` idempotent |
| 4 | مجموع الدفعات = تسوية البوابة | `billing_payments` ↔ Moyasar | `provider.getSettlement({ from, to })` (`moyasar.ts:257`) |
| 5 | لا حدث webhook `RECEIVED`/`FAILED` عالق لطلب مدفوع فعليًا | `billing_webhook_events` ↔ `billing_orders` | استعلام + إعادة إيفاء |

- `provider.getSettlement` يعيد `{ id, amountHalalas, feeHalalas, status, date }[]` من `/v1/settlements`.
  يُقارن إجمالي التسوية (والرسوم) مع مجموع `billing_payments.amount_halalas`/`provider_fee_halalas` للنافذة.

---

## 2. اكتشاف الانحرافات وإبرازها

- **مطابقة المبلغ في الوقت الفعلي:** أي تفاوت مبلغ/عملة أثناء الـwebhook يُسجَّل فورًا
  `recordBillingAudit({ action:"WEBHOOK_AMOUNT_MISMATCH", targetType:"order", metadata:{ expected, got, currency } })`
  (`webhook-processor.ts:102`).
- **سجل التدقيق المالي:** كل انحراف/إجراء يُكتب عبر `recordBillingAudit` (`lib/modules/billing/billing-audit.ts`) في
  جدول `billing_audit_logs` **ويُعكَس** إلى `audit_logs` بـ`subject:"BILLING"`. الجدول append-friendly (لا حذف صامت).
- **الإبراز/التنبيه (Alerting):** المصالحة المخطّطة تجمع الانحرافات (أزواج غير متطابقة، فواتير مفقودة، فجوة تسوية)
  وتكتب حدث تدقيق موجزًا (مثل `RECONCILIATION_MISMATCH`) لعرضه في لوحة `/admin/billing`. **قناة التنبيه الخارجية (بريد/رسالة) مخطّطة.**

الإجراءات التصحيحية المتاحة الآن:
- فاتورة مفقودة لطلب مدفوع → إعادة `issueInvoiceForOrder` (idempotent عبر `order_id`).
- منح مفقود لطلب مدفوع → إعادة `fulfillPaidOrder` (idempotent — لا منح مزدوج).
- عكس نقاط بعد استرداد → `POST /api/admin/billing/refunds/[id]/approve` (يعكس عبر `adjustCredits`).

---

## 3. معالجة الأحداث الفاشلة (Dead-letter)

- كل حدث webhook يُسجَّل خامًا في `billing_webhook_events` قبل أي معالجة (لا فقدان).
- الحالات: `RECEIVED → PROCESSED | FAILED`؛ وقيمتا `DUPLICATE`/`DEAD_LETTER` محجوزتان في enum `WebhookStatus`.
- `finalize()` في `webhook-processor.ts` يقبل `DEAD_LETTER` كحالة نهائية لعزل الأحداث الفاشلة المتكررة
  (التصعيد الآلي إلى `DEAD_LETTER` بعد N محاولات **مخطّط**؛ عدّاد `attempts` موجود في الجدول).
- المعالجة: المصالحة تلتقط كل صف `FAILED`/`RECEIVED` قديم، تعيد التحقق عبر `verifyPayment`، وتُعيد الإيفاء إن تأكّد الدفع؛
  وإلا تنقله إلى `DEAD_LETTER` للمراجعة الإدارية اليدوية.

---

## 4. الحجوزات والأرصدة العالقة (Expiry)

- **الحجوزات المعلّقة (held):** TTL = 15 دقيقة (`usage-ledger.ts:140`). تُحرَّر تلقائيًا عبر `expireHeldReservations(tx, userId)`
  الذي يُستدعى **ضمنيًا في بداية كل `reserveUsageCredits`** — يعيد `reservedMilliUnits` المحجوز دون خصم.
  (لا سكربت جدولة مستقل يمرّ على كل المستخدمين دوريًا بعد — مخطّط ضمن المصالحة.)
- **الأرصدة المنتهية (buckets):** `expireCredits(userId?)` (`credit-engine.ts:327`) → `expireBuckets` (`usage-ledger.ts:578`):
  يغلق الـBucket ذرّيًا (`status='expired'`)، يخفض المحفظة، ويكتب قيد دفتر `source="expire"` بمفتاح `expire:{bucketId}` (idempotent).
  يُشغَّل يوميًا في المرحلة E؛ يمكن استدعاؤه بلا `userId` ليمرّ على كل الأرصدة المنتهية.

---

## 5. ما هو مُنفَّذ مقابل المخطّط

| العنصر | الحالة | الموضع |
|---|---|---|
| جلب تسوية البوابة | **مُنفَّذ** | `provider.getSettlement` (`moyasar.ts:257`) |
| تحقق المبلغ + تدقيق التفاوت | **مُنفَّذ** | `webhook-processor.ts:100` |
| تسجيل خام لكل حدث (لا فقدان) | **مُنفَّذ** | `billing_webhook_events` |
| إعادة إيفاء idempotent | **مُنفَّذ** | `fulfillment.ts` |
| انتهاء الأرصدة + قيد دفتر | **مُنفَّذ** | `expireBuckets` / `expireCredits` |
| تحرير الحجوزات المعلّقة | **مُنفَّذ (ضمنيًّا عند الحجز)** | `expireHeldReservations` |
| اختبارات الفوترة | **مُنفَّذ** | `scripts/test-billing-*.ts` |
| **سكربت مصالحة يومي مجدول** | **مخطّط** | — (لا `scripts/reconcile-*` بعد) |
| **تصعيد آلي إلى DEAD_LETTER + عدّاد المحاولات** | **مخطّط** | حقل `attempts` موجود؛ المنطق مخطّط |
| **مهمة انتهاء الأرصدة المجدولة (cron)** | **مخطّط (المرحلة E)** | الدالة جاهزة؛ الجدولة مخطّطة |
| **تنبيه خارجي (بريد/رسالة)** | **مخطّط** | التدقيق يُكتب؛ القناة مخطّطة |

> عند تنفيذ المصالحة كسكربت: أضِف `scripts/reconcile-billing.ts` يستدعي `getSettlement` ويقارن مع `billing_payments`/`billing_orders`،
> ويكتب انحرافاته عبر `recordBillingAudit`، ثم يُجدوَل يوميًا في المرحلة E مع `expireCredits()`.
