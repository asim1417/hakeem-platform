# المخطط السيادي الشامل لبناء منصة حديثة متكاملة

> **نوع الوثيقة:** وثيقة تأسيس وحوكمة وتنفيذ مرجعية (دستور معماري)
> **النطاق:** أي منصة رقمية حديثة، مهما كان مجالها
> **الحالة:** نموذج عام قابل للتخصيص — مُعتمد مرجعًا لمنصّة حكيم
> **اللغة:** العربية
>
> هذه الوثيقة هي **النسخة المرجعية** للمخطط السيادي العام. أُودعت في المستودع دون
> تعديل جوهري لتكون أساسًا للمراجعة الهندسية وإعداد Roadmap و System Design.
> مطابقتها بواقع منصّة حكيم موثّقة في
> [`BLUEPRINT_GAP_ANALYSIS.md`](./BLUEPRINT_GAP_ANALYSIS.md)، وقرار تبنّيها في
> [`adr/ADR-ARCH-000-adopt-universal-blueprint.md`](./adr/ADR-ARCH-000-adopt-universal-blueprint.md).

---

> هذه الوثيقة ليست نسخًا حرفيًا للمحادثة، بل استخلاصًا منظمًا لقراراتها ومتطلباتها،
> وتحويلها إلى مخطط عام يصلح لمنصة قانونية أو أكاديمية أو تعليمية أو صحية أو مؤسسية أو معرفية.

---

## 1. الغرض من الوثيقة

تجمع هذه الوثيقة المتطلبات المعمارية والتشغيلية والمعرفية والحوكمية اللازمة لبناء منصة رقمية حديثة قابلة للنمو طويل المدى.

تفصل الوثيقة بين:

- النواة العامة الثابتة التي تصلح لكل منصة.
- حزمة المجال التي تحمل قواعد التخصص ومصطلحاته ومصادره.
- حزمة المؤسسة التي تحمل سياسات الجهة المستخدمة.
- حزمة سير العمل التي تحدد المراحل وشروط الانتقال.
- التطبيقات التي تقدم تجربة مختلفة لكل فئة مستخدم.

القاعدة الأساسية:

> المنصة لا تُعاد هندستها كلما تغير المجال، بل تُركب فوقها حزمة مجال جديدة تلتزم بالعقود والمعايير المعتمدة.

## 2. التعريف الرسمي للمنصة

المنصة الحديثة هي بنية تشغيل رقمية سيادية قائمة على نواة مستقرة، ونموذج بيانات موحد، ومحركات مستقلة، وواجهات قابلة للاستبدال، وذكاء اصطناعي محكوم، وسير عمل قابل للتخصيص، ونظام حزم وإضافات، مع قابلية التشغيل المحلي أو السحابي أو الهجين.

ليست المنصة:

- صفحة ويب كبيرة.
- تطبيقًا مرتبطًا بنموذج ذكاء اصطناعي واحد.
- مجموعة خدمات متجاورة بلا نواة مشتركة.
- واجهة محادثة تخفي خلفها العمليات.
- قاعدة بيانات يكتب كل محرك فيها بطريقته.

## 3. المبادئ العليا

- **3.1 المنصة قبل التطبيق:** يبنى النظام كمنصة تستضيف تطبيقات متعددة (المستفيد، المختص، المراجع، المشرف، الإدارة، المؤسسة، الهاتف، بوابة المطورين).
- **3.2 البنية التحتية قبل الميزة:** كل إضافة تُقيّم: هل هي قدرة بنيوية يعاد استخدامها، أم ميزة خاصة بواجهة واحدة؟
- **3.3 العقود قبل الشيفرة:** لا يبدأ التنفيذ قبل تحديد العقد والمدخلات والمخرجات والأخطاء والصلاحيات والأحداث والإصدارات واختبارات القبول.
- **3.4 التكوين قبل التخصيص البرمجي:** القواعد المتغيرة تحفظ في ملفات تعريف وحزم، لا داخل الشيفرة.
- **3.5 الإنسان صاحب القرار:** الذكاء الاصطناعي يقترح ويحلل ويراجع، ولا يستولي على القرار النهائي في المهام عالية الأثر.

## 4. الدستور السيادي للمنصة

- **4.1 سيادة البيانات:** ملكية البيانات لصاحبها؛ تصدير/استيراد بصيغ مفتوحة؛ لا حبس داخل مزود واحد؛ تحديد مصدر الحقيقة والفهارس المشتقة؛ لا نقل بيانات حساسة دون موافقة.
- **4.2 سيادة الذكاء الاصطناعي:** لا ارتباط بمزود واحد؛ كل الاستدعاءات عبر بوابة موحدة؛ دعم النماذج المحلية والسحابية؛ تسجيل النموذج والإصدار والتكلفة؛ عدم كشف الأسرار.
- **4.3 سيادة المعرفة:** القواميس والأنطولوجيات وقواعد المجال أصول مستقلة؛ حفظ المصدر والإصدار والبصمة؛ الفصل بين النص الخام والمطبع والمعروض.
- **4.4 سيادة الحزم:** كل حزمة مستقلة قابلة للإزالة؛ تعطل حزمة لا يعطل النواة؛ لكل حزمة Manifest وتبعيات وصلاحيات.
- **4.5 السيادة التشغيلية:** دعم Local-First و Cloud و Hybrid و On-Premise و Offline Sync.

## 5. طبقات المنصة

```text
Layer 7  التطبيقات المؤسسية والمتخصصة
Layer 6  السوق والحزم والإضافات
Layer 5  البنية التحتية للذكاء الاصطناعي
Layer 4  محركات المجال والأعمال
Layer 3  المعرفة والبحث والاسترجاع
Layer 2  نظام التشغيل وسير العمل
Layer 1  النواة
Layer 0  التخزين والأمن والتشغيل
```

- **Layer 0:** قواعد البيانات، التخزين، التشفير، الأسرار، النسخ الاحتياطي، السجلات والمراقبة.
- **Layer 1:** الهوية، السياق، الجلسات، الصلاحيات، الأوامر، الاستعلامات، الأحداث، الإصدارات والتدقيق.
- **Layer 2:** إدارة دورة الحياة، البوابات، السياسات، الأتمتة، الخط الزمني والإشعارات.
- **Layer 3:** نموذج المعرفة، البحث اللفظي والدلالي والهجين، الرسم المعرفي، الاستشهادات، الحجية والتعارضات.
- **Layer 4:** المراجعة، الامتثال، التخصص، المؤسسة، الجودة والمستندات.
- **Layer 5:** بوابة المزودين، سجل النماذج والوكلاء والبرومبتات، الحوكمة والتكلفة.
- **Layer 6:** Plugin SDK و Package SDK و Marketplace وأدوات المطورين.
- **Layer 7:** تطبيقات مختلفة مبنية فوق البيانات والخدمات ذاتها.

## 6. النواة التشغيلية

**Command Bus** — كل عملية تغيير أمر صريح:

```text
CreateProject · ImportDocument · CreateEvidence · AcceptSuggestion
RejectSuggestion · RunReview · AdvanceWorkflow · PublishArtifact
```

**Query Bus** — طلبات القراءة عبر عقود موحدة:

```text
GetProject · GetDocument · SearchKnowledge · GetReviewReport
GetWorkflowTimeline · GetPermissions
```

**Event Bus** — كل تغيير مهم يولد حدثًا:

```text
ProjectCreated · DocumentImported · FindingAdded · SuggestionAccepted
GatePassed · WorkflowAdvanced · PublicationReady
```

يحتوي الحدث على: المعرف، النوع، الكيان، المنفذ، الوقت، نسخة المخطط، `correlation_id`، `causation_id`، والبيانات.

**إدارة السياق:** يعرف السياق المستخدم، المؤسسة، المشروع، المرحلة، اللغة، حزمة المجال، سياسة الخصوصية والموارد المفتوحة.

**الذاكرة التشغيلية:** آخر موضع وتخطيط وفلاتر، والقرارات السابقة، والاقتراحات المرفوضة، وتفضيلات المستخدم.

## 7. نموذج المعرفة الموحد

كل عنصر مهم يمثل Knowledge Object (مشروع، مستند، فصل، فقرة، ادعاء، دليل، استشهاد، مفهوم، شخص، مؤسسة، قاعدة، قرار، ملاحظة، اقتراح).

```yaml
id: string
uri: string
type: string
schema_version: string
entity_version: integer
status: string
owner_id: string
workspace_id: string
created_at: datetime
updated_at: datetime
created_by: string
content_hash: string
provenance: object
rights: object
metadata: object
history: array
```

**الهوية السيادية:** `platform://project/...` · `platform://document/...` · `platform://evidence/...` · `platform://citation/...` · `platform://package/...` · `platform://workflow/...`

**طبقات المحتوى:** `source_content` · `canonical_content` · `normalized_content` · `display_content`.

**Provenance:** كل معلومة تحمل المصدر، والمعرف الخارجي، ووقت الاستيراد، والإصدار، والبصمة، وحالة التحقق، وسلسلة التحويلات.

## 8. محرك العلاقات والرسم المعرفي

```yaml
id: string
source_id: string
target_id: string
relation_type: string
status: proposed | verified | rejected | superseded
confidence: number
authority: number
evidence_id: string
provenance: object
history: array
```

- **علاقات بنيوية:** contains، parent_of، next، previous.
- **علاقات مرجعية:** cites، quotes، mentions، summarizes.
- **علاقات تحليلية:** supports، contradicts، qualifies، restricts، explains، defines.
- **علاقات دلالية:** similar_to، same_concept، related_to.

العلاقات المستنتجة آليًا تبدأ `proposed` ولا تصبح `verified` إلا وفق سياسة مراجعة.

## 9. بنية المصادر والموصلات

```ts
interface SourceAdapter {
  discover(query: DiscoverQuery): Promise<SourceItem[]>;
  fetchMetadata(id: string): Promise<Metadata>;
  fetchManifest(id: string): Promise<Manifest>;
  fetchText(id: string): Promise<TextPayload>;
  fetchPages(id: string): Promise<PagePayload[]>;
  fetchUpdates(cursor?: string): Promise<UpdateBatch>;
  resolveRights(id: string): Promise<RightsDecision>;
  verifyIntegrity(payload: unknown): Promise<IntegrityReport>;
}
```

سلسلة الاستيراد:

```text
Source → Connector → Staging → Validation → Normalization
       → Deduplication → Knowledge Objects → Indices
```

الموصل ليس مصدر الحقيقة؛ وظيفته جلب حزم قابلة للتحقق.

## 10. البحث والاسترجاع

- **اللفظي:** BM25، العبارات، الفلاتر، الحقول، التطبيع اللغوي.
- **الدلالي:** Embeddings، البحث المتجهي، ربط الفهرس بإصدار النموذج.
- **الهجين:**

```text
Final Score = Lexical × W1 + Semantic × W2 + Authority × W3
            + Freshness × W4 + Context Match × W5
```

كل نتيجة تعيد تفسير درجتها. الفهارس مخرجات مشتقة قابلة لإعادة البناء، وليست مصدر الحقيقة.

## 11. محرك المستندات

```ts
interface DocumentProvider {
  inspectDocument(input: DocumentInput): Promise<DocumentInspection>;
  importStructure(input: DocumentInput): Promise<DocumentModel>;
  renderPreview(input: RenderInput): Promise<RenderResult>;
  applyOperations(input: OperationBatch): Promise<OperationResult>;
  validateDocument(input: DocumentInput): Promise<ValidationReport>;
  exportDocument(input: ExportInput): Promise<ExportResult>;
}
```

القدرات المحتملة: DOCX قراءة/كتابة، التغييرات المتعقبة، التعليقات والحواشي، القوالب والجداول والصور، PDF و HTML Preview، XLSX و PPTX. محرك المستندات مزود قابل للاستبدال، وليس جزءًا صلبًا من النواة.

## 12. مركز المراجعة

**Review Session:** كل مراجعة جلسة مستقلة تحمل الكيان محل المراجعة، الإصدار، القواعد، المراجعين أو الوكلاء، النتائج، الاقتراحات، القرارات والأحداث.

**Finding:**

```yaml
id: string
category: string
severity: info | low | medium | high | critical
description: string
evidence: array
confidence: number
affected_location: object
rule_id: string
```

**Suggestion:** `suggested → accepted → rejected → deferred`. لا يوجد تعديل صامت.

**Review Report:** الملخص، المؤشرات، النتائج، الاقتراحات، المخاطر، الجاهزية، وحدود التحليل.

## 13. مبادئ الحوكمة التنفيذية

- **Evidence First:** لا ملاحظة ولا تقييم ولا اقتراح بلا دليل ومصدر وموضع وثقة ونطاق انطباق.
- **Human Approval:** التعديلات عالية الأثر تحتاج موافقة صريحة.
- **Review Memory:** يحفظ النظام ما قُبل وما رُفض وأسباب القرارات وما تغير منذ المراجعة السابقة.
- **Quality Gates:** لا انتقال إلى مرحلة جديدة دون اجتياز بوابات محددة.
- **Health Index:** مؤشرات مستقلة بدل رقم واحد (Structure، Evidence، Compliance، Security، Delivery Health).

## 14. سير العمل

```text
Created → Planned → In Progress → Review → Revision → Validation
        → Ready → Submitted/Delivered → Approved/Accepted → Archived
```

كل انتقال يحدد شروط الدخول والخروج، المحركات المطلوبة، الأذونات، المخرجات، الأحداث وسياسة الفشل. لا يغير أي محرك حالة المشروع مباشرة؛ يرفع نتيجة إلى Workflow Engine الذي يطبق السياسة ويسجل القرار.

## 15. محرك الامتثال

يفصل الامتثال عن الجودة:

- **الجودة:** هل المخرج قوي ومتماسك؟
- **الامتثال:** هل يطابق القواعد الإلزامية؟

أنواع القواعد: الحقول الإلزامية، الحدود، التنسيق، الصلاحيات، المتطلبات المؤسسية، التوقيعات، المصادر والخصوصية.

```yaml
rule_id: string
source: string
version: string
effective_from: datetime
effective_to: datetime | null
scope: object
severity: string
validation: object
```

## 16. حزم المجال والمؤسسة

- **Domain Package:** المصطلحات، الأنطولوجيا، أنواع الأدلة، المصادر، طرق التحليل، القواعد، مؤشرات الجودة، الوكلاء والقوالب.
- **Institution Package:** الهوية، الأدوار، السياسات، سير العمل، القوالب، المتطلبات، الإشعارات والتكاملات.

**Package Manifest:**

```yaml
id: string
name: string
version: string
schema_version: string
publisher: string
capabilities: array
permissions: array
dependencies: array
conflicts: array
compatibility: object
entrypoints: object
signatures: array
```

**أولوية القواعد:**

```text
القرار الرسمي الأحدث → سياسة المؤسسة → سياسة القسم أو الوحدة
→ حزمة المجال → الإعدادات الافتراضية
```

يسجل النظام سبب تطبيق كل قاعدة.

## 17. البنية التحتية للذكاء الاصطناعي

- **AI Provider Gateway:** يدعم المزودين السحابيين والمحليين و OpenAI-compatible و Custom APIs.
- **Model Registry:** المزود، النموذج، الإصدار، القدرات، نافذة السياق، التكلفة، الخصوصية والمهام المعتمدة.
- **Agent Registry:** المهمة، الصلاحيات، الأدوات، المصادر، البرومبت، بوابات الموافقة وسياسة الفشل.
- **Prompt Registry:** لا تكتب البرومبتات داخل الشيفرة؛ لكل Prompt معرف وإصدار ومالك ومتغيرات واختبارات وسجل تغييرات.
- **أوضاع الخصوصية:** Cloud، Hybrid، Local Only.
- **الحوكمة:** منع اختلاق المصادر، الادعاء القطعي دون دليل، إرسال بيانات حساسة بلا موافقة، تعديل المحتوى دون اعتماد، وإخفاء النموذج المؤثر.
- **التكلفة:** تسجيل الاستدعاءات والرموز والزمن والتكلفة والمشروع والمستخدم والوكيل.

## 18. واجهات الاستخدام ومساحات العمل

Workspaces تحفظ حالتها: Reading، Search، Review، Evidence، Writing، Comparison، Knowledge Graph، Administration.

- **One Entity — Many Views:** الكيان واحد، والعرض يختلف بحسب الدور.
- **Command-First UX:** شريط أوامر موحد للبحث والتنقل والتنفيذ.
- **Progressive Disclosure:** الأدوات المتقدمة تظهر عند الحاجة.
- **Context-Aware Panels:** اللوحات تتغير بحسب الكيان والمهمة والمرحلة.

## 19. نظام التصميم

المبادئ: الواجهة تخدم المحتوى؛ RTL أصلي عند دعم العربية؛ وصول بلوحة المفاتيح وقارئات الشاشة؛ قابلية التكبير؛ حركة هادئة وظيفية؛ تصميم متجاوب حقيقي.

Design Tokens: الخطوط، الألوان، المسافات، الزوايا، الظلال، الحركة، الأيقونات ونقاط التحول. اعتماد شبكة 8pt، والتحميل الكسول، والقوائم الافتراضية، و Lazy AI، و Offline Cache.

## 20. الأدوار والصلاحيات

تجمع المنصة بين RBAC و ABAC. الأدوار المحتملة: Owner، Author، Reviewer، Supervisor، Approver، Administrator، Auditor، Guest، AI Agent. نطاق الصلاحية: المؤسسة، مساحة العمل، المشروع، الكيان، الحقل والعملية. كل أداة أو وكيل يحصل فقط على القدرات اللازمة.

## 21. الأمن والخصوصية

عدم حفظ مفاتيح API في الواجهة؛ عدم إظهار الأسرار في السجلات؛ Secret Manager أو تشفير فعلي؛ فحص الملفات وأنواعها وأحجامها؛ حماية من SSRF و Path Traversal؛ عزل معالجة الملفات؛ TLS أثناء النقل؛ تشفير التخزين عند الحاجة؛ سجل تدقيق كامل؛ تصنيف البيانات: Public، Internal، Confidential، Restricted.

## 22. قواعد البيانات والتخزين

قاعدة معاملات موثوقة هي مصدر الحقيقة؛ الفهارس والـ Cache والتحليلات مخازن مشتقة؛ كل كيان يدعم version و revision و history و content_hash؛ Local-First يحتاج سجل تغييرات، حل تعارضات، مزامنة انتقائية و Offline Queue.

## 23. المراقبة والاعتمادية

لكل محرك: Readiness، Liveness، Dependencies، Version، Capabilities. Observability: Structured Logs، Metrics، Distributed Tracing، Correlation IDs. المؤشرات: زمن الإقلاع، P50/P95/P99، زمن البحث، الذاكرة، حجم الفهارس، تكلفة AI ومعدل فشل الوظائف. الاسترداد: نسخ احتياطي، اختبار استعادة، RPO و RTO.

## 24. الحوكمة الهندسية

تصنيف Pull Requests:

```text
ARCH · ENGINE · FEATURE · FIX · REFACTOR · TEST
DOCS · SECURITY · PERFORMANCE · BUILD · CI · CHORE
```

قاعدة PR الصغير: هدف واحد، سبب واحد، نتيجة واحدة، وخطة تراجع.

**بطاقة هوية المحرك:**

```yaml
engine_id: string
owner: string
version: string
status: planned | experimental | active | deprecated
capabilities: array
dependencies: array
public_apis: array
events: array
permissions: array
health_check: string
tests: object
acceptance: object
documentation: array
```

## 25. بوابات الإصدار

لا يصدر إصدار قبل نجاح: Typecheck، Build، Unit Tests، Integration Tests، Contract Tests، Smoke Tests، Security Checks، Version Consistency، Documentation، Rollback Plan. لا يجوز الادعاء بنجاح فحص لم يُشغل فعليًا.

## 26. استراتيجية الاختبارات

Unit Tests للدوال والقواعد؛ Contract Tests للمحركات والمزودين؛ Integration Tests للخدمات والبيانات والأحداث؛ End-to-End لرحلات المستخدم؛ Golden Files للمستندات والمخرجات الحساسة؛ Benchmark Suite للجودة والدقة والأداء؛ حزم اختبار مستقلة لكل لغة أو مجال.

## 27. إدارة الإصدارات والتوافق

Semantic Versioning: Major لكسر التوافق، Minor لقدرة جديدة متوافقة، Patch لإصلاح متوافق. مصدر حقيقة واحد للإصدار، و Compatibility Matrix لكل حزمة، وسياسة Deprecation (الإعلان، المهلة، البديل، أداة الترحيل).

## 28. مجلس المراجعة المعمارية

أي تغيير جوهري يجيب: هل يكسر النواة؟ هل يكسر التوافق؟ هل يكرر قدرة؟ هل يضع قاعدة قابلة للتكوين داخل الشيفرة؟ هل يضيف اعتمادًا يصعب استبداله؟ هل يحترم السيادة والخصوصية؟ هل توجد خطة ترحيل وتراجع؟ تحفظ القرارات كسجلات ADRs.

## 29. Foundation Freeze

بعد تثبيت العقود، نموذج البيانات، الهوية، واجهات الامتداد، Schema الحزم و Event Envelope، تُجمّد الأسطح الأساسية، ولا تكسر إلا بقرار موثق وخطة ترحيل.

## 30. مراحل بناء المنصة

1. **Stage 0 — Recovery Point:** نسخة احتياطية، Git baseline، lockfile، خط أساس.
2. **Stage 1 — Build Reliability:** تثبيت نظيف، Typecheck، Build، Tests، Smoke.
3. **Stage 2 — Sources of Truth:** جرد authoritative و derived و artifact و fixture.
4. **Stage 3 — Contracts Foundation:** العقود و Schemas والأحداث والأخطاء.
5. **Stage 4 — Core Services:** الخدمات والمستودعات و APIs والتدقيق.
6. **Stage 5 — Workflow and Review:** المراجعة والامتثال والبوابات والذاكرة.
7. **Stage 6 — AI Infrastructure:** البوابة والنماذج والوكلاء والحوكمة.
8. **Stage 7 — Domain Packages:** أول حزمة مجال ومؤسسة وسير عمل.
9. **Stage 8 — Institutional Preview:** Pilot وتدقيق أمني وأداء ووثائق تشغيل.

## 31. خارطة Pull Requests نموذجية

`PR-001` Baseline · `PR-002` Contract Registry · `PR-003` Event Envelope · `PR-004` Core Entity Repository · `PR-005` Review Contracts · `PR-006` Workflow Gates · `PR-007` AI Gateway Contract · `PR-008` Document Provider Contract · `PR-009` First Domain Package · `PR-010` First Product UI.

## 32. ما لا ينبغي فعله

بناء كل شيء داخل ملف خادم واحد؛ تكرار القواعد في الواجهة والخلفية؛ جعل LLM مصدر الحقيقة؛ تخزين الأسرار في Local Storage أو Logs؛ ربط النظام بمزود واحد؛ استخدام معرف خارجي هوية داخلية دائمة؛ تعديل المحتوى دون تاريخ وإصدار؛ إضافة حزمة بلا Schema؛ إعلان Production Ready دون Build واختبارات؛ إعادة هيكلة واسعة قبل نقطة استرداد.

## 33. الحد الأدنى للإصدار المؤسسي الأول

نواة هوية وصلاحيات وسياق؛ نموذج بيانات موحد؛ مشروع ومساحة عمل؛ استيراد مستند؛ بحث موحد؛ مراجعة منظمة؛ اقتراحات بموافقة بشرية؛ Workflow مع Gate واحدة على الأقل؛ بوابة AI قابلة للاستبدال؛ سجل تدقيق؛ تصدير كامل للبيانات؛ لوحة إدارة؛ Health و Metrics؛ نسخ احتياطي واختبار استعادة؛ وثائق تشغيل وتطوير.

## 34. قالب تخصيص المنصة لأي هدف

```yaml
platform:
  name: ""
  mission: ""
  primary_users: []
  operating_modes: [local, cloud, hybrid]

domain_package:
  id: ""
  terminology: []
  entity_types: []
  evidence_types: []
  source_types: []
  workflows: []
  quality_dimensions: []
  compliance_rules: []
  ai_agents: []

institution_package:
  id: ""
  roles: []
  policies: []
  templates: []
  integrations: []
  retention_rules: []

product_apps:
  - id: ""
    audience: ""
    workspaces: []
    capabilities: []
```

## 35. أمثلة التخصيص

- **قانونية:** نظام، لائحة، حكم، مبدأ قضائي، مذكرة، واقعة، دفع، دليل.
- **أكاديمية:** مشروع بحث، سؤال، فرضية، مرجع، فصل، مراجعة، جامعة، مجلة.
- **صحية:** مريض، زيارة، فحص، خطة علاج، بروتوكول، موافقة، تنبيه سلامة.
- **تعليمية:** مقرر، وحدة، هدف تعلم، نشاط، تقييم، طالب، تقدم.

النواة ثابتة، وتتغير الحزم والعقود المتخصصة.

## 36. مؤشرات النجاح

- **تقنية:** نجاح Build، معدل الأعطال، زمن الاستجابة، قابلية الاستعادة، التغطية بالاختبارات.
- **تشغيلية:** الزمن الموفر، نسبة إتمام سير العمل، الأخطاء المكتشفة، معدل قبول الاقتراحات.
- **مؤسسية:** عدد الجهات، الحزم، التطبيقات، إعادة الاستخدام، مدة إضافة مجال جديد.
- **سيادية:** نسبة التشغيل المحلي، قابلية تصدير البيانات، عدد المزودين القابلين للاستبدال.

## 37. القرار التنفيذي الختامي

> نواة مستقرة، بيانات سيادية، عقود قبل الشيفرة، محركات مستقلة، ذكاء اصطناعي قابل للاستبدال،
> سير عمل محكوم، مراجعة قائمة على الدليل، موافقة بشرية، حزم مجال ومؤسسة، وتجربة استخدام
> قائمة على مساحات العمل.

لا تقاس قوة المنصة بعدد الميزات، بل بقدرتها على البقاء، والاستبدال، والتوسع، والتفسير، والتدقيق، والاستعادة، وخدمة منتجات ومؤسسات متعددة دون إعادة بناء الأساس.

## 38. حالة الوثيقة

هذه الوثيقة مخطط عام مستخلص ومنظم لبناء منصة حديثة متكاملة. تصلح بوصفها: دستورًا معماريًا أوليًا،
وثيقة متطلبات عليا، خارطة تنفيذ، مرجع مراجعة هندسية، وأساسًا لإعداد Product Requirements Document
و System Design و Roadmap.
