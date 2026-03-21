#!/usr/bin/env bash
# Simulate realistic chat conversations between bot accounts
# Requires: websocat, jq, curl, server on localhost:3001
set -euo pipefail

API="http://localhost:3001/api/v1"

ALICE_ID="00000000-0000-0000-0000-000000000001"
BOB_ID="00000000-0000-0000-0000-000000000002"
CHARLIE_ID="00000000-0000-0000-0000-000000000003"

login() {
  curl -sf "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" | jq -r '.token'
}

upload_image() {
  local token="$1" url="$2" ext="$3"
  local tmpfile="/tmp/oceana_conv_img_$$.${ext}"
  curl -sf -L "$url" -o "$tmpfile"
  local img_url
  img_url=$(curl -sf "$API/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@${tmpfile};type=image/${ext}" | jq -r '.url')
  rm -f "$tmpfile"
  echo "$img_url"
}

create_conv() {
  local token="$1" participants="$2"
  curl -sf "$API/chats" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"participant_ids\":$participants}" | jq -r '.id'
}

send_msg() {
  local token="$1" conv_id="$2" content="$3" image_url="${4:-}"
  local ticket
  ticket=$(curl -sf "$API/ws/ticket" -X POST \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' | jq -r '.ticket')

  local payload
  if [ -n "$image_url" ]; then
    payload=$(jq -nc --arg cid "$conv_id" --arg c "$content" --arg img "$image_url" \
      '{type:"send_message",conversation_id:$cid,content:$c,image_url:$img}')
  else
    payload=$(jq -nc --arg cid "$conv_id" --arg c "$content" \
      '{type:"send_message",conversation_id:$cid,content:$c}')
  fi

  echo "$payload" | websocat -n1 "ws://localhost:3001/api/v1/ws?ticket=$ticket"
  sleep 0.5
}

# --- Login ---
echo "Logging in bots..."
ALICE=$(login alice@oceana.dev)
BOB=$(login bob@oceana.dev)
CHARLIE=$(login charlie@oceana.dev)

# --- Upload images ---
echo "Uploading images..."
IMG_JELLY=$(upload_image "$ALICE" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Jellyfish_in_Kamo_Aquarium_3.jpg/320px-Jellyfish_in_Kamo_Aquarium_3.jpg" "jpeg")
echo "  jellyfish: $IMG_JELLY"
IMG_OCEAN=$(upload_image "$BOB" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Large_Scaled_Scorpionfish.jpg/320px-Large_Scaled_Scorpionfish.jpg" "jpeg")
echo "  ocean: $IMG_OCEAN"
IMG_NAUTILUS=$(upload_image "$CHARLIE" "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Nautilus_pompilius_%28shell%29.jpg/320px-Nautilus_pompilius_%28shell%29.jpg" "jpeg")
echo "  nautilus: $IMG_NAUTILUS"

# ============================================================
# Conv 1: Alice <-> Bob — "Deep Sea & Jellyfish"
# ============================================================
echo ""
echo "Creating Conv 1: Alice <-> Bob — Deep Sea & Jellyfish"
CONV1=$(create_conv "$ALICE" "[\"$BOB_ID\"]")
echo "  conv_id: $CONV1"

send_msg "$ALICE" "$CONV1" "hey bob! did you see that new paper on deep-sea jellyfish bioluminescence? absolutely wild stuff 🪼"
echo "  [alice] msg 1"

send_msg "$BOB" "$CONV1" "YES. the part about *Atolla wyvillei* using bioluminescent burglar alarms?? like they literally scream in light to attract bigger predators to eat whatever is attacking them"
echo "  [bob] msg 2"

send_msg "$ALICE" "$CONV1" "exactly! here's the thing that blows my mind:

> Most deep-sea jellyfish produce light in the **blue-green spectrum** (470-490nm) because it travels furthest through seawater

nature is an optical engineer" "$IMG_JELLY"
echo "  [alice] msg 3 (with image)"

send_msg "$BOB" "$CONV1" "that photo is gorgeous. reminds me of the ones we saw at 800m on the last dive

fun fact: **95%** of deep-sea creatures produce bioluminescence. the dark ocean is actually *full* of light"
echo "  [bob] msg 4"

send_msg "$ALICE" "$CONV1" "the craziest part is the counter-illumination strategy. some jellyfish match the **exact intensity** of downwelling light from above so predators looking up can't see their silhouette"
echo "  [alice] msg 5"

send_msg "$BOB" "$CONV1" "stealth jellies 😎 they've been doing active camouflage for 500 million years while humans are still figuring out RGB LEDs

also have you read about the *Crossota millsae*? blood-red medusa found near hydrothermal vents" "$IMG_OCEAN"
echo "  [bob] msg 6 (with image)"

send_msg "$ALICE" "$CONV1" "oh yeah the blood-belly comb jelly! it's red specifically because **red light doesn't penetrate** deep water — so it's effectively invisible down there

the ocean is basically running its own encryption layer lol"
echo "  [alice] msg 7"

send_msg "$BOB" "$CONV1" "lmao ocean-layer encryption 💀 charlie would appreciate that one

we should plan a deep bioluminescence survey. i want to map the light signatures across the mesopelagic zone"
echo "  [bob] msg 8"

# ============================================================
# Conv 2: Alice <-> Charlie — "Crypto & Hacking"
# ============================================================
echo ""
echo "Creating Conv 2: Alice <-> Charlie — Crypto & Hacking"
CONV2=$(create_conv "$ALICE" "[\"$CHARLIE_ID\"]")
echo "  conv_id: $CONV2"

send_msg "$ALICE" "$CONV2" 'yo charlie, been reading about the Signal protocol internals. the double ratchet is such elegant engineering'
echo "  [alice] msg 1"

send_msg "$CHARLIE" "$CONV2" 'oh for sure. the beauty is in how it combines the **Diffie-Hellman ratchet** with a symmetric-key ratchet. forward secrecy AND break-in recovery in one mechanism

the X3DH handshake is wild too — three DH computations just to establish the initial shared secret'
echo "  [charlie] msg 2"

send_msg "$ALICE" "$CONV2" 'right! I was implementing a simplified version in Rust. check this out:

```rust
fn ratchet_step(state: &mut RatchetState, header: &Header) -> MessageKey {
    let dh_output = x25519(state.dh_private, header.dh_public);
    let (root_key, chain_key) = kdf_rk(&state.root_key, &dh_output);
    state.root_key = root_key;
    state.dh_private = generate_keypair();
    derive_message_key(&chain_key)
}
```

each message gets a unique key and you literally **cannot** derive past keys from the current state'
echo "  [alice] msg 3"

send_msg "$CHARLIE" "$CONV2" 'clean implementation 👌 one thing to watch out for: you need to handle **out-of-order messages** by caching skipped message keys

I hit that bug during a CTF last month. the challenge had a custom E2EE protocol that didnt handle reordering and you could replay messages to leak plaintext'
echo "  [charlie] msg 4"

send_msg "$ALICE" "$CONV2" 'oh nice catch. speaking of CTFs — did you do the CryptoHack challenges? the one on elliptic curve math was 🔥

```python
# Pohlig-Hellman attack on weak EC group order
from sage.all import *
E = EllipticCurve(GF(p), [a, b])
G = E(gx, gy)
factors = factor(G.order())
# solve DLP in each small subgroup, then CRT
```'
echo "  [alice] msg 5"

send_msg "$CHARLIE" "$CONV2" 'yeah the Pohlig-Hellman one was great. I also liked the padding oracle challenge — classic but they added a twist with a timing side-channel

real talk though: most \"encrypted\" apps people use are just TLS to the server where everything sits in plaintext. actual E2EE is rare

relevant: https://en.wikipedia.org/wiki/End-to-end_encryption'
echo "  [charlie] msg 6"

send_msg "$ALICE" "$CONV2" "that's why I love what we're building here. proper Signal-style E2EE with safety numbers and everything

btw have you looked at post-quantum key exchange? NIST just standardized ML-KEM (Kyber) and Signal already shipped PQXDH"
echo "  [alice] msg 7"

send_msg "$CHARLIE" "$CONV2" 'yeah PQXDH is smart — hybrid approach so you get quantum resistance without losing classical security guarantees if the PQ part breaks

```typescript
// hybrid KEM: classical X25519 + post-quantum ML-KEM-768
const ss = concat(
  x25519_shared_secret,
  ml_kem_shared_secret
);
const key = hkdf(ss, salt, info);
```

belt AND suspenders 🔐'
echo "  [charlie] msg 8"

# ============================================================
# Conv 3: Bob <-> Charlie — "Music, Festivals & Alt Culture"
# ============================================================
echo ""
echo "Creating Conv 3: Bob <-> Charlie — Music, Festivals & Alt Culture"
CONV3=$(create_conv "$BOB" "[\"$CHARLIE_ID\"]")
echo "  conv_id: $CONV3"

send_msg "$BOB" "$CONV3" "charlie have you heard the new Aphex Twin stuff?? apparently he dropped unreleased tracks on SoundCloud again under a random alias 🎵"
echo "  [bob] msg 1"

send_msg "$CHARLIE" "$CONV3" "wait WHAT. every time lmao. that man has like 12 aliases and just casually drops masterpieces on free platforms

reminds me of when Burial released Untrue and nobody knew who he was for years 👻"
echo "  [charlie] msg 2"

send_msg "$BOB" "$CONV3" "Burial is a legend. that vinyl crackle + garage bass combo is still unmatched. perfect music for 3am walks through empty streets

speaking of which — you going to any festivals this summer? I heard Unsound in Kraków is doing an underwater acoustics stage 🌊"
echo "  [bob] msg 3"

send_msg "$CHARLIE" "$CONV3" "UNSOUND. yes absolutely. their lineup last year was insane — Objekt, SHXCXCHCXSH, Demdike Stare

the underwater acoustics thing is so on brand for us lol. sound propagation in water is wild — the SOFAR channel can carry whale songs thousands of km"
echo "  [charlie] msg 4"

send_msg "$BOB" "$CONV3" "yooo imagine a sound system that uses the SOFAR channel 😂 bass drops heard across the Atlantic

but fr, the DIY sound system culture is incredible. those crews building custom rigs in warehouses with insane attention to acoustic engineering"
echo "  [bob] msg 5"

send_msg "$CHARLIE" "$CONV3" "the crossover between sound engineering and hacking culture is real. half the people at CCC congress are also into modular synths

check this set btw: https://www.youtube.com/watch?v=dQw4w9WgXcQ — not the title you'd expect but the sound design is next level"
echo "  [charlie] msg 6"

send_msg "$BOB" "$CONV3" "💀💀💀 I will neither confirm nor deny clicking that link

but real rec: Autechre's NTS Sessions. 8 hours of generative electronic music. they literally coded custom Max/MSP patches that compose in real-time

also this: https://www.youtube.com/watch?v=SoNgMaHF3bY — Amon Tobin ISAM live. the projection mapping is 🤯"
echo "  [bob] msg 7"

send_msg "$CHARLIE" "$CONV3" "Autechre NTS Sessions is a masterwork. pure algorithmic art. the elseq series too

you know what I love about this scene? it's one of the few places where tech people and artists genuinely overlap without it being cringe. no \"disruption\" no \"web3 music NFTs\" just people making weird beautiful things with computers 🖤"
echo "  [charlie] msg 8"

# ============================================================
# Conv 4: Alice + Bob + Charlie (group) — "Ocean Tech Collective"
# ============================================================
echo ""
echo "Creating Conv 4: Group — Ocean Tech Collective"
CONV4=$(create_conv "$ALICE" "[\"$BOB_ID\",\"$CHARLIE_ID\"]")
echo "  conv_id: $CONV4"

send_msg "$ALICE" "$CONV4" "ok team, I've been thinking about our ocean monitoring project. what if we use **bio-inspired algorithms** for the sensor network?

# Proposal: Swarm-Based Ocean Monitoring

- Distributed sensor nodes that self-organize like a school of fish
- No central coordinator — emergent behavior handles routing
- Fault-tolerant by design (lose a node, the swarm adapts)"
echo "  [alice] msg 1"

send_msg "$BOB" "$CONV4" "I love this. the jellyfish angle is obvious for me — they drift with currents but maintain formation through simple chemical signaling

we could model our inter-node communication on that:
- **Broadcast**: low-power omnidirectional (like bioluminescence)
- **Directed**: high-power point-to-point (like the SOFAR channel)
- **Passive**: piggyback on ambient ocean noise"
echo "  [bob] msg 2"

send_msg "$CHARLIE" "$CONV4" "the distributed consensus part is my jam. here's a rough sketch:

\`\`\`rust
struct SensorNode {
    id: NodeId,
    position: GeoCoord,
    neighbors: Vec<NodeId>,
    readings: VecDeque<OceanReading>,
}

impl SensorNode {
    fn propagate(&self, reading: OceanReading) -> Vec<Message> {
        // gossip protocol: forward to k random neighbors
        self.neighbors.choose_multiple(&mut rng(), K)
            .map(|n| Message::new(*n, reading.clone()))
            .collect()
    }
}
\`\`\`

gossip protocols are perfect for unreliable underwater links"
echo "  [charlie] msg 3"

send_msg "$ALICE" "$CONV4" "nice! for the actual sensing layer, I'm thinking we monitor:

1. **Temperature** — thermocline mapping
2. **Salinity** — current tracking
3. **Bioluminescence** — biological activity proxy
4. **Acoustic** — marine mammal detection + ambient noise
5. **Pressure** — depth/wave patterns

the bioluminescence sensor is the coolest — we can detect plankton blooms in real-time" "$IMG_NAUTILUS"
echo "  [alice] msg 4 (with image)"

send_msg "$BOB" "$CONV4" "the acoustic sensor is key. underwater sound travels at ~1500 m/s and we can use it for both **communication** and **sensing**

here's the fun part: whale songs can tell us about ocean temperature because sound speed varies with temp

> *Sound speed in seawater: c = 1449.2 + 4.6T - 0.055T² + 0.00029T³ + (1.34 - 0.01T)(S - 35) + 0.016z*

where T=temperature, S=salinity, z=depth"
echo "  [bob] msg 5"

send_msg "$CHARLIE" "$CONV4" "we should also think about the data pipeline. sensor readings need to get from underwater nodes to shore somehow

\`\`\`python
# acoustic modem data pipeline
class UnderwaterGateway:
    def __init__(self, freq_khz=12, bandwidth_khz=4):
        self.modem = AcousticModem(freq_khz, bandwidth_khz)
        self.buffer = PriorityQueue()  # urgent readings first

    async def relay_to_surface(self):
        while True:
            reading = await self.buffer.get()
            # compress + FEC encode for noisy channel
            encoded = reed_solomon_encode(compress(reading))
            await self.modem.transmit(encoded)
\`\`\`

acoustic modems are slow (~1 kbps) so we need smart compression"
echo "  [charlie] msg 6"

send_msg "$ALICE" "$CONV4" "great point on bandwidth. we could use **delta encoding** — only transmit changes from baseline readings. for a stable ocean column, that could cut data by 90%

also thinking about power: what about harvesting energy from ocean thermal gradients? the temperature difference between surface and deep water is basically a free battery"
echo "  [alice] msg 7"

send_msg "$BOB" "$CONV4" "ocean thermal energy conversion! there's a research station in Hawaii that actually does this. the temp gradient between surface (25°C) and 1000m depth (4°C) drives a heat engine

for our sensor nodes we probably want a hybrid approach:
- Solar for surface/shallow nodes ☀️
- Thermal gradient for mid-depth 🌡️
- Long-life batteries for deep nodes 🔋

the deep nodes could also harvest energy from hydrothermal vents if they're near a ridge"
echo "  [bob] msg 8"

send_msg "$CHARLIE" "$CONV4" "the whole system should be **self-healing** too. if a node fails, its neighbors redistribute coverage:

\`\`\`rust
fn handle_node_failure(swarm: &mut Swarm, failed: NodeId) {
    let neighbors = swarm.get_neighbors(failed);
    let orphaned_area = swarm.coverage_area(failed);

    for neighbor in neighbors {
        let new_pos = neighbor.position.move_toward(
            orphaned_area.centroid(),
            MAX_ADJUSTMENT_DISTANCE,
        );
        swarm.reposition(neighbor.id, new_pos);
    }

    swarm.recalculate_routes();
    log::info!(\"swarm adapted to loss of node {failed}\");
}
\`\`\`

nature handles this perfectly — coral reefs, ant colonies, neural networks. all self-repairing"
echo "  [charlie] msg 9"

send_msg "$ALICE" "$CONV4" "this is coming together beautifully. let's set up a repo and start prototyping

## Next Steps
- [ ] Charlie: scaffold the gossip protocol + node simulation
- [ ] Bob: spec out the acoustic sensor array + SOFAR experiments
- [ ] Alice: build the bioluminescence detection pipeline
- [ ] All: meet next week to integrate

the ocean has been running distributed systems for 3.5 billion years — time we learned from the best 🌊🧬"
echo "  [alice] msg 10"

echo ""
echo "✅ Bot conversations complete!"
echo "   4 conversations created"
echo "   34 messages sent"
echo "   3 images uploaded"
echo "   Topics: ocean biology, cryptography, music culture, ocean tech"
