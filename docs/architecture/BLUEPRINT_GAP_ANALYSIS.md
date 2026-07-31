# تحليل الفجوة — المخطط السيادي الشامل ↔ واقع منصّة حكيم

مطابقة [المخطط السيادي الشامل](./UNIVERSAL_PLATFORM_BLUEPRINT.md) ببنية مستودع حكيم الفعلية،
بمسارات ملفات حقيقية. الحالة: ✅ موجود · 🟡 جزئيّ · ⬜ فجوة.

> **منهج التقييم:** جرد استكشافيّ آليّ لكامل `lib/modules`, `lib/agent-runtime`,
> `prisma/schema.prisma` (1108 سطرًا), `agents/`, `services/`, `.github/workflows` (76 ملفًا),
> و`scripts/`. كل بند مسنودٌ بمسار. التاريخ: 2026-07-31.

## 0. الخلاصة التنفيذية

منصّة حكيم **ليست مشروعًا جديدًا يُبنى على المخطط**، بل منصّة ناضجة (589 PR) تحقّق **معظم النواة
المعرفية والحوكمة القائمة على الدليل** فعليًّا، وتتفوّق في طبقتين يعتبرهما المخطط الأصعب:
**الحوكمة/التأصيل (Evidence-First)** و**نموذج البيانات القانوني المُصدَّق**. الفجوات الحقيقية ليست في
القدرات، بل في **الأسطح العامة الموحّدة (contracts/registries/envelopes)** التي يطلبها المخطط
لتعميم المنصّة على مجالات ومؤسسات متعددة.

| الطبقة | التغطية | الحكم |
|---|---|---|
| L0 التخزين/الأمن | ✅ قويّة | مصدر حقيقة واضح، pgvector، هجرات، SSRF/أسرار محكمة |
| L1 النواة (Command/Query/Event Bus) | ⬜ غائبة كبنية | دوال مباشرة + تدقيق append-only بديلًا عن Event Bus |
| L2 سير العمل والبوابات | 🟡 جزئيّة | مراحل مُعدَّدة، لا آلة حالة رسمية ببوابات دخول/خروج |
| L3 المعرفة/البحث/الرسم | ✅/🟡 | بحث هجين + رسم معرفيّ قويّ؛ نموذج المعرفة غير موحَّد |
| L4 المراجعة/الامتثال/المستندات | 🟡 | حراس التأصيل ممتازون؛ لا مركز مراجعة ولا محرك امتثال مُصدَّق |
| L5 البنية التحتية للـ AI | 🟡 | بوابة + وكلاء موجودة؛ لا Model/Prompt Registry |
| L6 الحزم والسوق | 🟡 | Manifest للوكلاء فقط؛ لا حزمة مجال/مؤسسة عامة |
| L7 التطبيقات ومساحات العمل | 🟡 | مساحات عمل غنيّة لكنها ليست إطارًا موحّدًا |

**القرار:** لا إعادة هيكلة (المخطط §32 يحرّمها قبل نقطة استرداد، و§29 يفرض تجميد الأساس).
تُعالَج الفجوات كـ **PRs عقود إضافية غير كاسرة** بالترتيب المقترح في §الأولويات أدناه.

---

## 1. النواة التشغيلية (المخطط §6)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| Command Bus (أوامر تغيير صريحة) | دوال `async` مُصدَّرة تُستدعى مباشرة من `app/api/*` | ⬜ | `lib/modules/*` |
| Query Bus (عقود قراءة موحّدة) | قراءات Prisma مباشرة؛ العقد الوحيد هو استراتيجية البحث | ⬜ (🟡 للبحث) | `lib/modules/legal-search/providers/search-provider.ts:26` |
| Event Bus + Envelope (`correlation_id`/`causation_id`/`schema_version`) | لا Pub/Sub؛ سجلّ تدقيق append-only فقط | ⬜ | `AuditEvent` `prisma/schema.prisma:507` · `lib/modules/audit/audit.ts:4` |
| السياق (مستخدم/مؤسسة/مشروع/مرحلة/لغة/خصوصية) | جلسة + RBAC؛ لا كائن سياق موحّد | 🟡 | `lib/modules/auth/session.ts` |

**التحليل:** غياب Command/Query/Event Bus **ليس عيبًا وظيفيًّا** — الوحدات معزولة منطقيًّا. لكنه يمنع
«حزمة مجال جديدة دون إعادة هندسة» (§1). أرخص خطوة غير كاسرة: **Event Envelope موحّد** يغلّف
`auditEvent` الحالي بـ `correlationId/causationId/schemaVersion` دون تغيير المستدعين.

## 2. نموذج المعرفة الموحّد والهوية السيادية (§7)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| Knowledge Object موحّد (`uri/schema_version/entity_version/content_hash/provenance/rights/history`) | جداول متخصّصة منفصلة؛ الحقول متناثرة | ⬜ | `LegalArticle:129`, `JudicialCase:216`, `JudicialPrinciple:272` |
| Sovereign URI (`platform://…`) | معرّف ELI ثابت للمواد فقط (`eli/sa/{law}/art/{n}`) | 🟡 | `lib/modules/legal-core/eli.ts:62` · `LegalSystem.eliSlug:118` |
| طبقات المحتوى (source/canonical/normalized/display) | حقل `content` واحد؛ فصل الفقه/النظاميّ للتصنيف لا للتمثيل | ⬜ | `LegalArticle.content:137` · `legal-core/content-separation.ts` |
| Provenance | الأقوى على المرفقات (sha256/engine/confidence/version) | 🟡 | `Attachment:338-368` · `JudicialCase.source:235` |
| content_hash / version / history على الكيانات الأساسية | على `Embedding` فقط؛ نسخ المواد في جداول مساعدة | 🟡 | `Embedding.contentHash:601` · `ArticleVersion:196` · `ArticleAmendment:168` |

**التحليل:** حكيم يملك **أقوى من المطلوب** في نسخ المواد (Akoma-Ntoso: Work/Expression, one-current)
والـ provenance للمرفقات، لكنها **غير معمّمة** ككائن معرفة واحد. توحيدها كامل الآن **كاسر** (يمسّ عشرات
الجداول). البديل غير الكاسر: **حقل `uri` مشتق (view/generated)** + توحيد `provenance` تدريجيًّا للكيانات الجديدة.

## 3. محرك العلاقات والرسم المعرفي (§8)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| علاقة بـ `status` (proposed/verified/rejected/superseded) + `authority` + `evidence_id` | تنفيذان متوازيان؛ يملكان confidence/evidence/source لكن بلا `status` lifecycle | 🟡 | `LegalRelation:575` (enum `RelationType:562`) · `LegalGraphEdge:983` (`RelationSource:957`, `verifiedBy`) |
| أنواع العلاقات (بنيوية/مرجعية/تحليلية/دلالية) | مغطّاة جزئيًّا (SUPPORTS/CONTRADICTS/INTERPRETS/IMPLEMENTS/AMENDS…) | 🟡 | `lib/modules/knowledge-graph/relations.ts` · `lib/legal-graph.ts` |

**التحليل:** الأقرب للمخطط هو `LegalGraphEdge` (confidence + evidence + source + verifiedBy). الفجوة
الوحيدة الجوهرية: **دورة حياة `status` صريحة** («المستنتج آليًّا يبدأ proposed»). إضافة عمود `status`
بقيمة افتراضية `verified` للسجلات القائمة = **غير كاسر**.

## 4. المصادر والموصلات (§9)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| عقد `SourceAdapter` موحّد (discover/fetchMetadata/fetchManifest/fetchText/fetchPages/fetchUpdates/resolveRights/verifyIntegrity) | عقد ضيّق (canHandle/inspect/download) + sha256؛ `DIRECT_URL` فقط | 🟡 | `lib/modules/documents/connectors/types.ts:29` · `registry.ts` · `direct-url.ts` |
| سلسلة الاستيراد (Staging→Validation→Normalization→Dedup→Indices) | سكربتات استيراد أحادية (لا عقد موحّد) | 🟡 | `scripts/import-{judgments,hoqoqi,fiqh,moj}-*.ts` · `lib/modules/turath/turath-client.ts` |

## 5. البحث والاسترجاع (§10)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| لفظي (BM25) | موجود | ✅ | `scripts/build-bm25-index.ts` · `test-bm25.ts` |
| دلالي (pgvector + ربط بإصدار النموذج) | موجود | ✅ | `Embedding.embedding:599` · `backfill-embeddings*.ts` |
| هجين (دمج مُفسَّر) + مزودون قابلون للاستبدال | استراتيجية مزوّد (postgres/vector/knowledge_graph/opensearch) | ✅ | `lib/modules/legal-search/providers/search-provider.ts:26` |

**التحليل:** هذه الطبقة **تحقّق المخطط بالكامل تقريبًا**، بل تتجاوزه (OpenSearch جاهز، تقييمات CI).

## 6. محرك المستندات (§11)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| عقد `DocumentProvider` (inspect/importStructure/renderPreview/applyOperations/validate/export) | القدرات موزّعة، لا واجهة واحدة | 🟡 | `services/doc-node/engines.ts:14` · `lib/modules/document-inspection/*` · `lib/modules/doc-tool/*` · `lib/answer-docx.ts` |
| OCR متعدد المحرّكات مع fallback | موجود (local/gemini/qari) | ✅ | `services/doc-node/engines.ts:187` |

## 7. مركز المراجعة (§12)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| ReviewSession / Finding(`id/category/severity/evidence/confidence/rule_id`) / Suggestion(`suggested→accepted→rejected→deferred`) / ReviewReport | غير مُنمذَج ككيانات؛ قطع مجاورة فقط (`CaseGap.severity`, `ChecklistItem.outcome`, `ruleId` في القواعد) | ⬜ | مجاور: `lib/modules/judicial-assistant/types.ts:100,231` · `rules/deadline.ts:77` |

**التحليل:** «لا تعديل صامت» و«human-in-the-loop» مطبَّقان سلوكيًّا (لافتات مسودّة، وسم اقتراح) لكن
**بلا نموذج Finding/Suggestion**. هذه من أعلى الفجوات قيمةً وأقلّها خطرًا (كيانات جديدة بحتة).

## 8. الحوكمة التنفيذية وحراس التأصيل (§13, §17-الحوكمة)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| Evidence-First (لا ادعاء بلا استشهاد) | حراس صلبة: grounding/scope/enforcement/noFabrication/stance | ✅ | `lib/agent-runtime/enforcement/{enforce,guards}.ts` |
| منع المادة الملغاة / اختلاق المصدر | مطبَّق | ✅ | `lib/modules/grounding/verify-guard.ts` · `legal-chat/anti-hallucination.ts` |
| «النموذج يقترح والكود يقرّر» + بوابات سياسة | مطبَّق حتميًّا | ✅ | `lib/modules/legal-chat/policy-gate.ts` · `response-verifier.ts` |
| تسجيل قرارات الحراس | جدول `GuardrailDecision` | ✅ | `prisma/schema.prisma:495` · `lib/modules/audit/audit.ts:24` |

**التحليل:** **هذه أقوى طبقات المنصّة، وتتجاوز المخطط.** لا تُلمس.

## 9. سير العمل وبوابات الجودة (§14, §13-Gates)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| آلة حالة رسمية (Created→…→Archived) ببوابات دخول/خروج | مراحل مُعدَّدة (enums/strings) بلا آلة مُنفَّذة | 🟡 | `SimulationStage:38` · `judicial-assistant/types.ts:15` · `legal-chat/workflows.ts` |
| «لا محرك يغيّر الحالة مباشرة» | القاعدة غير مُنفَّذة صراحةً | ⬜ | — |
| بوابات بين المراحل | متناثرة (`reviewRequired`, `evaluateReportGate`) لا منهجية | 🟡 | `policy-gate.ts:49` |

## 10. محرك الامتثال المنفصل عن الجودة (§15)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| محرك امتثال بقواعد `rule_id/source/version/effective_from-to/scope/severity` | قواعد تجريبية غير مُصدَّقة (موسومة «غير معتمدة») بلا نسخ/سريان | ⬜ | `lib/modules/judicial-assistant/rules/deadline.ts:21` (`DEMO_RULES`) |
| فصل الامتثال عن الجودة | غير مُنمذَج كمحرّكين | ⬜ | — |

## 11. البنية التحتية للذكاء الاصطناعي (§17)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| AI Provider Gateway (نقطة اختناق واحدة) | بوابة + تجريد مزوّد، لكن `fetch()` مكرّر في 3 مواضع | 🟡 | `lib/modules/ai/ai-gateway.ts` · `ai-config.ts:319` · `ai-provider.ts` |
| Model Registry (نموذج/إصدار/قدرات/نافذة/تكلفة/خصوصية/مهام) | لا سجلّ؛ `defaultModelFor` + env فقط | ⬜ | `lib/modules/ai/ai-config.ts:242` |
| Agent Registry (مهمة/صلاحيات/أدوات/مصادر/برومبت/موافقة/فشل) | Manifests للوكلاء (سكِيما + مدقّق)، لكن بلا `permissions/sources/prompt/failurePolicy` | 🟡 | `agents/*/manifest.json` · `lib/agent-runtime/live/manifests.ts:40` |
| Prompt Registry (برومبت خارج الكود بإصدار/مالك/اختبارات) | برومبتات inline في TS | ⬜ | `lib/modules/ai/legal-prompts.ts` · `*/…-prompts.ts` |
| أوضاع خصوصية (Cloud/Hybrid/Local) + PDPL redaction | Redaction قويّ (FULL/PARTIAL/NONE)؛ لا مُحدِّد أوضاع ثلاثيّ | 🟡 | `lib/modules/legal-chat/redaction.ts:61` (مطبَّق `ai-gateway.ts:81`) |
| تسجيل التكلفة (استدعاءات/رموز/زمن/تكلفة/مشروع/مستخدم/وكيل) | رموز فقط، Anthropic فقط؛ لا زمن/تكلفة/وكيل | 🟡 | `lib/modules/billing/ai-usage-meter.ts` |

## 12. مساحات العمل والتصميم (§18, §19)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| Workspaces تحفظ حالتها | مساحات غنيّة (Ask بجلسات، Chat، Training) لكنها ليست إطارًا موحّدًا بتصنيف Reading/Evidence/Comparison | 🟡 | `components/ask/*`, `components/legal-chat/LegalChatWorkspace.tsx`, `lib/modules/doc-platform/workspace.ts` |
| Command-First (شريط أوامر موحّد ⌘K) | Slash-commands حتميّة + autocomplete؛ لا palette عامّة | 🟡 | `lib/modules/agents/commands.ts` · `components/SearchAutocomplete.tsx` |
| Design Tokens + شبكة 8pt + RTL أصلي | موجودة بالكامل | ✅ | `tailwind.config.ts` · `app/globals.css` (`--space-1..8`) · `app/identity.css` |
| الوصول (WCAG/لوحة مفاتيح/قارئ شاشة) | مُدقَّق جزئيًّا (نطاق المستندات) | 🟡 | `docs/wcag-audit.md` · `SearchAutocomplete.tsx` |

## 13. الأدوار والأمن والبيانات (§20, §21, §22)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| RBAC | قويّ (خريطة ثابتة + تجاوز DB) | ✅ | `lib/modules/auth/{role-permissions,rbac}.ts` |
| ABAC (نطاق: مؤسسة/مساحة/مشروع/حقل) | ad-hoc (ownerId/confidentiality) لا محرّك سياسة | 🟡 | `lib/modules/auth/ownership.ts` |
| أسرار خارج الواجهة / لا `NEXT_PUBLIC_*` للـ AI | مطبَّق ومُوثَّق ومفحوص | ✅ | `.env.example:32` · `scripts/qa-security.ts` |
| SSRF / Path-Traversal / فحص الملفات | محكم جدًّا | ✅ | `lib/modules/documents/url-security.ts` |
| تصنيف بيانات (Public/Internal/Confidential/Restricted) | غائب كنظام أمنيّ (الموجود تصنيف قانونيّ للمحتوى) | ⬜ | `JudicialWorkCase.confidentiality:1098` (نصّ حرّ) |
| مصدر حقيقة vs مشتقّ + hash/version + pgvector | قائم وواضح | ✅ | `prisma/schema.prisma:9` · migrations |

## 14. المراقبة والحوكمة الهندسية والإصدار (§23–§28)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| Health/Readiness مُجمَّع | `/api/health` (DB + تكاملات) | 🟡 | `app/api/health/route.ts` · `services/doc-node/server.ts:50` `/healthz` |
| Metrics / Tracing / Correlation IDs | غائبة (لا OpenTelemetry؛ `requestId` على الحراس فقط) | ⬜ | `GuardrailDecision.requestId:498` |
| Health Index متعدّد الأبعاد (Structure/Evidence/Compliance/Security/Delivery) | غائب كمؤشّر؛ go/no-go يدويّ | ⬜ | `audit/reports/12-go-no-go.md` |
| بوابة إصدار CI | typecheck→build→qa:security→qa:citations | 🟡 | `.github/workflows/deploy-readiness-check.yml` |
| تصنيف PR (ARCH/ENGINE/FEATURE/…) + قالب | غائب (لا template/CODEOWNERS) | ⬜ | `.github/` (workflows فقط) |
| بطاقة هوية المحرك | موجودة كـ **Manifest للوكلاء** لا كـ engine card عامّ | 🟡 | `agents/schema/agent-manifest.schema.json` |
| ADRs / مجلس مراجعة | 3 ADRs (نطاق المعاون القضائي فقط) | 🟡 | `docs/judicial-assistant/adr/*` |
| SemVer + مصفوفة توافق + سياسة إهمال | SemVer للـ manifests فقط؛ لا مصفوفة/إهمال | 🟡 | `agents/CHANGELOG-v2.1.md` |
| تصدير كامل للبيانات (§33) | تصديرات مُنطاقة؛ لا «صدِّر كل بياناتي» | 🟡 | `app/api/*/export` · `lib/modules/exports/*` |
| OpenAPI للخدمة الخارجية | OpenAPI 3.1 مكتوب | ✅ | `lib/openapi/spec.ts` · `app/api-docs/page.tsx` |

## 15. الحزم (§16)

| المتطلب | الواقع | الحالة | المسار |
|---|---|---|---|
| Domain Package + Manifest (deps/conflicts/signatures/permissions/schema_version) | Manifest للوكلاء فقط؛ ناقص الحقول | 🟡 | `agents/schema/agent-manifest.schema.json` |
| Institution Package (أدوار/سياسات/قوالب/احتفاظ) | غائبة | ⬜ | — |
| أولوية القواعد (رسميّ>مؤسسة>قسم>مجال>افتراضي) + تسجيل السبب | غائبة كمُحلِّل؛ primitives فقط | ⬜ | `agents/substrate/{enforcement,normative}.ts` |

---

## الأولويات — PRs غير كاسرة (بترتيب العائد/المخاطرة)

يلتزم كل بند بـ§29 (تجميد الأساس) و§32 (لا إعادة هيكلة): **إضافة عقود/كيانات جديدة، لا تعديل القائم.**

| # | العقد المقترح | لماذا الآن | كسر؟ | المخطط |
|---|---|---|---|---|
| P1 | **Event Envelope** يغلّف `auditEvent` بـ `correlationId/causationId/schemaVersion` (اختيارية) | يفتح Observability والتتبّع دون لمس المستدعين | لا (حقول اختيارية) | §6, §23 |
| P2 | **Review Center** (نماذج `Finding`/`Suggestion`/`ReviewReport` جديدة + أنواع) | أعلى قيمة/أقلّ خطر؛ كيانات جديدة بحتة | لا | §12 |
| P3 | **Prompt Registry** (نقل البرومبتات إلى `lib/modules/ai/prompts/*` بمعرّف/إصدار) | يزيل brittleness ويُمكّن الاختبار | لا (إعادة تصدير) | §17 |
| P4 | **Model Registry** (جدول/ملف قدرات النماذج) يقرأه `defaultModelFor` | حوكمة تكلفة/خصوصية/مهام | لا | §17 |
| P5 | **`status` lifecycle** على `LegalGraphEdge`/`LegalRelation` (افتراضي `verified`) | يطابق §8 دون كسر البيانات | لا (default) | §8 |
| P6 | **تصنيف البيانات الأمنيّ** (enum `DataClass` + عمود اختياريّ) | متطلّب PDPL مؤسسيّ | لا | §21 |
| P7 | **Health Index** (تجميع الأبعاد الخمسة من الفحوص القائمة) | يحوّل go/no-go اليدويّ إلى مؤشّر | لا (قراءة فقط) | §13, §23 |
| P8 | **Domain/Institution Package Manifest** (توسيع سكِيما الوكلاء) | يعمّم المنصّة على مجالات أخرى | لا | §16 |
| P9 | **محرك امتثال مُصدَّق** (استبدال `DEMO_RULES` بقواعد بنسخ/سريان) | يفصل الامتثال عن الجودة | يحتاج مراجعة قانونية | §15 |

## ما أُنجز في هذا الـ PR (DOCS، غير كاسر)

1. إيداع [`UNIVERSAL_PLATFORM_BLUEPRINT.md`](./UNIVERSAL_PLATFORM_BLUEPRINT.md) كمرجع معماريّ.
2. هذا التحليل.
3. [`adr/ADR-ARCH-000-adopt-universal-blueprint.md`](./adr/ADR-ARCH-000-adopt-universal-blueprint.md) — قرار التبنّي + Foundation Freeze.
4. `.github/pull_request_template.md` — تفعيل تصنيف PR (§24) بحقل نوع إلزاميّ + خطة تراجع.

**لم يُلمس أيّ كود تشغيليّ، ولا Prisma، ولا CI، ولا سلوك.**
