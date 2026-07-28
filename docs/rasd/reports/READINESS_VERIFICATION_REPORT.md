# تقرير إكمال الجاهزية التشغيلية — PR #511 (محدّث بعد تثبيت النطاق)

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/511  
**هل حُوِّل Draft→Ready؟** موصى به للنواة فقط — راجع القرار أدناه  
**القرار:** `CORE_READY_FOR_REVIEW` · `PRODUCTION_NOT_READY`

---

## بيان صريح عن المصادر

1. **تم الربط البرمجي** مع المصادر الثلاثة (BOE / NCAR / UQN).
2. **ثبت الربط الحي مع UQN فقط** (عينة 10 وثائق).
3. **لم يثبت الربط الحي مع BOE وNCAR** حتى الآن (TLS ECONNRESET after ClientHello).
4. وجود Connector ≠ نجاح الاتصال الحي.
5. Fixtures ≠ دليل رصد حي.

| المصدر | IMPLEMENTED | LIVE_VERIFIED | شهادة الاعتماد | الافتراضي |
|---|---|---|---|---|
| UQN | نعم | نعم (10) | VERIFIED_WITH_LIMITATIONS | ENABLED |
| BOE | نعم | لا | DEGRADED | DISABLED |
| NCAR | نعم | لا | DEGRADED | DISABLED |

---

## إغلاق موانع النواة

| المانع | الحالة |
|---|---|
| SSRF | CLOSED — url-guard + اختبارات رفض |
| RBAC | CLOSED — RASD_VIEW/REVIEW/APPLY/ADMIN |
| فشل مصدر يعطّل الآخر | CLOSED — run=`PARTIAL`، نتائج UQN تُحفظ |
| Feature flags مستقلة | CLOSED — راجع `.env.example` |
| Auto-apply | CLOSED — `RASD_AUTO_APPLY_ENABLED=false` |
| تضخم PR | مخفَّض — أُزيلت أدلة TLS/مقارنة/GHA/vercel cron من النطاق |
| نطاق النواة | موثّق في `PR511_SCOPE_AUDIT.md` و`PR511_FINAL_SCOPE_REPORT.md` |

---

## ما تبقّى خارج النواة (PRات لاحقة)

- `feat/rasd-boe-connector-live-verification`
- `feat/rasd-ncar-connector-live-verification`
- `feat/rasd-baseline-scan` (بعد موصلين LIVE)
- `feat/rasd-hakeem-library-comparison`
- `feat/rasd-weekly-scheduler`

---

## اختبارات القبول (هذه الجولة)

- prisma validate / generate ✅
- typecheck / build ✅
- test:rasd ✅
- test:rasd:integration ✅
- partial-run UQN✅ + BOE/NCAR unreachable → PARTIAL ✅
- apply/rollback isolated ✅ (`allPass`)
- cron auth unit ✅

---

## لا يُدّعى

- اكتمال الربط الثلاثي الحي  
- جاهزية الإنتاج  
- عمل الكرون على Vercel  
- نجاح BOE أو NCAR الحي
