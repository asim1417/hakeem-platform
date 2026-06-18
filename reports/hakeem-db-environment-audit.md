# Hakeem Database Environment & Data Source Audit

> **مرحلة تشخيص فقط** — لا seed/backfill/migration/db push/كتابة. كل عمليات القاعدة SELECT فقط.
> الأعداد الحيّة لقاعدة Vercel (A) تُملأ عند تشغيل `Audit DB Environments` بسرّ `VERCEL_DATABASE_URL_INSPECT`.

## 1) الملخّص التنفيذي
المنصّة موصولة بـ **قاعدتي Postgres مختلفتين** + مصدر MySQL خارجي:
- **A — Vercel الحيّة** (`DATABASE_URL` في Vercel): ما يراه المستخدم؛ فيها أحكام ظاهرة. أعدادها **قيد التأكيد**.
- **B — GitHub Actions** (`DATABASE_URL` سرّ المستودع): هدف الأتمتة؛ **9 أنظمة / 1981 مادة / 0 حكم / 1981 embedding** (DB Inspect).
- **C — Hostinger MySQL** (`HOSTINGER_DB_URL`): مصدر استيراد فقط (~60k حكم)، ليست قاعدة تشغيل.

**A ≠ B** ⇒ كل عمليات seed/embeddings/BM25 ذهبت إلى **B**، والموقع الحيّ يعمل على **A**.

## 2) خريطة الاتصال (من الكود)
- متغيّرات مُشار إليها: `DATABASE_URL` (48)، `HOSTINGER_DB_URL` (17)، `VERCEL_DATABASE_URL_INSPECT` (10). **لا** `DIRECT_URL`/`POSTGRES_URL`/`SUPABASE_URL`/`MYSQL_URL`.
- `prismaDatasource`: `postgresql`, `url=env(DATABASE_URL)`, `extensions=[vector]` — **متغيّر تشغيل واحد فقط للموقع**.
- عملاء: Prisma (Postgres) في كل التطبيق؛ `mysql2` في سكربتات Hostinger فقط؛ لا `@supabase/supabase-js`.

## 3) GitHub Actions workflows (تصنيف المخاطر)
| Workflow | يكتب في DB؟ | التصنيف |
|---|---|---|
| deploy-readiness-check | لا | Read-only (typecheck/build/qa) |
| db-inspect | لا | Read-only |
| **audit-db-environments** (جديد) | لا | Read-only |
| **inspect-vercel-db** (جديد) | لا | Read-only |
| seed-legal-library | **نعم** | Seed (upsert) |
| backfill-embeddings | **نعم** | Backfill (update embedding) |
| seed-knowledge-graph | **نعم** | Seed (relations) |
| migrate-judgments | **نعم** | Import + db push |
| analyze-judgments / analyze-hostinger | analyze: نعم/لا | Import/Read |

## 4) Vercel (من الكود)
- المتوقّع: متغيّر واحد `DATABASE_URL` (لا متغيّر DB آخر في الكود).
- صفحات تقرأ DB ديناميكياً (`force-dynamic`): legal-core/judgments وأخواتها → **لا تخزين مؤقت** يفسّر ظهور الأحكام ⇒ A فيها أحكام فعلاً.

## 5) تدقيق المسارات (المصدر/الـfallback)
| المسار | المصدر | fallback/mock |
|---|---|---|
| `/dashboard/legal-core` | Prisma (DB) | **`\|\| 1981`** (الوحيد) |
| `/legal-core/quality` · `/judgments` | Prisma (DB) + `catch(()=>0/[])` | لا أرقام وهمية |
| `/api/legal-core/*` · `/legal-search` · `/legal-rag` | Prisma (DB) + hybrid | لا |
| `/api/legal-rag` · case-analysis · legal-agent · judicial-simulation | DB by id + Citation Engine | لا |
| `/api/embeddings/status` | جدول `embeddings` (pgvector) | — |
| BM25 (`/api/legal-core/bm25-search`) | ملف `legal-bm25-index.json.gz` | — |

## 6) الأرقام الثابتة والفهارس
- **Hardcoded:** `1981` في موضع واحد فقط (fallback النواة). **`15902`/`51105`/`489` غير موجودة** في الكود (489 يظهر فقط كـ«رقم مادة» داخل seed المضمّن في `hakim1111.html`).
- **BM25:** موجود، 1981 مادة، مصدره `legal_articles_export.json` → يطابق **B** (لا A إن كانت أكبر).
- **embeddings:** منقسمة — `LegalArticle.embedding` (B: 1981) ≠ جدول `embeddings` pgvector (B: 0).

## 7) الأثر على المحرّكات
- **BM25/Citation:** سليمان على 1981؛ الاستشهاد مُتحقَّق من `legalArticle` بالـid (لا استشهاد بمادة غير موجودة).
- **Legal RAG:** hybrid(postgres يعمل) + كيانات من DB بالـid؛ لكن `vector-provider` يقرأ جدول `embeddings` **الفارغ** ⇒ الدلالي لا يعمل في RAG.
- **Case Analysis / Legal Agent / Judicial Simulation:** تعمل لكن تعتمد محتوى DB؛ الأحكام/الروابط/KG فارغة في B.

## 8) المخاطر (مرتبة)
1. 🔴 **A ≠ B** — ازدواج مصدر الحقيقة؛ العمل على القاعدة الخطأ.
2. 🔴 **DISABLE_AUTH + لا PDPL** — RBAC غير نافذ.
3. 🟠 **انقسام مخزن التضمين** — الدلالي لا يغذّي RAG.
4. 🟠 **judicial_cases=0 في B** + غموض محتوى A.
5. 🟠 **CI لا يشغّل `test:*`**.
6. 🟡 **fallback `|| 1981`** يُخفي حقيقة القاعدة.

## 9) الخيارات العلاجية (دون تنفيذ)
1. تشغيل `Audit DB Environments` بسرّ `VERCEL_DATABASE_URL_INSPECT` لمعرفة أعداد A.
2. حسم قاعدة واحدة لمصدر الحقيقة وربط Vercel + GitHub بها.
3. مواءمة BM25 + embeddings مع القاعدة المعتمدة.
4. توحيد مخزنَي التضمين.
5. إزالة `|| 1981` وربط `test:*` بالـCI.

## 10) الخلاصة
```json
{
  "databasesDetected": ["A: Vercel live", "B: GitHub Actions", "C: Hostinger MySQL (import only)"],
  "liveSiteLikelyDatabase": "A (Vercel)",
  "githubActionsDatabase": "B (9 systems / 1981 articles / 0 judgments)",
  "hostingerSource": "MySQL ahkam_moj — import source only",
  "mismatchDetected": true,
  "smallDatasetDetected": true,
  "largeDatasetDetected": "unverified (possibly in A; not in repo/B)",
  "judgmentsDetectedWhere": "A (live) + Hostinger; NOT in B",
  "bm25MatchesWhichDatabase": "B (1981)",
  "embeddingsStatus": "split: LegalArticle.embedding(B)=1981 vs embeddings table(B)=0",
  "criticalRisks": ["A!=B", "DISABLE_AUTH/no-PDPL", "embedding split", "judgments empty in B", "CI not running tests"],
  "recommendedNextStepsNoExecution": ["run audit:db-env on A", "pick single source of truth", "align Vercel+GitHub", "rebuild indexes on chosen DB", "unify embeddings", "remove ||1981 + wire tests in CI"]
}
```
