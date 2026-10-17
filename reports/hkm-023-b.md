# HKM-023-B — صفحة النظام الكاملة ومقدمات الأنظمة: تقرير القسم ب (البيانات) وع-١٣ وجانب البيانات من ع-١٤

- **المُنفِّذ:** aman-database (المخطط والقارئ والتصنيف) مع aman-ai-engineer (أداة MCP والبحث)، القسم التقني لأمان.
- **التاريخ:** 2026-10-17، 10:30 بتوقيت الرياض.
- **الفرع:** `hkm-023-b-data` (محلي)، من `aman/hkm-023-b-law-page` (main + التزام الحجز 2a66d5c، مسودة #746). **لم يُدفع.**
- **الإنتاج:** لم يُكتب. كل ما قُرئ منه كان بـ `SELECT` عبر أداة Neon `run_sql` (مشروع misty-base-66693229، قاعدة neondb). لم يُنشأ فرع Neon. لم تُولَّد تضمينات. لم يُطبَّق الترحيل إلا على Postgres 17 محلي (`hakeem_hkm023b_test`).
- **القسم أ (العرض):** لم يُنفَّذ هنا، فهو لمطوّر آخر. تُرك له عقد قراءة جاهز ومختبر (انظر الملحق أ).
- **قراءة رجّحتُها لغياب المالك:** «المادة صفر» في الأمر هي الحقل `legal_systems.preamble`، إذ لا صف مادة رقمه صفر في الإنتاج (انظر الواقعة ٢).

---

## ٠. جولة الإصلاح بعد حكم الجودة (على dcb7678، تقرير `qa-b.md`)

- **الوقت:** 2026-10-17، نحو 12:30 بتوقيت الرياض. الفرع نفسه `hkm-023-b-data`، ولم يُدفع.
- **الإنتاج:** لم يُكتب. أُعيد التحقق بقراءة فقط (SELECT) من ثلاثة أمور:
  - عدد المقدمات (991)، وآخر تحديث لحقلها (2026-09-25، لم يتغير).
  - صفوف «مكرر» (11 مادة مكررة، و7 صفوف غير مادية بدرجة 100 فأعلى).
  - بصمة إشارات التصنيف كاملة بالأنماط الجديدة.

| بند الجودة | ما تغيّر | الدليل |
|---|---|---|
| **ع١** الفرع متأخر عن main ولا يعرف `articleBis` | دُمج main ‏(604bd56، HKM-028) بالتزام دمج، وتعارضه الوحيد في `package.json` حُلّ بإبقاء الطرفين. `getLawPageData` يقرأ `"articleBis"`، ويستبعد ما درجته 100 فأعلى (`NON_ARTICLE_BIS` من `article-key.ts` في main)، ويرتب بـ `"articleNumber", "articleBis", id`. لكل مادة الآن `bis` و`key` (`articleKey`: «103» أو «103_bis» أو «103_bis2»، كما في main وhkn-uri) و`label` («103 مكرر»). المرساة `art-<key>` والرابط `/legal/<slug>/<key>`، وصفحة المادة في main تقرأ هذا المفتاح. المفتاح «103» هو الأصل دائمًا. في MCP: المكررة تحمل `bis` و`key`، والصفوف غير المادية غائبة. | اختبارات BIS (8) في `test-law-page-data`، ومنها: ترتيب المكررات بعد أصلها، وفرادة المراسي، ورابط المكررة المستقل، والمفتاح «103» للأصل، واستبعاد الدرجة 100. |
| **ع٢** مخرج `hakeem_get_law` كبر نحو 3.6 مرات | عنصر الفهرس صار حقوله القديمة الثلاثة، ولا يُضاف إليه إلا ما له قيمة: `bis`/`key` للمكررة، و`status` للموثّقة فقط (غيابه = غير مؤكد)، و`repealed_by`/`repeal_effective_date` للملغاة بأداة خاصة بها، و`repealed_from`. حُذفت `status_label` و`status_source` و`repeal_type` و`url` من كل مادة. الرابط قالب واحد `article_url_template` (`…/legal/<slug>/{key}`). الملغاة تبعًا لإلغاء النظام كله تحمل الحالة فقط، وبيان الإلغاء مرة واحدة في `repeal`. مسار MCP يستدعي `getLawPageData` بـ `withText: false` (لا يُقرأ نص أي مادة ولا نص نسخها)، و`withOutgoingRepeals: false` و`resolveRepealingSystems: false` (لا مسح لكل التحقق ولا لكل البطاقات). المقدمة القديمة التي تحوي متنًا تُعاد منها 1٬000 حرف مع `body_leak: true`. | **الحجم** لنظام اصطناعي بـ721 مادة (عناوين بطول 33، ومعرّفات بطول 25، ومقدمة قديمة بطول 8٬623 حرفًا هي نص المعاملات المدنية)، وكلها `JSON.stringify(x, null, 1)` كما في `tool-runner`: **القديم (main) 107٬662 بايت، والنسخة الأولى من الفرع (f575c0a) 447٬578 بايت (×4.16)، والآن 124٬223 بايت (×1.15)**. منها الفهرس 103٬826 والمقدمة 15٬179. اختبارات M-13 تتحقق من: لا `null` في الفهرس، ولا قراءة لعمود `content`، ولا مسح للجداول، و×1.2 حدًا أعلى. |
| **ن٨** سبب التصنيف يخفي المتون (دليل السكك الحديدية 41٬959 حرفًا «سطر إصدار / عبارة صدر») | الخلل عام، وله ثلاثة إصلاحات: (١) المتن المتسرّب صار يتقدم على «عبارة صدر» في السبب. (٢) نص بلا أي جزء من أجزاء المقدمة وطوله 1٬000 حرف فأكثر صار `body_leak`، والسبب في الإنتاج أن صفوف «عبارة صدر» الـ19 بين 1٬000 و3٬000 حرف كلها متون أو أدلة أو سياسات، منها 9 مقطوعة عند 3٬000 حرف بالضبط. (٣) إشارة المتن صارت تقبل «المادة (الأولى):» المقوّسة. **الأصناف الثلاثة ومجموعها لم تتغير**؛ تغيّر السبب ووسم `body_leak`. | استعلام فروق (قراءة فقط): تغيّرت إشارة المتن في 7 صفوف. بصمة الإشارات كاملة في الإنتاج بالأنماط الجديدة `3d84663859cc54823f732d7e12c5c19e` تطابق الملف. الأرقام الجديدة في §٤. |
| **ن٢** بيانات القارئ الوصفية | أُضيفت إلى الحذف من الصورة العارية محارف الاتجاه U+202A–202E وU+2066–2069 وU+061C، في TS وفي `translate` SQL معًا (التكافؤ 40/40). رقم الأداة يُقرأ بعد حذف التشكيل والتطويل وNBSP، والأرقام الفارسية تُحوَّل. التركيب الحرفي لم يتغير. صفّ الإنتاج الوحيد الذي فيه محارف اتجاه (`db86a88b…`) أُعيد حساب إشاراته بقراءة فقط، فلم تتغير. | 5 اختبارات B-2 جديدة، وحالة `edge-bidi` في التكافؤ. |
| **ن٣** حواف مطابقة الاسم | السنة في المُدخل («نظام التنفيذ 1433») تُقدِّم الاسم الذي يحملها. داخل الدرجة يتأخر الملغى والمستبدل (آخر سجل تحقق للعمل) عن الساري، وتُقرأ حالات المرشحين فقط حين يتعددون. ما زال `findLawByName` يقرأ أسماء الأنظمة الـ1٬147، وهي قراءة صغيرة. | 5 اختبارات M-13، ومنها حالة من القاعدة («تنظيم اصطناعي للري» ← طبعة 1447). |
| **ن٥** ضجيج `prisma:error` قبل الترحيل | `relationExists` (`to_regclass`) قبل قراءة `preamble_edition` و`preamble_unit_current`، فلا يُرسل استعلام يفشل. | U-4: قبل الترحيل لا استعلام على جداول المقدمة. |
| **ن٤** روابط MCP و`ArticleView.url` إلى `/legal/...` | **لم يُغيَّر.** مسارات `/law` في فرع العرض، ولم يُحسم معرّفها الكنسي بعد. `/legal/<slug>/<key>` يعمل اليوم في main بمفتاح «مكرر». التحويل إلى `/law` سطر واحد في `law-page-data.ts` (الحقل `url`) وسطر في `get-law.ts` (القالب)، بعد دمج العرض. | — |
| **م٥** تكرار التحميل في صفحة المادة | من العرض. البيانات توفّر الآن `withText: false` و`withOutgoingRepeals: false`. التوصية للعرض: `React.cache` حول `getLawPageData` في المسار. | — |

**لاحظتُ في main (ليس من هذا الفرع):** `scripts/test-effective-consumers.ts` يفشل في 10 حالات على main نفسه (604bd56، في نسخة عمل نظيفة). السبب أن قاعدته الوهمية لا تعرف `articleBis` ولا المعامل `lt`، وفلاتر #751 (`articleBis: 0` و`ARTICLE_ROWS`) لا تطابق صفوفها. الإصلاح لمالك HKM-028.

---

## ١. ما أخذته من #685 و#631، وما أضفته

| المصدر | حاله | ما أخذته | ما أضفته فوقه |
|---|---|---|---|
| #685 (الموجة ١: وجه البحث وبطاقة النظام ونص النظام) | الطلب ما زال مفتوحًا، لكن التزامه 5501d44 داخل main (`git merge-base --is-ancestor 5501d44 HEAD`). جداوله `search_surface` و`search_surface_member` و`law_card` موجودة في الإنتاج (52 و55 و506 صفًا). | البناء مباشرة على `law_card` (أدوات الإصدار والتواريخ وكتل النص `text_blocks`)، وعلى `computeSurface` و`workStatusAsOf` و`unitStatusAsOf` من `lib/modules/legal-core/search-surface.ts`، وعلى `verification` و`unit_version`. لم أكرر شيئًا منها. | دالة قراءة واحدة للصفحة كلها: البطاقة بالتواريخ الأربعة ومصدر كل تاريخ، والحالة على قائمة الهيئة الست، وبيان الإلغاء، والمقدمة بأربع حالات، والمتن بحالة كل مادة. وأضفت قاعدة `composeLawCardText`، وهي تطابق تركيب كتل البطاقة في SQL (md5 مطابق للإنتاج). |
| #631 (طبقة الوحدات `document_units` والقارئ) | **مغلق دون دمج**. هجرته 20260809120000 ليست في main، ولا جدول `document_units` في الإنتاج (استعلام `information_schema.tables` ⇒ 0). وقرار HKM-028 ألّا يُعاد بناؤه. | نقلت أسماء الأعمدة ومنطقها: `unit_type` و`ordinal` و`parent_id` و`label_ar` و`number` و`text_raw` و`text_normalized` و`path` و`char_start` و`char_end`. ونقلت مبدأ «آلة حالات تبلّط النص وتُلزم إعادة التركيب الحرفي». لم أنقل كوده، ولا الكرون، ولا `vercel.json`. | جدولان جديدان مقصوران على المقدمة (ب-١) وقارئ مستقل لها (ب-٢). الأسماء نفسها تُبقي الضم ممكنًا إن أُحيي نموذج #631. |
| #724 (مدموج) | داخل main | `verified-status.ts` (`textAsOf` و`citationFlagsFromVerification`)، وحالة المادة بالتاريخ. | — |

---

## ٢. وقائع §١ في الكود والقاعدة

القاعدة هنا هي الإنتاج، وكل استعلاماتها قراءة فقط بتاريخ 2026-10-17. أما الكود فمن رأس الفرع 2a66d5c.

| # | واقعة الأمر | الحكم | الدليل |
|---|---|---|---|
| 1 | صفحة `/dashboard/legal-core/systems/[id]` فهرس فقط بلا نص، وتبدأ من المادة الأولى | **ثبتت** | `app/dashboard/legal-core/systems/[id]/page.tsx:79-90`: كل صف رابط فيه «م {رقم}» والعنوان فقط. `lib/modules/library/library-service.ts:107-109`: الاستعلام يختار `id, articleNumber, title, chapter` بلا `content`. |
| 1أ | (ملاحظة) الحالة في الصفحة نفسها | — | `page.tsx:46`: شارة «ساري» ثابتة للنظام كله، لا تُقرأ من التحقق. |
| 2 | المقدمات مخزّنة «مادةً رقمها صفر» | **لم تثبت بنصها** | القاعدة: `count(*) FROM legal_articles WHERE "articleNumber"=0` ⇒ **0**. المقدمة حقل `legal_systems.preamble`: الهجرة `20260925050000_system_preamble_field`، وتعليق `app/api/admin/legal-core/preambles/route.ts:3-4` («لا مادة صفر»). نُقلت إلى الحقل في 2026-09-25 (`preamble_updated_at` بين 06:02 و10:43 من ذلك اليوم، بـ `scripts/backfill/move-preambles-to-system.ts`). بقي `scripts/import-preambles.ts` يصف «المادة صفر» في رأسه، وهذا وصف تاريخي. |
| 3 | `GET /api/admin/legal-core/preambles?system=` يعيد كل الوثائق | **ثبتت** | `route.ts:27-34`: بلا `system` يُرجع `findMany` بلا شرط، وبه يبحث بالاحتواء (`take: 20`). |
| 4 | 1٬147 وثيقة، منها 991 لها مقدمة و156 بلا مقدمة، وما يبدأ بـ«نظام» (290) كله له مقدمة | **ثبتت** | `systems=1147`، `with_preamble_field=991`، `nizam_with=290`، `nizam_all=290`. |
| 5 | المُضمَّن للبحث الدلالي: صفر | **ثبتت** | `embeddings` بحسب `owner_type`: article 17٬325، ruling 50٬273، principle 4٬066، ولا شيء غيرها. `lib/modules/legal-search/providers/search-provider.ts:4`: `LegalEntityType = "article" \| "ruling" \| "principle"`. |
| 6 | الأطوال: أقل من 200 ⇒ 710، و200–1000 ⇒ 54، و1000–3000 ⇒ 63، وأكثر من 3000 ⇒ 164، والوسيط 169 | **ثبت جزئيًا** | 710 و54 والوسيط 169: مطابقة. الفئتان الأخيرتان **80 و147** (المجموع 227 مطابق: 63+164 = 80+147). جرّبت الحساب بالبايت، وبعد `btrim`، وبحد 2500، ولم يتطابق أي منها مع 63/164. أرجّح أن الأمر قسّم الفئتين بحد آخر. |
| 7 | مقدمة «نظام الإثبات» 171 حرفًا، وفي الهيئة أكثر من 4٬000 (مرسوم + قرار) | **ثبتت** | `legal_systems.preamble` للنظام `cmpz5pbv80021cwg2br8calht` طوله 171. بطاقة `law_card` (`lc26-be18c7df20bb28974df24785`، من الهيئة بتاريخ 2026-09-28) تركيب كتلها **4٬081 حرفًا**. فكّكه القارئ إلى أداتين و14 استنادًا و11 بندًا وتوقيعين، والتركيب حرفي (اختبار B-2). |
| 8 | المقدمة لا تظهر في صفحة النظام، ولا في البحث، ولا في فهرس `hakeem_get_law` | **ثبتت للوحة والبحث وMCP، ولم تثبت للصفحة العامة** | اللوحة: الواقعة 1. البحث: مزوّد Postgres يقرأ `legal_articles` فقط (`providers/postgres-provider.ts:76` `type: "article"`). MCP: `lib/mcp/adapter.ts@HEAD:137` (الفهرس من المواد فقط). أما **الصفحة العامة `/legal/[slug]`** فتعرضها: `app/legal/[slug]/page.tsx:153-161` تعرض كتل `law_card` إن وُجدت، وإلا `system.preamble`. |
| 9 | `issue_instrument` و`issue_date_h` و`status` كلها `null` في `hakeem_get_law` | **ثبتت** | `lib/mcp/adapter.ts@HEAD:133-135`: القيم `null` مكتوبة صراحة في الكود. |
| 10 | مطابقة الاسم تفضّل الوثيقة الخطأ («نظام المرافعات الشرعية» ⇒ اللوائح، و«نظام الإثبات» ⇒ الأدلة الإجرائية) | **ثبتت** | `adapter.ts@HEAD:123-126`: `findFirst({ where: { name: { contains } }, orderBy: { articleCount: "desc" } })`، فيفوز الأكثر مواد بلا تفضيل للمطابقة التامة. في القاعدة يحوي الاسمَ أكثرُ من وثيقة: «الأدلة الإجرائية لنظام الإثبات» (135 مادة) و«نظام الإثبات»، و«اللوائح التنفيذية لنظام المرافعات الشرعية» (639) و«نظام المرافعات الشرعية». أعاد اختبار `M-13 إعادة إنتاج العلة` إنتاج الخطأ بالمنطق القديم في الحالتين. |
| 11 | لا تمييز للمعدّلة أو الملغاة في صفحة النظام | **ثبتت (اللوحة)** | الواقعة 1 و1أ. |
| 12 | (مرجع الهيئة) المرافعات 242 مادة، والملغاة 101–158 ألغتها م128 من نظام الإثبات | **في حكيم: 242 ثبتت، والإلغاء غير مسجّل** | `articleCount=242`. للمواد 101–158 (58 مادة): `status <> 'سارية'` ⇒ 0، وسجلات `verification` للوحدة ⇒ 0. أعداد الهيئة (32 معدّلة و58 ملغاة) لم أتحقق منها، لأن السحب من البوابة ممنوع. |

---

## ٣. المتطلبات المغلقة برموزها، وما بقي

### أُغلق بالكود (محليًا ومختبرًا)

- **ب-١ مخطط الوحدات** — `prisma/migrations/20261017130000_hkm023b_preamble_units/migration.sql`
  - إضافي فقط، ولا يمس جدولًا قائمًا.
  - `preamble_edition`: النص الحرفي، و`raw_sha256`، والمصدر (أم القرى أو هيئة الخبراء، ورابط https)، وتاريخ الاسترجاع، والاكتمال، و`legacy_preamble_sha256` الذي يربط بـ«المادة صفر» ببصمتها فقط، و`change_ref`، والمُعِدّ والمعتمِد مع القيد `approved_by <> prepared_by`.
  - `preamble_unit`: ثمانية أنواع، هي أنواع §٢ الستة والأب `issuing_instrument` و`unclassified`.
  - إعادة التركيب الحرفي والتبليط المتصل وعدد الوحدات مفروضة في القاعدة بقيود مؤجلة عند الالتزام (`hkm023b_verify_preamble_edition`).
  - الجدولان للإضافة فقط (`hakeem_append_only`).
  - العرض `preamble_unit_current` يعطي أحدث نسخة لكل نظام بلا وحدات الأب.
  - فهارس `tsvector('simple')` و`pg_trgm` على `text_normalized`.
  - الترحيل يحمل التراجع في رأسه، وطُبِّق محليًا فقط.
- **ب-٢ قارئ المقدمة** — `lib/modules/legal-core/preamble-parser.ts` (`parsePreamble`)
  - يعمل بمراسٍ لفظية على نص «عارٍ» بلا تشكيل ولا تطويل ولا محارف صفرية العرض، وبهمزات موحّدة، مع خريطة مواضع تعود إلى النص الخام.
  - الوحدات تبلّط النص الخام، و`reconstructionOk` شرط القبول، فالتفكيك الذي لا يعيد الأصل يُرفض ولا يُحفظ.
  - صفوف النسخة تُبنى في `preamble-edition.ts` (`checkPreambleImport` و`buildPreambleEditionRows` و`insertPreambleEdition`).
- **ب-٣ التصنيف** — `lib/modules/legal-core/preamble-signals.ts` و`scripts/hkm-023-b/classify-preambles.ts`
  - شُغِّل فعليًا على الإنتاج بقراءة فقط، والنتائج في §٤.
- **ب-٤ مسار الاستكمال** — وثيقة تصميم في الملحق ب، دون تنفيذ، كما طلب الأمر. فرعي من main ولا يحوي المكتب.
- **ع-١٣ أداة MCP** — `lib/mcp/tools/get-law.ts` و`lib/modules/legal-core/law-name-match.ts`، مع تعديل `lib/mcp/adapter.ts` و`app/mcp/route.ts`.
  - **المطابقة:** تامة، ثم «يبدأ بـ»، ثم احتواء. داخل الطبقة الواحدة يُقدَّم الأصل على اللائحة (إلا إن طُلبت اللائحة صراحة)، ثم الساري على الملغى، ثم الأقصر، ثم الأكثر مواد. والسنة في المُدخل تُقدِّم من يحملها. مع المطابقة تُعاد `match` و`alternatives` (حتى 8).
  - **المخرجات الجديدة:**
    - `issue_instruments[]`
    - `dates` الأربعة (issued و published و effective و applied)
    - `status_detail` على قائمة الهيئة الست
    - `preamble` (وحدات، أو نص بـ `completeness` و`complete` و`truncated` بسقف 12٬000 حرف)
    - `counts`
    - `toc[]` مضغوط: الحقول القديمة، ثم ما له قيمة فقط (`bis`/`key` للمكررة، و`status` للموثّقة، و`repealed_by` و`repeal_effective_date` و`repealed_from`)، والرابط من `article_url_template` (انظر §٠)
  - **العقد القديم باقٍ:** لم يُحذف حقل ولم يُغيَّر نوعه. الحقول الثلاثة التي كانت `null` صارت تُملأ متى وُجد مصدرها.
  - **`/mcp` ليس مسارًا مراقبًا:** لا workflow فيه مرشّح `paths` يشمل `app/mcp` أو `lib/mcp` أو `lib/**`. `deploy-readiness-check.yml` يعمل على كل push إلى main أو `codex/**` وكل pull_request، ولا يطبّق ترحيلًا ولا يكتب على قاعدة.
- **ع-١٤ جانب البيانات** — `lib/modules/legal-core/preamble-search.ts` و`scripts/hkm-023-b/embed-preamble-units.ts`
  - وحدات المقدمة في الفهرس النصي موسومة بـ `type: "preamble_unit"` و`unitType` والمرساة.
  - `mergeArticleAndPreambleHits` يُبقي المواد بترتيبها، ويعيد المقدمة منفصلة (`separate`) أو ملحقة بعد المواد (`append`)، ولا يخلط بينهما أبدًا.
  - غياب الجدول يعني «لا نتائج» بلا خطأ.
  - أمر التضمين تجريبي: يعدّ ويقدّر بمعاملة `READ ONLY`، ويرفض `--apply` بخروج 2.
- **دوال القراءة للعرض** — `lib/modules/legal-core/law-page-data.ts`، والعقد في الملحق أ.

### ما بقي

- **القسم أ كله (ع-١ إلى ع-١٢، وع-١٥):** لمطوّر العرض فوق `getLawPageData`، ومعه لقطات 390 و1440.
- **ربط ع-١٤:** ربط `searchPreambleUnits` بـ `hybrid-search` و`hakeem_search`، وربط `vector-provider` بالنوع `preamble_unit`. يأتي بعد وجود البيانات، فلا معنى لربطه اليوم والجدول فارغ.
- **قبول ع-١٤ الحي:** «عبارة من منطوق نظام الإثبات تعيد البند». ينتظر إدخال المقدمة (ف١١). اختُبر محليًا على بيانات اصطناعية (S-14).
- **تنفيذ ب-٤:** على فرع المكتب `aman/legal-editorial-desk-phase0`، وفق الملحق ب.
- **ما لم يُشغَّل:** `next build` و`qa:security` (شغّلتهما الجودة على dcb7678 ونجحا). والجدولان الجديدان يُقرآن بـ SQL خام عبر `SqlClient`، مثل `law_card` و`search_surface` القائمين، فلا تغيير في `schema.prisma`.
- **فحص الأنواع بعد دمج main:**
  - `node_modules` المشترك فيه عميل Prisma مولَّد من مخطط قديم بلا `articleBis`، فيفشل `npm run typecheck` فيه على ملفات main نفسها (`app/legal/...`، و`app/eli/...`).
  - ولّدتُ عميلًا خاصًا بـ `prisma generate --no-engine` من مخطط الفرع إلى مجلد مؤقت خارج المستودع، وشغّلت `tsc` بربط `@prisma/client` به، فخرج **نظيفًا**.
  - لم أُعِد توليد العميل المشترك، لأنه تستعمله نسخ عمل أخرى.
- **الدفعات الخمس:** لم تُدخل (انظر §٤).

---

## ٤. تصنيف المقدمات (ب-٣) وحال الدفعات الخمس

**الطريقة**
1. لا رابط اتصال بالإنتاج في البيئة، فولّدت SQL من `buildPreambleSignalsSql` وشغّلته بـ `SELECT` على الإنتاج في أربع دفعات، تحققت من md5 كل منها.
2. الأنماط مكتوبة لتعمل في Postgres ARE وJS معًا، وتكافؤهما مثبت على Postgres 17 محلي (40/40 بعد جولة الجودة).
3. القرار دالة TS واحدة هي `classifyPreambleSignals`.
4. المُدخل: `reports/hkm-023-b-preamble-signals.txt`.
   - md5 الحالي `3d84663859cc54823f732d7e12c5c19e`، وهو ما حسبته القاعدة نفسها بالأنماط الجديدة.
   - السابق `d3cb1fc9…`. الفرق 7 صفوف في إشارة المتن.
5. الناتج: `reports/hkm-023-b-preamble-classification.csv` (md5 `67fcab59218e5c58b96c413696734d8d`؛ والسابق `9997ae40…`) و`.summary.json`.
6. أعمدة CSV: المعرّف، والاسم، والقطاع، والتصنيف، والسبب، والطول، والإشارات، و`law_card_full`. الترتيب بالقطاع، ثم «نظام» قبل غيره، ثم الاسم.

**المجموع: 991 = 878 سطر إصدار فقط + 68 كاملة + 45 جزئية.** يطابق عدد المقدمات (الواقعة 4).

| السبب | العدد |
|---|---|
| كاملة: افتتاحية + استنادات + صيغة إصدار + بنود | 68 |
| جزئية: تنقصها الافتتاحية والبنود | 33 |
| جزئية: تنقصها الافتتاحية والاستنادات | 9 |
| جزئية: تنقصها الافتتاحية | 3 |
| سطر إصدار: عبارة «صدر بالمرسوم…» | 530 (كانت 663) |
| سطر إصدار: عنوان وتاريخ فقط (300 حرف فأقل) | 123 |
| سطر إصدار: الحقل يحوي متن النظام أو ملحقًا لا مقدمة (`body_leak`) | 220 (كانت 75) |
| سطر إصدار: تمهيد سردي | 4 (كانت 10) |
| سطر إصدار: نص بين 300 و1٬000 حرف بلا بنية مقدمة | 1 (كانت 7) |

**ما تغيّر في جولة الجودة:** الأسباب وحدها. الأصناف الثلاثة ومجموعها كما هي، وكذلك جدول القطاعات أدناه. لا صف «عبارة صدر» بقي طوله 1٬000 حرف فأكثر (كانت 78 صفًا فوق 3٬000).

| القطاع (بأولوية الأمر) | كاملة | جزئية | سطر إصدار | المجموع | منها كتل بطاقة كاملة في `law_card` |
|---|---|---|---|---|---|
| التقاضي | 3 | 0 | 37 | 40 | 28 |
| التجاري والمالي | 7 | 3 | 93 | 103 | 54 |
| العمل والاجتماعي والجزائي | 1 | 1 | 55 | 57 | 33 |
| العقاري والملكية الفكرية | 4 | 3 | 45 | 52 | 24 |
| الإداري والقضائي | 13 | 0 | 87 | 100 | 66 |
| أخرى (قطاعي، صحي، غير مصنف) | 40 | 38 | 561 | 639 | 262 |

- **مصدر القطاع:** `legal_systems.domain` في 459، والاسم في 162، وبلا قطاع ⇒ «أخرى» في 370. التصنيف القطاعي تقريبي في مجمله.
- **متن داخل حقل المقدمة (`body_leak`):** 227 نصًا (كانت 153)، منها 220 صُنفت «سطر إصدار» بسبب المتن. هذه **ليست مقدمات** في الحقيقة، ويجب ألا يُعرض حقلها بعنوان «المقدمة». `PreambleView.legacy.bodyLeak` يحمل الوسم للعرض.
- **أهم رقم للاستكمال:** 467 نظامًا لها في `law_card` كتل مقدمة كاملة من لقطة الهيئة (2026-09-28)، **446** منها مقدمتها في حكيم غير كاملة. هذه مصدر جاهز داخل القاعدة لا يحتاج سحبًا، وفي التقاضي وحده 26 من 40.
- **من نواة التقاضي:** الإثبات، والإجراءات الجزائية، والأحوال الشخصية، والتحكيم، والمحاماة، والمرافعات الشرعية، والمرافعات أمام ديوان المظالم كلها «سطر إصدار» (127–174 حرفًا) ولها كتل بطاقة كاملة. «التنفيذ» (م/237) و«المعاملات المدنية» كاملتان.

**عيّنة الـ20** (مع النصوص كاملة: `reports/hkm-023-b-preamble-sample.md`، ومعها `reports/hkm-023-b-preamble-sample.json`)
- العيّنة طبقية: 8 كاملة، و4 جزئية، و8 سطر إصدار، ومنها «نظام الإثبات» و«نظام المرافعات الشرعية».
- كل نص فيها مطابق لبصمة md5 في الإنتاج.
- القارئ والإشارات متفقان على العشرين كلها، وإعادة التركيب حرفية في العشرين.

| # | الاسم | الطول | التصنيف | السبب |
|---|---|---|---|---|
| 1 | النظام الأساس للمركز العالمي لمكافحة الفكر المتطرف | 845 | كاملة | all_parts |
| 2 | تنظيم المجلس الوطني للسلامة والصحة المهنية | 945 | كاملة | all_parts |
| 3 | تنظيم مجالس التنمية السياحية في المناطق | 1043 | كاملة | all_parts |
| 4 | نظام الحرف والصناعات اليدوية | 1083 | كاملة | all_parts |
| 5 | الترتيبات التنظيمية لمجلس الاستثمار | 1135 | كاملة | all_parts |
| 6 | تنظيم حوكمة إجراءات منع التصدير وتقييده | 1141 | كاملة | all_parts |
| 7 | تنظيم مركز الإحالات الطبية | 1241 | كاملة | all_parts |
| 8 | تنظيم هيئة الاتصالات والفضاء والتقنية | 1243 | كاملة | all_parts |
| 9 | القواعد المنظمة لإعادة التأهيل ودفع التعويضات… وفقاً لنظام السياحة | 167 | جزئية | missing:opening+recital |
| 10 | تعليمات الحسابات الاستثمارية | 368 | جزئية | missing:opening+operative (+متن) |
| 11 | القواعد المنظمة للاستثمار الأجنبي في الأوراق المالية | 394 | جزئية | missing:opening+operative (+متن) |
| 12 | تنظيم مركز سارة السديري لدراسات المرأة | 1074 | جزئية | missing:opening |
| 13 | نظام تأديب الموظفين | 11 | سطر إصدار | title_date_only |
| 14 | لائحة التقارير الطبية المنصوص عليها في نظام الأحوال الشخصية | 92 | سطر إصدار | title_date_only |
| 15 | ضوابط تعاقد الجهات الحكومية مع الشركات التي ليس لها مقر إقليمي… | 126 | سطر إصدار | title_date_only |
| 16 | النظام الجزائي الخاص بتزييف وتقليد النقود | 126 | سطر إصدار | issuance_phrase |
| 17 | نظام المرافعات الشرعية | 127 | سطر إصدار | issuance_phrase |
| 18 | اللائحة التنفيذية لمنع التلوث البحري من السفن (ماربول)… | 148 | سطر إصدار | narrative_intro |
| 19 | نظام الإثبات | 171 | سطر إصدار | issuance_phrase |
| 20 | اللائحة المنظمة لنشاط النقل الدولي للركاب بالحافلات | 266 | سطر إصدار | body_leak (+متن) |

**الدفعات الخمس (نحو 78 نظامًا): لم تُدخل.** الأدلة:
1. آخر `preamble_updated_at` في الإنتاج هو 2026-09-25 10:43، أي يوم النقل من «المادة صفر»، ولم يُحدَّث بعده أي حقل مقدمة.
2. لا جدول مقدمات مهيكلة في الإنتاج (`preamble_edition` و`preamble_unit` و`document_units` و`legal_effect` ⇒ 0).
3. ملف الاستيراد `data/preambles.json` فيه مدخل واحد فقط (المعاملات المدنية)، وworkflow `import-preambles.yml` يُشغَّل يدويًا وحده.
4. 37 من 40 في التقاضي «سطر إصدار»، ومقدمة «نظام الإثبات» 171 حرفًا.
5. لم أجد ملفات الدفعات في المستودع (بحث بالأسماء ونصوص «نواة التقاضي»/«الدفعات الخمس»). `legal_system_issuance` فيه 15 صفًا فقط من بوابة العدل (`moj-portal-2026-10-16`)، وهي أدوات لا مقدمات.

**وصول عيّنة المالك:** لم تصل عيّنة الهيئة التي يلصقها المالك (ب-٢). عوّضتها:
- نصوص حقيقية من الإنتاج فوق 3٬000 حرف: جمع التبرعات 3٬286، والبراءات 3٬290، وحقوق المؤلف 3٬335، وتعميم مستشفى الملك خالد 3٬710، والمعاملات المدنية 8٬623.
- كتل بطاقة «نظام الإثبات» من لقطة الهيئة في `law_card` (4٬081 حرفًا).
- كلها في `data/preamble-fixtures/hkm-023-b/production.json` مع مصدرها وبصمتها. لم يُختلق نص.

---

## ٥. الملفات المتغيّرة، ونتائج الاختبارات، وما لم يُختبر

**جديد**
- **الترحيل:** `prisma/migrations/20261017130000_hkm023b_preamble_units/migration.sql`
- **الوحدات في `lib/modules/legal-core/`:**
  - `preamble-parser.ts` و`preamble-signals.ts` و`preamble-edition.ts`
  - `law-page-data.ts` و`law-name-match.ts` و`preamble-search.ts` و`sql-port.ts`
- **أداة MCP:** `lib/mcp/tools/get-law.ts`
- **السكربتات في `scripts/hkm-023-b/`:**
  - `local-db.ts`، وفيه حارس يرفض أي قاعدة غير محلية أو لا ينتهي اسمها بـ `_test`
  - `classify-preambles.ts` و`render-preamble-sample.ts` و`embed-preamble-units.ts`
  - `fixtures/base-schema.sql`
- **الاختبارات:** `scripts/test-preamble-parser.ts` و`scripts/test-preamble-signals.ts` و`scripts/test-law-page-data.ts`
- **العيّنات:** `data/preamble-fixtures/hkm-023-b/synthetic.json`، وفيه ثلاث عيّنات موسومة «اصطناعي» في اسمها ونصها (مرسوم فقط، ومرسوم + قرار مجلس، وأمر ملكي)، و`production.json`
- **التقارير في `reports/`:** `hkm-023-b.md` و`hkm-023-b-preamble-*.{txt,csv,json,md}`

**معدّل**
- `lib/mcp/adapter.ts`: `getLaw` يفوّض إلى `getLawTool`.
- `app/mcp/route.ts`: وصف الأداة فقط.
- `package.json`: ثلاثة أوامر `test:*`، وأمر البناء لم يتغير.
- `docs/PROJECT_STATUS.md`: مدخل HKM-023-B وسطر السجل.

**نتائج الاختبارات**

| الأمر | النتيجة | ما يغطيه |
|---|---|---|
| `npm run test:preamble-parser` | **181 نجح، 0 فشل** (كانت 176) | B-2: المراسي، وإعادة التركيب الحرفي لكل عيّنة، والعيّنات الاصطناعية الثلاث، والنصوص الحقيقية الخمسة، وكتل بطاقة الإثبات، وعنوان الأداة بأرقام هندية وفارسية ومع التشكيل وNBSP ومحارف الاتجاه. |
| `npm run test:preamble-signals` | **34 نجح، 0 فشل** (كانت 31) | B-3: القرار والسبب والقطاع والترتيب وCSV، ومنها المتن الطويل بلا بنية. تكافؤ SQL/TS على Postgres 17 محلي 40/40، وعيّنة الإنتاج 20/20. |
| `npm run test:law-page-data` | **113 نجح، 0 فشل** (كانت 88) | B-1 ‏(14): الترحيل والقيود والإضافة فقط. U-* ‏(42): بيانات الصفحة، ومنها `withText=false` و`bodyLeak` وعدم الاستعلام قبل الترحيل. BIS ‏(8): المادة المكررة. M-13 ‏(42): المطابقة وحوافها، والعقد القديم والجديد، والفهرس المضغوط، والحجم. S-14 ‏(7): البحث. كلها على قاعدة محلية ببيانات اصطناعية. |
| `test:article-key` (من main) | نجح | |
| `test:mcp-hardening` | نجح | |
| `scripts/test-effective-consumers.ts` | **10 فشل، على main نفسه أيضًا** | قاعدته الوهمية لا تعرف `articleBis` (انظر §٠). ليس من هذا الفرع. |
| فحص الأنواع | نظيف بعميل Prisma مولَّد من مخطط الفرع | العميل المشترك قديم (انظر §٣ «ما بقي»). |
| `npx next lint --file` على كل ملف مُسّ | نظيف | |

**ما لم يُختبر ولماذا**
- `next build`: لم يُشغَّل بعد الدمج. شغّلته الجودة على dcb7678 فنجح.
- لقطات 390 و1440: من القسم أ.
- قبول ع-١٤ الحي: لا بيانات بعد.
- مقارنة أعداد الهيئة للمرافعات: السحب ممنوع.
- `prismaSqlClient` نفسه لم يُشغَّل على Prisma حقيقي. هو غلاف من سطرين حول `$queryRawUnsafe`، والمنطق كله مختبر عبر `pg`.

**`git diff --name-only origin/main...HEAD`** (بعد دمج main ‏604bd56 والتزامات جولة الجودة؛ القائمة نفسها قبلها):

```
app/mcp/route.ts
data/preamble-fixtures/hkm-023-b/production.json
data/preamble-fixtures/hkm-023-b/synthetic.json
docs/PROJECT_STATUS.md
lib/mcp/adapter.ts
lib/mcp/tools/get-law.ts
lib/modules/legal-core/law-name-match.ts
lib/modules/legal-core/law-page-data.ts
lib/modules/legal-core/preamble-edition.ts
lib/modules/legal-core/preamble-parser.ts
lib/modules/legal-core/preamble-search.ts
lib/modules/legal-core/preamble-signals.ts
lib/modules/legal-core/sql-port.ts
package.json
prisma/migrations/20261017130000_hkm023b_preamble_units/migration.sql
reports/hkm-023-b-preamble-classification.csv
reports/hkm-023-b-preamble-classification.summary.json
reports/hkm-023-b-preamble-names-extra.json
reports/hkm-023-b-preamble-sample.json
reports/hkm-023-b-preamble-sample.md
reports/hkm-023-b-preamble-signals.txt
reports/hkm-023-b.md
scripts/hkm-023-b/classify-preambles.ts
scripts/hkm-023-b/embed-preamble-units.ts
scripts/hkm-023-b/fixtures/base-schema.sql
scripts/hkm-023-b/local-db.ts
scripts/hkm-023-b/render-preamble-sample.ts
scripts/test-law-page-data.ts
scripts/test-preamble-parser.ts
scripts/test-preamble-signals.ts
```

لا شيء تحت `.github/`، ولا `vercel.json`، ولا `db/migrate-request.json`. أمر البناء `prisma generate && next build` لم يتغير.

---

## ٦. أفعال تنتظر المالك

1. **الدفع** (أسرار Preview مشتركة مع الإنتاج): دفع `hkm-023-b-data` إلى `aman/hkm-023-b-law-page`، أو فتح طلب مسودة منه. لم يُدفع شيء.
2. **تطبيق الترحيل (ف١٠):** على فرع Neon أولًا، ثم الإنتاج باعتماد فردي. لا مسار آلي يطبّقه.
3. **إدخال المقدمات (ف١١) بعيّنة:**
   - الاقتراح: البدء بنواة التقاضي من كتل `law_card` القائمة (26 نظامًا)، عبر `import_preamble` في المكتب بعد تنفيذه (الملحق ب).
   - لكل نظام: معاينة الوحدات وبصمتها قبل الاعتماد، ومعتمِد غير المُعِدّ.
   - عيّنة أولى مقترحة: الإثبات، والمرافعات الشرعية، والتحكيم.
4. **التضمينات (ف١٠ + ف١٤):** بعد الإدخال يُشغَّل `scripts/hkm-023-b/embed-preamble-units.ts` تجريبيًا لتقدير العدد والرموز. التطبيق يحتاج كلمة صريحة ومسارًا مأذونًا (`--apply` مرفوض اليوم).
5. **تصحيح بيانات الإلغاء (ف١١):** وسم مواد المرافعات 101–158 بـ «ملغاة» ودليلها م128 من نظام الإثبات. اليوم لا يملك المكتب فعلًا للوحدة (`set_work_status` فقط).

---

## ٧. قرارات مطلوبة من المالك

**من §٨ في الأمر، مع رأي البيانات:**
1. **طيّ المقدمة:** للعرض. البيانات تعيد الوحدات كاملة، والطيّ قرار القسم أ.
2. **ألوان المعدّل والملغى:** للعرض. البيانات تعيد `status` و`statusLabel` نصًا، فلا اعتماد على اللون وحده.
3. **استبعاد الملغى من البحث العام:** أؤيد التوصية. `searchPreambleUnits` لا يرشّح بالحالة بعد، ويُضاف ذلك عند الربط.
   - **3أ. صيغة المعرّف الدائم:** أؤيد معرّف الأداة. `instrumentKey()` يعطي اليوم «م/43|1443»، ويُشتق منه `m-43-1443` بلا بيانات جديدة.
   - **3ب. من يعتمد الإلغاء الضمني:** لا مصدر بيانات له اليوم. `RepealType = "implicit"` معرّف، لكنه لا يُملأ إلا بسجل `verification` طريقته `owner_decision`. أقترح أن يكون المالك وحده.
4. **أولوية الاستكمال بعد الـ78:** أقترح البدء بالأنظمة الـ446 التي لها كتل كاملة في `law_card` (لا تحتاج مصدرًا جديدًا ولا سحبًا) بالترتيب القطاعي، ثم البقية بالأكثر بحثًا.
5. **من يعتمد المقدمات المستوردة:** صاحب صلاحية النشر في المكتب، على ألا يكون هو المُعِدّ (مفروض في القاعدة وفي المكتب). أقترح المالك لنواة التقاضي، ثم التفويض.

**قرارات إضافية ظهرت في التنفيذ:**
6. **أسبقية مصادر المقدمة في العرض:** وحدات معتمدة، ثم كتل `law_card` من لقطة الهيئة بوسم «لم تُفكَّك»، ثم الحقل القديم بوسم «مقدمة غير مكتملة»، ثم «غير متوفرة». الصفحة العامة اليوم تعرض الكتل قبل الحقل، فأبقيتُ هذا الترتيب. هل يُقرّ؟
7. **تعارض في عرض المادة الملغاة:** قرار المالك في 16/10 أن تعرض سطر الإلغاء، والأمر ع-٧أ يقول ببقاء النص كاملًا. البيانات تعيد الأمرين (`text` و`effectiveText` و`repeal`)، والحسم للعرض.
8. **حالة النظام على قائمة الهيئة:** الحالات «صادر لم يسرِ بعد» و«سجل مخلوط» وغياب السجل لا تقابلها حالة من الست. تُعاد `null`، أي «غير متوفر»، ولا تُخترع «تحت الإجراء». و«ساري خلال مدة» و«لاغي خلال مدة» لا بيانات مدة لهما في حكيم. هل يُقرّ ذلك؟
9. **الحقل القديم الذي يحوي متنًا (153 نصًا):** هل يُخفى من العرض بعنوان «المقدمة» حتى يُستبدل؟ البيانات تعيده مع `completeness`، و`bodyLeak` متاح في الإشارات.

---

## الملحق أ — عقد دوال القراءة للعرض (للقسم أ)

```ts
// lib/modules/legal-core/sql-port.ts
interface SqlClient { query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> }
prismaSqlClient(prisma): SqlClient                // في الخادم

// lib/modules/legal-core/law-page-data.ts
getLawPageData(db: SqlClient, systemId: string, opts?: LawPageDataOptions)
  : Promise<LawPageData | null>                   // null = لا نظام بهذا المعرّف
LawPageDataOptions {
  asOf?: string                    // YYYY-MM-DD، افتراضيًا اليوم بالرياض
  withText?: boolean               // false: text/effectiveText = "" (لا يُقرأ نص المواد ولا نسخها)؛ الحالات كما هي
  withOutgoingRepeals?: boolean    // false: outgoingRepeals = [] (لا مسح لكل سجلات التحقق)
  resolveRepealingSystems?: boolean // false: repeal.repealingSystem = null (لا مسح لكل البطاقات)
}

LawPageData {
  system: { id, name, slug, articleCount, articleCountStored, classification, domainTitle, domain }
  asOf: string
  card: LawCardView {
    name, officialName, kind: WorkKind|null, domain,
    status: LawStatusView { boe: BoeLawStatus|null; label; hakeem; atSource; derivedByDate; evidence; period },
    instruments: IssueInstrument[] { kind, text, number, dateHijri, source, url },
    dates: { issued, published, effective, applied }: DateValue { hijri, gregorian, source },
    summary, officialSource: { name, url, retrievedOn } | null,
    replaces: SystemRef[], replacedBy: SystemRef|null, repeal: RepealInfo|null }
  preamble: PreambleView {
    kind: "units" | "source_blocks" | "legacy_text" | "none"; label: string|null;
    completeness: "complete" | "partial" | "issuance_line" | null;
    units: { editionId; source; rawSha256; outside: PreambleUnitView[]; instruments: PreambleInstrumentView[] } | null;
    sourceBlocks: { blocks: { kind; heading; text }[]; sourceUrl; retrievedOn } | null;
    legacy: { text; chars; royalDecree; completeness; bodyLeak } | null;   // يُعاد دائمًا إن وُجد؛ bodyLeak = متن لا مقدمة
    officialSourceUrl: string | null }
  body: { divisions: DivisionView[] { heading; articles: ArticleView[]; allRepealed },
          counts: { total, inForce, amended, repealed, unverified } }
  outgoingRepeals: OutgoingRepeal[]               // { …, articleNumber, articleBis, derived: true }
}
ArticleView { id, number,
  bis: number,                     // درجة «مكرر» (0 للأصل)؛ الصفوف بدرجة ≥ 100 لا تُقرأ أصلًا
  key: string,                     // articleKey من HKM-028: "103" أو "103_bis" أو "103_bis2" — فريد في النظام
  label: string,                   // "103" أو "103 مكرر"
  title, heading /* «المادة ١٠٣ مكرر» إن لم يكن عنوان */, chapter, text, effectiveText,
  status: "ساري" | "معدّل" | "ملغى" | null, statusLabel, statusSource, inheritedFromWork,
  amendment: { versions, currentFrom, instrument, url, pendingFrom } | null,
  repeal: RepealInfo | null, repealedLaterOn, anchor: `art-${key}`, url: `/legal/<slug>/<key>` }
// الترتيب: articleNumber ثم bis ثم id. صفحة المادة تحسم المفتاح بـ articleKey/المطابقة نفسها في main
// (app/legal/[slug]/[article]: /^(\d+)(?:_bis(\d*))?$/)، فلا تفتح المكررة بدل الأصل.
RepealInfo { type: RepealType|null; typeDerived; instrument; url; quote; effectiveDate; effectiveDateSource;
  repealingSystem: SystemRef|null; repealingSystemBasis; repealingArticle }
PreambleUnitView { id, type: PreambleUnitType, ordinal, label, number, text, anchor, path }

// ثوابت الوسوم
NOT_AVAILABLE = "غير متوفر"; PREAMBLE_INCOMPLETE_LABEL = "مقدمة غير مكتملة";
PREAMBLE_NONE_LABEL = "المقدمة غير متوفرة"; PREAMBLE_SOURCE_BLOCKS_LABEL; BOE_LAW_STATUSES

// lib/modules/legal-core/law-name-match.ts
findLawByName(db, name): Promise<{ match; matchType: "exact"|"prefix"|"contains"|"none"; alternatives }>
rankLawNameMatches(candidates, name, { retired? }); queryYears(name)

// lib/modules/legal-core/sql-port.ts
relationExists(db, name): Promise<boolean>         // to_regclass قبل قراءة جدول لم يُطبَّق ترحيله

// lib/modules/legal-core/preamble-search.ts
searchPreambleUnits(db, query, { limit?, systemIds?, unitTypes? }): Promise<PreambleSearchHit[]>
mergeArticleAndPreambleHits(articles, preamble, "separate" | "append")
```

**قواعد العقد**
- قراءة فقط.
- الحقل الفارغ يعني `null`، ويعرضه العرض «غير متوفر» دون أن يُخفيه أو يخترعه.
- التواريخ نصوص `YYYY-MM-DD` لا تتأثر بمنطقة الخادم.
- غياب أي جدول، كالجدولين الجديدين قبل الترحيل، يسقط بأمان إلى `none` أو قائمة فارغة.
- `law_card.status_at_source` يُعاد للاطلاع فقط ولا يُعتمد للحالة.

---

## الملحق ب — تصميم نوع التغيير `import_preamble` في مكتب التحرير (ب-٤) — وثيقة تصميم، لم يُنفَّذ

هذا التصميم مقروء من فرع المكتب `aman/legal-editorial-desk-phase0`، المجلد `lib/modules/editorial/`، وهجرته `20261017090000_editorial_desk_phase0`. جداول المكتب **غير مطبّقة على الإنتاج** (`change_set` و`editorial_change` و`index_sync` ⇒ 0 في `information_schema`).

### ١. الهدف والجدول

- `target_type = 'preamble'`، و`target_id = legal_systems.id`.
- قيد `editorial_change.target_type` اليوم: `('work','unit','ruling','relation','principle','amendment_op')`.
- **التوصية:** إضافة `'preamble'` في هجرة المكتب نفسها قبل تطبيقها أول مرة. الهجرة لم تُطبَّق، فهذا ليس تعديل جدول قائم.
- **البديل إن طُبّقت أولًا:** `target_type='work'` مع `op='import_preamble'`. عيبه أن الفهرس الجزئي `editorial_change_open_target_uq` (على `(target_type, target_id)` للحالات المفتوحة) يمنع أن يكون لنظام واحد تغيير حالة مفتوح واستيراد مقدمة مفتوح معًا.
- `op = 'import_preamble'`، ويُضاف إلى `ITEM_KINDS` في `types.ts`.

### ٢. الحمولة

- **`before`**:
  - `{ legacy_preamble_sha256, current_edition_id | null, current_raw_sha256 | null }`
  - يُقرأ وقت الإعداد ويُحفظ معه `read_at`. أي نسخة أحدث للهدف تعني تعارضًا (W-02).
- **`after`**:
  - `raw_text`: النص الحرفي كما لُصق، بلا تطبيع ولا `trim`.
  - `raw_sha256`.
  - `source_name`: «أم القرى» أو «هيئة الخبراء بمجلس الوزراء».
  - `source_url`: https على `uqn.gov.sa` أو `boe.gov.sa`.
  - `source_retrieved_on`: `YYYY-MM-DD`.
  - `source_record`: معرّف `law_card` عند الاستيراد من اللقطة، وإلا `null`.
  - `parser_version`: `PREAMBLE_PARSER_VERSION`.
  - `units`: قائمة `[{ ordinal, type, char_start, char_end, sha256(text) }]` للمعاينة والمقارنة، دون نسخ النص مرة ثانية.
  - `completeness` و`instruments` (النوع والرقم والتاريخ).
- **حقول الدليل:**
  - `evidence_url = source_url`، و`evidence_instrument` = عنوان الأداة الأولى، و`evidence_quote` = أول 300 حرف من النص.
  - `source_rank = sourceRankFromUrl(source_url)` في الخادم (`audit.ts:55`): 1 لأم القرى، 2 للهيئة. الرتبة 3 (الجهة المصدرة) **مرفوضة** لهذا الفعل، لأن الأمر يشترط أم القرى أو الهيئة.
  - `source_ref` مفتاح عدم التكرار: `preamble:<system_id>:<raw_sha256>`.
- `payloadHash` (`payload.ts:27`) يغطي `before` و`after` والدليل كما هو اليوم، فيتجمّد النص ووحداته من لحظة الإرسال.

### ٣. الفحوص

**عند الإنشاء** (`createChangeSet`):
1. `checkPreambleImport(raw, meta, parsePreamble(raw))` يتحقق من:
   - المصدر من القائمة، والرابط على النطاقين، والتاريخ بصيغته.
   - إعادة التركيب حرفية، وفي النص وحدات.
   - أي سبب يعني `checks_failed` ولا يدخل الطابور.
2. لا تغيير مفتوح للهدف، ويفرضه الفهرس الجزئي القائم.
3. إن كان `raw_sha256` يساوي بصمة أحدث نسخة، يُرفض بـ «لا تغيير».
4. تحذير غير مانع إن كان `completeness ≠ complete`، أو كان النص أقصر من الحقل القديم.

**عند الاعتماد:** القواعد القائمة نفسها. الوكيل لا يقرّر (`AGENT_CANNOT_DECIDE`)، والمعتمِد غير المُعِدّ، وحد الموافقات الأدنى.

**عند النشر:**
1. `assertPayloadUnchanged`.
2. يُعاد `parsePreamble(raw_text)` على الخادم، وتُقارن بصمات الوحدات بـ `after.units`. أي فرق، كتغيّر إصدار القارئ مثلًا، يرفض النشر ويطلب إعادة الإعداد.

### ٤. النشر

- **أين:** فرع جديد في حلقة `publishChangeSet` (`service.ts:503`). اليوم كل `op` غير `set_work_status` يرمي «فعل غير مدعوم للنشر».

```ts
if (change.op === "import_preamble") {
  const rows = buildPreambleEditionRows(after.raw_text, {
    systemId: change.target_id, sourceName, sourceUrl, sourceRetrievedOn, sourceRecord,
    legacyPreamble: <legal_systems.preamble الحالي>, supersedesEditionId: before.current_edition_id,
    changeRef: change.id, preparedBy: set.author_id, approvedBy: <المعتمِد الأخير>,
  });
  await insertPreambleEdition(tx, rows);            // داخل deskTransaction نفسها
  await setAppliedRef(tx, change.id, rows.edition.id);
  await enqueueIndexSync(tx, changeSetId, change);  // target_type='preamble' ← الفهرس النصي والتضمين لاحقًا
  await recordAudit(tx, actor, { action: "change.publish", objectType: "preamble", objectId: change.target_id,
    before: change.before, after: { edition_id: rows.edition.id, raw_sha256, units: rows.units.length } });
}
```

- **قيود القاعدة** تعمل عند الالتزام: إعادة التركيب، والتبليط، والعدد، و`approved_by <> prepared_by`. أي خلل يُلغي المعاملة كلها، فلا تُنشر مقدمة ناقصة.
- **`legal_systems.preamble` لا يُمس.** يُحفظ فقط `legacy_preamble_sha256`.

### ٥. التراجع

- `revert` ينشئ نسخة جديدة `preamble_edition`، وقيمة `supersedes_edition_id` فيها هي النسخة المنشورة.
- النسخة الجديدة تحمل نص النسخة السابقة إن وُجدت. إن لم توجد، فلا نسخة تُكتب ويُستعمل وسم «مسحوبة».
- **قرار تصميم:** يحتاج هذا الوسم عمودًا أو جدول سحب صغيرًا للإضافة فقط. أقترح جدول `preamble_withdrawal (edition_id, change_ref, reason)`، ويقرأه `preamble_unit_current`.
- يرفض التراجع إن لم تعد النسخة المنشورة هي الأحدث، أي `applied_ref ≠ current_edition_id`، على نمط ق-٧ القائم (`service.ts:542-553`).
- لا `DELETE` أبدًا، والجدولان للإضافة فقط.

### ٦. الاستيراد الجماعي

**نقطة الإدخال:** `POST /api/editorial/preambles/bulk` بصلاحية المُعِدّ.

**الملف:** JSON على بنية الدفعات الخمس:

```json
{ "batch": "litigation-core-1", "source_name": "هيئة الخبراء بمجلس الوزراء",
  "items": [ { "system_id": "…" | null, "law_name": "…", "source_url": "https://laws.boe.gov.sa/…",
               "source_retrieved_on": "2026-10-20", "raw_text": "…" } ] }
```

**المعالجة:**
1. يُحلّ كل عنصر إلى نظام بـ `system_id` أو `findLawByName` بالمطابقة التامة فقط. أي غموض يعني رفض العنصر، ولا تخمين.
2. يُفكَّك كل عنصر ويُفحص.
3. يُنشأ **change_set واحد لكل دفعة**، وفيه تغيير `import_preamble` لكل نظام.
4. العنصر الفاشل لا يُسقط الدفعة، ويُعاد في تقرير `{ accepted, rejected: [{ law_name, reasons }] }`.
5. المعاينة صفحة واحدة لكل تغيير، فيها الوحدات بنوعها وبصمة النص ومقارنة بالحقل القديم.

**الاستيراد من اللقطة** (للأنظمة الـ446): سكربت يقرأ `law_card` ويبني العناصر بـ `raw_text = composeLawCardText(text_blocks)` و`source_record = law_card.id`. النص من القاعدة نفسها، فلا سحب ولا لصق. التصميم وحده هنا، والسكربت يُكتب مع التنفيذ.

### ٧. ما يحتاجه التنفيذ على فرع المكتب

1. نقل `preamble-parser.ts` و`preamble-edition.ts` و`sql-port.ts` من هذا الفرع، أو دمجه أولًا.
2. إضافة `'preamble'` لقيد `target_type` في هجرة المكتب قبل تطبيقها.
3. فرع النشر والتراجع واختباراتهما على قاعدة محلية، على نمط `test:editorial-desk` القائم.
4. شاشة اللصق والمعاينة: للقسم أ، أو aman-frontend.

---

## الملحق ج — القسم أ (العرض): صفحة النظام الكاملة وصفحة المادة المستقلة

- **المُنفِّذ:** aman-frontend، 2026-10-17. الالتزام `e70d8f4` على `aman/hkm-023-b-law-page`. **لم يُدفع.**
- **بوابة التصميم:** مواصفة aman-ui-designer (`design-review/law-page-spec.md` 1.0) ونموذجها. القرار المنفَّذ: الصفحة العامة على `/law/<معرّف>`.
- **قراءات رجّحتُها لغياب المالك:**
  - المعرّف الدائم بأداة الإصدار (`m-43-1443`) غير مخزّن، فالمعرّف اليوم هو `eliSlug` المجمّد أو اشتقاقه (المواصفة §١ «مؤقتًا»). المعرّف الداخلي وأي إملاء آخر يُقبلان ويُحوَّلان إلى الكنسي.
  - `app/legal/[slug]` و`[article]` **لم تُمسّا** حفاظًا على عمل #724، وتحويلهما إلى `/law/*` قرار بعد مراجعة aman-qa، لأنهما المرجع المفهرس في الإنتاج اليوم.
  - `/dashboard/legal-core/articles/<id>` **لم يُحوَّل**: صفحته تحمل لوحات (المسائل الفقهية، الشرح، المقارن، الرسم المعرفي، نقاط القراءة) لا تحملها صفحة المادة العامة، وتحويلها يُسقطها عن المستخدم المسجّل.
  - الحواشي `<details>/<summary>` أصلية (إفصاح بلا سكربت، وتُفتح كلها عند الطباعة) بدل زر `aria-expanded`.
  - أدوات المادة على الجوال أزرار أيقونة 44 في صف العنوان، لا لوح «أدوات المادة».
- **ما لم يُمسّ:** `law-page-data.ts` (بلا تعديل)، والمسارات المراقبة، و`middleware.ts`، و`next.config.mjs`، و`package.json`.

### جدول المتطلبات

| الرمز | الحال | الدليل أو السبب |
|---|---|---|
| ع-١ الترتيب | منفذ ومتحقق | قياس الموضع: البطاقة ثم الأدوات ثم المقدمة ثم «نص النظام» في الأنظمة الأربعة وعلى العروض الثلاثة (`metrics.json` الحقل `order`). |
| ع-٢ البطاقة | منفذ ومتحقق | الحقول التسعة دائمًا، والفارغ «غير متوفر» (٢ في الإثبات، ٦ في المرافعات الاصطناعي). الحالة من الست فقط (`statusTone`، U-2.2). «خلال مدة» بسطر المدة. «حلّ محل» يظهر حين يعيده العقد. |
| ع-٣ الأدوات | منفذ ومتحقق جزئيًا | البحث يبرز (١٠ مطابقات) وينتقل ويعلن «المطابقة ١ من ١٠، المادة المائة»، ويفتح المقدمة المطوية. المرشحات: «المعدّل فقط» ١ ظاهرة = العدّاد، و«الملغى فقط» ٤ = العدّاد، و`?show=`. نسخ الرابط والطباعة. **لم يُنفَّذ:** شريط الموضع على الجوال، و`aria-current` في الفهرس. |
| ع-٤ المقدمة | منفذ ومتحقق | الوحدات بتنسيق الأداة ومراسي البنود `#preamble-1-clause-n` (والبديل `#preamble-clause-n`). مطوية 432 على الجوال و480 على الحاسب، و`inert`. النص القديم بوسم «مقدمة غير مكتملة» ورابط المصدر، والغياب صندوق «المقدمة غير متوفرة». |
| ع-٥ المتن | منفذ ومتحقق جزئيًا | المواد بنصها تحت فواصل الأبواب، والفقرات والبنود بترقيمها الأصلي (U-5.3). Amiri المحمّل `__fontJudicial…` 18/36 و20/40. التحميل التدريجي `content-visibility: auto` (عرض افتراضي من المتصفح) والبحث يشمل كل المواد. **لم يتحقق:** الأداء على ٧٢١ مادة، فالقاعدة الاصطناعية صغيرة. |
| ع-٦ المعدّلة | منفذ ومتحقق | سطح ووسم «معدّلة»، والنص الساري، والحاشية: الأداة ورابطها وتاريخ السريان والنص السابق. |
| ع-٧أ الملغاة | منفذ ومتحقق | النص كامل بلا شطب ولا تبهيت، ووسم «ملغاة»، و«بيان الإلغاء» بحقوله. الباب الملغى موسوم مرة واحدة بحاشية واحدة. الاتجاه المعاكس: «ما ألغته أداة إصدار هذا النظام» مجمّعًا نطاقات (U-7a.3). **حدّ البيانات:** المادة الملغية بعينها غير مخزّنة، فتُعرض «غير متوفر». |
| ع-٧ب النظام الملغى | منفذ ومتحقق | الشريط بعد h1 وقبل البطاقة، والتاريخ والنوع وزر «الساري هو» ورابط الأداة، والمواد موسومة بلا حاشية مكررة. |
| ع-٧ج الإلغاء الضمني | لم يُنفذ | لا يعيد العقد بيانات «صدر بعده نظام تضمّن إلغاء ما يتعارض». لا وسم آلي على أي مادة. |
| ع-٨ الخاتمة | منفذ | المواد الختامية تُعرض كأي مادة. |
| ع-٩ كما في تاريخ | منفذ ومتحقق جزئيًا | «لا تتوفر نسخ تاريخية» حين لا بيانات، وتنبيه حين يُطلب `asof` لنظام بلا نسخ (U-9.2)، و`asof` و`asOf` كلاهما. العرض التاريخي يعتمد العقد (`repealedLaterOn`، النص بالتاريخ). العدّادات بالتاريخ لم تُختبر بصريًا. |
| ع-١٠ المقارنة | لم يُنفذ | الوقت. |
| ع-١١ الربط | لم يُنفذ | البطاقتان في صفحة المادة تصرّحان بعدم الربط، ولا تعرضان صفرًا يوهم الغياب. |
| ع-١٢ الهوية والإتاحة | منفذ ومتحقق جزئيًا | رموز المواصفة دون لون جديد، و`lang`/`dir`، ورابط التخطي، والتواريخ معزولة `bdi`، وصفر هدف أصغر من 24 في القياس. لم يُشغَّل axe ولا قارئ شاشة. الوضع الداكن غير مفعّل في الصفحات القانونية. |
| ع-١٥ الروابط | منفذ ومتحقق جزئيًا | `/law/<معرّف>` و`/law/<معرّف>/art/<n>` و«اقرأها في سياق النظام» إلى `#art-n` بإبراز مؤقت وتركيز العنوان، ومراسي `#art-n` و`#art-n-p-m`، والإحالة المنسوخة بالرابط المستقل، وcanonical، و`noindex` للتاريخي. `/eli/…` يعطي **301** فعلًا. **لم يتحقق 301 للوحة:** `/dashboard/legal-core/systems/<id>` والمعرّف غير الكنسي و404 تعيد **200** ثم تتحوّل في المتصفح، لأن `app/loading.tsx` الجذري يبث الصفحة قبل وصول `permanentRedirect`/`notFound`، حتى من `generateMetadata`. |

### الفحوص

- `npm run typecheck`: نظيف.
- `npx next lint --file` على الملفات الخمسة عشر الملموسة: نظيف.
- `npx tsx scripts/test-law-page-view.ts`: **42/42**. السكربت غير مسجّل في `package.json` لأن الملف يحمل أمر البناء المراقب.
- **فحص بصري حي:** معاينة محلية على المنفذ 3500، قاعدة اصطناعية `hakeem_lawpage_preview_test` من بذور `test-law-page-data`، مع سطر إصدار وفقرات اصطناعية.
  - الأنظمة: الإثبات (مقدمة كاملة بالوحدات)، والمعاملات المدنية (سطر إصدار فقط)، والمرافعات (معدّلة وملغاة وباب ملغى)، والضمان القديم (نظام ملغى).
  - `innerWidth = clientWidth = scrollWidth` على 320 و390 و1440 في الأنظمة الأربعة وصفحتي المادة: صفر فيض أفقي.
  - أخطاء وحدة التحكم: «Failed to fetch RSC payload … Falling back to browser navigation» في وضع التطوير فقط مع الروابط العربية، ويتراجع إلى تنقل المتصفح بلا أثر ظاهر. يُفحص على معاينة Vercel.
  - اللقطات: `scratchpad/shots/hkm-023-b/`، وقياساتها في `metrics.json`.
- **لم يُشغَّل:** `next build`، و`prisma generate --no-engine`، وaxe، والأداء على معاينة Vercel.

### جولة الإصلاح بعد مراجعة الجودة (qa-b على dcb7678)

- **الالتزامات:**
  - `f0a26e5`: دمج main ‏`604bd56`. حُل التعارضان: `package.json` بإبقاء سكربتات الطرفين، ولم يُمس أمر البناء. و`app/eli/[...slug]/route.ts` بإبقاء فلتر main ‏`articleBis: 0` مع تحويل `/law` الدائم.
  - `b3603e9`: الإصلاحات أدناه.
- **م١ (الحالة الحقيقية):**
  - الوسيط يحسم مسارات `/law/*` و`/dashboard/legal-core/systems/*` قبل الرسم (`lib/modules/legal-core/law-route-gate.ts`).
  - يقرأ جدولًا خفيفًا من `/api/law-routes` فيه المعرّف الداخلي والكنسي ونطاقات أرقام المواد، ويخزّنه في الذاكرة عشر دقائق.
  - إن تعذّر الجدول يمرّ الطلب بالسلوك السابق ولا ينكسر.
  - صُحّحت التعليقات الثلاثة التي كانت تدّعي أن الحالة تُحسم في الصفحة.
  - **التحقق بـ curl على `next build && next start` محليًا:**
    - المعرّف الداخلي والإملاء بالهمزة: **301** إلى الكنسي، و`?asof` محفوظ.
    - الكنسي: 200.
    - `/law/does-not-exist`: **404**.
    - مادة غير موجودة (999) ورقم غير صالح (abc): **404**.
    - `/law/<داخلي>/art/212`: **301**.
    - `/dashboard/legal-core/systems/<id>`: **301**.
    - معرّف لوحة مجهول: 200 من الصفحة. هذا احتياط، ولا يصل إليه رابط صحيح.
- **م٢ (المرساة):**
  - عند الوصول إلى `#art-N` تُرسم المواد قبل الهدف رسمًا فعليًا، ثم يُعاد التمرير حتى يستقر الموضع، ومرة بعد تحميل الخطوط.
  - يتوقف إن مرّر المستخدم بنفسه. ويُطبَّق كذلك عند `hashchange` من الفهرس.
  - **حيًّا على 721 مادة اصطناعية** (`next start`): `#art-500` و`#art-700` و`#art-61` تهبط على المادة نفسها بالإزاحة المطلوبة تمامًا (72 بكسل على 390، و80 على 1440)، والتركيز على عنوانها، وصفر خطأ في وحدة التحكم. و`hashchange` إلى `#art-450` كذلك.
- **م٣ (التنقية):**
  - `sanitizeDisplayText` في طبقة العرض على نص المادة، والنص السابق، والمقدمة بحالاتها، ووصف صفحة المادة.
  - حيًّا: مادة اصطناعية فيها U+202E وU+200B لم يبق منهما شيء في HTML.
- **ن٦:** `/law/(.*)` في قائمة تجاوز Clerk كـ `/legal(.*)`.
- **ن٧:** `?asof` يُحفظ في تحويل صفحة المادة.
- **الفحوص:**
  - typecheck نظيف في نسخة نظيفة من `b3603e9` بعميل Prisma مولَّد من مخطط main المدموج. أما في `wt-b` فيظهر خطأ `articleBis` في ملفات main وحدها، لأن `node_modules` المشترك مولَّد من مخطط أقدم.
  - `next build` نجح.
  - `next lint --file` على الملفات المتغيّرة: نظيف.
  - `test-law-page-view` نجح 42 من 42.
- **لم يُعالج في هذه الجولة:**
  - **م٤:** تحويل صفحة اللوحة يحتاج قرار المالك، فالسلوك باقٍ كما هو مع 301 حقيقي.
  - **م٥:** `React.cache` وتخفيف حمولة أدوات المادة.
  - **ن١:** «Failed to fetch RSC payload» لم يُعد قياسه بعد إزالة `meta refresh`.
  - **ن٤:** روابط `ArticleView.url` في `law-page-data.ts`، وهو ملف مهندس البيانات.
  - **ع١ وع٢ (`articleBis` وحجم MCP):** لمهندس البيانات في `wt-b-data`.
  - **مرساة المكرر `art-N-bis-K`:** تتبع إضافة `bis` إلى `ArticleView`.

### ما يبقى للعرض

1. ~~تحويل 301 حقيقي لروابط اللوحة~~: أُنجز في جولة الإصلاح عبر الوسيط. يبقى التحقق على معاينة Vercel، لأن جلب الوسيط لـ`/api/law-routes` قد يتعطل خلف حماية المعاينات، فيسقط إلى السلوك القديم.
2. تحويل `/legal/*` و`/dashboard/legal-core/articles/<id>` بقرار.
3. شريط الموضع، والفهرس بـ`aria-current`، ولوح أدوات المادة على الجوال.
4. ع-٧ج وع-١٠ وع-١١ حين تتوفر بياناتها.
5. مراجعة aman-ux وaman-ui-designer للمنفَّذ، ثم aman-qa على المعاينة.
