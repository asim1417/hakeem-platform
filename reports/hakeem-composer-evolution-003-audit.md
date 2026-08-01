# تقرير الفحص — HKM-COMPOSER-EVOLUTION-003

تاريخ: 2026-08-01  
المستودع: `asim1417/hakeem-platform`  
PR التأسيسي: [#592](https://github.com/asim1417/hakeem-platform/pull/592) — **مفتوح وغير مدمج**  
الفرع: `cursor/hakeem-composer-da55`

---

## 1) حالة PR 592

| البند | الحالة |
|---|---|
| الدمج | غير مدمج (`OPEN`, `MERGEABLE`) |
| CI | readiness ✅ · Vercel ✅ |
| القرار | يبقى مرحلة تأسيسية للواجهة والعقود |
| الفروع اللاحقة | Stacked فوق `cursor/hakeem-composer-da55` |

**لا يُكرَّر HakeemComposer. لا تُنقل الخدمات الخلفية الضخمة إلى PR 592.**

---

## 2) مسار الطلب الفعلي (تتبع)

```
HakeemComposer (UI)
  → HakeemAskWorkspace.ask()
    → composeAgentQuery(text + sourceHint + contextLabels)   ← تلميح نصي فقط للمصادر
    → POST /api/ai/agent-search
         { query, document, detailed, skipBreadth, mode, conversationId, history }
    → [native] runHakeemAgent → tools.executeTool → legal_search / read_attachment / …
      أو [fallback] orchestrate → search_articles / search_rulings / search_principles
    → NDJSON: job / step / result / clarify / error / done
    → persistAskTurn / appendMessage (جلسات Ask)
```

نقطة الاختناق الصحيحة للتطوير: `/api/ai/agent-search` — **اعتماد + توسيع**، لا استبدال.

---

## 3) مصفوفة القدرات

| القدرة | المسارات | التقنية | الحالة | UI/Server | قرار | السبب |
|---|---|---|---|---|---|---|
| HakeemComposer | `components/hakeem-composer/*` | React RTL | إنتاجي مرحلي | UI | **اعتماد + تطوير عقود** | واجهة مركزية سليمة |
| HakeemAskWorkspace | `components/ask/HakeemAskWorkspace.tsx` | React + NDJSON | إنتاجي | كلاهما | **اعتماد + مواءمة** | غلاف الجلسات/البث |
| GuestAskComposer | `components/home/GuestAskComposer.tsx` | sessionStorage + auth | إنتاجي | UI | **اعتماد** | مسار زائر منفصل |
| agent-search | `app/api/ai/agent-search/route.ts` | NDJSON + jobs | إنتاجي | Server | **تطوير** | لا يقبل sourcePolicy |
| بث NDJSON | Ask workspace + route | ReadableStream | إنتاجي | كلاهما | **اعتماد** | مستقر |
| Abort/إيقاف | Ask workspace | AbortController | إنتاجي | UI→Server | **اعتماد** | إيقاف المستخدم مميّز |
| محرك الجلسات | `lib/modules/conversations/*` | Postgres ChatConversation | إنتاجي | Server | **اعتماد** | لا موازي |
| المسودات | `HOME_ASK_DRAFT_KEY` | sessionStorage | إنتاجي | UI | **اعتماد** | كافٍ مرحليًا |
| intent-router | `lib/modules/hakeem-composer/intent-router.ts` | قواعد + intent-gate | مرحلي | UI | **تطوير** | لا يفرض أدوات/مصادر |
| intent-gate | `lib/modules/agents/intent-gate.ts` | حتمي | إنتاجي | Server+UI | **اعتماد** | يمنع البحث العشوائي |
| AGENT_MODES | `lib/modules/agents/modes.ts` | prompts | إنتاجي | كلاهما | **اعتماد** | زاوية إخراج فقط |
| slash commands | composer + `agents/commands.ts` | parser | جزئي | UI→prompt | **تطوير** | أوامر الوكلاء غير موصولة كاملًا بالتنفيذ |
| mentions | `mentions.ts` | إدراج نص | تجميلي جزئي | UI | **مواءمة** | بلا تحقق صلاحيات |
| SourcesSelector | `sources-selector.tsx` | UI state | **غير مقبول كنص فقط** | UI | **تطوير خادمي** | المرحلة 1 |
| tools-menu | `tools-menu.tsx` | قوالب نص/وضع | UI shortcuts | UI | **Adapter→أدوات حقيقية** | المرحلة 4 |
| extractFile | `doc-tool/extract.ts` | pdfjs/docx/OCR | إنتاجي للمتصفح | UI | **اعتماد + تطوير لاحق** | المرحلة 2 |
| /api/attachments | `app/api/attachments/*` | Azure/SharePoint | جزئي (`extractedText:null`) | Server | **تطوير** | المرحلة 2 |
| OCR | local + cloud Gemini | اختياري | مرحلي | كلاهما | **مواءمة** | تعارض محتمل مع Claude-only للـOCR |
| تخزين الملفات | blob-storage | Azure/SP | إنتاجي للمرفقات العامة | Server | **اعتماد** | Ask لا يستخدمه |
| ربط ملف↔جلسة | MessageAttachmentRef JSON | inline | مرحلي | Server | **Adapter** | ليس FK لـ Attachment |
| بحث نصي | searchLegalCore | Postgres/tsvector | إنتاجي | Server | **اعتماد + تطوير** | المرحلة 3 |
| pgvector/HNSW | Embedding + SQL scripts | vector(1536) | إنتاجي إن طُبّق | Server | **اعتماد** | لا IVFFlat؛ HNSW عبر SQL |
| Rerank | scoring/RRF | حتمي | جزئي | Server | **تطوير** | لا cross-encoder |
| استشهادات | basis items | JSON | جزئي | كلاهما | **تطوير** | تفقد حقولًا عند الحفظ |
| مكتبة/أحكام | legal_articles + hybrid | Postgres | إنتاجي | Server | **اعتماد** | مصدر الحقيقة |
| ملفات قضايا | CaseFile + JA case-search | Prisma | موجود غير موصول بـ Ask | Server | **مواءمة** | المرحلة 6 |
| صوت | VoiceButton Web Speech | ar-SA | MVP | UI | **Adapter** | المرحلة 5 |
| ComposerContextBar | chips | label+id | تجميلي جزئي | UI | **تطوير** | المرحلة 6 |
| RBAC | rbac/ownership | server | إنتاجي للمرفقات/حالات | Server | **اعتماد** | يُمدَّد للمصادر |
| تدقيق AI | auditEvent | موجود لكن غير مستدعى من agent-search | فجوة | Server | **تطوير** | المرحلة 1+ |
| Feature Flags | env + FeatureToggle | مختلط | موجود | كلاهما | **اعتماد نمط** | أعلام HAKEEM_* الجديدة |
| تبعيات | package.json | Next/Prisma/… | صيانة مقبولة | — | **لا إضافة بلا تقييم** | — |

---

## 4) قرارات حاكمة للمسار

### اعتماد فوري
- HakeemComposer واجهة مركزية
- محرك الجلسات conversations
- agent-search كنقطة اختناق
- extractFile للمتصفح
- searchLegalCore للمقالات
- intent-gate

### تطوير إلزامي (مرتّب)
1. **سياسة مصادر خادمية** (هذه المرحلة)
2. مرفقات ومستندات
3. بحث هجين + استشهادات
4. أدوات قانونية حقيقية
5. صوت Adapter
6. سياقات فعلية
7. تحصين أمني E2E

### ممنوع
- استبدال agent-search
- محرك جلسات موازي
- صندوق إدخال بديل
- الاعتماد على تلميحات النص للمصادر

---

## 5) خطة الفروع وPRs (Stacked)

| المرحلة | الفرع | يعتمد على | النطاق |
|---|---|---|---|
| 0 تأسيسي | `cursor/hakeem-composer-da55` | main | واجهة + عقود أساسية (PR 592) |
| 1 مصادر | `cursor/composer-source-policy-da55` | فرع 592 | SourcePolicy خادمي |
| 2 مرفقات | `cursor/composer-documents-da55` | فرع 1 | تحقق/تخزين/استخراج/ربط |
| 3 بحث+استشهاد | `cursor/composer-retrieval-citations-da55` | فرع 2 | hybrid + LegalCitation |
| 4 أدوات | `cursor/composer-tools-da55` | فرع 3 | أدوات حقيقية |
| 5 صوت | `cursor/composer-speech-adapter-da55` | فرع 4 | SpeechToTextProvider |
| 6 سياق | `cursor/composer-context-da55` | فرع 5 | سياق بصلاحيات |
| 7 أمن E2E | `cursor/composer-security-e2e-da55` | فرع 6 | حقن/صلاحيات/Playwright |

كل PR لاحق يعلن اعتماده على PR 592 (وما قبله).

---

## 6) عيوب تأسيسية تُكمَل في PR 592 فقط

1. توحيد عقد `SourcePolicy` في الأنواع (بدون إنفاذ خادمي كامل).
2. إرسال `sources` / `sourcePolicy` في جسم الطلب من العميل (جاهزية للعقد).
3. حفظ اختيار المصادر في `inputSnapshot`.
4. استخدام `sources` داخل intent-router (تلميح توجيه، لا إنفاذ).
5. توثيق أن التلميح النصي انتقالي ويُزال بعد تفعيل العلم.

---

## 7) المرحلة 1 — سياسة المصادر (بعد التأسيس)

العقد:

```ts
type SourcePolicy = {
  legalLibrary: boolean;
  regulations: boolean;
  judgments: boolean;
  caseFiles: boolean;
  attachments: boolean;
  organizationLibrary: boolean;
  web: boolean;
  strictScope: boolean;
};
```

الإنفاذ في:
- `agent-search` parse/validate
- `AgentContext.policy` + deny tools
- `orchestrate` options
- `auditEvent`
- Feature Flag: `HAKEEM_COMPOSER_SOURCE_POLICY_V2`

Rollback: العلم = off → السلوك الحالي (تلميح فقط / افتراضي كامل للنواة).

---

## 8) المخاطر

| خطر | أثر | تخفيف |
|---|---|---|
| تسرّب نتائج semantic خارج systemIds | يكسر strictScope | إعادة تطبيق where على extras |
| Ask inline docs بلا RBAC ملفات | خصوصية | مرحلة 2 Adapter |
| OCR Gemini vs Claude-only | سياسة AI | عزل OCR كمسار وثائق |
| Stacked PRs طويلة | تعارض دمج | أعلام + توافق خلفي |

---

## 9) التبعيات

لا تُضاف مكتبات جديدة في المرحلة 1. الاعتماد على Zod الموجود إن وُجد، أو تحقق يدوي متوافق مع أنماط المشروع.
