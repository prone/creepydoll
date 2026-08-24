/* ============================================================
   CREEPY DOLL — an 8-bit platformer
   The further she goes, the worse she looks.
   No dependencies. Everything is drawn from pixel strings.
   ============================================================ */
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = 320, VIEW_H = 176, TILE = 16;
const MAP_H = 11;               // rows
const MAP_W = 220;              // columns
const LEVEL_W = MAP_W * TILE;

// Integer-scale the canvas to fit the window.
function fitCanvas() {
  const s = Math.max(1, Math.floor(Math.min(
    window.innerWidth / VIEW_W, (window.innerHeight - 40) / VIEW_H)));
  canvas.style.width = (VIEW_W * s) + 'px';
  canvas.style.height = (VIEW_H * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/* ---------------- deterministic RNG (level layout) ---------------- */
let rngState = 0xC0FFEE;
function rng() {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}
function rint(a, b) { return a + Math.floor(rng() * (b - a + 1)); }

/* ---------------- sprite builder ---------------- */
function sprite(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x, y, 1, 1);
    }
  return c;
}
function overlay(base, rows, pal) {
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x, y, 1, 1);
    }
  return c;
}

/* ---------------- the doll ---------------- */
const DOLL_PAL = {
  H: '#6d3326',  // yarn hair
  h: '#57281e',  // hair shade
  S: '#efe2cf',  // porcelain
  s: '#d9c8b2',  // porcelain shade
  E: '#171717',  // button eye
  M: '#8c2f39',  // stitched mouth
  R: '#d89090',  // cheek
  D: '#5b7ea3',  // dress
  d: '#48657f',  // dress shade
  W: '#e8e4da',  // apron
  L: '#e5d8c4',  // legs
  B: '#20242c',  // shoes
};

const DOLL_HEAD = [
  '..HHHHHHHHHH..',
  '.HHHHHHHHHHHH.',
  '.HhSSSSSSSShH.',
  '.HSSSSSSSSSSH.',
  '.HSEESSSSEESH.',
  '.HSEESSSSEESH.',
  '.HSSSSSSSSSSH.',
  '.HRSSMMMMSSRH.',
  '..SSSSMMSSSS..',
  '...SSSSSSSS...',
];
const DOLL_BODY = [
  '.SDDDDDDDDDDS.',
  'SSDDDDDDDDDDSS',
  'SSDDWWWWWWDDSS',
  '.SDDWWWWWWDDS.',
  '..DDDDDDDDDD..',
  '.DdDDDDDDDDdD.',
];
const LEGS_IDLE = [
  '...LL...LL....',
  '...LL...LL....',
  '...LL...LL....',
  '..BBB...BBB...',
];
const LEGS_WALK1 = [
  '..LL.....LL...',
  '..LL......LL..',
  '.LL.......LL..',
  'BBB.......BBB.',
];
const LEGS_WALK2 = [
  '....LL..LL....',
  '....LL..LL....',
  '....LL..LL....',
  '...BBB..BBB...',
];
const LEGS_JUMP = [
  '...LL....LL...',
  '..LL......LL..',
  '..BBB....BBB..',
  '..............',
];
const LEGS_CROUCH1 = [
  '..LLL...LLL...',
  '.BBB....BBB...',
];
const LEGS_CROUCH2 = [
  '...LLL..LLL...',
  '..BBB...BBB...',
];

// Cumulative decay overlays — one per creepiness stage (14 x 20 grids).
const DECAY_PAL = {
  c: '#3b3b3b',  // crack
  k: '#101010',  // deep crack / hollow
  g: '#4a4238',  // grime
  x: '#7a1f1f',  // dark stitches
  m: '#2a2e26',  // mold stain
};
const DECAY = [
  // stage 0 — pristine
  [],
  // stage 1 — first scratches, a little dirt
  [
    '..............',
    '......c.......',
    '......c.......',
    '.......c......',
    '..............',
    '..............',
    '..........c...',
    '..............',
    '..............',
    '..............',
    '..............',
    '....g.........',
    '..............',
    '.........g....',
    '...g..........',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  // stage 2 — cracked face, one button eye torn off, stained dress
  [
    '..............',
    '......c.......',
    '......c..c....',
    '.......cc.....',
    '..kk...c......',
    '..xk..........',
    '...x..........',
    '..............',
    '..............',
    '..............',
    '..g...........',
    '....g....gg...',
    '..gg..........',
    '.........gg...',
    '...gg....g....',
    '.g........g...',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  // stage 3 — split porcelain, hollow eyes, the smile widens
  [
    '.....c........',
    '.....cc.......',
    '......c..c....',
    '..c....cc..c..',
    '..kk..c..kk...',
    '..kk......kk..',
    '...c...c......',
    '.xx........xx.',
    '..x........x..',
    '..............',
    '.mg...........',
    '..ggg....gg...',
    '..gmg...ggg...',
    '...gg..gmg....',
    '..mgg....gg...',
    '.gg....gg..g..',
    '..............',
    '....m.........',
    '..............',
    '..............',
  ],
];

function buildDollFrames() {
  const stages = [];
  for (let st = 0; st < 4; st++) {
    const mk = legs => {
      let base = sprite(DOLL_HEAD.concat(DOLL_BODY, legs), DOLL_PAL);
      for (let i = 1; i <= st; i++) base = overlay(base, DECAY[i], DECAY_PAL);
      return base;
    };
    stages.push({
      idle: mk(LEGS_IDLE),
      walk: [mk(LEGS_WALK1), mk(LEGS_WALK2)],
      jump: mk(LEGS_JUMP),
      crouch: [mk(LEGS_CROUCH1), mk(LEGS_CROUCH2)],  // 18px tall
    });
  }
  return stages;
}
const DOLL = buildDollFrames();

/* ---------------- enemies ---------------- */
const BAT_PAL = { X: '#3a2c4a', x: '#2a1f38', e: '#ff3040' };
const BAT_FRAMES = [
  sprite([
    'XX..........XX',
    'XXX........XXX',
    '.XXX.XXXX.XXX.',
    '..XXXXxxXXXX..',
    '...XXeXXeXX...',
    '....XXXXXX....',
    '.....X..X.....',
  ], BAT_PAL),
  sprite([
    '..............',
    '..X........X..',
    '.XXX.XXXX.XXX.',
    'XXXXXXxxXXXXXX',
    'XX.XXeXXeXX.XX',
    '....XXXXXX....',
    '.....X..X.....',
  ], BAT_PAL),
];

const SPIDER_PAL = { B: '#1c1b22', b: '#33303e', e: '#ff3040', L: '#26242e' };
const SPIDER_FRAMES = [
  sprite([
    'L..L....L..L',
    '.L.L....L.L.',
    '.LBBBBBBBBL.',
    'L.BbBBBBbB.L',
    '..BeBBBBeB..',
    '..BBBBBBBB..',
    '.L.BBBBBB.L.',
    'L...L..L...L',
  ], SPIDER_PAL),
  sprite([
    '.L.L....L.L.',
    'L..L....L..L',
    '.LBBBBBBBBL.',
    '..BbBBBBbB..',
    'L.BeBBBBeB.L',
    '..BBBBBBBB..',
    '..L.BBBB.L..',
    '.L...LL...L.',
  ], SPIDER_PAL),
];

const VALK_PAL = { W: '#e8e4f4', H: '#e8c66a', S: '#d8c8c8', E: '#ff3040',
                   A: '#c9cede', a: '#8f95a8' };
const VALK_FRAMES = [
  sprite([
    '..WW........WW..',
    '.WWW...HH...WWW.',
    '.WWW..HHHH..WWW.',
    '..WW..ESSE..WW..',
    '......SSSS......',
    '.....AAAAAA.....',
    '....AAaAAaA.....',
    '.....AAAAAA.....',
    '.....AA..AA.....',
    '.....A....A.....',
  ], VALK_PAL),
  sprite([
    '................',
    '.......HH.......',
    '......HHHH......',
    '..W...ESSE...W..',
    '.WW...SSSS...WW.',
    '.WWW.AAAAAA.WWW.',
    '..WWWAAaAAaAWW..',
    '.....AAAAAA.....',
    '.....AA..AA.....',
    '.....A....A.....',
  ], VALK_PAL),
];

const SNAKE_PAL = { G: '#3f7a3a', g: '#2e5c2b', y: '#c9d26b', e: '#ff3040', t: '#d04a4a' };
const SNAKE_FRAMES = [
  sprite([
    '..................GG....',
    '.................GGGG...',
    '.....GGG.........GeGG.t.',
    '...GGgggGG......GGGGG.tt',
    '..GGg....gGG...GGgG.....',
    '.GGg.......gGGGGgG......',
    'yGG..........ggg........',
    'yy......................',
  ], SNAKE_PAL),
  sprite([
    '..................GG....',
    '.................GGGG...',
    '.........GGG.....GeGG...',
    '.......GGgggG...GGGGG...',
    '.....GGg....gG.GGgG..t..',
    '..GGGg.......gGGgG...t..',
    'yGGg..........gg........',
    'yy......................',
  ], SNAKE_PAL),
];

// the house's own tenants (level 2)
const ANT_PAL = { A: '#2a1c14', a: '#3e2c1e' };
const ANT_FRAMES = [
  sprite([
    'AA.AA.',
    'AAAAAA',
    'a.a.a.',
  ], ANT_PAL),
  sprite([
    'AA.AA.',
    'AAAAAA',
    '.a.a.a',
  ], ANT_PAL),
];

const ROACH_PAL = { R: '#5a3a1e', r: '#7a4e28', L: '#3a2812' };
const ROACH_FRAMES = [
  sprite([
    '.rrrrrr..L',
    'RRRRRRRr.L',
    'RRRRRRRRL.',
    '.L.L.L....',
  ], ROACH_PAL),
  sprite([
    '.rrrrrr..L',
    'RRRRRRRr.L',
    'RRRRRRRRL.',
    'L.L.L.L...',
  ], ROACH_PAL),
];

const RAT_PAL = { G: '#6a6272', g: '#524a5c', p: '#c98f9a', e: '#ff3040', t: '#8a6a70' };
const RAT_FRAMES = [
  sprite([
    '...ggGGGg.....',
    'ttgGGGGGGGg...',
    't.GGGGGGGGGpe.',
    '..gGGGGGGGGp..',
    '..g.gg..gg.p..',
  ], RAT_PAL),
  sprite([
    '...ggGGGg.....',
    't.gGGGGGGGg...',
    'ttGGGGGGGGGpe.',
    '..gGGGGGGGGp..',
    '...gg.gg..gg..',
  ], RAT_PAL),
];

/* ---------------- the healthy kid (NPC) ---------------- */
const KID_PAL = {
  C: '#c9903a',  // cap
  c: '#a3722c',  // cap shade
  S: '#e8b48c',  // healthy skin
  E: '#2a1c10',  // eye
  M: '#a05a3a',  // smile
  Y: '#d8c23a',  // bright shirt
  P: '#3a5cc9',  // jeans
  p: '#2c47a0',  // jeans shade
  s: '#e8e8e8',  // sneakers
  '!': '#f0e040', // alarm
};
const KID_HEAD = [
  '...CCCCCCCC...',
  '..CCCCCCCCCC..',
  '..cccccccccc..',
  '..SSSSSSSSSS..',
  '..SSESSSSESS..',
  '..SSSSSSSSSS..',
  '..SSSSMMSSSS..',
  '...SSSSSSSS...',
];
const KID_BODY = [
  '..YYYYYYYYYY..',
  '.YYYYYYYYYYYY.',
  '.SYYYYYYYYYYS.',
  '.SYYYYYYYYYYS.',
  '..YYYYYYYYYY..',
  '..PPPPPPPPpP..',
  '..PPPPPPPPpP..',
];
const KID_LEGS_IDLE = [
  '...PP...PP....',
  '...PP...PP....',
  '...PP...PP....',
  '..sss...sss...',
  '..............',
];
const KID_LEGS_RUN1 = [
  '..PP.....PP...',
  '.PP.......PP..',
  'PP.........PP.',
  'sss........sss',
  '..............',
];
const KID_LEGS_RUN2 = [
  '....PP..PP....',
  '....PP..PP....',
  '...PP....PP...',
  '..sss....sss..',
  '..............',
];
const KID_FRAMES = {
  idle: sprite(KID_HEAD.concat(KID_BODY, KID_LEGS_IDLE), KID_PAL),
  run: [
    sprite(KID_HEAD.concat(KID_BODY, KID_LEGS_RUN1), KID_PAL),
    sprite(KID_HEAD.concat(KID_BODY, KID_LEGS_RUN2), KID_PAL),
  ],
};

const kid = {
  x: 0, y: 0, w: 10, h: 18, vx: 0, vy: 0,
  onGround: false, face: -1,
  stage: 'roam',   // roam (glimpses ahead, untouchable) | final (the real chase)
  mode: 'hidden',  // roam: hidden | peek | sprint   final: idle | flee | cornered
  hideT: 0, glimpseT: 0, seen: false, glimpses: 0,
  animT: 0, alarmT: 0,
};

// what passes through her head, one glimpse at a time
const GLIMPSE_LINES = [
  '...a friend?',
  'wait. come see her.',
  'why do they always run?',
  'she just wants to play.',
  'almost. almost.',
];
// and once she is inside his house
const HOUSE_GLIMPSE_LINES = [
  'he is home. now so is she.',
  'what a nice house this is.',
  'his room must be close.',
  'no more running after this one.',
  'she can already see his door.',
];

/* ---------------- level ---------------- */
// map[r][c]: 0 empty, 1 ground, 2 platform, 3 furniture (solid wood)
let map = [];
const enemies = [];
let houseX = 0;         // level 1: the dollhouse. level 2: the boy's bedroom door.
let level = 1;          // 1: the road outside. 2: inside the boy's house.
const tables = [];      // level 2: world-x of each table she must jump

// a lone heart floating over the second ravine — heals one heart, once
const heartPickup = { x: 0, y: 0, taken: false, t: 0 };

// five lost button eyes — four hidden in the overworld, one in the hollow.
// finding any four of them is enough; the fifth is for the thorough.
const eyePickups = [];
let eyesFound = 0;
const EYES_TOTAL = 4;

// carnival doorways into minigame worlds (press Up to enter, once each)
const doors = [];
const DOOR_KINDS = ['toss', 'balloon', 'coffin'];

// lantern checkpoints — passing one lights it and saves the spot
const checkpoints = [];
const lastCP = { x: 40, y: 100 };

// the eyeless dragon — purple like a bruise, appears after a minute
const dragon = { spawned: false, active: false, ridden: false,
                 x: 0, y: 0, w: 30, h: 13, vx: 0, vy: 0, face: 1, t: 0,
                 gustCd: 0, ballCd: 0, valkT: 0, valkSeen: false, mountCd: 0 };

// the house dog — woken by the first table, never far behind after that.
// three good hits and it barks, thinks better of it, and runs — but this is
// its house: ten seconds later it comes back.
const dog = { active: false, x: 0, y: 0, w: 16, h: 10, vx: 0, vy: 0,
              face: 1, t: 0, onGround: false, retreatT: 0, barkCd: 0,
              lastHit: -1, hp: 3, deadT: 0, fleeT: 0, flashT: 0 };
const fireballs = [];
let playTime = 0;

function genLevel() {
  if (level === 2) genHouse();
  else genOutside();
}

function genOutside() {
  map = [];
  enemies.length = 0;
  tables.length = 0;
  rngState = 0xC0FFEE;
  for (let r = 0; r < MAP_H; r++) map.push(new Array(MAP_W).fill(0));

  // ground with gaps
  let c = 0;
  while (c < MAP_W) {
    let run = rint(8, 16);
    if (c < 12) run = 14;                       // safe start
    if (c + run > MAP_W - 14) run = MAP_W - c;  // solid finale
    for (let i = 0; i < run && c + i < MAP_W; i++) {
      map[9][c + i] = 1; map[10][c + i] = 1;
    }
    const segStart = c, segEnd = Math.min(c + run, MAP_W) - 1;

    // populate the segment
    if (segStart > 12 && segEnd < MAP_W - 16 && run >= 6) {
      const roll = rng();
      if (roll < 0.45) {
        enemies.push(makeSnake((segStart + 2) * TILE, segEnd));
      } else if (roll < 0.7) {
        enemies.push(makeSpider(rint(segStart + 2, segEnd - 2) * TILE, 0));
      }
      if (rng() < 0.5) {
        enemies.push(makeBat(rint(segStart, segEnd) * TILE, rint(40, 90)));
      }
    }
    c += run;
    if (c >= MAP_W - 14) break;

    // gap
    const gap = rint(2, 3);
    if (rng() < 0.4) {  // platform bridging the gap
      const pr = rint(6, 7);          // ends over ground are culled by the headroom pass
      for (let i = -1; i <= gap; i++)
        if (c + i >= 0 && c + i < MAP_W) map[pr][c + i] = 2;
    }
    c += gap;
  }

  // floating platforms with occasional spiders beneath
  // (never lower than row 6 — she must be able to walk under them standing)
  for (let i = 0; i < 26; i++) {
    const pc = rint(14, MAP_W - 20), pr = Math.min(6, rint(5, 7)), len = rint(3, 5);
    let clear = true;
    for (let j = 0; j < len; j++)
      if (map[pr][pc + j] || map[pr + 1] && map[pr + 1][pc + j] === 2) clear = false;
    if (!clear) continue;
    for (let j = 0; j < len; j++) map[pr][pc + j] = 2;
    if (rng() < 0.35)
      enemies.push(makeSpider((pc + (len >> 1)) * TILE, (pr + 1) * TILE));
  }

  // headroom pass: no platform may leave less than two tiles of standing
  // air over solid ground — she (and the boy) must fit underneath upright
  for (let r = 2; r < MAP_H - 2; r++)
    for (let cc = 0; cc < MAP_W; cc++)
      if (map[r][cc] === 2 && map[r + 2][cc]) map[r][cc] = 0;

  // hand-tweak: the spider platform at the first snake encounter sat one
  // tile too high (row 5, cols 56-58) — drop it to row 6 so it lines up
  // with the neighboring ledge, and lower its spider's anchor with it
  for (let j = 56; j <= 58; j++) {
    if (map[5][j] === 2) { map[5][j] = 0; map[6][j] = 2; }
  }
  for (const e of enemies)
    if (e.kind === 'spider' && e.x === 912 && e.anchorY === 96) e.anchorY = 112;

  // hand-tweak: cut the second spider, and the platform it hung from
  // (row 6, cols 68-71 — the small ravine beneath is jumpable without it)
  for (let j = 68; j <= 71; j++) if (map[6][j] === 2) map[6][j] = 0;
  for (let i = enemies.length - 1; i >= 0; i--)
    if (enemies[i].kind === 'spider' && enemies[i].x === 1120 &&
        enemies[i].anchorY === 112)
      enemies.splice(i, 1);

  // hang the healing heart over the second ravine
  heartPickup.taken = false; heartPickup.t = 0;
  let gapCount = 0, inGap = false;
  for (let cc = 0; cc < MAP_W; cc++) {
    if (map[9][cc] === 0) {
      if (!inGap) {
        inGap = true; gapCount++;
        if (gapCount === 2) {
          let end = cc;
          while (end < MAP_W && map[9][end] === 0) end++;
          heartPickup.x = Math.round((cc + end) / 2 * TILE) - 4;
          heartPickup.y = 6 * TILE - 4;
          break;
        }
      }
    } else inGap = false;
  }

  // carnival doors every few screens, set on solid open ground
  doors.length = 0;
  [36, 100, 160].forEach((target, i) => {
    let c = target;
    while (c < MAP_W - 20 &&
           !(map[9][c] === 1 && map[9][c + 1] === 1 && !map[8][c] && !map[8][c + 1]))
      c++;
    doors.push({ x: c * TILE + 1, y: 9 * TILE - 22, w: 14, h: 22,
                 kind: DOOR_KINDS[i % DOOR_KINDS.length], used: false });
  });

  // lantern checkpoints every couple of screens, on solid open ground
  // (clear of the doors so the furniture doesn't stack)
  checkpoints.length = 0;
  for (let target = 34; target < MAP_W - 22; target += 32) {
    let c = target;
    while (c < MAP_W - 18 &&
           !(map[9][c] === 1 && !map[8][c] &&
             doors.every(d => Math.abs(d.x - c * TILE) > 40)))
      c++;
    checkpoints.push({ x: c * TILE + 4, reached: false });
  }
  lastCP.x = 40; lastCP.y = 100;

  // a hairline crack in the world, easy to walk past — the hollow
  {
    let c = 128;
    while (c < MAP_W - 20 &&
           !(map[9][c] === 1 && map[9][c + 1] === 1 && !map[8][c] && !map[8][c + 1]))
      c++;
    doors.push({ x: c * TILE + 1, y: 9 * TILE - 22, w: 14, h: 22,
                 kind: 'hollow', used: false });
  }

  houseX = (MAP_W - 6) * TILE;

  // four lost button eyes, hidden where a careful doll can reach
  eyePickups.length = 0;
  eyesFound = 0;
  outerA:                                       // atop the first floating platform
  for (let cc = 18; cc < MAP_W; cc++)
    for (let r = 4; r <= 7; r++)
      if (map[r][cc] === 2) {
        eyePickups.push({ x: cc * TILE + 4, y: (r - 2) * TILE, taken: false, t: 0 });
        break outerA;
      }
  {                                             // high over the first ravine
    let inGap = false;
    for (let cc = 0; cc < MAP_W; cc++) {
      if (map[9][cc] === 0 && !inGap) {
        let end = cc;
        while (end < MAP_W && map[9][end] === 0) end++;
        eyePickups.push({ x: Math.round((cc + end) / 2 * TILE) - 4,
                          y: 4 * TILE, taken: false, t: 0 });
        break;
      }
      inGap = map[9][cc] === 0;
    }
  }
  {                                             // impossibly high mid-road:
    let cc = Math.floor(MAP_W / 2);             // power jump or dragonback
    while (cc < MAP_W - 18 && map[9][cc] !== 1) cc++;
    eyePickups.push({ x: cc * TILE + 4, y: 24, taken: false, t: 0 });
  }
  eyePickups.push({ x: houseX + 64, y: 9 * TILE - 12, taken: false, t: 0 });  // behind the dollhouse

  // ---- pacing pass (post-generation, layout untouched) ----
  // teach first, rest at the doors, escalate through the back half,
  // and go quiet just before the dollhouse so the finale lands.
  const nearDoor = x => doors.some(d => x > d.x - 64 && x < d.x + 176);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (nearDoor(e.x) ||                                  // rest beats
        (e.x < LEVEL_W * 0.25 && e.kind !== 'snake') ||   // teaching zone
        e.x > (MAP_W - 26) * TILE)                        // breath before the end
      enemies.splice(i, 1);
  }
  // escalation: extra bats thicken toward the end of the road
  for (let cc = Math.floor(MAP_W * 0.5); cc < MAP_W - 26; cc += 7) {
    if (map[9][cc] !== 1 || nearDoor(cc * TILE)) continue;
    if (tileNoise(cc, 3) < (cc / MAP_W - 0.35) * 0.9)
      enemies.push(makeBat(cc * TILE, 36 + Math.floor(tileNoise(cc, 5) * 60)));
  }

  // the healthy kid roams ahead — glimpsed, never caught, until the end
  resetKid();
}

function resetKid() {
  kid.x = -1000; kid.y = 0;
  kid.vx = 0; kid.vy = 0;
  kid.stage = 'roam'; kid.mode = 'hidden'; kid.hideT = 240;
  kid.glimpseT = 0; kid.seen = false; kid.glimpses = 0;
  kid.face = -1; kid.animT = 0; kid.alarmT = 0;
}

/* ---------------- level 2: inside the boy's house ---------------- */
function genHouse() {
  map = [];
  enemies.length = 0;
  tables.length = 0;
  rngState = 0xD0117;
  for (let r = 0; r < MAP_H; r++) map.push(new Array(MAP_W).fill(0));

  for (let c = 0; c < MAP_W; c++) map[0][c] = 1;      // the ceiling

  // floorboards with narrow stairwell gaps
  const segs = [];
  let c = 0;
  while (c < MAP_W) {
    let run = rint(16, 26);
    if (c < 26) run = 30;                              // chandelier-lit landing
    if (c + run > MAP_W - 14) run = MAP_W - c;
    for (let i = 0; i < run && c + i < MAP_W; i++) {
      map[9][c + i] = 1; map[10][c + i] = 1;
    }
    segs.push({ s: c, e: Math.min(c + run, MAP_W) - 1 });
    c += run;
    if (c >= MAP_W - 14) break;
    c += 2;                                            // a stairwell's width
  }

  // tables — solid wood, two tiles tall; she has to jump them.
  // the first one stands just past the start. the dog is listening.
  const tableCols = [20];
  for (let tc = 48; tc < MAP_W - 40; tc += rint(26, 40)) tableCols.push(tc);
  for (const t0 of tableCols) {
    let tc = t0;
    while (tc < MAP_W - 36 &&                          // the finale hall stays clear
           !(map[9][tc] === 1 && map[9][tc + 1] === 1 && map[9][tc + 2] === 1))
      tc++;
    let clear = true;
    for (let i = 0; i < 3; i++) if (map[8][tc + i] || map[7][tc + i]) clear = false;
    if (!clear) continue;
    for (let i = 0; i < 3; i++) { map[7][tc + i] = 3; map[8][tc + i] = 3; }
    tables.push(tc * TILE);
  }

  // shelves to hop along
  for (let i = 0; i < 20; i++) {
    const pc = rint(26, MAP_W - 22), pr = rint(4, 6), len = rint(3, 5);
    let ok = true;
    for (let j = 0; j < len; j++)
      if (map[pr][pc + j] || map[pr + 1][pc + j] || map[pr - 1][pc + j]) ok = false;
    if (!ok) continue;
    for (let j = 0; j < len; j++) map[pr][pc + j] = 2;
  }

  // the infestation — gentle at first, bolder the deeper she goes.
  // the lit landing and the hall outside his room stay clear.
  for (const sg of segs) {
    if (sg.s <= 12 || sg.e >= MAP_W - 26) continue;
    const prog = sg.s / MAP_W;
    const ax = (sg.s + 2) * TILE;                      // a marching line of ants
    for (let i = 0; i < 3; i++)
      enemies.push(makeAnt(ax + i * 9, sg.s * TILE, (sg.e - 1) * TILE));
    if (prog > 0.2)
      enemies.push(makeRoach(rint(sg.s + 2, sg.e - 2) * TILE));
    if (prog > 0.4)
      enemies.push(makeRat((sg.s + 4) * TILE, sg.s * TILE, (sg.e - 1) * TILE));
    if (prog > 0.55 && tileNoise(sg.s, 11) < 0.5)
      enemies.push(makeRoach(rint(sg.s + 2, sg.e - 2) * TILE));
  }
  // spiders on long silk, down from the ceiling
  for (let cc = 40; cc < MAP_W - 30; cc += rint(18, 30))
    if (rng() < 0.5) enemies.push(makeSpider(cc * TILE, TILE));

  // same headroom rule as outside: standing room under every shelf
  for (let r = 2; r < MAP_H - 2; r++)
    for (let cc = 0; cc < MAP_W; cc++)
      if (map[r][cc] === 2 && map[r + 2][cc]) map[r][cc] = 0;

  doors.length = 0;                                    // no carnival in here
  eyePickups.length = 0;                               // her eyes were outside

  // a heart over the second stairwell
  heartPickup.taken = false; heartPickup.t = 0;
  heartPickup.x = -100; heartPickup.y = -100;
  let gapCount = 0, inGap = false;
  for (let cc = 0; cc < MAP_W; cc++) {
    if (map[9][cc] === 0) {
      if (!inGap) {
        inGap = true; gapCount++;
        if (gapCount === 2) {
          let end = cc;
          while (end < MAP_W && map[9][end] === 0) end++;
          heartPickup.x = Math.round((cc + end) / 2 * TILE) - 4;
          heartPickup.y = 6 * TILE - 4;
          break;
        }
      }
    } else inGap = false;
  }

  // candles mark the way (same souls as the lanterns outside)
  checkpoints.length = 0;
  for (let target = 30; target < MAP_W - 22; target += 30) {
    let cc = target;
    while (cc < MAP_W - 18 &&
           !(map[9][cc] === 1 && !map[8][cc] && !map[7][cc]))
      cc++;
    checkpoints.push({ x: cc * TILE + 4, reached: false });
  }
  lastCP.x = 40; lastCP.y = 100;

  houseX = (MAP_W - 6) * TILE;                         // his bedroom door
  resetKid();
}

function solidAt(px, py) {
  if (px < 0) return true;
  const cc = Math.floor(px / TILE), rr = Math.floor(py / TILE);
  if (cc >= MAP_W) return true;
  if (rr < 0 || rr >= MAP_H) return false;
  return map[rr][cc] > 0;
}

/* ---------------- entities ---------------- */
function makeBat(x, y) {
  return { kind: 'bat', x, y, w: 12, h: 7, hp: 1, t: rng() * 100,
           homeY: y, vx: 0, vy: 0, dead: 0, lastHit: -1, face: 1, flashT: 0 };
}
function makeSpider(x, anchorY) {
  return { kind: 'spider', x, y: anchorY, w: 10, h: 8, hp: 1,
           anchorY, len: rint(30, 70), t: rng() * 100, dead: 0, lastHit: -1,
           webHp: 3, lastWebHit: -1, webWobble: 0, flashT: 0 };
}
function makeValkyrie(x, y) {
  return { kind: 'valkyrie', x, y, w: 12, h: 12, hp: 2, vx: 0, vy: 0,
           t: Math.random() * 100, dead: 0, lastHit: -1, face: 1, flashT: 0 };
}

function makeSnake(x, segEnd) {
  return { kind: 'snake', x, y: 0, w: 20, h: 8, hp: 2, dir: 1,
           minX: x - TILE, maxX: (segEnd - 1) * TILE, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeAnt(x, minX, maxX) {
  return { kind: 'ant', x, y: 0, w: 6, h: 3, hp: 1, dir: 1, minX, maxX,
           t: rng() * 100, dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeRoach(x) {
  return { kind: 'roach', x, y: 0, w: 10, h: 4, hp: 1, dir: -1,
           dashT: 0, dashCd: 0, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeRat(x, minX, maxX) {
  return { kind: 'rat', x, y: 0, w: 14, h: 8, hp: 2, dir: 1, minX, maxX,
           dashT: 0, lungeCd: 0, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}

const player = {
  x: 40, y: 100, w: 10, h: 18, vx: 0, vy: 0,
  face: 1, onGround: false, hp: 5, invuln: 0, crouch: false, chargeT: 0,
  coyoteT: 99, jumpBufT: 0, pJump: false,
  stretchT: 0, squashT: 0, respawnT: 0,
  attack: null,        // {type:'punch'|'kick', t, id}
  attackId: 0,
  animT: 0, maxX: 0,
  twitch: 0,
};

const particles = [];
// dirX/dirY (optional) bias the spray so debris flies away from the blow
function burst(x, y, color, n, dirX, dirY) {
  for (let i = 0; i < n; i++)
    particles.push({ x, y,
                     vx: (Math.random() - .5) * 3 + (dirX || 0) * (0.5 + Math.random()),
                     vy: -Math.random() * 2.5 + (dirY || 0) * (0.5 + Math.random()),
                     t: 20 + Math.random() * 15, color });
}

// white-out copies of enemy frames for the hit flash
const WHITE_CACHE = new Map();
function whiten(img) {
  let w = WHITE_CACHE.get(img);
  if (!w) {
    w = document.createElement('canvas');
    w.width = img.width; w.height = img.height;
    const g = w.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w.width, w.height);
    WHITE_CACHE.set(img, w);
  }
  return w;
}

/* ---------------- audio ---------------- */
let AC = null, masterGain = null, musicTimer = null, musicStep = 0, nextNoteTime = 0;

// A broken music box: minor lullaby with a sour note. -1 = rest.
const LULLABY = [
  69, -1, 72, -1, 76, -1, 72, -1,
  69, -1, 71, -1, 68, -1, -1, -1,
  69, -1, 72, -1, 77, -1, 76, -1,
  72, -1, 71, -1, 63, -1, -1, -1,
];
const STEP_LEN = 0.30;

// inside the carnival doors: a tinny, slightly wrong waltz
const CARNIVAL = [
  50, 69, 69, 50, 69, 69, 49, 68, 68, 49, 68, 68,
  50, 69, 69, 52, 71, 71, 53, 74, 71, 50, 69, 66,
  50, 69, 69, 50, 69, 69, 55, 71, 71, 55, 70, 70,
  50, 69, 69, 52, 71, 71, 48, 67, 67, 50, 69, -1,
];
const CARNIVAL_STEP = 0.17;

// inside the house: a slow waltz, warm as lamplight, wrong as a smile
// held one beat too long. bass on the one, music box above.
const HOUSE = [
  53, 69, 72,   50, 69, 74,   53, 72, 76,   50, 74, 72,
  46, 69, 72,   51, 70, 75,   53, 72, 69,   48, 63, -1,
];
const HOUSE_STEP = 0.27;

// the boss fight: fast, low, and wrong — a tritone gnawing at the floor
const BOSS_THEME = [
  38, -1, 50, 44, 38, -1, 49, 44,
  38, -1, 50, 44, 51, 50, 49, 44,
  36, -1, 48, 42, 36, -1, 47, 42,
  41, 44, 47, 50, 53, 50, 47, 44,
];
const BOSS_STEP = 0.15;

function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function startAudio() {
  if (AC) return;
  try {
    initAudio();
  } catch (e) {
    AC = null;  // no audio support — play silent
  }
}
function initAudio() {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = AC.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(AC.destination);

  // low haunted drone
  const drone = AC.createOscillator();
  drone.type = 'sine'; drone.frequency.value = 55;
  const droneG = AC.createGain(); droneG.gain.value = 0.045;
  const wob = AC.createOscillator(); wob.frequency.value = 0.13;
  const wobG = AC.createGain(); wobG.gain.value = 4;
  wob.connect(wobG); wobG.connect(drone.frequency);
  drone.connect(droneG); droneG.connect(masterGain);
  drone.start(); wob.start();

  nextNoteTime = AC.currentTime + 0.1;
  musicTimer = setInterval(scheduleMusic, 120);
}

function musicBoxNote(midi, when, vol, detune, type, decay) {
  const o = AC.createOscillator();
  o.type = type || 'triangle';
  o.frequency.value = midiHz(midi);
  if (detune) o.detune.value = detune;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (decay || 0.9));
  o.connect(g); g.connect(masterGain);
  o.start(when); o.stop(when + (decay || 0.9) + 0.1);
}

function scheduleMusic() {
  while (nextNoteTime < AC.currentTime + 0.3) {
    if (state === 'mini' && mini && mini.kind !== 'hollow') {
      // carnival organ, cheerful in the way taxidermy is lifelike
      const m = CARNIVAL[musicStep % CARNIVAL.length];
      if (m > 0) {
        const bass = m < 60;
        musicBoxNote(m, nextNoteTime, bass ? 0.06 : 0.05,
                     (Math.random() - 0.5) * 12, 'square', bass ? 0.3 : 0.22);
        if (!bass) musicBoxNote(m + 12, nextNoteTime + 0.01, 0.015, 6, 'square', 0.2);
      }
      musicStep++;
      nextNoteTime += CARNIVAL_STEP;
    } else if (state === 'boss') {
      // his music: fast, low, tritone teeth
      const m = BOSS_THEME[musicStep % BOSS_THEME.length];
      if (m > 0) {
        musicBoxNote(m, nextNoteTime, 0.085, (Math.random() - 0.5) * 10, 'sawtooth', 0.18);
        musicBoxNote(m + 24, nextNoteTime + 0.01, 0.028, 8, 'square', 0.14);
      }
      musicStep++;
      nextNoteTime += BOSS_STEP;
    } else if (level === 2) {
      // the house waltz — cozy, with a sour lean that grows with her
      const m = HOUSE[musicStep % HOUSE.length];
      if (m > 0) {
        const bass = m < 60;
        const sour = creepStage() * 4;
        musicBoxNote(m, nextNoteTime, bass ? 0.07 : 0.06,
                     (Math.random() - 0.5) * (4 + sour), 'triangle',
                     bass ? 0.5 : 0.35);
        if (!bass)
          musicBoxNote(m + 12, nextNoteTime + 0.015, 0.018, 4, 'sine', 0.3);
      }
      musicStep++;
      nextNoteTime += HOUSE_STEP;
    } else {
      const m = LULLABY[musicStep % LULLABY.length];
      if (m > 0) {
        // the music box goes further out of tune the creepier the doll gets
        const sour = creepStage() * (Math.random() < 0.3 ? 18 : 6);
        musicBoxNote(m, nextNoteTime, 0.10, (Math.random() - 0.5) * sour);
        musicBoxNote(m + 12, nextNoteTime + 0.02, 0.03, (Math.random() - 0.5) * sour);
        // ghost echo
        musicBoxNote(m, nextNoteTime + STEP_LEN * 1.5, 0.025, -8);
      }
      musicStep++;
      nextNoteTime += STEP_LEN * (creepStage() >= 3 && Math.random() < 0.12 ? 1.6 : 1);
    }
  }
}

function sfx(freq, dur, type, vol, slide) {
  if (!AC || !masterGain) return;
  const t = AC.currentTime;
  const o = AC.createOscillator();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(vol || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + dur + 0.02);
}
const sndJump  = () => sfx(300, 0.15, 'square', 0.06, 300);
const sndPunch = () => sfx(180, 0.08, 'square', 0.07, -80);
const sndKick  = () => sfx(140, 0.1, 'square', 0.07, -70);
const sndHitE  = () => sfx(500, 0.12, 'sawtooth', 0.06, -350);
const sndHurt  = () => sfx(200, 0.3, 'sawtooth', 0.08, -150);
const sndStage = () => { sfx(880, 0.6, 'sine', 0.05, -500); sfx(87, 0.8, 'sine', 0.07); };
const sndHeal  = () => { sfx(659, 0.1, 'triangle', 0.07); setTimeout(() => sfx(988, 0.2, 'triangle', 0.06), 90); };
const sndWin   = () => { sfx(523, 0.15, 'square', 0.06); setTimeout(() => sfx(659, 0.15, 'square', 0.06), 150); setTimeout(() => sfx(784, 0.3, 'square', 0.06), 300); };

// ambient one-shots — the night making small noises around her
const AMBIENTS = [
  { minStage: 0, name: 'crow', play: () => {                 // a crow objects
      sfx(640, 0.09, 'sawtooth', 0.028, -260);
      setTimeout(() => sfx(600, 0.08, 'sawtooth', 0.024, -240), 140);
      setTimeout(() => sfx(560, 0.11, 'sawtooth', 0.02, -260), 300); } },
  { minStage: 0, name: 'wind', play: () => {                 // wind through dead trees
      sfx(110, 1.8, 'triangle', 0.022, 70);
      setTimeout(() => sfx(150, 1.4, 'triangle', 0.016, -50), 500); } },
  { minStage: 0, name: 'owl', play: () => {                  // something asks who
      sfx(392, 0.18, 'triangle', 0.03);
      setTimeout(() => sfx(330, 0.3, 'triangle', 0.028, -20), 230); } },
  { minStage: 2, name: 'laugh', play: () => {                // far off, a child laughs. probably a child.
      [880, 830, 780, 700].forEach((f, i) =>
        setTimeout(() => sfx(f, 0.07, 'square', 0.018, -60), i * 95)); } },
];
// and the house making its own (level 2)
const HOUSE_AMBIENTS = [
  { minStage: 0, name: 'creak', play: () => {                // a floorboard shifts upstairs
      sfx(120, 0.35, 'sawtooth', 0.018, 60);
      setTimeout(() => sfx(95, 0.3, 'sawtooth', 0.014, -25), 300); } },
  { minStage: 0, name: 'clock', play: () => {                // the hall clock, minding its business
      [0, 350, 700].forEach(d =>
        setTimeout(() => sfx(660, 0.05, 'square', 0.014, -30), d)); } },
  { minStage: 0, name: 'chime', play: () => {                // ...except when it chimes early
      sfx(392, 0.8, 'triangle', 0.025, -5);
      setTimeout(() => sfx(370, 0.9, 'triangle', 0.02, -8), 700); } },
  { minStage: 2, name: 'whisper', play: () => {              // the walls have opinions now
      sfx(1200, 0.5, 'sawtooth', 0.006, -700);
      setTimeout(() => sfx(1000, 0.4, 'sawtooth', 0.005, -500), 350); } },
];
let ambientCd = 600;
function playAmbient(stage) {
  const pool = (level === 2 ? HOUSE_AMBIENTS : AMBIENTS)
    .filter(a => stage >= a.minStage);
  pool[Math.floor(Math.random() * pool.length)].play();
}

/* ---------------- input ---------------- */
const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  startAudio();
  if (e.key === 'Escape') { togglePause(); return; }
  if (paused && (state === 'play' || state === 'mini' || state === 'boss')) {
    handleAssistKeys(e.key);               // the pause screen is the assist menu
    return;
  }
  if (AC && AC.state === 'suspended' && !paused) AC.resume();
  keys[e.key.toLowerCase()] = true;
  handleMenuKeys(e.key);
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('pointerdown', () => { startAudio(); if (AC && AC.state === 'suspended') AC.resume(); });

const kLeft  = () => keys['arrowleft'] || keys['a'];
const kRight = () => keys['arrowright'] || keys['d'];
const kJump  = () => keys[' '] || keys['arrowup'] || keys['w'];
const kPunch  = () => keys['z'] || keys['j'];
const kKick   = () => keys['x'] || keys['k'];
const kCrouch = () => keys['c'];
const kDown   = () => keys['arrowdown'] || keys['s'];

/* ---------------- game state ---------------- */
let state = 'title';    // title | play | mini | interlude (between levels) | gameover | win
let paused = false;     // Esc freezes play and mini worlds
let score = 0;
let camX = 0;
let frame = 0;
let inkMelt = false;            // past the second lantern, half of her runs to ink
let shakeT = 0, shakeMag = 0;   // screen shake: frames left, pixel magnitude
function addShake(mag, frames) {
  if (assist.calm) return;      // reduced-flash mode keeps the camera still
  shakeMag = Math.max(shakeMag, mag);
  shakeT = Math.max(shakeT, frames);
}

// assist mode — options a player can tune without shame (Esc opens them)
const assist = { invuln: false, speed: 1, hearts: false, calm: false, skipMini: false };
const SPEEDS = [1, 0.8, 0.6];
let assistSel = 0;
let speedAcc = 0;               // fractional update accumulator for game speed
function saveAssist() {
  try { localStorage.setItem('creepydoll-assist', JSON.stringify(assist)); } catch (e) {}
}
try { Object.assign(assist, JSON.parse(localStorage.getItem('creepydoll-assist') || '{}')); } catch (e) {}

function handleAssistKeys(key) {
  const ROWS = 5;
  if (key === 'ArrowUp')        { assistSel = (assistSel + ROWS - 1) % ROWS; sfx(300, 0.04, 'square', 0.03); }
  else if (key === 'ArrowDown') { assistSel = (assistSel + 1) % ROWS; sfx(300, 0.04, 'square', 0.03); }
  else if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const on = key === 'ArrowRight';        // right turns it on / slows further
    if (assistSel === 0) assist.invuln = on;
    else if (assistSel === 1) {
      const i = SPEEDS.indexOf(assist.speed);
      assist.speed = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1,
                                                 (i < 0 ? 0 : i) + (on ? 1 : -1)))];
    }
    else if (assistSel === 2) assist.hearts = on;
    else if (assistSel === 3) assist.calm = on;
    else assist.skipMini = on;
    saveAssist();
    sfx(500, 0.05, 'square', 0.03);
  }
}
let flashText = null;   // {msg, t}
let jumpHeld = false, punchHeld = false, kickHeld = false, crouchHeld = false,
    upHeld = false;

const STAGE_MSGS = [
  null,
  'the paint begins to chip...',
  'her button eye is gone.',
  'something is very wrong.',
];

function creepStage() {
  if (level === 2) return 3;    // she arrives as she left level 1: something is very wrong
  return Math.min(3, Math.floor(player.maxX / (LEVEL_W / 4.2)));
}

function resetGame() {
  genLevel();
  player.x = 40; player.y = 100; player.vx = 0; player.vy = 0;
  player.hp = 5; player.invuln = 0; player.attack = null;
  player.crouch = false; player.h = 18; player.chargeT = 0;
  player.coyoteT = 99; player.jumpBufT = 0; player.pJump = false;
  player.stretchT = 0; player.squashT = 0; player.respawnT = 0;
  player.face = 1; player.maxX = 0;
  score = 0; camX = 0; flashText = null;
  inkMelt = false;
  shakeT = 0; shakeMag = 0;
  particles.length = 0;
  fireballs.length = 0;
  playTime = 0;
  mini = null;
  paused = false;
  dragon.spawned = dragon.active = dragon.ridden = false;
  dragon.vx = dragon.vy = 0; dragon.t = 0;
  dragon.valkT = 0; dragon.valkSeen = false; dragon.mountCd = 0;
  dog.active = false; dog.vx = dog.vy = 0; dog.t = 0;
  dog.retreatT = 0; dog.barkCd = 0; dog.lastHit = -1;
  dog.hp = 3; dog.deadT = 0; dog.fleeT = 0; dog.flashT = 0;
  boss.active = false;
  bossBats.length = 0; bossRoaches.length = 0; thrown.length = 0;
  carrying = null;
}

function togglePause() {
  if (state !== 'play' && state !== 'mini' && state !== 'boss') return;
  paused = !paused;
  if (AC) { if (paused) AC.suspend(); else AC.resume(); }
  Object.keys(keys).forEach(k => { keys[k] = false; });  // drop held inputs
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(6,3,10,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('PAUSED', 116, 34, '#cfc3e8', 20);
  pixelText('ASSIST — no shame in any of it', 74, 66, '#9a8fb0');
  const rows = [
    ['invincible',        assist.invuln ? 'ON' : 'OFF'],
    ['game speed',        Math.round(assist.speed * 100) + '%'],
    ['infinite hearts',   assist.hearts ? 'ON' : 'OFF'],
    ['reduced flash',     assist.calm ? 'ON' : 'OFF'],
    ['skip minigames',    assist.skipMini ? 'ON' : 'OFF'],
  ];
  rows.forEach((r, i) => {
    const y = 82 + i * 12, sel = i === assistSel;
    if (sel) pixelText('>', 82, y, '#e8c66a');
    pixelText(r[0], 94, y, sel ? '#e8d8f0' : '#8a7f9e');
    pixelText(r[1], 208, y, sel ? '#e8c66a' : '#8a7f9e');
  });
  pixelText('UP DOWN PICK   LEFT RIGHT SET', 78, 148, '#6a5f80');
  if ((frame >> 5) % 2) pixelText('ESC TO RESUME', 122, 162, '#9a8fb0');
}

function handleMenuKeys(key) {
  if (paused || key !== 'Enter') return;
  if (state === 'mini') {
    if (mini && mini.over) endMini();
    else if (mini && assist.skipMini) endMini();   // assist: walk out any time
    return;
  }
  if (state === 'title' || state === 'gameover' || state === 'win' ||
      state === 'interlude') {
    const carry = state === 'interlude' ? score : 0;   // the score follows her in
    if (state === 'interlude') level = 2;
    else if (state !== 'gameover') level = 1;          // game over retries the level
    resetGame();
    score = carry;
    state = 'play';
  }
}

/* ---------------- physics ---------------- */
function moveAndCollide(p) {
  // horizontal
  p.x += p.vx;
  if (p.vx > 0) {
    if (solidAt(p.x + p.w, p.y + 1) || solidAt(p.x + p.w, p.y + p.h - 1)) {
      p.x = Math.floor((p.x + p.w) / TILE) * TILE - p.w - 0.01;
      p.vx = 0;
    }
  } else if (p.vx < 0) {
    if (solidAt(p.x, p.y + 1) || solidAt(p.x, p.y + p.h - 1)) {
      p.x = (Math.floor(p.x / TILE) + 1) * TILE + 0.01;
      p.vx = 0;
    }
  }
  // vertical
  p.y += p.vy;
  p.onGround = false;
  if (p.vy > 0) {
    if (solidAt(p.x + 1, p.y + p.h) || solidAt(p.x + p.w - 1, p.y + p.h)) {
      p.y = Math.floor((p.y + p.h) / TILE) * TILE - p.h - 0.01;
      p.vy = 0; p.onGround = true;
    }
  } else if (p.vy < 0) {
    if (solidAt(p.x + 1, p.y) || solidAt(p.x + p.w - 1, p.y)) {
      p.y = (Math.floor(p.y / TILE) + 1) * TILE + 0.01;
      p.vy = 0;
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hurtPlayer(fromX, dmg) {
  if (player.invuln > 0 || (state !== 'play' && state !== 'boss') || assist.invuln) return;
  player.hp -= dmg || 1;
  if (assist.hearts && player.hp < 5) player.hp = 5;   // the hearts refuse to empty
  player.invuln = 80;
  player.vy = -3.5;
  player.vx = player.x + player.w / 2 < fromX ? -2.5 : 2.5;
  sndHurt();
  addShake(3, 14);
  burst(player.x + 5, player.y + 8, '#efe2cf', 8, player.vx * 0.6);
  if (player.hp <= 0) {
    state = 'gameover';
    addShake(5, 25);
    sfx(120, 1.2, 'sawtooth', 0.09, -90);
  }
}

/* ---------------- update ---------------- */
function attackHitbox() {
  const a = player.attack;
  if (!a) return null;
  const active = a.type === 'punch' ? (a.t >= 3 && a.t <= 9) : (a.t >= 4 && a.t <= 12);
  if (!active) return null;
  const reach = a.type === 'punch' ? 13 : 16;
  const hy = a.type === 'punch' ? player.y + 6 : player.y + 11;
  const hx = player.face > 0 ? player.x + player.w : player.x - reach;
  return { x: hx, y: hy, w: reach, h: 7, id: a.id, dmg: 1 };
}

function updatePlayer() {
  // a second in the dark, then the last lit lantern pulls her back
  if (player.respawnT > 0) {
    player.respawnT--;
    if (player.respawnT % 5 === 0)
      burst(player.x + 5, player.y + 9, '#e8c66a', 1);
    if (player.respawnT === 0) {
      sfx(500, 0.2, 'triangle', 0.06, 200);
      burst(player.x + 5, player.y + 9, '#e8c66a', 12);
    }
    return;
  }

  const prevStage = creepStage();

  if (dragon.ridden) {
    updateRiding();
    afterMove(prevStage);
    return;
  }

  // step through a carnival doorway with Up
  if ((keys['arrowup'] || keys['w']) && !upHeld && player.onGround) {
    const d = doors.find(d => !d.used &&
      player.x + player.w > d.x && player.x < d.x + d.w);
    if (d) { upHeld = true; startMini(d); return; }
  }
  upHeld = keys['arrowup'] || keys['w'];

  // crouch toggles on C (stand up only with headroom)
  if (kCrouch() && !crouchHeld) {
    if (!player.crouch) {
      player.crouch = true; player.h = 14; player.y += 4;
      sfx(160, 0.06, 'square', 0.04, -60);
    } else if (!solidAt(player.x + 1, player.y - 4) &&
               !solidAt(player.x + player.w - 1, player.y - 4)) {
      player.crouch = false; player.h = 18; player.y -= 4;
      sfx(200, 0.06, 'square', 0.04, 80);
    }
  }
  crouchHeld = kCrouch();

  // walking (attacks root you briefly on the ground; crouching is slow)
  const rooted = player.attack && player.onGround;
  const speed = player.crouch ? 0.8 : 1.7;
  if (!rooted) {
    if (kLeft())       { player.vx = -speed; player.face = -1; }
    else if (kRight()) { player.vx = speed;  player.face = 1; }
    else player.vx *= player.onGround ? 0.6 : 0.95;
  } else player.vx *= 0.5;

  // power-jump charge: hold Down on the ground for 2 seconds to coil up
  const CHARGE_FRAMES = 120;
  if (kDown() && player.onGround && !player.crouch && !player.attack) {
    player.chargeT++;
    player.vx *= 0.5;                                  // she plants her feet
    if (player.chargeT === CHARGE_FRAMES)
      sfx(880, 0.15, 'square', 0.06);                  // fully coiled
    else if (player.chargeT < CHARGE_FRAMES && player.chargeT % 30 === 0)
      sfx(260 + player.chargeT * 2, 0.05, 'square', 0.04);
    if (player.chargeT >= CHARGE_FRAMES && frame % 10 === 0)
      burst(player.x + 5, player.y + 14, '#e8d8f0', 1);
  } else if (!kDown()) player.chargeT = 0;

  // forgiving controls: read intent, not frame-perfect input
  if (kJump() && !jumpHeld) player.jumpBufT = 6;       // buffer the press
  jumpHeld = kJump();

  // jump (half-speed launch; gravity scaled to keep the same height)
  // fires while grounded OR within the coyote window just after a ledge.
  // never from a crouch — stand up (C) first
  if (player.jumpBufT > 0 && !player.crouch &&
      (player.onGround || (player.coyoteT <= 6 && player.vy >= 0))) {
    player.jumpBufT = 0;
    player.coyoteT = 99;
    player.stretchT = 8; player.squashT = 0;   // spring up off the ground
    if (player.chargeT >= CHARGE_FRAMES) {
      player.vy = -4.9;                                // power jump — ~2x height
      player.pJump = true;
      player.chargeT = 0;
      addShake(2, 10);
      sfx(180, 0.4, 'square', 0.08, 420);
      burst(player.x + 5, player.y + 16, '#e8d8f0', 10);
    } else {
      player.vy = -3.45; player.pJump = false; sndJump();
    }
  } else if (player.jumpBufT > 0) player.jumpBufT--;

  // variable height: releasing jump early shortens a normal jump
  // (a charged power jump always flies its full arc)
  if (!kJump() && player.vy < -1.2 && !player.pJump) player.vy = -1.2;

  // attacks
  if (!player.attack) {
    if (kPunch() && !punchHeld) {
      player.attack = { type: 'punch', t: 0, id: ++player.attackId };
      sndPunch();
    } else if (kKick() && !kickHeld) {
      player.attack = { type: 'kick', t: 0, id: ++player.attackId };
      sndKick();
    }
  }
  punchHeld = kPunch(); kickHeld = kKick();
  if (player.attack) {
    player.attack.t++;
    const dur = player.attack.type === 'punch' ? 14 : 18;
    if (player.attack.t > dur) player.attack = null;
  }

  player.vy = Math.min(player.vy + 0.095, 3.5);
  const fallV = player.vy;
  moveAndCollide(player);

  // touchdown from a real fall: squash, dust, a soft thud
  if (player.onGround && player.coyoteT >= 4 && fallV > 2) {
    player.squashT = fallV > 3 ? 10 : 7;
    const fx = player.x + player.w / 2, fy = player.y + player.h - 1;
    burst(fx - 3, fy, '#6a5f80', 3, -1.4, 1.0);
    burst(fx + 3, fy, '#6a5f80', 3, 1.4, 1.0);
    sfx(80, 0.07, 'triangle', 0.05, -30);
    if (fallV > 3) addShake(1.5, 6);
  }

  // coyote clock: frames since her feet last touched ground
  if (player.onGround) { player.coyoteT = 0; player.pJump = false; }
  else if (player.coyoteT < 99) player.coyoteT++;

  // fell into a pit — a heart for the dark, and the lantern pulls her back.
  // on her last heart the dark keeps her.
  if (player.y > MAP_H * TILE + 30) {
    if (!assist.invuln) player.hp--;
    if (assist.hearts && player.hp < 5) player.hp = 5;
    sndHurt();
    addShake(5, 25);
    if (player.hp <= 0) {
      state = 'gameover';
      sfx(120, 1.2, 'sawtooth', 0.09, -90);
      return;
    }
    player.respawnT = 55;
    player.x = lastCP.x; player.y = lastCP.y;
    player.vx = 0; player.vy = 0;
    player.crouch = false; player.h = 18;
    player.chargeT = 0; player.attack = null;
    player.invuln = 140;             // grace through the return
    sfx(220, 0.5, 'sine', 0.06, -160);
    return;
  }

  afterMove(prevStage);
}

// shared tail of the player update (on foot or riding the dragon)
function afterMove(prevStage) {
  if (player.invuln > 0) player.invuln--;
  if (player.stretchT > 0) player.stretchT--;
  if (player.squashT > 0) player.squashT--;
  // light any lantern she passes
  for (const cp of checkpoints) {
    if (!cp.reached && player.x + player.w > cp.x) {
      cp.reached = true;
      lastCP.x = cp.x - 2; lastCP.y = 9 * TILE - 19;
      sfx(660, 0.12, 'triangle', 0.05);
      sfx(990, 0.2, 'sine', 0.03);
      burst(cp.x + 4, 9 * TILE - 20, '#e8c66a', 8);
      // the house's second candle is one candle too many
      if (!inkMelt && level === 2 &&
          checkpoints.filter(c => c.reached).length === 2) {
        inkMelt = true;
        flashText = { msg: 'she is annoyed.', t: 120, hold: true };
        addShake(2, 10);
        sfx(120, 0.5, 'sawtooth', 0.05, -60);
        sfx(90, 0.7, 'sine', 0.06, -30);
        burst(player.x + 5, player.y + 14, '#0c0a12', 12, 0, 1);
      }
    }
  }
  // and the ink never stops dripping
  if (inkMelt && Math.random() < 0.06)
    particles.push({ x: player.x + 2 + Math.random() * 8,
                     y: player.y + 12 + Math.random() * 6,
                     vx: 0, vy: 0.4, t: 22, color: '#0c0a12' });
  player.maxX = Math.max(player.maxX, player.x);
  player.animT += Math.abs(player.vx) > 0.3 ? 1 : 0;

  // creepiness advances
  const st = creepStage();
  if (st > prevStage && STAGE_MSGS[st] && !(flashText && flashText.hold)) {
    flashText = { msg: STAGE_MSGS[st], t: 150 };
    sndStage();
    addShake(2, 12);
    burst(player.x + 5, player.y + 6, '#3b3b3b', 12);
  }
  // she twitches when she's far gone
  if (st >= 2 && Math.random() < 0.006 * st) player.twitch = 6;
  if (player.twitch > 0) player.twitch--;
}

function updateKid() {
  // roaming phase: glimpses ahead of the doll, always out of reach
  if (kid.stage === 'roam') {
    if (player.maxX >= houseX - 280) {
      // the finale — the kid takes their place outside the dollhouse
      kid.stage = 'final'; kid.mode = 'idle';
      kid.x = houseX - 70; kid.y = 9 * TILE - kid.h - 1;
      kid.vx = 0; kid.vy = 0; kid.face = -1;
      return;
    }
    if (kid.mode === 'hidden') {
      if (--kid.hideT <= 0) {
        // step out onto solid ground ahead of her — close enough to chase
        let c = Math.floor((player.x + 120) / TILE);
        while (c < MAP_W - 16 && map[9][c] !== 1) c++;
        kid.x = c * TILE + 3; kid.y = 9 * TILE - kid.h - 1;
        kid.vx = 0; kid.vy = 0;
        kid.mode = 'peek'; kid.glimpseT = 0;
        const lines = level === 2 ? HOUSE_GLIMPSE_LINES : GLIMPSE_LINES;
        if (kid.glimpses < lines.length)
          flashText = { msg: lines[kid.glimpses], t: 120 };
        kid.glimpses++;
        kid.seen = true;
      }
    } else if (kid.mode === 'peek') {
      // one heartbeat to be seen, then he RUNS — he is always running
      kid.glimpseT++;
      kid.vx = 0;
      kid.face = player.x < kid.x ? -1 : 1;
      if (Math.abs(player.x - kid.x) < 200 || kid.glimpseT > 10) {
        kid.mode = 'sprint'; kid.alarmT = 30;
        sfx(700, 0.2, 'square', 0.05, 250);
      }
    } else if (kid.mode === 'sprint') {
      // faster than the doll — she cannot catch him until the end
      kid.vx = 1.95; kid.face = 1;
      const aheadX = kid.x + kid.w + 6;
      if (kid.onGround &&
          (solidAt(aheadX, kid.y + kid.h - 4) || !solidAt(aheadX, kid.y + kid.h + 6)))
        kid.vy = -6;
      kid.vy = Math.min(kid.vy + 0.38, 7);
      moveAndCollide(kid);
      if (kid.x > camX + VIEW_W + 80 || kid.x > houseX - 90 ||
          kid.y > MAP_H * TILE + 30) {
        kid.mode = 'hidden'; kid.hideT = 240 + Math.random() * 240;
        kid.x = -1000; kid.vx = 0; kid.vy = 0;
      }
    }
    if (kid.alarmT > 0) kid.alarmT--;
    kid.animT += Math.abs(kid.vx) > 0.2 ? 1 : 0;
    return;   // no tagging during the roam — she only gets to watch
  }

  const dx = (player.x + player.w / 2) - (kid.x + kid.w / 2);
  const dist = Math.abs(dx);

  if (kid.mode === 'idle') {
    kid.vx = 0;
    kid.face = dx < 0 ? -1 : 1;
    if (dist < 85 && Math.abs(player.y - kid.y) < 50) {
      kid.mode = 'flee';
      kid.alarmT = 40;
      sfx(700, 0.25, 'square', 0.06, 250);  // frightened yelp
    }
  } else {
    // run away from the doll — but the world ends at the dollhouse
    const away = dx < 0 ? 1 : -1;
    kid.vx = away * 1.35;
    kid.face = away;
    if (kid.x > houseX + 14) {          // cornered against the house
      kid.mode = 'cornered';
      kid.vx = 0;
      kid.face = dx < 0 ? -1 : 1;       // trembling, watching her come
    }
    // hop over small obstacles / gaps
    const aheadX = kid.face > 0 ? kid.x + kid.w + 6 : kid.x - 6;
    if (kid.onGround &&
        (solidAt(aheadX, kid.y + kid.h - 4) || !solidAt(aheadX, kid.y + kid.h + 6)))
      kid.vy = -6;
  }

  kid.vy = Math.min(kid.vy + 0.38, 7);
  moveAndCollide(kid);
  if (kid.y > MAP_H * TILE + 30) {      // never lose the kid down a pit
    kid.x = houseX - 40; kid.y = 9 * TILE - kid.h - 1; kid.vy = 0;
  }
  if (kid.alarmT > 0) kid.alarmT--;
  kid.animT += Math.abs(kid.vx) > 0.2 ? 1 : 0;

  // tag! the doll only wanted a friend
  if (rectsOverlap(kid, player)) {
    if (level === 1) {
      score += 1000;
      if (eyesFound >= EYES_TOTAL) score += 1000;  // she found every eye
      state = 'interlude';                         // but he slips away, and runs home
      sndWin();
      burst(kid.x + 5, kid.y + 8, '#f0e040', 10);
    } else {
      startBoss();                                 // the boy is not a boy
    }
  }
}

function killEnemy(e) {
  e.dead = 1;
  score += { snake: 200, valkyrie: 300, rat: 150, roach: 100, ant: 50 }[e.kind] || 100;
  sfx(90, 0.25, 'triangle', 0.07, -40);
  addShake(2, 8);
  // a bat's life feeds hers — one heart back, if she's hurt
  if (e.kind === 'bat' && player.hp < 5) {
    player.hp = Math.min(5, player.hp + 1);
    sndHeal();
    burst(player.x + 5, player.y + 6, '#e8506a', 8);
  }
}

function updateEnemies() {
  const hb = attackHitbox();
  const pcx = player.x + player.w / 2;

  for (const e of enemies) {
    if (e.dead) { e.dead++; continue; }
    e.t++;
    if (e.flashT > 0) e.flashT--;

    if (e.placed === false) {   // ground-dwellers settle once (below any ceiling)
      let r = 2;
      while (r < MAP_H && !solidAt(e.x + e.w / 2, r * TILE + TILE - 1)) r++;
      e.y = r * TILE - e.h;
      e.placed = true;
    }

    if (e.kind === 'bat') {
      const d = Math.abs(e.x - player.x);
      if (d < 130 && Math.abs(e.y - player.y) < 80) {
        e.vx += (pcx > e.x + 6 ? 0.03 : -0.03);
        e.vy += (player.y + 4 > e.y ? 0.02 : -0.02);
        e.vx = Math.max(-0.9, Math.min(0.9, e.vx));
        e.vy = Math.max(-0.7, Math.min(0.7, e.vy));
      } else {
        e.vx *= 0.95;
        e.vy = (e.homeY + Math.sin(e.t / 20) * 6 - e.y) * 0.05;
      }
      e.x += e.vx; e.y += e.vy;
      e.face = e.vx >= 0 ? 1 : -1;
    }

    if (e.kind === 'spider') {
      const drop = Math.abs(pcx - (e.x + 5)) < 26 ? 46 : 0;
      const target = e.anchorY + e.len + Math.sin(e.t / 25) * 10 + drop;
      e.y += (target - e.y) * 0.06;
      if (e.webWobble > 0) e.webWobble--;

      // striking the silk thread — three hits and it snaps
      if (hb && e.lastWebHit !== hb.id && !rectsOverlap(hb, e)) {
        const web = { x: e.x + 4, y: e.anchorY, w: 3, h: Math.max(0, e.y - e.anchorY) };
        if (rectsOverlap(hb, web)) {
          e.lastWebHit = hb.id;
          e.webHp--;
          e.webWobble = 25;
          sfx(720, 0.07, 'square', 0.05, -260);      // twang
          burst(e.x + 5, Math.max(e.anchorY + 2, Math.min(hb.y + 3, e.y)), '#cfc9dd', 4);
          if (e.webHp <= 0) {                        // the web and the spider die
            e.dead = 1;
            score += 200;
            addShake(2, 8);
            sfx(220, 0.2, 'sawtooth', 0.06, -160);   // snap
            burst(e.x + 5, e.y + 4, '#cfc9dd', 8);
          }
        }
      }
    }

    if (e.kind === 'valkyrie') {
      if (dragon.ridden) {
        // hunt the rider — relentless, a little slower than the dragon
        e.vx = Math.max(-1.3, Math.min(1.3, e.vx + Math.sign(player.x - e.x) * 0.05));
        e.vy = Math.max(-1.0, Math.min(1.0, e.vy + Math.sign(player.y - e.y) * 0.04));
        e.vy += Math.sin(e.t / 14) * 0.05;
      } else {
        // no rider in the sky — withdraw into the dark above
        e.vy -= 0.07;
        e.vx *= 0.98;
        if (e.y < -40) { e.hp = 0; e.dead = 24; }
      }
      e.x += e.vx; e.y += e.vy;
      e.y = Math.max(-50, e.y);
      e.face = e.vx >= 0 ? 1 : -1;
    }

    if (e.kind === 'snake') {
      e.x += e.dir * 0.45;
      const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.x < e.minX || e.x > e.maxX || !solidAt(aheadX, e.y + e.h + 4))
        e.dir *= -1;
    }

    if (e.kind === 'ant') {     // small, certain, endless
      e.x += e.dir * 0.55;
      const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.x < e.minX || e.x > e.maxX ||
          !solidAt(aheadX, e.y + e.h + 4) || solidAt(aheadX, e.y + e.h - 2))
        e.dir *= -1;
    }

    if (e.kind === 'roach') {   // skitters, then bolts at her
      if (e.dashT > 0) { e.dashT--; e.x += e.dir * 1.7; }
      else {
        e.x += e.dir * 0.4;
        if (e.dashCd > 0) e.dashCd--;
        const dx = pcx - (e.x + e.w / 2);
        if (e.dashCd <= 0 && Math.abs(dx) < 90 &&
            Math.abs((player.y + player.h) - (e.y + e.h)) < 26) {
          e.dir = Math.sign(dx) || 1;
          e.dashT = 26; e.dashCd = 110;
          sfx(520, 0.05, 'square', 0.03, -200);          // a dry click
        }
      }
      const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (!solidAt(aheadX, e.y + e.h + 4) || solidAt(aheadX, e.y + e.h - 2)) {
        e.dir *= -1; e.dashT = 0;
      }
    }

    if (e.kind === 'rat') {     // patrols, and lunges when she's close
      if (e.lungeCd > 0) e.lungeCd--;
      if (e.dashT > 0) { e.dashT--; e.x += e.dir * 2.2; }
      else {
        e.x += e.dir * 0.5;
        const dx = pcx - (e.x + e.w / 2);
        if (e.lungeCd <= 0 && Math.abs(dx) < 80 &&
            Math.abs((player.y + player.h) - (e.y + e.h)) < 26) {
          e.dir = Math.sign(dx) || 1;
          e.dashT = 20; e.lungeCd = 130;
          sfx(760, 0.08, 'square', 0.04, 300);           // a squeak with intent
        }
      }
      const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.x < e.minX || e.x > e.maxX ||
          !solidAt(aheadX, e.y + e.h + 4) || solidAt(aheadX, e.y + e.h - 2)) {
        e.dir *= -1; e.dashT = 0;
      }
    }

    // the doll's fists and feet
    if (hb && e.lastHit !== hb.id && rectsOverlap(hb, e)) {
      e.lastHit = hb.id;
      e.hp -= hb.dmg;
      e.flashT = 6;
      sndHitE();
      burst(e.x + e.w / 2, e.y + e.h / 2, '#ff3040', 6, player.face * 1.6);
      if (e.hp <= 0) killEnemy(e);
      else e.x += player.face * 6;
    }

    // touching the doll — the small things only take half a heart,
    // and the bite is the last thing they do
    if (!e.dead && rectsOverlap(e, player)) {
      const small = e.kind === 'ant' || e.kind === 'roach';
      hurtPlayer(e.x + e.w / 2, small ? 0.5 : 1);
      if (small && player.invuln === 80) {     // the bite landed; it is spent
        e.dead = 1;
        burst(e.x + e.w / 2, e.y + e.h / 2,
              e.kind === 'ant' ? '#3e2c1e' : '#5a3a1e', 5);
        sfx(220, 0.08, 'square', 0.04, -120);
      }
    }
  }

  // sweep the long-dead
  for (let i = enemies.length - 1; i >= 0; i--)
    if (enemies[i].dead > 25) enemies.splice(i, 1);
}

function updateHeartPickup() {
  if (heartPickup.taken) return;
  heartPickup.t++;
  const hy = heartPickup.y + Math.sin(heartPickup.t / 25) * 3;
  const box = { x: heartPickup.x - 1, y: hy - 1, w: 9, h: 10 };
  if (player.hp < 5 && rectsOverlap(box, player)) {
    heartPickup.taken = true;       // it only gives itself to the wounded
    player.hp = Math.min(5, player.hp + 1);
    sndHeal();
    burst(heartPickup.x + 4, hy + 4, '#e8506a', 10);
  }
}

function updateEyePickups() {
  for (const ep of eyePickups) {
    if (ep.taken) continue;
    ep.t++;
    const ey = ep.y + Math.sin(ep.t / 25) * 3;
    if (rectsOverlap({ x: ep.x - 1, y: ey - 1, w: 9, h: 9 }, player)) {
      ep.taken = true;
      eyesFound++;
      score += 200;
      sfx(1046, 0.15, 'triangle', 0.06);
      sfx(1568, 0.25, 'sine', 0.04);
      burst(ep.x + 3, ey + 3, '#e8c66a', 10);
      flashText = eyesFound >= EYES_TOTAL
        ? { msg: 'all her eyes... she sees.', t: 120, hold: true }  // two steady seconds
        : { msg: 'a lost button eye (' + eyesFound + '/' + EYES_TOTAL + ')', t: 120 };
    }
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    if (!p.float) p.vy += 0.15;          // ash motes drift, debris falls
    p.t--;
    if (p.t <= 0) particles.splice(i, 1);
  }
}

/* ---------------- drawing ---------------- */
const SKY = [
  ['#1a1430', '#241a3e', '#302145'],   // stage 0
  ['#191028', '#231738', '#2e1d40'],
  ['#170c20', '#220f2e', '#2c1233'],
  ['#160814', '#22091c', '#2e0a1f'],   // stage 3 — bruised red
];

function tileNoise(cx, cy) {  // deterministic per-tile hash
  let n = (cx * 73856093) ^ (cy * 19349663);
  n = (n ^ (n >> 13)) & 0x7fffffff;
  return n / 0x7fffffff;
}

function drawBackground(st) {
  const sky = SKY[st];
  ctx.fillStyle = sky[0]; ctx.fillRect(0, 0, VIEW_W, 60);
  ctx.fillStyle = sky[1]; ctx.fillRect(0, 60, VIEW_W, 60);
  ctx.fillStyle = sky[2]; ctx.fillRect(0, 120, VIEW_W, VIEW_H - 120);

  // stars
  for (let i = 0; i < 40; i++) {
    const sx = (i * 83 + 31) % (VIEW_W + 40) - ((camX * 0.1) % (VIEW_W + 40));
    const wx = ((sx % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40) - 20;
    const sy = (i * 47) % 70 + 4;
    if ((i + frame >> 5) % 7 === 0) continue; // twinkle
    ctx.fillStyle = i % 3 ? '#5a4d78' : '#8d7fae';
    ctx.fillRect(wx, sy, 1, 1);
  }

  // moon — it stains red as the doll decays
  const moonX = 250 - camX * 0.05;
  ctx.fillStyle = ['#e8e4d5', '#e3d9c2', '#d8b9a5', '#c96a5a'][st];
  ctx.beginPath(); ctx.arc(moonX, 32, 14, 0, 7); ctx.fill();
  ctx.fillStyle = sky[0];
  ctx.beginPath(); ctx.arc(moonX - 6, 28, 12, 0, 7); ctx.fill();

  // far dead trees
  ctx.fillStyle = '#0e0a1c';
  for (let i = 0; i < 12; i++) {
    const tx = ((i * 160 + 40 - camX * 0.3) % (VIEW_W + 160) + VIEW_W + 160) % (VIEW_W + 160) - 80;
    const h = 34 + (i * 13) % 22;
    ctx.fillRect(tx, 128 - h, 3, h);
    ctx.fillRect(tx - 6, 128 - h + 6, 6, 2);
    ctx.fillRect(tx + 3, 128 - h + 12, 7, 2);
    ctx.fillRect(tx - 8, 128 - h + 18, 8, 2);
  }
  // circling specks by the moon once she's far gone
  if (st >= 2) {
    ctx.fillStyle = '#241628';
    for (let i = 0; i < 3; i++) {
      const bx = ((frame * 0.4 + i * 117) % (VIEW_W + 60)) - 30;
      const by = 18 + Math.sin(frame / 26 + i * 2.1) * 8 + i * 7;
      ctx.fillRect(bx, by, 2, 1);
      if ((frame >> 3 + i) % 2) { ctx.fillRect(bx - 1, by - 1, 1, 1); ctx.fillRect(bx + 2, by - 1, 1, 1); }
    }
  }

  // fog band
  ctx.fillStyle = 'rgba(60,50,90,0.25)';
  ctx.fillRect(0, 118, VIEW_W, 14);

  // nearer parallax: a crooked fence line, pickets and the odd gravestone
  for (let i = 0; i < 14; i++) {
    const fx = ((i * 96 + 22 - camX * 0.55) % (VIEW_W + 96) + VIEW_W + 96) % (VIEW_W + 96) - 48;
    const grave = i % 4 === 1;
    ctx.fillStyle = '#191330';
    if (grave) {
      ctx.fillRect(fx, 132, 6, 12);
      ctx.fillRect(fx + 1, 130, 4, 2);
    } else {
      const lean = (i * 7) % 3 - 1;
      ctx.fillRect(fx, 131 + (i % 2), 2, 13);
      ctx.fillRect(fx + 5 + lean, 132, 2, 12);
      ctx.fillRect(fx - 2, 134, 11, 2);
    }
  }
}

function drawTiles() {
  const indoor = level === 2;
  const c0 = Math.max(0, Math.floor(camX / TILE));
  const c1 = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W) / TILE));
  for (let r = 0; r < MAP_H; r++) {
    for (let cc = c0; cc <= c1; cc++) {
      const t = map[r][cc];
      if (!t) continue;
      const x = cc * TILE - camX, y = r * TILE;
      if (t === 1) {
        const top = r === 0 || !map[r - 1][cc];
        ctx.fillStyle = indoor ? '#4a3626' : '#3a3244';
        ctx.fillRect(x, y, TILE, TILE);
        if (top && r > 0) {
          ctx.fillStyle = indoor ? '#6d5138' : '#4b3f5c';
          ctx.fillRect(x, y, TILE, 4);
          ctx.fillStyle = indoor ? '#7d5f42' : '#5d4f72';
          for (let i = 0; i < 4; i++)
            if (tileNoise(cc * 4 + i, r) > 0.4) ctx.fillRect(x + i * 4 + 1, y, 2, 2);
        }
        if (indoor && r === 0) {                       // crown molding
          ctx.fillStyle = '#5a4632';
          ctx.fillRect(x, y + TILE - 3, TILE, 3);
        }
        if (indoor && r >= 9 && (cc % 2 === 0)) {      // floorboard seams
          ctx.fillStyle = '#3a2a1c';
          ctx.fillRect(x, y + (r === 9 ? 5 : 0), 1, TILE - 5);
        } else if (!indoor && tileNoise(cc, r) > 0.6) {
          ctx.fillStyle = '#2e2738';                   // stones
          ctx.fillRect(x + 3 + (cc % 3) * 3, y + 7 + (r % 2) * 3, 4, 3);
        }
      } else if (t === 3) {
        // solid furniture — a good oak table
        const top = !map[r - 1][cc] || map[r - 1][cc] !== 3;
        if (top) {
          ctx.fillStyle = '#7a5a35'; ctx.fillRect(x - 1, y, TILE + 2, 5);
          ctx.fillStyle = '#8f6c42'; ctx.fillRect(x - 1, y, TILE + 2, 2);
          ctx.fillStyle = '#5a3f24'; ctx.fillRect(x + 2, y + 5, 3, TILE - 5);
          ctx.fillRect(x + TILE - 5, y + 5, 3, TILE - 5);
        } else {
          ctx.fillStyle = '#5a3f24';                   // legs continue down
          ctx.fillRect(x + 2, y, 3, TILE);
          ctx.fillRect(x + TILE - 5, y, 3, TILE);
        }
      } else {
        // wooden platform / shelf
        ctx.fillStyle = '#4d3a2e';
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = '#6b5240';
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillStyle = '#33261e';
        ctx.fillRect(x + 7, y + 2, 1, 4);
        if (indoor) {                                  // shelf bracket
          ctx.fillStyle = '#3a2a1c';
          ctx.fillRect(x + 6, y + 6, 3, 3);
        }
      }
    }
  }
}

/* ---------------- the house, properly lit ---------------- */
function drawHouseBackground(st) {
  // warm wallpaper in two stripes, dimming just a little as she decays
  const dim = st * 0.045;
  ctx.fillStyle = '#54423a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#5c483e';
  for (let i = 0; i < 12; i++) {
    const wx = ((i * 34 - camX) % (VIEW_W + 34) + VIEW_W + 34) % (VIEW_W + 34) - 17;
    ctx.fillRect(wx, 16, 17, 104);
  }
  // wainscot and baseboard
  ctx.fillStyle = '#3e2c22'; ctx.fillRect(0, 120, VIEW_W, 24);
  ctx.fillStyle = '#4a3628';
  for (let i = 0; i < 12; i++) {
    const wx = ((i * 34 + 6 - camX) % (VIEW_W + 34) + VIEW_W + 34) % (VIEW_W + 34) - 17;
    ctx.fillRect(wx, 123, 24, 17);
  }
  ctx.fillStyle = '#2e2018'; ctx.fillRect(0, 140, VIEW_W, 4);

  // windows onto the night she came from, and portraits between them
  for (let wc = 34; wc < MAP_W; wc += 44) {
    const wx = wc * TILE - camX;
    if (wx > -40 && wx < VIEW_W + 40) {
      ctx.fillStyle = '#2e2018'; ctx.fillRect(wx - 3, 30, 34, 44);
      ctx.fillStyle = ['#1a1430', '#191028', '#170c20', '#160814'][st];
      ctx.fillRect(wx, 33, 28, 38);
      ctx.fillStyle = '#2e2018';
      ctx.fillRect(wx + 13, 33, 2, 38); ctx.fillRect(wx, 50, 28, 2);
      ctx.fillStyle = ['#e8e4d5', '#e3d9c2', '#d8b9a5', '#c96a5a'][st];
      ctx.fillRect(wx + 19, 38, 5, 5);                 // the moon looks in
    }
    const px = (wc - 22) * TILE - camX;
    if (px > -20 && px < VIEW_W + 20) {                // a family portrait
      ctx.fillStyle = '#6d5138'; ctx.fillRect(px, 38, 18, 22);
      ctx.fillStyle = '#d9c8b2'; ctx.fillRect(px + 2, 40, 14, 18);
      ctx.fillStyle = '#8a7a5c';
      ctx.fillRect(px + 6, 45, 6, 5); ctx.fillRect(px + 7, 50, 4, 5);
      ctx.fillStyle = st >= 2 ? '#7a1f1f' : '#2a1c10'; // the eyes follow, later
      ctx.fillRect(px + 7, 46, 1, 1); ctx.fillRect(px + 10, 46, 1, 1);
    }
  }

  // wall sconces with steady little flames
  for (let sc = 12; sc < MAP_W; sc += 22) {
    const sx = sc * TILE - camX;
    if (sx < -8 || sx > VIEW_W + 8) continue;
    ctx.fillStyle = '#3e2c22'; ctx.fillRect(sx, 44, 4, 8);
    ctx.fillStyle = (frame + sc) % 9 < 7 ? '#ffce6a' : '#e8a050';
    ctx.fillRect(sx + 1, 40, 2, 4);
    ctx.fillStyle = 'rgba(255,206,106,0.07)';
    ctx.fillRect(sx - 8, 32, 20, 26);
  }

  // the chandelier over where she starts
  const chx = 4 * TILE - camX;
  if (chx > -60 && chx < VIEW_W + 60) {
    const sway = Math.sin(frame / 55) * 2;
    ctx.fillStyle = '#2e2018';
    ctx.fillRect(chx + 15, 16, 2, 12);                  // chain
    ctx.fillRect(chx + sway, 28, 32, 3);                // arms
    ctx.fillRect(chx + sway + 14, 26, 4, 5);            // hub
    for (let i = 0; i < 4; i++) {
      const cx = chx + sway + 1 + i * 10;
      ctx.fillStyle = '#e8e0c8'; ctx.fillRect(cx, 24, 3, 4);      // candles
      ctx.fillStyle = (frame + i * 3) % 8 < 6 ? '#ffce6a' : '#ffa030';
      ctx.fillRect(cx, 21, 3, 3);                                  // flames
      ctx.fillStyle = '#b795d6'; ctx.fillRect(cx + 1, 31, 1, 3);   // crystal
    }
    ctx.fillStyle = 'rgba(255,206,106,0.10)';
    ctx.fillRect(chx - 18 + sway, 20, 68, 110);          // its warm light
    ctx.fillStyle = 'rgba(255,206,106,0.06)';
    ctx.fillRect(chx - 34 + sway, 20, 100, 124);
  }

  if (dim > 0) {
    ctx.fillStyle = 'rgba(20,4,12,' + dim + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawCheckpoints() {
  for (const cp of checkpoints) {
    const x = Math.round(cp.x - camX);
    if (x < -12 || x > VIEW_W + 12) continue;
    if (level === 2) {                            // a candle on the floor
      const y = 9 * TILE - 12;
      ctx.fillStyle = '#3e2c22'; ctx.fillRect(x, y + 9, 8, 3);     // saucer
      ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x + 2, y + 2, 4, 8); // wax
      const lit = cp.reached && (frame >> 3) % 5 !== 4;
      ctx.fillStyle = lit ? '#ffce6a' : '#1c1626';
      ctx.fillRect(x + 3, y - 2, 2, 4);
      if (cp.reached) {
        ctx.fillStyle = 'rgba(255,206,106,0.10)';
        ctx.fillRect(x - 4, y - 6, 16, 18);
      }
      continue;
    }
    const y = 9 * TILE - 26;                      // lantern post
    ctx.fillStyle = '#3a3244';
    ctx.fillRect(x + 3, y + 8, 2, 16);
    ctx.fillRect(x + 1, y + 24, 6, 2);
    ctx.fillStyle = cp.reached ? '#5a4a2a' : '#2e2738';
    ctx.fillRect(x, y, 8, 9);                     // housing
    const lit = cp.reached && (frame >> 3) % 5 !== 4;   // lazy flicker
    ctx.fillStyle = lit ? '#e8c66a' : '#1c1626';
    ctx.fillRect(x + 2, y + 2, 4, 5);
    if (cp.reached) {
      ctx.fillStyle = 'rgba(232,198,106,0.10)';
      ctx.fillRect(x - 3, y - 3, 14, 15);
    }
  }
}

function drawHouse() {
  if (level === 2) { drawBedroomDoor(); return; }
  const x = houseX - camX, y = 9 * TILE - 46;
  if (x < -60 || x > VIEW_W) return;
  // a dollhouse, lit from inside
  ctx.fillStyle = '#241a24'; ctx.fillRect(x, y + 14, 48, 32);
  ctx.fillStyle = '#3d1f2a';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 16); ctx.lineTo(x + 24, y); ctx.lineTo(x + 52, y + 16);
  ctx.fill();
  ctx.fillStyle = frame % 90 < 80 ? '#e8c66a' : '#5a4020';  // flickering window
  ctx.fillRect(x + 8, y + 22, 8, 8);
  ctx.fillRect(x + 32, y + 22, 8, 8);
  ctx.fillStyle = '#120c14'; ctx.fillRect(x + 20, y + 28, 9, 18);
  ctx.fillStyle = '#e8c66a'; ctx.fillRect(x + 26, y + 37, 2, 2); // doorknob
}

function drawBedroomDoor() {
  const x = houseX - camX, y = 9 * TILE - 44;
  if (x < -60 || x > VIEW_W) return;
  ctx.fillStyle = '#2e2018'; ctx.fillRect(x - 3, y - 3, 26, 47);   // frame
  ctx.fillStyle = '#5a3f24'; ctx.fillRect(x, y, 20, 44);           // the door
  ctx.fillStyle = '#4a3620';
  ctx.fillRect(x + 3, y + 4, 14, 16); ctx.fillRect(x + 3, y + 24, 14, 16);
  ctx.fillStyle = '#e8c66a'; ctx.fillRect(x + 16, y + 22, 2, 2);   // knob
  ctx.fillStyle = 'rgba(255,206,106,0.25)';                        // nightlight under
  ctx.fillRect(x - 2, y + 42, 24, 2);
  // crayon drawings taped up beside it — a boy, a dog, and a doll he lost
  ctx.fillStyle = '#d9c8b2';
  ctx.fillRect(x - 22, y + 6, 12, 14); ctx.fillRect(x - 38, y + 10, 12, 14);
  ctx.fillStyle = '#3a5cc9'; ctx.fillRect(x - 19, y + 10, 6, 6);
  ctx.fillStyle = '#8f6c42'; ctx.fillRect(x - 35, y + 15, 7, 5);
}

function drawPlayer() {
  if (player.respawnT > 0) return;                    // still in the dark
  if (player.invuln > 0 && (frame >> 2) % 2) return;  // hit flicker
  const st = creepStage();
  const set = DOLL[st];
  const charging = player.chargeT > 0 && player.onGround;
  let img;
  if (dragon.ridden) img = set.jump;                    // legs tucked, riding
  else if (player.crouch) img = set.crouch[Math.abs(player.vx) > 0.3 ? (player.animT >> 5) % 2 : 0];
  else if (charging) img = set.crouch[0];               // coiled for the power jump
  else if (!player.onGround) img = set.jump;
  else if (Math.abs(player.vx) > 0.3) img = set.walk[(player.animT >> 4) % 2];
  else img = set.idle;

  const tremble = player.chargeT >= 120 ? ((frame >> 1) % 2 ? 1 : -1) : 0;
  const dx = Math.round(player.x - camX - 2) + tremble;
  const dy = Math.round(player.y - (player.crouch ? 4 : charging ? 0 : 2)) +
             (player.twitch > 3 ? 1 : 0);
  // squash & stretch, anchored at her feet
  let sqX = 1, sqY = 1;
  if (!dragon.ridden) {
    if (player.squashT > 0) {
      const k = player.squashT / 10;
      sqX = 1 + 0.28 * k; sqY = 1 - 0.28 * k;
    } else if (player.stretchT > 0) {
      const k = player.stretchT / 8;
      sqX = 1 - 0.18 * k; sqY = 1 + 0.18 * k;
    }
  }
  ctx.save();
  if (player.face < 0) {
    ctx.translate(dx + 14, dy); ctx.scale(-1, 1);
  } else {
    ctx.translate(dx, dy);
  }
  if (sqX !== 1 || sqY !== 1) {
    ctx.translate(7, img.height);
    ctx.scale(sqX, sqY);
    ctx.translate(-7, -img.height);
  }
  ctx.drawImage(img, 0, 0);
  // extended limb during attacks
  const a = player.attack;
  if (a) {
    ctx.fillStyle = st >= 3 ? '#c9b8a0' : '#efe2cf';
    if (a.type === 'punch' && a.t >= 2 && a.t <= 10)
      ctx.fillRect(13, 8, 8, 3);
    if (a.type === 'kick' && a.t >= 3 && a.t <= 13) {
      ctx.fillRect(11, 14, 9, 3);
      ctx.fillStyle = '#20242c';
      ctx.fillRect(18, 13, 4, 4);
    }
  }
  // half of her has run to ink since the house's second candle
  if (inkMelt) {
    ctx.fillStyle = '#0c0a12';
    const H = img.height;
    for (let ix = 0; ix < 14; ix++) {
      const edge = Math.max(4, Math.round(H / 2 + Math.sin(frame / 9 + ix * 1.7) * 1.5));
      ctx.fillRect(ix, edge, 1, H - edge);
    }
    for (let i = 0; i < 3; i++) {                 // drips running off her hem
      const ix = 2 + i * 4 + (i === 2 ? 1 : 0);
      const dl = (frame * (0.3 + i * 0.15) + i * 37) % 22;
      if (dl < 14) ctx.fillRect(ix, H - 1, 1, 2 + Math.round(dl / 3));
    }
  }
  ctx.restore();
}

function drawHeartPickup() {
  if (heartPickup.taken) return;
  const x = Math.round(heartPickup.x - camX);
  if (x < -12 || x > VIEW_W + 12) return;
  const y = Math.round(heartPickup.y + Math.sin(heartPickup.t / 25) * 3);
  ctx.fillStyle = 'rgba(232,80,106,0.12)';          // soft glow
  ctx.fillRect(x - 2, y - 2, 11, 12);
  drawHeart(x, y, (heartPickup.t >> 4) % 2 ? '#e8506a' : '#c9304a');
}

function drawKid() {
  const dx = Math.round(kid.x - camX - 2);
  if (dx < -20 || dx > VIEW_W + 20) return;
  const tremble = kid.mode === 'cornered' && (frame >> 2) % 2 ? 1 : 0;
  const dy = Math.round(kid.y - 2) + tremble;
  let img;
  if (Math.abs(kid.vx) > 0.2) img = KID_FRAMES.run[(kid.animT >> 3) % 2];
  else img = KID_FRAMES.idle;
  ctx.save();
  if (kid.face < 0) {
    ctx.translate(dx + 14, dy); ctx.scale(-1, 1);
  } else {
    ctx.translate(dx, dy);
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  // alarm mark when first spooked
  if (kid.alarmT > 0 && (kid.alarmT >> 2) % 2) {
    ctx.fillStyle = '#f0e040';
    ctx.fillRect(dx + 6, dy - 8, 2, 4);
    ctx.fillRect(dx + 6, dy - 3, 2, 2);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const x = Math.round(e.x - camX), y = Math.round(e.y);
    if (x < -30 || x > VIEW_W + 30) continue;

    if (e.dead) {  // puff of dust
      ctx.fillStyle = 'rgba(140,120,160,' + (1 - e.dead / 25) + ')';
      const s = e.dead / 3;
      ctx.fillRect(x + e.w / 2 - s, y + e.h / 2 - s, s * 2, s * 2);
      continue;
    }

    const flash = e.flashT > 0 && !assist.calm;
    if (e.kind === 'bat') {
      let img = BAT_FRAMES[(e.t >> 3) % 2];
      if (flash) img = whiten(img);
      ctx.save();
      if (e.face < 0) { ctx.translate(x + 14, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
      else ctx.drawImage(img, x - 1, y);
      ctx.restore();
    } else if (e.kind === 'spider') {
      const wob = e.webWobble > 0 ? Math.sin(frame * 1.3) * 1.5 : 0;
      ctx.strokeStyle = e.webHp >= 3 ? '#8f8a9e' : e.webHp === 2 ? '#6f6a80' : '#4f4a60';
      if (e.webHp < 3) ctx.setLineDash(e.webHp === 2 ? [4, 2] : [2, 3]);  // fraying
      ctx.beginPath();
      ctx.moveTo(x + 5.5, e.anchorY);
      ctx.quadraticCurveTo(x + 5.5 + wob * 2, (e.anchorY + y) / 2, x + 5.5 + wob, y + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      let img = SPIDER_FRAMES[(e.t >> 4) % 2];
      if (flash) img = whiten(img);
      ctx.drawImage(img, x - 1 + Math.round(wob), y - 1);
    } else if (e.kind === 'valkyrie') {
      let img = VALK_FRAMES[(e.t >> 3) % 2];
      if (flash) img = whiten(img);
      ctx.save();
      if (e.face < 0) { ctx.translate(x + 14, y - 1); ctx.scale(-1, 1); }
      else ctx.translate(x - 2, y - 1);
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = flash ? '#ffffff' : '#8f95a8'; ctx.fillRect(12, 5, 9, 1);   // spear shaft
      ctx.fillStyle = flash ? '#ffffff' : '#e8e4f4'; ctx.fillRect(21, 4, 2, 3);   // spear tip
      ctx.restore();
    } else if (e.kind === 'snake') {
      let img = SNAKE_FRAMES[(e.t >> 4) % 2];
      if (flash) img = whiten(img);
      ctx.save();
      if (e.dir < 0) ctx.drawImage(img, x - 2, y);
      else { ctx.translate(x + 22, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
      ctx.restore();
    } else if (e.kind === 'ant' || e.kind === 'roach' || e.kind === 'rat') {
      const frames = e.kind === 'ant' ? ANT_FRAMES :
                     e.kind === 'roach' ? ROACH_FRAMES : RAT_FRAMES;
      let img = frames[(e.t >> (e.kind === 'ant' ? 2 : 3)) % 2];
      if (flash) img = whiten(img);
      ctx.save();
      if (e.dir < 0) { ctx.translate(x + img.width, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
      else ctx.drawImage(img, x, y);
      ctx.restore();
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), 2, 2);
  }
}

function drawButtonEye(x, y, glow) {
  if (glow) {
    ctx.fillStyle = 'rgba(232,198,106,0.12)';
    ctx.fillRect(x - 2, y - 2, 11, 11);
  }
  ctx.fillStyle = '#171717';
  ctx.fillRect(x + 1, y, 5, 7); ctx.fillRect(x, y + 1, 7, 5);
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + 1, y + 1, 1, 1);   // sheen
  ctx.fillStyle = '#8a7a5c';                                     // thread holes
  ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 4, y + 2, 1, 1);
  ctx.fillRect(x + 2, y + 4, 1, 1); ctx.fillRect(x + 4, y + 4, 1, 1);
}

function drawEyePickups() {
  for (const ep of eyePickups) {
    if (ep.taken) continue;
    const x = Math.round(ep.x - camX);
    if (x < -12 || x > VIEW_W + 12) continue;
    const y = Math.round(ep.y + Math.sin(ep.t / 25) * 3);
    drawButtonEye(x, y, (ep.t >> 4) % 3 !== 0);
  }
}

function drawHeart(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 3, 3); ctx.fillRect(x + 4, y, 3, 3);
  ctx.fillRect(x, y + 2, 7, 3); ctx.fillRect(x + 1, y + 5, 5, 1);
  ctx.fillRect(x + 2, y + 6, 3, 1); ctx.fillRect(x + 3, y + 7, 1, 1);
}

function drawHUD() {
  // hearts (the small things chew them half at a time)
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 12;
    drawHeart(x, 6, '#3a2530');                       // empty socket
    if (player.hp >= i + 1) drawHeart(x, 6, '#c9304a');
    else if (player.hp >= i + 0.5) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, 6, 4, 8); ctx.clip();
      drawHeart(x, 6, '#c9304a');                     // the left half survives
      ctx.restore();
    }
  }
  // lost eyes found (an outdoor hunt)
  if (level === 1) {
    drawButtonEye(6, 17, false);
    pixelText(Math.min(eyesFound, EYES_TOTAL) + '/' + EYES_TOTAL, 16, 17, '#8a7a5c');
  }
  pixelText('SCORE ' + score, VIEW_W - 6 - (7 + String(score).length) * 6, 6, '#cfc3e8');
  const st = creepStage();
  pixelText('CREEP', 6, VIEW_H - 12, '#9a8fb0');
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i <= st ? ['#8878a8', '#a06888', '#b04858', '#d02838'][i] : '#241c30';
    ctx.fillRect(42 + i * 8, VIEW_H - 12, 6, 5);
  }
  // the fifth notch marks the melt — a red gone almost black
  const ix = 42 + 4 * 8;
  ctx.fillStyle = inkMelt ? '#3a0408' : '#241c30';
  ctx.fillRect(ix, VIEW_H - 12, 6, 5);
  if (inkMelt) {
    ctx.fillStyle = '#6a1018';                       // a glint so it reads
    ctx.fillRect(ix, VIEW_H - 12, 6, 1);
    ctx.fillStyle = '#2a0306';                       // and it drips
    const dl = (frame * 0.25) % 9;
    ctx.fillRect(ix + 2 + (frame >> 6) % 3, VIEW_H - 7, 1, 1 + Math.round(dl / 3));
  }

  if (flashText) {
    flashText.t--;
    if (flashText.t < 0) flashText = null;
    else if (flashText.hold || (flashText.t >> 3) % 4 !== 0) {
      const w = flashText.msg.length * 6;
      pixelText(flashText.msg, (VIEW_W - w) / 2, 60, '#e8d8f0');
    }
  }
}

// chunky uppercase bitmap-ish text using canvas font at low res
function pixelText(msg, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = '7px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(msg.toUpperCase(), Math.round(x), Math.round(y));
}
function bigText(msg, x, y, color, size) {
  ctx.fillStyle = color;
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(msg, Math.round(x), Math.round(y));
}

/* ---------------- the eyeless dragon ---------------- */
function updateDragon() {
  if (level === 2) return;                           // no wings indoors
  if (!dragon.spawned && playTime > 3600) {          // one minute in
    dragon.spawned = dragon.active = true;
    dragon.x = Math.max(0, player.x - 160);
    dragon.y = 50;
    flashText = { msg: 'wings in the dark...', t: 150 };
    sfx(55, 1.2, 'sine', 0.09, 40);
  }
  if (!dragon.active) return;
  dragon.t++;
  if (dragon.gustCd > 0) dragon.gustCd--;
  if (dragon.ballCd > 0) dragon.ballCd--;
  if (dragon.mountCd > 0) dragon.mountCd--;

  // the sky sends its daughters after anyone who dares to fly
  if (dragon.ridden) {
    dragon.valkT++;
    const aloft = enemies.filter(e => e.kind === 'valkyrie' && !e.dead).length;
    if (dragon.valkT > 240 && aloft < 3) {
      dragon.valkT = 0;
      const side = Math.random() < 0.5 ? -1 : 1;
      const vx = camX + (side > 0 ? VIEW_W + 20 : -30);
      enemies.push(makeValkyrie(vx, Math.max(14, player.y + (Math.random() - 0.5) * 60)));
      sfx(392, 0.25, 'sawtooth', 0.045, 100);
      sfx(494, 0.35, 'sawtooth', 0.035, 80);
      if (!dragon.valkSeen) {
        dragon.valkSeen = true;
        flashText = { msg: 'the sky sends its daughters...', t: 150 };
      }
    }
  }

  if (!dragon.ridden) {
    // she is followed. patiently.
    const tx = player.x - 46, ty = Math.max(36, player.y - 44);
    dragon.x += (tx - dragon.x) * 0.03;
    dragon.y += (ty - dragon.y) * 0.03 + Math.sin(dragon.t / 22) * 0.4;
    dragon.face = player.x > dragon.x + 12 ? 1 : -1;
    // the doll lands on its back -> she rides
    if (dragon.mountCd <= 0 && player.vy > 0 && !player.onGround &&
        player.x + player.w > dragon.x + 4 && player.x < dragon.x + dragon.w - 4 &&
        player.y + player.h > dragon.y - 5 && player.y + player.h < dragon.y + 9) {
      dragon.ridden = true;
      dragon.vx = 0; dragon.vy = 0;
      flashText = { msg: 'she rides.', t: 100 };
      sfx(320, 0.35, 'triangle', 0.08, 260);
    }
  }
}

function updateRiding() {
  const spd = 1.7;
  if (kLeft())       { dragon.vx = -spd; dragon.face = -1; }
  else if (kRight()) { dragon.vx = spd;  dragon.face = 1; }
  else dragon.vx *= 0.9;
  if (keys['arrowup'] || keys['w']) dragon.vy = -1.5;
  else if (kDown())                 dragon.vy = 1.5;
  else                              dragon.vy = Math.sin(frame / 18) * 0.3;
  moveAndCollide(dragon);
  dragon.y = Math.max(6, Math.min(dragon.y, 132));
  dragon.x = Math.max(2, Math.min(dragon.x, LEVEL_W - dragon.w - 2));

  player.face = dragon.face;
  player.x = dragon.x + (dragon.w - player.w) / 2;
  player.y = dragon.y - 13;
  player.vx = dragon.vx; player.vy = 0;
  player.onGround = false; player.crouch = false; player.h = 18;
  player.chargeT = 0; player.attack = null;

  // punch: a small gust of flame
  if (kPunch() && !punchHeld && dragon.gustCd <= 0) {
    dragon.gustCd = 14;
    sfx(150, 0.14, 'sawtooth', 0.06, 220);
    const gx = dragon.face > 0 ? dragon.x + dragon.w : dragon.x - 22;
    const gust = { x: gx, y: dragon.y - 4, w: 22, h: 16 };
    for (let i = 0; i < 7; i++)
      particles.push({ x: gx + (dragon.face > 0 ? 2 : 20), y: dragon.y + 2 + (Math.random() - 0.5) * 8,
                       vx: dragon.face * (1.5 + Math.random() * 1.5), vy: (Math.random() - 0.5),
                       t: 12 + Math.random() * 8, color: Math.random() < 0.5 ? '#ffa030' : '#ffce6a' });
    for (const e of enemies)
      if (!e.dead && rectsOverlap(gust, e)) {
        e.hp--; e.flashT = 6;
        if (e.hp <= 0) killEnemy(e);
      }
  }
  // kick: a flame ball
  if (kKick() && !kickHeld && dragon.ballCd <= 0) {
    dragon.ballCd = 26;
    sfx(240, 0.2, 'square', 0.07, -140);
    fireballs.push({ x: dragon.face > 0 ? dragon.x + dragon.w : dragon.x - 5,
                     y: dragon.y + 1, vx: dragon.face * 3.2, t: 0 });
  }
  punchHeld = kPunch(); kickHeld = kKick(); jumpHeld = kJump();

  // hop off with C (brief cooldown so she doesn't fall straight back on)
  if (kCrouch() && !crouchHeld) {
    dragon.ridden = false; player.vy = -1.5; dragon.mountCd = 50;
  }
  crouchHeld = kCrouch();
}

function updateFireballs() {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.x += f.vx; f.t++;
    if (f.t % 3 === 0)
      particles.push({ x: f.x + 2, y: f.y + 2, vx: -f.vx * 0.1,
                       vy: (Math.random() - 0.5) * 0.6, t: 9, color: '#ffce6a' });
    let gone = f.t > 100 || solidAt(f.x + 2, f.y + 2);
    for (const e of enemies) {
      if (!e.dead && rectsOverlap({ x: f.x, y: f.y, w: 5, h: 5 }, e)) {
        e.hp -= 2;
        e.flashT = 6;
        if (e.hp <= 0) killEnemy(e); else e.x += Math.sign(f.vx) * 6;
        gone = true; break;
      }
    }
    if (gone) {
      burst(f.x + 2, f.y + 2, '#ff8030', 6, Math.sign(f.vx) * 1.8);
      addShake(1.5, 6);
      fireballs.splice(i, 1);
    }
  }
}

function drawDragon() {
  if (!dragon.active) return;
  const x = Math.round(dragon.x - camX), y = Math.round(dragon.y);
  if (x < -50 || x > VIEW_W + 50) return;
  const flapUp = (dragon.t >> 3) % 2 === 0;
  ctx.save();
  if (dragon.face < 0) { ctx.translate(x + dragon.w, y); ctx.scale(-1, 1); }
  else ctx.translate(x, y);
  const P = '#6b3f94', D = '#54307a', B = '#b795d6', W = '#8a5cb8';
  // tail
  ctx.fillStyle = D;
  ctx.fillRect(-4, 5, 5, 2); ctx.fillRect(-7, 3, 4, 2);
  // body
  ctx.fillStyle = P; ctx.fillRect(1, 2, 20, 9);
  ctx.fillStyle = B; ctx.fillRect(3, 8, 16, 3);
  // neck + head — a smooth face with no eyes at all
  ctx.fillStyle = P; ctx.fillRect(19, 0, 5, 6);
  ctx.fillRect(22, -2, 8, 7);
  ctx.fillStyle = D; ctx.fillRect(29, 1, 1, 1); // nostril only
  ctx.fillStyle = B; ctx.fillRect(23, -4, 1, 2); ctx.fillRect(26, -4, 1, 2); // horns
  // wing
  ctx.fillStyle = W;
  if (flapUp) { ctx.fillRect(6, -7, 10, 4); ctx.fillRect(8, -3, 8, 3); }
  else        { ctx.fillRect(6, 6, 10, 4);  ctx.fillRect(8, 3, 8, 3); }
  // dangling legs
  ctx.fillStyle = D; ctx.fillRect(6, 11, 2, 3); ctx.fillRect(14, 11, 2, 3);
  ctx.restore();
  // mounting hint
  if (!dragon.ridden && Math.abs(player.x - dragon.x - 10) < 60 && (frame >> 5) % 2)
    pixelText('JUMP ON', x - 2, y - 16, '#cbb8e8');
}

function drawFireballs() {
  for (const f of fireballs) {
    const x = Math.round(f.x - camX), y = Math.round(f.y);
    ctx.fillStyle = (f.t >> 1) % 2 ? '#ff8030' : '#ffce6a';
    ctx.fillRect(x, y, 5, 5);
    ctx.fillStyle = '#fff0c0';
    ctx.fillRect(x + 1, y + 1, 3, 3);
  }
}

/* ---------------- level 2 boss: the boy, at his worst ---------------- */
const boss = { active: false, hp: 3, x: 235, w: 40, h: 56, dir: -1, t: 0,
               phase: 'fight',   // fight | shrink | crouch | laugh | run | cat
               phaseT: 0, hurtT: 0, shootCd: 100,
               boltT: 0, boltCd: 180, roachCd: 200, held: {} };
const bossBats = [];     // {x,y,baseY,vx,t,w,h,state:'fly'|'down'}
const bossRoaches = [];  // {x,y,dir,t,w,h,state:'run'|'down'}
const thrown = [];       // {kind,x,y,vx,vy}
let carrying = null;     // 'bat' | 'roach'
const cat = { x: -40, t: 0 };

function bEdge(name, cur) {
  const was = boss.held[name];
  boss.held[name] = cur;
  return cur && !was;
}

function startBoss() {
  state = 'boss';
  boss.active = true; boss.hp = 3; boss.t = 0;
  boss.phase = 'fight'; boss.phaseT = 0; boss.hurtT = 0;
  boss.x = 235; boss.dir = -1;
  boss.shootCd = 100; boss.boltCd = 180; boss.boltT = 0; boss.roachCd = 200;
  boss.held = {};
  bossBats.length = 0; bossRoaches.length = 0; thrown.length = 0;
  carrying = null;
  cat.x = -40; cat.t = 0;
  camX = 0;
  particles.length = 0;
  player.x = 30; player.y = 126; player.vx = 0; player.vy = 0; player.face = 1;
  player.crouch = false; player.h = 18; player.attack = null; player.chargeT = 0;
  player.invuln = 60;
  musicStep = 0;
  flashText = { msg: 'the boy is not a boy.', t: 150 };
  sfx(60, 1.5, 'sawtooth', 0.08, 30);
}

function bossHit() {
  boss.hp--;
  boss.hurtT = 30;
  score += 500;
  addShake(3, 12);
  boss.boltCd = Math.min(boss.boltCd, 18);           // the sky answers
  burst(boss.x + 18, 110, '#a01828', 12, -1.5);
  sfx(90, 0.5, 'sawtooth', 0.09, -30);               // a roar too big for a boy
  sfx(700, 0.2, 'sawtooth', 0.05, -300);
  if (boss.hp <= 0) {
    boss.phase = 'shrink'; boss.phaseT = 0;
    flashText = { msg: 'the third one lands.', t: 100 };
  } else {
    flashText = { msg: boss.hp === 2 ? 'he bleeds. he quickens.' : 'again. one more.', t: 100 };
  }
}

function updateBoss() {
  boss.t++;
  if (boss.hurtT > 0) boss.hurtT--;
  if (boss.boltT > 0) boss.boltT--;

  // the storm keeps time with his wounds
  if (--boss.boltCd <= 0) {
    boss.boltCd = 240 - (3 - boss.hp) * 65 + Math.random() * 90;
    boss.boltT = 12;
    sfx(1400, 0.1, 'sawtooth', 0.03, -900);
    setTimeout(() => sfx(55, 0.9, 'sawtooth', 0.07, -15), 220);
  }

  updateBossDoll();

  if (boss.phase === 'fight') {
    // he paces, faster as he bleeds
    const spd = 0.25 + (3 - boss.hp) * 0.3;
    boss.x += boss.dir * spd;
    if (boss.x < 170) boss.dir = 1;
    if (boss.x > 272) boss.dir = -1;
    // he looses bats
    if (--boss.shootCd <= 0) {
      boss.shootCd = 150 - (3 - boss.hp) * 30 + Math.random() * 40;
      bossBats.push({ x: boss.x + 6, y: 100, baseY: 88 + Math.random() * 34,
                      vx: -(1.0 + (3 - boss.hp) * 0.25), t: 0, w: 12, h: 7,
                      state: 'fly' });
      sfx(900, 0.1, 'square', 0.04, -400);
    }
    // roaches crash the fight
    if (--boss.roachCd <= 0) {
      boss.roachCd = 260 + Math.random() * 200;
      const fromLeft = Math.random() < 0.5;
      bossRoaches.push({ x: fromLeft ? -12 : VIEW_W + 2, dir: fromLeft ? 1 : -1,
                         y: 140, t: 0, w: 10, h: 4, state: 'run' });
    }
    // his body
    if (rectsOverlap({ x: boss.x, y: 144 - boss.h, w: boss.w, h: boss.h }, player))
      hurtPlayer(boss.x + boss.w / 2, 1);
  } else {
    updateBossOutro();
  }

  // bats: flying ones hunt; downed ones drop to the boards
  for (let i = bossBats.length - 1; i >= 0; i--) {
    const b = bossBats[i];
    b.t++;
    if (b.state === 'fly') {
      b.x += b.vx;
      b.y = b.baseY + Math.sin(b.t / 14) * 8;
      if (b.x < -20) { bossBats.splice(i, 1); continue; }
      if (boss.phase === 'fight' && rectsOverlap(b, player)) {
        hurtPlayer(b.x + 6, 1);
        burst(b.x + 6, b.y + 3, '#3a2c4a', 6);
        bossBats.splice(i, 1);
      }
    } else if (b.y < 137) b.y += 2;
  }

  // roaches: scuttle through, or lie where they were stomped
  for (let i = bossRoaches.length - 1; i >= 0; i--) {
    const r = bossRoaches[i];
    r.t++;
    if (r.state === 'run') {
      r.x += r.dir * 0.9;
      if (r.x < -16 || r.x > VIEW_W + 6) { bossRoaches.splice(i, 1); continue; }
      if (boss.phase === 'fight' && rectsOverlap(r, player)) {
        hurtPlayer(r.x + 5, 0.5);
        if (player.invuln === 80) {              // spent on the bite
          burst(r.x + 5, r.y + 2, '#5a3a1e', 5);
          bossRoaches.splice(i, 1);
        }
      }
    }
  }

  // thrown carcasses arc toward him
  for (let i = thrown.length - 1; i >= 0; i--) {
    const th = thrown[i];
    th.x += th.vx; th.y += th.vy; th.vy += 0.06;
    if (boss.phase === 'fight' &&
        rectsOverlap({ x: th.x, y: th.y, w: 10, h: 8 },
                     { x: boss.x, y: 144 - boss.h, w: boss.w, h: boss.h })) {
      thrown.splice(i, 1);
      bossHit();
    } else if (th.x < -15 || th.x > VIEW_W + 15 || th.y > 140) {
      burst(th.x + 4, Math.min(th.y, 140), '#6a5f80', 5);
      thrown.splice(i, 1);
    }
  }

  updateParticles();
}

// her side of the room: plain floor physics, stomps, and the pickup/throw
function updateBossDoll() {
  const spd = 1.7;
  if (kLeft())       { player.vx = -spd; player.face = -1; }
  else if (kRight()) { player.vx = spd;  player.face = 1; }
  else player.vx *= player.onGround ? 0.6 : 0.95;
  if (kJump() && !jumpHeld && player.onGround) {
    player.vy = -3.45; player.stretchT = 8; sndJump();
  }
  jumpHeld = kJump();
  if (!kJump() && player.vy < -1.2) player.vy = -1.2;
  player.vy = Math.min(player.vy + 0.095, 3.5);
  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(2, Math.min(VIEW_W - 12, player.x));
  const wasAir = !player.onGround;
  player.onGround = false;
  if (player.y >= 126) {
    if (wasAir && player.vy > 2) {
      player.squashT = 8;
      sfx(80, 0.07, 'triangle', 0.05, -30);
    }
    player.y = 126; player.vy = 0; player.onGround = true;
  }
  if (player.invuln > 0) player.invuln--;
  if (player.stretchT > 0) player.stretchT--;
  if (player.squashT > 0) player.squashT--;
  player.animT += Math.abs(player.vx) > 0.3 ? 1 : 0;

  // her heels: a falling doll knocks bats and roaches out of the fight
  if (player.vy > 0.5) {
    const feet = { x: player.x, y: player.y + player.h - 3, w: player.w, h: 6 };
    for (const b of bossBats)
      if (b.state === 'fly' && rectsOverlap(feet, b)) {
        b.state = 'down';
        player.vy = -2.6;
        score += 50;
        sfx(600, 0.08, 'square', 0.05, -250);
        burst(b.x + 6, b.y + 3, '#3a2c4a', 6, 0, 1);
      }
    for (const r of bossRoaches)
      if (r.state === 'run' && rectsOverlap(feet, r)) {
        r.state = 'down';
        player.vy = -2.6;
        score += 50;
        sfx(300, 0.06, 'square', 0.05, -150);
        burst(r.x + 5, r.y + 2, '#5a3a1e', 6, 0, 1);
      }
  }

  // punch or kick: pick a carcass up, or let one fly
  const pz = bEdge('z', kPunch()), px = bEdge('x', kKick());
  if ((pz || px) && boss.phase === 'fight') {
    if (carrying) {
      thrown.push({ kind: carrying,
                    x: player.x + (player.face > 0 ? 10 : -8), y: player.y + 3,
                    vx: player.face * 3.4, vy: -0.9 });
      carrying = null;
      sfx(280, 0.1, 'square', 0.06, 160);
    } else {
      const near = it => it.state === 'down' && it.y > 130 &&
                         Math.abs(it.x - player.x) < 16 && player.onGround;
      let idx = bossBats.findIndex(near);
      if (idx >= 0) { bossBats.splice(idx, 1); carrying = 'bat'; sfx(500, 0.07, 'triangle', 0.05); }
      else {
        idx = bossRoaches.findIndex(near);
        if (idx >= 0) { bossRoaches.splice(idx, 1); carrying = 'roach'; sfx(500, 0.07, 'triangle', 0.05); }
        else sfx(180, 0.06, 'square', 0.04, -80);      // a swing at nothing
      }
    }
  }
}

// after the third hit: he shrinks, crouches, laughs, and runs
function updateBossOutro() {
  boss.phaseT++;
  if (boss.phase === 'shrink' && boss.phaseT > 70) {
    boss.phase = 'crouch'; boss.phaseT = 0;
  } else if (boss.phase === 'crouch' && boss.phaseT > 90) {
    boss.phase = 'laugh'; boss.phaseT = 0;
    [0, 160, 320].forEach((d, i) =>
      setTimeout(() => sfx(500 - i * 60, 0.12, 'square', 0.06, -80), d));
    flashText = { msg: 'ha. ha. ha.', t: 90 };
  } else if (boss.phase === 'laugh' && boss.phaseT > 80) {
    boss.phase = 'run'; boss.phaseT = 0;
    sfx(160, 0.3, 'sawtooth', 0.04, 90);              // the door swings wide
  } else if (boss.phase === 'run') {
    boss.x += 2.2;                                     // laughing all the way
    if (boss.phaseT > 100 || boss.x > 300) {
      boss.phase = 'cat'; boss.phaseT = 0;
      cat.x = 318;
    }
  } else if (boss.phase === 'cat') {
    cat.t++;
    if (cat.x > 250) cat.x -= 0.5;
    if (boss.phaseT === 30 || boss.phaseT === 140) {
      sfx(880, 0.18, 'triangle', 0.05, 140);
      setTimeout(() => sfx(760, 0.22, 'triangle', 0.045, -120), 150);
      flashText = { msg: 'meow.', t: 60 };
    }
    if (boss.phaseT > 210) {
      state = 'win';
      score += 1000;
      sndWin();
    }
  }
}

function drawBoss() {
  const shX = shakeT > 0 ? Math.round((Math.random() - 0.5) * 2 * shakeMag) : 0;
  const shY = shakeT > 0 ? Math.round((Math.random() - 0.5) * shakeMag) : 0;
  ctx.save();
  ctx.translate(shX, shY);
  // his room, at night
  ctx.fillStyle = '#241a20'; ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
  ctx.fillStyle = '#2e222a';
  for (let i = 0; i < 10; i++) ctx.fillRect(i * 34, 16, 17, 104);
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(0, 144, VIEW_W, 32);
  ctx.fillStyle = '#4a3626'; ctx.fillRect(0, 144, VIEW_W, 4);

  // the big window: moon, rain, and the answering lightning
  const wx = 100, wy = 22, ww = 120, wh = 86;
  ctx.fillStyle = '#2e2018'; ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
  const flashing = boss.boltT > 0;
  ctx.fillStyle = flashing && !assist.calm ? '#dfe8ff' : '#10101c';
  ctx.fillRect(wx, wy, ww, wh);
  if (!flashing || assist.calm) {
    ctx.fillStyle = '#c9d0d8';
    ctx.beginPath(); ctx.arc(wx + 88, wy + 22, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#10101c';
    ctx.beginPath(); ctx.arc(wx + 83, wy + 19, 9, 0, 7); ctx.fill();
  }
  if (flashing) {
    ctx.strokeStyle = assist.calm ? '#8a92c9' : '#f0f4ff';
    ctx.beginPath();
    const bx = wx + 24 + (boss.t * 7) % 70;
    ctx.moveTo(bx, wy);
    for (let s = 1; s <= 4; s++)
      ctx.lineTo(bx + (s % 2 ? -6 : 9), wy + s * (wh / 4.5));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(160,180,220,0.35)';
  for (let i = 0; i < 26; i++) {                       // rain on the glass
    const rx = wx + ((i * 37 + frame * 2.5) % ww);
    const ry = wy + ((i * 53 + frame * 3.7) % wh);
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 6); ctx.stroke();
  }
  ctx.fillStyle = '#2e2018';                           // window cross
  ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
  ctx.fillRect(wx, wy + wh / 2 - 2, ww, 4);

  // his bed, and the door he will not stop for
  ctx.fillStyle = '#3a2a34'; ctx.fillRect(2, 128, 40, 16);
  ctx.fillStyle = '#5a4a5c'; ctx.fillRect(2, 124, 40, 6);
  ctx.fillStyle = '#8a7a8c'; ctx.fillRect(4, 121, 10, 5);
  const doorOpen = boss.phase === 'run' || boss.phase === 'cat';
  ctx.fillStyle = '#2e2018'; ctx.fillRect(286, 96, 32, 48);
  ctx.fillStyle = doorOpen ? '#08060e' : '#5a3f24';
  ctx.fillRect(290, 100, 24, 44);
  if (!doorOpen) { ctx.fillStyle = '#e8c66a'; ctx.fillRect(292, 120, 2, 2); }
  else { ctx.fillStyle = '#10101c'; ctx.fillRect(294, 104, 16, 40); }  // the night beyond

  drawDracula();
  drawBossCat();

  for (const b of bossBats) {                          // his bats
    const img = BAT_FRAMES[(b.t >> 3) % 2];
    if (b.state === 'down') {
      ctx.save();
      ctx.translate(Math.round(b.x), Math.round(b.y) + 7);
      ctx.scale(1, -1);                                // wings up, done flying
      ctx.drawImage(BAT_FRAMES[0], -1, 0);
      ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(b.x) - 1, Math.round(b.y));
    }
  }
  for (const r of bossRoaches) {                       // the uninvited
    const img = ROACH_FRAMES[(r.t >> 3) % 2];
    ctx.save();
    if (r.state === 'down') {
      ctx.translate(Math.round(r.x), Math.round(r.y) + 4);
      ctx.scale(1, -1);
      ctx.drawImage(ROACH_FRAMES[0], 0, 0);
    } else if (r.dir < 0) {
      ctx.translate(Math.round(r.x) + 10, Math.round(r.y));
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
    } else {
      ctx.drawImage(img, Math.round(r.x), Math.round(r.y));
    }
    ctx.restore();
  }
  for (const th of thrown) {                           // return to sender
    const img = th.kind === 'bat' ? BAT_FRAMES[(frame >> 2) % 2] : ROACH_FRAMES[0];
    ctx.drawImage(img, Math.round(th.x), Math.round(th.y));
  }

  drawPlayer();
  if (carrying) {                                      // held over her head
    const img = carrying === 'bat' ? BAT_FRAMES[0] : ROACH_FRAMES[0];
    ctx.drawImage(img, Math.round(player.x) - 1, Math.round(player.y) - 8);
  }
  drawParticles();

  // the whole room catches the flash
  if (flashing && !assist.calm) {
    ctx.fillStyle = 'rgba(220,230,255,' + (boss.boltT / 12) * 0.25 + ')';
    ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
  }
  ctx.restore();
  drawHUD();
}

function drawDracula() {
  if (boss.phase === 'crouch' || boss.phase === 'laugh' ||
      boss.phase === 'run' || boss.phase === 'cat') { drawOutroBoy(); return; }
  let scale = 1;
  if (boss.phase === 'shrink')
    scale = 1 - 0.72 * Math.min(1, boss.phaseT / 70);
  const x = Math.round(boss.x), y = Math.round(144 - boss.h * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (boss.hurtT > 0 && (frame >> 1) % 2) ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#181020'; ctx.fillRect(-6, 8, 52, 46);   // the cape
  ctx.fillStyle = '#241428'; ctx.fillRect(-2, 10, 44, 42);
  ctx.fillStyle = '#2a1e33'; ctx.fillRect(8, 20, 24, 32);   // the suit
  ctx.fillStyle = '#0e0a14'; ctx.fillRect(14, 22, 12, 28);
  ctx.fillStyle = '#8c2f39'; ctx.fillRect(18, 24, 4, 8);    // cravat
  ctx.fillStyle = '#d8d8e4'; ctx.fillRect(10, 0, 20, 20);   // gone pale
  ctx.fillStyle = '#0a0810';                                // widow's peak
  ctx.fillRect(8, -4, 24, 6); ctx.fillRect(18, 2, 4, 4);
  ctx.fillStyle = '#ff2030';                                // the eyes
  ctx.fillRect(13, 8, 4, 3); ctx.fillRect(23, 8, 4, 3);
  ctx.fillStyle = '#8c2f39'; ctx.fillRect(14, 14, 12, 3);
  ctx.fillStyle = '#f0f0f4';                                // fangs
  ctx.fillRect(15, 16, 2, 3); ctx.fillRect(23, 16, 2, 3);
  ctx.fillStyle = '#a01828';                                // he wears his hits
  for (let i = 0, cuts = (3 - Math.max(0, boss.hp)) * 4; i < cuts; i++)
    ctx.fillRect((i * 61) % 36, (i * 37) % 44 + 4, 3, 5);
  ctx.restore();
}

function drawOutroBoy() {
  const x = Math.round(boss.x), y = 124;
  ctx.save();
  if (boss.phase === 'crouch') {
    ctx.translate(x, y + 6);
    ctx.scale(1, 0.7);
    ctx.drawImage(KID_FRAMES.idle, 0, 0);
  } else if (boss.phase === 'laugh') {
    ctx.translate(x, y + ((frame >> 3) % 2));
    ctx.drawImage(KID_FRAMES.idle, 0, 0);
    if ((frame >> 4) % 2) pixelText('HA HA', x - 2, y - 12, '#f0e040');
  } else {
    ctx.translate(x, y);
    ctx.drawImage(KID_FRAMES.run[(frame >> 3) % 2], 0, 0);
  }
  ctx.restore();
}

function drawBossCat() {
  if (boss.phase !== 'cat') return;
  const x = Math.round(cat.x), y = 134;
  ctx.fillStyle = '#8a8a92';
  ctx.fillRect(x, y + 2, 12, 5);                       // body
  ctx.fillRect(x - 3, y, 6, 5);                        // head, facing in
  ctx.fillStyle = '#6a6a72';
  ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x, y - 2, 2, 2);   // ears
  ctx.fillRect(x + 12, y - 2, 2, 6);                   // tail up, pleased
  ctx.fillStyle = '#d0f050'; ctx.fillRect(x - 2, y + 1, 1, 1);      // an eye
  ctx.fillStyle = '#6a6a72';
  const step = (cat.t >> 3) % 2;
  ctx.fillRect(x + (step ? 1 : 2), y + 7, 2, 3);
  ctx.fillRect(x + (step ? 8 : 7), y + 7, 2, 3);
}

/* ---------------- the house dog ---------------- */
function updateDog() {
  if (level !== 2) return;
  // the first cleared table wakes it
  if (!dog.active && tables.length && player.x > tables[0] + 52) {
    dog.active = true;
    dog.x = Math.max(8, camX - 24);
    dog.y = 9 * TILE - dog.h - 1;
    dog.vx = 0; dog.vy = 0; dog.face = 1; dog.retreatT = 0;
    if (!(flashText && flashText.hold))            // held beats keep the floor
      flashText = { msg: 'the dog knows what she is.', t: 150 };
    sfx(180, 0.1, 'sawtooth', 0.06, 140);
    setTimeout(() => sfx(200, 0.12, 'sawtooth', 0.06, 110), 130);
  }
  if (!dog.active) return;

  // driven off, but never gone — it runs barking, and ten seconds later
  // it remembers whose house this is
  if (dog.deadT > 0) {
    dog.deadT--;
    if (dog.fleeT > 0) {                     // the visible part: tail, gone
      dog.t += 2;                            // legs like a cartoon
      const away = Math.sign(dog.x - player.x) || -1;
      dog.vx = away * 2.2;
      dog.face = away;
      const aheadX = away > 0 ? dog.x + dog.w + 4 : dog.x - 4;
      if (dog.onGround &&
          (solidAt(aheadX, dog.y + dog.h - 4) || !solidAt(aheadX, dog.y + dog.h + 6)))
        dog.vy = -5.6;
      dog.vy = Math.min(dog.vy + 0.3, 6.5);
      moveAndCollide(dog);
      if (--dog.barkCd <= 0) {               // barking the whole way out
        dog.barkCd = 26;
        sfx(200, 0.07, 'sawtooth', 0.045, 150);
      }
      if (dog.x < camX - 40 || dog.x > camX + VIEW_W + 40 ||
          dog.y > MAP_H * TILE + 20)
        dog.fleeT = 0;                       // out of sight, licking its pride
    }
    if (dog.deadT === 0) {
      dog.hp = 3; dog.fleeT = 0;
      dog.x = Math.max(8, camX - 24);
      dog.y = 9 * TILE - dog.h - 1;
      dog.vx = 0; dog.vy = 0; dog.retreatT = 0;
      flashText = { msg: 'the dog is back.', t: 120 };
      sfx(180, 0.1, 'sawtooth', 0.06, 140);
      setTimeout(() => sfx(200, 0.12, 'sawtooth', 0.06, 110), 130);
    }
    return;
  }

  dog.t++;
  if (dog.barkCd > 0) dog.barkCd--;
  if (dog.flashT > 0) dog.flashT--;

  if (dog.retreatT > 0) {
    dog.retreatT--;
    dog.vx *= 0.9;
  } else {
    const dir = Math.sign(player.x - dog.x) || 1;
    dog.vx = Math.max(-1.25, Math.min(1.25, dog.vx + dir * 0.05));
    dog.face = dir;
    // hop tables and stairwells like it has a thousand times
    const aheadX = dog.face > 0 ? dog.x + dog.w + 4 : dog.x - 4;
    if (dog.onGround &&
        (solidAt(aheadX, dog.y + dog.h - 4) || !solidAt(aheadX, dog.y + dog.h + 6)))
      dog.vy = -5.6;
    // it knows the house — it is never truly left behind
    if (player.x - dog.x > 460) dog.x = player.x - 420;
  }
  dog.vy = Math.min(dog.vy + 0.3, 6.5);
  moveAndCollide(dog);
  if (dog.y > MAP_H * TILE + 20) {          // fell down a stairwell; scrabbles back up
    dog.x = Math.max(8, player.x - 260);
    dog.y = 60; dog.vy = 0;
  }

  // barks when it closes in
  if (dog.barkCd <= 0 && Math.abs(player.x - dog.x) < 140) {
    dog.barkCd = 90 + Math.random() * 120;
    sfx(180, 0.08, 'sawtooth', 0.05, 120);
    setTimeout(() => sfx(160, 0.1, 'sawtooth', 0.05, 90), 110);
  }

  // teeth — and one landed bite is a job well done: it trots off,
  // satisfied, to come back for another in ten seconds
  if (dog.retreatT <= 0 && player.respawnT <= 0 && rectsOverlap(dog, player)) {
    hurtPlayer(dog.x + dog.w / 2);
    if (player.invuln === 80) {              // the bite landed just now
      dog.deadT = 600;
      dog.fleeT = 1;
      dog.barkCd = 0;
      flashText = { msg: 'the dog trots off, satisfied.', t: 100 };
    }
  }

  // her fists push it back — and the third one puts it down
  const hb = attackHitbox();
  if (hb && dog.lastHit !== hb.id && rectsOverlap(hb, dog)) {
    dog.lastHit = hb.id;
    dog.hp--;
    dog.flashT = 6;
    dog.retreatT = 70;
    dog.vx = player.face * 3;
    dog.vy = -1.5;
    sfx(300, 0.15, 'sawtooth', 0.05, 200);   // a yelp
    burst(dog.x + 8, dog.y + 4, '#c9a06a', 5, player.face * 1.5);
    if (dog.hp <= 0) {
      dog.deadT = 600;                       // ten seconds before it dares again
      dog.fleeT = 1;                         // visible until it clears the screen
      dog.retreatT = 0;
      dog.barkCd = 0;
      score += 250;
      sfx(210, 0.07, 'sawtooth', 0.055, 170);            // two sharp barks
      setTimeout(() => sfx(230, 0.07, 'sawtooth', 0.05, 160), 120);
      flashText = { msg: 'it barks, and thinks better of it.', t: 110 };
    }
  }
}

function drawDog() {
  if (!dog.active || (dog.deadT > 0 && dog.fleeT <= 0)) return;
  const x = Math.round(dog.x - camX), y = Math.round(dog.y);
  if (x < -30 || x > VIEW_W + 30) return;
  ctx.save();
  if (dog.face < 0) { ctx.translate(x + dog.w, y); ctx.scale(-1, 1); }
  else ctx.translate(x, y);
  const flash = dog.flashT > 0 && !assist.calm;
  const B = flash ? '#ffffff' : '#8a5a32',
        D = flash ? '#ffffff' : '#6d4526',
        E = flash ? '#ffffff' : '#2a1c10';
  const run = (dog.t >> 2) % 2;
  ctx.fillStyle = D; ctx.fillRect(0, run ? 0 : 2, 2, 2);        // tail wag
  ctx.fillStyle = B; ctx.fillRect(2, 2, 10, 5);                 // body
  ctx.fillStyle = D; ctx.fillRect(2, 6, 10, 1);
  ctx.fillStyle = B; ctx.fillRect(10, -1, 5, 5);                // head
  ctx.fillStyle = D; ctx.fillRect(10, -2, 2, 4);                // floppy ear
  ctx.fillStyle = E; ctx.fillRect(13, 0, 1, 1);                 // eye
  ctx.fillStyle = D; ctx.fillRect(15, 1, 1, 2);                 // nose
  ctx.fillStyle = D;                                            // legs
  if (run) { ctx.fillRect(3, 7, 2, 3); ctx.fillRect(9, 7, 2, 3); }
  else     { ctx.fillRect(4, 7, 2, 3); ctx.fillRect(8, 7, 2, 3); }
  ctx.restore();
}

/* ---------------- carnival doors & minigame worlds ---------------- */
let mini = null;

function drawDoors() {
  for (const d of doors) {
    const x = Math.round(d.x - camX);
    if (x < -22 || x > VIEW_W + 22) continue;
    if (d.kind === 'hollow') {
      // a hairline crack in the world — no marquee, no prompt, no promises
      ctx.fillStyle = d.used ? '#1a1424' : '#231a33';
      ctx.fillRect(x + 6, d.y + 2, 2, 20);
      ctx.fillRect(x + 4, d.y + 8, 2, 8);
      ctx.fillRect(x + 8, d.y + 12, 2, 6);
      if (!d.used && (frame >> 4) % 6 === 0) {       // the rarest shimmer
        ctx.fillStyle = 'rgba(160,110,220,0.35)';
        ctx.fillRect(x + 6, d.y + 4, 2, 16);
      }
      continue;
    }
    const pulse = (Math.sin(frame / 15) + 1) / 2;
    ctx.fillStyle = d.used ? '#2a2136' : '#4b3a5c';
    ctx.fillRect(x - 2, d.y - 2, 18, 24);
    ctx.fillStyle = d.used ? '#161020' : (frame >> 4) % 2 ? '#2a1a40' : '#33204d';
    ctx.fillRect(x, d.y, 14, 22);
    if (d.used) continue;
    ctx.fillStyle = 'rgba(160,110,220,' + (0.2 + pulse * 0.3) + ')';
    ctx.fillRect(x + 2, d.y + 2, 10, 20);
    for (let i = 0; i < 7; i++) {                       // marquee bulbs
      ctx.fillStyle = (i + (frame >> 3)) % 3 ? '#5a4a70' : '#e8c66a';
      ctx.fillRect(x - 2 + i * 3, d.y - 5, 2, 2);
    }
    ctx.fillStyle = d.kind === 'toss' ? '#e8a050' :
                    d.kind === 'balloon' ? '#e05060' : '#b0a8c0';
    ctx.fillRect(x + 5, d.y + 8, 4, 4);                 // sigil
    if (state === 'play' && player.onGround &&
        player.x + player.w > d.x && player.x < d.x + d.w && (frame >> 5) % 2)
      pixelText('UP', x + 2, d.y - 15, '#e8d8f0');
  }
}

function startMini(door) {
  door.used = true;
  state = 'mini';
  jumpHeld = true;
  mini = { kind: door.kind, t: 0, over: false, won: false, msg: '',
           msg2: '', msg2T: 0, doneT: 0, held: {}, parts: [] };
  musicStep = 0;                       // the carnival waltz starts at the top
  if (door.kind === 'toss')
    Object.assign(mini, { throws: 3, hits: 0, proj: null, bucketX: 190, bucketDir: 1,
                          aimPhase: 'sweep', p: 0, lockedP: 0 });
  if (door.kind === 'balloon')
    Object.assign(mini, {
      darts: 5, pops: 0, dart: null, aimY: 90, drips: [], splats: [],
      balloons: [{ x: 205, y0: 56, ph: 0, c: '#e8c66a', alive: true },
                 { x: 248, y0: 88, ph: 2, c: '#7ec9e8', alive: true },
                 { x: 288, y0: 52, ph: 4, c: '#c98fe8', alive: true },
                 { x: 232, y0: 120, ph: 1, c: '#9fe88f', alive: true }] });
  if (door.kind === 'hollow')
    Object.assign(mini, { dollX: 30, eyeTaken: false });
  if (door.kind === 'coffin') {
    const swaps = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.floor(Math.random() * 3);
      swaps.push([a, (a + 1 + Math.floor(Math.random() * 2)) % 3]);
    }
    Object.assign(mini, { phase: 'show', heartCoffin: Math.floor(Math.random() * 3),
                          slots: [0, 1, 2], swaps, swapI: 0, swapP: 0,
                          sel: 1, reveal: 0, pickOk: false });
  }
  sfx(520, 0.35, 'sine', 0.07, -400);
}

function endMini() {
  mini = null;
  state = 'play';
  jumpHeld = punchHeld = kickHeld = true;
  musicStep = 0;                       // back to the lullaby
  sfx(200, 0.3, 'sine', 0.07, 320);
}

function mEdge(name, cur) {
  const was = mini.held[name];
  mini.held[name] = cur;
  return cur && !was;
}
function mpBurst(x, y, color, n) {
  for (let i = 0; i < n; i++)
    mini.parts.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.2,
                      t: 18 + Math.random() * 14, color });
}

function updateMini() {
  mini.t++;
  for (let i = mini.parts.length - 1; i >= 0; i--) {
    const q = mini.parts[i];
    q.x += q.vx; q.y += q.vy; q.vy += 0.12;
    if (--q.t <= 0) mini.parts.splice(i, 1);
  }
  if (mini.msg2T > 0) mini.msg2T--;
  if (mini.over) return;
  if (mini.kind === 'toss') updateToss();
  else if (mini.kind === 'balloon') updateBalloon();
  else if (mini.kind === 'hollow') updateHollow();
  else updateCoffin();
}

/* --- the hollow: a bare little room behind the wall, and one lost eye --- */
function updateHollow() {
  if (kLeft())  mini.dollX = Math.max(24, mini.dollX - 1.4);
  if (kRight()) mini.dollX = Math.min(288, mini.dollX + 1.4);
  if (!mini.eyeTaken && Math.abs(mini.dollX + 7 - 160) < 10) {
    mini.eyeTaken = true;
    eyesFound++;
    score += 200;
    if (player.hp < 5) { player.hp = Math.min(5, player.hp + 1); sndHeal(); }
    sfx(880, 0.3, 'sine', 0.06); sfx(1320, 0.4, 'sine', 0.04);
    mpBurst(160, 118, '#e8c66a', 12);
    mini.msg2 = 'IT FITS.'; mini.msg2T = 130;
    mini.doneT = mini.t;
  }
  if (mini.eyeTaken && mini.t - mini.doneT > 90) {
    mini.over = true; mini.won = true;
    mini.msg = 'A LOST EYE   +200';
  }
}

function drawHollow() {
  ctx.fillStyle = '#0c0813'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // rough stones
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 3 ? '#141020' : '#181228';
    ctx.fillRect((i * 53) % VIEW_W, (i * 37) % 140, 10 + (i % 3) * 6, 5);
  }
  // three pale masks watch from the wall
  for (let i = 0; i < 3; i++) {
    const mx = 96 + i * 52, my = 52;
    ctx.fillStyle = '#3a3446';
    ctx.fillRect(mx, my, 12, 15);
    ctx.fillStyle = '#0c0813';
    ctx.fillRect(mx + 2, my + 4, 3, 3); ctx.fillRect(mx + 7, my + 4, 3, 3);
    ctx.fillRect(mx + 4, my + 10, 4, 2);
  }
  ctx.fillStyle = '#241a2a'; ctx.fillRect(0, 150, VIEW_W, 26);
  ctx.fillStyle = '#302338'; ctx.fillRect(0, 150, VIEW_W, 2);
  pixelText('THE HOLLOW', 130, 34, '#9a8fb0');
  // the pedestal and the eye
  ctx.fillStyle = '#2e2738';
  ctx.fillRect(153, 126, 14, 24);
  ctx.fillRect(150, 148, 20, 2);
  ctx.fillRect(151, 124, 18, 3);
  if (!mini.eyeTaken)
    drawButtonEye(157, 115 + Math.round(Math.sin(mini.t / 25) * 2), true);
  ctx.drawImage(DOLL[creepStage()].idle, Math.round(mini.dollX), 130);
  if (!mini.eyeTaken) pixelText('ARROWS WALK', 128, 160, '#6a5f80');
}

/* --- doll toss: land the little rag doll in the moving bucket --- */
function updateToss() {
  mini.bucketX += mini.bucketDir * 1.0;
  if (mini.bucketX < 150 || mini.bucketX > 284) mini.bucketDir *= -1;
  // golf-style two-step: lock the slow meter first, then confirm the throw
  const aiming = !mini.proj && mini.throws > 0;
  if (aiming && mini.aimPhase === 'sweep') {
    mini.p = (Math.sin(mini.t / 28) + 1) / 2;
    if (mEdge('z', kPunch())) {
      mini.aimPhase = 'locked'; mini.lockedP = mini.p;
      sfx(520, 0.06, 'square', 0.05);
    }
  } else if (aiming && mini.aimPhase === 'locked') {
    if (mEdge('z', kPunch())) {
      mini.throws--;
      mini.aimPhase = 'sweep';
      mini.proj = { x: 42, y: 114, vx: 1.4 + mini.lockedP * 2.4, vy: -2.0 - mini.lockedP * 1.7 };
      sfx(280, 0.1, 'square', 0.05, 140);
    } else if (mEdge('x', kKick())) {
      mini.aimPhase = 'sweep';
      sfx(200, 0.06, 'square', 0.04, -60);
    }
  }
  if (mini.proj) {
    const pr = mini.proj;
    pr.x += pr.vx; pr.y += pr.vy; pr.vy += 0.09;
    if (pr.vy > 0 && pr.y > 126 && pr.y < 140 &&
        pr.x > mini.bucketX + 2 && pr.x < mini.bucketX + 16) {
      mini.hits++; mini.proj = null;
      sfx(540, 0.18, 'triangle', 0.08); sfx(800, 0.25, 'triangle', 0.05);
      mpBurst(mini.bucketX + 9, 128, '#e8c66a', 10);
    } else if (pr.y > 147) {
      mini.proj = null;
      sfx(90, 0.1, 'square', 0.04, -30);
      mpBurst(pr.x, 147, '#6a5f80', 5);
    } else if (pr.x > 330) mini.proj = null;
  }
  if (!mini.proj && mini.throws === 0) {
    if (!mini.doneT) mini.doneT = mini.t;
    else if (mini.t - mini.doneT > 45) {
      mini.over = true; mini.won = mini.hits > 0;
      const bonus = mini.hits * 300;
      score += bonus;
      mini.msg = mini.hits + '/3 IN THE BUCKET   +' + bonus;
    }
  }
}

function drawToss() {
  miniBackdrop('DOLL TOSS');
  // the doll herself, mid-carnival
  ctx.drawImage(DOLL[creepStage()].idle, 22, 130);
  // power meter — frozen and flashing once locked
  const locked = mini.aimPhase === 'locked';
  const p = locked ? mini.lockedP : mini.p;
  ctx.fillStyle = '#241c30'; ctx.fillRect(8, 58, 8, 86);
  ctx.fillStyle = locked ? ((frame >> 3) % 2 ? '#f0f0d0' : '#e8c66a')
                         : p > 0.75 ? '#d04040' : '#e8c66a';
  ctx.fillRect(9, 59 + (1 - p) * 84, 6, p * 84);
  if (locked) {
    ctx.fillStyle = '#f0f0d0';
    ctx.fillRect(6, 58 + (1 - p) * 84, 12, 1);           // lock tick
    // dotted trajectory preview for the locked power
    let px = 44, py = 112, vx = 1.4 + p * 2.4, vy = -2.0 - p * 1.7;
    for (let i = 0; i < 60 && py < 146; i++) {
      px += vx; py += vy; vy += 0.09;
      if (i % 4 === 0) {
        ctx.fillStyle = 'rgba(232,216,240,0.5)';
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
    }
  }
  // bucket
  const bx = Math.round(mini.bucketX);
  ctx.fillStyle = '#5a5f6e'; ctx.fillRect(bx + 2, 130, 14, 14);
  ctx.fillStyle = '#7a8094'; ctx.fillRect(bx, 128, 18, 3);
  ctx.fillStyle = '#33363e'; ctx.fillRect(bx + 4, 133, 10, 9);
  // rag doll projectile
  if (mini.proj) {
    const pr = mini.proj;
    ctx.fillStyle = '#efe2cf'; ctx.fillRect(Math.round(pr.x), Math.round(pr.y) - 4, 3, 3);
    ctx.fillStyle = '#5b7ea3'; ctx.fillRect(Math.round(pr.x) - 1, Math.round(pr.y) - 1, 5, 4);
  }
  // throws left
  for (let i = 0; i < mini.throws; i++) {
    ctx.fillStyle = '#efe2cf'; ctx.fillRect(10 + i * 8, 46, 3, 3);
    ctx.fillStyle = '#5b7ea3'; ctx.fillRect(9 + i * 8, 49, 5, 4);
  }
  pixelText(mini.aimPhase === 'locked' ? 'Z THROW    X RE-AIM' : 'Z LOCK POWER',
            mini.aimPhase === 'locked' ? 102 : 122, 160, '#9a8fb0');
  pixelText('HITS ' + mini.hits, 272, 46, '#e8c66a');
}

/* --- balloon darts: pop them. find out what was inside. --- */
function bY(b) { return b.y0 + Math.sin((mini.t + b.ph * 20) / 30) * 6; }

function updateBalloon() {
  if (keys['arrowup'] || keys['w']) mini.aimY -= 1.3;
  if (kDown()) mini.aimY += 1.3;
  mini.aimY = Math.max(44, Math.min(140, mini.aimY));
  if (!mini.dart && mini.darts > 0 && mEdge('z', kPunch())) {
    mini.darts--;
    mini.dart = { x: 34, y: mini.aimY };
    sfx(440, 0.07, 'square', 0.05, -140);
  }
  if (mini.dart) {
    mini.dart.x += 3.4;
    for (const b of mini.balloons) {
      if (!b.alive) continue;
      const by = bY(b);
      if (Math.abs(mini.dart.x + 8 - b.x) < 7 && Math.abs(mini.dart.y - by) < 9) {
        b.alive = false; mini.pops++; mini.dart = null;
        sfx(680, 0.05, 'square', 0.08, -300);
        sfx(65, 0.5, 'sine', 0.08);                    // something wet
        mpBurst(b.x, by, '#c01828', 14);
        mini.splats.push({ x: b.x, y: by });
        for (let i = 0; i < 3; i++)
          mini.drips.push({ x: b.x - 3 + i * 3, y: by + 2, len: 0,
                            max: 26 + Math.random() * 48, spd: 0.12 + Math.random() * 0.2 });
        if (mini.pops === 1) { mini.msg2 = 'IT WAS... BLOOD.'; mini.msg2T = 140; }
        break;
      }
    }
    if (mini.dart && mini.dart.x > 330) mini.dart = null;
  }
  for (const dr of mini.drips) dr.len = Math.min(dr.max, dr.len + dr.spd);
  if (!mini.dart && mini.darts === 0) {
    if (!mini.doneT) mini.doneT = mini.t;
    else if (mini.t - mini.doneT > 55) {
      mini.over = true; mini.won = mini.pops >= 3;
      const bonus = mini.pops * 100 + (mini.won ? 200 : 0);
      score += bonus;
      mini.msg = mini.pops + ' POPPED   +' + bonus;
    }
  }
}

function drawBalloon() {
  miniBackdrop('DART & BALLOON');
  // balloons on strings
  for (const b of mini.balloons) {
    if (!b.alive) continue;
    const by = Math.round(bY(b));
    ctx.strokeStyle = '#6a5f80';
    ctx.beginPath(); ctx.moveTo(b.x + 0.5, by + 7);
    ctx.lineTo(b.x + 0.5 + Math.sin(mini.t / 25 + b.ph) * 2, by + 22); ctx.stroke();
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x - 4, by - 6, 9, 11);
    ctx.fillRect(b.x - 5, by - 4, 11, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x - 3, by - 4, 2, 3);
    ctx.fillStyle = b.c; ctx.fillRect(b.x, by + 5, 1, 2);   // knot
  }
  // blood: splats stay, drips crawl down the stall wall
  for (const s of mini.splats) {
    ctx.fillStyle = '#8c1220';
    ctx.fillRect(s.x - 3, s.y - 2, 7, 4);
    ctx.fillRect(s.x - 5, s.y, 3, 2); ctx.fillRect(s.x + 3, s.y - 4, 2, 3);
  }
  ctx.fillStyle = '#8c1220';
  for (const dr of mini.drips)
    ctx.fillRect(dr.x, Math.round(dr.y), 1, Math.round(dr.len));
  // the doll aims
  ctx.drawImage(DOLL[creepStage()].idle, 6, Math.round(mini.aimY) - 16);
  if (!mini.dart) {
    ctx.fillStyle = '#c9cede'; ctx.fillRect(24, Math.round(mini.aimY), 6, 2);
    ctx.fillStyle = '#d04040'; ctx.fillRect(22, Math.round(mini.aimY) - 1, 2, 4);
  }
  if (mini.dart) {
    const d = mini.dart;
    ctx.fillStyle = '#c9cede'; ctx.fillRect(Math.round(d.x), Math.round(d.y), 7, 2);
    ctx.fillStyle = '#e8e8f4'; ctx.fillRect(Math.round(d.x) + 7, Math.round(d.y), 2, 2);
    ctx.fillStyle = '#d04040'; ctx.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 1, 2, 4);
  }
  for (let i = 0; i < mini.darts; i++) {
    ctx.fillStyle = '#c9cede'; ctx.fillRect(10 + i * 7, 46, 5, 2);
  }
  pixelText('UP DOWN AIM   Z THROWS', 92, 160, '#9a8fb0');
  pixelText('POPS ' + mini.pops, 272, 46, '#e05060');
}

/* --- coffin shuffle: follow the heart --- */
const SLOT_X = [76, 146, 216];

function updateCoffin() {
  if (mini.phase === 'show') {
    if (mini.t > 85) { mini.phase = 'shuffle'; sfx(180, 0.1, 'square', 0.05); }
  } else if (mini.phase === 'shuffle') {
    mini.swapP++;
    if (mini.swapP >= 16) {
      const [sa, sb] = mini.swaps[mini.swapI];
      for (let c = 0; c < 3; c++) {
        if (mini.slots[c] === sa) mini.slots[c] = sb;
        else if (mini.slots[c] === sb) mini.slots[c] = sa;
      }
      mini.swapI++; mini.swapP = 0;
      sfx(130 + mini.swapI * 14, 0.05, 'square', 0.04);
      if (mini.swapI >= mini.swaps.length) mini.phase = 'pick';
    }
  } else if (mini.phase === 'pick') {
    if (mEdge('l', kLeft()) && mini.sel > 0) mini.sel--;
    if (mEdge('r', kRight()) && mini.sel < 2) mini.sel++;
    if (mEdge('z', kPunch())) {
      mini.phase = 'reveal';
      mini.pickOk = mini.slots[mini.heartCoffin] === mini.sel;
      if (mini.pickOk) {
        score += 200;
        if (player.hp < 5) { player.hp = Math.min(5, player.hp + 1); sndHeal(); }
        sfx(660, 0.3, 'triangle', 0.07);
      } else sfx(140, 0.4, 'sawtooth', 0.06, -70);
    }
  } else if (mini.phase === 'reveal') {
    mini.reveal++;
    if (mini.reveal > 120) {
      mini.over = true; mini.won = mini.pickOk;
      mini.msg = mini.pickOk ? 'SHE FEELS A LITTLE BETTER   +200' : 'WRONG BOX.';
    }
  }
}

function coffinX(c) {
  let sx = SLOT_X[mini.slots[c]];
  if (mini.phase === 'shuffle' && mini.swapI < mini.swaps.length) {
    const [sa, sb] = mini.swaps[mini.swapI];
    const pgs = mini.swapP / 16;
    if (mini.slots[c] === sa) sx = SLOT_X[sa] + (SLOT_X[sb] - SLOT_X[sa]) * pgs;
    if (mini.slots[c] === sb) sx = SLOT_X[sb] + (SLOT_X[sa] - SLOT_X[sb]) * pgs;
  }
  return Math.round(sx);
}

function drawCoffinBox(x, y) {
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(x + 4, y, 18, 7); ctx.fillRect(x, y + 7, 26, 15); ctx.fillRect(x + 3, y + 22, 20, 9);
  ctx.fillStyle = '#54402e';
  ctx.fillRect(x + 4, y, 18, 2); ctx.fillRect(x, y + 7, 2, 15);
  ctx.fillStyle = '#8a7a5c';
  ctx.fillRect(x + 12, y + 8, 2, 9); ctx.fillRect(x + 9, y + 11, 8, 2);
}

function drawCoffin() {
  miniBackdrop('COFFIN SHUFFLE');
  for (let c = 0; c < 3; c++) {
    const x = coffinX(c) - 13;
    let y = 118;
    const isHeart = c === mini.heartCoffin;
    if (mini.phase === 'show' && isHeart) y -= 16;
    if (mini.phase === 'reveal') {
      const lift = Math.min(20, mini.reveal);
      if (mini.slots[c] === mini.sel) y -= lift;
      if (!mini.pickOk && isHeart && mini.reveal > 60) y -= Math.min(16, mini.reveal - 60);
    }
    if (mini.phase === 'show' && isHeart)
      drawHeart(coffinX(c) - 3, 136, '#c9304a');
    if (mini.phase === 'reveal' && mini.slots[c] === mini.sel) {
      if (mini.pickOk) drawHeart(coffinX(c) - 3, 136, '#c9304a');
      else ctx.drawImage(SPIDER_FRAMES[(mini.reveal >> 3) % 2],
                         coffinX(c) - 6 + Math.min(60, Math.max(0, mini.reveal - 25) * 1.6), 136);
    }
    if (!mini.pickOk && mini.phase === 'reveal' && isHeart && mini.reveal > 60)
      drawHeart(coffinX(c) - 3, 136, '#c9304a');
    drawCoffinBox(x, y);
  }
  if (mini.phase === 'show') pixelText('WATCH THE HEART', 116, 60, '#e8d8f0');
  if (mini.phase === 'pick') {
    pixelText('PICK: LEFT RIGHT  Z OPENS', 84, 60, '#9a8fb0');
    const ax = SLOT_X[mini.sel];
    ctx.fillStyle = '#e8c66a';
    ctx.fillRect(ax - 1, 104, 3, 5); ctx.fillRect(ax - 3, 102, 7, 3);
  }
}

function miniBackdrop(title) {
  ctx.fillStyle = '#150d1d'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 20; i++) {                       // carnival awning
    ctx.fillStyle = i % 2 ? '#5a2333' : '#331522';
    ctx.fillRect(i * 16, 0, 16, 16);
    ctx.fillRect(i * 16 + 4, 16, 8, 4);
  }
  for (let i = 0; i < 16; i++) {                       // string lights
    ctx.fillStyle = (i + (frame >> 4)) % 4 ? '#3a2f4a' : '#e8c66a';
    ctx.fillRect(10 + i * 20, 27 + (i % 2) * 3, 2, 2);
  }
  ctx.fillStyle = '#241a2a'; ctx.fillRect(0, 150, VIEW_W, 26);
  ctx.fillStyle = '#302338'; ctx.fillRect(0, 150, VIEW_W, 2);
  pixelText(title, (VIEW_W - title.length * 6) / 2 + 8, 34, '#e8d8f0');
}

function drawMini() {
  if (mini.kind === 'toss') drawToss();
  else if (mini.kind === 'balloon') drawBalloon();
  else if (mini.kind === 'hollow') drawHollow();
  else drawCoffin();
  for (const q of mini.parts) {
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2);
  }
  if (mini.msg2T > 0 && (mini.msg2T >> 3) % 3)
    pixelText(mini.msg2, (VIEW_W - mini.msg2.length * 6) / 2 + 6, 74, '#e04050');
  if (mini.over) {
    ctx.fillStyle = 'rgba(8,4,12,0.65)'; ctx.fillRect(0, 62, VIEW_W, 56);
    pixelText(mini.msg, (VIEW_W - mini.msg.length * 6) / 2 + 4, 78,
              mini.won ? '#e8c66a' : '#9a8fb0');
    if ((frame >> 5) % 2) pixelText('PRESS ENTER', 128, 98, '#cfc3e8');
  }
}

/* ---------------- screens ---------------- */
let titleT = 0;
function drawTitle() {
  titleT++;
  drawBackground(Math.min(3, (titleT >> 8) % 4));
  ctx.fillStyle = 'rgba(5,2,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const wob = Math.sin(titleT / 40) * 2;
  bigText('CREEPY DOLL', 74, 34 + wob, '#1a0a12', 24);
  bigText('CREEPY DOLL', 72, 32 + wob, '#c9304a', 24);

  // the doll herself, big and slowly rotting
  const st = Math.min(3, (titleT >> 8) % 4);
  const img = DOLL[st].idle;
  ctx.save();
  ctx.translate(146, 74);
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, (titleT >> 5) % 2);  // gentle breathing bob
  ctx.restore();

  if (!AC) pixelText('press any key to wake her', 82, 128, '#9a8fb0');
  else if ((titleT >> 5) % 2) pixelText('press ENTER to play', 100, 128, '#e8d8f0');

  pixelText('arrows move   space jump', 82, 146, '#6a5f80');
  pixelText('z punch  x kick  c crouch', 88, 156, '#6a5f80');
  pixelText('hold down 2s: power jump', 84, 166, '#6a5f80');
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(10,2,6,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('SHE BROKE', 92, 60, '#c9304a', 20);
  pixelText('score ' + score, 136, 92, '#cfc3e8');
  if ((frame >> 5) % 2) pixelText('press ENTER', 126, 112, '#9a8fb0');
}

function drawInterlude() {
  ctx.fillStyle = 'rgba(4,2,10,0.68)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('TAG. YOU\'RE IT.', 56, 42, '#e8c66a', 20);
  pixelText('but he twists free, and runs home,', 70, 74, '#cfc3e8');
  pixelText('and slams the door behind him.', 78, 86, '#cfc3e8');
  pixelText('she knows the way. she follows.', 74, 102, '#e8d8f0');
  pixelText('score ' + score, 136, 120, '#cfc3e8');
  if ((frame >> 5) % 2) pixelText('press ENTER — into the house', 90, 140, '#9a8fb0');
}

function drawWin() {
  ctx.fillStyle = 'rgba(4,2,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('THE HOUSE IS HERS.', 34, 52, '#e8c66a', 20);
  pixelText('the boy ran laughing into the forest.', 58, 82, '#cfc3e8');
  pixelText('the cat, at least, seems friendly.', 66, 92, '#cfc3e8');
  if (eyesFound >= EYES_TOTAL)
    pixelText('and with every eye found, she sees him clearly.', 22, 102, '#e8c66a');
  pixelText('score ' + score, 136, eyesFound >= EYES_TOTAL ? 116 : 106, '#cfc3e8');
  pixelText('level three: the forest. soon.', 82, 132, '#9a8fb0');
  if ((frame >> 5) % 2) pixelText('press ENTER', 126, 148, '#cfc3e8');
}

/* ---------------- main loop ---------------- */
function tick() {
  frame++;

  if (state === 'title') {
    drawTitle();
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'mini') {
    if (!paused) {
      speedAcc += assist.speed;
      if (speedAcc >= 1) { speedAcc -= 1; updateMini(); }
    }
    drawMini();
    if (paused) drawPauseOverlay();
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'boss' || (boss.active && (state === 'gameover' || state === 'win'))) {
    if (state === 'boss' && !paused) {
      speedAcc += assist.speed;
      if (speedAcc >= 1) { speedAcc -= 1; updateBoss(); }
      if (shakeT > 0 && --shakeT === 0) shakeMag = 0;
    }
    drawBoss();
    if (state === 'gameover') drawGameOver();
    if (state === 'win') drawWin();
    if (paused && state === 'boss') drawPauseOverlay();
    requestAnimationFrame(tick);
    return;
  }

  let runUpdate = false;
  if (state === 'play' && !paused) {
    speedAcc += assist.speed;
    if (speedAcc >= 1) { speedAcc -= 1; runUpdate = true; }
  }
  if (runUpdate) {
    playTime++;
    // the night murmurs now and then
    if (AC && --ambientCd <= 0) {
      ambientCd = 480 + Math.random() * 600;
      playAmbient(creepStage());
    }
    // once the decay starts, ash sifts out of the sky — redder as she goes
    const ast = creepStage();
    if (level === 1 && ast >= 1 && frame % 9 === 0)
      particles.push({ x: camX + Math.random() * VIEW_W, y: -4,
                       vx: (Math.random() - 0.5) * 0.3, vy: 0.25 + Math.random() * 0.2,
                       t: 400, float: true,
                       color: ['', '#4a4238', '#5a3a34', '#6a2a26'][ast] });
    updatePlayer();
    if (state === 'play') {
      updateDragon();
      updateDog();
      updateKid();
    }
    updateEnemies();
    updateFireballs();
    updateHeartPickup();
    updateEyePickups();
    updateParticles();
    camX = Math.max(0, Math.min(LEVEL_W - VIEW_W, player.x - 130));
  }

  const st = creepStage();
  if (!paused && shakeT > 0 && --shakeT === 0) shakeMag = 0;
  const shX = shakeT > 0 ? Math.round((Math.random() - 0.5) * 2 * shakeMag) : 0;
  const shY = shakeT > 0 ? Math.round((Math.random() - 0.5) * shakeMag) : 0;
  ctx.save();
  ctx.translate(shX, shY);
  if (level === 2) drawHouseBackground(st);
  else drawBackground(st);
  drawTiles();
  drawCheckpoints();
  drawDoors();
  drawHouse();
  drawHeartPickup();
  drawEyePickups();
  drawKid();
  drawEnemies();
  drawDragon();
  drawDog();
  drawPlayer();
  drawFireballs();
  drawParticles();
  ctx.restore();
  drawHUD();

  // vignette creeps in with her (outside — the house keeps its lights on)
  if (st > 0 && level === 1) {
    ctx.fillStyle = 'rgba(10,0,8,' + st * 0.06 + ')';
    ctx.fillRect(0, 0, VIEW_W, 10);
    ctx.fillRect(0, VIEW_H - 10, VIEW_W, 10);
    ctx.fillRect(0, 0, 10, VIEW_H);
    ctx.fillRect(VIEW_W - 10, 0, 10, VIEW_H);
  }

  if (state === 'gameover') drawGameOver();
  if (state === 'win') drawWin();
  if (state === 'interlude') drawInterlude();
  if (paused && state === 'play') drawPauseOverlay();

  requestAnimationFrame(tick);
}

genLevel();
requestAnimationFrame(tick);
