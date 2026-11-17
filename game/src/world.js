// EMBERDEEP — the rules.
// One clear job: the whole simulation with no DOM in it — the player,
// bolts, foes, pickups, rooms, drafts, the shop, the altar, bosses,
// feats and the win/lose conditions. render.js draws this state;
// main.js drives it one frame at a time.

import {
  VIEW_W, VIEW_H, WALL, DOOR_W, PLAYER, ABILITIES, ENEMIES, BOSSES,
  FLOORS, RELICS, RARITY_WEIGHT, SHOP_ITEMS, FEATS, xpForLevel, gradeFor,
} from './config.js';
import { makeRng } from './random.js';
import { generateFloor, roomById, entryPoint } from './rooms.js';
import { spawnEnemy, updateEnemy } from './enemies.js';

const DT_MAX = 0.05;

function weightedRelic(rng, ownedIds) {
  const pool = RELICS.filter((r) => !(r.unique && ownedIds.has(r.id)));
  let total = 0;
  for (const r of pool) total += RARITY_WEIGHT[r.rarity];
  let roll = rng.next() * total;
  for (const r of pool) {
    roll -= RARITY_WEIGHT[r.rarity];
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

export function rollDraftOptions(world) {
  const owned = new Set(world.relics.map((r) => r.id));
  const options = [];
  let tries = 0;
  while (options.length < 3 && tries < 80) {
    tries += 1;
    const pick = weightedRelic(world.rng, owned);
    if (!options.find((o) => o.id === pick.id)) options.push(pick);
  }
  world.draftOptions = options;
  world.draftPicked = false;
}

function recomputeMods(world) {
  const m = {
    damage: 1, fireRate: 1, multishot: 1, pierce: 0, bounce: 0,
    range: 1, magnet: 1, speed: 1, crit: PLAYER.critChance,
    dashCd: 1, gold: 1, storm: 0, bloodEmber: false, secondWind: false,
    nova: false, aegis: false, light: 1,
  };
  for (const owned of world.relics) {
    const def = RELICS.find((r) => r.id === owned.id);
    if (!def) continue;
    const c = owned.count;
    switch (def.apply) {
      case 'damage': m.damage += def.value * c; break;
      case 'fireRate': m.fireRate += def.value * c; break;
      case 'multishot':
        m.multishot += def.value * c;
        m.damage -= (def.id === 'twin-wick' ? 0.15 : 0.10) * c;
        break;
      case 'range': m.range += def.value * c; break;
      case 'magnet': m.magnet += def.value * c; break;
      case 'maxHearts': break; // applied immediately in applyRelic
      case 'speed': m.speed += def.value * c; break;
      case 'crit': m.crit += def.value * c; break;
      case 'dashCd': m.dashCd *= (1 - def.value) ** c; break;
      case 'gold': m.gold += def.value * c; break;
      case 'pierce': m.pierce += def.value * c; break;
      case 'bounce': m.bounce += def.value * c; break;
      case 'oil': m.light += 0.45 * c; m.damage += def.value * c; break;
      case 'bloodEmber': m.bloodEmber = true; break;
      case 'secondWind': m.secondWind = true; break;
      case 'storm': m.storm = def.value; break;
      case 'nova': m.nova = true; break;
      case 'aegis': m.aegis = true; break;
      default: break;
    }
  }
  m.damage = Math.max(0.4, m.damage);
  m.multishot = Math.min(5, Math.max(1, m.multishot));
  m.pierce = Math.min(3, m.pierce);
  world.mods = m;
}

export function applyRelic(world, def) {
  const owned = world.relics.find((r) => r.id === def.id);
  if (owned) owned.count += 1;
  else world.relics.push({ id: def.id, count: 1 });
  if (def.apply === 'maxHearts') {
    world.player.maxHearts = Math.min(6, world.player.maxHearts + def.value);
    world.player.hp = Math.min(world.player.maxHearts, world.player.hp + def.value);
  }
  recomputeMods(world);
  if (world.relics.reduce((n, r) => n + r.count, 0) >= 5) world.feats.add('relic5');
}

function addBanner(world, text, sub) {
  world.banner = { text, sub: sub || '', t: 2.6 };
}

function addFloater(world, x, y, text, color, big) {
  world.floaters.push({ x, y, text, color, life: 0.9, big: !!big });
}

function burst(world, x, y, n, color, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = world.rng.next() * Math.PI * 2;
    const s = (speed || 140) * (0.4 + world.rng.next() * 0.8);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + world.rng.next() * 0.4, maxLife: 0.9,
      color, size: 2 + world.rng.next() * 3,
    });
  }
}

function dropPickup(world, x, y, kind, value) {
  const a = world.rng.next() * Math.PI * 2;
  world.pickups.push({
    kind, value, x, y,
    vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
    t: 0, life: 14,
  });
}

function dropLoot(world, e) {
  const goldMult = world.mods.gold * (world.difficulty === 'abyssal' ? 1.25 : 1);
  const xpMult = world.difficulty === 'abyssal' ? 1.25 : 1;
  const shards = e.boss ? 8 : Math.min(3, e.xp);
  for (let i = 0; i < shards; i += 1) dropPickup(world, e.x, e.y, 'shard', Math.max(1, Math.round(e.xp / shards * xpMult)));
  const coins = e.boss ? 6 : (e.elite ? 4 : 1);
  for (let i = 0; i < coins; i += 1) {
    dropPickup(world, e.x, e.y, 'gold', Math.max(1, Math.round((e.gold / coins) * goldMult)));
  }
  if (!e.boss && world.rng.chance(0.07)) dropPickup(world, e.x, e.y, 'heart', 1);
  if (e.elite) dropPickup(world, e.x, e.y, 'relic', 1);
}

function killEnemy(world, e) {
  e.dead = true;
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = 3;
  const mult = Math.min(8, world.combo);
  world.comboMult = mult;
  if (mult >= 8) world.feats.add('combo8');
  world.score += Math.round(e.score * mult);
  addFloater(world, e.x, e.y - e.r - 6, `+${Math.round(e.score * mult)}`, '#ffd23d', mult >= 4);
  burst(world, e.x, e.y, e.boss ? 46 : 14, e.color, e.boss ? 260 : 170);
  world.events.push('kill');
  if (e.boss) {
    world.bossesSlain += 1;
    world.feats.add('boss');
    world.shake = 14;
    world.events.push('boss');
  }
  if (e.elite) world.elitesSlain += 1;
  if (world.feats.has('first-blood') === false) world.feats.add('first-blood');
  if (e.elite) world.feats.add('elite');
  // Shardlings split into two small ones, once.
  if (e.shape === 'shardling' && !e.splitDone) {
    for (let i = 0; i < 2; i += 1) {
      const mini = spawnEnemy('shardling', e.x + (i ? 26 : -26), e.y, world.floorIndex, world.rng);
      mini.hp = 8;
      mini.maxHp = 8;
      mini.r = 8;
      mini.speed *= 1.25;
      mini.splitDone = true;
      world.enemies.push(mini);
    }
  }
  // Storm Wick: a kill may zap a nearby foe.
  if (world.mods.storm > 0 && world.rng.chance(world.mods.storm)) {
    let best = null;
    let bestD = 320;
    for (const o of world.enemies) {
      if (o.dead || o === e) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) {
      best.hp -= 20;
      best.hitFlash = 0.15;
      addFloater(world, best.x, best.y - 16, '20', '#6ad8ff', false);
      burst(world, best.x, best.y, 8, '#6ad8ff', 180);
      if (best.hp <= 0) killEnemy(world, best);
    }
  }
  dropLoot(world, e);
}

function hurtPlayer(world, amount) {
  const p = world.player;
  if (p.invulnT > 0 || p.dashT > 0) return;
  if (p.wardCharges > 0 && p.wardT > 0) {
    p.wardCharges -= 1;
    p.invulnT = 0.8;
    world.events.push('ward');
    addFloater(world, p.x, p.y - 26, 'WARDED', '#6ad8ff', true);
    burst(world, p.x, p.y, 12, '#6ad8ff', 160);
    return;
  }
  p.hp -= amount;
  p.invulnT = 1.2;
  world.combo = 0;
  world.comboMult = 1;
  world.shake = 9;
  world.events.push('hit');
  burst(world, p.x, p.y, 16, '#ff5a4d', 200);
  if (p.hp <= 0) {
    if (world.mods.secondWind && !world.secondWindUsed) {
      world.secondWindUsed = true;
      p.hp = 1;
      p.invulnT = 2;
      addBanner(world, 'SECOND WIND', 'The ember refuses to go out.');
      world.events.push('burst');
      burst(world, p.x, p.y, 30, '#ffb35c', 260);
      useAbility(world, 'burst', true);
    } else {
      world.phase = 'lost';
      world.events.push('lose');
    }
  }
}

export function useAbility(world, which, free) {
  const p = world.player;
  if (world.phase !== 'fight') return false;
  if (which === 'burst') {
    if (!free && p.burstCd > 0) return false;
    const radius = ABILITIES.burst.radius * (world.mods.nova ? 1.7 : 1);
    const dmg = ABILITIES.burst.damage * world.mods.damage;
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) <= radius + e.r) {
        e.hp -= dmg;
        e.hitFlash = 0.15;
        addFloater(world, e.x, e.y - e.r - 4, `${Math.round(dmg)}`, '#ffb35c', false);
        if (e.hp <= 0) killEnemy(world, e);
      }
    }
    burst(world, p.x, p.y, 26, '#ffb35c', 320);
    world.shake = Math.max(world.shake, 6);
    if (!free) p.burstCd = ABILITIES.burst.cooldown * (world.mods.nova ? 0.75 : 1);
    world.events.push('burst');
    return true;
  }
  if (which === 'ward') {
    if (p.wardCd > 0) return false;
    p.wardCharges = world.mods.aegis ? 2 : 1;
    p.wardT = ABILITIES.ward.duration;
    p.wardCd = ABILITIES.ward.cooldown;
    world.events.push('ward');
    return true;
  }
  return false;
}

function fireBolt(world, input) {
  const p = world.player;
  const m = world.mods;
  const aimDx = input.mouse.x - p.x;
  const aimDy = input.mouse.y - p.y;
  const base = Math.atan2(aimDy, aimDx);
  const n = m.multishot;
  // Tight spread: at the 250–420px kiting band both bolts of Twin Wick
  // must still land inside a foe's hit circle (was 0.16 — at 300px the
  // ±24px offset missed a 19px hit circle entirely, so a lone Spitter
  // keeping its distance could never be hit at all).
  const spread = 0.07;
  for (let i = 0; i < n; i += 1) {
    const off = (i - (n - 1) / 2) * spread;
    const a = base + off;
    const speed = PLAYER.boltSpeed * m.range;
    world.bolts.push({
      x: p.x + Math.cos(a) * (p.r + 6),
      y: p.y + Math.sin(a) * (p.r + 6),
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      travelled: 0, range: PLAYER.boltRange * m.range,
      damage: PLAYER.boltDamage * m.damage * (1 + world.oilBonus),
      pierce: m.pierce, bounce: m.bounce, hitSet: new Set(), dead: false,
    });
  }
  world.events.push('shoot');
}

function spawnRoomEnemies(world) {
  const room = world.room;
  const p = world.player;
  for (const kind of room.spawn) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries += 1) {
      x = world.rng.range(WALL + 80, VIEW_W - WALL - 80);
      y = world.rng.range(WALL + 80, VIEW_H - WALL - 80);
      if (Math.hypot(x - p.x, y - p.y) > 240) break;
    }
    const e = spawnEnemy(kind, x, y, world.floorIndex, world.rng);
    if (world.difficulty === 'abyssal') {
      e.hp = Math.round(e.hp * 1.35);
      e.maxHp = e.hp;
    }
    world.enemies.push(e);
    if (e.boss) {
      world.boss = e;
      addBanner(world, e.name, BOSSES[e.boss].title);
      world.events.push('boss');
    }
  }
}

export function enterRoom(world, roomId, fromDir) {
  const prevId = world.roomId;
  const room = roomById(world.floorData, roomId);
  world.roomId = roomId;
  world.room = room;
  room.visited = true;
  // The mid room's west door leads back where the player came from.
  if (roomId === 4) world.floorData.exits[4].w = prevId;
  const entry = entryPoint(fromDir || 'w');
  world.player.x = entry.x;
  world.player.y = entry.y;
  world.player.vx = 0;
  world.player.vy = 0;
  world.bolts = [];
  world.globs = [];
  world.chest = null;
  world.fadeT = 0.3;
  world.events.push('door');

  if (room.kind === 'fork') {
    room.cleared = true;
    addBanner(world, 'CHOOSE YOUR PATH', 'North — the elite. South — the treasure.');
    return;
  }
  if (room.kind === 'treasure') {
    if (room.chestOpened) return; // looted already: walk through
    world.chest = { x: 640, y: 360, opened: false };
    room.cleared = false;
    addBanner(world, 'TREASURE CHAMBER', 'Touch the chest to open it.');
    return;
  }
  if (room.kind === 'shop') {
    if (room.cleared) return; // shopped already: walk through
    room.cleared = true;
    world.phase = 'shop';
    world.shopBought = new Set();
    return;
  }
  if (room.kind === 'altar') {
    if (room.cleared) return; // offered already: walk through
    room.cleared = true;
    const epics = RELICS.filter((r) => r.rarity === 'epic' && !world.relics.find((o) => o.id === r.id));
    const pool = epics.length ? epics : RELICS.filter((r) => r.rarity === 'rare');
    world.altarOffer = world.rng.pick(pool);
    world.phase = 'altar';
    return;
  }
  if (room.cleared) return; // revisited empty room
  // First entry only: foes spawn once per room. Retreating from an
  // uncleared room and walking back in used to summon a second boss
  // (bossesSlain read 4 after a 3-boss win) and farmable respawns.
  if (room.kind === 'boss' || room.kind === 'combat' || room.kind === 'elite') {
    if (!room.spawned) {
      room.spawned = true;
      spawnRoomEnemies(world);
    }
  }
}

export function applyDraft(world, relicId) {
  const def = world.draftOptions.find((r) => r.id === relicId);
  if (!def) return;
  applyRelic(world, def);
  addBanner(world, `RELIC — ${def.name}`, def.desc);
  world.events.push('draft');
  if (world.mods.bloodEmber) {
    world.player.hp = Math.min(world.player.maxHearts, world.player.hp + 1);
  }
  world.draftPicked = true;
  if (world.phase === 'draft') {
    if (world.xp >= world.xpNeed) {
      world.level += 1;
      world.xp -= world.xpNeed;
      world.xpNeed = xpForLevel(world.level);
      rollDraftOptions(world);
      world.events.push('levelup');
    } else {
      world.phase = 'fight';
    }
  }
}

export function buyShop(world, itemId) {
  if (world.phase !== 'shop') return;
  const item = SHOP_ITEMS.find((s) => s.id === itemId);
  if (!item) return;
  if (world.gold < item.price) {
    world.events.push('denied');
    return;
  }
  if (item.id === 'heal' && world.player.hp >= world.player.maxHearts) return;
  if (item.id === 'maxheart' && world.player.maxHearts >= 6) return;
  world.gold -= item.price;
  if (item.id === 'heal') world.player.hp = Math.min(world.player.maxHearts, world.player.hp + 1);
  else if (item.id === 'maxheart') {
    world.player.maxHearts += 1;
    world.player.hp = Math.min(world.player.maxHearts, world.player.hp + 1);
  } else if (item.id === 'oil') world.oilBonus += 0.15;
  else if (item.id === 'relic') {
    const def = weightedRelic(world.rng, new Set(world.relics.map((r) => r.id)));
    applyRelic(world, def);
    addBanner(world, `RELIC — ${def.name}`, def.desc);
  }
  world.events.push('coin');
}

export function altarChoice(world, take) {
  if (world.phase !== 'altar') return;
  if (take) {
    if (world.player.maxHearts <= 1) {
      world.events.push('denied');
      return;
    }
    world.player.maxHearts -= 1;
    world.player.hp = Math.min(world.player.hp, world.player.maxHearts);
    applyRelic(world, world.altarOffer);
    addBanner(world, `THE ALTAR ACCEPTS — ${world.altarOffer.name}`, world.altarOffer.desc);
    world.events.push('altar');
  }
  world.room.cleared = true;
  world.phase = 'fight';
}

export function leaveShop(world) {
  if (world.phase !== 'shop') return;
  world.phase = 'fight';
}

export function startNextFloor(world) {
  world.floorIndex += 1;
  const endless = world.floorIndex >= FLOORS.length;
  world.floorData = generateFloor(world.seed + world.floorIndex * 101, world.floorIndex);
  world.roomId = 0;
  world.room = world.floorData.rooms[0];
  world.room.visited = true;
  world.enemies = [];
  world.bolts = [];
  world.globs = [];
  world.pickups = [];
  world.boss = null;
  world.chest = null;
  world.player.x = 640;
  world.player.y = 420;
  world.player.hp = Math.min(world.player.maxHearts, world.player.hp + 1);
  world.phase = 'fight';
  world.draftPicked = false;
  addBanner(world, world.floorData.floor.name, endless ? `Endless delve ${world.floorIndex + 1} · the dark grows hungrier` : world.floorData.floor.sub);
  world.events.push('floorClear');
}

function clearRoom(world) {
  const room = world.room;
  room.cleared = true;
  if (room.kind === 'boss') {
    world.events.push('floorClear');
    if (world.floorIndex === 0) world.feats.add('floor1');
    if (world.floorIndex === 1) world.feats.add('floor2');
    if (world.floorIndex >= 2) {
      world.phase = 'won';
      world.grade = gradeFor(world.score, world.player.hp, world.player.maxHearts, world.runTime);
      world.winStats = {
        score: world.score, grade: world.grade, floor: 3, kills: world.kills,
        time: Math.round(world.runTime), relics: world.relics.reduce((n, r) => n + r.count, 0),
        difficulty: world.difficulty, seed: world.seed, endless: world.endless,
      };
      world.events.push('win');
      return;
    }
    rollDraftOptions(world);
    world.phase = 'floorclear';
    return;
  }
  if (room.kind === 'elite') {
    addBanner(world, 'ELITE SLAIN', 'The deep yields a relic.');
  }
}

function checkRoomClear(world) {
  if (world.room.cleared) return;
  if (world.enemies.length === 0 && world.phase === 'fight') clearRoom(world);
}

function gainXp(world, amount) {
  world.xp += amount;
  while (world.xp >= world.xpNeed && world.phase === 'fight') {
    world.xp -= world.xpNeed;
    world.level += 1;
    world.xpNeed = xpForLevel(world.level);
    rollDraftOptions(world);
    world.phase = 'draft';
    world.events.push('levelup');
    break; // further levels queue behind this draft via applyDraft
  }
}

export function createWorld(seed, difficulty, endless) {
  const rng = makeRng(seed);
  const floorData = generateFloor(seed, 0);
  const world = {
    seed, difficulty: difficulty || 'delver', endless: !!endless,
    rng,
    floorIndex: 0, floorData,
    roomId: 0, room: floorData.rooms[0],
    phase: 'fight',
    player: {
      x: 640, y: 420, r: PLAYER.r, hp: PLAYER.maxHearts, maxHearts: PLAYER.maxHearts,
      vx: 0, vy: 0, fireCd: 0, dashCd: 0, dashT: 0, dashDx: 1, dashDy: 0,
      invulnT: 0, wardCharges: 0, wardT: 0, burstCd: 0, wardCd: 0,
    },
    relics: [], mods: null, oilBonus: 0,
    enemies: [], bolts: [], globs: [], pickups: [], particles: [], floaters: [],
    xp: 0, level: 1, xpNeed: xpForLevel(1), gold: 0,
    score: 0, kills: 0, combo: 0, comboTimer: 0, comboMult: 1,
    elitesSlain: 0, bossesSlain: 0, secondWindUsed: false,
    draftOptions: [], draftPicked: false,
    shopBought: new Set(), altarOffer: null,
    chest: null, boss: null,
    events: [], feats: new Set(),
    banner: null, shake: 0, fadeT: 0,
    runTime: 0, grade: null, winStats: null,
  };
  recomputeMods(world);
  world.room.visited = true;
  return world;
}

export function update(world, input, dt) {
  dt = Math.min(DT_MAX, dt);
  if (world.phase !== 'fight') return;
  const p = world.player;
  const m = world.mods;
  world.runTime += dt;
  if (world.fadeT > 0) world.fadeT -= dt;
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) world.banner = null;
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.combo = 0;
      world.comboMult = 1;
    }
  }
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.invulnT > 0) p.invulnT -= dt;
  if (p.burstCd > 0) p.burstCd -= dt;
  if (p.wardCd > 0) p.wardCd -= dt;
  if (p.wardT > 0) {
    p.wardT -= dt;
    if (p.wardT <= 0) p.wardCharges = 0;
  }

  // --- Movement & dash ---
  let mx = 0;
  let my = 0;
  if (input.down('w', 'arrowup')) my -= 1;
  if (input.down('s', 'arrowdown')) my += 1;
  if (input.down('a', 'arrowleft')) mx -= 1;
  if (input.down('d', 'arrowright')) mx += 1;
  const mLen = Math.hypot(mx, my) || 1;
  mx /= mLen;
  my /= mLen;
  if ((input.wasPressed('shift', ' ') || input.mouse.right) && p.dashCd <= 0 && p.dashT <= 0 && (mx !== 0 || my !== 0)) {
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown * m.dashCd;
    p.dashDx = mx;
    p.dashDy = my;
    world.events.push('dash');
    burst(world, p.x, p.y, 8, '#ffb35c', 120);
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dashDx * PLAYER.dashSpeed * dt;
    p.y += p.dashDy * PLAYER.dashSpeed * dt;
    world.particles.push({
      x: p.x, y: p.y, vx: 0, vy: -20, life: 0.3, maxLife: 0.3,
      color: '#ffb35c', size: 4,
    });
  } else {
    p.x += mx * PLAYER.speed * m.speed * dt;
    p.y += my * PLAYER.speed * m.speed * dt;
  }

  // --- Abilities ---
  if (input.wasPressed('1')) useAbility(world, 'burst');
  if (input.wasPressed('2')) useAbility(world, 'ward');

  // --- Fire ---
  if (input.mouse.left && p.fireCd <= 0) {
    fireBolt(world, input);
    p.fireCd = PLAYER.fireInterval / m.fireRate;
  }

  // --- Walls & doors ---
  const exits = world.floorData.exits[world.roomId] || {};
  const doorOpen = (dir) => {
    if (exits[dir] === undefined) return false;
    const target = roomById(world.floorData, exits[dir]);
    return world.room.cleared || (target && target.visited);
  };
  const inGapX = Math.abs(p.x - 640) < DOOR_W / 2;
  const inGapY = Math.abs(p.y - 360) < DOOR_W / 2;
  if (p.x - p.r < WALL && doorOpen('w') && inGapY) enterRoom(world, exits.w, 'w');
  else if (p.x + p.r > VIEW_W - WALL && doorOpen('e') && inGapY) enterRoom(world, exits.e, 'e');
  else if (p.y - p.r < WALL && doorOpen('n') && inGapX) enterRoom(world, exits.n, 'n');
  else if (p.y + p.r > VIEW_H - WALL && doorOpen('s') && inGapX) enterRoom(world, exits.s, 's');
  if (world.phase !== 'fight') return; // a door changed the phase (shop/altar)
  p.x = Math.max(WALL + p.r, Math.min(VIEW_W - WALL - p.r, p.x));
  p.y = Math.max(WALL + p.r, Math.min(VIEW_H - WALL - p.r, p.y));

  // --- Chest ---
  if (world.chest && !world.chest.opened) {
    if (Math.hypot(p.x - world.chest.x, p.y - world.chest.y) < 56) {
      world.chest.opened = true;
      world.room.chestOpened = true;
      world.room.cleared = true;
      world.gold += Math.round(40 * m.gold);
      const def = weightedRelic(world.rng, new Set(world.relics.map((r) => r.id)));
      applyRelic(world, def);
      addBanner(world, `TREASURE — ${def.name}`, def.desc);
      world.events.push('chest');
      burst(world, world.chest.x, world.chest.y, 24, '#ffd23d', 220);
    }
  }

  // --- Enemies ---
  const api = {
    shootGlob(x, y, vx, vy) {
      world.globs.push({ x, y, vx, vy, r: 7, damage: 1, life: 6 });
    },
    spawnMinion(kind, x, y) {
      const min = spawnEnemy(kind, x, y, world.floorIndex, world.rng);
      world.enemies.push(min);
    },
    burst(x, y, n, color) {
      burst(world, x, y, n, color, 160);
    },
  };
  for (const e of world.enemies) {
    if (e.dead) continue;
    updateEnemy(e, p, dt, api);
    e.x = Math.max(WALL + e.r, Math.min(VIEW_W - WALL - e.r, e.x));
    e.y = Math.max(WALL + e.r, Math.min(VIEW_H - WALL - e.r, e.y));
  }
  // Separation: foes do not stack on one spot.
  for (let i = 0; i < world.enemies.length; i += 1) {
    const a = world.enemies[i];
    if (a.dead) continue;
    for (let j = i + 1; j < world.enemies.length; j += 1) {
      const b = world.enemies[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
  // Touch damage.
  for (const e of world.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r - 2) {
      hurtPlayer(world, e.damage);
      // Knock the foe back a little so one touch is one hit.
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * 26;
      e.y += (dy / d) * 26;
      if (world.phase !== 'fight') return;
    }
  }

  // --- Bolts ---
  for (const b of world.bolts) {
    if (b.dead) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += Math.hypot(b.vx, b.vy) * dt;
    if (b.travelled > b.range || b.x < WALL || b.x > VIEW_W - WALL || b.y < WALL || b.y > VIEW_H - WALL) {
      b.dead = true;
      continue;
    }
    for (const e of world.enemies) {
      if (e.dead || b.hitSet.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 8) {
        const crit = world.rng.next() < m.crit;
        const dmg = Math.round(b.damage * (crit ? PLAYER.critMult : 1));
        e.hp -= dmg;
        e.hitFlash = 0.12;
        b.hitSet.add(e);
        addFloater(world, e.x, e.y - e.r - 4, `${dmg}`, crit ? '#ffd23d' : '#ffffff', crit);
        burst(world, b.x, b.y, 5, '#ffb35c', 120);
        if (e.hp <= 0) {
          killEnemy(world, e);
        } else if (b.bounce > 0) {
          // Bounce to the nearest other foe.
          let best = null;
          let bestD = 300;
          for (const o of world.enemies) {
            if (o.dead || o === e || b.hitSet.has(o)) continue;
            const d = Math.hypot(o.x - e.x, o.y - e.y);
            if (d < bestD) { bestD = d; best = o; }
          }
          if (best) {
            b.bounce -= 1;
            const a = Math.atan2(best.y - e.y, best.x - e.x);
            const sp = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(a) * sp;
            b.vy = Math.sin(a) * sp;
            b.x = e.x;
            b.y = e.y;
            b.travelled = 0;
          } else {
            b.dead = true;
          }
        } else if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          b.dead = true;
        }
        if (b.dead) break;
      }
    }
  }
  world.bolts = world.bolts.filter((b) => !b.dead);
  world.enemies = world.enemies.filter((e) => !e.dead);

  // --- Hostile globs ---
  for (const g of world.globs) {
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.life -= dt;
    if (g.life <= 0 || g.x < WALL || g.x > VIEW_W - WALL || g.y < WALL || g.y > VIEW_H - WALL) {
      g.dead = true;
      continue;
    }
    if (Math.hypot(g.x - p.x, g.y - p.y) < g.r + p.r - 2) {
      g.dead = true;
      hurtPlayer(world, g.damage);
      if (world.phase !== 'fight') return;
    }
  }
  world.globs = world.globs.filter((g) => !g.dead);

  // --- Pickups ---
  const magnetR = PLAYER.pickupRadius * m.magnet;
  for (const pk of world.pickups) {
    pk.t += dt;
    pk.life -= dt;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < magnetR) {
      const pull = 620 * (1 - d / (magnetR + 1));
      pk.vx += ((p.x - pk.x) / (d || 1)) * pull * dt * 4;
      pk.vy += ((p.y - pk.y) / (d || 1)) * pull * dt * 4;
    }
    pk.vx *= 0.92;
    pk.vy *= 0.92;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    if (d < p.r + 14) {
      pk.dead = true;
      if (pk.kind === 'shard') gainXp(world, pk.value);
      else if (pk.kind === 'gold') {
        world.gold += pk.value;
        world.events.push('coin');
      } else if (pk.kind === 'heart') {
        p.hp = Math.min(p.maxHearts, p.hp + 1);
        world.events.push('pickup');
        addFloater(world, p.x, p.y - 26, '+1 ♥', '#ff6a7a', false);
      } else if (pk.kind === 'relic') {
        const def = weightedRelic(world.rng, new Set(world.relics.map((r) => r.id)));
        applyRelic(world, def);
        addBanner(world, `RELIC — ${def.name}`, def.desc);
        world.events.push('chest');
      }
      if (world.phase !== 'fight') return; // a level-up opened the draft
    }
    if (pk.life <= 0) pk.dead = true;
  }
  world.pickups = world.pickups.filter((pk) => !pk.dead);

  // --- Particles & floaters ---
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  for (const f of world.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);

  checkRoomClear(world);
}

export { FEATS };
