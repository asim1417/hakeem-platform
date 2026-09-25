# دليل تفعيل وسائل الدخول في حكيم (Clerk)

حكيم يستخدم Clerk مزوّدَ هوية، مع إبقاء صفحات `/sign-in` و`/sign-up` بلا Clerk JS
(لاستقرار iPhone/Safari). كل وسيلة غير Google مخفية حتى **تُفعَّل في لوحة Clerk أولًا**
ثم يُضبط علمها في بيئة النشر أو من لوحة الإعدادات في حكيم (مجموعة «وسائل الدخول (Clerk)»).

> القاعدة: فعّل في Clerk ← اختبر في بيئة التطوير ← اضبط العلم `=1` ← أعد النشر.
> تسميات قوائم لوحة Clerk قد تختلف قليلًا بحسب إصدارها.

## الربط بتطبيق Clerk

- التطبيق: `app_3JpE1GKAefz0gGh5JdzwPM6HP1F`
- المفاتيح في بيئة النشر: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` و`CLERK_SECRET_KEY`
  (من **API Keys** في لوحة التطبيق). لا تضع `CLERK_SECRET_KEY` في أي كود عميل.
- للإنتاج استخدم مفاتيح `pk_live_` / `sk_live_` بعد ربط النطاق في Clerk (**Domains**).

## الوسائل وأعلامها

| الوسيلة | ما تفعله في لوحة Clerk | العلم في حكيم |
|---|---|---|
| Google | **SSO connections** ← Google (في الإنتاج: بيانات OAuth خاصة من Google Cloud) | يظهر تلقائيًا |
| Microsoft | **SSO connections** ← Microsoft (في الإنتاج: تسجيل تطبيق في Entra ID وإدخال Client ID/Secret؛ عنوان الرجوع تعرضه Clerk) | `AUTH_MICROSOFT_ENABLED=1` |
| Apple | **SSO connections** ← Apple (يحتاج حساب Apple Developer: Services ID + Key) | `AUTH_APPLE_ENABLED=1` |
| البريد برمز تحقق | **Email** ← Sign-in with email ← Email verification code | `AUTH_EMAIL_CODE_ENABLED=1` |
| الجوال برمز OTP | **Phone** ← Sign-in with phone ← SMS verification code (راجع الدول المسموحة وتكلفة الرسائل في خطتك) | `AUTH_PHONE_ENABLED=1` |
| التحقق الثنائي | **Multi-factor** ← Authenticator app (TOTP) + Backup codes، ويُفضَّل SMS احتياطًا (قد يتطلب خطة مدفوعة) | `AUTH_MFA_ENABLED=1` |
| حسابات المكاتب | **Organizations** ← Enable، وحدّد الأدوار (مثل: مدير المكتب / محامٍ) وحد الأعضاء | `AUTH_ORGANIZATIONS_ENABLED=1` |

كل علم يقبل `1` أو `true` أو `yes`، ويقبل أيضًا نظيره `NEXT_PUBLIC_*`.

## كيف تعمل كل وسيلة في الكود

- **Google**: `/api/auth/google` (OAuth أصلي إن وُجدت `GOOGLE_CLIENT_ID/SECRET`، وإلا Clerk).
- **Microsoft / Apple**: `/api/auth/oauth/start?provider=microsoft|apple` ← بوابة حسابات Clerk
  (`/sign-in/sso?strategy=oauth_…`) ← `/auth/continue` لتثبيت الجلسة.
- **البريد / الجوال**: `/api/auth/oauth/start?provider=email|phone` ← صفحة الدخول أو التسجيل
  في بوابة Clerk، وهي تعرض الحقول المفعّلة وتطلب الرمز الثاني لمن فعّل التحقق الثنائي.
- **التحقق الثنائي وحساب المكتب**: قائمة الحساب ← `/api/auth/account-portal?section=security|organization`
  ← صفحة `/user` أو `/organization` في البوابة، ثم العودة إلى لوحة التحكم.
- الوسيلة التي لم يُضبط علمها لا تظهر، ورابطها المباشر يعود إلى `/sign-in`.

نطاق البوابة يُستنتج من المفتاح العلني (`xxx.accounts.dev` في التطوير، `accounts.<نطاقك>` في الإنتاج).
إن اختلف فاضبط `NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_URL`.

## إعدادات موصى بها في Clerk

- **Account Portal**: فعّله، واضبط الشعار والألوان والعربية ليطابق هوية حكيم.
- **Account linking**: اربط الحسابات بالبريد الموثّق حتى يصل المستخدم للحساب نفسه عبر Google أو البريد.
- **Attack protection**: فعّل حماية الروبوتات وقفل الحساب بعد محاولات فاشلة.
- **Webhook**: `https://<domain>/api/webhooks/clerk` بأحداث `user.*`، والسر في `CLERK_WEBHOOK_SECRET`.

## قائمة اختبار قبل الإطلاق

1. `/sign-in` على iPhone Safari وAndroid Chrome وسطح المكتب: تظهر الأزرار المفعّلة فقط.
2. كل وسيلة: حساب جديد ثم دخول ثانٍ، ثم التأكد من الوصول إلى `/dashboard`.
3. تفعيل التحقق الثنائي من قائمة الحساب ثم تسجيل الخروج والدخول بالرمز.
4. إنشاء مكتب ودعوة عضو ثانٍ وقبول الدعوة.
5. `npm run test:auth-providers-visibility` و`npx tsx scripts/test-ssr-oauth-start.ts`.
