# STAGING_LIVE_SCAN_REPORT

**Generated:** 2026-07-27T22:33:14Z  
**JSON:** `STAGING_LIVE_SCAN_REPORT.json`  
**DB:** local staging surrogate `rasd_preview` @ 127.0.0.1 (**not** Neon staging; Neon staging credentials unavailable)

## Command

```bash
RASD_STAGING_LIMIT=10 RASD_STAGING_SOURCES=UQN,BOE,NCAR \
RASD_AUTO_APPLY_ENABLED=false npm run rasd:staging:live-scan
```

Two dry-run passes (dedupe/idempotency).

## Source outcomes (pass 1)

| Source | Outcome | Fetched | Notes |
|---|---|---|---|
| UQN | SUCCEEDED | 7 | Legislative URL filter tightened; <10 because sitemap yield of legislative locs was 7 |
| BOE | FAILED | 0 | TLS/fetch failed from this runner |
| NCAR | FAILED | 0 | TLS/fetch failed from this runner |

Overall status: **PARTIAL** (expected under foreign egress).

## Dedupe (pass 2)

| Metric | Value |
|---|---|
| pass1New | 7 |
| pass2New | 0 |
| pass2Unchanged | 7 |

## Library guard

| Table | Before | After |
|---|---|---|
| legal_systems | 2 | 2 |
| legal_articles | 2 | 2 |

`libraryUnchanged: true` · `autoApply: false`

## Monitoring tables after scan

| Metric | After (scan report) | Later DB check |
|---|---|---|
| monitored documents | 29 | 29 |
| snapshots | 59 | 73 (includes worker runs) |
| runs | 6 | 10 |

## Circuit breaker during scan

UQN CLOSED (2 successes). BOE/NCAR accumulating failures (2 each in this dual pass — threshold 3 not yet OPEN). Separate unit proof: 3 failures → OPEN and `canAttempt=false`.

## Neon staging migrate deploy

**NOT EXECUTED** — no Neon staging `DATABASE_URL` in this environment. Local schema previously `migrate status` up-to-date.

## Gate

Staging multi-source live 10×3: **FAIL** (BOE/NCAR 0; UQN 7 legislative docs).  
Dedupe + no library write: **PASS** on available path.
