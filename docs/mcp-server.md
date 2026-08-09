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

## المصادقة (اختيارية)

عرّف `HAKEEM_MCP_KEY` في متغيرات البيئة لتفعيل الحماية بمفتاح. عندئذٍ يجب أن يمرّر
العميل المفتاح إمّا في ترويسة `x-api-key` أو كمعامل `?key=` في الرابط. تركه فارغًا
يُبقي الخادم مفتوحًا.

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

Settings → Connectors → Add custom connector → الرابط `https://<host>/mcp`
(أضف `?key=<المفتاح>` إن فعّلت المصادقة). ثم اسأل مثلًا:
«ابحث في حكيم عن مدد الاعتراض في نظام المرافعات الشرعية».
