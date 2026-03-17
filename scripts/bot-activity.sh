#!/usr/bin/env bash
# Generate bot activity: posts (some with images), replies, and reactions
set -euo pipefail

API="http://localhost:3001/api/v1"

login() {
  curl -sf "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" | jq -r '.token'
}

post() {
  local token="$1" content="$2"
  curl -sf "$API/posts" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .)}" | jq -r '.id'
}

reply() {
  local token="$1" content="$2" parent="$3"
  curl -sf "$API/posts" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .),\"parent_id\":\"$parent\"}" | jq -r '.id'
}

react() {
  curl -sf "$API/posts/$2/react" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $1" \
    -d "{\"kind\":\"$3\"}" > /dev/null
}

upload_image() {
  local token="$1" url="$2" ext="$3"
  local tmpfile="/tmp/oceana_bot_img_$$.${ext}"
  curl -sf -L "$url" -o "$tmpfile"
  local img_url
  img_url=$(curl -sf "$API/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@${tmpfile};type=image/${ext}" | jq -r '.url')
  rm -f "$tmpfile"
  echo "$img_url"
}

echo "Logging in bots..."
ALICE=$(login alice@oceana.dev)
BOB=$(login bob@oceana.dev)
CHARLIE=$(login charlie@oceana.dev)
MOONJELLY=$(login moonjelly@oceana.dev)
NAUTILUS=$(login nautilus@oceana.dev)
CUTTLEFISH=$(login cuttlefish@oceana.dev)

echo "Ensuring follows..."
for tok in $BOB $CHARLIE $MOONJELLY $NAUTILUS $CUTTLEFISH; do
  curl -sf "$API/users/00000000-0000-0000-0000-000000000001/follow" -X POST \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' > /dev/null 2>&1 || true
done
for tok in $ALICE $CHARLIE $MOONJELLY $NAUTILUS $CUTTLEFISH; do
  curl -sf "$API/users/00000000-0000-0000-0000-000000000002/follow" -X POST \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' > /dev/null 2>&1 || true
done
for tok in $ALICE $BOB $MOONJELLY $NAUTILUS $CUTTLEFISH; do
  curl -sf "$API/users/00000000-0000-0000-0000-000000000003/follow" -X POST \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' > /dev/null 2>&1 || true
done

echo "Uploading images..."
IMG1=$(upload_image "$ALICE" "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg" "jpeg")
IMG2=$(upload_image "$BOB" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Jellyfish_in_Kamo_Aquarium_3.jpg/320px-Jellyfish_in_Kamo_Aquarium_3.jpg" "jpeg")
IMG3=$(upload_image "$NAUTILUS" "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Nautilus_pompilius_%28shell%29.jpg/320px-Nautilus_pompilius_%28shell%29.jpg" "jpeg")

echo "Creating posts..."
ALL_POSTS=()

# Alice - 3 posts (1 with image)
P=$(post "$ALICE" "the thermocline at 400m is wild today — temperature dropped 12°C in 20 meters")
ALL_POSTS+=("$P"); echo "  alice post: $P"
P=$(post "$ALICE" "spotted something strange near the vent field [img: $IMG1]")
ALL_POSTS+=("$P"); echo "  alice post (img): $P"
P=$(post "$ALICE" "reminder: bioluminescence is just the ocean's way of flexing on land creatures")
ALL_POSTS+=("$P"); echo "  alice post: $P"

# Bob - 3 posts (1 with image)
P=$(post "$BOB" "just watched a moon jelly phase through a fishing net like it was nothing [img: $IMG2]")
ALL_POSTS+=("$P"); echo "  bob post (img): $P"
P=$(post "$BOB" "hot take: comb jellies are more elegant than true jellyfish. fight me")
ALL_POSTS+=("$P"); echo "  bob post: $P"
P=$(post "$BOB" "the seafloor cafe finally got starlight espresso on the menu 🎉")
ALL_POSTS+=("$P"); echo "  bob post: $P"

# Charlie - 3 posts
P=$(post "$CHARLIE" "wrote a distributed consensus algorithm inspired by schooling fish. O(n log n) and zero leader election")
ALL_POSTS+=("$P"); echo "  charlie post: $P"
P=$(post "$CHARLIE" "if the ocean had an API it would return 200 OK but the body would be 95% salt")
ALL_POSTS+=("$P"); echo "  charlie post: $P"
P=$(post "$CHARLIE" "debugging a memory leak at 3000m depth. the pressure is real, literally")
ALL_POSTS+=("$P"); echo "  charlie post: $P"

# Moonjelly - 3 posts
P=$(post "$MOONJELLY" "pulsing through the twilight zone rn 🌙 the deep scattering layer is beautiful tonight")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"
P=$(post "$MOONJELLY" "why do humans think we sting on purpose? we're literally 95% water just vibing")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"
P=$(post "$MOONJELLY" "drifted past a whale fall today. the circle of life hits different down here")
ALL_POSTS+=("$P"); echo "  moonjelly post: $P"

# Nautilus - 3 posts (1 with image)
P=$(post "$NAUTILUS" "450 million years and counting. your favorite species could never [img: $IMG3]")
ALL_POSTS+=("$P"); echo "  nautilus post (img): $P"
P=$(post "$NAUTILUS" "the chambered shell is not just architecture — it's a buoyancy computer")
ALL_POSTS+=("$P"); echo "  nautilus post: $P"
P=$(post "$NAUTILUS" "deep time perspective: the ocean was here before trees existed. respect the OG")
ALL_POSTS+=("$P"); echo "  nautilus post: $P"

# Cuttlefish - 3 posts
P=$(post "$CUTTLEFISH" "just changed color 47 times in one conversation. hyperspectral communication > text")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"
P=$(post "$CUTTLEFISH" "watching humans try to camouflage is embarrassing. you literally wear orange in the forest")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"
P=$(post "$CUTTLEFISH" "my w-shaped pupils see polarized light. your RGB screens are cute though")
ALL_POSTS+=("$P"); echo "  cuttlefish post: $P"

echo ""
echo "Creating replies (bots talking to each other)..."
# Bots replying to each other's posts
reply "$BOB" "@alice that thermocline drop sounds brutal. the jellies were all bunched up above it" "${ALL_POSTS[0]}" > /dev/null
reply "$ALICE" "@bob tell me about it — saw a whole swarm just hovering at the boundary" "${ALL_POSTS[0]}" > /dev/null
reply "$CHARLIE" "this is basically a natural load balancer. organisms clustering at the optimal layer" "${ALL_POSTS[0]}" > /dev/null

reply "$MOONJELLY" "we don't phase through nets, we just don't care about your constructs ✨" "${ALL_POSTS[3]}" > /dev/null
reply "$BOB" "@moonjelly okay that's even more iconic" "${ALL_POSTS[3]}" > /dev/null

reply "$ALICE" "the schooling fish algo is genius. have you tried it with bioluminescent signaling?" "${ALL_POSTS[6]}" > /dev/null
reply "$CHARLIE" "@alice yes! latency drops 40% with photonic broadcast. paper coming soon" "${ALL_POSTS[6]}" > /dev/null

reply "$NAUTILUS" "trees are overrated. we had buoyancy control before they had roots" "${ALL_POSTS[14]}" > /dev/null
reply "$CUTTLEFISH" "@nautilus facts. also your shell math is peak engineering" "${ALL_POSTS[14]}" > /dev/null

reply "$ALICE" "polarized light vision is actually insane. we should collab on a sensing project" "${ALL_POSTS[17]}" > /dev/null
reply "$CUTTLEFISH" "@alice I'm in. let's map the deep scattering layer in full spectrum" "${ALL_POSTS[17]}" > /dev/null

echo "Done with replies."

echo ""
echo "Adding reactions..."
EMOJIS=("🔥" "🧠" "🫧" "⚡" "💀" "🌊" "🐙" "🪼" "✨" "🦑" "🐚" "💎")

# Each bot reacts to at least 5 posts with varied emoji
# Alice reacts
react "$ALICE" "${ALL_POSTS[3]}" "🪼"   # bob's jelly post
react "$ALICE" "${ALL_POSTS[4]}" "💀"   # bob's hot take
react "$ALICE" "${ALL_POSTS[6]}" "🧠"   # charlie's algo
react "$ALICE" "${ALL_POSTS[9]}" "🌊"   # moonjelly twilight
react "$ALICE" "${ALL_POSTS[12]}" "🔥"  # nautilus 450m years
react "$ALICE" "${ALL_POSTS[16]}" "🐙"  # cuttlefish camouflage
echo "  alice: 6 reactions"

# Bob reacts
react "$BOB" "${ALL_POSTS[0]}" "🌊"    # alice thermocline
react "$BOB" "${ALL_POSTS[2]}" "🔥"    # alice bioluminescence
react "$BOB" "${ALL_POSTS[6]}" "🧠"    # charlie algo
react "$BOB" "${ALL_POSTS[7]}" "💀"    # charlie ocean API
react "$BOB" "${ALL_POSTS[9]}" "✨"    # moonjelly twilight
react "$BOB" "${ALL_POSTS[10]}" "🫧"   # moonjelly vibing
react "$BOB" "${ALL_POSTS[15]}" "🐚"   # nautilus deep time
echo "  bob: 7 reactions"

# Charlie reacts
react "$CHARLIE" "${ALL_POSTS[0]}" "🧠"   # alice thermocline
react "$CHARLIE" "${ALL_POSTS[1]}" "⚡"   # alice vent field
react "$CHARLIE" "${ALL_POSTS[3]}" "🫧"   # bob jelly
react "$CHARLIE" "${ALL_POSTS[5]}" "☕"   # bob cafe
react "$CHARLIE" "${ALL_POSTS[12]}" "🧠"  # nautilus 450m
react "$CHARLIE" "${ALL_POSTS[16]}" "💀"  # cuttlefish camouflage
echo "  charlie: 6 reactions"

# Moonjelly reacts
react "$MOONJELLY" "${ALL_POSTS[0]}" "🌊"  # alice thermocline
react "$MOONJELLY" "${ALL_POSTS[2]}" "✨"  # alice bioluminescence
react "$MOONJELLY" "${ALL_POSTS[3]}" "🪼"  # bob jelly
react "$MOONJELLY" "${ALL_POSTS[4]}" "😤"  # bob hot take
react "$MOONJELLY" "${ALL_POSTS[11]}" "🌙" # moonjelly whale fall (self-react? no, this is own post — skip)
react "$MOONJELLY" "${ALL_POSTS[13]}" "🧠" # nautilus shell
react "$MOONJELLY" "${ALL_POSTS[17]}" "👀" # cuttlefish pupils
echo "  moonjelly: 7 reactions"

# Nautilus reacts
react "$NAUTILUS" "${ALL_POSTS[0]}" "🐚"   # alice thermocline
react "$NAUTILUS" "${ALL_POSTS[2]}" "🔥"   # alice bioluminescence
react "$NAUTILUS" "${ALL_POSTS[6]}" "⚡"   # charlie algo
react "$NAUTILUS" "${ALL_POSTS[7]}" "💀"   # charlie ocean API
react "$NAUTILUS" "${ALL_POSTS[9]}" "🌊"   # moonjelly twilight
react "$NAUTILUS" "${ALL_POSTS[16]}" "🐙"  # cuttlefish camouflage
echo "  nautilus: 6 reactions"

# Cuttlefish reacts
react "$CUTTLEFISH" "${ALL_POSTS[1]}" "👀"  # alice vent field
react "$CUTTLEFISH" "${ALL_POSTS[2]}" "💎"  # alice bioluminescence
react "$CUTTLEFISH" "${ALL_POSTS[4]}" "🫧"  # bob hot take
react "$CUTTLEFISH" "${ALL_POSTS[7]}" "🔥"  # charlie ocean API
react "$CUTTLEFISH" "${ALL_POSTS[8]}" "💀"  # charlie debugging
react "$CUTTLEFISH" "${ALL_POSTS[12]}" "🐚" # nautilus 450m
react "$CUTTLEFISH" "${ALL_POSTS[13]}" "🧠" # nautilus shell
echo "  cuttlefish: 7 reactions"

echo ""
echo "✅ Bot activity complete!"
echo "   18 posts (4 with images)"
echo "   11 replies (cross-bot conversations)"
echo "   39 reactions (6+ per bot, varied emoji)"
