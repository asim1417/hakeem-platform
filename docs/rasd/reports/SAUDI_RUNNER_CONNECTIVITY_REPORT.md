# SAUDI_RUNNER_CONNECTIVITY_REPORT

**Generated:** 2026-07-27T22:32:28Z  
**Raw JSON:** `SAUDI_RUNNER_CONNECTIVITY_RAW.json`  
**Setup playbook:** `SAUDI_RUNNER_SETUP.md`

## Runner used for this evidence

| Field | Value |
|---|---|
| Type | Cursor Cloud Agent (AWS foreign egress) — **not** a Saudi runner |
| Label | `cursor-cloud-agent-not-saudi` |
| Region hint | `aws-us-foreign-egress` |
| Egress IP | Omitted from public report |
| Saudi VPS / self-hosted KSA | **Not available to this agent** |

Commands:

```bash
RASD_RUNNER_LABEL=cursor-cloud-agent-not-saudi \
RASD_RUNNER_REGION=aws-us-foreign-egress \
npm run rasd:saudi:connectivity
```

Evidence layers: DNS, TCP:443, TLS+SNI (Node `tls` + `openssl s_client`), HTTP (`curl`), **Node `rasdFetch`** (same path as connectors).

## Classification

| Source | DNS | TCP | TLS | HTTP (curl) | Node rasdFetch | Class |
|---|---|---|---|---|---|---|
| BOE | PASS | PASS | **FAIL** ECONNRESET | FAIL | FAIL | **TLS_BLOCKED** |
| NCAR | PASS | PASS | **FAIL** ECONNRESET | FAIL | FAIL | **TLS_BLOCKED** |
| UQN | PASS | PASS | PASS | PASS | PASS | **HEALTHY** |

## Interpretation

BOE/NCAR failure remains **pre-HTTP TLS reset** from foreign datacenter egress. Not User-Agent, not redirect, not captcha (never reached). No anonymous proxy or WAF bypass was attempted.

## Gate

Saudi-runner connectivity gate: **FAIL** (no HEALTHY BOE+NCAR from an authorized Saudi runner yet).  
Playbook + self-hosted workflow (`.github/workflows/rasd-saudi-runner.yml`) are ready for an operator-provisioned KSA runner.
