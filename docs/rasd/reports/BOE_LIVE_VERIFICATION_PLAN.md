# Rasd: BOE Connector Live Verification

**Branch:** `feat/rasd-boe-connector-live-verification`  
**Depends on:** core PR #511  
**Status:** NOT_LIVE_VERIFIED — TLS ECONNRESET after ClientHello

## Goal
Prove live BOE connectivity from an authorized Preview/Actions/runner environment.

## Acceptance
- TLS success, HTTP success, 10 documents, snapshots, parser evidence
- No SSRF bypass
- Do not mark CONNECTED/WORKING/LIVE/VERIFIED until acceptance passes

## Artifacts restored for continuation
- GitHub Actions workflow `rasd-source-health.yml`
- `scripts/rasd/probe-sources-live.ts`
- Prior TLS/live probe reports (evidence of failure, not success)
