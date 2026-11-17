// EMBERDEEP — canvas rendering of the delve itself.
// One clear job: draw the room, its walls and doors, torches, chest,
// foes, the lantern-bearer, bolts, pickups and particles, then the
// lantern-light darkness and the HUD (hearts, XP, gold, combo, boss bar,
// minimap, relics, abilities). Screens live in screens.js.

import { VIEW_W, VIEW_H, WALL, DOOR_W, PLAYER, ABILITIES, RARITY_COLOR, RELICS } from './config.js';

export const LAYOUT = {
  hud: { minimap: { x: VIEW_W - 218, y: 14, w: 204, h: 92 } },
};

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPanel(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill || 'rgba(8, 10, 22, 0.88)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = stroke || 'rgba(255, 179, 92, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawButton(ctx, r, label, sub, enabled, hover) {
  ctx.fillStyle = enabled ? (hover ? 'rgba(255, 179, 92, 0.28)' : 'rgba(255, 179, 92, 0.14)') : 'rgba(120, 120, 130, 0.12)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.strokeStyle = enabled ? '#ffb35c' : '#555';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = enabled ? '#ffe9c4' : '#888';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 10 : 0));
  if (sub) {
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = enabled ? '#c9b8a0' : '#777';
    ctx.fillText(sub, r.x + r.w / 2, r.y + r.h / 2 + 16);
  }
}

export function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -5, -10, 0, -5);
  ctx.bezierCurveTo(5, -10, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff5a6a' : 'rgba(255, 90, 106, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#ff8a96';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawWalls(ctx, world, t) {
  const pal = world.floorData.floor.palette;
  const exits = world.floorData.exits[world.roomId] || {};
  const doorOpen = (dir) => {
    if (exits[dir] === undefined) return false;
    return world.room.cleared;
  };
  ctx.fillStyle = pal.wall;
  // Four walls with door gaps at the centre of each edge.
  const gap = (cx, cy, horizontal) => {
    ctx.fillStyle = pal.wallTop;
    if (horizontal) ctx.fillRect(cx - DOOR_W / 2, cy - 8, DOOR_W, 16);
    else ctx.fillRect(cx - 8, cy - DOOR_W / 2, 16, DOOR_W);
  };
  // North
  ctx.fillRect(0, 0, VIEW_W, WALL);
  if (exits.n !== undefined) {
    ctx.fillStyle = doorOpen('n') ? pal.door : pal.wall;
    ctx.fillRect(640 - DOOR_W / 2, 0, DOOR_W, WALL);
    gap(640, WALL, true);
  }
  // South
  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, VIEW_H - WALL, VIEW_W, WALL);
  if (exits.s !== undefined) {
    ctx.fillStyle = doorOpen('s') ? pal.door : pal.wall;
    ctx.fillRect(640 - DOOR_W / 2, VIEW_H - WALL, DOOR_W, WALL);
    gap(640, VIEW_H - WALL, true);
  }
  // West
  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, 0, WALL, VIEW_H);
  if (exits.w !== undefined) {
    ctx.fillStyle = doorOpen('w') ? pal.door : pal.wall;
    ctx.fillRect(0, 360 - DOOR_W / 2, WALL, DOOR_W);
    gap(WALL, 360, false);
  }
  // East
  ctx.fillStyle = pal.wall;
  ctx.fillRect(VIEW_W - WALL, 0, WALL, VIEW_H);
  if (exits.e !== undefined) {
    ctx.fillStyle = doorOpen('e') ? pal.door : pal.wall;
    ctx.fillRect(VIEW_W - WALL, 360 - DOOR_W / 2, WALL, DOOR_W);
    gap(VIEW_W - WALL, 360, false);
  }
  // Wall top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, WALL - 4, VIEW_W, 4);
  ctx.fillRect(0, VIEW_H - WALL, VIEW_W, 4);
}

function mixWhite(hex) {
  // A hit flash that lightens the body colour instead of blanking it white.
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.45 + 255 * 0.55);
  const g = Math.round(((n >> 8) & 255) * 0.45 + 255 * 0.55);
  const b = Math.round((n & 255) * 0.45 + 255 * 0.55);
  return `rgb(${r},${g},${b})`;
}

function drawEnemy(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.hitFlash > 0;
  const body = flash ? mixWhite(e.color) : e.color;
  ctx.fillStyle = body;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  if (e.boss) {
    // Boss: big horned disc with a crown of spikes.
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#1a1026';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + t * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.r * 0.7, Math.sin(a) * e.r * 0.7);
      ctx.lineTo(Math.cos(a) * (e.r + 14), Math.sin(a) * (e.r + 14));
      ctx.lineTo(Math.cos(a + 0.35) * e.r * 0.7, Math.sin(a + 0.35) * e.r * 0.7);
      ctx.fill();
    }
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-14, -8, 6, 0, Math.PI * 2);
    ctx.arc(14, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2a1a';
    ctx.beginPath();
    ctx.arc(-14, -8, 3, 0, Math.PI * 2);
    ctx.arc(14, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    if (e.enraged) {
      ctx.strokeStyle = '#ff2a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 8 + Math.sin(t * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (e.shape === 'skitter') {
    ctx.rotate(Math.atan2(Math.sin(e.zig), Math.cos(e.zig)) * 0.4 + e.t);
    ctx.beginPath();
    ctx.moveTo(e.r + 6, 0);
    ctx.lineTo(-e.r, e.r * 0.8);
    ctx.lineTo(-e.r * 0.4, 0);
    ctx.lineTo(-e.r, -e.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.shape === 'spitter') {
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#12300e';
    ctx.beginPath();
    ctx.arc(0, 2, e.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.shape === 'brute') {
    roundRect(ctx, -e.r, -e.r, e.r * 2, e.r * 2, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-e.r + 5, -6, e.r * 2 - 10, 4);
    ctx.fillRect(-e.r + 5, 4, e.r * 2 - 10, 4);
  } else if (e.shape === 'wisp') {
    const wob = Math.sin(t * 5 + e.phase) * 3;
    ctx.beginPath();
    ctx.moveTo(0, -e.r - 6);
    ctx.quadraticCurveTo(e.r + wob, -4, e.r * 0.7, e.r);
    ctx.quadraticCurveTo(0, e.r - 6, -e.r * 0.7, e.r);
    ctx.quadraticCurveTo(-e.r - wob, -4, 0, -e.r - 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.shape === 'shardling') {
    ctx.rotate(Math.PI / 4 + Math.sin(e.t * 3) * 0.15);
    ctx.fillRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
    ctx.strokeRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-3, -3, 6, 6);
  } else if (e.shape === 'wraith') {
    ctx.globalAlpha = 0.75 + Math.sin(t * 6 + e.phase) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, -e.r - 8);
    ctx.quadraticCurveTo(e.r, -e.r * 0.4, e.r * 0.8, e.r);
    ctx.lineTo(-e.r * 0.8, e.r);
    ctx.quadraticCurveTo(-e.r, -e.r * 0.4, 0, -e.r - 8);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#12081f';
    ctx.beginPath();
    ctx.arc(-5, -4, 3, 0, Math.PI * 2);
    ctx.arc(5, -4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // mite: spiky ember
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? e.r + 4 : e.r - 2;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Elite crown
  if (e.elite) {
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(-12, -e.r - 2);
    ctx.lineTo(-12, -e.r - 12);
    ctx.lineTo(-6, -e.r - 5);
    ctx.lineTo(0, -e.r - 13);
    ctx.lineTo(6, -e.r - 5);
    ctx.lineTo(12, -e.r - 12);
    ctx.lineTo(12, -e.r - 2);
    ctx.closePath();
    ctx.fill();
  }
  // HP bar for hurt foes
  if (e.hp < e.maxHp && !e.boss) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-w / 2, -e.r - 10, w, 4);
    ctx.fillStyle = '#ff5a4d';
    ctx.fillRect(-w / 2, -e.r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
  }
  ctx.restore();
}

function drawPlayer(ctx, world, t, mouse) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnT > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  // A pool of lantern-light under the bearer, so the hero reads at a glance.
  const pool = ctx.createRadialGradient(0, 0, 4, 0, 0, 64);
  pool.addColorStop(0, 'rgba(255, 190, 100, 0.30)');
  pool.addColorStop(1, 'rgba(255, 190, 100, 0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.fill();
  // Dash trail is drawn by particles; the bearer is a hooded cloak.
  const aim = Math.atan2((mouse ? mouse.y : 360) - p.y, (mouse ? mouse.x : 640) - p.x);
  ctx.rotate(0);
  ctx.fillStyle = '#54407a';
  ctx.beginPath();
  ctx.moveTo(0, -p.r - 6);
  ctx.quadraticCurveTo(p.r + 6, -4, p.r * 0.8, p.r);
  ctx.quadraticCurveTo(0, p.r + 4, -p.r * 0.8, p.r);
  ctx.quadraticCurveTo(-p.r - 6, -4, 0, -p.r - 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 92, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Face
  ctx.fillStyle = '#f2d8b0';
  ctx.beginPath();
  ctx.arc(Math.cos(aim) * 3, Math.sin(aim) * 3 - 2, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Hood
  ctx.fillStyle = '#6b52a0';
  ctx.beginPath();
  ctx.arc(0, -4, 9, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  // The lantern, held toward the aim.
  const lx = Math.cos(aim) * (p.r + 10);
  const ly = Math.sin(aim) * (p.r + 10);
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(lx, ly, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4a12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lx, ly, 7, 0, Math.PI * 2);
  ctx.stroke();
  // Ward ring
  if (p.wardCharges > 0 && p.wardT > 0) {
    ctx.strokeStyle = 'rgba(106, 216, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 10 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawField(ctx, world, t, mouse) {
  const pal = world.floorData.floor.palette;
  // Floor tiles
  const tile = 64;
  for (let y = 0; y < VIEW_H / tile; y += 1) {
    for (let x = 0; x < VIEW_W / tile; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? pal.floor : pal.floorAlt;
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  // Speckles
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (const s of world.room.speckles) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawWalls(ctx, world, t);

  // Torches on the walls, flickering.
  for (const tor of world.room.torches) {
    const flick = 0.75 + Math.sin(t * 7 + tor.x) * 0.25;
    const g = ctx.createRadialGradient(tor.x, tor.y, 2, tor.x, tor.y, 90);
    g.addColorStop(0, `rgba(255, 179, 92, ${0.5 * flick})`);
    g.addColorStop(1, 'rgba(255, 179, 92, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(tor.x - 90, tor.y - 90, 180, 180);
    ctx.fillStyle = '#ffb35c';
    ctx.beginPath();
    ctx.arc(tor.x, tor.y, 5 + flick * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chest
  if (world.chest) {
    const c = world.chest;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (!c.opened) {
      const glow = 0.5 + Math.sin(t * 4) * 0.3;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
      g.addColorStop(0, `rgba(255, 210, 61, ${glow})`);
      g.addColorStop(1, 'rgba(255, 210, 61, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-90, -90, 180, 180);
    }
    ctx.fillStyle = c.opened ? '#5a4426' : '#8a5a30';
    roundRect(ctx, -26, -16, 52, 32, 5);
    ctx.fill();
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(-4, -20, 8, 8);
    ctx.restore();
  }

  // Pickups (skip ones already collected mid-frame)
  for (const pk of world.pickups) {
    if (pk.dead) continue;
    const bob = Math.sin(t * 4 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'shard') {
      ctx.fillStyle = '#6ad8ff';
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
    } else if (pk.kind === 'gold') {
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a67c00';
      ctx.stroke();
    } else if (pk.kind === 'heart') {
      drawHeart(ctx, 0, 0, 18, true);
    } else if (pk.kind === 'relic') {
      ctx.fillStyle = '#ffb35c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2408';
      ctx.font = 'bold 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
    }
    ctx.restore();
  }

  // Hostile globs
  for (const g of world.globs) {
    ctx.fillStyle = '#9dff6a';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(g.x - 2, g.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies
  for (const e of world.enemies) {
    if (!e.dead) drawEnemy(ctx, e, t);
  }

  // Bolts
  for (const b of world.bolts) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(-14, 0, 8, 0);
    g.addColorStop(0, 'rgba(255, 179, 92, 0)');
    g.addColorStop(1, '#ffe9c4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-3, 0, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating damage numbers
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / 0.9);
    ctx.font = f.big ? 'bold 20px Georgia, serif' : 'bold 14px Georgia, serif';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // The lantern-bearer, drawn above the dark.
  drawPlayer(ctx, world, t, mouse);

  // Lantern light: a soft glow, then the dark that closes in.
  const p = world.player;
  const lightR = PLAYER.lightRadius * world.mods.light;
  const glow = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, lightR);
  glow.addColorStop(0, 'rgba(255, 190, 100, 0.20)');
  glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - lightR, p.y - lightR, lightR * 2, lightR * 2);
  const dark = ctx.createRadialGradient(p.x, p.y, lightR * 0.55, p.x, p.y, lightR * 1.9);
  dark.addColorStop(0, 'rgba(2, 2, 10, 0)');
  dark.addColorStop(0.75, 'rgba(2, 2, 10, 0.30)');
  dark.addColorStop(1, 'rgba(2, 2, 10, 0.58)');
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Room banner
  if (world.banner) {
    const a = Math.min(1, world.banner.t / 0.6);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9c4';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(world.banner.text, 640, 128);
    if (world.banner.sub) {
      ctx.font = 'italic 17px Georgia, serif';
      ctx.fillStyle = '#c9b8a0';
      ctx.fillText(world.banner.sub, 640, 158);
    }
    ctx.globalAlpha = 1;
  }

  // Fade after a room change
  if (world.fadeT > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, world.fadeT / 0.3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawMinimap(ctx, world) {
  const box = LAYOUT.hud.minimap;
  drawPanel(ctx, box.x, box.y, box.w, box.h, 'rgba(8, 10, 22, 0.72)', 'rgba(255,255,255,0.14)');
  ctx.font = 'bold 11px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(world.floorData.floor.name, box.x + 8, box.y + 15);
  // Rooms are on a 6-wide, 3-tall grid (x 0..5, y -1..1).
  const cell = 22;
  const ox = box.x + 34;
  const oy = box.y + 30;
  for (const r of world.floorData.rooms) {
    const cx = ox + r.x * cell;
    const cy = oy + (r.y + 1) * cell;
    let color = 'rgba(160,160,180,0.35)';
    if (r.kind === 'boss') color = '#ff5a4d';
    else if (r.kind === 'shop') color = '#ffd23d';
    else if (r.kind === 'altar') color = '#b78cff';
    else if (r.kind === 'treasure') color = '#ffd23d';
    else if (r.kind === 'elite') color = '#ff9a3d';
    else if (r.kind === 'fork') color = '#6ad8ff';
    if (!r.visited) {
      ctx.fillStyle = 'rgba(120,120,140,0.18)';
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillRect(cx - 7, cy - 6, 14, 12);
    if (r.id === world.roomId) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 8, cy - 7, 16, 14);
    }
    if (r.kind === 'boss') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, cy + 3);
    }
  }
  ctx.font = '11px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  ctx.textAlign = 'left';
  ctx.fillText(`Room: ${world.room.kind.toUpperCase()}`, box.x + 8, box.y + box.h - 8);
}

export function drawHud(ctx, world, meta) {
  const p = world.player;
  // Top-left: hearts + XP + level
  for (let i = 0; i < p.maxHearts; i += 1) {
    drawHeart(ctx, 30 + i * 30, 32, 22, i < p.hp);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillStyle = '#ffe9c4';
  ctx.fillText(`Lv ${world.level}`, 22, 66);
  const xpW = 170;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(64, 55, xpW, 10);
  ctx.fillStyle = '#6ad8ff';
  ctx.fillRect(64, 55, xpW * Math.min(1, world.xp / world.xpNeed), 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(64, 55, xpW, 10);

  // Top-centre: score, gold, floor
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillStyle = '#ffe9c4';
  ctx.fillText(`${world.score}`, 640, 34);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#ffd23d';
  ctx.fillText(`◈ ${world.gold} gold`, 640, 56);
  ctx.fillStyle = '#c9b8a0';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(`${world.floorData.floor.name} · ${world.room.kind.toUpperCase()} ROOM`, 640, 76);

  // Combo
  if (world.comboMult > 1) {
    ctx.font = 'bold 19px Georgia, serif';
    ctx.fillStyle = '#ff9a3d';
    ctx.fillText(`x${world.comboMult} COMBO`, 640, 104);
    ctx.fillStyle = 'rgba(255,154,61,0.5)';
    ctx.fillRect(590, 112, 100 * Math.max(0, world.comboTimer / 3), 4);
  }

  // Boss bar
  const boss = world.boss && !world.boss.dead ? world.boss : null;
  if (boss) {
    const bw = 460;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillStyle = '#ffb3a8';
    ctx.fillText(boss.name, 640, 178);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(640 - bw / 2, 186, bw, 12);
    ctx.fillStyle = boss.enraged ? '#ff2a1a' : '#ff5a4d';
    ctx.fillRect(640 - bw / 2, 186, bw * Math.max(0, boss.hp / boss.maxHp), 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(640 - bw / 2, 186, bw, 12);
  }

  drawMinimap(ctx, world);

  // Bottom-left: relics owned
  ctx.textAlign = 'left';
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  ctx.fillText('RELICS', 22, VIEW_H - 56);
  world.relics.forEach((r, i) => {
    const def = RELICS.find((d) => d.id === r.id);
    if (!def) return;
    const x = 22 + i * 34;
    const y = VIEW_H - 44;
    ctx.fillStyle = RARITY_COLOR[def.rarity];
    ctx.save();
    ctx.translate(x + 12, y + 12);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = '#12081f';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.name[0], x + 12, y + 16);
    if (r.count > 1) {
      ctx.fillStyle = '#ffe9c4';
      ctx.font = 'bold 10px Georgia, serif';
      ctx.fillText(`x${r.count}`, x + 24, y + 8);
    }
  });

  // Bottom-centre: abilities + dash
  const abY = VIEW_H - 52;
  const defs = [
    { key: '1', name: ABILITIES.burst.name, cd: p.burstCd, max: ABILITIES.burst.cooldown * (world.mods.nova ? 0.75 : 1) },
    { key: '2', name: ABILITIES.ward.name, cd: p.wardCd, max: ABILITIES.ward.cooldown },
    { key: 'SHIFT', name: 'Dash', cd: p.dashCd, max: PLAYER.dashCooldown * world.mods.dashCd },
  ];
  defs.forEach((a, i) => {
    const x = 500 + i * 96;
    const ready = a.cd <= 0;
    ctx.fillStyle = ready ? 'rgba(255, 179, 92, 0.22)' : 'rgba(0,0,0,0.55)';
    roundRect(ctx, x, abY, 86, 40, 8);
    ctx.fill();
    ctx.strokeStyle = ready ? '#ffb35c' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (!ready) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, abY, 86, 40 * (a.cd / a.max));
    }
    ctx.fillStyle = ready ? '#ffe9c4' : '#999';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[${a.key}] ${a.name}`, x + 43, abY + 17);
    ctx.font = '11px Georgia, serif';
    ctx.fillText(ready ? 'READY' : `${a.cd.toFixed(1)}s`, x + 43, abY + 32);
  });

  // Bottom-right: run stats
  ctx.textAlign = 'right';
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  ctx.fillText(`Kills ${world.kills} · ${Math.floor(world.runTime / 60)}:${String(Math.floor(world.runTime % 60)).padStart(2, '0')}`, VIEW_W - 22, VIEW_H - 24);
  ctx.fillText(`Best ${meta.bestScore}`, VIEW_W - 22, VIEW_H - 44);
}
