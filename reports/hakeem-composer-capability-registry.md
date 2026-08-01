# جرد الخدمات وعقودها — Composer Capability Registry

**التاريخ:** 2026-08-01  
**الفرع:** `cursor/composer-capability-registry-da55`  
**بعد دمج:** #592 → #593 → #594 في `main`

## مبدأ

**الربط دون الابتلاع.** كل خدمة تبقى مستقلة؛ السجل يصف الاكتشاف والاستدعاء فقط.

## المكدّس المدموج

| PR | الحالة |
|---|---|
| #592 HakeemComposer | MERGED |
| #593 Source Policy | MERGED |
| #594 Documents/Attachments | MERGED |

## الخدمات المستقلة (لا تُلغى)

| خدمة | مالك | ربط Composer |
|---|---|---|
| Ask / agent-search | ask | مضيف التنفيذ |
| legal-core / hybrid | legal-core | أدوات بحث |
| Attachments + doc-node | attachments / doc-node | `read_attachment` + process |
| Document inspection | document-inspection | دماغ نصي مشترك |
| المعاون القضائي JS-* | judicial-assistant | redirect handoff فقط |
| بوابات JDS | jds-gates | ظل/إنفاذ تدريجي |
| Case analysis bridge | case-analysis | وضع analyze-case |
| Courtroom simulations | simulations | redirect سطح simulation |
| Library | library | تصفح + mentions |
| Conversations | conversations | `conversationId` |
| Citations / verifier | citations | middleware إسناد |

## سجل القدرات

`lib/modules/hakeem-composer/capability-registry.ts` — ≥ 15 قدرة، كلها `independent: true`.

أعلام تدريجية:

- `HAKEEM_COMPOSER_CASE_CONTEXT_V1` (OFF)
- `HAKEEM_COMPOSER_JDS_HANDOFF_V1` (OFF)
- `JDS_DRAFTING_SHADOW` / `JDS_ENFORCE` (قائمة؛ السجل يكتشفها)

## الاستشهاد الموحّد

`unified-citations.ts`: مواد/أحكام/مبادئ + صفحات مرفقات بنفس شكل `UnifiedCitation`.  
لا يدّعي رقم صفحة بلا بنية صفحات.

## ما اختُبر

عقود وحدة للسجل/الاستشهاد/التسليم + اختبارات Composer السابقة.  
اختبار حي شامل: يعتمد على بيئة الجلسة/DB — يُذكر صراحة في تقرير الجولة إن تعذّر HTTP حي.
