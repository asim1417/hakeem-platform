# STAGING_COMPARISON_REPORT

**Generated:** 2026-07-27  
**Mode:** read-only vs `legal_*` · writes only in monitoring/review tables · **no apply**

## Library size (staging surrogate)

- `legal_systems`: 2  
- `legal_articles`: 2  

## Monitored corpus after limited live attempt

- `monitored_legal_documents`: 29 (mix of prior UQN staging + new legislative-filtered docs + fixtures leftovers)
- Live BOE docs: **0**
- Live NCAR docs: **0**
- Live UQN legislative fetch this scan: **7** (dry-run)

## Comparison classes (honest)

With only 2 Hakeem systems in staging, a meaningful 30-document multi-source match matrix cannot be certified.

Observed from prior baseline dry-run + this scan:

| Class | Result |
|---|---|
| exact | 0 live legislative exact matches against the 2-system library |
| probable | not scored at production quality (library too small) |
| ambiguous | n/a |
| no match | dominant for new UQN docs (`NO_MATCH` / `NEW_DOCUMENT`) |
| metadata differences | n/a (no exact pairs) |
| text differences | n/a |
| parser warnings | titles/instruments may still emit `MISSING_*` / issue-vs-decree warnings (parser hardened to prefer null+warning) |
| source conflicts | 0 in this scan |

## Gate

Staging comparison of 30 live docs (10×3): **FAIL** — BOE/NCAR absent; UQN <10 legislative in this run; library staging incomplete vs production.
