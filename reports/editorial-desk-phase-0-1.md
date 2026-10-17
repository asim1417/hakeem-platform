# تقرير مكتب التحرير التشريعي — المرحلة صفر

> الفرع: `aman/legal-editorial-desk` من `main` عند `e3cd34b`.
> المنفّذ: القسم التقني لشركة أمان (قواعد البيانات، الشامل، الواجهات)، والمراجعة المستقلة: الجودة والأمن بوكيل منفصل باستنساخ جديد.
> اعتماد المالك: «نعم وخلنا نجرب» (17/10/2026)، على تشغيل المرحلة صفر في فرع منفصل بلا دمج ولا كتابة على قاعدة الإنتاج.
> نطاق هذا التشغيل: **المرحلة صفر وحدها**. المرحلة الأولى (L-01…L-06، S-01…S-03، D-01) لم تبدأ.

## ١. ما أُنجز

| الرمز | المنجز | الملفات | معيار القبول | تحقق؟ |
| --- | --- | --- | --- | --- |
| نموذج البيانات | خمسة جداول جديدة بترحيل إضافي فقط | `prisma/migrations/20261017090000_editorial_desk_phase0/migration.sql`، نماذج في `prisma/schema.prisma` | لا ALTER ولا DROP على جدول قائم؛ يُطبَّق مرتين بلا خطأ | نعم (محليًّا على Postgres 17) |
| الصلاحيات | خمس صلاحيات جديدة، لـ SUPER_ADMIN وحده افتراضيًّا | `lib/modules/auth/role-permissions.ts`، `role-admin.ts`، `lib/modules/editorial/access.ts`، `guard.ts` | SYSTEM_ADMIN لا يملك شيئًا بلا منح صريح (الحارس لا يستعمل `canUser`) | نعم |
| W-01 | طابور موحد بثلاثة أقسام: تعديلات الأنظمة، المبادئ، دفعات المحررين؛ مرشحات واختصارات لوحة مفاتيح | `app/admin/legal/queue/page.tsx`، `components/editorial/*` | يعمل على 390 بكسل، وأهداف اللمس 44 بكسل | كودًا نعم؛ بصريًّا لم يُفحص على معاينة |
| W-02 | فحوص: السند، والحقول، والتعارض، والبصمة | `lib/modules/editorial/service.ts` (`submitChangeSet`) | الفاشل لا يصل الطابور | نعم |
| W-03 | قرار بمعتمِد غير المُعِدّ، ونشر ذري | `decideChangeSet`، `publishChangeSet` | دفعة فيها تعارض لا يُنشر منها شيء | نعم (T0-3) |
| W-04 | سجل تدقيق لا يُعدَّل | جدول `audit_event` بمشغّلات ترفض UPDATE وDELETE وTRUNCATE؛ `app/admin/legal/audit` | القاعدة ترفض التعديل والحذف | نعم (T0-2) |
| W-05 | تراجع بدفعة معاكسة، وتراجع عاجل للمالك | `revertChangeSet` | لا حذف، ولا سند مخترع | نعم (T0-4) |
| W-07 | اعتماد مقترحات الذكاء الاصطناعي من الموقع | `lib/modules/editorial/intake.ts`، مسارات `app/api/admin/legal/intake/**` | القرار صف جديد في `uqn_fix.amendment_review`، ولا يمس نص أي مادة | نعم (T0-6…T0-9) |
| D-02، D-03 | فهرسان جزئيان فريدان: قفل الهدف، وعدم تكرار المقترح | ملف الترحيل | نقرتان متزامنتان = قرار واحد | نعم |
| D-07 (جزئي) | حساب الوكيل يقترح فقط | `access.ts`، `guard.ts` | أي اعتماد أو نشر منه 403 ومسجّل | نعم |
| الفعل التجريبي | `set_work_status` بسند إلزامي | `app/admin/legal/new` | لا حالة بلا سند | نعم |
| بوابة الكتابة | كل كتابة خلف `EDITORIAL_DESK_WRITE=1` | `write-gate.ts` | غيابه = «اللوحة للقراءة فقط» | نعم (T0-5 على المسارات السبعة) |
| حارس السلامة | تُقفل الكتابة إن غابت الفهارس أو المشغّلات أو المفاتيح الأجنبية | `integrity.ts` | حذف فهرس القفل يقفل الكتابة فورًا | نعم |

## ٢. نتائج الاختبارات

- `npm run test:editorial-desk` على قاعدة Postgres 17 محلية فارغة: **122 ناجحًا، 0 فاشلًا**. وبلا قاعدة (الجزء النقي): 23 من 23.
- T0-1 إلى T0-9: ناجحة كلها.
- `npm run typecheck`: نجح. `next lint` على الملفات الجديدة والمعدلة: صفر تحذير.
- `test:verified-display` و`test:effective-text` و`qa:security` و`qa:citations`: نجحت.
- `test:citation-guard`: يفشل في 4 حالات، **ويفشل بالعدد نفسه على `main` قبل هذا الفرع**؛ ليس من هذا العمل.
- `next build`: نجح محليًّا مع محاكاة خطوط Google لأن الشبكة هنا لا تصلها. أخطاء `prisma://` في السجل سببها غياب محرك Prisma في بيئة الاختبار، لا الكود.
- T1-x: لم تُشغَّل لأنها للمرحلة الأولى.

**المراجعة المستقلة** (وكيل جديد باستنساخ جديد، دورتان): الحكم على `65d25d9` «جاهز بملاحظات» بلا بند حرج أو عالٍ. البنود المتوسطة الأربعة أُصلحت، وأُصلح بعدها ما بقي من بند القفل وحارس السلامة في `93f376c`.

**أعداد الإنتاج الحالية (قراءة فقط، 17/10/2026):**

| المصدر | العدد |
| --- | --- |
| عمليات تعديل بلا قرار | 395 |
| منها تقبل الاعتماد الجماعي (مطابقة بالقاعدة، حرفية، بلا مخاطر) | 166 |
| آثار لم تُستخرج آليًّا | 176 |
| مبادئ تنتظر المراجعة | 3,433 |
| روابط أحكام بمواد تنتظر المراجعة | 29,705 |
| علاقات آلية `RELATED_TO` | 64,801 |
| جداول المكتب في الإنتاج | غير موجودة (الترحيل لم يُطبَّق) |

## ٣. ما لم يُنجز ولماذا

- **فرع Neon التجريبي لم يُنشأ.** النسخة من الإنتاج تحمل حسابات المستخدمين (ف٢٣ «ع»)، والخطة مدفوعة (ف١٤). البديل المجاني: Postgres 17 محلي بمخطط الإنتاج للجداول المعنية وبيانات اصطناعية.
- **مسار Prisma لم يُشغَّل طرفًا لطرف**؛ محرك Prisma لا يُنزَّل في هذه البيئة. الخدمة تمر بمنفذ SQL ضيق (`$queryRawUnsafe` بمعاملات)، واختُبرت عبر `pg`، وأُضيف اختبار لشكل أخطاء Prisma.
- **الفحص البصري على معاينة حية لم يتم.** المعاينة محمية بـ SSO، ولا جداول للمكتب في قاعدتها؛ فستعرض الصفحات رسالة «غير مطبّق بعد» حتى يُطبَّق الترحيل.
- **التحقق الثنائي غير مفروض.** `AUTH_MFA_ENABLED` يُظهر إعداد Clerk فقط، ودخول المالك الأساسي بـ Google عبر `hakeem_session` لا يمر بعامل ثانٍ. الخيار المقترح: اشتراط تحقق حديث بعامل ثانٍ من Clerk لأفعال الاعتماد والنشر، ويحتاج قرارًا قبل بنائه.
- **مزامنة الفهارس (S-01) لا تُنفَّذ بعد**؛ النشر يسجّل صف `index_sync` فقط، والتنفيذ في المرحلة الأولى.
- **تمرير التصميم** (`aman-ux` ثم `aman-ui-designer`) لم يتم قبل الكود؛ الواجهة بهوية حكيم القائمة، وتحتاج مراجعة بصرية.
- **فحص الزر القائم للمبدأ** اختُبر بقراءة الكود لا بتشغيله.

## ٤. قرارات تنتظر المالك

1. **فصل بيئة Preview عن قاعدة الإنتاج** قبل أي ضبط لـ `EDITORIAL_DESK_WRITE` (ف١٣/ف٨ مع `aman-devops`).
2. **تطبيق الترحيل على الإنتاج** (ف١٠ «ع»): إضافي فقط، بلا أثر على الجداول القائمة، وتراجعه مكتوب في رأس الملف.
3. **ضبط `EDITORIAL_DESK_WRITE=1`** في الإنتاج فقط بعد البندين ١ و٢.
4. **منح الصلاحيات** من صفحة الأدوار: من المعتمِد؟ ومن المحرر؟ المنح على مستوى الدور، ومنح فرد بعينه يحتاج جدول منح فردي في مرحلة لاحقة.
5. **التحقق الثنائي** للاعتماد والنشر (الخيار في القسم ٣).
6. **مهمة «التطوير الأسبوعي لموقع حكيم»** مفوّضة بالدمج والنشر؛ يُقترح إضافة سطر يستثني هذا الفرع (ف٢١). إلى حينه الـ PR مسودة وعنوانه «لا تدمج».
7. **workflows يدوية تشغّل `prisma db push`**: `seed-legal-library.yml` و`seed-knowledge-graph.yml` و`migrate-judgments.yml`. قد تحذف فهرسي القفل والمشغّلات؛ حارس السلامة يقفل الكتابة حينها، ويُقترح على `aman-devops` تحذير أو فحص في تلك الملفات (ف٢٧).

## ٥. التحقق من الحدود

مخرج `git diff --name-only e3cd34b...HEAD`:

```
app/admin/legal/audit/page.tsx
app/admin/legal/new/page.tsx
app/admin/legal/page.tsx
app/admin/legal/queue/page.tsx
app/api/admin/legal/audit/route.ts
app/api/admin/legal/change-sets/[id]/[action]/route.ts
app/api/admin/legal/change-sets/[id]/route.ts
app/api/admin/legal/change-sets/route.ts
app/api/admin/legal/intake/amendments/[opId]/decide/route.ts
app/api/admin/legal/intake/amendments/bulk-approve/route.ts
app/api/admin/legal/intake/amendments/route.ts
app/api/admin/legal/intake/principles/[id]/decide/route.ts
app/api/admin/legal/intake/principles/route.ts
app/api/legal-core/principles/[id]/route.ts
components/AdminUsersManager.tsx
components/admin/AdminNav.tsx
components/editorial/*
lib/modules/auth/role-admin.ts
lib/modules/auth/role-permissions.ts
lib/modules/editorial/*
lib/modules/legal-core/principle-review.ts
package.json            (سكربت test:editorial-desk فقط)
prisma/migrations/20261017090000_editorial_desk_phase0/migration.sql
prisma/schema.prisma    (نماذج جديدة فقط)
reports/editorial-desk-phase-0-1.md
scripts/editorial/fixtures/base-schema.sql
scripts/test-editorial-desk.ts
```

- لا تغيير في `.github/` ولا `vercel.json` ولا أي `migrate-request` ولا أوامر البناء أو التثبيت.
- أمر البناء `prisma generate && next build` لا يطبّق ترحيلًا، ولا workflow يطبّق ملفات الترحيل عند الدفع أو الدمج.
- لا كتابة على قاعدة الإنتاج: كل ما قُرئ منها أعداد ومخطط (قراءة فقط).
- لا قيمة سر في الكود أو التقرير.
- لم تُمس العلاقات الآلية ولا أعمدة الحالة القديمة.

## ٦. المعرّفات

- الفرع: `aman/legal-editorial-desk`.
- آخر SHA: يُذكر في وصف الـ PR.
- فرع Neon تجريبي: لم يُنشأ (القسم ٣).
