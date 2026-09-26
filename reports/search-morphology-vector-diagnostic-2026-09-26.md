# تقرير البحث الصرفي والمتجهي في منصة حكيم

> جرد كامل لتقنيات البحث الصرفي والدلالي والمعجمي، ثم تشخيص بتجربة تشغيل على الشيفرة والمعجم وفهرس BM25.
> اللقطة المفحوصة: `46bf1e31` (2026-09-26). التجربة بلا قاعدة Neon وبلا مفتاح تضمين وبلا عنقود OpenSearch، والسبب في القسم ٨.

## الخلاصة

حكيم يبحث بثلاث طبقات تُبنى داخل المستودع، وطبقة رابعة اختيارية على خادم خارجي:

| الطبقة | الحالة في الكود | ما أثبته التشغيل |
|---|---|---|
| صرف عربي بالقواعد + معجم hoqoqi | مُنفَّذ، والتوسيع الشامل مطفأ | يعمل، وفيه أخطاء جذر واشتقاق وتغطية معجم |
| معجمي: `search_norm` + `tsvector` + trigram + BM25 | مُنفَّذ | BM25 الملفّي نجح 13/13 على 15,902 مادة. مسار القاعدة لم يُفتح |
| دلالي: `text-embedding-3-small` / 1536 / pgvector HNSW | مُنفَّذ، والتوليد الحي متوقف في السكربت | حساب التشابه سليم. لا مفتاح ولا قاعدة في هذه الجلسة |
| OpenSearch بمحلّل `arabic_stem` | اختياري، ويسقط بأمان إن غاب | لا عنوان عنقود ولا Docker في هذه الجلسة |

ثلاثة أعطال تظهر من الاستعلامات القانونية نفسها:

1. وضع **الجذر** يعالج العبارة كاملة، فيحذف فاء «فسخ» ويُخرج مرشّحات فيها مسافة: `سخ ` و`سخ ا`.
2. المعجم المُحمَّل **17,674** صيغة لا **124,464**. «دعوى» و«تعويض» و«تنفيذ» و«تحكيم» بلا صيغ شقيقة. اختبار المعجم ينجح لأنه يقرأ معجماً وهمياً فيه «دعوى».
3. وضع **الاشتقاق** يولّد بالقوالب حتى سقف 32 متغيّراً، ومنها صيغ غير عربية (`عقدون`، `نفيذون`، `استنفيذ`). جذع النواة يحوّل «بالتعويض» إلى `عويض` و«استئناف» إلى `يناف`.

قرار إبقاء `LEXICON_EXPANSION` مطفأً، الموثّق في `reports/lexicon-eval.md`، ما زال متسقاً مع هذه التجربة: أول صيغ «عقد» التي تدخل البحث هي اعتقاد واعتقد وعقائد.

---

## 1. نطاق الفحص وطريقته

فُحصت الشيفرة في `/workspace` قراءةً، ثم شُغّلت الدوال الحقيقية:

- `buildVariants` كما في `lib/modules/legal-core/legal-retrieval.ts` على عشرة استعلامات قانونية.
- `expandToken` على `data/hoqoqi-lexicon.json` (لا على الملف الوهمي).
- مقارنة المطبعات الثلاث والجذعين.
- `npx tsx scripts/test-lexicon-expansion.ts`
- `npx tsx scripts/test-bm25.ts`

لم يُستدعَ نموذج لغة، ولم تُكتب قاعدة، ولم يُغيَّر سلوك البحث. هذه الوثيقة وصف وتشخيص.

---

## 2. البحث الصرفي

النواة: `lib/modules/legal-core/arabic-morphology.ts`. الصرف قواعد داخلية. لا Farasa ولا CAMeL ولا pyarabic في `package.json`.

| التقنية | الدالة | السلوك |
|---|---|---|
| إزالة التشكيل والتطويل | `removeDiacritics` | الحركات وعلامة المد |
| توحيد الهمزة | `normalizeHamza` | أ إ آ ٱ → ا، ؤ → و، ئ → ي |
| تاء مربوطة | `normalizeTaMarbuta` | ة → ه |
| ألف مقصورة | `normalizeAlefMaqsura` | ى → ي |
| تطبيع مركب | `normalizeArabicText` | الأربع السابقة ثم حذف غير الحروف والأرقام |
| تجريد اللواصق | `stripArabicAffixes` | بادئة واحدة من وال/فال/بال/كال/لل/ال/و/ف/ب/ك/ل، ولاحقة واحدة من كما/هما/هم/هن/نا/ها/ه/ون/ين/ات/ان/ة/ي/ك، بشرط بقاء 3 أحرف |
| جذع | `getArabicStem` | بعد اللواصق يحذف بادئة `است\|مست\|مت\|ت\|ي\|ن\|ا` ولاحقة جمع، ثم يدمج الحرف المكرر |
| مرشّحات جذر | `findRootCandidates` | أول 3 أحرف من الجذع، وأول 3 بعد حذف ا/و/ي، وأول 4 إن طال الجذع |
| اشتقاق بالقوالب | `expandArabicDerivatives` | الـ / بـ / وـ / لـ / مـ / تـ / يـ / استـ / انـ ولواحق ه وها وات وون وين |
| متغيّرات الاستعلام | `buildArabicSearchVariants` | حسب النمط، وسقف 32 متغيّراً |

أنماط `ArabicSearchType`: `exact` | `contains` | `derivatives` | `root` | `stem` | `affixes`.

`buildVariants` في الاسترجاع يفرّقها هكذا:

| النمط | في الواجهة | ماذا يُبنى |
|---|---|---|
| `contains` | ضمن النص، وهو الافتراضي | كلمات الاستعلام بعد التطبيع |
| `exact` | عبارة مطابقة | نص الاستعلام وحده، ويُستثنى من `tsvector` |
| `stem` | جذع | الاستعلام + `getArabicStem` على العبارة كلها + متغيّرات الجذع |
| `root` | جذر | الاستعلام + `findRootCandidates` على العبارة كلها + `expandToken(العبارة, 8)` + متغيّرات الجذر |
| `derivatives` | اشتقاقات | الاستعلام + `expandToken(العبارة, 8)` + قوالب الاشتقاق لكل كلمة |
| `affixes` | الواجهة البرمجية فقط | تجريد اللواصق والجذع. غير ظاهر في قائمة البحث المتقدم |

أماكن الربط:

| السطح | المسار | النمط |
|---|---|---|
| البحث المتقدم للنواة | `app/dashboard/legal-core/search/page.tsx` | خمسة أنماط يختارها المستخدم (بلا `affixes`) |
| واجهة النواة | `app/api/legal-core/search/route.ts` | `searchType`، ويشمل `affixes` |
| الواجهة القديمة | `app/api/original-hakeem/legal-search/route.ts` | نفس المعامل |
| الاسترجاع للوكيل وRAG | `findRelevantLegalArticles` | `derivatives` ثابت |
| البحث الشامل | `lib/modules/legal-core/comprehensive-search.ts` | لا يمرّر النمط، فيبقى `contains` مع الدلالي |
| البحث الهجين | `app/api/legal-search/route.ts` | بلا أنماط صرفية؛ دمج RRF |
| مستندات القضية | `components/documents/CaseBrowser.tsx` | مفتاح «البحث بالجذر» ومعجم `public/doc-lexicon.json` |

خطوط صرف موازية، كل منها بمطبّعه:

| الملف | الدالة | أين تُستخدم |
|---|---|---|
| `lib/modules/legal-core/bm25-tokenizer.ts` | `normalizeArabic` + `lightStem` | فهرس BM25 وبحث الأحكام |
| `lib/modules/legal-search/query-parse.ts` | `normalizeArabicQuery` | رقم المادة في البحث الهجين |
| `lib/modules/document-inspection/search.ts` | `lightStem` + `buildMorphLexicon` | BM25 مستندات القضية |
| `lib/mcp/tools/research.ts` | `lexicalVariants` | `stem+ا` و`stem+و` |
| `lib/mcp/tools/enumerate.ts` | `normalizeAr` + `NORM_EXPR` | `ILIKE` على `content` بعد `translate`، بلا `search_norm` |
| `lib/mcp/tools/rulings.ts` | `normalizeArabic` | `search_norm ILIKE` للأحكام |
| `scripts/index-opensearch.ts` | محلّل `hakeem_arabic` | مرشّح Lucene `arabic_stem`، لا Farasa |
| `lib/modules/legal-thesaurus/normalize.ts` | `searchableText` | مكنز المواد |
| `lib/modules/legal-chat/taxonomy.ts` | `normalizeArabic` | نيّة المحادثة |
| `ingest/uqn-2026-09-25/scripts/extraction/normlib.py` | `norm` | استيعاب UQN |
| `components/SearchHighlight.tsx` | `normalizeArabicText` + `stripArabicAffixes` | تظليل النتائج |

### المعجم

| البند | القيمة |
|---|---|
| الملف الخادمي | `data/hoqoqi-lexicon.json` |
| نسخة واجهة المستندات | `public/doc-lexicon.json` |
| المصدر | `hoqoqi.sql` جداول `nouns` و`verbs`، عبر `scripts/extract-hoqoqi-lexicon.ts` |
| التنزيل | سير `.github/workflows/extract-lexicon.yml` من رابط مشاركة OneDrive (المُدخل `share_url`) |
| الاستيراد للنصوص القانونية | `npm run import:hoqoqi` → `scripts/import-hoqoqi-sql.ts` (أنظمة ومواد، والمعجم مسار منفصل) |
| التوسيع | `lib/modules/legal-core/lexicon-expansion.ts` الدالة `expandToken` |
| التفعيل الشامل | `LEXICON_EXPANSION=1`، وافتراضه مطفأ. المسار البديل `LEXICON_PATH` |

`normLex` يحذف التشكيل، ويوحّد الهمزات إلى ا، وؤ→و، وئ/ى→ي، ويحذف ء، وة→ه، ويحذف بادئة `ال`.

العداد داخل الملف يقول `forms: 124464`. العدّ على المصفوفات المخزّنة:

| المقياس | العدد |
|---|---:|
| جذور | 3,314 |
| صيغ خام (مجموع أطوال المصفوفات) | 17,674 |
| صيغ فريدة قبل التطبيع | 17,189 |
| صيغ فريدة بعد `normLex` | 16,619 |
| ما يحمّله `lexiconStats().forms` | 16,618 |

سبب الفجوة: في `extract-hoqoqi-lexicon.ts` المتغير `forms` يُزاد بمقاس المجموعة عند **كل صف** قبل اكتمال الدمج، فيتكرر العد. الرقم 124,464 ليس عدد الصيغ القابلة للبحث.

من 25 مصطلحاً قانونياً شائعاً، 12 لها صيغ شقيقة. بلا توسيع: دعوى، دعاوى، تعويض، تنفيذ، تحكيم، غبن، شفعة، وكالة، كفالة، دية، نفقة، شركة، مساهم.

جذر `دعو` فيه 14 صيغة (دعوة، ادعاء، دعاء، دعاية، استدعاء…). «دعوى» تُطبَّع إلى `دعوي` و«دعوة» إلى `دعوه`، فلا تلتقيان. اختبار `scripts/test-lexicon-expansion.ts` يكتب معجماً وهمياً في `/tmp/lex-test.json` فيه «دعوى» صراحة، لذلك ينجح 4/4 ولا يمثّل الملف الحقيقي.

«عقد» له 19 صيغة. أول 8 تدخل البحث في وضع الجذر: أعقد، اعتقاد، اعتقد، انعقد، تعاقد، تعقد، عاقد، عقائد. هذا نفس نمط الضوضاء الذي قاسه `reports/lexicon-eval.md` على Neon (مرشّحات من 1,430 إلى 6,907، وتراجع P@3 وMRR وsystemHit). القرار هناك: يبقى العلم مطفأً.

---

## 3. البحث المتجهي

التوليد: `lib/modules/ai/embeddings.ts`.

| البند | القيمة |
|---|---|
| النموذج | `text-embedding-3-small` (`EMBEDDING_MODEL`) |
| البعد | 1536 (`EMBEDDING_DIMS`) |
| العنوان | `EMBEDDING_BASE_URL` أو `https://api.openai.com/v1/embeddings` |
| المفتاح | `EMBEDDING_API_KEY` ثم `OPENAI_API_KEY` |
| الإيقاف | `SEMANTIC_SEARCH=false` أو `0` أو `off`. بلا مفتاح يبقى مطفأً |
| البصمة | SHA-256 للنص مع اسم النموذج في `lib/modules/legal-core/embedding-fingerprint.ts` |
| القص | `buildEmbeddingText` حتى 8,000 حرف بعد حجب البيانات الشخصية |
| الذاكرة | 500 مدخلاً، عمر 5 دقائق، المفتاح النموذج + النص |

`config/ai-models.ts` لا يسجّل نموذج تضمين. المحادثة على Claude (أو المزوّد المضبوط في `AI_PROVIDER`). التضمين مسار HTTP منفصل.

التخزين:

| المكان | النوع | الاستخدام |
|---|---|---|
| جدول `embeddings` | `vector(1536)` | المصدر المعتمد. فهرس HNSW `idx_embeddings_hnsw_cosine` على `vector_cosine_ops` |
| `embedding_version` | `vector(1536)` | إصدارات في المخطط. `latestVectorSource()` يقرأ آخر إصدار. لا كاتب فعّال في السكربتات |
| `legal_articles.embedding` | JSON | موسوم `@deprecated`. احتياط لإعادة الترتيب داخل التطبيق |
| `judicial_doc_chunks.embedding` | JSONB | مقاطع مرفقات القضية. التشابه في Node عبر `cosineSimilarity` |

الاستعلام: `(1 - (embedding <=> $vec))` ثم `ORDER BY embedding <=> $vec`. المعامل `<=>` مسافة جيب التمام.

من يستدعي التضمين:

| الملف | الدور |
|---|---|
| `lib/modules/legal-core/legal-retrieval.ts` | `semanticArticleScores` حتى 200 مادة، ويُمزج إن كانت الدرجة المعجمية تحت `SEMANTIC_LEX_FLOOR` (12). المقياس `SEMANTIC_BLEND_SCALE=80`. إن فشل المسار: `applySemanticRerank` على أعلى 80 من عمود JSON |
| `lib/modules/legal-search/providers/vector-provider.ts` | مزوّد الهجين. عتبة `MIN_SEMANTIC_SCORE=0.6`، ثم سقوط إلى ترتيب جيب التمام في التطبيق |
| `lib/modules/judicial-assistant/case-vector.ts` | فهرسة كسولة لمرفقات القضية بـ `embedBatch` |
| `lib/modules/legal-search/hybrid-search.ts` | دمج Reciprocal Rank Fusion بمعامل `RRF_K=60` من Postgres + متجه + رسم معرفي + OpenSearch |
| `lib/mcp/adapter.ts` | `searchArticles` عبر `hybridSearch` |
| أدوات الوكيل | `search_articles` و`semantic_search` تستدعيان `searchLegalCore` مع `semantic: true` |

`GET /api/legal-core/search` لا يمرّر `semantic: true`. الدلالي يصل من البحث الشامل والوكيل ومسارات تمرّره صراحة.

لا إعادة ترتيب بنموذج مستقل (لا Cohere ولا Voyage). `lib/modules/agents/thinking/rerank.ts` ترتيب إرشادي بالاستشهاد والحالة.

السكربت `scripts/backfill-embeddings.ts` متوقف ويشير إلى `embedding_version`. التعبئة العاملة `scripts/backfill-embeddings-table.ts` تنسخ JSON الموجود إلى جدول pgvector بلا نداء شبكة. سير `.github/workflows/backfill-embeddings.yml` ما زال يستدعي السكربت المتوقف.

فهرس HNSW في `scripts/sql/neon-retrieval-hnsw.sql` و`prisma/migrations/20260712120000_search_performance_indexes`. مقطع `ivfflat` في `CLAUDE.md` وصف قديم؛ التشغيل على HNSW.

---

## 4. الطبقة المعجمية والرسم المعرفي

| الآلية | أين | الملاحظة |
|---|---|---|
| `legal_articles.search_norm` | يُبنى بـ `normalizeArabicText` في `reindex.ts` و`backfill-search-norm` | GIN على `to_tsvector('simple', search_norm)` وGIN trigram. الاستعلام `ts_rank_cd`. يُطفأ بـ `IN_DB_RECALL=0` |
| `judicial_cases.search_norm` | `buildRulingSearchNorm`: حجب PDPL ثم `normalizeArabic` من BM25 | فهارس في هجرتَي `20260911120000` و`20260925060000` |
| trigram | `scripts/apply-search-indexes.ts` و`scripts/sql/neon-retrieval-pre.sql` | يسرّع `ILIKE`. `word_similarity` لاقتراح «هل تقصد» في `suggestions.ts` |
| BM25 ملفّي | `data/legal-bm25-index.json.gz` عبر `lib/modules/legal-core/bm25.ts` | الواجهة `app/api/legal-core/bm25-search/route.ts` |
| BM25 القضية | `lib/modules/judicial-assistant/case-search.ts` و`document-inspection/search.ts` | سقوط `case-vector` عند غياب المتجه |
| OpenSearch BM25 | `opensearch-provider.ts` + `openSearchArticleScores` | إشارة خامسة داخل النواة. تُطفأ بـ `CORE_OPENSEARCH=0`. التعزيز `OPENSEARCH_BOOST_SCALE=30` |
| الرسم `legal_relations` | `knowledge-graph-provider.ts` | بذور `contains` ثم جيران بقوة العلاقة × 0.75. ليس متجهات |
| مكنز المفاهيم | `matchThesaurusConcepts` داخل `searchLegalCore` | تعزيز درجة، منفصل عن جدول العلاقات |

OpenSearch صورة `opensearchproject/opensearch:3.7.0` في `docker-compose.yml` تحت بروفايل `search`، بلا عميل npm؛ النداء `fetch` إلى REST. الفهارس الافتراضية `legal_articles` و`judicial_cases`.

أعلام التشغيل:

| المتغير | الأثر |
|---|---|
| `LEXICON_EXPANSION=1` | توسيع كل كلمة بـ `expandToken(w, 6)` حتى في «ضمن النص» |
| `LEXICON_PATH` | مسار JSON بديل للمعجم |
| `IN_DB_RECALL=0` | إيقاف مسار `tsvector` والعودة إلى `ILIKE` |
| `SEMANTIC_SEARCH` | إيقاف صريح للتضمين |
| `EMBEDDING_*` / `OPENAI_API_KEY` | مزوّد المتجهات |
| `SEARCH_PROVIDER_MODE` | `hybrid` أو مزوّد واحد: `postgres` / `vector` / `knowledge_graph` / `opensearch` |
| `CORE_OPENSEARCH=0` | إيقاف إشارة OpenSearch داخل النواة |
| `OPENSEARCH_URL` وما معه | عنوان العنقود |
| `COVERAGE_DAMP=0` | إيقاف تخفيض الدرجة عند ضعف تغطية المفاهيم |
| `CONFIRM_RUNTIME_DB_ALIGNMENT` | قفل الكتابة على Neon في السير |

---

## 5. أدوات ومواقع مرتبطة بالبحث

| الأداة أو الموقع | الدور |
|---|---|
| PostgreSQL + pgvector على Neon | الفهرس المعجمي والمتجهي للإنتاج. السر `NEON_DATABASE_URL` في GitHub Actions |
| OpenSearch 3.7 أو Bonsai | BM25 عربي اختياري |
| `https://api.openai.com/v1/embeddings` | توليد المتجهات. قابل للاستبدال بـ `EMBEDDING_BASE_URL` |
| `hoqoqi.sql` عبر مشاركة OneDrive في سير الاستخراج | مصدر الأنظمة والمعجم |
| `https://api.turath.io` و`https://app.turath.io` | بحث كتب التراث عبر `lib/modules/turath/turath-client.ts`. منفصل عن صرف حكيم |
| `hakeem-platform.vercel.app` | الواجهة المنشورة. الصرف على الخادم، ومعجم المستندات يُجلب في المتصفح من `/doc-lexicon.json` |

غير موجود في الاعتماديات: Farasa، CAMeL Tools، pyarabic، عميل OpenSearch الرسمي، حزمة `openai`.

وثائق التصميم ذات الصلة: `docs/search-surfaces-diagnostic.md`، `docs/retrieval-verification-gates.md`، `docs/legal-search-engine-architecture.md`، `docs/complete-retrieval-architecture.md`، `docs/opensearch-setup.md`، `reports/lexicon-eval.md`، `audit/reports/06-search-readiness-report.md`.

---

## 6. التجربة

عشرة استعلامات: فسخ العقد، التعويض، الدعوى، التنفيذ والحجز، عقد، طلاق، التحكيم، الغبن، الشفعة، حجز تحفظي.

عدد المتغيّرات التي يبنيها `buildVariants`. علامة التعجب تعني بلوغ سقف التوليد 32. فلتر القاعدة يقصّ عند 36.

| الاستعلام | contains | exact | stem | root | derivatives | affixes |
|---|---:|---:|---:|---:|---:|---:|
| فسخ العقد | 3 | 1 | 4 | 5 | 31 | 3 |
| التعويض | 1 | 1 | 3 | 3 | 31 | 3 |
| الدعوى | 1 | 1 | 3 | 3 | 17 | 2 |
| التنفيذ والحجز | 3 | 1 | 5 | 5 | 32! | 4 |
| عقد | 1 | 1 | 1 | 9 | 21 | 1 |
| طلاق | 1 | 1 | 1 | 3 | 32! | 1 |
| التحكيم | 1 | 1 | 3 | 4 | 32! | 3 |
| الغبن | 1 | 1 | 2 | 2 | 15 | 2 |
| الشفعة | 1 | 1 | 3 | 3 | 17 | 2 |
| حجز تحفظي | 3 | 1 | 5 | 4 | 32! | 4 |

عيّنات المتغيّرات:

- «عقد» / جذر (9): عقد، أعقد، اعتقاد، اعتقد، انعقد، تعاقد، تعقد، عاقد، عقائد.
- «عقد» / اشتقاق (21): ما سبق ثم العقد، بعقد، وعقد، لعقد، عقده، عقدها، عقدات، عقدون، عقدين.
- «فسخ العقد» / جذر (5): `فسخ العقد`، `سخ `، `سخ ا`، فسخ، عقد.
- «الدعوى» / اشتقاق (17): الدعوي، دعو، بدعو، دعوون، مدعو، استدعو، اندعو… بلا صيغ المعجم.
- «التنفيذ والحجز» / اشتقاق: يبلغ 32، ومنها نفيذون، استنفيذ، اننفيذ.

جذع النواة مقابل جذع BM25:

| الكلمة | جذع النواة | بعد اللواصق فقط | BM25 | مرشّحات الجذر |
|---|---|---|---|---|
| العقود | عقود | عقود | عقود | عقو، عقد، عقود |
| بالتعويض | عويض | تعويض | تعويض | عوي، عويض |
| الدعاوى | دعاو | دعاو | دعاو | دعا، دعاو |
| استئناف | يناف | استيناف | استيناف | ينا، يناف |
| المحجوز | محجوز | محجوز | محجوز | محج، محجو |
| التنفيذ | نفيذ | تنفيذ | تنفيذ | نفي، نفذ، نفيذ |

تباين المطبعات على العيّنات نفسها:

| النص | نواة `normalizeArabicText` | BM25 `normalizeArabic` | محلّل الاستعلام |
|---|---|---|---|
| إثباتُ العَقد | اثبات العقد | اثبات العقد | اثباتُ العَقد (التشكيل يبقى) |
| قضيةٌ | قضيه | قضيه | قضيهٌ |
| المادة ٥ | الماده ٥ | الماده 5 | الماده 5 |
| مؤسسة | موسسه | موسسه | مؤسسه |
| على | علي | علي | علي |
| هيئة | هييه | هييه | هيئه |

محلّل رقم المادة:

| الاستعلام | الناتج |
|---|---|
| المادة ١٣٠ من نظام المعاملات المدنية | رقم 130، والتلميح «من نظام المعاملات المدنية» |
| م/5 التنفيذ | رقم 5، والتلميح «التنفيذ» |
| فسخ العقد | بلا رقم مادة |

اختبار المعجم الرسمي: 4 ناجح / 0 فاشل، على جذرين وهميين. اختبار BM25 الرسمي: 13 ناجح / 0 فاشل.

| فحص BM25 | النتيجة |
|---|---|
| تحميل `legal-bm25-index.json.gz` | نجح |
| عدد المستندات | 15,902 |
| متوسط الطول | 64.9 |
| عدد المصطلحات | 30,559 |
| «فسخ العقد» | 5 نتائج باستشهاد «… المادة (..)» |
| «الغبن» | 4 نتائج |
| «الزواج» | 5 نتائج |
| «التنفيذ» | 5 نتائج |
| استعلام بلا تطابق | مصفوفة فارغة |

بوابة الدلالي في جلسة التشغيل: `semanticOn=false`، لا مفتاح تضمين، لا `OPENSEARCH_URL`، لا `DATABASE_URL`. جيب التمام: متعامد = 0، متواز = 1.

---

## 7. قراءة الأعطال

**الجذر على العبارة.** `findRootCandidates` و`getArabicStem` في وضعَي الجذر والجذع يُستدعيان على نص الاستعلام كاملاً. «فسخ العقد» تبدأ بفاء، والفاء في قائمة البادئات، فيصبح الجذع `سخ العقد`. أول ثلاثة أحرف `سخ ` وأول أربعة `سخ ا`. هذان النصان يدخلان فلتر `ILIKE`. متغيّرات الكلمات المفردة (فسخ، عقد) تبقى، فالمطابقة لا تسقط كلها، والمرشّح ذو المسافة يوسّع الضوضاء.

**جذع النواة يبتلع حروف الوزن.** بعد حذف «بال» من «بالتعويض» تبقى «تعويض»، ثم يحذف النمط `^ت` فيصير `عويض`. «استئناف» بعد توحيد ئ تصبح `استيناف`، ثم يُحذف `است` فيصير `يناف`. BM25 يقف بعد سابقة واحدة ولاحقة واحدة ويبقي ثلاثة أحرف، فيحفظ تعويض وتنفيذ واستيناف.

**الاشتقاق قوالب لا معجم.** السقف 32 يُملأ بصيغ مصنوعة. «عقدون» و«نفيذون» و«استنفيذ» ليست في المعجم ولا في الاستعمال. وضع الاشتقاق هو ما يثبّته `findRelevantLegalArticles` لمسار الوكيل.

**المعجم العام لا يغطي لغة الدعوى.** الملف معجم عربي سطحي من جداول الأسماء والأفعال، وعدّاد صيغه مبالغ فيه. كلمات التقاضي عالية التكرار غائبة أو لا تتطابق بعد تحويل ى/ة. توسيع «عقد» يجلب اعتقاد وعقائد، وهو ما خفض مقاييس الترتيب عندما فُتح العلم على Neon (P@3 من 94.7% إلى 93.3%، وMRR من 0.940 إلى 0.930، ومجموعة المرشّحات ×4.8).

**ثلاث مطبعات لعمود واحد.** `search_norm` للمواد يُبنى بمطبّع النواة، فيُبقي الرقم الهندي `٥` ويحذف ؤ. فهرس BM25 وبحث الأحكام يحوّلان `٥` إلى `5` ويحذفان ء. محلّل رقم المادة يحوّل الأرقام ويبقي التشكيل وؤ. الاستعلام الواحد يصير ثلاثة نصوص.

**اختبار المعجم لا يحرس الإنتاج.** النجاح على `/tmp/lex-test.json` لا يفشل إذا غابت «دعوى» من `data/hoqoqi-lexicon.json`.

---

## 8. لماذا لم تُفتح الطبقة الحية

ما بقي خارج التجربة يعيش على خوادم، وهذه الجلسة فيها الشيفرة فقط.

الخروج الشبكي غير مقيّد (`egress.restricted: false`). الحاجز بيانات الاتصال:

| النظام | أين هو | ماذا غاب في الجلسة |
|---|---|---|
| `tsvector` وHNSW وجدول `embeddings` | Neon | `NEON_DATABASE_URL` و`DATABASE_URL` |
| التضمين الحي | واجهة OpenAI أو المتوافق معها | `EMBEDDING_API_KEY` و`OPENAI_API_KEY` |
| OpenSearch | عنقود `OPENSEARCH_URL` | العنوان واسم المستخدم وكلمة المرور |

هذه القيم تُحقن في GitHub Actions من أسرار المستودع (`secrets.NEON_DATABASE_URL` وغيرها في `.github/workflows/`). في الآلة التي شغّلت التجربة:

- لا ملف `.env` ولا `.env.local` ولا `.env.production`.
- كل متغيرات الاتصال حالتها ABSENT.
- رمز GitHub على الآلة يتلقى 403 عند طلب قائمة الأسرار، فلا يقرأ الأسماء ولا القيم.
- لا `psql` ولا Docker. تشغيل محلي، لو توفّرت الأداة، ينشئ قاعدة فارغة. المواد المفهرسة والمتجهات على Neon وليست داخل Git.

ما أمكن تشغيله يسافر مع المستودع: دوال الصرف، `data/hoqoqi-lexicon.json`، و`data/legal-bm25-index.json.gz`.

قياس P@k الحي لمسار `tsvector` والمتجهات يبقى على سير `eval-search.yml` و`eval-lexicon.yml` بعد توفير الأسرار، كما فُعل سابقاً في run القياس 28634645060 الموثّق في `reports/lexicon-eval.md`.

---

## 9. ما يثبته هذا التقرير وما يبقى مفتوحاً

يثبت، على اللقطة `46bf1e31` وبلا قاعدة:

- خريطة الملفات والأنماط والأعلام والمزوّدات أعلاه.
- أرقام المتغيّرات وتغطية المعجم وعلّة العدّاد 124,464.
- نجاح BM25 الملفّي على 15,902 مادة.
- انقطاع التطابق بين «دعوى» وجذر `دعو` في المعجم الحقيقي.
- أن بوابة الدلالي تسقط بأمان عند غياب المفتاح.

يبقى مفتوحاً حتى تُمرَّر أسرار Neon وOpenSearch إلى بيئة تشغيل مسموح لها بالقراءة:

- هل فهرس GIN على `search_norm` يُستخدم فعلاً (`EXPLAIN` في `verify-search-index.yml`).
- تغطية صفوف `embeddings` مقابل المواد، وجودة HNSW على استعلامات حقيقية.
- هل عنقود OpenSearch مفهرس ومطابق لـ Neon.
- إعادة `eval:search` بعد أي إصلاح للجذر أو الجذع أو المعجم، قبل فتح `LEXICON_EXPANSION`.
