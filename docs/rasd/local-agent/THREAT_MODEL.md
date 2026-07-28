# Threat Model — Hakeem Rasd Local Bridge

## Assets

- Pairing codes (short-lived)
- Agent private keys (device-local)
- Platform job-signing keys
- Staged legislative snapshots
- Admin session / RASD_ADMIN capability

## Trust boundaries

1. Browser admin UI ↔ Hakeem cloud (session auth + RBAC)
2. Local agent ↔ Hakeem cloud (Ed25519 request signatures, nonce, timestamp)
3. Local agent ↔ official `.gov.sa` sources (HTTPS + allowlist + redirect re-validation)
4. Agent sandbox directory ↔ rest of user filesystem (denied by design)

## Threats & controls

| Threat | Control |
|---|---|
| Stolen pairing code | 10-minute TTL, single use, audit log, requires physical/local agent possession to complete keygen |
| Stolen agent private key | Key never uploaded; revoke agent; rotate via re-pair; device OS permissions on identity file mode 0600 |
| Replay | Per-request nonce store + timestamp skew window |
| Job tampering | Platform-signed envelopes; agent verifies before execute |
| Result tampering | Agent-signed payloads + checksum; server verifies |
| SSRF | HTTPS-only allowlist hosts; no free URLs; no private IPs (shared url-guard) |
| DNS rebinding | Resolve/validate host against allowlist before fetch; redirects re-checked |
| Malicious redirects | Manual redirect handling; each hop allowlisted |
| Compromised agent | Typed jobs only; no shell; no arbitrary scripts; revoke + pause |
| Compromised cloud account | RASD_ADMIN RBAC; audit; dry-run default; no auto-apply |
| Oversized uploads | RASD_MAX_RESULT_BYTES / chunk limits |
| Zip bombs | Content-type allowlist; size caps; no archive extraction as code |
| Path traversal | Sandbox dir only; no user path parameters in protocol |
| Log injection | Structured JSON logs; redact secrets |
| RCE | No Remote Shell; no executable delivery from server; no `eval` of job params |
| Unauthorized cancel | Admin permission + job ownership checks |
| Cross-tenant access | Jobs scoped by agentId; claim only own queue |
| LOCAL_REQUIRED bypass | Cloud refuses to execute BOE/NCAR when mode=LOCAL_REQUIRED |

## Non-goals

- Browser-direct scraping of BOE/NCAR as primary path
- Opening inbound ports on user devices
- Auto-apply into production legal library
