# التقرير النهائي لنطاق PR #511 — نواة محرك رصد

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/511  
**التصنيف:** `CORE_READY_FOR_REVIEW` · `PRODUCTION_NOT_READY`

---

## 1) ما الذي بقي داخل PR #511

1. نواة محرك رصد (`lib/modules/rasd/**`)
2. نماذج Prisma + هجرة `20260727120000_add_rasd_monitoring`
3. Run orchestration / snapshot / normalize / fingerprint / match / diff / conflict
4. Review + apply/rollback abstractions (بدون auto-apply)
5. Audit hooks + RBAC (`RASD_*`) + SSRF url-guard
6. واجهة إدارة أساسية `/admin/rasd/*` + APIs
7. عقد موصل موحّد `LegislativeSourceConnector` + سجل حالة الموصلات
8. موصل UQN (LIVE_VERIFIED — 10 وثائق) + كود BOE/NCAR (IMPLEMENTED / DEGRADED / flags off)
9. Feature flags لكل مصدر
10. اختبارات النواة + acceptance (عزل المصادر / partial / flags / SSRF / cron auth / RBAC)
11. Fixtures + توثيق أساسي + تقارير النطاق

## 2) ما الذي نُقل إلى PRات / مراحل لاحقة

| المرحلة | الفرع المقترح | المحتوى |
|---|---|---|
| تحقق BOE الحي | `feat/rasd-boe-connector-live-verification` | TLS، health، 10 وثائق، تقرير أدلة |
| تحقق NCAR الحي | `feat/rasd-ncar-connector-live-verification` | نفس معيار القبول |
| مسح تأسيسي | `feat/rasd-baseline-scan` | بعد ≥2 موصلات LIVE |
| مقارنة مكتبة حكيم | `feat/rasd-hakeem-library-comparison` | Preview فقط |
| جدولة أسبوعية | `feat/rasd-weekly-scheduler` | `vercel.json` + إثبات Preview |

**أُزيل من شجرة #511 (يُستعاد من تاريخ git للفروع اللاحقة):**

- `.github/workflows/rasd-source-health.yml`
- `scripts/rasd/probe-sources-live.ts`
- `scripts/rasd/verify-preview-compare.ts`
- `docs/rasd/reports/tls-diagnosis*.json|txt`
- `docs/rasd/reports/live-source-probe.json`
- `docs/rasd/reports/live-verification-probe.json`
- `docs/rasd/reports/preview-live-compare.json`
- `vercel.json` (تسجيل الكرون)

خطط موجّهة: `docs/rasd/follow-ups/*/README.md`

## 3–4) حجم التغييرات

| المقياس | قبل التنظيف | بعد التنظيف (تقريبي) |
|---|---|---|
| ملفات | ~117 | ~119 (شامل خطط follow-ups + اختبارات؛ بدون أدلة TLS الضخمة) |
| إضافات | ~10,634 | ~9,700 |
| حذوفات | ~500 (ضوضاء CRLF في AdminUsersManager) | ~42 |

تنقية مهمة: `AdminUsersManager.tsx` أصبح +4 أسطر فقط (تسميات RASD) بدل إعادة الملف كاملًا.

## 5) حالة الاختبارات

| الاختبار | النتيجة |
|---|---|
| prisma validate | PASS |
| prisma generate | PASS |
| typecheck | PASS |
| build | PASS |
| test:rasd (unit+acceptance+cron+rbac) | PASS (12+10+6+16) |
| test:rasd:integration | PASS |
| SSRF | PASS |
| RBAC | PASS |
| source isolation / partial-run | PASS (`status=PARTIAL`) |
| feature flags | PASS |
| cron auth | PASS |
| apply/rollback isolated DB | PASS (`allPass: true`) |
| UQN live sample (موثّق سابقًا) | 10/10 — راجع `live-uqn-sample.json` |
| no auto-apply / no prod write guards | PASS |

## 6–8) حالة المصادر

| المصدر | التنفيذ | الحي | الاعتماد | العلم الافتراضي |
|---|---|---|---|---|
| **UQN** | IMPLEMENTED | LIVE_VERIFIED (10) | VERIFIED_WITH_LIMITATIONS | `RASD_SOURCE_UQN_ENABLED=true` |
| **BOE** | IMPLEMENTED | NOT_LIVE_VERIFIED | DEGRADED (TLS ECONNRESET) | `RASD_SOURCE_BOE_ENABLED=false` |
| **NCAR** | IMPLEMENTED | NOT_LIVE_VERIFIED | DEGRADED (TLS ECONNRESET) | `RASD_SOURCE_NCAR_ENABLED=false` |

**بيان صريح:** تم الربط البرمجي مع المصادر الثلاثة. ثبت الربط الحي مع UQN فقط. لم يثبت الربط الحي مع BOE وNCAR.

## 9) قاعدة البيانات

- هجرة رصد مضافة؛ لا كتابة إنتاجية في هذا الـPR.
- apply/rollback على Postgres محلي معزول فقط.
- `RASD_AUTO_APPLY_ENABLED=false` · `RASD_REVIEW_REQUIRED=true`.

## 10) Cron

- مسار API موجود ومحمي بسر + تعطيل Preview افتراضيًا.
- `RASD_SCHEDULER_ENABLED=false`.
- تسجيل `vercel.json` نُقل لفرع الجدولة — **غير مثبت على Vercel**.

## 11) المخاطر المتبقية

1. BOE/NCAR متعذران حيًا (TLS) من البيئات المختبرة.
2. لا مقارنة حية مع مكتبة إنتاج حكيم (متعمد).
3. الكرون غير مثبت على Vercel Preview.
4. هجرات تاريخية للمنصة تمنع `migrate deploy` من صفر على بعض القواعد الفارغة (سابقة للـPR).
5. Parser UQN بحدود على بعض أشكال HTML.

## 12) هل PR خاص بالنواة فقط؟

**نعم** — بعد التنظيف: لا مصادر جديدة، لا مسح إنتاجي، لا مقارنة إنتاج، لا ادعاء ربط ثلاثي حي، لا auto-apply.

## 13) قرار الجاهزية

```
CORE_READY_FOR_REVIEW
PRODUCTION_NOT_READY
```

يجوز تحويل Draft→Ready for Review للمراجعة البشرية.  
**لا دمج · لا نشر إنتاج.**
