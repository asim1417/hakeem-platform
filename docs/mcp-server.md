# خادم حكيم MCP — Model Context Protocol

يكشف مكنز حكيم القانوني (الأنظمة السعودية، موادها، والأحكام القضائية، والمكنز
الدلالي SKOS) عبر بروتوكول **MCP** كمصدر تشريعي رسمي تقرأ منه نماذج الذكاء
الاصطناعي مباشرةً — مع **حارس إحالات** يمنع اختلاق المواد.

## نقطة النهاية

```
https://<host>/mcp
```

المسار مُطبَّق كـ Next.js App Router Route Handler في `app/mcp/route.ts`
(GET / POST / DELETE، بيئة تشغيل Node لأن Prisma لا يعمل على Edge).

## الأدوات (١١ أداة)

| الأداة | الوظيفة | المصدر في المشروع |
|---|---|---|
| `hakeem_search` | بحث هجين (BM25 + دلالي) في المواد | `hybridSearch` (legal-search) |
| `hakeem_get_article` | نص مادة كاملًا بمعرّفها | `LegalArticle` |
| `hakeem_get_law` | بطاقة نظام + فهرس مواده | `LegalSystem` |
| `hakeem_bylaw_links` | روابط النظام بلوائحه (IMPLEMENTS) | `LegalRelation` |
| `hakeem_expand_terms` | توسيع مصطلح من المكنز SKOS | `legal-thesaurus` |
| `hakeem_search_rulings` | بحث في الأحكام القضائية | `hybridSearch` (نوع ruling) |
| `hakeem_verify_citation` | التحقق من صحة إحالة قبل عزوها | `LegalSystem` + `LegalArticle` |
| `hakeem_research` | بحث موضوعي شامل (توسيع مكنز + هجين + حصر لفظي، مجمّع حسب النظام) | `adapter` + `tools/research` |
| `hakeem_enumerate` | حصر لفظي كامل مع عداد إجمالي وترقيم cursor | `tools/enumerate` (SQL خام) |
| `hakeem_get_articles_range` | قراءة نطاق مواد متتابع بالنص الكامل (حتى ٢٠) | `LegalArticle` |
| `hakeem_guide` | دليل سير العمل للوكيل (نصّ ثابت) | `tools/range-and-guide` |

`hakeem_search` و`hakeem_search_rulings` و`hakeem_research` تعيد استخدام محرّك البحث
الهجين القائم (postgres + vector + knowledge-graph مع دمج RRF) — لا استعلام `contains` مبسّط.

طبقة الوصول للبيانات في `lib/mcp/adapter.ts` وأدوات الإصدار الثاني في
`lib/mcp/tools/`، وكلها مطابِقة لمخطط `prisma/schema.prisma` الفعلي. عقود المخرجات
(أسماء حقول JSON) ثابتة — هي الواجهة الرسمية للخادم فلا تُغيَّر.

`hakeem_enumerate` يطبّع العربية داخل SQL (تشكيل + صور الهمزة/الألف/التاء) عبر
`translate` نقيّ ليطابق `normalizeAr` — ويرتّب بالمعرّف لضمان ثبات الـ cursor.

### `hakeem_research` — فصل المسارين ودقّة الصلة (v2.1)

المبدأ: **حجة الشمول لفظية، وحجة الاسترجاع دلالية، ولا تُخلط العملتان**.

- **المسار اللفظي** (مصدر `total`/`by_law`/`exhaustive`): مشتقات رأس الموضوع فقط —
  الجذر ونمطا حشو الألف والواو (مثال: «فسخ» → `["فسخ","فساخ","فسوخ"]`)؛ لا بوادئ
  مولّدة (المطابقة الجزئية بـ ILIKE تغني عنها).
- **المسار الدلالي** (`hybridSearch`): الموضوع + صيغ المكنز المنقّحة بفلتر «يحتوي
  الرأس» — يُضمّ `broader` دائمًا، وتُسقط `synonyms`/`narrower` غير المتعلّقة (مثل
  «العقد» العام أو أنواع العقود).

حقول جديدة في المخرجات (إضافة فقط، بلا حذف أو إعادة تسمية):

| الحقل | المعنى |
|---|---|
| مُدخل `strict` (افتراضي `true`) | يقصر `grouped_by_law` على المواد التي تحتوي رأس الموضوع لفظًا؛ `false` يعرض نتائج الدلالي موسومة |
| `lexical_terms` | مشتقات الرأس المستعملة في الحصر اللفظي |
| `semantic_terms` | صيغ المكنز المنقّحة المستعملة في البحث الدلالي |
| `lexical_match` (لكل مادة) | هل المادة تحتوي رأس الموضوع لفظًا (تُطابق النصّ) |
| `coverage.semantic_only_excluded` | عدد نتائج الدلالي المُستبعَدة في وضع `strict` |

`terms_used` باقٍ (توافق خلفي) كاتحاد المسارين.

## الربط بحساب حكيم (الموصى به)

كل مستخدم يربط Claude أو ChatGPT **بحسابه** في حكيم: يُعرف صاحب كل طلب، ويُحسب
استهلاكه على باقته ورصيده، ويُلغى ربطه وحده من «التطبيقات المرتبطة» (`/dashboard/connections`).

التفعيل (بعد تطبيق هجرة `20261016180000_mcp_account_linking` — انظر `DB_RUNBOOK.md` › MCP-001):

```
MCP_TOKEN_SECRET=<سرّ عشوائي ≥ 32 حرفًا، مختلف لكل بيئة>
MCP_ACCOUNT_LINKING=1
MCP_USER_RATE_LIMIT=60            # اختياري: استدعاءات لكل مستخدم في الدقيقة
```

الرحلة: Connect في Claude ← `/oauth/authorize` يحفظ الطلب موقّعًا في كوكي ← `/connect/authorize`
(دخول حكيم إن لزم، ثم شاشة موافقة) ← رمز تفويض لمرة واحدة ← `/oauth/token`.

| الرمز | الصيغة | العمر | التخزين |
| --- | --- | --- | --- |
| تصريح وصول | `hk2.…` موقّع | ساعة | لا يُخزَّن؛ يُفحص الربط مع كل استدعاء |
| رمز تجديد | `hkr_…` | يُستبدل في كل تجديد | بصمته فقط في `mcp_grants` |
| رمز تفويض | `hka_…` | خمس دقائق، مرة واحدة | بصمته فقط في `mcp_auth_codes` |

- إعادة استعمال رمز تجديد قديم بعد دقيقة من تدويره، أو رمز تفويض مستعمل ← إلغاء الربط كله.
- الربط الخامل ٣٠ يومًا ينتهي ويلزم الربط من جديد.
- **الباقات والرصيد** في `config/mcp-tools.ts`: البحث والحصر يُحجزان ثم يُخصمان بعد النجاح فقط
  (`HYBRID_SEARCH`)، والقراءة بمعرّف والتحقق من الإحالة والدليل بلا خصم. أدوات `paid` للمشترك،
  أو لصاحب رصيد متاح حين يكون نظام الوحدات مفعّلًا، وللمشرفين دائمًا. قبل تفعيل الفوترة
  في القاعدة تبقى مفتوحة كبقية المنصة.
- كل استدعاء يُسجَّل في `audit_logs` (`AI_GATEWAY` / `MCP_TOOL_CALL`) باسم المستخدم والأداة
  والنتيجة والمدة — **بلا نص السؤال ولا النتيجة**.
- **مفاتيح شخصية** (`hk_live_…` بنطاق `mcp:read`) من `/dashboard/connections` للأدوات البرمجية،
  تُرسل في `Authorization: Bearer` وتُحسب على صاحبها.
- ChatGPT: عنوان الرجوع `https://chatgpt.com/connector_platform_oauth_redirect` (ونمط
  `connector/oauth/{id}`) ومعرّفات `https://chatgpt.com/oauth/…/client.json` مسموحة.
- المشرف يرى الروابط النشطة ويلغيها من `/admin/mcp-connections`.

## المفتاح المشترك (انتقالي، لفريق أمان)

يبقى `HAKEEM_MCP_KEY` مقبولًا في الترويسة (ورموز `hk1` القديمة حتى انتهائها) ويُسجَّل
كـ«داخلي». حين يُفعَّل الربط بالحساب تُعطَّل صفحة إدخال المفتاح. للإيقاف النهائي:
`HAKEEM_MCP_SHARED_KEY_DISABLED=1`.

## المصادقة بالمفتاح المشترك (المسار القديم)

عرّف `HAKEEM_MCP_KEY` في متغيرات البيئة لتفعيل الحماية بمفتاح. **الخادم مغلق افتراضيًا:**
عند غياب المفتاح وسرّ التصاريح يردّ `/mcp` بـ `503` ولا يكشف شيئًا (نسخ المعاينة مثلًا). للفتح العام الصريح ضع
`HAKEEM_MCP_ALLOW_OPEN=1` (والمفتاح إن وُجد يغلب هذا العلم).
محاولات المفتاح الفاشلة في `/oauth/authorize` محدودة بخمس لكل عنوان خلال ١٥ دقيقة
(أفضل جهد لكل نسخة تشغيل)، ورمز التفويض صالح دقيقتين. لمضيفات إضافية موثوقة
(نطاق مخصص خلف وكيل) استعمل `MCP_ALLOWED_HOSTS=a.example,b.example` أو
`NEXT_PUBLIC_SITE_URL`. المفتاح لا يُمرَّر في الرابط (`?key=` مرفوض حتى لا يتسرّب إلى
السجلات). عند غياب المفتاح أو رمز الوصول يردّ المسار `401` مع
`WWW-Authenticate` حتى يستطيع Claude بدء الربط.

طريقتان مقبولتان:

1. ترويسة ثابتة (بدون شاشة دخول): `x-api-key: <المفتاح>` أو
   `Authorization: Bearer <المفتاح>`. في Claude اختر **No sign-in** ثم أضف
   الترويسة من Request headers إن ظهرت لك.
2. زر **Connect** في Claude: يفتح صفحة `https://<host>/oauth/authorize`. أدخل
   مفتاح الموصل هناك. الخادم يصدر رمز وصول موقّعًا، ولا يحفظ المفتاح في الرابط.

بيانات الاكتشاف:

```
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-protected-resource/mcp
GET /.well-known/oauth-authorization-server
```

## ملاحظة تقنية: إصدار Zod

يبني خادم `@modelcontextprotocol/server` مخططاته على **Zod v4** ويتطلّب
`~standard.jsonSchema` (غير الموجود في Zod v3 المعتمد في بقيّة المشروع). لذلك
يستورد `app/mcp/route.ts` وحده Zod v4 عبر الاسم المستعار `zodv4`
(`"zodv4": "npm:zod@^4"` في `package.json`) — دون المساس بـ `zod` v3 في سائر الكود.

## اختبار محلي

```bash
npm run build          # prisma generate && next build
npx @modelcontextprotocol/inspector   # على http://localhost:3000/mcp
```

جرّب `hakeem_search` بكلمة «الإفلاس»، و`hakeem_verify_citation` بمادة معروفة.

## الربط بعميل (Claude)

Settings → Connectors → Add custom connector → الرابط `https://<host>/mcp`.
ثم اضغط Connect وأدخل مفتاح الموصل في صفحة حكيم. بعدها اسأل مثلًا:
«ابحث في حكيم عن مدد الاعتراض في نظام المرافعات الشرعية».
