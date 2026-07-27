# Follow-up: NCAR Connector Live Verification

**Proposed branch:** `feat/rasd-ncar-connector-live-verification`  
**Proposed PR title:** Rasd: NCAR Connector Live Verification  
**Depends on:** PR #511 core

## Scope

1. Live connectivity test
2. API / sitemap / RSS / search endpoint discovery
3. Live run of 10 documents
4. Metadata analysis
5. UQN issue linkage when available
6. Snapshots + parser tests + evidence report

## Current status

- Connector: **IMPLEMENTED**
- Live: **NOT_LIVE_VERIFIED**
- Reason: TLS ECONNRESET after ClientHello
- Certification: **DEGRADED**
- Flag default: `RASD_SOURCE_NCAR_ENABLED=false`

Do not describe NCAR as CONNECTED / WORKING / LIVE / VERIFIED until acceptance passes.
