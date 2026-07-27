# تقرير التحقق الحي — المركز الوطني للوثائق والمحفوظات (NCAR)

**التاريخ:** 2026-07-27T19:35:00.291Z  
**الفرع:** `feat/rasd-ncar-connector-live-verification`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/513  

## الطبقات

| الطبقة | النتيجة |
|---|---|
| DNS | PASS |
| TCP :443 | PASS |
| TLS handshake | FAIL — reset after ClientHello |
| HTTP | FAIL |

## الوثائق الحية

| البند | القيمة |
|---|---|
| اكتشف | 0 |
| نجاح حي | 0 / 10 |
| discoverError | fetch failed |

## القرار

**DEGRADED**

لا يوصف NCAR بأنه CONNECTED / WORKING / LIVE / VERIFIED.
