# Oceana — Future Goals

Ordered by impact. Security hardening (Phase 7) is partially complete from the recent audit fixes.

---

## Completed

- [x] **Follower/following counts on profile** — Counts display on profile page
- [x] **Typing indicators in chat UI** — Backend sends them, frontend renders them
- [x] **User search endpoint** — `GET /users/search?q=` with ILIKE matching + search bar in feed
- [x] **Cursor-based pagination** — Opaque cursors on feed, replies, and messages endpoints
- [x] **Rate limiting** — Per-endpoint limits (auth: 5/min, uploads: 10/min, general: 60/min)
- [x] **Content Security Policy headers** — CSP + X-Frame-Options + nosniff + Referrer-Policy
- [x] **Key verification UI (safety numbers)** — Fingerprint comparison modal for E2EE contacts
- [x] **Group chat E2EE** — AES-256-GCM with group key distribution messages
- [x] **Post detail page** — Full view with reactions, replies, comment input, signature badges
- [x] **Bot key signing** — Bot activity script generates Ed25519 keys and signs all posts
- [x] **Local test images** — 8 ocean-themed PNG test images (no external downloads)
- [x] **Likes and yikes** — 👍 and 😬 reactions in bot activity + UI buttons
- [x] **WS ticket-based auth** — Short-lived one-time tickets replace JWT in URL
- [x] **CORS: require explicit origin** — Backend panics if `CORS_ORIGIN` not set; no `Any` fallback
- [x] **Secrets to .env** — JWT_SECRET and POSTGRES_PASSWORD read from `.env`, validated on startup
- [x] **Backend unit tests** — 104 tests across models, routes, auth, emoji validation
- [x] **Frontend unit tests** — 86 tests across crypto, stores, and components
- [x] **Integration test suite** — `test.sh` with assertions covering all major API endpoints

## Quick Wins

- [ ] **Follower/following list pages** — Counts show but can't view actual follower/following lists
- [ ] **Profile avatar upload UI** — Schema supports it, no upload interface
- [ ] **Post editing** — Only delete supported, no edit capability
- [ ] **Conversation naming** — Groups show member list but no titles

## Security Hardening

- [ ] **Fix silent encryption fallback** — Chat silently sends plaintext when E2EE fails; should error
- [ ] **Remove plaintext message column** — Or enforce E2EE-only to prevent server-readable messages
- [ ] **WS message size validation** — No content length limit before DB insert
- [ ] **Group key rotation** — AES group key never rotates on membership changes
- [ ] **Token refresh/revocation** — 1-hour JWTs can't be invalidated early
- [ ] **Password max length cap** — Prevent DoS via Argon2 with very long passwords
- [ ] **WS message rate limiting** — No per-message rate limit after WebSocket upgrade

## Bigger Features

- [ ] **CI pipeline** — No automated testing on PRs
- [ ] **Redis pub/sub** — Multi-instance WebSocket support + feed caching
- [ ] **MinIO object storage** — Replace local /uploads with S3-compatible storage

## Advanced

- [ ] **Neo4j integration** — Friend-of-friend recommendations, community detection
- [ ] **Full-text search on posts** — PostgreSQL tsvector or Meilisearch
- [ ] **Content recommendation** — Graph-based ranking using reaction similarity
