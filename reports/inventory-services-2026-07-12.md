# جرد الخدمات الخلفية — منصة حكيم (100%)

**التاريخ:** 2026-07-12 · **الفرع:** `claude/legal-platform-audit-ii0r3u` · **وثيقة توثيق (بلا تعديل كود)**
**مكمّل لـ:** `reports/global-audit-2026-07-12.md` · Next.js 14 App Router + Prisma/PostgreSQL

## 0. سياق حاكم — يُقرأ قبل جداول الصلاحيات

| البند | الحقيقة | الدليل |
|---|---|---|
| **المصادقة معطّلة افتراضيًا** | `REQUIRE_AUTH` غير مضبوط ⇒ `isAuthDisabled()=true` ⇒ أي زائر يُرقّى إلى `guest@hakeem.local` بدور **`SYSTEM_ADMIN`**؛ فعليًا كل `requireApiPermission(...)` يمرّ كمدير نظام ما لم يُضبط `REQUIRE_AUTH=true`. | `lib/modules/auth/session.ts:21-45,122-134` |
| الحارس الرئيسي | `requireApiPermission(perm, req)` ⇒ 401 بلا جلسة، 403 بلا صلاحية + `auditEvent(ACCESS_DENIED)` | `session.ts:162-178` |
| بوّابة API الخارجية | `handleLegalApi`/`requireApiKey`: مفتاح `hk_...` + نطاق `legal:read` + حدّ معدّل + CORS؛ يسقط لجلسة داخلية حقيقية (لا يقبل الضيف) | `gateway-auth.ts:64-120` |
| مصفوفة RBAC | `rolePermissions: Record<UserRole,Permission[]>`؛ SYSTEM_ADMIN كل شيء، LAWYER محدود؛ يُدمج مع `roleRecord` من DB | `rbac.ts:20-83` |

**العدّ المؤكَّد:** `find app -name route.ts` = **75 مسارًا**. الوحدات: **26 داخل `lib/modules/`** + `lib/legal-graph` + `lib/openapi` = **28 وحدة**.

**مفتاح:** 🟢 سليم · 🟡 جزئي/ملاحظة · 🔴 ثغرة/عاجل · `.parse()` = يرمي ZodError⇒500 عند مدخل خاطئ (بدل 400) · `safeParse`=400 لطيف.

---

## PART A — جرد المسارات (75)

### A1. الإدارة والحوكمة
| المسار + الأفعال | الغرض | الوحدة | DB | الصلاحية | تحقّق | IDOR | الحالة |
|---|---|---|---|---|---|---|---|
| `admin/ai-settings` GET,POST | إعداد مزوّد الذكاء | ai-config/gateway | ext | `USERS_MANAGE` | safeParse | n-a | 🟢 |
| `admin/api-keys` GET,POST | مفاتيح API | — | apiKey | `USERS_MANAGE` | safeParse | n-a | 🟢 |
| `admin/api-keys/[id]` PATCH,DELETE | تعديل/إبطال مفتاح | — | apiKey | `USERS_MANAGE` | safeParse | n-a | 🟢 |
| `admin/roles` GET,POST | أدوار/منح صلاحية | role-admin | prisma | `USERS_MANAGE` | safeParse | n-a | 🟢 |
| `admin/settings` GET,POST | إعدادات النظام | settings-service | prisma | `USERS_MANAGE` | `.parse` 🟡 | n-a | 🟡 500 |
| `admin/users` GET,POST | سرد/إنشاء مستخدم | — | user | `USERS_MANAGE` | `.parse` 🟡 | n-a | 🟡 |
| `admin/users/[id]` PATCH | تعديل مستخدم | — | user | `USERS_MANAGE` | `.parse` 🟡 | n-a | 🟡 |
| `audit` GET | استعراض التدقيق | — | auditEvent | `GOVERNANCE_AUDIT_VIEW` | none | n-a | 🟢 |

### A2. المصادقة
| المسار + الأفعال | الغرض | DB | الصلاحية | الحالة |
|---|---|---|---|---|
| `auth/login` POST | دخول bcrypt | user | NONE-public | 🟡 `.parse`⇒500 |
| `auth/logout` POST | إنهاء الجلسة | لا | cookie-only | 🟢 |
| `auth/me` GET | المستخدم الحالي | لا | cookie-only | 🟢 |
| `auth/google` GET | بدء OAuth | لا | NONE-public | 🟢 |
| `auth/callback/google` GET | رد OAuth + إنشاء/ترقية | user×3 | NONE-public (يتحقّق الرمز) | 🟡 أول مستخدم=admin |

### A3. الذكاء/المحادثة/التحليل
| المسار + الأفعال | الغرض | DB | الصلاحية | IDOR | الحالة |
|---|---|---|---|---|---|
| `ai/agent-search` POST | بحث وكيل بثّي | لا | cookie-only `:22` 🟡 | n-a | 🟡 حارس ألطف من RBAC |
| `ai/consultation` POST | إنشاء استشارة | consultation | `CONSULTATIONS_LIMITED` | n-a | 🟢 |
| `case-analysis` POST | تحليل وقائع (بلا حفظ) | لا | `LEGAL_CORE_VIEW` | n-a | 🟢 |
| `judicial-simulation` POST | محاكاة عديمة الحالة | لا | `LEGAL_CORE_VIEW` | n-a | 🟢 |
| `legal-agent` POST | خطة عمل قانونية | لا | `LEGAL_CORE_VIEW` | n-a | 🟢 |
| `legal-rag` GET,POST | إجابة RAG مُسنَدة | لا | `LEGAL_CORE_VIEW` | n-a | 🟢 |
| `legal-chat` POST | تنسيق محادثة + حفظ | prisma×5 | `LEGAL_CORE_VIEW` | يكتب userId 🟢 | 🟢 |
| `legal-chat/conversations` GET | محادثات المستخدم | chatConversation | `LEGAL_CORE_VIEW` | `where:{userId}` 🟢 | 🟢 |
| `original-hakeem/ai` POST | واجهة «حكيم الأصلي» | لا | `SIMULATIONS_USE` | n-a | 🟢 |

### A4. النواة القانونية والبحث
| المسار + الأفعال | الغرض | DB | الصلاحية | الحالة |
|---|---|---|---|---|
| `legal-core/search` GET | بحث النواة | queryRaw | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-core/bm25-search` GET | بحث BM25 | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-core/citations/analyze` POST | استخراج استشهادات | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-core/intelligence-summary` GET | ملخّص ذكاء النواة | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-core/article/[articleId]/intelligence` GET | ذكاء مادة | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-core/principles/[id]` PATCH | اعتماد/رفض مبدأ | principle | `LEGAL_CORE_EDIT` | 🟡 `.parse` |
| `legal-search` GET | بحث المكتبة + علاقات | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-search/suggest` GET | اقتراحات | prisma | `LEGAL_CORE_VIEW` | 🟢 |
| `legal-relations` GET,POST | قراءة/إنشاء علاقة | لا | GET `LEGAL_CORE_VIEW`/POST `LEGAL_CORE_EDIT` | 🟢 |
| `legal-relations/article/[articleId]` GET | علاقات مادة | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `embeddings/status` GET | تغطية التضمين | لا | `LEGAL_CORE_VIEW` | 🟢 |
| `turath/search` GET | بحث التراث | external | `LEGAL_CORE_VIEW` | 🟢 |
| `original-hakeem/legal-search` GET,OPTIONS | بحث عام + CORS | retrieval | **NONE-public** ⚠️ | 🔴 عام بلا حارس |

### A5. بوّابة API الخارجية (مفتاح `hk_...`) — كلها GET+OPTIONS عبر `handleLegalApi`
`legal/search` · `legal/systems` · `legal/systems/[id]` · `legal/articles` · `legal/articles/[id]` · `legal/articles/[id]/related` · `legal/articles/[id]/fiqh` — 🟢 (بيانات عامة، لا IDOR، أخطاء موحّدة 500+CORS).

### A6. المحاكاة القضائية بالحالة — عنقود IDOR 🔴
الحارس `SIMULATIONS_USE` في الجميع. الجذر مقيّد بالمالك، لكن **كل الفرعية تستخدم `findUnique({where:{id}})` بلا قيد ملكية** (تأكيد: 0 إشارات userId/ownerId/findFirst).

| المسار + الأفعال | الغرض | IDOR | الحالة |
|---|---|---|---|
| `simulations` GET,POST | سرد/إنشاء | POST يكتب userId؛ GET بالمالك 🟢 | 🟢 |
| `simulations/[id]` GET,PATCH | عرض/تعديل | `findFirst{id,userId}` 🟢 | 🟢 المرجع الصحيح |
| `simulations/[id]/messages` GET,POST | رسائل مرافعة | `findUnique({id})` **MISSING** 🔴 | 🔴 |
| `simulations/[id]/judge-turn` POST | دور القاضي | **MISSING** 🔴 | 🔴 |
| `simulations/[id]/decisions` POST | قرار إجرائي | **MISSING** 🔴 | 🔴 |
| `simulations/[id]/judgment` POST | إصدار الحكم | **MISSING** 🔴 | 🔴 |
| `simulations/[id]/appeal` POST | الاعتراض | **MISSING** 🔴 | 🔴 |
| `simulations/[id]/settlement` POST | مسودة صلح | **MISSING** (يكتب بلا جلب) 🔴 | 🔴 |
| `simulations/[id]/strength-score` POST | قوة الدعوى | **MISSING** 🔴 | 🔴 |
| `simulations/[id]/hearing-record` POST | محضر جلسة | **MISSING** 🔴 | 🔴 |
| `simulations/[id]/export` GET | تصدير مذكرة/حكم | **MISSING** 🔴 | 🔴 تسريب مستند |

> **11 مسار محاكاة بلا فحص ملكية** (وسّعت اكتشاف الأمن السابق من 8 إلى 11 بإضافة messages/settlement/decisions).

### A7. القضايا/الاستشارات/المرفقات/المكتبة الشخصية
| المسار + الأفعال | الغرض | DB | الصلاحية | IDOR | الحالة |
|---|---|---|---|---|---|
| `cases` GET,POST | سرد/إنشاء قضية | caseFile×2 | GET `CONSULTATIONS_LIMITED`/POST `CONSULTATIONS_FULL` | GET مقيّد `{ownerId}` 🟢 | 🟢 |
| `cases/[id]` GET | تفاصيل قضية | caseFile | `CONSULTATIONS_LIMITED` | `findFirst{id,ownerId}` 🟢 | 🟢 |
| `attachments` GET,POST | سرد/رفع مرفق | attachment×2 | GET `ATTACHMENTS_LIMITED`/POST `ATTACHMENTS_FULL` | **list غير مقيّد بالمالك** 🟡 | 🟡 تسريب قائمة |
| `attachments/[id]` GET,DELETE | عرض/حذف | prisma×3 | `ATTACHMENTS_LIMITED/FULL` | `ownsAttachment` 🟢 | 🟢 |
| `attachments/[id]/download` GET | رابط تنزيل موقّع | prisma | `ATTACHMENTS_LIMITED` | فحص ownerId 🟢 | 🟢 |
| `annotations` GET,POST | تظليلات | عبر الوحدة | `LIBRARY_READ` | داخل الوحدة | 🟢 |
| `folders` GET,POST | مجلدات | عبر الوحدة | `LIBRARY_READ` | داخل الوحدة | 🟢 |
| `training/attempts` POST | محاولة تدريب | prisma×3 | `TRAINING_USE` | `findFirst{userId}` 🟢 | 🟢 |

### A8. منصة الوثائق وOCR — حارس مختلف (كوكي مساحة عمل مجهولة، لا RBAC)
| المسار + الأفعال | الغرض | الصلاحية | IDOR | الحالة |
|---|---|---|---|---|
| `doc-platform/cases` GET,POST | قضايا الوثائق | cookie-workspace 🟡 | `{workspaceId}` 🟢 | 🟡 عام بلا حساب |
| `doc-platform/cases/[id]` GET,DELETE | عرض/حذف | cookie-workspace 🟡 | `{id,workspaceId}` 🟢 | 🟡 |
| `doc-platform/drive/auth` | بدء OAuth Drive | NONE-public | n-a | 🟡 |
| `doc-platform/drive/callback` GET | رد Drive | NONE-public | n-a | 🟡 |
| `doc-platform/drive/files` GET | سرد ملفات Drive | NONE (توكن كوكي) | n-a | 🟡 |
| `doc-platform/drive/import` POST | استيراد ملف | NONE | n-a | 🟡 |
| `doc-platform/drive/status` GET | حالة الربط | NONE | n-a | 🟢 |
| `doc-tool` GET,PUT,DELETE | حالة أداة الوثائق | cookie-workspace 🟡 | `{workspaceId,marker}` 🟢 | 🟡 |
| `doc-tool/ocr` GET,POST | OCR Gemini سحابي | **NONE-public** (503 إن غير مُهيّأ) 🟡 | n-a | 🟡 عام (تكلفة) |
| `doc-tool/ocr/settings` GET,POST,DELETE | مفتاح Gemini | `USERS_MANAGE` | n-a | 🟢 |

### A9. عامة/بلاغات/مواصفات
| المسار + الأفعال | الغرض | الصلاحية | الحالة |
|---|---|---|---|
| `original-hakeem/bug-report` POST,GET | بلاغ خطأ/استعراضه | POST `SIMULATIONS_USE`/GET `ADMIN_REPORTS_VIEW` | 🟢 |
| `eli/[...slug]` GET | محلّل ELI ⇒ redirect | NONE-public | 🟢 |
| `llms.txt` GET | دليل llms.txt | NONE-public | 🟢 |
| `api/openapi` GET | مواصفة OpenAPI 3.1 | NONE-public | 🟢 |

**ملخص A:** حرّاس: `requireApiPermission` (الأغلب) · `handleLegalApi` (7 خارجية) · cookie-only (3) · cookie-workspace (10 doc-*) · **NONE-public** (≈10). أبرز الثغرات: **11 مسار محاكاة IDOR 🔴** · قائمة المرفقات غير مقيّدة 🟡 · `original-hakeem/legal-search` عام 🔴 · نمط `.parse()` (≈12 مسارًا) يعيد 500 بدل 400.

---

## PART B — جرد الوحدات (28)

| الوحدة | المسؤولية | ملفات | DB | الاكتمال | يتكرّر مع؟ | الإجراء |
|---|---|---|---|---|---|---|
| `ai` | بوّابة مزوّد مركزي + embeddings + OCR | 12 | نعم | full | — | keep |
| `api-gateway` | مفاتيح API + مصادقة/حدّ معدّل + CORS | 2 | نعم | full | — | keep |
| `auth` | جلسات HMAC + RBAC + أدوار DB + OAuth | 5 | نعم | full | — | keep |
| `audit` | auditEvent + recordGuardrail | 1 | نعم | full | — | keep |
| `settings` | مفاتيح النظام المُدارة | 1 | نعم | full | ai-config (جزئي) | keep |
| `legal-core` | نواة البحث الموحّد (comprehensive/bm25/retrieval/pgvector/morphology/eli/fiqh/intelligence) | 27 | نعم | full | legal-search, legal-rag | **keep (النواة)** |
| `legal-search` | مزوّدات بحث + fallback + اقتراحات | 10 | نعم | full | 🔴 legal-core | **merge→legal-core** |
| `legal-rag` | RAG: retrieval→citations→answer | 5 | نعم | full | legal-core, citations | keep (منسّق) |
| `legal-thesaurus` | معجم قانوني حتمي | 7 | نعم | full | legal-core | keep |
| `knowledge-graph` | علاقات/تظليلات/مجلدات/embeddings | 5 | نعم | full | legal-graph | keep |
| `citations` | محرّك استشهاد + تحقق من DB | 1 | نعم | full | legal-rag | keep |
| `case-analysis` | تحليل قضايا (RAG+دفوع+قوة) | 4 | لا | full | legal-agent, judicial-simulation | **merge→عنقود التحليل** |
| `legal-agent` | تحويل التحليل لخطة عمل | 3 | لا | full | case-analysis | **merge→عنقود التحليل** |
| `judicial-simulation` | محاكاة عديمة الحالة | 4 | لا | full | 🔴 simulations | **merge→simulations** |
| `simulations` | محاكاة بالحالة (judge-engine/hakeem-judge) | 4 | نعم | full (TODO اعتراض `hakeem-judge:106`) | 🔴 judicial-simulation | keep + merge |
| `legal-chat` | تنسيق محادثة (الأكبر ~4724 سطر) | 21 | لا | full | ai, legal-rag | keep (قد يُقسّم) |
| `library` | خدمة المكتبة لبوّابة `/api/legal/*` | 1 | نعم | full | legal-core | keep |
| `cases` | خدمة قضايا رفيعة | 1 | نعم | thin-stub (9 أسطر) | consultations | **merge** |
| `consultations` | خدمة استشارات رفيعة | 1 | نعم | thin-stub (9 أسطر) | cases | **merge** |
| `attachments` | ميتاداتا + blob (Azure/SharePoint) | 2 | لا | partial (استخراج نص TODO) | doc-platform | keep |
| `doc-platform` | مساحة وثائق مجهولة + Google Drive | 2 | نعم | full | doc-tool | keep + merge doc-tool |
| `doc-tool` | تصنيف/تنظيف الوثائق | 4 | لا | full | 🔴 document-inspection | **merge→document-inspection** |
| `document-inspection` | فحص/استخراج محلي (OCR-quality/PDF/DOCX/reflow) | 16 | لا | full | 🔴 doc-tool | keep (نواة الوثائق) |
| `exports` | توليد مستندات للتصدير | 1 | لا | full | simulations/export | keep |
| `training` | مسارات تدريب + تقدّم | 2 | نعم | partial | — | keep |
| `turath` | عميل بحث خارجي (تراث) | 1 | external | full | — | keep |
| `lib/legal-graph` | محلّل مراجع/علاقات | 1 | لا | partial | knowledge-graph | **merge→knowledge-graph** |
| `lib/openapi` | مواصفة OpenAPI 3.1 | 1 | لا | full | — | keep |

**عناقيد الدمج:** (1) `legal-search`→`legal-core`. (2) `case-analysis`+`legal-agent`+`judicial-simulation`→`simulations`. (3) `doc-tool`+`document-inspection`. (4) `cases`+`consultations`. (5) `legal-graph`→`knowledge-graph`.

---

## PART C — مطابقة الخدمات المطلوبة (19)

| # | الخدمة | الحالة | الدليل |
|---|---|---|---|
| 1 | المصادقة | 🟢 موجود (لكن معطّل افتراضيًا) | `auth/session.ts`, `auth/login`, `auth/google` |
| 2 | إدارة المستخدمين | 🟢 | `admin/users`+`[id]` |
| 3 | الأدوار والصلاحيات | 🟢 | `rbac.ts`, `admin/roles`, `roleRecord` |
| 4 | إدارة الأنظمة | 🟢 | `legal/systems`, `library-service` |
| 5 | اللوائح | 🟡 جزئي (ضمن الأنظمة، لا كيان مستقل بارز) | `core-systems`, schema |
| 6 | الأحكام | 🟢 | `judicialCase`, citation-extractor |
| 7 | المبادئ | 🟢 | `principles/[id]`, `judicialPrinciple` |
| 8 | رفع الوثائق | 🟢 | `attachments POST`, drive/import |
| 9 | استخراج النصوص | 🟢 (PDF/DOCX + OCR Gemini)؛ مرفقات المنصّة TODO 🟡 | `document-inspection/file-extract`, `doc-tool/ocr` |
| 10 | البحث النصي | 🟢 (tsvector/ts_rank_cd + BM25) | `legal-retrieval:295-318`, `bm25` |
| 11 | البحث الدلالي | 🟢 (pgvector `<=>`+HNSW، مشروط بتعبئة المتجهات) | `legal-retrieval:207-211`, `vector-provider` |
| 12 | الذكاء الاصطناعي | 🟢 (Claude مركزي + مزوّدات) | `ai-gateway`, `legal-rag`, `legal-chat` |
| 13 | **الإشعارات** | 🔴 **غير موجود** | لا خدمة/جدول إشعارات |
| 14 | التقارير | 🟡 ضعيف جدًا (بلاغات أخطاء فقط، لا تقارير تشريعية/قضائية) | `bug-report` فقط |
| 15 | سجل التدقيق | 🟢 | `audit.ts`, `api/audit` (≈15 مسارًا) |
| 16 | إدارة الملفات | 🟢 | `attachments`, `folders`, `doc-platform` |
| 17 | **النسخ الاحتياطية** | 🔴 **غير موجود** | لا شيء في `lib`/`app` |
| 18 | التكاملات الخارجية | 🟢 (Google OAuth/Drive، Turath، Gemini)؛ **WhatsApp/Rasayel غير موجود** 🟡 | `google-*`, `turath-client`, `gemini-ocr` |
| 19 | واجهات API | 🟢 (بوّابة `/api/legal/*` + OpenAPI + ELI + llms.txt) | `gateway-auth`, `api/openapi` |

**المفقود المؤكَّد:** الإشعارات (13) والنسخ الاحتياطية (17) غير موجودتين نهائيًا · التقارير (14) شبه معدومة · اللوائح ككيان مستقل (5) وWhatsApp (18) ناقصان. الباقي موجود ويعمل — مع التحفّظ الحاكم (المصادقة معطّلة افتراضيًا + عنقود IDOR في المحاكاة).
