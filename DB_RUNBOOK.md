# DB_RUNBOOK — خطوات قاعدة البيانات اليدوية الآمنة (حكيم)

> هذا الملف **توثيق فقط**. لا ينفّذ شيئًا. لا يُطبَّق على الإنتاج إلا بموافقة صريحة من
> مالك المشروع، ضمن نافذة صيانة، بعد أخذ Snapshot/Branch من Neon.
>
> القواعد: **ممنوع** `prisma db push`. **ممنوع** أي `UPDATE/DELETE/ALTER` على الإنتاج
> بلا موافقة. لا تكشف `DATABASE_URL` أو أي سرّ في السجلّات أو الـPR.

نتائج التشخيص أدناه أُخذت **قراءةً فقط** من Neon بتاريخ 2026-09-25 (بلا أي كتابة).

---

## DB-001 — قيمة enum «SUPER_ADMIN» غير موجودة في Neon

### الدليل (قراءة فقط)
```sql
SELECT unnest(enum_range(NULL::"UserRole")) AS role;
-- الناتج الفعلي على Neon: LAWYER, SYSTEM_ADMIN, TRAINEE, TRAINER
-- ناقص: SUPER_ADMIN (وأيضًا JUDGE المعرّفان في prisma/schema.prisma)

SELECT 'SUPER_ADMIN' = ANY(enum_range(NULL::"UserRole")::text[]);  -- ‎f‎ (غير موجودة)

SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC;
-- سجلّ واحد فقط: 20260604120000_add_judicial_cases
-- ⇒ الترحيلات ليست آلية الإدارة؛ ملف الهجرة 20260723160000_add_super_admin_role لم يُطبَّق.
```
سبب أخطاء الإنتاج `invalid input value for enum UserRole: SUPER_ADMIN (22P02)`: الكود يكتب
الدور بينما القيمة غير موجودة في enum الإنتاج.

### الإصلاح البرمجي المُنفَّذ في هذا الـPR (يقلّل الضرر فورًا)
- `instrumentation.ts` لم يعد يزوّد المالك ولا يكتب الدور عند الإقلاع (RUN-001/AUTH-001).
- `ensurePlatformOwner` لم يعد يكتب الدور لحساب قائم إلا عند طلب صريح `allowRoleWrite`.
  ⇒ يتوقّف تكرار خطأ 22P02 من مسار الإقلاع دون لمس القاعدة.

### الخطوات اليدوية (بموافقة صريحة فقط)
1. خذ **Snapshot** أو أنشئ **Neon branch** للتراجع.
2. طبّق إضافة القيم للـenum (خارج معاملة — `ALTER TYPE ... ADD VALUE` لا يعمل داخل transaction):
   ```sql
   ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
   ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JUDGE';
   ```
3. تحقّق:
   ```sql
   SELECT unnest(enum_range(NULL::"UserRole")) AS role;  -- يجب أن تظهر SUPER_ADMIN و JUDGE
   ```
4. زوّد دور المالك يدويًّا (لا يمسّ كلمة مرور):
   ```bash
   npm run owner:ensure -- --apply --allow-role-write
   ```
5. تحقّق بعد التطبيق:
   - تسجيل الدخول عبر Clerk يعمل كالمعتاد.
   - **لم تتغيّر كلمة مرور أي مستخدم** بسبب هذه الخطوات.
   - لا يظهر خطأ 22P02 في سجلّ Vercel خلال 24 ساعة.

### التراجع (Rollback)
- إزالة قيمة من enum في PostgreSQL **غير مدعومة مباشرة**؛ خطة التراجع = استعادة
  الـSnapshot/Branch الذي أُخذ في الخطوة 1. القيمة المضافة غير ضارّة إن بقيت غير مستخدمة.

---

## DATA-001 — سجلّات `articleNumber <= 0` (الديباجات)

### الدليل (قراءة فقط)
```sql
SELECT count(*) FROM legal_articles WHERE "articleNumber" <= 0;   -- 489
SELECT "lawName","articleNumber",title FROM legal_articles WHERE "articleNumber" <= 0 LIMIT 10;
-- كلّها articleNumber = 0 وعنوانها «الديباجة» (مقدّمات الأنظمة).
```
**استنتاج مهم:** هذه ليست بيانات فاسدة — إنّها **ديباجات** الأنظمة مخزّنة كـ `articleNumber = 0`.
العطل الظاهر (رابط «المادة ٠» ثم صفحة not-found) سببه أن العرض/التنقّل كان يُدرجها كأنها مادة مرقّمة.

### الإصلاح البرمجي المُنفَّذ في هذا الـPR (بلا أي تعديل بيانات)
- `app/legal/[slug]/page.tsx`: استعلام القائمة يستبعد `articleNumber <= 0`.
- `app/legal/[slug]/[article]/page.tsx`: رابط «المادة السابقة» يشترط `> 0` (لا رابط إلى /0).

### قرار البيانات (يحتاج موافقة مالك البيانات — لا تُنفَّذ الآن)
- **لا تُحذف** الديباجات. الخيارات المقترحة للمراجعة:
  1. إبقاؤها كما هي (0 = ديباجة) مع الحارس العرضي الحالي — **الأدنى خطرًا**.
  2. نقلها إلى حقل/علاقة «preamble» مخصّص عبر ترحيل مدروس، ثم إضافة `CHECK ("articleNumber" > 0)`:
     ```sql
     -- بعد نقل الديباجات وتأكيد عدم وجود مخالفات:
     -- ALTER TABLE legal_articles ADD CONSTRAINT article_number_positive CHECK ("articleNumber" > 0);
     ```
- تحقّق قبل أي قيد:
  ```sql
  SELECT count(*) FROM legal_articles WHERE "articleNumber" <= 0;  -- يجب أن يوافق المتوقّع
  ```

---

## RUN-001 — نقل DDL خارج الإقلاع

- أُزيل كل DDL/تجهيز المخطط من `instrumentation.ts` (صار تحميل إعدادات قراءة فقط).
- بديلها أمر إداري صريح يُشغَّل ضمن صيانة مراجَعة:
  ```bash
  npm run db:ensure-schema            # معاينة (لا تنفيذ)
  npm run db:ensure-schema -- --apply # تنفيذ DDL idempotent (بموافقة + نسخة احتياطية)
  ```
- `app/api/health` صار يقرأ جاهزية المخطط فقط (لا ينفّذ DDL).

---

## ملاحظات أمان دائمة
- لا `prisma db push` على الإنتاج إطلاقًا.
- أي كتابة على Neon تتطلّب: Snapshot/Branch + موافقة صريحة + نافذة صيانة + تحقّق بعدها.
- `npm run qa:security` صار يكشف كلمات المرور/الأسرار الحرفية (QA-001) — أبقِه بوابة CI.
