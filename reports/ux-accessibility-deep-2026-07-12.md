# تدقيق تجربة المستخدم والوصول الرقمي — منصة حكيم (تمريرة معمّقة)

**التاريخ:** 2026-07-12 · **الفرع:** `claude/legal-platform-audit-ii0r3u` · **وثيقة توثيق (بلا تعديل كود)**
**مكمّل لـ:** `reports/global-audit-2026-07-12.md`
**النطاق:** كامل مجموعات الصفحات (لا `/documents*` فقط) · تحليل ساكن للكود (No app render) · الوسم: `[code-verified]` مؤكَّد من الكود / `[render-unverifiable]` يحتاج تشغيلاً فعلياً · Next.js 14 App Router · Tailwind · RTL عربي.

## الإيجابيات العامة (تُذكر مرة واحدة) — `[code-verified]`
- **Skip link:** `components/AppShell.tsx:87` + `app/globals.css:177-178` (WCAG 2.4.1). غير موجود في الصفحات العامة خارج AppShell — §1.
- **Focus مرئي موحّد:** `app/globals.css:180-184` (2.4.7).
- **MobileNav:** `aria-label` ديناميكي + `aria-expanded` + إغلاق Esc + الغطاء `components/MobileNav.tsx:49-51,34-37`.
- **SearchAutocomplete نموذجي (combobox APG):** `role=combobox/listbox/option` + `aria-expanded/haspopup/owns/activedescendant` + تنقّل أسهم/Enter/Esc `components/SearchAutocomplete.tsx:83-153`.
- **ArticleTabs:** `role=tablist/tab/tabpanel` + `aria-selected` `components/ArticleTabs.tsx:19-43` (ينقصه `aria-controls`/أسهم).
- **ArticleReadingTools:** `role=toolbar` + `aria-pressed` + `aria-label` `components/ArticleReadingTools.tsx:50-56`.
- **زر كشف مفتاح AI:** `aria-label`+`aria-pressed`+`title` `components/admin/AiSettingsManager.tsx:205-206` (قدوة).
- **صفحات الحالة العامة:** `app/loading.tsx` (`role=status`), `not-found.tsx`/`error.tsx` بـ`h1` وهوية موحّدة.
- **الشارات تجمع اللون + النص** (لا لون وحده): `app/admin/page.tsx:127-131`, `AdminUsersManager.tsx:132`.

---

## 1) تدقيق الوصول صفحة-بصفحة (كل المجموعات)

> المكوّنات التي تلفّ الحقل داخل `<label>` (نص في `<span>`) = **مُوسَّمة ضمنياً وصحيحة** (ليست ثغرة): `CasesManager`, `ConsultationForm`, `AttachmentsManager`, `AdminUsersManager`, `AdminApiKeysManager`, `AiSettingsManager`, `knowledge-graph` — استُبعدت من قائمة «غير المُوسَّم».

| الصفحة/المجموعة | مشكلة a11y [WCAG] | file:line | الخطورة |
|---|---|---|---|
| الرئيسية (HomeHero) | لا Skip link؛ شعار كـ`<p>`؛ إجمالاً سليمة | `components/home/HomeHero.tsx:55,67,112` | 🟢 |
| البحث العام /search | لا Skip link بالغلاف العام؛ input مُوسَّم | `app/search/page.tsx:44-51` | 🟢 |
| الغلاف العام | لا `<h1>`، لا Skip link، `<nav>` بلا `aria-label` [1.3.1/2.4.1] | `components/public/PublicLegalShell.tsx:5-15` | 🟡 |
| فهرس الأنظمة /legal | لا حالة فارغة صريحة؛ العناوين سليمة | `app/legal/page.tsx:52-73` | 🟢 |
| عرض المادة | `dangerouslySetInnerHTML` لـ JSON-LD (خامل، آمن) | `legal/[slug]/[article]/page.tsx:75`، `legal/page.tsx:43`، `legal/[slug]/page.tsx:60` | 🟢 |
| النواة: بحث النواة | **4 `<select>` بلا اسم** + input باسم مفقود [1.3.1/3.3.2/4.1.2] | `dashboard/legal-core/search/page.tsx:131,138,145,160,168` | 🔴 |
| النواة: خيارات «لاحقًا» معطّلة | `<option disabled>شرح/حكم/مقارن - لاحقًا` | `legal-core/search/page.tsx:171-173` | 🟡 |
| LegalCoreSearchBar | input بلا اسم + `<select>` بلا اسم + **6 «فلاتر» وهمية `<div>` غير تفاعلية** [4.1.2] | `components/legal-core.tsx:80,87,100-106` | 🔴 |
| النواة: الأحكام | input بلا اسم + `<select court/city>` بلا اسم | `legal-core/judgments/page.tsx:152,159,163` | 🔴 |
| النواة: المبادئ | مُوسَّمة صحيحاً (`<label htmlFor>`) | `legal-core/principles/page.tsx:92,96,105` | 🟢 |
| النواة: صفحة المادة | 6/9 تبويبات `Placeholder` فارغ؛ أزرار ميتة «تحرير/ربط»؛ Tabs بلا `aria-controls`/أسهم | `legal-core/articles/[id]/page.tsx:175,190-193,207,276,277` | 🟡 |
| CoreIntelligenceDashboard | **3 `<select>` + input بلا اسم** + ألوان خام | `components/CoreIntelligenceDashboard.tsx:229,234,245,250` | 🔴 |
| اسأل حكيم (Ask) | `textarea` بلا اسم؛ لا `aria-live` للنتائج المتدفّقة؛ ✦ غير `aria-hidden` | `components/agent/AgentSearchPanel.tsx:249,123,203` | 🟡 |
| تحليل القضية | 4 حقول بلا اسم؛ عناوين `<div>` لا `<h2/h3>`؛ لا loading/empty | `dashboard/case-analysis/page.tsx:57-63,83,104,125` | 🔴 |
| المحاكاة القضائية | 8 حقول بلا اسم (منها `<select partyRole/stage>`)؛ عناوين `<div>`؛ لا loading/empty | `dashboard/judicial-simulation/page.tsx:70-90` | 🔴 |
| الوكيل القانوني | 7 حقول بلا اسم (منها `<select partyRole>`)؛ عناوين `<div>` | `dashboard/legal-agent/page.tsx:60-74` | 🔴 |
| Legal RAG (اختبار) | input بلا اسم؛ عناوين `<div>`؛ ⚠ غير `aria-hidden`؛ ألوان خام كثيفة | `dashboard/legal-rag/page.tsx:32,135,43,93` | 🟡 |
| Legal Chat | `textarea` بلا اسم؛ `<select>` مرفق بلا اسم؛ **IconBtn 📎🎙️⚙️ اسمها من `title` فقط**؛ لا `role=status` | `components/legal-chat/LegalChatWorkspace.tsx:497,470,514-516,332` | 🟡 |
| Knowledge Graph | input مُوسَّم؛ لكن لصق **UUID خام** يدوياً (احتكاك)؛ ألوان خام | `dashboard/knowledge-graph/page.tsx:85-92,107-112` | 🟡 |
| الإعدادات (admin/settings) | **الثغرة الوحيدة الحقيقية لـ input غير مُوسَّم**: الوسم في `<div>` شقيق لا `<label htmlFor>` | `components/AdminSettingsForm.tsx:75,81-89` | 🔴 |
| الأدوار (RBAC) | تخطّي h1→h3؛ حالة المنح **باللون فقط** [1.4.1]؛ لا focus-ring | `components/admin/RolePermissionsEditor.tsx:45,55,63` | 🟡 |
| جداول الإدارة/التدقيق | `<th>` بلا `scope="col"` [1.3.1] | `AdminUsersManager.tsx:107-112`, `AdminApiKeysManager.tsx:116-122`, `audit-logs/page.tsx:35-39`, `developers/page.tsx:79-81` | 🟡 |
| القاضي التفاعلي (iframe) | **الأخطر:** التطبيق داخل `<iframe>` معتم؛ **صفر `aria-live`**، **101 `<div onclick>` بلا `role=button`** (لا كيبورد)، `<h1>` متعدد وتخطّي مستويات، `<select>` بلا اسم، labels بلا `for` | `dashboard/simulations/page.tsx:12-17`؛ `public/original-hakeem/hakim1111.html` | 🔴 |
| CaseBrowser (الوثائق) | **`<div onClick>` غير قابل للكيبورد**؛ `dangerouslySetInnerHTML` لمحتوى مستند/OCR (سطح XSS إن غير موثوق) | `components/documents/CaseBrowser.tsx:1788,1792,2019,2185` | 🟡 |

**قائمة `dangerouslySetInnerHTML`:** `legal/page.tsx:43`، `legal/[slug]/page.tsx:60`، `legal/[slug]/[article]/page.tsx:75` (JSON-LD خامل — آمن)؛ `CaseBrowser.tsx:2019,2185` (HTML مُلوَّن من نص المستند — يجب تأكيد التطهير) `[render-unverifiable]`.

**عناصر `<div>` تفاعلية:** `CaseBrowser.tsx:1788,1792` (فعلية)، خلفيات مودالات `1976,2483,2524,2547,2589` (backdrop بلا كيبورد)، «فلاتر» وهمية `legal-core.tsx:100-106`، **101 عنصر** داخل `hakim1111.html`. **لا يوجد أي `<img>`** (الأيقونات lucide/SVG) — إيجابي.

**أيقونة-كنص غير زخرفية:** `IconBtn 📎🎙️⚙️` اسمها من `title` فقط `LegalChatWorkspace.tsx:514-516`. رموز زخرفية غير `aria-hidden`: `✦` `dashboard/page.tsx:110`, `AgentSearchPanel.tsx:123,203`؛ `⚖` `LegalChatWorkspace.tsx:300-302`؛ `⚠` `legal-rag/page.tsx:43,93`. المحارف `⌕` كلها `aria-hidden` — سليمة.

---

## 2) تدفقات المستخدم خطوة-بخطوة

> **حاكم:** المصادقة **معطّلة افتراضياً** (`middleware.ts:6-13`) → تُتجاوز خطوة الدخول وتظهر «المستخدم التجريبي» (`AppShell.tsx:117`). الذكاء **mock/deterministic افتراضياً** بلا مفتاح (`ai-provider.ts:16,38`, `ai-config.ts:86`).

### (أ) زائر عام: landing → search → article → register
1. **Landing** `HomeHero.tsx:76-93` — مبدّل «ابحث/اسأل»؛ يعمل. زر «اسأل» يوجّه لـ`/dashboard/ask` خلف حارس (مُعطّل افتراضياً).
2. **Search** `/search` — بحث نواة حقيقي، بطاقات، حالة فارغة (`:66-70`) وصفر نتائج (`:99-103`).
3. **Article** — «فتح المادة كاملةً» يقود لـ`legal-core/search` مع لافتة «يتطلب الدخول» (`:89-94`)؛ الصفحة العامة `/legal/[slug]/[article]` تعمل بذاتها.
4. **Register** — **لا صفحة تسجيل** (`app/(auth)/register` غير موجودة رغم CLAUDE.md)؛ فقط `/login`. **فجوة رحلة:** «خيار الفرد» المُميِّز عن قانونية غير مُنفَّذ في UI. `[code-verified]`

### (ب) محامٍ: login → dashboard → new case → analyze → citations
1. **Login** `LoginForm.tsx` — مُوسَّم، loading/error، Google اختياري (يُتجاوز افتراضياً).
2. **Dashboard** `dashboard/page.tsx` — بطاقات + «تابع عملك»؛ خطأ الإحصاءات `:116`؛ ألوان خام.
3. **New case** `CasesManager.tsx` — نموذج مُوسَّم، فارغ `:124`، خطأ `:119`؛ يحفظ فعلياً (Prisma+audit).
4. **Analyze** `case-analysis/page.tsx` — **بلا loading/empty**؛ حقول بلا اسم؛ **no-op صامت**: إدخال <10 أحرف يعيد التحميل بلا رسالة (`:30`). الذكاء rule-based افتراضياً (`case-analysis-engine.ts:161-235`, `generated:false`) موسوم بشارة المزوّد `:86`.
5. **Citations** — من `LegalBasisPanel` بمعرّفات حقيقية `internalUrl` — يطابق CLAUDE.md؛ عناوين الأقسام `<div>`.

### (ج) بحث قانوني: topbar → results → filters → article → related/fiqh
1. **Topbar/Autocomplete** — نموذجي.
2. **Results** `legal-search/page.tsx` — الأمتن: فلاتر نوع/متقدّمة (كل `<select>` **مُوسَّم بـ`aria-label`** `:234-295`)، ترتيب `aria-current` `:329`، حالات كاملة `:456-473`، شارات مزوّدات، «عيّنة تجريبية». قدوة.
3. **Article** `articles/[id]` — بنية دلالية قوية (`dl/dt/dd`, Tabs)؛ **احتكاك:** 6/9 تبويبات فارغة؛ الفقه/المواد ذات الصلة حقيقية.
4. **related/fiqh** — تبويب الفقه بتنويه عدم الإلزام + `ShieldAlert` `:182-186` — ممتاز؛ «المقارن/الشرح» stub.

### (د) محاكاة قضائية: start → judge turns → judgment → appeal
1. **Start** `simulations/page.tsx:12-17` — **iframe لملف ساكن 7,629 سطراً** (`hakim1111.html`)؛ أنواع «عمالية/مدنية» **معطّلة «قريباً»** (`:2120,2124`)، **18 قضية DEMO** ثابتة.
2. **Judge turns** — القاضي **AI حقيقي** عبر `/api/original-hakeem/ai`→`callCentralProvider` (`ai-gateway.ts:187-196`) بسقوط offline. مؤشّر بصري `:5057`. **لكن صفر `aria-live`** → صامت لقارئ الشاشة.
3. **Judgment/appeal** — **انفصام معماري:** محرّك `/api/simulations/*` + `judge-engine.ts` + صفحات `[id]/appeal|cassation|reconsideration` هو **آلة حالات بلا AI** (`judge-engine.ts:175-333`)، **معزول تماماً** عن الـiframe. `buildAppealDraft` → `"TODO: ... لاحقًا"` (`hakeem-judge.ts:102-109`). النماذج الثلاثة تُرسل لنفس endpoint (`PostJudgmentRemedyForm.tsx:77`). الـiframe لا يُنشئ صف `prisma.simulation` → **رحلة Next.js لا تُبلَغ عملياً**. `[code-verified]`

### (هـ) admin: login → users/roles → content → audit
1. **Users** `AdminUsersManager` — CRUD حقيقي (bcrypt+audit)؛ **تبديل التفعيل بلا loading-guard** (سباق `:65-80`) و**بلا تأكيد** `:140`؛ كلمة المرور المؤقتة في `<p>` غير حيّ `:57`؛ تناقض نص `users/page.tsx:31`.
2. **Roles** — منح/سحب فوري **بلا تأكيد** `:62`؛ زر `px-2 py-0.5` ≈18px.
3. **AI/API-keys** — يحفظ فعلياً؛ كشف المفتاح **مؤكَّد** — قدوة؛ لكن **سحب مفتاح API بلا تأكيد** `AdminApiKeysManager.tsx:150`.
4. **Content** — النواة/المبادئ/الأحكام (§1).
5. **Audit** `audit-logs/page.tsx` — قراءة فقط؛ **بلا ترقيم/فلترة/بحث** وسقف `take:50` `:11`؛ خطأ DB يظهر كفارغ `:19`.
6. **/settings** — يعيد لـ`/admin`؛ لكن `admin/settings` **لا يستخدم AppShell** — تفاوت landmarks.

---

## 3) اتساق التصميم والتجاوب

| البند | الحالة | الدليل |
|---|---|---|
| ألوان خام خارج الهوية | **154 استخداماً في 24 ملفاً** | `CoreIntelligenceDashboard`(37)، `legal-rag`(23)، `legal-intelligence`(22)، `knowledge-graph`(12)، `RolePermissionsEditor`(9)، `admin/page`(7)، `CasesManager/AttachmentsManager/TrainingWorkspace`(6)، `developers`(5)، `dashboard`(4) |
| aliases الهوية | `olive→navy`, `sand→#F8FAF9`, `gold/ink` (تُصيَّر بالهوية — ليست ثغرة) | `tailwind.config.ts:15-28` |
| Breakpoints | Desktop-first؛ انهيار وحيد `max-width:1024px`؛ الباقي Tailwind؛ لا `sm` مخصّص | `globals.css:405-426` |
| أهداف اللمس <44px | منتشرة: `.btn`≈33-38px؛ inputs≈36px؛ **منح الصلاحية ≈18px (الأسوأ)**؛ `<select>` مرفق≈24px؛ Tabs≈30px؛ ReadingTools≈28px | `globals.css:202`؛ `RolePermissionsEditor.tsx:63`؛ `LegalChatWorkspace.tsx:473` |
| هدف صحيح | `.send-btn` **44×44** | `globals.css:386` |
| RTL | `html dir=rtl` + خصائص منطقية + تجاوزات `dir=ltr` للأكواد | `globals.css:451`؛ `AiSettingsManager.tsx:178` |
| RTL نقطي | أسهم `←/→`/`Chevron` قد تبدو معكوسة في RTL — مراجعة | `articles/[id]/page.tsx:249,254` `[render-unverifiable]` |
| الخطوط | Google Fonts عبر `<link>` لا `next/font` → **FOUT + تبعية خارجية** | `layout.tsx:16-21` |
| تباين محتمل | `--ink-40` (rgba .40 على أبيض) قد يفشل 4.5:1 [1.4.3] | `globals.css:212,322` `[render-unverifiable]` |

---

## 4) تغطية الحالات (loading/empty/error)

| الصفحة | loading | empty | error | file:line |
|---|---|---|---|---|
| /search | ✗(خادمي) | ✓ | ✓ | `search/page.tsx:66,99` |
| legal-search | ✗ | ✓ | ✓ | `legal-search/page.tsx:456,467,376` |
| articles/[id] | ✗ | ✓ | ✓ | `articles/[id]/page.tsx:89,168` |
| المبادئ | ✗ | ✓ | — | `principles/page.tsx:141` |
| الأحكام | ✗ | ✓ | — | `judgments/page.tsx:180` |
| Ask | ✓(تدفّق) | ✓ | ✓ | `AgentSearchPanel.tsx:163,121,193` |
| تحليل القضية | **✗** | **✗** | ✓ | `case-analysis/page.tsx:70` |
| المحاكاة القضائية | **✗** | **✗** | ✓ | `judicial-simulation/page.tsx:98` |
| الوكيل القانوني | **✗** | **✗** | ✓ | `legal-agent/page.tsx:82` |
| Legal RAG | **✗** | **✗** | ✓ | `legal-rag/page.tsx:41,91` |
| Legal Chat | ✓ | ✓ | ✓ | `LegalChatWorkspace.tsx:379,298,332` |
| الاستشارات | جزئي | — | ✓ | `ConsultationForm.tsx:118,122` |
| القضايا | جزئي | ✓ | ✓ | `CasesManager.tsx:117,124,119` |
| المرفقات | جزئي | لافتة stub | ✓ | `AttachmentsManager.tsx:155,89,159` |
| القاضي (iframe) | ✓(بصري) | ✗ | ✗(لا fallback 404) | `hakim1111.html:5057` |
| appeal/cassation/recon | جزئي | ✓ | ✓ | `PostJudgmentRemedyForm.tsx:152,95,155` |
| admin | ✗ | ضمني | جزئي | `admin/page.tsx:11,15` |
| admin/users | جزئي | ✓ | ✓(يُبتلع) | `AdminUsersManager.tsx:100,96` |
| admin/roles | ✓ | **✗** | ✓ | `RolePermissionsEditor.tsx:61,35` |
| admin/ai | ✓ | ✓ | ✓ | `AiSettingsManager.tsx:218,126,225` |
| admin/api-keys | جزئي | ✓ | ✓ | `AdminApiKeysManager.tsx:82,110,105` |
| admin/settings | جزئي | **✗** | ✓ | `AdminSettingsForm.tsx:113,97` |
| audit-logs | ✗ | ✓ | **✗**(خطأ=فارغ) | `audit-logs/page.tsx:28,19` |
| knowledge-graph | ✗ | ✓ | ✓ | `knowledge-graph/page.tsx:116,60` |

**نمط منهجي:** صفحات النماذج الخادمية (تحليل/محاكاة/وكيل/RAG) **بلا loading/empty** مع **no-op صامت**. **لا `aria-live`/`role=status`** على أي نتيجة/خطأ في المنصة كلها (WCAG 4.1.3).

---

## 5) الدرجات + أعلى 10 توصيات

### الدرجات (0–10)
| المحور | الدرجة | المبرّر |
|---|---|---|
| البنية الدلالية/Landmarks | 7.0 | AppShell/skip-link/nav قوية، `dl`/`role=tab/toolbar/combobox` نموذجية؛ خُصمت لعناوين `<div>`، تخطّي h1→h3، غياب landmarks في `/admin/settings` |
| توسيم النماذج | 5.0 | نصفها صحيح، لكن **~30 حقلاً** بلا اسم في النواة/التحليل/المحاكاة/الوكيل/RAG/الإعدادات |
| التشغيل بالكيبورد | 4.0 | **101 `<div onclick>`** في قلب المنتج (iframe) + CaseBrowser + غياب أسهم Tabs |
| رسائل الحالة (4.1.3) | 2.5 | **صفر `aria-live`**؛ أسرار تُعرض دون إعلان |
| تغطية الحالات (UX) | 5.5 | ممتازة في legal-search/chat/ask؛ منعدمة في 4 صفحات نماذج |
| اتساق الهوية | 6.5 | tokens ناضجة؛ 154 لوناً خاماً في 24 ملفاً |
| الاستجابة/أهداف اللمس | 4.5 | طيّ سليم؛ أغلب الأزرار <44px (أدنى 18px) |
| سلامة الرحلة | 4.0 | البحث/التحليل متين؛ القاضي منفصم + TODO stub، لا تسجيل/خيار فرد، 6/9 تبويبات فارغة |
| **Overall a11y** | **4.7** | أساسات ممتازة مقوّضة بتوسيم النماذج وiframe غير الدلالي وغياب aria-live |
| **Overall UX** | **5.5** | بحث/استشهاد راقٍ؛ يشوبه stubs ظاهرة، حالات ناقصة، أهداف لمس صغيرة |

### أعلى 10 توصيات (بالأثر)
1. **`aria-live`/`role=status|alert` لكل النتائج والأخطاء والأسرار.** الآن صفر. `ui/legal.tsx:29`, `AgentSearchPanel.tsx:193`, `AdminApiKeysManager.tsx:90`. WCAG 4.1.3.
2. **توسيم ~30 حقلاً غير مُوسَّم.** `legal-core/search:138-168`, `case-analysis:57-63`, `judicial-simulation:70-90`, `legal-agent:60-74`, `legal-rag:32`, `CoreIntelligenceDashboard:229-250`, `AdminSettingsForm:81`, `hakim1111.html:3698,3700`. 1.3.1/4.1.2.
3. **تحويل 101 `<div onclick>` + CaseBrowser إلى `<button>`/كيبورد.** `hakim1111.html`, `CaseBrowser.tsx:1788,1792`. 2.1.1/4.1.2.
4. **معالجة انفصام القاضي + إزالة stub.** `hakeem-judge.ts:102-109`, `PostJudgmentRemedyForm.tsx:77`, `simulations/page.tsx:12`.
5. **رفع أهداف اللمس ≥44px.** `globals.css:202`, `RolePermissionsEditor.tsx:63`, `LegalChatWorkspace.tsx:473`. 2.5.5.
6. **loading+empty للصفحات الأربع + إبطال no-op الصامت.** case-analysis/judicial-simulation/legal-agent/legal-rag.
7. **تأكيد الإجراءات المدمّرة + قفل السباق.** `AdminApiKeysManager.tsx:150`, `AdminUsersManager.tsx:140`, `RolePermissionsEditor.tsx:62`.
8. **تنظيف الألوان الخام (154→0) + ترقية/إخفاء الصفحتين التجريبيتين.** `AppShell.tsx:52-53`.
9. **إصلاح الأزرار الميتة والتبويبات الفارغة والفلاتر الوهمية.** `articles/[id]:207,276-277`, `legal-core.tsx:100-106`.
10. **استضافة الخطوط ذاتياً (`next/font`) + ترتيب العناوين + `scope` للجداول + skip-link للعامة.** `layout.tsx:16-21`, `RolePermissionsEditor.tsx:45`, `PublicLegalShell.tsx`.

---

**ملخص:** أساسات الوصول **متقدّمة في المكوّنات المشتركة** (combobox/tabs/toolbar/skip-link/focus-visible/شارات لون+نص) وتجربة البحث/الاستشهاد راقية ومطابقة لقاعدة «لا هلوسة». لكن ثلاث فجوات منهجية تخفض الدرجة: (1) **غياب `aria-live` كلياً** + ~30 حقلاً بلا اسم، (2) **القاضي التفاعلي iframe غير دلالي** ومحرّك المحاكاة معزول مع stub، (3) **حالات وأهداف لمس ناقصة** في صفحات النماذج. التوصيات 1–5 تعالج غالبية الأثر بأقل تغيير هيكلي.
