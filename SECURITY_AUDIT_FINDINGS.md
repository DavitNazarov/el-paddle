# Security Audit — Findings Register

**Date:** 2026-07-25
**Scope of this pass:** Application-layer review of authentication, session management, CSRF, authorization/RBAC, user & player data isolation, cross-site scripting, open redirects, mass assignment, and realtime/socket authorization. Grounded in the current source, not a re-statement of the prior `SECURITY_REPORT.md` hardening pass.

**Standards referenced:** OWASP Top 10:2021, OWASP API Security Top 10:2023, OWASP ASVS 5.0, CWE.

---

## Summary

| ID | Severity | Category | Title | Status |
|----|----------|----------|-------|--------|
| F-01 | High | XSS (CWE-79) | Stored XSS via JSON-LD injection | 📋 Planned — not yet implemented |
| F-02 | Medium | Secrets (CWE-312/798) | Live Resend API key in working-tree `.env` | ⚠️ Action required (rotate) |
| F-03 | Low–Medium | Data exposure (CWE-200) | Financial PII (IBAN + payee name) exposed to anonymous users | 📋 Planned — decision made, not yet implemented |
| F-04 | Low | Open redirect (CWE-601) | Login `next` param backslash bypass | 📋 Planned — not yet implemented |
| F-05 | Low | CSRF (CWE-352) | Double-submit token not bound to session | ✅ Accepted risk (mitigated) |
| F-06 | Low | Resource control (CWE-770) | In-process rate limiting only | ✅ Accepted for single-host topology |

> **This document is plan-only. No code changes have been applied.** Every remediation below is a recommendation with a verified approach; implement when approved.

**Overall security score:** 82/100. **Production readiness:** READY WITH OPS (unchanged), contingent on F-02 rotation and implementing F-01 (live High XSS) + F-03.

---

## Findings

### F-01 — Stored XSS via JSON-LD injection `[HIGH]` 📋 Planned

- **Category:** Cross-Site Scripting — CWE-79 / OWASP A03:2021 (Injection)
- **CVSS (est.):** 7.4 (AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:L/A:N)
- **Confidence:** Confirmed
- **Affected files:**
  - `frontend/src/components/seo/JsonLd.tsx`
  - Consumers: `frontend/src/app/players/[playerId]/page.tsx`, `frontend/src/app/clubs/[slug]/page.tsx`, event pages, via `frontend/src/lib/seo.ts`
- **Affected data:** `player.fullName`, `club.name`, `event.title`, `event.location` — all user-controlled.

**Attack scenario / PoC:**
The component rendered `dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}`. `JSON.stringify` does not escape `<`, `>`, or `&`. An attacker sets their player or club name to:

```
</script><script>alert(document.cookie)</script>
```

On any public SEO page embedding that JSON-LD block, the payload breaks out of the `<script type="application/ld+json">` element and executes in every visitor's browser, including admins.

**Impact:** Session/CSRF-cookie theft, admin account takeover, arbitrary actions as the victim. Stored and self-propagating across public pages.

**Recommended remediation (NOT yet applied):** In `JsonLd.tsx`, add a `serializeJsonLd()` helper that unicode-escapes `<`, `>`, `&`, `U+2028`, `U+2029` after `JSON.stringify`, then feed its output to `dangerouslySetInnerHTML`. Output stays valid, semantically identical JSON. The approach was prototyped and verified (breakout payload neutralized, round-trip preserved, lint clean) before being reverted to plan-only.

```js
// Use ASCII escapes for the separators in the regex literal;
// literal U+2028/U+2029 would break the source file itself.
JSON.stringify(data).replace(/[<>&\u2028\u2029]/g,
  (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
```

**Blocks production:** Yes — live High-severity stored XSS until implemented.

---

### F-02 — Live Resend API key in working-tree `.env` `[MEDIUM]` ⚠️ Action required

- **Category:** Secrets management — CWE-312 (Cleartext Storage) / CWE-798
- **CVSS (est.):** 6.5
- **Confidence:** Confirmed
- **Affected file:** `.env` (repo root)

**Detail:** `.env` is correctly gitignored and **not** tracked in git history (verified via `git ls-files` and the prior gitleaks scan). However it contains a real, production-capable Resend API key in cleartext on disk:

```
RESEND_API_KEY="re_********************"   (redacted)
```

**Impact:** Anyone with read access to the working tree (or a future accidental commit/backup/log) can send email as the platform — phishing, quota abuse, reputation damage.

**Remediation:** Treat the key as compromised and **rotate it** in the Resend dashboard. Keep secrets in the deployment environment / a secrets manager, not in a committed-adjacent file. No code change required. This finding is flagged but not auto-remediated (rotation must be done by the owner in Resend).

**Blocks production:** No, but rotate before/at launch.

---

### F-03 — Financial PII exposed to anonymous users `[LOW–MEDIUM]` 📋 Planned

- **Category:** Excessive Data Exposure — CWE-200 / OWASP API3:2023
- **CVSS (est.):** 5.3
- **Confidence:** Confirmed
- **Affected files:**
  - `backend/src/common/serializers.ts:44-45` (`serializeEvent` includes `bankAccountIban`, `bankAccountReceiver`)
  - `backend/src/modules/events/events.routes.ts:128` (`GET /api/public/events/:id`)
  - `backend/src/modules/events/events.routes.ts:208` (`GET /api/public/events`)

**Attack scenario:** Both endpoints are unauthenticated. `serializeEvent` returns `bankAccountIban` plus `bankAccountReceiver` (an individual's full name attached to a bank account). Any anonymous visitor — or scraper — can enumerate published events and harvest payee name + IBAN pairs. The list endpoint also returns bank details for *previous/finished* events, where no payment is pending.

**Positive:** Publication is enforced — `getEventById`/`listPublicEvents` filter `isPublished: true`, so **unpublished/draft events do not leak** (verified). Exposure is limited to published events.

**Impact:** Scrapeable financial PII enables targeted "pay your tournament entry fee to this account" phishing and doxxing of the payee. Whether IBAN should be public at all is a product decision (players may legitimately need it to pay).

**Decision (owner, 2026-07-25):** Bank details **must not be visible to anonymous users**. They remain available to authenticated players (who need the IBAN to pay the entry fee — per the admin form hint "Shown to players with the fee").

**Planned remediation (approved, NOT yet implemented):**
1. Give `serializeEvent` an opt-in `{ includeBankDetails?: boolean }` option that defaults to **omitting** the fields (return empty strings to keep the response shape stable — avoids frontend type churn).
2. Gate each event route on whether a user is authenticated:
   - `GET /api/public/events`, `GET /api/public/events/:id` → omit (anonymous).
   - `GET /api/events`, `GET /api/events/:id` → include only when `getCurrentUser` returns a user.
   - `GET /api/dashboard` and all `requireCapability`-gated admin create/update/status/publication routes → include.
3. No change needed to `serializeRegistration` / `serializePublicRegistrationTeam` — they already expose only `id/title/date/location` for the event, no bank fields.

**Affected files to touch when implemented:** `backend/src/common/serializers.ts`, `backend/src/modules/events/events.routes.ts`, `backend/src/modules/dashboard/dashboard.routes.ts`.

**Verification checklist for the future implementation:** anonymous `GET /api/public/events/:id` returns empty bank fields; authenticated `GET /api/events/:id` and `GET /api/dashboard` return the real IBAN; `.map(serializeEvent)` call sites must use an arrow wrapper (a bare reference passes the array index as the options arg); run backend `lint` + `test` + `build`.

**Blocks production:** No, but should ship before launch given the decision.

---

### F-04 — Open redirect via login `next` parameter `[LOW]` 📋 Planned

- **Category:** Open Redirect — CWE-601 / OWASP A01:2021
- **CVSS (est.):** 4.3
- **Confidence:** Confirmed (bypass), redirect sink is client-side `router.push`
- **Affected files:**
  - `frontend/src/app/login/page.tsx` (`safeNextPath`)
  - `frontend/src/components/auth/LoginForm.tsx:67` (`router.push(destination)`)

**Attack scenario / PoC:** The original guard was `!value.startsWith('/') || value.startsWith('//')`. It blocked `//evil.com` but not a backslash variant:

```
/login?next=/\evil.com
```

Browsers normalize `\` → `/`, turning `/\evil.com` into protocol-relative `//evil.com`. After successful login, `router.push()` navigates the victim off-site — usable for phishing (a credential-harvesting clone) or OAuth-token relay.

**Impact:** Post-login redirect to attacker-controlled origin. Low severity (requires the victim to follow a crafted login link and authenticate).

**Recommended remediation (NOT yet applied):** Tighten `safeNextPath` to require a single leading slash followed by a non-slash/non-backslash char, and reject backslashes and control characters:

```js
if (!value || !/^\/[^/\\]/.test(value) || /[\x00-\x1f\\]/.test(value)) return '/dashboard';
```

Prototyped and verified with a behavior table (`/dashboard`, `/admin/events/123`, `/ok?x=1` pass; `//evil.com`, `/\evil.com`, `https://evil.com`, control chars fall back to `/dashboard`), then reverted to plan-only.

**Blocks production:** No.

---

### F-05 — CSRF token not bound to session `[LOW]` ✅ Accepted (mitigated)

- **Category:** CSRF — CWE-352
- **Affected file:** `backend/src/common/csrf.ts`

**Detail:** The CSRF defense is a double-submit cookie/header compared with `crypto.timingSafeEqual`, plus a strict `Origin` allow-list check on unsafe methods. The token is not cryptographically bound to the user session. With the `Origin` allow-list and `SameSite=Lax` session cookies, practical CSRF risk is low.

**Recommendation (future):** Sign the CSRF token against the session (HMAC of session id) for defense-in-depth. Not blocking.

---

### F-06 — In-process rate limiting only `[LOW]` ✅ Accepted (single-host)

- **Category:** Unrestricted Resource Consumption — CWE-770 / OWASP API4:2023
- **Affected file:** `backend/src/common/rateLimit.ts`

**Detail:** Fixed-window limiter is per-process and per-IP; there is no per-account lockout. Complemented by nginx endpoint rate limits. Adequate for the documented single-host topology.

**Recommendation (future):** Move to Redis/edge/WAF limits and add per-account throttling before scaling to multiple API replicas. Already tracked in the prior report's residual findings.

---

## Verified Safe (this pass)

These were actively tested and found correctly implemented:

- **Authentication / session:** JWT pinned to `HS256` (no `alg:none` bypass), session revocation via `sessionVersion`, bcrypt cost 12, 12-char password floor / 72-byte cap, dummy-hash comparison prevents user enumeration & timing leaks, email-verified gating before role elevation, header-only bootstrap token behind a Postgres advisory lock, fail-closed production env validation.
- **RBAC / privilege separation:** Admin capabilities granted to `UserRole.ADMIN` only; every PII-bearing admin route is `requireCapability`-gated. Ordinary users → 403.
- **User/player data isolation:** Public player endpoints use a DB-level field `select` (no email/phone/status fetched) *and* an allowlist serializer; `role: USER, status: ACTIVE` filter means admins/judges never surface via public lookups (→ 404). No IDOR.
- **SQL injection:** None — Prisma parameterized throughout; only raw SQL is a test-only `TRUNCATE`.
- **Mass assignment:** None — no route spreads `req.body` into a Prisma write.
- **Notification IDOR:** All queries scoped by `recipientUserId`.
- **Judge match scoring:** Scoped by `judgeId` plus active court/schedule assignment; optimistic `version` + `commandId` idempotency.
- **Realtime (Socket.IO):** Re-validates session version on subscribe, role-scoped rooms, subscription/rate/room caps, 16 KiB buffer cap, publication-gated event/match access.
- **Secret leakage (frontend):** No secrets in `NEXT_PUBLIC_*` — only public config.
- **Unpublished event leakage:** Blocked by `isPublished` filter on all public event queries.

---

## NOT Yet Audited (remaining scope)

The following were **not** reviewed in this pass and remain open surface:

- **Authorization / IDOR** in: `brackets`, `scheduling`, `clubs`, `opponent-requests`, `categories`, `operations`, `dashboard`.
- **Business-logic abuse:** double-registration, disqualification bypass, cross-club moves, opponent-request self-approval, bracket tampering by non-owning clubs, score/result-correction race conditions.
- **Outbox worker / SSRF**, per-endpoint DoS (expensive queries, deep nesting), file uploads (existence unconfirmed).
- **Dependency CVEs** beyond the prior `npm audit` (5 moderate, no high/critical).
- **Infra:** HTTP request smuggling, host-header attacks, TLS/HSTS/CSP live verification, WAF readiness.

**Suggested next pass:** `registrations` + `opponent-requests` + `brackets` — attempt to (a) register into another club's slot, (b) approve one's own opponent request, (c) read/modify another club's unpublished bracket. This is where tournament-integrity bugs would most likely hide.

---

## Change Log (this pass)

**No code changes are applied.** This audit is documentation/plan only. The remediations for F-01, F-03, and F-04 were prototyped and verified during review, then reverted so the working tree is clean.

Files that *would* be touched when each remediation is approved:

| Finding | Files to change |
|---------|-----------------|
| F-01 | `frontend/src/components/seo/JsonLd.tsx` |
| F-03 | `backend/src/common/serializers.ts`, `backend/src/modules/events/events.routes.ts`, `backend/src/modules/dashboard/dashboard.routes.ts` |
| F-04 | `frontend/src/app/login/page.tsx` |

Each prototyped change was backward-compatible and passed the relevant `lint` / `test` before being reverted.
