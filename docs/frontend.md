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
| `/users/[id]` | `users/[id]/+page.svelte` | No | User profile with follow/unfollow |
| `/posts/[id]` | `posts/[id]/+page.svelte` | No | Single post detail view |
| `/chat` | `chat/+page.svelte` | Yes | Conversation list, create new chat |
| `/chat/[id]` | `chat/[id]/+page.svelte` | Yes | E2E encrypted chat view |
| `/about` | `about/+page.svelte` | No | About page |

---

## Key Libraries

| Library | File | Purpose |
|---------|------|---------|
| `src/lib/api.ts` | API client | Typed fetch wrapper with JWT auth, auto-logout on 401 |
| `src/lib/ws.ts` | WebSocket | Connection management with auto-reconnect |
| `src/lib/types.ts` | Types | TypeScript interfaces for all API types |
| `src/lib/stores/auth.ts` | Auth store | Svelte store with localStorage persistence |
| `src/lib/stores/chat.ts` | Chat store | Conversations, messages, E2EE integration |
| `src/lib/crypto/*` | Crypto | Signal Protocol + Ed25519 (see [encryption.md](encryption.md)) |
| `src/lib/components/Markdown.svelte` | Markdown | Renders markdown with syntax highlighting and embed support |

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

// Posts
await api.createPost(content, parent_id?, signature?);
await api.getPost(id);
await api.deletePost(id);
await api.getReplies(id);
await api.getFeed(before?, limit?);

// Reactions
await api.reactToPost(id, emoji);
await api.unreactToPost(id);

// Chat
await api.createConversation(participant_ids);
await api.listConversations();
await api.getMessages(conversationId, before?, limit?);
await api.getConversationMembers(conversationId);

// Crypto
await api.uploadKeyBundle(bundle);
await api.getKeyBundle(userId);
await api.getKeyCount();

// Media
await api.uploadImage(file);
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
- DOMPurify sanitization on both server and client (isomorphic-dompurify)

Embeds are replaced before sanitization so the final output is always sanitized.

---

## API Proxy

The frontend proxies `/api/v1/*` requests to the backend:

- **Dev (Vite):** `vite.config.ts` `server.proxy` routes to `http://backend:3000`
- **SSR:** `hooks.server.ts` forwards requests to `API_URL` environment variable

---

## Theme

Dark ocean terminal aesthetic:

- **Font:** JetBrains Mono (monospace)
- **Colors:** Ocean blues (`--ocean-950` to `--ocean-50`), terminal green/cyan/amber/red
- **Effects:** Scanline overlay, glow on hover, cursor blink animation
- **Scrollbars:** Styled to match theme
