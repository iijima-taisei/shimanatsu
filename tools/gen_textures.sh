#!/bin/bash
# Codexの画像生成でテクスチャを作る。使い方: tools/gen_textures.sh <バッチ名>...
cd "$(dirname "$0")/.." || exit 1
C=/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex; D="$PWD/textures/src"; mkdir -p "$D"
STYLE='Shared style for all: hand-painted texture for an early-2000s home console 3D game (PS2 era), slightly desaturated nostalgic Japanese summer palette, even soft lighting, no strong baked shadows, no perspective distortion, no border, no watermark.'
gen(){ # $1=names (space separated)  $2=spec text
  local need="" paths=""
  for n in $1; do [ -f "$D/$n.png" ] || need="$need $n"; paths="$paths $D/$n.png"; done
  [ -z "$need" ] && { echo "skip: $1"; return; }
  echo "=== generating:$need"
  "$C" exec --skip-git-repo-check -s workspace-write -C "$PWD" "\$imagegen Generate separate square images with these specs, one image per numbered item.
$STYLE
$2
Size: 1024x1024 each
Quality: medium
After generating, copy each PNG to the folder $D/ using exactly the file name given for each item. Do not overwrite existing files.
Finally print only the saved absolute paths." 2>&1 | tail -n 8
}
TILE='Each is a flat straight-on surface view that is seamless and tileable (edges must wrap), no objects, no text.'
for b in "$@"; do case $b in
ground2) gen "rock water dirt concrete" "$TILE
1) rock.png : pale grey-beige weathered volcanic cliff rock face with soft cracks.
2) water.png : calm shallow tropical sea surface seen from above, turquoise-blue with soft lighter caustic ripple pattern, painterly.
3) dirt.png : light tan packed dirt of a school sports ground, very subtle scuffs.
4) concrete.png : light grey weathered concrete with faint stains and hairline cracks." ;;
build1) gen "school-wall school-windows roof-tile wood-wall plaster" "$TILE
1) school-wall.png : cream-white painted concrete wall of an old Japanese school building, faint rain streaks.
2) school-windows.png : one facade bay of a Japanese school building viewed straight-on: cream concrete wall with one wide four-pane aluminium sliding window in the middle reflecting pale blue sky, a concrete sill below; must tile horizontally into a row of identical windows and vertically into floors.
3) roof-tile.png : Japanese kawara roof tiles, dark blue-grey, rows running horizontally.
4) wood-wall.png : weathered dark brown vertical wooden board siding of an old Japanese island house.
5) plaster.png : off-white slightly dirty plaster house wall." ;;
build2) gen "classroom-floor blackboard shop-front house-front vending" "Each is a flat straight-on orthographic view filling the entire image edge to edge, no perspective.
1) classroom-floor.png : worn wooden plank floor of a Japanese classroom, warm brown, seamless tileable.
2) blackboard.png : dark green school chalkboard surface with faint chalk dust smudges and eraser marks, no writing, with a thin wooden frame at the edges.
3) shop-front.png : front wall of an old Japanese countryside general store: wide glass sliding doors with wooden frames showing dim shelves of snacks inside, a blank faded signboard above, no readable text.
4) house-front.png : front wall of an old Japanese wooden house: sliding lattice door in the middle and a frosted glass window, dark wood, plaster above.
5) vending.png : front of a Japanese drink vending machine, white-blue body, rows of small colorful drink cans and bottles behind glass, buttons, coin slot, no readable text." ;;
build3) gen "festival-sign school-door chainlink tatami" "Each is a flat straight-on orthographic view filling the entire image edge to edge.
1) festival-sign.png : a hand-painted school festival signboard on plywood, cheerful summer colors, painted waves, sun and paper-flower decorations around big hand-brushed Japanese text \"文化祭\" in the centre.
2) school-door.png : glass double entrance doors of a Japanese school building with aluminium frames, dim shoe lockers faintly visible inside.
3) chainlink.png : green chain-link fence mesh on a fully transparent background, seamless tileable, only the wires are opaque.
4) tatami.png : tatami mat floor, seamless tileable." ;;
plants) gen "leaves pine-branch palm-leaf cloud bark" "Items 1-4 must have a fully transparent background (real alpha channel), subject centred with a small margin, no ground, no shadow.
1) leaves.png : a dense rounded clump of deep green broadleaf tree foliage (camellia/tabu tree), painterly, opaque in the middle with a leafy ragged silhouette.
2) pine-branch.png : a flat horizontal layered bough of Japanese black pine needles seen from the side, dark green, ragged needle silhouette.
3) palm-leaf.png : a single long arching palm frond seen from the side, stem starting at the left-centre edge and tip at the right, green.
4) cloud.png : a big towering white summer cumulonimbus cloud (nyudo-gumo) with a flat base, soft painterly shading, white with pale blue-grey shadows.
5) bark.png : brown-grey tree bark, vertical grain, seamless tileable, opaque." ;;
interior) gen "snack-shelf goods-shelf drink-case fusuma shoji-lit bookshelf poster runway-view souvenir-shelf" "Each is a flat straight-on orthographic view filling the entire image edge to edge, no perspective, no readable text, no logos.
1) snack-shelf.png : front of a crowded wooden shelf in an old Japanese countryside dagashi candy shop: rows of small colourful candy packets, jars and boxes on four shelves.
2) goods-shelf.png : front of a wooden shelf in a small Japanese island general store: instant noodle cups, canned food, dish soap, rolls of toilet paper, mosquito coils, on four shelves.
3) drink-case.png : glass door of a refrigerated drink case seen straight on, rows of glass ramune soda bottles, small juice bottles and tea cans inside, cool white light.
4) fusuma.png : a Japanese fusuma sliding door panel, cream paper with faint pale-blue wave and pine pattern, thin dark wooden frame at the edges, round recessed handle.
5) shoji-lit.png : Japanese shoji paper screen lit brightly from behind by summer daylight, grid of thin wooden lattice over glowing white paper, seamless tileable horizontally.
6) bookshelf.png : front of a teenager's wooden bookshelf with manga volumes, a few books, a model ship and a small trophy, no readable text.
7) poster.png : a faded summer travel poster of a white sand beach and turquoise sea with a small island on the horizon, painterly, no text.
8) runway-view.png : view through a large airport window of a small island airstrip on a bright summer day: grey runway with white markings, green grass, blue sea and sky beyond, heat haze.
9) souvenir-shelf.png : front of a souvenir shelf in a small island airport: boxes of local sweets, bottles of shochu, dried fish packs, small white stone ornaments, no readable text." ;;
clouds) gen "cloud-cb1 cloud-cb2 cloud-cb3 cloud-cu cloud-st" "Each image is ONE cloud on a FULLY TRANSPARENT background (alpha), for a billboard in the sky of a nostalgic Japanese summer game, hand-painted, soft edges, bright white tops with pale blue-grey shading underneath, flat bases where natural, no sky colour behind it, no ground, nothing else in the image, the cloud fills most of the square but never touches the edges.
1) cloud-cb1.png : a huge towering summer cumulonimbus (nyudo-gumo), very tall cauliflower column rising high, brilliant white sunlit top.
2) cloud-cb2.png : a mature cumulonimbus with a wide flat anvil top spreading sideways, tall column below.
3) cloud-cb3.png : a massive wide wall of billowing cumulus congestus clouds stacked like mountains along the horizon.
4) cloud-cu.png : a small cluster of three or four fluffy fair-weather cumulus puffs.
5) cloud-st.png : thin wispy high cirrus streaks brushed across, very light and semi-transparent." ;;
items) gen "icon-umbrella icon-net icon-ukiwa icon-hat" "Each image is ONE small inventory ICON for a nostalgic Japanese summer-vacation game menu, on a fully transparent background: a single object centred, filling about 80% of the square, chunky readable silhouette, soft hand-painted look with a thin dark brown outline, warm summer colours, no text, no shadow on the ground, no frame.
1) icon-umbrella.png : an open clear vinyl Japanese umbrella with a white handle, seen from slightly below, a few raindrops on it.
2) icon-net.png : a green bug-catching net on a long bamboo pole.
3) icon-ukiwa.png : a red and white striped swim ring (inflatable float).
4) icon-hat.png : a straw hat (mugiwara boshi) with a blue ribbon." ;;
icons) gen "icon-coin icon-ramune icon-shell icon-fish icon-cicada icon-senko icon-stamp icon-stone icon-ball icon-prep-ring icon-prep-sign icon-prep-flower icon-prep-lantern icon-prep-banner" "Each image is ONE small inventory ICON for a nostalgic Japanese summer-vacation game menu, on a fully transparent background: a single object centred, filling about 80% of the square, chunky readable silhouette, soft hand-painted look with a thin dark brown outline, warm summer colours, no text, no shadow on the ground, no frame.
1) icon-coin.png : a round Japanese 100-yen style silver coin with a little gold 10-yen coin overlapping it.
2) icon-ramune.png : a glass ramune soda bottle with a marble in the neck, pale blue-green glass.
3) icon-shell.png : a pink and cream scallop seashell.
4) icon-fish.png : a small silver-blue horse mackerel fish seen from the side.
5) icon-cicada.png : a brown Japanese cicada seen from above, wings folded.
6) icon-senko.png : a bundle of three thin twisted senko hanabi sparklers with paper tails, one with a tiny orange spark ball.
7) icon-stamp.png : a round red rubber-stamp impression of a smiling sun, like a radio exercise attendance stamp.
8) icon-stone.png : a flat smooth grey skipping stone with a few water droplets.
9) icon-ball.png : a classic black and white soccer ball.
10) icon-prep-ring.png : a short colourful paper ring chain (red, yellow, blue, green links).
11) icon-prep-sign.png : a small hand-painted wooden signboard with a blue wave pattern, a paintbrush leaning on it.
12) icon-prep-flower.png : a pink tissue-paper flower decoration.
13) icon-prep-lantern.png : a small red and white paper chochin lantern.
14) icon-prep-banner.png : a rolled-out white cloth banner with a red wavy stripe, held by two sticks." ;;
family) gen "face-mother face-father face-sister" "Each image is a FACE DECAL texture to be projected onto the front of a low-poly head: the whole square is filled edge to edge with one flat skin colour, and the facial features are painted in the centre in a simple gentle early-2000s Japanese anime game style. Eyes at about 55% height, eyes spaced apart with about 30% of the image width between them, small nose hint, small mouth at about 28% height, thin eyebrows. NO hair, NO ears, NO head outline, NO neck, NO background other than skin colour, no shading gradients at the edges.
1) face-mother.png : skin colour #F0C8A4, a warm cheerful island mother of about 45, kind slightly tired eyes with soft smile lines, gentle smile.
2) face-father.png : sun-tanned skin colour #D9A57C, an easygoing father of about 48, slightly sleepy kind eyes, short neat moustache, relaxed grin.
3) face-sister.png : skin colour #F4D2B4, a lively 9-year-old girl, big round dark brown eyes, rosy cheeks, mischievous open-mouth grin with a missing front tooth." ;;
ojisan) gen "face-ojisan" "The image is a FACE DECAL texture to be projected onto the front of a low-poly head: the whole square is filled edge to edge with one flat skin colour, and the facial features are painted in the centre in a simple gentle early-2000s Japanese anime game style. Eyes at about 55% height, eyes spaced apart with about 30% of the image width between them, small nose hint, small mouth at about 28% height. NO hair, NO ears, NO head outline, NO neck, NO background other than skin colour, no shading gradients at the edges.
1) face-ojisan.png : deeply sun-tanned skin colour #C98E62, a cheerful weathered island fisherman of about 55, thick bushy grey eyebrows, small kind eyes with crow's feet, a wide toothy grin, light grey stubble around the mouth and chin." ;;
oneesan) gen "face-oneesan" "The image is a FACE DECAL texture to be projected onto the front of a low-poly head: the whole square is filled edge to edge with one flat skin colour, and the facial features are painted in the centre in a simple gentle early-2000s Japanese anime game style. Eyes at about 55% height, eyes spaced apart with about 30% of the image width between them, small nose hint, small mouth at about 28% height, thin eyebrows. NO hair, NO ears, NO head outline, NO neck, NO background other than skin colour, no shading gradients at the edges.
1) face-oneesan.png : pale skin colour #F6DCC6, a calm mysterious young woman of about 22, slightly narrow long-lashed dark grey-blue eyes with a gentle downward tilt, a faint knowing closed-mouth smile, one tiny beauty mark under her left eye, soft pink lips." ;;
faces) gen "face-boy face-kouta face-nagisa face-kotoha face-granny" "Each image is a FACE DECAL texture to be projected onto the front of a low-poly head: the whole square is filled edge to edge with one flat skin colour, and the facial features are painted in the centre in a simple gentle early-2000s Japanese anime game style. Eyes at about 55% height, eyes spaced apart with about 30% of the image width between them, small nose hint, small mouth at about 28% height, thin eyebrows. NO hair, NO ears, NO head outline, NO neck, NO background other than skin colour, no shading gradients at the edges.
1) face-boy.png : skin colour #F1C9A4, a calm kind 17-year-old boy, dark brown eyes, slight smile.
2) face-kouta.png : sun-tanned skin colour #D9A57C, an energetic cheerful 17-year-old surfer boy, thick eyebrows, big grin.
3) face-nagisa.png : skin colour #F1C9A4, a bright lively 17-year-old girl, large brown eyes, open happy smile.
4) face-kotoha.png : skin colour #F4D2B4, a quiet gentle 17-year-old girl, dark violet-grey eyes, thin round glasses, tiny soft smile.
5) face-granny.png : skin colour #E8C09A, a kind smiling old woman with closed crescent eyes, laugh wrinkles." ;;
clothes) gen "top-shirt top-sailor top-kappogi skirt-pleats cloth-navy" "Each is a flat straight-on orthographic texture filling the entire image edge to edge with fabric, no body parts, no background.
1) top-shirt.png : the front of a white short-sleeve Japanese school summer uniform shirt (torso only, no sleeves): collar at the top centre, button placket down the middle, one chest pocket, fabric fills the entire square including corners.
2) top-sailor.png : the front of a white Japanese summer sailor school uniform blouse (torso only): navy sailor collar with white stripes at the top, a navy-blue ribbon scarf in the centre, white fabric fills the entire square including corners.
3) top-kappogi.png : the front of a white Japanese kappogi apron smock over a pale indigo kimono collar, fabric fills the entire square.
4) skirt-pleats.png : navy-blue pleated school skirt fabric, vertical pleats, seamless tileable.
5) cloth-navy.png : plain dark navy school trouser fabric with subtle weave, seamless tileable." ;;
town) gen "tin-roof house-front2 noticeboard manhole garden-flowers" "Items 1-3 are flat straight-on orthographic views filling the entire image edge to edge.
1) tin-roof.png : old corrugated tin roof sheets painted faded red-brown with rust streaks, ridges running vertically, seamless tileable.
2) house-front2.png : front wall of a 1980s Japanese house: off-white mortar wall with a brown aluminium sliding entrance door with frosted glass in the middle, a small porch light, and an aluminium sash window with a lace curtain to the right.
3) noticeboard.png : a Japanese neighbourhood community notice board face: green felt board with several pinned paper notices and a faded festival poster, no readable text.
4) manhole.png : a round cast-iron Japanese manhole cover seen from directly above with a wave and camellia flower relief pattern, on a fully transparent background (real alpha), circle touching the image edges.
5) garden-flowers.png : a bushy red hibiscus shrub with green leaves seen from the side, painterly, on a fully transparent background (real alpha), no ground, no shadow." ;;
esac; done
