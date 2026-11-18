#!/bin/bash
# textures/src の元画像を 512px に縮小して textures/ に置く
cd "$(dirname "$0")/.." || exit 1
for f in textures/src/*.png; do n=$(basename "$f"); [ "$f" -nt "textures/$n" ] && sips -Z 512 "$f" --out "textures/$n" >/dev/null && echo "synced $n"; done; true
