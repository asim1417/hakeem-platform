# STAGING_CRON_REPORT

**Generated:** 2026-07-27

## Intended staging schedule

- Day: Saturday
- Local: 03:00 Asia/Riyadh (UTC+3, no DST)
- UTC cron: `0 0 * * 6`

## What was tested in this agent

| Item | Result |
|---|---|
| Cron auth unit tests (`test-rasd-cron-auth`) | **PASS** (reject missing secret; accept `x-cron-secret` / bearer; preview disabled; scheduler flag) |
| `RASD_SCHEDULER_ENABLED` default | **false** |
| Production cron registration | **Not enabled** (forbidden this round) |
| Staging automatic Saturday tick | **Not registered** (no Saudi/staging scheduler host) |
| Manual authorized trigger against staging endpoint | **Not executed** (no deployed staging web+secret pair in this agent) |
| Alert on cron failure | Code path via `sendRasdAlert({ kind: "CRON_FAILURE" })` available; external webhook not configured |

## Worker-related substitute evidence

- Worker refuses start when `RASD_ENABLED=false` (**PASS**)
- Worker once-run UQN dry-run COMPLETED with dedupe unchanged docs (**PASS**)
- Health token pattern 401/200 proven (**PASS** for auth model)

## Gate

Staging cron automatic success: **FAIL / NOT PROVEN**.  
Do not enable production cron.
