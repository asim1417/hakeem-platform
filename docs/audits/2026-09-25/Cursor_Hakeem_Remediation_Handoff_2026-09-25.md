# تسليم إصلاحات حكيم إلى Cursor

انسخ التعليمات التالية إلى Cursor داخل مستودع asim1417/hakeem-platform.

---

أنت مهندس Next.js وPrisma وVercel مسؤول عن إصلاحات مدروسة في منصة حكيم. اقرأ تقرير Hakeem_Site_Error_Audit_2026-09-25.md كاملًا قبل أي تعديل.

هدفك: إعداد Pull Request آمن ومجزأ يصلح الأعطال المؤكدة، مع خطة منفصلة للترحيلات والبيانات. لا تنشر إلى الإنتاج ولا تطبق أي تغيير على Neon من دون موافقة صريحة من مالك المشروع.

## قواعد غير قابلة للتجاوز

1. لا تشغّل prisma db push.
2. لا تشغّل أي UPDATE أو DELETE أو migration على Neon أو Supabase من تلقاء نفسك.
3. لا تطبع أو تضع أسرارًا أو كلمات مرور أو DATABASE_URL داخل المحادثة أو commits أو الاختبارات.
4. لا تعدّل بيانات articleNumber أقل من أو يساوي صفر قبل إظهار نتائج فحص قراءة فقط وأخذ موافقة.
5. لا تنشر Production. ابنِ Preview فقط ثم سلّم الرابط والنتائج.
6. لا تعالج enum SUPER_ADMIN قبل إزالة منطق كلمة مرور المالك الافتراضية وإعادة التعيين عند الإقلاع.
7. استخدم branch باسم cursor/fix-hakeem-audit-20260925 أو اسم مكافئ واضح.

## معطيات مثبتة

- Production deployment: dpl_B1Kp3BZD5kadMBadevfoeXm6uQ1k.
- Production commit: a6910138dc7452c89165ebb2ec7c397cec31adbd.
- /legal/[slug] يتعطل بسبب BASE غير معرف داخل app/legal/[slug]/page.tsx.
- Neon يرفض SUPER_ADMIN في enum، رغم وجوده في Prisma migration.
- /mcp سجّل مهلات 300 ثانية.
- instrumentation.ts ينفذ DDL وتجهيزات مخطط عند الإقلاع.
- صفحة المادة 1 تعرض رابطًا للمادة 0، ما يثبت سجلًا غير صالح في بيانات النظام أو مسار الاستعلام.
- منطق owner emergency يحتوي fallback credential مضمّن ويعيد كتابة passwordHash للمستخدم الموجود.

## ترتيب العمل

### المرحلة A — إصلاحات مصدر لا تمس قاعدة البيانات

1. أصلح BASE في app/legal/[slug]/page.tsx باستخدام getSiteUrl.
2. أزل أي كلمة مرور افتراضية مضمّنة من ensure-owner وowner-login.
3. لا تسمح لـ instrumentation بإعادة تعيين passwordHash لمستخدم موجود.
4. قرر أحد مسارين، مع توثيق القرار:
   - Clerk هو المصادقة الوحيدة: أزل مسار كلمة المرور الطارئ والـ bootstrap password.
   - الطوارئ مطلوبة: صممها بحيث تكون معطلة افتراضيًا، لا تقبل secret من المصدر، تستعمل secret مخزنًا في البيئة فقط، وتملك rate limit، ولا تغير كلمة مرور موجودة عند الإقلاع.
5. انقل DDL من instrumentation إلى migrations أو command إداري صريح. أبق instrumentation قراءة أو تحميل إعدادات فقط.
6. أضف حارس عرض مؤقت يستبعد articleNumber أقل من أو يساوي صفر من روابط التنقل، من دون تعديل البيانات.
7. انقل outputFileTracingIncludes إلى الموضع المتوافق مع نسخة Next المثبتة، ثم تحقق فعليًا من trace للملف BM25.
8. أزل قبول مفتاح MCP من query string واجعل المصادقة Header-only.

### المرحلة B — تشخيص قاعدة البيانات، قراءة فقط

لا تنفذ هذه المرحلة إلا إن توفر اتصال مقيد بالقراءة أو Neon branch آمن.

~~~sql
SELECT unnest(enum_range(NULL::"UserRole")) AS role;

SELECT id, "legalSystemId", "lawName", "articleNumber", title, "createdAt", "updatedAt"
FROM legal_articles
WHERE "articleNumber" <= 0
ORDER BY "lawName", "articleNumber";

SELECT migration_name, finished_at, logs
FROM "_prisma_migrations"
ORDER BY finished_at DESC;
~~~

سلّم النتائج أولًا. اقترح معالجة البيانات، ولا تنفذها قبل موافقة. أنشئ Runbook مستقلًا لتطبيق هجرة SUPER_ADMIN مع:

- Snapshot أو branch من Neon.
- فحص migrate status.
- نافذة صيانة ومراقبة.
- rollback أو خطة تعاف.
- تحقق بعد التطبيق من enum، ومن تسجيل الدخول عبر Clerk، ومن عدم تغير كلمة مرور أي حساب.

### المرحلة C — MCP والقياس

1. أضف correlation id وtimings للأقسام: auth، parse، Prisma، hybrid search، rulings، serialization.
2. أضف timeout محدودًا واستجابة خطأ واضحة قبل حد Vercel.
3. افحص كل أداة MCP مرتفعة الكلفة، خصوصًا search_rulings وenumerate_rulings.
4. أضف اختبارًا لطريق سريع، وطلب كبير يعود بفشل مضبوط، بدل Timeout بعد 300 ثانية.

### المرحلة D — الأحكام والمراقبة

1. لا تفتح لوحة الأحكام الإدارية للعامة.
2. اقترح واجهة عامة منفصلة للأحكام المرتبطة بالمواد إن كان قرار المنتج هو عرضها.
3. أضف judicialCase وlegal_article_case_links إلى readiness الإداري دون كشف تفاصيل للأفراد.

## اختبارات إلزامية قبل Pull Request

استخدم إصدار Node LTS مثبتًا في engines ويفضل .nvmrc. شغّل:

~~~bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm run build
~~~

وأضف أو حدّث اختبارات تثبت ما يلي:

- صفحة /legal/[slug] لا ترمي BASE is not defined.
- JSON-LD للرابط القانوني صحيح.
- المادة 1 لا تعرض رابطًا إلى /0.
- لا يوجد fallback credential في المصدر.
- لا يعيد instrumentation تعيين passwordHash لحساب قائم.
- endpoint الطوارئ، إن بقي، معطل افتراضيًا ومحمي.
- MCP يرجع نجاحًا أو فشلًا مضبوطًا قبل 20 ثانية في سيناريو الاختبار.
- health/readiness الإداري يبيّن مؤشرات الأحكام.

## المطلوب في تسليمك

1. ملخص المشكلة والسبب الجذري لكل تغيير.
2. قائمة الملفات المعدلة.
3. نتائج الأوامر والاختبارات كاملة، مع ذكر أي فشل أو تحذير.
4. رابط Preview فقط.
5. ملف DB_RUNBOOK.md، لا ينفذ شيئًا، يشرح خطوات Neon اليدوية الآمنة.
6. قائمة بالأمور التي ما زالت تحتاج موافقة مالك المشروع.

لا تذكر أي secret في التسليم. لا تدمج ولا تنشر إلى الإنتاج دون موافقة صريحة.

---

هذه الحزمة تقصد أن يستخدم Cursor التقرير كمصدر حقائق، لا أن يخمّن حالة Neon أو متغيرات Vercel.
