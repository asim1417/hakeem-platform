# تهيص بصري شامل لمنصة حكيم
## جرد كامل لكل الصفحات والخدمات والأيقونات — الظاهر والمخفي، الفعّال والمعطّل

> تاريخ التدقيق: 2026-06-20 · الفرع: `claude/website-visual-audit-kihjic`
> الهدف: أساس لإعادة بناء واجهة بصرية جديدة للموقع.

---

## 0) ملخص تنفيذي — الصورة الكبيرة

- **عدد الصفحات (Routes):** 44 صفحة (`page.tsx`)، منها **8 مجرد إعادة توجيه (redirect)**.
- **عدد خدمات الـ API:** ~43 مسار (`route.ts`) موزّعة على 12 نطاقًا.
- **عدد المكوّنات (Components):** 30 مكوّنًا.
- **عدد الأيقونات المستخدمة (lucide-react):** ~40 أيقونة + رموز نصية (`⌕`, `↗`, `✦`, `①②③`, `●○`).
- **حالة النضج:** نواة قانونية + قاضٍ تفاعلي + إدارة = **فعّالة**. أما مجموعة "الذكاء" (RAG، الوكيل، المحاكاة، الرسم المعرفي) = **صفحات اختبار (اختبار)**.

### إشارات حمراء بصرية لازم تُحلّ في التصميم الجديد
1. **ازدواج التنقّل:** الشريط الجانبي فيه روابط "(اختبار)" مكشوفة للمستخدم النهائي بجانب الخدمات الحقيقية — تشويش هوية.
2. **8 صفحات وهمية (redirect فقط):** `/library`, `/judge`, `/simulation`, `/training`, `/cases`, `/consultations`, `/settings`, `/dashboard/library`.
3. **3 مسارات بحث متكررة:** `/legal-rag` + `/legal-core/search` + `/legal-search` — تجربة مبعثرة.
4. **iframe قديم:** القاضي التفاعلي الرئيسي يعمل عبر `hakim1111.html` داخل iframe وليس مكوّن React أصلي.
5. **أزرار/أقسام معطّلة ظاهرة:** "ملفات داعمة لاحقًا"، "ربط بمسألة"، "تحرير"، 8 لوحات إثراء فارغة، طبقات معرفة "مرحلي".

---

## 1) نظام التصميم البصري الحالي (Design Tokens)

من `app/globals.css`:

| الفئة | القيم |
|---|---|
| **الكحلي (Navy)** | `--navy #0B1F3A` · `--navy-mid #142D52` · `--navy-soft #1E3F6F` |
| **الذهبي (Gold)** | `--gold #C09B5A` · `--gold-bright #D4AF6E` · `--gold-pale #E8D5A8` · `--gold-dark #9A7636` · `--gold-ghost` · `--gold-border` |
| **دلالات الحالة** | `--emerald #1A5C41` (نجاح/فعّال) · `--amber #B8721A` (مرحلي/تحذير) · `--ruby #8C2233` (خطر/مراجعة) |
| **الخطوط** | `font-display` · `font-judicial` (Amiri للنصوص القضائية) · `font-mono-legal` (للأرقام والاستشهادات) |
| **اللمسات** | خلفية ضوضاء SVG، نقش سداسي ذهبي خلف الشريط الجانبي والـ hero |
| **الأزرار** | `.btn-gold` (أساسي) · `.btn-primary` (كحلي) · `.btn-outline` · `.ho-hero-outline` |
| **الاتجاه** | RTL كامل، عربية أولاً |

**الخلاصة البصرية:** هوية "قضائية فاخرة" (كحلي + ذهبي + رق/ورق). متماسكة لكنها مطبّقة بنِسَب متفاوتة بين الصفحات الفعّالة وصفحات الاختبار.

---

## 2) الأيقونات — الجرد الكامل (lucide-react)

```
ArrowRight · BarChart3 · BookMarked · BookOpen · BookOpenCheck · BookmarkPlus ·
Briefcase · CalendarClock · Check · CheckCircle2 · ClipboardCopy · Copy · Database ·
ExternalLink · FileArchive · FileClock · FileSearch · FileText · Filter · Gavel ·
GraduationCap · LayoutDashboard · Link2 · ListChecks · Loader2 · LogOut · Menu ·
Paperclip · Pencil · Quote · RefreshCcw · Scale · ScrollText · Search · Settings ·
ShieldAlert · ShieldCheck · Sparkles · Users · XCircle
```

**رموز نصية (Glyphs) مستخدمة بدل أيقونات:** `⌕` (بحث) · `↗` (فتح خارجي) · `✦` (اسأل حكيم) · `①②③` (مسارات الاعتراض) · `●○` (حالة المستخدم) · `✓ ✕` (نتائج).

**خريطة الأيقونة ← الوظيفة:**

| الأيقونة | الاستخدام |
|---|---|
| `LayoutDashboard` | الرئيسية |
| `Briefcase` | الدعاوى/القضايا |
| `ShieldCheck` | الاستشارات |
| `Paperclip` | المرفقات |
| `Sparkles` | اسأل حكيم / الذكاء / RAG / الوكيل |
| `Scale` | القاضي التفاعلي / المسائل / التحليل / المحاكاة |
| `Database` | النواة / الرسم المعرفي / البحث الهجين / جودة البيانات |
| `GraduationCap` | التدريب |
| `Settings` | الإعدادات |
| `Users` | المستخدمون |
| `FileClock` | سجل التدقيق |
| `BookOpen / BookMarked / BookOpenCheck` | النواة والمكتبة والبحث |
| `Gavel` | طرق الاعتراض / القاضي |
| `Quote / FileSearch / ScrollText` | الاستشهادات والأحكام |
| `LogOut` | الخروج |
| `Menu / X` | قائمة الجوال |

> **ملاحظة تصميمية:** أيقونة `Scale` و`Database` و`Sparkles` مُعاد استخدامها لأكثر من خدمة مختلفة → يصعب التمييز البصري بين الخدمات. التصميم الجديد يحتاج أيقونة مميزة لكل خدمة.

---

## 3) جرد الصفحات الكامل

### أ) الصفحات العامة (قبل الدخول)

| المسار | الغرض | الحالة | أيقونات/عناصر | الروابط |
|---|---|---|---|---|
| `/` | الواجهة الرئيسية (Hero بحث-أولًا) | ✅ فعّال | شعار «ح»، `⌕`، تبديل بحث/سؤال | 5 اقتراحات سريعة + 4 روابط (المكتبة/الاستشارات/القاضي/التدريب) + `LoginPopover` |
| `/login` | صفحة الدخول الكاملة | ✅ فعّال | — | نموذج دخول (بريد+كلمة مرور)، يحوّل لـ`/dashboard` إذا الجلسة مفعّلة |
| `/search` | بحث للزائر (BM25، بلا تسجيل) | ✅ فعّال | `⌕`, `↗` | نتائج بطاقات + بانر زائر + "فتح المادة (يتطلب الدخول)" + `LoginPopover` |

### ب) صفحات إعادة التوجيه فقط (وهمية بصريًا) ⚠️

| المسار | يحوّل إلى |
|---|---|
| `/library` | `/dashboard/legal-core/search` |
| `/dashboard/library` | `/dashboard/legal-core/search` |
| `/judge` | `/dashboard/simulations` |
| `/simulation` | `/dashboard/simulations` |
| `/training` | `/dashboard/training` |
| `/cases` | `/dashboard/cases` |
| `/consultations` | `/dashboard/consultations` |
| `/settings` | `/admin` |

> هذه 8 مسارات لا تعرض شيئًا — مجرد aliases. مفيدة للروابط القديمة لكنها تضخّم خريطة الموقع.

### ج) لوحة التحكم — الخدمات الأساسية (فعّالة)

| المسار | الغرض | الحالة | أبرز العناصر |
|---|---|---|---|
| `/dashboard` | الرئيسية: hero بحث + بطاقات خدمات + إحصاءات + نشاط | ✅ فعّال | 6 بطاقات خدمة، 8 بطاقات إحصاء (2 منها روابط)، 6 قوائم "آخر النشاط" |
| `/dashboard/ask` | اسأل حكيم (محادثة الوكيل) | ✅ فعّال | `AgentSearchPanel` (يقبل `?q=`) |
| `/dashboard/cases` | القضايا والمرفقات | ✅ فعّال (MVP) | `CasesManager`، آخر 50 قضية |
| `/dashboard/consultations` | الاستشارات (RAG محكوم بالمكتبة) | ✅ فعّال | `ConsultationForm` (يقبل `?facts=`) |
| `/dashboard/attachments` | المرفقات (بدون تخزين دائم) | ✅ فعّال (MVP) | `AttachmentsManager` — **استخراج نص PDF/DOCX = TODO** |
| `/dashboard/training` | التدريب والتعلّم | ✅ فعّال (MVP) | `TrainingWorkspace` (مسارات/نقاط/شارات) |

### د) لوحة التحكم — النواة القانونية (فعّالة، مع أقسام مرحلية)

| المسار | الغرض | الحالة | عناصر مهمة / معطّلة |
|---|---|---|---|
| `/dashboard/legal-core` | مركز النواة | ✅ فعّال | 10 بطاقات إحصاء (3 منها amber=مرحلي: شروح/مبادئ/قانون مقارن)؛ 5 طبقات معرفة (1 نشط + 4 «مرحلي») |
| `/dashboard/legal-core/search` | بحث متقدم (اشتقاق/جذر/ساق) | ✅ فعّال | 6 أنواع بحث؛ **معطّل:** "ملفات داعمة لاحقًا"، مصادر (شرح/حكم/مقارن) disabled |
| `/dashboard/legal-core/systems` | تصفّح الأنظمة | ✅ فعّال (بسيط) | شبكة `LegalSystemCard` |
| `/dashboard/legal-core/articles/[id]` | تفاصيل المادة | ✅ فعّال | **معطّل:** "تحرير"، "ربط بمسألة"، "ربط بحكم"، **8 لوحات إثراء فارغة** ("لم يتم الإثراء بعد") |
| `/dashboard/legal-core/judgments` | تصفّح الأحكام | ✅ فعّال | كل الأحكام بوسم `needs_review` (amber) |
| `/dashboard/legal-core/judgments/[id]` | تفاصيل حكم | ✅ فعّال | روابط مواد آلية بانتظار مراجعة بشرية |
| `/dashboard/legal-core/legal-issues` | المسائل (الفقهية) | ✅ فعّال | فهرس هرمي + ترقيم؛ وسوم (مطابقة/مراجعة/غير مقنّن) |
| `/dashboard/legal-core/objection-methods` | دليل طرق الاعتراض | ✅ فعّال (مرجع ثابت) | 7 أقسام، جداول، `①②③` |
| `/dashboard/legal-core/citations` | التقاط الاستشهاد | ✅ فعّال | `JudgmentCitationCapture` |
| `/dashboard/legal-core/citations/dashboard` | تغطية الربط (تحليلات) | ✅ فعّال | شريط تقدّم + توزيع أنواع العلاقات |
| `/dashboard/legal-core/quality` | جودة البيانات | ✅ فعّال | 8 مؤشرات (3 منها بقيمة 0 = غير مُطبّقة بعد) |

### هـ) لوحة التحكم — القاضي التفاعلي (فعّال عبر iframe)

| المسار | الغرض | الحالة | ملاحظات |
|---|---|---|---|
| `/dashboard/simulations` | القاضي التفاعلي (قاعة المرافعة) | ✅ فعّال | **iframe لـ`/original-hakeem/hakim1111.html`** وليس React أصلي |
| `/dashboard/simulations/[id]/appeal` | لائحة استئناف | ✅ فعّال | النموذج **معطّل حتى صدور الحكم**؛ تصدير DOCX/PDF |
| `/dashboard/simulations/[id]/cassation` | طلب نقض | ✅ فعّال | روابط للاستئناف/الالتماس |
| `/dashboard/simulations/[id]/reconsideration` | التماس إعادة نظر | ✅ فعّال | مطابق للنقض بنوع مختلف |

### و) لوحة التحكم — مجموعة الذكاء (صفحات «اختبار» مكشوفة) 🧪

> هذه فعّالة وظيفيًا لكنها مُعلَّمة صراحةً بـ«(اختبار)» في الشريط الجانبي والعناوين. القرار التصميمي: إخفاؤها خلف وضع متقدّم، أو دمجها في الخدمات الناضجة.

| المسار | الغرض | الحالة |
|---|---|---|
| `/dashboard/case-analysis` | تحليل قضية مُسنَد (درجة قوة + استشهادات) | 🧪 اختبار |
| `/dashboard/legal-search` | بحث هجين (نصّي/دلالي/رسم معرفي/OpenSearch) | 🧪 اختبار |
| `/dashboard/legal-rag` | إجابة منضبطة بالمصادر | 🧪 اختبار |
| `/dashboard/legal-agent` | خطة عمل قانونية للمحامي | 🧪 اختبار |
| `/dashboard/knowledge-graph` | العلاقات + حالة المتجهات | 🧪 اختبار |
| `/dashboard/judicial-simulation` | محاكاة تفكير القاضي (نموذجي غير ملزم) | 🧪 اختبار |

### ز) الإدارة (Admin) — فعّالة

| المسار | الغرض | الحالة |
|---|---|---|
| `/admin` | لوحة الإدارة + حالة التكاملات | ✅ فعّال (M365 SSO «تتطلب مستأجرًا» = معطّل) |
| `/admin/ai` | إعدادات مزوّد الذكاء (حفظ/اختبار) | ✅ فعّال |
| `/admin/roles` | محرّر صلاحيات RBAC (مصفوفة) | ✅ فعّال |
| `/admin/users` | إدارة المستخدمين (CRUD) | ✅ فعّال |
| `/audit-logs` | سجل التدقيق (محمي بصلاحية) | ✅ فعّال (جدول للقراءة فقط) |

---

## 4) خدمات الـ API (الباك-إند) — مختصر

| النطاق | المسارات |
|---|---|
| **المصادقة** | `auth/login` · `auth/logout` · `auth/me` |
| **الإدارة** | `admin/ai-settings` · `admin/roles` · `admin/users` · `admin/users/[id]` |
| **النواة القانونية** | `legal-core/search` · `bm25-search` · `intelligence-summary` · `article/[id]/intelligence` · `citations/analyze` |
| **البحث/الذكاء** | `legal-search` · `legal-rag` · `ai/agent-search` (مرحلة 1: استرجاع فقط) · `ai/consultation` |
| **القضايا/التحليل** | `cases` · `cases/[id]` · `case-analysis` · `legal-agent` · `judicial-simulation` |
| **المحاكاة** | `simulations` + 11 مسار فرعي (judge-turn, messages, judgment, hearing-record, settlement, appeal, export, decisions, strength-score…) |
| **المرفقات** | `attachments` · `attachments/[id]` · `attachments/[id]/download` |
| **المعرفة/الملاحظات** | `folders` · `annotations` · `legal-relations` · `legal-relations/article/[id]` · `embeddings/status` |
| **حوكمة/تدريب** | `audit` · `training/attempts` |
| **حكيم الأصلي (توافق)** | `original-hakeem/ai` · `original-hakeem/legal-search` (عام، CORS) · `original-hakeem/bug-report` |

### مسارات API بحالة خاصة
- `ai/agent-search` → **مرحلة 1: استرجاع وتحقّق فقط، لا توليد AI**.
- `attachments` (POST) → **stub:** لا يستخرج نص PDF/DOCX (TODO).
- `embeddings/status` → تدهور رشيق إن لم تُفعّل pgvector.
- `original-hakeem/bug-report` → يرجع 503 إن الجدول مفقود.
- `case-analysis` و`legal-agent` → **لا يُستدعيان من أي صفحة UI** حاليًا (مرتبطان بصفحات الاختبار فقط).
- **تكرار:** `legal-rag` + `legal-core/search` + `legal-search` — مرشّحة للدمج.

---

## 5) المكوّنات (Components)

`AppShell` (الهيكل+الشريط الجانبي) · `MobileNav` · `TopbarBreadcrumb` · `ModuleCard` · `LoginForm` · `LogoutButton` ·
`CasesManager` · `ConsultationForm` · `AttachmentsManager` · `TrainingWorkspace` · `AgentSearchPanel` ·
`CoreIntelligenceDashboard` · `JudgmentCitationCapture` · `JudgmentText` · `PostJudgmentRemedyForm` · `SearchHighlight` ·
`LegalCopyButton` · `LegalFavoriteButton` · `ModuleCard` ·
`admin/AiSettingsManager` · `admin/RolePermissionsEditor` · `AdminUsersManager` ·
`home/HomeHero` · `home/LoginPopover` · `legal/LegalBasisPanel` · `legal/legal-intelligence` · `ui/legal` · `legal-core`

---

## 6) توصيات لإعادة التصميم البصري

1. **افصل وضعين:** «منتج عام نظيف» (نواة + اسأل حكيم + قاضٍ + استشارات + تدريب) عن «مختبر/اختبار» (RAG، الوكيل، المحاكاة، الرسم المعرفي، البحث الهجين) خلف تبويب "متقدّم/تجريبي".
2. **وحّد البحث:** واجهة بحث واحدة فوق المسارات الثلاثة المتكررة.
3. **نظّف الأيقونات:** أيقونة فريدة لكل خدمة (لا تكرار `Scale`/`Database`/`Sparkles`).
4. **عالج الأزرار/الأقسام المعطّلة:** إمّا أكملها أو أخفِها (8 لوحات إثراء، "ملفات داعمة لاحقًا"، "تحرير"، "ربط بمسألة/حكم").
5. **استبدل iframe القاضي** بمكوّن React أصلي ضمن نظام التصميم الموحّد.
6. **بطاقات حالة موحّدة:** نظام وسوم ثابت (emerald=فعّال، amber=مرحلي، ruby=يحتاج مراجعة) عبر كل الموقع.
7. **خريطة موقع أنظف:** عامِل الـ8 redirects كـ aliases خفية لا كصفحات.
