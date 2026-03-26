# Oceana - Architecture & API Design

A social media platform built for learning, with a Rust backend, secure frontend, and encryption-first design.

---

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Data Layer](#data-layer)
- [API Design](#api-design)
- [Authentication & Authorization](#authentication--authorization)
- [Media Pipeline](#media-pipeline)
- [Real-Time Chat & E2E Encryption](#real-time-chat--e2e-encryption)
- [Feed System](#feed-system)
- [Content Rendering & Security](#content-rendering--security)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Learning Roadmap](#learning-roadmap)
- [Future Architecture](#future-architecture)

---

## System Overview

### Current Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Clients                                   │
│   SvelteKit SSR  ←→  Browser  ←→  Mobile (future)                │
└──────────────┬───────────────────────────┬───────────────────────┘
               │ HTTPS / WSS               │
               ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Axum Application Server                      │
│                                                                  │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌─────────────┐    │
│  │  Auth   │ │ Profiles │ │ Posts  │ │ Feed │ │    Chat     │    │
│  │ Service │ │ Service  │ │Service │ │Service │  Service    │    │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──┬───┘ └──────┬──────┘    │
│       │           │           │         │            │           │
│  ┌────┴───────────┴───────────┴─────────┴────────────┴───────┐   │
│  │                   Middleware Layer                        │   │
│  │  Rate Limit · CORS · Auth · Logging · Security Headers    │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────┬──────────────────────────────────────────────────────-───┘
       │
       ▼
┌────────────┐
│ PostgreSQL │
│  (primary  │
│   store)   │
└────────────┘
```

### Target Architecture (as features are added)

```
Axum Server
  │
  ├──► PostgreSQL  (source of truth for all data)
  ├──► Neo4j       (social graph queries, recommendations)
  ├──► Redis       (feed cache, WS pub/sub, rate limiting)
  └──► MinIO       (S3-compatible media storage)
```

---

## Technology Stack

### Backend (Rust)

| Component | Crate | Purpose | Status |
|---|---|---|---|
| Web framework | `axum 0.7` | Async HTTP/WS server built on `tokio` and `tower` | In use |
| Database | `sqlx 0.8` | Async SQL with compile-time checking (PostgreSQL) | In use |
| Serialization | `serde`, `serde_json` | JSON request/response handling | In use |
| Auth tokens | `jsonwebtoken 9` | JWT creation and validation (HS256) | In use |
| Password hashing | `argon2 0.5` | Argon2id password hashing | In use |
| Rate limiting | `dashmap 6` | In-memory per-IP rate limiter | In use |
| Middleware | `tower-http` | CORS, tracing, body limits | In use |
| Tracing | `tracing`, `tracing-subscriber` | Structured logging | In use |
| WebSockets | Built-in Axum | Real-time bidirectional communication | In use |
| Graph DB | `neo4rs` | Neo4j async driver | Planned |
| Cache/RT | `redis` | Session store, feed cache, pub/sub | Planned |
| Object storage | `rust-s3` | S3-compatible API for MinIO | Planned |

### Frontend

| Component | Tool | Purpose |
|---|---|---|
| Framework | SvelteKit 2 + Svelte 5 | SSR + SPA hybrid, minimal runtime |
| Language | TypeScript | Type safety mirroring Rust's philosophy |
| Markdown | `marked` + `isomorphic-dompurify` | Render and sanitize user markdown |
| Syntax highlighting | `highlight.js` | Code block highlighting |
| WebSocket | Native `WebSocket` API | Real-time chat connection |
| Crypto | Web Crypto API + `@privacyresearch/libsignal-protocol-typescript` | Signal Protocol E2EE + Ed25519 signing |
| CSS | Tailwind CSS 4 | Utility-first styling |

### Infrastructure

| Component | Tool | Purpose | Status |
|---|---|---|---|
| Containers | Docker + docker-compose | Reproducible dev environment | In use |
| Primary DB | PostgreSQL 16 | Users, posts, messages, keys | In use |
| File storage | Local `/uploads` directory | Image uploads | In use |
| Graph DB | Neo4j 5 | Social graph, recommendations | Planned |
| Cache | Redis 7 | Sessions, feed cache, chat pub/sub | Planned |
| Object storage | MinIO | Self-hosted S3-compatible media | Planned |

---

## Data Layer

PostgreSQL is the single datastore. All data lives here.

### PostgreSQL Schema (Actual)

```sql
-- Core identity and auth
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(32) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(64),
    bio             TEXT,
    avatar_url      TEXT,
    is_bot          BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Signal Protocol fields
    identity_key            TEXT,
    signed_prekey           TEXT,
    signed_prekey_signature TEXT,
    signed_prekey_id        INT,
    signing_key             TEXT    -- Ed25519 public key for post signing
);

-- Refresh tokens for JWT rotation
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social graph edges
CREATE TABLE follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);

-- Posts (text content, replies via parent_id, optional Ed25519 signature)
CREATE TABLE posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    parent_id   UUID REFERENCES posts(id) ON DELETE SET NULL,
    signature   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Emoji reactions (one per user per post, any emoji)
CREATE TABLE reactions (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    kind        VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

-- Chat conversations
CREATE TABLE conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages (plaintext or Signal Protocol encrypted)
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plaintext       TEXT,
    ciphertext      TEXT,
    nonce           TEXT,
    message_type    INT,        -- 2 = WhisperMessage, 3 = PreKeyWhisperMessage
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signal Protocol one-time prekeys
CREATE TABLE prekeys (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id      INT NOT NULL,
    public_key  TEXT NOT NULL,
    UNIQUE (user_id, key_id)
);

-- Indexes
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_parent ON posts(parent_id);
CREATE INDEX idx_follows_followed ON follows(followed_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_reactions_post ON reactions(post_id);
CREATE INDEX idx_reactions_kind ON reactions(kind);
```

---

## API Design

### Conventions

- **Base URL:** `/api/v1/`
- **Auth:** Bearer token in `Authorization` header
- **Pagination:** Cursor-based using `?cursor=<opaque>&limit=20`
- **Errors:** Consistent JSON error envelope: `{ "error": { "message": "..." } }`
- **Content-Type:** `application/json` except media uploads (`multipart/form-data`)

See **[API Reference](api-reference.md)** for full endpoint documentation.

### Key Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/auth/register` | POST | No | Create account |
| `/auth/login` | POST | No | Get JWT + refresh token |
| `/auth/refresh` | POST | No | Rotate refresh token |
| `/auth/logout` | POST | Yes | Revoke all refresh tokens |
| `/users/search` | GET | Yes | Search by username/display name |
| `/users/:id` | GET | No | Public profile with follower counts |
| `/profile` | PUT | Yes | Update own profile |
| `/users/:id/follow` | POST/DELETE | Yes | Follow/unfollow |
| `/users/:id/followers` | GET | No | List followers |
| `/users/:id/following` | GET | No | List following |
| `/posts` | POST | Yes | Create post (with optional signature) |
| `/posts/:id` | GET/DELETE | Yes | Get/delete post |
| `/posts/:id/react` | POST/DELETE | Yes | Add/remove emoji reaction |
| `/posts/:id/replies` | GET | Yes | Paginated replies |
| `/feed` | GET | Yes | Paginated feed (followed + self) |
| `/chats` | POST/GET | Yes | Create/list conversations |
| `/chats/:id/messages` | GET | Yes | Paginated messages |
| `/keys/bundle` | PUT/GET | Yes | Signal Protocol key management |
| `/ws/ticket` | POST | Yes | Get one-time WS auth ticket |
| `/ws` | WS | Ticket | Real-time chat |
| `/upload` | POST | Yes | Image upload |

---

## Authentication & Authorization

### Token Strategy

```
Client                              Server
  │  POST /auth/login                 │
  │ ──────────────────────────────►   │
  │                                   │  Validates password with Argon2id
  │  { user, token, refresh_token }   │
  │ ◄──────────────────────────────   │
  │                                   │
  │  GET /api/v1/feed                 │
  │  Authorization: Bearer <JWT>      │
  │ ──────────────────────────────►   │  Verifies JWT signature + expiry
  │  { data: [...] }                 │
  │ ◄──────────────────────────────   │
```

- **Access token:** JWT (HS256), 15-minute expiry. Contains `sub` (user_id), `username`, `iat`, `exp`. Stateless validation.
- **Refresh token:** Opaque UUID, 30-day expiry, stored in `refresh_tokens` table. Rotated on each use. Revoked on logout.
- **Password hashing:** Argon2id with configurable parameters via `ARGON2_M_COST`, `ARGON2_T_COST`, `ARGON2_P_COST` env vars (defaults to OWASP-recommended m=47104, t=1, p=1).
- **JWT secret:** Must be 32+ characters, validated on startup. Known defaults are rejected.
- **Token storage:** localStorage on the frontend (migrate to httpOnly cookies for production).

### Authorization Model

| Action | Rule |
|---|---|
| Read public profile | Anyone |
| Edit profile | Owner only |
| Create post | Authenticated |
| Delete post | Author only |
| Follow user | Authenticated |
| Read feed | Authenticated |
| Send message | Conversation member |
| Read messages | Conversation member |
| Upload media | Authenticated, within rate limits |

---

## Media Pipeline

### Current Implementation

Simple file upload to local filesystem:

```
Client                    Axum Server                /uploads
  │                          │                         │
  │  POST /upload            │                         │
  │  (multipart/form-data)   │                         │
  │ ────────────────────────►│                         │
  │                          │  1. Validate MIME type   │
  │                          │     (jpeg/png/gif/webp)  │
  │                          │  2. Enforce 10 MB limit  │
  │                          │     (middleware layer)    │
  │                          │  3. Reject path traversal│
  │                          │  4. Generate UUID name    │
  │                          │                         │
  │                          │  Write to /uploads/      │
  │                          │ ───────────────────────►│
  │                          │                         │
  │  { url: "/api/v1/uploads/uuid.png" }              │
  │ ◄────────────────────────│                         │
```

Uploads are served with `Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`.

### Future: MinIO Object Storage

Replace local `/uploads` with S3-compatible storage. Add EXIF stripping, blurhash generation, and signed download URLs.

---

## Real-Time Chat & E2E Encryption

### WebSocket Architecture

```
┌────────┐  WSS  ┌──────────────────────────────────┐
│Client A│◄─────►│         Axum WS Handler           │
└────────┘       │                                    │
                 │  ┌──────────────────────────────┐  │
┌────────┐  WSS  │  │   Connection Manager          │  │
│Client B│◄─────►│  │   (in-memory HashMap of       │  │
└────────┘       │  │    user_id → Vec<Sender>)      │  │
                 │  │   Max 5 connections/user       │  │
                 │  └──────────────────────────────┘  │
                 └──────────────────────────────────┘
```

**Auth flow:** Client gets a one-time ticket via `POST /ws/ticket` (30s expiry), then connects via `GET /ws?ticket=<ticket>`.

### E2E Encryption: Signal Protocol

Fully implemented client-side using `@privacyresearch/libsignal-protocol-typescript`.

#### DM Encryption (Signal Protocol)
1. **X3DH key agreement** — 4 Diffie-Hellman operations establish a shared secret
2. **Double Ratchet** — Derives new encryption keys per message (forward secrecy)
3. **Key management** — Identity keys, signed prekeys, and one-time prekeys managed via REST API

#### Group Encryption (AES-256-GCM)
- Shared group key generated by the first sender
- Distributed to members via pairwise Signal Protocol messages
- Key stored in IndexedDB per conversation
- Key rotated when membership changes (members added/removed)

#### Post Signing (Ed25519)
- Posts signed client-side via Web Crypto API
- Signatures verified by other clients against the author's public signing key
- Badge shows verified/unverified/unsigned status

See **[Encryption](encryption.md)** for full protocol details.

---

## Feed System

### Current: Pull-Based Chronological with Cursor Pagination

```sql
SELECT p.*, u.username, u.display_name, u.is_bot, u.signing_key,
       reaction_counts, user_reaction, reply_count
FROM posts p
JOIN users u ON u.id = p.author_id
WHERE (p.author_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
       OR p.author_id = $1)
  AND p.parent_id IS NULL
  AND (p.created_at, p.id) < ($cursor_ts, $cursor_id)
ORDER BY p.created_at DESC, p.id DESC
LIMIT $limit
```

Pagination uses opaque base64-encoded cursors containing `(created_at, id)`.

### Future: Cached + Ranked Feed

- **Phase 2:** Fan-out-on-write with Redis sorted sets
- **Phase 3:** Graph-enhanced ranking using Neo4j (affinity, engagement signals)

---

## Content Rendering & Security

### Markdown Processing

Posts support rich content via markdown:

| Feature | Rendered As |
|---|---|
| Bold, italic, etc. | Formatted text |
| Code blocks (` ```lang `) | Syntax highlighted (highlight.js) |
| Images `![](url)` | Inline images |
| Links `[text](url)` | Sanitized anchor tags |
| YouTube/Spotify/SoundCloud URLs | Embedded iframes |

### Security Measures

- **Sanitization:** `isomorphic-dompurify` on both SSR and client paths
- **CSP:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' wss:; frame-ancestors 'none'`
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- **Rate limiting:** Per-IP, per-endpoint (auth 5/min, key bundles 20/min, uploads 10/min, general 60/min)
- **Body limits:** 11 MB max request size at middleware layer
- **Upload validation:** MIME type whitelist, path traversal rejection, UUID filenames

---

## Infrastructure & Deployment

### Docker Compose

```yaml
services:
  postgres:    # PostgreSQL 16 with health check
  backend:     # Multi-stage Rust build (rust:alpine → alpine:3.21)
  frontend:    # Node 22 alpine, Vite dev server
```

Secrets are loaded from `.env` file (not hardcoded). See **[Deployment](deployment.md)**.

### Project Structure

```
oceana/
├── docs/                          # This documentation
├── scripts/
│   ├── bot-activity.sh            # Bot content generation (signed posts, reactions, etc.)
│   └── images/                    # Local ocean-themed test images
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── migrations/                # 001-010 + 999_seed.sql
│   └── src/
│       ├── main.rs                # Server startup, migration, router, middleware
│       ├── error.rs               # AppError enum → JSON responses
│       ├── models.rs              # DB rows, request/response structs, pagination
│       ├── chat.rs                # WebSocket connection manager
│       ├── auth.rs                # JWT, Argon2id, AuthUser extractor
│       ├── rate_limit.rs          # Per-IP rate limiter (DashMap)
│       └── routes.rs              # All route handlers (REST + WS + Signal keys)
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── svelte.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── app.html, app.css      # Shell + dark ocean terminal theme
│       ├── hooks.server.ts        # API proxy to backend
│       ├── lib/
│       │   ├── api.ts             # Typed fetch wrapper with JWT auth
│       │   ├── types.ts           # TypeScript interfaces
│       │   ├── ws.ts              # WebSocket with ticket-based auth
│       │   ├── crypto/            # Signal Protocol + Ed25519 + group keys
│       │   ├── stores/            # auth.ts, chat.ts
│       │   └── components/        # Markdown.svelte
│       └── routes/                # SvelteKit file-based routing
├── docker-compose.yml
├── .env.example
├── test.sh                        # Integration test suite
└── .gitignore
```

---

## Learning Roadmap

### Phase 1: Foundation — COMPLETE
- [x] Monorepo with `backend/` and `frontend/`
- [x] Docker Compose with PostgreSQL
- [x] Axum server with health check
- [x] Database migrations (inline SQL, split-by-semicolon)
- [x] User registration and login (Argon2id + JWT)
- [x] SvelteKit frontend with all pages

### Phase 2: Core Social Features — COMPLETE
- [x] User profiles (display_name, bio, follower/following counts)
- [x] Post creation (markdown text, optional Ed25519 signature)
- [x] Follow/unfollow
- [x] Chronological feed with cursor-based pagination
- [x] Post replies and threading (multi-level)
- [x] Emoji reactions (any emoji, likes 👍, yikes 😬)
- [x] User search (ILIKE matching)

### Phase 3: Media — PARTIAL
- [x] Image upload endpoint with MIME validation
- [x] Image display in posts and chat
- [x] Syntax highlighted code blocks (highlight.js)
- [ ] MinIO object storage (currently local filesystem)
- [ ] EXIF stripping and blurhash generation

### Phase 4: Real-Time Chat — COMPLETE
- [x] WebSocket handler with ticket-based auth
- [x] Connection manager (in-memory, 5 connections/user max)
- [x] Conversation creation and message history
- [x] Real-time message delivery
- [x] Typing indicators
- [x] Verify identity requests

### Phase 5: E2E Encryption — COMPLETE
- [x] Key generation (Curve25519 + Ed25519) on client
- [x] Key bundle upload/fetch API with OPK management
- [x] X3DH key agreement
- [x] AES-256-GCM message encryption
- [x] Double Ratchet for forward secrecy
- [x] Group chat E2EE (AES-256-GCM with group key distribution)
- [x] Key verification UI (safety numbers / fingerprint modal)
- [x] Ed25519 post signing + verification badges

### Phase 6: Graph Database — NOT STARTED
- [ ] Neo4j integration
- [ ] Social graph sync from PostgreSQL
- [ ] Friend-of-friend recommendations
- [ ] Community detection, PageRank, content recommendation

### Phase 7: Hardening — IN PROGRESS
- [x] Rate limiting per endpoint
- [x] Content Security Policy + security headers
- [x] Input validation on all endpoints (username charset, email format, password length cap)
- [x] Secrets in `.env` (not hardcoded)
- [x] CORS requires explicit origin
- [x] WS ticket-based auth (replaces JWT in URL)
- [x] Body size limits at middleware layer
- [x] Fix silent encryption fallback to plaintext
- [x] WS message rate limiting and size validation
- [x] Group key rotation on membership changes
- [x] Token refresh/revocation (15-min access + 30-day refresh tokens)
- [x] Configurable Argon2 parameters (OWASP defaults)
- [x] Key bundle endpoint rate limiting (20/min)
- [x] Backend unit tests (114 tests)
- [x] Frontend unit tests (99 tests)
- [x] Integration test suite (test.sh)
- [ ] CI pipeline

---

## Future Architecture

These components are planned but not yet implemented:

### Neo4j (Graph Database)
Social graph queries, friend-of-friend recommendations, community detection (Louvain), PageRank influence scoring, content recommendation based on reaction similarity.

### Redis (Cache & Pub/Sub)
Feed caching with sorted sets, WebSocket message fan-out for multi-instance deployments, session storage.

### MinIO (Object Storage)
Replace local `/uploads` with S3-compatible storage. Add signed download URLs, EXIF stripping, blurhash generation, and thumbnail creation.

---

## Open Design Decisions

| Decision | Current | Notes |
|---|---|---|
| Search | Not implemented | Start with PostgreSQL `tsvector`, add Meilisearch later |
| Notifications | Not implemented | WebSocket already in place, reuse for push |
| Mobile | Not implemented | PWA via SvelteKit is free, native is separate |
| Email | Not implemented | Not needed for learning project |
