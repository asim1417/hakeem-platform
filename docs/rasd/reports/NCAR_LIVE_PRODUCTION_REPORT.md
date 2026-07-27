# NCAR_LIVE_PRODUCTION_REPORT

**Generated:** 2026-07-27T20:15:27Z  
**Branch:** `cursor/rasd-production-integration-97b5`  
**Related PR:** https://github.com/asim1417/hakeem-platform/pull/513 (Draft — remains NOT_LIVE_VERIFIED)  
**JSON:** `NCAR_LIVE_VERIFICATION_REPORT.json`

## Gate C checklist

| Requirement | Result |
|---|---|
| ≥10 live documents (not fixtures) | **FAIL — 0** |
| HTTP + TLS from production runner | **FAIL** — TLS ECONNRESET from Cursor Cloud; TCP timeout from GHA |
| Parser on live docs | **FAIL** — no live payload |
| Persist + compare | **FAIL** |

## Connectivity (Cursor Cloud Agent)

| Host | DNS | TCP | TLS | HTTP |
|---|---|---|---|---|
| ncar.gov.sa | PASS | PASS | FAIL `read ECONNRESET` | skipped |
| www.ncar.gov.sa | PASS | PASS | FAIL `read ECONNRESET` | skipped |

`discoveredCount: 0` · `liveSuccessCount: 0` · `certification: DEGRADED`

## Forbidden claims

Do **not** describe NCAR as CONNECTED / WORKING / LIVE / VERIFIED.

## Certification

**DEGRADED · NOT_LIVE_VERIFIED**
