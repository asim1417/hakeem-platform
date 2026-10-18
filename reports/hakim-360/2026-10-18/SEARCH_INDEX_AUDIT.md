# تدقيق الفهارس والبحث — HKM-031

**القياس:** 2026-10-18. مجموعة دقة (Precision/Recall/nDCG) **لم تُشغَّل**. لا تُكتب PASS.

## المخازن

| الطبقة | أين | الحداثة المثبتة |
|---|---|---|
| `legal_articles.search_norm` | عمود SQL خارج Prisma | 0 فارغ |
| `judicial_cases.search_norm` | عمود SQL خارج Prisma | لا NULL حسب `pg_stats`؛ الفراغ النصي لم يُحسم لتجاوز المهلة |
| FTS | `to_tsvector('simple', …)` في `legal-retrieval.ts` و`rulings-search.ts` | الكود على `main`؛ الخطة لم تُشرح بـ EXPLAIN ANALYZE |
| BM25 ملفي | `data/legal-bm25-index.json.gz` عبر `bm25.ts` | workflow نجح 06:21 UTC على `827e623`؛ الهاش الحالي للملف لم يُحسب |
| OpenSearch | `OPENSEARCH_URL` من الكود وworkflows | تشغيل ناجح 06:07 UTC على `09ceb8b`؛ العدّ الحي UNVERIFIED |
| pgvector | `embeddings` و`embedding_version` و`ruling_segment_embeddings` أبعاد 1536 | الأعداد في الخلاصة |
| دمج | RRF بثابت 60 في أكثر من مسار، وخلط درجات مختلف في `searchLegalCore` | الكود موجود؛ لم يُقاس على مجموعة مرجعية |

## فجوة المتجهات

من 28,731 مادة، 17,325 لها صف `embeddings` من نوع `article`. الباقي 11,406. المبادئ 4,066 لها صفوف مطابقة للعدد. الأحكام في الجدول نفسه 50,273 من نوع `ruling`. النموذج المخزن `text-embedding-3-small`. هذا مسار تضمين، منفصل عن توليد Claude في الوثائق المعمارية.

HKM-029 على فرعين مفتوحين (#772 انحراف الفهرس، #780 إعادة بناء محصورة) وليس على `main`. لا تُعاد المتجهات من هنا.

## حراس الاستناد في الكود

موجودة وغير منفَّذة في هذه الجلسة: `validateLegalCitation`، `guardOutputAgainstUnknownArticleNumbers`، `verifyCitations` في محرك الاستناد، `hakeem_verify_citation` على MCP. الحارس على المعرّف لا يثبت أن الجملة المنقولة تطابق المادة إلا حيث تقارن الأداة النص.

## فهارس PostgreSQL

4 HNSW بحجم نحو 1.9 مليار بايت، و12 GIN نحو 0.71 مليار بايت، و362 B-tree في `public`. 216 فهرسًا ظهر `idx_scan=0` من 422 في `pg_stat_user_indexes`. النافذة منذ تصفير الإحصاء غير معروفة، فلا يُحذف فهرس بهذا الدليل. `pg_stat_statements` غير مثبّت. الصفوف الميتة الأعلى: `ruling_segments` 37,366 مقابل 253,165 حيّة. `autovacuum` مفعّل.

## تقييم البحث

غير منفَّذ. المعيار الذي يطلبه الأمر (مادة برقمها، تعديل قديم، حكم بأسبابه، مبدأ، استناد، لائحة ونظام، نص في تاريخ) يحتاج مجموعة معتمدة وتشغيلًا لا يكتب إنتاجًا. لم تُخترع أرقام دقة.
