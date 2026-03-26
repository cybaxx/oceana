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

- [x] **Follower/following list endpoints** — Backend endpoints implemented
- [x] **Profile avatar upload** — Backend migration and handler implemented
- [x] **Post editing** — Edit button on own posts, inline textarea, updated_at tracking
- [x] **Conversation naming** — Name field on conversations, editable in chat header

## Security Hardening

- [x] **Fix silent encryption fallback** — Chat now errors when E2EE fails instead of sending plaintext
- [x] **WS message size validation** — Content/ciphertext validated to max 10,000 chars; frame size limited to 64KB
- [x] **WS message rate limiting** — Per-connection rate limiting at 10 messages/second
- [x] **Group key rotation** — AES group key rotates when membership changes
- [x] **Token refresh/revocation** — 15-min access tokens + 30-day refresh tokens with server-side revocation
- [x] **Password max length cap** — Limited to 128 characters
- [x] **Configurable Argon2 parameters** — Via env vars, defaults to OWASP-recommended values
- [x] **Key bundle rate limiting** — 20 requests/minute on `/keys/bundle/`
- [x] **Email validation** — Proper format validation (not just `@` and `.`)
- [x] **Username charset restriction** — `[a-zA-Z0-9_-]` only
- [x] **Encrypted sent message cache** — AES-256-GCM encrypted localStorage cache
- [x] **Exponential backoff on WS reconnect** — 1s to 60s cap with jitter

## Bigger Features

- [ ] **CI pipeline** — No automated testing on PRs
- [ ] **Redis pub/sub** — Multi-instance WebSocket support + feed caching
- [ ] **MinIO object storage** — Replace local /uploads with S3-compatible storage

## Advanced

- [ ] **Neo4j integration** — Friend-of-friend recommendations, community detection
- [ ] **Full-text search on posts** — PostgreSQL tsvector or Meilisearch
- [ ] **Content recommendation** — Graph-based ranking using reaction similarity
