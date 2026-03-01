# Oceana - Dev Pilot Progress

Tracking what's been built, what works, and what's next.

---

## Current State: Phase 1 — Foundation

**Status:** Backend compiles and is runnable against a local PostgreSQL instance.

### What Exists

```
oceana/
├── docker-compose.yml          # PostgreSQL 16 (single service for now)
├── .gitignore                  # target/, .env, node_modules/
├── test.sh                     # curl-based smoke test for all endpoints
├── docs/
│   ├── architecture.md         # Full architecture & API design reference
│   └── dev-pilot.md            # This file
└── backend/
    ├── Cargo.toml              # Rust dependencies (axum, sqlx, argon2, jwt, etc.)
    ├── .env                    # DATABASE_URL, JWT_SECRET (dev only)
    ├── migrations/
    │   └── 001_initial.sql     # users, posts, follows tables + indexes
    └── src/
        ├── main.rs             # Server startup, migration, router assembly
        ├── error.rs            # AppError enum → JSON error responses
        ├── models.rs           # DB row types, request/response structs
        ├── auth.rs             # JWT create/verify, Argon2id hash/verify, AuthUser extractor
        └── routes.rs           # All route handlers (auth, users, posts, feed)
```

### Working Endpoints

| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/v1/health` | GET | No | Done |
| `/api/v1/auth/register` | POST | No | Done |
| `/api/v1/auth/login` | POST | No | Done |
| `/api/v1/users/:id` | GET | No | Done |
| `/api/v1/users/me/profile` | PUT | Yes | Done |
| `/api/v1/users/:id/follow` | POST | Yes | Done |
| `/api/v1/users/:id/follow` | DELETE | Yes | Done |
| `/api/v1/posts` | POST | Yes | Done |
| `/api/v1/posts/:id` | GET | No | Done |
| `/api/v1/posts/:id` | DELETE | Yes | Done |
| `/api/v1/feed` | GET | Yes | Done |

### Database Schema (001_initial.sql)

Three tables:
- **users** — id, username, email, password_hash, display_name, bio, created_at
- **posts** — id, author_id, content, parent_id (for replies), created_at
- **follows** — follower_id, followed_id, created_at (composite PK)

### Design Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Web framework | Axum 0.7 | Async, tower middleware, best Rust web ecosystem |
| Database driver | sqlx 0.8 | Compile-time SQL checking, async, direct PostgreSQL |
| Password hashing | Argon2id | Current best practice, resistant to GPU/ASIC attacks |
| Auth tokens | JWT (HS256) | Stateless, simple for dev; upgrade to Ed25519 for prod |
| Token lifetime | 1 hour | Long enough for dev convenience |
| Migration strategy | Raw SQL via `include_str!` | Simple, no extra tooling; migrate to sqlx-cli later |
| Feed algorithm | Pull-based chronological SQL | Simplest correct implementation; cache/rank later |
| Project layout | Flat modules | No premature abstraction; split into subdirectories as code grows |

### How to Run

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Run the backend
cd backend
cargo run
# Server listens on http://localhost:3000

# 3. Smoke test
./test.sh
```

---

## Roadmap: What's Next

### Phase 1 Remaining (Foundation)

- [ ] Verify all endpoints work end-to-end with `test.sh`
- [ ] Add basic input validation (email format, username chars)
- [ ] Switch migration to `sqlx-cli` for proper versioned migrations
- [ ] Add `.env.example` with placeholder values

### Phase 2: Core Social Features

- [ ] Reactions table + endpoints (`POST/DELETE /posts/:id/reactions`)
- [ ] Follower/following counts on user profile response
- [ ] Post reply threading (`GET /posts/:id/replies`)
- [ ] Cursor-based pagination (replace timestamp `before` param with opaque cursor)
- [ ] User search endpoint

### Phase 3: Media

- [ ] Add MinIO to `docker-compose.yml`
- [ ] Media upload endpoint with file type validation (magic bytes)
- [ ] EXIF metadata stripping
- [ ] Blurhash generation for image placeholders
- [ ] Signed URL generation for media downloads
- [ ] Attach media IDs to posts

### Phase 4: Real-Time Chat

- [ ] WebSocket handler in Axum
- [ ] Conversations and messages tables (already in architecture.md schema)
- [ ] In-memory connection manager
- [ ] Message send/receive over WebSocket
- [ ] REST endpoints for chat history
- [ ] Add Redis to docker-compose for pub/sub

### Phase 5: E2E Encryption

- [ ] User key bundle table + endpoints
- [ ] X25519 key generation on client
- [ ] X3DH key agreement
- [ ] AES-256-GCM message encryption
- [ ] Double Ratchet implementation

### Phase 6: Graph Database & Data Science

- [ ] Add Neo4j to docker-compose
- [ ] Sync follows/reactions to Neo4j on write
- [ ] Friend-of-friend recommendation query
- [ ] Community detection (Louvain)
- [ ] PageRank influence scoring
- [ ] Content recommendation engine

### Phase 7: Frontend

- [ ] SvelteKit project scaffold
- [ ] Typed API client
- [ ] Login/register pages
- [ ] Feed page with markdown rendering
- [ ] Profile page
- [ ] Chat interface

### Phase 8: Hardening

- [ ] Rate limiting middleware (tower)
- [ ] Content Security Policy headers
- [ ] Audit logging
- [ ] Integration tests
- [ ] CI pipeline

---

## Known Gaps & Tech Debt

| Item | Severity | Notes |
|---|---|---|
| No refresh tokens | Low | Single JWT only; add refresh token flow before frontend |
| Migration runs on startup with `.ok()` | Low | Silently ignores errors; fine for dev, replace with sqlx-cli |
| No email validation | Low | Accepts any string as email |
| No rate limiting | Medium | Add before any public exposure |
| JWT secret from env var | Medium | Fine for dev; use proper secret management for prod |
| No tests | Medium | Add unit tests for auth, integration tests for routes |
| `CorsLayer::permissive()` | Low | Wide open CORS; lock down when frontend domain is known |

---

## Dev Log

### Session 1 — Project Bootstrap

**What was done:**
1. Created `docs/architecture.md` — full architecture reference covering system overview, tech stack, database schema (Postgres + Neo4j + Redis), complete API design, auth strategy, media pipeline, E2E encryption design (Signal protocol), feed system (3 phases), graph DB experiments, docker-compose, project structure, and 7-phase learning roadmap.
2. Scaffolded `backend/` Rust project with Axum 0.7.
3. Implemented core modules: error handling, models, JWT auth with Argon2id password hashing, AuthUser extractor middleware.
4. Built all Phase 1 route handlers: register, login, get user, update profile, follow/unfollow, create/get/delete post, chronological feed.
5. Created PostgreSQL migration with users, posts, follows tables.
6. Created `docker-compose.yml` with PostgreSQL 16.
7. Created `test.sh` smoke test script exercising the full API flow.
8. Got the project compiling cleanly.

**Key learning moments:**
- Axum 0.7 (axum-core 0.4) uses `#[async_trait]` for the `FromRequestParts` trait — native `async fn` in trait impls won't match the lifetime signature. Required adding `async-trait` crate and `#[async_trait]` attribute to the `AuthUser` extractor.
- Argon2 0.5 re-exports `rand_core::OsRng` via `argon2::password_hash::rand_core::OsRng` — no need to add `rand` as a direct dependency for salt generation.
