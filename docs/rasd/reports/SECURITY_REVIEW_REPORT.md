# SECURITY_REVIEW_REPORT

**Generated:** 2026-07-27  
**Scope:** Rasd monitoring engine on branch `cursor/rasd-production-integration-97b5`

## Controls present in code

| Control | Status | Location / notes |
|---|---|---|
| SSRF allowlist + private IP block | Implemented | `lib/modules/rasd/connectors/url-guard.ts` + `http.ts`; unit tests deny non-allowlisted hosts |
| Redirect target re-validation | Implemented in HTTP client path | url-guard on redirects |
| Cron auth (secret / bearer) | Implemented | `app/api/cron/rasd-*`; tests in `test-rasd-cron-auth.ts` |
| Scheduler default OFF | Implemented | `RASD_SCHEDULER_ENABLED=false` |
| Auto-apply default OFF | Implemented | `RASD_AUTO_APPLY_ENABLED=false` + prod URL refuse helper |
| RBAC permissions | Implemented | RASD_VIEW/REVIEW/APPLY/ADMIN; `test-rasd-rbac.ts` PASS |
| Content treated untrusted | Design | HTML stripped in normalize/parse; no script execution |
| Audit subjects | Migration adds AuditSubject `RASD` | Applied on staging |
| Secrets in repo | None for production | Worker expects env; compose uses `${DATABASE_URL}` |
| Circuit breaker | Added | `connectors/circuit-breaker.ts` wired in orchestrator |
| Distributed run lock | Present | `rasd_run_locks` + lock manager |

## Gaps blocking production security gate

1. **No production Secret Manager wiring** proven in this environment.
2. **Worker health endpoint** not yet a separate authenticated internal service (admin page exists; worker writes `reports/rasd/worker-health.json` locally).
3. **Dependency CVE scan** not executed as a dedicated gate in this run (no `npm audit` signed evidence attached).
4. **CSRF** on admin actions relies on existing admin session model — not re-audited end-to-end against production auth providers here.
5. **PDF size/time/page limits** — code paths exist for attachments; not live-proven on BOE/NCAR PDFs (unreachable).

## Abuse scenarios checked

- Public cron without secret → rejected (unit)
- Preview cron disabled by default → PASS
- Trainee cannot APPLY/ADMIN → PASS

## Gate impact

Security foundations: **partial PASS**  
Full production security closure: **FAIL** until runner + secrets + dependency scan + live PDF path are proven.
