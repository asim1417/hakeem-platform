# تقرير المرحلة صفر — جرد نظام الجلسات والسياق وسجل الأعمال

**التاريخ:** 2026-07-25  
**المرحلة:** صفر (جرد فقط)  
**الحالة:** لم يُعدَّل أي ملف تطبيقي في مرحلة الجرد. لم تُنفَّذ أي مهاجرة. لم يُدمَج إلى `main`.

> هذا الملف يحفظ نتائج الجرد كما عُرضت بعد فحص المستودع الفعلي.  
> لا يبدأ التنفيذ (المرحلة الأولى) إلا بعد اعتماد صريح لتقرير الجرد.

---

## 1) مصدر وبنية «تابع آخر عمل»

| البند | الواقع في الشيفرة |
|--------|-------------------|
| المكوّن | `components/dashboard/DashboardWorkbench.tsx` — عنوان «تابع آخر عمل» عند `ASK_FIRST_HOME`، و«تابع عملك» في الوضع القديم |
| مصدر البيانات | **SSR داخل** `app/dashboard/page.tsx` عبر `getDashboardStats` — **لا يوجد API** مخصص |
| الجداول | `CaseFile` (`cases`) · `Consultation` (`consultations`) · `Simulation` (`simulation_sessions`) |
| الحد | `continueItems.slice(0, 6)` |
| الترتيب | **ليس دمجًا زمنيًا موحّدًا**: قضايا ثم استشارات ثم محاكاة، ثم قصّ إلى 6 |
| العزل | عبر `caseListWhere` / `consultationListWhere` / `simulationListWhere` — المستخدم العادي مقيد بـ `userId`/`ownerId`؛ المدير يرى الجميع |

### تفاصيل الفحص الإلزامي (15 نقطة)

1. **المكوّن:** `DashboardWorkbench` يستقبل `continueItems` ويعرضها كقائمة روابط.
2. **مسار API:** لا يوجد — التحميل من الخادم في `app/dashboard/page.tsx`.
3. **الجداول:** `cases` · `consultations` · `simulation_sessions`.
4. **أنواع العناصر:** قضية · استشارة · قاضي تفاعلي (محاكاة).
5. **توليد العنوان:** قضية/محاكاة = `title` · استشارة = `facts.slice(0, 100)`.
6. **المقتطف:** حقل `meta` فقط (نوع · حالة/مرحلة · تاريخ) — بلا مقتطف نصي مستقل.
7. **ضعف العناوين:** انظر القسم 5.
8. **العدد:** حتى 6 عناصر بعد الدمج الجزئي (حتى 4 من كل مصدر قبل القصّ).
9. **الترتيب:** قضايا أولًا ثم استشارات ثم محاكاة — ليس حسب آخر تحديث عالمي.
10. **النقر:** `Link` إلى صفحة القائمة.
11. **استعادة السياق:** لا — فتح صفحة فقط.
12. **تقييد userId:** نعم للمستخدم العادي عبر ownership helpers.
13. **بيانات مستخدم آخر:** لا للمستخدم العادي؛ المدير/السوبر أدمن قد يرون الجميع (سلوك الملكية الحالي).
14. **استعلام:** ثلاثة استعلامات منفصلة ثم تجميع في الذاكرة.
15. **إنشاء أم تحديث:** قضايا/محاكاة حسب `updatedAt` · استشارات حسب `createdAt`.
16. **محذوف/مؤرشف:** لا أرشفة/حذف ناعم على هذه الجداول؛ الاستشارات مفلترة بـ `status: GENERATED` فقط.
17. **ارتباط الكيان:** المعرف موجود في `id` المحلي للبطاقة لكن **الـ href لا يستخدمه** — لا deep link.

---

## 2) التصنيف الحاكم

**استعلام تجميعي جزئي / مزيج غير منضبط** — أقرب إلى «روابط حديثة لثلاث خدمات» منه إلى سجل نشاط عام أو سجل جلسات.

- ليس سجل جلسات «اسأل حكيم».
- ليس سجل نشاط شامل للمنصة.
- لا يستعيد سياقًا؛ يفتح صفحة القائمة فقط.

**القرار المقترح (متوافق مع الأمر الحاكم):** يبقى القسم سجل نشاط عام للمنصة، ويُحسَّن لاحقًا (عناوين · deep links · ترتيب موحّد · 5–7 عناصر · رابط «عرض جميع الأعمال») دون تحويله إلى سجل جلسات اسأل حكيم.

---

## 3) الخدمات التي يسحب منها (وما لا يسحب)

**يسحب:**

- قضايا (`CaseFile`)
- استشارات (`GENERATED` فقط)
- محاكاة Prisma (`Simulation`)

**لا يسحب:**

- اسأل حكيم
- المعاون القضائي (`JudicialWorkCase`)
- المحادثة القانونية
- المرفقات
- التدريب
- المهام الخلفية (`generation_jobs`)
- DocCase / منصة الوثائق

---

## 4) ماذا يحدث عند النقر

| النوع | العنوان | الوجهة | الاستئناف |
|--------|---------|--------|-----------|
| قضية | `item.title` | `/dashboard/cases` | قائمة فقط — **بدون** `?id=` |
| استشارة | `facts.slice(0, 100)` | `/dashboard/consultations` | نموذج فارغ — **لا إعادة فتح** |
| محاكاة | `item.title` | `/dashboard/simulations` | iframe HTML — **ليس** `/api/simulations/{id}` |

لا يوجد زر «متابعة / فتح / استئناف» منفصل؛ البطاقة كلها `Link`.

---

## 5) سبب ضعف العناوين

1. الاستشارات: لا عمود `title` — العرض = أول 100 حرف من `facts`.
2. لا مولّد عناوين قصيرة (4–8 كلمات).
3. قضايا/محاكاة تعتمد عنوان المستخدم كما أُدخل (قد يكون ضعيفًا أو رموزًا).
4. التاريخ بصيغة `toLocaleString("ar-SA")` كثيفة، وليست نسبية.
5. لا يظهر عدد رسائل/مرفقات/استشهادات.
6. لا تمييز واضح بين اسم الخدمة ونوع العنصر والحالة بصيغة البطاقة المطلوبة في الأمر الحاكم.

---

## 6) جدول جرد الخدمات

### القائمة الجانبية الفعلية (`components/AppShell.tsx`)

| القائمة | العناصر |
|---------|---------|
| `legacyNavItems` | الرئيسية · اسأل حكيم · المعاون · بحث · قاضي تفاعلي · مكتبة · وثائق · وكلاء · ملفاتي |
| `askFirstNavItems` | الرئيسية · المعاون · مكتبة · ملفاتي · وثائق · بحث · قاضي · وكلاء (**بدون** رابط اسأل منفصل — السؤال على `/dashboard`) |

**موجودة كصفحات لكن خارج القائمتين:**

- `/dashboard/consultations`
- `/dashboard/legal-chat` (تحويل إلى اسأل)
- `/dashboard/cases`
- `/dashboard/training`
- `/dashboard/attachments`

### جدول الخدمات

| الخدمة | الصفحة | API الرئيسي | الجدول / وحدة الجلسة | الاستئناف الحالي |
|--------|--------|-------------|----------------------|------------------|
| اسأل حكيم | `/dashboard/ask` (+ الصفحة الرئيسية) | `POST /api/ai/agent-search` · `GET /api/jobs/[id]` | حالة React + `generation_jobs` + أثر جانبي `Consultation` عند mode=consultation | استئناف مهمة خلفية فقط؛ لا سجل جلسات |
| المعاون القضائي | `/dashboard/judicial-assistant/...` | `/api/judicial-assistant/*` | `JudicialWorkCase` + `JudicialAnalysis` | فتح Workspace القضية ✅ |
| القاضي التفاعلي | `/dashboard/simulations` (iframe) | `/api/simulations/*` منفصل عن الواجهة | UI: localStorage في HTML · API: `Simulation` + رسائل/قرارات | البطاقة → iframe؛ API يستأنف إن استُدعي |
| الاستشارات | `/dashboard/consultations` | `POST /api/ai/consultation` فقط | `Consultation` + `ConsultationCitation` | لا إعادة فتح |
| المحادثة القانونية | تحويل → `/dashboard/ask?mode=chat` | `/api/legal-chat` + `/conversations` (يتيمة نسبيًا) | `ChatConversation` + `ChatMessage` + `SimulationCase/Run` | واجهة السجل يتيمة؛ اسأل لا يستخدمها |
| الدعاوى | `/dashboard/cases` | `GET/POST /api/cases` | `CaseFile` | قائمة عرض فقط |
| ملفاتي | `/dashboard/files` = «مساحتي» | عدّادات؛ الملفات عبر `/api/attachments` | `Attachment` | فتح/تحميل — ليست جلسة |
| التدريب | `/dashboard/training` | `POST /api/training/attempts` | `TrainingProgress` | لا استئناف محاولات |

**خدمات ذات صلة خارج نطاق الجلسات المباشرة:**

- المكتبة: `/dashboard/legal-core`
- الوثائق: `/documents`
- الوكلاء: `/dashboard/agents`
- البحث: `/dashboard/legal-search`

**لا يوجد حاليًا:**

- `SessionAdapter` · `SessionRecord` · `SessionContext`
- `/api/sessions`
- `serviceKey`
- مكوّن `SessionHistoryPanel`

---

## 7) عناصر السياق — محفوظ / مفقود

| الخدمة | رسائل | نتائج | مرفقات | نص مستخرج | استشهادات | إعدادات | نواقص حرجة |
|--------|-------|-------|--------|-----------|-----------|---------|------------|
| اسأل حكيم | ذاكرة فقط (+ history في الطلب) | ذاكرة / job | محلي ثم نص في الطلب | في الذاكرة | في الواجهة | mode في الواجهة | لا persistence متعدد الجلسات |
| المعاون | ليست محادثة عامة | `JudicialAnalysis.payload` | JSON في القضية | مستخرج في المتصفح ثم مخزّن | داخل المخرجات | مرحلة/خريطة | لا pin/archive؛ سجل التحليلات لا يعيد تحميل كامل الواجهة من القائمة |
| محاكاة API | ✅ | قرارات/أحكام | ❌ | ❌ | جزئي | stage | الواجهة لا تستخدم API |
| استشارات | جدول `Message` بلا كاتب | ✅ | داخل facts | لا عمود مستقل | ✅ citations | qualityReport | لا GET by id · لا عنوان |
| محادثة قانونية | ✅ | output في Run | JSON على الرسالة | — | intent فقط؛ `retrievedArticles` فارغ | mode | واجهة يتيمة؛ Run جديد لـ SimulationCase كل دورة |
| قضايا | ❌ | summary JSON | عبر Attachments | عبر المرفق (معطوب كـ OCR) | ❌ | status | لا مسار تفصيلي |
| مرفقات | N/A | N/A | الملف | **metadata في extractedText** | ❌ | — | OCR غير منفَّذ على هذا المسار |
| تدريب | ❌ | نقاط/شارات فقط | ❌ | ❌ | ❌ | — | لا سجل إجابات |

### تفاصيل اسأل حكيم

- المكوّن: `components/ask/HakeemAskWorkspace.tsx`
- يستدعي `/api/ai/agent-search` — **لا** يستخدم `/api/legal-chat`
- يحفظ مسودة/handoff/job في `sessionStorage`
- أوضاع `AgentModeId`: `ask | analyze-case | action-plan | verdict-estimate | consultation | chat`
- لا يوجد `serviceKey` / `assistantProfile` في الشيفرة

---

## 8) جدول القدرات

| القدرة | اسأل | معاون | محاكاة UI/API | استشارات | محادثة قانونية* | قضايا | مرفقات | تدريب |
|--------|------|-------|---------------|----------|-----------------|-------|--------|-------|
| عرض سجل | ❌ | ✅ قضايا | ❌ / ✅ API | ❌ | ✅ يتيم | ✅ | ✅ | مسارات فقط |
| بحث سجل | ❌ | جزئي | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| استئناف سياق | job فقط | قضية ✅ | ❌ / ✅ API | ❌ | جزئي يتيم | قائمة | N/A | ❌ |
| إعادة تسمية | ❌ | ✅ PATCH | ❌ / ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| تثبيت | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ربط قضية | handoff | = القضية | ❌ | API فقط | عبر SimulationCase | N/A | ✅ | ❌ |
| تصدير | جزئي (toolbar) | ✅ | ✅ API | ❌ | ❌ | ❌ | تنزيل | ❌ |
| تفريع | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| أرشفة / استرجاع | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| حذف ناعم | ❌ | حذف صلب | ❌ | ❌ | ❌ | ❌ | حذف API | ❌ |
| استشهادات محفوظة | واجهة | في payload | جزئي | ✅ | غير مكتمل | ❌ | ❌ | ❌ |
| مرفقات في السياق | محلي | ✅ | ❌ | داخل facts | جزئي يتيم | عبر Attachments | ✅ كيان | ❌ |

\*الواجهة الكاملة في `components/legal-chat/LegalChatWorkspace.tsx` غير مستوردة؛ المسار يحوّل إلى اسأل.

---

## 9) الحقول الإدارية — موجودة / مفقودة

| الحقل | الحالة |
|-------|--------|
| `titleOverride` | غير موجود |
| `pinned` / `pinnedAt` | غير موجود على نماذج الجلسات |
| `archived` / `archivedAt` | غير موجود |
| `parentSessionId` | غير موجود |
| `deletedAt` | فقط على نماذج فقه (`FiqhText` …) — ليس على جلسات المستخدم |
| `ChatConversation.title` | موجود عند الإنشاء؛ لا API لإعادة التسمية |
| `Consultation` | بلا عمود عنوان |
| `serviceKey` | غير موجود |

**الخلاصة:** القراءة عبر Adapters ممكنة جزئيًا بلا مهاجرة؛ **التثبيت/الأرشفة/الحذف الناعم/التفريع/العنوان المخصص** تحتاج `ServiceSessionMetadata` (أو حقول مكافئة) — مقترحة فقط، غير منفَّذة.

---

## 10) الفجوات التي تمنع استئناف الجلسة الحقيقي

1. اسأل حكيم بلا جدول جلسات وبلا لوحة سجل.
2. «تابع آخر عمل» يفتح قوائم لا كيانات (لا deep link).
3. الاستشارات write-only من جهة الاستئناف (لا GET by id في الواجهة).
4. المحادثة القانونية مفصولة عن مسار اسأل رغم وجود جداول.
5. القاضي التفاعلي: Prisma API ≠ iframe UI.
6. لا عقد `SessionContext` ولا استعادة مرفقات/استشهادات/إعدادات موحّدة.
7. لا سياسة تلخيص سياق؛ اسأل يرسل آخر تاريخ محدود من الذاكرة فقط.
8. لا تمييز `serviceKey` بين أوضاع اسأل والمعاون والمحادثة القانونية.
9. نجاح واجهة سجل دون استعادة سياق = غير مقبول حسب الأمر الحاكم.

---

## 11) المهاجرات المطلوبة (لم تُنفَّذ)

### أ) `ServiceSessionMetadata` (للإدارة المشتركة)

```prisma
model ServiceSessionMetadata {
  id              String   @id @default(cuid())
  userId          String
  service         String
  resourceId      String

  titleOverride   String?
  pinnedAt        DateTime?
  archivedAt      DateTime?
  deletedAt       DateTime?

  caseFileId      String?
  parentSessionId String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, service, resourceId])
  @@index([userId, service, updatedAt])
  @@index([userId, service, pinnedAt])
  @@index([caseFileId])
}
```

- لا يحفظ الرسائل ولا النتائج القانونية.
- لا يوحّد محتوى الخدمات.
- **أثر:** يفعّل rename/pin/archive/soft-delete/link-case/branch.
- **خطة التراجع:** `DROP TABLE` + إزالة طبقة الكتابة.

### ب) فصل metadata عن `extractedText` في `attachments`

```sql
ALTER TABLE attachments ADD COLUMN metadata JSONB;
ALTER TABLE attachments ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'PENDING';
-- ثم backfill: نقل JSON من extractedText → metadata حيث ينطبق
```

- **أثر:** يصحح معنى OCR ويحرر `extractedText` للنص الحقيقي.
- **مرتهن:** تحديث `attachmentListWhere` وdownload وownership.
- **تراجع:** إسقاط الأعمدة بعد استعادة البيانات إن لزم.

### ج) جداول جلسات اسأل (لاحقًا بعد الاعتماد)

إما:

- توسيع محرك محادثات موجود **مع** `serviceKey` صريح، أو
- جداول مخصّصة لـ ask

**ممنوع** دمج محتوى كل الخدمات في جدول واحد.

### حالة قاعدة البيانات في هذه المرحلة

| السؤال | الجواب |
|--------|--------|
| هل احتاجت مهاجرة؟ | نعم لاحقًا لبعض القدرات |
| هل نُفّذت؟ | **لم تُنفَّذ** |

---

## 12) ادّعاء `retrievedArticles` / `inputSnapshot` / `warnings`

| السؤال | الجواب |
|--------|--------|
| أين يُعرَّف النموذج؟ | `prisma/schema.prisma` → `SimulationRun` |
| أين يُنشأ؟ | `app/api/legal-chat/route.ts` → `persistTurn` فقط |
| الخدمة المالكة؟ | مساحة المحادثة القانونية — **ليس** قاضي `/api/simulations` |
| من يكتب الحقول الثلاثة؟ | **لا أحد** — تُهمَل عند `create` |
| من يقرأها؟ | **لا أحد** |
| لماذا فارغة؟ | غير ممرَّرة من الـ orchestrator إلى `persistTurn`؛ أعمدة اختيارية تبقى null |
| هل الإصلاح يحتاج مهاجرة؟ | **لا** — كتابة تطبيقية (+ إثراء نوع النتيجة) |
| اختبار الإثبات | بعد دورة legal-chat: `findUnique` يثبت `inputSnapshot` / `retrievedArticles` / `warnings` غير null |

**ملاحظة:** لا تربط جدول المحاكاة القضائي (`Simulation` / `simulation_sessions`) بهذا الحقل لمجرد تشابه الأسماء.

---

## 13) ادّعاء `extractedText`

**مؤكَّد.**

في `app/api/attachments/route.ts`:

```ts
extractedText: JSON.stringify(metadata)
// metadata يتضمن: size, relationType, relationId, uploadedBy,
// storageMode, storageUrl, وملاحظة TODO لاستخراج النص لاحقًا
```

| البند | الواقع |
|-------|--------|
| عمود metadata منفصل | غير موجود |
| OCR على مسار `/api/attachments` | غير منفَّذ |
| ملكية المرفقات بلا قضية | تعتمد `extractedText.contains("uploadedBy":"...")` |
| مسارات OCR أخرى | doc-tool / المعاون — منفصلة ولا تصلح هذا العمود تلقائيًا |

**خطة معالجة البيانات القديمة (مقترحة فقط):**

1. تحديد الصفوف التي `extractedText` فيها JSON بخصائص metadata.
2. نقلها إلى عمود `metadata` بعد إنشائه.
3. تفريغ `extractedText` أو الإبقاء على نص غير JSON إن وُجد.
4. تحديث استعلامات الملكية والتنزيل.
5. dry-run قبل الكتابة.

---

## 14) التوصية المعمارية النهائية

1. الإبقاء على «تابع آخر عمل» **سجل نشاط عام** — توسيع مصادره لاحقًا وربطه بـ deep links + عناوين قصيرة + ترتيب موحّد حسب `updatedAt`.
2. بناء **طبقة مواءمة + Registry** فوق الجداول الحالية؛ لا توحيد محتوى.
3. إضافة `ServiceSessionMetadata` بعد إذن المهاجرة للخصائص الإدارية.
4. اسأل حكيم: persistence صريح بـ `serviceKey: "ask"` منفصل عن legal-chat وعن المعاون — حتى لو تشابه المحرك.
5. عدم إعادة تفعيل `/api/legal-chat` كمسار اسأل أعمى؛ إن أُعيد استخدام الجداول فبفصل خدمة صريح.
6. إصلاح `extractedText` و`retrievedArticles` في مراحل لاحقة مخصّصة، بعد جرد المستهلكين.
7. مكوّن واحد `SessionHistoryPanel` يستهلك `SessionRecord` فقط؛ الفروقات في الـ Adapter والقدرات.

---

## 15) خطة تنفيذ مرحلية (بدون كسر)

| مرحلة | النطاق | مخاطرة الكسر | شرط التوقف |
|--------|--------|--------------|------------|
| 0 ✅ | الجرد | — | انتظار اعتماد التقرير |
| 1 | العقود العقود + Adapter + Registry + اختبارات وحدة — بلا UI | منخفضة | عرض النتيجة وانتظار الموافقة |
| 2 | نموذج أولي: محادثة قانونية (API القائم) + استشارات (قراءة/فتح) | متوسطة على مسارات يتيمة | إن احتاج استثناء داخل المكوّن → إعادة تصميم |
| 3 | اسأل حكيم: سجل + حفظ + استعادة سياق؛ تحسين «تابع آخر عمل» | عالية إن لم يُفصل serviceKey | توقف وعرض |
| 4 | المعاون مع الحفاظ على هوية المشروع | متوسطة | توقف وعرض |
| 5 | محاكاة / قضايا / ملفات / تدريب بقدرات مناسبة لنوع الكيان | متوسطة (iframe vs API) | توقف وعرض |
| 6 | إدارة بعد إذن المهاجرة | متوسطة | توقف وعرض |
| 7 | استشهادات + OCR | عالية على ownership/download | توقف وعرض |
| 8 | جودة وأمن وجوال | — | معايير القبول |

### ما يمكن بلا مهاجرة

- عقود TypeScript
- Registry
- لوحة موحّدة
- API موحّد للقراءة
- تحسين عناوين العرض
- deep links للكيانات الموجودة
- كتابة `retrievedArticles` في legal-chat
- فصل اسأل عن legal-chat منطقيًا

### ما يحتاج مهاجرة (+ إذن)

- metadata الإدارية
- فصل metadata المرفقات
- جداول جلسات اسأل إن لم يُعتمد جدول قائم مع `serviceKey`

---

## المخاطر

- بطاقات المحاكاة توهم باستئناف Prisma بينما الواجهة iframe.
- ملكية المرفقات مربوطة بسلسلة داخل `extractedText`.
- `persistTurn` ينشئ `SimulationCase` جديدًا كل دورة — تضخم بيانات.
- المدير يرى نشاط الجميع في الرئيسية (سلوك ملكية حالي).
- كسر اسأل إن وُصِل بـ legal-chat بلا فصل خدمة.
- الاعتماد على `sessionStorage` في اسأل ليس بديلاً دائمًا للخصائص الإدارية.

---

## الملفات المفحوصة (عينة أساسية)

- `components/AppShell.tsx`
- `components/dashboard/DashboardWorkbench.tsx`
- `app/dashboard/page.tsx`
- `components/ask/HakeemAskWorkspace.tsx`
- `app/api/ai/agent-search/route.ts` (مرجعي عبر الجرد)
- `app/api/legal-chat/route.ts`
- `app/api/legal-chat/conversations/route.ts`
- `app/api/attachments/route.ts`
- `app/dashboard/legal-chat/page.tsx`
- `app/dashboard/simulations/page.tsx`
- `app/dashboard/files/page.tsx`
- `lib/modules/auth/ownership.ts`
- `lib/activity-labels.ts`
- `prisma/schema.prisma`
- صفحات/مسارات: ask · judicial-assistant · consultations · cases · training · simulations · attachments

---

## ما لم يُنفَّذ (ومعه السبب)

| البند | السبب |
|-------|--------|
| أي تعديل على شيفرة التطبيق | المرحلة صفر جرد فقط |
| مهاجرة قاعدة البيانات | ممنوع بلا إذن صريح |
| دمج إلى `main` / نشر | ممنوع بلا موافقة |
| المرحلة الأولى | تنتظر اعتماد هذا التقرير |

---

## القرار المطلوب

1. **اعتماد تقرير الجرد** للانتقال إلى المرحلة الأولى (العقود + Adapter + Registry + اختبارات — بلا UI وبلا مهاجرة).
2. اختيار مبكر (يمكن تأجيله لمرحلة 3):
   - **أ)** جداول جلسات اسأل جديدة، أو
   - **ب)** إعادة استخدام `ChatConversation` مع `serviceKey` صريح وفصل تام عن مسار legal-chat الحالي.
3. **لا إذن مهاجرة في هذه المرحلة** — المهاجرة **لم تُنفَّذ**.
