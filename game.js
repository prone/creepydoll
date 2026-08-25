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

// Scale the canvas to fit the window: crisp integer steps when there's
// room, fluid fill on small (phone) screens where floor(scale) would
// leave the game postage-stamp sized.
const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
function fitCanvas() {
  const availH = window.innerHeight - (touchDevice ? 8 : 40);
  let s = Math.min(window.innerWidth / VIEW_W, availH / VIEW_H);
  s = s >= 2 ? Math.floor(s) : Math.max(0.5, s);
  canvas.style.width = Math.round(VIEW_W * s) + 'px';
  canvas.style.height = Math.round(VIEW_H * s) + 'px';
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
function paintRows(g, rows, pal) {
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x, y, 1, 1);
    }
}
function sprite(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  paintRows(c.getContext('2d'), rows, pal);
  return c;
}
function overlay(base, rows, pal) {
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  paintRows(g, rows, pal);
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

// the deep woods' own hunger (level 3)
const BEAR_PAL = { B: '#4a3320', b: '#3a2818', e: '#ff3040', c: '#2a1c10' };
const BEAR_FRAMES = [
  sprite([
    '.....bBBBBBBBBBB......',
    '...BBBBBBBBBBBBBB.....',
    '..BBBBBBBBBBBBBBBBbb..',
    '..BBBBBBBBBBBBBBBBBBe.',
    '.BBBBBBBBBBBBBBBBBBBc.',
    '.BBBBBBBBBBBBBBBBBB...',
    '..BBb..BBb...BBb..Bb..',
    '..bb...bb....bb...bb..',
  ], BEAR_PAL),
  sprite([
    '.....bBBBBBBBBBB......',
    '...BBBBBBBBBBBBBB.....',
    '..BBBBBBBBBBBBBBBBbb..',
    '..BBBBBBBBBBBBBBBBBBe.',
    '.BBBBBBBBBBBBBBBBBBBc.',
    '.BBBBBBBBBBBBBBBBBB...',
    '...BBb..BBb..BBb..Bb..',
    '..bb....bb....bb..bb..',
  ], BEAR_PAL),
];

const WOLF_PAL = { G: '#5a5a64', g: '#44444e', w: '#8a8a94', e: '#ffd040', t: '#3a3a44' };
const WOLF_FRAMES = [
  sprite([
    't.....gGGGGg....gg',
    'tt...GGGGGGGGg.GGg',
    '.t..GGGGGGGGGGGGeG',
    '..gGGGGGGGGGGGGGww',
    '...GGGGGGGGGGGGw..',
    '...Gg..GGg..GGg...',
    '...g...g....g.....',
  ], WOLF_PAL),
  sprite([
    't.....gGGGGg....gg',
    '.t...GGGGGGGGg.GGg',
    '.tt.GGGGGGGGGGGGeG',
    '..gGGGGGGGGGGGGGww',
    '...GGGGGGGGGGGGw..',
    '..Gg...GGg...GGg..',
    '..g.....g.....g...',
  ], WOLF_PAL),
];

const LION_PAL = { L: '#a3803a', l: '#8a6a2e', w: '#d9c8a2', e: '#ff3040', t: '#6d5324' };
const LION_FRAMES = [
  sprite([
    't......lLLLLl...ll',
    '.tt...LLLLLLLLl.Ll',
    '..t..LLLLLLLLLLLeL',
    '...lLLLLLLLLLLLLww',
    '...LLLLLLLLLLLLw..',
    '...Ll..LLl..LLl...',
    '...l...l....l.....',
  ], LION_PAL),
  sprite([
    't......lLLLLl...ll',
    'tt....LLLLLLLLl.Ll',
    '.t...LLLLLLLLLLLeL',
    '...lLLLLLLLLLLLLww',
    '...LLLLLLLLLLLLw..',
    '..Ll...LLl...LLl..',
    '..l.....l.....l...',
  ], LION_PAL),
];

// the mountain's tenants (level 4)
const GOAT_PAL = { F: '#d9d5c9', f: '#b8b4a6', h: '#8a7a5c', e: '#2a1c10' };
const GOAT_FRAMES = [
  sprite([
    'hh....fFFFFf....',
    '.h...FFFFFFFFf.f',
    '..h.FFFFFFFFFFFe',
    '...fFFFFFFFFFFf.',
    '...FFFFFFFFFFf..',
    '...Ff..FFf..Ff..',
    '...f...f....f...',
  ], GOAT_PAL),
  sprite([
    'hh....fFFFFf....',
    '.h...FFFFFFFFf.f',
    '..h.FFFFFFFFFFFe',
    '...fFFFFFFFFFFf.',
    '...FFFFFFFFFFf..',
    '..Ff...FFf...Ff.',
    '..f.....f.....f.',
  ], GOAT_PAL),
];
const OWL_PAL = { W: '#e8e4da', w: '#a8a49a', e: '#e8c66a', b: '#c9903a' };
const OWL_FRAMES = [
  sprite([
    'WW..........WW',
    'WWW..wWWw..WWW',
    '.WWWWWWWWWWWW.',
    '..WWeWWWWeWW..',
    '...WWWbbWWW...',
    '....WwWWwW....',
    '.....W..W.....',
  ], OWL_PAL),
  sprite([
    '..............',
    '..W..wWWw..W..',
    '.WWWWWWWWWWWW.',
    'WWWWeWWWWeWWWW',
    'WW.WWWbbWWW.WW',
    '....WwWWwW....',
    '.....W..W.....',
  ], OWL_PAL),
];
const WHITEWOLF_PAL = { G: '#c9ccd6', g: '#a8adc0', w: '#f0f2f8', e: '#7ec9e8', t: '#8a8fa4' };
const WHITEWOLF_FRAMES = [
  sprite([
    't.....gGGGGg....gg',
    'tt...GGGGGGGGg.GGg',
    '.t..GGGGGGGGGGGGeG',
    '..gGGGGGGGGGGGGGww',
    '...GGGGGGGGGGGGw..',
    '...Gg..GGg..GGg...',
    '...g...g....g.....',
  ], WHITEWOLF_PAL),
  sprite([
    't.....gGGGGg....gg',
    '.t...GGGGGGGGg.GGg',
    '.tt.GGGGGGGGGGGGeG',
    '..gGGGGGGGGGGGGGww',
    '...GGGGGGGGGGGGw..',
    '..Gg...GGg...GGg..',
    '..g.....g.....g...',
  ], WHITEWOLF_PAL),
];

// the tomb's tenants (level 5)
const MUMMY_PAL = { B: '#c9bfa2', b: '#a89e84', d: '#6d6350', e: '#7ec9e8' };
const MUMMY_FRAMES = [
  sprite([
    '..BBBBBB..',
    '.BBBBBBBB.',
    '.BbeBBebB.',
    '.BBBbBBBB.',
    '..BbBBbB..',
    '.BBBBBBBb.',
    'bBBBbBBBB.',
    '.BBbBBBbB.',
    '..BB..BB..',
    '..Bb..Bb..',
    '..BB..BB..',
    '..bb...bb.',
  ], MUMMY_PAL),
  sprite([
    '..BBBBBB..',
    '.BBBBBBBB.',
    '.BbeBBebB.',
    '.BBBbBBBB.',
    '..BbBBbB..',
    '.bBBBBBBB.',
    '.BBBbBBBb.',
    '.BbBBBbBB.',
    '..BB..BB..',
    '.BB....Bb.',
    '.Bb....BB.',
    '.bb.....bb',
  ], MUMMY_PAL),
];
const SCARAB_PAL = { S: '#2a6a5a', s: '#1c4a3e', g: '#5aa88a', L: '#14342c' };
const SCARAB_FRAMES = [
  sprite([
    '.ssSSs.L',
    'SSSSSSL.',
    'SgSSgSs.',
    'L.L.L...',
  ], SCARAB_PAL),
  sprite([
    '.ssSSs.L',
    'SSSSSSL.',
    'SgSSgSs.',
    '.L.L.L..',
  ], SCARAB_PAL),
];
const COBRA_PAL = { G: '#8a7a3a', g: '#6d5f2c', y: '#c9b26b', e: '#ff3040', t: '#d04a4a' };
const COBRA_FRAMES = [
  sprite([
    '.................GGGG...',
    '................GGGGGG..',
    '.....GGG........GeGGGG..',
    '...GGgggGG......GGGGG.t.',
    '..GGg....gGG...GGgGG.tt.',
    '.GGg.......gGGGGgG......',
    'yGG..........ggg........',
    'yy......................',
  ], COBRA_PAL),
  sprite([
    '................GGGG....',
    '...............GGGGGG...',
    '.........GGG...GeGGGG...',
    '.......GGgggG..GGGGG..t.',
    '.....GGg....gGGGgGG...t.',
    '..GGGg.......gGGgG......',
    'yGGg..........gg........',
    'yy......................',
  ], COBRA_PAL),
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
  hideT: 0, glimpseT: 0, glimpses: 0,
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
// and once the woods close around them both
const WOODS_GLIMPSE_LINES = [
  'the trees know him. they let him pass.',
  'he cannot run forever.',
  'the dark is on her side now.',
  'nearly out of woods to hide in.',
  'the chapel. of course. the chapel.',
];
// and on the climb
const SNOW_GLIMPSE_LINES = [
  'his footprints. fresh ones.',
  'cold means nothing to porcelain.',
  'he climbs. she climbs.',
  'the mountain is on nobody\'s side.',
  'a cave above. nowhere past it.',
];
// and down among the old kings
const TOMB_GLIMPSE_LINES = [
  'the dead make room for him. odd.',
  'dust settles on everyone but her.',
  'these halls end. everything here ends.',
  'the torches lean toward the deep door.',
  'a gold face over a door. his last one.',
];

/* ---------------- level ---------------- */
// map[r][c]: 0 empty, 1 ground, 2 platform, 3 furniture (solid wood)
let map = [];
const enemies = [];
let houseX = 0;         // the finale landmark: dollhouse / bedroom / chapel / cave / burial door
let level = 1;          // 1 road, 2 house, 3 deep woods, 4 snowy mountain, 5 tomb
let FINALE_GY = 9 * TILE;  // ground y at the finale landmark (the mountain raises it)

// first standable ground row at a column (solid ground with air above)
function groundTopRowAt(c) {
  for (let r = 2; r < MAP_H; r++)
    if (map[r][c] === 1 && !map[r - 1][c]) return r;
  return -1;
}

// ---- generator helpers (deterministic map scans — no rng consumed) ----
// never leave less than two tiles of standing air beneath a platform
function headroomPass() {
  for (let r = 2; r < MAP_H - 2; r++)
    for (let cc = 0; cc < MAP_W; cc++)
      if (map[r][cc] === 2 && map[r + 2][cc]) map[r][cc] = 0;
}

// a column is a gap when nothing solid fills it (platforms don't count —
// a bridged ravine is still a ravine)
function gapAt(cc) {
  for (let r = 2; r < MAP_H; r++) {
    const t = map[r][cc];
    if (t && t !== 2) return false;
  }
  return true;
}

// hang the healing heart over the level's second gap, at local height
function placeHeartOverGap() {
  heartPickup.taken = false; heartPickup.t = 0;
  heartPickup.x = -100; heartPickup.y = -100;
  let gapCount = 0, inGap = false;
  for (let cc = 0; cc < MAP_W; cc++) {
    if (gapAt(cc)) {
      if (!inGap) {
        inGap = true; gapCount++;
        if (gapCount === 2) {
          let end = cc;
          while (end < MAP_W && gapAt(end)) end++;
          const nearRow = groundTopRowAt(Math.max(0, cc - 1));
          heartPickup.x = Math.round((cc + end) / 2 * TILE) - 4;
          heartPickup.y = ((nearRow > 3 ? nearRow : 9) - 3) * TILE - 4;
          return;
        }
      }
    } else inGap = false;
  }
}

// checkpoint markers every `step` columns on standable, uncluttered ground
function placeCheckpoints(start, step) {
  checkpoints.length = 0;
  for (let target = start; target < MAP_W - 22; target += step) {
    let cc = target, gr = -1;
    while (cc < MAP_W - 18 &&
           ((gr = groundTopRowAt(cc)) < 0 || (gr >= 2 && map[gr - 2][cc])))
      cc++;
    checkpoints.push({ x: cc * TILE + 4, reached: false, gy: gr * TILE });
  }
  lastCP.x = 40; lastCP.y = 100;
}

// is x inside the quiet zone around any doorway?
const nearDoors = x => doors.some(d => x > d.x - 64 && x < d.x + 176);
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

// the alien invasion — every thirty seconds, a door that should not be there.
// reach it in three and she flies a borrowed saucer with borrowed hearts.
const saucer = { active: false, x: 0, y: 0, vx: 0, vy: 0, face: 1, t: 0,
                 doorX: -1, doorGy: 0, doorT: 0, doorCd: 1800,
                 laserCd: 0, smokeT: -1, jetCount: 0 };
const jets = [];      // {x, y, vx, t, fireCd, dead}
const missiles = [];  // {x, y, vx, vy, t}
const lasers = [];    // {x, y, vx}
const shards = [];    // porcelain, thrown at full creep: {x, y, vx, vy, t}

function enterSaucer() {
  saucer.active = true;
  saucer.x = player.x - 10;
  saucer.y = Math.max(24, player.y - 30);
  saucer.vx = 0; saucer.vy = 0; saucer.face = 1; saucer.t = 0;
  saucer.doorX = -1; saucer.doorT = 0;
  saucer.smokeT = -1; saucer.laserCd = 0;
  saucer.jetCount = 2 + Math.floor(Math.random() * 4);   // two to five
  jets.length = 0; missiles.length = 0; lasers.length = 0;
  player.hp = Math.min(10, player.hp + 5);               // five extra, alien courtesy
  player.invuln = 60;
  musicStep = 0;
  flashText = { msg: 'the saucer takes her. +5 hearts.', t: 120, hold: true };
  sfx(220, 0.6, 'sine', 0.07, 500);
}

function exitSaucer(bang) {
  saucer.active = false;
  saucer.smokeT = -1;
  saucer.doorCd = 1800;
  jets.length = 0; missiles.length = 0; lasers.length = 0;
  player.hp = Math.min(5, player.hp);                    // the loaner hearts go home
  player.vy = -1.5;
  musicStep = 0;
  if (!bang) sfx(300, 0.2, 'sine', 0.05, -150);
}

function explodeSaucer(aboard) {
  addShake(4, 18);
  for (let i = 0; i < 4; i++)
    burst(saucer.x + 8 + i * 7, saucer.y + 4,
          i % 2 ? '#ffa030' : '#ffce6a', 10, i - 1.5);
  sfx(90, 0.8, 'sawtooth', 0.1, -60);
  exitSaucer(true);
  if (aboard) {
    player.hp -= 1;                                      // one breath too long
    flashText = { msg: 'she stayed one breath too long.', t: 110, hold: true };
    sndHurt();
    if (player.hp <= 0) { state = 'gameover'; sfx(120, 1.2, 'sawtooth', 0.09, -90); }
  }
}

// the thirty-second door clock (runs whenever she is on foot)
function updateSaucerDoor() {
  if (saucer.active) return;
  if (saucer.doorT > 0) {
    saucer.doorT--;
    if (rectsOverlap({ x: saucer.doorX, y: saucer.doorGy - 24, w: 16, h: 24 }, player)) {
      enterSaucer();
      return;
    }
    if (saucer.doorT === 0) saucer.doorX = -1;           // it thought better of it
  } else if (!dragon.ridden && --saucer.doorCd <= 0) {
    saucer.doorCd = 1800;
    let cc = Math.floor((player.x + 130) / TILE), gr = -1;
    while (cc < MAP_W - 16 && (gr = groundTopRowAt(cc)) < 0) cc++;
    if (gr > 0 && cc * TILE < houseX - 280) {
      saucer.doorX = cc * TILE + 2;
      saucer.doorGy = gr * TILE;
      saucer.doorT = 180;                                // three seconds, not one more
      flashText = { msg: 'a door that should not be there. RUN.', t: 120, hold: true };
      sfx(880, 0.3, 'sine', 0.05, 240);
      sfx(1320, 0.4, 'sine', 0.03, -200);
    }
  }
}

// borrowed flight (replaces her physics while aboard)
function updateSaucerFlight() {
  saucer.t++;
  if (saucer.laserCd > 0) saucer.laserCd--;
  // the end of the line is bad news for stolen machinery
  if (saucer.smokeT < 0 && saucer.x > houseX - 260) {
    saucer.smokeT = 120;
    flashText = { msg: 'smoke. EJECT (C). NOW.', t: 110, hold: true };
    sfx(140, 0.8, 'sawtooth', 0.05, -60);
  }
  if (saucer.smokeT >= 0) {
    saucer.smokeT--;
    if (saucer.smokeT % 4 === 0)
      particles.push({ x: saucer.x + 8 + Math.random() * 18, y: saucer.y - 2,
                       vx: (Math.random() - 0.5) * 0.4, vy: -0.7,
                       t: 40, float: true, color: '#3a3a44' });
    if (saucer.smokeT <= 0) { explodeSaucer(true); return; }
  }
  const spd = 2;
  if (kLeft())       { saucer.vx = -spd; saucer.face = -1; }
  else if (kRight()) { saucer.vx = spd;  saucer.face = 1; }
  else saucer.vx *= 0.9;
  if (keys['arrowup'] || keys['w']) saucer.vy = -1.6;
  else if (kDown())                 saucer.vy = 1.6;
  else                              saucer.vy = Math.sin(saucer.t / 16) * 0.3;
  saucer.x += saucer.vx; saucer.y += saucer.vy;
  saucer.x = Math.max(2, Math.min(LEVEL_W - 36, saucer.x));
  saucer.y = Math.max(level === 2 || level === 5 ? 26 : 12, Math.min(saucer.y, 118));

  // she rides in the dome
  player.face = saucer.face;
  player.x = saucer.x + 12; player.y = saucer.y - 6;
  player.vx = saucer.vx; player.vy = 0;
  player.onGround = false; player.crouch = false; player.h = 18;
  player.chargeT = 0; player.attack = null;

  // Z: laser beams
  if (kPunch() && !punchHeld && saucer.laserCd <= 0) {
    saucer.laserCd = 9;
    lasers.push({ x: saucer.face > 0 ? saucer.x + 34 : saucer.x - 10,
                  y: saucer.y + 7, vx: saucer.face * 4.5 });
    sfx(1200, 0.08, 'square', 0.05, -700);
  }
  punchHeld = kPunch(); kickHeld = kKick(); jumpHeld = kJump();

  // C: bail out
  if (kCrouch() && !crouchHeld) {
    crouchHeld = true;
    exitSaucer(false);
    return;
  }
  crouchHeld = kCrouch();

  updateJets();
}

function updateJets() {
  // keep the squadron at strength for the duration
  while (jets.filter(j => !j.dead).length < saucer.jetCount) {
    const fromLeft = Math.random() < 0.5;
    jets.push({ x: camX + (fromLeft ? -40 : VIEW_W + 40),
                y: 14 + Math.random() * 90,
                vx: (fromLeft ? 1 : -1) * (1.3 + Math.random() * 0.6),
                t: 0, fireCd: 40 + Math.random() * 60, dead: 0 });
  }
  for (let i = jets.length - 1; i >= 0; i--) {
    const j = jets[i];
    if (j.dead) { if (++j.dead > 20) jets.splice(i, 1); continue; }
    j.t++;
    j.x += j.vx;
    j.y += Math.sin(j.t / 18) * 0.4;
    j.y = Math.max(8, Math.min(j.y, 120));
    if (--j.fireCd <= 0) {
      j.fireCd = 90 + Math.random() * 80;
      // aimed at the saucer, generously wrong
      const dx = saucer.x + 17 - j.x, dy = saucer.y + 8 - j.y;
      const d = Math.hypot(dx, dy) || 1;
      missiles.push({ x: j.x + 9, y: j.y + 3,
                      vx: dx / d * 2 + (Math.random() - 0.5) * 1.4,
                      vy: dy / d * 2 + (Math.random() - 0.5) * 1.4, t: 0 });
      sfx(500, 0.1, 'sawtooth', 0.04, -200);
    }
    if (j.x < camX - 90 || j.x > camX + VIEW_W + 90) j.vx = -j.vx;
    if (rectsOverlap({ x: j.x, y: j.y, w: 18, h: 7 },
                     { x: saucer.x, y: saucer.y, w: 34, h: 14 }))
      hurtPlayer(j.x + 9, 1);
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += m.vx; m.y += m.vy; m.t++;
    if (m.t % 3 === 0)
      particles.push({ x: m.x - m.vx, y: m.y, vx: 0, vy: -0.1,
                       t: 8, float: true, color: '#6a6f80' });
    if (rectsOverlap({ x: m.x, y: m.y, w: 6, h: 3 },
                     { x: saucer.x, y: saucer.y, w: 34, h: 14 })) {
      hurtPlayer(m.x, 1);
      burst(m.x + 2, m.y + 1, '#ffa030', 8);
      missiles.splice(i, 1);
      continue;
    }
    if (m.t > 260 || m.y > 200 || m.y < -30) missiles.splice(i, 1);
  }
  for (let i = lasers.length - 1; i >= 0; i--) {
    const L = lasers[i];
    L.x += L.vx;
    let done = L.x < camX - 40 || L.x > camX + VIEW_W + 40;
    for (const j of jets) {
      if (!j.dead && rectsOverlap({ x: L.x, y: L.y - 1, w: 10, h: 3 },
                                  { x: j.x, y: j.y, w: 18, h: 7 })) {
        j.dead = 1;
        score += 300;
        addShake(1.5, 5);
        burst(j.x + 9, j.y + 3, '#ffa030', 10, Math.sign(L.vx));
        sfx(300, 0.2, 'sawtooth', 0.07, -180);
        done = true;
        break;
      }
    }
    if (done) lasers.splice(i, 1);
  }
}

function drawSaucerDoor() {
  if (saucer.doorT <= 0 || saucer.doorX < 0) return;
  const x = Math.round(saucer.doorX - camX), gy = saucer.doorGy;
  if (x < -24 || x > VIEW_W + 24) return;
  const pulse = (Math.sin(frame / 6) + 1) / 2;
  ctx.fillStyle = '#b8c4d8';                             // a silver frame
  ctx.fillRect(x - 2, gy - 26, 20, 28);
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(x, gy - 24, 16, 24);
  ctx.fillStyle = 'rgba(106,222,138,' + (0.25 + pulse * 0.4) + ')';
  ctx.fillRect(x + 2, gy - 22, 12, 22);
  for (let i = 0; i < 4; i++) {                          // stars inside it
    ctx.fillStyle = '#e8f4ff';
    ctx.fillRect(x + 3 + (i * 5 + (frame >> 2)) % 11, gy - 20 + (i * 7) % 18, 1, 1);
  }
  // the countdown, in seconds she does not have
  pixelText(String(Math.ceil(saucer.doorT / 60)), x + 5, gy - 38, '#6ade8a');
}

function drawSaucer() {
  if (!saucer.active) return;
  const x = Math.round(saucer.x - camX), y = Math.round(saucer.y);
  // dome (she is drawn inside it by drawPlayer)
  ctx.fillStyle = 'rgba(159,232,255,0.35)';
  ctx.beginPath(); ctx.arc(x + 17, y + 4, 10, Math.PI, 0); ctx.fill();
  // disc
  ctx.fillStyle = '#8a92a4';
  ctx.fillRect(x, y + 4, 34, 7);
  ctx.fillRect(x + 4, y + 11, 26, 3);
  ctx.fillStyle = '#b8c4d8'; ctx.fillRect(x + 2, y + 4, 30, 2);
  // running lights
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = ['#6ade8a', '#e8c66a', '#d04a4a'][(i + (frame >> 3)) % 3];
    ctx.fillRect(x + 4 + i * 7, y + 8, 2, 2);
  }
  // a soft beam below
  ctx.fillStyle = 'rgba(106,222,138,0.07)';
  ctx.fillRect(x + 8, y + 14, 18, 30);
}

function drawJets() {
  for (const j of jets) {
    const x = Math.round(j.x - camX), y = Math.round(j.y);
    if (x < -30 || x > VIEW_W + 30) continue;
    if (j.dead) {
      ctx.fillStyle = 'rgba(255,160,48,' + (1 - j.dead / 20) + ')';
      ctx.fillRect(x + 6, y, j.dead, j.dead / 2);
      continue;
    }
    ctx.save();
    if (j.vx < 0) { ctx.translate(x + 18, y); ctx.scale(-1, 1); }
    else ctx.translate(x, y);
    ctx.fillStyle = '#5a6272';
    ctx.fillRect(0, 3, 16, 3);                           // fuselage
    ctx.fillRect(12, 1, 6, 2);                           // nose up? cockpit
    ctx.fillRect(4, 0, 3, 3);                            // tail fin
    ctx.fillStyle = '#8a92a4'; ctx.fillRect(6, 2, 6, 1); // wing
    ctx.fillStyle = '#ffa030'; ctx.fillRect(-2, 4, 2, 1);// afterburner
    ctx.restore();
  }
  ctx.fillStyle = '#c9cede';
  for (const m of missiles)
    ctx.fillRect(Math.round(m.x - camX), Math.round(m.y), 5, 2);
  ctx.fillStyle = '#6ade8a';
  for (const L of lasers)
    ctx.fillRect(Math.round(L.x - camX), Math.round(L.y), 10, 2);
}

// the house dog — woken by the first table, never far behind after that.
// three good hits and it barks, thinks better of it, and runs — but this is
// its house: ten seconds later it comes back.
const dog = { active: false, x: 0, y: 0, w: 16, h: 10, vx: 0, vy: 0,
              face: 1, t: 0, onGround: false, retreatT: 0, barkCd: 0,
              lastHit: -1, hp: 3, deadT: 0, fleeT: 0, flashT: 0 };
const fireballs = [];
let playTime = 0;

function genLevel() {
  FINALE_GY = 9 * TILE;
  if (level === 5) genTomb();
  else if (level === 4) genSnow();
  else if (level === 3) genWoods();
  else if (level === 2) genHouse();
  else genOutside();
}

/* ---------------- level 4: the snowy mountain ---------------- */
function genSnow() {
  map = [];
  enemies.length = 0;
  tables.length = 0;
  rngState = 0x5C04F;
  for (let r = 0; r < MAP_H; r++) map.push(new Array(MAP_W).fill(0));

  // the climb: the ground steps upward, valley floor to summit plateau
  const SUMMIT = 5;
  let c = 0, row = 9;
  while (c < MAP_W) {
    let run = rint(8, 14);
    if (c < 14) { run = 16; row = 9; }
    if (c + run > MAP_W - 18) { run = MAP_W - c; row = SUMMIT; }
    for (let i = 0; i < run && c + i < MAP_W; i++)
      for (let r = row; r < MAP_H; r++) map[r][c + i] = 1;
    c += run;
    if (c >= MAP_W - 18) break;
    c += rint(2, 3);                                  // a crevasse
    if (row > SUMMIT && rng() < 0.75) row--;          // and the next shelf is higher
  }

  doors.length = 0;                                   // no games this high up
  eyePickups.length = 0;

  // the mountain's tenants — the first shelf and the summit stay empty
  let herd = 0;
  for (let cc = 26; cc < MAP_W - 22; cc += rint(9, 15)) {
    const gr = groundTopRowAt(cc);
    if (gr < 0) continue;
    const prog = cc / MAP_W;
    if (prog < 0.15 || rng() < 0.3) continue;
    herd++;
    if (herd % 3 === 0) enemies.push(makeGoat(cc * TILE));
    else if (herd % 3 === 1) enemies.push(makeWolf(cc * TILE));
    else enemies.push(makeOwl(cc * TILE, gr * TILE - 56));
  }

  // a heart over the second crevasse, hung at local height
  placeHeartOverGap();

  // frozen crystals mark the way
  placeCheckpoints(30, 30);

  houseX = (MAP_W - 6) * TILE;                        // the ice-cave mouth
  FINALE_GY = SUMMIT * TILE;
  resetKid();
}

/* ---------------- level 5: the tomb ---------------- */
function genTomb() {
  map = [];
  enemies.length = 0;
  tables.length = 0;
  rngState = 0x70B0;
  for (let r = 0; r < MAP_H; r++) map.push(new Array(MAP_W).fill(0));

  for (let c = 0; c < MAP_W; c++) map[0][c] = 1;      // the ceiling of ages

  // corridors with pit traps
  const segs = [];
  let c = 0;
  while (c < MAP_W) {
    let run = rint(14, 24);
    if (c < 20) run = 22;
    if (c + run > MAP_W - 14) run = MAP_W - c;
    for (let i = 0; i < run && c + i < MAP_W; i++) {
      map[9][c + i] = 1; map[10][c + i] = 1;
    }
    segs.push({ s: c, e: Math.min(c + run, MAP_W) - 1 });
    c += run;
    if (c >= MAP_W - 14) break;
    c += 2;                                            // a trap for the unwary
  }

  // fallen pillars to vault (solid, two tall — like the tables of the house)
  for (let pc = 40; pc < MAP_W - 30; pc += rint(24, 38)) {
    let cc = pc;
    while (cc < MAP_W - 26 &&
           !(map[9][cc] === 1 && map[9][cc + 1] === 1 && map[9][cc + 2] === 1))
      cc++;
    let clear = true;
    for (let i = 0; i < 2; i++) if (map[8][cc + i] || map[7][cc + i]) clear = false;
    if (!clear) continue;
    for (let i = 0; i < 2; i++) { map[7][cc + i] = 3; map[8][cc + i] = 3; }
    tables.push(cc * TILE);
  }

  // high ledges along the walls
  for (let i = 0; i < 16; i++) {
    const pc = rint(26, MAP_W - 24), pr = rint(4, 6), len = rint(3, 5);
    let ok = true;
    for (let j = 0; j < len; j++)
      if (map[pr][pc + j] || map[pr + 1][pc + j] || map[pr - 1][pc + j]) ok = false;
    if (!ok) continue;
    for (let j = 0; j < len; j++) map[pr][pc + j] = 2;
  }
  headroomPass();

  // three doorways into older games
  doors.length = 0;
  [34, 92, 150].forEach((target, i) => {
    let cc = target;
    while (cc < MAP_W - 24 &&
           !(map[9][cc] === 1 && map[9][cc + 1] === 1 &&
             !map[8][cc] && !map[8][cc + 1] && !map[7][cc] && !map[7][cc + 1]))
      cc++;
    doors.push({ x: cc * TILE + 1, y: 9 * TILE - 22, w: 14, h: 22,
                 kind: ['glyphs', 'scarabs', 'spears'][i], used: false });
  });

  // the tomb's tenants — quiet at the threshold, thick near the heart
  let shamble = 0;
  for (const sg of segs) {
    if (sg.s <= 14 || sg.e >= MAP_W - 24) continue;
    const prog = sg.s / MAP_W;
    if (prog < 0.15) continue;
    const ax = (sg.s + 2) * TILE;
    if (!nearDoors(ax))
      for (let i = 0; i < 3; i++)                       // a line of scarabs
        enemies.push(makeScarab(ax + i * 10));
    const mx = (sg.s + 5) * TILE;
    if (prog > 0.3 && !nearDoors(mx) && ++shamble % 2 === 0)
      enemies.push(makeMummy(mx));
    const cx2 = (sg.s + 8) * TILE;
    if (prog > 0.2 && !nearDoors(cx2) && sg.e - sg.s > 8)
      enemies.push(makeCobra(cx2, sg.e));
  }

  eyePickups.length = 0;

  // a heart over the second trap
  placeHeartOverGap();

  // torches mark the way
  placeCheckpoints(30, 30);

  houseX = (MAP_W - 6) * TILE;                         // the burial door
  FINALE_GY = 9 * TILE;
  resetKid();
}

/* ---------------- level 3: the deep woods ---------------- */
function genWoods() {
  map = [];
  enemies.length = 0;
  tables.length = 0;
  rngState = 0xF07E57;
  for (let r = 0; r < MAP_H; r++) map.push(new Array(MAP_W).fill(0));

  // rocky ground broken by ravines, with low stone outcrops
  let c = 0;
  while (c < MAP_W) {
    let run = rint(10, 20);
    if (c < 14) run = 16;
    if (c + run > MAP_W - 14) run = MAP_W - c;
    for (let i = 0; i < run && c + i < MAP_W; i++) {
      map[9][c + i] = 1; map[10][c + i] = 1;
    }
    if (run >= 12 && c + run < MAP_W - 20) {      // the chapel approach stays flat
      const oc = c + rint(3, run - 6), ow = rint(2, 3);
      for (let i = 0; i < ow && oc + i < MAP_W; i++) map[8][oc + i] = 1;
    }
    c += run;
    if (c >= MAP_W - 14) break;
    c += rint(2, 3);
  }

  // giant trees: a trunk two tiles wide, a root arch to run beneath,
  // and branches to climb on either side
  for (let tc = 24; tc < MAP_W - 26; tc += rint(28, 42)) {
    if (map[9][tc] !== 1 || map[9][tc + 1] !== 1) continue;
    if (map[8][tc] || map[8][tc + 1]) continue;         // not atop an outcrop
    for (let r = 2; r <= 6; r++) { map[r][tc] = 4; map[r][tc + 1] = 4; }
    for (let i = tc - 3; i <= tc - 1; i++)
      if (i >= 0 && !map[4][i]) map[4][i] = 2;          // left branch, high
    for (let i = tc + 2; i <= tc + 4; i++)
      if (i < MAP_W && !map[6][i]) map[6][i] = 2;       // right branch, low
  }

  headroomPass();

  // four standing-stone doors, humming with carnival left out in the rain
  doors.length = 0;
  [30, 80, 130, 172].forEach((target, i) => {
    let cc = target;
    while (cc < MAP_W - 24 &&
           !(map[9][cc] === 1 && map[9][cc + 1] === 1 &&
             !map[8][cc] && !map[8][cc + 1] &&
             !map[6][cc] && !map[6][cc + 1] && !map[7][cc] && !map[7][cc + 1]))
      cc++;
    doors.push({ x: cc * TILE + 1, y: 9 * TILE - 22, w: 14, h: 22,
                 kind: ['tarot', 'bell', 'crows', 'dig'][i], used: false });
  });

  // the woods are hungry — but the treeline, the stones, and the chapel stay quiet
  let packCount = 0;
  for (let cc = 30; cc < MAP_W - 26; cc += rint(10, 16)) {
    if (map[9][cc] !== 1 || map[8][cc] || nearDoors(cc * TILE)) continue;
    const prog = cc / MAP_W;
    if (prog < 0.18 || rng() < 0.35) continue;
    packCount++;
    if (prog > 0.35 && packCount % 3 === 0) enemies.push(makeBear(cc * TILE));
    else enemies.push(makeWolf(cc * TILE));
  }
  // mountain lions wait on the branches
  for (let cc = 40; cc < MAP_W - 30; cc++)
    if ((map[4][cc] === 2 || map[6][cc] === 2) &&
        !nearDoors(cc * TILE) && tileNoise(cc, 13) < 0.12)
      enemies.push(makeLion(cc * TILE));

  eyePickups.length = 0;

  // a heart over the second ravine
  placeHeartOverGap();

  // will-o-wisps mark the way (the same souls, thinner air)
  placeCheckpoints(30, 30);

  houseX = (MAP_W - 6) * TILE;                          // the old chapel
  resetKid();
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

  headroomPass();

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
  placeHeartOverGap();

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
    checkpoints.push({ x: c * TILE + 4, reached: false, gy: 9 * TILE });
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
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (nearDoors(e.x) ||                                  // rest beats
        (e.x < LEVEL_W * 0.25 && e.kind !== 'snake') ||   // teaching zone
        e.x > (MAP_W - 26) * TILE)                        // breath before the end
      enemies.splice(i, 1);
  }
  // escalation: extra bats thicken toward the end of the road
  for (let cc = Math.floor(MAP_W * 0.5); cc < MAP_W - 26; cc += 7) {
    if (map[9][cc] !== 1 || nearDoors(cc * TILE)) continue;
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
  kid.glimpseT = 0; kid.glimpses = 0;
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

  headroomPass();

  doors.length = 0;                                    // no carnival in here
  eyePickups.length = 0;                               // her eyes were outside

  // a heart over the second stairwell
  placeHeartOverGap();

  // candles mark the way (same souls as the lanterns outside)
  placeCheckpoints(30, 30);

  houseX = (MAP_W - 6) * TILE;                         // his bedroom door
  resetKid();
}

function tileAt(px, py) {
  if (px < 0) return 1;
  const cc = Math.floor(px / TILE), rr = Math.floor(py / TILE);
  if (cc >= MAP_W) return 1;
  if (rr < 0 || rr >= MAP_H) return 0;
  return map[rr][cc];
}
// anything at all (platforms included) — footing, AI floor checks
function solidAt(px, py) { return tileAt(px, py) > 0; }
// what actually blocks a body: ground, furniture, trunks — never a thin
// platform, which is one-way (land from above, pass freely otherwise)
function hardAt(px, py) { const t = tileAt(px, py); return t > 0 && t !== 2; }

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
function makeBear(x) {
  return { kind: 'bear', x, y: 0, w: 22, h: 8, hp: 3, dir: -1,
           minX: x - 4 * TILE, maxX: x + 4 * TILE, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeWolf(x) {
  return { kind: 'wolf', x, y: 0, w: 18, h: 7, hp: 2, dir: 1,
           minX: x - 5 * TILE, maxX: x + 5 * TILE, dashT: 0, lungeCd: 0,
           t: rng() * 100, dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeLion(x) {
  return { kind: 'lion', x, y: 0, w: 18, h: 7, hp: 2, dir: -1, mode: 'perch',
           vy: 0, pounceCd: 0, minX: x - 5 * TILE, maxX: x + 5 * TILE,
           t: rng() * 100, dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeMummy(x) {
  return { kind: 'mummy', x, y: 0, w: 10, h: 12, hp: 3, dir: -1,
           minX: x - 4 * TILE, maxX: x + 4 * TILE, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeScarab(x) {
  return { kind: 'scarab', x, y: 0, w: 8, h: 4, hp: 1, dir: -1,
           dashT: 0, dashCd: 0, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeCobra(x, segEnd) {
  return { kind: 'cobra', x, y: 0, w: 20, h: 8, hp: 2, dir: 1,
           minX: x - TILE, maxX: (segEnd - 1) * TILE, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeGoat(x) {
  return { kind: 'goat', x, y: 0, w: 16, h: 7, hp: 2, dir: 1,
           minX: x - 4 * TILE, maxX: x + 4 * TILE,
           windupT: 0, chargeT: 0, chargeCd: 0, stunT: 0,
           t: rng() * 100, dead: 0, lastHit: -1, placed: false, flashT: 0 };
}
function makeOwl(x, y) {
  return { kind: 'owl', x, y, w: 14, h: 7, hp: 2, homeY: y, vx: 0, vy: 0,
           diveCd: 0, t: rng() * 100, dead: 0, lastHit: -1, face: 1, flashT: 0 };
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
let AC = null, masterGain = null, musicStep = 0, nextNoteTime = 0;

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

// the deep woods: long sine tolls with too much silence between them
const WOODS = [
  45, -1, -1, 57, -1, 52, -1, -1,
  44, -1, -1, 56, -1, 51, -1, -1,
  45, -1, -1, 57, -1, 60, -1, 59,
  52, -1, -1, 45, -1, -1, -1, -1,
];
const WOODS_STEP = 0.32;

// the saucer: an ORIGINAL late-90s eurodance hook (in the style of the era's
// trance anthems — deliberately not a transcription of any existing song)
const SAUCER_LEAD = [
  69, 69, -1, 69,  72, -1, 69, -1,  74, 74, -1, 72,  69, -1, 67, -1,
  65, 65, -1, 65,  69, -1, 65, -1,  64, 64, -1, 67,  71, -1, 64, -1,
];
const SAUCER_STEP = 0.107;   // ~140 BPM sixteenths

// the tomb: stone intervals, patient as its tenants
const TOMB = [
  41, -1, 44, -1, 48, -1, 44, -1,
  41, -1, 44, -1, 47, -1, -1, -1,
  39, -1, 42, -1, 46, -1, 42, -1,
  41, -1, 48, -1, 53, -1, -1, -1,
];
const TOMB_STEP = 0.34;

// the mountain: high, thin, and slow — notes like breath in cold air
const SNOW = [
  57, -1, 64, -1, 62, -1, 57, -1,
  55, -1, 62, -1, 60, -1, 55, -1,
  57, -1, 64, -1, 67, -1, 66, -1,
  62, -1, 60, -1, 57, -1, -1, -1,
];
const SNOW_STEP = 0.30;

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
  setInterval(scheduleMusic, 120);
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
    } else if (saucer.active) {
      // four-on-the-floor, off-beat bass, gated square lead
      const st16 = musicStep % 32;
      if (st16 % 4 === 0) musicBoxNote(38, nextNoteTime, 0.10, 0, 'sine', 0.12);
      if (st16 % 4 === 2) musicBoxNote(45, nextNoteTime, 0.055, 0, 'square', 0.09);
      const m = SAUCER_LEAD[st16];
      if (m > 0) {
        musicBoxNote(m, nextNoteTime, 0.05, 4, 'square', 0.1);
        musicBoxNote(m + 12, nextNoteTime + 0.005, 0.018, -4, 'square', 0.08);
      }
      musicStep++;
      nextNoteTime += SAUCER_STEP;
    } else if (level === 3) {
      // the woods keep their own time
      const m = WOODS[musicStep % WOODS.length];
      if (m > 0) {
        musicBoxNote(m, nextNoteTime, 0.08, (Math.random() - 0.5) * 6, 'sine', 0.9);
        if (Math.random() < 0.3)
          musicBoxNote(m + 24, nextNoteTime + 0.05, 0.02, -6, 'triangle', 0.5);
      }
      musicStep++;
      nextNoteTime += WOODS_STEP;
    } else if (level === 4) {
      // the mountain barely hums
      const m = SNOW[musicStep % SNOW.length];
      if (m > 0) {
        musicBoxNote(m, nextNoteTime, 0.07, (Math.random() - 0.5) * 5, 'triangle', 0.7);
        if (Math.random() < 0.25)
          musicBoxNote(m + 12, nextNoteTime + 0.03, 0.02, 5, 'sine', 0.5);
      }
      musicStep++;
      nextNoteTime += SNOW_STEP;
    } else if (level === 5) {
      // the tomb counts its own hours
      const m = TOMB[musicStep % TOMB.length];
      if (m > 0) {
        musicBoxNote(m, nextNoteTime, 0.085, (Math.random() - 0.5) * 6, 'square', 0.4);
        musicBoxNote(m - 12, nextNoteTime + 0.02, 0.04, 0, 'sine', 0.8);
      }
      musicStep++;
      nextNoteTime += TOMB_STEP;
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
// and the deep woods, making bigger ones (level 3)
const WOODS_AMBIENTS = [
  { minStage: 0, name: 'howl', play: () => {                 // something claims the hill
      sfx(280, 1.1, 'triangle', 0.035, 160);
      setTimeout(() => sfx(430, 0.9, 'triangle', 0.028, -60), 900); } },
  { minStage: 0, name: 'crack', play: () => {                // a branch gives up
      sfx(90, 0.06, 'square', 0.05, -40);
      setTimeout(() => sfx(70, 0.05, 'square', 0.04, -30), 90); } },
  { minStage: 0, name: 'owl', play: () => {                  // the same question as always
      sfx(392, 0.18, 'triangle', 0.03);
      setTimeout(() => sfx(330, 0.3, 'triangle', 0.028, -20), 230); } },
  { minStage: 0, name: 'pines', play: () => {                // wind through a thousand needles
      sfx(140, 2.0, 'triangle', 0.02, 50);
      setTimeout(() => sfx(180, 1.5, 'triangle', 0.014, -60), 700); } },
];
// and the mountain, saying very little (level 4)
const SNOW_AMBIENTS = [
  { minStage: 0, name: 'gust', play: () => {                 // wind with teeth
      sfx(180, 1.6, 'triangle', 0.03, 90);
      setTimeout(() => sfx(240, 1.2, 'triangle', 0.02, -80), 600); } },
  { minStage: 0, name: 'rumble', play: () => {               // something lets go, far off
      sfx(45, 1.8, 'sine', 0.06, -8);
      setTimeout(() => sfx(38, 1.4, 'sine', 0.04, -5), 800); } },
  { minStage: 0, name: 'raven', play: () => {                // one black speck complains
      sfx(560, 0.09, 'sawtooth', 0.025, -220);
      setTimeout(() => sfx(520, 0.1, 'sawtooth', 0.02, -200), 200); } },
  { minStage: 2, name: 'iceCrack', play: () => {             // the glacier shifts its grip
      sfx(1100, 0.08, 'square', 0.03, -700);
      setTimeout(() => sfx(70, 0.6, 'sine', 0.05, -20), 120); } },
];
// and the tomb, remembering (level 5)
const TOMB_AMBIENTS = [
  { minStage: 0, name: 'drip', play: () => {                 // water finding its way down
      sfx(900, 0.05, 'sine', 0.04, -300);
      setTimeout(() => sfx(700, 0.06, 'sine', 0.03, -250), 400); } },
  { minStage: 0, name: 'grind', play: () => {                // stone moving where no stone should
      sfx(55, 1.4, 'sawtooth', 0.05, 12);
      setTimeout(() => sfx(48, 1.0, 'sawtooth', 0.04, -6), 700); } },
  { minStage: 0, name: 'skitter', play: () => {              // a thousand small opinions
      [0, 80, 150, 260].forEach(d =>
        setTimeout(() => sfx(1400 + Math.random() * 400, 0.03, 'square', 0.015, -400), d)); } },
  { minStage: 2, name: 'chant', play: () => {                // the walls keep old habits
      sfx(110, 1.2, 'triangle', 0.03, 4);
      setTimeout(() => sfx(147, 1.0, 'triangle', 0.025, -4), 500); } },
];
let ambientCd = 600;
function playAmbient(stage) {
  const pool = (level === 5 ? TOMB_AMBIENTS :
                level === 4 ? SNOW_AMBIENTS :
                level === 3 ? WOODS_AMBIENTS :
                level === 2 ? HOUSE_AMBIENTS : AMBIENTS)
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

/* ---------------- gamepad: an Xbox pad speaks the same keys ----------------
   Polled each frame; button/stick edges are re-dispatched as the keyboard
   events the whole game (and its menus) already understand. */
const padHeld = {};
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  let p = null;
  for (let i = 0; i < pads.length && !p; i++)
    if (pads[i] && pads[i].connected) p = pads[i];
  if (!p) return;
  const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  const want = {
    'ArrowLeft':  b(14) || ax < -0.4,
    'ArrowRight': b(15) || ax > 0.4,
    'ArrowUp':    b(12) || ay < -0.6,       // doors (A is the jump)
    'ArrowDown':  b(13) || ay > 0.6,        // held: power jump
    ' ':      b(0),                         // A — jump
    'x':      b(1),                         // B — kick
    'z':      b(2),                         // X — punch
    'c':      b(3),                         // Y — crouch
    'Enter':  b(9),                         // menu — start / confirm
    'Escape': b(8),                         // view — pause
  };
  for (const k in want) {
    if (want[k] === !!padHeld[k]) continue;
    padHeld[k] = want[k];
    window.dispatchEvent(new KeyboardEvent(want[k] ? 'keydown' : 'keyup', { key: k }));
  }
}

/* ---------------- touch: on-screen controls, same key events ----------------
   Built by the game itself on touch devices (no markup changes, CSP-safe),
   so the Capacitor/UWP wrappers get controls for free. */
function buildTouchControls(force) {
  if (!force && !touchDevice) return;
  if (document.getElementById('touch-l')) return;
  const style = document.createElement('style');
  style.textContent =
    '#touch-l,#touch-r{position:fixed;bottom:max(12px,env(safe-area-inset-bottom));' +
    'display:flex;gap:10px;z-index:9;user-select:none;-webkit-user-select:none;touch-action:none}' +
    '#touch-l{left:max(12px,env(safe-area-inset-left))}' +
    '#touch-r{right:max(12px,env(safe-area-inset-right))}' +
    '.tbtn{width:52px;height:52px;border-radius:14px;border:2px solid #4a3f66;' +
    'background:rgba(20,12,34,0.55);color:#cfc3e8;font:700 16px monospace;' +
    'touch-action:none;padding:0}' +
    '.tbtn:active{background:rgba(90,60,140,0.6)}' +
    '#touch-sys{position:fixed;top:10px;right:10px;display:flex;gap:8px;z-index:9}' +
    '#touch-sys .tbtn{width:40px;height:40px;font-size:13px}' +
    (touchDevice ? '.hint{display:none}' : '');
  document.head.appendChild(style);
  const mk = (parent, label, key) => {
    const el = document.createElement('button');
    el.className = 'tbtn';
    el.textContent = label;
    const send = (type, e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent(type, { key }));
    };
    el.addEventListener('pointerdown', e => send('keydown', e));
    el.addEventListener('pointerup', e => send('keyup', e));
    el.addEventListener('pointercancel', e => send('keyup', e));
    el.addEventListener('pointerleave', e => send('keyup', e));
    el.addEventListener('contextmenu', e => e.preventDefault());
    parent.appendChild(el);
  };
  const L = document.createElement('div'); L.id = 'touch-l';
  const R = document.createElement('div'); R.id = 'touch-r';
  const S = document.createElement('div'); S.id = 'touch-sys';
  document.body.appendChild(L); document.body.appendChild(R); document.body.appendChild(S);
  mk(L, '◀', 'ArrowLeft'); mk(L, '▶', 'ArrowRight');
  mk(L, '▲', 'ArrowUp');   mk(L, '▼', 'ArrowDown');
  mk(R, 'C', 'c'); mk(R, 'Z', 'z'); mk(R, 'X', 'x'); mk(R, 'A', ' ');
  mk(S, '⏎', 'Enter'); mk(S, '⏸', 'Escape');
}
buildTouchControls();

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
function shakeOffset() {
  return shakeT > 0
    ? [Math.round((Math.random() - 0.5) * 2 * shakeMag),
       Math.round((Math.random() - 0.5) * shakeMag)]
    : [0, 0];
}
let inkMelt = false;            // past the second lantern, half of her runs to ink
let creepClean = false;         // a lost-all-hearts retry starts the creep meter over
let shakeT = 0, shakeMag = 0;   // screen shake: frames left, pixel magnitude
function addShake(mag, frames) {
  if (assist.calm) return;      // reduced-flash mode keeps the camera still
  shakeMag = Math.max(shakeMag, mag);
  shakeT = Math.max(shakeT, frames);
}

// cheats — assist options and level warps, locked behind a password
const assist = { invuln: false, speed: 1, hearts: false, calm: false, skipMini: false };
const SPEEDS = [1, 0.8, 0.6];
const CHEAT_PASSWORD = 'Duncan';   // case-sensitive
let cheatsOn = false, cheatBuf = '', cheatMsgT = 0, warpLevel = 1,
    rideChoice = 'dragon';         // the summon-a-ride cheat: 'dragon' | 'saucer'
let assistSel = 0;
let speedAcc = 0;               // fractional update accumulator for game speed
let lastTickT = 0;              // rAF timestamp of the previous tick
// game speed must not follow the display: when the browser hands us long
// frames (low-power mode, energy saver, 30Hz panels) run catch-up steps so
// the night never plays in slow motion. Capped so a backgrounded tab
// returning after minutes doesn't fast-forward.
function catchupSteps(dt) {
  if (dt <= 24) return 1;                    // ~60Hz or faster: one step
  return Math.min(3, Math.round(dt / (1000 / 60)));
}
function saveAssist() {
  try {
    localStorage.setItem('creepydoll-assist',
      JSON.stringify({ ...assist, unlocked: cheatsOn }));
  } catch (e) {}
}
// load stored settings field-by-field — never merge unvalidated data
// (a corrupted speed would freeze the update loop; foreign keys stay out).
// stored cheat settings only apply if the password was entered before.
try {
  const s = JSON.parse(localStorage.getItem('creepydoll-assist') || '{}');
  if (s && typeof s === 'object' && s.unlocked === true) {
    cheatsOn = true;
    assist.invuln = s.invuln === true;
    assist.hearts = s.hearts === true;
    assist.calm = s.calm === true;
    assist.skipMini = s.skipMini === true;
    assist.speed = SPEEDS.includes(s.speed) ? s.speed : 1;
  }
} catch (e) {}

function handleAssistKeys(key) {
  if (!cheatsOn) {                          // the password gate
    if (key === 'Enter') {
      if (cheatBuf === CHEAT_PASSWORD) {
        cheatsOn = true;
        saveAssist();
        sfx(660, 0.15, 'triangle', 0.06);
        sfx(990, 0.25, 'sine', 0.04);
      } else {
        cheatMsgT = 90;
        sfx(120, 0.3, 'sawtooth', 0.06, -60);
      }
      cheatBuf = '';
    } else if (key === 'Backspace') cheatBuf = cheatBuf.slice(0, -1);
    else if (key.length === 1 && cheatBuf.length < 24) cheatBuf += key;
    return;
  }
  const ROWS = 7;
  if (key === 'ArrowUp')        { assistSel = (assistSel + ROWS - 1) % ROWS; sfx(300, 0.04, 'square', 0.03); }
  else if (key === 'ArrowDown') { assistSel = (assistSel + 1) % ROWS; sfx(300, 0.04, 'square', 0.03); }
  else if (key === 'Enter' && assistSel === 5) {
    // warp: a fresh run of the chosen level
    level = warpLevel;
    resetGame();
    state = 'play';
    paused = false;
    if (AC) AC.resume();
    flashText = { msg: 'level ' + warpLevel + '. as you wish.', t: 120, hold: true };
    sfx(520, 0.3, 'sine', 0.06, -380);
  }
  else if (key === 'Enter' && assistSel === 6) {
    // summon a ride, right where she stands (mid-run only)
    if (state !== 'play' || saucer.active || dragon.ridden) {
      sfx(140, 0.12, 'square', 0.04, -40);
      return;
    }
    paused = false;
    if (AC) AC.resume();
    if (rideChoice === 'saucer') enterSaucer();
    else {
      dragon.spawned = dragon.active = dragon.ridden = true;
      dragon.x = player.x - 6; dragon.y = Math.max(20, player.y - 20);
      dragon.vx = dragon.vy = 0; dragon.t = 0; dragon.mountCd = 0;
      flashText = { msg: 'she rides.', t: 100, hold: true };
      sfx(320, 0.35, 'triangle', 0.08, 260);
    }
  }
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
    else if (assistSel === 4) assist.skipMini = on;
    else if (assistSel === 5) { warpLevel = Math.max(1, Math.min(5, warpLevel + (on ? 1 : -1))); }
    else { rideChoice = rideChoice === 'dragon' ? 'saucer' : 'dragon'; }
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
  // past the road she stays as she left it: very wrong — unless she lost
  // every heart, in which case the retry starts porcelain-clean
  if (level >= 2 && !creepClean) return 3;
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
  inkMelt = level >= 3;         // the house's candle already took half of her
  creepClean = false;           // a gameover retry flips this back on after the reset
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
  saucer.active = false; saucer.doorX = -1; saucer.doorT = 0;
  saucer.doorCd = 1800; saucer.smokeT = -1;
  jets.length = 0; missiles.length = 0; lasers.length = 0;
  shards.length = 0;
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
  if (!cheatsOn) {
    pixelText('ENABLE CHEATS', 121, 70, '#e8c66a');
    pixelText('TYPE THE PASSWORD, THEN ENTER:', 72, 92, '#9a8fb0');
    const shown = cheatBuf.length ? cheatBuf : ((frame >> 4) % 2 ? '_' : '');
    pixelText(shown, (VIEW_W - shown.length * 6) / 2, 110, '#e8d8f0');
    if (cheatMsgT > 0) {
      cheatMsgT--;
      pixelText('WRONG.', 142, 128, '#d02838');
    }
    if ((frame >> 5) % 2) pixelText('ESC TO RESUME', 122, 162, '#9a8fb0');
    return;
  }
  pixelText('CHEATS — no shame in any of it', 74, 62, '#9a8fb0');
  const rows = [
    ['invincible',        assist.invuln ? 'ON' : 'OFF'],
    ['game speed',        Math.round(assist.speed * 100) + '%'],
    ['infinite hearts',   assist.hearts ? 'ON' : 'OFF'],
    ['reduced flash',     assist.calm ? 'ON' : 'OFF'],
    ['skip minigames',    assist.skipMini ? 'ON' : 'OFF'],
    ['warp to level',     '< ' + warpLevel + ' >'],
    ['summon a ride',     '< ' + rideChoice.toUpperCase() + ' >'],
  ];
  rows.forEach((r, i) => {
    const y = 74 + i * 11, sel = i === assistSel;
    if (sel) pixelText('>', 82, y, '#e8c66a');
    pixelText(r[0], 94, y, sel ? '#e8d8f0' : '#8a7f9e');
    pixelText(r[1], 208, y, sel ? '#e8c66a' : '#8a7f9e');
  });
  pixelText('UP DOWN PICK  LEFT RIGHT SET  ENTER GOES', 48, 152, '#6a5f80');
  if ((frame >> 5) % 2) pixelText('ESC TO RESUME', 122, 164, '#9a8fb0');
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
    const retry = state === 'gameover';
    const wasTitle = state === 'title';
    if (state === 'interlude') level = Math.min(5, level + 1);
    else if (!retry) level = 1;                        // game over retries the level
    resetGame();
    // a slow-speed cheat saved last session shouldn't masquerade as lag
    if (wasTitle && assist.speed < 1)
      flashText = { msg: 'game speed ' + Math.round(assist.speed * 100) +
                         '% cheat is on — esc to change', t: 240, hold: true };
    // losing every heart wipes the creep: she retries porcelain-clean
    // and has to earn the cracks (and the ink) all over again
    if (retry) { creepClean = true; inkMelt = false; }
    score = carry;
    state = 'play';
  }
}

/* ---------------- physics ---------------- */
function moveAndCollide(p) {
  // horizontal — one-way platforms never block sideways movement
  p.x += p.vx;
  if (p.vx > 0) {
    if (hardAt(p.x + p.w, p.y + 1) || hardAt(p.x + p.w, p.y + p.h - 1)) {
      p.x = Math.floor((p.x + p.w) / TILE) * TILE - p.w - 0.01;
      p.vx = 0;
    }
  } else if (p.vx < 0) {
    if (hardAt(p.x, p.y + 1) || hardAt(p.x, p.y + p.h - 1)) {
      p.x = (Math.floor(p.x / TILE) + 1) * TILE + 0.01;
      p.vx = 0;
    }
  }
  // vertical — land on a platform only when crossing its top from above
  const prevBottom = p.y + p.h;
  p.y += p.vy;
  p.onGround = false;
  if (p.vy > 0) {
    const bottom = p.y + p.h;
    const t1 = tileAt(p.x + 1, bottom), t2 = tileAt(p.x + p.w - 1, bottom);
    const rowTop = Math.floor(bottom / TILE) * TILE;
    if ((t1 > 0 && t1 !== 2) || (t2 > 0 && t2 !== 2) ||
        ((t1 === 2 || t2 === 2) && prevBottom <= rowTop + 0.01)) {
      p.y = rowTop - p.h - 0.01;
      p.vy = 0; p.onGround = true;
    }
  } else if (p.vy < 0) {
    if (hardAt(p.x + 1, p.y) || hardAt(p.x + p.w - 1, p.y)) {
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
function tickAttack() {
  if (!player.attack) return;
  player.attack.t++;
  const dur = player.attack.type === 'punch' ? 14 : 18;
  if (player.attack.t > dur) player.attack = null;
}

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

  if (saucer.active) {
    updateSaucerFlight();
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
    } else if (!hardAt(player.x + 1, player.y - 4) &&
               !hardAt(player.x + player.w - 1, player.y - 4)) {
      player.crouch = false; player.h = 18; player.y -= 4;
      sfx(200, 0.06, 'square', 0.04, 80);
    }
  }
  crouchHeld = kCrouch();

  // walking (crouching is slow; attacks never cost her momentum)
  const speed = player.crouch ? 0.8 : 1.7;
  if (kLeft())       { player.vx = -speed; player.face = -1; }
  else if (kRight()) { player.vx = speed;  player.face = 1; }
  else player.vx *= player.onGround ? 0.6 : 0.95;

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
      if (creepStage() >= 3) {                 // at full creep she sheds porcelain
        shards.push({ x: player.x + (player.face > 0 ? 10 : -4),
                      y: player.y + 10, vx: player.face * 3, vy: -0.4, t: 0 });
        sfx(1500, 0.06, 'triangle', 0.04, -600);
      }
    }
  }
  punchHeld = kPunch(); kickHeld = kKick();
  tickAttack();

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
      lastCP.x = cp.x - 2; lastCP.y = (cp.gy || 9 * TILE) - 19;
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
      // the finale — the kid takes their place at the landmark
      kid.stage = 'final'; kid.mode = 'idle';
      kid.x = houseX - 70; kid.y = FINALE_GY - kid.h - 1;
      kid.vx = 0; kid.vy = 0; kid.face = -1;
      return;
    }
    if (kid.mode === 'hidden') {
      if (--kid.hideT <= 0) {
        // step out onto solid ground ahead of her — close enough to chase
        let c = Math.floor((player.x + 120) / TILE), gr = -1;
        while (c < MAP_W - 16 && (gr = groundTopRowAt(c)) < 0) c++;
        kid.x = c * TILE + 3; kid.y = (gr > 0 ? gr : 9) * TILE - kid.h - 1;
        kid.vx = 0; kid.vy = 0;
        kid.mode = 'peek'; kid.glimpseT = 0;
        const lines = level === 5 ? TOMB_GLIMPSE_LINES :
                      level === 4 ? SNOW_GLIMPSE_LINES :
                      level === 3 ? WOODS_GLIMPSE_LINES :
                      level === 2 ? HOUSE_GLIMPSE_LINES : GLIMPSE_LINES;
        if (kid.glimpses < lines.length)
          flashText = { msg: lines[kid.glimpses], t: 120 };
        kid.glimpses++;
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
          (hardAt(aheadX, kid.y + kid.h - 4) || !solidAt(aheadX, kid.y + kid.h + 6)))
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
        (hardAt(aheadX, kid.y + kid.h - 4) || !solidAt(aheadX, kid.y + kid.h + 6)))
      kid.vy = -6;
  }

  kid.vy = Math.min(kid.vy + 0.38, 7);
  moveAndCollide(kid);
  if (kid.y > MAP_H * TILE + 30) {      // never lose the kid down a pit
    kid.x = houseX - 40; kid.y = FINALE_GY - kid.h - 1; kid.vy = 0;
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
    } else if (level === 2) {
      startBoss();                                 // the boy is not a boy
    } else {
      startBoss();       // the wolf, the yeti, or the god — level decides
    }
  }
}

function killEnemy(e) {
  e.dead = 1;
  score += { snake: 200, valkyrie: 300, rat: 150, roach: 100, ant: 50,
             bear: 250, wolf: 200, lion: 250, goat: 200, owl: 200,
             mummy: 250, scarab: 100, cobra: 200 }[e.kind] || 100;
  sfx(90, 0.25, 'triangle', 0.07, -40);
  addShake(2, 8);
  // a bat's life feeds hers — one heart back, if she's hurt
  if (e.kind === 'bat' && player.hp < 5) {
    player.hp = Math.min(5, player.hp + 1);
    sndHeal();
    burst(player.x + 5, player.y + 6, '#e8506a', 8);
  }
}

// look one step ahead; turn at patrol bounds, cliff edges, and walls
function edgeTurn(e, bounds, walls, resetDash) {
  const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
  if ((bounds && (e.x < e.minX || e.x > e.maxX)) ||
      !solidAt(aheadX, e.y + e.h + 4) ||
      (walls && solidAt(aheadX, e.y + e.h - 2))) {
    e.dir *= -1;
    if (resetDash) e.dashT = 0;
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

    if (e.kind === 'snake' || e.kind === 'cobra') {
      e.x += e.dir * (e.kind === 'cobra' ? 0.55 : 0.45);
      edgeTurn(e, true, false, false);
    }

    if (e.kind === 'mummy') {   // it has been walking a long time
      e.x += e.dir * 0.25;
      edgeTurn(e, true, true, false);
    }

    if (e.kind === 'ant') {     // small, certain, endless
      e.x += e.dir * 0.55;
      edgeTurn(e, true, true, false);
    }

    if (e.kind === 'roach' || e.kind === 'scarab') {   // skitters, then bolts at her
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
      edgeTurn(e, false, true, true);
    }

    if (e.kind === 'goat') {    // grazes, snorts, and then arrives all at once
      if (e.stunT > 0) e.stunT--;
      else if (e.chargeT > 0) {
        e.chargeT--;
        e.x += e.dir * 2.6;
        const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
        if (!solidAt(aheadX, e.y + e.h + 4) || solidAt(aheadX, e.y + e.h - 2) ||
            e.x < e.minX - TILE || e.x > e.maxX + TILE) {
          e.chargeT = 0; e.stunT = 35;
          sfx(120, 0.1, 'square', 0.05, -40);
        }
      } else if (e.windupT > 0) {
        if (--e.windupT === 0) e.chargeT = 55;
      } else {
        e.x += e.dir * 0.35;
        if (e.chargeCd > 0) e.chargeCd--;
        const dx = pcx - (e.x + e.w / 2);
        if (e.chargeCd <= 0 && Math.abs(dx) < 130 &&
            Math.abs((player.y + player.h) - (e.y + e.h)) < 20) {
          e.dir = Math.sign(dx) || 1;
          e.windupT = 22; e.chargeCd = 200;
          sfx(340, 0.12, 'sawtooth', 0.05, -120);      // a snort of intent
        }
        edgeTurn(e, true, true, false);
      }
    }

    if (e.kind === 'owl') {     // patient, then all wings
      const d = Math.abs(e.x - player.x);
      if (e.diveCd > 0) e.diveCd--;
      if (e.diveCd <= 0 && d < 150 && Math.abs(e.y - player.y) < 90) {
        e.vx += (pcx > e.x + 7 ? 0.06 : -0.06);
        e.vy += (player.y + 4 > e.y ? 0.05 : -0.05);
        e.vx = Math.max(-1.5, Math.min(1.5, e.vx));
        e.vy = Math.max(-1.2, Math.min(1.2, e.vy));
        if (e.t % 90 === 0) sfx(500, 0.15, 'triangle', 0.03, -120);
      } else {
        e.vx *= 0.95;
        e.vy = (e.homeY + Math.sin(e.t / 24) * 8 - e.y) * 0.05;
      }
      e.x += e.vx; e.y += e.vy;
      e.face = e.vx >= 0 ? 1 : -1;
    }

    if (e.kind === 'bear') {    // slow, wide, and very sure of itself
      e.x += e.dir * 0.3;
      edgeTurn(e, true, true, false);
    }

    if (e.kind === 'wolf') {    // patrols, then closes fast
      if (e.lungeCd > 0) e.lungeCd--;
      if (e.dashT > 0) { e.dashT--; e.x += e.dir * 2.4; }
      else {
        e.x += e.dir * 0.6;
        const dx = pcx - (e.x + e.w / 2);
        if (e.lungeCd <= 0 && Math.abs(dx) < 110 &&
            Math.abs((player.y + player.h) - (e.y + e.h)) < 26) {
          e.dir = Math.sign(dx) || 1;
          e.dashT = 22; e.lungeCd = 140;
          sfx(300, 0.15, 'sawtooth', 0.04, -80);       // a low snarl
        }
      }
      edgeTurn(e, true, true, true);
    }

    if (e.kind === 'lion') {    // waits on a branch, then falls like weather
      if (e.pounceCd > 0) e.pounceCd--;
      if (e.mode === 'perch') {
        const dx = pcx - (e.x + e.w / 2);
        if (e.pounceCd <= 0 && Math.abs(dx) < 120 &&
            player.y + player.h >= e.y + e.h - 4) {
          e.mode = 'air';
          e.dir = Math.sign(dx) || 1;
          e.vy = -2.6;
          sfx(500, 0.2, 'sawtooth', 0.045, -180);      // a cough of intent
        }
      } else if (e.mode === 'air') {
        e.x += e.dir * 2.0;
        e.vy = Math.min(e.vy + 0.3, 6);
        e.y += e.vy;
        if (e.vy > 0 && (solidAt(e.x + 2, e.y + e.h) || solidAt(e.x + e.w - 2, e.y + e.h))) {
          e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h - 0.01;
          e.mode = 'ground';
          e.minX = e.x - 5 * TILE; e.maxX = e.x + 5 * TILE;
          e.pounceCd = 160;
        }
        if (e.y > MAP_H * TILE + 20) { e.dead = 26; }  // pounced into a ravine
      } else {                                          // prowls where it landed
        e.x += e.dir * 0.7;
        edgeTurn(e, true, true, false);
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
      edgeTurn(e, true, true, true);
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
      const small = e.kind === 'ant' || e.kind === 'roach' || e.kind === 'scarab';
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

/* ---------------- the deep woods, drawn ---------------- */
function drawWoodsBackground(st) {
  // a sky gone almost black
  ctx.fillStyle = '#0a0812'; ctx.fillRect(0, 0, VIEW_W, 60);
  ctx.fillStyle = '#0e0a16'; ctx.fillRect(0, 60, VIEW_W, 60);
  ctx.fillStyle = '#120c18'; ctx.fillRect(0, 120, VIEW_W, VIEW_H - 120);
  // a few hard stars
  for (let i = 0; i < 18; i++) {
    const sx = (i * 131 + 17) % (VIEW_W + 40) - ((camX * 0.08) % (VIEW_W + 40));
    const wx = ((sx % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40) - 20;
    if ((i + (frame >> 6)) % 9 === 0) continue;
    ctx.fillStyle = '#4a4260';
    ctx.fillRect(wx, (i * 37) % 50 + 4, 1, 1);
  }
  // a sliver of moon, mostly swallowed
  const mx = 260 - camX * 0.04;
  ctx.fillStyle = '#c9c2b0';
  ctx.beginPath(); ctx.arc(mx, 26, 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#0a0812';
  ctx.beginPath(); ctx.arc(mx - 4, 24, 9.5, 0, 7); ctx.fill();
  // far pines, ranked and patient
  ctx.fillStyle = '#0c0f14';
  for (let i = 0; i < 16; i++) {
    const tx = ((i * 120 + 30 - camX * 0.25) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
    const h = 60 + (i * 17) % 30;
    for (let s = 0; s < 4; s++)
      ctx.fillRect(tx - (10 - s * 2), 132 - h + s * (h / 4), 20 - s * 4 < 2 ? 2 : 20 - s * 4, h / 4 + 1);
  }
  // nearer crags
  ctx.fillStyle = '#141820';
  for (let i = 0; i < 10; i++) {
    const cx = ((i * 170 + 60 - camX * 0.5) % (VIEW_W + 170) + VIEW_W + 170) % (VIEW_W + 170) - 85;
    const h = 18 + (i * 23) % 16;
    ctx.fillRect(cx, 142 - h, 30 + (i % 3) * 8, h);
    ctx.fillRect(cx + 8, 136 - h, 14, 6);
  }
  // fireflies
  for (let i = 0; i < 6; i++) {
    if ((frame + i * 47) % 90 > 60) continue;
    const fx = ((i * 210 + frame * 0.3 - camX * 0.7) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20;
    ctx.fillStyle = '#9fd08a';
    ctx.fillRect(fx, 90 + Math.sin(frame / 25 + i * 2) * 14 + (i * 11) % 30, 1, 1);
  }
  // low fog, thicker than the road's
  ctx.fillStyle = 'rgba(40,44,64,0.32)';
  ctx.fillRect(0, 116, VIEW_W, 18);
}

/* ---------------- the mountain, drawn ---------------- */
function drawSnowBackground(st) {
  // a twilight blizzard sky
  ctx.fillStyle = '#232c40'; ctx.fillRect(0, 0, VIEW_W, 60);
  ctx.fillStyle = '#2b3550'; ctx.fillRect(0, 60, VIEW_W, 60);
  ctx.fillStyle = '#333e5c'; ctx.fillRect(0, 120, VIEW_W, VIEW_H - 120);
  // the moon behind cloud
  const mx = 240 - camX * 0.04;
  ctx.fillStyle = 'rgba(220,224,238,0.5)';
  ctx.beginPath(); ctx.arc(mx, 30, 12, 0, 7); ctx.fill();
  // far peaks, white-capped
  ctx.fillStyle = '#1a2236';
  for (let i = 0; i < 8; i++) {
    const px = ((i * 190 + 40 - camX * 0.2) % (VIEW_W + 190) + VIEW_W + 190) % (VIEW_W + 190) - 95;
    const h = 60 + (i * 29) % 34;
    ctx.beginPath();
    ctx.moveTo(px - 44, 132); ctx.lineTo(px, 132 - h); ctx.lineTo(px + 44, 132);
    ctx.fill();
    ctx.fillStyle = '#c9d2e4';
    ctx.beginPath();
    ctx.moveTo(px - 10, 132 - h + 14); ctx.lineTo(px, 132 - h); ctx.lineTo(px + 10, 132 - h + 14);
    ctx.fill();
    ctx.fillStyle = '#1a2236';
  }
  // nearer ridges
  ctx.fillStyle = '#242e48';
  for (let i = 0; i < 9; i++) {
    const rx = ((i * 160 + 70 - camX * 0.5) % (VIEW_W + 160) + VIEW_W + 160) % (VIEW_W + 160) - 80;
    const h = 20 + (i * 17) % 18;
    ctx.beginPath();
    ctx.moveTo(rx - 40, 146); ctx.lineTo(rx, 146 - h); ctx.lineTo(rx + 40, 146);
    ctx.fill();
  }
  // blowing snow streaks
  ctx.strokeStyle = 'rgba(220,228,240,0.25)';
  for (let i = 0; i < 14; i++) {
    const sx = ((i * 67 + frame * 3.2 - camX * 0.8) % (VIEW_W + 30) + VIEW_W + 30) % (VIEW_W + 30) - 15;
    const sy = (i * 41 + (frame >> 1)) % 150 + 6;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 7, sy + 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(90,104,140,0.28)';
  ctx.fillRect(0, 118, VIEW_W, 16);
}

/* ---------------- the tomb, drawn ---------------- */
function drawTombBackground(st) {
  ctx.fillStyle = '#2a2216'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#332a1c';
  for (let i = 0; i < 12; i++) {
    const wx = ((i * 34 - camX) % (VIEW_W + 34) + VIEW_W + 34) % (VIEW_W + 34) - 17;
    ctx.fillRect(wx, 18, 17, 108);
  }
  // hieroglyph columns
  ctx.fillStyle = '#4a3c22';
  for (let gc = 18; gc < MAP_W; gc += 26) {
    const gx = gc * TILE - camX;
    if (gx < -20 || gx > VIEW_W + 20) continue;
    ctx.fillRect(gx, 24, 12, 100);
    ctx.fillStyle = '#6d5a30';
    for (let r = 0; r < 8; r++) {
      const g = (gc * 7 + r * 3) % 4;
      const gy = 30 + r * 12;
      if (g === 0) { ctx.fillRect(gx + 3, gy, 6, 2); ctx.fillRect(gx + 5, gy + 3, 2, 4); }
      else if (g === 1) { ctx.fillRect(gx + 3, gy, 2, 7); ctx.fillRect(gx + 7, gy, 2, 7); }
      else if (g === 2) { ctx.fillRect(gx + 4, gy + 1, 4, 4); }
      else { ctx.fillRect(gx + 3, gy + 2, 6, 2); ctx.fillRect(gx + 3, gy + 5, 6, 2); }
    }
    ctx.fillStyle = '#4a3c22';
  }
  // standing sarcophagi between the columns
  for (let sc = 30; sc < MAP_W; sc += 52) {
    const sx = sc * TILE - camX;
    if (sx < -30 || sx > VIEW_W + 30) continue;
    ctx.fillStyle = '#54442c';
    ctx.fillRect(sx, 70, 18, 56);
    ctx.fillRect(sx + 3, 64, 12, 8);
    ctx.fillStyle = '#6d5a30';
    ctx.fillRect(sx + 5, 74, 8, 10);
    ctx.fillStyle = '#2a2216';
    ctx.fillRect(sx + 7, 78, 2, 2); ctx.fillRect(sx + 11, 78, 2, 2);
  }
  // wall torches with their long duty
  for (let tc = 12; tc < MAP_W; tc += 20) {
    const tx = tc * TILE - camX;
    if (tx < -8 || tx > VIEW_W + 8) continue;
    ctx.fillStyle = '#3e2c18'; ctx.fillRect(tx, 46, 4, 9);
    ctx.fillStyle = (frame + tc) % 9 < 7 ? '#ffce6a' : '#e8a050';
    ctx.fillRect(tx + 1, 41, 2, 5);
    ctx.fillStyle = 'rgba(255,206,106,0.06)';
    ctx.fillRect(tx - 9, 32, 22, 30);
  }
  ctx.fillStyle = 'rgba(20,14,6,' + (0.12 + st * 0.03) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawTiles() {
  const indoor = level === 2, woods = level === 3, snow = level === 4,
        tomb = level === 5;
  const c0 = Math.max(0, Math.floor(camX / TILE));
  const c1 = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W) / TILE));
  for (let r = 0; r < MAP_H; r++) {
    for (let cc = c0; cc <= c1; cc++) {
      const t = map[r][cc];
      if (!t) continue;
      const x = cc * TILE - camX, y = r * TILE;
      if (t === 1) {
        const top = r === 0 || !map[r - 1][cc];
        ctx.fillStyle = tomb ? '#54442c' : snow ? '#3c4660' : woods ? '#343a42' :
                        indoor ? '#4a3626' : '#3a3244';
        ctx.fillRect(x, y, TILE, TILE);
        if (top && r > 0) {
          ctx.fillStyle = tomb ? '#6d5a30' : snow ? '#dce4ee' : woods ? '#48505c' :
                          indoor ? '#6d5138' : '#4b3f5c';
          ctx.fillRect(x, y, TILE, 4);
          ctx.fillStyle = tomb ? '#7d693a' : snow ? '#b8c4d8' : woods ? '#59626e' :
                          indoor ? '#7d5f42' : '#5d4f72';
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
      } else if (t === 4) {
        // giant-tree trunk — old bark, older shadows
        ctx.fillStyle = '#241c14';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#332a1e';
        ctx.fillRect(x + ((cc * 7 + r * 3) % 3) * 4, y, 3, TILE);
        ctx.fillRect(x + 9 + (r % 2) * 3, y + 4, 2, TILE - 4);
        if (r === 2 && !map[1][cc]) {                  // the crown starts
          ctx.fillStyle = '#101710';
          ctx.fillRect(x - 4, y - 8, TILE + 8, 10);
          ctx.fillRect(x - 1, y - 14, TILE + 2, 8);
        }
        if (r === 6) {                                 // root flare beside the arch
          ctx.fillStyle = '#241c14';
          ctx.fillRect(x - 2, y + TILE - 4, 3, 4);
          ctx.fillRect(x + TILE - 1, y + TILE - 4, 3, 4);
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
    if (level === 5) {                            // a floor torch, patient as stone
      const y = 9 * TILE - 16;
      ctx.fillStyle = '#3e2c18'; ctx.fillRect(x + 3, y + 4, 3, 12);
      ctx.fillStyle = '#54442c'; ctx.fillRect(x + 1, y + 14, 7, 2);
      const lit = cp.reached && (frame >> 3) % 6 !== 5;
      ctx.fillStyle = lit ? '#ffce6a' : '#241c30';
      ctx.fillRect(x + 2, y - 1, 5, 6);
      if (cp.reached) {
        ctx.fillStyle = 'rgba(255,206,106,0.10)';
        ctx.fillRect(x - 5, y - 7, 19, 22);
      }
      continue;
    }
    if (level === 4) {                            // a frozen crystal on the shelf
      const gy = cp.gy || 9 * TILE;
      const y = gy - 14;
      const lit = cp.reached && (frame >> 3) % 6 !== 5;
      ctx.fillStyle = lit ? '#9fe8ff' : '#3a4a5e';
      ctx.fillRect(x + 3, y, 3, 10);
      ctx.fillRect(x + 1, y + 3, 7, 4);
      if (cp.reached) {
        ctx.fillStyle = 'rgba(160,230,255,0.12)';
        ctx.fillRect(x - 4, y - 5, 17, 20);
        ctx.fillStyle = '#e0f4ff';
        ctx.fillRect(x + 4, y + 1, 1, 3);
      }
      continue;
    }
    if (level === 3) {                            // a will-o-wisp, waiting
      const y = 9 * TILE - 22 + Math.sin((frame + cp.x) / 30) * 2;
      const lit = cp.reached && (frame >> 3) % 6 !== 5;
      ctx.fillStyle = lit ? '#bfe8ff' : '#2a3240';
      ctx.fillRect(x + 2, Math.round(y), 4, 4);
      ctx.fillRect(x + 3, Math.round(y) - 2, 2, 2);
      if (cp.reached) {
        ctx.fillStyle = 'rgba(160,220,255,0.10)';
        ctx.fillRect(x - 4, Math.round(y) - 7, 16, 18);
        ctx.fillStyle = 'rgba(160,220,255,0.35)';
        ctx.fillRect(x + 3, Math.round(y) + 6 + ((frame >> 2) % 4), 1, 1);
      }
      continue;
    }
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
  if (level === 5) { drawBurialDoor(); return; }
  if (level === 4) { drawCaveMouth(); return; }
  if (level === 3) { drawChapel(); return; }
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

function drawBurialDoor() {
  const x = houseX - camX, y = 9 * TILE - 52;
  if (x < -70 || x > VIEW_W) return;
  // a stone door for someone important, and a mask above it
  ctx.fillStyle = '#3e321c'; ctx.fillRect(x - 8, y - 2, 46, 54);
  ctx.fillStyle = '#54442c'; ctx.fillRect(x - 4, y + 2, 38, 50);
  ctx.fillStyle = '#6d5a30';
  ctx.fillRect(x, y + 8, 30, 44);
  ctx.fillStyle = '#4a3c22';
  for (let r = 0; r < 4; r++) ctx.fillRect(x + 3, y + 12 + r * 10, 24, 2);
  // the golden face over the lintel
  ctx.fillStyle = '#d8b23a';
  ctx.fillRect(x + 8, y - 12, 14, 12);
  ctx.fillStyle = '#2a2216';
  ctx.fillRect(x + 11, y - 8, 2, 3); ctx.fillRect(x + 17, y - 8, 2, 3);
  ctx.fillRect(x + 13, y - 3, 4, 2);
  ctx.fillStyle = (frame >> 4) % 6 ? '#8a742a' : '#ffce6a';   // it glints, sometimes
  ctx.fillRect(x + 14, y - 12, 2, 2);
}

function drawCaveMouth() {
  const x = houseX - camX, y = FINALE_GY - 44;
  if (x < -80 || x > VIEW_W) return;
  // a rise of blue ice with a dark mouth in it
  ctx.fillStyle = '#4a5a78';
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 44); ctx.lineTo(x + 20, y - 12); ctx.lineTo(x + 58, y + 44);
  ctx.fill();
  ctx.fillStyle = '#dce4ee';
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + 20, y - 12); ctx.lineTo(x + 30, y + 4);
  ctx.fill();
  ctx.fillStyle = '#0c1018';                          // the mouth itself
  ctx.fillRect(x + 12, y + 20, 18, 24);
  ctx.beginPath(); ctx.arc(x + 21, y + 20, 9, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#9fe8ff';                          // icicle teeth
  for (let i = 0; i < 4; i++)
    ctx.fillRect(x + 13 + i * 4, y + 12 + (i % 2) * 2, 2, 5 + (i % 2) * 2);
}

function drawChapel() {
  const x = houseX - camX, y = 9 * TILE - 56;
  if (x < -80 || x > VIEW_W) return;
  // an old stone chapel, leaning into the dark
  ctx.fillStyle = '#2a2e36'; ctx.fillRect(x - 6, y + 18, 60, 38);   // body
  ctx.fillStyle = '#343a44';
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 20); ctx.lineTo(x + 24, y); ctx.lineTo(x + 58, y + 20);
  ctx.fill();
  ctx.fillStyle = '#1c2028'; ctx.fillRect(x + 21, y - 14, 6, 16);   // crooked spire
  ctx.fillRect(x + 19, y - 18, 10, 4);
  // rose window, faintly lit
  ctx.fillStyle = (frame >> 4) % 5 ? '#6a4a7a' : '#8a5f9e';
  ctx.beginPath(); ctx.arc(x + 24, y + 26, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a2e36'; ctx.fillRect(x + 23, y + 20, 2, 12);
  ctx.fillRect(x + 18, y + 25, 12, 2);
  // the arched door
  ctx.fillStyle = '#141018';
  ctx.fillRect(x + 17, y + 40, 14, 16);
  ctx.beginPath(); ctx.arc(x + 24, y + 40, 7, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e8c66a'; ctx.fillRect(x + 27, y + 47, 2, 2);    // a knob, warm
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
    } else if (e.kind === 'snake' || e.kind === 'cobra') {
      let img = (e.kind === 'cobra' ? COBRA_FRAMES : SNAKE_FRAMES)[(e.t >> 4) % 2];
      if (flash) img = whiten(img);
      ctx.save();
      if (e.dir < 0) ctx.drawImage(img, x - 2, y);
      else { ctx.translate(x + 22, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
      ctx.restore();
    } else if (ENEMY_SPRITES[e.kind]) {
      const spec = ENEMY_SPRITES[e.kind];
      const frames = typeof spec.frames === 'function' ? spec.frames() : spec.frames;
      let img = frames[(e.t >> spec.shift) % 2];
      if (flash) img = whiten(img);
      const mirror = (e.kind === 'owl' ? e.face : e.dir) < 0;
      ctx.save();
      if (e.kind === 'goat' && e.windupT > 0) ctx.translate(-e.dir, 0);  // rearing back
      if (mirror) { ctx.translate(x + img.width, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
      else ctx.drawImage(img, x, y);
      ctx.restore();
    }
  }
}

// simple walkers/fliers drawn by one rule: frames, anim speed, mirror by dir
const ENEMY_SPRITES = {
  ant:    { frames: ANT_FRAMES, shift: 2 },
  roach:  { frames: ROACH_FRAMES, shift: 3 },
  rat:    { frames: RAT_FRAMES, shift: 3 },
  bear:   { frames: BEAR_FRAMES, shift: 4 },
  wolf:   { frames: () => (level === 4 ? WHITEWOLF_FRAMES : WOLF_FRAMES), shift: 3 },
  lion:   { frames: LION_FRAMES, shift: 3 },
  goat:   { frames: GOAT_FRAMES, shift: 3 },
  owl:    { frames: OWL_FRAMES, shift: 3 },
  mummy:  { frames: MUMMY_FRAMES, shift: 3 },
  scarab: { frames: SCARAB_FRAMES, shift: 3 },
};

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
  // hearts (the small things chew them half at a time; the saucer lends five)
  const slots = player.hp > 5 || saucer.active ? 10 : 5;
  for (let i = 0; i < slots; i++) {
    const x = 6 + i * 12;
    const full = i >= 5 ? '#6ade8a' : '#c9304a';      // borrowed hearts run green
    drawHeart(x, 6, '#3a2530');                       // empty socket
    if (player.hp >= i + 1) drawHeart(x, 6, full);
    else if (player.hp >= i + 0.5) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, 6, 4, 8); ctx.clip();
      drawHeart(x, 6, full);                          // the left half survives
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
  if (level !== 1) {                 // the dragon keeps to the road...
    if (dragon.ridden) {             // ...unless the cheat menu called it
      dragon.t++;
      if (dragon.gustCd > 0) dragon.gustCd--;
      if (dragon.ballCd > 0) dragon.ballCd--;
    } else if (dragon.active) {      // dismissed elsewhere, it slips away
      dragon.spawned = dragon.active = false;
      burst(dragon.x + dragon.w / 2, dragon.y + 6, '#7a4fd0', 10);
    }
    return;
  }
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
const boss = { active: false, kind: 'dracula', hp: 3, x: 235, w: 40, h: 56,
               dir: -1, t: 0,
               phase: 'fight',   // dracula: fight|shrink|crouch|laugh|run|cat
                                 // werewolf: fight|crumple|revert|wallbreak|gone
               phaseT: 0, hurtT: 0, shootCd: 100,
               boltT: 0, boltCd: 180, roachCd: 200,
               swipeT: 0, swipeCd: 60, wallHole: false, held: {} };
const candel = { x: 250, y: 132, vx: 0, vy: 0, state: 'ground' };  // the silver candelabra
const iceCeil = [];   // hanging icicles: {x, state:'hung'|'falling'|'gone', y, vy, regrowT, lastHit}
const iceFloor = [];  // standing icicles: {x, state:'stand'|'sliding'|'gone', vx, regrowT}
const dag = { x: 250, y: 132, vx: 0, vy: 0, state: 'ground' };     // the obsidian-and-gold dagger
const skulls = [];    // his offerings: {x, y, vx, vy, bounced}
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

function healOne() {
  if (player.hp < 5) { player.hp = Math.min(5, player.hp + 1); sndHeal(); }
}
const bossBox = () => ({ x: boss.x, y: 144 - boss.h, w: boss.w, h: boss.h });

// the fetch-and-throw relics: one mechanic, two artifacts
const RELICS = {
  aztec:    { obj: dag,    name: 'dagger',     w: 10, h: 8,  g: 0.06,
              tvx: 3.8, tvy: -0.6, throwF: 320, throwS: 200, pickF: 760,
              clinkF: 700, clinkD: 0.08, clinkS: -250, onHit: () => aztecHit() },
  werewolf: { obj: candel, name: 'candelabra', w: 12, h: 10, g: 0.08,
              tvx: 3.6, tvy: -1.2, throwF: 300, throwS: 180, pickF: 700,
              clinkF: 600, clinkD: 0.1, clinkS: -200, onHit: () => wolfHit() },
};

function updateRelicFlight(rc) {
  const o = rc.obj;
  if (o.state !== 'thrown') return;
  o.x += o.vx; o.y += o.vy; o.vy += rc.g;
  if (rectsOverlap({ x: o.x, y: o.y, w: rc.w, h: rc.h }, bossBox())) {
    rc.onHit();
  } else if (o.y >= 132) {
    o.y = 132; o.state = 'ground'; o.vx = 0;
    sfx(rc.clinkF, rc.clinkD, 'triangle', 0.04, rc.clinkS);   // metal on stone
  } else if (o.x < 4 || o.x > VIEW_W - 16) {
    o.vx *= -0.5;
    o.x = Math.max(4, Math.min(VIEW_W - 16, o.x));
  }
}

function relicPickOrThrow(rc) {
  const o = rc.obj;
  if (carrying === rc.name) {
    o.state = 'thrown';
    o.x = player.x + (player.face > 0 ? 10 : -10);
    o.y = player.y + 2;
    o.vx = player.face * rc.tvx;
    o.vy = rc.tvy;
    carrying = null;
    sfx(rc.throwF, 0.1, 'square', 0.06, rc.throwS);
  } else if (o.state === 'ground' && player.onGround &&
             Math.abs(o.x - player.x) < 16) {
    o.state = 'held';
    carrying = rc.name;
    sfx(rc.pickF, 0.08, 'triangle', 0.05);
  } else {
    sfx(180, 0.06, 'square', 0.04, -80);   // a swing at nothing that matters
  }
}

// the boy, back to himself, drawn wherever a monster used to stand
function drawBoyAt(x, y, pose) {
  ctx.save();
  ctx.translate(x, y);
  if (pose === 'crouch') { ctx.translate(0, 6); ctx.scale(1, 0.7); }
  ctx.drawImage(pose === 'run' ? KID_FRAMES.run[(frame >> 3) % 2] : KID_FRAMES.idle, 0, 0);
  ctx.restore();
}

function startBoss() {
  state = 'boss';
  boss.active = true;
  boss.kind = level === 5 ? 'aztec' : level === 4 ? 'yeti' :
              level === 3 ? 'werewolf' : 'dracula';
  boss.hp = boss.kind === 'dracula' ? 3 : 4;
  boss.w = boss.kind === 'yeti' ? 38 : boss.kind === 'werewolf' ? 34 :
           boss.kind === 'aztec' ? 30 : 40;
  boss.h = boss.kind === 'yeti' ? 44 : boss.kind === 'werewolf' ? 34 :
           boss.kind === 'aztec' ? 46 : 56;
  dag.x = 250; dag.y = 132; dag.vx = 0; dag.vy = 0; dag.state = 'ground';
  skulls.length = 0;
  boss.lastHit = -1;
  iceCeil.length = 0; iceFloor.length = 0;
  if (boss.kind === 'yeti') {
    [70, 120, 170, 220, 270].forEach(x =>
      iceCeil.push({ x, state: 'hung', y: 40, vy: 0, regrowT: 0, lastHit: -1 }));
    [90, 160, 230].forEach(x =>
      iceFloor.push({ x, state: 'stand', vx: 0, regrowT: 0 }));
  }
  boss.t = 0;
  boss.phase = 'fight'; boss.phaseT = 0; boss.hurtT = 0;
  boss.x = 235; boss.dir = -1;
  boss.shootCd = 100; boss.boltCd = 180; boss.boltT = 0; boss.roachCd = 200;
  boss.swipeT = 0; boss.swipeCd = 60; boss.wallHole = false;
  boss.held = {};
  bossBats.length = 0; bossRoaches.length = 0; thrown.length = 0;
  carrying = null;
  candel.x = 250; candel.y = 132; candel.vx = 0; candel.vy = 0; candel.state = 'ground';
  cat.x = -40; cat.t = 0;
  camX = 0;
  particles.length = 0;
  player.x = 30; player.y = 126; player.vx = 0; player.vy = 0; player.face = 1;
  player.crouch = false; player.h = 18; player.attack = null; player.chargeT = 0;
  player.invuln = 60;
  musicStep = 0;
  flashText = boss.kind === 'aztec'
    ? { msg: 'the boy wears a god\'s gold face.', t: 150 }
    : boss.kind === 'yeti'
      ? { msg: 'the cave breathes. so does something else.', t: 150 }
      : boss.kind === 'werewolf'
        ? { msg: 'the moon is full. the boy is gone.', t: 150 }
        : { msg: 'the boy is not a boy.', t: 150 };
  sfx(60, 1.5, 'sawtooth', 0.08, 30);
  if (boss.kind === 'werewolf')
    setTimeout(() => { sfx(280, 1.1, 'triangle', 0.05, 160); }, 400);   // the first howl
  if (boss.kind === 'yeti')
    setTimeout(() => { sfx(70, 1.2, 'sawtooth', 0.08, 25); }, 400);     // something answers
}

function aztecHit() {
  boss.hp--;
  boss.hurtT = 26;
  score += 400;
  addShake(3, 12);
  burst(boss.x + boss.w / 2, 110, '#d8b23a', 12, -1.4);
  sfx(140, 0.5, 'sawtooth', 0.09, -50);                // a voice too old for the room
  sfx(1100, 0.15, 'triangle', 0.05, -400);             // obsidian on gold
  const farLeft = boss.x + boss.w / 2 > VIEW_W / 2;
  dag.x = farLeft ? 24 + Math.random() * 40 : 230 + Math.random() * 40;
  dag.y = 132; dag.vx = 0; dag.vy = 0; dag.state = 'ground';
  if (boss.hp <= 0) {
    boss.phase = 'crumple'; boss.phaseT = 0;
    flashText = { msg: 'the mask falls.', t: 110 };
  } else {
    flashText = { msg: boss.hp === 3 ? 'the mask cracks. the god notices.' :
                       boss.hp === 2 ? 'gold chips. feathers fall.' :
                                       'one more. the last one.', t: 100 };
  }
}

function yetiHit(dmg) {
  boss.hp -= dmg;
  boss.hurtT = 24;
  score += dmg >= 1 ? 400 : 150;
  addShake(dmg >= 1 ? 3 : 1.5, dmg >= 1 ? 12 : 6);
  burst(boss.x + boss.w / 2, 120, dmg >= 1 ? '#9fe8ff' : '#a01828', 10, -1.2);
  sfx(100, 0.4, 'sawtooth', 0.08, -35);                // a roar off the ice
  if (dmg >= 1) sfx(1200, 0.12, 'triangle', 0.05, -500);
  if (boss.hp <= 0) {
    boss.phase = 'crumple'; boss.phaseT = 0;
    flashText = { msg: 'the mountain lets him go.', t: 110 };
  } else {
    flashText = { msg: dmg >= 1 ? 'the ice knows its own work.' : 'porcelain stings. a little.', t: 80 };
  }
}

function wolfHit() {
  boss.hp--;
  boss.hurtT = 30;
  score += 400;
  addShake(3, 12);
  burst(boss.x + boss.w / 2, 120, '#a01828', 12, -1.5);
  sfx(120, 0.5, 'sawtooth', 0.09, -40);                // a howl with a hole in it
  sfx(900, 0.15, 'triangle', 0.05, -300);              // silver rings true
  // the candelabra flies wide — go and get it
  const farLeft = boss.x + boss.w / 2 > VIEW_W / 2;
  candel.x = farLeft ? 24 + Math.random() * 40 : 240 + Math.random() * 40;
  candel.y = 132; candel.vx = 0; candel.vy = 0; candel.state = 'ground';
  if (boss.hp <= 0) {
    boss.phase = 'crumple'; boss.phaseT = 0;
    flashText = { msg: 'the fourth finds the heart of him.', t: 110 };
  } else {
    flashText = { msg: boss.hp === 3 ? 'his shirt tears. he howls.' :
                       boss.hp === 2 ? 'more blood than boy now.' :
                                       'one more. one more.', t: 100 };
  }
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

  // the storm keeps time with his wounds (the werewolf gets a still full moon)
  if (boss.kind === 'dracula' && --boss.boltCd <= 0) {
    boss.boltCd = 240 - (3 - boss.hp) * 65 + Math.random() * 90;
    boss.boltT = 12;
    sfx(1400, 0.1, 'sawtooth', 0.03, -900);
    setTimeout(() => sfx(55, 0.9, 'sawtooth', 0.07, -15), 220);
  }

  updateBossDoll();

  if (boss.phase === 'fight' && boss.kind === 'aztec') {
    // he drifts above the gold, throwing what the tomb gave him
    const spd = 0.3 + (4 - boss.hp) * 0.2;
    boss.x += boss.dir * spd;
    if (boss.x < 160) boss.dir = 1;
    if (boss.x > 268) boss.dir = -1;
    if (--boss.shootCd <= 0) {
      boss.shootCd = 130 - (4 - boss.hp) * 22 + Math.random() * 30;
      const dx = (player.x + 5) - (boss.x + boss.w / 2);
      skulls.push({ x: boss.x + boss.w / 2, y: 144 - boss.h + 8,
                    vx: Math.sign(dx) * (1.3 + Math.random() * 0.8) || -1.5,
                    vy: -2.2, bounced: false });
      sfx(180, 0.12, 'square', 0.05, -70);             // a gift, hurled
    }
    if (rectsOverlap(bossBox(), player))
      hurtPlayer(boss.x + boss.w / 2, 1);
    // the skulls in flight
    for (let i = skulls.length - 1; i >= 0; i--) {
      const sk = skulls[i];
      sk.x += sk.vx; sk.y += sk.vy; sk.vy += 0.08;
      if (rectsOverlap({ x: sk.x, y: sk.y, w: 8, h: 8 }, player)) {
        hurtPlayer(sk.x + 4, 1);
        burst(sk.x + 4, sk.y + 4, '#e8e4da', 6);
        skulls.splice(i, 1);
        continue;
      }
      if (sk.y >= 136) {
        if (!sk.bounced) { sk.bounced = true; sk.y = 136; sk.vy = -1.6;
                           sfx(400, 0.05, 'square', 0.03, -150); }
        else { burst(sk.x + 4, 140, '#e8e4da', 5); skulls.splice(i, 1); continue; }
      }
      if (sk.x < -12 || sk.x > VIEW_W + 12) skulls.splice(i, 1);
    }
    updateRelicFlight(RELICS.aztec);
  } else if (boss.phase === 'fight' && boss.kind === 'yeti') {
    // he lumbers, and the cave lumbers with him
    const spd = 0.4 + (4 - Math.ceil(boss.hp)) * 0.15;
    if (boss.swipeT > 0) {
      boss.swipeT--;
      if (boss.swipeT === 8) {                        // the slam lands
        addShake(3, 10);
        sfx(60, 0.3, 'square', 0.08, -20);
        const slam = { x: boss.dir > 0 ? boss.x + boss.w : boss.x - 26,
                       y: 144 - 36, w: 26, h: 36 };
        if (rectsOverlap(slam, player)) hurtPlayer(boss.x + boss.w / 2, 1);
        // his own slams shake the ceiling loose sometimes
        const hung = iceCeil.filter(i => i.state === 'hung');
        if (hung.length && Math.random() < 0.25) {
          const ic = hung[Math.floor(Math.random() * hung.length)];
          ic.state = 'falling'; ic.vy = 0;
          sfx(1000, 0.08, 'square', 0.03, -500);
        }
      }
    } else {
      boss.dir = Math.sign(player.x - boss.x - boss.w / 2) || 1;
      boss.x += boss.dir * spd;
      if (boss.swipeCd > 0) boss.swipeCd--;
      if (boss.swipeCd <= 0 &&
          Math.abs((player.x + 5) - (boss.x + boss.w / 2)) < 52) {
        boss.swipeT = 20;
        boss.swipeCd = 110 - (4 - Math.ceil(boss.hp)) * 12;
        sfx(90, 0.25, 'sawtooth', 0.07, -30);          // he inhales the room
      }
    }
    boss.x = Math.max(30, Math.min(VIEW_W - boss.w - 40, boss.x));
    if (rectsOverlap(bossBox(), player))
      hurtPlayer(boss.x + boss.w / 2, 1);

    // her fists and heels: half power on fur, full leverage on ice
    const hb = attackHitbox();
    if (hb) {
      for (const ic of iceCeil)
        if (ic.state === 'hung' && ic.lastHit !== hb.id &&
            rectsOverlap(hb, { x: ic.x - 3, y: ic.y, w: 8, h: 30 })) {
          ic.lastHit = hb.id;
          ic.state = 'falling'; ic.vy = 0;
          sfx(1000, 0.08, 'square', 0.04, -500);
        }
      if (boss.lastHit !== hb.id &&
          rectsOverlap(hb, bossBox())) {
        boss.lastHit = hb.id;
        yetiHit(0.5);
      }
    }
    // falling icicles
    for (const ic of iceCeil) {
      if (ic.state === 'falling') {
        ic.vy = Math.min(ic.vy + 0.25, 5);
        ic.y += ic.vy;
        if (rectsOverlap({ x: ic.x - 2, y: ic.y, w: 6, h: 30 },
                         bossBox())) {
          ic.state = 'gone'; ic.regrowT = 480;
          burst(ic.x, ic.y + 20, '#9fe8ff', 8, 0, 1);
          yetiHit(1);
        } else if (ic.y + 30 >= 144) {
          ic.state = 'gone'; ic.regrowT = 480;
          burst(ic.x, 140, '#9fe8ff', 6, 0, 1);
          sfx(800, 0.1, 'square', 0.04, -400);
        }
      } else if (ic.state === 'gone' && --ic.regrowT <= 0) {
        ic.state = 'hung'; ic.y = 40; ic.vy = 0;
      }
    }
    // sliding icicles
    for (const fi of iceFloor) {
      if (fi.state === 'sliding') {
        fi.x += fi.vx;
        if (rectsOverlap({ x: fi.x - 3, y: 130, w: 8, h: 14 },
                         bossBox())) {
          fi.state = 'gone'; fi.regrowT = 480;
          burst(fi.x, 134, '#9fe8ff', 8, Math.sign(fi.vx), 0);
          yetiHit(1);
        } else if (fi.x < 6 || fi.x > VIEW_W - 10) {
          fi.state = 'gone'; fi.regrowT = 480;
          burst(fi.x, 134, '#9fe8ff', 5);
        }
      } else if (fi.state === 'gone' && --fi.regrowT <= 0) {
        fi.state = 'stand'; fi.vx = 0;
      }
    }
  } else if (boss.phase === 'fight' && boss.kind === 'werewolf') {
    // he stalks her on all fours, quicker with every wound
    const spd = 0.5 + (4 - boss.hp) * 0.2;
    if (boss.swipeT > 0) {
      boss.swipeT--;
      boss.x += boss.dir * 1.6;                        // the lunge behind the claws
      if (boss.swipeT > 4 && boss.swipeT < 14) {
        const claw = { x: boss.dir > 0 ? boss.x + boss.w : boss.x - 22,
                       y: 144 - 32, w: 22, h: 30 };
        if (rectsOverlap(claw, player)) hurtPlayer(boss.x + boss.w / 2, 1);
      }
    } else {
      boss.dir = Math.sign(player.x - boss.x - boss.w / 2) || 1;
      boss.x += boss.dir * spd;
      if (boss.swipeCd > 0) boss.swipeCd--;
      if (boss.swipeCd <= 0 &&
          Math.abs((player.x + 5) - (boss.x + boss.w / 2)) < 46) {
        boss.swipeT = 18;
        boss.swipeCd = 90 - (4 - boss.hp) * 12;
        sfx(160, 0.2, 'sawtooth', 0.06, -60);          // a wet snarl
      }
    }
    boss.x = Math.max(28, Math.min(VIEW_W - boss.w - 34, boss.x));
    if (rectsOverlap(bossBox(), player))
      hurtPlayer(boss.x + boss.w / 2, 1);
    updateRelicFlight(RELICS.werewolf);
  } else if (boss.phase === 'fight') {
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
    if (rectsOverlap(bossBox(), player))
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
                     bossBox())) {
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

  // her attacks live here in the cave (fists, and boots against ice)
  tickAttack();

  // punch or kick: pick something up, or let it fly
  const pz = bEdge('z', kPunch()), px = bEdge('x', kKick());
  if ((pz || px) && boss.phase === 'fight' && boss.kind === 'aztec') {
    relicPickOrThrow(RELICS.aztec);
  } else if ((pz || px) && boss.phase === 'fight' && boss.kind === 'yeti') {
    const fi = iceFloor.find(f => f.state === 'stand' &&
                                  Math.abs(f.x - (player.x + 5)) < 18);
    if (fi && player.onGround) {
      fi.state = 'sliding';
      fi.vx = (player.face || 1) * 3;
      sfx(700, 0.1, 'triangle', 0.05, -200);           // ice given purpose
    } else if (!player.attack) {
      player.attack = { type: pz ? 'punch' : 'kick', t: 0, id: ++player.attackId };
      (pz ? sndPunch : sndKick)();
    }
  } else if ((pz || px) && boss.phase === 'fight' && boss.kind === 'werewolf') {
    relicPickOrThrow(RELICS.werewolf);
  } else if ((pz || px) && boss.phase === 'fight') {
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

// after the last hit: each monster leaves in its own way
function updateBossOutro() {
  if (boss.kind === 'aztec') {
    boss.phaseT++;
    if (boss.phase === 'crumple' && boss.phaseT > 90) {
      boss.phase = 'revert'; boss.phaseT = 0;
      sfx(320, 0.6, 'sine', 0.05, -140);               // just a boy, and a heavy mask
    } else if (boss.phase === 'revert' && boss.phaseT > 80) {
      boss.phase = 'gone'; boss.phaseT = 0;
      sfx(60, 1.0, 'sawtooth', 0.05, -12);             // the dark behind the sarcophagus takes him
      burst(boss.x + 10, 120, '#2a2216', 10, 1);
    } else if (boss.phase === 'gone' && boss.phaseT > 100) {
      state = 'win';                                   // the true, final ending
      score += 2000;
      sndWin();
    }
    return;
  }
  if (boss.kind === 'yeti') {
    boss.phaseT++;
    if (boss.phase === 'crumple' && boss.phaseT > 90) {
      boss.phase = 'revert'; boss.phaseT = 0;
      sfx(320, 0.6, 'sine', 0.05, -140);               // the cold gives him back
    } else if (boss.phase === 'revert' && boss.phaseT > 70) {
      boss.phase = 'run'; boss.phaseT = 0;
      sfx(200, 0.2, 'square', 0.04, 120);
    } else if (boss.phase === 'run') {
      boss.x += 2.4;                                   // for the tunnel at the back
      if (boss.phaseT > 90 || boss.x > VIEW_W - 30) { boss.phase = 'gone'; boss.phaseT = 0; }
    } else if (boss.phase === 'gone' && boss.phaseT > 80) {
      state = 'interlude';                             // down, into the old halls
      score += 1500;
      sndWin();
    }
    return;
  }
  if (boss.kind === 'werewolf') {
    boss.phaseT++;
    if (boss.phase === 'crumple' && boss.phaseT > 90) {
      boss.phase = 'revert'; boss.phaseT = 0;
      sfx(320, 0.6, 'sine', 0.05, -140);               // the fur lets go of him
    } else if (boss.phase === 'revert' && boss.phaseT > 70) {
      boss.phase = 'wallbreak'; boss.phaseT = 0;
      boss.wallHole = true;
      addShake(4, 18);
      sfx(80, 0.5, 'sawtooth', 0.09, -30);             // the wall loses
      burst(VIEW_W - 28, 110, '#59626e', 16, 1.5);
      burst(VIEW_W - 24, 128, '#48505c', 10, 1.2);
    } else if (boss.phase === 'wallbreak') {
      boss.x += 2.4;                                   // through, not around
      if (boss.phaseT > 80) { boss.phase = 'gone'; boss.phaseT = 0; }
    } else if (boss.phase === 'gone' && boss.phaseT > 90) {
      state = 'interlude';       // his tracks run uphill, into the snow
      score += 1500;
      sndWin();
    }
    return;
  }
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
      state = 'interlude';       // the house is hers — but he ran for the trees
      score += 1000;
      sndWin();
    }
  }
}

function drawBoss() {
  const [shX, shY] = shakeOffset();
  ctx.save();
  ctx.translate(shX, shY);
  if (boss.kind === 'aztec') { drawGoldChamber(); drawBossEntitiesAztec(); return endBossDraw(); }
  if (boss.kind === 'yeti') { drawIceCave(); drawBossEntitiesYeti(); return endBossDraw(); }
  if (boss.kind === 'werewolf') { drawChapelArena(); drawBossEntitiesWolf(); return endBossDraw(); }
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

function endBossDraw() {
  ctx.restore();
  drawHUD();
}

/* --- the burial chamber, and its gold --- */
function drawGoldChamber() {
  ctx.fillStyle = '#2a2210'; ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
  ctx.fillStyle = '#332a14';
  for (let i = 0; i < 10; i++) ctx.fillRect(i * 34, 12, 17, 122);
  // the sun stone behind him
  const sx = 214, sy = 74;
  ctx.fillStyle = '#8a742a';
  ctx.beginPath(); ctx.arc(sx, sy, 44, 0, 7); ctx.fill();
  ctx.fillStyle = '#a8903a';
  ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
  ctx.fillStyle = '#6d5a20';
  ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
  ctx.fillStyle = '#d8b23a';
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4 + frame / 400;
    ctx.fillRect(sx + Math.cos(ang) * 38 - 2, sy + Math.sin(ang) * 38 - 2, 5, 5);
  }
  // the great sarcophagus
  ctx.fillStyle = '#54442c'; ctx.fillRect(VIEW_W - 40, 60, 30, 84);
  ctx.fillStyle = '#d8b23a'; ctx.fillRect(VIEW_W - 35, 70, 20, 26);
  ctx.fillStyle = '#2a2210';
  ctx.fillRect(VIEW_W - 30, 76, 3, 4); ctx.fillRect(VIEW_W - 23, 76, 3, 4);
  // the floor, and its treasure drifts
  ctx.fillStyle = '#3a2f18'; ctx.fillRect(-8, 144, VIEW_W + 16, 40);
  ctx.fillStyle = '#54442c'; ctx.fillRect(-8, 144, VIEW_W + 16, 3);
  ctx.fillStyle = '#d8b23a';
  for (let i = 0; i < 14; i++)
    ctx.fillRect((i * 47) % VIEW_W, 140 + (i % 3), 5, 3);
  for (let i = 0; i < 3; i++) {                        // braziers
    const bx = 30 + i * 60;
    ctx.fillStyle = '#3e2c18'; ctx.fillRect(bx, 128, 8, 14);
    ctx.fillStyle = (frame + i * 5) % 8 < 6 ? '#ffce6a' : '#e8a050';
    ctx.fillRect(bx + 1, 122, 6, 6);
  }
}

function drawSkull(x, y) {
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(x, y, 8, 6);
  ctx.fillRect(x + 1, y + 6, 6, 2);
  ctx.fillStyle = '#241c10';
  ctx.fillRect(x + 1, y + 2, 2, 2); ctx.fillRect(x + 5, y + 2, 2, 2);
  ctx.fillRect(x + 2, y + 6, 1, 1); ctx.fillRect(x + 4, y + 6, 1, 1);
}

function drawDagger(x, y) {
  ctx.fillStyle = '#1c1a22';                           // obsidian blade
  ctx.fillRect(x, y + 2, 8, 3);
  ctx.fillRect(x + 8, y + 3, 2, 1);
  ctx.fillStyle = '#d8b23a';                           // gold grip
  ctx.fillRect(x - 3, y + 1, 4, 5);
  ctx.fillStyle = '#5aa88a'; ctx.fillRect(x - 2, y + 3, 1, 1);   // one jade eye
}

function drawBossEntitiesAztec() {
  if (dag.state !== 'held') drawDagger(Math.round(dag.x), Math.round(dag.y));
  for (const sk of skulls) drawSkull(Math.round(sk.x), Math.round(sk.y));
  drawAztec();
  drawPlayer();
  if (carrying === 'dagger')
    drawDagger(Math.round(player.x), Math.round(player.y) - 12);
  drawParticles();
}

function drawAztec() {
  const P = boss;
  if (P.phase === 'revert') {
    const x = Math.round(P.x);
    drawBoyAt(x, 124, 'crouch');
    ctx.fillStyle = '#d8b23a';                         // the mask, face down beside him
    ctx.fillRect(x - 14, 136, 12, 7);
    return;
  }
  if (P.phase === 'gone') {
    ctx.fillStyle = '#d8b23a'; ctx.fillRect(Math.round(P.x) - 14, 136, 12, 7);
    return;
  }
  const crumpled = P.phase === 'crumple';
  const cracks = 4 - Math.max(0, P.hp);
  const hov = crumpled ? 0 : Math.sin(frame / 22) * 3;
  const x = Math.round(P.x), y = Math.round((crumpled ? 144 - 24 : 144 - P.h) - hov);
  ctx.save();
  ctx.translate(x, y);
  if (P.dir < 0 && !crumpled) { ctx.translate(P.w, 0); ctx.scale(-1, 1); }
  if (P.hurtT > 0 && (frame >> 1) % 2) ctx.globalAlpha = 0.55;
  if (crumpled) {
    ctx.fillStyle = '#8c5a30'; ctx.fillRect(4, 8, 22, 16);        // kneeling
    ctx.fillStyle = '#d8b23a'; ctx.fillRect(8, 0, 14, 10);        // mask bowed
    ctx.fillStyle = '#241c10';
    ctx.fillRect(11, 3, 2, 2); ctx.fillRect(17, 3, 2, 2);
  } else {
    // the feather crown, thinning as the gold chips
    for (let i = 0; i < 7 - cracks; i++) {
      ctx.fillStyle = i % 2 ? '#2a8a5a' : '#c93a3a';
      ctx.fillRect(2 + i * 4, -10 - (i % 3) * 3, 3, 12);
    }
    ctx.fillStyle = '#d8b23a';                         // the mask itself
    ctx.fillRect(6, 0, 18, 16);
    ctx.fillRect(4, 4, 22, 8);
    ctx.fillStyle = '#241c10';                         // its patient eyes
    ctx.fillRect(10, 5, 3, 3); ctx.fillRect(18, 5, 3, 3);
    ctx.fillRect(13, 11, 5, 2);
    ctx.fillStyle = '#8a742a';                         // and its cracks
    for (let i = 0; i < cracks * 3; i++)
      ctx.fillRect(6 + (i * 41) % 17, 1 + (i * 23) % 13, 1, 4);
    ctx.fillStyle = '#8c5a30';                         // the boy beneath, gone regal
    ctx.fillRect(8, 16, 14, 18);
    ctx.fillStyle = '#d8b23a'; ctx.fillRect(8, 18, 14, 5);        // pectoral
    ctx.fillStyle = '#c93a3a'; ctx.fillRect(4, 16, 4, 20);        // cape edge
    ctx.fillStyle = '#8c5a30';
    ctx.fillRect(9, 34, 4, 12); ctx.fillRect(17, 34, 4, 12);      // legs, above the floor
  }
  ctx.restore();
}

/* --- the ice cave, and what it kept --- */
function drawIceCave() {
  ctx.fillStyle = '#25324a'; ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
  // walls of old blue ice
  ctx.fillStyle = '#2e3d5a';
  for (let i = 0; i < 9; i++)
    ctx.fillRect(i * 40 - 12, 34 + (i % 3) * 28, 34, 24);
  ctx.fillStyle = 'rgba(159,232,255,0.06)';
  for (let i = 0; i < 5; i++)
    ctx.fillRect(i * 70 + 20, 30 + (i % 2) * 40, 3, 60);   // glints in the depth
  // the ceiling mass
  ctx.fillStyle = '#3a4a6e'; ctx.fillRect(-8, -8, VIEW_W + 16, 48);
  ctx.fillStyle = '#4a5c84';
  for (let i = 0; i < 11; i++)
    ctx.fillRect(i * 30 - 4, 32 + (i % 2) * 4, 22, 8);
  // the floor
  ctx.fillStyle = '#2c3852'; ctx.fillRect(-8, 144, VIEW_W + 16, 40);
  ctx.fillStyle = '#9fb4d8'; ctx.fillRect(-8, 144, VIEW_W + 16, 3);
  // the tunnel he is saving for later
  ctx.fillStyle = '#0c1018';
  ctx.fillRect(VIEW_W - 28, 96, 30, 48);
  ctx.beginPath(); ctx.arc(VIEW_W - 13, 96, 15, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#1a2438';
  ctx.fillRect(VIEW_W - 30, 92, 4, 52); ctx.fillRect(VIEW_W - 2, 92, 4, 52);
}

function drawIcicleHang(x, y) {
  ctx.fillStyle = '#bfe0f4';
  ctx.fillRect(x - 3, y, 8, 12);
  ctx.fillRect(x - 1, y + 12, 5, 10);
  ctx.fillRect(x, y + 22, 3, 6);
  ctx.fillRect(x + 1, y + 28, 1, 3);
  ctx.fillStyle = '#e8f4fc'; ctx.fillRect(x - 2, y + 2, 1, 18);
}

function drawBossEntitiesYeti() {
  for (const ic of iceCeil)
    if (ic.state !== 'gone') drawIcicleHang(ic.x, ic.y);
  for (const fi of iceFloor)
    if (fi.state !== 'gone') {
      const x = Math.round(fi.x);
      ctx.fillStyle = '#bfe0f4';
      ctx.fillRect(x - 3, 138, 8, 6);
      ctx.fillRect(x - 1, 133, 5, 6);
      ctx.fillRect(x, 130, 3, 4);
      ctx.fillStyle = '#e8f4fc'; ctx.fillRect(x - 2, 134, 1, 8);
    }
  drawYeti();
  drawPlayer();
  drawParticles();
}

function drawYeti() {
  const P = boss;
  if (P.phase === 'revert' || P.phase === 'run') {
    drawBoyAt(Math.round(P.x), 124, P.phase === 'revert' ? 'crouch' : 'run');
    return;
  }
  if (P.phase === 'gone') return;
  const crumpled = P.phase === 'crumple';
  const x = Math.round(P.x), y = crumpled ? 144 - 18 : 144 - P.h;
  ctx.save();
  ctx.translate(x, y);
  if (P.dir < 0 && !crumpled) { ctx.translate(P.w, 0); ctx.scale(-1, 1); }
  if (P.hurtT > 0 && (frame >> 1) % 2) ctx.globalAlpha = 0.55;
  const F = '#dce4ee', S = '#a8b4c8', D = '#3a4250';
  if (crumpled) {
    const bob = (frame >> 4) % 2;
    ctx.fillStyle = F; ctx.fillRect(0, 4 - bob, 38, 14 + bob);
    ctx.fillStyle = S; ctx.fillRect(4, 12, 30, 6);
    ctx.fillRect(30, 0, 8, 8);
  } else {
    const slam = P.swipeT > 8;
    ctx.fillStyle = F;
    ctx.fillRect(4, 10, 30, 34);                      // shaggy bulk
    ctx.fillRect(8, 0, 22, 14);                       // head
    ctx.fillStyle = S;
    ctx.fillRect(4, 38, 30, 6);
    ctx.fillRect(6, 20, 4, 18); ctx.fillRect(28, 20, 4, 18);
    ctx.fillStyle = D;                                // the face in the fur
    ctx.fillRect(12, 4, 14, 8);
    ctx.fillStyle = '#7ec9e8';                        // ice-water eyes
    ctx.fillRect(14, 6, 3, 2); ctx.fillRect(21, 6, 3, 2);
    ctx.fillStyle = '#f0f4fa';                        // teeth
    ctx.fillRect(15, 10, 2, 2); ctx.fillRect(20, 10, 2, 2);
    // the arms — up for the slam, down for the walk
    ctx.fillStyle = F;
    if (slam) { ctx.fillRect(30, -6, 8, 22); ctx.fillRect(-2, 8, 8, 18); }
    else { ctx.fillRect(32, 12, 7, 26); ctx.fillRect(-1, 12, 7, 26); }
    ctx.fillStyle = '#a01828';                        // what she has cost him
    for (let i = 0, cuts = (4 - Math.max(0, Math.ceil(P.hp))) * 3; i < cuts; i++)
      ctx.fillRect((i * 47) % 28 + 5, (i * 31) % 30 + 8, 3, 4);
  }
  ctx.restore();
}

/* --- the chapel, the moon, the wolf --- */
function drawChapelArena() {
  ctx.fillStyle = '#1e222a'; ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
  ctx.fillStyle = '#252a34';
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 9; i++)
      ctx.fillRect(i * 42 + (j % 2) * 21 - 14, j * 30 + 4, 38, 26);
  ctx.fillStyle = '#2c313a'; ctx.fillRect(-8, 144, VIEW_W + 16, 40);
  ctx.fillStyle = '#3a4048'; ctx.fillRect(-8, 144, VIEW_W + 16, 4);
  // the arched window, and a moon with nothing missing from it
  const wx = 66, wy = 24;
  ctx.fillStyle = '#141820';
  ctx.fillRect(wx - 5, wy + 16, 74, 62);
  ctx.beginPath(); ctx.arc(wx + 32, wy + 18, 37, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(wx, wy + 18, 64, 56);
  ctx.beginPath(); ctx.arc(wx + 32, wy + 19, 32, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e8e4d5';
  ctx.beginPath(); ctx.arc(wx + 32, wy + 24, 17, 0, 7); ctx.fill();
  ctx.fillStyle = '#d5d0be';
  ctx.fillRect(wx + 24, wy + 18, 5, 4); ctx.fillRect(wx + 38, wy + 28, 4, 3);
  ctx.fillStyle = '#141820';
  ctx.fillRect(wx + 30, wy - 12, 4, 88); ctx.fillRect(wx, wy + 44, 64, 4);
  // candles along the left
  for (let i = 0; i < 3; i++) {
    const cx2 = 14 + i * 16;
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(cx2, 128, 3, 14);
    ctx.fillStyle = (frame + i * 5) % 8 < 6 ? '#ffce6a' : '#e8a050';
    ctx.fillRect(cx2, 124, 3, 4);
  }
  ctx.fillStyle = 'rgba(255,206,106,0.05)'; ctx.fillRect(4, 112, 56, 40);
  // the east wall — thick, until it isn't
  ctx.fillStyle = '#39424e'; ctx.fillRect(VIEW_W - 30, -8, 38, 152);
  ctx.fillStyle = '#2f3742';
  for (let j = 0; j < 6; j++) ctx.fillRect(VIEW_W - 30, j * 26 + (j % 2) * 4, 38, 2);
  if (boss.wallHole) {
    ctx.fillStyle = '#0a0812';
    ctx.fillRect(VIEW_W - 30, 92, 38, 52);
    ctx.fillRect(VIEW_W - 26, 80, 30, 14);
    ctx.fillStyle = '#48505c';                        // rubble where the wall was
    ctx.fillRect(VIEW_W - 40, 138, 10, 6); ctx.fillRect(VIEW_W - 52, 141, 8, 3);
    ctx.fillRect(VIEW_W - 30, 136, 6, 8);
    ctx.fillStyle = '#e8e4d5';                        // moonlight through the hole
    ctx.fillRect(VIEW_W - 30, 100, 2, 40);
  }
}

function drawBossEntitiesWolf() {
  drawWerewolf();
  if (candel.state !== 'held')
    drawCandelabra(Math.round(candel.x), Math.round(candel.y));
  drawPlayer();
  if (carrying === 'candelabra')
    drawCandelabra(Math.round(player.x) - 1, Math.round(player.y) - 15);
  drawParticles();
}

function drawCandelabra(x, y) {
  ctx.fillStyle = '#c9cede';
  ctx.fillRect(x + 5, y + 4, 2, 6);                    // stem
  ctx.fillRect(x + 3, y + 10, 6, 2);                   // foot
  ctx.fillRect(x + 1, y + 2, 10, 2);                   // arms
  ctx.fillRect(x + 1, y - 1, 2, 3); ctx.fillRect(x + 9, y - 1, 2, 3);
  ctx.fillRect(x + 5, y - 2, 2, 3);
  ctx.fillStyle = '#ffce6a';                           // three stubborn flames
  ctx.fillRect(x + 1, y - 3, 2, 2); ctx.fillRect(x + 9, y - 3, 2, 2);
  ctx.fillRect(x + 5, y - 4, 2, 2);
}

function drawWerewolf() {
  const P = boss;
  if (P.phase === 'revert' || P.phase === 'wallbreak') {
    // the boy again, small and pleased with himself
    drawBoyAt(Math.round(P.x), 124, P.phase === 'revert' ? 'crouch' : 'run');
    return;
  }
  if (P.phase === 'gone') return;
  const x = Math.round(P.x), tear = 4 - Math.max(0, P.hp);
  ctx.save();
  const crumpled = P.phase === 'crumple';
  const y = crumpled ? 144 - 16 : 144 - P.h;
  ctx.translate(x, y);
  if (P.dir < 0 && !crumpled) { ctx.translate(P.w, 0); ctx.scale(-1, 1); }
  if (P.hurtT > 0 && (frame >> 1) % 2) ctx.globalAlpha = 0.55;
  const F = '#3a3028', D = '#2a221c', W = '#8a8a94';
  if (crumpled) {
    // a naked hairy beast, breathing its last borrowed breaths
    const bob = (frame >> 4) % 2;
    ctx.fillStyle = F; ctx.fillRect(0, 4 - bob, 34, 12 + bob);
    ctx.fillStyle = D; ctx.fillRect(4, 10, 26, 6);
    ctx.fillRect(28, 0, 8, 8);                          // head down
    ctx.fillStyle = '#8c2f39'; ctx.fillRect(30, 6, 3, 1);
  } else {
    const lunge = P.swipeT > 4 && P.swipeT < 14;
    ctx.fillStyle = F;
    ctx.fillRect(0, 8, 30, 16);                        // torso, all fours
    ctx.fillRect(24, 0, 12, 12);                       // head
    ctx.fillStyle = D;
    ctx.fillRect(2, 22, 5, 12); ctx.fillRect(12, 22, 5, 12);   // haunches
    ctx.fillRect(22, 20, 4, 14); ctx.fillRect(29, 20, 4, 14);  // forelegs
    ctx.fillRect(24, -4, 4, 5); ctx.fillRect(31, -4, 4, 5);    // ears
    ctx.fillRect(-6, 6, 7, 4);                          // tail
    ctx.fillStyle = '#ff2030';                          // the eyes stayed his
    ctx.fillRect(31, 3, 3, 2);
    ctx.fillStyle = '#f0f0f4';                          // teeth and claws
    ctx.fillRect(33, 8, 3, 2);
    ctx.fillRect(22, 32, 5, 2); ctx.fillRect(29, 32, 5, 2);
    if (lunge) {                                        // the swipe itself
      ctx.fillRect(36, 12, 8, 2); ctx.fillRect(38, 16, 8, 2); ctx.fillRect(36, 20, 8, 2);
    }
    // what's left of his clothes, by wound
    ctx.fillStyle = '#d8c23a';                          // the bright shirt
    if (tear < 1) { ctx.fillRect(2, 8, 22, 6); ctx.fillRect(4, 14, 18, 4); }
    else if (tear < 2) { ctx.fillRect(4, 9, 12, 5); ctx.fillRect(18, 8, 5, 3); }
    else if (tear < 3) ctx.fillRect(6, 9, 6, 4);
    ctx.fillStyle = '#3a5cc9';                          // the jeans
    if (tear < 2) { ctx.fillRect(2, 20, 6, 8); ctx.fillRect(12, 20, 6, 8); }
    else if (tear < 3) ctx.fillRect(2, 20, 5, 5);
    else if (tear < 4) ctx.fillRect(3, 21, 3, 3);
    // and the blood he earned
    ctx.fillStyle = '#a01828';
    for (let i = 0; i < tear * 4; i++)
      ctx.fillRect((i * 53) % 30 + 1, (i * 29) % 20 + 6, 3, 4);
  }
  ctx.restore();
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
  if (boss.phase === 'crouch') {
    drawBoyAt(x, y, 'crouch');
  } else if (boss.phase === 'laugh') {
    drawBoyAt(x, y + ((frame >> 3) % 2), 'idle');
    if ((frame >> 4) % 2) pixelText('HA HA', x - 2, y - 12, '#f0e040');
  } else {
    drawBoyAt(x, y, 'run');
  }
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
          (hardAt(aheadX, dog.y + dog.h - 4) || !solidAt(aheadX, dog.y + dog.h + 6)))
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
        (hardAt(aheadX, dog.y + dog.h - 4) || !solidAt(aheadX, dog.y + dog.h + 6)))
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
    dogStruck(player.face);
  }
}

// anything of hers that lands on the dog goes through here
function dogStruck(dir) {
  dog.hp--;
  dog.flashT = 6;
  dog.retreatT = 70;
  dog.vx = dir * 3;
  dog.vy = -1.5;
  sfx(300, 0.15, 'sawtooth', 0.05, 200);     // a yelp
  burst(dog.x + 8, dog.y + 4, '#c9a06a', 5, dir * 1.5);
  if (dog.hp <= 0) {
    dog.deadT = 600;                         // ten seconds before it dares again
    dog.fleeT = 1;                           // visible until it clears the screen
    dog.retreatT = 0;
    dog.barkCd = 0;
    score += 250;
    sfx(210, 0.07, 'sawtooth', 0.055, 170);              // two sharp barks
    setTimeout(() => sfx(230, 0.07, 'sawtooth', 0.05, 160), 120);
    flashText = { msg: 'it barks, and thinks better of it.', t: 110 };
  }
}

// at full creep her kicks shed porcelain — and she throws it
function updateShards() {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.x += s.vx; s.y += s.vy; s.vy += 0.04; s.t++;
    let gone = s.t > 90 || hardAt(s.x + 2, s.y + 2);
    if (!gone) {
      for (const e of enemies) {
        if (!e.dead && rectsOverlap({ x: s.x, y: s.y, w: 4, h: 4 }, e)) {
          e.hp -= 1;
          e.flashT = 6;
          sndHitE();
          if (e.hp <= 0) killEnemy(e);
          gone = true;
          break;
        }
      }
    }
    if (!gone && dog.active && dog.deadT <= 0 &&
        rectsOverlap({ x: s.x, y: s.y, w: 4, h: 4 }, dog)) {
      dogStruck(Math.sign(s.vx) || 1);
      gone = true;
    }
    if (gone) {
      burst(s.x + 2, s.y + 2, '#efe2cf', 5, Math.sign(s.vx) * 0.8);
      shards.splice(i, 1);
    }
  }
}

function drawShards() {
  ctx.fillStyle = '#efe2cf';
  for (const s of shards) {
    const x = Math.round(s.x - camX), y = Math.round(s.y);
    if ((s.t >> 2) % 2) ctx.fillRect(x, y + 1, 4, 2);
    else ctx.fillRect(x + 1, y, 2, 4);
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
    if (level === 5) {
      // a doorway older than doors
      ctx.fillStyle = d.used ? '#3a2f1c' : '#54442c';
      ctx.fillRect(x - 3, d.y - 4, 20, 26);
      ctx.fillStyle = d.used ? '#241c10' : '#2e2414';
      ctx.fillRect(x, d.y, 14, 22);
      if (d.used) continue;
      const tpulse = (Math.sin(frame / 15) + 1) / 2;
      ctx.fillStyle = 'rgba(255,206,106,' + (0.10 + tpulse * 0.18) + ')';
      ctx.fillRect(x + 2, d.y + 2, 10, 20);
      ctx.fillStyle = d.kind === 'glyphs' ? '#e8c66a' :
                      d.kind === 'scarabs' ? '#5aa88a' : '#c9cede';
      ctx.fillRect(x + 5, d.y + 8, 4, 4);
      if (state === 'play' && player.onGround &&
          player.x + player.w > d.x && player.x < d.x + d.w && (frame >> 5) % 2)
        pixelText('UP', x + 2, d.y - 15, '#e8c66a');
      continue;
    }
    if (level === 3) {
      // a standing-stone arch with a rune that knows her name
      ctx.fillStyle = d.used ? '#242a32' : '#39424e';
      ctx.fillRect(x - 3, d.y - 2, 5, 24);
      ctx.fillRect(x + 12, d.y - 2, 5, 24);
      ctx.fillRect(x - 4, d.y - 6, 22, 5);
      if (d.used) { ctx.fillStyle = '#10141a'; ctx.fillRect(x + 2, d.y + 2, 10, 20); continue; }
      const pulse = (Math.sin(frame / 15) + 1) / 2;
      ctx.fillStyle = 'rgba(140,200,255,' + (0.12 + pulse * 0.22) + ')';
      ctx.fillRect(x + 2, d.y + 2, 10, 20);
      ctx.fillStyle = d.kind === 'tarot' ? '#c98fe8' :
                      d.kind === 'bell' ? '#e8c66a' :
                      d.kind === 'crows' ? '#8a8a94' : '#9fe88f';
      ctx.fillRect(x + 5, d.y + 8, 4, 4);
      if (state === 'play' && player.onGround &&
          player.x + player.w > d.x && player.x < d.x + d.w && (frame >> 5) % 2)
        pixelText('UP', x + 2, d.y - 15, '#bfe8ff');
      continue;
    }
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
  if (door.kind === 'tarot') {
    const vals = [0, 0, 1, 1, 2, 2, 3, 3];
    for (let i = vals.length - 1; i > 0; i--) {          // shuffle the deck
      const j = Math.floor(Math.random() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    Object.assign(mini, { cards: vals, face: vals.map(() => 0),  // 0 down, 1 up, 2 matched
                          sel: 0, first: -1, flips: 0, matched: 0, revealT: 0 });
  }
  if (door.kind === 'bell')
    Object.assign(mini, { swings: 3, rung: 0, p: 0, bellT: 0 });
  if (door.kind === 'crows')
    Object.assign(mini, {
      darts: 5, hits: 0, dart: null, aimY: 90, hopT: 0,
      perches: [{ x: 190, y: 58 }, { x: 232, y: 84 }, { x: 274, y: 56 },
                { x: 210, y: 116 }, { x: 258, y: 122 }],
      crows: [0, 2, 4],                                  // perch indexes
    });
  if (door.kind === 'dig')
    Object.assign(mini, { locket: Math.floor(Math.random() * 3), sel: 1,
                          phase: 'pick', digP: 0, digT: 300, dug: false, spiderT: 0 });
  if (door.kind === 'glyphs') {
    const seq = [];
    for (let i = 0; i < 4; i++) seq.push(Math.floor(Math.random() * 4));
    Object.assign(mini, { seq, phase: 'show', showI: -1, showT: 0, sel: 0, inputI: 0 });
  }
  if (door.kind === 'scarabs')
    Object.assign(mini, { phase: 'pick', sel: 1, winner: -1,
                          racers: [{ x: 46 }, { x: 46 }, { x: 46 }] });
  if (door.kind === 'spears')
    Object.assign(mini, { dollX: 36, gate: 0, attempts: 5, dashT: 0, ow: 0 });
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
  else if (mini.kind === 'tarot') updateTarot();
  else if (mini.kind === 'bell') updateBell();
  else if (mini.kind === 'crows') updateCrows();
  else if (mini.kind === 'dig') updateDig();
  else if (mini.kind === 'glyphs') updateGlyphs();
  else if (mini.kind === 'scarabs') updateScarabs();
  else if (mini.kind === 'spears') updateSpears();
  else updateCoffin();
}

/* --- the glyph rite: the wall speaks four words; say them back --- */
const GLYPH_TONES = [392, 494, 587, 660];

function updateGlyphs() {
  if (mini.phase === 'show') {
    if (++mini.showT % 45 === 0) {
      mini.showI++;
      if (mini.showI >= 4) { mini.phase = 'input'; mini.showI = -1; }
      else sfx(GLYPH_TONES[mini.seq[mini.showI]], 0.25, 'triangle', 0.06);
    }
  } else if (mini.phase === 'input') {
    if (mEdge('l', kLeft()) && mini.sel > 0) mini.sel--;
    if (mEdge('r', kRight()) && mini.sel < 3) mini.sel++;
    if (mEdge('z', kPunch())) {
      if (mini.sel === mini.seq[mini.inputI]) {
        sfx(GLYPH_TONES[mini.sel], 0.2, 'triangle', 0.06);
        mpBurst(70 + mini.sel * 50 + 15, 96, '#e8c66a', 5);
        if (++mini.inputI >= 4) {
          mini.over = true; mini.won = true;
          score += 400;
          healOne();
          mini.msg = 'THE WALL REMEMBERS HER   +400';
        }
      } else {
        mini.over = true; mini.won = false;
        sfx(120, 0.4, 'sawtooth', 0.06, -60);
        mini.msg = 'THE WALL FORGETS YOU.';
      }
    }
  }
}

function drawGlyphStone(x, y, g, lit) {
  ctx.fillStyle = lit ? '#8a742a' : '#4a3c22';
  ctx.fillRect(x, y, 34, 40);
  ctx.fillStyle = lit ? '#ffce6a' : '#6d5a30';
  const gx = x + 11, gy = y + 12;
  if (g === 0) { ctx.fillRect(gx, gy, 12, 3); ctx.fillRect(gx + 4, gy + 5, 4, 10); }
  else if (g === 1) { ctx.fillRect(gx, gy, 3, 16); ctx.fillRect(gx + 9, gy, 3, 16); }
  else if (g === 2) { ctx.fillRect(gx + 2, gy + 2, 8, 8); ctx.fillRect(gx + 4, gy + 12, 4, 4); }
  else { ctx.fillRect(gx, gy + 2, 12, 3); ctx.fillRect(gx, gy + 8, 12, 3); ctx.fillRect(gx, gy + 14, 12, 3); }
}

function drawGlyphs() {
  miniBackdropTomb('THE GLYPH RITE');
  for (let i = 0; i < 4; i++) {
    const lit = (mini.phase === 'show' && mini.showI >= 0 && mini.seq[mini.showI] === i);
    drawGlyphStone(70 + i * 50, 76, i, lit);
    if (mini.phase === 'input' && i === mini.sel) {
      ctx.fillStyle = '#e8c66a';
      ctx.fillRect(70 + i * 50 + 14, 122, 6, 3);
    }
  }
  pixelText(mini.phase === 'show' ? 'WATCH THE WALL SPEAK'
                                  : 'REPEAT: LEFT RIGHT  Z SPEAKS', 84, 148, '#9a8fb0');
  pixelText('WORDS ' + Math.max(0, mini.inputI) + '/4', 254, 46, '#e8c66a');
}

/* --- the scarab race: back the right beetle --- */
function updateScarabs() {
  if (mini.phase === 'pick') {
    if (mEdge('l', kLeft()) && mini.sel > 0) mini.sel--;
    if (mEdge('r', kRight()) && mini.sel < 2) mini.sel++;
    if (mEdge('z', kPunch())) {
      mini.phase = 'race';
      sfx(520, 0.15, 'square', 0.05);
    }
  } else if (mini.phase === 'race') {
    for (let i = 0; i < 3; i++) {
      mini.racers[i].x += 0.4 + Math.random() * 0.7;
      if (mini.racers[i].x >= 272 && mini.winner < 0) mini.winner = i;
    }
    if (mini.winner >= 0) {
      mini.over = true; mini.won = mini.winner === mini.sel;
      if (mini.won) score += 300;
      mini.msg = mini.won ? 'HER BEETLE KNEW THE WAY   +300'
                          : 'YOUR BEETLE DAWDLED.';
      sfx(mini.won ? 660 : 140, 0.3, mini.won ? 'triangle' : 'sawtooth', 0.06);
    }
  }
}

function drawScarabs() {
  miniBackdropTomb('THE SCARAB RACE');
  for (let i = 0; i < 3; i++) {
    const ly = 76 + i * 26;
    ctx.fillStyle = '#3a2f1c'; ctx.fillRect(40, ly + 10, 240, 2);
    ctx.fillStyle = '#6d5a30'; ctx.fillRect(272, ly - 2, 3, 16);   // the finish stone
    const img = SCARAB_FRAMES[(frame >> 2) % 2];
    ctx.drawImage(img, Math.round(mini.racers[i].x), ly + 3);
    if (mini.phase === 'pick' && i === mini.sel) {
      ctx.fillStyle = '#e8c66a';
      ctx.fillRect(28, ly + 4, 6, 4);
    }
  }
  pixelText(mini.phase === 'pick' ? 'BACK A BEETLE: LEFT RIGHT  Z BETS'
                                  : 'RUN, LITTLE GODS, RUN', 68, 148, '#9a8fb0');
}

/* --- the spear gauntlet: three gates, and timing --- */
const SPEAR_X = [120, 180, 240];
function spearUp(t, i) { return ((t / 50 + i * 0.37) % 1) > 0.5; }

function updateSpears() {
  if (mini.dashT > 0) { mini.dashT--; return; }
  if (mini.ow > 0) { mini.ow--; return; }
  if (mEdge('z', kPunch()) && mini.gate < 3 && mini.attempts > 0) {
    if (spearUp(mini.t, mini.gate)) {
      mini.dollX = SPEAR_X[mini.gate] + 14;
      mini.gate++;
      mini.dashT = 10;
      sfx(300, 0.1, 'square', 0.05, 180);
      if (mini.gate === 3) {
        mini.over = true; mini.won = true;
        score += 400;
        mini.msg = 'THREE GATES, UNTOUCHED   +400';
      }
    } else {
      mini.attempts--;
      mini.ow = 25;
      sfx(900, 0.1, 'square', 0.06, -500);             // spear meets stone, barely misses doll
      mpBurst(SPEAR_X[mini.gate], 120, '#c9cede', 6);
      if (mini.attempts <= 0) {
        mini.over = true; mini.won = false;
        mini.msg = 'THE GATES KEEP HER OUT.';
      }
    }
  }
}

function drawSpears() {
  miniBackdropTomb('THE SPEAR GAUNTLET');
  for (let i = 0; i < 3; i++) {
    const up = spearUp(mini.t, i), sx = SPEAR_X[i];
    ctx.fillStyle = '#4a3c22'; ctx.fillRect(sx - 4, 40, 14, 8);
    const len = up ? 18 : 84;
    ctx.fillStyle = '#8a8a94'; ctx.fillRect(sx + 1, 48, 4, len);
    ctx.fillStyle = '#c9cede'; ctx.fillRect(sx, 48 + len, 6, 8);
    if (i < mini.gate) {
      ctx.fillStyle = 'rgba(232,198,106,0.25)';
      ctx.fillRect(sx - 6, 48, 18, 96);
    }
  }
  ctx.drawImage(DOLL[creepStage()].idle, Math.round(mini.dollX), 124);
  for (let i = 0; i < mini.attempts; i++) {
    ctx.fillStyle = '#c9304a'; ctx.fillRect(10 + i * 8, 46, 5, 5);
  }
  pixelText('Z DASHES WHEN THE SPEAR IS UP', 76, 156, '#9a8fb0');
  pixelText('GATES ' + mini.gate + '/3', 258, 46, '#e8c66a');
}

function miniBackdropTomb(title) {
  ctx.fillStyle = '#241c10'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#2e2414';
  for (let i = 0; i < 10; i++) ctx.fillRect(i * 34, 14, 17, 120);
  for (let i = 0; i < 4; i++) {                        // braziers
    ctx.fillStyle = '#3e2c18'; ctx.fillRect(24 + i * 88, 26, 6, 6);
    ctx.fillStyle = (frame + i * 7) % 8 < 6 ? '#ffce6a' : '#e8a050';
    ctx.fillRect(25 + i * 88, 22, 4, 4);
  }
  ctx.fillStyle = '#1c1408'; ctx.fillRect(0, 150, VIEW_W, 26);
  ctx.fillStyle = '#2e2414'; ctx.fillRect(0, 150, VIEW_W, 2);
  pixelText(title, (VIEW_W - title.length * 6) / 2 + 8, 34, '#e8c66a');
}

/* --- the fortune teller: four pairs, face down, patient --- */
function updateTarot() {
  if (mini.revealT > 0) {
    if (--mini.revealT === 0)
      mini.face = mini.face.map(f => (f === 1 ? 0 : f));  // the mismatch turns back
    return;
  }
  if (mEdge('l', kLeft()) && mini.sel > 0) mini.sel--;
  if (mEdge('r', kRight()) && mini.sel < 7) mini.sel++;
  if (mEdge('z', kPunch()) && mini.face[mini.sel] === 0) {
    mini.face[mini.sel] = 1;
    sfx(500 + mini.cards[mini.sel] * 60, 0.08, 'triangle', 0.05);
    if (mini.first < 0) mini.first = mini.sel;
    else {
      mini.flips++;
      if (mini.cards[mini.first] === mini.cards[mini.sel]) {
        mini.face[mini.first] = mini.face[mini.sel] = 2;
        mini.matched++;
        sfx(780, 0.2, 'triangle', 0.06);
        mpBurst(60 + mini.sel * 26, 100, '#c98fe8', 6);
        if (mini.matched === 4) {
          mini.over = true; mini.won = true;
          const bonus = Math.max(100, 800 - mini.flips * 100);
          score += bonus;
          healOne();
          mini.msg = 'THE CARDS REMEMBER HER   +' + bonus;
        }
      } else {
        mini.revealT = 40;
        sfx(180, 0.15, 'sawtooth', 0.04, -60);
      }
      mini.first = -1;
    }
  }
}

function drawTarot() {
  miniBackdropWoods('THE FORTUNE TELLER');
  const GLYPH = ['#e8c66a', '#c9304a', '#8a8a94', '#9fe88f'];   // moon, heart, skull, spider
  for (let i = 0; i < 8; i++) {
    const x = 48 + i * 30, y = 84;
    const up = mini.face[i] > 0;
    ctx.fillStyle = mini.face[i] === 2 ? '#3a3050' : up ? '#d9c8b2' : '#2a2440';
    ctx.fillRect(x, y, 22, 34);
    ctx.fillStyle = mini.face[i] === 2 ? '#584a78' : up ? '#bfae98' : '#3a3458';
    ctx.fillRect(x + 1, y + 1, 20, 2);
    if (up) {
      ctx.fillStyle = GLYPH[mini.cards[i]];
      const cx2 = x + 8, cy2 = y + 13;
      if (mini.cards[i] === 0) {                       // moon
        ctx.beginPath(); ctx.arc(cx2 + 3, cy2 + 3, 5, 0, 7); ctx.fill();
        ctx.fillStyle = mini.face[i] === 2 ? '#3a3050' : '#d9c8b2';
        ctx.beginPath(); ctx.arc(cx2 + 1, cy2 + 2, 4, 0, 7); ctx.fill();
      } else if (mini.cards[i] === 1) drawHeart(cx2 - 1, cy2, GLYPH[1]);
      else if (mini.cards[i] === 2) {                  // skull
        ctx.fillRect(cx2 - 1, cy2, 8, 6);
        ctx.fillStyle = '#1a1626';
        ctx.fillRect(cx2, cy2 + 2, 2, 2); ctx.fillRect(cx2 + 4, cy2 + 2, 2, 2);
        ctx.fillStyle = GLYPH[2]; ctx.fillRect(cx2, cy2 + 6, 6, 2);
      } else {                                         // spider
        ctx.fillRect(cx2, cy2 + 1, 6, 4);
        for (let s = 0; s < 3; s++) {
          ctx.fillRect(cx2 - 2, cy2 + s * 2, 2, 1);
          ctx.fillRect(cx2 + 6, cy2 + s * 2, 2, 1);
        }
      }
    } else {
      ctx.fillStyle = '#584a78';                       // card back filigree
      ctx.fillRect(x + 4, y + 6, 14, 1); ctx.fillRect(x + 4, y + 27, 14, 1);
      ctx.fillRect(x + 10, y + 12, 2, 10);
    }
    if (i === mini.sel && !mini.over) {
      ctx.fillStyle = '#e8c66a';
      ctx.fillRect(x + 8, y + 38, 6, 3);
    }
  }
  pixelText('MATCH THE PAIRS   LEFT RIGHT  Z FLIPS', 52, 148, '#9a8fb0');
  pixelText('PAIRS ' + mini.matched + '/4', 254, 46, '#c98fe8');
}

/* --- the bell toll: strike true, three times --- */
function updateBell() {
  mini.p = (Math.sin(mini.t / 18) + 1) / 2;
  if (mini.bellT > 0) mini.bellT--;
  if (mini.swings > 0 && mEdge('z', kPunch())) {
    const q = 1 - Math.abs(mini.p - 0.5) * 2;
    mini.swings--;
    mini.bellT = 24;
    if (q > 0.8) {
      mini.rung++;
      score += 200;
      sfx(220, 1.2, 'triangle', 0.09, -8); sfx(440, 0.9, 'sine', 0.05, -12);
      mpBurst(240, 66, '#e8c66a', 12);
      mini.msg2 = 'A TRUE TOLL.'; mini.msg2T = 80;
    } else if (q > 0.4) {
      score += 50;
      sfx(200, 0.5, 'triangle', 0.05, -30);
    } else {
      sfx(110, 0.2, 'square', 0.05, -60);              // a clunk the crows enjoy
    }
  }
  if (mini.swings === 0 && mini.bellT === 0) {
    mini.over = true; mini.won = mini.rung > 0;
    mini.msg = mini.rung + ' TRUE TOLL' + (mini.rung === 1 ? '' : 'S');
  }
}

function drawBell() {
  miniBackdropWoods('THE BELL TOLL');
  // the bell, hung from nothing anyone remembers
  ctx.fillStyle = '#2a2e36'; ctx.fillRect(238, 44, 4, 10);
  const rock = mini.bellT > 0 ? Math.sin(frame) * 2 : 0;
  ctx.save();
  ctx.translate(240 + rock, 62);
  ctx.fillStyle = '#8a7a4a';
  ctx.fillRect(-12, -8, 24, 14);
  ctx.fillRect(-15, 4, 30, 4);
  ctx.fillStyle = '#6d5f38'; ctx.fillRect(-3, 8, 6, 4);
  ctx.restore();
  // the meter
  ctx.fillStyle = '#241c30'; ctx.fillRect(60, 96, 200, 10);
  ctx.fillStyle = '#3a5a3a'; ctx.fillRect(60 + 80, 96, 40, 10);
  ctx.fillStyle = '#e8c66a'; ctx.fillRect(60 + 92, 96, 16, 10);
  ctx.fillStyle = '#f0f0d0';
  ctx.fillRect(Math.round(58 + mini.p * 200), 92, 4, 18);
  for (let i = 0; i < mini.swings; i++) {
    ctx.fillStyle = '#8a7a4a'; ctx.fillRect(62 + i * 10, 46, 6, 8);
  }
  pixelText('Z STRIKES WHEN THE MARK RINGS GOLD', 60, 148, '#9a8fb0');
  pixelText('TOLLS ' + mini.rung, 262, 46, '#e8c66a');
}

/* --- the crow gallery: they hop, she throws --- */
function updateCrows() {
  if (keys['arrowup'] || keys['w']) mini.aimY -= 1.3;
  if (kDown()) mini.aimY += 1.3;
  mini.aimY = Math.max(44, Math.min(140, mini.aimY));
  if (++mini.hopT > 85) {                              // the crows change their minds
    mini.hopT = 0;
    const free = [0, 1, 2, 3, 4].filter(p => !mini.crows.includes(p));
    if (free.length && mini.crows.length) {
      const ci = Math.floor(Math.random() * mini.crows.length);
      mini.crows[ci] = free[Math.floor(Math.random() * free.length)];
      sfx(700, 0.05, 'square', 0.02, -200);
    }
  }
  const zEdge = mEdge('z', kPunch());   // read every frame so the edge never goes stale
  if (!mini.dart && mini.darts > 0 && zEdge) {
    mini.darts--;
    mini.dart = { x: 34, y: mini.aimY };
    sfx(440, 0.07, 'square', 0.05, -140);
  }
  if (mini.dart) {
    mini.dart.x += 3.4;
    for (let i = 0; i < mini.crows.length; i++) {
      const p = mini.perches[mini.crows[i]];
      if (Math.abs(mini.dart.x + 8 - p.x) < 8 && Math.abs(mini.dart.y - p.y) < 8) {
        mini.crows.splice(i, 1);
        mini.hits++; mini.dart = null;
        score += 150;
        sfx(600, 0.1, 'square', 0.06, -350);
        mpBurst(p.x, p.y, '#3a3a44', 10);
        break;
      }
    }
    if (mini.dart && mini.dart.x > 330) mini.dart = null;
  }
  if (!mini.dart && (mini.darts === 0 || mini.crows.length === 0)) {
    if (!mini.doneT) mini.doneT = mini.t;
    else if (mini.t - mini.doneT > 50) {
      mini.over = true; mini.won = mini.hits >= 3;
      mini.msg = mini.hits + '/3 CROWS   +' + mini.hits * 150;
    }
  }
}

function drawCrows() {
  miniBackdropWoods('THE CROW GALLERY');
  // perches
  ctx.fillStyle = '#3a2c20';
  for (const p of mini.perches) ctx.fillRect(p.x - 12, p.y + 8, 24, 3);
  // crows
  for (const ci of mini.crows) {
    const p = mini.perches[ci];
    ctx.fillStyle = '#22222c';
    ctx.fillRect(p.x - 4, p.y, 9, 6);
    ctx.fillRect(p.x + 4, p.y - 3, 5, 4);
    ctx.fillStyle = '#e8a050'; ctx.fillRect(p.x + 9, p.y - 2, 2, 1);
    ctx.fillStyle = '#ff3040'; ctx.fillRect(p.x + 6, p.y - 2, 1, 1);
    if ((frame + ci * 13) % 70 < 4) {                  // an unimpressed hop
      ctx.fillStyle = '#22222c'; ctx.fillRect(p.x - 2, p.y - 5, 5, 2);
    }
  }
  ctx.drawImage(DOLL[creepStage()].idle, 6, Math.round(mini.aimY) - 16);
  if (!mini.dart) {
    ctx.fillStyle = '#c9cede'; ctx.fillRect(24, Math.round(mini.aimY), 6, 2);
  } else {
    ctx.fillStyle = '#c9cede';
    ctx.fillRect(Math.round(mini.dart.x), Math.round(mini.dart.y), 7, 2);
  }
  for (let i = 0; i < mini.darts; i++) {
    ctx.fillStyle = '#c9cede'; ctx.fillRect(10 + i * 7, 46, 5, 2);
  }
  pixelText('UP DOWN AIM   Z THROWS', 92, 160, '#9a8fb0');
  pixelText('CROWS ' + mini.hits, 262, 46, '#8a8a94');
}

/* --- the grave dig: choose a mound, then earn it --- */
function updateDig() {
  if (mini.phase === 'pick') {
    if (mEdge('l', kLeft()) && mini.sel > 0) mini.sel--;
    if (mEdge('r', kRight()) && mini.sel < 2) mini.sel++;
    if (mEdge('z', kPunch())) {
      mini.phase = 'digging';
      sfx(160, 0.1, 'square', 0.05);
    }
  } else if (mini.phase === 'digging') {
    if (--mini.digT <= 0) {
      mini.over = true; mini.won = false;
      mini.msg = 'TOO SLOW. THE GROUND KEEPS IT.';
      return;
    }
    if (mEdge('z', kPunch())) {
      mini.digP += 9;
      sfx(140 + Math.random() * 40, 0.05, 'square', 0.04, -40);
      mpBurst(80 + mini.sel * 80 + 8, 128, '#3a3f46', 3);
      if (mini.digP >= 100) {
        mini.phase = 'reveal';
        mini.dug = true;
        if (mini.sel === mini.locket) {
          score += 300;
          healOne();
          sfx(660, 0.3, 'triangle', 0.07); sfx(990, 0.4, 'sine', 0.04);
        } else {
          mini.spiderT = 1;
          score += 50;
          sfx(220, 0.3, 'sawtooth', 0.05, -120);
        }
      }
    }
  } else {
    if (mini.spiderT > 0) mini.spiderT++;
    if (++mini.digP > 190) {
      mini.over = true; mini.won = mini.sel === mini.locket;
      mini.msg = mini.won ? 'A SILVER LOCKET   +300' : 'ONLY SPIDERS   +50';
    }
  }
}

function drawDig() {
  miniBackdropWoods('THE GRAVE DIG');
  for (let i = 0; i < 3; i++) {
    const x = 80 + i * 80;
    // headstone
    ctx.fillStyle = '#39424e'; ctx.fillRect(x - 6, 96, 20, 24);
    ctx.fillStyle = '#48505c'; ctx.fillRect(x - 4, 92, 16, 6);
    ctx.fillStyle = '#242a32'; ctx.fillRect(x - 1, 102, 10, 1);
    ctx.fillRect(x + 1, 106, 6, 1);
    // mound (dug down if chosen)
    const depth = (mini.phase !== 'pick' && i === mini.sel)
      ? Math.min(8, Math.round(mini.digP / 14)) : 0;
    ctx.fillStyle = '#2c2318';
    ctx.fillRect(x - 8, 126 + depth, 26, 12 - depth);
    if (mini.phase === 'reveal' && i === mini.sel) {
      if (mini.sel === mini.locket) {
        ctx.fillStyle = '#d9d0e8'; ctx.fillRect(x + 1, 122, 6, 6);
        ctx.fillStyle = '#8a80a0'; ctx.fillRect(x + 3, 120, 2, 2);
      } else if (mini.spiderT > 0) {
        ctx.drawImage(SPIDER_FRAMES[(mini.spiderT >> 3) % 2],
                      x - 2 + Math.min(70, mini.spiderT * 1.4), 122);
      }
    }
  }
  if (mini.phase === 'pick') {
    const ax = 80 + mini.sel * 80;
    ctx.fillStyle = '#e8c66a';
    ctx.fillRect(ax + 3, 82, 3, 5); ctx.fillRect(ax + 1, 80, 7, 3);
    pixelText('PICK A GRAVE: LEFT RIGHT  Z DIGS', 68, 148, '#9a8fb0');
  } else if (mini.phase === 'digging') {
    ctx.fillStyle = '#241c30'; ctx.fillRect(90, 56, 140, 8);
    ctx.fillStyle = '#9fe88f'; ctx.fillRect(91, 57, Math.round(mini.digP * 1.38), 6);
    ctx.fillStyle = '#3a3458';
    ctx.fillRect(90 + Math.round((mini.digT / 300) * 140), 52, 2, 16);
    pixelText('MASH Z BEFORE THE MARK RUNS OUT', 68, 148, '#9a8fb0');
  }
  ctx.drawImage(DOLL[creepStage()].idle, 40 + (mini.sel * 80), 128);
}

function miniBackdropWoods(title) {
  ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // moss hangs from the dark
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#16201a' : '#121a16';
    ctx.fillRect(i * 28 + 6, 0, 4, 18 + (i * 13) % 14);
  }
  // a lantern someone left
  ctx.fillStyle = '#3e2c22'; ctx.fillRect(300, 40, 8, 10);
  ctx.fillStyle = (frame >> 3) % 7 ? '#ffce6a' : '#e8a050';
  ctx.fillRect(302, 43, 4, 5);
  ctx.fillStyle = 'rgba(255,206,106,0.06)'; ctx.fillRect(284, 28, 40, 40);
  ctx.fillStyle = '#141820'; ctx.fillRect(0, 150, VIEW_W, 26);
  ctx.fillStyle = '#1c222c'; ctx.fillRect(0, 150, VIEW_W, 2);
  pixelText(title, (VIEW_W - title.length * 6) / 2 + 8, 34, '#bfe8ff');
}

/* --- the hollow: a bare little room behind the wall, and one lost eye --- */
function updateHollow() {
  if (kLeft())  mini.dollX = Math.max(24, mini.dollX - 1.4);
  if (kRight()) mini.dollX = Math.min(288, mini.dollX + 1.4);
  if (!mini.eyeTaken && Math.abs(mini.dollX + 7 - 160) < 10) {
    mini.eyeTaken = true;
    eyesFound++;
    score += 200;
    healOne();
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
        healOne();
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
  else if (mini.kind === 'tarot') drawTarot();
  else if (mini.kind === 'bell') drawBell();
  else if (mini.kind === 'crows') drawCrows();
  else if (mini.kind === 'dig') drawDig();
  else if (mini.kind === 'glyphs') drawGlyphs();
  else if (mini.kind === 'scarabs') drawScarabs();
  else if (mini.kind === 'spears') drawSpears();
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
  if (level === 1) {
    bigText('TAG. YOU\'RE IT.', 56, 42, '#e8c66a', 20);
    pixelText('but he twists free, and runs home,', 70, 74, '#cfc3e8');
    pixelText('and slams the door behind him.', 78, 86, '#cfc3e8');
    pixelText('she knows the way. she follows.', 74, 102, '#e8d8f0');
    if ((frame >> 5) % 2) pixelText('press ENTER — into the house', 90, 140, '#9a8fb0');
  } else if (level === 2) {
    bigText('THE HOUSE IS HERS.', 34, 42, '#e8c66a', 20);
    pixelText('but the boy ran laughing for the deep woods,', 40, 74, '#cfc3e8');
    pixelText('where the trees are tall and the dark is old.', 40, 86, '#cfc3e8');
    pixelText('she follows. she always follows.', 70, 102, '#e8d8f0');
    if ((frame >> 5) % 2) pixelText('press ENTER — into the trees', 92, 140, '#9a8fb0');
  } else if (level === 3) {
    bigText('THROUGH THE WALL.', 40, 42, '#e8c66a', 20);
    pixelText('his tracks run uphill, into the snow,', 56, 74, '#cfc3e8');
    pixelText('up where the air goes thin and quiet.', 54, 86, '#cfc3e8');
    pixelText('porcelain does not feel the cold.', 66, 102, '#e8d8f0');
    if ((frame >> 5) % 2) pixelText('press ENTER — up the mountain', 88, 140, '#9a8fb0');
  } else {
    bigText('THE MOUNTAIN IS QUIET.', 16, 42, '#e8c66a', 20);
    pixelText('the tunnel winds down and down and down,', 46, 74, '#cfc3e8');
    pixelText('into halls older than any of this.', 64, 86, '#cfc3e8');
    pixelText('she follows. she always follows.', 70, 102, '#e8d8f0');
    if ((frame >> 5) % 2) pixelText('press ENTER — into the tomb', 94, 140, '#9a8fb0');
  }
  pixelText('score ' + score, 136, 120, '#cfc3e8');
}

function drawWin() {
  ctx.fillStyle = 'rgba(4,2,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('AND STILL HE RUNS.', 34, 46, '#e8c66a', 20);
  pixelText('past the gold, past the dead, gone again.', 46, 76, '#cfc3e8');
  pixelText('she is patient. she is porcelain.', 66, 88, '#cfc3e8');
  pixelText('some friendships take forever.', 76, 100, '#e8d8f0');
  if (eyesFound >= EYES_TOTAL)
    pixelText('and with every eye found, she sees him clearly.', 22, 112, '#e8c66a');
  pixelText('score ' + score, 136, eyesFound >= EYES_TOTAL ? 126 : 116, '#cfc3e8');
  pixelText('thanks for playing', 118, 136, '#9a8fb0');
  if ((frame >> 5) % 2) pixelText('press ENTER', 126, 150, '#cfc3e8');
}

/* ---------------- main loop ---------------- */
function tick(now) {
  frame++;
  pollGamepad();
  const steps = lastTickT > 0 && now > 0 ? catchupSteps(now - lastTickT) : 1;
  if (now > 0) lastTickT = now;

  if (state === 'title') {
    drawTitle();
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'mini') {
    if (!paused) for (let s = 0; s < steps && state === 'mini'; s++) {
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
      for (let s = 0; s < steps && state === 'boss'; s++) {
        speedAcc += assist.speed;
        if (speedAcc >= 1) { speedAcc -= 1; updateBoss(); }
      }
      if (shakeT > 0 && --shakeT === 0) shakeMag = 0;
    }
    drawBoss();
    if (state === 'gameover') drawGameOver();
    if (state === 'win') drawWin();
    if (paused && state === 'boss') drawPauseOverlay();
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'play' && !paused)
  for (let s = 0; s < steps && state === 'play'; s++) {
    speedAcc += assist.speed;
    if (speedAcc < 1) continue;
    speedAcc -= 1;
    playTime++;
    // the night murmurs now and then
    if (AC && --ambientCd <= 0) {
      ambientCd = 480 + Math.random() * 600;
      playAmbient(creepStage());
    }
    // the mountain snows, always
    if (level === 4 && frame % 4 === 0)
      particles.push({ x: camX + Math.random() * VIEW_W, y: -4,
                       vx: -0.3 - Math.random() * 0.4, vy: 0.5 + Math.random() * 0.3,
                       t: 320, float: true, color: '#e8eef6' });
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
      updateSaucerDoor();
      updateKid();
    }
    updateEnemies();
    updateFireballs();
    updateShards();
    updateHeartPickup();
    updateEyePickups();
    updateParticles();
    camX = Math.max(0, Math.min(LEVEL_W - VIEW_W, player.x - 130));
  }

  const st = creepStage();
  if (!paused && shakeT > 0 && --shakeT === 0) shakeMag = 0;
  const [shX, shY] = shakeOffset();
  ctx.save();
  ctx.translate(shX, shY);
  if (level === 5) drawTombBackground(st);
  else if (level === 4) drawSnowBackground(st);
  else if (level === 3) drawWoodsBackground(st);
  else if (level === 2) drawHouseBackground(st);
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
  drawSaucerDoor();
  drawSaucer();
  drawPlayer();
  drawJets();
  drawFireballs();
  drawShards();
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
