# تسليم: الفهرسة والصفحات المعطلة أو الموقوفة — 29/10/2026

> لوكيل يكمل البحث (Claude Code أو غيره). كل رقم هنا من قياس فعلي يوم 29/10 (الإنتاج: Neon `misty-base-66693229` الفرع `br-rapid-salad-aq782ea2`، وVercel `prj_wJLAcWVw3StcZpNVp9AhiGHsjqV0`، والموقع hakeemai.net).
> المصدر: جلسة HKM-045/053/054/058/059. سطور السجل المقابلة في `docs/PROJECT_STATUS.md` (ابحث عن HKM-054 وHKM-058 وHKM-059).

## قبل أن تبدأ

1. اقرأ `AGENTS.md` و`docs/PROJECT_STATUS.md` و`docs/project-control/LANES.md` من أحدث main، وافحص الطلبات المفتوحة.
2. **المعرّفات المستعملة حتى الآن تصل إلى HKM-060.** احجز رقمًا جديدًا (HKM-061 فما بعد) بعد فحص main والطلبات المفتوحة.
3. لا تكتب على محتوى قاعدة الأنظمة (مسار جلسة التنفيذ HKM-052). المتجهات وsearch_norm والنشر والقياس مسار جلسة القياس.
4. لا تطبع DATABASE_URL ولا أي سرّ، ولا تعطّل TLS.

## الملخص

| # | البند | الحالة | الخطورة | من يصلحه |
|---|---|---|---|---|
| 1 | OpenSearch (Bonsai) | **موقوف من المزوّد** منذ 22/10 على الأقل، وفهرسه قديم منذ 18/10 | عالية | المالك (حساب Bonsai)، ثم إعادة فهرسة |
| 2 | سجل OpenSearch يقول `ok` وهو معطّل | يخفي التعطل | متوسطة | كود |
| 3 | الصرف العربي في البحث | سوابق ولواحق فقط؛ لا جذر ولا جمع تكسير | عالية | كود |
| 4 | `hakeem_search` بلغة الناس | يفشل في أسئلة عامية/حوارية | عالية | كود + مقياس |
| 5 | المتجهات | تعمل 100%، وتضعف مع الأسئلة القصيرة | متوسطة | قياس نموذج أقوى |
| 6 | فهرسة محركات البحث (SEO) | canonical وsitemap وrobots تشير إلى `hakeem-platform.vercel.app` لا `hakeemai.net` | عالية | متغير بيئة أو كود |
| 7 | صفحات المواد خارج sitemap | 29,704 صفحة مادة غير مدرجة | متوسطة | كود |
| 8 | 22 نظامًا فارغًا | صفحاتها 200 بلا `noindex` | متوسطة | كود (noindex) + محتوى (جلسة التنفيذ) |
| 9 | مهلة 300 ث على /mcp | **مُصلَحة** (#935) ومتحقق منها | — | منجز |
| 10 | صفحات الموقع | لا صفحة معطلة (فحص كامل أدناه) | — | — |

---

## 1. OpenSearch موقوف

**الدليل:**
- فهرسة عيّنة عبر `index-opensearch.yml` (run 40907503130، 29/10 ~16:05 UTC) فشلت بـ:
  `تعذّر إنشاء الفهرس legal_articles: 403 {"code":403,"message":"Cluster has been disabled. Please contact support@bonsai.io for further details."}`
- آخر فهرسة ناجحة: 18/10 06:07 UTC. محاولة 22/10 فشلت: `bulk فشل: 403`.
- منذ 18/10 في القاعدة: 1,006 مادة جديدة، و3,901 مادة متغيرة، و549 مادة لها نسخة نص معدّلة جديدة، و34 نظامًا جديدًا. فحتى لو عاد العنقود كما هو فالفهرس قديم.

**الملفات:**
- `lib/modules/legal-search/providers/opensearch-provider.ts` — المزوّد. `isAvailable()` يفحص `/_cluster/health`، و`search()` يرجع `[]` عند `!res.ok` بصمت.
- `scripts/index-opensearch.ts` و`.github/workflows/index-opensearch.yml` — الفهرسة (مدخلات: `confirm=INDEX`، `scope=all|sample`، `index_suffix`).
- `.github/workflows/verify-search-index.yml` — آخر تشغيل 03/07.
- `lib/modules/legal-search/hybrid-search.ts` — `ALL_PROVIDERS` (postgres، vector، knowledge_graph، opensearch) ودمج RRF.
- النواة `lib/modules/legal-core/legal-retrieval.ts` فيها إشارة OpenSearch خامسة (`CORE_OPENSEARCH`، `options.openSearch`).

**المطلوب:**
1. المالك يفعّل العنقود من حساب Bonsai (فوترة/اشتراك/دعم) أو يقرر بديلًا (OpenSearch مُدار آخر، أو الاكتفاء بـ PostgreSQL — قاعدة CLAUDE.md: «لا تضف أداة حتى يثبت PostgreSQL عجزه»).
2. بعد التفعيل: `index-opensearch.yml` بـ `scope=all` (يفضّل `index_suffix=_v2` ثم التبديل)، ثم `verify-search-index.yml`.
3. قياس أثره قبل/بعد: `eval-search.yml` بـ `core_opensearch=0` و`1`.

## 2. السجل يخفي تعطل OpenSearch

سجل الإنتاج يكتب `[search] provider=opensearch ms=18 outcome=ok` في كل بحث، لأن `outcome` في `hybrid-search.ts` يعني «لم يرمِ استثناء»، والمزوّد يرجع `[]` عند 403.
**المطلوب:** أن يسجل المزوّد حالة HTTP عند الفشل (مثلًا `outcome=http_403`) أو يرمي فيُسجَّل `unavailable`، وتنبيه حين يفشل باستمرار. لا يغيّر النتائج.

## 3. الصرف العربي ضعيف

`lib/mcp/tools/word-match.ts` — `compileTerm(term, "derivatives")` يطابق بسوابق ولواحق فقط. اختبار مباشر (29/10):

| اللفظ | النص | النتيجة |
|---|---|---|
| فصل | «إذا فُصل العامل» | ✓ |
| الموظف | «الموظفين والموظفات» | ✓ |
| التصفية | «وتصفيته» | ✓ |
| العقد | «العقود» | ✗ (جمع تكسير) |
| عقد | «المتعاقدين والتعاقد» | ✗ (جذر) |
| الاستئناف | «يستأنف» | ✗ (جذر/فعل) |
| طلاق | «المطلقة» | ✗ (جذر) |
| فصلوه | «فصل» | ✗ (ضمير متصل في العامية) |

**المعايير المرجعية:** مجذّع خفيف عربي (Light10، Larkey 2002) أو مجذّع ISRI، مع قاموس جذور/جموع تكسير؛ محلل `arabic` في OpenSearch/Lucene (تطبيع + تجذيع خفيف). وفي المشروع: `lib/modules/legal-core/arabic-morphology.ts` و`lib/modules/legal-thesaurus/` (مكنز) — افحص ما يمكن إعادة استعماله.
**المطلوب:** توسيع اللفظ بالجذر وجمع التكسير، مقاسًا على مجموعة أسئلة (البند 4) قبل وبعد، بلا تراجع في البوابات.

## 4. `hakeem_search` يفشل مع لغة الناس

اختبار حي (29/10):

| السؤال | ما رجع | المتوقع |
|---|---|---|
| «ابحث لي عن حق العامل اذا فصلوه بدون سبب» | نظام الطيران المدني م165، لائحة هيئة التحقيق م1 | نظام العمل (البحث الدلالي وحده يجد م80 وم81) |
| «كم مهلة الاستئناف» | قرار تمديد مهلة رخص المياه الجوفية | نظام المرافعات الشرعية (مدة الاعتراض بالاستئناف) |
| «ما هو التغرير في العقد» | المعاملات المدنية م61، 63، 62 ✓ | — |
| «مدة الاعتراض على الحكم» | المرافعات م179 ثم 187 ✓ | — |
| «التصفية» مع law_id الإفلاس | 10 مواد كلها في التصفية ✓ (#922 و#936) | — |

**الأسباب:**
1. لا تنظيف لعبارات الطلب («ابحث لي عن»، «أبغى»، «وش حكم»): `queryKeywords` و`QUERY_STOP` في `lib/mcp/tools/semantic.ts`.
2. اللفظ «النادر» الضعيف (مثل «مهلة») يغلب: `fusedArticleIds` في `lib/mcp/adapter.ts` يحصر أطول لفظين (`probe`) ويعدّهما دليلًا، وأوزان `lib/mcp/search-fusion.ts` (تغطية 0.55، تشابه 0.35، لفظي 0.1، تسمية النظام 0.08؛ وBM25 لكسر التعادل منذ #936).
3. لا جسر لغة الناس ← لغة النظام (فصل ← فسخ/إنهاء العقد، مهلة ← مدة/ميعاد): المكنز `lib/modules/legal-thesaurus/concept-index.ts` (`matchThesaurusConcepts`) مستورد في adapter ولا يوسّع سؤال البحث في مسار الدمج.

**المطلوب، بالترتيب:**
1. **مقياس أولًا:** ~50 سؤالًا بلغة الناس (فصحى وعامية خليجية) لكل منها المادة الصحيحة بمعرّفها في القاعدة (لا من الذاكرة؛ تحقق بـ `hakeem_get_article`). احفظها ملفًا ذهبيًا وأداة قياس تمر بـ `searchArticles` نفسها (مجموعات `eval-search` و`eval-known-item` الحالية لا تمر بها).
2. تنظيف السؤال، ثم التوسيع بالمكنز والجذر، ثم ترجيح المعنى حين لا يحمل اللفظ دليلًا مميِّزًا.
3. بوابات لا تتراجع: «ما هو التغرير في العقد» (م61 أولًا)، «مدة الاعتراض على الحكم» (م179/187)، «التصفية» مع الإفلاس، «المعاملات المدنيه» في resolve، م55 عمل، البيع بالتقسيط.

## 5. المتجهات

- التغطية 29,704/29,704 (100%) بعد بناء 29/10 (#904، #920، #933).
- النموذج `text-embedding-3-small` (`lib/modules/ai/embeddings.ts`، `EMBEDDING_MODEL`)، العتبة 0.6 في المزوّد و0.5 في `hakeem_semantic_search`.
- يعمل للأسئلة الوصفية، ويرجع فارغًا لـ«كم مهلة الاستئناف» (لا شيء فوق 0.5).
- خط التجميد والبناء: `scripts/hkm-029/embed-lib.mjs --print-summary-sql` (قراءة) ← `freeze-manifest.mjs` ← `backfill-embeddings.yml` (target=articles، scope=all، limit=N، CONFIRM_RUNTIME_DB_ALIGNMENT).
- **المطلوب:** قياس نموذج أقوى (مثل `text-embedding-3-large`، أو متعدد اللغات مثل BGE-M3) على مجموعة البند 4 قبل أي تبديل؛ التبديل يعني إعادة بناء كل المتجهات وتغيير البُعد.

## 6. فهرسة محركات البحث (SEO): النطاق الخطأ

**الدليل (29/10):**
- `https://hakeemai.net/robots.txt` ينتهي بـ `Host: https://hakeem-platform.vercel.app` و`Sitemap: https://hakeem-platform.vercel.app/sitemap.xml`.
- `sitemap.xml` يدرج 1,173 رابطًا كلها على `hakeem-platform.vercel.app`.
- صفحة النظام على hakeemai.net فيها `<link rel="canonical" href="https://hakeem-platform.vercel.app/legal/…">`.
- فالمحركات تعدّ نطاق Vercel هو الأصل، وhakeemai.net نسخة.

**المصدر:** `lib/modules/config/site-url.ts`: `DEFAULT_SITE_URL = "https://hakeem-platform.vercel.app"`، و`getSiteUrl()` يقرأ `NEXT_PUBLIC_SITE_URL` ثم `NEXTAUTH_URL` ثم الافتراضي؛ فالمتغير غير مضبوط في Vercel للإنتاج أو يشير إلى vercel.app. (مواضع أخرى بالنطاق القديم: `lib/mcp/tools/aman-triage.ts` الأسطر 72–73 و199، وتعليق `app/mcp/route.ts`.)
**المطلوب:** ضبط `NEXT_PUBLIC_SITE_URL=https://hakeemai.net` في Vercel (Production) أو تغيير الافتراضي، ثم إعادة النشر والتحقق من robots وsitemap وcanonical؛ وتحويل 308 من `hakeem-platform.vercel.app` إلى hakeemai.net إن رغب المالك. تنبيه: `lib/mcp/oauth.ts` يقبل النطاقين لـ MCP فلا يُكسر الموصل.

## 7. صفحات المواد غير مدرجة في sitemap

sitemap فيه الأنظمة (1,167) وصفحات عامة (6) فقط. صفحات المواد (`/legal/[slug]/[article]`، نحو 29,704) غير مدرجة. **المطلوب:** sitemap index بملفات فرعية (≤50,000 رابط لكل ملف وفق sitemaps.org) تشمل المواد، مع `lastmod` من آخر تغيير للمادة.

## 8. الأنظمة الفارغة

22 نظامًا بلا مواد. صفحاتها ترجع 200 بعنوان عادي وبلا `<meta name="robots" content="noindex">` (محتوى رقيق/soft-404). منها **«نظام تأديب الموظفين»** (`fix25-1d499fa86360862021ef73aa`)، و«نظام رسوم وأجور خدمات الموانئ» (`cmpz5rjdr00cbcwg21dd5xfqa`)، و«تنظيم المجلس الأعلى لشؤون البترول والمعادن» (`cmpz5r1zd00ascwg288khl9y3`)، والباقي لوائح فنية وتنفيذية بيئية. القائمة كاملة: `SELECT id, name FROM legal_systems s WHERE NOT EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId" = s.id)`.
**المطلوب:** `noindex` (أو 404) للنظام بلا مواد حتى يُملأ؛ وملء المحتوى في مسار جلسة التنفيذ (بعضها مكرر لنظام آخر — قرار مالك معلّق).

## 9. مهلة 300 ث على /mcp — مُصلَحة

- السبب: `subscriptions/listen` (مواصفة MCP 2026) يفتح بثّ SSE لا ينتهي، فيبلغ حد Vercel. 732 خطأ في أربعة أشهر (163 مستخدمًا).
- الإصلاح #935 (`lib/mcp/listen-guard.ts`): رفض فوري بـ ‎-32603 «Subscription limit reached» (رد الحزمة حين maxSubscriptions=0). وأضاف #941 `maxDuration = 60`.
- التحقق: listen ينتهي في 7–12ms، ولا «Task timed out» من 16:10 إلى 18:25 UTC.
- السجل التشخيصي `lib/mcp/request-log.ts` (`[mcp-req] phase=start|slow|end … stage=handler|stream`) يبقى للمراقبة.

## 10. فحص الصفحات (29/10، hakeemai.net)

| النطاق | العدد | النتيجة |
|---|---|---|
| الصفحات الثابتة (كل `app/**/page.tsx` بلا معامل) | 88 | 24 ترجع 200، و64 تحويل 307 إلى `/sign-in` (محمية، متوقع)؛ لا صفحة أبطأ من 4 ث |
| صفحات الأنظمة (كل ما في sitemap) | 1,167 | كلها 200، أبطؤها 3.2 ث |
| صفحات المواد (عيّنة من 40 نظامًا) | 290 | كلها 200، أبطؤها 0.83 ث |
| الأنظمة الفارغة | 22 | كلها 200 (انظر البند 8) |
| أخطاء Vercel (7 أيام) | — | مجموعة واحدة: مهلة /mcp (مُصلَحة) |

لإعادة الفحص:
```bash
curl -s https://hakeemai.net/sitemap.xml | grep -o '<loc>[^<]*/legal/[^<]*</loc>' | sed 's#<loc>##; s#</loc>##; s#https://hakeem-platform.vercel.app#https://hakeemai.net#' > laws.txt
xargs -P 8 -I{} curl -s -o /dev/null -w "%{http_code} %{time_total} {}\n" --max-time 40 "{}" < laws.txt | awk '{print $1}' | sort | uniq -c
```
