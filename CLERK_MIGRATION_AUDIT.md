# CLERK_MIGRATION_AUDIT.md — المرحلة صفر (تشخيص فقط)

| البند | القيمة |
|---|---|
| التاريخ | 2026-07-25 |
| الفرع المفحوص | `main` @ `db83d2f` (عبر `cursor/clerk-prod-audit-9b97`) |
| المشروع | `prj_wJLAcWVw3StcZpNVp9AhiGHsjqV0` / فريق `team_sQBQgYyXXLUexy89nNWD5aVO` |
| وضع المرحلة | **فحص وتوثيق فقط — بلا تعديل شيفرة / بلا تبديل مفاتيح / بلا دمج** |
| وصول Vercel API / لوحة Clerk | **غير متاح** من الوكيل (`VERCEL_TOKEN` غائب؛ لا جلسة Clerk) |

**تنبيه دائم:** الحسابات والجلسات ومعرّفات Clerk **لا تنتقل** بين نسخة التطوير ونسخة الإنتاج. أي تبديل لاحق للمفاتيح يُسقط الجلسات ويترك `users.clerk_id` يشير إلى مستخدمين غير موجودين في النسخة الجديدة حتى تُعاد المزامنة بالبريد.

---

## 1) خلاصة تنفيذية

| السؤال | الجواب |
|---|---|
| هل Clerk على Development في الإنتاج؟ | **نعم — مؤكَّد بدليلين حيّين** (انظر §2) |
| هل يوجد webhook؟ | **نعم** — `POST /api/webhooks/clerk` مع تحقق Svix عبر `CLERK_WEBHOOK_SECRET` |
| هل تُخزَّن معرّفات Clerk في DB؟ | **نعم — حرج** — `users.clerk_id` (`User.clerkId`) فريد واختياري |
| أين تُبنى CSP؟ | `next.config.mjs` → `async headers()` — **وقت البناء** |
| هل الحزمة محدّثة ضمن خط Next 14؟ | `@clerk/nextjs@6.39.6` = **أحدث 6.x** المتوافق مع Next 14؛ سطر 7.x يتطلب Next ≥15.2.8 |
| هل يجوز تبديل المفاتيح الآن؟ | **لا** — الملزم الأحمر 1؛ بعد توسيع CSP + نشر + قائمة المستخدم فقط |

---

## 2) دليل Development في الإنتاج (حيّ)

فُحص النطاقان في 2026-07-25:

| الدليل | `hakeem-platform.vercel.app` | `hakeemsa.com` |
|---|---|---|
| CSP تسمح بـ `*.clerk.accounts.dev` و`clerk.shared.lcl.dev` | نعم (في `script-src` / `frame-src` / `form-action`) | نعم — نفس السياسة |
| رأس `/dashboard` بلا جلسة | `x-clerk-auth-reason: **dev-browser-missing**` + `x-clerk-auth-status: signed-out` + 307 → `/sign-in?next=%2Fdashboard` | **نفس الرؤوس** |

`www.hakeemsa.com` لم يُفصَل هنا (مُفترض 308→الأصل حسب معطياتك الثابتة).

---

## 3) إصدار حزمة Clerk

| الحزمة | في `package.json` / المثبّت | ملاحظة توافق |
|---|---|---|
| `@clerk/nextjs` | `^6.39.6` / مثبّت **6.39.6** | peer: Next `^13.5.7 \|\| ^14.2.25 \|\| ^15.2.3 \|\| ^16` — متوافق مع Next المشروع `^14.2.18` |
| أحدث npm عام | **7.6.1** | peer: Next **≥15.2.8** — **غير مناسب** دون ترقية Next |
| أحدث خط 6.x | **6.39.6** | = ما لدينا؛ لا فجوة إصدار ضمن 6.x |
| `@clerk/backend` (تابع) | **2.33.6** | يُستخدم في `establish-session.ts` عبر `createClerkClient` |
| أخرى تحت `@clerk/*` | `clerk-react`, `shared`, `types`, `localizations` | تُسحب مع nextjs |

**حكم المرحلة صفر:** لا يلزم ترقية Clerk قبل النقل؛ البقاء على 6.39.6 مع Next 14 سليم. ترقية 7.x خارج نطاق هذه الهجرة ما لم تُرقَّ Next أولًا.

---

## 4) Middleware (`middleware.ts`)

### 4.1 مسارات محمية (`auth.protect` عند غياب `hakeem_session`)

- `/dashboard(.*)`
- `/admin(.*)`
- `/audit-logs(.*)`
- `/onboarding(.*)`

غير مصادق → `/sign-in?next=<pathname>`.

### 4.2 مسارات دخول (إعادة توجيه إن وُجدت جلسة Clerk)

`/sign-in(.*)`, `/sign-up(.*)`, `/login` → `next` الآمن أو `/dashboard`.

### 4.3 Bypass — لا يُشغَّل `clerkMiddleware` (عزل iPhone / OAuth)

`/`, `/sign-in(.*)`, `/sign-up(.*)`, `/login`, `/register`, `/pricing(.*)`, `/privacy(.*)`, `/terms(.*)`, `/legal(.*)`, `/auth/continue(.*)`, `/sso-callback(.*)`, `/api/auth/oauth/start(.*)`, `/api/auth/google(.*)`, `/api/auth/callback/google(.*)`, `/api/auth/claim-clerk-return(.*)`, `/api/auth/me(.*)`, `/api/auth/providers(.*)`.

ملاحظة: وجود كوكي `hakeem_session` يمرّر المسارات المحمية **بدون** `auth.protect` (جلسة أولى طرف موازية لـ Clerk).

### 4.4 Matcher

```ts
matcher: [
  "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  "/(api|trpc)(.*)",
]
```

### 4.5 بلا مفاتيح Clerk

`plainAuthGate` / `resolveUnauthenticatedGate` بدل `clerkMiddleware`.

---

## 5) قيم إعادة التوجيه (نسبية — بلا نطاق مطلق في الشيفرة)

| التدفق | القيمة | المصدر |
|---|---|---|
| صفحة الدخول | `/sign-in` | `ClerkAppProvider` + `NEXT_PUBLIC_CLERK_SIGN_IN_URL` |
| صفحة التسجيل | `/sign-up` | `signUpUrl` + `NEXT_PUBLIC_CLERK_SIGN_UP_URL` |
| بعد الدخول / التسجيل (fallback) | `/auth/continue` | `signInFallbackRedirectUrl` / `signUpFallbackRedirectUrl` + env `*_FALLBACK_REDIRECT_URL` |
| بعد الخروج | `/` | `afterSignOutUrl="/"` + `AFTER_LOGOUT` في أزرار الخروج |
| نقطة التوحيد بعد OAuth/Clerk | `/auth/continue?next=…` | Provider + Google callback + SSO |
| بعد `continue` (مستخدم عادي) | `/dashboard` (أو `next` الآمن) | `resolvePostLoginNext` |
| بعد `continue` (SUPER_ADMIN) | `/admin` إن كانت اللوحة مفعّلة | `home-destination.ts` |
| Clerk SSO callback | `/sso-callback` → ثم `/auth/continue` | `AuthOauthOnlyInner` / `SsoCallbackClient` |
| Google الأصلي (غير Clerk FAPI) | `/api/auth/callback/google` → جلسة أولى طرف → `/auth/continue` | مسار منفصل |
| Handshake Clerk على continue | → `/api/auth/claim-clerk-return?...` | `app/auth/continue/page.tsx` |
| Onboarding | مسار **محمي** `/onboarding(.*)`؛ ليست وجهة fallback افتراضية بعد الدخول | تُفتح لاحقًا عبر منطق الملف إن لزم |
| Webhook (توثيق) | `https://<domain>/api/webhooks/clerk` | `.env.example` |

---

## 6) المتغيرات البيئية المتعلقة بـ Clerk

| المتغير | علني / سرّي | الدور |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **علني** (يُضمَّن في العميل وقت البناء) | مفتاح النشر — `pk_test_` حاليًا متوقَّع |
| `CLERK_SECRET_KEY` | **سرّي** | خادم / middleware / `@clerk/backend` |
| `CLERK_WEBHOOK_SECRET` | **سرّي** | تحقق توقيع Svix للـ webhook — **لا ينتقل بين النسختين** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | علني (مسار) | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | علني (مسار) | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | علني (مسار) | `/auth/continue` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | علني (مسار) | `/auth/continue` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` | علني (اختياري، معلّق في المثال) | `/` إن فُعّل |

مرتبطة بالدخول لكن ليست مفاتيح Clerk instance:

| المتغير | ملاحظة |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth أصلي للمنصة (`/api/auth/callback/google`) — منفصل عن عميل Google داخل لوحة Clerk |
| `OAUTH_REDIRECT_BASE` | تجاوز أصل redirect |
| `AUTH_APPLE_ENABLED` / `NEXT_PUBLIC_AUTH_APPLE_ENABLED` | إظهار Apple في الواجهة |
| إعدادات اللوحة (`settings-service`) | قد تحمّل `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_WEBHOOK_SECRET` من DB وقت الإقلاع |

---

## 7) Webhook — بند حرج

| البند | التفصيل |
|---|---|
| المسار | `POST /api/webhooks/clerk` — الملف `app/api/webhooks/clerk/route.ts` |
| الأحداث المعالجة | `user.created`, `user.updated` → `ensureLocalUserFromClerk`؛ `user.deleted` → `deactivateLocalUserByClerkId` |
| التحقق من التوقيع | **نعم** — مكتبة `svix` (`Webhook.verify`) على رؤوس `svix-id` / `svix-timestamp` / `svix-signature` |
| بدون سرّ | استجابة **503** (`CLERK_WEBHOOK_SECRET غير مضبوط`) |
| توقيع فاسد/ناقص | 400 |
| أثر النقل | يجب إنشاء endpoint + سرّ جديد في **نسخة الإنتاج** وتحديث `CLERK_WEBHOOK_SECRET` في Vercel — السرّ القديم لن يعمل |

لا يمكن من الوكيل تأكيد أن الـ webhook مُسجَّل فعليًا في لوحة Clerk Development — يلزم تحققك من اللوحة.

---

## 8) معرّفات مستخدمي Clerk في قاعدة البيانات — الأخطر

| البند | التفصيل |
|---|---|
| الجدول | `users` (`model User`) |
| الحقل | `clerkId String? @unique @map("clerk_id")` |
| الاستخدام | مزامنة webhook؛ `ensureLocalUserFromClerk`؛ `establish-session` / `claim-clerk-return`؛ تعطيل عند الحذف |
| مفتاح المنصة الداخلي | `users.id` (cuid) — منفصل عن Clerk |
| جلسة أولى طرف | كوكي `hakeem_session` ترتبط بمستخدم المنصة المحلي بعد المزامنة |

**حجم المشكلة:** `DATABASE_URL` غير متاح في بيئة الوكيل — **تعذّر عدّ الصفوف** ذات `clerk_id IS NOT NULL`.  
من الشيفرة وحدها: كل مستخدم مُزامَن يحمل `clerk_id` من نسخة التطوير؛ بعد التبديل إلى Production:

1. معرّفات `user_…` القديمة **لن توجد** في النسخة الجديدة.
2. السجلات المحلية تبقى (بريد، أدوار، قضايا…) لكن الربط بـ Clerk ينكسر حتى إعادة مزامنة بالبريد (webhook أو مسار establish).
3. **لا أُعالج الربط تلقائيًا في هذه المرحلة** — أبلّغ فقط. يلزم لاحقًا أمر صريح + إحصاء من الإنتاج.

سكربت/هجرة ذات صلة (للتوثيق لا للتنفيذ هنا): `scripts/apply-clerk-id.ts`, `prisma/migrations/20260719120000_add_clerk_id/`, تجهيز عمود عند الإقلاع في `instrumentation.ts`.

---

## 9) سياسة CSP — المصدر والنص

### 9.1 أين تُبنى

- الملف: `next.config.mjs`
- الدالة: `async headers()` → مفتاح `Content-Security-Policy` على المصدر `/:path*`
- التوقيت: **وقت البناء** (مثل `NEXT_PUBLIC_*`)
- متغير `clerkHosts` ثابت حاليًا (سطر واحد) — **ليس** مشتقًا من env بعد

### 9.2 قيمة `clerkHosts` في الشيفرة

```
https://*.clerk.accounts.dev
https://*.clerk.com
https://*.protect.clerk.com
https://*.accounts.dev
https://clerk.shared.lcl.dev
```

تُحقن في: `script-src`, `frame-src`, `form-action` (مع Google/Apple في form-action).  
`connect-src` = `'self' ${siteOrigin} https:` — أي اتصال HTTPS مسموح أصلًا (بما فيه Clerk APIs)، فعنق الزجاجة الأهم للنقل هو **script/frame/form** للنطاقات المخصصة (مثل بوابة حسابات على نطاقك) وليس `connect-src`.

### 9.3 نص CSP الحيّ (عينة من `/` على النطاقين — متطابق)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://*.accounts.dev https://clerk.shared.lcl.dev https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://hakeem-platform.vercel.app https:;
frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://*.accounts.dev https://clerk.shared.lcl.dev https://challenges.cloudflare.com;
worker-src 'self' blob:;
frame-ancestors 'self';
base-uri 'self';
form-action 'self' https://hakeem-platform.vercel.app https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://*.accounts.dev https://clerk.shared.lcl.dev https://accounts.google.com https://appleid.apple.com;
object-src 'none'
```

ملاحظة: `siteOrigin` في CSP ما زال `https://hakeem-platform.vercel.app` (متوافق مع `NEXT_PUBLIC_SITE_URL` / الاحتياط). `'self'` يغطي المضيف الفعلي عند الزيارة من `hakeemsa.com`.

### 9.4 فجوة متوقعة قبل التبديل (للمرحلة 1 — لم تُنفَّذ)

نطاقات Clerk **الإنتاجية المخصّصة** (مثل Frontend API / Account Portal على نطاقك بعد إعداد DNS في Clerk) غالبًا **ليست** تحت `*.clerk.accounts.dev`.  
`*.clerk.com` موجود مسبقًا؛ ما يُضاف لاحقًا يجب أن يكون **بجانب** نطاقات التطوير عبر متغير بيئي (تعايش مؤقت)، بلا حذف.

---

## 10) معمارية مصادقة مختصرة (للسياق)

```
Clerk (pk_test_ / Development)
  + جلسة أولى طرف hakeem_session
  + مزامنة users.clerk_id
  + Google OAuth أصلي اختياري (/api/auth/google)
  + Clerk SSO (/sso-callback) لـ Google/Apple عبر Clerk
```

مزوّدا الدخول الاجتماعي في CSP `form-action`: `accounts.google.com`, `appleid.apple.com` (ثابت من المعطيات).

---

## 11) ما لن يُفعل قبل موافقتك على المرحلة 1

- ❌ توسيع CSP / أي تعديل `next.config.mjs`
- ❌ تبديل مفاتيح Clerk
- ❌ حذف نطاقات التطوير من CSP
- ❌ تغيير نطاقات Vercel / Primary
- ❌ Prisma / بيانات
- ❌ تعديل واجهة
- ❌ دمج إلى `main` (الدمج = نشر إنتاجي تلقائي)

---

## 12) طلب الموافقة

**اكتملت المرحلة صفر.**  
المخرج: هذا الملف `CLERK_MIGRATION_AUDIT.md`.

إذا وافقت، المرحلة الأولى حسب أمرك: توسيع CSP لتعايش نطاقات Development + Production (مشتقة من env)، **بلا** تبديل مفاتيح، مع تذكير صريح أن الدمج إلى `main` سيُطلق نشرًا إنتاجيًا تلقائيًا قبل الدمج.
