# Oceana Security & Code Quality Audit - Round 1

**Date:** 2026-03-19
**Auditor:** Claude Opus 4.6
**Scope:** Full codebase review - Rust/Axum backend, SvelteKit frontend, Signal Protocol E2EE
**Commit:** `4faf988` (main)

---

## Executive Summary

Oceana is a social platform with E2EE chat using the Signal Protocol (X3DH + Double Ratchet) for DMs and AES-256-GCM for group chats. The codebase demonstrates strong security awareness: parameterized SQL queries, Argon2id password hashing, DOMPurify for XSS prevention, rate limiting, security headers, and proper error information hiding.

The most significant findings relate to: JWT tokens exposed in WebSocket URLs (logged in access logs), encryption fallback to plaintext on failure (silently breaking E2EE guarantees), lack of server-side content validation for WebSocket messages, and hardcoded secrets in docker-compose.yml.

**Finding Summary:**
| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | 2 | 2 |
| HIGH     | 6 | 6 |
| MEDIUM   | 8 | 7 |
| LOW      | 7 | 5 |
| INFO     | 6 | — |

---

## Findings

### CRITICAL

#### C-1: ~~JWT Token Exposed in WebSocket URL Query Parameter~~ FIXED

**Status:** Remediated. WebSocket now uses ticket-based auth: `POST /api/v1/ws/ticket` returns a one-time UUID ticket (30s expiry). The ticket is passed in the URL instead of the JWT and consumed on first use.

---

#### C-2: ~~Silent Fallback to Plaintext on Encryption Failure~~ FIXED

**Status:** Remediated. `sendEncryptedMessage()` now throws an error when the crypto store is unavailable or encryption fails, instead of silently falling back to plaintext. The UI catches the error and displays it to the user via `sendError`. No message is sent if encryption cannot be performed.

---

### HIGH

#### H-1: ~~Plaintext Messages Stored on Server Alongside Ciphertext~~ FIXED

**Status:** Remediated. The server now always binds NULL for the plaintext column in message inserts, ignoring any `content` field sent by the client. The `list_conversations` query returns `NULL::text AS last_message_text` instead of reading from the plaintext column. Self-chat now encrypts via AES-256-GCM group keys instead of sending plaintext. Conversation previews are decrypted client-side. Seed data plaintext has been nullified.

---

#### H-2: ~~No Rate Limiting on WebSocket Messages~~ FIXED

**Status:** Remediated. Per-connection rate limiting at 10 messages/second enforced in WebSocket handler with sliding window.

---

#### H-3: ~~No WebSocket Message Size Validation~~ FIXED

**Status:** Remediated. WebSocket frame size limited to 64KB via `max_frame_size`. Content/ciphertext validated to max 10,000 chars before DB insertion.

---

#### H-4: ~~No CSRF Protection / Permissive CORS~~ FIXED

**Status:** Remediated. `CORS_ORIGIN` is now required — the backend panics on startup if not set. No `Any` fallback exists. Only explicit origin, specific methods, and `Content-Type` + `Authorization` headers are allowed.

---

#### H-5: ~~Hardcoded Secrets in Docker Compose~~ FIXED

**Status:** Remediated. Docker Compose now uses `${JWT_SECRET:?Set JWT_SECRET in .env}` and `${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}` variable substitution. The backend also validates on startup that JWT_SECRET is 32+ chars and not the known default string.

---

#### H-6: ~~Group Key Never Rotated on Member Change~~ FIXED

**Status:** Remediated. Group keys are now rotated when membership changes. Before each group message, current members are fetched and compared against the set that received the current key. On mismatch, a new AES-256-GCM key is generated and distributed via pairwise Signal encryption.

---

### MEDIUM

#### M-1: ~~Sent Message Cache in localStorage is Not Encrypted~~ FIXED

**Status:** Remediated. The sent message cache is now encrypted with AES-256-GCM using a key derived from the user's Signal identity key via HKDF. The IV is stored alongside the ciphertext. Raw plaintext is never written to localStorage.

---

#### M-2: ~~Ciphertext Cache Key Collision Risk~~ FIXED

**Status:** Remediated. The cache key is now a SHA-256 hash of the full ciphertext, eliminating prefix collision risk.

---

#### M-3: No Password Complexity Requirements Beyond Length

**File:** `/backend/src/routes.rs:65-67`
**Description:** Password validation only checks minimum length (8 characters). No checks for:
- Maximum length (could be used for denial-of-service via Argon2 with very long passwords)
- Character diversity (all-numeric, dictionary words, etc.)

```rust
if body.password.len() < 8 {
    return Err(AppError::BadRequest("Password must be at least 8 characters".into()));
}
```

**Impact:** Users can set weak passwords like "12345678" or "aaaaaaaa". Very long passwords (MB+) could cause Argon2 hashing to consume excessive CPU.
**Recommendation:** Add a maximum password length (e.g., 128 bytes) to prevent DoS. Consider integrating a breached-password check (k-anonymity model via HaveIBeenPwned API) or requiring mixed character classes.

---

#### M-4: ~~No Token Refresh / Revocation Mechanism~~ FIXED

**Status:** Remediated. Access tokens now expire after 15 minutes. Refresh tokens (opaque UUIDs, 30-day expiry) are stored in a `refresh_tokens` Postgres table. Token rotation on each refresh (old token deleted, new pair issued). Server-side revocation on logout deletes all refresh tokens for the user. Frontend transparently refreshes on 401 with a mutex to prevent concurrent refresh requests.

---

#### M-5: ~~Upload Size Check After Full Read Into Memory~~ FIXED

**Status:** Remediated. `DefaultBodyLimit::max(11 * 1024 * 1024)` is now applied at the middleware layer, rejecting oversized requests before they're fully read into memory.

---

#### M-6: ~~Argon2 Default Parameters May Be Too Low for Production~~ FIXED

**Status:** Remediated. Argon2 parameters are now configurable via `ARGON2_M_COST`, `ARGON2_T_COST`, and `ARGON2_P_COST` environment variables, falling back to OWASP-recommended defaults (m=47104, t=1, p=1). `verify_password()` reads params from the stored hash, so old hashes continue to verify correctly.

---

#### M-7: ~~No Rate Limiting on Key Bundle Retrieval~~ FIXED

**Status:** Remediated. The `/api/v1/keys/bundle/` endpoint now has a dedicated rate limit of 20 requests per 60 seconds, stricter than the default 60/min, preventing OPK exhaustion attacks.

---

#### M-8: Race Condition in OPK Consumption

**File:** `/backend/src/routes.rs:934-936`
**Description:** The one-time prekey is consumed with a `DELETE ... RETURNING` query, but between the `SELECT` check for shared conversation and the `DELETE`, another request could consume the same OPK. Additionally, the `SELECT id FROM prekeys WHERE user_id = $1 LIMIT 1` subquery is not deterministic without `ORDER BY`.

```rust
"DELETE FROM prekeys WHERE id = (SELECT id FROM prekeys WHERE user_id = $1 LIMIT 1) RETURNING key_id, public_key"
```

**Impact:** Two concurrent session initiations could get the same OPK (TOCTOU race), or different OPKs could be consumed non-deterministically. In Signal Protocol, OPK reuse weakens forward secrecy.
**Recommendation:** Use `FOR UPDATE SKIP LOCKED` in the subquery to prevent concurrent consumption of the same OPK:
```sql
DELETE FROM prekeys WHERE id = (SELECT id FROM prekeys WHERE user_id = $1 ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING key_id, public_key
```

---

### LOW

#### L-1: ~~No Username Character Validation~~ FIXED

**Status:** Remediated. Usernames are now validated to only allow `[a-zA-Z0-9_-]` characters, rejecting Unicode confusables, spaces, and special characters.

---

#### L-2: ~~Email Validation Is Minimal~~ FIXED

**Status:** Remediated. Email validation now checks: max 254 chars total, non-empty local part (max 64 chars), domain has at least one dot, no empty domain labels, TLD at least 2 chars, and restricted character sets for both local and domain parts.

---

#### L-3: Missing `HttpOnly` / `Secure` Cookie Attributes

**File:** `/frontend/src/lib/stores/auth.ts:28`
**Description:** The JWT is stored in `localStorage` rather than an HttpOnly cookie. While this is standard for SPAs, it means the token is accessible to JavaScript (including any XSS).

```typescript
if (browser) localStorage.setItem('auth', JSON.stringify(state));
```

**Impact:** XSS vulnerability would allow token theft. Note: the application uses DOMPurify which mitigates XSS significantly.
**Recommendation:** This is acceptable for SPAs with proper XSS protection (which exists). For higher security, consider using HttpOnly cookies with the token.

---

#### L-4: User Profile Endpoint Leaks User Existence

**File:** `/backend/src/routes.rs:113-137`
**Description:** `GET /users/:id` is unauthenticated and returns user data or a 404. This allows enumeration of valid UUIDs (though UUIDs are hard to guess).

**Impact:** Minimal due to UUID format, but if UUIDs are leaked elsewhere (e.g., in chat URLs), profiles can be scraped by unauthenticated users.
**Recommendation:** Consider requiring authentication for user profile access, or accepting the tradeoff for a public-by-design social platform.

---

#### L-5: ~~No Exponential Backoff on WebSocket Reconnection~~ FIXED

**Status:** Remediated. WebSocket reconnection now uses exponential backoff (1s, 2s, 4s... up to 60s cap) with random jitter. The attempt counter resets on successful connection.

---

#### L-6: ~~DOMPurify Allows Iframes~~ FIXED

**Status:** Remediated. `ALLOWED_URI_REGEXP` is now set on DOMPurify to restrict iframe `src` to only youtube.com, soundcloud.com, and spotify.com domains. All other URI schemes are allowed for normal links except `javascript:`.

---

#### L-7: ~~No Logout Invalidation of Crypto State~~ FIXED

**Status:** Remediated. On logout: (1) `clearCryptoStore()` nulls the module-level store reference and initPromise, (2) all `oceana-sent-*` localStorage entries are cleared, (3) WebSocket is disconnected. IndexedDB is preserved for re-login on the same device.

---

### INFO

#### I-1: Good Practice - Parameterized SQL Queries

All SQL queries use SQLx's parameterized binding (`$1`, `$2`, etc.) consistently. No string interpolation of user input into SQL was found. This effectively eliminates SQL injection.

---

#### I-2: Good Practice - Password Hash Not Serialized

**File:** `/backend/src/models.rs:14-15`
**Description:** The `User` struct correctly uses `#[serde(skip_serializing)]` on both `email` and `password_hash` fields, preventing accidental leakage in API responses.

---

#### I-3: Good Practice - Error Information Hiding

**File:** `/backend/src/error.rs:22-25`
**Description:** Internal errors log the real message server-side but return a generic "Internal server error" to clients. JWT errors are mapped to "Invalid token" without leaking details.

---

#### I-4: Good Practice - Security Headers

**File:** `/backend/src/main.rs:105-116`
**Description:** The application sets CSP, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers. The CSP is reasonably strict with `frame-ancestors 'none'` and explicit source directives.

---

#### I-5: Good Practice - Upload Path Traversal Prevention

**File:** `/backend/src/routes.rs:833-839`
**Description:** Upload filenames are validated against directory traversal (`/`, `\`, `..`) and generated server-side using UUIDs. Content-type validation restricts to known image types. SVG is correctly rejected (prevents stored XSS via SVG).

---

#### I-6: Observation - Memory-Only Rate Limiter

**File:** `/backend/src/rate_limit.rs`
**Description:** The rate limiter is in-memory using `DashMap`. This means:
- Rate limits reset on server restart
- Not shared across multiple server instances (if load-balanced)
- Memory grows with unique IPs (no cleanup of expired entries beyond per-check pruning)

This is fine for a single-instance hobby project but would need Redis-backed storage for production scale.

---

## Dependency Assessment

### Backend (Cargo.toml)
- All crate versions are current stable releases
- `argon2 0.5`, `jsonwebtoken 9`, `sqlx 0.8` are well-maintained
- No known CVEs in specified versions as of audit date
- `dashmap 6` is relatively new; previous versions had soundness issues but v6 is clean

### Frontend (package.json)
- `@privacyresearch/libsignal-protocol-typescript ^0.0.16` - This is a community port of Signal Protocol, not the official library. It is lightly maintained. Consider the risk of using a non-audited crypto library.
- `isomorphic-dompurify ^2.20.0` - Current and well-maintained
- `marked ^17.0.4` - Current
- `highlight.js ^11.11.1` - Current

---

## Prioritized Recommendations (Updated)

**Fixed:** C-1, C-2, H-2, H-3, H-4, H-5, H-6, L-1, L-2, L-5, L-6, L-7, M-1, M-2, M-4, M-5, M-6, M-7

### Short-term (P1)
2. ~~**Fix H-2:** Add per-message rate limiting to WebSocket handler.~~ DONE
3. ~~**Fix H-3:** Add WebSocket message size limits.~~ DONE

### Medium-term (P2)
4. ~~**Fix H-6:** Implement group key rotation on membership changes.~~ DONE
5. **Fix M-1:** Encrypt the localStorage sent message cache.
6. ~~**Fix M-4:** Implement token refresh mechanism.~~ DONE

### Long-term (P3)
7. **Fix M-8:** Use `FOR UPDATE SKIP LOCKED` for OPK consumption.
8. **Fix M-3:** Add password length cap and complexity guidance.
9. **Fix L-1:** Restrict username character set.
10. Evaluate replacing `@privacyresearch/libsignal-protocol-typescript` with an officially maintained Signal library.

---

## Methodology

This audit was performed through static code analysis of all source files listed in scope. No dynamic testing, fuzzing, or penetration testing was performed. Findings are based on code review patterns and known vulnerability classes. The audit focused on the application layer and did not assess OS-level or network-level security.
