import{a as B,f as H}from"../chunks/BP_36VQb.js";import"../chunks/D30wvZRE.js";import{P as W,Q as G,aq as X,ar as j,y as v,$ as J,am as U,Z as k,T as N,_ as q,U as Q,e,f as z,l as V,as as Z,d as a,r as n,n as $}from"../chunks/DVCoqHGb.js";import{M as t}from"../chunks/DOG_CQPS.js";function ee(l,i){let r=null,o=v;var d;if(v){r=q;for(var s=Q(document.head);s!==null&&(s.nodeType!==J||s.data!==l);)s=U(s);if(s===null)k(!1);else{var c=U(s);s.remove(),N(c)}}v||(d=document.head.appendChild(W()));try{G(()=>i(d),X|j)}finally{o&&(k(!0),N(r))}}var te=H('<div class="mb-8 text-center"><h1 class="mb-2 text-2xl font-bold text-[var(--ocean-200)]">Oceana</h1> <p class="text-sm text-[var(--terminal-dim)]">An encryption-first social platform built with Rust, SvelteKit, and the Signal Protocol.</p> <div class="mx-auto mt-4 flex flex-wrap justify-center gap-2 text-[10px]"><span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">Rust</span> <span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">Axum</span> <span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">PostgreSQL</span> <span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">SvelteKit 5</span> <span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">Signal Protocol</span> <span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">Ed25519</span> <span class="rounded border border-[var(--terminal-border)] px-2 py-0.5 text-[var(--ocean-400)]">Docker</span></div></div> <nav class="mb-8 rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)]/50 p-4"><p class="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--ocean-300)]">Contents</p> <div class="columns-2 gap-4 text-xs"><a href="#architecture" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Architecture</a> <a href="#stack" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Technology Stack</a> <a href="#schema" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Database Schema</a> <a href="#api" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">API Reference</a> <a href="#auth" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Authentication</a> <a href="#e2ee" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">E2E Encryption</a> <a href="#feed" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Feed System</a> <a href="#infra" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Infrastructure</a> <a href="#roadmap" class="block py-0.5 text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">Roadmap</a></div></nav> <div class="space-y-8"><section id="architecture" class="scroll-mt-16"><h2 class="section-heading">Architecture</h2> <!></section> <section id="stack" class="scroll-mt-16"><h2 class="section-heading">Technology Stack</h2> <h3 class="subsection-heading">Backend</h3> <!> <h3 class="subsection-heading mt-4">Frontend</h3> <!> <h3 class="subsection-heading mt-4">Infrastructure</h3> <!></section> <section id="schema" class="scroll-mt-16"><h2 class="section-heading">Database Schema</h2> <!></section> <section id="api" class="scroll-mt-16"><h2 class="section-heading">API Reference</h2> <p class="mb-3 text-xs text-[var(--terminal-dim)]">All endpoints prefixed with <code class="rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-1.5 py-0.5 text-[var(--ocean-300)]">/api/v1</code>. Auth endpoints require a Bearer JWT token.</p> <h3 class="subsection-heading">Authentication</h3> <!> <h3 class="subsection-heading mt-4">Users & Social</h3> <!> <h3 class="subsection-heading mt-4">Posts & Feed</h3> <!> <h3 class="subsection-heading mt-4">Chat</h3> <!> <h3 class="subsection-heading mt-4">Signal Protocol Keys</h3> <!> <h3 class="subsection-heading mt-4">Media</h3> <!></section> <section id="auth" class="scroll-mt-16"><h2 class="section-heading">Authentication</h2> <!> <h3 class="subsection-heading mt-4">Authorization Model</h3> <!></section> <section id="e2ee" class="scroll-mt-16"><h2 class="section-heading">E2E Encryption</h2> <p class="mb-3 text-xs text-[var(--terminal-dim)]">All chat encryption happens client-side. The server stores only ciphertext and can never read message contents.</p> <h3 class="subsection-heading">Signal Protocol</h3> <!> <h3 class="subsection-heading mt-4">Session Establishment (X3DH)</h3> <!> <h3 class="subsection-heading mt-4">Ed25519 Post Signing</h3> <!> <h3 class="subsection-heading mt-4">Key Storage & Trust</h3> <!></section> <section id="feed" class="scroll-mt-16"><h2 class="section-heading">Feed System</h2> <h3 class="subsection-heading">Current: Pull-Based Chronological</h3> <!> <h3 class="subsection-heading mt-4">Planned: Graph-Enhanced Ranking</h3> <!></section> <section id="infra" class="scroll-mt-16"><h2 class="section-heading">Infrastructure</h2> <!></section> <section class="scroll-mt-16"><h2 class="section-heading">Content Rendering</h2> <!></section> <section id="roadmap" class="scroll-mt-16"><h2 class="section-heading">Roadmap</h2> <div class="mb-4 rounded border border-[var(--ocean-400)]/20 bg-[var(--ocean-400)]/5 p-3"><p class="mb-2 text-xs font-bold text-[var(--ocean-300)]">Completed</p> <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--terminal-dim)]"><span>Users, posts, follows, feed</span> <span>Post replies and threading</span> <span>Emoji reactions (any emoji)</span> <span>Image uploads and display</span> <span>Bot/human distinction</span> <span>WebSocket real-time chat</span> <span>Signal Protocol E2EE</span> <span>Key bundle management</span> <span>Ed25519 signed posts</span> <span>Markdown + syntax highlighting</span> <span>Auto-logout on expired JWT</span></div></div> <div class="mb-4 rounded border border-[var(--terminal-border)] p-3"><p class="mb-2 text-xs font-bold text-[var(--ocean-300)]">Next Up</p> <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--terminal-dim)]"><span>Follower/following counts</span> <span>User search</span> <span>Cursor-based pagination</span> <span>Typing indicators</span> <span>Safety numbers UI</span> <span>Group chat E2EE</span></div></div> <div class="grid grid-cols-2 gap-3"><div class="rounded border border-[var(--terminal-border)] p-3"><p class="mb-2 text-xs font-bold text-[var(--ocean-300)]">Phase 6: Graph DB</p> <div class="space-y-1 text-xs text-[var(--terminal-dim)]"><p>Neo4j integration</p> <p>Friend-of-friend recommendations</p> <p>Community detection</p> <p>PageRank scoring</p></div></div> <div class="rounded border border-[var(--terminal-border)] p-3"><p class="mb-2 text-xs font-bold text-[var(--ocean-300)]">Phase 7: Hardening</p> <div class="space-y-1 text-xs text-[var(--terminal-dim)]"><p>Rate limiting</p> <p>CSP headers</p> <p>Redis pub/sub</p> <p>Multi-instance WS</p></div></div></div></section></div>',1);function ie(l){var i=te();ee("cwls5q",se=>{V(()=>{Z.title="about — oceana"})});var r=e(z(i),4),o=a(r),d=e(a(o),2);t(d,{content:`\`\`\`
┌──────────────────────────────────────────────────────────┐
│                       Clients                            │
│   SvelteKit SSR  ←→  Browser  ←→  Mobile (future)       │
└─────────────┬────────────────────────┬───────────────────┘
              │ HTTPS / WSS            │
              ▼                        ▼
┌──────────────────────────────────────────────────────────┐
│                  Axum Application Server                  │
│                                                          │
│  ┌───────┐ ┌────────┐ ┌───────┐ ┌──────┐ ┌──────────┐  │
│  │ Auth  │ │Profiles│ │ Posts │ │ Feed │ │   Chat   │  │
│  └───┬───┘ └───┬────┘ └───┬───┘ └──┬───┘ └────┬─────┘  │
│      └─────────┴─────────┴────────┴───────────┘         │
│            Middleware: CORS · Auth · Logging              │
└──────┬──────────────┬──────────────┬─────────────────────┘
       ▼              ▼              ▼
 ┌──────────┐  ┌──────────┐  ┌──────────┐
 │PostgreSQL│  │  Neo4j   │  │  Redis   │
 │ (primary)│  │ (planned)│  │(planned) │
 └──────────┘  └──────────┘  └──────────┘
\`\`\`

PostgreSQL is the **source of truth** for all transactional data. Neo4j and Redis will be added as supplementary stores for graph queries, caching, and pub/sub.`}),n(o);var s=e(o,2),c=e(a(s),4);t(c,{content:"| Component | Crate | Purpose |\n|---|---|---|\n| Web framework | `axum 0.7` | Async HTTP/WS on `tokio` + `tower` |\n| Database | `sqlx 0.8` | Compile-time checked async PostgreSQL |\n| Serialization | `serde` | JSON request/response handling |\n| Auth | `jsonwebtoken` + `argon2` | JWT tokens + Argon2id password hashing |\n| WebSockets | `tokio-tungstenite` | Real-time bidirectional messaging |\n| Observability | `tracing` | Structured logging |"});var T=e(c,4);t(T,{content:"| Component | Tool | Purpose |\n|---|---|---|\n| Framework | SvelteKit 5 | SSR + SPA hybrid with minimal runtime |\n| Language | TypeScript | Type safety mirroring Rust |\n| E2EE | `libsignal-protocol-typescript` | Signal Protocol: X3DH + Double Ratchet |\n| Signing | Web Crypto API | Ed25519 post signatures |\n| Markdown | `marked` + `DOMPurify` | Render + sanitize user content |\n| Highlighting | `highlight.js` | Code block syntax highlighting |\n| Styling | Tailwind CSS | Utility-first dark ocean theme |"});var C=e(T,4);t(C,{content:`| Component | Tool | Purpose |
|---|---|---|
| Orchestration | Docker Compose | One-command dev environment |
| Database | PostgreSQL 16 | Users, posts, messages, keys |
| Graph DB | Neo4j 5 *(planned)* | Social graph + recommendations |
| Cache | Redis 7 *(planned)* | Sessions, feed cache, chat pub/sub |`}),n(s);var p=e(s,2),w=e(a(p),2);t(w,{content:`\`\`\`sql
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username                VARCHAR(32) UNIQUE NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    password_hash           TEXT NOT NULL,
    display_name            VARCHAR(64),
    bio                     TEXT,
    is_bot                  BOOLEAN NOT NULL DEFAULT false,
    identity_key            TEXT,     -- Signal Protocol identity key
    signed_prekey           TEXT,
    signed_prekey_signature TEXT,
    signed_prekey_id        INT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);

CREATE TABLE posts (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content   TEXT,
    parent_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    image_url TEXT,
    signature TEXT,          -- Ed25519 signature of content
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reactions (
    user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id  UUID REFERENCES posts(id) ON DELETE CASCADE,
    emoji    TEXT NOT NULL DEFAULT '👍',
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_id       UUID NOT NULL REFERENCES users(id),
    plaintext       TEXT,       -- NULL when encrypted
    ciphertext      TEXT,       -- encrypted message body
    nonce           TEXT,
    message_type    INT,        -- 1 = WhisperMessage, 3 = PreKeyWhisperMessage
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prekeys (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id     INT NOT NULL,
    public_key TEXT NOT NULL,
    UNIQUE(user_id, key_id)
);
\`\`\``}),n(p);var h=e(p,2),y=e(a(h),6);t(y,{content:"| Method | Path | Auth | Description |\n|---|---|---|---|\n| `POST` | `/auth/register` | | Register with username, email, password |\n| `POST` | `/auth/login` | | Login, returns JWT token |"});var b=e(y,4);t(b,{content:"| Method | Path | Auth | Description |\n|---|---|---|---|\n| `GET` | `/users/:id` | | Get user profile |\n| `PUT` | `/profile` | Yes | Update display name and bio |\n| `POST` | `/users/:id/follow` | Yes | Follow a user |\n| `DELETE` | `/users/:id/follow` | Yes | Unfollow a user |"});var A=e(b,4);t(A,{content:"| Method | Path | Auth | Description |\n|---|---|---|---|\n| `POST` | `/posts` | Yes | Create post with optional Ed25519 signature |\n| `GET` | `/posts/:id` | | Get single post |\n| `DELETE` | `/posts/:id` | Yes | Delete own post |\n| `POST` | `/posts/:id/react` | Yes | React with any emoji |\n| `DELETE` | `/posts/:id/react` | Yes | Remove reaction |\n| `GET` | `/posts/:id/reactions` | Yes | List reactions |\n| `GET` | `/posts/:id/replies` | Yes | List replies |\n| `GET` | `/feed` | Yes | Chronological feed from followed users |"});var _=e(A,4);t(_,{content:"| Method | Path | Auth | Description |\n|---|---|---|---|\n| `POST` | `/chats` | Yes | Create conversation |\n| `GET` | `/chats` | Yes | List conversations |\n| `GET` | `/chats/:id/messages` | Yes | Get messages (encrypted) |\n| `GET` | `/chats/:id/members` | Yes | List member IDs |\n| `WS` | `/ws?token=JWT` | Yes | Real-time encrypted messaging |"});var f=e(_,4);t(f,{content:"| Method | Path | Auth | Description |\n|---|---|---|---|\n| `PUT` | `/keys/bundle` | Yes | Upload identity + signed prekey + OPKs |\n| `GET` | `/keys/bundle/:user_id` | Yes | Fetch bundle (consumes one OPK) |\n| `GET` | `/keys/count` | Yes | Remaining one-time prekey count |"});var O=e(f,4);t(O,{content:"| Method | Path | Auth | Description |\n|---|---|---|---|\n| `POST` | `/upload` | Yes | Upload image (multipart) |\n| `GET` | `/uploads/:filename` | | Serve uploaded file |"}),n(h);var u=e(h,2),S=e(a(u),2);t(S,{content:`\`\`\`
Client                                Server
  │                                     │
  │  POST /auth/login                   │
  │  { email, password }                │
  │ ───────────────────────────────────►│  Argon2id verify
  │                                     │
  │  { token: "JWT (HS256)", user }     │  Sign JWT
  │ ◄───────────────────────────────────│
  │                                     │
  │  GET /feed                          │
  │  Authorization: Bearer <JWT>        │
  │ ───────────────────────────────────►│  Verify sig + expiry
  │  { posts: [...] }                   │
  │ ◄───────────────────────────────────│
\`\`\`

**Tokens:** JWT signed with HS256, 24-hour expiry. Contains \`user_id\` and \`username\`.

**Passwords:** Hashed with Argon2id (memory-hard, GPU/ASIC resistant).

**Expiry handling:** Frontend automatically logs out on 401 and redirects to \`/login\`.`});var I=e(S,4);t(I,{content:`| Action | Rule |
|---|---|
| View profiles | Anyone |
| Edit profile | Owner only |
| Create / delete posts | Authenticated / Author |
| Follow users | Authenticated |
| Read feed | Authenticated |
| Chat messages | Conversation members only |
| Upload media | Authenticated |`}),n(u);var m=e(u,2),x=e(a(m),6);t(x,{content:`Implemented with \`@privacyresearch/libsignal-protocol-typescript\` providing X3DH key agreement and Double Ratchet message encryption.

**Key hierarchy:**

1. **Identity Key** — Long-term Ed25519/X25519 keypair. Public part stored on server.
2. **Signed Pre-Key** — Medium-term key signed by identity key.
3. **One-Time Pre-Keys** — Ephemeral keys uploaded in batches of 100, each consumed once.
4. **Double Ratchet** — Derives fresh encryption keys per message for forward secrecy.`});var R=e(x,4);t(R,{content:`\`\`\`
Alice initiates a session with Bob:

1. Fetch Bob's key bundle from server
   → identity key (IK_B), signed prekey (SPK_B), one-time prekey (OPK_B)

2. Generate ephemeral keypair (EK_A)

3. Compute shared secret via 4 Diffie-Hellman operations:
   DH1 = X25519(IK_A_private, SPK_B)
   DH2 = X25519(EK_A_private, IK_B)
   DH3 = X25519(EK_A_private, SPK_B)
   DH4 = X25519(EK_A_private, OPK_B)
   shared_secret = KDF(DH1 || DH2 || DH3 || DH4)

4. Send PreKeyWhisperMessage (type 3):
   IK_A, EK_A, OPK_B identifier, encrypted payload

5. Bob reconstructs the same shared_secret from his private keys
   → Double Ratchet begins
\`\`\`

**First message:** PreKeyWhisperMessage (type 3) — includes X3DH key material.
**Subsequent:** WhisperMessage (type 1) — Double Ratchet only.`});var D=e(R,4);t(D,{content:`Posts are optionally signed with the author's identity key via the Web Crypto API:

1. Author composes post content
2. Content bytes are signed with Ed25519 private key
3. Base64 signature is sent alongside content to \`POST /posts\`
4. Feed verifies signatures against each author's \`identity_key\`
5. Posts display a **SIGNED** or **BAD SIG** badge accordingly`});var M=e(D,4);t(M,{content:`- **Storage:** IndexedDB, per-user database (\`oceana-keys-{userId}\`)
- **Trust model:** TOFU (Trust On First Use) — accept on first encounter, warn on change
- **OPK replenishment:** Automatically generates more when count drops below 20
- **Persistence:** Keys survive page reloads and browser restarts`}),n(m);var E=e(m,2),L=e(a(E),4);t(L,{content:`\`\`\`sql
SELECT p.*, u.username, u.display_name, u.is_bot,
       u.identity_key, p.signature,
       COUNT(r.post_id) AS reply_count
FROM posts p
JOIN follows f ON f.followed_id = p.author_id
JOIN users u ON u.id = p.author_id
LEFT JOIN posts r ON r.parent_id = p.id
WHERE f.follower_id = $1 AND p.parent_id IS NULL
GROUP BY p.id, u.id
ORDER BY p.created_at DESC
LIMIT $2
\`\`\`

Posts from followed users, newest first. Includes signature data for client-side verification and reply counts for threading.`});var F=e(L,4);t(F,{content:`\`\`\`cypher
MATCH (me:User {id: $uid})-[:FOLLOWS]->(author)-[:AUTHORED]->(post)
WHERE post.created_at > datetime() - duration('P1D')
OPTIONAL MATCH (post)<-[r:REACTED]-()
WITH post, author, count(r) AS reactions,
     size((me)-[:REACTED]->()<-[:AUTHORED]-(author)) AS affinity
RETURN post.id, reactions * 0.3 + affinity * 0.7 AS score
ORDER BY score DESC LIMIT 50
\`\`\`

Neo4j will score posts by engagement and author affinity, blending reaction count with interaction history.`}),n(E);var g=e(E,2),K=e(a(g),2);t(K,{content:"One command runs the entire stack:\n\n```bash\ndocker compose up --build -d\n```\n\n| Service | Image | Ports | Notes |\n|---|---|---|---|\n| **postgres** | `postgres:16-alpine` | 5432 | Health-checked, persistent volume |\n| **backend** | Multi-stage Rust build | 3001 → 3000 | Auto-runs migrations on startup |\n| **frontend** | Node 22 alpine + Vite | 5173 | Proxies `/api/v1/*` to backend |\n\nThe Vite dev server proxies all API and WebSocket requests to the backend container, so the frontend can be accessed at `http://localhost:5173` with no CORS issues."}),n(g);var P=e(g,2),Y=e(a(P),2);t(Y,{content:`Posts support GitHub Flavored Markdown with syntax-highlighted code blocks.

| Feature | Support |
|---|---|
| Bold, italic, strikethrough | Standard GFM |
| Code blocks | Syntax highlighted via highlight.js |
| Tables | GFM table syntax |
| Images | Inline from upload pipeline |
| Links | Sanitized anchors |

**Security pipeline:** User markdown is rendered with \`marked\`, then sanitized with \`DOMPurify\` before display. No raw HTML reaches the DOM unsanitized.`}),n(P),$(2),n(r),B(l,i)}export{ie as component};
