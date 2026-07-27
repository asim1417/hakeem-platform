# تقرير GitHub Checks — PR #511

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/511  
**قبل الإصلاح (HEAD `8dc5110`):** Draft حُوّل مؤقتًا إلى Ready ثم أُعيد إلى Draft حتى نجاح Checks.

## جدول Checks (قبل الإصلاح)

| الفحص | الحالة | الأمر / المصدر | ملاحظات |
|---|---|---|---|
| Deploy Readiness Check / `readiness` | **PASS** | `npm ci` → `db:generate` → `typecheck` → `build` → `qa:security` → `qa:citations` | ناجح على GHA |
| Vercel Preview Comments | **PASS** | تكامل Vercel GitHub | لا ملاحظات |
| Vercel Deployment | **FAIL** | نشر Preview عبر Vercel Git Integration | فشل منذ commit `b9125ec` (إضافة admin/API/cron) بينما `71e6e33` نجح |

## تحليل فشل Vercel

| البند | القيمة |
|---|---|
| أول commit ناجح على Vercel | `71e6e33` (نواة بدون مسارات admin/API) |
| أول commit فاشل | `b9125ec` |
| هل الفشل سابق للمنصة؟ | **لا** — ناتج عن مسارات رصد في هذا الـPR |
| السبب الجذري | Node File Tracing لعدة routes سحب `.next` + `.git` + `data/**` → حزم Serverless ≈ **706 MB** (حد Vercel ≈ 250 MB uncompressed) |
| الملفات/الآلية المتسببة | `fs` + `process.cwd()` في `reports/gaps.ts` / `snapshot/store.ts` / connectors fixtures، واستيراد ثقيل لـ orchestrator من routes |
| السطر/الملف | `lib/modules/rasd/reports/gaps.ts` (writeRasdReport تحت cwd)، `app/api/admin/rasd/runs/route.ts`, cron weekly, comparisons/gaps/conflicts pages |

## الإصلاح (نطاق النواة فقط)

1. `outputFileTracingExcludes` في `next.config.mjs` لاستبعاد `.git` / `.next` / snapshots / docs / scripts / أدوات ثقيلة.
2. كتابة التقارير واللقطات إلى `/tmp` على Vercel.
3. Dynamic import لـ orchestrator/reports من routes الثقيلة.
4. `runtime = "nodejs"` لمسارات cron/runs/reports.

بعد الإصلاح محليًا: أكبر حزمة Rasd NFT ≈ **17 MB**.

## إعادة تشغيل محلي

| الأمر | النتيجة |
|---|---|
| prisma validate | PASS |
| prisma generate | PASS |
| typecheck | PASS |
| build | PASS |
| test:rasd | PASS |
| test:rasd:integration | PASS |

## ما لم يُعاد إلى #511

- live probes · preview comparison · vercel cron registration · BOE/NCAR deployment verification

## القرار بعد نجاح CI

- عند نجاح `readiness` + `Vercel` → `CORE_READY_FOR_REVIEW` وتحويل Draft→Ready.
- وإلا → `CORE_NOT_READY`.
