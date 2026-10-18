# المرحلة الأولى — تصميم التخزين النهائي لمحرك جلسات حكيم

**التاريخ:** 2026-07-25  
**الحالة:** تصميم فقط — **المهاجرة لم تُنفَّذ** · لم تُعدَّل الواجهة · لم يُغيَّر منطق الذكاء · لم يُدمَج إلى `main`

---

## 0) القرارات المعتمدة (مُلزمة)

1. إعادة استخدام `ChatConversation` و`ChatMessage` كمحرك جلسات موحّد.
2. فصل الخدمات بـ `serviceKey`: `ask` | `judicial-assistant` | `legal-chat`.
3. المعاون الهجين: قضية واحدة (`JudicialWorkCase`) → عدة جلسات محادثة داخلها.
4. روابط دائمة:
   - `/dashboard/ask/c/[conversationId]`
   - `/dashboard/judicial-assistant/cases/[caseId]/c/[conversationId]`
5. لا إنشاء صف محادثة في DB حتى أول رسالة.
6. الحفاظ الكامل على جودة الذكاء الحالية وموجهات الأوضاع و`/api/ai/agent-search`.
7. ممنوع استبدال `agent-search` بـ `legal-chat` أو تغيير سلوك الذكاء في هذه المرحلة.
8. هذه المرحلة = تصميم تخزين + Prisma + مهاجرة + ترحيل + تراجع فقط.

---

## 1) النموذج الحالي (كما هو في الشيفرة)

### `ChatConversation` → `chat_conversations`

| عمود | نوع | ملاحظات |
|------|-----|---------|
| id | TEXT (cuid) | PK |
| title | TEXT NOT NULL | عنوان عند الإنشاء |
| user_id | TEXT → users | ملكية |
| case_id | TEXT? → simulation_cases | تراث legal-chat |
| mode | TEXT DEFAULT `RESEARCHER` | أوضاع legal-chat |
| created_at / updated_at | TIMESTAMP | |

### `ChatMessage` → `chat_messages`

| عمود | نوع | ملاحظات |
|------|-----|---------|
| id | TEXT | PK |
| conversation_id | TEXT → chat_conversations CASCADE | |
| role | TEXT | user/assistant/system |
| content | TEXT | |
| attachments | JSONB? | مرفقات الرسالة (شكل حر) |
| extracted_intent | JSONB? | تراث legal-chat |
| created_at | TIMESTAMP | بلا sequence |

### علاقات محيطة (لا تُدمج محتوياتها)

| جدول | الدور بعد التصميم |
|------|-------------------|
| `simulation_cases` / `simulation_runs` | تراث `legal-chat` فقط؛ لا تُنشأ لـ ask/JA |
| `judicial_work_cases` | مستوى القضية للمعاون |
| `judicial_analyses` | مخرجات خدمات JS-*؛ تُربط لاحقًا اختياريًا بالجلسة |
| `generation_jobs` | مهام خلفية؛ الربط عبر `chat_messages.job_id` لاحقًا في التطبيق |
| `consultations` | يبقى أثرًا جانبيًا لوضع consultation كما هو؛ ليس سجل جلسات اسأل |
| `attachments` (جدول المنصة) | خارج إصلاح OCR في هذه المهاجرة |

---

## 2) النموذج المقترح النهائي

### مبادئ

- **محرك واحد للرسائل**، **هويات خدمة متعددة** عبر `service_key`.
- لا جدول محادثات عام بديل، ولا توحيد نتائج الخدمات القانونية في صف واحد.
- `case_id` (SimulationCase) يبقى للتراث؛ `judicial_case_id` للمعاون؛ `case_file_id` اختياري لملف قضية المنصة العامة.
- العنوان المعروض = `coalesce(title_override, title)`.
- الحذف ناعم عبر `deleted_at` فقط.
- المرفقات في المرحلة القادمة للتطبيق تُخزَّن أولًا في `chat_messages.attachments` بعقد JSON ثابت (بلا مهاجرة جدول مرفقات هنا).

### عقد `state` (Json على المحادثة)

```ts
type ConversationState = {
  // ask
  detailed?: boolean;
  lastMode?: string;          // آخر AskMode مستخدم
  activeJobId?: string | null;

  // judicial-assistant
  stageSnapshot?: string;
  linkedAnalysisIds?: string[]; // مراجع JudicialAnalysis اختيارية

  // مشترك
  contextVersion?: number;
  flags?: Record<string, boolean>;
};
```

### عقد مرفقات الرسالة (Json — بلا جدول جديد الآن)

```ts
type MessageAttachmentRef = {
  id: string;                 // معرّف منطقي داخل الجلسة
  fileName: string;
  mimeType?: string;
  size?: number;
  extractedText?: string;     // نص وقت الرفع (للسياق)
  storageKey?: string;        // إن وُجد لاحقًا
  processingStatus?: "inline" | "pending" | "ready" | "failed";
};
```

### عقد مصادر/استشهادات الرسالة

```ts
type RetrievedSource = {
  kind: "article" | "ruling" | "principle" | "document" | "other";
  id?: string;
  systemName?: string;
  articleNumber?: string | number;
  title?: string;
  quote?: string;
  url?: string;
  score?: number;
};
```

---

## 3) Prisma المقترح (لا يُطبَّق على `schema.prisma` الآن)

> النص التالي هو **المقترح المعتمد للمرحلة التالية** بعد إذن المهاجرة.  
> لم يُعدَّل ملف `prisma/schema.prisma` في هذه المرحلة.

```prisma
/// محرك الجلسات الموحّد — يُفصَل بالخدمة عبر serviceKey
model ChatConversation {
  id              String    @id @default(cuid())
  title           String
  titleOverride   String?   @map("title_override")
  userId          String    @map("user_id")
  user            User      @relation(fields: [userId], references: [id])

  /// ask | judicial-assistant | legal-chat
  serviceKey      String    @map("service_key")

  /// مفسَّر حسب serviceKey (AskMode أو وضع legal-chat أو سياق JA)
  mode            String    @default("RESEARCHER")

  summary         String?
  preview         String?
  state           Json?

  /// تراث legal-chat فقط
  caseId          String?         @map("case_id")
  simulationCase  SimulationCase? @relation(fields: [caseId], references: [id])

  /// ملف قضية المنصة العامة (اختياري)
  caseFileId      String?   @map("case_file_id")
  caseFile        CaseFile? @relation(fields: [caseFileId], references: [id])

  /// قضية المعاون القضائي (النموذج الهجين)
  judicialCaseId  String?           @map("judicial_case_id") @db.Uuid
  judicialCase    JudicialWorkCase? @relation(fields: [judicialCaseId], references: [id])

  /// تفريع
  parentId        String?           @map("parent_id")
  parent          ChatConversation? @relation("ConversationBranch", fields: [parentId], references: [id])
  branches        ChatConversation[] @relation("ConversationBranch")
  parentMessageId String?           @map("parent_message_id")
  parentMessage   ChatMessage?      @relation("BranchFromMessage", fields: [parentMessageId], references: [id])

  pinnedAt        DateTime? @map("pinned_at")
  archivedAt      DateTime? @map("archived_at")
  deletedAt       DateTime? @map("deleted_at")

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  messages        ChatMessage[] @relation("ConversationMessages")

  @@index([userId, serviceKey, updatedAt])
  @@index([userId, serviceKey, pinnedAt])
  @@index([judicialCaseId, updatedAt])
  @@index([parentId])
  @@map("chat_conversations")
}

model ChatMessage {
  id               String           @id @default(cuid())
  conversationId   String           @map("conversation_id")
  conversation     ChatConversation @relation("ConversationMessages", fields: [conversationId], references: [id], onDelete: Cascade)

  role             String           // user | assistant | system | tool
  content          String
  sequence         Int

  /// وضع اسأل/الخدمة وقت إرسال هذه الرسالة
  mode             String?
  model            String?

  attachments      Json?            // MessageAttachmentRef[]
  extractedIntent  Json?            @map("extracted_intent") // تراث legal-chat
  inputSnapshot    Json?            @map("input_snapshot")
  outputSnapshot   Json?            @map("output_snapshot")
  toolCalls        Json?            @map("tool_calls")
  retrievedSources Json?            @map("retrieved_sources")
  warnings         Json?
  jobId            String?          @map("job_id")

  createdAt        DateTime         @default(now()) @map("created_at")

  branchedConversations ChatConversation[] @relation("BranchFromMessage")

  @@unique([conversationId, sequence])
  @@index([conversationId])
  @@index([jobId])
  @@map("chat_messages")
}
```

### تعديلات علاقات مساندة (عند تطبيق Prisma لاحقًا)

على `User` / `CaseFile` / `JudicialWorkCase` / `SimulationCase` تُضاف العلاقات العكسية المناسبة فقط — **بدون** تغيير أعمدة تلك الجداول سوى علاقة Prisma.

مثال على `JudicialWorkCase`:

```prisma
conversations ChatConversation[]
```

مثال على `CaseFile`:

```prisma
conversations ChatConversation[]
```

---

## 4) المهاجرة المقترحة

**الملف المقترح (خارج `prisma/migrations` عمدًا حتى لا تُطبَّق تلقائيًا):**

`reports/migrations-proposed/20260725160000_conversation_session_engine.sql`

### ملخص خطوات SQL

1. إضافة أعمدة الإدارة/الهوية على `chat_conversations`.
2. `UPDATE` الصفوف الحالية → `service_key = 'legal-chat'`.
3. جعل `service_key` NOT NULL + CHECK للقيم الثلاث.
4. إضافة أعمدة السياق على `chat_messages`.
5. Backfill لـ `sequence` بـ `ROW_NUMBER()` ثم NOT NULL + UNIQUE `(conversation_id, sequence)`.
6. FKs اختيارية: `case_file_id` → `cases`، `judicial_case_id` → `judicial_work_cases` (إن وُجد الجدول)، `parent_id` / `parent_message_id`.
7. فهارس قائمة/مثبتات/قضية معاون/عنوان.

### ما لا تشمله المهاجرة (متعمد)

| البند | السبب |
|-------|--------|
| تعديل `/api/ai/agent-search` | قرار 6–7 |
| كتابة `retrievedArticles` في SimulationRun | إصلاح تطبيقي لاحق، بلا حاجة لمهاجرة أعمدة |
| إصلاح `attachments.extractedText` | مهاجرة منفصلة لاحقًا بعد إذن خاص |
| إنشاء جداول جلسات جديدة | نعيد استخدام الموجود |
| حذف أو دمج `consultations` | تبقى كما هي |
| تغيير DEFAULT لـ `mode` بعيدًا عن RESEARCHER | تفادي كسر تراث legal-chat |

---

## 5) خطة ترحيل البيانات

| المصدر | الإجراء |
|--------|---------|
| صفوف `chat_conversations` الحالية | `service_key = 'legal-chat'` |
| `mode` الحالي (RESEARCHER/…) | يبقى كما هو |
| `case_id` → SimulationCase | يبقى؛ لا يُمس |
| رسائل بلا `sequence` | ترقيم حسب `created_at, id` |
| `attachments` / `extracted_intent` على الرسائل | تُترك كما هي |
| جلسات اسأل التاريخية في المتصفح | **لا ترحيل** (لم تُحفظ في DB) |
| `generation_jobs` | لا ترحيل محتوى؛ الربط المستقبلي عبر `job_id` عند الكتابة الجديدة |
| `judicial_analyses` | لا ترحيل إلى رسائل؛ تبقى جدول مهام؛ الربط اختياري لاحقًا عبر `state.linkedAnalysisIds` |
| `consultations` من mode=consultation | تبقى صفوف استشارات؛ الجلسات الجديدة لاعتماد المحرك الموحّد بعد مرحلة التنفيذ |

### قواعد الكتابة بعد التفعيل (للتطبيق — مراحل لاحقة)

| الخدمة | service_key | إنشاء الصف | SimulationCase |
|--------|-------------|------------|----------------|
| اسأل حكيم | `ask` | عند أول رسالة فقط | **لا** |
| المعاون | `judicial-assistant` | عند أول رسالة في جلسة مرتبطة بـ `judicial_case_id` | **لا** |
| legal-chat التراثي | `legal-chat` | كما هو اليوم (best-effort) | يبقى سلوكه الحالي حتى يُقرَّر إصلاح منفصل |

### سياسة العنوان

1. عند أول رسالة مستخدم: توليد عنوان 4–8 كلمات → `title`.
2. إعادة التسمية من المستخدم → `title_override` (لا تغيّر الرسالة الأولى).
3. العرض: `coalesce(title_override, title)`.
4. احتياطي: «جلسة جديدة» / «جلسة معاون» حسب الخدمة إن فشل التوليد.

### سياسة القائمة الافتراضية

```sql
WHERE user_id = $userId
  AND service_key = $service
  AND deleted_at IS NULL
  AND archived_at IS NULL   -- ما لم يُطلب عرض المؤرشف
ORDER BY pinned_at DESC NULLS LAST, updated_at DESC
```

---

## 6) خطة التراجع

### مستوى التطبيق (قبل أي اعتماد للمهاجرة على الإنتاج)

- لا شيء للتنفيذ العكسي: الشيفرة الحالية لا تعتمد الأعمدة الجديدة بعد.

### بعد تطبيق المهاجرة على بيئة (عند صدور الإذن لاحقًا)

**تراجع آمن مفضّل (إبقاء الأعمدة، تعطيل الاستخدام):**

1. إيقاف كتابة المسارات الجديدة إلى الأعمدة الجديدة.
2. الإبقاء على قراءة `service_key` مع افتراض `legal-chat` إن لزم للتراث.

**تراجع صلب (إسقاط الأعمدة) — فقط إن لم تُكتب بعد بيانات ask/JA مهمة:**

```sql
-- ترتيب الحذف يحترم FKs
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_parent_message_id_fkey";
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_parent_id_fkey";
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_judicial_case_id_fkey";
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_case_file_id_fkey";
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_service_key_check";

DROP INDEX IF EXISTS "chat_messages_conversation_sequence_uidx";
DROP INDEX IF EXISTS "chat_messages_job_id_idx";
DROP INDEX IF EXISTS "chat_conversations_user_service_updated_idx";
DROP INDEX IF EXISTS "chat_conversations_user_service_pinned_idx";
DROP INDEX IF EXISTS "chat_conversations_user_service_active_idx";
DROP INDEX IF EXISTS "chat_conversations_judicial_case_updated_idx";
DROP INDEX IF EXISTS "chat_conversations_parent_id_idx";
DROP INDEX IF EXISTS "chat_conversations_title_lower_idx";

ALTER TABLE "chat_messages"
  DROP COLUMN IF EXISTS "sequence",
  DROP COLUMN IF EXISTS "mode",
  DROP COLUMN IF EXISTS "model",
  DROP COLUMN IF EXISTS "input_snapshot",
  DROP COLUMN IF EXISTS "output_snapshot",
  DROP COLUMN IF EXISTS "tool_calls",
  DROP COLUMN IF EXISTS "retrieved_sources",
  DROP COLUMN IF EXISTS "warnings",
  DROP COLUMN IF EXISTS "job_id";

ALTER TABLE "chat_conversations"
  DROP COLUMN IF EXISTS "service_key",
  DROP COLUMN IF EXISTS "title_override",
  DROP COLUMN IF EXISTS "summary",
  DROP COLUMN IF EXISTS "preview",
  DROP COLUMN IF EXISTS "state",
  DROP COLUMN IF EXISTS "case_file_id",
  DROP COLUMN IF EXISTS "judicial_case_id",
  DROP COLUMN IF EXISTS "parent_id",
  DROP COLUMN IF EXISTS "parent_message_id",
  DROP COLUMN IF EXISTS "pinned_at",
  DROP COLUMN IF EXISTS "archived_at",
  DROP COLUMN IF EXISTS "deleted_at";
```

**تحذير:** إسقاط `sequence` بعد بدء اسأل/JA يحذف ترتيبًا صريحًا؛ التراجع الصلب غير مناسب بعد بيانات إنتاج جديدة.

### نسخة احتياطية قبل التنفيذ (عند الإذن لاحقًا)

```bash
pg_dump --format=custom --table=chat_conversations --table=chat_messages ...
```

---

## 7) العقود المنطقية للتطبيق (مراحل لاحقة — ليست تنفيذًا الآن)

```ts
type ConversationService = "ask" | "judicial-assistant" | "legal-chat";

type AskMode =
  | "ask"
  | "analyze-case"
  | "action-plan"
  | "verdict-estimate"
  | "consultation"
  | "chat";
```

### قواعد عزل إلزامية في كل استعلام لاحق

```text
userId + serviceKey + conversationId
```

وللمعاون إضافة:

```text
judicialCaseId + ملكية القضية (ABAC)
```

### سلوك الإنشاء (معتمد)

1. المستخدم يضغط «جلسة جديدة» → حالة UI فارغة فقط، **بلا INSERT**.
2. عند أول إرسال ناجح/مقبول → إنشاء `ChatConversation` + أول `ChatMessage` (+ رد المساعد لاحقًا).
3. `service_key` يُثبَّت من الخادم لا من العميل وحده.
4. مسار الذكاء يبقى `POST /api/ai/agent-search` لأسأل؛ طبقة الجلسات تلتف حوله للحفظ فقط.

---

## 8) الروابط الدائمة (للتطبيق لاحقًا)

| الخدمة | المسار |
|--------|--------|
| اسأل | `/dashboard/ask/c/[conversationId]` |
| معاون | `/dashboard/judicial-assistant/cases/[caseId]/c/[conversationId]` |

فحوص مطلوبة لاحقًا: تحديث الصفحة، تبويب جديد، جلسة محذوفة، جلسة مستخدم آخر، `serviceKey` خاطئ في المسار.

---

## 9) المخاطر والاعتماديات

| خطر | التخفيف |
|-----|---------|
| `judicial_work_cases` غير موجود في بعض البيئات | FK داخل `DO $$` شرطي |
| كسر legal-chat التراثي | الإبقاء على `mode` DEFAULT و`case_id`؛ ترحيل `service_key=legal-chat` فقط |
| فهرس trigram غير متاح | استُبدل بفهرس `lower(title)` آمن |
| تضخم JSON للمرفقات/المصادر في الرسائل | حدود حجم في طبقة التطبيق لاحقًا؛ جدول مرفقات منفصل إن لزم في مرحلة لاحقة |
| خلط أوضاع RESEARCHER مع ask | فرض `service_key` في كل API؛ رفض فتح جلسة JA من مسار ask |
| sequence غير فريد أثناء كتابة متزامنة | unique + تخصيص sequence في معاملة |

---

## 10) ما نُفّذ في هذه المرحلة / ما لم يُنفَّذ

### نُفّذ

- تصميم التخزين النهائي المكتوب.
- Prisma المقترح (وثيقة فقط).
- ملف SQL مقترح تحت `reports/migrations-proposed/` (**ليس** تحت `prisma/migrations`).
- خطة الترحيل.
- خطة التراجع.

### لم يُنفَّذ (عمدًا)

| البند | السبب |
|-------|--------|
| `prisma migrate deploy` / أي تطبيق SQL | بانتظار إذن صريح |
| تعديل `prisma/schema.prisma` | بانتظار إذن المهاجرة |
| تعديل الواجهة | خارج المرحلة 1 |
| تعديل `/api/ai/agent-search` أو الموجهات | قرار 6–7 |
| دمج إلى `main` / نشر | ممنوع |
| المرحلة 2 (محرك API) | تنتظر موافقتك على هذا التقرير |

---

## 11) القرار المطلوب منك

للانتقال إلى **المرحلة الثانية** (محرك الجلسات API بلا واجهة نهائية):

1. **اعتماد** تصميم التخزين وPrisma أعلاه.
2. **إذن صريح بتنفيذ المهاجرة** على البيئة المناسبة (أو إذن بتحديث `schema.prisma` + إضافة المهاجرة تحت `prisma/migrations` دون deploy إن رغبت بفصل الخطوتين).
3. تأكيد أن `pg_trgm` غير مطلوب الآن (معتمد في المقترح الحالي).

**قاعدة البيانات:** هل احتاجت مهاجرة؟ نعم. هل نُفّذت؟ **لا — لم تُنفَّذ.**
