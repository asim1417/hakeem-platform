# أطلس العلاقات — HKM-031

**القياس:** 2026-10-18T11:41:39Z حتى 11:45Z. القيود المؤكدة: 411 صفًا في `evidence/constraints.csv`، وكلها `validated` في ملخص الجرد (`unvalidated_constraints=0`). المفاتيح الأجنبية لا تغطي كل الروابط المنطقية.

## طبقتان قانونيتان لا تُستبدلان

| المخزن | القياس | القراءة |
|---|---|---|
| `legal_relations` | 64,814 صفًا: 64,801 `RELATED_TO` و13 `SUPERSEDES` | علاقة عامة واسعة. غياب `IMPLEMENTS` هنا لا يعني غياب الربط |
| `legal_graph_edges` | 1,130 صفًا: 1,081 `IMPLEMENTS` و37 `PROCEDURE_FOR` و12 `GOVERNED_BY`، الحالة `VERIFIED` لكلها | الرسم البنيوي الذي يستهلكه ربط اللائحة بالنظام |
| `legal_graph_nodes` | 4,256 | عقد الرسم |
| `legal_article_case_links` | 29,705 | استناد حكم إلى مادة، وليس صف `legal_relations` |

عقد الاستهلاك الحالي في الكود: `hakeem_bylaw_links` يقرأ علاقات `IMPLEMENTS`. أي توحيد لاحق يقرأ الطبقتين ولا ينقل الصفوف في هذه المهمة.

## روابط بلا اختراع سلامة

- `ruling_segments` و`ruling_segment_embeddings` يلتقيان بمفتاح منطقي `(ruling_id, part, …)` لا بعمود `segment_id`. العدّ: 253,165 مقطعًا، 104,229 متجه مقطع، 51,105 حكمًا لها مقاطع، 51,103 لها متجهات مقاطع.
- `boe.match` يربط `guid` بـ `hakeem_system_id`. 33 صفًا في `boe.law` بلا صف مطابقة على `guid`.
- أعمدة `users` الزائدة (هاتف، إحالة، رصيد) ليست علاقات Prisma. لم تُقرأ قيمها.

فهارس HNSW الأربعة على `embeddings` (مقالة، مبدأ، عام) وعلى `ruling_segment_embeddings`. الأنواع `vector(1536)`.

التفاصيل العمودية: [DATABASE_CATALOG.csv](DATABASE_CATALOG.csv). القيود: [evidence/constraints.csv](evidence/constraints.csv).
