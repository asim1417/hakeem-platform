# RUNNER_NETWORK_VERIFICATION_REPORT

**Generated:** 2026-07-27T20:16:00Z  
**Branch:** `cursor/rasd-production-integration-97b5`  
**Runner:** Cursor Cloud Agent (AWS egress)  
**Raw evidence:** `RUNNER_NETWORK_VERIFICATION_RAW.json`, `RUNNER_NETWORK_DIAGNOSIS_RAW.json`

## Environment

| Field | Value |
|---|---|
| Runner | cursor-cloud-agent |
| Egress IPv4 (ipify) | `54.158.128.7` (later probe); earlier diagnosis `3.217.89.139` |
| IPv4 support | Yes |
| Fixed egress | No (ephemeral cloud IP) |
| Secret Manager | Not provisioned in this agent (local staging DB only) |
| Worker separation | Code path exists (`scripts/rasd/worker.ts` + docker profile `rasd`) — **not deployed** to a Saudi-reachable host |

## Layer results (live)

| Source | Host | DNS | TCP:443 | TLS | HTTP |
|---|---|---|---|---|---|
| BOE | laws.boe.gov.sa → 66.9.136.215 | PASS | PASS (~0–3ms) | **FAIL** `Connection reset by peer` / `read ECONNRESET` after ClientHello | FAIL (skipped) |
| BOE | boe.gov.sa → 66.9.136.214 | PASS | PASS | **FAIL** ECONNRESET | FAIL |
| NCAR | ncar.gov.sa → 66.9.128.33 | PASS | PASS | **FAIL** ECONNRESET | FAIL |
| NCAR | www.ncar.gov.sa → 66.9.128.33 | PASS | PASS | **FAIL** ECONNRESET | FAIL |
| UQN | www.uqn.gov.sa | PASS | PASS | **PASS** | **PASS** (200) |

TLS variants tried on BOE/NCAR: default, TLS1.2-only, TLS1.3-only — all reset. Not a missing SNI bug (SNI present). Certificates never presented.

## Failure classification

| Hypothesis | Verdict |
|---|---|
| DNS | Ruled out (resolves) |
| TCP | Ruled out (connects) |
| TLS/SNI | **Primary failure:** reset during handshake |
| IPv6 | N/A (A records only) |
| Bad client cert store | Unlikely — handshake never completes; UQN TLS works from same host |
| Datacenter IP block / WAF geo policy | **Most likely** for BOE/NCAR (`66.9.*`) |
| Rate limiting | Unlikely (immediate reset, no HTTP) |
| Redirect / User-Agent | Not reached (pre-HTTP) |
| Deployment Protection | Separate issue on Vercel Preview SSO for probe endpoint |
| GitHub Actions | DNS PASS, **TCP timeout** to BOE/NCAR (different failure mode) |

## Unauthorized methods

No CAPTCHA/WAF bypass, no unofficial proxies, no residential tunneling.

## Required runner for PRODUCTION_READY

A persistent worker with:

1. Outbound IPv4 that completes TLS to `laws.boe.gov.sa` and `ncar.gov.sa`
2. Prefer Saudi/regional VPS or self-hosted runner after live TLS proof
3. Secrets via Secret Manager (not repo)
4. Separate from Next.js web tier
5. Health endpoint internal-only

**This Cursor Cloud Agent cannot satisfy BOE/NCAR TLS.** Worker compose profile is prepared but cannot be certified LIVE from this network.

## Decision for network gate

**FAIL** for BOE + NCAR live path from available runners.  
**PASS** for UQN from Cursor Cloud Agent.
