# UQN_LIVE_PRODUCTION_REPORT

**Generated:** 2026-07-27  
**Machine evidence:** `UQN_LIVE_PRODUCTION_REPORT.json`  
**Environment:** local staging PostgreSQL `rasd_preview` @ `127.0.0.1` (NOT Neon production)

## Gate A checklist

| Requirement | Result | Evidence |
|---|---|---|
| ≥10 live documents | **PASS** — 10 | `liveSamplesOk: 10` |
| Parser ran without crash | **PASS** (confidence ~0.65) | samples[].parserConfidence |
| Saved to staging DB | **PASS** | `monitored_legal_documents` 12 total (10 UQN + 2 fixtures); `source_snapshots` UQN=20 |
| Deduplication | **PASS** | scanDry: new=10; scanPersist: unchanged=10, new=0 |
| Baseline | **PARTIAL** | dry-run COMPLETED; all classified NEW_DOCUMENT / NO_MATCH vs tiny library (2 legal_systems) |
| Production DB | **FAIL** | No Neon production write; staging only |
| Auto-apply | Disabled | `autoApply: false`; legal_articles unchanged (2→2) |

## Runs

| Run | Type | Status | Fetched | New | Changed | Unchanged | Failed | dry_run |
|---|---|---|---|---|---|---|---|---|
| cms3nuobl… | MANUAL | COMPLETED | 10 | 10 | 10 | 0 | 0 | true |
| cms3nurfv… | MANUAL | COMPLETED | 10 | 0 | 0 | 10 | 0 | false |

## Parser quality note (honest)

Fetched live UQN sitemap XML (`content-type: text/xml`). Extracted titles often remain URL-like; `instrumentType`/`instrumentNumber` null; `document_type=OTHER`. This satisfies the **live connectivity + persist** gate for UQN staging, but **full legislative field extraction quality is not production-grade**.

## Certification

`UQN_LIVE_STAGING_VERIFIED` — staging only.  
**Not** production-library-applied.
