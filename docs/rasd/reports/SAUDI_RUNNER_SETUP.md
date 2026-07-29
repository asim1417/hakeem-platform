# SAUDI_RUNNER_SETUP

**Purpose:** Operate Rasd live connectors (BOE / NCAR / UQN) from an authorized network path inside the Kingdom (or an egress IP accepted by the official sources).

**Status of this document:** Playbook + acceptance checklist.  
**This Cursor Cloud Agent does not host a Saudi runner.** BOE/NCAR remain TLS-blocked from AWS/GHA egress until a Saudi/authorized runner executes the probes below.

---

## 1. Allowed environment types (priority order)

1. VPS inside Saudi Arabia (preferred for sticky egress).
2. On-prem / enterprise server inside KSA.
3. Self-hosted GitHub Actions runner labeled for Rasd (KSA network).
4. Regional cloud with **Saudi egress** and written authorization.

Forbidden: anonymous residential proxies, CAPTCHA farms, WAF bypass services.

---

## 2. Baseline machine profile

| Item | Requirement |
|---|---|
| OS | Ubuntu 22.04/24.04 LTS (or stable Linux) |
| Runtime | Node.js matching repo (20+ / 22 / 24 as in CI) |
| Tools | `git`, `curl`, `openssl`, `build-essential` as needed |
| Network | Outbound HTTPS (443) to official `.gov.sa` hosts |
| Egress | Static IPv4 if possible (store privately; **do not publish in PRs**) |
| Exposure | No public inbound for worker UI; SSH key-only; firewall default deny |
| Identity | Non-root service user (e.g. `rasd`) |
| Secrets | Env file or Secret Manager only — never committed |

---

## 3. Hardening checklist

- [ ] UFW/nftables: allow SSH from admin CIDRs only; allow health port only on localhost or private VPC.
- [ ] Fail2ban or equivalent on SSH.
- [ ] Unattended upgrades for security patches.
- [ ] Separate Linux user `rasd` without sudo for day-to-day runs.
- [ ] `RASD_WORKER_HEALTH_PORT` bound to `127.0.0.1` + `RASD_WORKER_HEALTH_TOKEN`.
- [ ] Staging `DATABASE_URL` only until readiness gates pass.
- [ ] `RASD_AUTO_APPLY_ENABLED=false` always on this runner until human approval.

---

## 4. Bootstrap (operator runbook)

```bash
# as admin
sudo adduser --system --group --home /opt/rasd rasd
sudo mkdir -p /opt/rasd/app /opt/rasd/logs /opt/rasd/secrets
sudo chown -R rasd:rasd /opt/rasd

# as rasd
cd /opt/rasd/app
git clone <private-repo-url> .
git checkout cursor/rasd-production-integration-97b5   # or approved tag
npm ci
npx prisma generate

# secrets (example paths — do not commit)
install -m 600 /dev/null /opt/rasd/secrets/rasd.env
# edit rasd.env with DATABASE_URL (Neon staging), RASD_* flags, tokens
```

Minimal `rasd.env` keys (values private):

```
RASD_ENABLED=true
RASD_AUTO_FETCH_ENABLED=true
RASD_WORKER_ENABLED=true
RASD_WORKER_DRY_RUN=true
RASD_AUTO_APPLY_ENABLED=false
RASD_REVIEW_REQUIRED=true
RASD_STAGING_OK=1
RASD_SOURCE_UQN_ENABLED=true
RASD_SOURCE_BOE_ENABLED=true
RASD_SOURCE_NCAR_ENABLED=true
RASD_CIRCUIT_BREAKER_ENABLED=true
RASD_WORKER_HEALTH_PORT=8787
RASD_WORKER_HEALTH_TOKEN=<random>
RASD_CRON_SECRET=<random>
RASD_ALERT_WEBHOOK_URL=<staging-webhook-optional>
DATABASE_URL=<neon-staging-url>
RASD_RUNNER_LABEL=ksa-self-hosted
RASD_RUNNER_REGION=sa-central-or-equivalent
```

---

## 5. Connectivity proof (mandatory before live scan)

```bash
set -a; source /opt/rasd/secrets/rasd.env; set +a
npm run rasd:saudi:connectivity
# writes docs/rasd/reports/SAUDI_RUNNER_CONNECTIVITY_RAW.json
```

Also keep shell evidence privately (not in git if it contains IPs):

```bash
for host in laws.boe.gov.sa ncar.gov.sa www.uqn.gov.sa; do
  echo "==== $host ===="
  getent ahostsv4 "$host" | head
  timeout 10 bash -c "cat < /dev/null > /dev/tcp/$host/443" && echo TCP_OK || echo TCP_FAIL
  echo | timeout 12 openssl s_client -connect "$host:443" -servername "$host" 2>&1 | sed -n '1,25p'
done
```

**Acceptance:** BOE + NCAR + UQN all `HEALTHY` in the Node+curl report (`classification: HEALTHY`), including **Node `rasdFetch` path**.

---

## 6. Staging live scan (dry-run)

```bash
npx prisma migrate deploy   # Neon staging only
npm run rasd:staging:live-scan
# two passes for dedupe; auto-apply forced off
```

Then worker smoke:

```bash
RASD_WORKER_ONCE=true RASD_WORKER_LIMIT=10 npm run rasd:worker
curl -sS -H "x-rasd-worker-token: $RASD_WORKER_HEALTH_TOKEN" http://127.0.0.1:8787/health
```

---

## 7. Staging cron (Saturday 03:00 Asia/Riyadh)

Riyadh is UTC+3 (no DST) → **Saturday 00:00 UTC**.

Examples:

- systemd timer / crontab on the runner calling a signed local script
- or GitHub Actions `schedule: "0 0 * * 6"` on **self-hosted KSA** runner hitting staging weekly endpoint with `CRON_SECRET`

Never enable production cron in this phase.

---

## 8. Self-hosted GitHub Actions label

Suggested labels: `self-hosted`, `linux`, `rasd`, `saudi`.

Workflow: `.github/workflows/rasd-saudi-runner.yml` (workflow_dispatch + optional schedule).  
`runs-on: [self-hosted, linux, rasd, saudi]`

Until such a runner is registered and green, CI on `ubuntu-latest` remains **evidence of foreign-egress failure**, not Saudi success.

---

## 9. What not to put in public reports

- Raw egress IP addresses
- SSH keys, tokens, DATABASE_URL
- Full document bodies

Use hashed IP prefixes in JSON reports if needed (`SAUDI_RUNNER_CONNECTIVITY` already hashes resolved A records).

---

## 10. Operator sign-off fields

| Field | Value |
|---|---|
| Environment type | _fill on Saudi host_ |
| Region | _fill_ |
| OS | _fill_ |
| Runner label | _fill_ |
| Connectivity commit | _fill_ |
| Operator | _fill_ |
| Date (UTC) | _fill_ |
