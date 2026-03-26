# Oceana — Project Round-Up

## Timeline

**Started:** March 1, 2026
**Current date:** March 20, 2026
**Duration:** 20 days
**Commits:** 12

---

## Where We Started

The first commit (`swim like a jellyfish in the ocean of memes`) was a blank canvas. The vision: build a full-featured social media platform from scratch as a learning project, touching every layer of a modern web stack — Rust backend, SvelteKit frontend, real-time chat, end-to-end encryption, and graph database experiments.

The initial architecture doc laid out an ambitious target: PostgreSQL + Neo4j + Redis + MinIO, Signal Protocol E2EE, graph-based feed ranking, media processing pipelines, and a dark ocean terminal aesthetic.

---

## Where We Are Now

### Codebase Size

| Layer | Files | Lines of Code |
|-------|-------|--------------|
| Backend (Rust) | 7 source files | 2,709 |
| Frontend (TypeScript) | 12 source files | 1,378 |
| Frontend (Svelte) | 12 components/pages | 2,456 |
| Frontend tests | 7 test files | 1,735 |
| SQL migrations | 11 files | ~155 |
| Scripts | 2 (bot-activity, test.sh) | 984 |
| Documentation | 13 markdown files | 3,861 |
| **Total application code** | | **~13,250** |

### What's Built

**Backend — Rust/Axum (fully functional)**
- 33+ REST endpoints + 1 WebSocket endpoint
- Argon2id password hashing (configurable params, OWASP defaults), JWT auth (HS256, 15-min access tokens + 30-day refresh tokens)
- Full CRUD: users, posts, reactions, follows, conversations, messages
- Cursor-based pagination on feed, replies, and messages
- Signal Protocol key bundle management (upload, fetch, OPK rotation)
- File uploads with MIME validation and path traversal protection
- Per-IP rate limiting (auth 5/min, key bundles 20/min, uploads 10/min, general 60/min)
- Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy)
- WebSocket with ticket-based auth (30s one-time tickets)
- Connection manager with 5 connections/user cap
- 114 unit tests passing

**Frontend — SvelteKit/Svelte 5 (fully functional)**
- 9 pages: feed, login, register, settings, profile, post detail, chat list, chat, about
- Full Signal Protocol E2EE for DMs (X3DH + Double Ratchet)
- AES-256-GCM group chat encryption with key distribution
- Ed25519 post signing and verification badges
- Safety number modal for identity key verification
- Markdown rendering with syntax highlighting and media embeds
- Dark ocean terminal theme (JetBrains Mono, cyan glow, scanlines)
- Auto-reconnecting WebSocket with ticket-based auth
- 99 unit tests passing

**DevOps & Testing**
- Docker Compose (postgres + backend + frontend) — one command startup
- `.env`-based secrets (JWT_SECRET validated for strength on startup)
- Bot activity script: 6 bots, 36 signed posts, 25 threaded replies, 50 reactions, image uploads
- Integration test suite (`test.sh`) with assertions across all API endpoints
- 8 locally-generated ocean-themed test images

**Documentation — 13 files**
- API Reference (complete, matches implementation)
- Architecture (separates reality from planned features)
- Database Schema, Deployment Guide, WebSocket Protocol
- Encryption deep-dive (Signal Protocol + Ed25519 + group E2EE)
- Frontend reference (pages, stores, crypto modules, testing)
- Two security audit reports with remediation tracking
- Structured learning curriculum (9 modules, exercises)
- Future goals roadmap

**Security Posture**
- Two security audits performed (61 total findings)
- 26+ findings remediated across two audits (including CORS lockdown, WS ticket auth, rate limiting, body limits, secrets externalized, connection caps, token refresh, Argon2 hardening, email validation, encryption fallback fix, group key rotation)
- No SQL injection (parameterized queries throughout)
- No XSS in normal flow (isomorphic-dompurify on all paths)
- Passwords never serialized in API responses

### Phase Completion

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| 1. Foundation | **COMPLETE** | Axum server, PostgreSQL, JWT auth, Docker Compose |
| 2. Core Social | **COMPLETE** | Posts, follows, feed, reactions, replies, user search, pagination |
| 3. Media | **PARTIAL** | Image upload/display works; no MinIO, EXIF strip, or blurhash |
| 4. Real-Time Chat | **COMPLETE** | WebSocket, connection manager, typing indicators, message history |
| 5. E2E Encryption | **COMPLETE** | Signal Protocol (X3DH + Double Ratchet), group E2EE, Ed25519 signing, safety numbers |
| 6. Graph Database | **NOT STARTED** | Neo4j integration planned |
| 7. Hardening | **IN PROGRESS** | Rate limiting, security headers, tests, token refresh, WS limits, Argon2 config done; CI remaining |

---

## The End Game

### Near-Term (Next Sprint)

**UX polish — make it feel complete:**
- Follower/following list pages (the data is there, just no UI)
- Profile avatar upload interface
- Post editing support
- Conversation naming for group chats
- Exponential backoff on WebSocket reconnect

**Security closure — close the remaining audit findings:**
- ~~Remove silent plaintext fallback~~ DONE
- ~~WebSocket message size validation and per-message rate limiting~~ DONE
- ~~Group key rotation when members are added/removed~~ DONE
- ~~Password max length cap~~ DONE
- ~~Token refresh/revocation mechanism~~ DONE

**CI pipeline:**
- Run the 114 backend tests + 99 frontend tests + integration suite on every PR
- Block merge on failure

### Medium-Term (Next Month)

**Redis integration:**
- WebSocket pub/sub for multi-instance deployment (currently single-instance only)
- Feed caching with sorted sets (fan-out-on-write)
- Rate limiter backed by Redis (currently in-memory, resets on restart)

**MinIO object storage:**
- Replace local `/uploads` directory with S3-compatible storage
- EXIF stripping for privacy
- Blurhash placeholders for image loading
- Signed download URLs with expiry

**Full-text search:**
- PostgreSQL `tsvector` on post content
- Search results page in the frontend

### Long-Term (The Vision)

**Neo4j graph database:**
- Mirror social graph from PostgreSQL
- Friend-of-friend recommendations ("people you may know")
- Community detection using Louvain algorithm
- PageRank influence scoring
- Content recommendation based on reaction similarity
- Virality tracking (how posts spread through reply chains)

**Ranked feed:**
- Replace pure chronological with affinity-weighted ranking
- Use graph signals (interaction frequency, mutual follows) combined with engagement metrics (reactions, replies)
- Keep chronological as an option

**Production readiness:**
- Asymmetric JWT signing (Ed25519 instead of HS256)
- httpOnly cookie token storage (eliminates XSS token theft)
- Audit logging for security-relevant actions
- Reverse proxy (Caddy) with TLS
- Monitoring and alerting

### The Ultimate Shape

```
┌─────────────────────────────────────────────────────────┐
│                    Oceana Platform                        │
│                                                          │
│  Social feed with graph-ranked posts                     │
│  Real-time E2EE chat (Signal Protocol)                   │
│  Cryptographic post signing & verification               │
│  Friend-of-friend discovery via graph analysis           │
│  Community detection & influence scoring                  │
│  Rich media with S3 storage                              │
│  Full-text search                                        │
│  Dark ocean terminal aesthetic                           │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │PostgreSQL│ │  Neo4j   │ │  Redis   │ │  MinIO   │    │
│  │ (truth)  │ │ (graph)  │ │ (cache)  │ │ (media)  │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│  Rust/Axum backend · SvelteKit frontend · Docker         │
└─────────────────────────────────────────────────────────┘
```

---

## By the Numbers

| Metric | Value |
|--------|-------|
| Days of development | 20 |
| Commits | 12 |
| Backend tests | 114 |
| Frontend tests | 99 |
| API endpoints | 33+ |
| Frontend pages | 9 |
| Database tables | 8 |
| SQL migrations | 11 |
| Security findings identified | 61 |
| Security findings fixed | 26+ |
| Documentation files | 15 |
| Lines of application code | ~13,250 |
| Lines of documentation | ~3,860 |
| Bot-generated test posts | 36 (all Ed25519 signed) |
| Encryption protocols | 3 (Signal/X3DH, AES-256-GCM group, Ed25519 signing) |

---

In 20 days, Oceana went from nothing to a working encrypted social platform with more security infrastructure than most production apps. The foundation is solid — the interesting work ahead is the graph database experiments and turning the feed from a simple timeline into something that understands social connections.
