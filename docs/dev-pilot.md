# Oceana - Dev Pilot Progress

Tracking what's been built, what works, and what's next.

---

## Current State: Phase 2 — Frontend MVP

**Status:** Full-stack app running in Docker. Backend API + SvelteKit frontend with dark ocean terminal theme.

### What Exists

```
oceana/
├── docker-compose.yml          # postgres + backend + frontend (one command)
├── .gitignore
├── test.sh                     # curl-based smoke test
├── docs/
│   ├── architecture.md         # Full architecture & API design reference
│   ├── dev-pilot.md            # This file
│   └── lessons.md              # Structured learning curriculum
├── backend/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── Dockerfile              # Multi-stage Rust build (rust:alpine → alpine)
│   ├── .env                    # DATABASE_URL, JWT_SECRET (local dev)
│   ├── migrations/
│   │   └── 001_initial.sql     # users, posts, follows tables + indexes
│   └── src/
│       ├── main.rs             # Server startup, migration, router assembly
│       ├── error.rs            # AppError enum → JSON error responses
│       ├── models.rs           # DB row types, request/response structs
│       ├── auth.rs             # JWT, Argon2id, AuthUser extractor
│       └── routes.rs           # All route handlers
└── frontend/
    ├── package.json
    ├── Dockerfile              # Node 22 alpine, Vite dev server
    ├── svelte.config.js
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── app.html
        ├── app.css             # Dark ocean terminal theme (scanlines, glow, monospace)
        ├── hooks.server.ts     # API proxy → backend container
        ├── lib/
        │   ├── api.ts          # Typed fetch wrapper with JWT auth
        │   ├── types.ts        # User, Post, PostWithAuthor, AuthResponse
        │   └── stores/
        │       └── auth.ts     # Svelte store (localStorage-backed, SSR-safe)
        └── routes/
            ├── +layout.svelte  # Nav bar (auth-aware, terminal style)
            ├── +page.svelte    # Feed: compose box + post cards + load more
            ├── login/+page.svelte
            ├── register/+page.svelte
            ├── settings/+page.svelte    # Edit display_name, bio
            ├── users/[id]/+page.svelte  # Profile + follow/unfollow
            └── posts/[id]/+page.svelte  # Single post view
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
| `/api/v1/posts` | POST | Yes | Done |
| `/api/v1/posts/:id` | GET | No | Done |
| `/api/v1/posts/:id` | DELETE | Yes | Done |
| `/api/v1/feed` | GET | Yes | Done |

### Frontend Pages

| Route | Purpose | Status |
|---|---|---|
| `/` | Feed (compose + post cards + load more) | Done |
| `/login` | Email/password login | Done |
| `/register` | Username/email/password registration | Done |
| `/settings` | Edit profile (display_name, bio) | Done |
| `/users/[id]` | User profile + follow/unfollow | Done |
| `/posts/[id]` | Single post detail view | Done |

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

---

## Roadmap: What's Next

### Phase 2 Remaining (Core Social)

- [ ] Post replies and threading
- [ ] Reactions
- [ ] Follower/following counts on profile
- [ ] User search endpoint
- [ ] Cursor-based pagination

### Phase 3: Media

- [ ] Add MinIO to docker-compose
- [ ] Media upload endpoint
- [ ] Image display in posts

### Phase 4: Real-Time Chat

- [ ] WebSocket handler
- [ ] Conversations and messages
- [ ] Chat UI in frontend

### Phase 5: E2E Encryption

- [ ] Key bundle management
- [ ] X3DH + Double Ratchet

### Phase 6: Graph Database

- [ ] Neo4j integration
- [ ] Friend-of-friend recommendations
- [ ] Community detection

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
