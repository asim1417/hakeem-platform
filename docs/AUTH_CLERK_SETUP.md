# بوابة الدخول في حكيم (Clerk)

> آخر تحديث: 27/09/2026. يشمل التغييرات حتى PR ‎#676.

حكيم يستخدم Clerk مزوّدًا للهوية، ويستخدم لجلسة المنصة كوكي الطرف الأول `hakeem_session`.
الواجهة عربية بالكامل، وClerk لا يُحمَّل في المتصفح إلا عند أول تفاعل مع حقل الجوال أو البريد (لاستقرار iPhone وSafari وسرعة الصفحة).
كل وسيلة غير Google مخفية حتى **تُفعَّل في لوحة Clerk أولًا**، ثم يُضبط علمها في Vercel أو في `/admin/settings` (مجموعة «وسائل الدخول (Clerk)»).

> القاعدة: فعّل في Clerk ← اختبر في بيئة التطوير ← اضبط العلم `=1` ← أعد النشر.
> تسميات قوائم لوحة Clerk قد تختلف قليلًا بحسب إصدارها.

## الربط بتطبيق Clerk

- التطبيق: `app_3JpE1GKAefz0gGh5JdzwPM6HP1F`.
- المفاتيح في بيئة النشر: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` و`CLERK_SECRET_KEY`.
  مصدرهما قائمة **API Keys** في لوحة التطبيق.
- لا تضع `CLERK_SECRET_KEY` في أي كود يعمل في المتصفح.

### قاعدة المفاتيح (إلزامية)

**المفتاحان يجب أن يكونا من نسخة Clerk نفسها.** في الإنتاج: نسخة **Production**، والمفتاح العام `pk_live_…` والسري `sk_live_…`، بعد ربط النطاق في Clerk (**Domains**).

- المتصفح يتحقق من الرمز بالمفتاح العام، والخادم يتحقق من الجلسة بالمفتاح السري.
- إن كان أحدهما من نسخة Development (`sk_test_`) والآخر من Production (`pk_live_`)، فسيصل الرمز ويتحقق، ثم **يرفض الخادم كل جلسة** (401).
- وهذا ما حدث فعلًا حتى 26/09/2026: 7 محاولات من 7 رُفضت. كشفه السجل التشخيصي بـ `secretKind: sk_test_` و`publishableKind: pk_live_`.

**المفتاحان مُداران أيضًا في `/admin/settings`.**
- `hydrateEnvFromSettings` يستبدل بقيمة Vercel ما يُحفظ في قاعدة البيانات.
- عند تغيير المفاتيح: حدّثها في Vercel **و**في `/admin/settings`، أو امسحها من الإعدادات ليُعتمد مفتاح Vercel وحده.
- يحفظ الخادم قيمة Vercel الأصلية قبل أي استبدال (`originalEnvValue`)، ويتحقق من الجلسة بالمفتاحين.

**تغيير متغيّرات Vercel لا يسري إلا بعد نشر جديد.**

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
| نموذج حكيم العربي للجوال/البريد | — | `AUTH_IDENTIFIER_FORM_ENABLED=1` (عند `0` يُستعمل بدله بوابة Clerk المستضافة) |

كل علم يقبل `1` أو `true` أو `yes`، ويقبل أيضًا نظيره `NEXT_PUBLIC_*`.

الحالة في الإنتاج (26/09/2026):
- مفعّل: Google، والبريد، والجوال، والتحقق الثنائي، والنموذج العربي.
- مخفي مؤقتًا: Microsoft وApple، حتى تُضاف مفاتيحهما في Clerk Production.

## صفحة دخول واحدة

للدخول مكان واحد بتصميم واحد: **صندوق الدخول** (`components/home/HomeAuthDialog.tsx`). يظهر بطريقتين:

| المدخل | الشكل |
|---|---|
| روابط الدخول في الرئيسية `/` | نافذة داخل الصفحة: لوح سفلي على الجوال، وصندوق 440px على سطح المكتب |
| `/sign-in` | الصندوق نفسه بطاقةً في الصفحة (`variant="page"`، `SignInPagePanel`)، بلا خلفية معتمة ولا زر إغلاق، والعنوان `h1` |

- `/sign-up` و`/register` ← `/sign-in?mode=sign-up`.
- `/login` و`/auth/identifier` ← `/sign-in`.
- الإحالة بـ 307 في `middleware.ts` قبل رسم أي صفحة (`lib/modules/auth/single-sign-in.ts`)، ولا تضع `redirect()` في الصفحة؛ فبسبب `app/loading.tsx` يصير انتقالًا من المتصفح.
- الوجهة `next` محفوظة، وتمر على `safeDashboardNext`، فالوجهات الخارجية ← `/dashboard`.
- إعدادات الصندوق مشتركة بين المدخلين: `buildHomeAuthConfig()` في `lib/modules/auth/home-auth-config.ts`.

### محتوى الصندوق

1. زر «المتابعة باستخدام Google» (ومعه Microsoft وApple إن فُعّلا). وسم «آخر دخول» فوق آخر وسيلة استُعملت (كوكي `hakeem_last_auth`).
2. تبويبا **«رقم الجوال | البريد الإلكتروني»**، وهما المقترح (أ) المعتمد:
   - يظهران فقط إن كانت الوسيلتان مفعّلتين؛ وإن كانت واحدة ظهر حقلها وحده.
   - **الجوال افتراضي:** بادئة ‎+966 ثابتة، ولوحة أرقام (`inputmode=numeric`، `autocomplete=tel-national`)، وسطر «سنرسل رمزًا من ستة أرقام برسالة نصية.».
   - **البريد:** تتغيّر التسمية ولوحة المفاتيح والسطر التوضيحي.
   - لكل تبويب قيمته، ويُحفظ آخر تبويب مستعمل (كوكي `hakeem_last_id_method`، باسم الوسيلة فقط).
   - التحقق حسب التبويب (`parseIdentifierFor`)، والجوال يقبل ‎5XXXXXXXX و‎05XXXXXXXX و‎9665XXXXXXXX والأرقام الدولية بعلامة +.
3. زر «أرسل الرمز» للوسيلتين.
4. شاشة الرمز: ست خانات فوق حقل حقيقي واحد (`one-time-code`)، وإرسال تلقائي عند اكتمال الأرقام، وإعادة إرسال بعد مهلة.
5. «جارٍ إكمال الدخول…» ثم «تم التحقق»، ثم انتقال واحد إلى الوجهة.

## مسار الدخول بالجوال أو البريد خطوة بخطوة

```
الرقم أو البريد
 └─ endStaleClerkSessions()          إنهاء أي جلسة Clerk متبقية (Session.end، بلا انتقال)
 └─ signIn.create ← prepareFirstFactor   Clerk يرسل الرمز
     (form_identifier_not_found ← signUp.create ← prepare…Verification: حساب جديد تلقائيًا)
الرمز
 └─ attemptFirstFactor / attempt…Verification   Clerk يتحقق من الرمز
 └─ setActive(session)                داخل activateWithoutNextRefresh
 └─ «جارٍ إكمال الدخول…»
 └─ POST /api/auth/claim-clerk-session  { token: رمز جلسة Clerk القصير }
       الخادم: hydrateEnvFromSettings ← verifyToken (بالمفتاح الحالي ومفتاح Vercel الأصلي)
               ← users.getUser ← establishFirstPartySession ← كوكي hakeem_session
 └─ نجاح: «تم التحقق» ← router.push(الوجهة) ← /dashboard (أو /onboarding للحساب الجديد)
 └─ فشل: العودة إلى الحقل برسالة «تعذّر إكمال الدخول. حاول مرة أخرى.»، بلا انتقال
```

قواعد ثابتة في هذا المسار:
- **رمز في كل محاولة:** جلسة Clerk متبقية من محاولة سابقة كانت تُرجع `session_exists` وتُدخل المستخدم دون رمز. تُنهى الآن قبل الإرسال، و`session_exists` لا يُدخل أحدًا دون رمز.
- **لا «تم التحقق» قبل تأكيد الخادم،** ولا انتقال إلى مسار محمي عند الفشل، لأنه كان يعيد المستخدم إلى صفحة الدخول.
- **لا إعادة تحميل وسط الدخول:**
  - `@clerk/nextjs` يستدعي حول `setActive` إجراء خادم (`invalidateCacheAction`) ثم `router.refresh`.
  - على صفحاتنا يفشل الإجراء («failed to forward action response»)، فتُعاد تحميل الصفحة ويضيع الحوار.
  - `activateWithoutNextRefresh` يعطّل خطّافي `window.__unstable__onBeforeSetActive/onAfterSetActive` أثناء التفعيل وإنهاء الجلسة فقط، ثم يعيدهما في `finally`.
- **حساب الجوال وحده** (بلا بريد في Clerk):
  - جدول `users` يشترط بريدًا، فيأخذ الحساب معرّفًا داخليًا ثابتًا: `u-<sha256(clerkId)[:32]>@phone.hakeemai.invalid` (`lib/modules/auth/clerk-local-email.ts`).
  - نطاق `.invalid` لا يُسلَّم إليه بريد أبدًا، والمعرّف لا يحمل رقم الجوال (PDPL).
  - لا تُرسل إليه رسالة ترحيب، واسمه الافتراضي «مستخدم حكيم».
- **البيانات الشخصية:** لا يُحفظ رقم الجوال ولا البريد في أي كوكي أو رابط أو سجل.

## الوسائل الأخرى في الكود

- **Google:**
  - `/api/auth/google` هو OAuth أصلي إن وُجدت `GOOGLE_CLIENT_ID/SECRET`، وإلا Clerk.
  - في الصندوق يُفتح في نافذة منبثقة (`?popup=1`). إن حُجبت النافذة، فانتقال كامل إلى الرابط نفسه.
  - لا يمرّ بـ `claim-clerk-session`.
- **Microsoft / Apple:** `/api/auth/oauth/start?provider=microsoft|apple` ← بوابة حسابات Clerk (`/sign-in/sso?strategy=oauth_…`) ← `/auth/continue` لتثبيت الجلسة.
- **البوابة المستضافة احتياطًا:**
  - `/api/auth/oauth/start?provider=email|phone&portal=1`، رابط «المتابعة عبر صفحة الدخول البديلة» عند تعذّر تحميل Clerk.
  - وتُستعمل كذلك عند `AUTH_IDENTIFIER_FORM_ENABLED=0`.
- **التحقق الثنائي وحساب المكتب:** قائمة الحساب ← `/api/auth/account-portal?section=security|organization` ← صفحة `/user` أو `/organization` في البوابة، ثم العودة إلى لوحة التحكم.
- الوسيلة التي لم يُضبط علمها لا تظهر، ورابطها المباشر يعود إلى `/sign-in`.

نطاق البوابة يُستنتج من المفتاح العلني (`xxx.accounts.dev` في التطوير، و`accounts.<نطاقك>` في الإنتاج). إن اختلف فاضبط `NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_URL`.

## بعد الدخول وعند الخروج

- `middleware.ts`: من يحمل `hakeem_session` ويفتح `/` يُحال (307) إلى `/dashboard`.
  - `/?view=home` يعرض الواجهة التعريفية.
  - بعد الخروج بثلاثين ثانية (`hakeem_logged_out`) لا إحالة.
  - مفتاح الطوارئ: `HOME_SIGNED_IN_REDIRECT_ENABLED=0`.
- حارس المسارات المحمية (`/dashboard` و`/admin` و`/onboarding`): `hakeem_session` أولًا، ثم جلسة Clerk.
  - لا جلسة ← `/sign-in?next=…`، ولذلك ظهرت صفحة الدخول بعد كل تثبيت فاشل.

## التشخيص

كل رفض لـ `claim-clerk-session` يُسجَّل في Vercel بسطر واحد:

```json
{"event":"claim_clerk_session_failed","stage":"verify","reason":"…","code":"…","status":401,
 "keysTried":2,"secretOverridden":true,"secretKind":"sk_live_","publishableKind":"pk_live_"}
```

| الحقل | المعنى |
|---|---|
| `stage` | `verify` (التحقق من الرمز) · `no_sub` · `get_user` (جلب المستخدم من Clerk) · `establish` (إنشاء الصف والجلسة) |
| `reason` / `code` | سبب Clerk أو الخطأ (مثل `jwk-kid-mismatch` و`secret-key-invalid` و`token-expired`) |
| `secretOverridden` | هل استبدلت الإعدادات المُدارة مفتاح Vercel؟ |
| `secretKind` / `publishableKind` | بادئة المفتاح فقط، ويجب أن يتطابق النوعان (`sk_live_` مع `pk_live_`) |

السجل لا يحمل رمز الجلسة ولا البريد ولا الجوال ولا أي معرّف.

**فحص سريع بعد تغيير المفاتيح:**
1. أرسل رمزًا غير صالح إلى `POST /api/auth/claim-clerk-session` من الأصل نفسه.
2. تأكد أن السطر يحمل `sk_live_` و`pk_live_`.
3. الرفض هنا متوقّع لأن الرمز مزيّف، والمهم نوعا المفتاحين.

للاطلاع على العدّ في Vercel Logs: ابحث عن `claim-clerk-session` وجمّع حسب `statusCode`.

## مفاتيح الطوارئ

| المفتاح | الأثر عند `0` |
|---|---|
| `HOME_INLINE_AUTH_ENABLED` | يعيد روابط الدخول وصفحات `/sign-in` و`/sign-up` و`/auth/identifier` السابقة كما هي، ويوقف الإحالات إلى الصفحة الواحدة |
| `AUTH_IDENTIFIER_FORM_ENABLED` | الجوال/البريد عبر بوابة Clerk المستضافة بدل النموذج العربي |
| `HOME_SIGNED_IN_REDIRECT_ENABLED` | يوقف إحالة `/` إلى `/dashboard` لصاحب الجلسة |
| `HOME_LIVE_DEMO_ENABLED` | (معطّل افتراضيًا) العرض الحي في الرئيسية — يُفعَّل بعد مراجعة نصه |

## إعدادات موصى بها في Clerk

- **Account Portal**: فعّله، واضبط الشعار والألوان والعربية ليطابق هوية حكيم.
- **Account linking**: اربط الحسابات بالبريد الموثّق حتى يصل المستخدم للحساب نفسه عبر Google أو البريد.
- **Attack protection**: فعّل حماية الروبوتات وقفل الحساب بعد محاولات فاشلة.
- **Webhook**:
  - العنوان `https://<domain>/api/webhooks/clerk` بأحداث `user.*`، والسر في `CLERK_WEBHOOK_SECRET`.
  - حساب الجوال وحده يتخطّاه الـ webhook (`skipped: no_email`)، ويُنشأ صفه عند أول دخول.
- **Test mode**: معطّل في Production، فلا تُقبل الأرقام والعناوين التجريبية (`424242`) هناك. الاختبار الآلي الكامل يكون على نسخة Development.

## قائمة اختبار قبل الإطلاق

1. **نوعا المفتاحين متطابقان:** افحص السجل التشخيصي كما في قسم «التشخيص».
2. **`/sign-in` على iPhone Safari وAndroid Chrome وسطح المكتب:**
   - التبويبان ظاهران، والجوال افتراضي.
   - لا تمرير أفقي، ولا Clerk قبل التفاعل.
3. **الجوال:** رقم ← رمز يصل ← «جارٍ إكمال الدخول…» ← «تم التحقق» ← `/dashboard`، دون المرور بصفحة الدخول.
   - ثم خروج ودخول ثانٍ: يُطلب رمز جديد.
4. **البريد:** الخطوات نفسها.
5. **Google:** من الرئيسية ومن `/sign-in`، والعودة إلى الوجهة الداخلية.
6. **الروابط القديمة:** `/sign-up` و`/register` و`/login` و`/auth/identifier` تعطي 307 إلى `/sign-in`، مع حفظ `next`.
7. **التحقق الثنائي:** تفعيله من قائمة الحساب، ثم الخروج والدخول بالرمز.
8. **المكاتب:** إنشاء مكتب، ودعوة عضو ثانٍ، وقبول الدعوة.
9. **الاختبارات:**
   - `npm run test:auth-providers-visibility` و`npx tsx scripts/test-ssr-oauth-start.ts`.
   - `npx tsx scripts/test-clerk-phone-only.ts` و`scripts/test-single-signin-page.ts` و`scripts/test-home-inline-auth.ts` و`scripts/test-identifier-flow.ts`.

## مسائل معروفة ومفتوحة

- **المفتاح السري في الإنتاج من نسخة Development** (`sk_test_`، حتى 26/09/2026). يُستبدل بـ `sk_live_` من نسخة Production في Vercel و`/admin/settings`. **هذا شرط لعمل الدخول بالجوال والبريد.**
- **حساب جوال يضيف بريدًا لاحقًا في Clerk:** يُنشأ له صف محلي جديد بالبريد الحقيقي بدل صفه القديم، ودمج الصفين لم يُنفَّذ بعد.
- **`www.hakeemai.net`:** التحويل مضاف في Vercel، وينقصه سجل CNAME في Cloudflare: `www` ← `cname.vercel-dns.com` (DNS only).
- **Microsoft وApple:** مخفيان حتى تُضاف مفاتيحهما في Clerk Production.

## سجل التغييرات

| PR | التغيير |
|---|---|
| ‎#665–#669 | Clerk: Google وMicrosoft وApple، والبريد برمز، والجوال OTP، والتحقق الثنائي، والمكاتب |
| ‎#670 | الدخول من الرئيسية داخل الصفحة (`HOME_INLINE_AUTH_ENABLED`) |
| ‎#672 | تسليم مساحة العمل: إحالة `/` لصاحب الجلسة، والشاشات المعتمدة ١–٨، والعرض الحي خلف علم (تقرير: [`workspace-handoff-report.md`](./workspace-handoff-report.md)) |
| ‎#673 | تبويبا «رقم الجوال \| البريد الإلكتروني» (المقترح أ) |
| ‎#674 | قبول حساب الجوال وحده، ولا «تم التحقق» قبل التأكيد، ورمز في كل محاولة |
| ‎#675 | صفحة دخول واحدة `/sign-in`، والمداخل الأخرى تُحال إليها |
| ‎#676 | سجل تشخيصي لرفض الجلسة، والتحقق بمفتاح Vercel الأصلي، ولا إعادة تحميل وسط الدخول |

مراجع أخرى: [`inline-auth-audit.md`](./inline-auth-audit.md) و[`inline-auth-report.md`](./inline-auth-report.md).
