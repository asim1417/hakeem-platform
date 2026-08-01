# جولة إغلاق PR #593 — تحصين سياسة المصادر

المرجع: أمر إغلاق PR #593  
الفرع: `cursor/composer-source-policy-da55`  
العلم: `HAKEEM_COMPOSER_SOURCE_POLICY_V2=1`

## 1) المشكلات المكتشفة

| مشكلة | الأثر | المعالجة |
|---|---|---|
| الثقة بـ `body.sourcePolicy` كسياسة نهائية | تصعيد صلاحيات من العميل | `resolveEffectiveSourcePolicy` + `effectivePolicy` فقط للتنفيذ |
| `organizationLibrary: true` من العميل قد يفتح `islamic_library_scan` | تجاوز نطاق | مربوط بـ `allowOrganizationLibrary` (افتراضي false) + رفض مسجّل |
| `normalizeSourcePolicy` يعيد DEFAULT الواسع عند فشل Zod | توسيع صامت للنطاق | فشل مغلق: `400 INVALID_SOURCE_POLICY` أو `RESTRICTED_SOURCE_POLICY` |
| وصف الواجهة «أنظمة فقط» مع `attachments=true` دائمًا | تناقض واجهة/خادم | خيار أ: تسمية «(+ المرفق الحالي إن وُجد)» |
| رد المنسّق عند حظر المكتبة لا يُعرض في الراوت | سقوط إلى «لا سند» بدل رسالة السياسة | فرع `result.reply` مع `mode: source-policy(-fallback)` |
| عدم تمييز `usedFallback` في التدقيق | ضعف رصد | `usedFallback` في الخطوة والتدقيق والنتيجة |

## 2) requestedPolicy مقابل effectivePolicy

```
Client sources / sourcePolicy
  → Validation (strict Zod)
  → strip privileged booleans
  → Server capabilities ∩ case/attachment context
  → effectivePolicy  ← الوحيد المستخدم في tools/orchestrator
```

- **requestedPolicy**: ما طُلب بعد التطبيع (بلا حقول حساسة مفعّلة من العميل).
- **effectivePolicy**: ما سمح به الخادم فعلًا بعد التقاطع مع القدرات.
- **deniedSources**: مصادر/حقول رُفضت مع السبب.

## 3) منع توسيع الصلاحيات من العميل

الحقول `caseFiles` / `organizationLibrary` / `web` لا تُؤخذ من boolean العميل.
`defaultServerCapabilities()` تُبقي مكتبة المؤسسة والويب غير مفعّلين افتراضيًا.
أي محاولة JSON تُسجَّل في `deniedSources` وتبقى `effective.*.=false`.

## 4) السياسة التالفة

الخيار المعتمد: **400 + `INVALID_SOURCE_POLICY`** عند العلم مفعّلًا.
`normalizeSourcePolicy` (Deprecated) → `RESTRICTED` لا DEFAULT.

## 5) قرار المرفقات (خيار أ)

المرفق المرفوع سياق مقروء مع الطلب عندما تسمح السياسة بـ `attachments`.
اختيار `legal-core` = مكتبة أنظمة + المرفق الحالي إن وُجد.
`attached-only` = حصر على المرفق؛ بلا ملف → `SOURCE_POLICY_REQUIRES_ATTACHMENT`.

## 6) مسارات الاسترجاع المحمية

| المسار | الحماية |
|---|---|
| native `executeTool` | `decideToolAccess(effectivePolicy)` |
| `legal_search` / `comprehensive_legal_scan` / `fetch_legal_source` | تتطلب مكتبة/لوائح |
| `deep_legal_study` → `orchestrate` | يمرّر `sourcePolicy` الفعّالة |
| `read_attachment` | يتطلب `attachments` |
| `islamic_library_scan` | يتطلب `web` أو `organizationLibrary` من الخادم فقط |
| orchestrator library search | يُحظر عند انعدام المكتبة/اللوائح |
| orchestrator judgments | مسار أحكام فقط أو تخطّي عند `judgments=false` |
| native → orchestrator fallback | نفس `effectivePolicy` + `usedFallback` |

## 7) نتائج الاختبارات

| أمر | نتيجة |
|---|---|
| `test:source-policy` | 71/71 |
| `test:source-policy-e2e` | 16/16 |
| `test:hakeem-composer` | 40/40 |
| `test:runtime` | 20/20 |
| `test:intent-gate` | 17/17 |
| `tsc --noEmit` | ناجح |
| `lint` | ناجح (تحذيرات قديمة غير متعلقة) |
| `build` | ناجح |

لا يوجد Playwright في المستودع؛ عُوّض بعقد API e2e حتمي (`test:source-policy-e2e`).

## 8) الملفات المعدّلة

- `lib/modules/hakeem-composer/source-policy.ts`
- `lib/modules/hakeem-composer/constants.ts`
- `app/api/ai/agent-search/route.ts`
- `lib/modules/agents/orchestrator.ts`
- `scripts/test-source-policy.ts`
- `scripts/test-source-policy-api-e2e.ts`
- `scripts/test-hakeem-composer.ts`
- `package.json`
- `reports/hakeem-composer-source-policy-closure.md`

## 9) مخاطر متبقية

- اختيار المصادر ما زال يمرّ تلميحًا نصيًا أيضًا عبر `composeAgentQuery` حتى يُزال انتقاليًا بعد استقرار العلم.
- `caseFiles` و`organizationLibrary` و`web` بلا مسار منح إنتاجي بعد — ممنوعة فقط.
- مسار `createConsultationDraft` بعد المنسّق ما زال يعتمد على مواد المنسّق؛ عند حظر المكتبة يُقطع قبلًا عبر `reply`/`isOrchestratorLibraryBlocked`.
- لا اختبار HTTP حي ضد خادم Next في هذه الجولة (عقد قرار حتمي بدلًا منه).

## 10) مؤجّل للمرحلة الثانية

مرفقات/OCR، بحث هجين، استشهادات V2، ملفات قضايا، مكتبة مؤسسة مربوطة، أداة ويب، صوت، ربط صفحات.

**لم يُدمج · لم يُضغط Mark Ready · لم يُنشر.**
