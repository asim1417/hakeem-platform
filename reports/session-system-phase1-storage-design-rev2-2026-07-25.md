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
