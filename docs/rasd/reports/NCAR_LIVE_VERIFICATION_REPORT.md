# تقرير التحقق الحي — المركز الوطني للوثائق والمحفوظات (NCAR)

**التاريخ:** 2026-07-27  
**الفرع:** `feat/rasd-ncar-connector-live-verification`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/513  
**Commit:** `62fe512`

## البيئات المنفّذة فعليًا

| البيئة | DNS | TCP | TLS | HTTP | وثائق حية |
|---|---|---|---|---|---|
| Cursor Cloud Agent | PASS | PASS | **FAIL** (ECONNRESET after ClientHello) | FAIL | 0/10 |
| GitHub Actions `ubuntu-latest` | PASS | **FAIL** (tcp_timeout) | skipped | FAIL | 0/10 |
| Vercel Preview Function | Deploy **PASS** | — | — | محظور بـ SSO Deployment Protection | لم يُنفَّذ جلب |

أوامر: openssl/curl + `verify-source-live.ts` + workflow `rasd-source-live.yml` + `/api/cron/rasd/live-probe`.

## الاكتشاف

| البند | Cloud | GHA |
|---|---|---|
| discovered | 0 | 0 |
| live success | 0 | 0 |
| error | fetch failed | fetch failed |

لم تُختبر فهارس/API/PDF حية بسبب تعذّر TLS/TCP من البيئات المتاحة.

## القرار النهائي

**DEGRADED** · **NOT_LIVE_VERIFIED** (0 وثائق حية)

يحظر وصف NCAR: CONNECTED / WORKING / LIVE / VERIFIED.
