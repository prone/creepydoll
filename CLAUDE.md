# Creepy Doll — code patterns and invariants

One file (`game.js`), zero dependencies, everything drawn from pixel strings.
These are the rules the file already follows; keep following them.

## Hard invariants (breaking these breaks saves, layouts, or the test suite)

- **Seeded RNG stream.** Level layouts come from `rng()`/`rint()` with a fixed
  seed per generator. Any edit inside a `gen*()` function must preserve the
  exact **order and count** of `rng()` calls, or every later layout decision
  shifts. Never gate a spawn on `rng() < p` mid-sequence (the LCG has
  call-position parity that can starve one branch every single run) — decide
  spawns with counters or `tileNoise(x, salt)`, which is a pure hash.
- **Headroom rule.** Every generator calls `headroomPass()`: no platform
  (tile 2) may leave less than two tiles of standing air over solid ground.
  Call position within each generator matters — don't reorder it.
- **Test-visible surface.** `test/e2e.js` reaches into top-level bindings
  (`player`, `boss`, `mini`, `dag`, `candel`, `checkpoints`, `doors`,
  `enemies`, `assist`, `dog`, `kid`, `level`, `state`, …) and their field
  names, including `boss.phase`/`boss.kind`/`mini.kind` string values and
  `carrying` item names. Renaming any of these is a breaking change; mutate
  the existing array/object bindings (`arr.length = 0`), never reassign them.
- **localStorage** (`creepydoll-assist`) is loaded field-by-field with
  validation, never merged wholesale — stored data is untrusted.

## Established patterns (extend these, don't invent parallels)

- **Tiles:** `map[r][c]` — 0 empty, 1 ground/stone, 2 platform (one-way-ish
  décor rules apply), 3 furniture (solid, vaultable), 4 tree trunk (solid,
  root arch beneath). New solid kinds get the next integer plus a `drawTiles`
  branch.
- **A level is:** `gen<Name>()` (terrain → doors → enemies → `headroomPass()`
  → `placeHeartOverGap()` → `placeCheckpoints(30, 30)` → `houseX`/`FINALE_GY`
  → `resetKid()`), a `draw<Name>Background(st)`, a checkpoint-marker branch in
  `drawCheckpoints`, a finale-landmark branch in `drawHouse`, plus per-level
  entries for music (`scheduleMusic`), ambients (`playAmbient`), and glimpse
  lines (`updateKid`).
- **An enemy is:** a `make<Kind>()` factory (with `flashT`, `lastHit`,
  `placed` where ground-settled), an update branch in `updateEnemies` (use
  `edgeTurn(e, bounds, walls, resetDash)` for patrol turning), an entry in
  `ENEMY_SPRITES` for drawing, and a line in `killEnemy`'s score table.
  Small vermin (ant/roach/scarab) deal 0.5 hearts and die on a landed bite;
  a bite "landed" iff `player.invuln === 80` right after `hurtPlayer`.
- **A boss is:** a `boss.kind`, specs in `startBoss`, a fight branch in
  `updateBoss`, an outro chain in `updateBossOutro` (phase strings are
  test-visible), and a `draw<Kind>` + arena + entities trio dispatched at the
  top of `drawBoss`. Fetch-and-throw weapons go through the `RELICS` table
  (`updateRelicFlight`/`relicPickOrThrow`).
- **Feedback ("juice"):** meaningful actions hit at least three channels —
  `addShake`, a `burst` (directional via dx/dy args), and an `sfx`. Held
  flash messages (`{ hold: true }`) outrank stage/dog lines.
- **Assist mode** must keep working for every new mechanic: `assist.calm`
  suppresses shakes/flashes, `assist.speed` gates all update loops through
  `speedAcc`, damage paths respect `assist.invuln`/`assist.hearts`.

## Testing rules (hard-won; see also the e2e file's own header)

- The game polls `keys{}` per frame: in tests, hold taps ≥3 frames (`tap()`),
  and **position-then-act must happen inside one `page.evaluate`** — CDP
  roundtrips let entities drift between calls.
- A still-active `player.attack` blocks a new one; set `player.attack = null`
  before dispatching an attack key in a probe.
- Prefer relative assertions (hp deltas, position deltas) with bounded
  retries over absolute values — absolute chains cascade on one miss.
- Every feature lands with e2e checks, and `npm test` must be green before
  every commit; push immediately after committing.
