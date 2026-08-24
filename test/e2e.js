// Creepy Doll — end-to-end test suite (Playwright, real browser, real keys).
// Run: npm test   (after: npm install && npx playwright install chromium)
//
// The game exposes its top-level bindings (player, state, doors, dragon, ...)
// to page.evaluate through the shared script-level lexical scope, so the tests
// drive real keyboard input and read real game state.
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const GAME_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

let passed = 0, failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log('  ok: ' + msg); }
  else { failed++; console.log('  FAIL: ' + msg); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  const ev = fn => page.evaluate(fn);
  const frames = n => page.evaluate(async n => {
    for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r));
  }, n);
  // land the doll somewhere solid and settle for a few frames
  // the game polls keys once per frame — hold taps across a few frames
  const tap = async k => {
    await page.keyboard.down(k);
    await frames(3);
    await page.keyboard.up(k);
    await frames(2);
  };

  /* ---------- boot & title ---------- */
  section('boot');
  await page.goto(GAME_URL);
  await frames(5);
  check(await ev(() => state === 'title'), 'game boots to the title screen');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => state === 'play');
  check(true, 'Enter starts the game');
  check(await ev(() => AC !== null), 'audio engine started on first key');

  /* ---------- pacing ---------- */
  section('pacing');
  check(await ev(() => enemies.filter(e => e.x < LEVEL_W * 0.25)
        .every(e => e.kind === 'snake')),
        'the opening quarter teaches with snakes alone');
  check(await ev(() => doors.every(d =>
        enemies.every(e => e.x <= d.x - 64 || e.x >= d.x + 176))),
        'the ground near every doorway rests quiet');
  check(await ev(() =>
        enemies.filter(e => e.x > LEVEL_W * 0.55).length >
        enemies.filter(e => e.x < LEVEL_W * 0.45).length),
        'the back half crowds harder than the front');
  check(await ev(() => enemies.every(e => e.x < (MAP_W - 26) * TILE)),
        'a quiet breath before the dollhouse');
  check(await ev(() => {
    for (let r = 2; r < MAP_H - 2; r++)
      for (let c = 0; c < MAP_W; c++)
        if (map[r][c] === 2 && map[r + 2][c]) return false;
    return true;
  }), 'every platform leaves standing room beneath it');

  /* ---------- movement ---------- */
  section('movement');
  const x0 = await ev(() => player.x);
  await page.keyboard.down('ArrowRight');
  await frames(60);
  await page.keyboard.up('ArrowRight');
  check(await ev(() => player.x) > x0 + 60, 'doll runs right');
  await frames(10);
  const yBefore = await ev(() => player.y);
  await tap('Space');
  await frames(18);
  check(await ev(() => player.y) < yBefore - 10, 'doll jumps');
  await frames(90);

  /* ---------- crouch ---------- */
  section('crouch');
  await tap('c');
  check(await ev(() => player.crouch && player.h === 14), 'C crouches (smaller hitbox)');
  const cx = await ev(() => player.x);
  await page.keyboard.down('ArrowRight');
  await frames(30);
  await page.keyboard.up('ArrowRight');
  const crouchDist = (await ev(() => player.x)) - cx;
  check(crouchDist > 5 && crouchDist < 32, 'crouch walk is slow (' + Math.round(crouchDist) + 'px/30f)');
  await tap('Space');
  await frames(10);
  check(await ev(() => player.crouch && player.onGround), 'no jumping from a crouch');
  await tap('c');
  check(await ev(() => !player.crouch && player.h === 18), 'C again stands her up');

  /* ---------- power jump (hold Down, not crouch) ---------- */
  section('power jump');
  await page.keyboard.down('ArrowDown');
  await frames(125);
  check(await ev(() => player.chargeT >= 120 && !player.crouch),
        'holding Down 2s coils her without crouching');
  await page.keyboard.down('Space');
  await frames(2);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowDown');
  await frames(2);
  check(await ev(() => player.vy < -4), 'the coiled jump launches ~2x height');
  await frames(120);

  /* ---------- forgiving controls ---------- */
  section('forgiving controls');
  const apexOf = hold => page.evaluate(async hold => {
    player.x = 100; player.y = 126; player.vy = 0; player.vx = 0;
    for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
    const y0 = player.y;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    let apex = y0;
    for (let i = 0; i < 160; i++) {
      if (i === (hold ? 70 : 2))
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      await new Promise(r => requestAnimationFrame(r));
      apex = Math.min(apex, player.y);
      if (i > 8 && player.onGround) break;
    }
    return y0 - apex;
  }, hold);
  const tapH = await apexOf(false);
  const holdH = await apexOf(true);
  check(holdH > 45, 'held jump reaches full height (' + Math.round(holdH) + 'px)');
  check(tapH < holdH * 0.55, 'tapped jump is a short hop (' + Math.round(tapH) + 'px)');
  await ev(() => { player.x = 100; player.y = 112; player.vy = 3; player.vx = 0; });
  await page.keyboard.down('Space'); await frames(2); await page.keyboard.up('Space');
  await frames(10);
  check(await ev(() => player.vy < 0 || player.y < 124), 'jump pressed just before landing still fires (buffered)');
  await frames(60);

  /* ---------- combat ---------- */
  section('combat');
  await ev(() => { player.invuln = 999999; });
  const scoreBeforeSnake = await ev(() => score);
  for (let hit = 0; hit < 2; hit++) {
    await ev(() => {
      const s = window.__snake && !window.__snake.dead ? window.__snake
        : (window.__snake = enemies.find(e => e.kind === 'snake' && e.placed && !e.dead));
      if (s) { player.x = s.x - 12; player.y = s.y + s.h - player.h; player.vy = 0; player.face = 1; }
    });
    await tap('z');
    await frames(20);
  }
  check(await ev(() => __snake.dead > 0 || __snake.hp <= 0), 'two punches kill a snake');
  check((await ev(() => score)) - scoreBeforeSnake >= 200, 'snake kill scores 200');

  // spider web: three strikes snap the thread and kill the spider
  const webBefore = await ev(() => score);
  for (let hit = 0; hit < 3; hit++) {
    await ev(() => {
      const s = window.__spider && !window.__spider.dead ? window.__spider
        : (window.__spider = enemies.find(e => e.kind === 'spider' && e.anchorY === 0 && !e.dead));
      if (s) { s.y = 210; player.x = s.x - 14; player.y = 126; player.vy = 0; player.face = 1; }
    });
    await tap('z');
    await frames(18);
  }
  check(await ev(() => __spider.dead > 0 && __spider.webHp <= 0), 'three web strikes snap the thread');
  check((await ev(() => score)) - webBefore >= 200, 'web break scores 200');

  // bat kill heals when hurt
  await ev(() => { player.hp = 3; });
  await ev(() => {
    const b = enemies.find(e => e.kind === 'bat' && !e.dead);
    if (b) { player.x = b.x - 12; player.y = b.y - 3; player.vy = 0; player.face = 1; }
  });
  await tap('z');
  await frames(8);
  check(await ev(() => player.hp) === 4, 'defeating a bat heals one heart when hurt');

  /* ---------- juice: screen shake ---------- */
  section('screen shake');
  await ev(() => { shakeT = 0; shakeMag = 0; player.hp = 5; player.invuln = 0;
                   hurtPlayer(player.x + 20); });
  check(await ev(() => shakeT > 0 && shakeMag >= 3), 'getting hurt shakes the screen');
  await frames(40);
  check(await ev(() => shakeT === 0 && shakeMag === 0), 'the shake dies back down');
  await ev(() => { player.invuln = 999999; });

  /* ---------- juice: hit flash & directional sparks ---------- */
  section('hit feedback');
  const flashSeen = await page.evaluate(async () => {
    const s = enemies.find(e => e.kind === 'snake' && e.placed && !e.dead && e.hp > 1);
    if (!s) return 'no-snake';
    player.x = s.x - 12; player.y = s.y + s.h - player.h; player.vy = 0; player.face = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let seen = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 3) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      seen = Math.max(seen, s.flashT || 0);
    }
    return seen;
  });
  check(flashSeen !== 'no-snake' && flashSeen > 0,
        'a struck enemy flashes white (' + flashSeen + 'f)');
  check(await ev(() => whiten(BAT_FRAMES[0]).width === BAT_FRAMES[0].width),
        'white flash frames render at sprite size');
  await ev(() => { particles.length = 0; burst(0, 0, '#fff', 40, 2); });
  const meanVx = await ev(() =>
    particles.reduce((a, p) => a + p.vx, 0) / particles.length);
  check(meanVx > 1, 'impact sparks fly away from the blow (mean vx ' +
        meanVx.toFixed(2) + ')');
  await ev(() => { particles.length = 0; });

  /* ---------- juice: squash & stretch ---------- */
  section('squash & stretch');
  const landing = await page.evaluate(async () => {
    player.x = 100; player.y = 60; player.vy = 0; player.vx = 0;
    particles.length = 0;
    let sq = 0;
    for (let i = 0; i < 120; i++) {
      await new Promise(r => requestAnimationFrame(r));
      sq = Math.max(sq, player.squashT);
      if (i > 4 && player.onGround) break;
    }
    for (let i = 0; i < 4; i++) {
      await new Promise(r => requestAnimationFrame(r));
      sq = Math.max(sq, player.squashT);
    }
    return { sq, dust: particles.length };
  });
  check(landing.sq > 0, 'landing squashes her (' + landing.sq + 'f)');
  check(landing.dust >= 6, 'landing kicks up dust (' + landing.dust + ' motes)');
  const stretch = await page.evaluate(async () => {
    for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    let st = 0;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => requestAnimationFrame(r));
      st = Math.max(st, player.stretchT);
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    return st;
  });
  check(stretch > 0, 'jumping stretches her (' + stretch + 'f)');
  await frames(90);

  /* ---------- heart pickup ---------- */
  section('heart pickup');
  await ev(() => { player.hp = 5; player.x = heartPickup.x - 2; player.y = 90; player.vy = 0; });
  await frames(14);
  check(await ev(() => !heartPickup.taken && player.hp === 5), 'heart refuses a full-health doll');
  await ev(() => { player.hp = 2; player.x = heartPickup.x - 2; player.y = 90; player.vy = 0; });
  await frames(14);
  check(await ev(() => heartPickup.taken && player.hp === 3), 'heart heals exactly one heart when hurt');

  /* ---------- pause ---------- */
  section('pause');
  await page.keyboard.press('Escape');
  await frames(3);
  check(await ev(() => paused), 'Esc pauses the game');
  const frozen = await ev(() => ({ x: player.x, t: playTime }));
  await page.keyboard.down('ArrowRight');
  await frames(40);
  await page.keyboard.up('ArrowRight');
  check(await ev(() => player.x) === frozen.x && (await ev(() => playTime)) === frozen.t,
        'world is frozen while paused (held keys ignored)');
  await page.keyboard.press('Escape');
  await frames(10);
  check(await ev(() => !paused && playTime > 0), 'Esc again resumes');

  /* ---------- the cheat gate ---------- */
  section('cheat gate');
  await ev(() => { cheatsOn = false; cheatBuf = ''; assistSel = 0; Object.assign(assist,
    { invuln: false, speed: 1, hearts: false, calm: false, skipMini: false }); });
  await page.keyboard.press('Escape');
  await frames(3);
  check(await ev(() => paused && !cheatsOn), 'Esc shows the locked cheats screen');
  await page.keyboard.press('ArrowRight');
  await frames(2);
  check(await ev(() => !assist.invuln), 'locked: the options cannot be touched');
  await page.keyboard.type('duncan');
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => !cheatsOn && cheatMsgT > 0),
        'the password is case-sensitive — "duncan" is WRONG.');
  await page.keyboard.type('Duncan');
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => cheatsOn), '"Duncan" unlocks the cheats');

  /* ---------- assist mode ---------- */
  section('assist mode');
  await page.keyboard.press('ArrowRight');          // invincible ON
  await frames(2);
  check(await ev(() => assist.invuln), 'cheat menu: invincibility switches on');
  await page.keyboard.press('ArrowDown');           // down to game speed
  await page.keyboard.press('ArrowRight');          // 80%
  await page.keyboard.press('ArrowRight');          // 60%
  await frames(2);
  check(await ev(() => assist.speed === 0.6), 'game speed steps down to 60%');
  await page.keyboard.press('Escape');              // resume
  await frames(3);
  await ev(() => { player.invuln = 0; player.hp = 5; hurtPlayer(player.x + 20); });
  check(await ev(() => player.hp === 5), 'invincible: a hit costs nothing');
  const spd0 = await ev(() => playTime);
  await frames(40);
  const spdT = (await ev(() => playTime)) - spd0;
  check(spdT >= 18 && spdT <= 30, '60% speed: ~24 updates across 40 frames (' + spdT + ')');
  await ev(() => { assist.speed = 1; assist.invuln = false; assist.hearts = true;
                   player.invuln = 0; player.hp = 2; hurtPlayer(player.x + 20); });
  check(await ev(() => player.hp === 5), 'infinite hearts refuse to empty');
  await ev(() => { assist.calm = true; shakeT = 0; shakeMag = 0; addShake(4, 20); });
  check(await ev(() => shakeT === 0), 'reduced flash: no screen shake');
  check(await ev(() => {
    const s = JSON.parse(localStorage.getItem('creepydoll-assist'));
    return s.invuln === true && s.unlocked === true;
  }), 'cheat choices and the unlock persist in localStorage');
  await ev(() => { Object.assign(assist,
    { invuln: false, speed: 1, hearts: false, calm: false, skipMini: false });
    player.hp = 5; player.invuln = 0; });

  /* ---------- level warp ---------- */
  section('level warp');
  await page.keyboard.press('Escape');
  await frames(3);
  await ev(() => { assistSel = 5; warpLevel = 1; });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await frames(2);
  check(await ev(() => warpLevel === 3), 'the warp row dials to level 3');
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => level === 3 && state === 'play' && !paused && player.x === 40),
        'Enter warps to a fresh level 3');
  await page.keyboard.press('Escape');
  await frames(3);
  await ev(() => { assistSel = 5; warpLevel = 1; });
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => level === 1 && state === 'play' && !paused && score === 0),
        'and back to the road, fresh, for the rest of the run');

  /* ---------- summon-a-ride cheat ---------- */
  section('ride cheat');
  await page.keyboard.press('Escape');
  await frames(3);
  await ev(() => { assistSel = 6; rideChoice = 'dragon'; });
  await page.keyboard.press('ArrowRight');
  await frames(2);
  check(await ev(() => rideChoice === 'saucer'), 'the ride row flips dragon to saucer');
  await page.keyboard.press('ArrowRight');
  await frames(2);
  check(await ev(() => rideChoice === 'dragon'), 'and back again');
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => !paused && dragon.active && dragon.ridden),
        'Enter drops her straight onto dragonback');
  await ev(() => { const c = { key: 'c' };
                   window.dispatchEvent(new KeyboardEvent('keydown', c)); });
  await frames(3);
  await ev(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'c' })));
  await frames(3);
  check(await ev(() => !dragon.ridden), 'C hops off the summoned dragon');
  await page.keyboard.press('Escape');
  await frames(3);
  await ev(() => { assistSel = 6; rideChoice = 'saucer'; player.hp = 5; });
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => !paused && saucer.active && player.hp === 10),
        'summoning the saucer beams her aboard, hearts and all');
  await tap('c');
  await frames(5);
  check(await ev(() => !saucer.active && player.hp <= 5),
        'and C bails her back out');
  await ev(() => { dragon.spawned = dragon.active = dragon.ridden = false;
                   saucer.doorCd = 1800; player.invuln = 999999;
                   flashText = null; });

  /* ---------- creep resets when every heart is lost ---------- */
  section('creep reset');
  await ev(() => { level = 2; resetGame(); state = 'play'; });
  await frames(3);
  check(await ev(() => creepStage() === 3),
        'entering the house the story way, she is still very wrong');
  await ev(() => { assist.invuln = false; assist.hearts = false;
                   player.invuln = 0; player.hp = 1;
                   hurtPlayer(player.x - 10); });
  await frames(3);
  check(await ev(() => state === 'gameover'), 'her last heart goes to the dog\'s house');
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => state === 'play' && level === 2 && player.hp === 5 &&
                       creepStage() === 0 && !inkMelt),
        'the retry starts her porcelain-clean — creep and ink wiped');
  await ev(() => { player.maxX = LEVEL_W; });
  await frames(2);
  check(await ev(() => creepStage() === 3),
        'and she earns the cracks all over again as she advances');
  // a plain (non-retry) entry into a later level still locks stage 3
  await ev(() => { level = 3; resetGame(); state = 'play'; });
  await frames(3);
  check(await ev(() => creepStage() === 3 && inkMelt),
        'a fresh story entry into the woods keeps her very wrong and melted');
  await ev(() => { level = 1; resetGame(); state = 'play';
                   player.invuln = 999999; });
  await frames(3);

  /* ---------- frame pacing & the speed cheat ---------- */
  section('frame pacing');
  check(await ev(() => catchupSteps(8) === 1 && catchupSteps(17) === 1 &&
                       catchupSteps(33) === 2 && catchupSteps(50) === 3 &&
                       catchupSteps(5000) === 3),
        'throttled browser frames get capped catch-up steps, never slow-motion');
  await ev(() => { assist.speed = 0.8; state = 'title'; });
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && flashText &&
                       /game speed 80/.test(flashText.msg)),
        'a stored slow-speed cheat announces itself on the way in');
  await ev(() => { assist.speed = 1; flashText = null;
                   player.invuln = 999999; });

  /* ---------- checkpoints & pit respawn ---------- */
  section('checkpoints');
  check(await ev(() => checkpoints.length >= 4),
        'lanterns dot the level (' + (await ev(() => checkpoints.length)) + ')');
  check(await ev(() => checkpoints.every(cp => map[9][Math.floor(cp.x / TILE)] === 1)),
        'every lantern stands on solid ground');
  await ev(() => { player.invuln = 999999;
                   player.x = checkpoints[0].x + 10; player.y = 126; player.vy = 0; });
  await frames(4);
  check(await ev(() => checkpoints.some(cp => cp.reached)),
        'lanterns she passed are lit');

  /* ---------- one-way platforms ---------- */
  section('one-way platforms');
  const passUnder = await page.evaluate(async () => {
    // a floating platform with clear ground beneath it
    let col = -1, prow = -1;
    for (let c = 20; c < MAP_W - 20 && col < 0; c++)
      for (let r = 6; r <= 7; r++)
        if (map[r][c] === 2 && !map[r + 1][c] && !map[r + 2][c] &&
            groundTopRowAt(c) === 9) { col = c; prow = r; break; }
    if (col < 0) return 'no-spot';
    // walk under it: platforms must not block sideways
    player.x = (col - 3) * TILE; player.y = 126; player.vy = 0; player.vx = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    for (let i = 0; i < 80; i++) await new Promise(r => requestAnimationFrame(r));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    const walked = player.x > (col + 1) * TILE;
    // jump up through it from below and land on top
    player.x = col * TILE + 2; player.y = 126; player.vy = 0; player.vx = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    let landed = false;
    for (let i = 0; i < 100; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 30) window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      player.x = col * TILE + 2;
      if (player.onGround && Math.abs((player.y + player.h) - prow * TILE) < 2) {
        landed = true; break;
      }
    }
    return { walked, landed, prow };
  });
  check(passUnder !== 'no-spot' && passUnder.walked,
        'she walks freely beneath a platform');
  check(passUnder !== 'no-spot' && passUnder.landed,
        'and jumps up through it to land on top');

  /* ---------- alien invasion ---------- */
  section('alien invasion');
  await ev(() => { player.invuln = 999999; player.hp = 5;
                   player.x = 300; player.y = 100; player.vy = 0;
                   saucer.doorCd = 1; });
  await frames(6);
  check(await ev(() => saucer.doorT > 0 && saucer.doorX > 0),
        'a door that should not be there appears');
  await ev(() => { saucer.doorT = 2; });
  await frames(6);
  check(await ev(() => saucer.doorT === 0 && saucer.doorX < 0 && !saucer.active),
        'three seconds pass, and it is gone');
  await ev(() => { saucer.doorCd = 1; });
  await frames(6);
  await ev(() => { player.x = saucer.doorX + 2; player.y = saucer.doorGy - 20;
                   player.vy = 0; });
  await frames(6);
  check(await ev(() => saucer.active && player.hp === 10),
        'the saucer takes her — five borrowed hearts');
  check(await ev(() => saucer.jetCount >= 2 && saucer.jetCount <= 5),
        'a squadron of two to five jets scrambles');
  await frames(20);
  check(await ev(() => jets.filter(j => !j.dead).length === saucer.jetCount),
        'and they arrive');
  const missileSeen = await page.evaluate(async () => {
    jets.forEach(j => { j.fireCd = 2; });
    for (let i = 0; i < 60; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (missiles.length) return true;
    }
    return false;
  });
  check(missileSeen, 'they fire, inaccurately');
  const jetKill = await page.evaluate(async () => {
    const j = jets.find(j => !j.dead);
    if (!j) return 'no-jet';
    const s0 = score;
    saucer.face = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    for (let i = 0; i < 40; i++) {
      j.x = saucer.x + 60; j.y = saucer.y + 6; j.vx = 0; j.fireCd = 999;
      await new Promise(r => requestAnimationFrame(r));
      if (i === 4) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      if (j.dead) break;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    return score - s0;
  });
  check(jetKill === 300, 'a laser beam downs a jet (+300)');
  await ev(() => { player.invuln = 0;
                   missiles.push({ x: saucer.x + 4, y: saucer.y + 4,
                                   vx: 0, vy: 0, t: 0 }); });
  await frames(4);
  check(await ev(() => player.hp === 9), 'a missile that finds her costs a heart');
  await ev(() => { player.invuln = 999999; });
  // the end of the line
  await ev(() => { saucer.x = houseX - 250; });
  await frames(4);
  check(await ev(() => saucer.smokeT > 0), 'the saucer smokes at the end of the level');
  await tap('c');
  await frames(6);
  check(await ev(() => !saucer.active && player.hp <= 5),
        'she ejects in time; the borrowed hearts go home');
  await ev(() => { player.hp = 5; enterSaucer(); saucer.x = houseX - 250;
                   saucer.smokeT = 8; player.invuln = 0; });
  await frames(30);
  check(await ev(() => !saucer.active && player.hp === 4),
        'staying aboard the explosion costs one heart');
  await ev(() => { player.hp = 5; player.invuln = 999999;
                   saucer.doorCd = 1800; flashText = null; });

  /* ---------- porcelain shards ---------- */
  section('porcelain shards');
  await ev(() => { player.x = 300; player.y = 126; player.vy = 0;
                   player.maxX = 200; player.attack = null; shards.length = 0; });
  await tap('x');
  await frames(4);
  check(await ev(() => shards.length === 0),
        'no shards before full creep — kicks are just kicks');
  const shardKill = await page.evaluate(async () => {
    player.maxX = LEVEL_W;                       // full creep
    const b = enemies.find(e => e.kind === 'bat' && !e.dead);
    if (!b) return 'no-bat';
    player.x = b.x - 60; player.y = b.y - 4; player.vy = 0; player.face = 1;
    player.attack = null; shards.length = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    let threw = false, hp0 = b.hp;
    for (let i = 0; i < 60; i++) {
      // keep the bat in the shard's flight line (she may be falling)
      if (shards.length) { b.x = shards[0].x - 4; b.y = shards[0].y - 2; }
      else { b.x = player.x + 60; b.y = player.y + 8; }
      b.vx = 0; b.vy = 0;
      await new Promise(r => requestAnimationFrame(r));
      if (i === 3) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
      if (shards.length) threw = true;
      if (b.dead || b.hp < hp0) {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
        return { threw, hit: true };
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
    return { threw, hit: false };
  });
  check(shardKill !== 'no-bat' && shardKill.threw && shardKill.hit,
        'at full creep a kick throws porcelain, and it lands');
  await ev(() => { player.maxX = 200; shards.length = 0; player.invuln = 999999; });

  section('pit');
  await ev(() => { player.invuln = 0; player.hp = 3; player.x = 670; player.y = 126; player.vy = 0; });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => player.respawnT > 0 || state === 'gameover',
                             null, { timeout: 15000 });
  await page.keyboard.up('ArrowRight');
  check(await ev(() => state === 'play'), 'a pit fall no longer ends the run');
  check(await ev(() => player.hp === 2), 'the dark takes one heart');
  await page.waitForFunction(() => player.respawnT === 0, null, { timeout: 5000 });
  check(await ev(() => {
    const lit = checkpoints.filter(cp => cp.reached);
    const cp = lit[lit.length - 1];
    return cp && Math.abs(player.x - cp.x) < 20 && player.y < 176;
  }), 'she returns at the last lit lantern');
  check(await ev(() => player.invuln > 0), 'grace frames cover the way back');
  // her last heart is still her last heart
  await ev(() => { player.hp = 1; player.y = 400; player.vy = 3; });
  await page.waitForFunction(() => state === 'gameover', null, { timeout: 5000 });
  check(true, 'a pit fall on her last heart still breaks her');
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && player.hp === 5 && player.x === 40 &&
        checkpoints.every(cp => !cp.reached)),
        'Enter restarts a fresh run with unlit lanterns');
  check(await ev(() => !inkMelt), 'a fresh doll starts un-melted');
  await ev(() => { player.invuln = 999999;
                   player.x = checkpoints[1].x + 8; player.y = 126; player.vy = 0; });
  await frames(4);
  check(await ev(() => !inkMelt), 'outdoor lanterns never melt her');

  /* ---------- lost button eyes ---------- */
  section('button eyes');
  check(await ev(() => eyePickups.length === 4 && eyesFound === 0),
        'four eyes hidden in the overworld, none found on a fresh run');
  check(await ev(() => eyePickups.some(ep => ep.y < 40)),
        'one eye hangs impossibly high (power jump or dragonback)');
  await ev(() => { player.invuln = 999999;
                   const ep = eyePickups[0];
                   player.x = ep.x - 2; player.y = ep.y - 4; player.vy = 0; });
  await frames(8);
  check(await ev(() => eyePickups[0].taken && eyesFound === 1),
        'touching a lost eye collects it (1/4)');
  // the fourth eye's message holds steady for two seconds
  await ev(() => { eyesFound = 3; const ep = eyePickups[1];
                   player.x = ep.x - 2; player.y = ep.y - 4; player.vy = 0; });
  await frames(8);
  check(await ev(() => eyePickups[1].taken && flashText &&
        flashText.msg === 'all her eyes... she sees.' &&
        flashText.hold === true && flashText.t > 100),
        'the all-eyes message holds steady for two seconds');
  await ev(() => { eyesFound = 1; eyePickups[1].taken = false; flashText = null; });

  /* ---------- carnival doors & minigames ---------- */
  section('carnival doors');
  check(await ev(() => doors.length === 4 &&
        doors.map(d => d.kind).join() === 'toss,balloon,coffin,hollow'),
        'three carnival doors and one secret crack: the hollow');

  // walk in through the real doorway with a real Up press
  await ev(() => { player.invuln = 999999; player.x = doors[0].x + 2; player.y = 126; player.vy = 0; });
  await frames(4);
  await tap('ArrowUp');
  check(await ev(() => state === 'mini' && mini && mini.kind === 'toss'),
        'Up at a door enters the doll toss world');

  // toss all three rag dolls: lock the meter, then confirm (golf style)
  for (let i = 0; i < 3; i++) {
    await tap('z');                      // lock power
    check(await ev(() => mini.aimPhase === 'locked'), 'Z locks the power meter (throw ' + (i + 1) + ')');
    await tap('z');                      // confirm throw
    await frames(130);
  }
  await page.waitForFunction(() => mini === null || mini.over, null, { timeout: 10000 });
  check(await ev(() => mini.over), 'doll toss finishes after three throws');
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && doors[0].used), 'Enter returns; the door is spent');

  // balloon world: pop one, the blood message appears
  await ev(() => startMini(doors[1]));
  await frames(3);
  check(await ev(() => state === 'mini' && mini.kind === 'balloon'), 'balloon world opens');
  // aim straight at a balloon each throw
  for (let d = 0; d < 5; d++) {
    await ev(() => {
      const b = mini.balloons.find(b => b.alive);
      if (b) mini.aimY = b.y0;
    });
    await tap('z');
    await frames(100);
    if (await ev(() => mini.pops >= 3)) break;
  }
  check(await ev(() => mini.pops >= 1), 'darts pop balloons');
  check(await ev(() => mini.drips.length >= 3 && mini.splats.length >= 1),
        'popped balloons bleed (splats and drips)');
  check(await ev(() => mini.msg2 === 'IT WAS... BLOOD.'), 'the blood reveal message shows');
  await page.waitForFunction(() => mini.over || mini.darts > 0, null, { timeout: 12000 });
  await ev(() => { mini.darts = 0; mini.dart = null; });        // spend the rest
  await page.waitForFunction(() => mini.over, null, { timeout: 10000 });
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play'), 'balloon world exits cleanly');

  // coffin shuffle: follow the heart (we peek at the slots, a test may cheat)
  await ev(() => { player.hp = 3; startMini(doors[2]); });
  await frames(3);
  check(await ev(() => state === 'mini' && mini.kind === 'coffin'), 'coffin world opens');
  await page.waitForFunction(() => mini.phase === 'pick', null, { timeout: 15000 });
  const heartSlot = await ev(() => mini.slots[mini.heartCoffin]);
  for (let i = 0; i < 2; i++) await tap('ArrowLeft');
  for (let i = 0; i < heartSlot; i++) await tap('ArrowRight');
  await tap('z');
  await page.waitForFunction(() => mini.over, null, { timeout: 10000 });
  check(await ev(() => mini.won), 'picking the right coffin wins');
  check(await ev(() => player.hp === 4), 'the coffin heart heals her');
  await page.keyboard.press('Enter');
  await frames(3);

  // the hollow: a crack in the wall, a bare room, one lost eye
  await ev(() => { player.hp = 3; startMini(doors[3]); });
  await frames(3);
  check(await ev(() => state === 'mini' && mini.kind === 'hollow'),
        'the crack opens into the hollow');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => mini.eyeTaken, null, { timeout: 10000 });
  await page.keyboard.up('ArrowRight');
  check(await ev(() => eyesFound === 2 && player.hp === 4),
        'she takes the hollow\'s eye and it heals her (2/4)');
  await page.waitForFunction(() => mini.over, null, { timeout: 10000 });
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && doors[3].used), 'the hollow seals behind her');

  // assist: skip-minigames walks straight out
  await ev(() => { assist.skipMini = true; startMini(doors[0]); });
  await frames(3);
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && mini === null),
        'assist: Enter skips a minigame outright');
  await ev(() => { assist.skipMini = false; });

  /* ---------- minigame music ---------- */
  section('music');
  check(await ev(() => typeof CARNIVAL !== 'undefined' && CARNIVAL.length > 0 &&
        LULLABY.length > 0), 'two tunes exist: lullaby outside, carnival waltz inside');

  /* ---------- the dragon ---------- */
  section('dragon');
  check(await ev(() => !dragon.active), 'no dragon before one minute');
  await ev(() => { playTime = 3700; });
  await frames(4);
  check(await ev(() => dragon.active), 'the eyeless dragon arrives after a minute');
  // mount: fall onto its back
  await ev(() => { player.invuln = 999999; player.y = dragon.y - 40; player.vy = 0; });
  for (let i = 0; i < 30 && !(await ev(() => dragon.ridden)); i++) {
    await ev(() => { player.x = dragon.x + 10; });
    await frames(6);
  }
  check(await ev(() => dragon.ridden), 'the doll mounts and rides the dragon');
  // kick spits a flame ball that kills a bat
  await ev(() => {
    const b = enemies.find(e => e.kind === 'bat' && !e.dead);
    if (b) { dragon.x = b.x - 70; dragon.y = Math.max(10, Math.min(130, b.y)); dragon.face = 1; dragon.ballCd = 0; }
  });
  await tap('x');
  check(await ev(() => fireballs.length > 0), 'kick launches a flame ball');
  await frames(90);
  // punch breathes a gust at a snake
  // position and punch inside one evaluate — the dragon's idle bob drifts
  // it vertically if real frames pass between the two
  const gustHit = await page.evaluate(async () => {
    // a GROUND snake: at that height the air beside it is guaranteed clear,
    // while platform snakes can have neighboring tiles that shove the dragon
    const s = enemies.find(e => e.kind === 'snake' && e.placed && !e.dead && e.y > 120);
    if (!s) return 'no-snake';
    const hp0 = s.hp;
    dragon.x = s.x - dragon.w - 12;
    dragon.y = Math.max(10, Math.min(132, s.y - 6));   // level with the snake
    dragon.face = 1; dragon.gustCd = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    return s.dead > 0 || s.hp < hp0 ? 'hit' : 'miss';
  });
  check(gustHit === 'no-snake' || gustHit === 'hit', 'punch breathes a flame gust');
  // valkyries hunt while she rides
  await ev(() => { dragon.valkT = 1000; });
  await frames(8);
  check(await ev(() => enemies.some(e => e.kind === 'valkyrie' && !e.dead)),
        'valkyries climb after the rider');
  await tap('c');
  check(await ev(() => !dragon.ridden), 'C hops off the dragon');
  await frames(40);
  check(await ev(() => enemies.every(e => e.kind !== 'valkyrie' || e.dead || e.vy < 0)),
        'valkyries withdraw when she dismounts');

  /* ---------- atmosphere ---------- */
  section('atmosphere');
  check(await ev(() => AMBIENTS.length >= 4 &&
        AMBIENTS.some(a => a.minStage >= 2)),
        'the night has ambient voices, one reserved for the far-gone');
  await ev(() => { ambientCd = 1; });
  await frames(4);
  check(await ev(() => ambientCd > 100), 'the ambient scheduler reschedules itself');
  await ev(() => { particles.length = 0; player.maxX = LEVEL_W; });
  await frames(40);
  check(await ev(() => particles.some(p => p.float)),
        'ash sifts down once the decay is deep');
  const glimpseLine = await page.evaluate(async () => {
    player.x = 1000; player.y = 100; player.vy = 0; player.maxX = 1000;
    kid.stage = 'roam'; kid.mode = 'hidden'; kid.hideT = 1;
    kid.x = -1000; kid.glimpses = 1;
    for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
    return { line: flashText && flashText.msg, n: kid.glimpses };
  });
  check(glimpseLine.line === 'wait. come see her.' && glimpseLine.n === 2,
        'each glimpse of the kid gets its own line');

  /* ---------- the chase & the win ---------- */
  section('the win');
  await ev(() => { dragon.ridden = false; player.invuln = 999999; });
  // roaming kid: glimpsed ahead, untouchable until the finale
  await ev(() => {
    player.x = 1000; player.y = 100; player.vy = 0; player.maxX = 1000;
    kid.stage = 'roam'; kid.mode = 'hidden'; kid.hideT = 1; kid.x = -1000;
  });
  await frames(5);
  check(await ev(() => kid.mode !== 'hidden' && kid.x > player.x),
        'the kid appears ahead during the level');
  await frames(10);
  check(await ev(() => kid.mode === 'sprint' && kid.vx > 1.7),
        'and he is always running — faster than she can');
  await ev(() => { player.x = kid.x; player.y = kid.y; });
  await frames(3);
  check(await ev(() => state === 'play'), 'the kid cannot be tagged while roaming');
  // cross into the finale
  await ev(() => { player.x = houseX - 250; player.y = 100; player.vy = 0; player.maxX = houseX - 250; });
  await frames(4);
  check(await ev(() => kid.stage === 'final'), 'the kid waits at the dollhouse for the finale');
  await ev(() => { player.x = kid.x - 80; player.y = 100; player.vy = 0; });
  await frames(30);
  check(await ev(() => kid.mode !== 'idle'), 'the kid is spooked and flees');
  // scoop up the remaining eyes so the 100% reward can show itself
  await ev(() => { eyePickups.forEach(ep => {
    if (!ep.taken) { ep.taken = true; eyesFound++; } }); });
  check(await ev(() => eyesFound >= EYES_TOTAL), 'enough eyes accounted for (4 needed)');
  const preWin = await ev(() => score);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => state === 'interlude', null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  check(true, 'tagging the kid ends level 1 — but he slips away');
  check((await ev(() => score)) >= preWin + 2000,
        'finding every eye doubles the level-1 bonus');

  /* ---------- level 2: the house ---------- */
  section('level 2');
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => level === 2 && state === 'play' && player.x === 40),
        'she follows him home — level 2 begins');
  check((await ev(() => score)) >= preWin + 2000, 'the score follows her inside');
  check(await ev(() => map[0].every(t => t === 1)), 'the house has a ceiling');
  check(await ev(() => creepStage() === 3 && !inkMelt),
        'she arrives already far gone — something is very wrong');
  check(await ev(() => tables.length >= 3 && tables[0] <= 26 * TILE),
        'tables to jump, the first just past the start');
  check(await ev(() => doors.length === 0 && eyePickups.length === 0),
        'no carnival doors and no eye hunt indoors');
  check(await ev(() => checkpoints.length >= 4), 'candles mark the way');
  check(await ev(() => {
    for (let r = 2; r < MAP_H - 2; r++)
      for (let c = 0; c < MAP_W; c++)
        if (map[r][c] === 2 && map[r + 2][c]) return false;
    return true;
  }), 'every shelf leaves standing room beneath it');
  // the house's second candle takes half of her
  await ev(() => { player.invuln = 999999;
                   player.x = checkpoints[1].x + 8; player.y = 126; player.vy = 0; });
  await frames(4);
  check(await ev(() => inkMelt && flashText && flashText.msg === 'she is annoyed.' &&
        flashText.hold === true),
        'the second candle melts half of her to ink — she is annoyed');
  await ev(() => { playTime = 4000; });
  await frames(4);
  check(await ev(() => !dragon.active), 'a minute passes; no wings in the house');
  // the first table stops a walk and yields to a jump
  await ev(() => { player.invuln = 999999;
                   player.x = tables[0] - 40; player.y = 126; player.vy = 0; });
  await page.keyboard.down('ArrowRight');
  await frames(45);
  check(await ev(() => player.x < tables[0] - 8), 'the table stops her on foot');
  for (let i = 0; i < 3 && !(await ev(() => player.x > tables[0] + 50)); i++) {
    await page.keyboard.down('Space');
    await frames(20);
    await page.keyboard.up('Space');
    await frames(30);
  }
  await page.keyboard.up('ArrowRight');
  check(await ev(() => player.x > tables[0] + 40), 'a jump carries her over it');

  /* ---------- the dog ---------- */
  section('the dog');
  check(await ev(() => dog.active), 'clearing the first table wakes the dog');
  const dgap0 = await ev(() => Math.abs(player.x - dog.x));
  await frames(50);
  const dgap1 = await ev(() => Math.abs(player.x - dog.x));
  check(dgap1 < dgap0, 'it closes the distance (' +
        Math.round(dgap0) + 'px to ' + Math.round(dgap1) + 'px)');
  await ev(() => { player.invuln = 0; player.hp = 5; dog.retreatT = 0;
                   dog.x = player.x - 4; dog.y = player.y; dog.vy = 0; });
  await frames(4);
  check(await ev(() => player.hp === 4), 'its teeth cost a heart');
  check(await ev(() => dog.deadT > 0 && dog.fleeT > 0),
        'one bite and it trots off satisfied — gone for ten seconds');
  await ev(() => { dog.deadT = 0; dog.fleeT = 0; dog.hp = 3; });
  await ev(() => { player.invuln = 999999; player.vx = 0;
                   dog.x = player.x + 12; dog.y = player.y + 6;
                   dog.vy = 0; dog.retreatT = 0; player.face = 1; });
  await tap('z');
  await frames(6);
  check(await ev(() => dog.active && (dog.retreatT > 0 || dog.x > player.x + 20)),
        'a punch backs it off');
  // three hits put it down for ten seconds — position and punch atomically
  const dogDown = await page.evaluate(async () => {
    dog.hp = 3; dog.deadT = 0; dog.fleeT = 0; dog.retreatT = 0;
    let hits = 0;
    for (let h = 0; h < 3; h++) {
      dog.x = player.x + 12; dog.y = player.y + 6;
      dog.vx = 0; dog.vy = 0; dog.retreatT = 0;
      player.attack = null; player.face = 1; player.vx = 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 20; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (i === 5) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        if (dog.deadT > 0) return { hits: hits + 1, deadT: dog.deadT };
        if (dog.hp <= 2 - h) {
          hits++;
          // release and let punchHeld clear, or the next press won't register
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
          for (let j = 0; j < 3; j++) await new Promise(r => requestAnimationFrame(r));
          break;
        }
      }
    }
    return { hits, deadT: dog.deadT };
  });
  check(dogDown.hits === 3 && dogDown.deadT > 500,
        'the third hit makes it bark and bolt (' + dogDown.deadT + 'f until it dares again)');
  check(await ev(() => dog.fleeT > 0 &&
        Math.sign(dog.vx) === Math.sign(dog.x - player.x)),
        'it runs away from her, visibly, barking');
  const fled0 = await ev(() => Math.abs(dog.x - player.x));
  await frames(40);
  check((await ev(() => Math.abs(dog.x - player.x))) > fled0,
        'and it keeps going');
  await ev(() => { dog.deadT = 20; dog.fleeT = 0; });   // fast-forward the ten seconds
  await frames(30);
  check(await ev(() => dog.deadT === 0 && dog.hp === 3 && dog.active),
        'ten seconds later, the dog is back');

  /* ---------- the infestation ---------- */
  section('infestation');
  check(await ev(() => ['ant', 'roach', 'rat'].every(k =>
        enemies.some(e => e.kind === k))),
        'ants, cockroaches, and rats live in the walls');
  check(await ev(() => enemies.some(e => e.kind === 'spider')),
        'spiders hang from the ceiling');
  check(await ev(() => enemies.filter(e => e.x < LEVEL_W * 0.15)
        .every(e => e.kind === 'ant' || e.kind === 'spider')),
        'the front hall only whispers — ants before anything worse');
  // one kick flattens an ant — position and kick atomically, ants are small
  const antKill = await page.evaluate(async () => {
    const a = enemies.find(e => e.kind === 'ant' && e.placed && !e.dead && e.y > 130);
    if (!a) return 'no-ant';
    a.dir = -1;
    player.x = a.x - 14; player.y = a.y + a.h - player.h;
    player.vy = 0; player.face = 1;
    player.attack = null;             // a leftover swing would block the new kick
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    for (let i = 0; i < 20; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 6) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
      if (a.dead > 0 || a.hp <= 0) return 'dead';
    }
    return 'alive';
  });
  check(antKill === 'dead', 'one kick ends an ant');
  // a rat takes two punches
  const ratScore0 = await ev(() => score);
  for (let hit = 0; hit < 2; hit++) {
    await ev(() => {
      const r = window.__rat && !window.__rat.dead ? window.__rat
        : (window.__rat = enemies.find(e =>
            e.kind === 'rat' && e.placed && !e.dead && e.y > 130));
      if (r) { r.dashT = 0; r.lungeCd = 999;
               player.x = r.x - 12; player.y = r.y + r.h - player.h;
               player.vy = 0; player.face = 1; }
    });
    await tap('z');
    await frames(20);
  }
  check(await ev(() => __rat && (__rat.dead > 0 || __rat.hp <= 0)), 'two punches down a rat');
  check((await ev(() => score)) - ratScore0 >= 150, 'a rat is worth 150');
  // a cockroach bolts when she gets near
  const roachDashed = await page.evaluate(async () => {
    const r = enemies.find(e => e.kind === 'roach' && e.placed && !e.dead && e.y > 130);
    if (!r) return 'no-roach';
    r.dashT = 0; r.dashCd = 0;
    player.x = r.x - 60; player.y = r.y + r.h - player.h; player.vy = 0;
    for (let i = 0; i < 16; i++) {
      await new Promise(res => requestAnimationFrame(res));
      if (r.dashT > 0) return 'dashed';
    }
    return 'idle';
  });
  check(roachDashed !== 'idle', 'a cockroach bolts at her when she comes near');
  // small things take small bites — half a heart each
  const nib = kind => page.evaluate(async kind => {
    const e = enemies.find(e => e.kind === kind && e.placed && !e.dead && e.y > 130);
    if (!e) return 'none';
    dog.deadT = 600; dog.fleeT = 0;      // park the dog; this is a dental exam
    player.invuln = 0; player.hp = 5;
    player.x = e.x - 2; player.y = e.y + e.h - player.h; player.vy = 0;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (player.hp < 5) break;
    }
    await new Promise(r => requestAnimationFrame(r));
    return { hp: player.hp, died: e.dead > 0 };
  }, kind);
  const antNib = await nib('ant');
  check(antNib.hp === 4.5 && antNib.died,
        'an ant nips half a heart — and the bite is the last thing it does');
  const roachNib = await nib('roach');
  check(roachNib.hp === 4.5 && roachNib.died,
        'a cockroach bites half a heart — and dies doing it');
  const ratBite = await nib('rat');
  check(ratBite === 'none' || (ratBite.hp === 4 && !ratBite.died),
        'a rat costs a full heart and lives to lunge again');
  await ev(() => { player.invuln = 999999; player.hp = 5; });

  /* ---------- the house's own sound ---------- */
  section('house music');
  check(await ev(() => HOUSE.length >= 24 && HOUSE.some(m => m >= 60) &&
        HOUSE.some(m => m > 0 && m < 60)),
        'the house waltz exists — music box over a slow bass');
  check(await ev(() => HOUSE_AMBIENTS.length >= 4 &&
        HOUSE_AMBIENTS.some(a => a.minStage >= 2)),
        'indoor murmurs, one reserved for the far-gone');
  await ev(() => { ambientCd = 1; });
  await frames(4);
  check(await ev(() => ambientCd > 100), 'the ambient clock winds itself indoors too');
  const houseLine = await page.evaluate(async () => {
    player.x = 1000; player.y = 100; player.vy = 0; player.maxX = 1000;
    kid.stage = 'roam'; kid.mode = 'hidden'; kid.hideT = 1;
    kid.x = -1000; kid.glimpses = 0;
    for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
    return flashText && flashText.msg;
  });
  check(houseLine === 'he is home. now so is she.',
        'the boy\'s glimpses speak in house lines');

  // death in the house retries the house
  await ev(() => { player.invuln = 0; player.hp = 1; player.y = 400; player.vy = 3; });
  await page.waitForFunction(() => state === 'gameover', null, { timeout: 5000 });
  await page.keyboard.press('Enter');
  await frames(4);
  check(await ev(() => level === 2 && state === 'play'),
        'game over retries the house, not the road');
  // reach him at his bedroom door
  await ev(() => { player.invuln = 999999; player.x = houseX - 250; player.y = 100;
                   player.vy = 0; player.maxX = houseX - 250; });
  await frames(4);
  check(await ev(() => kid.stage === 'final'), 'the boy waits at his bedroom door');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => state === 'boss', null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  check(true, 'reaching the boy opens the boss fight');

  /* ---------- the boss: the boy at his worst ---------- */
  section('boss fight');
  await ev(() => { player.invuln = 999999; });
  check(await ev(() => boss.hp === 3 && boss.phase === 'fight' &&
        BOSS_THEME.length >= 16),
        'the dracula-boy stands giant; his own music is ready');
  await ev(() => { boss.shootCd = 1; });
  await frames(8);
  check(await ev(() => bossBats.some(b => b.state === 'fly')), 'he looses bats at her');
  await ev(() => { boss.roachCd = 1; });
  await frames(8);
  check(await ev(() => bossRoaches.length > 0), 'cockroaches crash the fight');
  const fightRoachBite = await page.evaluate(async () => {
    const r = bossRoaches.find(r => r.state === 'run');
    if (!r) return 'none';
    r.x = 60;                                // away from the boss and his bats
    player.invuln = 0; player.hp = 5;
    player.x = 58; player.y = 126; player.vy = 0;
    for (let i = 0; i < 20; i++) {
      player.x = r.x - 2;
      await new Promise(res => requestAnimationFrame(res));
      if (player.hp < 5) return { hp: player.hp, gone: !bossRoaches.includes(r) };
    }
    return 'no-bite';
  });
  check(fightRoachBite === 'none' ||
        (fightRoachBite.hp === 4.5 && fightRoachBite.gone),
        'a fight roach is spent on its bite too');
  await ev(() => { player.invuln = 999999; player.hp = 5; });
  // jump onto a bat mid-flight
  const stomp = await page.evaluate(async () => {
    const b = bossBats.find(b => b.state === 'fly');
    if (!b) return 'no-bat';
    for (let i = 0; i < 40; i++) {
      player.x = b.x - 2; player.y = b.y - 16; player.vy = 1;
      await new Promise(r => requestAnimationFrame(r));
      if (b.state === 'down') return 'down';
    }
    return b.state;
  });
  check(stomp === 'down', 'jumping onto a bat knocks it out of the air');
  // walk over and pick it up
  const picked = await page.evaluate(async () => {
    const b = bossBats.find(b => b.state === 'down');
    if (!b) return 'no-down-bat';
    for (let i = 0; i < 120; i++) {          // wait out her bounce and its fall
      await new Promise(r => requestAnimationFrame(r));
      player.x = b.x - 1;
      if (b.y >= 137 && player.onGround) break;
    }
    player.vx = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let got = 'empty-handed';
    for (let i = 0; i < 10; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (carrying) { got = carrying; break; }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    return got;
  });
  check(picked === 'bat', 'punch picks the downed bat up');
  // throw it back at him
  const hit1 = await page.evaluate(async () => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    player.x = 130; player.y = 126; player.vy = 0; player.face = 1;
    boss.x = 210; boss.dir = 1;
    const hp0 = boss.hp;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let ret = 'miss';
    for (let i = 0; i < 70; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      if (boss.hp < hp0) { ret = { hp: boss.hp, boltCd: boss.boltCd }; break; }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    return ret;
  });
  check(hit1 !== 'miss' && hit1.hp === 2, 'the thrown bat lands — first blood');
  check(hit1 !== 'miss' && hit1.boltCd <= 18, 'the lightning answers the wound');
  // two more, and the spell breaks
  for (let h = 0; h < 2; h++) {
    await page.evaluate(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
      carrying = 'bat';
      player.x = 130; player.y = 126; player.vy = 0; player.face = 1;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 70; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        if (!carrying && thrown.length === 0) break;
        if (boss.phase !== 'fight') break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    });
  }
  check(await ev(() => boss.phase !== 'fight' && boss.hp <= 0),
        'three hits break the spell');
  // he shrinks, laughs, runs; the door stays open; the cat wanders in
  await page.waitForFunction(() => state === 'interlude', null, { timeout: 60000 });
  check(await ev(() => boss.phase === 'cat' && cat.x < 318),
        'he runs out laughing and the cat wanders in — level 2 ends');

  /* ---------- level 3: the deep woods ---------- */
  section('level 3');
  const preWoods = await ev(() => score);
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => level === 3 && state === 'play' && player.x === 40),
        'she follows him into the deep woods');
  check((await ev(() => score)) >= preWoods, 'the score follows her under the trees');
  check(await ev(() => creepStage() === 3 && inkMelt),
        'she arrives far gone and half ink');
  check(await ev(() => map.some(row => row.includes(4))),
        'giant trees stand in the woods');
  check(await ev(() => {
    for (let c = 0; c < MAP_W; c++)
      if (map[6][c] === 4 && (map[7][c] || map[8][c])) return false;
    return true;
  }), 'every trunk leaves a root arch to run beneath');
  check(await ev(() => {
    for (let r = 2; r < MAP_H - 2; r++)
      for (let c = 0; c < MAP_W; c++)
        if (map[r][c] === 2 && map[r + 2][c]) return false;
    return true;
  }), 'every branch leaves standing room beneath it');
  check(await ev(() => checkpoints.length >= 4 && eyePickups.length === 0),
        'wisps mark the way; the eye hunt stayed on the road');
  check(await ev(() => doors.length === 4 &&
        doors.map(d => d.kind).join() === 'tarot,bell,crows,dig'),
        'four standing stones: fortune teller, bell toll, crow gallery, grave dig');
  check(await ev(() => map[8].some((t, c) => t === 1 && map[9][c] === 1)),
        'stone outcrops break the ground');

  /* ---------- the woods are hungry ---------- */
  section('woods enemies');
  check(await ev(() => ['bear', 'wolf', 'lion'].every(k =>
        enemies.some(e => e.kind === k))),
        'bears, wolves, and mountain lions live here');
  check(await ev(() => enemies.every(e => e.x > LEVEL_W * 0.15)),
        'the treeline is quiet — nothing hunts the first stretch');
  check(await ev(() => enemies.every(e => e.x < (MAP_W - 24) * TILE)),
        'and the chapel clearing is calm');
  const bearFight = await page.evaluate(async () => {
    const b = enemies.find(e => e.kind === 'bear' && !e.dead);
    if (!b) return 'no-bear';
    player.invuln = 999999;
    let hits = 0;
    for (let h = 0; h < 3; h++) {
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
      if (b.dead) break;
      player.x = b.x - 12; player.y = b.y + b.h - player.h;
      player.vy = 0; player.face = 1; player.attack = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 20; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (b.hp <= 2 - h || b.dead) { hits++; break; }
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    }
    return { hits, dead: b.dead > 0 || b.hp <= 0 };
  });
  check(bearFight !== 'no-bear' && bearFight.hits === 3 && bearFight.dead,
        'three punches fell a bear');
  const wolfLunge = await page.evaluate(async () => {
    const w = enemies.find(e => e.kind === 'wolf' && e.placed && !e.dead);
    if (!w) return 'no-wolf';
    w.dashT = 0; w.lungeCd = 0;
    player.x = w.x - 70; player.y = w.y + w.h - player.h; player.vy = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (w.dashT > 0) return 'lunged';
    }
    return 'idle';
  });
  check(wolfLunge === 'lunged', 'a wolf closes fast when she is near');
  const lionPounce = await page.evaluate(async () => {
    const l = enemies.find(e => e.kind === 'lion' && e.mode === 'perch' && !e.dead);
    if (!l) return 'no-lion';
    l.pounceCd = 0;
    for (let i = 0; i < 30; i++) {
      player.x = l.x - 60; player.y = 100; player.vy = 0;
      await new Promise(r => requestAnimationFrame(r));
      if (l.mode !== 'perch') return l.mode;
    }
    return 'perch';
  });
  check(lionPounce === 'air' || lionPounce === 'ground',
        'a mountain lion pounces from its branch');

  /* ---------- gothic minigames ---------- */
  section('gothic minigames');
  await ev(() => { player.invuln = 999999; startMini(doors[0]); });
  await frames(3);
  check(await ev(() => state === 'mini' && mini.kind === 'tarot'), 'the fortune teller deals');
  const tarotWin = await page.evaluate(async () => {
    for (let round = 0; round < 4 && !mini.over; round++) {
      const want = [0, 1, 2, 3].find(v =>
        mini.cards.some((c, i) => c === v && mini.face[i] !== 2));
      const a = mini.cards.findIndex((c, i) => c === want && mini.face[i] !== 2);
      const b = mini.cards.findIndex((c, i) => c === want && mini.face[i] !== 2 && i !== a);
      for (const idx of [a, b]) {
        mini.sel = idx;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
        await new Promise(r => requestAnimationFrame(r));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        await new Promise(r => requestAnimationFrame(r));
      }
    }
    return { matched: mini.matched, won: mini.won };
  });
  check(tarotWin.won && tarotWin.matched === 4, 'matching all four pairs wins');
  await page.keyboard.press('Enter');
  await frames(3);

  await ev(() => startMini(doors[1]));
  await frames(3);
  const bell = await page.evaluate(async () => {
    for (let s = 0; s < 3 && !mini.over; s++) {
      for (let i = 0; i < 220; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (mini.swings > 0 && Math.abs(mini.p - 0.5) < 0.05) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
          await new Promise(r => requestAnimationFrame(r));
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
          await new Promise(r => requestAnimationFrame(r));
          break;
        }
      }
    }
    for (let i = 0; i < 80 && !mini.over; i++) await new Promise(r => requestAnimationFrame(r));
    return { rung: mini.rung, won: mini.won };
  });
  check(bell.rung >= 1 && bell.won, 'striking gold rings a true toll');
  await page.keyboard.press('Enter');
  await frames(3);

  await ev(() => startMini(doors[2]));
  await frames(3);
  const crowsRes = await page.evaluate(async () => {
    for (let d = 0; d < 5 && mini.crows.length && !mini.over; d++) {
      const p = mini.perches[mini.crows[0]];
      mini.aimY = p.y;
      mini.hopT = -999;                                 // no second thoughts
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      for (let i = 0; i < 110 && mini.dart; i++) {
        mini.hopT = 0;                                  // hold their nerve mid-flight
        await new Promise(r => requestAnimationFrame(r));
      }
      await new Promise(r => requestAnimationFrame(r)); // let the release register
    }
    for (let i = 0; i < 80 && !mini.over; i++) await new Promise(r => requestAnimationFrame(r));
    return { hits: mini.hits, won: mini.won };
  });
  check(crowsRes.hits >= 3 && crowsRes.won, 'three crows fall to good aim');
  await page.keyboard.press('Enter');
  await frames(3);

  await ev(() => { player.hp = 3; startMini(doors[3]); });
  await frames(3);
  const digRes = await page.evaluate(async () => {
    mini.sel = mini.locket;                             // she reads graves fluently
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    for (let m = 0; m < 16 && mini.phase === 'digging'; m++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
    }
    for (let i = 0; i < 220 && !mini.over; i++) await new Promise(r => requestAnimationFrame(r));
    return { won: mini.won, hp: player.hp };
  });
  check(digRes.won && digRes.hp === 4, 'the right grave gives up a silver locket, and a heart');
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && doors.every(d => d.used)),
        'all four stones are spent');

  /* ---------- the woods' own sound ---------- */
  section('woods sound');
  check(await ev(() => WOODS.length >= 24 && WOODS_AMBIENTS.length >= 4),
        'the woods have their own tune and their own voices');
  await ev(() => { ambientCd = 1; });
  await frames(4);
  check(await ev(() => ambientCd > 100), 'the night reschedules itself out here too');
  const woodsLine = await page.evaluate(async () => {
    player.x = 1000; player.y = 100; player.vy = 0; player.maxX = 1000;
    kid.stage = 'roam'; kid.mode = 'hidden'; kid.hideT = 1;
    kid.x = -1000; kid.glimpses = 0;
    for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
    return flashText && flashText.msg;
  });
  check(woodsLine === 'the trees know him. they let him pass.',
        'his glimpses speak in woods lines now');

  // death in the woods retries the woods
  await ev(() => { player.invuln = 0; player.hp = 1; player.y = 400; player.vy = 3; });
  await page.waitForFunction(() => state === 'gameover', null, { timeout: 5000 });
  await page.keyboard.press('Enter');
  await frames(4);
  check(await ev(() => level === 3 && state === 'play' &&
                       creepStage() === 0 && !inkMelt),
        'game over retries the woods — scrubbed porcelain-clean');
  // corner him at the chapel (the werewolf will land here next)
  await ev(() => { player.invuln = 999999; player.x = houseX - 250; player.y = 100;
                   player.vy = 0; player.maxX = houseX - 250; });
  await frames(4);
  check(await ev(() => kid.stage === 'final'), 'the boy waits at the old chapel');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => state === 'boss', null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  check(true, 'reaching him at the chapel wakes the werewolf');

  /* ---------- the werewolf ---------- */
  section('werewolf');
  await ev(() => { player.invuln = 999999; });
  check(await ev(() => boss.kind === 'werewolf' && boss.hp === 4 &&
        candel.state === 'ground'),
        'four wounds to give, and a silver candelabra waiting');
  // he swipes when she is close
  const swipe = await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      player.x = boss.x - 30; player.y = 126; player.vy = 0;
      await new Promise(r => requestAnimationFrame(r));
      if (boss.swipeT > 0) return 'swiped';
    }
    return 'calm';
  });
  check(swipe === 'swiped', 'he claws at her when she strays close');
  // pick the candelabra up
  const grabbed = await page.evaluate(async () => {
    player.x = candel.x; player.y = 126; player.vy = 0; player.attack = null;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let got = 'empty-handed';
    for (let i = 0; i < 10; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (carrying === 'candelabra') { got = 'held'; break; }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    return got;
  });
  check(grabbed === 'held', 'punch lifts the silver candelabra');
  // throw it — first wound, and the candelabra lands far away
  const wolfHit1 = await page.evaluate(async () => {
    const cx0 = candel.x;
    player.x = boss.x - 70; player.y = 126; player.vy = 0; player.face = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let ret = 'miss';
    for (let i = 0; i < 80; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      if (boss.hp < 4) {
        ret = { hp: boss.hp, moved: Math.abs(candel.x - cx0) > 50,
                grounded: candel.state === 'ground' };
        break;
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    return ret;
  });
  check(wolfHit1 !== 'miss' && wolfHit1.hp === 3, 'silver lands — his shirt tears');
  check(wolfHit1 !== 'miss' && wolfHit1.moved && wolfHit1.grounded,
        'the candelabra flies wide; she must fetch it again');
  // three more, by the same ritual
  for (let h = 0; h < 3; h++) {
    await page.evaluate(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
      carrying = 'candelabra'; candel.state = 'held';
      player.x = boss.x < 160 ? boss.x + boss.w + 60 : boss.x - 70;
      player.face = boss.x < 160 ? -1 : 1;
      player.y = 126; player.vy = 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 80; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        if (candel.state === 'ground' && !carrying) break;
        if (boss.phase !== 'fight') break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    });
  }
  check(await ev(() => boss.phase !== 'fight' && boss.hp <= 0),
        'the fourth finds the heart of him');
  // crumple, revert, and THROUGH the wall
  await page.waitForFunction(() => boss.wallHole === true, null, { timeout: 30000 });
  check(true, 'the boy breaks through the chapel wall');
  await page.waitForFunction(() => state === 'interlude', null, { timeout: 30000 });
  check(await ev(() => boss.phase === 'gone'), 'and he is gone — uphill, into the snow');

  /* ---------- level 4: the snowy mountain ---------- */
  section('level 4');
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => level === 4 && state === 'play' && player.x === 40),
        'she follows him up the mountain');
  check(await ev(() => groundTopRowAt(8) === 9 && groundTopRowAt(MAP_W - 8) === 5),
        'the ground climbs from valley floor to summit plateau');
  check(await ev(() => checkpoints.length >= 4 &&
        checkpoints.some(cp => cp.gy < 9 * TILE)),
        'frozen crystals mark the way, some on high shelves');
  check(await ev(() => doors.length === 0), 'no doors this high up');

  /* ---------- the slopes have tenants ---------- */
  section('alpine enemies');
  check(await ev(() => ['goat', 'wolf', 'owl'].every(k =>
        enemies.some(e => e.kind === k))),
        'goats, white wolves, and snowy owls hold the slopes');
  check(await ev(() => enemies.every(e => e.x > LEVEL_W * 0.12 &&
        e.x < (MAP_W - 20) * TILE)),
        'the first shelf and the summit stay empty');
  const goatCharge = await page.evaluate(async () => {
    const g = enemies.find(e => e.kind === 'goat' && e.placed && !e.dead);
    if (!g) return 'no-goat';
    g.chargeCd = 0; g.windupT = 0; g.chargeT = 0; g.stunT = 0;
    player.invuln = 999999;
    for (let i = 0; i < 60; i++) {
      player.x = g.x - 80; player.y = g.y + g.h - player.h; player.vy = 0;
      await new Promise(r => requestAnimationFrame(r));
      if (g.windupT > 0) return 'windup';
      if (g.chargeT > 0) return 'charging';
    }
    return 'grazing';
  });
  check(goatCharge === 'windup' || goatCharge === 'charging',
        'a goat snorts and charges when she lingers');
  const owlDive = await page.evaluate(async () => {
    const o = enemies.find(e => e.kind === 'owl' && !e.dead);
    if (!o) return 'no-owl';
    o.diveCd = 0;
    const y0 = { vx: o.vx, vy: o.vy };
    for (let i = 0; i < 40; i++) {
      player.x = o.x - 60; player.y = o.y + 40; player.vy = 0;
      await new Promise(r => requestAnimationFrame(r));
      if (Math.abs(o.vx) > 0.4 || Math.abs(o.vy) > 0.4) return 'diving';
    }
    return 'hovering';
  });
  check(owlDive === 'diving', 'a snowy owl folds its wings at her');
  check(await ev(() => creepStage() === 3 && inkMelt), 'still far gone, still half ink');
  // a raised checkpoint catches her fall at its own height
  const raisedRespawn = await page.evaluate(async () => {
    const cp = checkpoints.find(c => c.gy < 9 * TILE);
    if (!cp) return 'no-raised-crystal';
    player.invuln = 999999; player.hp = 5;
    player.x = cp.x + 10; player.y = cp.gy - 30; player.vy = 0;
    for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));
    if (!cp.reached) return 'not-lit';
    player.invuln = 0; player.y = 400; player.vy = 3;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (player.respawnT > 0) break;
    }
    for (let i = 0; i < 90 && player.respawnT > 0; i++)
      await new Promise(r => requestAnimationFrame(r));
    return { y: player.y, want: lastCP.y, hp: player.hp };
  });
  check(raisedRespawn.hp === 4 && Math.abs(raisedRespawn.y - raisedRespawn.want) < 3,
        'the crystal pulls her back at its own height');
  // the summit
  await ev(() => { player.invuln = 999999; player.x = houseX - 250;
                   player.y = FINALE_GY - 40; player.vy = 0; player.maxX = houseX - 250; });
  await frames(4);
  check(await ev(() => kid.stage === 'final' &&
        Math.abs(kid.y - (FINALE_GY - kid.h)) < 4),
        'the boy waits at the ice-cave mouth');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => state === 'boss', null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  check(true, 'reaching him at the cave wakes the yeti');

  /* ---------- the yeti ---------- */
  section('yeti');
  await ev(() => { player.invuln = 999999; });
  check(await ev(() => boss.kind === 'yeti' && boss.hp === 4 &&
        iceCeil.filter(i => i.state === 'hung').length === 5 &&
        iceFloor.filter(i => i.state === 'stand').length === 3),
        'four wounds to give; the cave is toothed above and below');
  // kick a floor icicle into him (relative hp + retries: no cascade on a miss)
  const slideHit = await page.evaluate(async () => {
    const hp0 = boss.hp;
    for (let attempt = 0; attempt < 3 && boss.hp === hp0; attempt++) {
      const fi = iceFloor.find(f => f.state === 'stand');
      if (!fi) { for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r)); continue; }
      boss.x = fi.x + 60; boss.dir = -1; boss.swipeT = 0; boss.swipeCd = 999;
      player.x = fi.x - 8; player.y = 126; player.vy = 0; player.face = 1;
      player.attack = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      for (let i = 0; i < 60; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
        if (boss.hp < hp0) break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
      await new Promise(r => requestAnimationFrame(r));
    }
    return boss.hp - hp0;
  });
  check(slideHit === -1, 'a kicked floor icicle skids into him — full damage');
  // knock a ceiling icicle onto him
  const dropHit = await page.evaluate(async () => {
    const hp0 = boss.hp;
    for (let attempt = 0; attempt < 3 && boss.hp === hp0; attempt++) {
      const ic = iceCeil.find(i => i.state === 'hung');
      if (!ic) { for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r)); continue; }
      boss.swipeT = 0; boss.swipeCd = 999;
      player.attack = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 90; i++) {
        player.x = ic.x - 14; player.y = 50; player.vy = 0; player.face = 1;
        boss.x = ic.x - 19; boss.dir = 1;
        await new Promise(r => requestAnimationFrame(r));
        if (i === 3) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        if (boss.hp < hp0) break;
        if (ic.state === 'gone') break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
    }
    return boss.hp - hp0;
  });
  check(dropHit === -1, 'a struck ceiling icicle drops on his head — full damage');
  // her own fists are half as convincing
  const meleeHit = await page.evaluate(async () => {
    const hp0 = boss.hp;
    for (let attempt = 0; attempt < 3 && boss.hp === hp0; attempt++) {
      boss.swipeT = 0; boss.swipeCd = 999; boss.dir = 1;
      player.attack = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 30; i++) {
        player.x = boss.x - 12; player.y = 126; player.vy = 0; player.face = 1;
        await new Promise(r => requestAnimationFrame(r));
        if (i === 3) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        if (boss.hp < hp0) break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
    }
    return boss.hp - hp0;
  });
  check(meleeHit === -0.5, 'her punch lands at half power');
  // finish him with the ice
  await ev(() => {
    boss.hp = 1;
    const fi = iceFloor[0]; fi.state = 'sliding'; fi.vx = 3;
    fi.x = boss.x - 40;
  });
  await page.waitForFunction(() => boss.phase !== 'fight', null, { timeout: 5000 });
  check(await ev(() => boss.phase === 'crumple'), 'the mountain lets him go');
  await page.waitForFunction(() => state === 'interlude', null, { timeout: 30000 });
  check(true, 'the boy escapes into the tunnel — down toward the tomb');

  /* ---------- level 5: the tomb ---------- */
  section('level 5');
  await page.keyboard.press('Enter');
  await frames(5);
  check(await ev(() => level === 5 && state === 'play' && player.x === 40),
        'the tunnel opens into the tomb');
  check(await ev(() => map[0].every(t => t === 1)), 'a ceiling of old stone');
  check(await ev(() => tables.length >= 3), 'fallen pillars to vault');
  check(await ev(() => doors.length === 3 &&
        doors.map(d => d.kind).join() === 'glyphs,scarabs,spears'),
        'three doorways: the glyph rite, the scarab race, the spear gauntlet');
  check(await ev(() => checkpoints.length >= 4), 'torches mark the way');

  section('tomb enemies');
  check(await ev(() => ['mummy', 'scarab', 'cobra'].every(k =>
        enemies.some(e => e.kind === k))),
        'mummies, scarabs, and cobras keep the halls');
  check(await ev(() => enemies.every(e => e.x > LEVEL_W * 0.12 &&
        e.x < (MAP_W - 22) * TILE)),
        'the threshold and the burial door stay quiet');
  const mummyFight = await page.evaluate(async () => {
    const m = enemies.find(e => e.kind === 'mummy' && e.placed && !e.dead);
    if (!m) return 'no-mummy';
    player.invuln = 999999;
    let hits = 0;
    for (let h = 0; h < 3; h++) {
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
      if (m.dead) break;
      player.x = m.x - 12; player.y = m.y + m.h - player.h;
      player.vy = 0; player.face = 1; player.attack = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 20; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (m.hp <= 2 - h || m.dead) { hits++; break; }
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    }
    return { hits, dead: m.dead > 0 || m.hp <= 0 };
  });
  check(mummyFight !== 'no-mummy' && mummyFight.hits === 3 && mummyFight.dead,
        'three punches unwind a mummy');
  const scarabBite = await page.evaluate(async () => {
    const s = enemies.find(e => e.kind === 'scarab' && e.placed && !e.dead);
    if (!s) return 'none';
    player.invuln = 0; player.hp = 5;
    player.x = s.x - 2; player.y = s.y + s.h - player.h; player.vy = 0;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (player.hp < 5) break;
    }
    await new Promise(r => requestAnimationFrame(r));
    return { hp: player.hp, died: s.dead > 0 };
  });
  check(scarabBite !== 'none' && scarabBite.hp === 4.5 && scarabBite.died,
        'a scarab takes half a heart and dies taking it');
  await ev(() => { player.invuln = 999999; player.hp = 5; });

  /* ---------- ancient minigames ---------- */
  section('ancient minigames');
  await ev(() => startMini(doors[0]));
  await frames(3);
  check(await ev(() => state === 'mini' && mini.kind === 'glyphs'), 'the wall clears its throat');
  const glyphWin = await page.evaluate(async () => {
    for (let i = 0; i < 400 && mini.phase === 'show'; i++)
      await new Promise(r => requestAnimationFrame(r));
    for (let w = 0; w < 4 && !mini.over; w++) {
      mini.sel = mini.seq[mini.inputI];
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
    }
    return { won: mini.won, inputI: mini.inputI };
  });
  check(glyphWin.won && glyphWin.inputI === 4, 'four words said back win the rite');
  await page.keyboard.press('Enter');
  await frames(3);

  await ev(() => startMini(doors[1]));
  await frames(3);
  const scarabRace = await page.evaluate(async () => {
    mini.sel = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    mini.racers[0].x = 300;                             // her beetle finds a shortcut
    for (let i = 0; i < 60 && !mini.over; i++) await new Promise(r => requestAnimationFrame(r));
    return { won: mini.won, winner: mini.winner };
  });
  check(scarabRace.won && scarabRace.winner === 0, 'her beetle knows the way');
  await page.keyboard.press('Enter');
  await frames(3);

  await ev(() => startMini(doors[2]));
  await frames(3);
  const gauntlet = await page.evaluate(async () => {
    for (let g = 0; g < 3 && !mini.over; g++) {
      for (let i = 0; i < 200; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (mini.dashT > 0 || mini.ow > 0) continue;
        const open = ((mini.t / 50 + mini.gate * 0.37) % 1) > 0.55;
        if (open) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
          await new Promise(r => requestAnimationFrame(r));
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
          await new Promise(r => requestAnimationFrame(r));
          break;
        }
      }
    }
    for (let i = 0; i < 60 && !mini.over; i++) await new Promise(r => requestAnimationFrame(r));
    return { won: mini.won, gates: mini.gate };
  });
  check(gauntlet.won && gauntlet.gates === 3, 'three gates dashed untouched');
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && doors.every(d => d.used)),
        'the three doorways are spent');

  // the burial door (the god arrives next)
  await ev(() => { player.invuln = 999999; player.x = houseX - 250; player.y = 100;
                   player.vy = 0; player.maxX = houseX - 250; });
  await frames(4);
  check(await ev(() => kid.stage === 'final'), 'the boy waits at the burial door');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => state === 'boss', null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  check(true, 'reaching him at the burial door wakes the god');

  /* ---------- the aztec god ---------- */
  section('aztec god');
  await ev(() => { player.invuln = 999999; });
  check(await ev(() => boss.kind === 'aztec' && boss.hp === 4 &&
        dag.state === 'ground'),
        'a gold mask, four cracks to give, and a dagger in the dust');
  await ev(() => { boss.shootCd = 1; });
  await frames(8);
  check(await ev(() => skulls.length > 0), 'he throws the tomb\'s own skulls');
  const dagGrab = await page.evaluate(async () => {
    player.x = dag.x; player.y = 126; player.vy = 0; player.attack = null;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let got = 'empty-handed';
    for (let i = 0; i < 10; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (carrying === 'dagger') { got = 'held'; break; }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    return got;
  });
  check(dagGrab === 'held', 'punch lifts the obsidian dagger');
  const godHit1 = await page.evaluate(async () => {
    const dx0 = dag.x;
    player.x = 100; player.y = 126; player.vy = 0; player.face = 1;
    boss.x = 200; boss.dir = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    let ret = 'miss';
    for (let i = 0; i < 80; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      if (boss.hp < 4) {
        ret = { hp: boss.hp, moved: Math.abs(dag.x - dx0) > 40,
                grounded: dag.state === 'ground' };
        break;
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    return ret;
  });
  check(godHit1 !== 'miss' && godHit1.hp === 3, 'obsidian finds gold — the mask cracks');
  check(godHit1 !== 'miss' && godHit1.moved && godHit1.grounded,
        'the dagger skids away; she must fetch it again');
  for (let h = 0; h < 3; h++) {
    await page.evaluate(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      await new Promise(r => requestAnimationFrame(r));
      carrying = 'dagger'; dag.state = 'held';
      player.x = boss.x < 160 ? boss.x + boss.w + 60 : boss.x - 70;
      player.face = boss.x < 160 ? -1 : 1;
      player.y = 126; player.vy = 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      for (let i = 0; i < 80; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (i === 2) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
        if (dag.state === 'ground' && !carrying) break;
        if (boss.phase !== 'fight') break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    });
  }
  check(await ev(() => boss.phase !== 'fight' && boss.hp <= 0), 'the mask falls');
  await page.waitForFunction(() => state === 'win', null, { timeout: 30000 });
  check(await ev(() => boss.phase === 'gone'),
        'the boy slips behind the sarcophagus — the true, final ending');
  await page.keyboard.press('Enter');
  await frames(4);
  check(await ev(() => level === 1 && state === 'play' && score === 0),
        'Enter after the true win starts the story over');

  /* ---------- wrap up ---------- */
  section('page health');
  check(pageErrors.length === 0, 'no page errors during the whole run' +
        (pageErrors.length ? ' (' + pageErrors.join('; ') + ')' : ''));

  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SUITE CRASHED:', e); process.exit(1); });
