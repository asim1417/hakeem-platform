# Architecture — Rasd Local Bridge

```
[Admin UI /admin/rasd/agents]
        |  create pairing / jobs (RBAC)
        v
[Hakeem Cloud]
  - pairing codes
  - signed job queue
  - result ingest (staging only)
  - comparison / review
        ^
        |  long-poll claim + heartbeat + signed uploads
        |  (agent initiates outbound HTTPS only)
        |
[Rasd Local Agent in KSA]
  - Ed25519 device key
  - LocalHttpTransport → BOE / NCAR / UQN
  - localhost status UI :8788
  - optional OS service
```

Execution modes:

| Source | Default mode |
|---|---|
| BOE | LOCAL_REQUIRED |
| NCAR | LOCAL_REQUIRED |
| UQN | CLOUD (or LOCAL) |

Cloud never silently falls back to Vercel for LOCAL_REQUIRED sources.
