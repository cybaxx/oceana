# Oceana Frontend

SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4.

---

## Pages

| Route | File | Auth | Description |
|-------|------|------|-------------|
| `/` | `+page.svelte` | Yes | Feed with compose box, signed posts, reactions, comments |
| `/login` | `login/+page.svelte` | No | Email/password login |
| `/register` | `register/+page.svelte` | No | Registration form |
| `/settings` | `settings/+page.svelte` | Yes | Edit display name and bio |
| `/users/[id]` | `users/[id]/+page.svelte` | No | User profile with follow/unfollow, follower/following counts |
| `/posts/[id]` | `posts/[id]/+page.svelte` | Yes | Post detail with replies, reactions, signature verification, comment input |
| `/chat` | `chat/+page.svelte` | Yes | Conversation list, create new chat |
| `/chat/[id]` | `chat/[id]/+page.svelte` | Yes | E2E encrypted chat view with safety numbers |
| `/about` | `about/+page.svelte` | No | About page |

---

## Key Libraries

| Library | File | Purpose |
|---------|------|---------|
| `src/lib/api.ts` | API client | Typed fetch wrapper with JWT auth, auto-logout on 401 |
| `src/lib/ws.ts` | WebSocket | Connection management with auto-reconnect, ticket-based auth |
| `src/lib/types.ts` | Types | TypeScript interfaces for all API types |
| `src/lib/stores/auth.ts` | Auth store | Svelte store with localStorage persistence |
| `src/lib/stores/chat.ts` | Chat store | Conversations, messages, E2EE integration, group keys |
| `src/lib/crypto/*` | Crypto | Signal Protocol + Ed25519 + group keys (see [encryption.md](encryption.md)) |
| `src/lib/components/Markdown.svelte` | Markdown | Renders markdown with syntax highlighting and embed support |

### Crypto Modules

| Module | Purpose |
|--------|---------|
| `crypto/index.ts` | Singleton init, auto key generation on login |
| `crypto/store.ts` | IndexedDB-backed Signal Protocol store (TOFU) |
| `crypto/keys.ts` | Identity/prekey generation, bundle upload, OPK replenishment |
| `crypto/signal.ts` | X3DH, Double Ratchet encrypt/decrypt, Ed25519 signing/verification |
| `crypto/groupkeys.ts` | AES-256-GCM group key generation and distribution |
| `crypto/fingerprint.ts` | Safety number generation for key verification UI |

---

## API Client (`api.ts`)

All API calls go through the `api` object. Adds `Authorization: Bearer <token>` header automatically. On 401 response, clears auth state and redirects to `/login`.

```typescript
import { api } from '$lib/api';

// Auth
await api.register(username, email, password);
await api.login(email, password);

// Users
await api.getUser(id);
await api.updateProfile({ display_name, bio });
await api.follow(id);
await api.unfollow(id);
await api.searchUsers(query);

// Posts
await api.createPost(content, parent_id?, signature?);
await api.getPost(id);            // returns PostWithAuthor
await api.deletePost(id);
await api.getReplies(id, cursor?); // returns PaginatedResponse
await api.getFeed(cursor?, limit?); // returns PaginatedResponse

// Reactions
await api.reactToPost(id, emoji);
await api.unreactToPost(id);

// Chat
await api.createConversation(participant_ids);
await api.listConversations();
await api.getMessages(conversationId, cursor?, limit?);
await api.getConversationMembers(conversationId);

// Crypto
await api.uploadKeyBundle(bundle);
await api.getKeyBundle(userId);
await api.getKeyCount();

// Media
await api.uploadImage(file);

// WebSocket
await api.getWsTicket();  // one-time ticket for WS auth
```

---

## Auth Store (`stores/auth.ts`)

Reactive Svelte store backed by `localStorage`. SSR-safe (guarded by `browser` check).

```typescript
import { auth } from '$lib/stores/auth';

// Read
$auth.user    // User | null
$auth.token   // string | null

// Write
auth.login(user, token);
auth.updateUser(user);
auth.logout();
```

---

## Markdown Component

`Markdown.svelte` renders user content as sanitized HTML with:

- GitHub Flavored Markdown (GFM)
- Line breaks
- Syntax-highlighted code blocks (highlight.js)
- YouTube, SoundCloud, and Spotify embeds (auto-detected from URLs)
- DOMPurify sanitization via `isomorphic-dompurify` (works in both SSR and client)

Embeds are replaced before sanitization so the final output is always sanitized.

---

## API Proxy

The frontend proxies `/api/v1/*` requests to the backend:

- **Dev (Vite):** `vite.config.ts` `server.proxy` routes to `http://backend:3000`
- **SSR:** `hooks.server.ts` forwards requests to `API_URL` environment variable

---

## WebSocket

`ws.ts` connects via a ticket-based auth flow:

1. Client calls `POST /api/v1/ws/ticket` to get a one-time ticket (30s expiry)
2. Client connects to `GET /api/v1/ws?ticket=<ticket>`
3. Auto-reconnects on disconnection (3-second delay) while a valid token exists

---

## Theme

Dark ocean terminal aesthetic:

- **Font:** JetBrains Mono (monospace)
- **Colors:** Ocean blues (`--ocean-950` to `--ocean-50`), terminal green/cyan/amber/red
- **Effects:** Scanline overlay, glow on hover, cursor blink animation
- **Scrollbars:** Styled to match theme

---

## Testing

86 unit tests across 7 test files:

| Test file | Coverage |
|-----------|----------|
| `crypto/store.test.ts` | IndexedDB Signal Protocol store |
| `crypto/keys.test.ts` | Key generation, bundle upload |
| `crypto/index.test.ts` | Crypto singleton init |
| `crypto/signal.test.ts` | X3DH, encrypt/decrypt |
| `crypto/groupkeys.test.ts` | AES-256-GCM group key ops |
| `crypto/fingerprint.test.ts` | Safety number generation |
| `stores/chat.test.ts` | Chat store with E2EE |

Run with:
```bash
cd frontend && npx vitest run
```
