# Oceana WebSocket Protocol

Real-time bidirectional communication for chat messages and typing indicators.

---

## Connection

**Endpoint:** `GET /api/v1/ws?token=<jwt>`

The JWT is passed as a query parameter. On successful authentication, the connection is upgraded to WebSocket.

### Connection Limits

- Maximum 5 WebSocket connections per user
- When a 6th connection opens, the oldest is dropped
- On disconnect, the connection is cleaned up automatically

### Reconnection

The frontend client (`src/lib/ws.ts`) automatically reconnects after 3 seconds on disconnection, as long as a valid token exists.

---

## Message Format

All messages are JSON-encoded strings.

### Client → Server

#### `send_message`

Send a chat message to a conversation. Sender must be a member.

**Plaintext message:**
```json
{
  "type": "send_message",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Hello!"
}
```

**Encrypted message (Signal Protocol):**
```json
{
  "type": "send_message",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "ciphertext": "base64-encoded-ciphertext",
  "nonce": "base64-encoded-nonce",
  "message_type": 3
}
```

**With image attachment:**
```json
{
  "type": "send_message",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Check this out",
  "image_url": "/api/v1/uploads/abc123.png"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conversation_id` | UUID | Yes | Target conversation |
| `content` | string | No | Plaintext message body |
| `image_url` | string | No | Path to uploaded image |
| `ciphertext` | string | No | Base64 Signal Protocol ciphertext |
| `nonce` | string | No | Base64 encryption nonce |
| `message_type` | integer | No | `2` = WhisperMessage, `3` = PreKeyWhisperMessage |

#### `typing`

Send a typing indicator. Sender must be a conversation member. Broadcast to all other members (not back to sender).

```json
{
  "type": "typing",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### Server → Client

#### `new_message`

Broadcast to all conversation members when a message is sent.

```json
{
  "type": "new_message",
  "message": {
    "id": "uuid",
    "conversation_id": "uuid",
    "sender_id": "uuid",
    "plaintext": "Hello!",
    "ciphertext": null,
    "nonce": null,
    "message_type": null,
    "image_url": null,
    "created_at": "2026-03-18T00:00:00Z"
  },
  "sender_username": "alice",
  "sender_is_bot": false
}
```

#### `typing`

Broadcast to all conversation members except the sender.

```json
{
  "type": "typing",
  "conversation_id": "uuid",
  "user_id": "uuid",
  "username": "alice"
}
```

#### `error`

Server-side error notification.

```json
{
  "type": "error",
  "message": "description of error"
}
```

---

## Architecture

### Connection Manager

The `ConnectionManager` (`backend/src/chat.rs`) maintains an in-memory map of `user_id → Vec<Sender>`.

- **connect:** Adds a new sender channel, caps at 5 per user
- **disconnect:** Removes the sender, cleans up empty entries
- **send_to_user:** Broadcasts a message to all active connections for a user

### Message Flow

```
Client A sends message
    │
    ▼
WebSocket Handler (routes.rs)
    │
    ├── 1. Verify sender is conversation member
    ├── 2. Store message in PostgreSQL
    ├── 3. Fetch all conversation member IDs
    └── 4. Broadcast via ConnectionManager to all members
            │
            ├── Client A (receives own message)
            ├── Client B (receives message)
            └── Client C (receives message)
```

### Frontend Client

`frontend/src/lib/ws.ts` provides:

- `connectWs()` — establishes connection with auto-reconnect
- `disconnectWs()` — clean shutdown
- `sendWsMessage(msg)` — sends JSON message
- `onWsMessage(handler)` — registers message handler, returns unsubscribe function
