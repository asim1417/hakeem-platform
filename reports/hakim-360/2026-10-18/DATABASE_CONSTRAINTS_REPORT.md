# تقرير القيود — HKM-031

يكمل [DATABASE_CONSTRAINTS.md](DATABASE_CONSTRAINTS.md). القياس السابق 11:41Z: 176 مفتاحًا أساسيًا، 131 أجنبيًا، 86 فحصًا، 15 فريدًا، قيدان من نوع مشغّل، ولا قيد غير معتمد.

## ما أضافه الفرق الدلالي في 13:02Z

Prisma يعلن 13 مفتاحًا أجنبيًا غير موجودة في الإنتاج، ومنها سلسلة المكتب:

- `change_set.reverts_change_set_id` → `ON DELETE SET NULL`
- `editorial_change.change_set_id` و`review_decision.change_set_id` و`index_sync.change_set_id` → `ON DELETE RESTRICT`
- محادثات `chat_conversations.user_id` → `RESTRICT`، و`case_id` → `SET NULL`
- `chat_messages.conversation_id` → `CASCADE`
- روابط الفقه `fiqh_issue_links.issue_id` → `CASCADE`
- جلسات المراجعة وما يتبعها

غياب القيد يعني أن حذف صف أب لا يرفضه PostgreSQL ولا ينظّف الأبناء كما يظن قارئ المخطط. الجداول المعنية للمكتب فارغة اليوم (`index_sync` = 0، و`change_set` كان 0 في 11:44Z ولم يُعد). الخطر كامن لا ظاهر على صفوف حالية. لا `ADD CONSTRAINT` من هذا التدقيق.

`legal_articles.keywords` و`training_progress.badges`: إلزام Prisma غير منطبق على `NOT NULL`، مع افتراض مصفوفة فارغة وبدون صفوف NULL في المواد. أداة `migrate diff` لم تقترح `SET NOT NULL`. لا يُعامل الصمت كمطابقة.

فهارس التشغيل التي ليست في Prisma (HNSW وGIN وtrgm) قيود أداء لا قيود صحة. إسقاطها يغيّر خطة البحث ولا يصلح انحرافًا.

RLS ما زال مطفأً. القيد الأجنبي لا يعوّض عزل الصفوف.
