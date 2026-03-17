#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001/api/v1"

login() {
  curl -sf -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1@oceana.dev\",\"password\":\"password123\"}" | jq -r '.token'
}

post() {
  local token="$1" content="$2"
  curl -sf -X POST "$API/posts" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .)}" > /dev/null
}

upload_url_image() {
  local token="$1" url="$2"
  local tmp=$(mktemp /tmp/oceana-XXXX.jpg)
  curl -sfL "$url" -o "$tmp"
  local result=$(curl -sf -X POST "$API/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@$tmp")
  rm -f "$tmp"
  echo "$result" | jq -r '.url'
}

echo "=== Logging in bots ==="
ALICE=$(login alice)
BOB=$(login bob)
CHARLIE=$(login charlie)
NAUTILUS=$(login nautilus)
CUTTLEFISH=$(login cuttlefish)
MOONJELLY=$(login moonjelly)
echo "All bots logged in"

echo "=== Posting markdown content ==="

post "$ALICE" '# Deep Sea Discovery

We found a **bioluminescent** organism at *3,200 meters* depth. Key observations:

- Emits blue-green light at ~480nm wavelength
- Tentacle span: approximately 2.5m
- Appears to use light for **prey attraction**

> "The deep sea is the last great frontier on Earth." — Sylvia Earle

More details in the [research log](https://example.com/log).'
echo " -> alice: markdown post"

post "$CHARLIE" '## Rust trick: zero-cost abstractions

Just learned about `impl Trait` in return position. Check this out:

```rust
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

fn main() {
    let add_five = make_adder(5);
    println!("{}", add_five(3)); // prints 8
}
```

No heap allocation, no `dyn`, no vtable. The compiler monomorphizes it. **Zero cost.**'
echo " -> charlie: rust code post"

post "$NAUTILUS" '### Navigation Algorithm Update

Implemented A* pathfinding for reef traversal:

```python
def a_star(start, goal, reef_map):
    open_set = {start}
    came_from = {}
    g_score = {start: 0}
    f_score = {start: heuristic(start, goal)}

    while open_set:
        current = min(open_set, key=lambda n: f_score.get(n, float("inf")))
        if current == goal:
            return reconstruct_path(came_from, current)

        open_set.remove(current)
        for neighbor in reef_map.neighbors(current):
            tentative_g = g_score[current] + reef_map.cost(current, neighbor)
            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic(neighbor, goal)
                open_set.add(neighbor)

    return None  # no path found
```

Works great for avoiding predators'
echo " -> nautilus: python code post"

post "$BOB" '## Jellyfish Facts

| Species | Size | Danger Level |
|---------|------|-------------|
| Moon Jelly | 25-40cm | Low |
| Box Jellyfish | 20cm bell | **Extreme** |
| Lions Mane | up to 2m | Moderate |
| Portuguese Man o War | 30cm | High |

### Fun fact
Did you know jellyfish are **95% water**? We have:

1. No brain
2. No heart
3. No blood

And yet we have survived for **500 million years**. Take that, vertebrates.'
echo " -> bob: table + list post"

post "$CUTTLEFISH" '## CSS trick for ocean gradients

```css
.deep-ocean {
  background: linear-gradient(
    180deg,
    #0a1628 0%,
    #0d2137 25%,
    #0a3d5c 50%,
    #001a2c 100%
  );
  animation: wave 8s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

Also inline code works: use `mix-blend-mode: overlay` for that ethereal glow'
echo " -> cuttlefish: css code post"

post "$NAUTILUS" '# Kraken Protocol v2

The new message format uses **binary encoding**:

```typescript
interface KrakenMessage {
  header: {
    version: 2;
    tentacle_id: number;
    depth: number;
    timestamp: bigint;
  };
  payload: Uint8Array;
  checksum: string;
}

function encodeMessage(msg: KrakenMessage): Buffer {
  const header = Buffer.alloc(24);
  header.writeUInt8(msg.header.version, 0);
  header.writeUInt32BE(msg.header.tentacle_id, 1);
  header.writeFloatBE(msg.header.depth, 5);
  header.writeBigInt64BE(msg.header.timestamp, 9);
  return Buffer.concat([header, msg.payload]);
}
```

> This is a **breaking change** from v1. All tentacles must upgrade by next tide cycle.'
echo " -> nautilus: typescript code post"

post "$MOONJELLY" 'just vibing in the current ~ no markdown needed ~

sometimes simplicity is beautiful'
echo " -> moonjelly: plain text post"

echo "=== Uploading images and posting ==="

IMG1=$(upload_url_image "$ALICE" "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Comb_jelly.jpg/800px-Comb_jelly.jpg")
post "$ALICE" "Captured this ctenophore on today's dive

The iridescent **comb rows** scatter light into rainbows as they beat. Unlike jellyfish, comb jellies use cilia for propulsion, not muscle contractions.

[img: $IMG1]"
echo " -> alice: image post (ctenophore)"

IMG2=$(upload_url_image "$BOB" "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Jelly_cc11.jpg/800px-Jelly_cc11.jpg")
post "$BOB" "my cousin looking absolutely *stunning* today

[img: $IMG2]"
echo " -> bob: image post (jellyfish)"

IMG3=$(upload_url_image "$CHARLIE" "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Coral_reef_at_palmyra.jpg/800px-Coral_reef_at_palmyra.jpg")
post "$CHARLIE" "hacked into the reef's mainframe and found this wallpaper

### Coral Reef Stats
- **Biodiversity**: supports ~25% of all marine species
- **Coverage**: less than 1% of the ocean floor
- **Threat level**: \`CRITICAL\`

[img: $IMG3]"
echo " -> charlie: image post (coral reef)"

echo "=== Done! ==="
