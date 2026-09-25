# Clerk Production Cutover — Hakeem (read-only until APPROVED_FOR_CUTOVER)

**Status:** Phase 0–3 deliverables ready · **Production keys NOT swapped**  
**Vercel project:** `hakeem-platform` · **Domain:** `hakeemai.net`  
**Stack:** `@clerk/nextjs` only (no Auth.js / NextAuth / Supabase Auth)  
**PR:** code-only Preview-safe changes; cutover blocked until literal `APPROVED_FOR_CUTOVER`

---

## 1) Truth table (Phase 0 + live smoke)

| Environment | Publishable class | Masked fingerprint | Frontend API host | Notes |
|---|---|---|---|---|
| Production site (`hakeemai.net`) | **`pk_test`** | `pk_test_…V2JA` · fp `871921e6` | `safe-elk-50.clerk.accounts.dev` | CSP allows `*.clerk.accounts.dev` |
| Preview (Vercel) | Not mutated | Keys present — do not swap | Keep Development / test | Never put `pk_live` in Preview |

**Gate → Path A** (Production is `pk_test`). Do not create/swap live keys in this run.

### Live smoke (2026-09-25, read-only)

| Check | Result |
|---|---|
| `GET /api/auth/providers` | `google: true`, `apple: false`, `microsoft: false`, `password: false` (pre-deploy); `launchReady: true` |
| `/sign-in` | Google visible; Apple / Microsoft / magic not shown |
| `GET /api/auth/google?next=/dashboard` | `307` → `accounts.google.com` (native Google start) |
| Unauthenticated `/dashboard`, `/admin`, `/onboarding` | `307` → Clerk handshake `dev-browser-missing` on `safe-elk-50.clerk.accounts.dev` |
| `/forgot-password` on live | `404` until this PR deploys Preview/Production build |

---

## 2) Changes by environment (allowed now vs blocked)

| Change | Preview | Production | Status |
|---|---|---|---|
| Feature flags Apple / Microsoft public / phone / magic (default off) | ✅ code | ✅ code (flags stay 0) | In PR |
| `/api/auth/providers` announces enabled strategies only | ✅ | ✅ after deploy | In PR |
| `LoginForm` harden (no hardcoded password; gated Microsoft/magic) | ✅ | ✅ after deploy | In PR |
| Abstract auth telemetry (no email/phone/token) | ✅ | ✅ after deploy | In PR |
| `.env.example` documents flags | ✅ | n/a | In PR |
| Swap Clerk `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | ❌ keep test | ❌ **blocked** | Needs `APPROVED_FOR_CUTOVER` |
| Create Clerk Production instance / permanent keys | ❌ | ❌ **blocked** | Needs approval |
| Enable Apple / phone / Microsoft Social for public | Preview test only | ❌ until ready | Post-approval |
| Magic link public | ❌ | ❌ | Explicit product decision |

**Preview-only recommended flags (never set live until approved + tested):**

```text
AUTH_APPLE_ENABLED=0
AUTH_MICROSOFT_PUBLIC_ENABLED=0
AUTH_PHONE_ENABLED=0
AUTH_MAGIC_LINK_PUBLIC_ENABLED=0
```

---

## 3) Redirect / origin checklist

| Provider | Allowed origins / redirect URIs |
|---|---|
| Clerk | `https://hakeemai.net`, `https://www.hakeemai.net`, Vercel Preview host(s), `/sso-callback`, `/auth/continue` |
| Google (native) | JS origins + redirect → `https://hakeemai.net/api/auth/callback/google` (+ Preview callback) |
| Apple | Services ID return URL from Clerk (when enabled) |
| Microsoft Social | Clerk-managed callback (when enabled) — **not** manual Entra `/api/auth/microsoft` |

---

## 4) User / data link plan (Path A — after approval)

1. Numeric inventory only: users, sign-in methods, rows with `User.clerkId`.
2. Reversible mapping table: `legacy_clerk_user_id` → `internal_app_user_id` → `new_clerk_user_id`.
3. Passwords: Clerk-supported reset/activation only — **never** copy password hashes.
4. Keep Preview on Development/`pk_test`. Never put Production keys in Preview.
5. Swap **both** Production Clerk keys together → single deploy → monitor.
6. Do not delete old Clerk instance/users during watch window.

Prisma link field today: `User.clerkId` (+ `passwordHash` for first-party password).

---

## 5) Rollback

| Trigger | Action |
|---|---|
| Sign-in failure spike / OAuth loop / session loss | Restore previous Production Clerk key pair; redeploy last known good |
| Bad feature flag | Set flag to `0`; no key change |
| Data link mismatch | Stop cutover; keep legacy `clerkId`; repair mapping offline |

---

## 6) Enablement order (post-approval)

| Method | Decision | Show when |
|---|---|---|
| Email + password | Core | Verify + reset + error paths pass |
| Google | Core when green | New + returning + protected `next` return |
| Phone / SMS | Later | Plan, cost, countries, rate limit, OTP, test account |
| Apple | Later | Apple Developer Team + Services ID + Team/Key IDs + private key + Clerk return URL |
| Microsoft Social | Later | Clerk Social Connection (not Enterprise Entra SSO) |
| Entra SSO | Deferred | Explicit enterprise product decision |
| Magic link | Deferred | Explicit product decision + mail delivery + UI tests |

---

## 7) Acceptance tests run (local / static — this agent)

```text
test-auth-providers-visibility: OK
test-production-auth: OK
test-google-popup-auth: OK
test-password-reset: OK
test-home-google-signin: OK
test-oauth-only-signin: OK
test-owner-emergency: OK
test-middleware-gate: OK
test-firstparty-session: OK
test-clerk-config: OK
test-clerk-off-home: OK
test-ssr-oauth-start: OK
test-unify-home-auth: OK
test-signin-iphone-isolation: OK
test-auth-continue: OK
test-oauth-false-fail: OK
```

Interactive Preview account tests (create/sign-in/reset/Google round-trip) remain for human QA on a Preview deployment of this PR.

---

## 8) Explicit stop

No Vercel Production/Preview secret edits, no Clerk dashboard / OAuth / billing mutations, no permanent key creation, no Production user mutation were performed.

**Next human action:** deploy/test Preview → reply with the literal string `APPROVED_FOR_CUTOVER` to authorize Path A key cutover.
