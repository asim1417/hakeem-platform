# RASD weekly cron

Vercel runs the weekly RASD cron at:

- Path: `/api/cron/rasd/weekly`
- Schedule: `0 0 * * 6`

This is Saturday 00:00 UTC, which equals Saturday 03:00 Asia/Riyadh.
Saudi Arabia uses AST (UTC+3) and does not observe daylight saving time.
