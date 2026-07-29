# BASELINE_COMPARISON_REPORT

**Generated:** 2026-07-27  
**Mode:** `--dry-run` only (no auto-apply)  
**JSON summary:** `BASELINE_COMPARISON_REPORT.json`  
**DB:** local staging `rasd_preview` — **not** production Neon

## Command

```bash
npx tsx scripts/rasd/cli.ts baseline --dry-run --source UQN --limit 20
```

## Result

| Field | Value |
|---|---|
| runId | `cms3nzhwz0000d3k0emcvsp58` |
| status | COMPLETED |
| dryRun | true |
| pagesFetched | 20 |
| documentsDiscovered | 20 |
| documentsNew | 10 |
| documentsChanged | 10 |
| documentsUnchanged | 10 |
| documentsFailed | 0 |
| conflictsFound | 0 |
| changeTypes | NEW_DOCUMENT × 10 |

## Classification vs Hakeem library

Staging library size: `legal_systems=2`, `legal_articles=2`.

| Class | Count | Method |
|---|---|---|
| NEW | 10 (changes) | No existing source version / Hakeem match |
| MATCHED | 0 | — |
| CHANGED | 0 (semantic) | counts.documentsChanged reflects version churn, not library apply |
| CONFLICT | 0 | — |
| INCOMPLETE / NEEDS_REVIEW | All staged docs remain `REQUIRES_REVIEW` / mostly `NO_MATCH` | Review gate intact |

Matching uses identity key + title/authority/date/fingerprint path — **not name alone**. Auto-apply **off**.

## BOE / NCAR baseline

Not executed live (sources unreachable). Fixtures-only integration baseline PASS (6 docs) — not counted as live production baseline.

## Decision

Baseline dry-run path **works** for UQN against staging.  
**Not** an approved production baseline apply. Gate for full multi-source production baseline: **FAIL**.
