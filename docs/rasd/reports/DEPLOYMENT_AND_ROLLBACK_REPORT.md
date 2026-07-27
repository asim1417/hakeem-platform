# DEPLOYMENT_AND_ROLLBACK_REPORT

**Generated:** 2026-07-27

## PRs / branches

| Item | URL / name | State |
|---|---|---|
| PR #511 core | https://github.com/asim1417/hakeem-platform/pull/511 | Ready for Review · checks green · **do not treat as PRODUCTION_READY** |
| PR #512 BOE | https://github.com/asim1417/hakeem-platform/pull/512 | **Draft** · NOT_LIVE_VERIFIED |
| PR #513 NCAR | https://github.com/asim1417/hakeem-platform/pull/513 | **Draft** · NOT_LIVE_VERIFIED |
| Integration branch | `cursor/rasd-production-integration-97b5` | This report set |

## Merge policy compliance

- Did **not** merge #512/#513 to main.
- Did **not** convert Draft live PRs to Ready (still NOT_LIVE_VERIFIED).
- Did **not** deploy production worker to Saudi-reachable network (cannot from this agent).
- Did **not** enable auto-apply.

## Deployments attempted / possible

| Target | Result |
|---|---|
| Local staging DB migrate | PASS |
| UQN live staging ingest | PASS (10 docs) |
| Vercel Preview (PR #511 historically) | PASS (web); not a live BOE/NCAR crawler |
| Production web | Not promoted by this agent |
| Production rasd-worker | **Not deployed** |
| Neon production migrate | **Not executed** |

## Rollback plan (documented, not exercised on prod)

1. Keep `RASD_ENABLED` / `RASD_SCHEDULER_ENABLED` / source flags false on web.
2. Stop worker container (`docker compose --profile rasd stop rasd-worker`).
3. Leave monitoring tables in place (additive); do not drop without backup.
4. Use review `rollbackAppliedBatch` if any apply ever occurred (none in this run).
5. Revert git deploy to previous release tag/commit.

## Gate G

**FAIL** — production worker + admin monitoring + live cron not deployed/proven.
