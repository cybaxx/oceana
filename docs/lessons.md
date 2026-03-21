# Oceana — Structured Dev Lessons

A progressive curriculum built from the Oceana codebase. Each lesson focuses on one concept, references the exact files where it's implemented, and includes exercises.

---

## Module 1: Project Setup & Tooling

### Lesson 1.1 — Rust Project Structure

**Concept:** How a Rust binary project is organized with Cargo.

**Files:** `backend/Cargo.toml`, `backend/src/main.rs`

**Key Points:**
- `Cargo.toml` declares the package name, edition, and dependencies
- `src/main.rs` is the binary entry point
- Modules are declared with `mod auth; mod error; mod models; mod routes;` — each maps to a file in `src/`
- The `edition = "2021"` field determines which Rust edition features are available

**Study the code:**
```rust
// main.rs — module declarations form the project skeleton
mod auth;
mod error;
mod models;
mod routes;
```

**Exercise:**
1. Add a new module `mod config;` and create `src/config.rs` with a struct that loads `DATABASE_URL` and `JWT_SECRET` from environment variables
2. Replace the raw `std::env::var` calls in `main.rs` with your config struct

---

### Lesson 1.2 — Docker Compose for Local Development

**Concept:** Using containers to run infrastructure dependencies reproducibly.

**Files:** `docker-compose.yml`

**Key Points:**
- A single `postgres` service with environment variables sets up the database automatically
- Named volumes (`pgdata`) persist data between container restarts
- Port mapping (`5432:5432`) exposes the service to the host

**Study the code:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: oceana
      POSTGRES_USER: oceana
      POSTGRES_PASSWORD: oceana_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
```

**Exercise:**
1. Add a Redis service (`redis:7-alpine`) on port 6379
2. Add a MinIO service for object storage (see `docs/architecture.md` for the full config)
3. Verify all services start with `docker compose up -d && docker compose ps`

---

## Module 2: Web Framework Fundamentals (Axum)

### Lesson 2.1 — Server Bootstrap & Router Assembly

**Concept:** How Axum initializes, mounts routes, and applies middleware layers.

**Files:** `backend/src/main.rs`

**Key Points:**
- `#[tokio::main]` makes `main()` async — Axum runs on the Tokio runtime
- `Router::new().nest("/api/v1", routes::router())` mounts all routes under a prefix
- `.layer()` wraps the entire application with middleware (CORS, tracing)
- `.with_state(state)` injects shared state (DB pool, JWT secret) into all handlers

**Study the code:**
```rust
let app = Router::new()
    .nest("/api/v1", routes::router())
    .layer(CorsLayer::permissive())
    .layer(TraceLayer::new_for_http())
    .with_state(state);
```

**Takeaway:** Axum's layered architecture follows the Tower middleware pattern — each layer wraps the inner service, forming a stack. Requests flow inward through layers, responses flow outward.

**Exercise:**
1. Add a custom layer that logs the request method and path before each handler runs
2. Try reordering the `.layer()` calls — observe how layer order affects execution

---

### Lesson 2.2 — Route Handlers & Extractors

**Concept:** How Axum maps HTTP requests to handler functions using extractors.

**Files:** `backend/src/routes.rs`

**Key Points:**
- Each handler is an `async fn` that takes extractors as parameters
- `State(state)` extracts shared application state
- `Json(body)` deserializes the request body into a typed struct
- `Path(id)` extracts URL path parameters
- `Query(params)` extracts query string parameters
- The return type `Result<Json<T>, AppError>` becomes an HTTP response automatically

**Study the code:**
```rust
async fn create_post(
    State(state): State<AppState>,     // shared state
    auth: AuthUser,                     // custom extractor (see Lesson 3.3)
    Json(body): Json<CreatePostRequest>, // JSON body → typed struct
) -> Result<Json<Post>, AppError> { ... }
```

**Key insight:** The *order* of extractors matters. `State` and `Path` can appear anywhere, but `Json` must be last because it consumes the request body.

**Exercise:**
1. Add a `GET /api/v1/posts/:id/replies` handler that fetches posts where `parent_id = :id`
2. Add pagination with `Query(params): Query<FeedQuery>` to limit results

---

### Lesson 2.3 — Shared Application State

**Concept:** How to share resources (database pool, config) across handlers.

**Files:** `backend/src/main.rs` (struct definition), `backend/src/routes.rs` (usage)

**Key Points:**
- `AppState` must derive `Clone` (Axum clones it for each request)
- `PgPool` is internally `Arc`-wrapped — cloning is cheap
- State is injected once at router creation and extracted in each handler

```rust
#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub jwt_secret: String,
}
```

**Exercise:**
1. Add a `redis: redis::Client` field to `AppState`
2. Use it in a handler to increment a request counter with `INCR`

---

## Module 3: Authentication & Security

### Lesson 3.1 — Password Hashing with Argon2id

**Concept:** Why plaintext passwords are catastrophic and how Argon2id protects against credential theft.

**Files:** `backend/src/auth.rs:76-93`

**Key Points:**
- Argon2id is the current best-practice password hashing algorithm (resistant to GPU/ASIC attacks)
- A random salt is generated per password — identical passwords produce different hashes
- The hash output includes algorithm parameters, salt, and hash in a single string (PHC format)
- Verification re-derives the hash from the input password and compares

**Study the code:**
```rust
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed = PasswordHash::new(hash).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}
```

**Security note:** The `Argon2::default()` parameters are intentionally low for dev speed. Production should tune memory (19+ MiB), iterations (2+), and parallelism based on server hardware.

**Exercise:**
1. Print the hash of "password123" — observe the PHC format string
2. Verify that the same password hashed twice produces different outputs (different salts)
3. Benchmark `hash_password` with different Argon2 params and observe the time/memory tradeoff

---

### Lesson 3.2 — JWT Token Creation & Verification

**Concept:** Stateless authentication using signed JSON Web Tokens.

**Files:** `backend/src/auth.rs:1-42`

**Key Points:**
- JWTs have three parts: header (algorithm), payload (claims), signature
- Claims include `sub` (user ID), `exp` (expiry), `iat` (issued at), and custom fields
- The server signs with a secret; later it verifies the signature to trust the token
- JWTs are stateless — no database lookup needed to validate

**Study the code:**
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,        // user id
    pub username: String,
    pub exp: usize,       // expiry (unix timestamp)
    pub iat: usize,       // issued at
}
```

**Security considerations:**
- Current implementation uses HS256 (symmetric) — the same secret signs and verifies
- Production should use Ed25519 (asymmetric) — private key signs, public key verifies
- 1-hour expiry is generous for dev; production typically uses 15 minutes + refresh tokens

**Exercise:**
1. Decode a JWT token manually (base64-decode the middle segment) to see the claims
2. Try modifying one character of the token and observe that verification fails
3. Implement a refresh token flow: opaque token stored in the database, 7-day expiry

---

### Lesson 3.3 — Custom Axum Extractor for Auth

**Concept:** Implementing `FromRequestParts` to make authentication declarative.

**Files:** `backend/src/auth.rs:44-74`

**Key Points:**
- `AuthUser` implements `FromRequestParts<AppState>` — Axum calls it automatically when a handler parameter is `AuthUser`
- It reads the `Authorization: Bearer <token>` header, verifies the JWT, and returns the user info
- If verification fails, it returns `AppError::Unauthorized` and the handler never executes
- Adding `auth: AuthUser` to a handler is all it takes to require authentication

**Study the code:**
```rust
pub struct AuthUser {
    pub user_id: Uuid,
    pub username: String,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let header = parts.headers.get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

        let token = header.strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Invalid authorization format".into()))?;

        let claims = verify_token(token, &state.jwt_secret)?;
        Ok(AuthUser { user_id: claims.sub, username: claims.username })
    }
}
```

**Design pattern:** This is the *extractor pattern* — move cross-cutting concerns (auth, logging, rate limiting) out of handler logic and into reusable extractors. Handlers stay focused on business logic.

**Exercise:**
1. Create an `OptionalAuthUser` extractor that returns `Option<AuthUser>` — useful for endpoints where auth is optional (e.g., public profiles that show extra data when logged in)
2. Create an `AdminUser` extractor that checks a role claim in the JWT

---

## Module 4: Database Design & SQL

### Lesson 4.1 — Schema Design with PostgreSQL

**Concept:** Designing relational tables for a social media domain.

**Files:** `backend/migrations/001_initial.sql`

**Key Points:**
- UUIDs as primary keys (`gen_random_uuid()`) — no sequential IDs to leak information
- `UNIQUE` constraints prevent duplicate usernames and emails at the database level
- `REFERENCES ... ON DELETE CASCADE` ensures data integrity (deleting a user deletes their posts)
- Composite primary key `(follower_id, followed_id)` on `follows` prevents duplicate follows
- `ON CONFLICT DO NOTHING` in the follow query makes the operation idempotent

**Study the schema:**
```sql
CREATE TABLE follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);
```

**Indexing strategy:**
```sql
CREATE INDEX idx_posts_author ON posts(author_id, created_at DESC);  -- feed queries
CREATE INDEX idx_posts_parent ON posts(parent_id);                    -- reply lookups
CREATE INDEX idx_follows_followed ON follows(followed_id);            -- "who follows me?"
```

**Exercise:**
1. Add a `reactions` table with a composite PK `(user_id, post_id)` and a `kind` column
2. Write an index for quickly counting reactions per post
3. Write a query that returns a post with its reaction counts grouped by kind

---

### Lesson 4.2 — Async SQL with SQLx

**Concept:** Type-safe database queries in Rust using sqlx.

**Files:** `backend/src/routes.rs`, `backend/src/models.rs`

**Key Points:**
- `sqlx::query_as::<_, User>(sql)` maps query results to a Rust struct via `#[derive(sqlx::FromRow)]`
- Bind parameters (`$1`, `$2`) prevent SQL injection — never interpolate user input into SQL
- `fetch_one` expects exactly one row; `fetch_optional` returns `Option`; `fetch_all` returns a `Vec`
- The `RETURNING *` clause returns the inserted/updated row without a second query

**Study the code:**
```rust
// models.rs — derive FromRow to auto-map columns to fields
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]   // never expose password hash in API responses
    pub password_hash: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub created_at: DateTime<Utc>,
}
```

```rust
// routes.rs — parameterized query prevents SQL injection
let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;
```

**Exercise:**
1. Write a query that counts a user's followers and following — return them alongside the user profile
2. Convert the feed query to use cursor-based pagination (use `created_at` + `id` as the cursor)

---

### Lesson 4.3 — The Feed Query (Joins & Subqueries)

**Concept:** Writing a real-world query that combines multiple tables for a social feed.

**Files:** `backend/src/routes.rs:202-255`

**Key Points:**
- The feed shows posts from people you follow, plus your own posts
- A subquery `SELECT followed_id FROM follows WHERE follower_id = $1` finds who you follow
- `JOIN users u ON u.id = p.author_id` enriches posts with author info
- `ORDER BY p.created_at DESC LIMIT $3` implements reverse-chronological pagination
- A separate `PostWithAuthorRow` struct maps the JOIN result since it doesn't match any single table

**Study the code:**
```sql
SELECT p.id, p.author_id, p.content, p.parent_id, p.created_at,
       u.username AS author_username, u.display_name AS author_display_name
FROM posts p
JOIN users u ON u.id = p.author_id
WHERE (p.author_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
       OR p.author_id = $1)
  AND p.created_at < $2
ORDER BY p.created_at DESC
LIMIT $3
```

**Exercise:**
1. Add `avatar_url` to the feed query (requires adding the column to `users` or creating a `profiles` table)
2. Add reaction counts to each feed item using a lateral join or subquery
3. Implement cursor-based pagination by encoding `(created_at, id)` as an opaque base64 cursor

---

## Module 5: Error Handling

### Lesson 5.1 — Unified Error Responses

**Concept:** Converting application errors into consistent JSON HTTP responses.

**Files:** `backend/src/error.rs`

**Key Points:**
- `AppError` is an enum with variants for each HTTP error class (400, 401, 404, 409, 500)
- Implementing `IntoResponse` tells Axum how to convert `AppError` into an HTTP response
- `From<sqlx::Error>` and `From<jsonwebtoken::errors::Error>` enable the `?` operator in handlers
- Internal errors log the real message but return a generic "Internal server error" to the client (prevents information leakage)

**Study the code:**
```rust
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {msg}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".into())
            }
            // ...
        };
        (status, Json(json!({ "error": { "message": message } }))).into_response()
    }
}
```

**Design pattern:** The `From` trait implementations create an *error conversion chain*: `sqlx::Error → AppError → HTTP Response`. This keeps handler code clean — just use `?` and errors propagate automatically.

**Exercise:**
1. Add an `AppError::RateLimited` variant that returns `429 Too Many Requests`
2. Add a `From<argon2::password_hash::Error>` impl to handle password hashing failures
3. Add an error `code` field (e.g., `"VALIDATION_ERROR"`) alongside the `message` for programmatic error handling by API clients

---

## Module 6: Data Modeling Patterns

### Lesson 6.1 — Request/Response Separation

**Concept:** Using different types for what comes in (requests) vs. what goes out (responses).

**Files:** `backend/src/models.rs`

**Key Points:**
- Request types derive `Deserialize` — they represent what the client sends
- Response types derive `Serialize` — they represent what the server returns
- Database row types derive both `Serialize` and `sqlx::FromRow`
- `#[serde(skip_serializing)]` on `password_hash` ensures it's never sent to clients
- `#[serde(flatten)]` on `PostWithAuthor` inlines the `Post` fields instead of nesting

**Study the code:**
```rust
// Request — what the client sends
#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

// Response — what the server returns (notice: no password_hash)
#[derive(Debug, Serialize)]
pub struct PostWithAuthor {
    #[serde(flatten)]      // inlines Post fields into the JSON object
    pub post: Post,
    pub author_username: String,
    pub author_display_name: Option<String>,
}
```

**Exercise:**
1. Create a `UserProfile` response type that includes follower/following counts but excludes `email` and `password_hash`
2. Add validation annotations to request types (e.g., email format, string length)

---

## Module 7: Testing

### Lesson 7.1 — API Smoke Testing with curl

**Concept:** End-to-end validation of your API using shell scripts.

**Files:** `test.sh`

**Key Points:**
- The script exercises the full user flow: register → login → post → follow → feed
- `jq` extracts tokens and IDs from JSON responses for use in subsequent requests
- Bearer tokens are passed via `-H "Authorization: Bearer $TOKEN"`
- This catches integration issues that unit tests miss (routing, middleware, database)

**Study the flow:**
1. Register Alice → get token
2. Register Bob → get token
3. Alice creates a post
4. Bob follows Alice
5. Bob checks feed → sees Alice's post + own posts
6. Alice checks feed → sees only own posts (doesn't follow Bob)

**Exercise:**
1. Add test cases for error paths (duplicate registration, invalid token, deleting someone else's post)
2. Add a test that unfollows and verifies the feed no longer shows that user's posts
3. Convert to an integration test in Rust using `reqwest` and a test database

---

## Module 8: Real-Time & Encryption (Implemented)

These features are fully implemented. Study the code to understand how they work.

### Lesson 8.1 — WebSocket Real-Time Communication

**Files:** `backend/src/chat.rs`, `backend/src/routes.rs` (ws_handler), `frontend/src/lib/ws.ts`

**Key Points:**
- Axum's `WebSocketUpgrade` extractor handles the HTTP → WS upgrade
- `ConnectionManager` stores `HashMap<UserId, Vec<Sender>>` — up to 5 connections per user
- Ticket-based auth: client gets a one-time ticket via REST, passes it in the WS URL
- Messages are broadcast to all conversation members via the connection manager
- Typing indicators are forwarded to all other members

**Study the code:**
```rust
// Ticket-based auth flow
async fn create_ws_ticket(auth: AuthUser) -> Json<Value> {
    let ticket = Uuid::new_v4().to_string();
    state.ws_tickets.insert(ticket, (user_id, username, Instant::now()));
    Json(json!({ "ticket": ticket }))
}
```

**Exercise:**
1. Add Redis pub/sub so messages are delivered across multiple server instances
2. Add a `presence` message type that broadcasts online/offline status

---

### Lesson 8.2 — E2E Encryption (Signal Protocol)

**Files:** `frontend/src/lib/crypto/` (all files), `frontend/src/lib/stores/chat.ts`

**Key Points:**
- X3DH key agreement: 4 Diffie-Hellman operations establish a shared secret
- Double Ratchet: derives a new key for every message (forward secrecy)
- Group chat uses AES-256-GCM with a shared group key distributed via pairwise encryption
- Ed25519 signing: posts are signed client-side, verified by other clients
- Safety numbers: fingerprint comparison modal for verifying identity keys

**Study the code:**
- `crypto/keys.ts` — Key generation and bundle upload
- `crypto/signal.ts` — X3DH, encrypt, decrypt
- `crypto/groupkeys.ts` — Group key generation and distribution
- `crypto/fingerprint.ts` — Safety number computation

**Exercise:**
1. Implement group key rotation when a member is removed
2. Add a warning UI when a contact's identity key changes

---

### Lesson 8.3 — Graph Database & Data Science (Future)

**Reference:** `docs/architecture.md` — Graph Database section

**Concepts to learn:**
- Polyglot persistence (PostgreSQL as source of truth, Neo4j as derived store)
- Cypher query language for graph traversal
- Friend-of-friend recommendations
- Community detection (Louvain algorithm)
- PageRank for influence scoring
- Content recommendation from reaction similarity

---

### Lesson 8.4 — Cursor-Based Pagination (Implemented)

**Files:** `backend/src/models.rs` (encode_cursor, decode_cursor), `backend/src/routes.rs` (get_feed, get_replies)

**Key Points:**
- Cursors encode `(created_at, id)` as base64 — opaque to the client
- Uses `(created_at, id) < ($cursor_ts, $cursor_id)` for stable, gap-free pagination
- Feed paginates descending (newest first), replies paginate ascending (oldest first)
- `PaginatedResponse<T>` wraps `{ data: [...], next_cursor: "..." }`

**Exercise:**
1. Add Redis-cached feed using sorted sets (fan-out-on-write)
2. Implement a ranked feed using reaction counts as a scoring signal

---

## Module 9: Frontend (SvelteKit)

### Lesson 9.1 — SvelteKit Project Structure & SSR

**Concept:** How SvelteKit combines server-side rendering with client-side interactivity.

**Files:** `frontend/src/routes/+layout.svelte`, `frontend/src/hooks.server.ts`

**Key Points:**
- `+layout.svelte` wraps all pages — ideal for nav bars and shared UI
- `+page.svelte` files define routes based on the filesystem (`/login/+page.svelte` → `/login`)
- `hooks.server.ts` runs on the server for every request — used here to proxy `/api/*` to the backend
- SSR means code runs on both server and client — `localStorage` and other browser APIs must be guarded with `import { browser } from '$app/environment'`

**Gotcha learned:** `process.env` doesn't work in SvelteKit. Use `$env/dynamic/private` for server-side env vars.

---

### Lesson 9.2 — Svelte Stores for Auth State

**Concept:** Managing authentication state across components with reactive stores.

**Files:** `frontend/src/lib/stores/auth.ts`

**Key Points:**
- `writable()` creates a reactive store that components can subscribe to
- The store is backed by `localStorage` for persistence across page reloads
- All `localStorage` calls are guarded with `if (browser)` for SSR safety
- Components access state with `$auth` (auto-subscription syntax)
- The store exposes `login()`, `logout()`, `updateUser()` methods

---

### Lesson 9.3 — API Client Pattern

**Concept:** A typed fetch wrapper that automatically handles auth headers and errors.

**Files:** `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`

**Key Points:**
- A single `request()` function handles all API calls
- JWT token is read from the auth store and attached as `Authorization: Bearer` header
- Non-2xx responses are parsed for error messages and thrown as exceptions
- TypeScript interfaces in `types.ts` mirror the Rust backend models
- Each API method is a thin wrapper: `login: (email, password) => request('POST', '/auth/login', { email, password })`

---

### Lesson 9.4 — API Proxying in SvelteKit

**Concept:** Routing frontend API calls to a separate backend service.

**Files:** `frontend/src/hooks.server.ts`

**Key Points:**
- Vite's built-in proxy doesn't work with SvelteKit (SvelteKit intercepts all routes first)
- `hooks.server.ts` intercepts requests matching `/api/*` and forwards them to the backend
- Inside Docker, the backend is at `http://backend:3000`; locally it's `http://localhost:3001`
- The `API_URL` env var (via `$env/dynamic/private`) controls the target
- Only `Authorization` and `Content-Type` headers are forwarded (avoids `Host` header conflicts)

---

## Appendix: Concept Map

```
                    ┌─────────────────────┐
                    │   Lesson 1.1        │
                    │   Project Structure  │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ Lesson 2.1 │  │ Lesson 1.2 │  │ Lesson 4.1 │
     │ Axum Setup │  │ Docker     │  │ Schema     │
     └─────┬──────┘  └────────────┘  └─────┬──────┘
           │                               │
     ┌─────┴──────┐                  ┌─────┴──────┐
     │ Lesson 2.2 │                  │ Lesson 4.2 │
     │ Handlers   │                  │ SQLx       │
     └─────┬──────┘                  └─────┬──────┘
           │                               │
     ┌─────┴──────┐                  ┌─────┴──────┐
     │ Lesson 2.3 │                  │ Lesson 4.3 │
     │ State      │──────────────────│ Feed Query │
     └─────┬──────┘                  └────────────┘
           │
     ┌─────┴──────┐     ┌────────────┐
     │ Lesson 3.1 │     │ Lesson 5.1 │
     │ Passwords  │     │ Errors     │
     └─────┬──────┘     └────────────┘
           │
     ┌─────┴──────┐     ┌────────────┐
     │ Lesson 3.2 │     │ Lesson 6.1 │
     │ JWT        │     │ Data Model │
     └─────┬──────┘     └────────────┘
           │
     ┌─────┴──────┐     ┌────────────┐
     │ Lesson 3.3 │     │ Lesson 7.1 │
     │ Extractors │     │ Testing    │
     └────────────┘     └────────────┘
```

---

## How to Use These Lessons

1. **Read the referenced files first** — understand the code before reading the explanation
2. **Do the exercises** — they extend the codebase incrementally toward the full architecture
3. **Follow the dependency graph** — lessons build on each other (Module 2 before Module 3, etc.)
4. **Check `docs/architecture.md`** for the full target design when you need more context
5. **Use `test.sh`** after each change to verify nothing broke
