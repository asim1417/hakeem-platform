# جرد صفحات منصة حكيم — Page-by-Page Inventory (100%)

**التاريخ:** 2026-07-12 · **الفرع:** `claude/legal-platform-audit-ii0r3u` · **وثيقة توثيق (بلا تعديل كود)**
**مكمّل لـ:** `reports/global-audit-2026-07-12.md`

تغطية مُثبتة بالتعداد: **60 ملف `app/**/page.tsx` + ملفّا `route.ts` يقدّمان استجابة للمستخدم** (`app/eli/[...slug]/route.ts` و`app/llms.txt/route.ts`) = **62 مساراً**. (بقية `app/api/**/route.ts` — 73 ملفاً — واجهات برمجية خلفية، مُغطّاة في `reports/inventory-services-2026-07-12.md`.)

## مفتاح الرموز (Legend)
- **مصدر البيانات**: `REAL-DB` استعلام Prisma حقيقي · `STATIC` محتوى ثابت · `CLIENT` معالجة في المتصفح · `MOCK-AI` محرك ذكاء يسقط لوضع محاكاة عند غياب مزوّد · `REDIRECT` تحويل · `EXTERNAL` مصدر خارجي/iframe
- **الحالة**: ✅ مكتملة · ⚠️ تحتاج إصلاح · 🧪 صفحة اختبار · 🔁 تحويل · `stub` جزئية
- **الإجراء**: keep / fix / merge / hide / archive
- جميع الصفحات RTL (من `app/layout.tsx` أو `dir="rtl"` محلي) والجداول العريضة داخل `overflow-x:auto` — لا مشاكل جوّال/RTL إلا حيث يُذكر.

---

## ① صفحات عامة (Public — خارج `/dashboard`، بلا حراسة middleware)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/` | الصفحة الرئيسية (هيرو) | STATIC (`HomeHero`) | لا | wired | لا | ok | — | ✅ | keep |
| `/search` | بحث عام للزائر | REAL-DB `searchLegalCore` (search/page.tsx:21) | نعم (وحدة النواة) | wired (form GET + LoginPopover) | لا | ok | نسخة عامة من `/dashboard/legal-core/search` | ✅ | keep |
| `/legal` | فهرس الأنظمة (ISR) | REAL-DB `prisma.legalSystem` (legal/page.tsx:16) | نعم | wired | لا | ok | يشبه `/dashboard/legal-core/systems` | ✅ | keep |
| `/legal/[slug]` | مواد نظام واحد (ISR) | REAL-DB `prisma.legalArticle` | نعم | wired | لا | ok | — | ✅ | keep |
| `/legal/[slug]/[article]` | نص مادة + ELI (ISR) | REAL-DB `prisma.legalArticle` | نعم | wired (سابق/تالي) | لا | ok | — | ✅ | keep |
| `/developers` | بوابة المطوّرين API | STATIC | لا | wired (روابط api-docs/openapi) | لا | ok | — | ✅ | keep |
| `/api-docs` | توثيق OpenAPI ذاتي | STATIC (`openApiSpec`) | لا | wired | لا | ok | — | ✅ | keep |
| `/privacy` | سياسة الخصوصية PDPL | STATIC | لا | wired | لا | ok | — | ✅ | keep |
| `/terms` | شروط الاستخدام | STATIC | لا | wired | لا | ok | — | ✅ | keep |
| `/login` | تسجيل الدخول | CLIENT→خادم (`LoginForm`→`/api/auth/login`, `/api/auth/google`) | نعم | wired | لا | ok | — | ✅ (يحوّل عند `isAuthDisabled`) | keep |
| `/documents` | بوابة منصة الوثائق | STATIC (مسار ثالث إن ضُبط `DOC_SERVICE_URL`) | لا | wired | لا | ok | — | ✅ | keep |
| `/documents/tool` | البحث السريع في الوثائق | CLIENT (`DocToolApp`) | لا (OCR اختياري `/api/doc-tool/*`) | wired | لا | ok | هدف تحويل `/doc-tool` | ✅ | keep |
| `/documents/app` | محطة العمل (فحص متقدم) | CLIENT (`CaseBrowser`) + `/api/doc-platform/*` | نعم (حفظ القضايا) | wired | لا | ok | — | ✅ | keep |

---

## ② صفحات المستخدمين (Dashboard)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` | الرئيسية + إحصاءات | REAL-DB (8 `count` + 6 `findMany`, dashboard/page.tsx:26-65) | نعم | wired (بحث→`/dashboard/legal-search`) | لا | ok | — | ✅ | keep |
| `/dashboard/ask` | اسأل حكيم (وكيل) | MOCK-AI (`AgentSearchPanel`→`/api/ai/agent-search`) | نعم | wired | لا | ok | يتقاطع مع legal-chat | ✅ | keep |
| `/dashboard/consultations` | الاستشارات (RAG) | MOCK-AI (`ConsultationForm`→`/api/ai/consultation`) | نعم | wired | لا | ok | هدف تحويل `/consultations` | ✅ | keep |
| `/dashboard/cases` | ملفات القضايا | REAL-DB `prisma.caseFile` (cases/page.tsx:9)؛ `CasesManager`→`/api/cases` | نعم | wired | لا | ok | هدف تحويل `/cases` | ✅ | keep |
| `/dashboard/attachments` | المرفقات والبينات | REAL-DB `prisma.attachment` (attachments/page.tsx:11)؛ `/api/attachments` | نعم (metadata-only افتراضياً) | wired | لا | ok | — | ⚠️ تخزين ملفات فعلي يحتاج ضبط Azure/SharePoint | keep |
| `/dashboard/legal-chat` | المحاكاة القضائية (شات) | MOCK-AI (`LegalChatWorkspace`→`/api/legal-chat`) | نعم | wired | لا | ok | يتقاطع مع ask/judicial-simulation | ✅ | keep |
| `/dashboard/training` | التدريب والتقييم | REAL-DB `prisma.trainingProgress` (training/page.tsx:9)؛ `/api/training/attempts` | نعم | wired | لا | ok | هدف تحويل `/training` | ✅ (مبدئية) | keep |
| `/dashboard/library` | مكتبة (مدمجة) | REDIRECT → `/dashboard/legal-core/search` (library/page.tsx:5) | لا | — | لا | — | تكرار | 🔁 | keep |

---

## ③ صفحات الإدارة (Admin — صلاحية `USERS_MANAGE`/`ADMIN_REPORTS_VIEW`)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/admin` | لوحة حالة الخدمات | REAL-DB (`$queryRaw`+counts, admin/page.tsx:11-22) | نعم | wired | لا | ok | — | ✅ | keep |
| `/admin/users` | إدارة المستخدمين | REAL-DB `prisma.user` (users/page.tsx:10)؛ `/api/admin/users` | نعم | wired | لا | ok | — | ✅ (مبدئية) | keep |
| `/admin/roles` | مصفوفة الأدوار×الصلاحيات (RBAC) | REAL `buildPermissionMatrix`؛ `/api/admin/roles` | نعم | wired | لا | ok | — | ✅ | keep |
| `/admin/api-keys` | مفاتيح API الخارجية | REAL-DB `prisma.apiKey` (api-keys/page.tsx:12)؛ `/api/admin/api-keys` | نعم | wired | لا | ok | — | ✅ | keep |
| `/admin/ai` | إعدادات الذكاء الاصطناعي | REAL `getAiStatus`؛ `/api/admin/ai-settings` | نعم | wired | لا | ok | يتقاطع مع `/admin/settings` | ✅ | keep |
| `/admin/settings` | مفاتيح التشغيل (بحث/ذكاء/Google) | REAL `getSettingsStatus`؛ `/api/admin/settings` | نعم | wired | لا | ok | يتقاطع مع `/admin/ai` | ✅ | keep |

---

## ④ إدارة المحتوى (Legal-Core Content Mgmt)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-core` | مركز النواة القانونية | REAL-DB (`getLibraryStats`+counts, page.tsx:21-28) | نعم | wired (9 روابط قسم) | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/admin` | حوكمة/مراجعة المحتوى | REAL-DB (طوابير مراجعة + جداول فقهية آمنة، admin/page.tsx:24-34) | نعم | wired | زر «مواءمات فقهية» يشير لنفس الصفحة (admin/page.tsx:39) | ok | — | ✅ | keep |

---

## ⑤ الأنظمة (Systems)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-core/systems` | بطاقات الأنظمة + تصفية | REAL-DB `listSystems` | نعم | wired (بحث/ترقيم) | لا | ok | يشبه `/legal` العام | ✅ | keep |
| `/dashboard/legal-core/systems/[id]` | شجرة النظام (فصول→مواد) | REAL-DB `getSystemDetail` | نعم | wired | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/articles/[id]` | صفحة المادة الكاملة (تبويبات) | REAL-DB `prisma.legalArticle` (page.tsx:65) | نعم | **partially** | لا | ok | — | ⚠️ | fix |

> **stubs في `articles/[id]`**: أزرار `type=button` بلا معالج: «تحرير» (:207)، «ربط بمسألة»/«ربط بحكم» (:276-277). تبويبات «اللائحة/الأسئلة/المسائل المتفرعة/المراجع» = `Placeholder` (:175-193). النسخ والقراءة تعمل.

---

## ⑥ الأحكام (Judgments) + تغطية الربط

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-core/judgments` | مستودع الأحكام + بحث | REAL-DB `prisma.judicialCase` (page.tsx:70-95) | نعم | wired | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/judgments/[id]` | حكم واحد + مواد مرتبطة | REAL-DB `prisma.judicialCase` (page.tsx:15) | نعم | wired | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/citations` | التقاط الاستشهاد من نص حكم | CLIENT→خادم (`JudgmentCitationCapture`→`/api/legal-core/citations/analyze`) | نعم | wired | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/citations/dashboard` | لوحة تغطية الربط (تقارير) | REAL-DB (`groupBy`+counts, page.tsx:12-22) | نعم | wired | لا | ok | — | ✅ | keep |

---

## ⑦ المبادئ + المسائل القانونية

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-core/principles` | المبادئ القضائية + مراجعة | REAL-DB `prisma.judicialPrinciple` (page.tsx:36-50) | نعم (`PrincipleReviewControls`→`/api/legal-core/principles/[id]`) | wired | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/legal-issues` | فهرس المسائل مربوطة بالمواد | STATIC (وحدة `legal-issues`) + REAL-DB `resolveArticleIds` (page.tsx:34) | جزئياً | wired | لا | ok | — | ✅ (بيانات من ملف) | keep |

---

## ⑧ البحث (Search)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-search` | بحث شامل موحّد (مواد+أحكام+مبادئ) | REAL-DB `searchLegalCoreComprehensive` + `recordSearch` (page.tsx:92-105) | نعم (+`/api/legal-search/suggest`, Turath) | wired | لا | ok | ثلاثية البحث | ✅ | keep |
| `/dashboard/legal-core/search` | البحث المتقدم في النواة | REAL-DB `searchLegalCore` (page.tsx:68) | نعم | **partially** | لا | ok | يتقاطع مع legal-search و`/search` | ⚠️ | merge/fix |

> **stubs في `legal-core/search`**: `LegalFavoriteButton` حفظ محلي فقط؛ زر «ملفات داعمة لاحقاً» بلا معالج (:274)؛ خيارات `sourceType` disabled (:171-173). البحث والنسخ يعملان.

---

## ⑨ الذكاء الاصطناعي (AI Engines & Simulation)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/case-analysis` | تحليل قانوني مُسنَد للدعوى | MOCK-AI `analyzeCase` (page.tsx:32) | نعم | wired | لا | ok | يتقاطع مع legal-agent | ✅ | keep |
| `/dashboard/legal-agent` | خطة عمل قانونية للمحامي | MOCK-AI `runLegalAgent` (page.tsx:35) | نعم | wired | لا | ok | يتقاطع مع case-analysis | ✅ | keep |
| `/dashboard/judicial-simulation` | محاكاة نظر القاضي + تقدير الحكم | MOCK-AI `runJudicialSimulation` (page.tsx:39) | نعم | wired | لا | ok | يتقاطع مع legal-chat/simulations | ✅ | keep |
| `/dashboard/simulations` | القاضي التفاعلي (قاعة كاملة) | EXTERNAL iframe `/original-hakeem/hakim1111.html?embed=1` (page.tsx:14) + `/api/simulations/*` | نعم | wired (داخل iframe) | لا | ok | أهداف تحويل `/judge`,`/simulation` | ✅ | keep |
| `/dashboard/simulations/[id]/appeal` | تقديم لائحة استئناف | REAL-DB `prisma.simulation` (appeal:30) + `/api/simulations/[id]/appeal`,`/export` | نعم | wired (يُعطَّل بلا حكم) | لا | ok | نمط مشترك | ✅ | keep |
| `/dashboard/simulations/[id]/cassation` | طلب نقض | REAL-DB `prisma.simulation` (cassation:11) | نعم | wired (`disabled=!judgment`) | لا | ok | — | ✅ | keep |
| `/dashboard/simulations/[id]/reconsideration` | التماس إعادة النظر | REAL-DB `prisma.simulation` (reconsideration:11) | نعم | wired (`disabled=!judgment`) | لا | ok | — | ✅ | keep |
| `/dashboard/legal-core/objection-methods` | دليل طرق الاعتراض (إجرائي) | STATIC (وحدة `objection-methods`) | لا | wired | لا | ok | — | ✅ | keep |

---

## ⑩ التقارير/التحليلات + الجودة

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-core/quality` | لوحة جودة بيانات النواة | REAL-DB (`count`+`$queryRawUnsafe`, quality/page.tsx:20-40) | نعم | wired (عرض فقط) | لا | ok | — | ✅ (بعض المؤشرات ثابتة =0: :68-70) | keep |

---

## ⑪ التدقيق والمراقبة (Audit)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/audit-logs` | سجل التدقيق (آخر 50) | REAL-DB `prisma.auditEvent` (audit-logs:9)؛ `/api/audit` | نعم | wired (عرض فقط) | لا | ok (جدول scroll) | — | ✅ | keep |

---

## ⑫ الاختبارات والتطوير (Test Pages — مُعلّمة صراحةً «صفحة اختبار»)

| المسار | الغرض | مصدر البيانات | مربوطة بالخادم؟ | الأزرار/الإجراءات | روابط مفقودة؟ | جوّال/RTL | مكرّرة مع؟ | الحالة | الإجراء |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/legal-rag` | اختبار الإجابة المنضبطة بالمصادر | MOCK-AI `legalRag` (:17) | نعم | wired | لا | ok | جوهرها داخل ask/consultations | 🧪 | merge/hide |
| `/dashboard/knowledge-graph` | اختبار العلاقات والمتجهات pgvector | REAL-DB `listRelations`/`getEmbeddingStatus` (:40-44) | نعم | wired | لا | ok | — | 🧪 | hide/keep |
| `/doc-tool` | مسار قديم لأداة الوثائق | REDIRECT → `/documents/tool` (:7) | لا | — | لا | — | تكرار | 🔁 | keep |

---

## ⑬ التوجيهات (Redirect Aliases)

| المسار | يحوّل إلى | الحالة | الإجراء |
|---|---|---|---|
| `/cases` | `/dashboard/cases` | 🔁 | keep |
| `/consultations` | `/dashboard/consultations` | 🔁 | keep |
| `/judge` | `/dashboard/simulations` | 🔁 | keep |
| `/library` | `/dashboard/legal-core/search` | 🔁 | keep |
| `/settings` | `/admin` (settings/page.tsx:4) | 🔁 | keep |
| `/simulation` | `/dashboard/simulations` | 🔁 | keep |
| `/training` | `/dashboard/training` | 🔁 | keep |
| `/dashboard/library` | `/dashboard/legal-core/search` | 🔁 | keep |
| `/eli/[...slug]` (route.ts) | `articles/{id}` — REAL-DB ثم 302/400/404 (eli/route.ts:16-30) | 🔁 | keep |

---

## ⑭ مُقدِّم نصّي (Non-page route renderer)

| المسار | الغرض | مصدر البيانات | الحالة | الإجراء |
|---|---|---|---|---|
| `/llms.txt` (route.ts) | دليل llms.txt لأنظمة الذكاء | STATIC (`force-static`) | ✅ | keep |

---

## خلاصة تنفيذية

- **العدد الكلي**: 62 مساراً (60 صفحة + 2 مُقدِّم route)، مُثبت بـ`find`.
- **مربوط فعلياً بـ REAL-DB**: ~34 صفحة. الثابت مقصود للأداء (public القانونية) أو بيانات من وحدات كود (`legal-issues`/`objection-methods`).
- **محركات الذكاء (MOCK-AI)**: 7 صفحات تعمل بمنطق حقيقي فوق النواة، لكنها تسقط لوضع محاكاة عند غياب مزوّد مضبوط (بتنبيه صريح).
- **أزرار stub تحتاج fix (3 مواضع)**: `articles/[id]` (تحرير/ربط + 5 تبويبات Placeholder)؛ `legal-core/search` (مفضّلة محلية + «ملفات داعمة لاحقاً» + مصادر disabled)؛ `attachments` (تخزين metadata-only حتى ضبط Azure/SharePoint).
- **تكرار مرشّح للدمج**: ثلاث واجهات بحث؛ محركات ذكاء متقاطعة؛ `legal-rag` صفحة اختبار مغطّاة في `ask`.
- **لا روابط ميتة خارجية**؛ ملاحظة وحيدة: زر «مواءمات فقهية» في `legal-core/admin` يشير للصفحة نفسها.
