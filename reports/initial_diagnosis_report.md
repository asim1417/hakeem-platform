# التقرير التشخيصي الأولي — منصة حكيم القانونية
## initial_diagnosis_report.md · المرحلة 1 (تشخيص قبل أي تعديل واسع)

> التاريخ: 2026-06-21 · الفرع: `claude/website-visual-audit-kihjic`
> المنهج: فحص الكود + تشغيل فعلي على قاعدة بيانات حقيقية مزروعة محليًا (PostgreSQL 16 + pgvector).
> **لم تُجرَ أي تغييرات واسعة. هذا تشخيص فقط.** القاضي التفاعلي لم يُمَس.

---

## 0) خلاصة تنفيذية

منصة حكيم **قوية في العمق القانوني** (RAG + حواجز استشهاد + معالجة عربية متقدمة) لكنها اليوم **«مكتبة مواد» لا «محرك بحث قانوني شامل»**: الأحكام والمبادئ والعلاقات والمتجهات **فارغة في مسار البذر القياسي**، والبحث يعتمد على فهرس BM25 مبني مسبقًا لا على فهرسة Postgres حيّة. الواجهة أُنجز جزء كبير من توحيد هويتها مؤخرًا (الخدمات التمايزية الثلاث)، لكن يتبقّى صفحات بهوية قديمة وأمان افتراضي مفتوح.

| المحور | الحالة |
|---|---|
| الهوية البصرية | 🟡 موحّدة جزئيًا (الرئيسية + 3 محرّكات تمايز + النواة)؛ صفحات أخرى بألوان عامة |
| البحث الشامل | 🟠 يبحث في المواد + الأحكام عبر BM25/هجين، لكن الأحكام فارغة بالبذر القياسي |
| الربط بقاعدة البيانات | 🟢 حقيقي عبر Prisma (لا Mock في الواجهة دون وسم) |
| الذكاء (AI) | 🟢 مربوط بإعدادات الموقع `/admin/ai` (أُنجز في هذه الجلسة) |
| الأمان | 🔴 `DISABLE_AUTH=true` افتراضيًا → وصول كامل بصلاحية مدير |
| جودة البيانات | 🟠 المواد مكتملة النص، لكن 100% بلا فصل/متجه، 36% بلا كلمات مفتاحية |
| القاضي التفاعلي | 🟢 يعمل (iframe) — مستثنى من التعديل |

---

## 1) بنية المشروع الحالية

```
hakeem-platform/  (Next.js 14.2 App Router · TS 5.7 · Tailwind 3.4 · RTL)
├── app/            44 صفحة (page.tsx) + ~43 مسار API (route.ts)
├── components/     30 مكوّن (AppShell هيكل + ui/legal نظام تصميم)
├── lib/
│   ├── prisma.ts
│   └── modules/    منطق الأعمال (Service/Repository pattern):
│        auth · ai · legal-core · legal-search · legal-rag ·
│        case-analysis · legal-agent · judicial-simulation ·
│        simulations · citations · knowledge-graph · cases ·
│        consultations · training · attachments · audit ·
│        exports · legal-thesaurus · library
├── prisma/         schema.prisma (24 model) + 2 migrations
├── data/           ~33MB مرجعي (saudi_systems 10MB, legal_articles 1.5MB,
│                   legal-bm25-index.json.gz 4MB, أشجار الفقه)
├── scripts/        50 سكربت (بذر/استيراد/اختبار/فحص)
└── public/original-hakeem/hakim1111.html  (القاضي التفاعلي)
```

**Stack الفعلي:** Next 14 · React 18 · Prisma 5.22 · PostgreSQL + pgvector · bcryptjs · zod · lucide-react. جلسة كوكي HMAC مخصّصة (`next-auth` مثبّت لكنه **ميت/غير مستخدم**). `mysql2` (devDep) لسكربتات استيراد من قاعدة قديمة.

**نمط معماري:** فصل طبقات سليم (الصفحات → API → `lib/modules` → Prisma). لا SQL مباشر في المكوّنات. اقتران محكم في سلسلة الاستدلال (محاكاة→وكيل→تحليل→RAG→بحث هجين).

---

## 2) الصفحات الموجودة (44)

**عامة (3):** `/` (Hero بحث-أولًا) · `/login` · `/search` (بحث الزائر BM25).
**إعادة توجيه (8 aliases):** `/library /judge /simulation /training /cases /consultations /settings /dashboard/library`.
**لوحة التحكم — خدمات (6):** `/dashboard` · `ask` · `cases` · `consultations` · `attachments` · `training`.
**النواة القانونية (11):** `legal-core` + `search · systems · articles/[id] · judgments · judgments/[id] · legal-issues · objection-methods · citations · citations/dashboard · quality`.
**القاضي/المحاكاة (4):** `simulations` (iframe) + `simulations/[id]/{appeal,cassation,reconsideration}`.
**محرّكات التمايز (3 — رُقّيت مؤخرًا):** `judicial-simulation · case-analysis · legal-agent`.
**أدوات تقنية (3 — موسومة «اختبار»):** `knowledge-graph · legal-search · legal-rag`.
**الإدارة (5):** `admin · admin/ai · admin/roles · admin/users · audit-logs`.

**ناقص (لا توجد صفحات له):** صفحة 404/500 مخصّصة، Loading/Empty states موحّدة، صفحة تفاصيل نظام مستقلّة (`systems` شبكة بطاقات فقط)، صفحة نتائج بحث شاملة موحّدة (البحث موزّع على 3 مسارات).

---

## 3) الخدمات الموجودة (مرتّبة بالحالة)

| الخدمة | المسار | الحالة | مصدر البيانات |
|---|---|---|---|
| النواة القانونية / المكتبة | `legal-core/search` | 🟢 جاهزة | DB حقيقي (1981 مادة) |
| اسأل حكيم (وكيل شفاف) | `ask` | 🟢 جاهزة | RAG + DB |
| القاضي التفاعلي | `simulations` | 🟢 يعمل (iframe) — مستثنى | DB + AI |
| تحليل القضايا | `case-analysis` | 🟢 رُقّيت لمنتج | RAG + DB + AI |
| الوكيل القانوني | `legal-agent` | 🟢 رُقّيت لمنتج | RAG + DB + AI |
| المحاكاة القضائية | `judicial-simulation` | 🟢 رُقّيت لمنتج | RAG + DB + AI |
| الاستشارات | `consultations` | 🟢 جاهزة | RAG + DB |
| القضايا | `cases` | 🟡 MVP | DB |
| المرفقات | `attachments` | 🟡 MVP (بلا تخزين دائم، استخراج نص PDF = TODO) | DB metadata |
| التدريب | `training` | 🟡 MVP | DB |
| الأحكام والسوابق | `legal-core/judgments` | 🟠 الواجهة جاهزة لكن **الجدول فارغ بالبذر** | DB (يحتاج استيراد) |
| المبادئ القضائية | — | 🔴 لا واجهة + جدول فارغ | — |
| البحث الهجين/RAG/الرسم المعرفي | أدوات تقنية | 🟡 «اختبار» (تُخفى لاحقًا) | DB |
| الإدارة (مستخدمون/RBAC/ذكاء/تدقيق) | `admin/*` | 🟢 جاهزة | DB |

---

## 4) المسارات (Routes)

- **صفحات:** 36 فعّالة + 8 إعادة توجيه. **صفر روابط ميتة** (تحقّقت سابقًا).
- **معطّل عمدًا (ظاهر):** «تحرير»، «ربط بمسألة/حكم»، «ملفات داعمة لاحقًا»، 8 لوحات إثراء فارغة، 4 طبقات معرفة «مرحلي».
- **تكرار وظيفي:** 3 مسارات بحث (`legal-rag` + `legal-core/search` + `legal-search`) — مرشّحة للتوحيد.

---

## 5) APIs المتاحة (~43)

| النطاق | المسارات |
|---|---|
| مصادقة | `auth/login·logout·me` |
| إدارة | `admin/ai-settings·roles·users·users/[id]` |
| نواة قانونية | `legal-core/search·bm25-search·intelligence-summary·article/[id]/intelligence·citations/analyze` |
| بحث/ذكاء | `legal-search · legal-rag · ai/agent-search · ai/consultation` |
| تحليل | `case-analysis · legal-agent · judicial-simulation` |
| محاكاة | `simulations` + 11 فرعي |
| مرفقات | `attachments·[id]·[id]/download` |
| معرفة | `folders · annotations · legal-relations·[..] · embeddings/status` |
| حوكمة/تدريب | `audit · training/attempts` |
| حكيم الأصلي | `original-hakeem/ai·legal-search·bug-report` |

**يتيمة (لا تُستدعى من واجهة قبل ترقية المحرّكات):** كانت `case-analysis` و`legal-agent` — الآن مربوطة بصفحاتها. **stub:** استخراج نص المرفقات. **مرحلة 1 فقط:** `ai/agent-search` (استرجاع بلا توليد).

---

## 6) حالة قاعدة البيانات (أرقام فعلية من تشغيل حقيقي)

PostgreSQL 16 + pgvector 0.6.0. امتدادات مفعّلة: `plpgsql`, `vector` فقط (**لا `pg_trgm`**).

| الجدول | عدد الصفوف (بعد `db:seed`) |
|---|---|
| legal_systems | **9** |
| legal_articles | **1981** |
| judicial_cases | **0** ⚠️ |
| legal_article_case_links | **0** ⚠️ |
| judicial_principles | **0** ⚠️ |
| legal_relations (KG) | **0** ⚠️ |
| embeddings (pgvector) | **0** ⚠️ |
| fiqh_issues | **0** ⚠️ |
| users | 2 · roles 4 · permissions 14 |
| audit_logs · glossary_terms | 0 |

**استنتاج حاسم:** `db:seed` القياسي يزرع **الأنظمة والمواد فقط**. الأحكام/المبادئ/العلاقات/المتجهات/الفقه تأتي من **سكربتات استيراد منفصلة ثقيلة** (`import:judgments`, `seed:kg`, `backfill-embeddings`) تتطلب مصادر بيانات خارجية. فأي بحث في «الأحكام/المبادئ» يرجع فارغًا حتى تُشغّل تلك الاستيرادات.

---

## 7) الجداول والعلاقات والفهارس الحالية

**24 model.** أبرز العلاقات:
- `LegalSystem 1—N LegalArticle`
- `LegalArticle N—N JudicialCase` عبر `LegalArticleCaseLink` (relationType, confidence, reviewStatus)
- `JudicialCase 1—N JudicialPrinciple`
- `LegalRelation` **polymorphic** (sourceType/sourceId ↔ targetType/targetId) بلا FK صارمة
- `Embedding` منفصل (`Unsupported(vector(1536))`)
- RBAC: `User → RoleRecord → RolePermission → PermissionRecord`
- حوكمة: `AuditEvent`, `GuardrailDecision`, `AppSetting` (إعداد الذكاء المشفّر)

**الفهارس الموجودة (btree جيدة):** `legal_articles(lawName)` + فريد `(lawName,articleNumber)`؛ `judicial_cases(caseNo, decisionNo, court, cityName, decisionDate)`؛ `legal_article_case_links(articleId, caseId, relationType)`؛ `legal_relations(source, target, relation)`؛ `embeddings(ownerType,ownerId)`.

**ناقص للبحث السريع:**
- ❌ لا فهرس **Full-Text (tsvector GIN)** على `content`/`judgmentText`.
- ❌ لا فهرس **trigram (pg_trgm)** للبحث الجزئي/التصحيح.
- ❌ لا فهرس **ivfflat/hnsw** فعّال على المتجهات (الجدول فارغ).
- ❌ `legal_articles.chapter` فارغ 100%، `topics` غير موجود كحقل مستقل (الكيان `LegalTopic` المطلوب غير موجود).

---

## 8) هل البيانات حقيقية أم Mock؟

- **بيانات المحتوى (مواد/أنظمة):** ✅ حقيقية (مستوردة من مصادر سعودية فعلية).
- **الواجهة:** ✅ لا Mock يُعرض للمستخدم دون وسم؛ صفحات الاختبار موسومة صراحةً.
- **الذكاء (AI):** ⚠️ **Mock افتراضيًا** (المزوّد `mock` حتمي) حتى يُضبط مفتاح من `/admin/ai` — والربط أصبح يعمل (أُنجز في هذه الجلسة). الاسترجاع/الاستشهادات حقيقية دائمًا؛ الصياغة فقط هي التي تكون حتمية بلا مفتاح.

---

## 9) حالة البحث الحالي

- **المحرك:** فهرس **BM25 مبني مسبقًا** (`data/legal-bm25-index.json.gz`، يُحمّل بالذاكرة) + معالجة عربية متقدمة (`legal-retrieval.ts`: اشتقاق/جذر/ساق + ~2967 مفهومًا) + بحث هجين (PostgreSQL/pgvector/KG/OpenSearch).
- **النطاق:** يبحث في **المواد + الأحكام** (لكن الأحكام فارغة بالبذر). المبادئ/العلاقات تُدمج إن وُجدت.
- **الثغرات:**
  1. لا يعتمد على Full-Text في Postgres → الفهرس ملف ثابت يحتاج إعادة بناء عند تغيّر البيانات (`build:bm25`).
  2. البحث الدلالي (pgvector) **معطّل** (متجهات فارغة + `SEMANTIC_SEARCH=false`).
  3. KG/OpenSearch غير مفعّلين.
  4. تجربة البحث **مشتّتة على 3 صفحات** بلا واجهة نتائج موحّدة احترافية (فلاتر/ترتيب/سبب الظهور موجودة جزئيًا في صفحات منفصلة).
- **تحقق فعلي سابق:** على بيانات حقيقية، بحث «نزاع تجاري» أرجع 15 استشهادًا حقيقيًا بأوزان 81–95% — جودة الاسترجاع جيدة على المتاح.

---

## 10) حالة الربط بين الواجهة و APIs وقاعدة البيانات

🟢 **حقيقي ومتسق.** الصفحات Server Components تستدعي `lib/modules/*` التي تستخدم Prisma. لا توجد واجهة «جميلة بلا ربط». معالجة الأخطاء موجودة (try/catch + سقوط منظّم). نقاط تحسين:
- بعض القوائم تجلب دفعات ثابتة (50/100) بلا **Pagination** حقيقي.
- لا **Caching** صريح لنتائج البحث المتكرّرة.
- إعداد الذكاء أصبح موحّد المصدر (DB → بيئة) بعد إصلاح هذه الجلسة.

---

## 11) حالة القاضي التفاعلي (دون تعديل)

- يعمل عبر **iframe** يحمّل `public/original-hakeem/hakim1111.html?embed=1` داخل `/dashboard/simulations`.
- له APIs خلفية كاملة (`simulations/[id]/*`: judge-turn, messages, judgment, hearing-record, settlement, appeal, export…) + جداول (`Simulation*`).
- مسارات ما بعد الحكم (استئناف/نقض/التماس) صفحات React منفصلة تعمل.
- **التشخيص فقط — لن يُعدّل منطقه/إجراؤه.** الملاحظة الوحيدة: هويته البصرية (HTML قديم) تختلف عن بقية المنصة؛ المسموح: تحسين بطاقته + توضيح حالته + تأكيد الرابط، دون مسّ المنطق.

---

## 12) أهم 20 مشكلة (مرتّبة حسب الأولوية)

| # | المشكلة | الخطورة |
|---|---|---|
| 1 | `DISABLE_AUTH=true` افتراضيًا → الموقع كله مفتوح بصلاحية SYSTEM_ADMIN | 🔴 حرجة |
| 2 | الأحكام/المبادئ/العلاقات/المتجهات **فارغة** بالبذر القياسي → البحث «شامل» جزئيًا | 🔴 حرجة |
| 3 | لا فهرسة Full-Text/trigram في Postgres؛ البحث معتمد على ملف BM25 ثابت | 🔴 عالية |
| 4 | البحث الدلالي (pgvector) معطّل (متجهات فارغة) | 🟠 عالية |
| 5 | تجربة البحث مشتّتة على 3 صفحات بلا واجهة نتائج موحّدة | 🟠 عالية |
| 6 | الصفحة الرئيسية ليست «Search-First» شاملة (Hero بحث لكن يوجّه للنواة فقط) | 🟠 عالية |
| 7 | هوية بصرية غير موحّدة (صفحات بألوان عامة: judgments, systems, legal-issues, quality…) | 🟠 عالية |
| 8 | لا صفحات 404/500/Loading/Empty موحّدة | 🟡 متوسطة |
| 9 | تكرار مزوّد الذكاء مع سياسة «Claude حصري» (CLAUDE.md) | 🟡 متوسطة |
| 10 | تناقض schema الفعلي مع CLAUDE.md (أسماء/UUID/FK) | 🟡 متوسطة |
| 11 | كيان `LegalTopic` (التصنيفات الموضوعية) غير موجود؛ `chapter` فارغ 100% | 🟠 عالية |
| 12 | لا `SearchLog` (سجل البحث) لقياس الاستخدام | 🟡 متوسطة |
| 13 | لا Pagination حقيقي في القوائم الطويلة | 🟡 متوسطة |
| 14 | استخراج نص PDF/DOCX للمرفقات = TODO | 🟡 متوسطة |
| 15 | iframe القاضي بهوية قديمة (تحسين بطاقة/إطار فقط — لا منطق) | 🟡 متوسطة |
| 16 | `next-auth` مثبّت وميت + `mysql2` تابع لسكربتات قديمة | 🟢 منخفضة |
| 17 | 8 صفحات redirect تضخّم خريطة الموقع | 🟢 منخفضة |
| 18 | لوحة الإدارة تنقصها إدارة محتوى (إضافة/تعديل نظام/مادة، إعادة فهرسة، أخطاء استيراد) | 🟠 عالية |
| 19 | 36% من المواد بلا كلمات مفتاحية، 100% بلا فصل (chapter) → ضعف الفلاتر | 🟡 متوسطة |
| 20 | لا Caching/مقاييس أداء موثّقة | 🟢 منخفضة |

---

## 13) خطة التنفيذ المقترحة (مراحل)

> ملتزمة بقواعدك: لا كسر لخدمة قائمة، لا حذف دون توثيق، القاضي التفاعلي مستثنى وظيفيًا، تحقّق build+typecheck بعد كل مرحلة.

| المرحلة | المحتوى | المخرجات |
|---|---|---|
| **1 (هذه)** | التشخيص | `initial_diagnosis_report.md` ✅ |
| **2** | 🔴 تصليب الأمان: عكس `DISABLE_AUTH` للوضع الآمن + سرّ قوي + حماية صفحات الإدارة فعليًا | `security_rbac_report.md` |
| **3** | توحيد الهوية البصرية على كل الصفحات المتبقية (judgments, systems, legal-issues, quality, admin…) + 404/500/Loading/Empty | `ui_ux_review_report.md` |
| **4** | قاعدة البيانات: إضافة `LegalTopic` + `SearchLog`، فهارس Full-Text (tsvector GIN) + trigram (pg_trgm)، حقول الحوكمة (source/status/indexedAt) | `database_quality_report.md` |
| **5** | البحث الشامل الموحّد: واجهة نتائج واحدة عبر كل الكيانات (مواد/أحكام/مبادئ/تصنيفات) + فلاتر + ترتيب صلة + سبب الظهور؛ توحيد المسارات الثلاثة | `search_quality_report.md` + `search_acceptance_tests.md` |
| **6** | ربط فعلي + إزالة اعتماد Mock غير المعلن + تشغيل استيراد الأحكام/المتجهات (توثيق) | `services_quality_report.md` |
| **7** | الأداء: Pagination + Caching + تحسين الاستعلامات + قياسات | `performance_report.md` |
| **8** | الأمن/RBAC الكامل + Audit للعمليات الحساسة + الأدوار (admin/lawyer/researcher/user) | تحديث `security_rbac_report.md` |
| **9** | اختبار القبول + الفحص التقني النهائي | `technical_audit_report.md` + `implementation_summary.md` + `final_delivery_report.md` |

**أوامر الفحص المعتمدة:** `npx tsc --noEmit` · `npm run build` · `npm run test:case/agent/simulation` · `npx prisma validate` · تشغيل خادم + طلبات HTTP حقيقية (كلها نجحت في هذه الجلسة).

---

## توصية البدء
أوصي بالبدء بـ **المرحلة 2 (تصليب الأمان)** لأنها أخطر وأصغر وأعلى أثرًا، ثم **المرحلة 5 (البحث الشامل الموحّد)** لأنها جوهر «المنصة القانونية الاحترافية» وأولويتك المعلنة (جودة البحث والبيانات أولًا).
**في انتظار موافقتك للانتقال للتنفيذ** (التزامًا بـ«ممنوع البدء بتغييرات واسعة قبل فهم البنية»).
