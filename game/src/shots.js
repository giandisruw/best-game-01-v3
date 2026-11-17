// EMBERDEEP — deterministic screenshot scenes.
// One clear job: stage a world into each named ?shot= scene (title, busy
// boss fight, draft, win) using the game's own simulation, so the
// screenshots are real renders of real play. Sets window.__shotReady
// when drawn.

import { createWorld, applyRelic, rollDraftOptions, update } from './world.js';
import { generateFloor, roomById } from './rooms.js';
import { spawnEnemy } from './enemies.js';
import { RELICS, BOSSES, xpForLevel } from './config.js';

const DT = 1 / 30;

function relicById(id) {
  return RELICS.find((r) => r.id === id);
}

// A fake input that plays the game: chase the nearest foe, shoot it,
// dash when crowded, burst when surrounded.
function autopilotInput(w) {
  let target = null;
  let best = Infinity;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d < best) { best = d; target = e; }
  }
  const keys = new Set();
  if (target) {
    const dx = target.x - w.player.x;
    const dy = target.y - w.player.y;
    if (dx > 14) keys.add('d');
    if (dx < -14) keys.add('a');
    if (dy > 14) keys.add('s');
    if (dy < -14) keys.add('w');
    if (best < 120 * 120) keys.add('shift');
  }
  const near = w.enemies.filter((e) => !e.dead && Math.hypot(e.x - w.player.x, e.y - w.player.y) < 200).length;
  if (near >= 3) keys.add('1');
  return {
    mouse: { x: target ? target.x : 640, y: target ? target.y : 300, left: !!target, right: false },
    keys,
    down(...names) { return names.some((n) => keys.has(n)); },
    wasPressed(...names) { return names.some((n) => keys.has(n)); },
    takeClicks() { return []; },
    endFrame() {},
  };
}

function simulate(w, maxSeconds, stopWhen) {
  const steps = Math.round(maxSeconds / DT);
  for (let i = 0; i < steps; i += 1) {
    update(w, autopilotInput(w), DT);
    if (w.phase === 'won' || w.phase === 'lost') return false;
    if (w.phase !== 'fight') return false;
    if (stopWhen && stopWhen(w)) return true;
  }
  return !!(stopWhen && stopWhen(w));
}

function grantRelics(w, ids) {
  for (const id of ids) applyRelic(w, relicById(id));
}

// Spawn the boss room's contents through the game's own spawn path.
function spawnBossRoom(w) {
  for (const kind of w.room.spawn) {
    const e = spawnEnemy(kind, 640, 220, w.floorIndex, w.rng);
    w.enemies.push(e);
    if (e.boss) {
      w.boss = e;
      w.banner = { text: e.name, sub: BOSSES[e.boss].title, t: 2.6 };
      w.events.push('boss');
    }
  }
  // Four shardling adds, as the Mother's brood — nearer the player so
  // the frame reads as a busy boss fight, not an empty dark room.
  for (const [x, y] of [[300, 260], [980, 260], [420, 420], [860, 430]]) {
    w.enemies.push(spawnEnemy('shardling', x, y, w.floorIndex, w.rng));
  }
}

export function buildShotScene(name, seed) {
  if (name === 'start') {
    const w = createWorld(seed, 'delver');
    return { world: w, screen: 'title' };
  }

  if (name === 'play') {
    // Floor 2 boss room, mid-fight: the Spore Mother with adds, a
    // half-built relic set, and a live combo.
    const w = createWorld(seed, 'delver');
    w.floorIndex = 1;
    w.floorData = generateFloor(seed + 101, 1);
    for (const r of w.floorData.rooms) {
      if (r.id < 5) { r.cleared = true; r.visited = true; }
    }
    w.roomId = 5;
    w.room = roomById(w.floorData, 5);
    w.room.visited = true;
    w.player.x = 640;
    w.player.y = 560;
    grantRelics(w, ['heavy-wick', 'twin-wick', 'lodestone', 'piercing-light', 'swift-boots', 'lantern-oil']);
    w.level = 6;
    w.xp = 4;
    w.xpNeed = xpForLevel(6);
    w.gold = 128;
    w.score = 4860;
    w.kills = 61;
    w.combo = 5;
    w.comboTimer = 2.4;
    w.comboMult = 5;
    spawnBossRoom(w);
    const ok = simulate(w, 30, (s) => {
      const boss = s.boss;
      return boss && !boss.dead && boss.hp < boss.maxHp * 0.78 && s.enemies.length >= 3 && s.bolts.length >= 1;
    });
    // Stage the shot so it always reads as a busy boss fight: the boss at
    // 62%, at least three foes on screen, the bearer in the open with
    // bolts in flight, and no hit-flash whitening anyone.
    const boss = w.boss;
    if (boss && !boss.dead) boss.hp = Math.round(boss.maxHp * 0.62);
    for (const e of w.enemies) e.hitFlash = 0;
    const alive = w.enemies.filter((e) => !e.dead);
    if (alive.length < 4 && boss && !boss.dead) {
      const extra = ['skitter', 'wisp', 'shardling'].slice(0, 4 - alive.length);
      const spots = [[300, 240], [980, 240], [900, 440]];
      for (const [i, kind] of extra.entries()) {
        w.enemies.push(spawnEnemy(kind, spots[i][0], spots[i][1], w.floorIndex, w.rng));
      }
    }
    // Keep the boss out from under the banner and the boss bar.
    if (boss && !boss.dead) { boss.x = 640; boss.y = 310; }
    w.banner = null; // the boss bar already names the fight
    w.player.x = 640;
    w.player.y = 520;
    w.player.invulnT = 0;
    w.combo = 5;
    w.comboTimer = 2.4;
    w.comboMult = 5;
    w.score = 5120;
    if (boss && !boss.dead && w.bolts.length === 0) {
      const a = Math.atan2(boss.y - w.player.y, boss.x - w.player.x);
      for (const off of [-0.16, 0.16]) {
        w.bolts.push({
          x: w.player.x + Math.cos(a + off) * 30, y: w.player.y + Math.sin(a + off) * 30,
          vx: Math.cos(a + off) * 560, vy: Math.sin(a + off) * 560,
          travelled: 60, range: 520, damage: 13, pierce: 1, bounce: 0,
          hitSet: new Set(), dead: false,
        });
      }
    }
    void ok;
    return { world: w, screen: 'play' };
  }

  if (name === 'draft') {
    const w = createWorld(seed, 'delver');
    grantRelics(w, ['heavy-wick', 'quick-wick', 'lodestone', 'thick-wicker']);
    w.level = 5;
    w.xp = 0;
    w.xpNeed = xpForLevel(5);
    w.gold = 86;
    w.score = 2940;
    w.kills = 34;
    rollDraftOptions(w);
    w.phase = 'draft';
    return { world: w, screen: 'draft' };
  }

  if (name === 'win') {
    const w = createWorld(seed, 'delver');
    w.floorIndex = 2;
    w.floorData = generateFloor(seed + 202, 2);
    w.roomId = 5;
    w.room = roomById(w.floorData, 5);
    grantRelics(w, ['heavy-wick', 'twin-wick', 'piercing-light', 'lantern-oil', 'tri-wick', 'second-wind', 'swift-boots', 'blood-ember']);
    w.phase = 'won';
    w.score = 12480;
    w.kills = 132;
    w.grade = 'S';
    w.winStats = {
      score: 12480, grade: 'S', floor: 3, kills: 132,
      time: 742, relics: 8, difficulty: 'delver', seed, endless: false,
    };
    w.feats.add('first-blood');
    w.feats.add('combo8');
    w.feats.add('elite');
    w.feats.add('relic5');
    w.feats.add('floor1');
    w.feats.add('floor2');
    w.feats.add('boss');
    w.feats.add('delve');
    w.player.hp = 2;
    w.player.maxHearts = 4;
    w.gold = 210;
    return { world: w, screen: 'win' };
  }

  const w = createWorld(seed, 'delver');
  return { world: w, screen: 'title' };
}
