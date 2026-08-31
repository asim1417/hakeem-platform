# جرد الخدمات وعقودها — Composer Capability Registry

**التاريخ:** 2026-08-01  
**الفرع:** `cursor/composer-capability-registry-da55`  
**بعد دمج:** #592 → #593 → #594 في `main` (+ مزامنة #598 محرّكات JDS)

## مبدأ

**الربط دون الابتلاع.** كل خدمة تبقى مستقلة؛ السجل يصف الاكتشاف والاستدعاء فقط.

## المكدّس المدموج

| PR | الحالة |
|---|---|
| #592 HakeemComposer | MERGED |
| #593 Source Policy | MERGED |
| #594 Documents/Attachments | MERGED |
| #598 JDS engines §18–25 | على `main` — مُسجَّل في السجل بأعلام تدريجية |

## الخدمات المستقلة (لا تُلغى)

| خدمة | مالك | ربط Composer |
|---|---|---|
| Ask / agent-search | ask | مضيف التنفيذ |
| legal-core / hybrid | legal-core | أدوات بحث |
| Attachments + doc-node | attachments / doc-node | `read_attachment` + process |
| Document inspection | document-inspection | دماغ نصي مشترك |
| المعاون القضائي JS-* | judicial-assistant | redirect handoff فقط |
| بوابات/محرّكات JDS | jds-gates | ظل/إنفاذ + محاضر/اعتراضات/تتبّع/وكيل دائم |
| Case analysis bridge | case-analysis | وضع analyze-case |
| Courtroom simulations | simulations | redirect سطح simulation |
| Library | library | تصفح + mentions |
| Conversations | conversations | `conversationId` |
| Citations / verifier | citations | middleware إسناد |

## سجل القدرات

`lib/modules/hakeem-composer/capability-registry.ts` — ≥ 20 قدرة، كلها `independent: true`.

أعلام تدريجية:

- `HAKEEM_COMPOSER_CASE_CONTEXT_V1` (OFF)
- `HAKEEM_COMPOSER_JDS_HANDOFF_V1` (OFF)
- `JDS_DRAFTING_SHADOW` / `JDS_ENFORCE`
- `JDS_RECORD_V2` / `JDS_OBJECTION_ROUTES_V2` / `JDS_REASONING_V2` / `JDS_PROCEDURE_V2` / `JDS_BACKGROUND_AGENT_V2`

## الاستشهاد الموحّد

`unified-citations.ts`: مواد/أحكام/مبادئ + صفحات مرفقات بنفس شكل `UnifiedCitation`.  
لا يدّعي رقم صفحة بلا بنية صفحات.

## واجهة التسليم

عند بث خطوة `jds-handoff` من `agent-search`، يعرض Ask رابطًا وسياقًا مقترحًا (خدمات JS يدويًا) — **بلا تنفيذ تلقائي**.

## ما اختُبر

- عقود وحدة للسجل/الاستشهاد/التسليم + اختبارات Composer السابقة.
- اختبار حي HTTP/جلسة مصادقة: غير متاح في بيئة الوكيل السحابي هذه؛ العقود + البناء هي بوابة الدمج.
