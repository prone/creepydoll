# Creepy Doll

An 8-bit style platformer. You are a porcelain doll on a long walk through the night —
and the further she goes, the worse she looks. Scratches spread across her face, her
dress gets filthier, a button eye goes missing, and the music box she walks to slowly
drifts out of tune.

At the end of the road a healthy kid is standing outside a dollhouse.
**She only wants to touch them.** Tag the kid to win.

![Title screen](screenshots/title.png)

## Play

No build, no dependencies — open `index.html` in any browser, or:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Press any key on the title screen to wake her (this also starts the music —
browsers require a keypress before audio can play), then **Enter** to begin.

## Controls

| Key | Action |
|-----|--------|
| ← / → (or A / D) | walk |
| Space (or ↑ / W) | jump |
| Z (or J) | punch |
| X (or K) | kick |
| C | crouch (toggle) |
| ↓ (or S), held 2s | charge a power jump |
| ↑ at a glowing door | enter a minigame world |
| Esc | pause / resume |

That's everything she can do. Crouching shrinks her, lets her duck under
swooping bats, and slows her walk to a wary shuffle. Holding ↓ on the
ground makes her coil up — after two seconds she trembles, and the next
jump launches her about twice as high.

## The rules of the night

- **Enemies:** bats swoop at you, spiders drop from silk threads, snakes patrol the
  ground (snakes take two hits). Punch or kick them before they touch you.
  Defeating a bat gives one heart back if she's hurt. A spider's silk thread can be
  struck instead of the spider — three hits snap the web, the spider dies with it,
  and it's worth 200 points.
- **Hearts:** she starts with five, and there is **no ceiling** — every heart
  she earns appends a new container to the HUD (rows of ten). Defeating a bat
  always feeds her one, and **every minigame win grants a heart** (the doll
  toss pays one per bucket landed — three buckets, three hearts). Enemy
  contact costs one. Falling into a pit costs a heart too — after a second in
  the dark, the last lit lantern pulls her back. On her last heart, the dark
  keeps her.
- **Lanterns:** checkpoint posts stand every couple of screens. Walking past one
  lights it and saves her spot for the next fall.
- **Lost button eyes:** five are hidden along the road — on platform tops, over
  ravines, one impossibly high, one behind the dollhouse, and one somewhere the
  wall is cracked. Entirely optional: 200 points each, and finding any four of
  the five is worth an extra +1000 at the end... and she gets to see again.
- **Creep meter:** advancing through the level raises her creepiness through four
  stages. Each stage cracks the porcelain a little more, stains the dress, reddens
  the moon — and sours the lullaby. Losing every heart wipes it: the retry starts
  her porcelain-clean (ink melt included), and she earns the cracks all over again.
- **The goal:** reach the dollhouse at the end. The kid will run. Catch them.
- **Carnival doors:** three glowing doorways stand along the road, a few screens
  apart. Press **↑** in front of one to step into a minigame world (each door
  works once):
  - **Doll Toss** — golf-style throw: Z locks the slow power meter (a dotted
    arc previews the flight), then Z confirms the toss — or X re-aims while
    the bucket keeps moving. Up to +900.
  - **Dart & Balloon** — aim with ↑/↓, throw darts with Z. Pop three of four
    balloons to win. When a balloon pops... it wasn't air in there.
  - **Coffin Shuffle** — watch which coffin hides the heart, follow it through
    the shuffle, open it with Z. Right guess heals a heart, +200.
- **The dragon:** survive a minute and a purple dragon with no eyes arrives and
  follows her. Jump onto its back to ride and fly freely (arrows). While flying,
  **punch (Z)** breathes a short gust of flame and **kick (X)** spits a flame
  ball that roasts anything it touches. Press **C** to hop off.
  Flight has a price: while she rides, spectral **valkyries** climb into the
  night after her — up to three at a time, spear-first, tougher than bats
  (300 points each). Dismount and they withdraw into the dark above.

- **The alien invasion:** every so often a silver door that should not be there
  appears on the road ahead, full of stars, counting down. Reach it within
  three seconds and a **flying saucer** takes her: +5 borrowed hearts (shown
  green), free flight on the arrows, **Z** fires laser beams, **C** bails out.
  The **tractor beam** under the dome lifts any enemy she hovers over —
  press **X** to fire the passenger back out as a projectile (a jet downed
  this way still pays +300).
  The military notices — two to five jet fighters scramble and lob missiles
  that mostly miss. Lasering a jet is worth 300. Near the end of the level the
  saucer starts smoking: eject in time, or the explosion costs a heart. Either
  way the borrowed hearts go home — though every heart she owned before
  boarding walks out with her. Aboard, the music box gives way to a
  thumping little eurodance number.
- **Porcelain shards:** once she reaches full creep, every kick also flings a
  spinning shard of her own porcelain — a short-range thrown weapon that
  hurts whatever it lands on, dog included.
- **Level 2 — his house:** tag the kid and he slips away, runs home, and slams
  the door. She knows the way. Inside: a properly lit house — chandelier over
  the landing, sconces, windows onto the night — with oak tables to jump,
  shelves to climb, and candle checkpoints. Jumping the first table wakes the
  **dog**, and it chases her the rest of the way, hopping the furniture. One
  landed bite and it trots off satisfied; land three hits first and it runs
  off barking (+250). Either way, this is its house — ten seconds later
  it's back for more. The walls hold ants, cockroaches, rats, and
  ceiling spiders. A slow waltz plays, cozy with something wrong underneath.
  Corner the boy at his bedroom door to end it — this time there's nowhere
  left to run.
- **The boss:** at his bedroom door, the boy is not a boy. He towers, Dracula-
  pale, and looses bats at her while lightning stutters past the window. Jump
  onto a bat mid-flight to knock it down, pick it up with punch or kick, and
  throw it back with the same button — three hits break the spell. Each wound
  makes him bloodier and faster, and the storm answers. Stomped cockroaches
  work as ammo too. Beaten, he shrinks back into a boy, laughs, and runs out
  the door — which stays open just long enough for a cat to wander in, meowing.
  Level three, the forest, is coming.
- **Level 3 — the deep woods:** past the house, the trees are tall and the dark
  is old. Rocky ground and ravines, giant trees with root arches to run beneath
  and branches to climb, will-o-wisp checkpoints, bears, wolves, and mountain
  lions — and four standing-stone minigames: the Fortune Teller (match the
  tarot pairs), the Bell Toll (strike gold), the Crow Gallery (they hop), and
  the Grave Dig (mash before the marker runs out).
- **The werewolf:** at the old chapel, under a moon with nothing missing from
  it, the boy is gone again. He stalks on all fours and claws when she strays
  close. Her only weapon is a **silver candelabra**: punch to lift it, punch to
  throw it — and every hit knocks it flying, so she must dodge around him to
  fetch it. Four wounds, each tearing his clothes and bloodying him further,
  and he crumples — a naked hairy beast — turns back into the boy, and breaks
  THROUGH the chapel wall into the night. And still he runs.
- **Level 4 — the snowy mountain:** the climb. Stepped shelves rise from the
  valley floor to a summit plateau across crevasses, through snowfall that
  **thickens with every step she climbs** — by the summit the whiteout takes
  half the view, and drifts pile deep on every surface. The packed snow
  barely grips: she builds speed gradually and glides a little after every
  stop. **Ice ledges** hang along the climb with icicles beneath — strike
  one and a few seconds later it comes down on whatever stands under it.
  Charging mountain goats, diving snowy owls, and wolves in winter coats
  patrol the shelves, with frozen crystals for checkpoints. In the ice cave at the top the boy is
  a **yeti** — strike the hanging icicles mid-jump to drop them on his head,
  kick the standing ones so they skid into him, or use your fists at half
  power. Beaten, he escapes down a tunnel.
- **Level 5 — the tomb:** torchlit sandstone corridors under a ceiling of old
  stone: pit traps, fallen pillars, mummies, scarabs, and cobras — and three
  doorways: the Glyph Rite (say the wall's four words back), the Scarab Race
  (back the right beetle), and the Spear Gauntlet (dash the gates while the
  spears are up). At the burial door the boy wears a god's gold face: the
  **Aztec god** throws skulls in arcs while she fetches and throws an
  silver-and-jade dagger thrown in a true arc — every hit cracks his mask,
  and the dagger drops right where it struck, waiting in the danger zone. Four hits and the mask falls, and the boy slips into the dark
  behind the sarcophagus. And still he runs.
- **Achievements:** nineteen of them, from TAG. YOU'RE IT. to AND STILL HE
  RUNS — bosses, rides, minigame sweeps, a deathless level, ten hearts, and
  more. Unlocks announce themselves with a gold banner, persist across
  deaths and sessions, and press **Tab** on the pause screen to see the
  list and your **completion %**.
- **Her lost parts:** beyond level 1's button eyes, each level hides one
  keepsake of hers — her braids in the house, her ivory teeth in the woods,
  her fingernails in the snow, and her porcelain heart in the tomb. Each is
  tucked somewhere high in the back half, glinting faintly, worth +500 and
  an achievement.
- **Cheats:** press **Esc** — the pause screen asks for the cheat password
  (someone who knows it will tell you; it's case-sensitive). Once unlocked
  (↑/↓ pick, ←/→ set): invincibility, game speed (100/80/60%), infinite
  hearts, reduced flash (no screen shake or hit-strobe), skip-minigames
  (Enter walks straight out of one), **warp to any level** (dial the
  level, Enter jumps), and **summon a ride** — pick the dragon or the
  flying saucer and Enter drops her straight into the saddle, any level,
  mid-run. The unlock and your choices persist between sessions.
- **One-way platforms:** thin wooden platforms and branches never block her —
  walk beneath them freely, jump up through them, and land on top. Only
  ground, furniture, and tree trunks are truly solid.

![Mid-level](screenshots/midgame.png)
![The chase](screenshots/endgame.png)

## Tests

An end-to-end suite drives the real game in headless Chromium with real
keyboard input — movement, crouch, combat, the juice layer (screen shake,
hit-flash, squash & stretch), the heart rules, pause, checkpoints and the pit,
all three minigame worlds, the dragon, and the final chase.

```sh
npm install
npx playwright install chromium   # first time only
npm test
```

## Tech

Single `game.js`, plain canvas 2D at 320×176 internal resolution, integer-scaled with
`image-rendering: pixelated`. Updates run on a fixed 60 Hz timestep with capped
catch-up steps, so a throttled browser (low-power mode, 30 Hz panels) slows the
frame rate but never the game. All sprites are authored as pixel strings and rendered to
offscreen canvases at load; the doll's four decay stages are overlay layers composited
onto the same base sprite. Music and sound effects are generated with the Web Audio
API (a triangle-wave "music box" lullaby over a low detuned drone — the melody gains
random detune as the creep stage rises).
