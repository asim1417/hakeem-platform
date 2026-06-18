# تفعيل الذكاء القانوني على Neon — الاسترجاع والاستشهاد و RAG

> **النطاق:** تفعيل طبقة الاسترجاع/الاستشهاد/RAG فوق بيانات Neon القائمة **دون أي كتابة في القاعدة**.
> لا seed، لا import، لا backfill، لا migration، لا تعديل schema. كل ما هنا قراءة + حساب داخل التطبيق.

## 1) لماذا هذا التغيير؟

قاعدة التشغيل الحيّة (Neon، عبر `DATABASE_URL` في Vercel) تحتوي:

| الجدول | الحالة على Neon |
|---|---|
| `legal_systems` | ≈ 489 |
| `legal_articles` | ≈ 15,902 (ولها `embedding` على عمود `legal_articles.embedding`) |
| `judicial_cases` | ≈ 51,105 |
| `legal_article_case_links` | ≈ 29,705 |
| `embeddings` (pgvector) | **غير موجود** |
| `legal_relations` (الرسم المعرفي) | **غير موجود** |

النتيجة: مزوّد البحث الدلالي القديم كان يقرأ جدول `embeddings` (pgvector) **الغائب على Neon**، فلم يكن الدلالي يغذّي RAG. كما أنّ ربط المواد بالأحكام عبر الرسم المعرفي (`legal_relations`) متعذّر لغياب الجدول.

## 2) ماذا فُعِّل (قراءة فقط)

### أ) البحث الدلالي مع سقوط احتياطي إلى `legal_articles.embedding`
`lib/modules/legal-search/providers/vector-provider.ts`:
1. يحاول أولاً جدول `embeddings` (pgvector) إن كان موجوداً وفيه متجهات.
2. إن غاب الجدول/الامتداد، يسقط بأمان إلى متجهات `legal_articles.embedding` (Json):
   - يأخذ **مجموعة مرشّحين معجمية محدودة** (≤ 100 مادة) من بحث النواة، لا كل المتجهات (حدّ نقل البيانات).
   - يقرأ متجهات هؤلاء فقط، ويحسب **cosine داخل التطبيق**.
   - **حارس أبعاد**: يتجاهل أي متجه بأبعاد مخالفة أو غير قابل للقراءة (سجلّ واحد فاسد لا يُفشل العملية).
3. عند تعطيل `SEMANTIC_SEARCH` أو غياب المفتاح: المزوّد غير متاح، والبحث يعود **معجمياً** عبر `postgres-provider` دون كسر.
4. **لا كتابة ولا backfill** إطلاقاً.

الأدوات النقيّة في `lib/modules/legal-search/embedding-fallback.ts`: `parseEmbedding` (مصفوفة/مصفوفة نصوص/سلسلة JSON)، `hasValidDimension`، `rankByCosine`.

### ب) البحث الهجين + بيانات وصفية موحّدة
`lib/modules/legal-search/hybrid-search.ts`: يدمج نتائج `postgres` + `vector` (+ غيرهما عند التوفّر)، ويُرفق بكل نتيجة:
`sourceType`، `systemName`، `articleNumber`، `articleId`، `citationKey`، `score`، و`matchedBy` (`lexical` | `semantic` | `hybrid`). لا يكسر أبداً عند تعطيل الدلالي.

### ج) ربط المواد بالأحكام عبر `legal_article_case_links`
`lib/modules/legal-rag/judgment-links.ts` + `legal-rag-service.ts`: لكل مادة حاضرة في السياق تُجلب أحكامها المرتبطة (قراءة فقط) بحقول محدودة من `judicial_cases` (id، عنوان، محكمة، مدينة، رقم القضية/القرار، تاريخ، مقتطف)، بسقوف **3 أحكام/مادة** و**8 أحكام إجمالاً**. غياب الروابط ⇒ تدهور آمن إلى «المواد فقط». هذا يعوّض غياب الرسم المعرفي.

### د) الاستشهاد و RAG الصارم
- محرّك الاستشهاد (`citation-engine.ts`) يبني الاستشهادات **من السياق فقط** ويتحقّق من وجود المصدر في القاعدة بالـid — لا اختلاق.
- حارس الإسناد (`grounding-guard.ts`): لا إجابة بلا مصدر كافٍ → «لا توجد مصادر قانونية كافية للإجابة بثقة.». وعند وجود مصادر بلا نصّ نظامي صريح → «لا يوجد نص صريح في المصادر المتاحة.».
- التعليمات تُلزم: الاستشهاد بمصادر Neon المسترجعة فقط، وربط كل استنتاج بمصدره، وأنّ **الأحكام سوابق مؤيِّدة لا أساس نظامي**.

### هـ) مكوّنات واجهة قابلة لإعادة الاستخدام
`components/legal/legal-intelligence.tsx`: `LegalCitationBox`، `RelatedJudgmentsList`، `LegalSourceBadge`، `GroundingWarning` — عرضية صِرفة، مدموجة في `app/dashboard/legal-rag/page.tsx` دون تغيير جذري في التصميم.

## 3) متغيّرات البيئة في Vercel (لتشغيل الدلالي)

البحث الدلالي **اختياري** — المعجمي يعمل بدونه. لتفعيل الدلالي على Neon اضبط في Vercel:

| المتغيّر | القيمة | ملاحظة |
|---|---|---|
| `SEMANTIC_SEARCH` | `true` | علَم التفعيل |
| `EMBEDDING_API_KEY` | مفتاح مزوّد التضمين | (أو `OPENAI_API_KEY`) — يُستعمل لتوليد متجه السؤال فقط |

> متجهات المواد على Neon موجودة مسبقاً (`legal_articles.embedding`)، فلا حاجة لأي backfill لتشغيل الاحتياطي. عند ضبط المتغيّرين يصبح `vectorProvider.isAvailable()` صحيحاً ويعمل الاسترجاع الدلالي عبر الاحتياطي مباشرةً.

اختياري: `EMBEDDING_MODEL` (افتراضي `text-embedding-3-small`)، `EMBEDDING_DIMS` (افتراضي 1536) — يجب أن يطابق البُعد المخزَّن وإلا تجاهله حارس الأبعاد.

## 4) ⚠️ تحذير: لا تُشغّل مسارات الكتابة على القاعدة الخطأ

مسارات الكتابة (seed / import / backfill / KG / migration) **مقفولة** خلف بوّابة في #29. لا تُشغّل أيّها إلا بقصدٍ صريح وبقيمة:

```
CONFIRM_RUNTIME_DB_ALIGNMENT = NEON_RUNTIME_CONFIRMED
```

هذا التفعيل **لا يتطلّب أي كتابة**؛ لا تفكّ القفل من أجله.

## 5) التحقّق بعد الدمج

```bash
npm run typecheck        # أنواع TS
npm run build            # بناء Next.js
npm run qa:security      # لا مفاتيح مكشوفة
npm run qa:citations     # دقّة/استرجاع الاستشهاد
npm run test:intel       # وحدات: cosine/parseEmbedding/حارس الأبعاد/الروابط/الإسناد
npm run test:embeddings  # أدوات التضمين النقيّة
npm run test:bm25        # فهرس BM25
npm run test:rag         # تكامل: يتطلّب اتصال قراءة بـ Neon (لا يعمل بلا قاعدة)
```

تحقّق يدوي على الموقع الحيّ: افتح `/dashboard/legal-rag?q=...` وتأكّد من ظهور: الأساس النظامي، الأحكام المرتبطة، وحالات «لا نصّ صريح» / «لا مصادر كافية» عند انطباقها.

## 6) ما تبقّى (مؤجَّل — يتطلّب كتابة/اتصالاً بـ Neon)

- **إعادة بناء BM25 من Neon**: الفهرس الحالي مبني من تصدير قديم (≈ 1981 مادة). لتغطية 15,902 مادة على Neon يلزم تصدير `legal_articles` من Neon ثم `npm run build:bm25` (قراءة من Neon — خارج نطاق هذا الـPR).
- **الرسم المعرفي (`legal_relations`)**: الجدول غير موجود على Neon → ميزة KG مؤجّلة (تتطلّب migration + seed).
- **تفعيل Legal Agent الكامل** و**معيار تقييم (eval benchmark)**: لاحقاً.
