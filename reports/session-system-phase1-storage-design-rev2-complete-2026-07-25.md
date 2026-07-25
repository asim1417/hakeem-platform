# المرحلة الأولى (مراجعة 2) — تصميم التخزين النهائي المعدّل

**التاريخ:** 2026-07-25  
**الحالة:** تصميم معدّل معتمد الاتجاه — **المهاجرة لم تُنفَّذ** · لم يُعدَّل التطبيق · لم يُدمَج إلى `main` · لم يُنشَر

---

## 0) الاعتمادات المعمارية السارية

1. `ChatConversation` + `ChatMessage` محرك جلسات موحّد.
2. `serviceKey`: `ask` | `judicial-assistant` | `legal-chat`.
3. المعاون الهجين: قضية → عدة جلسات.
4. روابط دائمة:
   - `/dashboard/ask/c/[conversationId]`
   - `/dashboard/judicial-assistant/cases/[caseId]/c/[conversationId]`
5. الحفاظ الكامل على `/api/ai/agent-search` ومنطق الذكاء.
6. لا إنشاء صف فارغ حتى أول رسالة.
7. **لا تنفيذ مهاجرة الآن.**

---

## 1) التعديلات الإلزامية المُدخَلة في هذه المراجعة

| # | المطلوب | القرار في النسخة المعدّلة |
|---|---------|---------------------------|
| 1 | لا DEFAULT على `service_key` بعد الترحيل | Backfill ثم `NOT NULL` + **`DROP DEFAULT`**؛ التطبيق يمرّر الخدمة صراحة |
| 2 | منع تكرار الرسائل | `client_request_id` + unique جزئي `(conversation_id, client_request_id)` |
| 3 | إعادة تسمية التفريع | `parent_conversation_id` · `branch_from_message_id` |
| 4 | ربط حقيقي لـ jobs | أعمدة على `generation_jobs`: `conversation_id`, `message_id`, `service_key`, `client_request_id` + FKs؛ و`chat_messages.job_id` كمرجع عكسي UUID |
| 5 | attachments JSON مرحلي | موثّق أدناه + خطة جدول مستقل |
| 6 | حسم العنوان | `generated_title` (تلقائي ثابت) + `title` (عرض/إعادة تسمية) — **بدون** `title_override` |
| 7 | status تشغيلي | على المحادثة والرسالة |
| 8 | مهاجرة مقسّمة | 01 nullable → 02 backfill → 03 بوابة تطبيق → 04 قيود |
| 9 | التحقق قبل FKs | `00_preflight_verify_fks.sql` + إنشاء FK شرطي حسب النوع الفعلي |
| 10 | تحديث Prisma/SQL/rollback | هذا الملف + مجلد المهاجرة المقسّم |

---

## 2) التحقق من الجداول الفعلية (قبل FKs)

**قاعدة البيانات الحية غير متاحة في بيئة الجرد الحالية** (`DATABASE_URL` غير محمّل). التحقق المعتمد من المخطط والشيفرة:

| الكيان | جدول فعلي | نوع `id` المتوقع | المصدر |
|--------|-----------|------------------|--------|
| CaseFile | `cases` | TEXT (cuid) | `prisma/schema.prisma` `@@map("cases")` |
| JudicialWorkCase | `judicial_work_cases` | UUID | Prisma `@db.Uuid` + `schema-ensure.ts` |
| ChatConversation | `chat_conversations` | TEXT (cuid) | مهاجرة legal-chat |
| GenerationJob | `generation_jobs` | UUID | `job-store.ts` DDL |

**قبل الخطوة 4 على أي بيئة:** تشغيل  
`reports/migrations-proposed/conversation-session-engine/00_preflight_verify_fks.sql`  
وعدم إنشاء FK إن اختلف النوع أو غاب الجدول.

---

## 3) نموذج العنوان (محسوم)

| عمود | المعنى |
|------|--------|
| `generated_title` | عنوان تلقائي من أول طلب؛ يُكتب مرة ولا يُستبدل عند إعادة التسمية |
| `title` | عنوان العرض؛ يبدأ بنسخة من التلقائي؛ إعادة التسمية تعدّل `title` فقط |

العرض: `title` (دائمًا).  
لا يوجد `title_override`.

---

## 4) الحالات التشغيلية (status)

### المحادثة `chat_conversations.status`

| قيمة | المعنى |
|------|--------|
| `active` | جاهزة / آخر حالة مستقرة |
| `processing` | توجد مهمة توليد جارية مرتبطة |
| `error` | آخر تشغيل فشل وما زال يحتاج انتباهًا |

الأرشفة والحذف يبقيان عبر `archived_at` / `deleted_at` (لا تُدمَج في status).

### الرسالة `chat_messages.status`

| قيمة | المعنى |
|------|--------|
| `pending` | قُبلت ولم يبدأ التوليد |
| `streaming` | التوليد جارٍ |
| `completed` | اكتملت |
| `failed` | فشلت |
| `cancelled` | أُلغيت |

---

## 5) منع التكرار (idempotency)

- عمود الرسالة: `client_request_id TEXT NULL`
- قيد: `UNIQUE (conversation_id, client_request_id) WHERE client_request_id IS NOT NULL`
- على المهمة: `generation_jobs.client_request_id` + unique جزئي مع `conversation_id`
- سلوك التطبيق اللاحق: إن تكرر نفس المفتاح → إعادة نفس الرسالة/المهمة بدل إدراج مكرر

---

## 6) ربط `generation_jobs` الحقيقي

```
ChatConversation 1 ─── * GenerationJob
ChatMessage      1 ─── * GenerationJob   (message_id = رسالة المستخدم المحفّزة أو رسالة المساعد الهدف)
ChatMessage.job_id  ──→ GenerationJob.id  (مرجع عكسي اختياري لتسهيل الاستئناف)
```

أعمدة تُضاف إلى `generation_jobs`:

| عمود | نوع | دور |
|------|-----|-----|
| conversation_id | TEXT NULL → chat_conversations | الجلسة المالكة |
| message_id | TEXT NULL → chat_messages | الرسالة المرتبطة |
| service_key | TEXT NULL | ask / judicial-assistant / … |
| client_request_id | TEXT NULL | نفس مفتاح عدم التكرار |

**ليس كافيًا** الاعتماد على `job_id` في الرسالة وحدها أو على `sessionStorage`.

تحديث `job-store` DDL الذاتي يحدث في مرحلة التطبيق (بوابة الخطوة 3)، لا الآن.

---

## 7) المرفقات — JSON مرحلي ثم جدول مستقل

### الآن (مرحلي)

`chat_messages.attachments` JSONB بعقد:

```ts
type MessageAttachmentRef = {
  id: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  extractedText?: string;
  storageKey?: string;
  processingStatus?: "inline" | "pending" | "ready" | "failed";
};
```

يُستخدم لتمكين استعادة السياق في اسأل/المعاون دون انتظار إصلاح جدول `attachments` العام.

### خطة الانتقال (مرحلة لاحقة — مهاجرة منفصلة بإذن مستقل)

```prisma
model ConversationAttachment {
  id               String   @id @default(cuid())
  conversationId   String   @map("conversation_id")
  messageId        String?  @map("message_id")
  userId           String   @map("user_id")
  fileName         String   @map("file_name")
  mimeType         String?  @map("mime_type")
  size             Int?
  storageKey       String?  @map("storage_key")
  extractedText    String?  @map("extracted_text")  // نص حقيقي فقط
  metadata         Json?
  processingStatus String   @default("PENDING") @map("processing_status")
  createdAt        DateTime @default(now()) @map("created_at")

  @@index([conversationId])
  @@index([messageId])
  @@map("conversation_attachments")
}
```

خطوات الانتقال:

1. إنشاء الجدول.
2. كتابة مزدوجة (JSON + جدول) لفترة قصيرة.
3. Backfill من JSON.
4. القراءة من الجدول.
5. إيقاف الاعتماد على JSON كم مصدر حقيقة (قد يبقى كـ cache خفيف).

إصلاح `attachments.extractedText` في جدول المنصة العام **خارج** هذه المهاجرة.

---

## 8) Prisma المقترح النهائي (وثيقة فقط — لم يُطبَّق)

```prisma
model ChatConversation {
  id                   String    @id @default(cuid())
  /// عنوان العرض — يُعدَّل عند إعادة التسمية
  title                String
  /// العنوان التلقائي الأصلي — لا يُستبدل عند إعادة التسمية
  generatedTitle       String?   @map("generated_title")

  userId               String    @map("user_id")
  user                 User      @relation(fields: [userId], references: [id])

  /// ask | judicial-assistant | legal-chat — بلا default في القاعدة بعد التشديد
  serviceKey           String    @map("service_key")

  /// مفسَّر حسب serviceKey
  mode                 String    @default("RESEARCHER")

  /// active | processing | error
  status               String    @default("active")

  summary              String?
  preview              String?
  state                Json?

  /// تراث legal-chat
  caseId               String?         @map("case_id")
  simulationCase       SimulationCase? @relation(fields: [caseId], references: [id])

  caseFileId           String?   @map("case_file_id")
  caseFile             CaseFile? @relation(fields: [caseFileId], references: [id])

  judicialCaseId       String?           @map("judicial_case_id") @db.Uuid
  judicialCase         JudicialWorkCase? @relation(fields: [judicialCaseId], references: [id])

  parentConversationId String?           @map("parent_conversation_id")
  parentConversation   ChatConversation? @relation("ConversationBranch", fields: [parentConversationId], references: [id])
  branches             ChatConversation[] @relation("ConversationBranch")

  branchFromMessageId  String?      @map("branch_from_message_id")
  branchFromMessage    ChatMessage? @relation("BranchFromMessage", fields: [branchFromMessageId], references: [id])

  pinnedAt             DateTime? @map("pinned_at")
  archivedAt           DateTime? @map("archived_at")
  deletedAt            DateTime? @map("deleted_at")

  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  messages             ChatMessage[] @relation("ConversationMessages")

  @@index([userId, serviceKey, updatedAt])
  @@index([userId, serviceKey, pinnedAt])
  @@index([judicialCaseId, updatedAt])
  @@index([parentConversationId])
  @@map("chat_conversations")
}

model ChatMessage {
  id               String           @id @default(cuid())
  conversationId   String           @map("conversation_id")
  conversation     ChatConversation @relation("ConversationMessages", fields: [conversationId], references: [id], onDelete: Cascade)

  role             String
  content          String
  sequence         Int
  /// pending | streaming | completed | failed | cancelled
  status           String           @default("completed")

  mode             String?
  model            String?
  clientRequestId  String?          @map("client_request_id")

  attachments      Json?            // مرحلي — انظر خطة ConversationAttachment
  extractedIntent  Json?            @map("extracted_intent")
  inputSnapshot    Json?            @map("input_snapshot")
  outputSnapshot   Json?            @map("output_snapshot")
  toolCalls        Json?            @map("tool_calls")
  retrievedSources Json?            @map("retrieved_sources")
  warnings         Json?

  jobId            String?          @map("job_id") @db.Uuid

  createdAt        DateTime         @default(now()) @map("created_at")

  branchedConversations ChatConversation[] @relation("BranchFromMessage")

  @@unique([conversationId, sequence])
  @@index([conversationId])
  @@index([jobId])
  @@map("chat_messages")
}
```

> لا يُعرَّف نموذج Prisma لـ `generation_jobs` في هذه الوثيقة إن بقي خارج Prisma؛ الأعمدة تُضاف SQLًا ويُحدَّث `job-store` لاحقًا. يمكن إضافة model اختياري في مرحلة التنفيذ.

---

## 9) المهاجرة المقسّمة (مقترحة — لم تُنفَّذ)

المجلد:

`reports/migrations-proposed/conversation-session-engine/`

| ملف | الدور |
|-----|--------|
| `00_preflight_verify_fks.sql` | قراءة فقط — أنواع/وجود الجداول |
| `01_add_nullable_columns.sql` | أعمدة nullable على conversations/messages/jobs |
| `02_backfill.sql` | legal-chat + generated_title + sequence + status |
| `03_app_update_gate.md` | بوابة تحديث التطبيق قبل التشديد |
| `04_constraints_and_not_null.sql` | NOT NULL بلا DEFAULT لـ service_key + CHECK + FKs شرطية + idempotency |

**الترتيب ملزم. لا تُنفَّذ 04 قبل نجاح 00 وبوابة 03.**

---

## 10) خطة الترحيل

1. تشغيل 01 على بيئة تجريبية بعد الإذن.
2. تشغيل 02:
   - `service_key = 'legal-chat'` للصفوف null
   - `generated_title = title`
   - `status` للمحادثة/الرسالة
   - `sequence` بالترتيب الزمني
3. تحديث التطبيق (مرحلة لاحقة) ليكتب `serviceKey` صراحة ويربط jobs.
4. تشغيل 00 والتحقق من `cases.id` و`judicial_work_cases.id`.
5. تشغيل 04 لفرض القيود.
6. لا ترحيل لتاريخ اسأل من المتصفح (غير موجود في DB).

---

## 11) خطة التراجع (محدَّثة)

### بعد 01 فقط

إسقاط الأعمدة الجديدة المضافة (conversations/messages/jobs) إن لم تُفرض قيود.

### بعد 02

نفس إسقاط الأعمدة؛ البيانات القديمة في الأعمدة الأصلية (`title`, …) لم تُمس جوهريًا.

### بعد 04

1. إسقاط FKs/indexes/checks الجديدة بالأسماء الواردة في 04.
2. `ALTER COLUMN service_key DROP NOT NULL` ثم إسقاط العمود إن لزم.
3. **لا يُعاد DEFAULT = legal-chat** كحل دائم للتطبيق حتى في التراجع الجزئي للتطوير؛ إن احتيج توافق مؤقت فيكون في طبقة التطبيق لا كعقد قاعدة دائم.

نسخة احتياطية قبل أي تنفيذ لاحق:

```bash
pg_dump --format=custom \
  --table=chat_conversations --table=chat_messages --table=generation_jobs ...
```

---

## 12) قواعد التطبيق اللاحقة (ليست تنفيذًا الآن)

- إنشاء الجلسة عند أول رسالة فقط.
- `serviceKey` من الخادم ومطابق للمسار.
- اسأل يحفظ عبر لفّ `agent-search` لا استبداله.
- المعاون: `service_key=judicial-assistant` + `judicial_case_id`.
- القائمة الافتراضية تستبعد `deleted_at` و`archived_at`.
- الاستئناف يجلب الرسائل + snapshots + sources + مرفقات JSON + حالة job المرتبطة.

---

## 13) ما نُفّذ / ما لم يُنفَّذ

### نُفّذ

- مراجعة التصميم حسب التعديلات العشر.
- Prisma معدّل (وثيقة).
- SQL مقسّم + preflight + بوابة تطبيق + rollback محدّث.

### لم يُنفَّذ

| البند | الحالة |
|-------|--------|
| تطبيق المهاجرة | **لم يُنفَّذ** |
| تعديل `schema.prisma` الحي | لا |
| تعديل التطبيق / الذكاء | لا |
| دمج `main` / نشر | لا |
| التحقق الحي من القاعدة | متعذّر هنا؛ مُلزَم عبر 00 قبل التنفيذ |

---

## 14) القرار المطلوب

1. اعتماد **هذه المراجعة 2** كتصميم تخزين نهائي.
2. عند الرغبة بالتنفيذ لاحقًا: إذن صريح منفصل يحدّد البيئة (تجريبي أولًا) وترتيب الملفات 01→02→(تطبيق)→00→04.
3. بعدها فقط يمكن فتح مرحلة محرك API.

**قاعدة البيانات:** احتاجت مهاجرة؟ نعم (مقسّمة). هل نُفّذت؟ **لا.**

---

# الملحق — ملفات المهاجرة المقسّمة (كاملة)


## ملف: `README.md`

# مهاجرة محرك الجلسات — مقترح مقسّم (لم يُنفَّذ)

الترتيب الإلزامي:

1. `01_add_nullable_columns.sql` — إضافة أعمدة nullable فقط
2. `02_backfill.sql` — ترحيل البيانات القديمة
3. *(تحديث التطبيق — خارج SQL؛ مراحل لاحقة بعد إذن التنفيذ)*
4. `04_constraints_and_not_null.sql` — القيود وNOT NULL وإزالة DEFAULT

قبل الخطوة 4: تشغيل `00_preflight_verify_fks.sql` والتحقق من النتائج.


## ملف: `00_preflight_verify_fks.sql`

```sql
-- ============================================================================
-- فحص ما قبل إنشاء المفاتيح الأجنبية — تشغيل قراءة فقط.
-- لا يغيّر بيانات. يجب نجاح الفحص قبل 04_constraints_and_not_null.sql
-- ============================================================================

-- 1) وجود الجداول المستهدفة
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'chat_conversations',
    'chat_messages',
    'cases',
    'judicial_work_cases',
    'generation_jobs'
  )
ORDER BY 1;

-- 2) نوع معرّف CaseFile الفعلي (= جدول cases)
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cases'
  AND column_name = 'id';
-- المتوقع من المخطط/الشيفرة: data_type = 'text' أو 'character varying'

-- 3) نوع معرّف JudicialWorkCase الفعلي
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'judicial_work_cases'
  AND column_name = 'id';
-- المتوقع من schema-ensure + Prisma: udt_name = 'uuid'

-- 4) نوع chat_conversations.id (للمقارنة مع generation_jobs.conversation_id)
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chat_conversations'
  AND column_name = 'id';

-- 5) أعمدة generation_jobs الحالية
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'generation_jobs'
ORDER BY ordinal_position;

-- قواعد القرار:
-- - إن كان cases.id نصًا و judicial_work_cases.id UUID وطابقت أعمدة الربط المقترحة:
--     اسمح بـ FKs في الخطوة 4.
-- - إن اختلف النوع أو غاب الجدول: لا تُنشأ FK لذلك الجدول؛ أبقِ العمود بدون قيد
--   حتى تُصحَّح البيئة.
```


## ملف: `01_add_nullable_columns.sql`

```sql
-- ============================================================================
-- الخطوة 1/4 — إضافة أعمدة nullable فقط
-- مقترح — لا يُنفَّذ دون إذن صريح.
-- لا DEFAULT على service_key. لا NOT NULL. لا CHECK صارم بعد.
-- ============================================================================

-- ── chat_conversations ──────────────────────────────────────────────────────
ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "service_key" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_title" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "preview" TEXT,
  ADD COLUMN IF NOT EXISTS "state" JSONB,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "case_file_id" TEXT,
  ADD COLUMN IF NOT EXISTS "judicial_case_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_conversation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_from_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- ملاحظة: عمود "title" الحالي يبقى عنوان العرض (قابل لإعادة التسمية).
-- "generated_title" يحفظ العنوان التلقائي الأصلي ولا يُستبدل عند إعادة التسمية.

-- ── chat_messages ───────────────────────────────────────────────────────────
ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "sequence" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "mode" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "client_request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "input_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "output_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "tool_calls" JSONB,
  ADD COLUMN IF NOT EXISTS "retrieved_sources" JSONB,
  ADD COLUMN IF NOT EXISTS "warnings" JSONB,
  ADD COLUMN IF NOT EXISTS "job_id" UUID;

-- ── generation_jobs — ربط حقيقي بالمحادثة/الرسالة ───────────────────────────
-- الجدول يُنشأ غالبًا بـ DDL ذاتي في job-store؛ نضيف الأعمدة إن وُجد الجدول.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'generation_jobs'
  ) THEN
    ALTER TABLE "generation_jobs"
      ADD COLUMN IF NOT EXISTS "conversation_id" TEXT,
      ADD COLUMN IF NOT EXISTS "message_id" TEXT,
      ADD COLUMN IF NOT EXISTS "service_key" TEXT,
      ADD COLUMN IF NOT EXISTS "client_request_id" TEXT;
  END IF;
END $$;
```


## ملف: `02_backfill.sql`

```sql
-- ============================================================================
-- الخطوة 2/4 — ترحيل البيانات القديمة (backfill)
-- مقترح — لا يُنفَّذ دون إذن صريح.
-- لا يفرض NOT NULL هنا. لا يضع DEFAULT دائمًا على service_key.
-- ============================================================================

-- 1) الصفوف التراثية → legal-chat (مرة واحدة)
UPDATE "chat_conversations"
SET "service_key" = 'legal-chat'
WHERE "service_key" IS NULL;

-- 2) العنوان التلقائي الأصلي = العنوان الحالي عند غياب generated_title
UPDATE "chat_conversations"
SET "generated_title" = "title"
WHERE "generated_title" IS NULL
  AND "title" IS NOT NULL
  AND btrim("title") <> '';

-- 3) حالة تشغيلية افتراضية للمحادثات القائمة
UPDATE "chat_conversations"
SET "status" = 'active'
WHERE "status" IS NULL;

-- 4) ترقيم الرسائل القديمة
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "conversation_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "chat_messages"
  WHERE "sequence" IS NULL
)
UPDATE "chat_messages" AS m
SET "sequence" = ordered.rn
FROM ordered
WHERE m."id" = ordered."id";

-- 5) حالة الرسائل القديمة المكتملة
UPDATE "chat_messages"
SET "status" = 'completed'
WHERE "status" IS NULL;

-- 6) (اختياري) لا نخمّن conversation_id لمهام generation_jobs القديمة من meta
--    إلا إذا وُجد مفتاح صريح لاحقًا. تُترك NULL عمدًا.
```


## ملف: `03_app_update_gate.md`

# الخطوة 3/4 — تحديث التطبيق (بوابة قبل القيود)

**ليست ملف SQL.** تُنفَّذ في مرحلة التطبيق بعد إذن المهاجرة، **قبل** `04_constraints_and_not_null.sql`.

## مطلوب من التطبيق قبل تفعيل NOT NULL / CHECK

1. كل إنشاء `ChatConversation` يمرّر `serviceKey` صراحة (`ask` | `judicial-assistant` | `legal-chat`) — **بلا اعتماد على DEFAULT في القاعدة**.
2. كل رسالة جديدة تحصل على `sequence` متزايد داخل معاملة.
3. رسائل المستخدم/المساعد تُرسل مع `clientRequestId` عند الإمكان؛ الخادم يرفض التكرار عبر القيد الفريد.
4. عند إنشاء `generation_jobs`: تعبئة `conversation_id` + `message_id` + `service_key` (+ `client_request_id` إن وُجد).
5. تحديث DDL الذاتي في `job-store` ليشمل الأعمدة الجديدة (idempotent) حتى البيئات التي تعتمد `ensure()` لا تُسقِط الأعمدة.
6. مسار `/api/ai/agent-search` **لا يُستبدل**؛ طبقة الجلسات تلتف حوله للحفظ فقط.
7. عدم إنشاء صف محادثة فارغ حتى أول رسالة.

## بوابة الانتقال للخطوة 4

- [ ] لا مسارات كتابة تعتمد DEFAULT لـ `service_key`
- [ ] قراءة القائمة تصفّي بـ `service_key` + `user_id`
- [ ] اختبارات عزل المستخدم/الخدمة خضراء على فرع التنفيذ
- [ ] نجاح `00_preflight_verify_fks.sql` موثّق


## ملف: `04_constraints_and_not_null.sql`

```sql
-- ============================================================================
-- الخطوة 4/4 — القيود و NOT NULL بعد الترحيل وتحديث التطبيق
-- مقترح — لا يُنفَّذ دون إذن صريح وبعد نجاح preflight + بوابة التطبيق.
-- مهم: لا يُضاف DEFAULT لـ service_key. التطبيق ملزم بتمرير القيمة صراحة.
-- ============================================================================

-- تأكيد عدم بقاء قيم فارغة قبل التشديد
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "chat_conversations" WHERE "service_key" IS NULL) THEN
    RAISE EXCEPTION 'backfill incomplete: chat_conversations.service_key contains NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM "chat_messages" WHERE "sequence" IS NULL) THEN
    RAISE EXCEPTION 'backfill incomplete: chat_messages.sequence contains NULL';
  END IF;
END $$;

-- ── service_key: إلزامي بلا DEFAULT ─────────────────────────────────────────
ALTER TABLE "chat_conversations"
  ALTER COLUMN "service_key" DROP DEFAULT;

ALTER TABLE "chat_conversations"
  ALTER COLUMN "service_key" SET NOT NULL;

ALTER TABLE "chat_conversations"
  DROP CONSTRAINT IF EXISTS "chat_conversations_service_key_check";
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_service_key_check"
  CHECK ("service_key" IN ('ask', 'judicial-assistant', 'legal-chat'));

-- ── status على المحادثة ─────────────────────────────────────────────────────
UPDATE "chat_conversations" SET "status" = 'active' WHERE "status" IS NULL;
ALTER TABLE "chat_conversations"
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "chat_conversations"
  DROP CONSTRAINT IF EXISTS "chat_conversations_status_check";
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_status_check"
  CHECK ("status" IN ('active', 'processing', 'error'));

-- ── sequence + status على الرسائل ───────────────────────────────────────────
ALTER TABLE "chat_messages"
  ALTER COLUMN "sequence" SET NOT NULL;

UPDATE "chat_messages" SET "status" = 'completed' WHERE "status" IS NULL;
ALTER TABLE "chat_messages"
  ALTER COLUMN "status" SET DEFAULT 'completed',
  ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "chat_messages"
  DROP CONSTRAINT IF EXISTS "chat_messages_status_check";
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_status_check"
  CHECK ("status" IN ('pending', 'streaming', 'completed', 'failed', 'cancelled'));

-- ── منع تكرار الرسائل (idempotency) ─────────────────────────────────────────
-- يسمح بعدة رسائل بلا مفتاح؛ يمنع تكرار نفس client_request_id داخل المحادثة.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_client_request_uidx"
  ON "chat_messages" ("conversation_id", "client_request_id")
  WHERE "client_request_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_sequence_uidx"
  ON "chat_messages" ("conversation_id", "sequence");

-- ── FKs بعد التحقق من الأنواع في preflight ──────────────────────────────────
-- CaseFile → cases.id (TEXT cuid متوقع)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cases' AND column_name='id'
      AND data_type IN ('text', 'character varying')
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_case_file_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_case_file_id_fkey"
      FOREIGN KEY ("case_file_id") REFERENCES "cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- JudicialWorkCase → judicial_work_cases.id (UUID متوقع)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='judicial_work_cases'
      AND column_name='id' AND udt_name = 'uuid'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_judicial_case_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_judicial_case_id_fkey"
      FOREIGN KEY ("judicial_case_id") REFERENCES "judicial_work_cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- تفريع
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_parent_conversation_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_parent_conversation_id_fkey"
      FOREIGN KEY ("parent_conversation_id") REFERENCES "chat_conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_branch_from_message_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_branch_from_message_id_fkey"
      FOREIGN KEY ("branch_from_message_id") REFERENCES "chat_messages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- generation_jobs ↔ المحادثة/الرسالة (إن وُجد الجدول)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='generation_jobs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'generation_jobs_conversation_id_fkey'
    ) THEN
      ALTER TABLE "generation_jobs"
        ADD CONSTRAINT "generation_jobs_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'generation_jobs_message_id_fkey'
    ) THEN
      ALTER TABLE "generation_jobs"
        ADD CONSTRAINT "generation_jobs_message_id_fkey"
        FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- منع تكرار مهمة لنفس طلب العميل داخل المحادثة
    CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_conversation_client_request_uidx"
      ON "generation_jobs" ("conversation_id", "client_request_id")
      WHERE "client_request_id" IS NOT NULL AND "conversation_id" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS "generation_jobs_conversation_created_idx"
      ON "generation_jobs" ("conversation_id", "created_at" DESC)
      WHERE "conversation_id" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS "generation_jobs_message_id_idx"
      ON "generation_jobs" ("message_id")
      WHERE "message_id" IS NOT NULL;
  END IF;
END $$;

-- ربط عكسي اختياري: message.job_id → generation_jobs.id (UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='generation_jobs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_job_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_job_id_fkey"
      FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── فهارس القائمة ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_updated_idx"
  ON "chat_conversations" ("user_id", "service_key", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_pinned_idx"
  ON "chat_conversations" ("user_id", "service_key", "pinned_at" DESC)
  WHERE "pinned_at" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_active_idx"
  ON "chat_conversations" ("user_id", "service_key", "updated_at" DESC)
  WHERE "deleted_at" IS NULL AND "archived_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_judicial_case_updated_idx"
  ON "chat_conversations" ("judicial_case_id", "updated_at" DESC)
  WHERE "judicial_case_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_parent_conversation_id_idx"
  ON "chat_conversations" ("parent_conversation_id")
  WHERE "parent_conversation_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_title_lower_idx"
  ON "chat_conversations" (lower("title"));

CREATE INDEX IF NOT EXISTS "chat_messages_job_id_idx"
  ON "chat_messages" ("job_id")
  WHERE "job_id" IS NOT NULL;
```

