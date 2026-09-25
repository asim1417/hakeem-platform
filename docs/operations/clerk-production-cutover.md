# Clerk Production Cutover — Hakeem (read-only until APPROVED_FOR_CUTOVER)

**Status:** Phase 0 complete · Phase 1 code PR only · **waiting for `APPROVED_FOR_CUTOVER`**  
**Vercel project:** `hakeem-platform` · **Domain:** `hakeemai.net`  
**Stack:** `@clerk/nextjs` only (no Auth.js / NextAuth / Supabase Auth)

---

## Decision gate (Phase 0)

| Environment | Publishable key class | Masked fingerprint | Frontend API host |
|---|---|---|---|
| Production site (`hakeemai.net`) | **`pk_test`** | `pk_test_…V2JA` · fp `871921e6` | `safe-elk-50.clerk.accounts.dev` |
| Preview (Vercel) | Not mutated this run | Keys exist in Preview env (do not swap) | Keep on Development / test |

**CSP on live site:** allows `*.clerk.accounts.dev` (Development-style host pattern).

**Unauthenticated protected routes (no session):** `/dashboard`, `/admin`, `/onboarding` → `307` to  
`https://safe-elk-50.clerk.accounts.dev/v1/client/handshake?...&__clerk_hs_reason=dev-browser-missing`  
(confirms Development Frontend API on the public Production site).

### Gate result → **Path A**

Production publishable key is **`pk_test`**. Therefore:

1. **Do not** create a new Production instance yet from this agent.
2. **Do not** swap Vercel Production Clerk keys.
3. Prepare an independent cutover (inventory + ID mapping + password journey) and ship **Preview-only** feature flags first.
4. Cutover only after the literal approval string: `APPROVED_FOR_CUTOVER`.

If a live (`pk_live`) workspace exists elsewhere, treat Path A as the verified public surface and resolve workspace access separately before any key change.

---

## Repo inventory (auth surface)

| Area | Finding |
|---|---|
| Primary UI | `/sign-in`, `/sign-up` via `AuthOauthButtons` (Google + optional Apple flag) |
| Email/password | `EmailPasswordSignIn` + `/forgot-password` / `/reset-password` (local bcrypt path) |
| Google | Native `/api/auth/google` (+ popup) preferred; Clerk fallback when allowed |
| Apple | Behind `AUTH_APPLE_ENABLED` (default off) |
| Microsoft public | Behind `AUTH_MICROSOFT_PUBLIC_ENABLED` (default off); Entra manual route redirects to `/sign-in` |
| Phone / SMS | Behind `AUTH_PHONE_ENABLED` (default off) |
| Magic link | Behind `AUTH_MAGIC_LINK_PUBLIC_ENABLED` (default off); legacy UI gated |
| User link | Prisma `User.clerkId` (+ `passwordHash` for first-party password) |
| Middleware | `clerkMiddleware` + `hakeem_session`; protected: `/dashboard`, `/admin`, `/audit-logs`, `/onboarding` |

---

## Phase 1 code changes (this PR — no Production env edits)

- Feature flags for Apple / Microsoft public / phone / magic (off by default).
- `/api/auth/providers` announces only enabled public strategies.
- `LoginForm` hardened: no hardcoded password fill; Microsoft & magic only if providers API says so.
- `AuthOauthButtons` remains Google (+ Apple when flagged); no public Entra / phone / magic buttons.

**Preview-only flags (never set on Production until approved):**

```text
AUTH_APPLE_ENABLED=0
AUTH_MICROSOFT_PUBLIC_ENABLED=0
AUTH_PHONE_ENABLED=0
AUTH_MAGIC_LINK_PUBLIC_ENABLED=0
```

---

## Enablement order (post-approval)

| Method | Decision | Show when |
|---|---|---|
| Email + password | Core | Verify + reset + error paths pass |
| Google | Core when green | New + returning + protected return |
| Phone / SMS | Later | Plan, cost, countries, rate limit, OTP, test account |
| Apple | Later | Apple Developer Team + Services ID + Team/Key IDs + private key + Clerk return URL |
| Microsoft Social | Later | Clerk Social Connection (not Enterprise Entra SSO) |
| Entra SSO | Deferred | Explicit enterprise product decision |
| Magic link | Deferred | Explicit product decision + mail delivery + UI tests |

---

## Path A cutover plan (after approval only)

1. Create Clerk **Production** instance for the correct app; verify `hakeemai.net` domains.
2. Copy **non-secret** settings only (strategies, URLs). Do **not** assume user/OAuth migration.
3. Keep Preview on Development/`pk_test`. Never put Production keys in Preview.
4. Numeric inventory only: user counts, sign-in methods, rows with `clerkId`.
5. Reversible mapping: `legacy_clerk_user_id` → `internal_app_user_id` → `new_clerk_user_id`.
6. Passwords: Clerk-supported reset/activation journey only — **never** copy hashes.
7. Swap **both** Production Clerk keys together → single deploy → monitor.
8. On P0 auth failure: restore previous key pair + redeploy immediately. Do not delete old instance/users during watch window.

---

## Redirect / origin checklist (fill before cutover)

| Provider | Allowed origins / redirect URIs |
|---|---|
| Clerk | `https://hakeemai.net`, `https://www.hakeemai.net`, Preview host(s), `/sso-callback`, `/auth/continue` |
| Google | Authorized JS origins + redirect → `/api/auth/callback/google` |
| Apple | Services ID return URL from Clerk dashboard (when enabled) |
| Microsoft Social | Clerk-managed callback (when enabled) |

---

## Rollback

| Trigger | Action |
|---|---|
| Sign-in failure rate spike / OAuth loop / session loss | Revert Production Clerk key pair to previous values; redeploy last known good |
| Bad feature flag | Set flag to `0` on Preview/Production; no key change |
| Data link mismatch | Stop cutover; keep legacy `clerkId` rows; repair mapping offline |

**Do not** delete the old Clerk instance or users during the monitoring window.

---

## Acceptance tests (Preview / test accounts only)

1. Email/password: create, verify, sign-in, sign-out, reset.
2. Google: new + returning + return to requested `next`.
3. Protected routes + admin roles (server-side).
4. Phone (when on): valid, bad/expired OTP, rate limit, SMS fail — generic errors only.
5. Apple / Microsoft (when on): new + returning; Apple Hide My Email.
6. Mobile + RTL + a11y.
7. No secrets/tokens in HTML or logs.
8. Documented rollback drill before Production cutover.

---

## Explicit non-actions (until `APPROVED_FOR_CUTOVER`)

- No Vercel Production/Preview secret edits.
- No Clerk dashboard / OAuth / billing mutations.
- No permanent key creation.
- No Production user or data mutation.
- No printing of secrets, passwords, or OTP.
