# فهرس العمل المفتوح — لقطة 17 أكتوبر 2026

[العودة إلى سجل حكيم](../../../docs/PROJECT_STATUS.md)

فُحصت قائمة GitHub كاملة وقت الالتقاط: **31 طلب دمج مفتوحًا و1 مشكلة مفتوحة** قبل إضافة طلب السجل نفسه. كانت هناك **368 فرعًا**، ولم تُراجع فروق كل الفروع. تفاصيل SHA والتوقيت في [baseline.json](baseline.json).

الطلبات المفتوحة ليست دليلًا على غياب العمل عن الإنتاج؛ بعض الأوصاف تسجل تطبيق بيانات يدويًا أو تنفيذًا موازيًا. الربط بالمهام أدناه لتنظيم المراجعة، وليس تعيين مسؤول حالي أو حكمًا بصلاحية الدمج. الحالة والقيود المذكورة في أوصاف قديمة تحتاج تحققًا حديثًا قبل اتخاذ قرار.

| الطلب | العنوان | الوضع عند الالتقاط | فرع العمل → الهدف | مهام السجل |
|---|---|---|---|---|
| [#720](https://github.com/asim1417/hakeem-platform/pull/720) | docs(legal): محضر مواءمة حقن الهيئة مع القاعدة القائمة | مسودة مفتوحة | `cursor/injection-alignment-record-28d4` → `cursor/setup-cloud-agent-environment-28d4` | [HKM-003](../../../docs/PROJECT_STATUS.md#hkm-003)، [HKM-004](../../../docs/PROJECT_STATUS.md#hkm-004)، [HKM-008](../../../docs/PROJECT_STATUS.md#hkm-008)، [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#704](https://github.com/asim1417/hakeem-platform/pull/704) | fix(rulings): حجب أرقام الهوية والجوال المتبقية في فهرس search_norm (هندية ولاتينية) | مفتوح للمراجعة | `claude/rulings-search-norm-redact` → `main` | [HKM-012](../../../docs/PROJECT_STATUS.md#hkm-012) |
| [#703](https://github.com/asim1417/hakeem-platform/pull/703) | audit(rulings): phase A read-only audit tooling + code-level diagnosis report | مفتوح للمراجعة | `aman/rulings-research-layer` → `main` | [HKM-012](../../../docs/PROJECT_STATUS.md#hkm-012) |
| [#702](https://github.com/asim1417/hakeem-platform/pull/702) | مقارنة قاعدة الموقع بحزمة الهيئة ومشروع المواءمة | مسودة مفتوحة | `cursor/boe-hakeem-alignment-28d4` → `claude/search-surface-wave1-law-card` | [HKM-003](../../../docs/PROJECT_STATUS.md#hkm-003)، [HKM-008](../../../docs/PROJECT_STATUS.md#hkm-008)، [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#685](https://github.com/asim1417/hakeem-platform/pull/685) | الموجة ١: وجه البحث الساري وبطاقة النظام ونص النظام | مسودة مفتوحة | `claude/search-surface-wave1-law-card` → `main` | [HKM-002](../../../docs/PROJECT_STATUS.md#hkm-002)، [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#671](https://github.com/asim1417/hakeem-platform/pull/671) | تقرير تشخيص البحث الصرفي والمتجهي | مسودة مفتوحة | `cursor/search-diagnostic-report-f1d4` → `main` | [HKM-002](../../../docs/PROJECT_STATUS.md#hkm-002)، [HKM-011](../../../docs/PROJECT_STATUS.md#hkm-011) |
| [#666](https://github.com/asim1417/hakeem-platform/pull/666) | ستة أنظمة بقرار المالك، وحُقنت الإضافة على الإنتاج | مسودة مفتوحة | `cursor/owner-approved-laws-28d4` → `main` | [HKM-002](../../../docs/PROJECT_STATUS.md#hkm-002)، [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#664](https://github.com/asim1417/hakeem-platform/pull/664) | توجيه السجلات المخلوطة إلى عملين مستقلين حسب التاريخ (فرع تجريبي) | مسودة مفتوحة | `cursor/split-mixed-records-28d4` → `main` | [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#662](https://github.com/asim1417/hakeem-platform/pull/662) | Judgment display sanitize + search_norm morph FTS | مسودة مفتوحة | `cursor/judgment-text-sanitize-dryrun-9926` → `main` | [HKM-012](../../../docs/PROJECT_STATUS.md#hkm-012) |
| [#652](https://github.com/asim1417/hakeem-platform/pull/652) | fix(legal-db): إصلاح انزياح ترقيم نظام المعاملات المدنية + تحصين مصدر الأنظمة | مسودة مفتوحة | `fix/legal-db-source-integrity` → `aman/legal-db-update` | [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#651](https://github.com/asim1417/hakeem-platform/pull/651) | Add Cloud Agent development environment | مسودة مفتوحة | `cursor/setup-cloud-agent-environment-28d4` → `main` | [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#650](https://github.com/asim1417/hakeem-platform/pull/650) | audit(legal-db): استئناف التدقيق — استعادة الحزمة وأمان التضمينات | مسودة مفتوحة | `cursor/legal-db-audit-resume-2351` → `aman/legal-db-update` | [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#631](https://github.com/asim1417/hakeem-platform/pull/631) | feat(legal-db): وكيل تحديث قاعدة الأنظمة — طبقة الوحدات + القارئ + الالتقاط (P1–P4) | مفتوح للمراجعة | `aman/legal-db-update` → `main` | [HKM-009](../../../docs/PROJECT_STATUS.md#hkm-009) |
| [#599](https://github.com/asim1417/hakeem-platform/pull/599) | feat(composer): Capability Registry — ربط الخدمات دون ابتلاعها | مسودة مفتوحة | `cursor/composer-capability-registry-da55` → `main` | [HKM-016](../../../docs/PROJECT_STATUS.md#hkm-016) |
| [#591](https://github.com/asim1417/hakeem-platform/pull/591) | docs: add complete Hakeem project profile | مسودة مفتوحة | `agent/complete-project-profile-2026-07-31` → `main` | [HKM-011](../../../docs/PROJECT_STATUS.md#hkm-011) |
| [#590](https://github.com/asim1417/hakeem-platform/pull/590) | feat(home): concise product landing, visual tour, and direct Google entry | مسودة مفتوحة | `agent/public-landing-page` → `main` | [HKM-018](../../../docs/PROJECT_STATUS.md#hkm-018) |
| [#577](https://github.com/asim1417/hakeem-platform/pull/577) | تدقيق جاهزية الإطلاق: إصلاحات أمنية P0 + تقارير GO/NO-GO | مسودة مفتوحة | `cursor/pre-launch-audit-ff97` → `main` | [HKM-012](../../../docs/PROJECT_STATUS.md#hkm-012) |
| [#548](https://github.com/asim1417/hakeem-platform/pull/548) | HKM-DOCUMENTS-UPGRADE-004 PR-2.5: التحصين التشغيلي لمنصة الوثائق | مسودة مفتوحة | `cursor/documents-pr2-5-hardening-dfcc` → `main` | [HKM-015](../../../docs/PROJECT_STATUS.md#hkm-015) |
| [#537](https://github.com/asim1417/hakeem-platform/pull/537) | Rasd: Local Saudi Execution Bridge | مسودة مفتوحة | `cursor/rasd-local-bridge-97b5` → `cursor/rasd-legislative-monitoring-97b5` | [HKM-013](../../../docs/PROJECT_STATUS.md#hkm-013) |
| [#519](https://github.com/asim1417/hakeem-platform/pull/519) | Rasd: Saudi runner playbook + staging harness — PRODUCTION_NOT_READY | مسودة مفتوحة | `cursor/rasd-production-integration-97b5` → `main` | [HKM-013](../../../docs/PROJECT_STATUS.md#hkm-013) |
| [#513](https://github.com/asim1417/hakeem-platform/pull/513) | Rasd: NCAR Connector Live Verification | مسودة مفتوحة | `feat/rasd-ncar-connector-live-verification` → `cursor/rasd-legislative-monitoring-97b5` | [HKM-013](../../../docs/PROJECT_STATUS.md#hkm-013) |
| [#512](https://github.com/asim1417/hakeem-platform/pull/512) | Rasd: BOE Connector Live Verification | مسودة مفتوحة | `feat/rasd-boe-connector-live-verification` → `cursor/rasd-legislative-monitoring-97b5` | [HKM-013](../../../docs/PROJECT_STATUS.md#hkm-013) |
| [#511](https://github.com/asim1417/hakeem-platform/pull/511) | Rasd: Legislative Monitoring Engine Core (scope-frozen) | مفتوح للمراجعة | `cursor/rasd-legislative-monitoring-97b5` → `main` | [HKM-013](../../../docs/PROJECT_STATUS.md#hkm-013) |
| [#506](https://github.com/asim1417/hakeem-platform/pull/506) | docs: مراجعة 2 لتصميم تخزين الجلسات (قبل التنفيذ) | مسودة مفتوحة | `cursor/session-phase1-storage-rev2-e7e2` → `main` | [HKM-014](../../../docs/PROJECT_STATUS.md#hkm-014) |
| [#505](https://github.com/asim1417/hakeem-platform/pull/505) | docs: المرحلة الأولى — تصميم تخزين محرك الجلسات (بلا تنفيذ) | مسودة مفتوحة | `cursor/session-phase1-storage-design-e7e2` → `main` | [HKM-014](../../../docs/PROJECT_STATUS.md#hkm-014) |
| [#504](https://github.com/asim1417/hakeem-platform/pull/504) | docs: جرد المرحلة صفر المحدود — اسأل حكيم والمعاون | مسودة مفتوحة | `cursor/session-phase0-ask-ja-report-e7e2` → `main` | [HKM-014](../../../docs/PROJECT_STATUS.md#hkm-014) |
| [#503](https://github.com/asim1417/hakeem-platform/pull/503) | docs: تقرير جرد المرحلة صفر لنظام الجلسات | مسودة مفتوحة | `cursor/session-phase0-inventory-e7e2` → `main` | [HKM-014](../../../docs/PROJECT_STATUS.md#hkm-014) |
| [#486](https://github.com/asim1417/hakeem-platform/pull/486) | fix(admin): إبراز نافذة المنصة حتى يظهر تصميم العميل للسوبر | مسودة مفتوحة | `cursor/fix-platform-window-visible-9b97` → `main` | [HKM-018](../../../docs/PROJECT_STATUS.md#hkm-018) |
| [#366](https://github.com/asim1417/hakeem-platform/pull/366) | صفحات الخطط والتسعير ولوحة الفوترة — مواءمة بلا كسر | مسودة مفتوحة | `cursor/plans-billing-dashboard-9b97` → `main` | [HKM-017](../../../docs/PROJECT_STATUS.md#hkm-017) |
| [#343](https://github.com/asim1417/hakeem-platform/pull/343) | feat(cards): طبقة استخراج بطاقات الأحكام التجارية — عيّنة الألف (داخلية، مُقفلة) | مفتوح للمراجعة | `data/judgment-cards-sample` → `main` | [HKM-020](../../../docs/PROJECT_STATUS.md#hkm-020) |
| [#62](https://github.com/asim1417/hakeem-platform/pull/62) | feat(thesaurus): دمج المعجم النظامي الرسمي في قاعدة بيانات حكيم والنواة القانونية | مفتوح للمراجعة | `claude/hakim-database-entry-1f2o0n` → `main` | [HKM-019](../../../docs/PROJECT_STATUS.md#hkm-019) |

## تبعيات الفروع الظاهرة

هذه علاقات هدف PR بحسب GitHub، وليست توصية لدمجها:

- [#720](https://github.com/asim1417/hakeem-platform/pull/720) يستهدف `cursor/setup-cloud-agent-environment-28d4`، وهو فرع [#651](https://github.com/asim1417/hakeem-platform/pull/651).
- [#702](https://github.com/asim1417/hakeem-platform/pull/702) يستهدف `claude/search-surface-wave1-law-card`، وهو فرع [#685](https://github.com/asim1417/hakeem-platform/pull/685).
- [#652](https://github.com/asim1417/hakeem-platform/pull/652) يستهدف `aman/legal-db-update`، وهو فرع [#631](https://github.com/asim1417/hakeem-platform/pull/631).
- [#650](https://github.com/asim1417/hakeem-platform/pull/650) يستهدف `aman/legal-db-update`، وهو فرع [#631](https://github.com/asim1417/hakeem-platform/pull/631).
- [#537](https://github.com/asim1417/hakeem-platform/pull/537) يستهدف `cursor/rasd-legislative-monitoring-97b5`، وهو فرع [#511](https://github.com/asim1417/hakeem-platform/pull/511).
- [#513](https://github.com/asim1417/hakeem-platform/pull/513) يستهدف `cursor/rasd-legislative-monitoring-97b5`، وهو فرع [#511](https://github.com/asim1417/hakeem-platform/pull/511).
- [#512](https://github.com/asim1417/hakeem-platform/pull/512) يستهدف `cursor/rasd-legislative-monitoring-97b5`، وهو فرع [#511](https://github.com/asim1417/hakeem-platform/pull/511).

## المشكلة المفتوحة

- [#654 — إصلاح أعطال الإنتاج وNeon](https://github.com/asim1417/hakeem-platform/issues/654): تقرير تاريخي من 25 سبتمبر؛ تُطابق بنوده مع الإصلاحات اللاحقة. يرتبط بـHKM-009 وHKM-010 وHKM-012؛ لم نُثبت أن كل ما فيه ما زال قائمًا.

## حدود اللقطة وإعادة القراءة

- لا تشمل هذه القائمة الطلبات المغلقة كلها أو العمل غير المرفوع أو المحادثات الخاصة.
- استخدم [الطلبات المفتوحة الحية](https://github.com/asim1417/hakeem-platform/pulls?q=is%3Apr+is%3Aopen) لمعرفة النشاط الجديد.
- استعلام الجرد: `GET /repos/asim1417/hakeem-platform/pulls?state=open&per_page=100`، مع متابعة الصفحات عند امتلاء الصفحة؛ والمشكلات عبر `issues` مع استبعاد عناصر `pull_request`.
- عند تحديث الأدلة أضف مجلدًا مؤرخًا جديدًا. لا تمحُ هذه اللقطة التاريخية.
