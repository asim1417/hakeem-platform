# PARSER_LIVE_RESULTS_REPORT

**Generated:** 2026-07-27

## Summary

| Source | Live docs parsed | Crash-free | Field completeness | Notes |
|---|---|---|---|---|
| UQN | 10 (staging) | Yes | Low–medium | Sitemap XML; title often URL; instrument fields null; type OTHER |
| BOE | 0 | N/A | N/A | TLS blocked — no live parse |
| NCAR | 0 | N/A | N/A | TLS blocked — no live parse |

## UQN live sample metrics

From `UQN_LIVE_PRODUCTION_REPORT.json`:

- All 10 samples: `httpStatus: 200`, `contentType: text/xml; charset=utf-8`
- `parserConfidence: 0.65` each
- Stable `rawHash` / `normalizedHash` present (fingerprint OK)
- Second persist run: 10 unchanged → fingerprint + identity key dedupe works

## Fixture parsers (not live evidence)

Unit tests pass on BOE/NCAR/UQN fixtures (`test:rasd` structure/diff/conflict). Fixtures ≠ production live proof.

## Baseline dry-run parse→match

Run `cms3nzhwz0000d3k0emcvsp58`: 20 fetched, 0 failed, 10 NEW_DOCUMENT changes, 0 conflicts. Match against Hakeem library: NO_MATCH (library has only 2 systems in staging).

## Gate impact

Parser live path **PASS only for UQN staging** with quality caveats. BOE/NCAR live parser gates **FAIL**.
