# Oceana — Future Goals

Ordered by impact. Security hardening (Phase 7) is partially complete from the recent audit fixes.

---

## Quick Wins

- [ ] **Follower/following counts on profile** — Add counts to user query + display on profile page
- [ ] **Typing indicators in chat UI** — Backend already sends them, just needs frontend rendering
- [ ] **User search endpoint** — `SELECT WHERE username ILIKE $1` + search bar in the UI

## Bigger Features

- [ ] **Cursor-based pagination** — Replace timestamp-based `before` param with opaque cursors for more reliable scrolling
- [ ] **Rate limiting** — `tower` middleware on auth/upload/reaction endpoints to prevent abuse
- [ ] **Content Security Policy headers** — Add CSP middleware in Axum

## Advanced

- [ ] **Key verification UI (safety numbers)** — Show fingerprint comparison for E2EE contacts
- [ ] **Group chat E2EE** — Sender Keys protocol instead of per-recipient encryption
- [ ] **Neo4j integration** — Friend-of-friend recommendations, community detection
- [ ] **Redis pub/sub** — Multi-instance WebSocket support
