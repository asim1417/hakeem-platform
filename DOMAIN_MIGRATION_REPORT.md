# DOMAIN_MIGRATION_REPORT.md — المرحلة الأولى (إعداد أصل الموقع)

| البند | القيمة |
|---|---|
| الفرع | `cursor/site-url-config-9b97` |
| الأساس | `main` |
| النطاق الاحتياطي (fallback) | `https://hakeem-platform.vercel.app` |
| النطاق المستهدف لاحقًا | `hakeemsa.com` — **لم يُربط** |
| Clerk | **بلا مساس** (لا مفاتيح، لا Production instance، لا نطاق مخصّص) |
| نشر / ربط نطاق | **لم يُنفَّذ** |
| تاريخ | 2026-07-24 |

---

## 1) ماذا نُفِّذ في المرحلة 1

1. وحدة موحّدة: `lib/modules/config/site-url.ts`
   - `NEXT_PUBLIC_SITE_URL` → ثم `NEXTAUTH_URL` → ثم `DEFAULT_SITE_URL`
2. استبدال الترميز الصلب في المسارات التشغيلية (SEO / بريد / إحالات / إعدادات أدمن).
3. `metadataBase` في `app/layout.tsx`.
4. CSP و`serverActions.allowedOrigins` في `next.config.mjs` تقرآن أصل الموقع **وقت البناء** مع الإبقاء على نطاقات Clerk كما هي.
5. توثيق المتغير في `.env.example` للبيئات الثلاث.
6. إكمال نواقص جرد المرحلة صفر (أدناه + تحديث `DOMAIN_MIGRATION_AUDIT.md`).
7. اختبار: `scripts/test-site-url.ts`.

**لم يُنفَّذ (ملزمات):** ربط نطاق، نشر إنتاج/معاينة، تغيير متغيرات Vercel من الوكيل، أي تعديل Clerk.

---

## 2) تحذير حاسم — وقت البناء vs وقت التشغيل

| العنصر | متى يُحسم؟ | ماذا يعني للقطع النهائي؟ |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **وقت البناء (build)** — يُضمَّن في الحزمة | تغيير القيمة في لوحة Vercel **alone لا يكفي**؛ يلزم **إعادة نشر** لكل بيئة تتأثر |
| CSP في `next.config.mjs` | **وقت البناء** (`headers()` تُقيَّم عند بناء Next) | نفس الحكم: إعادة نشر بعد ضبط المتغير |
| `serverActions.allowedOrigins` | **وقت البناء** | نفس الحكم |
| `getSiteUrl()` على الخادم (RSC / Route Handlers) | يقرأ `process.env` وقت التشغيل إن وُجدت القيمة في بيئة الدالة | مع ذلك `NEXT_PUBLIC_*` على العميل مضمونة وقت البناء — اعتمد إعادة النشر دائمًا عند تغيير النطاق |

**الخلاصة الصريحة:** التحول النهائي إلى `hakeemsa.com` يستلزم: ضبط المتغير في البيئات الثلاث **ثم إعادة نشر**، لا مجرد تعديل قيمة env.

---

## 3) ضبط المتغير — Production + Preview + Development

اضبط يدويًا في Vercel → Project → Settings → Environment Variables:

| المتغير | القيمة (قبل القطع) | البيئات |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://hakeem-platform.vercel.app` | **Production** و **Preview** و **Development** |
| `NEXTAUTH_URL` (توافق) | نفس القيمة | الثلاث (اختياري إن وُجد `NEXT_PUBLIC_SITE_URL`) |

**لماذا الثلاث؟** إن بقي Preview/Development بلا المتغير أو بقيمة مختلفة، تولّد نسخ المعاينة `canonical` / sitemap / روابط بريد على أصل خاطئ.

عند القطع لاحقًا (مرحلة منفصلة بموافقة صريحة): غيّر القيمة إلى `https://hakeemsa.com` في الثلاث، ثم أعد النشر — **بدون** جعل النطاق Primary و**بدون** إعادة توجيه من `vercel.app` (حسب الملزمات).

---

## 4) Deployment Protection (تصحيح الجرد)

تعذّر فحص اللوحة من بيئة الوكيل (`VERCEL_TOKEN` غائب). **اعتماد مؤشراتك:**

| المؤشر | الدلالة المعتمدة في التقرير |
|---|---|
| `cache-control: private, no-store` | استجابة غير قابلة للتخزين العام — متسقة مع حماية نشر |
| الحاجة إلى `_vercel_share` | بوابة مشاركة Vercel مفعّلة للوصول |
| حقل `live: false` في بيانات المشروع | المشروع/النشر ليس «عامًا حيًّا» بالمعنى الذي تفحصه اللوحة |

**الحكم المعتمد هنا:** حماية النشر **مفعّلة وتشمل الإنتاج** — تحققك النهائي من اللوحة (Project → Settings → Deployment Protection) يبقى المرجع القاطع.

---

## 5) إكمال جرد المرحلة صفر — Clerk (كامل)

### 5.1 Middleware (`middleware.ts`)

| البند | القيمة |
|---|---|
| المحرّك | `clerkMiddleware` عند توفر المفاتيح (`isClerkConfigured`) |
| مسارات محمية (`auth.protect`) | `/dashboard(.*)`, `/admin(.*)`, `/audit-logs(.*)`, `/onboarding(.*)` |
| غير المصادق → | `/sign-in?next=<path>` |
| جلسة مالك `hakeem_session` | تمرّر المسارات المحمية بدون `auth.protect` |
| دخول وهو مسجّل على `/sign-in|/sign-up|/login` | إعادة توجيه إلى `next` الآمن أو `/dashboard` |
| **Bypass** (لا `clerkMiddleware`) | `/`, `/sign-in`, `/sign-up`, `/login`, `/register`, `/pricing`, `/privacy`, `/terms`, `/legal`, `/auth/continue`, `/sso-callback`, `/api/auth/oauth/start`, `/api/auth/google`, `/api/auth/callback/google`, `/api/auth/claim-clerk-return`, `/api/auth/me`, `/api/auth/providers` |
| بلا مفاتيح Clerk | بوابة `plainAuthGate` / `resolveUnauthenticatedGate` |

### 5.2 قيم إعادة التوجيه (نسبية — لا نطاق مطلق في الشيفرة)

| التدفق | المصدر | القيمة |
|---|---|---|
| صفحة الدخول | Provider + env | `/sign-in` ← `NEXT_PUBLIC_CLERK_SIGN_IN_URL` |
| صفحة التسجيل | Provider + env | `/sign-up` ← `NEXT_PUBLIC_CLERK_SIGN_UP_URL` |
| بعد الدخول (fallback) | `ClerkAppProvider` + env | `/auth/continue` ← `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `_SIGN_UP_…` |
| بعد الخروج | Provider + UI `AFTER_LOGOUT` | `/` (`afterSignOutUrl` / `SignOutButton redirectUrl`) |
| بعد Google الأصلي | callback route | `/auth/continue?next=…` ثم `/dashboard` أو `/admin` |
| Clerk SSO | `/sso-callback` | ثم `/auth/continue` |
| Webhook (توثيق) | `.env.example` | `https://<domain>/api/webhooks/clerk` |

**ملاحظة:** المسارات نسبية؛ أصل الطلب (`request.origin`) يحدد المضيف. لا تغيير Clerk في هذه المرحلة.

### 5.3 مفاتيح / نسخة

CSP الإنتاجية ما زالت تسمح بـ `*.clerk.accounts.dev` و`clerk.shared.lcl.dev` → **Development instance** (تشخيص فقط؛ النقل لـ Production خارج الملزم).

---

## 6) جرد المتغيرات البيئية — المرتبطة بالأصل (origin)

| المتغير | مرتبط بالأصل؟ | ملاحظات |
|---|---|---|
| **`NEXT_PUBLIC_SITE_URL`** | **نعم — مركزي** | SEO، metadataBase، بريد، إحالات، CSP وقت البناء |
| **`NEXTAUTH_URL`** | **نعم — توافق** | fallback ثانٍ لـ `getSiteUrl` |
| **`OAUTH_REDIRECT_BASE`** | **نعم** | يتجاوز `origin` لـ Google/Microsoft `redirect_uri` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | غير مباشر | مفاتيح instance؛ النطاق يُضبط في لوحة Clerk لاحقًا |
| `NEXT_PUBLIC_CLERK_SIGN_*` / `*_FALLBACK_REDIRECT_URL` | مسارات نسبية | ليست نطاقًا؛ تُفسَّر على أصل الطلب |
| `CLERK_WEBHOOK_SECRET` | غير مباشر | URL الـ webhook يتبع النطاق عند التسجيل في Clerk |
| `GOOGLE_CLIENT_*` / `AZURE_AD_*` | غير مباشر | Redirect URIs في لوحات المزوّدين يجب أن تطابق النطاق |
| `DOC_TOOL_URL` | لا (خدمة خلفية) | بروكسي داخلي |
| `RESEND_*` | لا | المحتوى فقط؛ الروابط داخل الرسائل تأخذ `getSiteUrl()` |
| `VERCEL_URL` / `VERCEL_ENV` | جزئي | يوفّره Vercel؛ غير مستعمل كأصل الموقع في الشيفرة الجديدة |
| بقية المفاتيح (DB, AI, Twilio, Moyasar, …) | لا | ليست origin الواجهة |

الجرد التشغيلي الأوسع يبقى في `.env.example`؛ الجدول أعلاه يميّز ما يلزم عند انتقال النطاق.

---

## 7) ملفات الشيفرة في هذا الـ PR

| ملف | التغيير |
|---|---|
| `lib/modules/config/site-url.ts` | جديد |
| `scripts/test-site-url.ts` | جديد |
| `app/layout.tsx` | `metadataBase` |
| `app/sitemap.ts`, `robots.ts`, `llms.txt/route.ts` | `getSiteUrl()` |
| `app/developers/page.tsx`, `app/legal/**` | أصل ديناميكي |
| `app/admin/settings/page.tsx` | عرض callback من `absoluteUrl` |
| `lib/modules/support/notify.ts`, `email/send.ts`, `referrals/codes.ts` | أصل ديناميكي |
| `next.config.mjs` | CSP + allowedOrigins من أصل الموقع (Clerk كما هو) |
| `.env.example` | توثيق `NEXT_PUBLIC_SITE_URL` للثلاث بيئات |
| `DOMAIN_MIGRATION_AUDIT.md` | جرد صفر + إكمالات |
| `DOMAIN_MIGRATION_REPORT.md` | هذا الملف |

---

## 8) التحقق المحلّي

```bash
npx tsx scripts/test-site-url.ts
```

---

## 9) ما بعد هذه المرحلة (يتطلّب أمرًا صريحًا)

- ❌ دمج هذا الـ PR قبل موافقتك («دمج»)
- ❌ ربط `hakeemsa.com` / `www`
- ❌ تغيير `NEXT_PUBLIC_SITE_URL` إلى النطاق الجديد
- ❌ نشر قطع
- ❌ Clerk Production / نطاق مخصّص في Clerk
- ❌ Google Console URIs للنطاق الجديد

**توقّف هنا.** راجع الفروق في الـ PR قبل أي دمج.
