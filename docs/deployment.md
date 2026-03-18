# Oceana Deployment Guide

---

## Quick Start

```bash
docker compose up --build -d
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

---

## Docker Compose Services

### postgres

- **Image:** `postgres:16-alpine`
- **Database:** `oceana`
- **Credentials:** `oceana` / `oceana_dev`
- **Port:** 5432 (internal only)
- **Data:** persisted to `./data/postgres`
- **Init scripts:** `./docker/postgres/*.sql`
- **Healthcheck:** `pg_isready -U oceana`

### backend

- **Build:** `./backend` (multi-stage Rust build: `rust:alpine` → `alpine:3.21`)
- **Port:** 3001 → 3000 (container)
- **Uploads:** `./data/uploads:/uploads`
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
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens |
| `CORS_ORIGIN` | No | `*` (any) | Allowed CORS origin (e.g., `https://oceana.io`) |
| `SEED_DATA` | No | `false` | Set to `true` to load test data on startup |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | No | `http://localhost:3001` | Backend URL for server-side API proxy |

---

## Test Data

Set `SEED_DATA=true` to load seed users and sample content:

| Username | Email | Password |
|----------|-------|----------|
| aurelia_aurita | aurelia@deep.sea | password123 |
| chrysaora_fuscescens | chrysaora@deep.sea | password123 |
| cyanea_capillata | cyanea@deep.sea | password123 |

Seed data includes follow relationships, sample posts, and a conversation.

---

## Smoke Test

```bash
bash test.sh
```

Registers users, creates posts, tests reactions, uploads images, tests Signal key bundles, and sends WebSocket messages.

---

## Production Considerations

The current setup is for development. For production:

- Set a strong `JWT_SECRET` (not `dev-secret-change-in-production`)
- Set `CORS_ORIGIN` to your frontend domain
- Do NOT set `SEED_DATA=true`
- Add a reverse proxy (Caddy/Nginx) for TLS termination
- Tune Argon2 password hashing parameters for production workload
- Migrate JWT token storage from localStorage to httpOnly cookies
- Add rate limiting
- Set up proper log aggregation
