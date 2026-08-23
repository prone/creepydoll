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
  onGround: false, face: -1, mode: 'idle',  // idle | flee | cornered
  animT: 0, alarmT: 0,
};

/* ---------------- level ---------------- */
// map[r][c]: 0 empty, 1 ground, 2 platform
let map = [];
const enemies = [];
let houseX = 0;

// a lone heart floating over the second ravine — heals one heart, once
const heartPickup = { x: 0, y: 0, taken: false, t: 0 };

function genLevel() {
  map = [];
  enemies.length = 0;
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
      const pr = rint(6, 7);
      for (let i = -1; i <= gap; i++)
        if (c + i >= 0 && c + i < MAP_W) map[pr][c + i] = 2;
    }
    c += gap;
  }

  // floating platforms with occasional spiders beneath
  for (let i = 0; i < 26; i++) {
    const pc = rint(14, MAP_W - 20), pr = rint(5, 7), len = rint(3, 5);
    let clear = true;
    for (let j = 0; j < len; j++)
      if (map[pr][pc + j] || map[pr + 1] && map[pr + 1][pc + j] === 2) clear = false;
    if (!clear) continue;
    for (let j = 0; j < len; j++) map[pr][pc + j] = 2;
    if (rng() < 0.35)
      enemies.push(makeSpider((pc + (len >> 1)) * TILE, (pr + 1) * TILE));
  }

  // hand-tweak: the spider platform at the first snake encounter sat one
  // tile too high (row 5, cols 56-58) — drop it to row 6 so it lines up
  // with the neighboring ledge, and lower its spider's anchor with it
  for (let j = 56; j <= 58; j++) {
    if (map[5][j] === 2) { map[5][j] = 0; map[6][j] = 2; }
  }
  for (const e of enemies)
    if (e.kind === 'spider' && e.x === 912 && e.anchorY === 96) e.anchorY = 112;

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

  houseX = (MAP_W - 6) * TILE;

  // the healthy kid waits near the dollhouse, unaware
  kid.x = houseX - 70;
  kid.y = 9 * TILE - kid.h - 1;
  kid.vx = 0; kid.vy = 0;
  kid.mode = 'idle'; kid.face = -1; kid.animT = 0; kid.alarmT = 0;
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
           homeY: y, vx: 0, vy: 0, dead: 0, lastHit: -1, face: 1 };
}
function makeSpider(x, anchorY) {
  return { kind: 'spider', x, y: anchorY, w: 10, h: 8, hp: 1,
           anchorY, len: rint(30, 70), t: rng() * 100, dead: 0, lastHit: -1 };
}
function makeSnake(x, segEnd) {
  return { kind: 'snake', x, y: 0, w: 20, h: 8, hp: 2, dir: 1,
           minX: x - TILE, maxX: (segEnd - 1) * TILE, t: rng() * 100,
           dead: 0, lastHit: -1, placed: false };
}

const player = {
  x: 40, y: 100, w: 10, h: 18, vx: 0, vy: 0,
  face: 1, onGround: false, hp: 5, invuln: 0,
  attack: null,        // {type:'punch'|'kick', t, id}
  attackId: 0,
  animT: 0, maxX: 0, safeX: 40, safeY: 100,
  twitch: 0,
};

const particles = [];
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++)
    particles.push({ x, y, vx: (Math.random() - .5) * 3,
                     vy: -Math.random() * 2.5, t: 20 + Math.random() * 15, color });
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

function musicBoxNote(midi, when, vol, detune) {
  const o = AC.createOscillator();
  o.type = 'triangle';
  o.frequency.value = midiHz(midi);
  if (detune) o.detune.value = detune;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
  o.connect(g); g.connect(masterGain);
  o.start(when); o.stop(when + 1);
}

function scheduleMusic() {
  while (nextNoteTime < AC.currentTime + 0.3) {
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

/* ---------------- input ---------------- */
const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  startAudio();
  if (AC && AC.state === 'suspended') AC.resume();
  keys[e.key.toLowerCase()] = true;
  handleMenuKeys(e.key);
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('pointerdown', () => { startAudio(); if (AC && AC.state === 'suspended') AC.resume(); });

const kLeft  = () => keys['arrowleft'] || keys['a'];
const kRight = () => keys['arrowright'] || keys['d'];
const kJump  = () => keys[' '] || keys['arrowup'] || keys['w'];
const kPunch = () => keys['z'] || keys['j'];
const kKick  = () => keys['x'] || keys['k'];

/* ---------------- game state ---------------- */
let state = 'title';    // title | play | gameover | win
let score = 0;
let camX = 0;
let frame = 0;
let flashText = null;   // {msg, t}
let jumpHeld = false, punchHeld = false, kickHeld = false;

const STAGE_MSGS = [
  null,
  'the paint begins to chip...',
  'her button eye is gone.',
  'something is very wrong.',
];

function creepStage() {
  return Math.min(3, Math.floor(player.maxX / (LEVEL_W / 4.2)));
}

function resetGame() {
  genLevel();
  player.x = 40; player.y = 100; player.vx = 0; player.vy = 0;
  player.hp = 5; player.invuln = 0; player.attack = null;
  player.face = 1; player.maxX = 0; player.safeX = 40; player.safeY = 100;
  score = 0; camX = 0; flashText = null;
  particles.length = 0;
}

function handleMenuKeys(key) {
  if (key !== 'Enter') return;
  if (state === 'title' || state === 'gameover' || state === 'win') {
    resetGame();
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

function hurtPlayer(fromX) {
  if (player.invuln > 0 || state !== 'play') return;
  player.hp--;
  player.invuln = 80;
  player.vy = -3.5;
  player.vx = player.x + player.w / 2 < fromX ? -2.5 : 2.5;
  sndHurt();
  burst(player.x + 5, player.y + 8, '#efe2cf', 8);
  if (player.hp <= 0) {
    state = 'gameover';
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
  const prevStage = creepStage();

  // walking (attacks root you briefly on the ground)
  const rooted = player.attack && player.onGround;
  if (!rooted) {
    if (kLeft())       { player.vx = -1.7; player.face = -1; }
    else if (kRight()) { player.vx = 1.7;  player.face = 1; }
    else player.vx *= player.onGround ? 0.6 : 0.95;
  } else player.vx *= 0.5;

  // jump
  if (kJump() && !jumpHeld && player.onGround) {
    player.vy = -6.9; sndJump();
  }
  jumpHeld = kJump();

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

  player.vy = Math.min(player.vy + 0.38, 7);
  moveAndCollide(player);

  if (player.onGround) { player.safeX = player.x; player.safeY = player.y - 2; }

  // fell into a pit
  if (player.y > MAP_H * TILE + 30) {
    player.hp--;
    sndHurt();
    if (player.hp <= 0) { state = 'gameover'; return; }
    player.x = player.safeX; player.y = player.safeY - 20;
    player.vx = 0; player.vy = 0; player.invuln = 90;
  }

  if (player.invuln > 0) player.invuln--;
  player.maxX = Math.max(player.maxX, player.x);
  player.animT += Math.abs(player.vx) > 0.3 ? 1 : 0;

  // creepiness advances
  const st = creepStage();
  if (st > prevStage && STAGE_MSGS[st]) {
    flashText = { msg: STAGE_MSGS[st], t: 150 };
    sndStage();
    burst(player.x + 5, player.y + 6, '#3b3b3b', 12);
  }
  // she twitches when she's far gone
  if (st >= 2 && Math.random() < 0.006 * st) player.twitch = 6;
  if (player.twitch > 0) player.twitch--;

}

function updateKid() {
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
    const aheadX = kid.face > 0 ? kid.x + kid.w + 4 : kid.x - 4;
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
    state = 'win';
    score += 1000;
    sndWin();
    burst(kid.x + 5, kid.y + 8, '#f0e040', 10);
  }
}

function updateEnemies() {
  const hb = attackHitbox();
  const pcx = player.x + player.w / 2;

  for (const e of enemies) {
    if (e.dead) { e.dead++; continue; }
    e.t++;

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
    }

    if (e.kind === 'snake') {
      if (!e.placed) {  // settle onto the ground once
        let r = 0;
        while (r < MAP_H && !solidAt(e.x + 10, r * TILE + TILE - 1)) r++;
        e.y = r * TILE - e.h;
        e.placed = true;
      }
      e.x += e.dir * 0.45;
      const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.x < e.minX || e.x > e.maxX || !solidAt(aheadX, e.y + e.h + 4))
        e.dir *= -1;
    }

    // the doll's fists and feet
    if (hb && e.lastHit !== hb.id && rectsOverlap(hb, e)) {
      e.lastHit = hb.id;
      e.hp -= hb.dmg;
      sndHitE();
      burst(e.x + e.w / 2, e.y + e.h / 2, '#ff3040', 6);
      if (e.hp <= 0) {
        e.dead = 1;
        score += e.kind === 'snake' ? 200 : 100;
        sfx(90, 0.25, 'triangle', 0.07, -40);
        // a bat's life feeds hers — one heart back, if she's hurt
        if (e.kind === 'bat' && player.hp < 5) {
          player.hp++;
          sndHeal();
          burst(player.x + 5, player.y + 6, '#e8506a', 8);
        }
      } else {
        e.x += player.face * 6;
      }
    }

    // touching the doll
    if (!e.dead && rectsOverlap(e, player)) hurtPlayer(e.x + e.w / 2);
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
    player.hp++;
    sndHeal();
    burst(heartPickup.x + 4, hy + 4, '#e8506a', 10);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.t--;
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
  // fog band
  ctx.fillStyle = 'rgba(60,50,90,0.25)';
  ctx.fillRect(0, 118, VIEW_W, 14);
}

function drawTiles() {
  const c0 = Math.max(0, Math.floor(camX / TILE));
  const c1 = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W) / TILE));
  for (let r = 0; r < MAP_H; r++) {
    for (let cc = c0; cc <= c1; cc++) {
      const t = map[r][cc];
      if (!t) continue;
      const x = cc * TILE - camX, y = r * TILE;
      if (t === 1) {
        const top = r === 0 || !map[r - 1][cc];
        ctx.fillStyle = '#3a3244';
        ctx.fillRect(x, y, TILE, TILE);
        if (top) {
          ctx.fillStyle = '#4b3f5c';
          ctx.fillRect(x, y, TILE, 4);
          ctx.fillStyle = '#5d4f72';
          for (let i = 0; i < 4; i++)
            if (tileNoise(cc * 4 + i, r) > 0.4) ctx.fillRect(x + i * 4 + 1, y, 2, 2);
        }
        // stones
        if (tileNoise(cc, r) > 0.6) {
          ctx.fillStyle = '#2e2738';
          ctx.fillRect(x + 3 + (cc % 3) * 3, y + 7 + (r % 2) * 3, 4, 3);
        }
      } else {
        // wooden platform
        ctx.fillStyle = '#4d3a2e';
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = '#6b5240';
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillStyle = '#33261e';
        ctx.fillRect(x + 7, y + 2, 1, 4);
      }
    }
  }
}

function drawHouse() {
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

function drawPlayer() {
  if (player.invuln > 0 && (frame >> 2) % 2) return;  // hit flicker
  const st = creepStage();
  const set = DOLL[st];
  let img;
  if (!player.onGround) img = set.jump;
  else if (Math.abs(player.vx) > 0.3) img = set.walk[(player.animT >> 4) % 2];
  else img = set.idle;

  const dx = Math.round(player.x - camX - 2);
  const dy = Math.round(player.y - 2) + (player.twitch > 3 ? 1 : 0);
  ctx.save();
  if (player.face < 0) {
    ctx.translate(dx + 14, dy); ctx.scale(-1, 1);
  } else {
    ctx.translate(dx, dy);
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

    if (e.kind === 'bat') {
      const img = BAT_FRAMES[(e.t >> 3) % 2];
      ctx.save();
      if (e.face < 0) { ctx.translate(x + 14, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
      else ctx.drawImage(img, x - 1, y);
      ctx.restore();
    } else if (e.kind === 'spider') {
      ctx.strokeStyle = '#8f8a9e';
      ctx.beginPath();
      ctx.moveTo(x + 5.5, e.anchorY);
      ctx.lineTo(x + 5.5, y + 2);
      ctx.stroke();
      ctx.drawImage(SPIDER_FRAMES[(e.t >> 4) % 2], x - 1, y - 1);
    } else if (e.kind === 'snake') {
      const img = SNAKE_FRAMES[(e.t >> 4) % 2];
      ctx.save();
      if (e.dir < 0) ctx.drawImage(img, x - 2, y);
      else { ctx.translate(x + 22, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); }
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

function drawHeart(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 3, 3); ctx.fillRect(x + 4, y, 3, 3);
  ctx.fillRect(x, y + 2, 7, 3); ctx.fillRect(x + 1, y + 5, 5, 1);
  ctx.fillRect(x + 2, y + 6, 3, 1); ctx.fillRect(x + 3, y + 7, 1, 1);
}

function drawHUD() {
  // hearts
  for (let i = 0; i < 5; i++)
    drawHeart(6 + i * 12, 6, i < player.hp ? '#c9304a' : '#3a2530');
  pixelText('SCORE ' + score, VIEW_W - 6 - (7 + String(score).length) * 6, 6, '#cfc3e8');
  const st = creepStage();
  pixelText('CREEP', 6, VIEW_H - 12, '#9a8fb0');
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i <= st ? ['#8878a8', '#a06888', '#b04858', '#d02838'][i] : '#241c30';
    ctx.fillRect(42 + i * 8, VIEW_H - 12, 6, 5);
  }

  if (flashText) {
    flashText.t--;
    if (flashText.t < 0) flashText = null;
    else if ((flashText.t >> 3) % 4 !== 0) {
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

  pixelText('arrows move   space jump', 82, 148, '#6a5f80');
  pixelText('z punch   x kick', 106, 158, '#6a5f80');
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(10,2,6,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('SHE BROKE', 92, 60, '#c9304a', 20);
  pixelText('score ' + score, 136, 92, '#cfc3e8');
  if ((frame >> 5) % 2) pixelText('press ENTER', 126, 112, '#9a8fb0');
}

function drawWin() {
  ctx.fillStyle = 'rgba(4,2,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  bigText('TAG. YOU\'RE IT.', 56, 56, '#e8c66a', 20);
  pixelText('she only ever wanted a friend.', 76, 86, '#cfc3e8');
  pixelText('score ' + score, 136, 102, '#cfc3e8');
  if ((frame >> 5) % 2) pixelText('press ENTER', 126, 122, '#9a8fb0');
}

/* ---------------- main loop ---------------- */
function tick() {
  frame++;

  if (state === 'title') {
    drawTitle();
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'play') {
    updatePlayer();
    if (state === 'play') updateKid();
    updateEnemies();
    updateHeartPickup();
    updateParticles();
    camX = Math.max(0, Math.min(LEVEL_W - VIEW_W, player.x - 130));
  }

  const st = creepStage();
  drawBackground(st);
  drawTiles();
  drawHouse();
  drawHeartPickup();
  drawKid();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawHUD();

  // vignette creeps in with her
  if (st > 0) {
    ctx.fillStyle = 'rgba(10,0,8,' + st * 0.06 + ')';
    ctx.fillRect(0, 0, VIEW_W, 10);
    ctx.fillRect(0, VIEW_H - 10, VIEW_W, 10);
    ctx.fillRect(0, 0, 10, VIEW_H);
    ctx.fillRect(VIEW_W - 10, 0, 10, VIEW_H);
  }

  if (state === 'gameover') drawGameOver();
  if (state === 'win') drawWin();

  requestAnimationFrame(tick);
}

genLevel();
requestAnimationFrame(tick);
