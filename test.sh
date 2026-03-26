#!/usr/bin/env bash
# Comprehensive smoke test for Oceana API
# Requires: curl, jq, running server on :5173 (frontend proxy) or :3001 (direct)
set -euo pipefail

BASE="http://localhost:5173/api/v1"
PASS="password123"
FAILURES=0

c() { curl -sf "$@"; }
cj() { curl -sf "$@" | jq .; }
post_json() {
  local token="$1" path="$2" body="$3"
  c -X POST "$BASE$path" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$body"
}
put_json() {
  local token="$1" path="$2" body="$3"
  c -X PUT "$BASE$path" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$body"
}
get_auth() {
  local token="$1" path="$2"
  c "$BASE$path" -H "Authorization: Bearer $token"
}
delete_auth() {
  local token="$1" path="$2"
  c -X DELETE "$BASE$path" -H "Authorization: Bearer $token"
}

section() { echo -e "\n\033[1;36m=== $1 ===\033[0m"; }
pass()    { echo -e "  \033[32m✓ $1\033[0m"; }
fail()    { echo -e "  \033[31m✗ $1\033[0m"; FAILURES=$((FAILURES + 1)); }
assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" = "$expected" ]; then pass "$label"; else fail "$label (expected '$expected', got '$actual')"; fi
}
assert_gt() {
  local actual="$1" min="$2" label="$3"
  if [ "$actual" -gt "$min" ] 2>/dev/null; then pass "$label"; else fail "$label (expected >$min, got '$actual')"; fi
}
assert_not_empty() {
  local actual="$1" label="$2"
  if [ -n "$actual" ] && [ "$actual" != "null" ]; then pass "$label"; else fail "$label (was empty/null)"; fi
}

# ─── Register / login users ───────────────────────────────────────────────────
section "Register & Login"

TS=$(date +%s)

register() {
  local user="$1" email="$2"
  local res
  res=$(c -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"email\":\"$email\",\"password\":\"$PASS\"}" 2>/dev/null) \
  || res=$(c -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}")
  echo "$res"
}

ALICE_JSON=$(register "alice$TS" "alice$TS@oceana.io")
ALICE_TOKEN=$(echo "$ALICE_JSON" | jq -r .token)
ALICE_ID=$(echo "$ALICE_JSON" | jq -r .user.id)
assert_not_empty "$ALICE_TOKEN" "alice login token"
assert_not_empty "$ALICE_ID" "alice user id"

BOB_JSON=$(register "bob$TS" "bob$TS@oceana.io")
BOB_TOKEN=$(echo "$BOB_JSON" | jq -r .token)
BOB_ID=$(echo "$BOB_JSON" | jq -r .user.id)
assert_not_empty "$BOB_TOKEN" "bob login token"

CORAL_JSON=$(register "coral$TS" "coral$TS@oceana.io")
CORAL_TOKEN=$(echo "$CORAL_JSON" | jq -r .token)
CORAL_ID=$(echo "$CORAL_JSON" | jq -r .user.id)

DEPTH_JSON=$(register "depth$TS" "depth$TS@oceana.io")
DEPTH_TOKEN=$(echo "$DEPTH_JSON" | jq -r .token)
DEPTH_ID=$(echo "$DEPTH_JSON" | jq -r .user.id)

echo "  registered 4 users: alice, bob, coral, depth"

# ─── Registration validation ─────────────────────────────────────────────────
section "Registration Validation"

# Too short username
SHORT_RES=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"ab\",\"email\":\"short$TS@test.io\",\"password\":\"$PASS\"}")
assert_eq "$SHORT_RES" "400" "rejects username < 3 chars"

# Too short password
WEAK_RES=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"weakpw$TS\",\"email\":\"weak$TS@test.io\",\"password\":\"short\"}")
assert_eq "$WEAK_RES" "400" "rejects password < 8 chars"

# ─── Update profiles ──────────────────────────────────────────────────────────
section "Update profiles"

ALICE_PROFILE=$(put_json "$ALICE_TOKEN" "/profile" '{"display_name":"Alice Abyss","bio":"jellyfish whisperer"}')
ALICE_DN=$(echo "$ALICE_PROFILE" | jq -r .display_name)
assert_eq "$ALICE_DN" "Alice Abyss" "alice profile display_name"

put_json "$BOB_TOKEN" "/profile" '{"display_name":"Bob Bioluminescent","bio":"ocean hacker"}' > /dev/null
put_json "$CORAL_TOKEN" "/profile" '{"display_name":"Coral Cipher","bio":"music + crypto"}' > /dev/null
put_json "$DEPTH_TOKEN" "/profile" '{"display_name":"Depth Charge","bio":"bass drops below sea level"}' > /dev/null
pass "4 profiles updated"

# ─── Get user profile ─────────────────────────────────────────────────────────
section "Get user profile"

USER_JSON=$(c "$BASE/users/$ALICE_ID")
USER_NAME=$(echo "$USER_JSON" | jq -r .username)
assert_eq "$USER_NAME" "alice$TS" "GET /users/:id returns correct username"

# ─── User search ──────────────────────────────────────────────────────────────
section "User search"

SEARCH_COUNT=$(get_auth "$ALICE_TOKEN" "/users/search?q=alice$TS" | jq 'length')
assert_gt "$SEARCH_COUNT" "0" "search for alice returns results"

SEARCH_EMPTY=$(get_auth "$ALICE_TOKEN" "/users/search?q=zzz_nonexistent_zzz" | jq 'length')
assert_eq "$SEARCH_EMPTY" "0" "search for nonexistent returns 0"

# ─── Follows ──────────────────────────────────────────────────────────────────
section "Follow mesh"

follow() {
  local token="$1" target="$2"
  c -X POST "$BASE/users/$target/follow" -H "Authorization: Bearer $token" > /dev/null 2>&1 || true
}

for token_var in ALICE_TOKEN BOB_TOKEN CORAL_TOKEN DEPTH_TOKEN; do
  for id_var in ALICE_ID BOB_ID CORAL_ID DEPTH_ID; do
    follow "${!token_var}" "${!id_var}"
  done
done
pass "full follow mesh created"

# ─── Posts ────────────────────────────────────────────────────────────────────
section "Create posts"

mk_post() {
  local token="$1" content="$2"
  post_json "$token" "/posts" "{\"content\":$(echo "$content" | jq -Rs .)}" | jq -r '.id'
}

mk_signed_post() {
  local token="$1" content="$2" sig="$3"
  post_json "$token" "/posts" "{\"content\":$(echo "$content" | jq -Rs .),\"signature\":\"$sig\"}" | jq -r '.id'
}

P1=$(mk_post "$ALICE_TOKEN" "Moon jellyfish have no brain — and they've survived for 500 million years. 🪼")
assert_not_empty "$P1" "post 1 created"

P2=$(mk_post "$BOB_TOKEN" "The Mariana Trench is 36,000 feet deep. Imagine a rave down there 🌊🔊")
assert_not_empty "$P2" "post 2 created"

P3=$(mk_post "$CORAL_TOKEN" "Side-channel timing attack in the key exchange protocol. Never trust memcmp for secrets. 🔐")
assert_not_empty "$P3" "post 3 created"

P4=$(mk_post "$DEPTH_TOKEN" "New mix: 140bpm liquid DnB meets underwater field recordings. 🎵🐋")
assert_not_empty "$P4" "post 4 created"

P5=$(mk_post "$ALICE_TOKEN" "Ed25519 is beautiful: 32-byte keys, deterministic signatures. Elegance in every bit.")
P6=$(mk_post "$BOB_TOKEN" "PLUR isn't dead, it just went underground — literally. Submarine rave last weekend. 🫧⚡")
P7=$(mk_post "$CORAL_TOKEN" "Octopi can edit their own RNA on the fly. Nature invented self-modifying code. 🐙💻")
P8=$(mk_post "$DEPTH_TOKEN" "Zero-knowledge proofs for music royalties. Privacy-preserving patronage. 🎵🔐")
P9=$(mk_post "$ALICE_TOKEN" "## Markdown Test\n\n**Bold** and *italic*. A list:\n- item 1\n- item 2\n\n> blockquote")
P10=$(mk_post "$BOB_TOKEN" "Undersea fiber optic cables carry 99% of intercontinental internet traffic. 🌊🔒")

pass "10 posts created"

# ─── Signed post ──────────────────────────────────────────────────────────────
section "Signed post"

P_SIGNED=$(mk_signed_post "$ALICE_TOKEN" "This post is signed with Ed25519" "dGVzdHNpZ25hdHVyZQ==")
assert_not_empty "$P_SIGNED" "signed post created"

SIGNED_POST_JSON=$(get_auth "$ALICE_TOKEN" "/posts/$P_SIGNED")
POST_SIG=$(echo "$SIGNED_POST_JSON" | jq -r '.signature')
assert_eq "$POST_SIG" "dGVzdHNpZ25hdHVyZQ==" "signed post has signature in response"

# ─── Get single post ─────────────────────────────────────────────────────────
section "Get single post"

POST_JSON=$(get_auth "$ALICE_TOKEN" "/posts/$P1")
POST_AUTHOR=$(echo "$POST_JSON" | jq -r '.author_username')
assert_eq "$POST_AUTHOR" "alice$TS" "GET /posts/:id returns PostWithAuthor"

POST_REPLY_COUNT=$(echo "$POST_JSON" | jq -r '.reply_count')
assert_eq "$POST_REPLY_COUNT" "0" "new post has 0 replies"

# ─── Comments / replies ──────────────────────────────────────────────────────
section "Replies"

reply() {
  local token="$1" parent="$2" content="$3"
  post_json "$token" "/posts" "{\"content\":$(echo "$content" | jq -Rs .),\"parent_id\":\"$parent\"}" | jq -r .id
}

R1=$(reply "$BOB_TOKEN" "$P1" "No brain gang — the jellyfish lifestyle sounds peaceful")
assert_not_empty "$R1" "reply 1 created"

R2=$(reply "$CORAL_TOKEN" "$P1" "Box jellyfish have 24 eyes. No brain but 24 eyes.")
reply "$ALICE_TOKEN" "$P2" "36,000 feet of water pressure would make bass drops hit different" > /dev/null
reply "$DEPTH_TOKEN" "$P3" "This is why I use libsodium for everything" > /dev/null

# Nested reply (reply to reply)
R3=$(reply "$ALICE_TOKEN" "$R1" "Honestly, floating around with no responsibilities sounds ideal")
assert_not_empty "$R3" "nested reply created (reply-to-reply)"

pass "5 replies created (including nested)"

# ─── Verify replies endpoint ──────────────────────────────────────────────────
section "Verify replies"

REPLY_DATA=$(get_auth "$ALICE_TOKEN" "/posts/$P1/replies")
REPLY_COUNT=$(echo "$REPLY_DATA" | jq '.data | length')
assert_eq "$REPLY_COUNT" "2" "P1 has 2 direct replies"

# Check reply has author info
REPLY_AUTHOR=$(echo "$REPLY_DATA" | jq -r '.data[0].author_username')
assert_not_empty "$REPLY_AUTHOR" "reply includes author_username"

# ─── Reactions ────────────────────────────────────────────────────────────────
section "Reactions (likes, yikes, emoji)"

react() {
  local token="$1" post_id="$2" emoji="$3"
  post_json "$token" "/posts/$post_id/react" "{\"kind\":\"$emoji\"}" > /dev/null
}

# Likes (👍)
react "$BOB_TOKEN" "$P1" "👍"
react "$CORAL_TOKEN" "$P1" "👍"
react "$DEPTH_TOKEN" "$P1" "👍"
react "$ALICE_TOKEN" "$P2" "👍"
pass "4 likes applied"

# Yikes (😬)
react "$DEPTH_TOKEN" "$P6" "😬"
pass "1 yikes applied"

# Various emoji
react "$ALICE_TOKEN" "$P3" "🔥"
react "$BOB_TOKEN" "$P3" "🔥"
react "$CORAL_TOKEN" "$P5" "🧠"
react "$BOB_TOKEN" "$P7" "💀"
react "$DEPTH_TOKEN" "$P9" "✨"
pass "5 emoji reactions applied"

# Verify reactions on post
REACT_JSON=$(get_auth "$ALICE_TOKEN" "/posts/$P1/reactions")
REACT_COUNT=$(echo "$REACT_JSON" | jq '.reactions | length')
assert_gt "$REACT_COUNT" "0" "P1 has reactions"

# ─── Reaction removal & update ───────────────────────────────────────────────
section "Reaction removal & update"

# Remove bob's like on P1
delete_auth "$BOB_TOKEN" "/posts/$P1/react" > /dev/null
pass "bob unreacted from P1"

# Re-react with different emoji
react "$BOB_TOKEN" "$P1" "🌊"
pass "bob re-reacted with 🌊"

# Verify the change
REACT_JSON2=$(get_auth "$BOB_TOKEN" "/posts/$P1/reactions")
BOB_REACTION=$(echo "$REACT_JSON2" | jq -r '.user_reaction')
assert_eq "$BOB_REACTION" "🌊" "bob's reaction changed to 🌊"

# ─── Post deletion ───────────────────────────────────────────────────────────
section "Post deletion"

P_DELETE=$(mk_post "$ALICE_TOKEN" "This post will be deleted")
assert_not_empty "$P_DELETE" "deletable post created"

DELETE_RES=$(delete_auth "$ALICE_TOKEN" "/posts/$P_DELETE")
DELETE_STATUS=$(echo "$DELETE_RES" | jq -r '.status')
assert_eq "$DELETE_STATUS" "deleted" "post deletion returns status=deleted"

# Verify it's gone
DELETE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/posts/$P_DELETE" -H "Authorization: Bearer $ALICE_TOKEN")
assert_eq "$DELETE_CHECK" "404" "deleted post returns 404"

# Can't delete someone else's post
NOAUTH_DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/posts/$P2" -H "Authorization: Bearer $ALICE_TOKEN")
assert_eq "$NOAUTH_DEL" "404" "can't delete someone else's post"

# ─── Post editing ─────────────────────────────────────────────────────────────
section "Post editing"

# Edit own post
EDIT_RES=$(put_json "$ALICE_TOKEN" "/posts/$P1" '{"content":"Moon jellyfish have no brain — EDITED for accuracy 🪼"}')
EDIT_CONTENT=$(echo "$EDIT_RES" | jq -r '.content')
assert_eq "$EDIT_CONTENT" "Moon jellyfish have no brain — EDITED for accuracy 🪼" "edit updates content"

EDIT_UPDATED=$(echo "$EDIT_RES" | jq -r '.updated_at')
assert_not_empty "$EDIT_UPDATED" "edit sets updated_at"

# Can't edit someone else's post
NOAUTH_EDIT=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/posts/$P2" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"content":"hacked"}')
assert_eq "$NOAUTH_EDIT" "404" "can't edit someone else's post"

# Validation: empty content
EMPTY_EDIT=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/posts/$P1" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"content":""}')
assert_eq "$EMPTY_EDIT" "400" "rejects empty edit content"

# ─── Feed ─────────────────────────────────────────────────────────────────────
section "Feed"

FEED_JSON=$(get_auth "$ALICE_TOKEN" "/feed")
FEED_COUNT=$(echo "$FEED_JSON" | jq '.data | length')
assert_gt "$FEED_COUNT" "0" "alice feed has posts"

# Check feed returns PostWithAuthor fields
FIRST_POST=$(echo "$FEED_JSON" | jq '.data[0]')
assert_not_empty "$(echo "$FIRST_POST" | jq -r '.author_username')" "feed post has author_username"
assert_not_empty "$(echo "$FIRST_POST" | jq -r '.reaction_counts')" "feed post has reaction_counts"

# Feed pagination
NEXT_CURSOR=$(echo "$FEED_JSON" | jq -r '.next_cursor // empty')
if [ -n "$NEXT_CURSOR" ]; then
  PAGE2_COUNT=$(get_auth "$ALICE_TOKEN" "/feed?cursor=$NEXT_CURSOR" | jq '.data | length')
  pass "pagination: page 2 has $PAGE2_COUNT posts"
else
  pass "pagination: all posts fit in one page (no next_cursor)"
fi

# ─── Chat conversations ─────────────────────────────────────────────────────
section "Chat"

CONV1=$(post_json "$ALICE_TOKEN" "/chats" "{\"participant_ids\":[\"$BOB_ID\"]}" | jq -r .id)
assert_not_empty "$CONV1" "1:1 conversation created"

# Create named conversation
CONV2_RES=$(post_json "$ALICE_TOKEN" "/chats" "{\"participant_ids\":[\"$BOB_ID\",\"$CORAL_ID\",\"$DEPTH_ID\"],\"name\":\"Ocean Crew\"}")
CONV2=$(echo "$CONV2_RES" | jq -r .id)
CONV2_NAME=$(echo "$CONV2_RES" | jq -r .name)
assert_not_empty "$CONV2" "named group conversation created"
assert_eq "$CONV2_NAME" "Ocean Crew" "conversation has name"

# List conversations includes name
CONV_LIST=$(get_auth "$ALICE_TOKEN" "/chats")
CONV_COUNT=$(echo "$CONV_LIST" | jq 'length')
assert_gt "$CONV_COUNT" "0" "alice has conversations"

LIST_NAME=$(echo "$CONV_LIST" | jq -r --arg id "$CONV2" '.[] | select(.id == $id) | .name')
assert_eq "$LIST_NAME" "Ocean Crew" "conversation name in listing"

# Rename conversation
RENAME_RES=$(put_json "$ALICE_TOKEN" "/chats/$CONV2" '{"name":"Deep Ocean Crew"}')
RENAMED=$(echo "$RENAME_RES" | jq -r .name)
assert_eq "$RENAMED" "Deep Ocean Crew" "conversation renamed"

# Non-member can't rename
RENAME_NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/chats/$CONV1" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $CORAL_TOKEN" \
  -d '{"name":"hacked"}')
assert_eq "$RENAME_NOAUTH" "404" "non-member can't rename conversation"

# Get conversation members
MEMBERS=$(get_auth "$ALICE_TOKEN" "/chats/$CONV2/members" | jq 'length')
assert_eq "$MEMBERS" "4" "group chat has 4 members"

# ─── Key bundle ───────────────────────────────────────────────────────────────
section "Key bundle"

BUNDLE_RES=$(put_json "$ALICE_TOKEN" "/keys/bundle" "{
  \"identity_key\": \"dGVzdGlkZW50aXR5a2V5\",
  \"signed_prekey\": \"dGVzdHNpZ25lZHByZWtleQ==\",
  \"signed_prekey_signature\": \"dGVzdHNpZw==\",
  \"signed_prekey_id\": 1,
  \"one_time_prekeys\": [{\"key_id\": 1, \"public_key\": \"b3BrMQ==\"}],
  \"signing_key\": \"c2lnbmluZ2tleQ==\"
}")
pass "key bundle uploaded"

KEY_COUNT=$(get_auth "$ALICE_TOKEN" "/keys/count" | jq -r '.count')
assert_gt "$KEY_COUNT" "-1" "key count endpoint works"

BUNDLE_FETCH=$(get_auth "$BOB_TOKEN" "/keys/bundle/$ALICE_ID")
FETCH_IK=$(echo "$BUNDLE_FETCH" | jq -r '.identity_key')
assert_eq "$FETCH_IK" "dGVzdGlkZW50aXR5a2V5" "fetched bundle has correct identity_key"

# ─── Image upload ─────────────────────────────────────────────────────────────
section "Image upload"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/images/jellyfish.png" ]; then
  IMG_URL=$(curl -sf "$BASE/upload" -H "Authorization: Bearer $ALICE_TOKEN" \
    -F "file=@$SCRIPT_DIR/scripts/images/jellyfish.png;type=image/png" | jq -r '.url')
  assert_not_empty "$IMG_URL" "image uploaded successfully"
elif [ -f "$SCRIPT_DIR/images/jellyfish.png" ]; then
  IMG_URL=$(curl -sf "$BASE/upload" -H "Authorization: Bearer $ALICE_TOKEN" \
    -F "file=@$SCRIPT_DIR/images/jellyfish.png;type=image/png" | jq -r '.url')
  assert_not_empty "$IMG_URL" "image uploaded successfully"
else
  pass "skipped image upload (no test images found)"
fi

# ─── Health check ─────────────────────────────────────────────────────────────
section "Health check"

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
assert_eq "$HEALTH_STATUS" "200" "health endpoint returns 200"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo -e "\033[31m✗ $FAILURES test(s) failed\033[0m"
  exit 1
else
  echo -e "\033[32m✓ All tests passed\033[0m"
fi
