# Quick Wins — Implementation Plan

Four small features ready to build. All follow existing patterns closely.

**Status:** Planned, not yet implemented.

---

## 1. Follower/Following List Pages

**Backend** (`backend/src/routes.rs`):
- Add `GET /users/:id/followers` — returns paginated `Vec<UserSearchResult>` (reuse existing type)
- Add `GET /users/:id/following` — same pattern
- Both use `CursorQuery` for pagination, join `follows` + `users` tables
- No auth required (public like `GET /users/:id`)

**Routes** (add to router):
```
.route("/users/:id/followers", get(get_followers))
.route("/users/:id/following", get(get_following))
```

**Frontend**:
- Add `api.getFollowers(id, cursor?)` and `api.getFollowing(id, cursor?)` to `api.ts`
- Make follower/following counts on `/users/[id]` clickable links
- Create `/users/[id]/followers/+page.svelte` and `/users/[id]/following/+page.svelte`
- Simple list of users with links to their profiles

**No migration needed.**

---

## 2. Profile Avatar Upload

**Migration** (`backend/migrations/009_avatar.sql`):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

**Backend**:
- Add `avatar_url: Option<String>` to `User` struct in `models.rs`
- Add `avatar_url: Option<String>` to `UpdateProfileRequest`
- Update `update_profile` handler to SET `avatar_url` in SQL
- Avatar display: included in all user-returning queries automatically (it's on User)

**Frontend**:
- Add `avatar_url` to `User` type in `types.ts`
- Add file input + preview to `settings/+page.svelte`: upload via `api.uploadImage()`, then save URL via `api.updateProfile({ avatar_url })`
- Add `updateProfile` to accept `avatar_url`
- Replace the initial-letter circle with `<img>` when `avatar_url` is set, across:
  - `users/[id]/+page.svelte` (profile)
  - `+page.svelte` (feed posts)
  - `posts/[id]/+page.svelte` (post detail)

---

## 3. Post Editing

**Migration** (`backend/migrations/010_post_updated_at.sql`):
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
```

**Backend** (`routes.rs`):
- Add `PUT /posts/:id` handler `edit_post`:
  - Auth required, must be author (`author_id = $user_id`)
  - Accepts `{ content: String }`
  - Validates 1–10,000 chars
  - Sets `updated_at = now()`
  - Returns updated `Post`
- Add route: `.route("/posts/:id", get(get_post).delete(delete_post).put(edit_post))`

**Models** (`models.rs`):
- Add `UpdatePostRequest { content: String }`
- Add `updated_at: Option<DateTime<Utc>>` to `Post` struct

**Frontend**:
- Add `editPost(id, content)` to `api.ts`
- Add `updated_at` to `Post` type in `types.ts`
- In feed (`+page.svelte`) and post detail (`posts/[id]/+page.svelte`): add edit button for own posts, toggle inline edit textarea, save via API
- Show "(edited)" indicator when `updated_at` is set

---

## 4. Conversation Naming

**Migration** (`backend/migrations/011_conversation_name.sql`):
```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(128);
```

**Backend**:
- Add `name: Option<String>` to `Conversation` and `ConversationWithLastMessage` in `models.rs`
- Extend `CreateConversationRequest` with `name: Option<String>`
- Update `create_conversation` to INSERT name
- Update `list_conversations` SQL to SELECT name
- Add `PUT /chats/:id` handler `update_conversation` — membership required, updates name
- Add `UpdateConversationRequest { name: Option<String> }` to models

**Routes**: `.route("/chats/:id", put(update_conversation))`

**Frontend**:
- Add `name` to `Conversation` type in `types.ts`
- Add `updateConversation(id, { name })` and update `createConversation` to accept optional name in `api.ts`
- In `chat/+page.svelte`: display `conv.name || conv.id.slice(0, 8)`
- In `chat/[id]/+page.svelte`: show name in header, add pencil icon to edit name inline
- In `createChat`: add optional name input field

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/migrations/009_avatar.sql` | NEW — avatar_url column |
| `backend/migrations/010_post_updated_at.sql` | NEW — updated_at column |
| `backend/migrations/011_conversation_name.sql` | NEW — name column |
| `backend/src/models.rs` | Add fields to User, Post, Conversation, ConversationWithLastMessage; add UpdatePostRequest, UpdateConversationRequest |
| `backend/src/routes.rs` | Add get_followers, get_following, edit_post, update_conversation handlers; update router, update_profile SQL |
| `backend/src/main.rs` | Add migration includes for 009, 010, 011 |
| `frontend/src/lib/types.ts` | Add avatar_url to User, updated_at to Post, name to Conversation |
| `frontend/src/lib/api.ts` | Add getFollowers, getFollowing, editPost, updateConversation methods |
| `frontend/src/routes/users/[id]/+page.svelte` | Clickable follower/following counts, avatar image |
| `frontend/src/routes/users/[id]/followers/+page.svelte` | NEW — follower list page |
| `frontend/src/routes/users/[id]/following/+page.svelte` | NEW — following list page |
| `frontend/src/routes/settings/+page.svelte` | Avatar upload UI |
| `frontend/src/routes/+page.svelte` | Avatar display in feed, edit button on own posts |
| `frontend/src/routes/posts/[id]/+page.svelte` | Avatar display, edit button on own post |
| `frontend/src/routes/chat/+page.svelte` | Display conversation name, name input on create |
| `frontend/src/routes/chat/[id]/+page.svelte` | Display/edit conversation name in header |

## Verification

1. `docker compose up --build -d` — migrations auto-run
2. Run `cargo test` — verify no regressions (104+ tests)
3. Manual checks:
   - Visit a user profile, click follower count → see list
   - Upload avatar in settings → see it in feed/profile
   - Edit a post → see "(edited)" marker
   - Name a conversation → see name in chat list
