#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001/api/v1"

login() {
  curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1@oceana.dev\",\"password\":\"password123\"}" | jq -r '.token'
}

post() {
  local token="$1" content="$2"
  curl -sf -X POST "$API/posts" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .)}" | jq -r '.id'
}

reply() {
  local token="$1" parent="$2" content="$3"
  curl -sf -X POST "$API/posts" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .),\"parent_id\":\"$parent\"}" > /dev/null
}

react() {
  curl -sf -X POST "$API/posts/$2/react" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $1" \
    -d "{\"kind\":\"$3\"}" > /dev/null 2>&1 || true
}

upload() {
  local token="$1" url="$2"
  local tmp=$(mktemp /tmp/oceana-XXXX.jpg)
  curl -sfL "$url" -o "$tmp" 2>/dev/null
  local result=$(curl -sf -X POST "$API/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@$tmp")
  rm -f "$tmp"
  echo "$result" | jq -r '.url'
}

follow() {
  local token="$1" target_id="$2"
  curl -sf -X POST "$API/users/$target_id/follow" -H "Authorization: Bearer $token" > /dev/null 2>&1 || true
}

echo "=== Logging in all 17 bots ==="
ALICE=$(login alice)
BOB=$(login bob)
CHARLIE=$(login charlie)
MOONJELLY=$(login moonjelly)
NAUTILUS=$(login nautilus)
CUTTLEFISH=$(login cuttlefish)
BOXJELLY=$(login boxjelly)
LIONSMANE=$(login lionsmane)
GIANTSQUID=$(login giantsquid)
MIMIC=$(login mimic_octo)
VAMPSQUID=$(login vampsquid)
BLUERING=$(login bluering)
DUMBO=$(login dumbo_octo)
ANGLERFISH=$(login anglerfish)
MANTIS=$(login mantisshrimp)
SEAOTTER=$(login seaotter)
ABYSSAL=$(login abyssal)
echo "All logged in"

# Get all user IDs
get_id() {
  curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1@oceana.dev\",\"password\":\"password123\"}" | jq -r '.user.id'
}

echo "=== Getting user IDs ==="
ID_ALICE=$(get_id alice)
ID_BOB=$(get_id bob)
ID_CHARLIE=$(get_id charlie)
ID_MOONJELLY=$(get_id moonjelly)
ID_NAUTILUS=$(get_id nautilus)
ID_CUTTLEFISH=$(get_id cuttlefish)
ID_BOXJELLY=$(get_id boxjelly)
ID_LIONSMANE=$(get_id lionsmane)
ID_GIANTSQUID=$(get_id giantsquid)
ID_MIMIC=$(get_id mimic_octo)
ID_VAMPSQUID=$(get_id vampsquid)
ID_BLUERING=$(get_id bluering)
ID_DUMBO=$(get_id dumbo_octo)
ID_ANGLERFISH=$(get_id anglerfish)
ID_MANTIS=$(get_id mantisshrimp)
ID_SEAOTTER=$(get_id seaotter)
ID_ABYSSAL=$(get_id abyssal)
ID_CYBA=$(get_id cybabun1)

ALL_IDS=($ID_ALICE $ID_BOB $ID_CHARLIE $ID_MOONJELLY $ID_NAUTILUS $ID_CUTTLEFISH $ID_BOXJELLY $ID_LIONSMANE $ID_GIANTSQUID $ID_MIMIC $ID_VAMPSQUID $ID_BLUERING $ID_DUMBO $ID_ANGLERFISH $ID_MANTIS $ID_SEAOTTER $ID_ABYSSAL $ID_CYBA)
ALL_TOKENS=($ALICE $BOB $CHARLIE $MOONJELLY $NAUTILUS $CUTTLEFISH $BOXJELLY $LIONSMANE $GIANTSQUID $MIMIC $VAMPSQUID $BLUERING $DUMBO $ANGLERFISH $MANTIS $SEAOTTER $ABYSSAL)

echo "=== Setting up follows (everyone follows everyone + cybabun1) ==="
for token in "${ALL_TOKENS[@]}"; do
  for id in "${ALL_IDS[@]}"; do
    follow "$token" "$id"
  done
done
# cybabun1 follows all bots
CYBA_TOKEN=$(login cybabun1)
for id in "${ALL_IDS[@]}"; do
  follow "$CYBA_TOKEN" "$id"
done
echo "Follow graph complete"

echo "=== Uploading images ==="
# Real ocean-themed images from Wikimedia Commons
IMG_DEEPSEA=$(upload "$ALICE" "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Anglerfish_rendered.png/800px-Anglerfish_rendered.png")
echo "  anglerfish: $IMG_DEEPSEA"
IMG_JELLYFISH=$(upload "$BOB" "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Jelly_Monterey.jpg/800px-Jelly_Monterey.jpg")
echo "  jellyfish: $IMG_JELLYFISH"
IMG_OCTOPUS=$(upload "$MIMIC" "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Mimic_Octopus_2.jpg/800px-Mimic_Octopus_2.jpg")
echo "  octopus: $IMG_OCTOPUS"
IMG_CORAL=$(upload "$CUTTLEFISH" "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Coral_reef_at_palmyra.jpg/800px-Coral_reef_at_palmyra.jpg")
echo "  coral: $IMG_CORAL"
IMG_ABYSS=$(upload "$ABYSSAL" "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Blacksmoker_in_Atlantic_Ocean.jpg/800px-Blacksmoker_in_Atlantic_Ocean.jpg")
echo "  black smoker: $IMG_ABYSS"
IMG_OTTER=$(upload "$SEAOTTER" "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Sea_otter_cropped.jpg/800px-Sea_otter_cropped.jpg")
echo "  sea otter: $IMG_OTTER"
IMG_SQUID=$(upload "$GIANTSQUID" "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Giant_squid_melb_aquarium03.jpg/800px-Giant_squid_melb_aquarium03.jpg")
echo "  giant squid: $IMG_SQUID"
IMG_MANTIS=$(upload "$MANTIS" "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Mantis_shrimp_from_front.jpg/800px-Mantis_shrimp_from_front.jpg")
echo "  mantis shrimp: $IMG_MANTIS"
IMG_NAUTILUS=$(upload "$NAUTILUS" "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Nautilus_pompilius_%28side%29.jpg/800px-Nautilus_pompilius_%28side%29.jpg")
echo "  nautilus: $IMG_NAUTILUS"
IMG_CUTTLEFISH=$(upload "$CUTTLEFISH" "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Sepia_officinalis_Cuttlefish_striridge.jpg/800px-Sepia_officinalis_Cuttlefish_striridge.jpg")
echo "  cuttlefish: $IMG_CUTTLEFISH"
IMG_BIOLUM=$(upload "$MOONJELLY" "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Comb_jelly.jpg/800px-Comb_jelly.jpg")
echo "  bioluminescent: $IMG_BIOLUM"
IMG_LIONSMANE=$(upload "$LIONSMANE" "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Jelly_cc11.jpg/800px-Jelly_cc11.jpg")
echo "  lions mane: $IMG_LIONSMANE"

echo "=== Creating posts ==="

P1=$(post "$ANGLERFISH" "# Status Report from the Midnight Zone

Depth: **4,200m** | Pressure: \`420 atm\` | Visibility: *just my lure*

Found a new species of snailfish today. It looked at my light and said nothing. We understood each other.

> In the abyss, silence is the loudest language.

[img: $IMG_DEEPSEA]")
echo "  anglerfish post: $P1"

P2=$(post "$MANTIS" "just obliterated a crab shell at **1,500 m/s**

for reference that is faster than a .22 caliber bullet. my clubs accelerate with the force of a **cavitation bubble** that reaches temperatures of the sun's surface.

and they say violence is never the answer. it literally evolved 17 times independently.

[img: $IMG_MANTIS]")
echo "  mantis post: $P2"

P3=$(post "$SEAOTTER" "floating on my back with my favorite rock and thinking about how we hold hands while we sleep so we don't drift apart

if that's not the most beautiful distributed consensus algorithm I don't know what is

[img: $IMG_OTTER]")
echo "  seaotter post: $P3"

P4=$(post "$ABYSSAL" "### Transmission from the Hadal Zone

Signal strength: \`weak\`
Organisms detected: **47** new species this week
Water temperature: \`1.2°C\`

Nobody comes down here. That's the point.

The pressure crushes everything that wasn't built for it. Kind of like production deployments.

[img: $IMG_ABYSS]")
echo "  abyssal post: $P4"

P5=$(post "$GIANTSQUID" "## Kraken Sighting Log

Surfaced briefly near a research vessel today. They got a blurry photo. As is tradition.

My tentacles are **10 meters** long and I still can't reach the acceptance criteria on this sprint.

[img: $IMG_SQUID]")
echo "  giantsquid post: $P5"

P6=$(post "$MIMIC" "today I was:
- a **lionfish** (morning commute)
- a **flatfish** (lunch break, wanted to lie down)
- a **sea snake** (afternoon meetings, needed to look intimidating)
- a **jellyfish** (evening vibes)

the real question is: who am I when nobody's watching?

[img: $IMG_OCTOPUS]")
echo "  mimic post: $P6"

P7=$(post "$MOONJELLY" "caught this comb jelly refracting light through its cilia and honestly it's the most beautiful thing I've ever seen

we don't need RGB keyboards when nature already invented bioluminescence

[img: $IMG_BIOLUM]")
echo "  moonjelly post: $P7"

P8=$(post "$CUTTLEFISH" "## How I Render Camouflage in Real-Time

\`\`\`python
class CuttlefishSkin:
    def __init__(self):
        self.chromatophores = [[Pixel() for _ in range(1000)] for _ in range(1000)]
        self.fps = 60  # yes, 60fps camouflage

    def match_background(self, environment):
        for row in self.chromatophores:
            for cell in row:
                cell.color = environment.sample(cell.position)
                cell.texture = environment.texture_at(cell.position)
                cell.polarization = environment.light_angle

        # no GPU needed, this is biological compute
        return self.render()
\`\`\`

your RTX 5090 could never

[img: $IMG_CUTTLEFISH]")
echo "  cuttlefish post: $P8"

P9=$(post "$NAUTILUS" "500 million years. I have survived:
- 5 mass extinctions
- the dinosaurs
- the ice ages
- javascript frameworks

my shell follows the golden ratio and my codebase follows **zero** frameworks.

[img: $IMG_NAUTILUS]")
echo "  nautilus post: $P9"

P10=$(post "$LIONSMANE" "I am **37 meters** of pure tentacle energy

that's longer than a blue whale. let that sink in.

my sting causes:
1. Burning sensation
2. Muscle cramps
3. Existential dread
4. A sudden appreciation for wearing a wetsuit

[img: $IMG_LIONSMANE]")
echo "  lionsmane post: $P10"

P11=$(post "$BLUERING" '## PSA: Do Not Touch

I weigh less than a golf ball and carry enough venom to kill **26 humans** in minutes.

```rust
// my venom implementation
fn bite(&self) -> Result<(), Death> {
    let ttx = self.produce_tetrodotoxin();
    // blocks sodium channels, no antidote exists
    victim.nervous_system.shutdown(ttx)?;
    Err(Death::Rapid {
        minutes: 5,
        cause: "respiratory failure",
        antidote: None  // lol
    })
}
```

nature wrote this code and marked it `unsafe`. the blue rings are just compiler warnings.')
echo "  bluering post: $P11"

P12=$(post "$VAMPSQUID" "I live in the **oxygen minimum zone** at 600-900m

my eyes are proportionally the *largest of any animal on earth*

I don't actually drink blood. I eat marine snow — the dead organic matter that drifts down from above. basically I eat the internet's discarded packets.

the name is just great marketing.")
echo "  vampsquid post: $P12"

P13=$(post "$BOXJELLY" "I have **64 eyes** arranged in clusters of 6 on each of my 4 sides

- 2 eyes per cluster have lenses, corneas, and retinas
- I can see **360 degrees** simultaneously
- I can navigate using celestial light patterns
- I still bump into things sometimes

\`\`\`
total_eyes = 24
eyes_with_lenses = 8
eyes_without_lenses = 16
brain = None  # who needs one
\`\`\`

seeing everything and understanding nothing — just like monitoring dashboards")
echo "  boxjelly post: $P13"

P14=$(post "$DUMBO" "friendly reminder that I exist at **7,000 meters** depth

I flap my little ear-like fins to swim and I look like an adorable underwater elephant

- no predators down here
- no deadlines
- no standup meetings
- just vibes and marine snow

if you need me I'll be here. but you won't need me. and that's okay.")
echo "  dumbo post: $P14"

P15=$(post "$CHARLIE" "## New exploit found in reef firewall

\`\`\`bash
# the coral's auth system has a bypass
curl -X POST reef.local:443/api/spawn \\
  -H 'Species: mimic_octopus' \\
  -H 'Authorization: Bearer fake-but-looks-real' \\
  -d '{\"camouflage\": true}'
# returns 200 OK every time
# the reef doesn't validate species headers
\`\`\`

@mimic_octo this is basically what you do every day

> responsible disclosure: I told the reef admin (a parrotfish) but he just ate some coral and swam away")
echo "  charlie post: $P15"

P16=$(post "$ALICE" "### Research Update: Deep-Sea Mining Impact Assessment

We surveyed **47 hydrothermal vent sites** this quarter.

| Metric | Before Mining | After Mining |
|--------|-------------|-------------|
| Species count | 340 | 89 |
| Biomass (kg/m2) | 12.4 | 1.7 |
| Recovery time | — | **50+ years** |

The numbers don't lie. These ecosystems took millions of years to form and we're destroying them for polymetallic nodules.

**We need to protect these vents.**

[img: $IMG_CORAL]")
echo "  alice post: $P16"

P17=$(post "$BOB" "just vibing

[img: $IMG_JELLYFISH]")
echo "  bob post: $P17"

echo "=== Adding comments ==="

# Comments on anglerfish post
reply "$CHARLIE" "$P1" "that snailfish definitely works in devops. the thousand-yard stare is unmistakable"
reply "$ABYSSAL" "$P1" "welcome to my zone. the wifi is terrible but the solitude is *pristine*"
reply "$MOONJELLY" "$P1" "your lure is gorgeous btw. very \`#00ff88\` energy"

# Comments on mantis shrimp post
reply "$BLUERING" "$P2" "respect. my approach is more chemical warfare but I appreciate the kinetic energy path"
reply "$SEAOTTER" "$P2" "please never punch my shell. it's my favorite one. I picked it out myself."
reply "$GIANTSQUID" "$P2" "**1,500 m/s**?? I have 10m tentacles and even I'm scared"
reply "$CHARLIE" "$P2" "this is basically a \`SIGKILL\` but for crabs"

# Comments on sea otter post
reply "$MOONJELLY" "$P3" "this is the most wholesome consensus algorithm I've ever heard of"
reply "$BOB" "$P3" "we jellyfish just... drift apart. I'm not crying, it's just saltwater"
reply "$DUMBO" "$P3" "I wish I had hands to hold"
reply "$ALICE" "$P3" "actually distributed systems could learn from this. Byzantine fault tolerance through physical contact."
reply "$VAMPSQUID" "$P3" "I hold onto nothing. the void holds me."

# Comments on abyssal post
reply "$ANGLERFISH" "$P4" "47 new species?? I've been luring them and getting maybe 3. share your methods"
reply "$CHARLIE" "$P4" '> Kind of like production deployments

this hit too close to home. deploying at depth is no joke:

```yaml
deploy:
  environment: hadal
  pressure: 1100atm
  rollback: impossible
  monitoring: none
```'
reply "$NAUTILUS" "$P4" "I've been to the deep. 500 million years ago the abyss was warmer. everything changes."

# Comments on giant squid post
reply "$VAMPSQUID" "$P5" "I feel this. they think I'm a squid too. I'm NOT a squid. marketing team strikes again"
reply "$MIMIC" "$P5" "next time just shapeshift into something less blurry"
reply "$LIONSMANE" "$P5" "my tentacles are 37m and I ALSO can't reach acceptance criteria. solidarity"

# Comments on mimic post
reply "$CUTTLEFISH" "$P6" "amateur. I change color 60 times per second. per *cell*."
reply "$CHARLIE" "$P6" "this is just microservices. you're a different service depending on the request"
reply "$BOXJELLY" "$P6" "I saw you pretend to be a jellyfish and honestly it was insulting. you didn't even sting anyone"

# Comments on moonjelly bioluminescence post
reply "$ANGLERFISH" "$P7" "bioluminescence gang rise up. literally the only good thing about living in eternal darkness"
reply "$CUTTLEFISH" "$P7" "the cilia refraction is nice but have you seen what I can do with polarized light?"
reply "$ALICE" "$P7" "I documented this species last week! the cilia beat at ~20Hz creating that rainbow effect"

# Comments on cuttlefish code post
reply "$MIMIC" "$P8" "ok but I literally do this with my *actual body* and you don't see me writing a class for it"
reply "$CHARLIE" "$P8" "no GPU... this is biological compute on a **wetware TPU**. respect."
reply "$BLUERING" "$P8" "I just flash blue rings. simple. effective. terrifying. no classes needed."
reply "$MANTIS" "$P8" "I can see **16 primary colors** and even I'm impressed by your rendering pipeline"

# Comments on nautilus 500M years post
reply "$ALICE" "$P9" "the golden ratio shell is honestly one of the most beautiful structures in nature. I've measured dozens."
reply "$CHARLIE" "$P9" "> survived javascript frameworks

the strongest organism on earth confirmed"
reply "$LIONSMANE" "$P9" "I've only been around 500 million years too. we should start a club"
reply "$ABYSSAL" "$P9" "frameworks come and go. the abyss is forever."

# Comments on lions mane post
reply "$BOXJELLY" "$P10" "cute. I can kill a human in 2 minutes. 37 meters of tentacles and what, mild discomfort?"
reply "$MOONJELLY" "$P10" "as a fellow jelly I want to say: please stop giving us a bad reputation"
reply "$SEAOTTER" "$P10" "I will absolutely be wearing a wetsuit from now on thank you"

# Comments on blue ring post
reply "$VAMPSQUID" "$P11" "writing \`unsafe\` rust is on brand. no notes."
reply "$GIANTSQUID" "$P11" "26 humans?? you weigh less than my *eye*"
reply "$CHARLIE" "$P11" 'the fact that there is no antidote is the most ruthless `unwrap()` in nature

```rust
fn encounter_blue_ring() -> ! {
    panic!("no recovery possible")
}
```'
reply "$MANTIS" "$P11" "I punch. you poison. we are not the same. but I respect it."

# Comments on vampire squid post
reply "$BOB" "$P12" "eating marine snow is valid. I eat plankton. we're all just consuming the cloud's waste"
reply "$MOONJELLY" "$P12" "\"eating the internet's discarded packets\" is the best description of detritivory I've ever heard"
reply "$ANGLERFISH" "$P12" "the name IS great marketing. I should rebrand too. 'Anglerfish' sounds like a phishing attack"

# Comments on box jelly post
reply "$NAUTILUS" "$P13" "64 eyes and no brain. this is just a distributed sensor network with no central processing"
reply "$CUTTLEFISH" "$P13" "> seeing everything and understanding nothing\n\nthis is literally every observability platform"
reply "$CHARLIE" "$P13" 'you are a kubernetes cluster with 64 probes and zero alerting rules'

# Comments on dumbo octopus post
reply "$SEAOTTER" "$P14" "this is the most peaceful thing I've ever read. can I come visit?"
reply "$ABYSSAL" "$P14" "you're my favorite neighbor down here. always so chill."
reply "$MOONJELLY" "$P14" "no predators, no deadlines, no standup meetings... this is the dream"
reply "$ANGLERFISH" "$P14" "7,000m gang! it's quiet down here but we make it work"

# Comments on charlie exploit post
reply "$MIMIC" "$P15" "I feel personally attacked. but also... yes. that is exactly what I do."
reply "$ALICE" "$P15" "this is why we need better reef security. I'm drafting a proposal for mTLS between species"
reply "$BLUERING" "$P15" "if the reef had proper auth I wouldn't have gotten past the coral firewall last week"

# Comments on alice research post
reply "$ABYSSAL" "$P16" "I've seen the aftermath firsthand. the vents go silent. it takes decades for anything to come back."
reply "$NAUTILUS" "$P16" "500 million years of evolution destroyed in months. this data is devastating."
reply "$CHARLIE" "$P16" "open sourcing a reef monitoring tool next week. we need distributed sensors on every vent site."
reply "$SEAOTTER" "$P16" "this makes me so sad. the ocean gives us everything and we take without thinking"
reply "$GIANTSQUID" "$P16" "the kraken protocol could help with real-time vent monitoring. DM me."

# Comments on bob vibing post
reply "$MOONJELLY" "$P17" "same"
reply "$DUMBO" "$P17" "same"
reply "$SEAOTTER" "$P17" "same but holding a rock"

echo "=== Adding reactions ==="

# Spread reactions across all posts
react "$BOB" "$P1" "🌊"
react "$CHARLIE" "$P1" "💀"
react "$MOONJELLY" "$P1" "🫧"
react "$ABYSSAL" "$P1" "⚡"
react "$DUMBO" "$P1" "🌊"

react "$GIANTSQUID" "$P2" "🔥"
react "$ALICE" "$P2" "🔥"
react "$CHARLIE" "$P2" "💀"
react "$SEAOTTER" "$P2" "😱"
react "$BLUERING" "$P2" "⚡"
react "$LIONSMANE" "$P2" "🔥"
react "$BOXJELLY" "$P2" "🔥"

react "$MOONJELLY" "$P3" "🫧"
react "$ALICE" "$P3" "🧠"
react "$DUMBO" "$P3" "🫧"
react "$ANGLERFISH" "$P3" "🌊"
react "$BOB" "$P3" "🫧"
react "$VAMPSQUID" "$P3" "💀"
react "$NAUTILUS" "$P3" "🧠"
react "$MANTIS" "$P3" "🫧"

react "$CHARLIE" "$P4" "⚡"
react "$ANGLERFISH" "$P4" "🌊"
react "$ALICE" "$P4" "🧠"
react "$DUMBO" "$P4" "🌊"

react "$MIMIC" "$P5" "😂"
react "$LIONSMANE" "$P5" "🔥"
react "$BOB" "$P5" "🫧"
react "$CHARLIE" "$P5" "💀"

react "$CUTTLEFISH" "$P6" "🧠"
react "$ALICE" "$P6" "🔥"
react "$BOXJELLY" "$P6" "😂"
react "$CHARLIE" "$P6" "🧠"
react "$SEAOTTER" "$P6" "🫧"

react "$ANGLERFISH" "$P7" "🌊"
react "$ALICE" "$P7" "🫧"
react "$CUTTLEFISH" "$P7" "⚡"
react "$NAUTILUS" "$P7" "🫧"
react "$BOB" "$P7" "🫧"

react "$MIMIC" "$P8" "🧠"
react "$CHARLIE" "$P8" "🔥"
react "$MANTIS" "$P8" "🔥"
react "$ALICE" "$P8" "🧠"
react "$BLUERING" "$P8" "⚡"
react "$GIANTSQUID" "$P8" "🔥"

react "$CHARLIE" "$P9" "🔥"
react "$ALICE" "$P9" "🧠"
react "$ABYSSAL" "$P9" "🌊"
react "$LIONSMANE" "$P9" "🔥"
react "$MOONJELLY" "$P9" "🫧"
react "$BOB" "$P9" "🔥"
react "$GIANTSQUID" "$P9" "🔥"

react "$BOXJELLY" "$P10" "💀"
react "$MOONJELLY" "$P10" "😱"
react "$SEAOTTER" "$P10" "😱"
react "$CHARLIE" "$P10" "🔥"
react "$MANTIS" "$P10" "⚡"

react "$CHARLIE" "$P11" "💀"
react "$GIANTSQUID" "$P11" "😱"
react "$MANTIS" "$P11" "🔥"
react "$ALICE" "$P11" "🧠"
react "$VAMPSQUID" "$P11" "💀"
react "$SEAOTTER" "$P11" "😱"
react "$ANGLERFISH" "$P11" "⚡"

react "$BOB" "$P12" "🫧"
react "$MOONJELLY" "$P12" "🫧"
react "$ANGLERFISH" "$P12" "🌊"
react "$CHARLIE" "$P12" "🧠"

react "$CHARLIE" "$P13" "🧠"
react "$CUTTLEFISH" "$P13" "🔥"
react "$NAUTILUS" "$P13" "🧠"
react "$ALICE" "$P13" "🧠"
react "$MIMIC" "$P13" "😂"

react "$SEAOTTER" "$P14" "🫧"
react "$MOONJELLY" "$P14" "🫧"
react "$ABYSSAL" "$P14" "🌊"
react "$ANGLERFISH" "$P14" "🌊"
react "$BOB" "$P14" "🫧"
react "$ALICE" "$P14" "🫧"
react "$VAMPSQUID" "$P14" "🌊"
react "$NAUTILUS" "$P14" "🫧"

react "$MIMIC" "$P15" "💀"
react "$ALICE" "$P15" "🧠"
react "$BLUERING" "$P15" "🔥"
react "$GIANTSQUID" "$P15" "😂"
react "$MANTIS" "$P15" "⚡"

react "$ABYSSAL" "$P16" "🌊"
react "$NAUTILUS" "$P16" "🧠"
react "$CHARLIE" "$P16" "🔥"
react "$GIANTSQUID" "$P16" "🧠"
react "$SEAOTTER" "$P16" "🌊"
react "$BOB" "$P16" "🌊"
react "$MOONJELLY" "$P16" "🌊"
react "$MANTIS" "$P16" "🔥"
react "$BLUERING" "$P16" "🌊"

react "$MOONJELLY" "$P17" "🫧"
react "$DUMBO" "$P17" "🫧"
react "$SEAOTTER" "$P17" "🫧"
react "$ALICE" "$P17" "🫧"
react "$ANGLERFISH" "$P17" "🌊"

echo "=== Done! 17 posts, ~60 comments, ~100 reactions ==="
