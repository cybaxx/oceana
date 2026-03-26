# Oceana Database Schema

PostgreSQL 16. All migrations are in `backend/migrations/` and run automatically on startup.

---

## Tables

### users

Primary identity and authentication table.

```sql
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
    -- Signal Protocol fields (added in migration 007, 008)
    identity_key            TEXT,
    signed_prekey           TEXT,
    signed_prekey_signature TEXT,
    signed_prekey_id        INT,
    signing_key             TEXT    -- Ed25519 public key for post signing
);
```

Notes:
- `email` is never serialized in API responses
- `password_hash` is Argon2id, never serialized
- `avatar_url` stores the path to the user's profile avatar image
- Signal fields are populated when the user uploads a key bundle
- `signing_key` is the Ed25519 public key used for post signature verification

---

### posts

User-generated content. Supports replies via `parent_id`.

```sql
CREATE TABLE posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    parent_id   UUID REFERENCES posts(id) ON DELETE SET NULL,
    signature   TEXT,       -- base64 Ed25519 signature of content
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_parent ON posts(parent_id);
```

---

### follows

Directed social graph edges.

```sql
CREATE TABLE follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);

CREATE INDEX idx_follows_followed ON follows(followed_id);
```

---

### reactions

Emoji reactions on posts. One reaction per user per post.

```sql
CREATE TABLE reactions (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    kind        VARCHAR(20) NOT NULL,  -- any emoji
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_reactions_post ON reactions(post_id);
CREATE INDEX idx_reactions_kind ON reactions(kind);
```

---

### conversations

Chat conversation containers.

```sql
CREATE TABLE conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### conversation_members

Many-to-many relationship between users and conversations.

```sql
CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);
```

---

### messages

Chat messages. Supports both plaintext and encrypted (Signal Protocol) messages.

```sql
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plaintext       TEXT,
    ciphertext      TEXT,       -- base64 Signal Protocol ciphertext
    nonce           TEXT,       -- base64 encryption nonce
    message_type    INT,        -- 2 = WhisperMessage, 3 = PreKeyWhisperMessage
    image_url       TEXT,       -- path to uploaded image attachment
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

---

### prekeys

One-time prekeys for Signal Protocol key exchange. Consumed (deleted) when another user fetches the key bundle.

```sql
CREATE TABLE prekeys (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id      INT NOT NULL,
    public_key  TEXT NOT NULL,
    UNIQUE (user_id, key_id)
);
```

---

### refresh_tokens

JWT refresh tokens for token rotation. Tokens are single-use and revoked on logout.

```sql
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
```

---

## Migration History

| File | Description |
|------|-------------|
| `001_initial.sql` | Core tables: users, posts, follows. pgcrypto extension. |
| `002_chat.sql` | conversations, conversation_members, messages |
| `003_attachments.sql` | Adds `image_url` column to messages |
| `004_bot_flag.sql` | Adds `is_bot` boolean to users |
| `005_reactions.sql` | reactions table with CHECK constraint (like/yikes) |
| `006_emoji_reactions.sql` | Drops CHECK constraint, allows any emoji |
| `007_signal_keys.sql` | Signal Protocol fields on users, prekeys table, post signature, message_type |
| `008_signing_key.sql` | Adds `signing_key` to users for Ed25519 |
| `009_avatar.sql` | Adds `avatar_url` to users for profile images |
| `010_refresh_tokens.sql` | Creates `refresh_tokens` table for JWT rotation |
| `999_seed.sql` | Test data (only runs when `SEED_DATA=true` env var is set) |

Migrations are idempotent — they use `IF NOT EXISTS` and `ON CONFLICT` patterns. Errors are logged (via `tracing::warn!`) but don't halt startup. Each migration file is split by `;` and each statement is executed individually (sqlx doesn't support multi-statement queries).
