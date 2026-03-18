#!/usr/bin/env bash
# Comprehensive smoke test for Oceana API
# Requires: curl, jq, running server on :3000, running postgres
set -euo pipefail

BASE="http://localhost:5173/api/v1"
PASS="password123"

c() { curl -sf "$@"; }
cj() { curl -sf "$@" | jq .; }
post_json() {
  local token="$1" path="$2" body="$3"
  c -X POST "$BASE$path" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$body"
}

section() { echo -e "\n\033[1;36m=== $1 ===\033[0m"; }

# ─── Register / login users ───────────────────────────────────────────────────
section "Register users"

register() {
  local user="$1" email="$2"
  local res
  res=$(c -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"email\":\"$email\",\"password\":\"$PASS\"}" 2>/dev/null) \
  || res=$(c -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}")
  echo "$res"
}

TS=$(date +%s)

ALICE_JSON=$(register "alice$TS" "alice$TS@oceana.io")
ALICE_TOKEN=$(echo "$ALICE_JSON" | jq -r .token)
ALICE_ID=$(echo "$ALICE_JSON" | jq -r .user.id)
echo "alice  => $ALICE_ID"

BOB_JSON=$(register "bob$TS" "bob$TS@oceana.io")
BOB_TOKEN=$(echo "$BOB_JSON" | jq -r .token)
BOB_ID=$(echo "$BOB_JSON" | jq -r .user.id)
echo "bob    => $BOB_ID"

CORAL_JSON=$(register "coral$TS" "coral$TS@oceana.io")
CORAL_TOKEN=$(echo "$CORAL_JSON" | jq -r .token)
CORAL_ID=$(echo "$CORAL_JSON" | jq -r .user.id)
echo "coral  => $CORAL_ID"

DEPTH_JSON=$(register "depth$TS" "depth$TS@oceana.io")
DEPTH_TOKEN=$(echo "$DEPTH_JSON" | jq -r .token)
DEPTH_ID=$(echo "$DEPTH_JSON" | jq -r .user.id)
echo "depth  => $DEPTH_ID"

# ─── Update profiles ──────────────────────────────────────────────────────────
section "Update profiles"

put_json() {
  local token="$1" path="$2" body="$3"
  c -X PUT "$BASE$path" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$body"
}

put_json "$ALICE_TOKEN" "/profile" '{"display_name":"Alice Abyss","bio":"jellyfish whisperer 🪼 // deep-sea cryptographer"}' | jq .display_name
put_json "$BOB_TOKEN" "/profile" '{"display_name":"Bob Bioluminescent","bio":"hacking the ocean floor 🌊 // rave @ the trench"}' | jq .display_name
put_json "$CORAL_TOKEN" "/profile" '{"display_name":"Coral Cipher","bio":"music + math + marine biology 🎵🔐"}' | jq .display_name
put_json "$DEPTH_TOKEN" "/profile" '{"display_name":"Depth Charge","bio":"bass drops below sea level 🫧⚡"}' | jq .display_name

# ─── Everyone follows everyone ────────────────────────────────────────────────
section "Everyone follows everyone"

follow() {
  local token="$1" target="$2"
  c -X POST "$BASE/users/$target/follow" -H "Authorization: Bearer $token" > /dev/null 2>&1 || true
}

for token_var in ALICE_TOKEN BOB_TOKEN CORAL_TOKEN DEPTH_TOKEN; do
  for id_var in ALICE_ID BOB_ID CORAL_ID DEPTH_ID; do
    token="${!token_var}"
    target="${!id_var}"
    follow "$token" "$target"
  done
done
echo "All follow relationships created"

# ─── Posts: themed content ─────────────────────────────────────────────────────
section "Create posts"

mk_post() {
  local token="$1" content="$2"
  local res
  res=$(post_json "$token" "/posts" "{\"content\":$(echo "$content" | jq -Rs .)}")
  echo "$res" | jq -r '.id'
}

# Jellyfish
P1=$(mk_post "$ALICE_TOKEN" "Moon jellyfish have no brain, no heart, no blood — and they've survived for 500 million years. Maybe simplicity is the ultimate sophistication. 🪼")
echo "post $P1 (jellyfish)"

# Ocean
P2=$(mk_post "$BOB_TOKEN" "The Mariana Trench is 36,000 feet deep. At that pressure, sound travels 4x faster than on land. Imagine a rave down there 🌊🔊")
echo "post $P2 (ocean/rave)"

# Hacking
P3=$(mk_post "$CORAL_TOKEN" "Just found a side-channel timing attack in the key exchange protocol. The fix? Add constant-time comparison + random delay jitter. Never trust \`memcmp\` for secrets. 🔐")
echo "post $P3 (hacking)"

# Music
P4=$(mk_post "$DEPTH_TOKEN" "New mix dropping tonight — 140bpm liquid DnB meets underwater field recordings. Hydrophones in the Pacific captured whale song at 52Hz. That's your sub-bass right there 🎵🐋")
echo "post $P4 (music)"

# Cryptography
P5=$(mk_post "$ALICE_TOKEN" "Ed25519 is beautiful: 32-byte keys, deterministic signatures, no random nonce needed. Curve25519 was chosen because \`2^255 - 19\` is prime. Elegance in every bit.")
echo "post $P5 (cryptography)"

# Rave culture
P6=$(mk_post "$BOB_TOKEN" "PLUR isn't dead, it just went underground — literally. Submarine rave last weekend: waterproof speakers, glow-in-the-dark plankton as the light show, and zero noise complaints 🫧⚡")
echo "post $P6 (rave)"

# Mixed: ocean + hacking
P7=$(mk_post "$CORAL_TOKEN" "Octopi can edit their own RNA on the fly to adapt to cold water. Nature invented self-modifying code 400 million years before we did. 🐙💻")
echo "post $P7 (ocean/hacking)"

# Mixed: music + crypto
P8=$(mk_post "$DEPTH_TOKEN" "What if we used zero-knowledge proofs for music royalties? Prove you streamed the track without revealing your identity. Privacy-preserving patronage. 🎵🔐")
echo "post $P8 (music/crypto)"

# Jellyfish + rave
P9=$(mk_post "$ALICE_TOKEN" "Bioluminescent jellyfish at 3am in the deep ocean is nature's own laser show. GFP (green fluorescent protein) won a Nobel Prize. The jellyfish didn't get credit. 🪼✨")
echo "post $P9 (jellyfish/rave)"

# Hacking + ocean
P10=$(mk_post "$BOB_TOKEN" "Undersea fiber optic cables carry 99% of intercontinental internet traffic. The ocean floor is the real backbone of cyberspace. Guard those cables. 🌊🔒")
echo "post $P10 (hacking/ocean)"

# ─── Comments / replies ───────────────────────────────────────────────────────
section "Comments"

reply() {
  local token="$1" parent="$2" content="$3"
  post_json "$token" "/posts" "{\"content\":$(echo "$content" | jq -Rs .),\"parent_id\":\"$parent\"}" | jq -r .id
}

reply "$BOB_TOKEN" "$P1" "No brain gang 🧠❌ — honestly the jellyfish lifestyle sounds peaceful"
reply "$CORAL_TOKEN" "$P1" "Fun fact: box jellyfish have 24 eyes. No brain but 24 eyes. Evolution is wild."

reply "$ALICE_TOKEN" "$P2" "36,000 feet of water pressure would make your bass drops hit DIFFERENT"
reply "$DEPTH_TOKEN" "$P2" "I've actually been researching underwater acoustics for a live set. Not joking."

reply "$DEPTH_TOKEN" "$P3" "This is why I use libsodium for everything. Constant-time by default."
reply "$ALICE_TOKEN" "$P3" "The timing oracle is always watching 👁️"

reply "$CORAL_TOKEN" "$P4" "52Hz whale is the loneliest whale in the ocean. Nobody else can hear its frequency. 😢"
reply "$BOB_TOKEN" "$P4" "Drop that mix link when it's ready, need new material for the submarine set"

reply "$BOB_TOKEN" "$P5" "Curve25519 is DJB's gift to humanity. Clean math, clean code."
reply "$DEPTH_TOKEN" "$P5" "The fact that the prime is so close to a power of 2 makes modular reduction insanely fast"

reply "$ALICE_TOKEN" "$P6" "Glow-in-the-dark plankton light show sounds unreal. Dinoflagellates?"
reply "$CORAL_TOKEN" "$P6" "PLUR + marine conservation = the crossover event nobody expected"

echo "All comments posted"

# ─── Reactions ─────────────────────────────────────────────────────────────────
section "Reactions (likes, yikes, emojis)"

react() {
  local token="$1" post_id="$2" emoji="$3"
  post_json "$token" "/posts/$post_id/react" "{\"kind\":\"$emoji\"}" > /dev/null
}

# Likes (👍) on various posts
react "$BOB_TOKEN" "$P1" "👍"
react "$CORAL_TOKEN" "$P1" "👍"
react "$DEPTH_TOKEN" "$P1" "👍"

react "$ALICE_TOKEN" "$P2" "👍"
react "$CORAL_TOKEN" "$P2" "👍"

react "$ALICE_TOKEN" "$P4" "👍"
react "$BOB_TOKEN" "$P4" "👍"

# Yikes (😬)
react "$DEPTH_TOKEN" "$P6" "😬"

# Fire
react "$ALICE_TOKEN" "$P3" "🔥"
react "$BOB_TOKEN" "$P3" "🔥"
react "$DEPTH_TOKEN" "$P3" "🔥"

# Brain
react "$CORAL_TOKEN" "$P5" "🧠"
react "$BOB_TOKEN" "$P5" "🧠"

# Ocean wave
react "$ALICE_TOKEN" "$P10" "🌊"
react "$CORAL_TOKEN" "$P10" "🌊"
react "$DEPTH_TOKEN" "$P10" "🌊"

# Music note
react "$ALICE_TOKEN" "$P8" "🎵"
react "$CORAL_TOKEN" "$P8" "🎵"

# Skull (impressed)
react "$BOB_TOKEN" "$P7" "💀"
react "$DEPTH_TOKEN" "$P7" "💀"

# Sparkle
react "$BOB_TOKEN" "$P9" "✨"
react "$CORAL_TOKEN" "$P9" "✨"
react "$DEPTH_TOKEN" "$P9" "✨"

echo "All reactions applied"

# ─── Chat conversations ───────────────────────────────────────────────────────
section "Create chat conversations"

CONV1=$(post_json "$ALICE_TOKEN" "/chats" "{\"participant_ids\":[\"$BOB_ID\"]}" | jq -r .id)
echo "alice <-> bob conversation: $CONV1"

CONV2=$(post_json "$CORAL_TOKEN" "/chats" "{\"participant_ids\":[\"$DEPTH_ID\"]}" | jq -r .id)
echo "coral <-> depth conversation: $CONV2"

CONV3=$(post_json "$ALICE_TOKEN" "/chats" "{\"participant_ids\":[\"$BOB_ID\",\"$CORAL_ID\",\"$DEPTH_ID\"]}" | jq -r .id)
echo "group chat (all four): $CONV3"

# ─── Verify feed ──────────────────────────────────────────────────────────────
section "Verify feed"

FEED_COUNT=$(c "$BASE/feed" -H "Authorization: Bearer $ALICE_TOKEN" | jq length)
echo "Alice's feed has $FEED_COUNT posts"

# ─── Verify reactions on a post ───────────────────────────────────────────────
section "Verify reactions on jellyfish post"

cj "$BASE/posts/$P1/reactions" -H "Authorization: Bearer $ALICE_TOKEN"

# ─── Verify replies ───────────────────────────────────────────────────────────
section "Verify replies on hacking post"

REPLY_COUNT=$(c "$BASE/posts/$P3/replies" -H "Authorization: Bearer $ALICE_TOKEN" | jq length)
echo "Hacking post has $REPLY_COUNT replies"

# ─── List conversations ───────────────────────────────────────────────────────
section "List alice's conversations"

CONV_COUNT=$(c "$BASE/chats" -H "Authorization: Bearer $ALICE_TOKEN" | jq length)
echo "Alice has $CONV_COUNT conversations"

section "All tests passed ✓"
