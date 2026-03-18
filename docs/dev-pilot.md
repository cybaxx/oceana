# Oceana - Dev Pilot Progress

Tracking what's been built, what works, and what's next.

---

## Current State: Phase 5 — E2E Encryption + Signed Posts

**Status:** Full-stack app running in Docker. Backend API + SvelteKit frontend with Signal Protocol E2EE for chat and Ed25519 post signing.

### What Exists

```
oceana/
├── docker-compose.yml          # postgres + backend + frontend (one command)
├── .gitignore
├── docs/
│   ├── architecture.md         # Full architecture & API design reference
│   ├── dev-pilot.md            # This file
│   └── lessons.md              # Structured learning curriculum
├── backend/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── Dockerfile              # Multi-stage Rust build (rust:alpine → alpine)
│   ├── migrations/
│   │   ├── 001_initial.sql     # users, posts, follows
│   │   ├── 002_chat.sql        # conversations, messages
│   │   ├── 003_attachments.sql # image support
│   │   ├── 004_bot_flag.sql    # bot/human distinction
│   │   ├── 005_reactions.sql   # emoji reactions
│   │   ├── 006_emoji_reactions.sql
│   │   ├── 007_signal_keys.sql # Signal Protocol keys, prekeys, post signatures
│   │   └── 999_seed.sql        # test data
│   └── src/
│       ├── main.rs             # Server startup, migration, router assembly
│       ├── error.rs            # AppError enum → JSON error responses
│       ├── models.rs           # DB rows, request/response structs, Signal types
│       ├── chat.rs             # WebSocket connection manager
│       ├── auth.rs             # JWT, Argon2id, AuthUser extractor
│       └── routes.rs           # All route handlers (REST + WS + Signal keys)
└── frontend/
    ├── package.json            # includes @privacyresearch/libsignal-protocol-typescript
    ├── Dockerfile              # Node 22 alpine, Vite dev server
    ├── svelte.config.js
    ├── vite.config.ts          # Vite proxy: /api/v1 → backend:3000
    └── src/
        ├── app.html
        ├── app.css             # Dark ocean terminal theme
        ├── hooks.server.ts     # SvelteKit server hooks
        ├── lib/
        │   ├── api.ts          # Typed fetch wrapper with JWT auth + 401 auto-logout
        │   ├── types.ts        # TS interfaces (User, Post, Message, PreKeyBundle, etc.)
        │   ├── ws.ts           # WebSocket connection + reconnect
        │   ├── crypto/
        │   │   ├── index.ts    # Singleton init, auto key generation
        │   │   ├── store.ts    # IndexedDB-backed Signal Protocol store (TOFU)
        │   │   ├── keys.ts     # Identity/prekey generation, bundle upload, OPK replenish
        │   │   └── signal.ts   # X3DH, Double Ratchet encrypt/decrypt, Ed25519 signing
        │   ├── stores/
        │   │   ├── auth.ts     # Svelte store (localStorage-backed, SSR-safe)
        │   │   └── chat.ts     # Chat store with E2EE integration
        │   └── components/
        │       └── Markdown.svelte
        └── routes/
            ├── +layout.svelte  # Nav bar (auth-aware, terminal style)
            ├── +page.svelte    # Feed: signed posts + verification badges
            ├── chat/
            │   ├── +page.svelte        # Conversation list
            │   └── [id]/+page.svelte   # E2E encrypted chat
            ├── login/+page.svelte
            ├── register/+page.svelte
            ├── settings/+page.svelte
            ├── users/[id]/+page.svelte
            └── posts/[id]/+page.svelte
```

### Working Endpoints

| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/v1/health` | GET | No | Done |
| `/api/v1/auth/register` | POST | No | Done |
| `/api/v1/auth/login` | POST | No | Done |
| `/api/v1/users/:id` | GET | No | Done |
| `/api/v1/profile` | PUT | Yes | Done |
| `/api/v1/users/:id/follow` | POST | Yes | Done |
| `/api/v1/users/:id/follow` | DELETE | Yes | Done |
| `/api/v1/posts` | POST | Yes | Done (accepts optional `signature`) |
| `/api/v1/posts/:id` | GET | No | Done |
| `/api/v1/posts/:id` | DELETE | Yes | Done |
| `/api/v1/posts/:id/react` | POST | Yes | Done (any emoji) |
| `/api/v1/posts/:id/react` | DELETE | Yes | Done |
| `/api/v1/posts/:id/reactions` | GET | Yes | Done |
| `/api/v1/posts/:id/replies` | GET | Yes | Done |
| `/api/v1/feed` | GET | Yes | Done (includes signature + identity_key) |
| `/api/v1/chats` | POST/GET | Yes | Done |
| `/api/v1/chats/:id/messages` | GET | Yes | Done (returns ciphertext + message_type) |
| `/api/v1/chats/:id/members` | GET | Yes | Done |
| `/api/v1/keys/bundle` | PUT | Yes | Done (upload Signal key bundle) |
| `/api/v1/keys/bundle/:user_id` | GET | Yes | Done (fetch bundle, pop OPK) |
| `/api/v1/keys/count` | GET | Yes | Done (remaining OPK count) |
| `/api/v1/upload` | POST | Yes | Done (image upload) |
| `/api/v1/uploads/:filename` | GET | No | Done (serve uploads) |
| `/api/v1/ws` | WS | Token | Done (encrypted + plaintext messages) |

### Frontend Pages

| Route | Purpose | Status |
|---|---|---|
| `/` | Feed (compose + signed posts + verification badges + reactions + comments) | Done |
| `/login` | Email/password login | Done |
| `/register` | Username/email/password registration | Done |
| `/settings` | Edit profile (display_name, bio) | Done |
| `/users/[id]` | User profile + follow/unfollow | Done |
| `/posts/[id]` | Single post detail view | Done |
| `/chat` | Conversation list | Done |
| `/chat/[id]` | E2E encrypted chat (Signal Protocol) | Done |

### Design Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Web framework | Axum 0.7 | Async, tower middleware, best Rust web ecosystem |
| Database driver | sqlx 0.8 | Compile-time SQL checking, async, direct PostgreSQL |
| Password hashing | Argon2id | Current best practice, resistant to GPU/ASIC attacks |
| Auth tokens | JWT (HS256) | Stateless, simple for dev; upgrade to Ed25519 for prod |
| Token storage | localStorage | Simple for MVP; move to httpOnly cookies for prod |
| Frontend framework | SvelteKit + Tailwind CSS | Minimal runtime, fast iteration, SSR support |
| Frontend theme | Dark ocean terminal | Monospace fonts, cyan glow, scanline overlay |
| API proxy | SvelteKit server hook | Routes `/api/*` to backend container |
| Route params | Axum `:id` syntax | Axum 0.7 uses matchit `:param` (not `{param}`) |
| Deployment | Docker Compose | One command: `docker compose up --build -d` |
| Profile endpoint | `/api/v1/profile` | Moved from `/users/me/profile` to avoid route conflict with `/users/:id` |
| E2EE library | `@privacyresearch/libsignal-protocol-typescript` | Pure TS Signal Protocol with X3DH + Double Ratchet |
| Key storage | IndexedDB (per-user DB) | `oceana-keys-${userId}` — survives page reloads |
| Trust model | TOFU (Trust On First Use) | Accept identity key on first encounter, warn on change |
| Post signing | Ed25519 via Web Crypto API | Signs post content, stores signature in DB |
| API proxy | Vite server.proxy | Routes `/api/v1/*` to `http://backend:3000` in Docker |
| 401 handling | Auto-logout on expired JWT | Clears localStorage and redirects to `/login` |

### How to Run

```bash
# One command — starts postgres, backend, frontend
docker compose up --build -d

# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
```

### Test Users

| Username | Email | Password |
|---|---|---|
| aurelia_aurita | aurelia@deep.sea | password123 |
| chrysaora_fuscescens | chrysaora@deep.sea | password123 |
| cyanea_capillata | cyanea@deep.sea | password123 |

---

## Lessons Learned

| Issue | Root Cause | Fix |
|---|---|---|
| `localStorage.getItem is not a function` | SvelteKit SSR has no `localStorage` | Guard with `import { browser } from '$app/environment'` |
| Vite proxy not working with SvelteKit | SvelteKit plugin intercepts routes before Vite proxy | Use `hooks.server.ts` to proxy `/api/*` instead |
| Backend 404 on `/users/:id` routes | Axum 0.7 uses `:id` syntax, not `{id}` | Changed all route params to `:id` format |
| Route conflict `/users/:id` vs `/users/me/profile` | matchit can't distinguish literal `me` from wildcard `:id` | Moved profile endpoint to `/api/v1/profile` |
| `process.env` not working in SvelteKit | SvelteKit uses `$env/dynamic/private` | Import `env` from `$env/dynamic/private` |
| Migrations not running in Docker | `sqlx::query()` doesn't support multi-statement SQL | Split migration by `;` and execute each statement |
| Backend can't connect to DB in Docker | Local postgres on same port intercepting connections | Fully Dockerized all services |
| Stale JWT causes 401 loop | Token expired but frontend still sends it | Added 401 detection in `api.ts` → auto-logout + redirect to `/login` |
| Vite proxy not set up for Docker | Frontend couldn't reach backend in container network | Added `server.proxy` in `vite.config.ts` forwarding to `http://backend:3000` |
| WS hardcoded to localhost:3001 | WebSocket bypassed Docker proxy | Changed to use `window.location.host` — goes through Vite proxy |
| Signal Protocol large bundle | `@privacyresearch/libsignal-protocol-typescript` + curve25519 WASM | ~1MB chunk; expected, works in browser |
| `content` field made optional on WS | Encrypted messages have no plaintext | Changed `content: String` to `content: Option<String>` in `WsClientMessage`, updated all tests |

---

## Roadmap: What's Next

### Completed

- [x] Post replies and threading
- [x] Emoji reactions (any emoji)
- [x] Image uploads and display
- [x] Bot/human user distinction
- [x] WebSocket real-time chat
- [x] Conversation creation and message history
- [x] Chat UI with encrypted messaging
- [x] Signal Protocol E2EE (X3DH + Double Ratchet)
- [x] Key bundle management (upload, fetch, OPK rotation)
- [x] Ed25519 post signing + verification badges
- [x] Auto-logout on expired JWT

### Remaining

- [ ] Follower/following counts on profile
- [ ] User search endpoint
- [ ] Cursor-based pagination (currently offset-based)
- [ ] Typing indicators in chat UI
- [ ] Key verification UI (safety numbers)
- [ ] Group chat E2EE (currently encrypts per-recipient)

### Phase 6: Graph Database

- [ ] Neo4j integration
- [ ] Friend-of-friend recommendations
- [ ] Community detection

### Phase 7: Hardening

- [ ] Rate limiting per endpoint
- [ ] Content Security Policy headers
- [ ] Redis pub/sub for multi-instance WebSocket

---

## Dev Log

### Session 1 — Project Bootstrap

Built the full backend: Axum 0.7, sqlx, Argon2id auth, JWT, all CRUD endpoints for users/posts/follows/feed. Created architecture docs and learning curriculum.

### Session 2 — Frontend MVP

1. Scaffolded SvelteKit frontend with TypeScript + Tailwind CSS
2. Built API client layer (`api.ts`, `types.ts`, `auth.ts` store)
3. Implemented all pages: feed, login, register, settings, profile, post detail
4. Applied dark ocean terminal theme (monospace, cyan glow, scanlines)
5. Dockerized entire stack (postgres + backend + frontend)
6. Fixed SSR localStorage issue, API proxy, route param syntax, route conflicts
7. Created test users (3 jellyfish species) with posts and follows
