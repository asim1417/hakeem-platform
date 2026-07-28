# تدقيق نطاق PR #511 — محرك رصد

**التاريخ:** 2026-07-27
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`
**الهدف:** حصر PR #511 على نواة رصد فقط وفصل الموصلات/التشغيل اللاحق.

## ملخص

- ملفات مُراجعة: **127**
- يُبقى في النواة: **119**
- أُزيل / يُنقل: **8**

## جدول الملفات

| المسار | سبب التعديل | نواة رصد؟ | يبقى في #511؟ | نقل لاحق؟ | خطورة | أثر |
|---|---|---|---|---|---|---|
| `.env.example` | أعلام وسكربتات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `.github/workflows/rasd-source-health.yml` | أُزيل من النواة — تحقق حي / مقارنة | لا | لا | follow-up PRs | MED | محدود على نواة رصد |
| `.gitignore` | أعلام وسكربتات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/comparisons/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/conflicts/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/gaps/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/reviews/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/runs/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/admin/rasd/sources/page.tsx` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/apply/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `app/api/admin/rasd/changes/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/conflicts/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/health/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/overview/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/reports/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/reviews/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/rollback/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/runs/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/admin/rasd/sources/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `app/api/cron/rasd-weekly/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `app/api/cron/rasd/weekly/route.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `components/AdminUsersManager.tsx` | RBAC تسميات/صلاحيات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `components/admin/AdminNav.tsx` | RBAC تسميات/صلاحيات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/boe/law-sample-amended.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/boe/law-sample-repealed.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/boe/law-sample.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/boe/updates-sample.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/ncar/document-sample.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/decision-4001465.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/decisions-index.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/instruments/amendment.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/instruments/cabinet-decision.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/instruments/ministerial.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/instruments/no-instrument.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/instruments/regulation.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/instruments/royal-decree.html` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/issue-text-sample.txt` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/robots.txt` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/sitemap-decisions-sample.txt` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `data/rasd/fixtures/uqn/sitemap-sample.xml` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/ADD_SOURCE.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/CRON.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/OPERATIONS.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/PARSER_REPAIR.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/RECON_REPORT.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/RECOVERY.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/ROLLBACK.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/follow-ups/baseline-scan/README.md` | خطة مراحل لاحقة (توثيق توجيهي فقط) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/follow-ups/boe-live/README.md` | خطة مراحل لاحقة (توثيق توجيهي فقط) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/follow-ups/hakeem-compare/README.md` | خطة مراحل لاحقة (توثيق توجيهي فقط) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/follow-ups/ncar-live/README.md` | خطة مراحل لاحقة (توثيق توجيهي فقط) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/follow-ups/weekly-scheduler/README.md` | خطة مراحل لاحقة (توثيق توجيهي فقط) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/FINAL_REPORT.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/PR511_CHANGE_REVIEW.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/READINESS_VERIFICATION_REPORT.md` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/apply-rollback-isolated.json` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `docs/rasd/reports/baseline-fixtures-run.json` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/conflicts-report.json` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/coverage-report.json` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/gaps-fixtures.json` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/live-source-probe.json` | أُزيل — جدولة/أدلة تحقق حي غير معتمدة للنواة | لا | لا | follow-up | MED | محدود على نواة رصد |
| `docs/rasd/reports/live-uqn-sample.json` | موصل UQN المتحقق حيًا (10 وثائق) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/live-verification-probe.json` | أُزيل — جدولة/أدلة تحقق حي غير معتمدة للنواة | لا | لا | follow-up | MED | محدود على نواة رصد |
| `docs/rasd/reports/preview-db-apply-rollback.json` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `docs/rasd/reports/preview-live-compare.json` | أُزيل — جدولة/أدلة تحقق حي غير معتمدة للنواة | لا | لا | follow-up | MED | محدود على نواة رصد |
| `docs/rasd/reports/tls-diagnosis-raw.txt` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `docs/rasd/reports/tls-diagnosis.json` | أُزيل — جدولة/أدلة تحقق حي غير معتمدة للنواة | لا | لا | follow-up | MED | محدود على نواة رصد |
| `lib/modules/auth/role-admin.ts` | RBAC تسميات/صلاحيات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/auth/role-permissions.ts` | RBAC تسميات/صلاحيات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/admin-data.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/conflict/engine.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/base.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/boe.ts` | عقد موصل + fixtures؛ معطّل افتراضياً وDEGRADED | نعم | نعم | — keep | MED | لا تشغيل حي افتراضي |
| `lib/modules/rasd/connectors/contract.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/http.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/index.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/ncar.ts` | عقد موصل + fixtures؛ معطّل افتراضياً وDEGRADED | نعم | نعم | — keep | MED | لا تشغيل حي افتراضي |
| `lib/modules/rasd/connectors/rate-limit.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/retry.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/status.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/uqn.ts` | موصل UQN المتحقق حيًا (10 وثائق) | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/connectors/url-guard.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/db/seed-sources.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/diff/engine.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/flags.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/hash.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/health.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/index.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/match/engine.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/normalize/arabic.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/normalize/dates.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/normalize/identity.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/normalize/numbers.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/notify/digest.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/parse/effects.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/parse/metadata.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/parse/pdf.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/parse/structure.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/reports/conflicts.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/reports/coverage.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/reports/gaps.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/review/apply.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `lib/modules/rasd/review/rollback.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/review/workflow.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/runs/lock.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/runs/manager.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/scan/baseline.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/scan/orchestrator.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/scan/run-status.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/scan/weekly.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/scheduler/weekly.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/snapshot/store.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `lib/modules/rasd/types.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `package.json` | أعلام وسكربتات رصد | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `prisma/migrations/20260727120000_add_rasd_monitoring/migration.sql` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `prisma/schema.prisma` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `scripts/rasd/cli.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `scripts/rasd/probe-sources-live.ts` | أُزيل من النواة — تحقق حي / مقارنة | لا | لا | follow-up PRs | MED | محدود على نواة رصد |
| `scripts/rasd/test-rasd-acceptance.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `scripts/rasd/test-rasd-cron-auth.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `scripts/rasd/test-rasd-integration.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `scripts/rasd/test-rasd-rbac.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `scripts/rasd/test-rasd-unit.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | LOW | محدود على نواة رصد |
| `scripts/rasd/verify-apply-rollback-isolated.ts` | نواة محرك رصد / إدارة / اختبارات / توثيق | نعم | نعم | — keep | MED | محدود على نواة رصد |
| `scripts/rasd/verify-preview-compare.ts` | أُزيل من النواة — تحقق حي / مقارنة | لا | لا | follow-up PRs | MED | محدود على نواة رصد |
| `vercel.json` | أُزيل — جدولة/أدلة تحقق حي غير معتمدة للنواة | لا | لا | follow-up | MED | محدود على نواة رصد |

## قرارات الإزالة من PR #511

- سير عمل GHA للتحقق الحي من المصادر
- سكربت `probe-sources-live.ts`
- سكربت `verify-preview-compare.ts` (مقارنة مكتبة حكيم)
- تقارير TLS والتحقق الحي غير المعتمدة كنجاح لـ BOE/NCAR
- `vercel.json` (تسجيل الكرون) → فرع الجدولة

## ما يبقى

- نواة المحرك، Prisma، الموصلات (UQN مفعّل؛ BOE/NCAR كود + DEGRADED + flags off)
- SSRF/RBAC/apply-rollback abstractions
- واجهة إدارة أساسية
- اختبارات النواة + عينة UQN الحية الموثّقة
