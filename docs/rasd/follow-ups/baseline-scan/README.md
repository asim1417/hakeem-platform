# Follow-up (later): Official Sources Baseline Scan

**Proposed branch:** `feat/rasd-baseline-scan`  
**Proposed PR title:** Rasd: Official Sources Baseline Scan

**Gate:** start only after ≥2 connectors are LIVE_VERIFIED.

## Scope

- Baseline scan, resumability, pagination, checkpointing
- Deduplication, retries, coverage reports, dry-run
- No writes to Hakeem legal library

Staged note: core already contains thin `scan/baseline.ts` abstractions for fixtures; production-scale baseline belongs here.
