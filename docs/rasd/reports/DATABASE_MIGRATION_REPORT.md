# DATABASE_MIGRATION_REPORT

**Generated:** 2026-07-27  
**Target exercised:** local staging PostgreSQL `rasd_preview` @ 127.0.0.1  
**Production Neon:** **not** migrated from this agent (no production DATABASE_URL)

## Commands executed

| Command | Result |
|---|---|
| `npx prisma validate` | PASS — schema valid |
| `npx prisma generate` | PASS — client v5.22.0 |
| `npx prisma migrate status` | PASS — “Database schema is up to date!” (22 migrations) |

## Rasd migration

- Name: `20260727120000_add_rasd_monitoring`
- Applied on staging: `finished_at 2026-07-27 15:10:19+00`
- Creates monitoring_* / monitored_* / source_* / rasd_* tables with unique keys (e.g. `canonical_identity_key`), indexes, FKs
- Does **not** mutate legal library content

## Staging data after UQN live

| Table | Count |
|---|---|
| monitored_legal_documents | 12 |
| monitored_document_versions | 10 |
| source_snapshots (UQN) | 20 |
| monitoring_runs | ≥2 COMPLETED |
| legal_systems | 2 (unchanged) |
| legal_articles | 2 (unchanged) |
| source_conflicts | 0 |

## Idempotency / constraints

- Unique `canonical_identity_key` on monitored documents
- Second UQN persist: documentsNew=0, documentsUnchanged=10
- `RASD_AUTO_APPLY_ENABLED=false` — no direct library writes
- Pending review status default `REQUIRES_REVIEW`

## Rollback / forward-fix

- Migration is additive (`CREATE TABLE IF NOT EXISTS` pattern in SQL)
- Forward-fix: re-run `prisma migrate deploy` on authorized host
- Rollback of applied library changes: review `rollbackAppliedBatch` path (not exercised on production)
- **Production migrate deploy:** NOT RUN (no prod credentials)

## Gate E

Staging migrate: **PASS**  
Production migrate: **FAIL / NOT EXECUTED**
