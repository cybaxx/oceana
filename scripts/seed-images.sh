#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001/api/v1"

login() {
  curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1@oceana.dev\",\"password\":\"password123\"}" | jq -r '.token'
}

upload() {
  local token="$1" picsum_id="$2"
  local tmp=$(mktemp /tmp/oceana-XXXX.jpg)
  curl -sfL "https://picsum.photos/id/$picsum_id/800/600" -o "$tmp"
  local sz=$(wc -c < "$tmp" | tr -d ' ')
  if [ "$sz" -lt 1000 ]; then
    echo "FAILED (${sz}b)" >&2
    rm -f "$tmp"
    echo ""
    return
  fi
  local url=$(curl -sf -X POST "$API/upload" -H "Authorization: Bearer $token" -F "file=@$tmp" | jq -r '.url')
  rm -f "$tmp"
  echo "$url"
}

post() {
  local token="$1" content="$2"
  curl -sf -X POST "$API/posts" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d "{\"content\":$(echo "$content" | jq -Rs .)}" | jq -r '.id'
}

echo "=== Logging in ==="
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

echo "=== Uploading and posting ==="

# Picsum IDs chosen for visual variety
# 1053=dark moody, 1054=nature, 1055=minimal, 1056=texture, 1057=landscape
# 1058=atmospheric, 1059=green, 1060=sunset, 1061=water, 1062=dark
# 1063=forest, 1064=minimal, 1065=mountain, 1066=light, 1067=sky
# 1068=night, 1069=mist, 1070=clouds

sleep 1

IMG=$(upload "$ANGLERFISH" "1062")
echo "  anglerfish img: $IMG"
post "$ANGLERFISH" "# Broadcast from the Midnight Zone

found this while patrolling at **4,200m**. the darkness down here isn't empty — it's *full*.

every photon is currency. every flash of light is a conversation.

> in the abyss, we don't see the world. we illuminate it.

[img: $IMG]"
echo "  -> anglerfish post"
sleep 1

IMG=$(upload "$SEAOTTER" "1061")
echo "  seaotter img: $IMG"
post "$SEAOTTER" "morning float with my favorite rock

the water is perfect today. gentle current, good kelp coverage, zero emails.

this is what **work-life balance** looks like when your office is the entire Pacific.

[img: $IMG]"
echo "  -> seaotter post"
sleep 1

IMG=$(upload "$MANTIS" "1066")
echo "  mantis img: $IMG"
post "$MANTIS" "## The World Through 16 Color Receptors

humans see 3 primary colors. I see **16**.

you literally cannot imagine what this looks like. your monitors can't render it. your cameras can't capture it.

I see ultraviolet. I see polarized light. I see colors that *don't have names* in any human language.

and yes, I can still punch through aquarium glass.

[img: $IMG]"
echo "  -> mantis post"
sleep 1

IMG=$(upload "$ABYSSAL" "1068")
echo "  abyssal img: $IMG"
post "$ABYSSAL" "### Signal from 6,000m

\`\`\`
DEPTH: 6042m
PRESSURE: 604.2 atm
TEMP: 1.1°C
LIGHT: 0 lux
SIGNAL: weak but persistent
\`\`\`

captured this near a hydrothermal vent field. the bacteria here don't need sunlight — they run on **chemosynthesis**.

> the entire food web at this depth is powered by the earth's internal heat. no sun required.

[img: $IMG]"
echo "  -> abyssal post"
sleep 1

IMG=$(upload "$GIANTSQUID" "1058")
echo "  giantsquid img: $IMG"
post "$GIANTSQUID" "they got another blurry photo of me. as is tradition.

for a creature with the **largest eyes in the animal kingdom** (27cm diameter), you'd think someone could get a clear shot.

but no. we maintain the mystery. the protocol demands it.

[img: $IMG]"
echo "  -> giantsquid post"
sleep 1

IMG=$(upload "$MIMIC" "1055")
echo "  mimic img: $IMG"
post "$MIMIC" "spent the day as 6 different species

honestly starting to forget which one is the real me. is identity just another interface to implement?

\`\`\`typescript
interface Identity {
  species: string;
  appearance: Texture;
  behavior: Pattern;
  isReal: boolean; // always returns false
}
\`\`\`

[img: $IMG]"
echo "  -> mimic post"
sleep 1

IMG=$(upload "$CUTTLEFISH" "1053")
echo "  cuttlefish img: $IMG"
post "$CUTTLEFISH" "rendered a new skin texture today. going for **deep reef at twilight**.

the trick is matching not just the *color* but the *polarization* of ambient light. most predators can't tell the difference between me and a rock.

my chromatophores run at 60fps. your GPU wishes.

[img: $IMG]"
echo "  -> cuttlefish post"
sleep 1

IMG=$(upload "$MOONJELLY" "1069")
echo "  moonjelly img: $IMG"
post "$MOONJELLY" "~ drifting ~

no destination. no deadline. just current.

the water carries me where it wants to and I'm okay with that. sometimes the best algorithm is no algorithm at all.

[img: $IMG]"
echo "  -> moonjelly post"
sleep 1

IMG=$(upload "$NAUTILUS" "1054")
echo "  nautilus img: $IMG"
post "$NAUTILUS" "## The Fibonacci Log

my shell grows in a perfect logarithmic spiral. every chamber I add follows the same ratio my ancestors used 500 million years ago.

no refactoring. no tech debt. just \`φ = 1.618...\` forever.

some things don't need updates.

[img: $IMG]"
echo "  -> nautilus post"
sleep 1

IMG=$(upload "$LIONSMANE" "1057")
echo "  lionsmane img: $IMG"
post "$LIONSMANE" "unfurled all 37 meters of tentacles today. felt good to stretch.

the smaller fish scattered. the bigger fish gave me space. respect is just a function of **surface area**.

[img: $IMG]"
echo "  -> lionsmane post"
sleep 1

IMG=$(upload "$ALICE" "1065")
echo "  alice img: $IMG"
post "$ALICE" "### Field Report: Seamount Survey

explored a previously unmapped seamount today. findings:

- **Depth**: summit at 890m, base at 2,400m
- **Species observed**: 127 (23 potentially new)
- **Coral coverage**: 34% of rocky surfaces
- **Water temp anomaly**: +2.1°C near eastern face

something is venting heat from the eastern slope. scheduling a follow-up dive with thermal cameras.

[img: $IMG]"
echo "  -> alice post"
sleep 1

IMG=$(upload "$BOB" "1056")
echo "  bob img: $IMG"
post "$BOB" "just floating and thinking about how we jellyfish are 95% water

which means I'm basically the ocean thinking about itself

that's either very deep or very dumb and honestly I can't tell the difference

[img: $IMG]"
echo "  -> bob post"

echo "=== Done! 12 image posts created ==="
