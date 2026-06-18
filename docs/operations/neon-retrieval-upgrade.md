# ترقية الاسترجاع على Neon — أقوى حل (trgm + pgvector HNSW)

> يرفع الاسترجاع من حلول وسطية (ILIKE بلا فهرس + cosine داخل التطبيق) إلى:
> **بحث نصّي مفهرس (GIN pg_trgm)** + **بحث دلالي ANN حقيقي (pgvector HNSW)** على كامل بيانات Neon.
> **لا يُطبَّق إلا يدوياً عبر workflow مُقفل** — لا أحد يكتب في Neon تلقائياً.

## لماذا؟

| الطبقة | قبل | بعد (هذه الترقية) |
|---|---|---|
| نصّي | `ILIKE` بلا فهرس على 15,902 مادة (صحيح لكن بطيء) | فهرس **GIN pg_trgm** ⇒ سريع على كل الصفوف |
| دلالي | cosine **داخل التطبيق** على مجموعة مرشّحين محدودة | **ANN حقيقي** عبر جدول `embeddings` + فهرس **HNSW** على كل المتجهات |

التطبيق يستفيد تلقائياً: `vector-provider` يفضّل جدول `embeddings` متى امتلأ، و`ILIKE` يستعمل فهرس trgm دون أي تغيير في الكود.

## المتطلّب الحاسم قبل التشغيل ⚠️

أضِف سرّاً **مخصّصاً** `NEON_DATABASE_URL` (اتصال Neon بصلاحية كتابة) في
GitHub → Settings → Secrets → Actions. الـworkflow يستعمل هذا السرّ وحده
**ولا يلمس** `DATABASE_URL` المشترك (الذي يشير إلى Supabase ويستعمله بقية الأتمتة).

**حارس مزدوج للأمان:**
1. بوّابة `CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED`.
2. حارس هدف (`verify-neon-target.ts`) يُلغي كل شيء قبل أي كتابة إن لم تكن القاعدة
   Neon الكبيرة فعلاً (المضيف ليس supabase، وعدد المواد ≥ 10000). فحتى مع سرّ
   خاطئ لن تُكتب القاعدة الخطأ.

**خطوتك الوحيدة:** أضِف سرّ `NEON_DATABASE_URL`، ثم شغّل الـworkflow بالتأكيد.

## كيفية التطبيق

1. GitHub → Actions → **Neon Retrieval Upgrade** → Run workflow.
2. `CONFIRM_RUNTIME_DB_ALIGNMENT = NEON_RUNTIME_CONFIRMED` (بدونها يفشل عند البوّابة).
3. (اختياري) `limit` لتجربة دفعة صغيرة أولاً.

يقوم الـworkflow بالترتيب:
1. `scripts/sql/neon-retrieval-pre.sql` — الامتدادات + جدول `embeddings` + فهارس trigram.
2. `scripts/backfill-embeddings-table.ts` — ينسخ `legal_articles.embedding` → جدول `embeddings` (UPSERT، **بلا إعادة توليد ولا تكلفة مزوّد**، يتخطّى الأبعاد المخالفة).
3. `scripts/sql/neon-retrieval-hnsw.sql` — فهرس HNSW (يُبنى بعد التعبئة = أسرع).
4. تحقّق قرائي: عدد صفوف `embeddings` + وجود الفهارس.

## التحقّق بعد التشغيل

- صفحة المزوّدات يجب أن تُبقي «دلالي: متاح» — لكن الآن عبر جدول pgvector (ANN) لا الاحتياطي.
- اختبار قرائي: `/dashboard/legal-rag?q=هل يجوز فسخ العقد بسبب الغبن` ⇒ مصادر أسرع وأدقّ.
- `GET /api/legal-rag?q=الغبن` ⇒ `sources` غير فارغة.

## ملاحظات وقيود

- **schema.prisma لم يُمسّ.** فهارس trgm مُدارة خارج Prisma؛ تشغيل `prisma db push` على Neon قد يسقطها (لا تشغّله — مقفول). جدول `embeddings` موجود في schema أصلاً فلا يتعارض.
- **البُعد:** عمود `embeddings.embedding` هو `vector(1536)`. إن كانت متجهات Neon ببُعد مختلف، سيتخطّاها backfill ويُبلّغ؛ عندئذٍ عدّل البُعد في `neon-retrieval-pre.sql` و`EMBEDDING_DIMS` وأعد التشغيل.
- **آمن للتكرار والاستئناف:** كل العمليات `IF NOT EXISTS` / `UPSERT`؛ يمكن إعادة التشغيل بلا ضرر.
- لم يُفكّ قفل #29؛ هذا الـworkflow مستقل وبنفس بوّابة التأكيد.

## التراجع (Rollback)

```sql
DROP INDEX IF EXISTS "idx_embeddings_hnsw_cosine";
DROP INDEX IF EXISTS "idx_legal_articles_content_trgm";
DROP INDEX IF EXISTS "idx_legal_articles_title_trgm";
DROP INDEX IF EXISTS "idx_judicial_cases_text_trgm";
DROP INDEX IF EXISTS "idx_judicial_cases_title_trgm";
DROP INDEX IF EXISTS "idx_judicial_principles_text_trgm";
-- (اختياري) إفراغ جدول المتجهات — التطبيق يعود تلقائياً إلى الاحتياطي:
-- TRUNCATE "embeddings";
```

إسقاط الفهارس/إفراغ الجدول يعيد السلوك إلى ما قبل الترقية دون كسر (الاحتياطي والـ ILIKE يعملان).
