# مكتب التحرير — HKM-031

**القياس:** 2026-10-18. المكتب القائم هو `/admin/legal` والكود `lib/modules/editorial`. لوحة `/dashboard/legal-core/admin` مراجعة ومسارات كتابة جانبية، وليست مكتبًا ثانيًا. لم يُنشأ مسار جديد.

الزيارة العامة: `/admin/legal` و`/dashboard/legal-core` أعادتا `307` إلى `/sign-in`. لم يُفتح المكتب بحساب.

## الحالة الحية

| الجدول | الصفوف |
|---|---:|
| `change_set` | 0 |
| `editorial_change` | 0 |
| `review_decision` | 0 |
| `index_sync` | 0 |
| `audit_event` | 1 |
| `editorial_config` | 1 |

النسخة 1 في 2026-10-18T00:28:26.633Z: `writeEnabled=true` و`requireMfa=true`. المفاتيح العليا للإعداد: `bindings` و`policies` و`controls`. لم تُصدَّر معرّفات المستخدمين داخل `bindings`.

قفل البيئة `EDITORIAL_DESK_WRITE` (0 يقفل، 1 يفتح حتى المعاينة، والغياب يتبع اللوحة) غير مقروء من Vercel. الكود يقول إن معاينة Vercel تشارك قاعدة الإنتاج وتُقفل كتابتها ما لم يُجبر المتغير. هذا تصميم موثّق في `write-gate.ts`، وقيمة المتغير الفعلي UNVERIFIED.

## الضوابط في الكود

| الضابط | الوجود |
|---|---|
| MFA | نعم، علم حساب Clerk لا خطوة الجلسة الحالية. مطلوب في الإعداد الحي |
| RBAC | أدوار المكتب في الإعداد، وأذونات المنصة عبر `requireApiPermission` / `canUser` |
| مفتاح الطوارئ | نعم في الكود |
| مفتاح اللوحة | مفتوح في الصف الحي |
| عدم تكرار الطلب | مفتاح اختياري على إنشاء مجموعة التغيير |
| منع الاعتماد الذاتي | نعم، مع استثناء مالك مسبب حين تسمح السياسة. السياسة الافتراضية `ownerSelfApproval=true` |
| عامل `index_sync` | الإدراج عند النشر فقط. لا cron ولا workflow يحدّث `search_norm_at` أو `opensearch_at` أو `vectors_at` أو `page_revalidated_at`. أعمدة المحاولة والقفل موجودة بلا قارئ |

صفر الصفوف في `index_sync` متسق مع عدم وجود مجموعات منشورة، وليس دليلًا على وجود العامل.

## كتابة خارج الطابور

ما زالت على `main`، وتُحجب بعضها حين `deskIsLive()`:

| المسار | الأثر |
|---|---|
| `POST /api/admin/legal-core/preambles` | يحدّث حقول المقدمة على `legal_systems` ولا يكتب `preamble_unit` |
| `POST /api/admin/legal-core/reindex` | يحدّث `search_norm` وقد ينشئ فهرسًا إن غاب |
| `PATCH /api/legal-core/principles/[id]` | يحدّث `reviewStatus` ويعيد 409 `USE_EDITORIAL_DESK` إذا كانت اللوحة حية |
| `POST /api/legal-relations` | ينشئ `legal_relations` بإذن `LEGAL_CORE_EDIT` |

لا مسار `app/` وُجد يحدّث متن `legal_articles.content`. سكربتات الاستيراد وإعادة الترقيم تحت `scripts/` و`data/renumber/` و`ingest/` تكتب عند تشغيلها عمدًا، وهي خارج المكتب. القائمة المفصلة في مسح الكود لهذه الجلسة، والمسارات الحية أعلاه هي التي تبقى قابلة للاستدعاء إن اجتمعت الصلاحية.

مهمة المكتب القائمة HKM-023 (#771 مفتوح لتوثيق التشغيل، #745 ملحق لا يُدمج). هذا التدقيق لا يغيّر تلك الفروع.
