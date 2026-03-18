# Oceana

A social media platform built with Rust, designed as a learning project exploring backend development, graph databases, E2E encryption, and real-time communication.

## Tech Stack

- **Backend:** Rust with Axum, SQLx, Argon2id, JWT
- **Frontend:** SvelteKit 5, TypeScript, Tailwind CSS
- **Database:** PostgreSQL 16
- **E2E Encryption:** Signal Protocol (X3DH + Double Ratchet) via `@privacyresearch/libsignal-protocol-typescript`
- **Post Signing:** Ed25519 signatures via Web Crypto API
- **Planned:** Neo4j (graph queries), Redis (caching/pub-sub), MinIO (media storage)

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Setup

1. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

2. Configure environment:

   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env and set a strong JWT_SECRET
   ```

3. Run the backend:

   ```bash
   cd backend
   cargo run
   ```

   The API will be available at `http://localhost:3000`.

4. Run the smoke test:

   ```bash
   ./test.sh
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/auth/register` | Register a new user |
| POST | `/api/v1/auth/login` | Log in |
| GET | `/api/v1/users/:id` | Get user by ID |
| PUT | `/api/v1/profile` | Update your profile |
| POST | `/api/v1/users/:id/follow` | Follow a user |
| DELETE | `/api/v1/users/:id/follow` | Unfollow a user |
| POST | `/api/v1/posts` | Create a post (with optional Ed25519 signature) |
| GET | `/api/v1/posts/:id` | Get a post |
| DELETE | `/api/v1/posts/:id` | Delete your post |
| POST | `/api/v1/posts/:id/react` | React to a post (any emoji) |
| DELETE | `/api/v1/posts/:id/react` | Remove reaction |
| GET | `/api/v1/posts/:id/reactions` | Get reactions for a post |
| GET | `/api/v1/posts/:id/replies` | Get replies to a post |
| GET | `/api/v1/feed` | Get your feed |
| POST | `/api/v1/chats` | Create a conversation |
| GET | `/api/v1/chats` | List conversations |
| GET | `/api/v1/chats/:id/messages` | Get messages (encrypted) |
| GET | `/api/v1/chats/:id/members` | List conversation member IDs |
| PUT | `/api/v1/keys/bundle` | Upload Signal Protocol key bundle |
| GET | `/api/v1/keys/bundle/:user_id` | Fetch key bundle (pops one OPK) |
| GET | `/api/v1/keys/count` | Get remaining OPK count |
| POST | `/api/v1/upload` | Upload an image |
| GET | `/api/v1/uploads/:filename` | Serve uploaded image |
| WS | `/api/v1/ws` | WebSocket (real-time encrypted chat) |

See [docs/architecture.md](docs/architecture.md) for full architecture and API design.

## Project Structure

```
oceana/
├── backend/
│   ├── Dockerfile              # Multi-stage Rust build (rust:alpine → alpine)
│   ├── src/
│   │   ├── main.rs             # Entry point, server startup, migrations
│   │   ├── auth.rs             # JWT, Argon2id, AuthUser extractor
│   │   ├── chat.rs             # WebSocket connection manager
│   │   ├── error.rs            # Error types → JSON responses
│   │   ├── models.rs           # DB models, request/response structs, Signal types
│   │   └── routes.rs           # Route handlers (REST + WebSocket + Signal keys)
│   └── migrations/
│       ├── 001_initial.sql     # users, posts, follows
│       ├── 002_chat.sql        # conversations, messages
│       ├── 003_attachments.sql # image support
│       ├── 004_bot_flag.sql    # bot/human distinction
│       ├── 005_reactions.sql   # emoji reactions
│       ├── 006_emoji_reactions.sql
│       ├── 007_signal_keys.sql # Signal Protocol keys, prekeys, post signatures
│       └── 999_seed.sql        # test data
├── frontend/
│   ├── Dockerfile              # Node 22 alpine, Vite dev server
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts          # Typed fetch wrapper with JWT + 401 auto-logout
│   │   │   ├── types.ts        # TS interfaces mirroring Rust models
│   │   │   ├── ws.ts           # WebSocket connection manager
│   │   │   ├── crypto/         # Signal Protocol E2EE module
│   │   │   │   ├── index.ts    # Singleton init, key generation on first use
│   │   │   │   ├── store.ts    # IndexedDB-backed Signal Protocol store (TOFU)
│   │   │   │   ├── keys.ts     # Key generation, bundle upload, OPK replenishment
│   │   │   │   └── signal.ts   # X3DH session init, encrypt/decrypt, Ed25519 signing
│   │   │   ├── stores/
│   │   │   │   ├── auth.ts     # Auth store (localStorage, SSR-safe)
│   │   │   │   └── chat.ts     # Chat store with E2EE decrypt/encrypt
│   │   │   └── components/
│   │   │       └── Markdown.svelte
│   │   └── routes/
│   │       ├── +layout.svelte
│   │       ├── +page.svelte    # Feed with signed posts + verification badges
│   │       ├── chat/
│   │       │   ├── +page.svelte        # Conversation list
│   │       │   └── [id]/+page.svelte   # E2E encrypted chat
│   │       ├── login/+page.svelte
│   │       ├── register/+page.svelte
│   │       ├── settings/+page.svelte
│   │       ├── users/[id]/+page.svelte
│   │       └── posts/[id]/+page.svelte
├── docs/
│   ├── architecture.md
│   ├── dev-pilot.md
│   └── lessons.md
├── docker-compose.yml          # postgres + backend + frontend
└── .gitignore
```

## License

This is a personal learning project.
