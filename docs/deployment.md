# Oceana Deployment Guide

---

## Quick Start

```bash
# 1. Create .env from the example
cp .env.example .env
# Edit .env to set your secrets

# 2. Start everything
docker compose up --build -d
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

---

## Prerequisites

### `.env` file

Docker Compose requires a `.env` file with the following variables. Copy `.env.example` and fill in the values.

```bash
# Required — all three must be set
POSTGRES_PASSWORD=your-strong-db-password
JWT_SECRET=your-secret-at-least-32-characters-long
CORS_ORIGIN=http://localhost:5173
```

**Important:**
- `JWT_SECRET` must be at least 32 characters and **not** the string `dev-secret-change-in-production` (the backend will panic on startup if it is)
- `CORS_ORIGIN` defaults to `http://localhost:5173` if not set
- Never commit `.env` to version control (it's in `.gitignore`)

---

## Docker Compose Services

### postgres

- **Image:** `postgres:16-alpine`
- **Database:** `oceana`
- **Credentials:** `oceana` / `$POSTGRES_PASSWORD`
- **Port:** 5432 (internal only, not exposed to host)
- **Data:** persisted to `./data/postgres`
- **Init scripts:** `./docker/postgres/*.sql`
- **Healthcheck:** `pg_isready -U oceana`

### backend

- **Build:** `./backend` (multi-stage Rust build: `rust:alpine` → `alpine:3.21`)
- **Port:** 3001 → 3000 (container)
- **Uploads:** `./data/uploads:/uploads`
- **Body limit:** 11 MB (10 MB file + overhead)
- **Depends on:** postgres (healthy)

### frontend

- **Build:** `./frontend` (Node 22 alpine, Vite dev server)
- **Port:** 5173 → 5173 (container)
- **Depends on:** backend

---

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (set automatically by docker-compose) |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens (32+ chars, validated on startup) |
| `CORS_ORIGIN` | Yes | `http://localhost:5173` | Allowed CORS origin |
| `SEED_DATA` | No | `false` | Set to `true` to load test data on startup |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | No | `http://backend:3000` | Backend URL for server-side API proxy |

---

## Test Data

Set `SEED_DATA=true` in your `.env` to load seed users and sample content:

| Username | Email | Password |
|----------|-------|----------|
| aurelia_aurita | aurelia@deep.sea | password123 |
| chrysaora_fuscescens | chrysaora@deep.sea | password123 |
| cyanea_capillata | cyanea@deep.sea | password123 |

Seed data includes follow relationships, sample posts, and a conversation.

---

## Bot Activity

Generate realistic test content with the bot activity script:

```bash
bash scripts/bot-activity.sh
```

This registers 6 bot accounts, creates ~36 signed posts with Ed25519 signatures, ~25 replies across deep threads, ~50 reactions (likes, yikes, emoji), follows, profile updates, image uploads, and exercises feed/search/pagination endpoints.

---

## Smoke Test

```bash
bash test.sh
```

Runs a comprehensive integration test suite that exercises registration, login, posts, reactions, follows, feed, search, key bundles, image uploads, and more. Reports pass/fail counts.

---

## Security Headers

The backend automatically sets these headers on all responses:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' wss:; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

---

## Rate Limiting

Built-in per-IP rate limiting:

| Endpoint Pattern | Limit |
|-----------------|-------|
| `/api/v1/auth/*` | 5 requests/minute |
| `/api/v1/upload` | 10 requests/minute |
| All other endpoints | 60 requests/minute |

---

## Production Considerations

The current setup is for development. For production:

- Use a strong, random `JWT_SECRET` (32+ characters)
- Set `CORS_ORIGIN` to your frontend domain (e.g., `https://oceana.io`)
- Do NOT set `SEED_DATA=true`
- Add a reverse proxy (Caddy/Nginx) for TLS termination
- Tune Argon2 password hashing parameters for production workload
- Migrate JWT token storage from localStorage to httpOnly cookies
- Set up proper log aggregation
- Consider external PostgreSQL for data durability
- Add Redis for multi-instance WebSocket support
