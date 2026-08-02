# التقرير النهائي — منظومة النقاط والاشتراكات والمدفوعات

**المرجع:** HKM-BILLING-UX-001 · المخرج رقم 15
**الفرع:** `claude/hakim-billing-system-rato3i` · **التاريخ:** 2026-08-02
**الحالة:** المراحل 0–E منفّذة خلف أعلام، مع اختبارات وحدة خضراء و`tsc` نظيف. **لا تفعيل إنتاجي.**

---

## 1. ما نُفِّذ

### الأساس (المرحلة 0)
- **نماذج Prisma للطبقة المالية**: Plan, PlanPrice, Subscription, Order, Payment, PaymentMethod, Invoice, Refund, WebhookEvent, BillingAuditLog, ModelPrice, TenantWorkspace, WorkspaceMember + الـenums، و`BILLING` في `AuditSubject`.
- **آلية الإنشاء**: `lib/modules/billing/ensure-billing-schema.ts` (DDL idempotent عند الإقلاع عبر `instrumentation.ts`) + مجلد migration مطابق.
- **توحيد النقطة**: `lib/modules/credits/points.ts` (1 نقطة = 1000 milli-unit، تحويل الهللات، تقسيم الضريبة الشامل).
- **البذر**: `config/billing-plans.ts` + `prisma/seed-billing.ts` (`npm run seed:billing`) بقيم الأمر التنفيذي (FREE/INDIVIDUAL 49/PROFESSIONAL 149/OFFICE 499/ENTERPRISE؛ الحزم 250@29·700@69·1600@139؛ 12 سعر خدمة؛ أسعار النماذج).
- **تجريد مزود الدفع**: `lib/payments/payment-provider.ts` + `providers/moyasar.ts` (HMAC + سرّ مشترك + إعادة تحقق من البوابة). `.env.billing.example`.

### قياس التكلفة (المرحلة A)
- `lib/modules/billing/model-pricing.ts`: حساب تكلفة Claude الفعلية بالـmicros USD من الاستخدام الكامل (input/output/**cache/web-search**) عبر `ModelPrice` (مع سقوط للبذور).
- توسعة `ai_usage_events` (أعمدة cache/web-search/التكلفة/النقاط/الحالة/الكمون)، والتقاط cache/web-search في بوابة Claude المركزية (`ai-config.ts`) في المسارين العادي والـstreaming.

### محرك الرصيد (المرحلة B)
- `lib/modules/credits/bucket-allocation.ts` (نقيّ): الأقرب انتهاءً أولًا، التوزيع حسب المصدر.
- توسعة `usage-ledger.ts` بدوال Buckets (تعيد استخدام دفتر الهاش المُتسلسل): grant/consume/expire/getUserBuckets.
- `lib/modules/billing/credit-engine.ts`: واجهة بالنقاط — estimateServiceCost (شرائح + زيادة Opus/تصدير + موافقة الكبير جدًا)، reserve/capture(+توزيع)/release، grant/refund/adjust/expire، getWalletSummary، getEstimatedRemainingUses.

### الطلبات والمدفوعات والفواتير (المرحلة C)
- `orders.ts` (مبالغ خادمية)، `checkout.ts` + `/api/billing/checkout/start`، `webhook-processor.ts` + `/api/billing/webhooks/moyasar` (تحقق → تسجيل خام → منع تكرار → إعادة تحقق من البوابة → مطابقة مبلغ → إيفاء idempotent)، `fulfillment.ts`، `invoicing.ts` (ترقيم متسلسل ذرّي، لقطات، منع التعديل)، `einvoice-provider.ts` (ZATCA خلف علم)، `billing-audit.ts`.
- مسارات: summary, estimate, ledger, checkout/start, orders/[id], invoices.

### دورة حياة الاشتراك والإدارة (المرحلة D)
- `proration.ts` (نقيّ)، `subscriptions.ts` (إلغاء/استئناف/ترقية فورية/تخفيض مؤجّل).
- مسارات المستخدم: subscription/{cancel,resume,change-plan}، refunds/request، payment-methods/{default,[id]}.
- مسارات الإدارة (سوبر أدمن + سبب إلزامي + تدقيق): service-rates، users/[id]/grant، refunds/[id]/approve.

### التجديد والمصالحة والإشعارات (المرحلة E)
- `trial.ts` (100 نقطة، 60+40، 14 يومًا، منع إعادة المنح بالهوية)، `renewal.ts`، `reconciliation.ts`، `notifications.ts` (كتالوج عربي + dedupe + بريد)، `scripts/billing-cron.ts` (`npm run billing:cron`).

### الواجهات
- مؤشر رصيد في الشريط، صفحات `/dashboard/account/*` (billing/usage/invoices/subscription/payment-methods)، مكوّنات UX (CostChip، ConfirmCostDialog، InsufficientBalanceDialog، DeductToast، PointPackages)، وقسم الحزم في `/pricing`. (RTL كامل + هاتف.)

---

## 2. نتائج الاختبارات (حقيقية)

اختبارات وحدة نقية (بلا قاعدة) — تعمل عبر `tsx` (نمط المشروع):

| السكربت | التغطية | النتيجة |
|---|---|---|
| `npm run test:billing-foundation` | تحويل النقاط، الضريبة، تحقق webhook، سلامة الكتالوج | **47/47 ✅** |
| `npm run test:billing-cost` | تكلفة Claude (cache/web-search)، الاستخراج، السقوط | **18/18 ✅** |
| `npm run test:billing-buckets` | الأقرب انتهاءً أولًا، العجز، التوزيع | **15/15 ✅** |
| `npm run test:billing-invoicing` | ترقيم الفواتير | **5/5 ✅** |
| `npm run test:billing-proration` | التناسب للترقية/النقاط | **9/9 ✅** |
| `npm run test:billing-trial` | تجزئة الهوية | **7/7 ✅** |

**الإجمالي: 101/101 اختبار وحدة ناجح.** `tsc --noEmit` نظيف (خروج 0) عبر المشروع كامله بعد كل مرحلة.

اختبارات التكامل وE2E مكتوبة كمخرجات (`scripts/test-billing-integration.ts`، `tests/e2e/billing.spec.ts`) وتتطلب **قاعدة بيانات staging + Moyasar Sandbox**، ولا تُشغَّل في بيئة التطوير هذه (لا قاعدة/بوابة حيّة).

---

## 3. ما لم يُنفَّذ / متبقٍّ

1. **تعميم الخصم على الخدمات الـ11**: البنية جاهزة (`credit-engine` + `access-gate` القائم)، لكن ربط `reserve/capture` بكل مسار AI (اسأل/تحليل/صياغة/تقدير/القاضي-الأدوار) يتبقّى — يُنفَّذ في تفعيل المرحلة B بعد اختبار الظل (A).
2. **ZATCA**: الواجهة والحقول جاهزة، لكن **لا مزود مربوط ولا شهادة توافق** — خلف `ZATCA_INTEGRATION_ENABLED`.
3. **تشفير provider tokens عند التخزين**: العمود موجود؛ يُوصى بتمريره عبر مساعد AES-256-GCM القائم (`settings-service`) قبل تفعيل حفظ البطاقات.
4. **Rate limiting على مسارات AI الداخلية**: غير مطبّق بعد (§14) — يُضاف عند تفعيل الإنفاذ.
5. **مقاعد OFFICE/ENTERPRISE**: النماذج (TenantWorkspace/WorkspaceMember) جاهزة، لكن ربط الرصيد المشترك بمساحة العمل وواجهات إدارة الأعضاء تتبقّى.
6. **لوحة الربحية والتحليلات في `/admin/billing`**: مسارات التعديل جاهزة؛ واجهات Overview/Profitability الرسومية تتبقّى.

---

## 4. المخاطر المتبقية

- **فيل-أوبن أثناء الرولأوت**: الأنظمة القديمة (حصة/نقاط) لا تزال تحكم الإنتاج؛ عند تفعيل `CREDITS_ENFORCEMENT_ENABLED` يجب التحقق من تحوّل السلوك إلى فيل-كلوزد.
- **توافق أسعار**: أسعار الأمر التنفيذي تختلف عن `config/pricing.ts` القديم (pro/team)؛ الكتالوج الجديد في DB منفصل — يلزم قرار توحيد العرض قبل إظهاره للمستخدمين الحاليين.
- **الاعتماد على المصالحة**: التقاط المدفوعات الفائتة يعتمد على مهمة `billing:cron` الدورية — يجب جدولتها فعليًا (cron/Vercel Cron).

---

## 5. خطوات تفعيل Sandbox

1. طبّق هجرة `usage_credits_v2` ثم `20260802120000_billing_core` على قاعدة staging (أو دع `ensureBillingSchema` يُنشئها عند الإقلاع).
2. `npm run seed:billing`.
3. اضبط مفاتيح Moyasar Sandbox: `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_SECRET_KEY`, `MOYASAR_WEBHOOK_SECRET`, و`PAYMENT_WEBHOOK_URL`.
4. فعّل `BILLING_ENABLED=true` ثم `PAID_CHECKOUT_ENABLED=true` (المرحلة C).
5. نفّذ `tests/e2e/billing.spec.ts` مقابل staging.

---

## 6. الانتقال إلى Production (متطلبات Moyasar والضريبة)

- **Moyasar**: مفاتيح Production، تسجيل الـwebhook على `PAYMENT_WEBHOOK_URL`، اختبار Apple Pay/Mada/Visa، وتأكيد التسويات (`getSettlement`).
- **الفوترة/الضريبة**: تعبئة `COMPANY_VAT_NUMBER`, `COMPANY_LEGAL_NAME_*`, `COMPANY_CR_NUMBER`, `COMPANY_ADDRESS_JSON`، و`VAT_RATE_BPS=1500`. **لا تفعيل ZATCA قبل ربط مزود متوافق واجتياز اختباراته.**
- فعّل المراحل تدريجيًا: A (قياس) → B (نقاط) → C (شراء) → D (اشتراكات) → E (تجديد+ZATCA)، ولا تفعّل الإنتاج الكامل قبل نجاح اختبارات التكامل وE2E.

---

## 7. خطة الـRollback

- كل مرحلة خلف علم مستقل؛ **إيقاف العلم يعيد السلوك السابق فورًا** دون هجرة عكسية.
- جداول الفوترة **إضافية** (لا حذف/إعادة تسمية)؛ تعطيل الأعلام يجعلها خاملة بلا أثر على المسارات القائمة.
- الأنظمة القديمة (حصة/نقاط ولاء) لم تُمَس وتبقى مصدر الإنتاج حتى الاعتماد الكامل.
- عند مشكلة في الدفع: أوقف `PAID_CHECKOUT_ENABLED`؛ الطلبات غير المكتملة تبقى `AWAITING_PAYMENT` وتُغلق بالمصالحة.

---

## 8. سجل الإيداعات (الفرع)

المرحلة 0 (الأساس) · A (القياس) · B (المحرك) · C (المدفوعات) · D (الاشتراكات) · E (التجديد) — كلٌّ في commit مستقل مع اختباراته. راجع سجل الفرع للتفاصيل.
