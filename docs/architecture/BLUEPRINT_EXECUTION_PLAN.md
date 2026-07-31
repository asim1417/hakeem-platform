# خطة تنفيذ مواءمة المخطط السيادي — PR لكل بند

خطة تفصيلية لمواءمة [المخطط السيادي](./UNIVERSAL_PLATFORM_BLUEPRINT.md) وفق
[تحليل الفجوة](./BLUEPRINT_GAP_ANALYSIS.md)، ملتزمةً بـ ADR-ARCH-000 (تجميد الأساس، إضافة لا كسر).

**قاعدة الإخراج:** كل بند = **PR مستقلّ** بنوعٍ من تصنيف §24، هدف واحد، وخطة تراجع.
**قاعدة السلامة:** لا تعديل توقيع دالّة عامّة، ولا عمود إلزاميّ على جدول قائم، ولا تغيير سلوك افتراضيّ.
كل عمود جديد **nullable/بقيمة افتراضية تحفظ السلوك الحاليّ**.

**مفتاح المخاطرة:** 🟢 صفر كسر · 🟡 يحتاج backfill/golden · 🔴 يمسّ الأساس أو مُدخلًا خارجيًّا.

---

## الموجة 1 — عقود الأساس (تفتح ما بعدها)

### PR-A1 · `ENGINE` · Event Envelope 🟢
**الهدف:** تغليف التدقيق القائم بمغلّف حدث موحّد دون لمس المستدعين (§6, §23).

- **جديد:** `lib/modules/audit/event-envelope.ts` — نوع `EventEnvelope { eventId, type, entityType, entityId, actorId, occurredAt, schemaVersion, correlationId, causationId, payload }` + `newCorrelationId()` + `withEnvelope()`.
- **جديد:** `lib/modules/audit/request-context.ts` — `AsyncLocalStorage` يحمل `correlationId` للطلب (اختياريّ؛ لا أثر إن لم يُستعمل).
- **تعديل إضافيّ:** `lib/modules/audit/audit.ts` — `auditEvent()` يقبل حقولًا **اختيارية** `correlationId?/causationId?/schemaVersion?`؛ يولّد `correlationId` تلقائيًّا إن غاب. التوقيع يبقى متوافقًا للخلف.
- **Prisma:** أعمدة **nullable** على `AuditEvent` (`schema.prisma:507`): `correlationId String?`, `causationId String?`, `schemaVersion String?`. هجرة إضافية.
- **اختبار:** `scripts/test-event-envelope.ts` — ثبات `correlationId` داخل الطلب، تسلسل `causationId`، توافق النداءات القديمة.
- **قبول:** كل نداءات `auditEvent` الحالية تُصرَّف دون تغيير · typecheck+build خضراء.
- **تراجع:** revert الهجرة (إسقاط أعمدة nullable) + الملفات.
- **يعتمد عليه:** A/B اللاحقة تُصدر أحداثها عبره (اختياريّ).

### PR-A2 · `ENGINE` · Prompt Registry 🟡
**الهدف:** إخراج البرومبتات من الكود بمعرّف/إصدار/مالك، **بنصٍّ مطابق حرفيًّا** (§17).

- **جديد:** `lib/modules/ai/prompts/registry.ts` — `PromptTemplate { id, version, owner, variables[], render(vars) }` + `getPrompt(id)` + `listPrompts()`.
- **جديد:** ملف لكل برومبت مُرحَّل حرفيًّا من: `lib/modules/ai/legal-prompts.ts`، `ai-gateway.ts:237-243/320-330`، `judicial-simulation/judicial-prompts.ts`، `case-analysis/case-prompts.ts`، `legal-agent/legal-agent-prompts.ts`.
- **جديد:** `lib/modules/ai/prompts/CHANGELOG.md`.
- **تعديل:** مواضع النداء تستورد من السجلّ بدل النصّ inline (النصّ ذاته → صفر تغيير سلوك).
- **اختبار (golden):** `scripts/test-prompt-registry.ts` — كل `id` يُحلّ ويُصيَّر، وله `version`+`owner`، و**اللقطة تساوي النصّ القديم بايتًا ببايت**.
- **قبول:** golden snapshot مطابق · typecheck+build.
- **تراجع:** revert الاستيرادات.

### PR-A3 · `ENGINE` · Model Registry 🟢
**الهدف:** سجلّ قدرات النماذج يقرأه `defaultModelFor` (§17-حوكمة/تكلفة/خصوصية).

- **جديد:** `lib/modules/ai/model-registry.ts` — `ModelEntry { provider, model, version?, contextWindow, cost{ inputPer1k, outputPer1k }, privacy: 'cloud'|'hybrid'|'local', approvedTasks[] }` + `getModel()` + `resolveModelForTask()`.
- **جديد:** `config/ai-models.ts` — البيانات (تُثري لا تُقيّد).
- **تعديل:** `ai-config.ts:242 defaultModelFor` يستشير السجلّ ثم **يسقط إلى env كما هو الآن** عند غياب مدخل (سلوك مطابق).
- **اختبار:** `scripts/test-model-registry.ts` — `defaultModelFor` يعيد قيم اليوم لبيئة اليوم؛ السجلّ يضيف بيانات وصفية فقط.
- **تراجع:** revert.

---

## الموجة 2 — كيانات جديدة عالية القيمة

### PR-B1 · `ENGINE` · مركز المراجعة 🟢
**الهدف:** نمذجة `ReviewSession/Finding/Suggestion/ReviewReport` (§12) — جداول جديدة بحتة.

- **Prisma (جداول جديدة، هجرة إضافية):** `ReviewSession`, `Finding`, `Suggestion`, `ReviewReport` + `enum FindingSeverity { INFO LOW MEDIUM HIGH CRITICAL }` + `enum SuggestionStatus { SUGGESTED ACCEPTED REJECTED DEFERRED }`. `Finding { id, sessionId, category, severity, description, evidence Json, confidence, affectedLocation Json, ruleId? }`.
- **جديد:** `lib/modules/review/` — `types.ts`، `review-service.ts` (`createSession`/`addFinding`/`proposeSuggestion`/`decideSuggestion`/`buildReport`)، `repository.ts`.
- **جسر اختياريّ (بلا تغيير سلوك):** محوّل يغذّي `Finding` من `CaseGap`/`ChecklistItem` القائمة في `lib/modules/judicial-assistant/types.ts:100,231` — سطح جديد فقط.
- **اختبار:** `scripts/test-review-center.ts` — دورة `SUGGESTED→ACCEPTED/REJECTED/DEFERRED`، «لا تعديل صامت»، تجميع التقرير.
- **قبول:** لا جدول قائم يُمسّ · الأحداث تُصدَر عبر A1 (إن وُجد).
- **تراجع:** إسقاط الجداول الجديدة.
- **يعتمد على:** A1 (اختياريّ).

### PR-B2 · `ENGINE` · دورة حياة العلاقات 🟡
**الهدف:** `status` صريح للعلاقات المستنتجة (§8).

- **Prisma:** `enum RelationStatus { PROPOSED VERIFIED REJECTED SUPERSEDED }`؛ عمود `status` على `LegalGraphEdge` (`schema.prisma:983`) و/أو `LegalRelation` (`:575`) بقيمة **افتراضية `VERIFIED` + backfill للسجلات القائمة**؛ عمودان اختياريان `evidenceId String?`, `authority Float?`.
- **تعديل:** `lib/modules/knowledge-graph/relations.ts` + `relation-derivation.ts` — الاشتقاق الآليّ يُدرج `status=PROPOSED`؛ اليدويّ/المؤكَّد يبقى `VERIFIED`.
- **اختبار:** `scripts/test-relation-status.ts` + توسيع `npm run qa:relations`.
- **قبول:** السجلات القائمة `VERIFIED` (لا تغيير ترتيب/عرض) · الاشتقاقات الجديدة `PROPOSED`.
- **تحقّق مسبق:** مسح المستهلكين للتأكد أن لا أحد يفلتر على غياب `status` (الافتراضي يحفظ السلوك).
- **تراجع:** إسقاط الأعمدة.

### PR-B3 · `SECURITY` · تصنيف البيانات 🟡
**الهدف:** تصنيف أمنيّ (§21) — **وسمٌ لا حجب** في البداية.

- **Prisma:** `enum DataClass { PUBLIC INTERNAL CONFIDENTIAL RESTRICTED }`؛ عمود **nullable** `dataClass DataClass?` على `CaseFile`/`JudicialWorkCase`/`Attachment`/`Consultation` (null → يُعامَل `INTERNAL` عبر مساعد).
- **جديد:** `lib/modules/security/data-classification.ts` — `classify()`, `clearanceFor()`؛ يُسجَّل `dataClass` في metadata التدقيق. **لا بوابة حجب** أوّلًا حتى لا تتعطّل تدفّقات.
- **اختبار:** `scripts/test-data-classification.ts`.
- **تراجع:** إسقاط الأعمدة + الملف.

---

## الموجة 3 — التعميم والتجميع

### PR-C1 · `ENGINE` · Health Index 🟢
**الهدف:** تجميع الأبعاد الخمسة من الفحوص القائمة، **قراءة فقط** (§13, §23).

- **جديد:** `lib/modules/observability/health-index.ts` — أبعاد Structure/Evidence/Compliance/Security/Delivery (0–100) من إشارات قائمة: `qa:db` (Structure)، معدّل نجاح حارس الاستشهاد (Evidence)، `qa:security` (Security)، `deploy-readiness` (Delivery)، تغطية قواعد الامتثال (Compliance).
- **جديد:** `app/api/health/index/route.ts` — **منفصل** عن `/api/health` القائم (لا يُمسّ).
- **اختبار:** `scripts/test-health-index.ts`.
- **تراجع:** حذف المسار + الملف.

### PR-C2 · `ARCH` · حزمة مجال/مؤسسة 🟡
**الهدف:** تعميم Manifest الوكلاء نحو حزمة كاملة (§16) — تعبيرٌ تعريفيّ عن المجال القانونيّ.

- **جديد:** `packages/schema/{domain-package,institution-package}.schema.json` (تضيف `schema_version`, `permissions`, `dependencies`, `conflicts`, `signatures` الناقصة في سكِيما الوكلاء).
- **جديد:** `packages/legal/domain.package.json` — المجال القانونيّ الحاليّ كحزمة (terminology/entity_types/source_types/workflows).
- **جديد:** `lib/modules/packages/manifest-loader.ts` + `packages/validate.mjs` (على منوال `agents/validate.mjs`).
- **ADR:** `ADR-ARCH-001-package-manifest.md`.
- **اختبار:** `scripts/test-package-manifest.ts`.
- **قبول:** تعريفيّ فقط، لا اقتران تشغيليّ بعد.

---

## الموجة 4 — مؤجَّلة (تمسّ الأساس أو تحتاج مُدخلًا)

### PR-D1 · `ENGINE` · محرك الامتثال المُصدَّق 🔴 (فئة ج)
**محجوب** حتى توفير **مصدر قواعد قانونيّ معتمد**. عندها: استبدال `DEMO_RULES`
(`judicial-assistant/rules/deadline.ts:21`) بقواعد `{ rule_id, source, version, effective_from/to, scope, severity, validation }`، ومحرك `lib/modules/compliance/` **منفصل عن الجودة** (§15). يمرّ عبر مجلس المراجعة (§28).

### PR-D2 · `ARCH` · تقارب Knowledge Object (تدريجيّ) 🔴 (فئة ب)
**لا هجرة كبرى.** بدلًا من توحيد عشرات الجداول: (1) `uri` مشتق عبر مساعد/view؛ (2) اصطلاح `provenance` JSON **للكيانات الجديدة فقط**؛ (3) `contentHash String?` nullable على `JudicialCase`/`JudicialPrinciple` + backfill. يتطلّب ADR. **صراحةً: لا نوحّد كل الجداول.**

### PR-D3 · `ENGINE` · آلة حالة سير العمل §14 🔴 (اختياريّ)
`WorkflowEngine` يملك الانتقالات ببوابات دخول/خروج، يغلّف `SimulationStage` (`schema.prisma:38`) دون تغيير القيم. مخاطرة متوسطة؛ يُنفَّذ بعد B1.

---

## خريطة الاعتماديّات والتسلسل

```text
A1 Event Envelope ─┬─► B1 Review Center ──► (C1 بُعد Evidence/Delivery)
                   └─► (كل الأحداث اللاحقة)
A2 Prompt Registry ─ مستقلّ
A3 Model Registry ── مستقلّ
B2 Relation status ─ مستقلّ
B3 Data class ──────► C1 (بُعد Security)
C2 Package manifest ─ مستقلّ (تعريفيّ)
D1 Compliance ─────── محجوب على مُدخل قانونيّ ─► C1 (بُعد Compliance)
D2 Knowledge Object ─ ADR منفصل
D3 Workflow SM ────── بعد B1
```

**المسار الحرِج المقترح:** A1 → B1 → (A2‖A3‖B2‖B3 بالتوازي) → C1 → C2 → مراجعة D.

## جدول التتبّع

| PR | النوع | الموجة | المخاطرة | Prisma؟ | يعتمد على |
|---|---|---|---|---|---|
| A1 Event Envelope | ENGINE | 1 | 🟢 | أعمدة nullable | — |
| A2 Prompt Registry | ENGINE | 1 | 🟡 golden | لا | — |
| A3 Model Registry | ENGINE | 1 | 🟢 | لا | — |
| B1 Review Center | ENGINE | 2 | 🟢 | جداول جديدة | A1 (اختياريّ) |
| B2 Relation status | ENGINE | 2 | 🟡 backfill | عمود + default | — |
| B3 Data class | SECURITY | 2 | 🟡 | أعمدة nullable | — |
| C1 Health Index | ENGINE | 3 | 🟢 | لا | B3, (D1) |
| C2 Package manifest | ARCH | 3 | 🟡 | لا | — |
| D1 Compliance | ENGINE | 4 | 🔴 مُدخل | جداول | مصدر قانونيّ |
| D2 Knowledge Object | ARCH | 4 | 🔴 | أعمدة nullable | ADR |
| D3 Workflow SM | ENGINE | 4 | 🔴 | لا | B1 |

**كل PR يجتاز §25 قبل الدمج:** `typecheck` · `build` · `qa:security` · اختباره المخصّص + خطة تراجع.
