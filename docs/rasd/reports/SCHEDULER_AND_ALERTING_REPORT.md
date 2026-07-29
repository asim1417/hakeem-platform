# SCHEDULER_AND_ALERTING_REPORT

**Generated:** 2026-07-27

## Scheduler code status

| Component | State |
|---|---|
| Cron routes | `app/api/cron/rasd/weekly`, `app/api/cron/rasd-weekly`, live-probe |
| Flag `RASD_SCHEDULER_ENABLED` | **false by default** |
| Vercel cron registration | **Not enabled** for production in this effort (scope: avoid serverless-only crawl) |
| Long-running worker | `scripts/rasd/worker.ts` + docker compose profile `rasd` |
| Per-source loop | Worker iterates enabled sources independently; failures logged, loop continues |
| Distributed lock | `rasd_run_locks` |
| Retry / backoff / jitter | Present in connector HTTP / orchestrator paths (unit-covered isolation) |
| Circuit breaker | Implemented + orchestrator skip when OPEN |

## Production cron registration

**NOT REGISTERED** on a live production scheduler in this run.

No evidence of:

- Successful automatic production cron tick per source
- Deployed worker heartbeat in a BOE/NCAR-reachable region

## Alerting / health UI

| Item | State |
|---|---|
| Admin health page | Added: `/admin/rasd/health` (LIVE/DEGRADED display via connector cert + circuits + recent runs) |
| Alert on 3 consecutive failures | Circuit opens after threshold (default 3) — **in-process**; no PagerDuty/email/Slack sink wired |
| Stale data / cron-stopped alerts | **Not** connected to external notifier |
| Migration failure alert | **Not** wired |

## Manual admin run

Supported via admin/CLI with RBAC + dry-run defaults. Public invocation blocked by cron secret tests.

## Gate D

**FAIL** — no proven production cron automatic success for all three sources.
