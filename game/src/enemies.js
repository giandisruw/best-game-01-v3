// EMBERDEEP — enemy behaviour.
// One clear job: how each foe moves, attacks and dies, and how the three
// floor bosses fight — the steering, lunges, volleys and summons that make
// every room play differently. world.js owns the state; this file owns
// the per-kind motion and the boss phases.

import { ENEMIES, BOSSES, ELITE_MULT } from './config.js';

// Spawn one enemy of a kind at a position. 'elite:kind' marks an elite;
// boss kinds spawn from BOSSES instead.
export function spawnEnemy(kind, x, y, floorIndex, rng) {
  let elite = false;
  if (kind.startsWith('elite:')) {
    elite = true;
    kind = kind.slice(6);
  }
  if (BOSSES[kind]) return spawnBoss(kind, x, y, floorIndex);
  const def = ENEMIES[kind];
  const hpScale = 1 + floorIndex * 0.35;
  const hp = Math.round(def.hp * hpScale * (elite ? ELITE_MULT.hp : 1));
  return {
    kind, elite, boss: null,
    x, y, hp, maxHp: hp,
    r: def.r * (elite ? ELITE_MULT.r : 1),
    speed: def.speed * (elite ? ELITE_MULT.speed : 1) * (0.9 + rng.next() * 0.2),
    damage: def.damage, score: def.score * (elite ? ELITE_MULT.score : 1),
    gold: def.gold * (elite ? ELITE_MULT.gold : 1),
    xp: def.xp * (elite ? ELITE_MULT.xp : 1),
    color: def.color, shape: def.shape, name: elite ? `Elite ${def.name}` : def.name,
    vx: 0, vy: 0, t: rng.next() * 10, attackCd: rng.range(0.5, 1.5),
    hitFlash: 0, zig: rng.next() * Math.PI * 2, phase: rng.next() * Math.PI * 2,
    shootCd: rng.range(1.2, 2.2), teleportCd: 5, chargeState: 0, chargeT: 0,
    splitDone: false, dead: false,
  };
}

export function spawnBoss(kind, x, y, floorIndex) {
  const def = BOSSES[kind];
  const hp = Math.round(def.hp * (1 + floorIndex * 0.15));
  return {
    kind, elite: false, boss: kind,
    x, y, hp, maxHp: hp,
    r: def.r, speed: def.speed, damage: 1, score: def.score,
    gold: def.gold, xp: def.xp,
    color: def.color, shape: 'boss', name: def.name,
    vx: 0, vy: 0, t: 0, attackCd: 2, hitFlash: 0,
    zig: 0, phase: 0, shootCd: 2.5, teleportCd: 6,
    chargeState: 0, chargeT: 0, enraged: false, summonCd: 7,
    splitDone: false, dead: false,
  };
}

// Steer an enemy toward the player for dt seconds. Returns nothing;
// mutates the enemy. `api` gives the enemy access to world events:
//   api.shootGlob(x, y, vx, vy) — a hostile projectile
//   api.spawnMinion(kind, x, y) — a new foe joins the room
//   api.burst(x, y, n, color) — a particle burst for telegraphs
export function updateEnemy(e, player, dt, api) {
  e.t += dt;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  if (e.boss) {
    updateBoss(e, player, dt, api, nx, ny, dist);
    return;
  }

  switch (e.shape) {
    case 'mite':
    case 'brute': {
      // Drift straight at the player, wobbling slightly.
      const wob = Math.sin(e.t * 2 + e.phase) * 0.35;
      e.x += (nx + -ny * wob) * e.speed * dt;
      e.y += (ny + nx * wob) * e.speed * dt;
      break;
    }
    case 'skitter': {
      // Fast zigzag: dart perpendicular, flipping direction often.
      e.zig += dt * 3.2;
      const side = Math.sin(e.zig) > 0 ? 1 : -1;
      e.x += (nx * 0.7 + -ny * side * 0.9) * e.speed * dt;
      e.y += (ny * 0.7 + nx * side * 0.9) * e.speed * dt;
      break;
    }
    case 'spitter': {
      // Keep its distance and spit globs.
      if (dist > 340) {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (dist < 200) {
        e.x -= nx * e.speed * 0.8 * dt;
        e.y -= ny * e.speed * 0.8 * dt;
      }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist < 560) {
        e.shootCd = 2.4;
        api.shootGlob(e.x, e.y, nx * 210, ny * 210);
      }
      break;
    }
    case 'wisp': {
      // Sine drift: slides sideways while closing in, hard to lead.
      const s = Math.sin(e.t * 3 + e.phase);
      e.x += (nx * 0.8 + -ny * s * 0.8) * e.speed * dt;
      e.y += (ny * 0.8 + nx * s * 0.8) * e.speed * dt;
      break;
    }
    case 'shardling': {
      // Hops toward the player in bursts.
      const hop = Math.sin(e.t * 4 + e.phase) > 0 ? 1.5 : 0.25;
      e.x += nx * e.speed * hop * dt;
      e.y += ny * e.speed * hop * dt;
      break;
    }
    case 'wraith': {
      // Fades, teleports near the player, then lunges.
      e.teleportCd -= dt;
      if (e.teleportCd <= 0) {
        e.teleportCd = 5;
        const a = Math.atan2(dy, dx) + Math.PI;
        e.x = player.x + Math.cos(a) * 190;
        e.y = player.y + Math.sin(a) * 190;
        e.chargeState = 1;
        e.chargeT = 0.55;
        api.burst(e.x, e.y, 10, '#e8e8ff');
      }
      if (e.chargeState === 1) {
        e.chargeT -= dt;
        if (e.chargeT <= 0) e.chargeState = 2;
      } else if (e.chargeState === 2) {
        e.x += nx * e.speed * 2.8 * dt;
        e.y += ny * e.speed * 2.8 * dt;
        if (dist < 30) e.chargeState = 0;
      } else {
        e.x += nx * e.speed * 0.55 * dt;
        e.y += ny * e.speed * 0.55 * dt;
      }
      break;
    }
    default: {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    }
  }
}

function updateBoss(e, player, dt, api, nx, ny, dist) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const enrage = e.hp < e.maxHp * 0.5;
  if (enrage && !e.enraged) {
    e.enraged = true;
    e.speed *= 1.35;
    api.burst(e.x, e.y, 30, e.color);
  }
  const mult = enrage ? 1.35 : 1;

  if (e.boss === 'maw') {
    // Cinder Maw: stalk, then telegraph and charge across the room.
    if (e.chargeState === 0) {
      e.x += nx * e.speed * mult * dt;
      e.y += ny * e.speed * mult * dt;
      e.attackCd -= dt;
      if (e.attackCd <= 0 && dist > 120) {
        e.attackCd = 3.6 / mult;
        e.chargeState = 1; // telegraph
        e.chargeT = 0.7;
        e.vx = nx;
        e.vy = ny;
      }
    } else if (e.chargeState === 1) {
      e.chargeT -= dt;
      if (e.chargeT <= 0) {
        e.chargeState = 2;
        e.chargeT = 0.6;
      }
    } else {
      e.x += e.vx * 640 * dt;
      e.y += e.vy * 640 * dt;
      e.chargeT -= dt;
      if (e.chargeT <= 0) {
        e.chargeState = 0;
        e.attackCd = 2.2;
      }
    }
    // At half health it births mites.
    if (enrage) {
      e.summonCd -= dt;
      if (e.summonCd <= 0) {
        e.summonCd = 8;
        api.spawnMinion('mite', e.x + 40, e.y);
        api.spawnMinion('mite', e.x - 40, e.y);
      }
    }
    return;
  }

  if (e.boss === 'mother') {
    // Spore Mother: slow drift, radial spore rings, births shardlings.
    e.x += nx * e.speed * mult * dt;
    e.y += ny * e.speed * mult * dt;
    e.shootCd -= dt;
    if (e.shootCd <= 0) {
      e.shootCd = 3.1 / mult;
      const n = 8;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + e.t;
        api.shootGlob(e.x, e.y, Math.cos(a) * 170, Math.sin(a) * 170);
      }
      api.burst(e.x, e.y, 14, '#9dff6a');
    }
    e.summonCd -= dt;
    if (e.summonCd <= 0) {
      e.summonCd = 9;
      api.spawnMinion('shardling', e.x + 60, e.y + 20);
      api.spawnMinion('shardling', e.x - 60, e.y - 20);
    }
    return;
  }

  // The Hollow King: keeps range, fires aimed volleys, blinks around.
  if (dist < 260) {
    e.x -= nx * e.speed * mult * dt;
    e.y -= ny * e.speed * mult * dt;
  } else if (dist > 420) {
    e.x += nx * e.speed * mult * dt;
    e.y += ny * e.speed * mult * dt;
  }
  e.shootCd -= dt;
  if (e.shootCd <= 0) {
    e.shootCd = (enrage ? 1.5 : 2.2);
    const shots = enrage ? 5 : 3;
    for (let i = 0; i < shots; i += 1) {
      const spread = (i - (shots - 1) / 2) * 0.22;
      const a = Math.atan2(dy, dx) + spread;
      api.shootGlob(e.x, e.y, Math.cos(a) * 260, Math.sin(a) * 260);
    }
  }
  e.teleportCd -= dt;
  if (e.teleportCd <= 0) {
    e.teleportCd = 7;
    api.burst(e.x, e.y, 16, '#c9b8ff');
    const a = Math.random() * Math.PI * 2;
    e.x = 640 + Math.cos(a) * 260;
    e.y = 360 + Math.sin(a) * 180;
    api.burst(e.x, e.y, 16, '#c9b8ff');
  }
  if (enrage) {
    e.summonCd -= dt;
    if (e.summonCd <= 0) {
      e.summonCd = 10;
      api.spawnMinion('wraith', e.x + 50, e.y);
    }
  }
}
