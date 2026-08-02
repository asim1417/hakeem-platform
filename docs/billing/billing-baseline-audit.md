# تقرير الفحص الأولي — منظومة النقاط والاشتراكات والمدفوعات

**المرجع:** HKM-BILLING-UX-001 · المخرج رقم 1 (الفحص الأولي)
**التاريخ:** 2026-08-02
**الفرع:** `claude/hakim-billing-system-rato3i`
**الحالة:** فحص فقط — لم يُعدَّل أي كود إنتاجي في هذه المرحلة.

---

## 0. الخلاصة التنفيذية

منصة حكيم **لا تبدأ من الصفر** في منظومة الفوترة. يوجد بالفعل أساس ناضج جزئيًا، لكنه
**مزدوج، معطّل، وناقص الطبقات العليا**. أهم استنتاج حاكم يخدم قاعدة «لا تبنِ نظامًا موازيًا»:

> **نظام «وحدات الاستخدام v2» (`usage_credits_*`) هو تقريبًا محرك الرصيد المطلوب في الأمر التنفيذي،
> وهو مبنيّ بمعايير إنتاجية (reserve/capture، أقفال صفوف، دفتر append-only مُتسلسل بالهاش،
> idempotency، انتهاء صلاحية، قفل تفاؤلي)، لكنه معطّل خلف علم `usage_credits_v2=false`.**

لذلك المسار الصحيح هو **تطوير هذا النظام وتفعيله وربطه بكل الخدمات**، لا إنشاء محرك جديد.

### ما هو موجود ويعمل (نبنِي فوقه)
- محرك رصيد v2 كامل: محفظة + دفتر + حجوزات + أسعار خدمات + حزم + حصص (SQL خام).
- وسيط تنظيمي واحد للخصم: `lib/modules/billing/access-gate.ts`.
- تكامل Moyasar أساسي (إنشاء فاتورة + webhook + سجل أحداث خام idempotent).
- بوابة Claude مركزية (`callCentralProvider`) تلتقط توكنات الإدخال/الإخراج في `ai_usage_events`.
- لوحة إدارة `/admin/billing` + بنية `AppSetting`/`FeatureToggle`/`AuditEvent` قابلة للتوسّع.
- واجهات `/pricing`، `/dashboard/billing`، `/dashboard/subscribe` مربوطة ببيانات حقيقية، RTL كامل.
- تخزين المال بالهللات كأعداد صحيحة (`priceHalalas`) ✓ — يطابق قواعد التنفيذ.

### الفجوات الجوهرية (نبنيها)
1. **لا نماذج Prisma** لـ Plan/PlanPrice/Subscription/Order/Payment/Invoice/Refund/PaymentMethod/WebhookEvent.
2. **نظامان متوازيان للنقاط** (نقاط ولاء + وحدات v2) + حصة مجانية — يلزم توحيد المفاهيم.
3. **تحقق Webhook ضعيف** + **لا إعادة تحقق من البوابة** قبل المنح (يخالف القاعدتين 11 و13).
4. **الخصم مربوط بـ4 خدمات فقط من ~11** — الأكثر استخدامًا (اسأل/تحليل/صياغة/تقدير) بلا خصم.
5. **لا طبقة ضريبة/ZATCA** ولا فواتير مُنمذجة.
6. **الأسعار في ثوابت TS** لا في DB قابل للتعديل من الإدارة (يخالف القاعدة: قابلية التعديل من لوحة الإدارة).
7. **لا تجريد لمزود الدفع** (Moyasar مثبّت مباشرةً).
8. **لا التقاط لتوكنات cache/web-search** ولا تخزين تكلفة Claude الفعلية لكل حدث.
9. **لا مقاعد/Workspace** — باقات OFFICE/ENTERPRISE بلا سند بيانات.
10. **لا واجهات UX للنقاط**: مؤشر رصيد في الشريط، تأكيد التكلفة، نفاد الرصيد، Toast الخصم — غير موجودة.

---

## 1. المصادقة ونموذج المستخدم والصلاحيات

| العنصر | الحالة | الموضع |
|---|---|---|
| مزوّد المصادقة | **Clerk** (المصدر الوحيد بعد الهجرة) + كوكي `hakeem_session` HMAC للمالك/الطوارئ + OAuth Google/Microsoft + Magic link + OTP هاتف ثانوي | `lib/modules/auth/session.ts` |
| هوية المستخدم في مسار API | `getApiUser(request)` / `requireApiPermission(permission, request)` → `{ user, response }` | `session.ts:158,175` |
| هوية في الصفحات | `getCurrentUser()` / `requirePagePermission(permission)` | `session.ts:128,151` |
| بوابة الإدارة (الأقوى) | `requireSuperAdminPage()` / `requireSuperAdminApi(request)` — دور `SUPER_ADMIN` + علم `SUPER_ADMIN_PANEL_ENABLED`، وتكتب حدث `ACCESS_DENIED` عند الرفض | `lib/modules/auth/super-admin.ts:28,36` |
| RBAC | خريطة ثابتة `ROLE_PERMISSIONS` + منح DB إضافية عبر `canUser(userId, perm)`؛ `SUPER_ADMIN`/`SYSTEM_ADMIN` يتجاوزان المصفوفة | `lib/modules/auth/rbac.ts:23`, `role-permissions.ts` |

### نموذج `User` (`prisma/schema.prisma:52`)
حقول Prisma الفعلية: `id, name, email, clerkId, username, passwordHash, role, isActive, createdAt, updatedAt` + علاقات.

**حرج:** الأعمدة المالية/الاشتراكية **ليست في نموذج Prisma**، بل أُضيفت بـSQL خام (تُقرأ/تُكتب بـ`$queryRawUnsafe` مع «سقوط مفتوح» قبل الهجرة):
- `subscriptionStatus` (default `'free'`), `freeQuotaUsed`, `freeQuotaTotal` — من `20260718120000_add_free_quota`.
- `creditsBalance`, `referralCode`, `referredBy`, `phone`, `city`, `entityType`, `yearsExperience`, `specialties`, `interests`, `onboarding*`, `phoneVerified`, `termsAccepted` — من `20260718180000_onboarding_credits_referrals`.

### تعددية المستأجرين / المقاعد — **غير مدعومة**
لا يوجد نموذج `Workspace`/`Team`/`Organization`/`Subscription`/`Plan`، ولا `workspaceId` على `User`.
النموذجان الوحيدان الشبيهان بمساحة عمل هما `DocWorkspace`/`DocCase` (مساحة قارئ مستندات مجهولة بكوكي،
لا صلة لها بـ`User`). **باقات OFFICE (5 مقاعد) وENTERPRISE تتطلب نموذج tenant جديد + `workspaceId`.**

---

## 2. منظومة النقاط/الحصص القائمة — ثلاثة أنظمة متوازية

> جميعها خارج نماذج Prisma عمدًا (SQL خام + `$queryRawUnsafe`) ليسقط النظام «مفتوحًا» قبل الهجرة.

### (أ) الحصة المجانية — عدّاد بسيط
- أعمدة `users.freeQuotaUsed/freeQuotaTotal/subscriptionStatus`.
- `lib/modules/billing/quota.ts`: `evaluateQuota`, `canConsume`, `consumeOne` (زيادة ذرّية `+1` بشرط `subscriptionStatus <> 'active'`)، المشتركون = بلا حد. القيمة الافتراضية 20 (`config/pricing.ts:13`).
- **ثغرة تزامن:** الفحص (`canConsume`) والخصم (`consumeOne`) منفصلان بلا حجز؛ طلبات متوازية قد تتجاوز كلها البوابة.

### (ب) نقاط الولاء — رصيد + سجل استشاري
- عمود `users.creditsBalance` + جدول `credit_transactions` (لا UNIQUE على `(userId, source)`).
- `lib/modules/credits/ledger.ts`: `awardCredits`, `spendCredits`, `getBalance`.
- **ثغرات:** المنح **غير ذرّي** (INSERT ثم UPDATE بلا transaction) وعرضة لسباق check-then-act → مضاعفة محتملة. الصرف idempotent فقط عند تمرير `uniqueSuffix`، وإلا `source = spend_${id}_${Date.now()}`. الصرف يمنع الرصيد السالب عبر `UPDATE ... WHERE creditsBalance >= amount` (جيد)، لكن ليس دفترًا حقيقيًا.
- `config/credits.ts`: `CREDIT_REWARDS` (welcome 500…)، `CREDIT_SPENDS` (advanced_use 25…). «1 نقطة ≈ 1 ر.س».

### (ج) وحدات الاستخدام v2 — **محرك الرصيد الحقيقي (معطّل)**
الجداول (من `20260729130000_usage_credits_v2`)، وكلها بالـ`milli-units` (1000 = وحدة ≈ 1000 توكن موزون):

| الجدول | يقابل في الأمر التنفيذي | ملاحظات |
|---|---|---|
| `usage_credit_accounts` | (جزء من) Wallet | balance/reserved/lifetime + `version` (قفل تفاؤلي)، `CHECK` تمنع السالب و`reserved<=balance` |
| `usage_credit_ledger` | `CreditLedgerEntry` | **append-only** عبر Trigger، سلسلة SHA-256 (`previousHash→entryHash`)، `idempotencyKey` UNIQUE |
| `usage_credit_reservations` | `CreditReservation` | held/captured/released/expired، TTL 15 دقيقة، `idempotencyKey` UNIQUE |
| `usage_service_prices` | `ServiceRate` | مبذورة بـ9 خدمات؛ نماذج تسعير TOKEN_WEIGHTED/FIXED/PER_PAGE/PER_TABLE/PER_TOKEN_BLOCK |
| `usage_credit_packages` | حزم النقاط | `priceHalalas` (أعداد صحيحة) — **غير مستخدمة بعد** |
| `usage_credit_quotas` | حصص دورية | **غير مستخدمة بعد** |

- المنطق: `lib/modules/credits/usage-ledger.ts` — `reserveUsageCredits`, `captureUsageCredits`, `releaseUsageCredits`, `grantUsageReward`, `adjustUsageCredits`, `expireHeldReservations`. كلها داخل `prisma.$transaction` مع `SELECT ... FOR UPDATE`، وidempotency عبر `idempotencyKey`.
- **الجودة إنتاجية**: منع السالب/الازدواج عبر أقفال الصفوف + `CHECK` + المفاتيح الفريدة. هذا يلبّي القسم الخامس من الأمر التنفيذي بدرجة عالية.
- **العلم `usage_credits_v2=false`** (env أو `feature_toggles`) → النظام كله خامل حاليًا؛ الإنتاج يعمل على (أ) و(ب) الأضعف.

### الوسيط التنظيمي الموحّد — `lib/modules/billing/access-gate.ts`
`gateAdvancedUse` (حجز) → `settleAdvancedUse` (تثبيت بعد النجاح) → `releaseAdvancedUse` (تحرير عند الحجب/الفشل)،
بأولوية: وحدات v2 → حصة مجانية → نقاط ولاء → `exhausted`. **هذا هو المقبس الصحيح لكل ربط لاحق.**

---

## 3. المدفوعات والفوترة القائمة

### تكامل Moyasar
- `lib/modules/billing/moyasar.ts`: `createMoyasarInvoice` (POST لـ`api.moyasar.com/v1/invoices`، Basic auth، metadata فيها `userId/planId/interval`)، `amountHalalas` (**بلا ضريبة**)، `activateSubscription` (raw `UPDATE users SET subscriptionStatus='active'`).
- **لا واجهة `PaymentProvider` مجرّدة** — المسارات تستورد `createMoyasarInvoice` مباشرة (يخالف قاعدة «مزوّد قابل للاستبدال»).

### مسارات API
- `app/api/billing/checkout/route.ts`: يُنشئ فاتورة ويعيد التوجيه إلى `invoice.url`. لا يحفظ Order.
- `app/api/billing/webhook/route.ts` (المسار الحرج):
  - `verifyMoyasarWebhookSecret` = **مطابقة سر نصّي اختياري في جسم الطلب** (ليس HMAC للجسم الخام)؛ بدون سر يقبل أي POST.
  - `recordBillingEvent` (`ON CONFLICT DO NOTHING` → `inserted`) = **بدائية idempotency**، لكن:
    - يُلتف عليها: عند فشل الكتابة `!recorded.ok` يُفعّل الاشتراك «توافقًا خلفيًا» (`:86`).
    - `eventId = moyasar_${Date.now()}` عند غياب المعرّف → يكسر الـdedup.
  - **لا إعادة تحقق من البوابة** (لا re-fetch للفاتورة) — يثق بحقل `status` في الجسم (يخالف القاعدة 13).
  - **لا تحقق من المبلغ/العملة** مقابل سعر الخطة.
- `app/api/billing/status/route.ts`: قراءة فقط (quota + plans + checkoutLive).

### التخزين
- `billing_events` (جدول يُنشأ بـDDL وقت التشغيل في `billing-events.ts`، ليس في Prisma) — سجل أحداث خام فقط.
- **لا Order، لا Payment، لا Invoice، لا Subscription، لا Plan** ككيانات. الاشتراك = نص `'active'` في عمود غير مُنمذج.

### الأسعار
- `config/pricing.ts` (المصدر المعلن): `BASE_PLANS` مثبّتة — `free` (0)، `pro` (**149** شهري / 1490 سنوي)، `team` (**399** / 3990، «حتى 10 مقاعد» نصًا فقط، غير مُنفَّذ). `isCheckoutLive()` = وجود `MOYASAR_SECRET_KEY`.
- **تعارض مع الأمر التنفيذي:** المطلوب FREE / INDIVIDUAL(49) / PROFESSIONAL(149) / OFFICE(499، 5 مقاعد) / ENTERPRISE، بنقاط 500/2200/9000، وحزم 250@29 / 700@69 / 1600@139. الأسعار الحالية مختلفة وليست في DB قابلة للتعديل.

### الضريبة/ZATCA — **غير موجودة إطلاقًا**
لا متغيرات `VAT_RATE_BPS`/`ZATCA`، ولا فواتير ضريبية، ولا QR، ولا إشعار دائن، ولا لقطة بائع/مشتري.

---

## 4. تكامل Claude وقياس التكلفة

- **لا SDK** (`@anthropic-ai/sdk` غير مثبّت) — استدعاءات `fetch` خام لـ`api.anthropic.com/v1/messages`.
- **المسار المهيمن مركزي:** `callCentralProvider` (`lib/modules/ai/ai-gateway.ts:198`) → `completeWithConfig`/`streamWithConfig` (`ai-config.ts`)، يفرض «Claude حصريًا» ويلتقط `input_tokens/output_tokens` → جدول `ai_usage_events` (`lib/modules/billing/ai-usage-meter.ts`, يُنشأ في `instrumentation.ts`).
- **مواقع تتسرّب من القياس:** `providers/claude-provider.ts`، `original-hakeem` (`callOriginalProvider`)، ومسبار الإدارة.
- **معرّفات الموديل متضاربة** عبر الملفات: `claude-3-5-sonnet-latest`، `claude-3-5-haiku-latest`، `claude-sonnet-4-6`، `claude-sonnet-4-5`. السجل المعلن `config/ai-models.ts` غير مقروء باتساق.
- **ثغرات القياس:** لا التقاط لـ`cache_creation_input_tokens`/`cache_read_input_tokens`/web-search. التكلفة تُحسب (`cost-estimator.ts`) لكن **لا تُخزَّن لكل حدث** (لا عمود تكلفة في `ai_usage_events`)، ولا جدول `ModelPrice` مؤرّخ.
- **الربط بالنقاط جزئي — 4 من ~11 خدمة فقط:**

| الخدمة | المسار | يخصم؟ |
|---|---|---|
| الاستشارات | `app/api/ai/consultation` | ✅ نعم (`CONSULTATION`+`HYBRID_SEARCH`+`RERANK`) |
| بحث الوكيل | `app/api/ai/agent-search` | ✅ نعم |
| القاضي (إنشاء) | `app/api/simulations` (POST) | ✅ نعم (إنشاء فقط، **لا** أدوار الجلسة) |
| رفع المستند | `app/api/attachments` | ✅ نعم (`DOCUMENT_UPLOAD`) |
| اسأل حكيم | `app/api/judicial-assistant/ask(+/stream)`، `app/api/legal-chat` | ❌ صلاحية فقط |
| تحليل القضايا | `app/api/case-analysis` | ❌ |
| خطط العمل | `app/api/legal-agent` | ❌ |
| تقدير الأحكام | `app/api/judicial-simulation` | ❌ |
| الصياغة القانونية | `app/api/judicial-assistant/draft` | ❌ |
| المكتبة/RAG | `app/api/legal-core/*`, `legal-rag` | ❌ |

- **المقبس جاهز:** لأن البوابة المركزية تعمل داخل `AsyncLocalStorage` وتُصدر التوكنات الحقيقية، يكفي استدعاء `gateAdvancedUse`/`settleAdvancedUse` في المسارات السبعة غير المقيسة (نمط الاستشارة المُثبَت). للـstreaming: التثبيت في `finally` عند نهاية البث.
- **Rate limiting:** موجود لبوابة API الخارجية (`ApiRequestWindow`) وللمرفقات (`GenericRateLimitWindow`) فقط؛ **مسارات AI الداخلية بلا حد معدّل**.

---

## 5. لوحة الإدارة والإعدادات والتدقيق

- **`/admin/billing` موجود** (Moyasar status، عدّادات، أرصدة، خطط بالأسعار، سجل webhook) عبر `lib/modules/billing/admin-overview.ts`.
- **`AppSetting`** (`schema.prisma:534`، key/value JSON، أسرار بـAES-256-GCM) عبر `settings-service.ts` (whitelist `MANAGED_KEYS` — فيها `MOYASAR_SECRET_KEY`، `FREE_QUOTA`، `WARN_AT`، **لا الأسعار**). **يُحقن في `process.env` عند الإقلاع** (`instrumentation.ts`) → أي قارئ `process.env` يلتقط تعديلات الإدارة تلقائيًا.
- **نمط جعل الأسعار قابلة للتعديل:** تخزين كائن الخطط كـ`AppSetting` JSON (قالب `lib/modules/ai/ai-config.ts:81,209`) ودمجه في `getPlans()`.
- **`FeatureToggle`** (`schema.prisma:489`) + `isFeatureEnabled(key, fallback)` (`lib/modules/admin/feature-toggles.ts:103`).
- **`AuditEvent`** (`schema.prisma:510`، جدول `audit_logs`) عبر `auditEvent(input)` (fail-open). **لا يوجد `BILLING` في enum `AuditSubject`** — الأحداث المالية تستخدم `subject:"ADMIN"` + `action:"BILLING_*"`. يُنصح بإضافة `BILLING`.
- **`instrumentation.ts`** يشغّل DDL idempotent عند الإقلاع (هذه آلية إنشاء الجداول الخام على Vercel بلا `prisma migrate deploy`).

---

## 6. الواجهات (UX)

- **نظام تصميم منزلي مخصّص** (`components/ui/design-system.tsx`: `Hero/Card/Button/CardGrid/SectionTitle…`) — **لا shadcn/Radix/مكتبة Toast**. Tailwind + طبقة CSS يدوية كبيرة (`app/globals.css`).
- **RTL كامل**: `app/layout.tsx` `dir` مقاد باللغة (افتراضي عربي)، خطوط IBM Plex Sans Arabic + Amiri + IBM Plex Mono.
- **`/pricing`** (server): يرندر `PlansGrid` من `config/pricing.ts`، paid UI خلف `isPaidCheckoutUiEnabled()`. **لا حزم نقاط معروضة.**
- **`/dashboard/billing`** («الحساب والرصيد»): بيانات حقيقية (`getStatus` + `getUsageCreditStatus`)، يعرض رصيد وحدات v2 عند التفعيل.
- **`/dashboard/subscribe`**: شبكة خطط + لافتات حالة checkout؛ المسار المدفوع خامل خلف العلم.
- **`/settings`**: مجرد `redirect("/admin")` (stub).
- **الناقص للـUX المطلوب:**
  - **لا مؤشر رصيد في الشريط العلوي** (`AppShell.tsx` topbar-right) — يمكن إضافته كمكوّن خادم يقرأ الرصيد ويربط `/dashboard/billing` (نمط `.nav-badge` جاهز).
  - **لا Toast** لـ«خُصمت X نقطة» — يلزم بناؤه (`aria-live`).
  - **لا نافذة تأكيد تكلفة** ولا **نافذة نفاد رصيد** تحفظ الطلب وتعيد إليه — يلزم بناؤها (نمط `role="dialog"` من `ExpandedComposerDialog`).
  - **لا صفحات** `/dashboard/account/{usage,invoices,payment-methods,subscription}`.

---

## 7. المتغيّرات والأعلام الحالية

| النوع | القيم |
|---|---|
| Moyasar (موجودة) | `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET` |
| حصة/نقاط | `FREE_QUOTA` (20), `WARN_AT` (3), `USAGE_CREDITS_V2` (false) |
| Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (`claude-3-5-haiku-latest`), `AI_MODEL`, `ANTHROPIC_FALLBACK_MODEL`, `HAKEEM_AGENT_MODEL`, `AI_PROVIDER` |
| أعلام | `PAID_CHECKOUT_UI_ENABLED`, `SUPER_ADMIN_PANEL_ENABLED`, `isCheckoutLive()` (مشتق) |
| **ناقصة (مطلوبة)** | `PAYMENT_PROVIDER`, `PAYMENT_CALLBACK_URL`, `PAYMENT_WEBHOOK_URL`, `BILLING_CURRENCY`, `VAT_RATE_BPS`, `COMPANY_*`, `ZATCA_INTEGRATION_ENABLED`, `LEGACY_USER_GRANT_POINTS`, أعلام `BILLING_ENABLED`/`CREDITS_ENFORCEMENT_ENABLED`/`SUBSCRIPTIONS_ENABLED`/`AUTO_RENEWAL_ENABLED` |

---

## 8. مصفوفة الفجوات مقابل الأمر التنفيذي (قرار: نعيد الاستخدام أم نبني)

| القسم في الأمر | الحالة القائمة | القرار |
|---|---|---|
| §4 محرك الرصيد (Wallet/Ledger/Reservation) | **موجود إنتاجيًا (v2)، معطّل** | **إعادة استخدام + تفعيل + تغليف Prisma اختياري** |
| §4 Plan/PlanPrice/Subscription | غير موجود (أسعار ثوابت TS) | **بناء نماذج Prisma + Seed + تحرير من الإدارة** |
| §4 Order/Payment/Invoice/Refund/PaymentMethod/WebhookEvent | غير موجود (سجل خام فقط) | **بناء كامل** |
| §5 عمليات محرك الرصيد | معظمها موجود في `usage-ledger.ts` | **إكمال (getEstimatedRemainingUses، مهمة تحرير الحجوزات الدورية)** |
| §6 بوابة Claude موحّدة + ModelPrice + cache/web-search | مركزية جزئيًا، بلا cache/تكلفة مخزّنة | **توحيد + `ModelPrice` + التقاط cache/تكلفة فعلية** |
| §7 تجريد مزود الدفع + Moyasar | Moyasar مثبّت بلا واجهة | **`payment-provider.ts` + نقل Moyasar خلفه** |
| §7 تقوية Webhook (توقيع/إعادة تحقق/dedup) | ضعيف | **HMAC + verifyPayment من البوابة + جدول `WebhookEvent` UNIQUE(provider,eventId)** |
| §8 دورة حياة الاشتراك (تجديد/ترقية/تخفيض/إلغاء) | لا شيء (نص `'active'`) | **بناء كامل** |
| §9 الضريبة/ZATCA | لا شيء | **`einvoice-provider.ts` + حقول ضريبة + علم `ZATCA_INTEGRATION_ENABLED`** |
| §10-11 UX + التسعير | صفحات أساسية موجودة | **مؤشر رصيد، تأكيد تكلفة، نفاد رصيد، Toast، صفحات account/*، تحديث /pricing** |
| §12 لوحة إدارة الفوترة | `/admin/billing` أساسي موجود | **توسعة: Overview/Plans/ServiceRates/Users/Payments/Profitability** |
| §13 الإشعارات | غير موجودة للفوترة | **بناء** |
| §14 الأمن/منع الإساءة | RBAC + rate-limit جزئي | **توسعة على مسارات AI + تشفير tokens + RBAC للإدارة** |
| §15 التحليلات | جزئي | **أحداث غير حسّاسة** |
| §16 الترحيل | نظامان قديمان محفوظان | **`LEGACY_MIGRATION` + `LEGACY_USER_GRANT_POINTS` + عدم مضاعفة** |
| §17 الاختبارات | غير موجودة للفوترة | **Unit/Integration/E2E** |
| مقاعد OFFICE/ENTERPRISE | لا Workspace | **نموذج tenant + `workspaceId`** |

---

## 9. مخاطر ومحاذير التنفيذ

1. **الازدواج المفاهيمي:** «نقاط» (الأمر التنفيذي) مقابل «milli-units/quota» (القائم). يلزم قرار توحيد: هل «النقطة» = وحدة v2 بمقياس معيّن؟ (توصية: النقطة = وحدة عرض مشتقة من milli-units لتفادي كسر الأرصدة والأسعار المبذورة).
2. **تعارض الأسعار:** خطط/أسعار الأمر التنفيذي تختلف عن `config/pricing.ts` الحالي. تغيير الأسعار يمسّ الواجهات وربما مشتركين — يلزم إصدارات أسعار مؤرّخة.
3. **الجداول الخام خارج Prisma:** نمط المشروع المتعمّد. أي نماذج جديدة يجب أن تقرّر: Prisma model (type-safe، لكن يتطلب migrate) أم الاستمرار بنمط DDL-at-boot عبر `instrumentation.ts` (متوافق مع Vercel). توصية: **Prisma models للكيانات المالية الجديدة** مع migration، مع إبقاء جداول v2 كما هي.
4. **حساسية المسار المالي:** لا يجوز تفعيل الخصم/الدفع في الإنتاج قبل مراحل A→E والاختبارات (كما في `docs/usage-credits-v2-rollout.md`). كل شيء خلف أعلام.
5. **عدم كسر ما يعمل:** الحصة المجانية ونقاط الولاء تحكم الإنتاج فعليًا اليوم؛ أي تفعيل لـv2/الخصم يجب أن يكون تدريجيًا ومحميًا بعلم.

---

## 10. خريطة التنفيذ المقترحة (مراحل، متوافقة مع §19)

> كل مرحلة قابلة للشحن باختباراتها وخلف أعلام؛ لا تفعيل إنتاجي قبل التقرير النهائي.

- **المرحلة 0 — الأساس (هذا التقرير + المخطط):** نماذج Prisma للكيانات المالية (Plan/PlanPrice/Subscription/Order/Payment/Invoice/Refund/PaymentMethod/WebhookEvent + enum `BILLING`)، Seed للباقات/الأسعار/الخدمات وفق الأمر التنفيذي، `.env.billing.example`.
- **المرحلة A — Shadow Metering:** التقاط تكلفة Claude الفعلية + cache/web-search + `ModelPrice`، وربط القياس بكل الخدمات الـ11 **بلا خصم**.
- **المرحلة B — تفعيل النقاط:** توحيد المفاهيم، تفعيل محرك v2، ربط `gateAdvancedUse`/`settleAdvancedUse` بكل الخدمات، UX (مؤشر رصيد/تأكيد/نفاد/Toast)، منح التجربة.
- **المرحلة C — شراء النقاط:** تجريد مزود الدفع، تقوية Webhook (HMAC + re-verify + `WebhookEvent`)، Order/Payment/Invoice، checkout للحزم، الفواتير.
- **المرحلة D — الاشتراكات:** دورة حياة كاملة (اشتراك/ترقية/تخفيض/إلغاء)، مقاعد OFFICE عبر Workspace، لوحة إدارة الفوترة الموسّعة.
- **المرحلة E — التجديد التلقائي + ZATCA:** بطاقات مرمّزة، جدولة التجديد، `einvoice-provider.ts`، المصالحة اليومية، الإشعارات.

---

## 11. الملفات المرجعية الأساسية

```
prisma/schema.prisma                         # نماذج Prisma (لا نماذج مالية بعد)
prisma/migrations/20260718120000_add_free_quota/
prisma/migrations/20260718180000_onboarding_credits_referrals/
prisma/migrations/20260729130000_usage_credits_v2/    # محرك الرصيد الحقيقي (DDL خام)
lib/modules/credits/usage-ledger.ts          # reserve/capture/release/grant/adjust/expire
lib/modules/credits/ledger.ts                # نقاط الولاء (يحتاج تقوية)
lib/modules/billing/access-gate.ts           # الوسيط التنظيمي (gate/settle/release)
lib/modules/billing/quota.ts                 # الحصة المجانية
lib/modules/billing/moyasar.ts               # Moyasar (يحتاج تجريد)
lib/modules/billing/billing-events.ts        # سجل webhook خام + تحقق ضعيف
lib/modules/billing/admin-overview.ts        # بيانات /admin/billing
lib/modules/ai/ai-config.ts                  # بوابة Claude (complete/stream + التقاط توكنات)
lib/modules/ai/ai-gateway.ts                 # callCentralProvider
lib/modules/billing/ai-usage-meter.ts        # ai_usage_events
config/pricing.ts / config/credits.ts / config/usage-credits.ts / config/ai-models.ts
lib/modules/settings/settings-service.ts     # AppSetting + hydrateEnvFromSettings
lib/modules/admin/feature-toggles.ts         # isFeatureEnabled
lib/modules/audit/audit.ts                   # auditEvent
lib/modules/auth/session.ts / super-admin.ts # المصادقة والبوابات
app/api/billing/{checkout,webhook,status}/route.ts
app/api/credits/{route,spend,engage}/route.ts
app/pricing/page.tsx · app/dashboard/{billing,subscribe}/page.tsx
components/AppShell.tsx                       # الشريط + الشريط الجانبي (موضع مؤشر الرصيد)
components/billing/*                          # PlansGrid/PlanCard/BillingStatusCard/QuotaCounter
instrumentation.ts                           # DDL idempotent عند الإقلاع (آلية Vercel)
docs/usage-credits-v2-rollout.md             # خطة طرح v2 القائمة
```

---

*انتهى الفحص الأولي. لم يُعدَّل أي كود إنتاجي. الخطوة التالية: اعتماد قرارات التوحيد/الأسعار
ثم تنفيذ المرحلة 0 (المخطط + النماذج + Seed) خلف أعلام.*
