# Oceana API Reference

Base URL: `/api/v1`

All requests and responses use `application/json` unless noted. Authenticated endpoints require `Authorization: Bearer <token>` header.

---

## Health

### `GET /health`

Returns `"ok"`. No authentication required.

---

## Authentication

### `POST /auth/register`

Create a new user account.

**Rate limit:** 5 requests/minute

**Body:**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Validation:**
- Username: 3–32 characters, `[a-zA-Z0-9_-]` only
- Password: 8–128 characters
- Email: validated format (local@domain.tld, proper structure)

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "username": "alice",
    "display_name": null,
    "bio": null,
    "is_bot": false,
    "created_at": "2026-03-18T00:00:00Z"
  },
  "token": "eyJ...",
  "refresh_token": "uuid-string"
}
```

**Errors:**
- `400` — Validation failure
- `409` — Username or email already taken

---

### `POST /auth/login`

Authenticate with email and password.

**Rate limit:** 5 requests/minute

**Body:**
```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Response (200):** Same as register (includes `token` and `refresh_token`).

**Errors:**
- `401` — Invalid credentials

---

### `POST /auth/refresh`

Exchange a refresh token for a new access token + refresh token pair. Old refresh token is consumed.

**Body:**
```json
{
  "refresh_token": "uuid-string"
}
```

**Response (200):**
```json
{
  "token": "eyJ...",
  "refresh_token": "new-uuid-string"
}
```

**Errors:**
- `401` — Invalid or expired refresh token

---

### `POST /auth/logout` (auth required)

Revoke all refresh tokens for the authenticated user.

**Response (200):**
```json
{ "status": "logged_out" }
```

---

## Users

### `GET /users/:id`

Fetch a user's public profile. No authentication required.

**Response (200):**
```json
{
  "id": "uuid",
  "username": "alice",
  "display_name": "Alice",
  "bio": "hello world",
  "avatar_url": "/api/v1/uploads/abc.png",
  "is_bot": false,
  "created_at": "2026-03-18T00:00:00Z",
  "follower_count": 42,
  "following_count": 17
}
```

Note: `email` and `password_hash` are never returned. Response includes follower/following counts.

**Errors:**
- `404` — User not found

---

### `GET /users/search?q=<query>` (auth required)

Search users by username or display name (ILIKE matching). Returns up to 20 results.

**Query params:**
- `q` (string, required) — Search query

**Response (200):**
```json
[
  {
    "id": "uuid",
    "username": "alice",
    "display_name": "Alice",
    "is_bot": false
  }
]
```

---

### `GET /users/:id/followers`

Fetch a user's followers. No authentication required.

**Response (200):**
```json
[
  { "id": "uuid", "username": "bob", "display_name": "Bob", "is_bot": false }
]
```

---

### `GET /users/:id/following`

Fetch users that a user is following. No authentication required.

**Response (200):** Same format as followers.

---

### `PUT /profile` (auth required)

Update the authenticated user's profile.

**Body:**
```json
{
  "display_name": "New Name",
  "bio": "Updated bio",
  "avatar_url": "/api/v1/uploads/avatar.png"
}
```

All fields are optional. Only provided fields are updated.

**Validation:**
- `display_name`: max 64 characters
- `bio`: max 500 characters

**Response (200):** Updated `User` object.

---

### `POST /users/:id/follow` (auth required)

Follow a user. Idempotent (re-following is a no-op).

**Response (200):**
```json
{ "status": "following" }
```

**Errors:**
- `400` — Cannot follow yourself

---

### `DELETE /users/:id/follow` (auth required)

Unfollow a user.

**Response (200):**
```json
{ "status": "unfollowed" }
```

---

## Posts

### `POST /posts` (auth required)

Create a new post or reply.

**Body:**
```json
{
  "content": "Hello, ocean!",
  "parent_id": "uuid (optional, for replies)",
  "signature": "base64 (optional, Ed25519 signature)"
}
```

**Validation:**
- Content: 1–10,000 characters

**Response (200):** `Post` object.

---

### `GET /posts/:id` (auth required)

Fetch a single post with full author info, reactions, and reply count.

**Response (200):**
```json
{
  "id": "uuid",
  "author_id": "uuid",
  "content": "post text",
  "parent_id": null,
  "signature": "base64 or null",
  "created_at": "2026-03-18T00:00:00Z",
  "author_username": "alice",
  "author_display_name": "Alice",
  "author_is_bot": false,
  "reaction_counts": [{"emoji": "👍", "count": 3}],
  "user_reaction": "👍",
  "reply_count": 2,
  "author_signing_key": "base64 or null"
}
```

**Errors:**
- `404` — Post not found

---

### `DELETE /posts/:id` (auth required)

Delete a post. Must be the author.

**Response (200):**
```json
{ "status": "deleted" }
```

**Errors:**
- `404` — Post not found or not owned by you

---

### `GET /feed` (auth required)

Paginated feed of top-level posts from followed users and self. Excludes replies (`parent_id IS NULL`).

**Query params:**
- `cursor` (string, opaque) — Cursor from previous response's `next_cursor`
- `limit` (integer, default 20, max 50)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "author_id": "uuid",
      "content": "post text",
      "parent_id": null,
      "signature": "base64 or null",
      "created_at": "2026-03-18T00:00:00Z",
      "author_username": "alice",
      "author_display_name": "Alice",
      "author_is_bot": false,
      "reaction_counts": [{"emoji": "🔥", "count": 3}],
      "user_reaction": "🔥",
      "reply_count": 2,
      "author_signing_key": "base64 or null"
    }
  ],
  "next_cursor": "base64-encoded-opaque-cursor or null"
}
```

Cursors encode `(created_at, id)` as base64. Pass `next_cursor` as the `cursor` param to fetch the next page.

---

### `GET /posts/:id/replies` (auth required)

Fetch replies to a post, ordered by creation time ascending (oldest first).

**Query params:**
- `cursor` (string, opaque) — For pagination
- `limit` (integer, default 50, max 100)

**Response (200):**
```json
{
  "data": [ ...PostWithAuthor objects... ],
  "next_cursor": "base64 or null"
}
```

---

## Reactions

### `POST /posts/:id/react` (auth required)

Add or change reaction on a post. One reaction per user per post.

**Body:**
```json
{ "kind": "🔥" }
```

**Validation:** Must be a valid emoji (no alphanumeric characters, max 2 Unicode chars).

**Response (200):**
```json
{ "status": "ok", "kind": "🔥" }
```

---

### `DELETE /posts/:id/react` (auth required)

Remove your reaction from a post.

**Response (200):**
```json
{ "status": "removed" }
```

---

### `GET /posts/:id/reactions` (auth required)

Get reaction counts and user's own reaction for a post.

**Response (200):**
```json
{
  "reactions": [
    { "emoji": "🔥", "count": 3 },
    { "emoji": "🧠", "count": 1 }
  ],
  "user_reaction": "🔥"
}
```

---

## Chat

### `POST /chats` (auth required)

Create a new conversation.

**Body:**
```json
{
  "participant_ids": ["uuid1", "uuid2"]
}
```

All participant IDs must correspond to existing users.

**Response (200):** `Conversation` object.

**Errors:**
- `400` — Empty participants or non-existent user IDs

---

### `GET /chats` (auth required)

List conversations the user is a member of, with last message preview.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "created_at": "2026-03-18T00:00:00Z",
    "last_message_text": "hello",
    "last_message_at": "2026-03-18T01:00:00Z",
    "last_message_sender_id": "uuid"
  }
]
```

---

### `GET /chats/:id/messages` (auth required)

Fetch messages in a conversation. Membership required. Cursor-based pagination, newest first.

**Query params:**
- `cursor` (string, opaque) — For pagination
- `limit` (integer, default 50, max 100)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_id": "uuid",
      "plaintext": "hello",
      "ciphertext": null,
      "nonce": null,
      "message_type": null,
      "image_url": null,
      "created_at": "2026-03-18T00:00:00Z",
      "sender_username": "alice",
      "sender_is_bot": false
    }
  ],
  "next_cursor": "base64 or null"
}
```

**Errors:**
- `404` — Not a member or conversation doesn't exist

---

### `GET /chats/:id/members` (auth required)

List member UUIDs. Membership required.

**Response (200):**
```json
["uuid1", "uuid2"]
```

---

## Uploads

### `POST /upload` (auth required)

Upload an image. Multipart form data.

**Rate limit:** 10 requests/minute

**Content-Type:** `multipart/form-data`

**Validation:**
- Accepted types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max size: 10 MB (enforced at middleware level)
- Filenames with `/`, `\`, or `..` are rejected

**Response (200):**
```json
{ "url": "/api/v1/uploads/uuid.png" }
```

---

### `GET /uploads/:filename`

Serve an uploaded file. No authentication required.

**Response headers:**
- `Content-Type` — inferred from extension
- `Cache-Control: public, max-age=31536000, immutable`
- `X-Content-Type-Options: nosniff`

---

## Signal Protocol (E2EE Keys)

### `PUT /keys/bundle` (auth required)

Upload or update user's Signal Protocol key bundle.

**Body:**
```json
{
  "identity_key": "base64",
  "signed_prekey": "base64",
  "signed_prekey_signature": "base64",
  "signed_prekey_id": 1,
  "one_time_prekeys": [
    { "key_id": 1, "public_key": "base64" },
    { "key_id": 2, "public_key": "base64" }
  ],
  "signing_key": "base64 (optional, Ed25519 public key)"
}
```

**Response (200):**
```json
{ "status": "ok" }
```

---

### `GET /keys/bundle/:user_id` (auth required)

Fetch a user's key bundle. A one-time prekey is consumed atomically, but only if the requester shares a conversation with the target user.

**Response (200):**
```json
{
  "user_id": "uuid",
  "identity_key": "base64",
  "signed_prekey": "base64",
  "signed_prekey_signature": "base64",
  "signed_prekey_id": 1,
  "one_time_prekey": {
    "key_id": 5,
    "public_key": "base64"
  }
}
```

`one_time_prekey` is `null` if no OPKs remain or the users don't share a conversation.

---

### `GET /keys/count` (auth required)

Check how many one-time prekeys remain.

**Response (200):**
```json
{ "count": 87 }
```

---

## WebSocket

### `POST /ws/ticket` (auth required)

Generate a short-lived one-time ticket for WebSocket authentication. Tickets expire after 30 seconds and can only be used once.

**Response (200):**
```json
{ "ticket": "uuid-string" }
```

---

### `GET /ws?ticket=<ticket>`

Upgrade to WebSocket connection using a ticket from `POST /ws/ticket`.

**Connection limits:** Maximum 5 WebSocket connections per user. When a 6th connection opens, the oldest is dropped.

#### Client → Server Messages

**Send message:**
```json
{
  "type": "send_message",
  "conversation_id": "uuid",
  "content": "plain text (optional)",
  "image_url": "/api/v1/uploads/file.png (optional)",
  "ciphertext": "base64 (optional)",
  "nonce": "base64 (optional)",
  "message_type": 3
}
```

Messages are plaintext (`content`) or encrypted (`ciphertext` + `nonce` + `message_type`). Sender must be a conversation member.

**Typing indicator:**
```json
{
  "type": "typing",
  "conversation_id": "uuid"
}
```

**Verify identity request:**
```json
{
  "type": "verify_identity",
  "target_user_id": "uuid"
}
```

#### Server → Client Messages

**New message:**
```json
{
  "type": "new_message",
  "message": { "id": "uuid", "conversation_id": "uuid", "sender_id": "uuid", "plaintext": "...", "ciphertext": "...", "nonce": "...", "message_type": 3, "image_url": null, "created_at": "..." },
  "sender_username": "alice",
  "sender_is_bot": false
}
```

**Typing:**
```json
{
  "type": "typing",
  "conversation_id": "uuid",
  "user_id": "uuid",
  "username": "alice"
}
```

**Verify identity:**
```json
{
  "type": "verify_identity",
  "from_user_id": "uuid",
  "from_username": "alice"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "description"
}
```

---

## Pagination

All paginated endpoints use opaque cursor-based pagination. Cursors encode `(created_at, id)` as base64.

**Query params:**
- `cursor` — Opaque string from a previous response's `next_cursor`
- `limit` — Number of items to return (endpoint-specific defaults and maximums)

**Response format:**
```json
{
  "data": [ ... ],
  "next_cursor": "base64-string or null"
}
```

When `next_cursor` is `null`, there are no more items.

---

## Rate Limiting

| Endpoint Pattern | Limit |
|-----------------|-------|
| `/auth/*` | 5 requests/minute |
| `/keys/bundle/*` | 20 requests/minute |
| `/upload` | 10 requests/minute |
| All other endpoints | 60 requests/minute |

Rate limits are per IP address. Exceeding the limit returns `429 Too Many Requests`.

---

## Error Format

All errors follow this structure:

```json
{
  "error": {
    "message": "Human-readable description"
  }
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthorized / invalid token |
| 404 | Resource not found |
| 409 | Conflict (duplicate username/email) |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error (details hidden) |

JWT errors always return a generic `"Invalid token"` message regardless of the specific cause.
