# توافق Prisma مع PostgreSQL — HKM-031

**الأداة:** `npx prisma migrate diff --from-url <إنتاج> --to-schema-datamodel prisma/schema.prisma --script` في 2026-10-18 نحو 13:02 UTC. الاتجاه يعني: SQL الذي يحوّل الإنتاج ليطابق مخطط Prisma. **لم يُنفَّذ.** الملف الخام بقي خارج المستودع لأنه يحوي أوامر DROP.

**المخطط المقارن:** 71 نموذجًا و15 enum في عميل Prisma 5.22 المولَّد من `prisma/schema.prisma` على هذا الفرع، وهو مخطط `main` (لا فرق Prisma بين `a1733679` و`d4ee69a`).

**إعادة القياس الحي:** الأنظمة 1,155، المواد 28,731، الأحكام 51,105. `editorial_config` الإصدار 1 ما زال `writeEnabled=true` و`requireMfa=true` (أُنشئ 00:28:26Z). `index_sync` = 0.

## ماذا يقول الفرق official

| فئة | العدد | الحكم |
|---|---:|---|
| جداول يريد حذفها | 67 | موجودة خارج Prisma. ليست خللًا. لا DROP |
| أعمدة يريد حذفها | 27 | مستخدمة من التطبيق أو البحث. لا DROP |
| enums يريد حذفها | 11 | فوترة وغيرها. الجداول فارغة في 12:47Z لكن الحذف ما زال تغيير مخطط |
| قيمة `AuditSubject.BILLING` | 1 | 0 صفوف في `audit_logs` (1,088) و`guardrail_decisions` (76) تحملها الآن. الحذف يبقى تغيير نوع |
| تضييق `timestamptz` إلى `timestamp(3)` | 9 أعمدة أُعيد قراءة نوعها | كلها `timestamp with time zone`. لا تضييق |
| إسقاط default | 6 | `@updatedAt` يديره العميل. الافتراض في القاعدة يخدم SQL الخام |
| فهارس بحث يريد إسقاطها | 8 | HNSW وtrgm و`search_norm`. لا DROP |
| فهارس Prisma بأسماء غائبة | 9 | قد يقابلها فهرس باسم آخر؛ لا إنشاء قبل إثبات الغياب |
| إعادة تسمية فهارس | 15 | الاسم فقط |
| مفاتيح أجنبية غائبة | 13 | الإنتاج لا يفرض ON DELETE الذي يعلنه Prisma |
| إلزامية `keywords` و`badges` | أداة الفرق سكتت | `attnotnull=false`، والقيمة الافتراضية مصفوفة فارغة. `keywords` بلا NULL في 28,731 صفًا. `training_progress` بلا صفوف |

التفصيل صفًا صفًا في [SCHEMA_SEMANTIC_DIFF.csv](SCHEMA_SEMANTIC_DIFF.csv).

## الأعمدة السبعة والعشرون ليست بقايا مهملة

- `users`: الهاتف وOTP والإحالة والرصيد وإكمال التعريف يكتبها `lib/modules/onboarding/profile.ts` و`lib/modules/otp/phone-otp.ts` و`lib/modules/credits/ledger.ts` ومسارات `app/api/onboarding` و`app/api/profile`. الحقول ليست في نموذج Prisma، فالوصول خارج العميل المولَّد أو عبر SQL.
- `legal_articles.search_norm` و`norm_*`: مسار البحث وملفات الاستيراد. تعليق المخطط عند المادة يقول إن فهرس `norm_modality` خارج النموذج عمدًا.
- `judicial_cases.search_norm`: بحث الأحكام. workflow `apply-rulings-search-norm.yml` يطبّق ملف الهجرة مباشرة.
- `legal_systems.instrument_kind`: يُنسخ في SQL التقسيم. الجرد السابق وجده فارغًا على الأنظمة الـ1,155. العمود مستدعى من سكربت رغم فراغ القيم. لا حذف.

## ما طابق

لا عمود Prisma مفقود ظهر كـ `ADD COLUMN` في هذا الفرق. الاختلافات كلها إنتاج أوسع من Prisma، أو أنواع أدق في الإنتاج، أو قيود Prisma غير منشأة في الإنتاج. متجه `embeddings.embedding` لم يظهر كتغيير نوع في الفرق.

تطبيق هذا الـ SQL على الإنتاج يحذف سطح الفوترة وأعمدة التطبيق الحية وفهارس البحث. هذا دليل انحراف اتجاهي، وليس خطة إصلاح.
