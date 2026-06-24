# تقرير شامل — مشروع «عرض الأنظمة» في منصة حكيم
## حالة قواعد البيانات · آلية العرض · الظهور مع باقي الخدمات · تقييم أفضل الممارسات

> تاريخ التقرير: 2026‑06‑20 · النطاق: النواة القانونية (الأنظمة والمواد) وتكاملها.
> منهج الإعداد: قراءة فعلية للكود (لا تخمين) — طبقة البيانات والإعداد فُحصت مباشرة، وطبقتا العرض والخدمات عبر مسح شامل.

---

## ١) ملخّص تنفيذي

- **المحرّك:** PostgreSQL عبر Prisma (عميل مفرد singleton). الجدولان المحوريان `legal_systems` و`legal_articles`.
- **حجم المحتوى الفعلي:** الكوربوس الكامل ≈ **485 نظاماً · 15,902 مادة** (مؤكَّد من فهرس BM25 المبني من الإنتاج). لكن **بذرة المستودع المحلية تتوقّع 9 أنظمة / 1,981 مادة فقط** — فجوة بين بيئة التطوير والإنتاج.
- **آلية العرض:** 4 صفحات (الرئيسية، الأنظمة، المادة، البحث) — البحث مُرقّم وناضج، لكن **صفحة الأنظمة تعرض كل الأنظمة دفعةً واحدة بلا ترقيم ولا بحث** (مشكلة حقيقية مع 485 نظاماً).
- **التكامل مع الخدمات:** سلسلة ناضجة: الاسترجاع → البحث الهجين → RAG → تحليل القضايا → الوكيل القانوني → المحاكاة القضائية، كلها تستند للأنظمة/المواد مع **تحقّق استناد (grounding) ومنع هلوسة**.
- **أبرز الثغرات:** ترقيم/بحث صفحة الأنظمة · انجراف الـ schema (db push بدل migrations) · مزامنة جدول `legal_systems` وعداد المواد · سكربتات DB مباشرة في الصفحات · فهارس ثابتة (BM25/الفقه) قد تتأخّر عن قاعدة البيانات الحيّة · `DISABLE_AUTH=true` افتراضياً.

---

## ٢) حالة قواعد البيانات

### ٢.١ المحرّك والاتصال
- `lib/prisma.ts`: عميل Prisma مفرد، تسجيل الاستعلامات في التطوير فقط. الاتصال عبر `DATABASE_URL`.
- `.env.example`: مثال **Supabase** (pgbouncer)، لكن سكربت التدقيق يكشف بيئات متعدّدة.

### ٢.٢ البيئات (متعدّدة)
من `scripts/audit-db-environments.ts`:
- **PostgreSQL:** `DATABASE_URL` · `VERCEL_DATABASE_URL_INSPECT` · `GITHUB_DATABASE_URL_INSPECT`.
- **MySQL (مصدر قديم):** `HOSTINGER_DB_URL` · `MYSQL_URL` — مصدر استيراد الأحكام (`ahkam_moj`) عبر `import-judgments-sql.ts`.
- مؤشرات على **Neon** كهدف إنتاج (`scripts/sql/neon-retrieval-*.sql`).
> أي: المنصة تجمع بين قاعدة إنتاج PostgreSQL (Neon/Supabase/Vercel) ومصدر MySQL تاريخي للأحكام.

### ٢.٣ السكيمة (الجداول المحورية)
- `legal_systems`: `id, name (unique), classification, articleCount, createdAt, updatedAt` + علاقة `articles[]`.
- `legal_articles`: `id, legalSystemId?, lawName, classification?, articleNumber, title, content, chapter?, keywords[], royalDecree?, effectiveFrom?, status, embedding(Json?)` — مفتاح فريد `(lawName, articleNumber)`، فهرس على `lawName`.
- جداول مرتبطة: `judicial_cases`, `judicial_principles`, `legal_article_case_links`, `legal_relations`, `embeddings`, وأحدثها `fiqh_issues` + `fiqh_issue_links` (المسائل القانونية).

### ٢.٤ الفهارس والامتدادات (أداء الاسترجاع)
من `scripts/sql/neon-retrieval-pre.sql`:
- امتدادات `pg_trgm` + `vector`.
- جدول `embeddings` (pgvector 1536) + فهرس فريد `(owner_type, owner_id)`.
- **فهارس GIN trigram** على `legal_articles.content/title` و`judicial_cases` — لتسريع البحث النصّي العربي (ILIKE/contains).

### ٢.٥ التهجير (Migrations) — ⚠️ ثغرة حوكمة
- مجلد `prisma/migrations` يحوي **هجرتين فقط** (`judicial_cases`, `knowledge_graph_pgvector`).
- جداول `legal_systems`/`legal_articles` (والجديدة `fiqh_*`) تُدار عبر **`prisma db push`** لا migrations.
- **فهارس Neon (trigram/pgvector) مُدارة خارج Prisma بـ SQL خام** مع تحذير صريح: «لا تشغّل `db push` على Neon» (قد يُسقط الفهارس). ← مصدر انجراف (drift) محتمل بين السكيمة والإنتاج.

### ٢.٦ مصادر البيانات والاستيعاب
- **الإنتاج:** `import-hoqoqi-sql.ts` (الأنظمة والمواد) + `import-judgments-sql.ts` (الأحكام من MySQL) → الكوربوس الكامل (485/15,902).
- **البذر المحلي:** `seed-legal-library.ts` يتوقّع **9 أنظمة / 1,981 مادة** (مجموعة جزئية) + الأدوار والصلاحيات والمستخدمين.
- **ملفات مشتقّة في المستودع:** `legal-bm25-index.json.gz` (الكوربوس الكامل، 16,037 وثيقة)، `saudi_systems.json` (485/15,902)، `legal_articles_export.json` (جزئي 9)، فهارس المسائل القانونية.
> ⚠️ **فجوة بيئات:** بذرة 9 أنظمة لا تمثّل إنتاج 485 نظاماً — أي اختبار عرض محلي يُضلّل ما لم تُربط بقاعدة الإنتاج أو يُحدَّث البذر.

### ٢.٧ مزامنة `legal_systems` وعدّاد المواد — ⚠️
- `getLibraryStats()` يقرأ جدول `legal_systems`؛ **وإن كان فارغاً يسقط إلى `groupBy(lawName)`** على المواد.
- `articleCount` عمود مُخزَّن في `legal_systems` — قابل للتقادم إن لم يُزامَن بعد كل استيراد (توجد `diagnose-legal-systems.ts` للتشخيص).

### ٢.٨ إعدادات تشغيلية مؤثّرة (من `.env.example`)
- `DISABLE_AUTH="true"` افتراضياً (وضع بلا تسجيل دخول) — ⚠️ أمني للإنتاج.
- `AI_PROVIDER="mock"` افتراضياً (محاكاة حتمية بلا مفتاح).
- `SEMANTIC_SEARCH="false"` افتراضياً (إعادة الترتيب الدلالي مُعطّلة ما لم تُملأ المتجهات + مفتاح).
- `OPENSEARCH_URL=""` → البحث يعمل بـ PostgreSQL + pgvector فقط (سقوط آمن).

---

## ٣) آلية عرض الأنظمة (طبقة الواجهة)

| الصفحة | المسار | المصدر | الترقيم | الحالة |
|---|---|---|---|---|
| الرئيسية | `/dashboard/legal-core` | `getLibraryStats` + `searchLegalArticles` + 3 استدعاءات prisma مباشرة | أحدث 4 مواد | ناضجة |
| **الأنظمة** | `/dashboard/legal-core/systems` | `getLibraryStats().laws` → بطاقات | **لا ترقيم/بحث** ⚠️ | بحاجة تحسين |
| المادة | `/dashboard/legal-core/articles/[id]` | `prisma.findUnique` + related + `getFiqhIssuesForArticle` | روابط أحكام 8 · مواد ذات صلة 6 | ناضجة (نص كامل) |
| البحث | `/dashboard/legal-core/search` | `searchLegalCore` (legal‑retrieval) | **30/صفحة (حتى 80)** | ناضجة |

**ملاحظات معمارية:**
- **نمط مختلط:** البحث/الاسترجاع مغلّف في خدمة (`legal-retrieval`, `library-service`)، لكن **~6 استدعاءات prisma مباشرة داخل الصفحات** (تصنيفات، عدّ المراجعة، الأحكام، المادة، المواد ذات الصلة، قائمة الأنظمة).
- كل الصفحات `force-dynamic` بلا أي **تخزين مؤقت/ISR** — رغم أن نصوص الأنظمة شبه ثابتة.
- **RBAC متّسق:** `requirePagePermission("LEGAL_CORE_VIEW")` على كل الصفحات، و`requireApiPermission` على مسارات الـ API.
- المحتوى: صفحة المادة تعرض **النص الكامل**؛ نتائج البحث **مقتطفات** (520 حرفاً متمركزة + فقرتان).
- بحث عربي متقدّم: `exact | contains | derivatives | root | stem | affixes` عبر `arabic-morphology.ts` + قائمة إيقاف (~432 كلمة).

---

## ٤) ظهور الأنظمة مع باقي الخدمات

**سلسلة الذكاء القانوني (كلها مستندة للأنظمة/المواد):**
```
وقائع → legal-retrieval (searchLegalCore) ─┐
        hybrid-search (4 مزوّدات) ─────────┤→ legal-rag (استناد+تحقّق)
                                            │      ↓
                                     case-analysis → legal-agent → judicial-simulation
```
- **`legal-retrieval.searchLegalCore`** — المحرّك الأساسي: يدمج خريطة المفاهيم + المكنز (~2,967 مفهوماً) + متجهات اختيارية + **اختيار مرشّحين متنوّع الأنظمة** (يمنع هيمنة نظام واحد) + تغطية المفاهيم.
- **البحث الهجين** `legal-search/hybrid-search` — 4 مزوّدات (postgres / vector / knowledge‑graph / opensearch) بدمج وتعزيز متعدّد المصادر؛ مزوّد OpenSearch اختياري (سقوط آمن).
- **RAG** `legal-rag-service` — يجلب المواد/الأحكام/المبادئ الكاملة، يربط المادة بالأحكام عبر `legal_article_case_links`، ثم **حارس الاستناد** يمنع الإجابة بلا مصادر كافية + **تحقّق الاستشهاد**.
- **تحليل القضايا / الوكيل / المحاكاة** — تتسلسل فوق RAG، بمخرجات تحمل استشهادات محقّقة وأعلام استناد، ولكل منها **بديل حتمي** عند غياب مزوّد الذكاء.
- **المسائل القانونية والمعجم:** `fiqh-issues` (مادة → مسائلها) و`legal-issues` (تصفّح) عبر **فهارس JSON ثابتة**؛ `concept-map` + مفاهيم المعجم تُرجّح الاسترجاع. `bm25` فهرس مضغوط ثابت يخدم ربط المسائل.

> الخلاصة: الأنظمة/المواد هي **مصدر الحقيقة الموحّد** لكل الخدمات، والاستناد مُحكم. مكامن الهشاشة في **اتساق المصادر الثابتة مع قاعدة البيانات الحيّة**.

---

## ٥) تقييم وفق أفضل الممارسات

### نقاط القوة ✅
1. معمارية استناد قوية (grounding + تحقّق استشهاد + منع هلوسة) — منسجمة مع قاعدة CLAUDE.md.
2. اختيار مرشّحين متنوّع الأنظمة يرفع جودة الاسترجاع.
3. بدائل حتمية لكل مخرجات الذكاء (مرونة بلا مفتاح).
4. RBAC متّسق على الصفحات والـ API.
5. سقوط آمن للمكوّنات الاختيارية (OpenSearch/المتجهات/الفهارس الثابتة).
6. مفتاح فريد نظيف `(lawName, articleNumber)` يربط كل الطبقات (وحتى المسائل القانونية).
7. فهارس GIN trigram + pgvector للأداء على الكوربوس الكبير.

### الثغرات (مرتّبة بالأولوية) ⚠️
| # | الثغرة | الأثر | الأولوية |
|---|---|---|---|
| 1 | صفحة الأنظمة بلا ترقيم/بحث (تعرض 485 بطاقة) | بطء/تجربة سيئة في الإنتاج | 🔴 عالية |
| 2 | انجراف الـ schema: `db push` + SQL خام خارج migrations | خطر تشغيلي وفقدان فهارس | 🔴 عالية |
| 3 | فجوة البذر (9) مقابل الإنتاج (485) | اختبار محلي مُضلِّل | 🟡 متوسطة |
| 4 | مزامنة `legal_systems.articleCount` بعد الاستيراد | إحصاءات متقادمة | 🟡 متوسطة |
| 5 | فهارس BM25/الفقه ثابتة قد تتأخّر عن DB | نتائج/روابط ناقصة للمواد الجديدة | 🟡 متوسطة |
| 6 | لا تخزين مؤقت/ISR (كل شيء force-dynamic) | حمل وتكلفة أعلى | 🟡 متوسطة |
| 7 | استدعاءات prisma مباشرة في الصفحات | تكرار، صعوبة كاش/اختبار | 🟢 منخفضة |
| 8 | `DISABLE_AUTH=true` افتراضياً | أمني إن سُرّب للإنتاج | 🔴 عالية (إنتاج) |
| 9 | المكنز يُدخل مفاهيم candidate في التوسعة | ضوضاء استرجاع | 🟢 منخفضة |

---

## ٦) توصيات عملية (خاصة بمشروع «عرض الأنظمة»)

### مكاسب سريعة (أسبوع)
1. **ترقيم + بحث + تصفية لصفحة الأنظمة** (مثل صفحة البحث): تقسيم حسب التصنيف/المجال، صندوق بحث، وعدّاد. يعالج الثغرة #1 مباشرةً.
2. **توحيد طبقة الوصول للبيانات (DAL):** نقل استدعاءات prisma من الصفحات إلى `library-service`/repository (دوال: `listSystems`, `getSystemArticles`, `getArticle`)، تمهيداً للكاش والاختبار.
3. **مزامنة `legal_systems`:** سكربت `sync:systems` يعيد بناء صفوف الأنظمة و`articleCount` من `legal_articles` بعد كل استيراد (idempotent).

### متوسطة المدى (٢‑٤ أسابيع)
4. **حوكمة الـ schema:** اعتماد migrations رسمية لجداول الأنظمة/المواد/الفقه + توثيق فهارس Neon ضمن مسار تهجير مُقفل (إنهاء الانجراف، الثغرة #2).
5. **تخزين مؤقت ذكي:** `revalidate`/ISR لصفحات الأنظمة والمواد (محتوى شبه ثابت) مع إبطال عند الاستيراد — بدل `force-dynamic` الشامل.
6. **إعادة بناء فهرس BM25 من DB** ضمن خط الاستيراد (`build:bm25:db`) ليبقى متّزناً مع المواد الجديدة (الثغرة #5).
7. **محاذاة البذر مع الإنتاج:** بذرة مُمثِّلة (عيّنة من 485) أو وضع «اتصال إنتاج للقراءة» للتطوير (الثغرة #3).

### استراتيجية
8. تفعيل البحث الدلالي افتراضياً بعد ملء المتجهات (رفع الدقة)، وتقييد توسعة المكنز إلى `approved` لتقليل الضوضاء.
9. مراجعة `DISABLE_AUTH` و`AI_PROVIDER=mock` في إعداد الإنتاج صراحةً (بوابة نشر).

---

## ٧) خريطة مرجعية سريعة (ملفات ومواضع)

| الطبقة | الملف |
|---|---|
| عميل DB | `lib/prisma.ts` |
| خدمة المكتبة | `lib/modules/library/library-service.ts` (`getLibraryStats`, `searchLegalArticles`) |
| محرّك الاسترجاع | `lib/modules/legal-core/legal-retrieval.ts` |
| البحث الهجين | `lib/modules/legal-search/hybrid-search.ts` (+ providers) |
| RAG | `lib/modules/legal-rag/legal-rag-service.ts` |
| الترجيح المفاهيمي | `lib/modules/legal-core/concept-map.ts` + المكنز `legal-thesaurus/concept-index.ts` |
| المسائل القانونية | `lib/modules/legal-core/{legal-issues,fiqh-issues}.ts` |
| صفحات العرض | `app/dashboard/legal-core/{page,systems,articles/[id],search}.tsx` |
| تدقيق البيئات | `scripts/audit-db-environments.ts` · `scripts/diagnose-legal-systems.ts` |
| فهارس/امتدادات DB | `scripts/sql/neon-retrieval-pre.sql` |
| الاستيراد/البذر | `scripts/import-hoqoqi-sql.ts` · `scripts/import-judgments-sql.ts` · `scripts/seed-legal-library.ts` |

---

*انتهى التقرير.*
