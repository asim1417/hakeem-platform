# Follow-up: BOE Connector Live Verification

**Proposed branch:** `feat/rasd-boe-connector-live-verification`  
**Proposed PR title:** Rasd: BOE Connector Live Verification  
**Depends on:** PR #511 core merge (or rebase onto cleaned core branch)

## Scope (only)

1. Health check from Vercel Preview / GitHub Actions / authorized runner
2. TLS diagnosis
3. Discover official endpoint / sitemap / API if present
4. Live run of 10 documents
5. Persist snapshots
6. Parser tests against live samples
7. Evidence report
8. No core engine changes unless proven necessary

## Acceptance

- TLS success + HTTP success
- 10 documents discovered and basic fields extracted
- Snapshot hashes stored
- No SSRF bypass / site circumvention
- Live evidence report

## Current status (as of PR #511 freeze)

- Connector: **IMPLEMENTED**
- Live: **NOT_LIVE_VERIFIED**
- Reason: TLS ECONNRESET after ClientHello
- Certification: **DEGRADED**
- Flag default: `RASD_SOURCE_BOE_ENABLED=false`

## Staged artifacts in this folder

Copied from the oversized PR #511 for continuation — not proof of live success.
