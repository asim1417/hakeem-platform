# DOMAIN_MIGRATION_AUDIT.md — المرحلة صفر (جرد فقط)

| البند | القيمة |
|---|---|
| المشروع | `hakeem-platform` (`prj_wJLAcWVw3StcZpNVp9AhiGHsjqV0`) |
| الفريق | `team_sQBQgYyXXLUexy89nNWD5aVO` |
| الفرع المفحوص | `main` @ `9ba7bbb` (وما بعده محليًا متزامن) |
| النطاق الحالي | `https://hakeem-platform.vercel.app` |
| النطاق المستهدف | `hakeemsa.com` (+ `www`) — **لم يُربط بعد** |
| تاريخ الجرد | 2026-07-24 |
| وضع المرحلة | **فحص فقط — لم يُعدَّل سلوك التطبيق** |
| الوصول إلى لوحة Vercel API | غير متاح من بيئة الوكيل (`VERCEL_TOKEN` غائب) |

**قاعدة هذه المرحلة:** لا تغيير في الشيفرة التشغيلية، ولا ربط نطاق، ولا نشر، ولا مساس بـ Clerk/DB. هذا الملف هو المخرج الوحيد المطلوب قبل موافقتك على المرحلة الأولى.

---

## 1) خلاصة تنفيذية

| السؤال | الجواب |
|---|---|
| هل الشيفرة مرتبطة بنطاق ثابت؟ | **نعم جزئيًا** — عدة ملفات تشغّل SEO/بريد/إحالات بقيمة `https://hakeem-platform.vercel.app` مكتوبة يدويًا |
| هل يوجد `NEXT_PUBLIC_SITE_URL`؟ | **كان لا** وقت الجرد الأولي — أُضيف في المرحلة 1 (انظر `DOMAIN_MIGRATION_REPORT.md`) |
| هل `metadataBase` مضبوط؟ | **كان لا** وقت الجرد — أُضيف في المرحلة 1 عبر `getSiteUrl()` |
| أين CSP؟ | `next.config.mjs` → `headers()` فقط (لا `vercel.json`) |
| هل Clerk تطوير أم إنتاج؟ | **تطوير (مؤكد من CSP الإنتاجية)**: `*.clerk.accounts.dev` + `clerk.shared.lcl.dev` ما زالا في ترويسة الإنتاج |
| هل مسارات OAuth تبني الأصل ديناميكيًا؟ | **نعم غالبًا** عبر `request.nextUrl.origin` + `OAUTH_REDIRECT_BASE` الاختياري |
| حالة `hakeemsa.com` الآن | TLS/HTTP من بيئة الفحص فشل (`SSL_ERROR_SYSCALL`) — النطاق **غير منشور/غير مربوط** بعد على المشروع |

---

## 2) جرد الذِكر الصريح للنطاق الحالي

### 2.1 شيفرة تشغيلية (تأثير على الإنتاج / SEO / بريد)

| الملف | السطر (تقريبًا) | السياق |
|---|---:|---|
| `app/sitemap.ts` | 7 | `const BASE = "https://hakeem-platform.vercel.app"` |
| `app/robots.ts` | 3 | نفس `BASE` |
| `app/llms.txt/route.ts` | 5 | نفس `BASE` |
| `app/developers/page.tsx` | 8 | نفس `BASE` لروابط التوثيق |
| `app/legal/page.tsx` | 11, 38 | `canonical` + Open Graph URL مطلقة |
| `app/legal/[slug]/page.tsx` | 10 | `BASE` |
| `app/legal/[slug]/[article]/page.tsx` | 10 | `BASE` |
| `lib/modules/support/notify.ts` | 7 | `NEXTAUTH_URL \|\| "https://hakeem-platform.vercel.app"` لروابط البريد |
| `lib/modules/email/send.ts` | 66 | رابط onboarding في البريد بنفس الاحتياط |
| `lib/modules/referrals/codes.ts` | 52 | افتراضي `buildReferralLink(..., origin = "https://hakeem-platform.vercel.app")` |
| `app/admin/settings/page.tsx` | 22 | نص إرشادي لـ Google callback على النطاق الحالي |

### 2.2 وكلاء / مخططات / وثائق (أثر تشغيلي محدود أو توثيقي)

| الملف | ملاحظة |
|---|---|
| `agents/*/manifest.json` (3 ملفات) | `endpoint` مطلق على vercel.app |
| `agents/schema/agent-manifest.schema.json` | `$id` مطلق |
| `docs/hakeem-external-api.md` | أمثلة Base URL |
| `scripts/test-ssr-oauth-start.ts` | قيمة اختبار ثابتة |
| `scripts/smoke-judicial.ts` | تعليق مثال |
| `README.md` | أمثلة `localhost:3000` / vercel.app |

### 2.3 `localhost:3000`

| الملف | السياق |
|---|---|
| `next.config.mjs` | `experimental.serverActions.allowedOrigins: ["localhost:3000"]` |
| `.github/workflows/deploy-readiness-check.yml` | `NEXTAUTH_URL: http://localhost:3000` |
| `README.md` | تعليمات تطوير محلي |

### 2.4 ما **ليس** مكتوبًا يدويًا (إيجابي)

- بدء Google OAuth: `googleCallbackUrl(origin)` من `request.nextUrl.origin` مع تجاوز اختياري `OAUTH_REDIRECT_BASE`.
- Clerk SSO start: `${origin}/sso-callback` و`${origin}/auth/continue?...`.
- معظم تحويلات المصادقة تستخدم مسارات نسبية (`/sign-in`, `/auth/continue`, `/dashboard`).

---

## 3) جرد بناء الروابط المطلقة (حسب النوع)

| النوع | أين | آلية البناء الحالية |
|---|---|---|
| Sitemap / robots / llms.txt | `app/sitemap.ts`, `robots.ts`, `llms.txt/route.ts` | ثابت vercel.app |
| Canonical / OG للصفحات القانونية | `app/legal/**` | ثابت vercel.app |
| بريد الدعم / الردود | `lib/modules/support/notify.ts` | `NEXTAUTH_URL` ثم ثابت |
| بريد onboarding | `lib/modules/email/send.ts` | `NEXTAUTH_URL` ثم ثابت |
| روابط الإحالة | `lib/modules/referrals/codes.ts` + `/api/referrals` يمرّر `request.nextUrl.origin` | افتراضي ثابت إن لم يُمرَّر origin |
| Google OAuth redirect_uri | `lib/modules/auth/google-oauth.ts` | `OAUTH_REDIRECT_BASE \|\| origin` |
| Microsoft OAuth | `lib/modules/auth/microsoft-oauth.ts` | نفس النمط |
| Clerk Portal / FAPI | `clerk-oauth-start.ts`, `oauth/start/route.ts` | origin ديناميكي + نطاقات Clerk |
| Webhook Clerk (توثيق) | `.env.example` | `https://<domain>/api/webhooks/clerk` — قالب |
| Checkout / billing redirects | `app/api/billing/checkout/route.ts` | نسبي على `request.url` |
| مشاركة / صور absolute | لم يُعثر على CDN نطاق ثابت للهوية خارج SEO أعلاه | — |

---

## 4) المتغيرات البيئية — جرد مرتبط بالأصل (origin)

### 4.1 مرتبطة مباشرة بالأصل / النطاق

| المتغير | في `.env.example`؟ | الاستخدام | ملاحظة قطع النطاق |
|---|---|---|---|
| **`NEXT_PUBLIC_SITE_URL`** | نعم (بعد المرحلة 1) | أصل موحّد: SEO، metadataBase، بريد، إحالات، CSP وقت البناء | **يُضبط في Production + Preview + Development**؛ التغيير النهائي يحتاج **إعادة نشر** (build-time) |
| **`NEXTAUTH_URL`** | نعم | fallback ثانٍ لـ `getSiteUrl` (اسم تاريخي) | أبقِه متوافقًا أو اعتمد على `NEXT_PUBLIC_SITE_URL` وحده |
| **`OAUTH_REDIRECT_BASE`** | نعم (فارغ) | يتجاوز `request.origin` لـ Google/Microsoft `redirect_uri` | حرج إن لزم URI ثابت أثناء تعدد المضيفين |

### 4.2 مرتبطة بالنطاق بشكل غير مباشر (إعدادات خارجية)

| المتغير | العلاقة |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | instance Clerk؛ إضافة النطاق المخصّص في لوحة Clerk لاحقًا |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` وغيرها من مسارات Clerk | مسارات **نسبية** — تُفسَّر على أصل الطلب الحالي |
| `CLERK_WEBHOOK_SECRET` | سرّ التوقيع؛ **URL** الـ webhook في Clerk يتبع النطاق عند التسجيل |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Redirect URI في Google Console يجب أن يطابق النطاق المستخدم |
| `AZURE_AD_*` / `MICROSOFT_*` | نفس الحكم لـ Entra redirect URI |
| `VERCEL_URL` / `VERCEL_ENV` | يوفّرها Vercel؛ ليست مصدر `getSiteUrl` |

### 4.3 غير مرتبطة بأصل الواجهة (عينة من `.env.example`)

`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `OPENAI_*`, `ANTHROPIC_*`, `GEMINI_*`, `EMBEDDING_*`, `AZURE_STORAGE_*`, `SHAREPOINT_*`, `OPENSEARCH_*`, `DOC_TOOL_*`, `RESEND_*`, `TWILIO_*`, `MOYASAR_*`, `REQUIRE_AUTH`, `FREE_QUOTA`, … — لا تُغيَّر لأجل انتقال النطاق.

**قاعدة:** المتغير المركزي للنطاق العام هو `NEXT_PUBLIC_SITE_URL`، ويُضبط على **الثلاث بيئات** بنفس القيمة قبل القطع وبعده (حتى لا تُنتج Preview روابط canonical خاطئة).

---

## 5) إعدادات Clerk (جرد كامل)

### 5.1 Middleware (`middleware.ts`)

| البند | التفصيل |
|---|---|
| الشرط | `clerkMiddleware` فقط إن `isClerkConfigured()` (مفتاحا Publishable + Secret) |
| محمي بـ `auth.protect` | `/dashboard(.*)`, `/admin(.*)`, `/audit-logs(.*)`, `/onboarding(.*)` |
| غير مصادق على المحمي | → `/sign-in?next=<pathname>` |
| استثناء جلسة أولى طرف | وجود كوكي `hakeem_session` يمرّر المسار المحمي بدون `protect` |
| مسجّل على صفحة دخول | `/sign-in|/sign-up|/login` → توجيه إلى `next` الآمن أو `/dashboard` |
| Bypass بلا `clerkMiddleware` | `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/login`, `/register`, `/pricing(.*)`, `/privacy(.*)`, `/terms(.*)`, `/legal(.*)`, `/auth/continue(.*)`, `/sso-callback(.*)`, `/api/auth/oauth/start(.*)`, `/api/auth/google(.*)`, `/api/auth/callback/google(.*)`, `/api/auth/claim-clerk-return(.*)`, `/api/auth/me(.*)`, `/api/auth/providers(.*)` |
| بلا مفاتيح | `resolveUnauthenticatedGate` / `plainAuthGate` |

### 5.2 قيم إعادة التوجيه بعد الدخول / الخروج / التسجيل

| التدفق | القيمة | المصدر |
|---|---|---|
| صفحة الدخول | `/sign-in` | `ClerkAppProvider.signInUrl` + `NEXT_PUBLIC_CLERK_SIGN_IN_URL` |
| صفحة التسجيل | `/sign-up` | `signUpUrl` + `NEXT_PUBLIC_CLERK_SIGN_UP_URL` |
| بعد الدخول (fallback) | `/auth/continue` | `signInFallbackRedirectUrl` / `signUpFallbackRedirectUrl` + env `*_FALLBACK_REDIRECT_URL` |
| بعد الخروج | `/` | `afterSignOutUrl="/"` + `AFTER_LOGOUT` في `LogoutButton` / `AccountMenu` (`SignOutButton redirectUrl`) |
| بعد Google الأصلي | `/auth/continue?next=…` → `/dashboard` أو `/admin` | `api/auth/callback/google` ثم صفحة continue |
| Clerk SSO | `/sso-callback` → `/auth/continue` | مسار SSO + توحيد الجلسة |
| Webhook (توثيق فقط) | `https://<domain>/api/webhooks/clerk` | `.env.example` — قالب |

جميع مسارات Clerk أعلاه **نسبية** (لا نطاق مطلق في الشيفرة). الأصل = مضيف الطلب.

### 5.3 المزوّد والمفاتيح

| المكوّن | الملخص |
|---|---|
| Provider | `ClerkRoot` → `ClerkAppProvider` — **ليس** على `/` ولا `/sign-in` ولا `/auth/continue` (عزل iPhone) |
| نسخة Clerk | CSP تتضمّن `*.clerk.accounts.dev` + `clerk.shared.lcl.dev` → **Development** |
| تحذير | `pk_test_` على نطاق حيّ غير مستقر؛ الانتقال لـ `pk_live_` خارج هذه المرحلة |

---

## 6) سياسة CSP — المصدر والنص الحالي

**المصدر الوحيد:** `next.config.mjs` → `async headers()` → مفتاح `Content-Security-Policy`.

**لا يوجد** `vercel.json`، ولا بناء CSP في `middleware.ts`.

نص الإنتاج الحي (عينة ترويسة `/` بتاريخ الجرد) يتضمن صراحة:

- `https://*.clerk.accounts.dev`
- `https://*.clerk.com`
- `https://*.protect.clerk.com`
- `https://*.accounts.dev`
- `https://clerk.shared.lcl.dev`
- `https://challenges.cloudflare.com`
- `https://accounts.google.com` / `https://appleid.apple.com` في `form-action`
- خطوط Google Fonts في `style-src` / `font-src`

**ملزم أحمر للمرحلة 1:** عند بناء CSP من متغير النطاق، **يُمنع حذف** نطاقات Clerk الحالية.

---

## 7) `metadataBase`

**وقت الجرد الأولي:** غير موجود في `app/layout.tsx`.

**بعد المرحلة 1 (على الفرع):** `metadataBase: new URL(getSiteUrl())` — انظر تقرير المرحلة 1.

---

## 8) Deployment Protection

| الفحص | النتيجة |
|---|---|
| وصول API/CLI لـ Vercel من الوكيل | **غير متاح** (`VERCEL_TOKEN` غير موجود) |
| مؤشرات من صاحب المشروع (معتمدة في التقرير) | استجابات بـ `cache-control: private, no-store`؛ الوصول يحتاج `_vercel_share`؛ حقل `live: false` في بيانات المشروع |
| الحكم المعتمد | حماية النشر **مفعّلة وتشمل الإنتاج** — التحقق النهائي من اللوحة يبقى عندك: Project → Settings → Deployment Protection |

---

## 8b) وقت البناء vs وقت التشغيل (ملزم توثيقي)

| العنصر | التوقيت | أثر قطع النطاق |
|---|---|---|
| `NEXT_PUBLIC_*` | **build-time** | تغيير القيمة في Vercel **لا يكفي** — يلزم **إعادة نشر** |
| CSP و`allowedOrigins` في `next.config.mjs` | **build-time** | نفس الحكم |

التفاصيل التنفيذية في `DOMAIN_MIGRATION_REPORT.md` §2.

---

## 9) ملاحظات تشغيلية للنطاق الجديد (تشخيص أولي — بلا تنفيذ)

1. **`hakeemsa.com` / `www`:** فشل اتصال TLS من بيئة الجرد → لم يُضف إلى المشروع أو لم يكتمل التحقق بعد.
2. **Google OAuth الأصلي:** يستخدم `origin` الحالي؛ عند فتح التطبيق من `hakeemsa.com` سيُطلب `redirect_uri=https://hakeemsa.com/api/auth/callback/google` — يجب تسجيله في Google Console **قبل** اعتماد النطاق (جلسة لاحقة / خارج ملزم Clerk الحالي إن لزم).
3. **Clerk:** على نسخة تطوير؛ إضافة نطاق مخصّص أو النقل إلى Production **خارج هذه المرحلة** (الملزم الأحمر 3).
4. **لا Primary / لا Redirect من vercel.app** في أي خطوة قادمة ضمن الملزمات.

---

## 10) قائمة ملفات المرحلة 1 المقترحة (للموافقة لاحقًا — لم تُنفَّذ)

ملفات تشغيلية يجب تحريرها من الترميز الصلب (مع إبقاء fallback = النطاق الحالي):

1. وحدة جديدة مقترحة: `lib/modules/config/site-url.ts` (أو ما يعادلها) تقرأ `NEXT_PUBLIC_SITE_URL` → fallback `https://hakeem-platform.vercel.app`
2. `app/sitemap.ts`, `app/robots.ts`, `app/llms.txt/route.ts`
3. `app/developers/page.tsx`, `app/legal/**`
4. `app/layout.tsx` → `metadataBase`
5. `lib/modules/support/notify.ts`, `lib/modules/email/send.ts`, `lib/modules/referrals/codes.ts`
6. `next.config.mjs` → CSP تُبنى مع الإبقاء على Clerk hosts كما هي؛ توسيع `serverActions.allowedOrigins` عبر env عند الحاجة
7. `.env.example` → توثيق `NEXT_PUBLIC_SITE_URL`
8. نص إرشادي في `app/admin/settings/page.tsx` (عرض من المتغير لا ثابت)

**خارج نطاق الاستبدال النمطي:** وثائق/تقارير/fixtures اختبارية يمكن إبقاؤها أو تحديثها بانتقاء لاحقًا (الملزم: لا استبدال جماعي أعمى).

---

## 11) ما لن يُفعل قبل موافقة لاحقة (ما زال ساريًا)

- ❌ إضافة نطاق في Vercel  
- ❌ تغيير متغيرات إنتاج من الوكيل (خطوات اللوحة موثّقة في التقرير)  
- ❌ نشر  
- ❌ تغيير Clerk  
- ❌ Prisma / DB  
- ❌ دمج PR المرحلة 1 قبل أمر «دمج»

---

## 12) حالة المراحل

- ✅ **المرحلة صفر** — هذا الملف + إكمالات Clerk/env/Deployment Protection/build-time  
- ✅ **المرحلة الأولى (شيفرة فقط)** — على الفرع `cursor/site-url-config-9b97`؛ التفاصيل في `DOMAIN_MIGRATION_REPORT.md`  
- ⏸ بانتظار عرض الفروق وموافقتك قبل أي دمج أو مرحلة تالية
