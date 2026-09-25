# تحديث المرحلة صفر — نطاق الجلسات الدائمة (اسأل + أوضاعه + المعاون)

**التاريخ:** 2026-07-25  
**النطاق:** اسأل حكيم · جميع أوضاع اسأل · المعاون القضائي · ChatConversation/ChatMessage · SimulationCase/Run · المرفقات والمهام الخلفية المرتبطة  
**الحالة:** لم يُعدَّل أي ملف تطبيقي في مرحلة الجرد. لم تُنفَّذ مهاجرة. التنفيذ متوقف حتى اعتماد التصميم ومخطط التخزين.

---

## أ) كيف تنشأ العملية الآن

### اسأل حكيم

1. المستخدم يكتب في `HakeemAskWorkspace` (الرئيسية أو `/dashboard/ask`).
2. يختار وضعًا من: `ask | analyze-case | action-plan | verdict-estimate | consultation | chat`.
3. قد يفعّل «بحث تفصيلي» و/أو يرفق مستندًا (استخراج محلي ثم إرسال النص).
4. `POST /api/ai/agent-search` مع `{ query, document?, detailed?, mode, history? }`.
5. الخادم ينشئ `generation_jobs` اختياريًا، يبث NDJSON، ويصيغ بـ `synthesizeWithMode` حسب `systemPrompt` للوضع.
6. الواجهة تضيف `Turn` في حالة React فقط.

**ملاحظة حرجة عن السياق:** العميل يرسل آخر 8 أزواج سؤال/جواب لكل الأوضاع، لكن الخادم يمرّر `history` إلى الصياغة **فقط** إذا `conversational === true` أي وضع `chat` وحده. باقي الأوضاع لا تستخدم تاريخ المحادثة في التوليد فعليًا.

### المعاون القضائي

1. إنشاء `JudicialWorkCase` (قضية/مساحة عمل).
2. رفع مرفقات → نص مستخرج في المتصفح → JSON داخل القضية.
3. تشغيل خدمات JS-001…JS-024 أو سؤال حر عبر `/api/judicial-assistant/ask`.
4. عند وجود قضية: `saveAnalysis` يكتب صفًا في `judicial_analyses` (payload كامل).
5. `CaseHistory` يعرض **عنوان الخدمة + التاريخ + محجوب/مسودة** — **لا يعيد فتح المخرج**.

---

## ب) أين تُحفظ / ماذا يضيع / ماذا يبقى بين الأجهزة

| العنصر | أين يُحفظ الآن | بعد تحديث الصفحة | بعد جهاز آخر / دخول جديد |
|--------|----------------|------------------|---------------------------|
| رسائل اسأل + الردود | React state | **تضيع** | **تضيع** |
| الوضع / بحث تفصيلي | React state | **يضيع** (يعود الافتراضي) | **يضيع** |
| مرفق اسأل + النص | ذاكرة الجلسة | **يضيع** | **يضيع** |
| الاستشهادات (basis) | React state | **تضيع** | **تضيع** |
| مسودة النص | `sessionStorage` | قد تبقى على نفس المتصفح | **لا** عبر الأجهزة |
| مهمة خلفية اسأل | `generation_jobs` + `sessionStorage` لـ jobId | قد تُستأنف إن بقي jobId | **لا** (jobId محلي) |
| وضع consultation | صف في `consultations` (أثر جانبي) | النتيجة في جدول الاستشارات — **ليست** جلسة اسأل قابلة للاستئناف | تظهر كاستشارة منفصلة بلا سلسلة رسائل |
| قضية المعاون | `judicial_work_cases` | **تبقى** | **تبقى** (للمالك) |
| مرفقات/خريطة المعاون | JSON في القضية | **تبقى** | **تبقى** |
| تحليلات المعاون | `judicial_analyses.payload` | الصف يبقى؛ **الواجهة لا تستعيد المحتوى** | نفس القيد |
| سؤال معاون بلا قضية | لا حفظ دائم | **يضيع** | **يضيع** |
| `ChatConversation` | يُكتب من `/api/legal-chat` فقط | موجود إن وُجدت جداول | اسأل **لا يستخدمه** |

---

## ج) أوضاع اسأل — هل لكل وضع سياق مستقل؟

المصدر: `lib/modules/agents/modes.ts`

| الوضع | موجه نظام | conversational | حفظ دائم | استعادة الوضع |
|-------|-----------|----------------|----------|----------------|
| `ask` | افتراضي (null) | لا | لا* | لا |
| `analyze-case` | مخصص | لا | لا | لا |
| `action-plan` | مخصص | لا | لا | لا |
| `verdict-estimate` | مخصص | لا | لا | لا |
| `consultation` | مخصص | لا | صف `Consultation` منفصل | لا كجلسة |
| `chat` | مخصص | نعم (history في الصياغة) | لا | لا |

\*ما عدا job للنتيجة الأخيرة الجارية.

**الخلاصة:** الأوضاع معرّفة جيدًا، لكن **لا تُحفظ داخل جلسة**؛ لا ضمان أن الاستئناف يعيد نفس الموجه/الأدوات/المخرج.

خيارات الواجهة المرتبطة:

- بحث تفصيلي (`detailed`)
- إضافة/تحليل مستند (`document`)
- تبديل الأوضاع الستة أعلاه

كلها حالة واجهة فقط حاليًا (ما عدا أثر consultation الجانبي).

---

## د) `ChatConversation` / `ChatMessage` وعلاقتهما بـ Simulation*

### النموذج الحالي (`prisma/schema.prisma`)

```
ChatConversation: id, title, userId, caseId→SimulationCase?, mode(default RESEARCHER), timestamps
ChatMessage: id, conversationId, role, content, attachments?, extractedIntent?, createdAt
SimulationCase: ملف قضية منظّم لمسار legal-chat
SimulationRun: تشغيل لكل دورة — inputSnapshot/retrievedArticles/warnings موجودة لكن لا تُكتب
```

### علاقة legal-chat

- المسار الحي الوحيد الكاتب: `POST /api/legal-chat` → `persistTurn`.
- كل دورة تنشئ **`SimulationCase` جديدًا** ثم رسالتين + `SimulationRun`.
- `/dashboard/legal-chat` يحوّل إلى `/dashboard/ask?mode=chat`.
- واجهة السجل (`LegalChatWorkspace`) يتيمة.
- أوضاع legal-chat (`RESEARCHER|JUDGE|…`) **مختلفة** عن أوضاع اسأل (`ask|analyze-case|…`).
- الحقول `inputSnapshot` / `retrievedArticles` / `warnings` على `SimulationRun` **لا تُكتب** عند الإنشاء.

### هل يمكن إعادة الاستخدام؟

**نعم — مع توسيع، لا كما هو.**

| الحقل الناقص على المحادثة | الحاجة |
|---------------------------|--------|
| `serviceKey` | فصل ask / judicial-assistant / legal-chat |
| `titleOverride` أو جعل `title` قابلًا للتعديل | إعادة تسمية |
| `summary` | إدارة طول السياق |
| `state` / `workspaceState` | وضع التشغيل، detailed، إعدادات |
| `judicialCaseId` | ربط المعاون دون استخدام SimulationCase |
| `parentId` / `parentMessageId` | تفريع |
| `pinnedAt` / `archivedAt` / `deletedAt` | إدارة السجل |
| فهارس `(userId, serviceKey, updatedAt)` | قائمة/بحث |

| الحقل الناقص على الرسالة | الحاجة |
|--------------------------|--------|
| `sequence` | ترتيب صريح |
| `mode` | وضع الرسالة وقت الإرسال |
| `inputSnapshot` / `outputSnapshot` | إعادة السياق |
| `retrievedSources` / `citations` / `warnings` | استشهادات الرد لا الجلسة فقط |
| `toolCalls` | أدوات/وكلاء |
| ربط مرفق برسالة | استعادة المرفقات |

**توصية التخزين:** إعادة استخدام `chat_conversations` + `chat_messages` كمحرك حواري موحّد، مع `serviceKey` إلزامي، و**إيقاف** إنشاء `SimulationCase` لكل دورة اسأل/معاون. الإبقاء على `SimulationCase`/`SimulationRun` كمسار تراثي لـ legal-chat أو دمجه لاحقًا برسائل غنية — لا كجدول جلسات اسأل.

---

## هـ) المعاون — نموذج السجل المقترح

**قرار معماري موصى به: هجين**

1. **المستوى 1 — القضية:** `JudicialWorkCase` كما هو (مساحة عمل: مرفقات، خريطة، مرحلة، أطراف).
2. **المستوى 2 — جلسات داخل القضية:** `ChatConversation` بـ `serviceKey = "judicial-assistant"` و`judicialCaseId`.
3. **التشغيلات الخدمية (JS-***):** تبقى في `JudicialAnalysis` كمخرجات مهام، ويمكن ربطها برسالة/جلسة عبر مرجع في `state` أو `outputSnapshot` لاحقًا.

**لماذا ليس جلسة واحدة ضخمة لكل قضية؟** لأن خدمات الملخص/التسبيب/الاعتراض مسارات تحليل مختلفة؛ جلسة حوار لكل مهمة أوضح للاستئناف والتفريع.

**لماذا ليس جلسات بلا قضية فقط؟** لأن هوية المعاون قضائية؛ السؤال الحر بلا قضية يُسمح به لكن يُحفظ كجلسة `judicial-assistant` بلا `judicialCaseId` أو يُرفض الحفظ حتى تُربط قضية — يُحسم عند اعتماد التصميم.

### خدمات المعاون (كتالوج)

المصدر: `lib/modules/judicial-assistant/catalog.ts` — JS-001 إلى JS-024 (ملخص، دراسة، اختصاص، تسبيب، مشروع حكم، اعتراض، تصدير…).

---

## و) المرفقات والمهام الخلفية (ضمن النطاق)

| المسار | الواقع | الفجوة للجلسات الدائمة |
|--------|--------|-------------------------|
| اسأل: استخراج محلي | نص في الطلب فقط | لا ربط بجلسة/رسالة؛ لا بقاء بين الأجهزة |
| `/api/attachments` | `extractedText = JSON.stringify(metadata)` | ليس مسار اسأل؛ OCR غير منفَّذ |
| معاون: JSON في القضية | نص محفوظ مع القضية | لا نموذج رسالة؛ لا مشاركة مع اسأل |
| `generation_jobs` | نتيجة مهمة واحدة (`lib/modules/jobs/job-store.ts`) | ليست سجل محادثة؛ الاستئناف يعتمد sessionStorage |

---

## ز) المهاجرة المقترحة (عرض فقط — لا تنفيذ)

```prisma
// توسيع ChatConversation (أسماء قابلة للتعديل بعد المراجعة)
serviceKey       String   // "ask" | "judicial-assistant" | "legal-chat"
mode             String?  // AskMode أو وضع قانوني — مفسَّر حسب serviceKey
title            String
titleOverride    String?
summary          String?
state            Json?    // detailed, tools, workspace flags
caseFileId       String?  // CaseFile اختياري (منصة عامة)
judicialCaseId   String?  // JudicialWorkCase
// caseId الحالي → SimulationCase يبقى اختياريًا للتراث
parentId         String?
parentMessageId  String?
pinnedAt         DateTime?
archivedAt       DateTime?
deletedAt        DateTime?
preview          String?

// توسيع ChatMessage
sequence         Int
mode             String?
model            String?
inputSnapshot    Json?
outputSnapshot   Json?
toolCalls        Json?
retrievedSources Json?
warnings         Json?
jobId            String?
```

**فهارس مقترحة:**

- `(userId, serviceKey, deletedAt, updatedAt)`
- `(userId, serviceKey, pinnedAt)`
- `(judicialCaseId, updatedAt)`
- `(conversationId, sequence)`

**ترحيل قديم:**

- صفوف `ChatConversation` الحالية → `serviceKey = "legal-chat"`.
- لا ترحيل لتاريخ اسأل (غير موجود في DB).
- `Consultation` المنشأة من mode=consultation تبقى كما هي؛ الجلسات الجديدة تُحفظ في المحرك الموحّد.
- `JudicialAnalysis` لا تُحذف؛ الربط الاختياري لاحقًا.

**تراجع:** إسقاط الأعمدة الجديدة / إعادة الافتراضيات؛ البيانات التراثية تبقى قابلة للقراءة إن حُفظ `serviceKey` الافتراضي.

### حالة قاعدة البيانات

| السؤال | الجواب |
|--------|--------|
| هل احتاجت مهاجرة؟ | نعم بعد اعتماد التصميم |
| هل نُفّذت؟ | **لم تُنفَّذ** |

---

## ح) مخاطر ترحيل البيانات القديمة

1. خلط أوضاع `RESEARCHER` مع `ask` إن لم يُفرض `serviceKey`.
2. تضخم `SimulationCase` التاريخي إن استمر النمط الحالي.
3. ملكية المرفقات المبنية على `extractedText` JSON قد تنكسر عند إصلاح العمود لاحقًا.
4. تحليلات المعاون بلا UI استعادة — المستخدم يتوقع «فتح» بينما القائمة metadata فقط.
5. المهام الخلفية بلا `conversationId` — يلزم ربط `jobId` بالرسالة بعد الاعتماد.

---

## ط) تصميم القائمة (UX — هوية حكيم، لا نسخ حرفي)

### سطح المكتب

- عمود جلسات ~280px بجانب مساحة اسأل/المعاون، قابل للطي.
- حالة الطي محفوظة (يفضّل تفضيل مستخدم في DB لاحقًا؛ ليس بديلًا لحفظ الجلسات).
- رأس: «الجلسات» · زر جلسة جديدة · بحث.
- مثبتات ثم تجميع زمني مشتق من `updatedAt`: اليوم / أمس / 7 أيام / 30 يومًا / أشهر.
- عنصر: عنوان · مقتطف · عدّادات خفيفة · علامة تثبيت · قائمة إجراءات حسب القدرة.

### الجوال (390px)

- زر «الجلسات» يفتح Drawer/Sheet.
- إغلاق: زر · خارج اللوحة · Escape.
- لا يمسح نص الإدخال · لا يغطي صندوق الكتابة دائمًا · RTL منطقي.

### روابط دائمة مقترحة

- اسأل: `/dashboard/ask/c/[conversationId]`
- معاون: `/dashboard/judicial-assistant/cases/[caseId]/c/[conversationId]`
- جلسة جديدة بلا صف DB حتى أول رسالة.

### قائمة الجلسات — بيانات خفيفة فقط

```ts
{
  id,
  title,
  serviceKey,
  mode,
  preview,
  updatedAt,
  pinnedAt,
  caseReference,
  messageCount,
  attachmentCount
}
```

الرسائل والسياق الكامل تُجلب عند فتح الجلسة فقط.

---

## ي) خطة التنفيذ النهائية (ضمن النطاق فقط)

| مرحلة | المحتوى | شرط التوقف |
|--------|---------|------------|
| 0 ✅ محدّث | هذا الجرد للنطاق الثلاثي + المحرك | اعتمادك |
| 1 | تصميم التخزين النهائي + نص المهاجرة + ترحيل + تراجع | **اعتماد المهاجرة صراحة** |
| 2 | محرك API: إنشاء/حفظ/استعادة/عزل/`serviceKey` — بلا UI نهائي | اختبارات API |
| 3 | ربط اسأل + كل الأوضاع + مرفقات + jobs → محرك الجلسات + قائمة أساسية | مراجعة استئناف حقيقي |
| 4 | بحث · rename · pin · archive · soft-delete · branch · export | — |
| 5 | المعاون: قضايا → جلسات · استعادة مساحة العمل · ربط التحليلات | — |
| 6 | Drawer جوال · تجميع زمني · a11y | — |
| 7 | جودة وأمن وتعدد أجهزة وفقد شبكة وعدم خلط أوضاع/خدمات | معايير القبول |

**خارج هذه الدفعة:** باقي خدمات المنصة، المشاركة العامة، الحذف النهائي، توحيد كل المنصة في سجل واحد.

---

## ك) الفجوات الجديدة (مقارنة بالجرد السابق الأوسع)

1. اسأل يرسل history لكل الأوضاع لكن الخادم يتجاهله إلا في `chat`.
2. لا يوجد `serviceKey`؛ أوضاع legal-chat وأسماء أوضاع اسأل قابلة للخلط عند إعادة استخدام الجدول.
3. `SimulationCase` يُنشأ لكل دورة legal-chat — غير صالح كنموذج اسأل.
4. المعاون يحفظ التحليلات لكن لا جلسة حوارية دائمة ولا استعادة payload من القائمة.
5. المرفقات في اسأل غير مرتبطة بأي صف دائم.
6. لا روابط دائمة لجلسات اسأل.
7. لا pin/archive/soft-delete/branch على أي من المسارين المستهدفين.

---

## ل) الملفات المفحوصة (عينة)

- `lib/modules/agents/modes.ts`
- `lib/modules/agents/mode-synthesis.ts`
- `components/ask/HakeemAskWorkspace.tsx`
- `app/api/ai/agent-search/route.ts`
- `lib/modules/jobs/job-store.ts`
- `app/api/jobs/[jobId]/route.ts`
- `prisma/schema.prisma` (`ChatConversation`, `ChatMessage`, `SimulationCase`, `SimulationRun`, `JudicialWorkCase`, `JudicialAnalysis`)
- `app/api/legal-chat/route.ts`
- `app/api/legal-chat/conversations/route.ts`
- `lib/modules/judicial-assistant/store.ts`
- `lib/modules/judicial-assistant/persistence.ts`
- `lib/modules/judicial-assistant/catalog.ts`
- `components/judicial-assistant/CaseHistory.tsx`
- `app/api/judicial-assistant/ask/route.ts`
- `app/dashboard/judicial-assistant/cases/[caseId]/page.tsx`
- `app/api/attachments/route.ts`

---

## م) الملزمات (سارية)

1. ممنوع الاكتفاء بـ sessionStorage/localStorage كحفظ دائم للجلسات.
2. ممنوع قائمة جلسات بلا رسائل حقيقية.
3. ممنوع خلط أوضاع اسأل أو خلط المعاون بالمحادثة العامة.
4. ممنوع مهاجرة / دمج main / نشر دون موافقة.
5. ممنوع حذف نهائي في هذه المرحلة.
6. ممنوع بدء التنفيذ الواسع قبل حسم نموذج التخزين.

---

## القرار المطلوب قبل أي تنفيذ

1. **اعتماد إعادة استخدام `ChatConversation`/`ChatMessage` مع `serviceKey`** (التوصية)، أو جداول جديدة منفصلة.
2. **اعتماد النموذج الهجين للمعاون** (قضية → جلسات)، أو بديل تحدده.
3. **مسار الرابط:** `/dashboard/ask/c/[id]` مقابل query param.
4. **سياسة الصف الفارغ:** لا إنشاء في DB حتى أول رسالة (موصى به).
5. **إذن لاحق للمهاجرة** — بعد اعتماد نصها في المرحلة 1؛ حاليًا **لم تُنفَّذ**.

بعد الموافقة الصريحة على التصميم ومخطط التخزين تبدأ المرحلة الأولى (عرض المهاجرة الكاملة فقط، بلا تنفيذ).
