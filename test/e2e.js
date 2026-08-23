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

  /* ---------- checkpoints & pit respawn ---------- */
  section('checkpoints');
  check(await ev(() => checkpoints.length >= 4),
        'lanterns dot the level (' + (await ev(() => checkpoints.length)) + ')');
  check(await ev(() => checkpoints.every(cp => map[9][Math.floor(cp.x / TILE)] === 1)),
        'every lantern stands on solid ground');
  check(await ev(() => checkpoints.some(cp => cp.reached)),
        'lanterns she passed are lit');

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
        'touching a lost eye collects it (1/5)');

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
        'she takes the hollow\'s eye and it heals her (2/5)');
  await page.waitForFunction(() => mini.over, null, { timeout: 10000 });
  await page.keyboard.press('Enter');
  await frames(3);
  check(await ev(() => state === 'play' && doors[3].used), 'the hollow seals behind her');

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
  const gustHit = await ev(() => {
    const s = enemies.find(e => e.kind === 'snake' && e.placed && !e.dead);
    if (!s) return 'no-snake';
    dragon.x = s.x - dragon.w - 12; dragon.y = 128; dragon.face = 1; dragon.gustCd = 0;
    return s.hp;
  });
  await tap('z');
  check(gustHit === 'no-snake' || (await ev(() => {
    const s = enemies.find(e => e.kind === 'snake' && e.placed);
    return !s || s.dead > 0 || s.hp < 2;
  })), 'punch breathes a flame gust');
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

  /* ---------- the chase & the win ---------- */
  section('the win');
  await ev(() => { dragon.ridden = false; player.invuln = 999999; });
  // roaming kid: glimpsed ahead, untouchable until the finale
  await ev(() => {
    player.x = 1000; player.y = 100; player.vy = 0; player.maxX = 1000;
    kid.stage = 'roam'; kid.mode = 'hidden'; kid.hideT = 1; kid.x = -1000;
  });
  await frames(5);
  check(await ev(() => kid.mode === 'peek' && kid.x > player.x),
        'the kid is glimpsed running ahead during the level');
  check(await ev(() => kid.x - player.x < 200),
        'he appears close enough to give chase');
  await ev(() => { player.x = kid.x - 100; player.y = kid.y; player.vy = 0; });
  await frames(10);
  check(await ev(() => kid.mode === 'sprint' && kid.vx > 1.7),
        'closing in makes him bolt, faster than she can run');
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
  check(await ev(() => eyesFound === EYES_TOTAL), 'all five eyes accounted for');
  const preWin = await ev(() => score);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => state === 'win', null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  check(true, 'tagging the kid wins the game');
  check((await ev(() => score)) >= preWin + 2000,
        'finding every eye doubles the win bonus');

  /* ---------- wrap up ---------- */
  section('page health');
  check(pageErrors.length === 0, 'no page errors during the whole run' +
        (pageErrors.length ? ' (' + pageErrors.join('; ') + ')' : ''));

  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SUITE CRASHED:', e); process.exit(1); });
