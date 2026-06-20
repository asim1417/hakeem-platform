# تيص معماري وتقني خبير لمنصة حكيم
## تحليل الـ Stack، الأمان، قاعدة البيانات، خط الذكاء، الروابط، واللغة

> تاريخ التدقيق: 2026-06-20 · الفرع: `claude/website-visual-audit-kihjic`
> مكمّل لتقرير `visual-audit.md` (التهيص البصري). هذا التقرير يغوص في المعمارية والكود.

---

## 0) الحكم الخبير في سطور

| المحور | التقييم | ملاحظة |
|---|---|---|
| **المعمارية العامة** | 8/10 | Next.js 14 App Router + طبقات modules نظيفة |
| **خط RAG/الذكاء** | 9/10 | حواجز استشهاد ممتازة، سقوط منظّم |
| **قاعدة البيانات** | 8/10 | Prisma + Postgres + pgvector، مُحكمة |
| **الأمان** | 🔴 4/10 | **تسجيل الدخول معطّل افتراضيًا — وصول كامل بصلاحيات مدير** |
| **اتساق الهوية التقنية** | 5/10 | الكود يخالف CLAUDE.md في الذكاء والـschema |
| **النضج البصري** | 6/10 | خدمات اختبار مكشوفة + iframe قديم |
| **الروابط** | 9/10 | **صفر روابط ميتة**، 8 إعادة توجيه |
| **اللغة/التدويل** | 6/10 | عربي مُصمَّت hardcoded، RTL، بلا إطار i18n |

### أخطر 3 نقاط (Top Risks)
1. 🔴 **`DISABLE_AUTH="true"` افتراضيًا** → أي زائر يدخل كـ«زائر النظام» بدور **SYSTEM_ADMIN** كامل الصلاحيات. الموقع كله مفتوح بلا حماية في الوضع الحالي.
2. 🟠 **تناقض مزوّد الذكاء:** CLAUDE.md يقول «Claude حصري»، والكود يدعم OpenAI + Gemini + custom بالتساوي، والافتراضي `mock` (محاكاة).
3. 🟠 **تناقض الـ Schema:** CLAUDE.md يصف نماذج (`Article`, `JudicialRuling`, `LegalRelation` بمفاتيح أجنبية…) والكود الفعلي مختلف (`LegalArticle`, `JudicialCase`, علاقات polymorphic بلا FK).

---

## 1) الـ Stack الفعلي (مقابل المُعلن في CLAUDE.md)

| الطبقة | المُعلن (CLAUDE.md) | **الفعلي في الكود** | الحالة |
|---|---|---|---|
| Frontend | Next.js 14 / TS / Tailwind | ✅ Next.js 14.2 App Router, React 18.3, TS 5.7, Tailwind 3.4 | مطابق |
| Auth | Microsoft Entra ID (Azure AD) | ❌ **جلسة كوكي HMAC مخصّصة** (`hakeem_session`)؛ `next-auth` مثبّت لكنه **غير مستخدم إطلاقًا** | مخالف |
| Database | PostgreSQL + Prisma | ✅ Postgres (Supabase/Neon) + Prisma 5.22 | مطابق |
| Vector | pgvector | ⚠️ pgvector في الـ schema لكن المتجهات تُخزَّن أيضًا كـ`Json`؛ غير مملوءة على الإنتاج | جزئي |
| AI | Claude حصري (`claude-sonnet-4-6`) | ❌ **متعدّد المزوّدين** (claude/openai/gemini/mock)، الافتراضي mock | مخالف |
| Storage | Azure Blob / SharePoint | ⚠️ كلاهما مُجهّز اختياريًا؛ الافتراضي metadata-only بلا تخزين | جزئي |
| Search | pgvector ← OpenSearch لاحقًا | ✅ BM25 (فهرس مبني) + pgvector + KG + OpenSearch (مُجهّز معطّل) | متقدّم |
| Messaging | WhatsApp Business API | ❌ غير موجود | غير منفّذ |

**أدوات إضافية مكتشفة:** `bcryptjs` (تجزئة كلمات المرور)، `zod` (تحقّق)، `mysql2` (في devDeps — **سكربتات استيراد من قاعدة MySQL/Hostinger قديمة**: `migrate-judgments`, `analyze-hostinger`, `audit-db-environments`).

---

## 2) المعمارية الطبقية (Layered Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  العرض (Presentation)                                         │
│  app/  →  44 صفحة (Server Components افتراضيًا)               │
│  components/  →  30 مكوّن (AppShell هيكل، باقي مزيج خادم/عميل) │
│  globals.css + tailwind.config  →  نظام تصميم كحلي/ذهبي RTL    │
└─────────────────────────────────────────────────────────────┘
                          ↓ يستدعي
┌─────────────────────────────────────────────────────────────┐
│  الحدود (API / Route Handlers)                               │
│  app/api/**  →  ~43 مسار  +  middleware.ts (حارس المسارات)     │
└─────────────────────────────────────────────────────────────┘
                          ↓ يستدعي
┌─────────────────────────────────────────────────────────────┐
│  منطق الأعمال (Domain Modules) — lib/modules/                 │
│  auth · ai · legal-core · legal-search · legal-rag ·          │
│  case-analysis · legal-agent · judicial-simulation ·          │
│  simulations · citations · knowledge-graph · cases ·          │
│  consultations · training · attachments · audit · exports ·   │
│  legal-thesaurus · library                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓ يستدعي
┌─────────────────────────────────────────────────────────────┐
│  البيانات (Data) — lib/prisma.ts + prisma/schema.prisma       │
│  PostgreSQL + pgvector   ·   data/*.json (33MB مرجعية)        │
└─────────────────────────────────────────────────────────────┘
```

**نمط معماري واضح:** فصل سليم للطبقات (Repository/Service pattern عبر `lib/modules`). الصفحات لا تكتب SQL مباشرة — تمرّ على وحدات الخدمة. هذا يطابق «قاعدة المعمارية» في CLAUDE.md. ✅

**رائحة معمارية:** اقتران محكم (tight coupling) في سلسلة الاستدلال:
`judicial-simulation → legal-agent → case-analysis → legal-rag → hybrid-search`. كل طبقة تعتمد على ما تحتها بلا مسار بديل، وكلها تمر على نقطة AI واحدة (`callCentralProvider`) — جيد للتدقيق، لكنه نقطة فشل واحدة (تخفّفها مسارات السقوط الحتمي deterministic).

---

## 3) الأمان والمصادقة — التحليل الحرج 🔴

### 3.1 آلية الجلسة
- جلسة **كوكي موقّعة HMAC-SHA256** باسم `hakeem_session`، صلاحية 8 ساعات، `timingSafeEqual` ضد هجمات التوقيت.
- السر من `AUTH_SECRET` → `NEXTAUTH_SECRET` → **قيمة افتراضية مكشوفة** `"hakeem-mvp-development-secret-change-me"` (خطر إن لم تُضبط).
- كلمات المرور: `bcryptjs`. ✅
- `next-auth@4.24` مثبّت في الحزم لكنه **ميت تمامًا** — لا استيراد له في أي ملف مصدر. (تنظيف مطلوب)

### 3.2 الثغرة الكبرى: وضع «بلا تسجيل دخول»
```ts
// middleware.ts + session.ts
export function isAuthDisabled() {
  const flag = (process.env.DISABLE_AUTH ?? "").toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "off"; // ← الافتراضي: مُعطّل!
}
```
- عند `DISABLE_AUTH=true` (وهو **الافتراضي** في `.env.example` وفي غياب المتغيّر): الـ middleware يمرّر كل المسارات، و`getCurrentUser()` يُنشئ/يُرجع **«زائر النظام» بدور `SYSTEM_ADMIN`** — أي **كل الصلاحيات بلا أي مصادقة**.
- النتيجة: في الوضع الافتراضي الموقع كله (لوحة التحكم، الإدارة، إدارة المستخدمين، سجل التدقيق) **مفتوح للعامة بصلاحيات مدير**.
- **التوصية:** للإنتاج اضبط `DISABLE_AUTH=false` صراحةً، وغيّر `AUTH_SECRET`. يُفضّل عكس المنطق ليكون الافتراضي «آمن» (auth مفعّل).

### 3.3 نظام الصلاحيات (RBAC) — مزدوج
- **مصدران للحقيقة:** ثابت في الكود (`rbac.ts` → `rolePermissions`) **و** جداول DB (`RoleRecord`/`PermissionRecord`/`RolePermission`).
- `canUser()` يقرأ من DB ثم يسقط على الثابت إن لم يوجد سجل → منطق دمج ذكي لكنه قد يُربك (أي مصدر يحكم؟).
- 4 أدوار: `SYSTEM_ADMIN`, `LAWYER`, `TRAINER`, `TRAINEE` × 14 صلاحية.
- `SYSTEM_ADMIN` يتجاوز كل الفحوص (`return true`).

---

## 4) قاعدة البيانات — تحليل الـ Schema (562 سطرًا)

### 4.1 الكيانات الفعلية (24 model)
**المستخدمون/الصلاحيات:** `User`, `RoleRecord`, `PermissionRecord`, `RolePermission`
**النواة القانونية:** `LegalSystem`, `LegalArticle`, `GlossaryTerm`
**القضاء:** `JudicialCase`, `LegalArticleCaseLink`, `JudicialPrinciple`
**عمل المستخدم:** `CaseFile`, `Attachment`, `Consultation`, `ConsultationCitation`, `Message`
**المحاكاة:** `Simulation`, `SimulationMessage`, `SimulationDecision`, `SimulationJudgment`
**التدريب:** `Exercise`, `TrainingProgress`
**الحوكمة:** `AuditEvent`, `GuardrailDecision`, `FeatureToggle`, `AppSetting`, `BugReport`
**المرحلة الثانية (Knowledge Graph + pgvector):** `LegalRelation`, `Embedding`
**الفقه:** `FiqhIssue`, `FiqhIssueLink`

### 4.2 تناقضات مع CLAUDE.md (مهم للتصميم)
| في CLAUDE.md | الفعلي | الأثر |
|---|---|---|
| `Article` (UUID, `text_ar/text_en`) | `LegalArticle` (cuid, `content`, بلا إنجليزي) | أسماء/حقول مختلفة |
| `JudicialRuling` | `JudicialCase` | تسمية مختلفة |
| `LegalRelation` بمفاتيح أجنبية صارمة | `LegalRelation` **polymorphic بلا FK** (`sourceType/sourceId`) | مرونة مقابل سلامة |
| UUID (`gen_random_uuid()`) | **cuid()** في كل النماذج | معرّفات مختلفة |
| `embedding vector(1536)` على الجداول | جدول `Embedding` منفصل + `Json?` على المادة | ازدواج تخزين المتجه |

### 4.3 ملاحظات تقنية
- **الهجرات (migrations):** 2 فقط — `add_judicial_cases` و`add_knowledge_graph_pgvector`. الأخيرة **لم تُطبَّق على الإنتاج** (مذكور صراحةً)، لذا جداول KG/pgvector تُلتقط بـ`try/catch` وتُتجاهل بأمان.
- **فهارس جيدة:** على `lawName`, `caseNo`, `court`, `decisionDate`, العلاقات، والتدقيق.
- **`reviewStatus = "needs_review"`** افتراضي على الأحكام والروابط → يفسّر لماذا كل الأحكام في الواجهة بوسم كهرماني «بانتظار مراجعة».
- **بيانات مرجعية ضخمة في `data/`** (~33MB): `saudi_systems.json` (10MB)، `legal-bm25-index.json.gz` (4MB، مُحزَّم مع دوال الخادم عبر `outputFileTracingIncludes`)، أشجار الفقه. هذه تُقرأ من نظام الملفات وقت التشغيل.

---

## 5) خط الذكاء الاصطناعي (AI/RAG) — المعمارية

### 5.1 طبقة المزوّد
```
getAiProvider()  ←  AI_PROVIDER (افتراضي: mock)
   ├─ claude/anthropic → claude-provider   (افتراضي claude-sonnet-4-6)
   ├─ openai           → openai-provider    (افتراضي gpt-4o-mini)
   ├─ gemini           → gemini-provider     (افتراضي gemini-1.5-flash)
   └─ mock/offline     → mock-provider (محاكاة حتمية)
   * أي مزوّد بلا مفتاح → سقوط منظّم إلى mock (لا يكسر أبدًا)
```
- 🟠 **تناقض السياسة:** الثلاثة مُفعَّلون بالتساوي رغم «Claude حصري». لوحة `/admin/ai` تتيح اختيار أي مزوّد.
- المفاتيح تُخزَّن **مشفّرة AES-256-GCM** في `app_settings` (اشتقاق من `AUTH_SECRET`)، مع سقوط لمتغيّرات البيئة. ✅ هندسة ناضجة.
- ⚠️ مفتاح الـ embeddings (OpenAI) يُستخدم من البيئة **بلا تشفير** — عدم اتساق.

### 5.2 خط RAG (8 مراحل)
```
سؤال → بحث هجين (15 نتيجة) → بناء سياق موزون → حارس الإسناد (حد أدنى مصادر/ثقة)
     → محرك الاستشهاد (تحقّق من DB) → توليد بالمزوّد (prompt صارم)
     → مُركّب الإجابة (أقسام) → نتيجة {answer, confidence, grounded, citations}
```
**الحواجز (Guardrails) — أقوى نقطة في المنصة:**
- `assertHasLegalArticles` يمنع أي مخرج بلا مواد من DB.
- `guardOutputAgainstUnknownArticleNumbers` يرفض أي رقم مادة غير موجود في السياق (regex على «المادة (XX)»).
- `verifyCitations` يتحقق من وجود كل استشهاد فعليًا في DB.
- prompt النظام: «يُمنع قول استقر القضاء دون رقم حكم»، «لا تختلق مادة». ← يحقّق هدف «0% هلوسة» في CLAUDE.md.

### 5.3 البحث الهجين — نضج المزوّدين
| المزوّد | الحالة | ملاحظة |
|---|---|---|
| PostgreSQL/BM25 | ✅ حقيقي | فهرس مبني مسبقًا (~16K مادة)، في الذاكرة، سريع |
| Vector (pgvector) | ⚠️ جزئي | يسقط لـ cosine داخل التطبيق إن لم تُملأ المتجهات |
| Knowledge Graph | 🟠 stub | الجدول ناقص على الإنتاج، يُتجاهل بـ try/catch |
| OpenSearch | ⬜ غير مُفعّل | كود جاهز + docker، معطّل (مناسب — لم يُبلغ 50K مستند) |

**رائحة:** صفحات/مسارات بحث متعدّدة (`legal-rag` + `legal-core/search` + `legal-search`) + معالجة عربية متقدّمة جدًا في `legal-retrieval.ts` (اشتقاق/جذر/ساق + 2967 مفهومًا) — قوية لكنها مبعثرة على المستخدم.

### 5.4 الاستدلال الأعلى
- `case-analysis` (تحليل + درجة قوة 0-100) · `legal-agent` (خطة عمل + دفوع موسومة verified/unverified) · `judicial-simulation` (محاكاة حكم + 3 تنبيهات: تدريبي/غير كافٍ/احتمالي).
- كلها: تحليل **حتمي (deterministic)** كأساس + إثراء AI اختياري فوقه → تعمل حتى بلا مزوّد. هندسة دفاعية ممتازة.
- 🟠 خدمتا API `case-analysis` و`legal-agent` **لا تُستدعيان إلا من صفحات الاختبار**.

---

## 6) خريطة الروابط (Link Graph)

### النتيجة: **صفر روابط ميتة/مكسورة** ✅
كل `href` و`redirect()` و`<Link>` و`action=` يشير لمسار موجود.

| الفئة | العدد |
|---|---|
| مسارات صفحات فعّالة | 36 |
| مسارات إعادة توجيه (aliases) | 8 |
| مسارات API | ~43 |
| روابط خارجية | خطوط Google Fonts + `sourceLink` للأحكام (من DB) |
| iframe | `/original-hakeem/hakim1111.html?embed=1` (القاضي التفاعلي) |

### عناصر معطّلة/خاملة ظاهرة (UI Controls)
| العنصر | الموقع | السبب |
|---|---|---|
| «تحرير» | `articles/[id]`, `legal-core.tsx` | زر بلا `onClick` |
| «ربط بمسألة» / «ربط بحكم» | `articles/[id]` | بلا handler |
| «ملفات داعمة لاحقًا» | `legal-core/search` | معطّل عمدًا (انتظار مستودع المرفقات) |
| خيارات «شرح/حكم/قانون مقارن — لاحقًا» | `legal-core/search` | `<option disabled>` |
| 8 لوحات إثراء «لم يتم الإثراء بعد» | `articles/[id]` | محتوى مرحلي |
| 4 طبقات معرفة «مرحلي» | `legal-core` | غير مفعّلة |
| أزرار النماذج `disabled` أثناء التحميل | عام | سلوك متوقّع (ليست أعطالًا) |

---

## 7) الأيقونات (مكرر من التهيص البصري — للاكتمال)
~40 أيقونة `lucide-react` + رموز نصية (`⌕ ↗ ✦ ①②③ ●○ ✓✕`). **مشكلة:** `Scale`/`Database`/`Sparkles` مُعاد استخدامها لخدمات مختلفة → ضعف التمييز البصري. (التفصيل الكامل في `visual-audit.md`).

---

## 8) اللغة والتدويل (i18n)
- **عربي مُصمَّت (hardcoded) بالكامل** في كل مكان — لا `next-intl` ولا `useTranslation` ولا ملفات `messages/`.
- `<html lang="ar" dir="rtl">`، خطوط IBM Plex Sans Arabic + Amiri (قضائي) + IBM Plex Mono (أرقام/استشهادات).
- لا توجد إنجليزية رغم أن CLAUDE.md يفترض حقول `text_en/nameEn`. الـ schema الفعلي **لا يحتوي حقولًا إنجليزية**.
- التنسيق العربي: `toLocaleString("ar-SA")` للأرقام والتواريخ. ✅
- **الأثر على إعادة التصميم:** أي دعم مستقبلي للإنجليزية = إعادة هيكلة كبيرة (استخراج كل النصوص لإطار i18n). القرار الآن: عربي فقط مقبول للسوق السعودي.

---

## 9) خلاصة الروائح المعمارية (Smells) وأولويات المعالجة

| # | المشكلة | الخطورة | التوصية |
|---|---|---|---|
| 1 | `DISABLE_AUTH=true` افتراضيًا = وصول مدير للعامة | 🔴 حرجة | اعكس الافتراضي / اضبط false للإنتاج + سرّ قوي |
| 2 | تناقض مزوّد الذكاء مع «Claude حصري» | 🟠 عالية | قرار: احذف openai/gemini أو حدّث CLAUDE.md |
| 3 | تناقض الـschema الفعلي مع CLAUDE.md | 🟠 عالية | حدّث CLAUDE.md ليطابق الواقع |
| 4 | `next-auth` مثبّت وميت | 🟡 متوسطة | احذفه من الحزم |
| 5 | 3 مسارات بحث متكرّرة | 🟡 متوسطة | وحّدها خلف واجهة واحدة |
| 6 | iframe قديم للقاضي (`hakim1111.html`) | 🟡 متوسطة | استبدله بمكوّن React أصلي |
| 7 | صفحات «اختبار» مكشوفة للمستخدم | 🟡 متوسطة | أخفِها خلف وضع «متقدّم/تجريبي» |
| 8 | KG/pgvector غير مملوءَين على الإنتاج | 🟡 متوسطة | شغّل سكربتات البذر/التعبئة |
| 9 | مفتاح embeddings بلا تشفير | 🟢 منخفضة | وحّد التشفير مع باقي المفاتيح |
| 10 | استخراج نص PDF/DOCX = TODO | 🟢 منخفضة | أكمل أو أخفِ الميزة |

---

## 10) التقييم النهائي (Scorecard)

```
المعمارية الطبقية   ████████░░ 8/10   فصل نظيف، اقتران محكم في الاستدلال
خط RAG/الحواجز      █████████░ 9/10   أقوى أصول المنصة
قاعدة البيانات       ████████░░ 8/10   مُحكمة، لكن متجهات/KG غير مملوءة
الأمان              ████░░░░░░ 4/10   الوضع الافتراضي مفتوح بالكامل
اتساق مع CLAUDE.md  █████░░░░░ 5/10   مخالفات في الذكاء والschema
سلامة الروابط        █████████░ 9/10   صفر روابط ميتة
اللغة/RTL           ███████░░░ 7/10   عربي ممتاز، صفر مرونة i18n
النضج البصري         ██████░░░░ 6/10   اختبارات مكشوفة + iframe
```

**الخلاصة:** منصة **قوية هندسيًا في العمق القانوني (RAG + الحواجز + المعالجة العربية)** — وهو بالضبط التمايز الذي يستهدفه CLAUDE.md ضد «قانونية». لكنها **هشّة في الأمان الافتراضي** ومُشتّتة في الواجهة (اختبارات مكشوفة، بحث مكرّر، iframe قديم). جاهزة للعرض، تحتاج تصليب الأمان وتنظيف الواجهة قبل الإنتاج الحقيقي.
