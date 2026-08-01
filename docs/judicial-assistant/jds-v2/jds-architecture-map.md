# HKM-JDS-002 — خريطة المعماريّة ومواضع التركيب (Phase A)

> كيف تنتفع **كلّ** خدمةٍ من طبقة JDS دون بناء «مكدّس ثالث» (§33). الطبقة عقودٌ
> مشتركة (`lib/modules/judicial/`) تُركَّب فوق المحرّكات القائمة.

## 1. المكدّسان القائمان + وحدة القضاء

- **المكدّس الأصيل** — `lib/modules/hakeem-agent/` = حلقة أدوات Claude الحقيقيّة (افتراض «اسأل حكيم»).
  - `runHakeemAgent` (`runtime.ts:82`), أدوات `tools.ts`, مهارات `skills.ts` (منها `procedural-roadmap`, `objection-drafting`), نظام `system.ts`.
- **المكدّس الحتميّ (Legacy)** — `agents/orchestrator.ts` ← `case-analysis` ← `legal-agent` ← `judicial-simulation` (خطّ مراحل + احتياطيّ).
- **وحدة القضاء** — `lib/modules/judicial-assistant/` = 24 خدمة، 12 مرحلة، قواعد حتميّة، صياغة، محاضر، تصدير، ABAC. تمرّ اليوم عبر المكدّس الحتميّ لا الأصيل.

## 2. الخدمات المنتِجة (يجب أن تنتفع كلّها)

| الخدمة | الوحدة | المسار |
|---|---|---|
| القاضي التفاعليّ | `lib/modules/simulations/*` (`reasoned-judgment`, `judicial-brain`) | `app/api/simulations/[id]/*` |
| المساعد القضائيّ | `lib/modules/judicial-assistant/*` (`drafting`, `study`, `works`) | `app/api/judicial-assistant/*` |
| المحاكاة القضائيّة (لقطة) | `lib/modules/judicial-simulation/*` | `app/api/judicial-simulation` |
| الوكيل القانونيّ | `lib/modules/legal-agent/*` | `app/api/legal-agent` |
| الاستشارات | `lib/modules/consultations/*` | نمط `consultation` |
| تحليل القضية | `lib/modules/case-analysis/*` | `app/api/case-analysis` |
| الدردشة القانونيّة (شخصيّات قضائيّة) | `lib/modules/legal-chat/*` (JUDGE/ARBITRATOR/…) | `app/api/legal-chat` |
| اسأل حكيم (أنماط) | `lib/modules/agents/modes.ts` (`verdict-estimate`…) | `app/api/ai/agent-search` |
| الوكلاء المعبّؤون | `agents/judge-aide`, `commercial-litigator`, `insolvency-practitioner` | `app/api/mcp/[agentId]` |

## 3. مواضع التركيب (Seams) لطبقة JDS

| اهتمام JDS | العقد/السجلّ (PR1) | يُركَّب على |
|---|---|---|
| تصنيف الدور/المسار/المرحلة (§15) | `characterizeJudicialTask`, `voiceProfileFor` | كلّ نقطة دخولٍ منتِجة قبل التوليد |
| طبقات السلطة (§6) | `JudicialSourceLayer`, `AUTHORITATIVE_LAYERS` | `legal-core` عند الاسترجاع + الاستشهاد |
| النواة اللغويّة (§13) | `BENCH/PARTY_LEXICON`, `ASSERTION_LEVEL_POLICY` | حرّاس الصياغة `grounding/verify-guard.ts`, `legal-chat/response-verifier.ts` |
| بوّابات الجودة (§27) | `JUDICIAL_QUALITY_GATES`, `blockingGatesFor` | ما بعد التوليد في كلّ خدمة (JG9 يلتقي `verifyNarrativeGrounding`) |
| حزم المجال (§8) | `JUDICIAL_DOMAIN_PACKS` | ربط `judicial-playbook-service.ts` + منع النقل بين المسارات |
| وصفة المستند (§16) | `JudicialDocumentRecipe` | يعمّم قوالب `drafting.ts`/`works.ts` القائمة |
| خريطة الإجراءات (§12) | `JudicialProcedureGraph` | يرقّي `catalog.ts STAGE_ACTIONS` + `judicial-procedure-engine.ts` |
| تتبّع العبارة (§22) | `JudicialStatementTrace` | يمتدّ فوق `CaseFact.verification` + `verifyCitations` |

## 4. حرّاس التأريض القائمون (يُعاد استعمالها لا تُكرَّر)

- `lib/modules/grounding/verify-guard.ts` — `verifyNarrativeGrounding`, `collectAllowedArticleNumbers` (5 محرّكات تستعمله). = تجسيدٌ عمليّ لـ JG9.
- `lib/modules/simulations/judicial-brain.ts` — `groundForJudge`, `verifyJudgeGrounding`.
- `lib/modules/legal-chat/response-verifier.ts` — `enforceSingleQuestion`, `finalizeReply`.
- `lib/modules/legal-core/legal-retrieval.ts` — `searchLegalCore` (هجين HNSW + معجميّ، مؤصَّل ومستشهَد).

## 5. قرار معماريّ حاسم
JDS **ليست خدمةً جديدة**، بل عقودٌ مشتركة + (في PRs لاحقة) محرّكاتٌ رفيعة تُستدعى من
المنتِجين القائمين. هذا يمنع «المكدّس الثالث» الذي حذّر منه فحص المعماريّة، ويحقّق شرط
المستخدم: «أيّ خدمة مستفيدة من هذا الأمر».
