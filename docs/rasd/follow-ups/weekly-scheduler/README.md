# Follow-up (later): Weekly Scheduler

**Proposed branch:** `feat/rasd-weekly-scheduler`  
**Proposed PR title:** Rasd: Weekly Scheduler

## Scope

- Vercel cron registration (`vercel.json`)
- CRON_SECRET protection (route already in core)
- UTC conversion, lock, retries, partial handling, notifications, scheduler health

## Gate

Do not call the scheduler “working” until proven on Vercel Preview.

Core keeps cron route + auth tests with `RASD_SCHEDULER_ENABLED=false` by default.
`vercel.json` was removed from PR #511 and staged here.
