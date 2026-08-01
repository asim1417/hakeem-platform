# حالة تنفيذ مواءمة المخطط السيادي

تتبّع ما نُفِّذ فعليًّا من [خطة التنفيذ](./BLUEPRINT_EXECUTION_PLAN.md). كل البنود أدناه
**غير كاسرة**، مربوطة هيكليًّا بالموقع، وتجتاز `typecheck` + `build` + اختبارها.

## ✅ منفَّذ (الموجات 1–3، غير الكاسرة)

| البند | الحالة | الربط بالموقع | Prisma |
|---|---|---|---|
| **A1** Event Envelope (§6) | ✅ | `middleware` يحقن `x-correlation-id` لكل طلب؛ `auditEvent` يسجّله (fail-open) | أعمدة nullable على `audit_logs` |
| **A2** Prompt Registry (§17) | ✅ | كتالوج حوكمة يُعرَض في `/admin/governance` | — |
| **A3** Model Registry (§17) | ✅ | `defaultModelFor` يستشيره؛ يُعرَض في `/admin/governance` | — |
| **B1** مركز المراجعة (§12) | ✅ | مسار `/dashboard/review` + عنصر تنقّل + صلاحية `REVIEW_USE` + 4 مسارات API | 4 جداول جديدة |
| **B2** دورة حياة العلاقات (§8) | ✅ | الاشتقاق الآليّ يكتب `PROPOSED`؛ يظهر في مؤشّر الامتثال | عمود `status` (افتراضي VERIFIED) |
| **B3** تصنيف البيانات (§21) | ✅ | مساعد + عرض في `/admin/governance` (وسمٌ لا حجب) | عمود `data_class` nullable |
| **C1** Health Index (§13/§23) | ✅ | `GET /api/health/index` + لوحة `/admin/governance` | — |
| **C2** حزمة المجال (§16) | ✅ | حزمة قانونيّة + مُحمِّل + `packages:validate` + عرض بالأدمن | — |

**نقطة دخول موحّدة:** `/admin/governance` (صلاحية `GOVERNANCE_AUDIT_VIEW`) تجمع C1 + A2 + A3 + C2 + B3.
**مركز المراجعة للمستخدم:** `/dashboard/review` (صلاحية `REVIEW_USE`).

## ⏸️ لم يُنفَّذ (يتطلّب موافقة/مُدخلًا — لم يُلمس)

| البند | السبب |
|---|---|
| **D1** محرك الامتثال المُصدَّق (§15) | يحتاج مصدر قواعد قانونيّ معتمد (فئة ج) |
| **D2** توحيد Knowledge Object (§7) | يمسّ الأساس المُجمَّد — يتطلّب ADR + موافقتك (فئة ب) |
| **D3** آلة حالة سير العمل (§14) | يمسّ منطق المحاكاة القائم — يتطلّب موافقتك |
| Command/Query Bus كامل (§6) | عائد ضعيف/مخاطرة عالية — A1 يكفي |

## ⚠️ خطوة تشغيليّة إلزاميّة قبل/مع النشر

بعض الأعمدة أُضيفت إلى جداول **تُقرأ كثيرًا** (`audit_logs`، `legal_relations`،
`legal_graph_edges`، `cases`، `attachments`، `consultations`، `judicial_work_cases`).
عميل Prisma سيُدرج هذه الأعمدة في استعلامات القراءة، لذا **يجب تطبيق الهجرات على قاعدة
الإنتاج مع نشر هذا الكود أو قبله** (نفس نمط كل تغييرات المخطط في هذا المستودع).

خياران:

```bash
# (أ) الأسهل — مزامنة المخطط كاملًا (نمط README):
npm run db:push

# (ب) تطبيق ملفّات الهجرة صراحةً (idempotent، IF NOT EXISTS):
psql "$DATABASE_URL" -f prisma/migrations/20260801100000_event_envelope_audit/migration.sql
psql "$DATABASE_URL" -f prisma/migrations/20260801101000_relation_status_lifecycle/migration.sql
psql "$DATABASE_URL" -f prisma/migrations/20260801102000_data_classification/migration.sql
psql "$DATABASE_URL" -f prisma/migrations/20260801103000_review_center/migration.sql
```

أو شغّل workflow **«Apply Blueprint Migrations (Neon)»** (`workflow_dispatch` بتأكيد APPLY).

**سلامة النافذة الزمنية:** `auditEvent` مكتوبٌ fail-open (يتراجع للكتابة دون أعمدة المغلّف)،
وصفحات مركز المراجعة تلتقط الأخطاء (تعرض «قيد التهيئة») — لكن قراءات `legal_relations`
و`cases`/`attachments`/`consultations` تعتمد على تطبيق الهجرة. طبّق الهجرات أوّلًا.

## الاختبارات المضافة

```
npm run test:event-envelope
npm run test:model-registry
npm run test:prompt-registry
npm run test:data-classification
npm run test:review-center
npm run packages:validate
```
