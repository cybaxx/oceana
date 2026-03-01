# Oceana

A social media platform built with Rust, designed as a learning project exploring backend development, graph databases, E2E encryption, and real-time communication.

## Tech Stack

- **Backend:** Rust with Axum, SQLx, Argon2id, JWT
- **Database:** PostgreSQL 16
- **Planned:** Neo4j (graph queries), Redis (caching/pub-sub), MinIO (media storage), SvelteKit (frontend)

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
| PUT | `/api/v1/users/me/profile` | Update your profile |
| POST | `/api/v1/users/:id/follow` | Follow a user |
| DELETE | `/api/v1/users/:id/follow` | Unfollow a user |
| POST | `/api/v1/posts` | Create a post |
| GET | `/api/v1/posts/:id` | Get a post |
| DELETE | `/api/v1/posts/:id` | Delete your post |
| GET | `/api/v1/feed` | Get your feed |

See [docs/architecture.md](docs/architecture.md) for full architecture and API design.

## Project Structure

```
oceana/
├── backend/
│   ├── src/
│   │   ├── main.rs       # Entry point, server startup
│   │   ├── auth.rs       # JWT, Argon2id, AuthUser extractor
│   │   ├── error.rs      # Error types → JSON responses
│   │   ├── models.rs     # DB models, request/response structs
│   │   └── routes.rs     # Route handlers
│   └── migrations/
│       └── 001_initial.sql
├── docs/
│   ├── architecture.md   # Full architecture & API design
│   ├── dev-pilot.md      # Implementation progress
│   └── lessons.md        # Lessons learned
├── docker-compose.yml
└── test.sh               # curl smoke test
```

## License

This is a personal learning project.
