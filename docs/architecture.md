# Oceana - Architecture & API Design

A social media platform built for learning, with a Rust backend, secure frontend, graph database experiments, and encryption-first design.

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
- [Graph Database & Data Science](#graph-database--data-science)
- [Content Rendering & Security](#content-rendering--security)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Learning Roadmap](#learning-roadmap)

---

## System Overview

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
│  │ Service │ │ Service  │ │Service │ │Service│ │  Service   │    │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──┬───┘ └──────┬──────┘    │
│       │           │           │         │            │           │
│  ┌────┴───────────┴───────────┴─────────┴────────────┴───────┐   │
│  │                   Middleware Layer                        │   │
│  │  Rate Limit · CORS · Auth · Logging · Compression         │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────┬──────────────┬──────────-───┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐
│ PostgreSQL │ │   Neo4j    │ │  Redis   │ │   MinIO    │
│  (primary  │ │  (graph    │ │ (cache,  │ │  (object   │
│   store)   │ │   queries) │ │  pub/sub)│ │   storage) │
└────────────┘ └────────────┘ └──────────┘ └────────────┘
```

---

## Technology Stack

### Backend (Rust)

| Component | Crate | Purpose |
|---|---|---|
| Web framework | `axum` | Async HTTP/WS server built on `tokio` and `tower` |
| Database | `sqlx` | Compile-time checked async SQL (PostgreSQL) |
| Graph DB | `neo4rs` | Neo4j async driver |
| Cache/RT | `redis` (crate) | Session store, feed cache, pub/sub |
| Serialization | `serde`, `serde_json` | JSON request/response handling |
| Auth tokens | `jsonwebtoken` | JWT creation and validation |
| Password hashing | `argon2` | Argon2id password hashing |
| Encryption | `x25519-dalek`, `aes-gcm` | Key exchange and symmetric encryption for E2E chat |
| WebSockets | `tokio-tungstenite` | Real-time bidirectional communication |
| Middleware | `tower-http` | CORS, rate limiting, compression, tracing |
| Object storage | `rust-s3` | S3-compatible API for MinIO |
| Validation | `validator` | Request payload validation |
| Tracing | `tracing`, `tracing-subscriber` | Structured logging and observability |
| Migration | `sqlx-cli` | Database schema migrations |

### Frontend

| Component | Tool | Purpose |
|---|---|---|
| Framework | SvelteKit | SSR + SPA hybrid, minimal runtime |
| Language | TypeScript | Type safety mirroring Rust's philosophy |
| Markdown | `marked` + `DOMPurify` | Render and sanitize user markdown |
| Syntax highlighting | `shiki` | Code block highlighting |
| Media | Native `<video>`, `<img>` | Browser-native media playback |
| WebSocket | Native `WebSocket` API | Real-time chat connection |
| Crypto | Web Crypto API | Client-side E2E encryption primitives |
| CSS | Tailwind CSS | Utility-first styling |

### Infrastructure

| Component | Tool | Purpose |
|---|---|---|
| Containers | Docker + docker-compose | Reproducible dev environment |
| Primary DB | PostgreSQL 16 | Users, posts, messages, media metadata |
| Graph DB | Neo4j 5 | Social graph, recommendations, analytics |
| Cache | Redis 7 | Sessions, feed cache, chat pub/sub |
| Object storage | MinIO | Self-hosted S3-compatible media storage |
| Reverse proxy | Caddy or Nginx | TLS termination, static files |

---

## Data Layer

### Polyglot Persistence Strategy

Each datastore is chosen for what it does best. PostgreSQL is the **source of truth** for all transactional data. Other stores are derived or supplementary.

```
PostgreSQL (source of truth)
    │
    ├──► Neo4j  (event-driven sync of social graph edges)
    ├──► Redis  (cache invalidation on write)
    └──► MinIO  (media referenced by URL in postgres rows)
```

### PostgreSQL Schema

```sql
-- Core identity
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(32) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public-facing profile, separate from auth data
CREATE TABLE profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(64),
    bio         TEXT,
    avatar_url  TEXT,
    banner_url  TEXT,
    location    VARCHAR(128),
    website     VARCHAR(255),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social graph edges (also mirrored to Neo4j)
CREATE TABLE follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);

-- Posts support multiple content types
CREATE TABLE posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT,                          -- markdown text body
    content_type VARCHAR(16) NOT NULL DEFAULT 'markdown',  -- 'markdown', 'plain'
    parent_id   UUID REFERENCES posts(id) ON DELETE SET NULL,  -- for replies/threads
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Media attachments linked to posts
CREATE TABLE media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type  VARCHAR(16) NOT NULL,          -- 'image', 'video', 'audio', 'file'
    mime_type   VARCHAR(128) NOT NULL,
    storage_key TEXT NOT NULL,                  -- key in MinIO/S3
    file_size   BIGINT NOT NULL,
    width       INT,                            -- for images/video
    height      INT,
    duration_ms INT,                            -- for video/audio
    blurhash    TEXT,                            -- placeholder while loading
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reactions on posts
CREATE TABLE reactions (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    kind        VARCHAR(16) NOT NULL DEFAULT 'like',
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

-- Chat messages - ciphertext only when E2E is enabled
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ciphertext      BYTEA,                      -- encrypted message body
    nonce           BYTEA,                      -- encryption nonce
    plaintext       TEXT,                        -- only used if E2E is off (dev/testing)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identity keys for E2E encryption
CREATE TABLE user_keys (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    identity_pubkey BYTEA NOT NULL,             -- X25519 public key
    signed_prekey   BYTEA NOT NULL,             -- signed pre-key bundle
    prekey_signature BYTEA NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time pre-keys (consumed on first message)
CREATE TABLE one_time_prekeys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pubkey      BYTEA NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_posts_author ON posts(author_id, created_at DESC);
CREATE INDEX idx_posts_parent ON posts(parent_id);
CREATE INDEX idx_media_post ON media(post_id);
CREATE INDEX idx_follows_followed ON follows(followed_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_reactions_post ON reactions(post_id);
```

### Neo4j Graph Model

Nodes and relationships mirrored from PostgreSQL:

```cypher
// Nodes
(:User {id, username, display_name})
(:Post {id, content_preview, created_at})
(:Tag  {name})

// Relationships
(:User)-[:FOLLOWS {since}]->(:User)
(:User)-[:AUTHORED]->(:Post)
(:User)-[:REACTED {kind}]->(:Post)
(:Post)-[:REPLY_TO]->(:Post)
(:Post)-[:TAGGED]->(:Tag)
(:User)-[:INTERESTED_IN]->(:Tag)
```

**Example graph queries:**

```cypher
-- Friends of friends you don't follow yet (recommendations)
MATCH (me:User {id: $user_id})-[:FOLLOWS]->()-[:FOLLOWS]->(suggestion:User)
WHERE NOT (me)-[:FOLLOWS]->(suggestion) AND suggestion.id <> $user_id
RETURN suggestion, count(*) AS mutual_connections
ORDER BY mutual_connections DESC
LIMIT 10

-- How a post spread through the network
MATCH path = (origin:Post {id: $post_id})<-[:REPLY_TO*1..5]-(reply)
RETURN path

-- Community detection (built-in algorithm)
CALL gds.louvain.stream('social-graph')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).username AS user, communityId
ORDER BY communityId

-- Degrees of separation
MATCH path = shortestPath(
    (a:User {id: $user_a})-[:FOLLOWS*..6]-(b:User {id: $user_b})
)
RETURN length(path) AS degrees, path
```

### Redis Usage

| Key Pattern | Type | Purpose | TTL |
|---|---|---|---|
| `session:{token}` | String (JSON) | User session data | 7 days |
| `feed:{user_id}` | Sorted Set | Cached feed post IDs, scored by timestamp | 1 hour |
| `rate:{ip}:{endpoint}` | String (counter) | Rate limiting | 1 minute |
| `online:{user_id}` | String | Presence tracking | 5 minutes |
| `chat:{conversation_id}` | Pub/Sub channel | Real-time message delivery | N/A |

---

## API Design

### Conventions

- **Base URL:** `/api/v1/`
- **Auth:** Bearer token in `Authorization` header
- **Pagination:** Cursor-based using `?cursor=<opaque>&limit=20`
- **Errors:** Consistent JSON error envelope
- **Content-Type:** `application/json` except media uploads (`multipart/form-data`)

### Error Format

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Username must be between 3 and 32 characters",
        "field": "username"
    }
}
```

### Endpoints

#### Authentication

```
POST /api/v1/auth/register
    Body: { username, email, password }
    Returns: { user, access_token, refresh_token }

POST /api/v1/auth/login
    Body: { email, password }
    Returns: { user, access_token, refresh_token }

POST /api/v1/auth/refresh
    Body: { refresh_token }
    Returns: { access_token, refresh_token }

POST /api/v1/auth/logout
    Invalidates the current refresh token
```

#### Users & Profiles

```
GET    /api/v1/users/:id
    Returns: { user, profile, follower_count, following_count }

GET    /api/v1/users/:id/posts
    Returns: paginated list of user's posts

PUT    /api/v1/profile
    Body: { display_name?, bio? }
    Returns: { user }

GET    /api/v1/users/:id/followers
    Returns: paginated list of followers

GET    /api/v1/users/:id/following
    Returns: paginated list of followed users

POST   /api/v1/users/:id/follow
    Follows the user

DELETE /api/v1/users/:id/follow
    Unfollows the user
```

#### Posts

```
POST   /api/v1/posts
    Body (multipart): {
        content: "markdown text",
        content_type: "markdown",
        media_ids: ["uuid", ...],       // previously uploaded
        parent_id?: "uuid"              // if replying
    }
    Returns: { post, media }

GET    /api/v1/posts/:id
    Returns: { post, author, media, reactions_summary }

DELETE /api/v1/posts/:id
    Deletes post (must be author)

POST   /api/v1/posts/:id/reactions
    Body: { kind: "like" }
    Returns: { reaction }

DELETE /api/v1/posts/:id/reactions
    Removes reaction

GET    /api/v1/posts/:id/replies
    Returns: paginated replies
```

#### Feed

```
GET    /api/v1/feed
    Query: ?cursor=<opaque>&limit=20
    Returns: {
        posts: [{ post, author, media, reactions_summary }],
        next_cursor: "opaque"
    }
```

#### Media

```
POST   /api/v1/media/upload
    Body (multipart): file + metadata
    Processing: validate type, strip EXIF, generate blurhash, store in MinIO
    Returns: { media_id, media_type, url }

GET    /api/v1/media/:id
    Returns: 302 redirect to time-limited signed URL
```

#### Chat

```
GET    /api/v1/chats
    Returns: list of conversations with last message preview

POST   /api/v1/chats
    Body: { participant_ids: ["uuid", ...] }
    Returns: { conversation }

GET    /api/v1/chats/:id/messages
    Query: ?cursor=<opaque>&limit=50
    Returns: paginated messages (ciphertext if E2E)

GET    /api/v1/chats/:id/members
    Returns: list of conversation members
```

#### Key Exchange (E2E Encryption)

```
PUT    /api/v1/keys/bundle
    Body: { identity_pubkey, signed_prekey, prekey_signature, one_time_prekeys: [...] }
    Uploads key bundle for other users to initiate E2E sessions

GET    /api/v1/keys/:user_id/bundle
    Returns: the user's public key bundle (consumes one one-time prekey)
```

#### WebSocket

```
WS /api/v1/ws
    Auth: token passed as query param or first message

    Client → Server messages:
    { "type": "chat_message", "conversation_id": "uuid", "ciphertext": "base64", "nonce": "base64" }
    { "type": "typing", "conversation_id": "uuid" }
    { "type": "presence", "status": "online" }

    Server → Client messages:
    { "type": "chat_message", "conversation_id": "uuid", "sender_id": "uuid", "ciphertext": "base64", "nonce": "base64", "created_at": "iso8601" }
    { "type": "typing", "conversation_id": "uuid", "user_id": "uuid" }
    { "type": "notification", "kind": "follow|reaction|reply", "data": {...} }
```

---

## Authentication & Authorization

### Token Strategy

```
┌──────────┐     POST /auth/login      ┌──────────────┐
│  Client  │ ──────────────────────────►│    Server    │
│          │◄────────────────────────── │              │
│          │  { access_token (JWT),     │  Validates   │
│          │    refresh_token (opaque)} │  password    │
│          │                            │  with        │
│          │  GET /api/v1/feed          │  Argon2id    │
│          │  Authorization: Bearer JWT │              │
│          │ ──────────────────────────►│  Verifies    │
│          │◄────────────────────────── │  JWT sig +   │
│          │  { feed data }             │  expiry      │
└──────────┘                            └──────────────┘
```

- **Access token:** JWT, signed with Ed25519, 15-minute expiry. Contains `user_id`, `username`, `iat`, `exp`. Stateless validation.
- **Refresh token:** Opaque random string stored in PostgreSQL. 7-day expiry. Stored in `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- **Password hashing:** Argon2id with recommended parameters (19 MiB memory, 2 iterations, 1 parallelism).

### Authorization Model

Simple role-based to start:

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
| Upload media | Authenticated, within size/rate limits |

---

## Media Pipeline

### Upload Flow

```
Client                    Axum Server                MinIO
  │                          │                         │
  │  POST /media/upload      │                         │
  │  (multipart/form-data)   │                         │
  │ ────────────────────────►│                         │
  │                          │  1. Validate file type  │
  │                          │     (magic bytes, not   │
  │                          │      just extension)    │
  │                          │  2. Enforce size limits │
  │                          │  3. Strip EXIF metadata │
  │                          │  4. Generate blurhash   │
  │                          │  5. Create thumbnails   │
  │                          │                         │
  │                          │  PUT object             │
  │                          │ ───────────────────────►│
  │                          │◄─────────────────────── │
  │                          │                         │
  │                          │  6. Store metadata in   │
  │                          │     PostgreSQL          │
  │                          │                         │
  │  { media_id, url }       │                         │
  │ ◄────────────────────────│                         │
```

### Supported Media Types

| Type | Formats | Max Size | Processing |
|---|---|---|---|
| Image | JPEG, PNG, WebP, GIF | 10 MB | Strip EXIF, generate blurhash, resize thumbnails |
| Video | MP4 (H.264), WebM | 100 MB | Extract thumbnail, transcode if needed |
| Audio | MP3, OGG, WAV | 20 MB | Extract duration |
| File | PDF | 25 MB | Virus scan |

### Security Measures

- Validate file contents by reading magic bytes, not trusting `Content-Type` or extension
- Strip all EXIF/metadata from images (prevents GPS leaks)
- Serve media from a separate domain/subdomain to prevent cookie leakage
- All download URLs are time-limited signed URLs (expire after 1 hour)
- Virus scanning via ClamAV before storage
- Rate limit uploads per user (e.g., 50 uploads/hour)

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
└────────┘       │  │    user_id → ws_sender)        │  │
                 │  └──────────┬───────────────────┘  │
                 │             │                      │
                 │             ▼                      │
                 │  ┌──────────────────────────────┐  │
                 │  │   Redis Pub/Sub               │  │
                 │  │   (for multi-instance)         │  │
                 │  └──────────────────────────────┘  │
                 └──────────────────────────────────┘
```

Single instance: deliver messages via in-memory connection map.
Multi-instance: publish to Redis pub/sub, all instances subscribe and deliver to local connections.

### E2E Encryption: Signal Protocol (Simplified)

This is the most complex and rewarding security feature to implement.

#### Key Concepts

1. **Identity Key** - Long-term X25519 keypair per user. Public part uploaded to server.
2. **Signed Pre-Key** - Medium-term key signed by identity key. Rotated periodically.
3. **One-Time Pre-Keys** - Ephemeral keys uploaded in batches. Each consumed once.
4. **Double Ratchet** - Derives new encryption keys for every message, providing forward secrecy.

#### Session Setup (X3DH Key Agreement)

```
Alice wants to message Bob for the first time:

1. Alice fetches Bob's key bundle from server:
   - Bob's identity key (IK_B)
   - Bob's signed pre-key (SPK_B)
   - One one-time pre-key (OPK_B) — consumed

2. Alice generates an ephemeral key pair (EK_A)

3. Alice computes shared secret from 4 DH operations:
   DH1 = X25519(IK_A_private, SPK_B)
   DH2 = X25519(EK_A_private, IK_B)
   DH3 = X25519(EK_A_private, SPK_B)
   DH4 = X25519(EK_A_private, OPK_B)

   shared_secret = KDF(DH1 || DH2 || DH3 || DH4)

4. Alice sends initial message with:
   - Her identity key (IK_A)
   - Her ephemeral key (EK_A)
   - Which one-time pre-key she used
   - Ciphertext encrypted with shared_secret

5. Bob reconstructs the same shared_secret using his private keys
```

#### Message Encryption

```
For each message:
1. Derive message key from Double Ratchet state
2. Encrypt: AES-256-GCM(message_key, nonce, plaintext)
3. Send: { ciphertext, nonce, ratchet_header }

The server only ever sees ciphertext. It cannot read messages.
```

#### Rust Crates for Implementation

```toml
[dependencies]
x25519-dalek = "2"      # X25519 key exchange
aes-gcm = "0.10"        # AES-256-GCM encryption
hkdf = "0.12"           # Key derivation
sha2 = "0.10"           # SHA-256 for KDF
rand = "0.8"            # Secure random generation
```

---

## Feed System

### Feed Generation Strategy

Start simple, evolve incrementally:

#### Phase 1: Pull-Based Chronological

```sql
-- Simple: get posts from people you follow, newest first
SELECT p.*, u.username, u.display_name, pr.avatar_url
FROM posts p
JOIN follows f ON f.followed_id = p.author_id
JOIN users u ON u.id = p.author_id
LEFT JOIN profiles pr ON pr.user_id = u.id
WHERE f.follower_id = $1
ORDER BY p.created_at DESC
LIMIT $2
OFFSET 0  -- use cursor-based pagination instead in practice
```

#### Phase 2: Cached with Redis

```
On post creation:
  1. Insert into PostgreSQL
  2. Fan-out: push post_id to Redis sorted sets for each follower
     ZADD feed:{follower_id} {timestamp} {post_id}

On feed read:
  1. ZREVRANGE feed:{user_id} cursor limit → post IDs
  2. Batch-fetch posts from PostgreSQL
  3. Return assembled feed
```

#### Phase 3: Ranked (Graph-Enhanced)

Query Neo4j for ranking signals:

```cypher
// Get engagement score for feed ranking
MATCH (me:User {id: $user_id})-[:FOLLOWS]->(author:User)-[:AUTHORED]->(post:Post)
WHERE post.created_at > datetime() - duration('P1D')
OPTIONAL MATCH (post)<-[r:REACTED]-()
WITH post, author, count(r) AS reactions,
     // Boost posts from users you interact with often
     size((me)-[:REACTED]->()<-[:AUTHORED]-(author)) AS affinity
RETURN post.id, reactions * 0.3 + affinity * 0.7 AS score
ORDER BY score DESC
LIMIT 50
```

---

## Content Rendering & Security

### Markdown Processing

Posts support rich content via markdown with extensions:

| Feature | Syntax | Rendered As |
|---|---|---|
| Bold, italic, etc. | Standard markdown | Formatted text |
| Code blocks | ` ```rust ` | Syntax highlighted (shiki) |
| Images | `![alt](media_id)` | Inline images from media pipeline |
| Links | `[text](url)` | Sanitized anchor tags |
| Mentions | `@username` | Profile link |
| Hashtags | `#topic` | Tag link, indexed in Neo4j |

### Security: Content Sanitization

```
User input → Server-side sanitize → Store → Client-side sanitize → Render

Server-side (Rust):
  - Parse markdown with `pulldown-cmark`
  - Strip all HTML tags except safe allowlist
  - Validate URLs (no javascript: schemes)
  - Limit nesting depth

Client-side (SvelteKit):
  - Render markdown with `marked`
  - Sanitize HTML output with `DOMPurify`
  - CSP headers prevent inline scripts
```

### Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' media.oceana.local;
  media-src 'self' media.oceana.local;
  connect-src 'self' wss://oceana.local;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
```

---

## Graph Database & Data Science

### Sync Strategy: PostgreSQL → Neo4j

Event-driven sync using application-level events (upgrade to CDC later):

```rust
// After a follow is created in PostgreSQL:
async fn on_follow_created(follower_id: Uuid, followed_id: Uuid, neo4j: &Graph) {
    neo4j.run(
        query("MERGE (a:User {id: $fid}) MERGE (b:User {id: $tid}) MERGE (a)-[:FOLLOWS {since: datetime()}]->(b)")
            .param("fid", follower_id.to_string())
            .param("tid", followed_id.to_string())
    ).await.unwrap();
}
```

### Experiments to Try

#### 1. Community Detection

Find clusters of users who interact heavily with each other:

```cypher
// Project graph and run Louvain
CALL gds.graph.project('social', 'User', 'FOLLOWS')
CALL gds.louvain.stream('social')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).username, communityId
ORDER BY communityId
```

#### 2. Influence Scoring (PageRank)

```cypher
CALL gds.pageRank.stream('social')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).username AS user, score
ORDER BY score DESC
LIMIT 20
```

#### 3. Content Recommendation

```cypher
// Users who reacted to similar posts also reacted to...
MATCH (me:User {id: $uid})-[:REACTED]->(p:Post)<-[:REACTED]-(similar:User)
WHERE similar <> me
MATCH (similar)-[:REACTED]->(rec:Post)
WHERE NOT (me)-[:REACTED]->(rec)
RETURN rec.id, count(similar) AS score
ORDER BY score DESC
LIMIT 20
```

#### 4. Content Virality Analysis

```cypher
// Track how a post spreads through reply chains
MATCH path = (origin:Post {id: $pid})<-[:REPLY_TO*1..10]-(reply)
WITH reply, length(path) AS depth
MATCH (reply)<-[:AUTHORED]-(author:User)
RETURN depth, count(reply) AS replies_at_depth, collect(author.username) AS authors
ORDER BY depth
```

#### 5. Six Degrees of Separation

```cypher
MATCH path = shortestPath(
    (a:User {username: $user_a})-[:FOLLOWS*..6]-(b:User {username: $user_b})
)
RETURN [n IN nodes(path) | n.username] AS chain, length(path) AS degrees
```

---

## Infrastructure & Deployment

### Docker Compose (Development)

Current setup — one command runs everything:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: oceana
      POSTGRES_USER: oceana
      POSTGRES_PASSWORD: oceana_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oceana"]
      interval: 2s
      timeout: 3s
      retries: 10

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://oceana:oceana_dev@postgres:5432/oceana
      JWT_SECRET: dev-secret-change-in-production
    ports:
      - "3001:3000"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    environment:
      API_URL: http://backend:3000
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  pgdata:
```

**Future additions** (as features are built):
- Neo4j for graph queries and recommendations
- Redis for caching, sessions, and chat pub/sub
- MinIO for media/object storage

### Project Structure

**Current (Phase 2 — full-stack MVP):**

```
oceana/
├── docs/
│   ├── architecture.md          # this document
│   ├── dev-pilot.md             # implementation progress tracker
│   └── lessons.md               # structured learning curriculum
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile               # multi-stage Rust build
│   ├── .env                     # DATABASE_URL, JWT_SECRET (local dev)
│   ├── src/
│   │   ├── main.rs              # entry point, server startup, migration
│   │   ├── error.rs             # AppError enum → JSON responses
│   │   ├── models.rs            # DB rows, request/response structs
│   │   ├── auth.rs              # JWT, Argon2id, AuthUser extractor
│   │   └── routes.rs            # all route handlers
│   └── migrations/
│       └── 001_initial.sql
├── frontend/
│   ├── Dockerfile               # Node 22 alpine, Vite dev server
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── app.html
│       ├── app.css              # dark ocean terminal theme
│       ├── hooks.server.ts      # API proxy to backend
│       ├── lib/
│       │   ├── api.ts           # typed fetch wrapper with JWT
│       │   ├── types.ts         # User, Post, PostWithAuthor, AuthResponse
│       │   └── stores/
│       │       └── auth.ts      # Svelte store (localStorage, SSR-safe)
│       └── routes/
│           ├── +layout.svelte   # nav bar
│           ├── +page.svelte     # feed
│           ├── login/+page.svelte
│           ├── register/+page.svelte
│           ├── settings/+page.svelte
│           ├── users/[id]/+page.svelte
│           └── posts/[id]/+page.svelte
├── docker-compose.yml           # postgres + backend + frontend
├── test.sh                      # curl smoke test
└── .gitignore
```

**Target (as features are added, split into subdirectories):**

```
oceana/
├── docs/
├── backend/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs            # environment/config loading
│   │   ├── error.rs
│   │   ├── routes/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── users.rs
│   │   │   ├── posts.rs
│   │   │   ├── feed.rs
│   │   │   ├── media.rs
│   │   │   ├── chat.rs
│   │   │   └── keys.rs
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   ├── user.rs
│   │   │   ├── post.rs
│   │   │   ├── media.rs
│   │   │   ├── message.rs
│   │   │   └── conversation.rs
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── feed.rs
│   │   │   ├── media.rs
│   │   │   ├── chat.rs
│   │   │   └── graph.rs         # Neo4j sync and queries
│   │   ├── middleware/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs          # JWT extraction/validation
│   │   │   └── rate_limit.rs
│   │   └── crypto/
│   │       ├── mod.rs
│   │       ├── passwords.rs     # Argon2id
│   │       ├── tokens.rs        # JWT
│   │       └── e2e.rs           # X25519, key bundles
│   └── migrations/
├── frontend/                    # SvelteKit (Phase 7)
├── docker-compose.yml
└── test.sh
```

---

## Learning Roadmap

### Phase 1: Foundation

- [x] Set up monorepo with `backend/` and `frontend/` directories
- [x] Docker Compose with PostgreSQL
- [x] Axum hello world with health check endpoint
- [x] Database migrations (inline SQL; upgrade to `sqlx-cli` later)
- [x] User registration and login (Argon2id + JWT)
- [x] SvelteKit frontend with login/register, feed, profiles, settings

### Phase 2: Core Social Features

- [x] User profiles (CRUD)
- [x] Post creation (text/markdown only, no media yet)
- [x] Follow/unfollow
- [x] Chronological feed (pull-based from PostgreSQL)
- [ ] Post replies and threading
- [ ] Reactions
- [x] Frontend pages for feed, profiles, post detail

### Phase 3: Media

- [ ] Add MinIO to docker-compose
- [ ] Media upload endpoint with validation
- [ ] EXIF stripping and blurhash generation
- [ ] Signed URL generation for downloads
- [ ] Image and video display in posts
- [ ] Syntax highlighted code blocks in frontend

### Phase 4: Real-Time Chat

- [ ] WebSocket handler in Axum
- [ ] Connection manager (in-memory)
- [ ] Conversation creation and message history
- [ ] Real-time message delivery
- [ ] Typing indicators and presence
- [ ] Redis pub/sub for multi-instance support

### Phase 5: E2E Encryption

- [ ] Key generation (X25519) on client
- [ ] Key bundle upload/fetch API
- [ ] X3DH key agreement implementation
- [ ] AES-256-GCM message encryption
- [ ] Double Ratchet for forward secrecy
- [ ] Key verification UI (safety numbers)

### Phase 6: Graph Database & Data Science

- [ ] Add Neo4j to docker-compose
- [ ] Sync social graph edges from PostgreSQL
- [ ] Friend-of-friend recommendations
- [ ] Community detection with Louvain algorithm
- [ ] PageRank influence scoring
- [ ] Content recommendation based on reaction similarity
- [ ] Virality tracking and visualization

### Phase 7: Hardening

- [ ] Rate limiting per endpoint
- [ ] Content Security Policy headers
- [ ] Input validation on all endpoints
- [ ] Audit logging for security-relevant actions
- [ ] Automated testing (unit + integration)
- [ ] CI pipeline

---

## Open Design Decisions

| Decision | Options | Notes |
|---|---|---|
| Frontend framework | SvelteKit (TypeScript) vs Leptos (Rust/WASM) | SvelteKit is faster to learn; Leptos keeps everything in Rust |
| Search | PostgreSQL full-text vs Meilisearch vs Elasticsearch | Start with Postgres `tsvector`, add dedicated search later |
| Notifications | Polling vs SSE vs WebSocket | WebSocket already in place for chat, reuse it |
| Email | Skip initially vs SMTP integration | Not needed for learning, add later if desired |
| Mobile | Skip vs PWA vs React Native | PWA via SvelteKit is free, native is a separate project |
