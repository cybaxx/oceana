#!/usr/bin/env bash
# Generate simple ocean-themed PNG test images using ImageMagick (convert) or fallback to raw PPM->PNG
# These are small colored images with text overlay for testing upload functionality.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for ImageMagick
if command -v magick &> /dev/null; then
  CMD="magick"
elif command -v convert &> /dev/null; then
  CMD="convert"
else
  echo "ImageMagick not found. Generating minimal PNG files with python3..."
  # Fallback: use python3 to create tiny PNGs
  python3 -c "
import struct, zlib, os

def create_png(filename, r, g, b, width=320, height=240):
    def chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00' + bytes([r, g, b]) * width
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(header + ihdr + idat + iend)

images = [
    ('jellyfish.png', 30, 90, 180),
    ('coral-reef.png', 220, 100, 80),
    ('deep-sea.png', 10, 20, 60),
    ('nautilus-shell.png', 200, 170, 120),
    ('kelp-forest.png', 40, 140, 70),
    ('bioluminescence.png', 20, 200, 220),
    ('tide-pool.png', 80, 160, 180),
    ('ocean-sunset.png', 220, 130, 60),
]

for name, r, g, b in images:
    path = os.path.join('$DIR', name)
    create_png(path, r, g, b)
    print(f'  created {name} ({r},{g},{b})')
"
  echo "Done: 8 test images generated."
  exit 0
fi

# ImageMagick path
images=(
  "jellyfish.png|#1E5AB4|Jellyfish"
  "coral-reef.png|#DC6450|Coral Reef"
  "deep-sea.png|#0A143C|Deep Sea"
  "nautilus-shell.png|#C8AA78|Nautilus Shell"
  "kelp-forest.png|#288C46|Kelp Forest"
  "bioluminescence.png|#14C8DC|Bioluminescence"
  "tide-pool.png|#50A0B4|Tide Pool"
  "ocean-sunset.png|#DC823C|Ocean Sunset"
)

for entry in "${images[@]}"; do
  IFS='|' read -r name color label <<< "$entry"
  $CMD -size 320x240 "xc:${color}" \
    -gravity center -pointsize 24 -fill white \
    -annotate 0 "$label" \
    "$DIR/$name"
  echo "  created $name"
done

echo "Done: ${#images[@]} test images generated."
