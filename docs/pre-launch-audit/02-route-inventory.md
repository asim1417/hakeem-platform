# 02 — جرد المسارات | PRE-LAUNCH-AUDIT-001

**الإحصاء:** 91 صفحة (`page.tsx`) · 145 مسار API (`route.ts`)

## التصنيف

| الفئة | العدد التقريبي | حماية |
|---|---:|---|
| تسويق / عام | ~18 | عامة |
| دخول / OAuth | ~5 | عامة + callbacks |
| لوحة المستخدم `/dashboard/**` | ~44 | middleware + `requireUser` |
| إدارة `/admin/**` | ~17 | middleware + layout + صلاحيات الصفحة |
| أخرى محمية | 2 (`/onboarding`, `/audit-logs`) | middleware |
| aliases عامة → محمية | ~8 | redirect |

## مسارات عامة مفحوصة (حي)

| المسار | HTTP | ملاحظة |
|---|---:|---|
| `/` | 200 | عنوان «حكيم» — hakeemsa.com و vercel.app |
| `/pricing` | 200 | أسعار + CTA قريبًا عند غياب Moyasar |
| `/privacy` | 200 | محدّثة في الفرع |
| `/terms` | 200 | موجودة |
| `/sign-in` | 200 | Clerk/Google |
| `/robots.txt` | 200 | محدّث في الفرع (لم يُنشر بعد) |
| `/api/health` | 200 | DB up، Clerk/Google configured، Moyasar missing |

## مسارات محمية (فحص شيفرة + middleware)

| المسار | الصلاحية | حالة الاختبار |
|---|---|---|
| `/dashboard` | مستخدم | حماية middleware + layout |
| `/dashboard/ask` | مستخدم | سطح AI الأساسي |
| `/dashboard/billing` | مستخدم | UI دفع مشروط بمفتاح |
| `/admin/**` | أدمن | layout يرفض غير المخوّل + صفحات بـ permission |
| `/api/legal-chat` | LEGAL_CORE_VIEW + حصّة | بُوّبت في هذا الفرع |
| `/api/judicial-assistant/ask*` | JUDICIAL_ASSISTANT_USE + حصّة | بُوّبت في هذا الفرع |
| `/api/billing/webhook` | سر Moyasar | يُرفض إن الدفع حي بلا سر |
| `/api/attachments` | ملكية + حد حجم | حد 25MB |

## مشكلات مكتشفة مرتبطة بالمسارات

| ID | المسار | الخطورة | الحالة |
|---|---|---|---|
| R-01 | `/documents/app` | P2 | عام عمدًا — أُضيف لـ robots disallow |
| R-02 | Lab / knowledge-graph | P2 | تجريبي لمستخدم مسجّل |
| R-03 | aliases `/cases` إلخ | P3 | redirects — لا تُفهرس بعد تحديث robots |
| R-04 | أزرار «قريبًا» في مقالة legal-core | P2 | واجهة غير مكتملة |

جرد API الكامل في الشجرة تحت `app/api/` (admin, auth, simulations, judicial-assistant, legal*, billing, credits, attachments, health, …).
