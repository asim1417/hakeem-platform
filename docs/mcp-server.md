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

## الأدوات السبع

| الأداة | الوظيفة | المصدر في المشروع |
|---|---|---|
| `hakeem_search` | بحث هجين (BM25 + دلالي) في المواد | `hybridSearch` (legal-search) |
| `hakeem_get_article` | نص مادة كاملًا بمعرّفها | `LegalArticle` |
| `hakeem_get_law` | بطاقة نظام + فهرس مواده | `LegalSystem` |
| `hakeem_bylaw_links` | روابط النظام بلوائحه (IMPLEMENTS) | `LegalRelation` |
| `hakeem_expand_terms` | توسيع مصطلح من المكنز SKOS | `legal-thesaurus` |
| `hakeem_search_rulings` | بحث في الأحكام القضائية | `hybridSearch` (نوع ruling) |
| `hakeem_verify_citation` | التحقق من صحة إحالة قبل عزوها | `LegalSystem` + `LegalArticle` |

`hakeem_search` و`hakeem_search_rulings` يعيدان استخدام محرّك البحث الهجين القائم
(postgres + vector + knowledge-graph مع دمج RRF) — لا استعلام `contains` مبسّط.

طبقة الوصول للبيانات في `lib/mcp/adapter.ts`، وهي مطابِقة لمخطط
`prisma/schema.prisma` الفعلي. عقود المخرجات (أسماء حقول JSON) ثابتة —
هي الواجهة الرسمية للخادم فلا تُغيَّر.

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
