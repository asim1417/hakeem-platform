# 06 — تقرير جاهزية البحث

## المحرّكات — ما هو مُفعَّل فعليًّا (مفحوص)
| التقنية | مطبَّقة؟ | مُفعَّلة وقت التشغيل؟ | الدليل |
|---|---|---|---|
| ILIKE (`contains`) | نعم | **نعم — العمود الفقري** | `legal-retrieval.ts:694-714`, `postgres-provider.ts:40-47` |
| Postgres FTS (`tsvector`/`ts_rank_cd`) | نعم | **مشروط** (لا فلتر بنيوي + `IN_DB_RECALL≠0`) | `legal-retrieval.ts:226-258` — يعتمد `search_norm`+GIN **غير موجودَين في المهاجرات** |
| pg_trgm | **لا** | لا | غائب تمامًا |
| pgvector (دلالي) | نعم | **مشروط** (مفتاح embedding + متجهات مُعبّأة) | `vector-provider.ts:42-78` |
| فهرس ANN (HNSW) | سكربت يدوي فقط | **خامل** (ليس في مهاجرة) → مسح تسلسلي | `scripts/sql/neon-retrieval-hnsw.sql:8-9` |
| BM25 (فهرس gz) | نعم | **غير مدرج في الهجين** (مسار منفصل فقط) | `bm25.ts:46-87`; `app/api/legal-core/bm25-search` |
| OpenSearch | نعم | **خامل افتراضيًّا** (لا URL) | `opensearch-provider.ts` |
| Knowledge Graph | نعم | نشط إن بُذِرت `legal_relations` | `knowledge-graph-provider.ts:14-84` |

**الحالة الافتراضية الفعلية** (بلا OpenSearch وبلا مفتاح embedding): **postgres فقط** (+KG إن بُذِر) يُنتج نتائج.

## الدمج والترتيب
RRF حقيقي (`RRF_K=60`)، بلا أوزان يدويّة، `confidence=rrf/maxRrf`، مطابقة المادة الدقيقة تتصدّر بعد الدمج
(`hybrid-search.ts:148-200,109-112`). **سليم.**

## النتائج (رموز)
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| SEARCH-001 | High | **أرقام المواد بالأرقام العربية-الهندية (٥) لا تُحلَّل** (`\d` لاتيني فقط)؛ والدالّة المصحّحة `normalizeArabicQuery` **بلا مستدعٍ** | `query-parse.ts:6,9-15`; `legal-retrieval.ts:707` |
| SEARCH-005 | Medium | **`bm25-search` بلا أي مصادقة** — وصول غير مُوثَّق لكامل الفهرس المقنَّن | `app/api/legal-core/bm25-search/route.ts:11-17` |
| SEARCH-006 | Medium | **الأحكام/المبادئ غير المُراجعة (`needs_review`) تظهر في البحث** بلا فلترة، بمرتبة متساوية مع المُعتمد | `postgres-provider.ts:86-115`; schema:223,248,268 |
| SEARCH-002 | Medium | مرشّحات `context` (caseType/court/stage) **مقبولة لكن يتجاهلها كل مزوّد** (no-op صامت) | `search-provider.ts:11`؛ لا مرجع في `providers/` |
| SEARCH-003 | Medium | مطابقة «رقم+نظام» الدقيقة **best-effort**: عند تعذّر حلّ النظام تعيد null فتظهر مادة الرقم من نظام آخر | `hybrid-search.ts:58-63` |
| SEARCH-004 | Low | فلتر مراجعة OpenSearch يستهدف `status:"needs_review"` وقيمة الحقل ليست كذلك → لا يستبعد شيئًا | `opensearch-provider.ts:62` |
| SEARCH-007 | Low | **محرّكا ترتيب متباعدان** (هجين RRF مقابل core) → ترتيب مختلف لنفس الاستعلام عبر الواجهات | `legal-retrieval.ts:754-837` |
| SEARCH-PERF | Medium | **غياب فهرس ANN و`search_norm` GIN من المهاجرات** → مسارات بحث تسقط لمسح ILIKE كامل (بطء عند الحجم) | لا مهاجرة تنشئهما |

## اللغة العربية
- تطبيع **أحادي الاتجاه ومتباين بين المحرّكات:** core يوحّد الهمزات/التاء/الياء لكن **لا يحوّل الأرقام**؛ BM25 يحوّلها
  بقواعد مختلفة؛ `normalizeArabicQuery` (يحوّلها) **ميّت**. (`arabic-morphology.ts:25-30`, `bm25-tokenizer.ts:11-28`).
- **لا تصحيح إملائي/fuzzy/did-you-mean** إطلاقًا.
- المرادفات/المكنز (2,967 مفهومًا) في مسار **core فقط**، لا في vector/opensearch/KG.

## تسريب الحقول
- `/api/legal/search` (خارجي) **يجرّد `status`/`reviewStatus`** ✅. `/api/legal-search` (داخلي) يعيد ميتا المزوّد
  **حرفيًّا** (يتضمّن `status`؛ لا `reviewStatus` لأن المواد لا تملكه) — حساسية منخفضة. **المتجهات لا تُسلسَل أبدًا** ✅.

## سلوك 15 استعلامًا (تنبّؤ ثابت من الكود، **لا تشغيل حيّ**)
دقيق: (1) رقم مادة صحيح ✅ · (4) اسم نظام كامل ✅ (قويّ) · (6) عبارة مطابقة ✅ · (7) عاميّة ✅ · (12) بلا نتيجة ✅ رشيق.
ضعيف/مفقود: (2)(3) أرقام عربية/هندية ❌ (SEARCH-001) · (8) مرادف ⚠️ (core فقط) · (9) نفي ❌ («غير» stopword) ·
(11) نصّ ساري بتاريخ ❌ (لا فلتر زمني) · (13) خطأ إملائي ❌ (لا fuzzy) · (14) نظامان ⚠️ جزئي · (15) حكم ✅ لكن **بلا فلترة مراجعة**.

## ما تعذّر فحصه (يحتاج Neon)
تعبئة `embeddings`/`legal_articles.embedding`، وجود فهرس HNSW و`search_norm` GIN فعليًّا، بذر `legal_relations`،
والصلة/الزمن الحقيقيان — استعلامات `audit/search-readiness.sql`.
