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
| CRITICAL | 2 | 1 |
| HIGH     | 6 | 2 |
| MEDIUM   | 8 | 2 |
| LOW      | 7 | 0 |
| INFO     | 6 | — |

---

## Findings

### CRITICAL

#### C-1: ~~JWT Token Exposed in WebSocket URL Query Parameter~~ FIXED

**Status:** Remediated. WebSocket now uses ticket-based auth: `POST /api/v1/ws/ticket` returns a one-time UUID ticket (30s expiry). The ticket is passed in the URL instead of the JWT and consumed on first use.

---

#### C-2: Silent Fallback to Plaintext on Encryption Failure

**File:** `/frontend/src/lib/stores/chat.ts:274-283`, `chat.ts:301-309`
**Description:** When encryption fails (either group or pairwise), the code silently falls back to sending the message as plaintext. The user sees no warning that their message was sent unencrypted.

```typescript
// chat.ts:274-283 (group encryption failure)
} catch (e) {
    console.error('Group encryption failed:', e);
    sendWsMessage({
        type: 'send_message',
        conversation_id: conversationId,
        content: plaintext,  // PLAINTEXT FALLBACK
        image_url: imageUrl ?? null
    });
```

**Impact:** Users believe their messages are E2EE (the UI shows the lock icon since `cryptoReady` is true) while messages may be sent as plaintext and stored permanently on the server. This is a fundamental E2EE trust violation.
**Recommendation:** Never silently fall back to plaintext. Either fail loudly with a user-visible error, or queue the message for retry. At minimum, show a clear warning that the message was sent unencrypted.

---

### HIGH

#### H-1: Plaintext Messages Stored on Server Alongside Ciphertext

**File:** `/backend/src/routes.rs:723-724`, `/backend/migrations/002_chat.sql:13-20`
**Description:** The `messages` table has both `plaintext` and `ciphertext` columns. When encryption fails (see C-2), the plaintext is stored directly. Even for encrypted messages, the server stores whatever the client sends. There is no server-side enforcement that chat messages must be encrypted.

```sql
-- messages table allows both plaintext and ciphertext
plaintext       TEXT,
ciphertext      TEXT,
```

**Impact:** The server can see and store any message that falls back to plaintext. An attacker with database access can read all fallback messages.
**Recommendation:** Consider removing the `plaintext` column from the messages table for E2EE conversations, or at minimum add a `is_encrypted` boolean flag that the server tracks. Warn users when receiving unencrypted messages in an E2EE conversation.

---

#### H-2: No Rate Limiting on WebSocket Messages

**File:** `/backend/src/routes.rs:666-690`
**Description:** The WebSocket message handler processes all incoming messages without any rate limiting. The HTTP rate limiter (5 req/60s for auth, 60 req/60s general) does not apply to WebSocket frames after the initial upgrade.

```rust
// routes.rs:666 - no rate check per-message
while let Some(Ok(msg)) = ws_stream.next().await {
    match msg {
        WsMsg::Text(text) => {
            if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(&text) {
```

**Impact:** A malicious client can flood the server with messages, causing database write amplification (each message is INSERT + broadcast), memory pressure, and denial of service for all users in shared conversations.
**Recommendation:** Add per-connection message rate limiting (e.g., max 10 messages per second). Also add message size limits.

---

#### H-3: No WebSocket Message Size Validation

**File:** `/backend/src/routes.rs:668-669`
**Description:** There is no limit on the size of incoming WebSocket text frames. The `content` field in `WsClientMessage::SendMessage` is `Option<String>` with no length validation before database insertion.

**Impact:** An attacker can send arbitrarily large messages, consuming database storage and memory. Combined with H-2, this enables rapid resource exhaustion.
**Recommendation:** Add `max_frame_size` configuration on the WebSocket upgrade and validate `content` length before database insertion (matching the 10,000 char limit used for posts).

---

#### H-4: ~~No CSRF Protection / Permissive CORS~~ FIXED

**Status:** Remediated. `CORS_ORIGIN` is now required — the backend panics on startup if not set. No `Any` fallback exists. Only explicit origin, specific methods, and `Content-Type` + `Authorization` headers are allowed.

---

#### H-5: ~~Hardcoded Secrets in Docker Compose~~ FIXED

**Status:** Remediated. Docker Compose now uses `${JWT_SECRET:?Set JWT_SECRET in .env}` and `${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}` variable substitution. The backend also validates on startup that JWT_SECRET is 32+ chars and not the known default string.

---

#### H-6: Group Key Never Rotated on Member Change

**File:** `/frontend/src/lib/stores/chat.ts:236-260`
**Description:** When a group chat's AES-256-GCM key is generated, it is distributed to current members and cached. There is no mechanism to rotate the group key when:
- A member is removed from the conversation
- A member's identity key changes
- Periodically for forward secrecy

The `groupKeyDistributed` set is an in-memory `Set<string>` that prevents re-distribution even within a single session.

```typescript
const groupKeyDistributed = new Set<string>();
// Once distributed, never rotated
if (!groupKey || !groupKeyDistributed.has(conversationId)) {
    groupKey = await generateGroupKey();
    // ...distribute...
    groupKeyDistributed.add(conversationId);
}
```

**Impact:** Removed members retain the ability to decrypt future messages if they have the group key. No forward secrecy is provided for group messages.
**Recommendation:** Rotate group keys when membership changes and implement periodic rotation. Track group key epochs.

---

### MEDIUM

#### M-1: Sent Message Cache in localStorage is Not Encrypted

**File:** `/frontend/src/lib/crypto/store.ts:203-217`
**Description:** When a user sends an encrypted DM, the plaintext is cached in `localStorage` using a key derived from the first 48 characters of the ciphertext. This plaintext is stored completely unencrypted.

```typescript
async storeSentMessage(ciphertext: string, plaintext: string): Promise<void> {
    const key = `oceana-sent-${ciphertext.slice(0, 48)}`;
    localStorage.setItem(key, plaintext);  // Plaintext in localStorage!
}
```

**Impact:** Anyone with access to the browser's localStorage (XSS, shared computer, browser extension, physical access) can read all sent message plaintexts. This partially defeats E2EE.
**Recommendation:** Encrypt the plaintext cache using a key derived from the user's credentials or a separate key stored in IndexedDB. Consider using IndexedDB instead of localStorage. Add cache expiration.

---

#### M-2: Ciphertext Cache Key Collision Risk

**File:** `/frontend/src/lib/crypto/store.ts:205`
**Description:** The sent message cache uses only the first 48 characters of the base64-encoded ciphertext as the lookup key. Different messages could share the same 48-character prefix, causing incorrect plaintext retrieval.

```typescript
const key = `oceana-sent-${ciphertext.slice(0, 48)}`;
```

**Impact:** In rare cases, a user's own sent message could display the wrong plaintext. Low probability but non-zero.
**Recommendation:** Use a hash of the full ciphertext (e.g., SHA-256) as the cache key.

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

#### M-4: No Token Refresh / Revocation Mechanism

**File:** `/backend/src/auth.rs:25`
**Description:** JWT tokens have a fixed 1-hour expiry with no refresh mechanism and no server-side revocation capability. There is no blacklist or token family tracking.

```rust
exp: now + 3600, // 1 hour for dev convenience
```

**Impact:** If a token is compromised, it cannot be revoked before expiry. Users who change passwords or log out on one device cannot invalidate tokens on other devices. After logout, the token remains valid for up to 1 hour.
**Recommendation:** Implement a refresh token mechanism with short-lived access tokens (5-15 min). Add server-side token revocation (e.g., Redis-backed blacklist or JWT ID tracking). Invalidate all tokens on password change.

---

#### M-5: ~~Upload Size Check After Full Read Into Memory~~ FIXED

**Status:** Remediated. `DefaultBodyLimit::max(11 * 1024 * 1024)` is now applied at the middleware layer, rejecting oversized requests before they're fully read into memory.

---

#### M-6: Argon2 Default Parameters May Be Too Low for Production

**File:** `/backend/src/auth.rs:79-84`
**Description:** The code deliberately uses Argon2's default parameters "for dev speed" as noted in the comment. Default params are `m=19456 (19MB), t=2, p=1` per the seed data hashes.

```rust
// Deliberately using default (lower) params for dev speed.
// Production should tune memory/iterations.
Argon2::default()
```

**Impact:** OWASP recommends Argon2id with m=47104 (46MB), t=1, p=1 as minimum. The current params provide less brute-force resistance than recommended.
**Recommendation:** For production, tune parameters per OWASP guidelines. Make parameters configurable via environment variables.

---

#### M-7: No Conversation Access Control for Key Bundle Retrieval

**File:** `/backend/src/routes.rs:910-952`
**Description:** Any authenticated user can fetch any other user's key bundle via `GET /keys/bundle/:user_id`. While OPK consumption requires a shared conversation, the identity key and signed prekey are always returned. This is somewhat by design (needed to initiate sessions) but allows harvesting of public key material.

**Impact:** Low direct impact since these are public keys, but allows enumeration and pre-computation attacks. More importantly, a user could exhaust another user's OPKs by creating a conversation with them and repeatedly fetching bundles (the OPK pop happens if they share a conversation).

**Recommendation:** Consider adding rate limiting specifically to key bundle fetches. The OPK consumption is already gated by conversation membership, which is good.

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

#### L-1: No Username Character Validation

**File:** `/backend/src/routes.rs:62-64`
**Description:** Username validation only checks length (3-32 chars) but not character set. Users can register with usernames containing special characters, spaces, Unicode confusables, or control characters.

```rust
if body.username.len() < 3 || body.username.len() > 32 {
```

**Impact:** Potential for homograph attacks (e.g., `alice` vs `al\u0456ce`), display issues, or social engineering.
**Recommendation:** Restrict usernames to `[a-zA-Z0-9_-]` or a similar safe character set. Normalize Unicode.

---

#### L-2: Email Validation Is Minimal

**File:** `/backend/src/routes.rs:68-70`
**Description:** Email validation only checks for `@` and `.` presence. This allows many invalid emails through (e.g., `@.`, `a@b.`).

```rust
if !body.email.contains('@') || !body.email.contains('.') {
```

**Impact:** Invalid emails in database, no email verification means accounts can be created with anyone's email.
**Recommendation:** Use a proper email validation library. Consider requiring email verification (though this adds complexity for a hobby project).

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

#### L-5: No Exponential Backoff on WebSocket Reconnection

**File:** `/frontend/src/lib/ws.ts:53-56`
**Description:** WebSocket reconnection uses a fixed 3-second delay. If the server is down, this creates a constant reconnection storm.

```typescript
reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
}, 3000);
```

**Impact:** If many clients are connected and the server restarts, all clients reconnect simultaneously every 3 seconds, potentially overwhelming the server (thundering herd).
**Recommendation:** Use exponential backoff with jitter (e.g., 1s, 2s, 4s, 8s... up to 60s, with random jitter).

---

#### L-6: DOMPurify Allows Iframes

**File:** `/frontend/src/lib/components/Markdown.svelte:86-89`
**Description:** DOMPurify is configured to allow `<iframe>` tags with `src`, `allow`, and `allowfullscreen` attributes. While the embed extraction regex is strict, a carefully crafted markdown input could potentially inject an iframe that passes DOMPurify but loads an unexpected URL.

```typescript
return DOMPurify.sanitize(withEmbeds, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'src']
});
```

**Impact:** The embed regex validation (YouTube, Spotify, SoundCloud) constrains this well, and DOMPurify removes `javascript:` URIs. The risk is low but the attack surface exists.
**Recommendation:** Consider adding `ALLOW_URI_REGEXP` to DOMPurify to restrict iframe `src` to only youtube.com, spotify.com, and soundcloud.com domains.

---

#### L-7: No Logout Invalidation of Crypto State

**File:** `/frontend/src/lib/stores/auth.ts:38-40`, `/frontend/src/lib/crypto/index.ts:5-6`
**Description:** On logout, the auth store clears the token from localStorage, but:
- The Signal Protocol store (IndexedDB) is not cleared
- The `store` module-level variable in `crypto/index.ts` still holds the reference
- `localStorage` sent message cache is not cleared

**Impact:** A subsequent user on the same browser could potentially access the previous user's crypto state if they can trigger `getCryptoStore()` before a new `initCrypto()` call.
**Recommendation:** Clear the module-level `store` variable on logout. Clear the sent message localStorage entries. Consider clearing or re-keying IndexedDB on logout.

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

**Fixed:** C-1, H-4, H-5, M-5

### Immediate (P0)
1. **Fix C-2:** Remove silent plaintext fallback. Fail encryption errors visibly to the user.

### Short-term (P1)
2. **Fix H-2:** Add per-message rate limiting to WebSocket handler.
3. **Fix H-3:** Add WebSocket message size limits.

### Medium-term (P2)
4. **Fix H-6:** Implement group key rotation on membership changes.
5. **Fix M-1:** Encrypt the localStorage sent message cache.
6. **Fix M-4:** Implement token refresh mechanism.

### Long-term (P3)
7. **Fix M-8:** Use `FOR UPDATE SKIP LOCKED` for OPK consumption.
8. **Fix M-3:** Add password length cap and complexity guidance.
9. **Fix L-1:** Restrict username character set.
10. Evaluate replacing `@privacyresearch/libsignal-protocol-typescript` with an officially maintained Signal library.

---

## Methodology

This audit was performed through static code analysis of all source files listed in scope. No dynamic testing, fuzzing, or penetration testing was performed. Findings are based on code review patterns and known vulnerability classes. The audit focused on the application layer and did not assess OS-level or network-level security.
