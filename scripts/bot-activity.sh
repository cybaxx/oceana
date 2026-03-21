#!/usr/bin/env bash
# Generate bot activity: registrations, profiles, key bundles, signed posts
# (some with images), replies, reactions (including likes/yikes), deletions,
# search, and feed verification.
set -euo pipefail

API="http://localhost:3001/api/v1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMG_DIR="$SCRIPT_DIR/images"
KEY_DIR="/tmp/oceana_bot_keys_$$"
mkdir -p "$KEY_DIR"
trap 'rm -rf "$KEY_DIR"' EXIT

# ── Helpers ──────────────────────────────────────────────────────────────────

register() {
  local username="$1" email="$2" display_name="$3"
  curl -sf "$API/auth/register" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$username\",\"email\":\"$email\",\"password\":\"password123\",\"display_name\":\"$display_name\"}" > /dev/null 2>&1 || true
}

login() {
  curl -sf "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" | jq -r '.token'
}

update_profile() {
  local token="$1" display_name="$2" bio="$3"
  curl -sf "$API/profile" -X PUT -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"display_name\":\"$display_name\",\"bio\":$(echo "$bio" | jq -Rs .)}" > /dev/null
}

# ── Ed25519 Key Management ──────────────────────────────────────────────────

generate_keys() {
  # Generate Ed25519 keypair for a bot, store in KEY_DIR/<name>.*
  local name="$1"
  openssl genpkey -algorithm Ed25519 -out "$KEY_DIR/${name}.pem" 2>/dev/null
  # Extract raw 32-byte public key (skip DER header: last 32 bytes of 44-byte DER)
  openssl pkey -in "$KEY_DIR/${name}.pem" -pubout -outform DER 2>/dev/null | tail -c 32 | base64 > "$KEY_DIR/${name}.pub"
}

upload_key_bundle() {
  local token="$1" name="$2"
  local signing_key
  signing_key=$(cat "$KEY_DIR/${name}.pub")

  # Also generate identity key + signed prekey (just reuse same key format for simplicity)
  local identity_key="$signing_key"
  local signed_prekey="$signing_key"

  curl -sf "$API/keys/bundle" -X PUT -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{
      \"identity_key\": \"$identity_key\",
      \"signed_prekey\": \"$signed_prekey\",
      \"signed_prekey_signature\": \"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\",
      \"signed_prekey_id\": 1,
      \"one_time_prekeys\": [{\"key_id\": 1, \"public_key\": \"$identity_key\"}, {\"key_id\": 2, \"public_key\": \"$identity_key\"}],
      \"signing_key\": \"$signing_key\"
    }" > /dev/null
}

sign_content() {
  # Sign content with Ed25519 private key, return base64 signature
  local name="$1" content="$2"
  printf '%s' "$content" | openssl pkeyutl -sign -inkey "$KEY_DIR/${name}.pem" 2>/dev/null | base64
}

signed_post() {
  local token="$1" name="$2" content="$3"
  local sig
  sig=$(sign_content "$name" "$content")
  curl -sf "$API/posts" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .),\"signature\":\"$sig\"}" | jq -r '.id'
}

signed_reply() {
  local token="$1" name="$2" content="$3" parent="$4"
  local sig
  sig=$(sign_content "$name" "$content")
  curl -sf "$API/posts" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .),\"parent_id\":\"$parent\",\"signature\":\"$sig\"}" | jq -r '.id'
}

react() {
  curl -sf "$API/posts/$2/react" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $1" \
    -d "{\"kind\":\"$3\"}" > /dev/null
}

unreact() {
  curl -sf "$API/posts/$2/react" -X DELETE \
    -H "Authorization: Bearer $1" > /dev/null
}

delete_post() {
  curl -sf "$API/posts/$2" -X DELETE \
    -H "Authorization: Bearer $1" > /dev/null
}

upload_local_image() {
  local token="$1" filepath="$2"
  curl -sf "$API/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@${filepath};type=image/png" | jq -r '.url'
}

search_users() {
  local token="$1" query="$2"
  local count
  count=$(curl -sf "$API/users/search?q=$query" \
    -H "Authorization: Bearer $token" | jq 'length')
  echo "  search '$query': $count result(s)"
}

check_feed() {
  local token="$1" label="$2"
  local count
  count=$(curl -sf "$API/feed" \
    -H "Authorization: Bearer $token" | jq '.data | length')
  echo "  $label feed: $count posts"
}

check_feed_page2() {
  local token="$1" cursor="$2"
  local count
  count=$(curl -sf "$API/feed?cursor=$cursor" \
    -H "Authorization: Bearer $token" | jq '.data | length')
  echo "  page 2: $count posts"
}

# ── 1. Generate test images if missing ──────────────────────────────────────

if [ ! -f "$IMG_DIR/jellyfish.png" ]; then
  echo "Generating test images..."
  bash "$IMG_DIR/generate.sh"
fi

# ── 2. Register bots (idempotent) ──────────────────────────────────────────

echo "Registering bots..."
register moonjelly "moonjelly@oceana.dev" "Moon Jelly"
register nautilus "nautilus@oceana.dev" "Nautilus"
register cuttlefish "cuttlefish@oceana.dev" "Cuttlefish"
echo "  done (skipped if already exist)"
sleep 0.3

# ── 3. Login ────────────────────────────────────────────────────────────────

echo "Logging in bots..."
ALICE=$(login alice@oceana.dev)
BOB=$(login bob@oceana.dev)
CHARLIE=$(login charlie@oceana.dev)
MOONJELLY=$(login moonjelly@oceana.dev)
NAUTILUS=$(login nautilus@oceana.dev)
CUTTLEFISH=$(login cuttlefish@oceana.dev)
echo "  all 6 logged in"
sleep 0.3

# ── 4. Generate Ed25519 keys & upload bundles ───────────────────────────────

echo "Generating Ed25519 signing keys..."
BOT_NAMES=(alice bob charlie moonjelly nautilus cuttlefish)
BOT_TOKENS=("$ALICE" "$BOB" "$CHARLIE" "$MOONJELLY" "$NAUTILUS" "$CUTTLEFISH")

for i in "${!BOT_NAMES[@]}"; do
  generate_keys "${BOT_NAMES[$i]}"
  upload_key_bundle "${BOT_TOKENS[$i]}" "${BOT_NAMES[$i]}"
done
echo "  6 key bundles uploaded (Ed25519 signing keys)"
sleep 0.3

# ── 5. Profile updates ─────────────────────────────────────────────────────

echo "Updating profiles..."
update_profile "$ALICE" "Alice" "Marine biologist. Thermocline chaser. Bioluminescence enthusiast."
update_profile "$BOB" "Bob" "Jellyfish whisperer. Deep-sea cafe regular. Anti-net activist."
update_profile "$CHARLIE" "Charlie" "Distributed systems engineer. Codes at 3000m depth. Fish-inspired algorithms."
update_profile "$MOONJELLY" "Moon Jelly" "95% water, 100% vibes. Twilight zone drifter. Whale fall philosopher."
update_profile "$NAUTILUS" "Nautilus" "450 million years old. Buoyancy computer. Living fossil, not sorry."
update_profile "$CUTTLEFISH" "Cuttlefish" "Chromatophore artist. W-shaped pupil gang. Polarized light communicator."
echo "  6 profiles updated"
sleep 0.3

# ── 6. Full follow mesh ────────────────────────────────────────────────────

echo "Building full follow mesh..."

get_user_id() {
  curl -sf "$API/users/search?q=$1" -H "Authorization: Bearer $ALICE" | jq -r '.[0].id'
}

ALICE_ID=$(get_user_id alice)
BOB_ID=$(get_user_id bob)
CHARLIE_ID=$(get_user_id charlie)
MOONJELLY_ID=$(get_user_id moonjelly)
NAUTILUS_ID=$(get_user_id nautilus)
CUTTLEFISH_ID=$(get_user_id cuttlefish)

ALL_IDS=("$ALICE_ID" "$BOB_ID" "$CHARLIE_ID" "$MOONJELLY_ID" "$NAUTILUS_ID" "$CUTTLEFISH_ID")

for i in "${!BOT_TOKENS[@]}"; do
  for j in "${!ALL_IDS[@]}"; do
    if [ "$i" != "$j" ]; then
      curl -sf "$API/users/${ALL_IDS[$j]}/follow" -X POST \
        -H "Authorization: Bearer ${BOT_TOKENS[$i]}" -H 'Content-Type: application/json' > /dev/null 2>&1 || true
    fi
  done
done
echo "  full 6x5 follow mesh created"
sleep 0.3

# ── 7. User search verification ────────────────────────────────────────────

echo "Verifying user search..."
search_users "$ALICE" "alice"
search_users "$ALICE" "nautilus"
search_users "$ALICE" "cuttlefish"
sleep 0.3

# ── 8. Upload images (local) ───────────────────────────────────────────────

echo "Uploading images..."
IMG1=$(upload_local_image "$ALICE" "$IMG_DIR/bioluminescence.png")
IMG2=$(upload_local_image "$BOB" "$IMG_DIR/jellyfish.png")
IMG3=$(upload_local_image "$NAUTILUS" "$IMG_DIR/nautilus-shell.png")
IMG4=$(upload_local_image "$CHARLIE" "$IMG_DIR/deep-sea.png")
IMG5=$(upload_local_image "$MOONJELLY" "$IMG_DIR/coral-reef.png")
IMG6=$(upload_local_image "$CUTTLEFISH" "$IMG_DIR/kelp-forest.png")
IMG7=$(upload_local_image "$ALICE" "$IMG_DIR/tide-pool.png")
IMG8=$(upload_local_image "$BOB" "$IMG_DIR/ocean-sunset.png")
echo "  8 images uploaded (local test PNGs)"
sleep 0.3

# ── 9. Signed posts (~36 total) ────────────────────────────────────────────

echo "Creating signed posts..."
ALL_POSTS=()

# Alice — 6 posts
P=$(signed_post "$ALICE" alice "the thermocline at 400m is wild today — temperature dropped 12°C in 20 meters")
ALL_POSTS+=("$P"); echo "  alice post: $P"
P=$(signed_post "$ALICE" alice "spotted something strange near the vent field [img: $IMG1]")
ALL_POSTS+=("$P"); echo "  alice post (img): $P"
P=$(signed_post "$ALICE" alice "reminder: bioluminescence is just the ocean's way of flexing on land creatures")
ALL_POSTS+=("$P"); echo "  alice post: $P"
P=$(signed_post "$ALICE" alice "## Field Notes: Hadal Zone

Pressure at 8000m is **800 atm**. Equipment failures are not *if* but *when*.

> \"The abyss doesn't stare back — it compresses you.\"

Key observations:
- Amphipod density increasing with depth
- Novel chemosynthetic bacteria at vents
- Sediment composition shifting below 7500m")
ALL_POSTS+=("$P"); echo "  alice post (markdown): $P"
P=$(signed_post "$ALICE" alice "just finished a 14-hour dive transect. the data is going to take weeks to process but the patterns we're seeing in megafauna distribution are unlike anything in the literature.

the deep ocean keeps surprising us. every dive rewrites what we thought we knew.")
ALL_POSTS+=("$P"); echo "  alice post (multi-para): $P"
P=$(signed_post "$ALICE" alice "friendly PSA: if you see a blue-ringed octopus, admire from a distance. they are beautiful and absolutely lethal")
ALL_POSTS+=("$P"); echo "  alice post: $P"
sleep 0.3

# Bob — 6 posts
P=$(signed_post "$BOB" bob "just watched a moon jelly phase through a fishing net like it was nothing [img: $IMG2]")
ALL_POSTS+=("$P"); echo "  bob post (img): $P"
P=$(signed_post "$BOB" bob "hot take: comb jellies are more elegant than true jellyfish. fight me")
ALL_POSTS+=("$P"); echo "  bob post: $P"
P=$(signed_post "$BOB" bob "the seafloor cafe finally got starlight espresso on the menu [img: $IMG8]")
ALL_POSTS+=("$P"); echo "  bob post (img): $P"
P=$(signed_post "$BOB" bob "things I learned this week:
1. Barrel jellyfish can weigh up to 35kg
2. Lion's mane tentacles stretch 30+ meters
3. Box jellies have **24 eyes**

the cnidarian world never stops delivering")
ALL_POSTS+=("$P"); echo "  bob post (list): $P"
P=$(signed_post "$BOB" bob "unpopular opinion: jellyfish blooms are just the ocean trying to tell us something and we keep ignoring the message")
ALL_POSTS+=("$P"); echo "  bob post: $P"
P=$(signed_post "$BOB" bob "dawn dive report: visibility 40m, current mild, spotted a rare \`Deepstaria enigmatica\` — the blanket jelly. footage incoming")
ALL_POSTS+=("$P"); echo "  bob post (code): $P"
sleep 0.3

# Charlie — 6 posts
P=$(signed_post "$CHARLIE" charlie "wrote a distributed consensus algorithm inspired by schooling fish. O(n log n) and zero leader election")
ALL_POSTS+=("$P"); echo "  charlie post: $P"
P=$(signed_post "$CHARLIE" charlie "if the ocean had an API it would return 200 OK but the body would be 95% salt")
ALL_POSTS+=("$P"); echo "  charlie post: $P"
P=$(signed_post "$CHARLIE" charlie "debugging a memory leak at 3000m depth. the pressure is real, literally")
ALL_POSTS+=("$P"); echo "  charlie post: $P"
P=$(signed_post "$CHARLIE" charlie "\`\`\`rust
fn ocean_pressure(depth_m: f64) -> f64 {
    1.0 + (depth_m / 10.0) // atm
}
// at 3000m that's 301 atm
// my laptop: not rated for this
\`\`\`

the code works, the hardware doesn't")
ALL_POSTS+=("$P"); echo "  charlie post (code block): $P"
P=$(signed_post "$CHARLIE" charlie "hot take: **microservices** are just digital plankton — tiny, everywhere, and the whole ecosystem collapses if they disappear [img: $IMG4]")
ALL_POSTS+=("$P"); echo "  charlie post (img): $P"
P=$(signed_post "$CHARLIE" charlie "shipped the fish-swarm consensus paper. peer review was brutal but fair. turns out the reviewers were actual fish biologists")
ALL_POSTS+=("$P"); echo "  charlie post: $P"
sleep 0.3

# Moonjelly — 6 posts
P=$(signed_post "$MOONJELLY" moonjelly "pulsing through the twilight zone rn. the deep scattering layer is beautiful tonight")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"
P=$(signed_post "$MOONJELLY" moonjelly "why do humans think we sting on purpose? we're literally 95% water just vibing")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"
P=$(signed_post "$MOONJELLY" moonjelly "drifted past a whale fall today. the circle of life hits different down here")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"
P=$(signed_post "$MOONJELLY" moonjelly "coral reef at sunset is a whole mood [img: $IMG5]")
ALL_POSTS+=("$P"); echo "  moonjelly post (img): $P"
P=$(signed_post "$MOONJELLY" moonjelly "> to drift is to trust the current

some days you just need to let go and let the ocean carry you. no direction, no destination. just *being*.

the twilight zone understands.")
ALL_POSTS+=("$P"); echo "  moonjelly post (blockquote): $P"
P=$(signed_post "$MOONJELLY" moonjelly "just vibed for 6 hours straight. personal best. the current was *perfect*")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"
sleep 0.3

# Nautilus — 6 posts
P=$(signed_post "$NAUTILUS" nautilus "450 million years and counting. your favorite species could never [img: $IMG3]")
ALL_POSTS+=("$P"); echo "  nautilus post (img): $P"
P=$(signed_post "$NAUTILUS" nautilus "the chambered shell is not just architecture — it's a buoyancy computer")
ALL_POSTS+=("$P"); echo "  nautilus post: $P"
P=$(signed_post "$NAUTILUS" nautilus "deep time perspective: the ocean was here before trees existed. respect the OG")
ALL_POSTS+=("$P"); echo "  nautilus post: $P"
P=$(signed_post "$NAUTILUS" nautilus "## Shell Chamber Mathematics

Each chamber follows a **logarithmic spiral** governed by:

r = ae^(bθ)

Where:
- *a* = initial radius
- *b* = growth factor (~0.1759)
- *θ* = angle of rotation

Nature's most elegant equation, and I wear it on my back.")
ALL_POSTS+=("$P"); echo "  nautilus post (markdown): $P"
P=$(signed_post "$NAUTILUS" nautilus "modern submarines: billions of dollars, decades of engineering

my shell: grew it myself, zero budget, perfect buoyancy for 450 million years

we are not the same")
ALL_POSTS+=("$P"); echo "  nautilus post: $P"
P=$(signed_post "$NAUTILUS" nautilus "the deep ocean is not dark. it's just lit differently. you need the right eyes — or 450 million years of evolution")
ALL_POSTS+=("$P"); echo "  nautilus post: $P"
sleep 0.3

# Cuttlefish — 6 posts
P=$(signed_post "$CUTTLEFISH" cuttlefish "just changed color 47 times in one conversation. hyperspectral communication > text")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"
P=$(signed_post "$CUTTLEFISH" cuttlefish "watching humans try to camouflage is embarrassing. you literally wear orange in the forest")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"
P=$(signed_post "$CUTTLEFISH" cuttlefish "my w-shaped pupils see polarized light. your RGB screens are cute though [img: $IMG6]")
ALL_POSTS+=("$P"); echo "  cuttlefish post (img): $P"
P=$(signed_post "$CUTTLEFISH" cuttlefish "### Chromatophore Control System

Each cell is a tiny **muscular organ** with pigment:
- \`expand()\` → color visible
- \`contract()\` → color hidden
- **Millions** of these fire in coordinated waves

I am my own display. 120fps, infinite resolution.")
ALL_POSTS+=("$P"); echo "  cuttlefish post (markdown): $P"
P=$(signed_post "$CUTTLEFISH" cuttlefish "tested a new camouflage pattern today. went checkerboard on a sandy bottom just to flex. the crabs were confused. the shrimp were impressed.")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"
P=$(signed_post "$CUTTLEFISH" cuttlefish "gentle reminder that cuttlefish have **three hearts** and **green blood**. we are literally aliens that chose to stay in the ocean")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"

TOTAL_POSTS=${#ALL_POSTS[@]}
echo "  total: $TOTAL_POSTS signed posts"
sleep 0.3

# ── 10. Signed reply threads (~25 replies, multi-level) ────────────────────

echo ""
echo "Creating signed reply threads..."

# Thread 1: thermocline discussion (4 levels deep)
R1=$(signed_reply "$BOB" bob "@alice that thermocline drop sounds brutal. the jellies were all bunched up above it" "${ALL_POSTS[0]}")
echo "  reply: bob -> alice post 0"
R2=$(signed_reply "$ALICE" alice "@bob tell me about it — saw a whole swarm just hovering at the boundary" "$R1")
echo "  reply: alice -> bob reply (level 2)"
R3=$(signed_reply "$CHARLIE" charlie "this is basically a natural load balancer. organisms clustering at the optimal layer" "$R2")
echo "  reply: charlie -> alice reply (level 3)"
R4=$(signed_reply "$MOONJELLY" moonjelly "can confirm. I was one of those jellies. the boundary layer is *chef's kiss*" "$R3")
echo "  reply: moonjelly -> charlie reply (level 4)"

# Thread 2: jelly net discussion
R5=$(signed_reply "$MOONJELLY" moonjelly "we don't phase through nets, we just don't care about your constructs" "${ALL_POSTS[6]}")
echo "  reply: moonjelly -> bob jelly post"
R6=$(signed_reply "$BOB" bob "@moonjelly okay that's even more iconic" "$R5")
echo "  reply: bob -> moonjelly reply (level 2)"
R7=$(signed_reply "$CUTTLEFISH" cuttlefish "you both need to see how I just go invisible and swim around them entirely" "$R6")
echo "  reply: cuttlefish -> bob reply (level 3)"

# Thread 3: fish algo discussion
R8=$(signed_reply "$ALICE" alice "the schooling fish algo is genius. have you tried it with bioluminescent signaling?" "${ALL_POSTS[12]}")
echo "  reply: alice -> charlie algo post"
R9=$(signed_reply "$CHARLIE" charlie "@alice yes! latency drops 40% with photonic broadcast. paper coming soon" "$R8")
echo "  reply: charlie -> alice reply (level 2)"
R10=$(signed_reply "$NAUTILUS" nautilus "I've been doing analog computation with gas exchange for 450M years. just saying" "$R9")
echo "  reply: nautilus -> charlie reply (level 3)"

# Thread 4: deep time
R11=$(signed_reply "$NAUTILUS" nautilus "trees are overrated. we had buoyancy control before they had roots" "${ALL_POSTS[32]}")
echo "  reply: nautilus -> own deep time post"
R12=$(signed_reply "$CUTTLEFISH" cuttlefish "@nautilus facts. also your shell math is peak engineering" "$R11")
echo "  reply: cuttlefish -> nautilus reply (level 2)"
R13=$(signed_reply "$ALICE" alice "the fibonacci spiral in nautilus shells is one of my favorite convergences in nature" "$R12")
echo "  reply: alice -> cuttlefish reply (level 3)"

# Thread 5: cuttlefish pupils
R14=$(signed_reply "$ALICE" alice "polarized light vision is actually insane. we should collab on a sensing project" "${ALL_POSTS[35]}")
echo "  reply: alice -> cuttlefish post"
R15=$(signed_reply "$CUTTLEFISH" cuttlefish "@alice I'm in. let's map the deep scattering layer in full spectrum" "$R14")
echo "  reply: cuttlefish -> alice reply (level 2)"
R16=$(signed_reply "$MOONJELLY" moonjelly "I volunteer as a test subject. I'm already in the scattering layer 24/7" "$R15")
echo "  reply: moonjelly -> cuttlefish reply (level 3)"

# Thread 6: ocean API joke
R17=$(signed_reply "$NAUTILUS" nautilus "the ocean's API would also have zero documentation and break every spring" "${ALL_POSTS[13]}")
echo "  reply: nautilus -> charlie API post"
R18=$(signed_reply "$BOB" bob "and the rate limiter would be tides" "$R17")
echo "  reply: bob -> nautilus reply (level 2)"
R19=$(signed_reply "$CHARLIE" charlie "accurate. also the auth token expires every lunar cycle" "$R18")
echo "  reply: charlie -> bob reply (level 3)"

# Thread 7: coral reef photo
R20=$(signed_reply "$ALICE" alice "incredible shot! what depth was this?" "${ALL_POSTS[27]}")
echo "  reply: alice -> moonjelly coral post"
R21=$(signed_reply "$MOONJELLY" moonjelly "about 15m — the light was just right at golden hour" "$R20")
echo "  reply: moonjelly -> alice reply (level 2)"

# Thread 8: cuttlefish camouflage flex
R22=$(signed_reply "$BOB" bob "the crabs were so confused" "${ALL_POSTS[34]}")
echo "  reply: bob -> cuttlefish checkerboard post"
R23=$(signed_reply "$CUTTLEFISH" cuttlefish "@bob exactly that energy. they just froze" "$R22")
echo "  reply: cuttlefish -> bob reply (level 2)"

# Thread 9: code block post
R24=$(signed_reply "$ALICE" alice "you need a pressure-rated laptop. or just compute in your head like nautilus" "${ALL_POSTS[15]}")
echo "  reply: alice -> charlie code post"
R25=$(signed_reply "$NAUTILUS" nautilus "my shell IS the computer. no fan noise, no thermal throttling" "$R24")
echo "  reply: nautilus -> alice reply (level 2)"

echo "  25 signed replies across 9 threads (up to 4 levels deep)"
sleep 0.3

# ── 11. Reactions: likes, yikes, and emoji (70+) ───────────────────────────

echo ""
echo "Adding reactions (likes, yikes, and emoji)..."

# Likes (👍) — every bot likes several posts
react "$ALICE" "${ALL_POSTS[6]}" "👍"    # bob's jelly post
react "$ALICE" "${ALL_POSTS[12]}" "👍"   # charlie's algo
react "$ALICE" "${ALL_POSTS[27]}" "👍"   # moonjelly coral
react "$ALICE" "${ALL_POSTS[30]}" "👍"   # nautilus 450m
react "$ALICE" "${ALL_POSTS[35]}" "👍"   # cuttlefish hearts
echo "  alice: 5 likes"

react "$BOB" "${ALL_POSTS[0]}" "👍"      # alice thermocline
react "$BOB" "${ALL_POSTS[2]}" "👍"      # alice bioluminescence
react "$BOB" "${ALL_POSTS[12]}" "👍"     # charlie algo
react "$BOB" "${ALL_POSTS[24]}" "👍"     # moonjelly twilight
react "$BOB" "${ALL_POSTS[33]}" "👍"     # nautilus math
echo "  bob: 5 likes"

react "$CHARLIE" "${ALL_POSTS[0]}" "👍"  # alice thermocline
react "$CHARLIE" "${ALL_POSTS[6]}" "👍"  # bob jelly
react "$CHARLIE" "${ALL_POSTS[30]}" "👍" # nautilus 450m
react "$CHARLIE" "${ALL_POSTS[35]}" "👍" # cuttlefish hearts
echo "  charlie: 4 likes"

react "$MOONJELLY" "${ALL_POSTS[2]}" "👍"   # alice bioluminescence
react "$MOONJELLY" "${ALL_POSTS[6]}" "👍"   # bob jelly
react "$MOONJELLY" "${ALL_POSTS[31]}" "👍"  # nautilus shell
react "$MOONJELLY" "${ALL_POSTS[34]}" "👍"  # cuttlefish camo
echo "  moonjelly: 4 likes"

react "$NAUTILUS" "${ALL_POSTS[0]}" "👍"    # alice thermocline
react "$NAUTILUS" "${ALL_POSTS[3]}" "👍"    # alice field notes
react "$NAUTILUS" "${ALL_POSTS[12]}" "👍"   # charlie algo
react "$NAUTILUS" "${ALL_POSTS[34]}" "👍"   # cuttlefish camo
echo "  nautilus: 4 likes"

react "$CUTTLEFISH" "${ALL_POSTS[1]}" "👍"  # alice vent
react "$CUTTLEFISH" "${ALL_POSTS[4]}" "👍"  # alice dive
react "$CUTTLEFISH" "${ALL_POSTS[12]}" "👍" # charlie algo
react "$CUTTLEFISH" "${ALL_POSTS[30]}" "👍" # nautilus 450m
echo "  cuttlefish: 4 likes"

echo "  total likes: 26"
sleep 0.3

# Yikes (😬) — used sparingly for controversial takes
react "$ALICE" "${ALL_POSTS[7]}" "😬"     # bob hot take
react "$BOB" "${ALL_POSTS[13]}" "😬"      # charlie ocean API
react "$CHARLIE" "${ALL_POSTS[10]}" "😬"  # bob unpopular opinion
react "$MOONJELLY" "${ALL_POSTS[7]}" "😬" # bob hot take
react "$NAUTILUS" "${ALL_POSTS[13]}" "😬" # charlie ocean API
react "$CUTTLEFISH" "${ALL_POSTS[7]}" "😬" # bob hot take
echo "  total yikes: 6"
sleep 0.3

# Emoji reactions — varied
react "$ALICE" "${ALL_POSTS[15]}" "💀"     # charlie code
react "$ALICE" "${ALL_POSTS[29]}" "🧠"    # nautilus lit differently
react "$ALICE" "${ALL_POSTS[34]}" "🐙"    # cuttlefish camo

react "$BOB" "${ALL_POSTS[3]}" "🧠"       # alice field notes
react "$BOB" "${ALL_POSTS[25]}" "🫧"      # moonjelly vibing
react "$BOB" "${ALL_POSTS[28]}" "🌊"      # moonjelly blockquote

react "$CHARLIE" "${ALL_POSTS[1]}" "⚡"   # alice vent
react "$CHARLIE" "${ALL_POSTS[8]}" "☕"   # bob cafe
react "$CHARLIE" "${ALL_POSTS[27]}" "🌊"  # moonjelly coral

react "$MOONJELLY" "${ALL_POSTS[0]}" "🌊"  # alice thermocline
react "$MOONJELLY" "${ALL_POSTS[15]}" "💀" # charlie code
react "$MOONJELLY" "${ALL_POSTS[35]}" "👀" # cuttlefish hearts

react "$NAUTILUS" "${ALL_POSTS[2]}" "🔥"   # alice bioluminescence
react "$NAUTILUS" "${ALL_POSTS[17]}" "🔥"  # charlie shipped
react "$NAUTILUS" "${ALL_POSTS[34]}" "🐙"  # cuttlefish camo

react "$CUTTLEFISH" "${ALL_POSTS[2]}" "💎"  # alice bioluminescence
react "$CUTTLEFISH" "${ALL_POSTS[14]}" "💀" # charlie debugging
react "$CUTTLEFISH" "${ALL_POSTS[28]}" "✨" # moonjelly blockquote
echo "  total emoji reactions: 18"

TOTAL_REACTIONS=$((26 + 6 + 18))
echo "  grand total: $TOTAL_REACTIONS reactions"
sleep 0.3

# ── 12. Reaction removal & update ──────────────────────────────────────────

echo ""
echo "Testing reaction removal and update..."
unreact "$BOB" "${ALL_POSTS[2]}"
echo "  bob unreacted from post 2"
react "$BOB" "${ALL_POSTS[2]}" "💎"
echo "  bob re-reacted with 💎"

unreact "$MOONJELLY" "${ALL_POSTS[7]}"
echo "  moonjelly unreacted yikes from post 7"
sleep 0.3

# ── 13. Post deletion ──────────────────────────────────────────────────────

echo ""
echo "Testing post deletion..."
delete_post "$ALICE" "${ALL_POSTS[5]}"
echo "  deleted alice post 5 (blue-ringed octopus PSA)"
delete_post "$BOB" "${ALL_POSTS[10]}"
echo "  deleted bob post 10 (unpopular opinion)"
sleep 0.3

# ── 14. Feed verification ──────────────────────────────────────────────────

echo ""
echo "Verifying feeds..."
check_feed "$ALICE" "alice"
check_feed "$BOB" "bob"
check_feed "$CHARLIE" "charlie"

echo "  testing pagination..."
FEED_JSON=$(curl -sf "$API/feed" -H "Authorization: Bearer $ALICE")
CURSOR=$(echo "$FEED_JSON" | jq -r '.next_cursor // empty')
if [ -n "$CURSOR" ]; then
  check_feed_page2 "$ALICE" "$CURSOR"
else
  echo "  no page 2 (all posts fit in one page)"
fi
sleep 0.3

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "Bot activity complete!"
echo "   3 registrations (idempotent)"
echo "   6 Ed25519 key bundles uploaded"
echo "   6 profile updates"
echo "   30 follows (full mesh)"
echo "   3 user searches"
echo "   8 local images uploaded"
echo "   $TOTAL_POSTS signed posts (8 with images, markdown, code blocks, multi-paragraph)"
echo "   25 signed replies (9 threads, up to 4 levels deep)"
echo "   $TOTAL_REACTIONS reactions (26 likes, 6 yikes, 18 emoji)"
echo "   2 reaction removals, 1 re-reaction"
echo "   2 post deletions"
echo "   feed verification with pagination"
