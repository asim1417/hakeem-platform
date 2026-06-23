# تقرير جودة قاعدة البيانات
## database_quality_report.md · المرحلة 4

> التاريخ: 2026-06-21 · PostgreSQL 16 + pgvector 0.6.0 + pg_trgm · قاعدة مزروعة محليًا.

## 1) الإحصاءات
| الكيان | العدد |
|---|---|
| الأنظمة (legal_systems) | 9 |
| المواد (legal_articles) | 1981 |
| الأحكام (judicial_cases) | 6 (عيّنة تجريبية موسومة) |
| روابط مادة↔حكم | 7 |
| المبادئ | 2 |
| التصنيفات الموضوعية (legal_topics) | جدول جديد ✅ (جاهز للتعبئة) |
| سجل البحث (search_logs) | يعمل ✅ (يسجّل فعليًا) |
| المستخدمون/الأدوار/الصلاحيات | 2 / 4 / 14 |

## 2) الفهارس
- **btree** (موجودة مسبقًا): `legal_articles(lawName)`، فريد `(lawName,articleNumber)`؛ `judicial_cases(caseNo,decisionNo,court,cityName,decisionDate)`؛ الروابط والعلاقات والتدقيق.
- **GIN trigram (مضافة هذه المرحلة عبر `db:search-indexes`):** 6 فهارس على
  `judicial_cases(judgmentTitle, judgmentText)` · `judicial_principles(title, principleText)` · `legal_articles(title, content)` — تُسرّع بحث `ILIKE %term%`.
- **ناقص:** فهرس متّجهات (ivfflat/hnsw) معطّل لأن جدول المتجهات فارغ.

## 3) جودة بيانات المواد
| المؤشر | القيمة |
|---|---|
| بلا تصنيف (classification) | 0 ✅ |
| بلا كلمات مفتاحية | 716 (36%) 🟠 |
| بلا فصل (chapter) | 1981 (100%) 🔴 |
| بلا متجه (embedding) | 1981 (100%) 🔴 |
| نص فارغ/ناقص | 0 ✅ |
| مكرّرات (lawName+articleNumber فريد) | 0 ✅ |

## 4) سلامة العلاقات
- مفاتيح أساسية: ✅ على كل الجداول (cuid).
- العلاقات: مادة↔نظام، مادة↔حكم (عبر link)، حكم↔مبدأ — سليمة.
- العلاقات polymorphic (KG) بلا FK صارمة (مرونة) — فارغة حاليًا.

## 5) المشكلات والتوصيات
| المشكلة | الأولوية | التوصية |
|---|---|---|
| الأحكام/المبادئ عيّنة تجريبية فقط | 🔴 | استيراد حقيقي عبر `import:judgments` عند توفّر المصدر |
| المتجهات فارغة (لا بحث دلالي) | 🟠 | `backfill-embeddings` + `SEMANTIC_SEARCH=true` |
| chapter فارغ 100% | 🟠 | إثراء من المصدر أو استخراج آلي |
| 36% بلا كلمات مفتاحية | 🟡 | توليد كلمات مفتاحية (مرحلة إثراء) |
| التصنيفات الموضوعية فارغة | 🟡 | تعبئة `legal_topics` وربطها بالمواد |

## 6) الجاهزية للاستيراد المستقبلي
الحقول الحوكمية موجودة على الكيانات الرئيسة: `source`, `status/reviewStatus`, `createdAt`, `updatedAt`. سكربتات الاستيراد جاهزة (`import:judgments`, `seed:kg`, `backfill-embeddings`). يُنصح بإضافة حقول `indexedAt`/`importError` لاحقًا لاكتمال سجلّ الجودة المطلوب.
