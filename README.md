# حكيم

حكيم هي المنصة القانونية الموحدة لمكتب أمان للمحاماة والاستشارات القانونية. اسم المنتج النهائي هو **حكيم**؛ أما أمان فهي الجهة المالكة أو المشغلة.

## ما تم فهمه من الوثيقة المعتمدة

- حكيم منتج واحد موحد يجمع الاستشارات القانونية، المحاكاة القضائية، التدريب والتعلم، المكتبة النظامية، المرفقات والبينات، المستخدمين والصلاحيات، الإدارة والتقارير، والحوكمة والتدقيق.
- النمط المعماري المعتمد هو Modular Monolith: منصة واحدة بوحدات مستقلة منطقيًا فوق نواة مشتركة.
- قاعدة البيانات PostgreSQL واحدة تخدم جميع الوحدات.
- المكتبة النظامية هي مصدر الحقيقة الوحيد، وتشمل مبدئيًا 9 أنظمة سعودية و1,981 مادة.
- كل استدعاءات الذكاء الاصطناعي تمر عبر الخادم فقط، ولا تحفظ مفاتيح API في المتصفح أو localStorage.
- الأدوار المعتمدة: مدير النظام، محامٍ، مدرب / مشرف، متدرب.
- مخرجات الذكاء الاصطناعي مساعدة وتعليمية، وليست رأيًا قانونيًا نهائيًا أو حكمًا فعليًا.
- المنصة ستعالج بيانات قضايا حقيقية، لذلك يلزم مراعاة الخصوصية والامتثال وتسجيل العمليات في سجل تدقيق.

## المتطلبات الوظيفية

- إدارة مستخدمين وأدوار وصلاحيات RBAC.
- مكتبة نظامية قابلة للبحث والاستدعاء السياقي.
- إدارة قضايا ومرفقات وبينات مع استخراج نصوص لاحقًا.
- إنشاء استشارات قانونية مساعدة مبنية على RAG من المكتبة النظامية.
- تشغيل محاكاة قضائية بمراحل: تقييد الدعوى، ضبط الجلسة، المرافعة، الصلح، قفل باب المرافعة، الحكم التدريبي، الاعتراض.
- تدريب وتعلم عبر تمارين واختبارات ونقاط وشارات وتتبع تقدم.
- لوحة إدارة وتقارير وسجل تدقيق.
- بوابة ذكاء خلفية موحدة مع تجريد المزود وحراس جودة.

## المتطلبات الفنية

- Next.js + React + TypeScript.
- Tailwind CSS وواجهة عربية RTL.
- PostgreSQL واحد، مع pgvector جاهز للمرحلة الثانية.
- Prisma ORM.
- AI Gateway server-side فقط.
- جداول أساسية للوحدات والمنطق المشترك.
- Seed للمكتبة النظامية من `data/legal_articles_export.json`.

## المتطلبات غير الوظيفية

- الخصوصية والامتثال لنظام حماية البيانات الشخصية PDPL قبل التشغيل الفعلي.
- عدم كشف مفاتيح الذكاء في الواجهة.
- سجل تدقيق دائم للطلبات والمخرجات وقرارات الحراس.
- قابلية صيانة عبر وحدات منطقية داخل Monolith.
- قابلية توسع مستقبلية نحو SaaS وتكامل Microsoft 365 / SharePoint.

## هيكل المشروع

```text
app/                    واجهات Next.js ومسارات API
components/             مكونات واجهة قابلة لإعادة الاستخدام
lib/prisma.ts           عميل قاعدة البيانات
lib/modules/auth        RBAC
lib/modules/library     خدمات المكتبة النظامية
lib/modules/ai          بوابة الذكاء والحراس
lib/modules/audit       سجل التدقيق وقرارات الحراس
prisma/schema.prisma    مخطط PostgreSQL الموحد
scripts/seed-legal-library.ts
data/legal_articles_export.json
```

## التشغيل المحلي

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

يفتح التطبيق على:

```text
http://localhost:3000
```

## ملاحظات حوكمة

- لا تستخدم أي متغيرات من نوع `NEXT_PUBLIC_*` لمفاتيح الذكاء.
- لا يسمح حارس الاستشهادات الأولي بتوليد استشارة دون مواد مسترجعة من `legal_articles`.
- كل بحث في المكتبة وكل توليد استشارة يسجل في `AuditEvent`.
- كل قرار حارس يسجل في `GuardrailDecision`.

## النشر الخارجي باستخدام Vercel + Supabase

هذا المسار مخصص لتجربة منصة **حكيم** خارجيًا دون تشغيل Docker أو PostgreSQL على الجهاز المحلي.

### 1. إنشاء مشروع Supabase

1. ادخل إلى Supabase وأنشئ مشروعًا جديدًا.
2. اختر كلمة مرور قوية لقاعدة البيانات واحفظها في مكان آمن.
3. انتظر حتى يكتمل إنشاء المشروع وتصبح قاعدة PostgreSQL جاهزة.

### 2. الحصول على connection string

من لوحة Supabase:

```text
Project Settings > Database > Connection string
```

استخدم اتصال PostgreSQL صالحًا لـ Prisma. أثناء تنفيذ أوامر `prisma db push` يفضل استخدام الاتصال المباشر أو session pooler. مثال الصيغة:

```text
postgresql://postgres.USER:PASSWORD@HOST:PORT/postgres?schema=public
```

ولتشغيل التطبيق على Vercel يمكن استخدام connection string الخاصة بـ Supabase pooler إذا كانت مضبوطة لـ Prisma، مثل:

```text
postgresql://postgres.USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1&schema=public
```

لا تضع connection string في الكود. ضعها فقط في متغير البيئة `DATABASE_URL`.

### 3. إعداد Vercel Environment Variables

في Vercel، افتح المشروع ثم:

```text
Settings > Environment Variables
```

أضف المتغيرات التالية:

```text
DATABASE_URL=Supabase PostgreSQL connection string
NEXTAUTH_SECRET=قيمة عشوائية طويلة
NEXTAUTH_URL=https://your-project.vercel.app
AI_PROVIDER=offline
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

مفاتيح الذكاء اختيارية في الـ MVP الحالي. عند إضافتها يجب أن تبقى server-only، ولا تستخدم أي اسم يبدأ بـ `NEXT_PUBLIC_` لمفاتيح الذكاء.

### 4. نشر التطبيق على Vercel

1. ارفع الكود إلى GitHub.
2. أنشئ مشروعًا جديدًا في Vercel واختر مستودع GitHub.
3. Framework Preset: `Next.js`.
4. Build Command الافتراضي يكفي لأنه يشغل:

```bash
npm run build
```

وهذا السكربت يشغل `prisma generate` ثم `next build`.

مهم: لا يتم تشغيل `db:seed` داخل build حتى لا يعاد الاستيراد تلقائيًا مع كل نشر.

### 5. تشغيل أوامر قاعدة البيانات الخارجية

بعد إضافة `DATABASE_URL`، شغل الأوامر من بيئة سحابية آمنة مثل GitHub Codespaces، أو جهاز موثوق، أو Vercel/CI shell يدوي، وليس داخل build المتكرر:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run qa:db
npm run qa:gate
```

`db:seed` آمن للتكرار لأنه يستخدم `upsert` للأدوار والصلاحيات والأنظمة والمواد، فلا يكرر البيانات عند إعادة التشغيل.

### 6. التحقق من استيراد 1,981 مادة

بعد `npm run db:seed` شغل:

```bash
npm run qa:db
```

يجب أن تظهر القيم الأساسية:

```text
roles: 4
permissions: 11
legal_systems: 9
legal_articles: 1981
```

ثم شغل:

```bash
npm run qa:gate
```

يتحقق هذا الفحص من البحث في المكتبة، الاستشارة التجريبية، الاستشهادات، جلسة المحاكاة، الحكم التدريبي، وسجلات التدقيق.

### 7. GitHub Actions

يوجد workflow باسم **Deploy Readiness Check** يعمل عند push أو pull request وينفذ:

```text
npm ci
npm run db:generate
npm run typecheck
npm run build
npm run qa:security
```

هذا الفحص لا يشغل `db:seed` ولا يكتب في قاعدة البيانات. إذا أردت تشغيل فحوصات قاعدة Supabase من GitHub Actions لاحقًا، أضف `DATABASE_URL` كـ GitHub Secret ثم أضف job منفصلًا ومقصودًا لقاعدة البيانات.

### 8. مشاكل متوقعة

- فشل `prisma db push`: غالبًا connection string غير صحيح، أو كلمة المرور تحتاج URL encoding، أو نوع الاتصال غير مناسب لأوامر Prisma.
- فشل `db:seed`: تأكد أن `db:push` نجح وأن الجداول موجودة.
- عدد المواد أقل من 1,981: أعد تشغيل `npm run db:seed` ثم `npm run qa:db`.
- صفحة المكتبة لا تعرض مواد: تأكد من وجود `DATABASE_URL` في Vercel ومن تشغيل seed.
- مفاتيح الذكاء: لا تضفها كـ `NEXT_PUBLIC_*` أبدًا؛ كل استدعاءات الذكاء تمر عبر `app/api`.
