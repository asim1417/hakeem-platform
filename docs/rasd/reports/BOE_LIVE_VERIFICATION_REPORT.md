# تقرير التحقق الحي — موصل هيئة الخبراء (BOE)

**التاريخ:** 2026-07-27  
**الفرع:** `feat/rasd-boe-connector-live-verification`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/512  
**Commit:** `114851d`

## البيئات المنفّذة فعليًا

| البيئة | DNS | TCP | TLS | HTTP | وثائق حية |
|---|---|---|---|---|---|
| Cursor Cloud Agent | PASS | PASS | **FAIL** (ECONNRESET after ClientHello / 0 bytes read) | FAIL | 0/10 |
| GitHub Actions `ubuntu-latest` | PASS | **FAIL** (tcp_timeout) | skipped | FAIL (`curl_http=000`) | 0/10 |
| Vercel Preview Function | Deploy **PASS** | — | — | استدعاء خارجي محظور بـ **Vercel Deployment Protection SSO** | لم يُنفَّذ جلب وثائق |

أوامر منفّذة: `openssl s_client`, `curl`, `npx tsx scripts/rasd/verify-source-live.ts`, workflow `rasd-source-live.yml`, endpoint `/api/cron/rasd/live-probe` (مُنشور لكن محمي SSO).

## الاكتشاف والاستخراج

| البند | Cloud Agent | GHA |
|---|---|---|
| discoveredCount | 0 | 0 |
| liveSuccessCount | 0 | 0 |
| discoverError | fetch failed | fetch failed |

## Parser

لم تُجلب وثائق حية؛ لا نتائج parser حية. Fixtures لا تُحسب.

## CI

| Check | حالة |
|---|---|
| readiness | PASS |
| live-verify workflow | completed (exit 2 = not LIVE_VERIFIED, continue-on-error) |
| Vercel Preview deploy | PASS |

## المخاطر

- حظر شبكي/TLS من مراكز بيانات GitHub وCloud تجاه `laws.boe.gov.sa`.
- Vercel Preview محمي SSO فلا يمكن استدعاء Function بدون صلاحية مالك.
- لا يجوز اعتبار الموصل البرمجي دليل اتصال حي.

## القرار النهائي

**DEGRADED** · **NOT_LIVE_VERIFIED** (0 وثائق حية)

يحظر وصف BOE: CONNECTED / WORKING / LIVE / VERIFIED.
