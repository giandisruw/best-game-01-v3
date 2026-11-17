// EMBERDEEP — floor and room generation.
// One clear job: turn a seed and a floor index into the room graph the
// player delves through: six rooms (start, two combats, a fork of elite
// versus treasure, a shop or altar, and the boss), each with its exits,
// its spawn table and its torches. Pure data — world.js plays it.

import { FLOORS, ROOM_KINDS } from './config.js';
import { makeRng } from './random.js';

// Room map coordinates (a small diamond so the minimap reads at a glance):
//   start (0,0) -> combat (1,0) -> combat (2,0)
//   fork: elite (2,-1) or treasure (2,1), both -> mid (3,0) -> boss (4,0)
const ROOM_POS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 0 },
];

function combatCount(floorIndex, kind, rng) {
  // More foes deeper down; elites rooms hold fewer, tougher foes.
  // Floor 1 opens gently: 3-4 foes a room, so the first delve is fair.
  if (floorIndex === 0) return 3 + rng.int(0, 1);
  const base = 4 + floorIndex * 2;
  if (kind === 'elite') return 1;
  if (kind === 'boss') return 0;
  return base + rng.int(0, 2);
}

function pickSpawnTypes(floor, rng, count, allowElite) {
  const types = [];
  for (let i = 0; i < count; i += 1) {
    // Deeper floors weight the nastier end of their roster.
    const roster = floor.enemies;
    const idx = Math.min(roster.length - 1, Math.floor(rng.next() * roster.length * 0.8 + rng.next() * roster.length * 0.2));
    types.push(roster[idx]);
  }
  if (allowElite && types.length > 0) {
    // One elite per fork room, marked by a crown in the render.
    types[Math.floor(rng.next() * types.length)] = `elite:${types[0]}`;
  }
  return types;
}

export function generateFloor(seed, floorIndex) {
  const floor = FLOORS[floorIndex % FLOORS.length];
  const rng = makeRng(seed * 31 + floorIndex * 7919 + 13);
  const midKind = floor.midRoom; // 'shop' or 'altar'
  const rooms = [];

  for (let i = 0; i < 6; i += 1) {
    const baseKind = ROOM_KINDS[i];
    let kind = baseKind;
    let spawn = [];
    if (baseKind === 'fork') {
      // The fork offers two doors: the elite room (north) or the treasure
      // room (south). Both are real rooms; the player picks one per run.
      kind = 'fork';
    } else if (baseKind === 'combat') {
      spawn = pickSpawnTypes(floor, rng, combatCount(floorIndex, 'combat', rng), false);
    } else if (baseKind === 'mid') {
      kind = midKind;
    } else if (baseKind === 'boss') {
      spawn = [floor.boss];
    }
    rooms.push({
      id: i,
      kind,
      x: ROOM_POS[i].x,
      y: ROOM_POS[i].y,
      spawn,
      eliteFork: false,
      cleared: baseKind === 'start',
      visited: i === 0,
      chestOpened: false,
      spawned: false, // set on first entry: re-entering a room never
      // respawns its foes (retreating from a boss, then walking back in,
      // used to summon a second boss).
      // Two wall torches per room, placed by seed so every room differs.
      torches: [
        { x: 120 + rng.range(-30, 30), y: 120 + rng.range(-20, 20) },
        { x: 1160 + rng.range(-30, 30), y: 600 + rng.range(-20, 20) },
      ],
      // Floor speckles for the renderer (deterministic per room).
      speckles: Array.from({ length: 26 }, () => ({
        x: rng.range(70, 1210), y: rng.range(70, 650), r: rng.range(1, 3.5),
      })),
    });
  }

  // The fork room (id 3) is entered from room 2; inside it the player
  // chooses the north door (elite) or the south door (treasure). Both
  // choice rooms sit at id 6 and 7 and lead on to the mid room (id 4).
  const eliteRoom = {
    id: 6, kind: 'elite', x: 3, y: -1,
    spawn: pickSpawnTypes(floor, rng, 2, true),
    eliteFork: false, cleared: false, visited: false, chestOpened: false, spawned: false,
    torches: [{ x: 140, y: 130 }, { x: 1140, y: 590 }],
    speckles: Array.from({ length: 22 }, () => ({
      x: rng.range(70, 1210), y: rng.range(70, 650), r: rng.range(1, 3),
    })),
  };
  const treasureRoom = {
    id: 7, kind: 'treasure', x: 3, y: 1,
    spawn: [], eliteFork: false, cleared: false, visited: false, chestOpened: false, spawned: false,
    torches: [{ x: 140, y: 590 }, { x: 1140, y: 130 }],
    speckles: Array.from({ length: 22 }, () => ({
      x: rng.range(70, 1210), y: rng.range(70, 650), r: rng.range(1, 3),
    })),
  };
  rooms.push(eliteRoom, treasureRoom);

  // Exits: direction -> room id. Doors open only when the room is cleared.
  const exits = {
    0: { e: 1 },
    1: { w: 0, e: 2 },
    2: { w: 1, e: 3 },
    3: { w: 2, n: 6, s: 7 },
    6: { s: 3, e: 4 },
    7: { n: 3, e: 4 },
    4: { w: 3, e: 5 },
    5: { w: 4 },
  };
  // Mid room (4) is reached from either fork choice; its west door leads
  // back to the room the player came from — resolved at runtime.
  return { floor, floorIndex, rooms, exits, seed };
}

export function roomById(floorData, id) {
  return floorData.rooms.find((r) => r.id === id);
}

// Where the player appears when entering a room from a given direction.
export function entryPoint(dir) {
  if (dir === 'e') return { x: 110, y: 360 };
  if (dir === 'w') return { x: 1170, y: 360 };
  if (dir === 'n') return { x: 640, y: 620 };
  if (dir === 's') return { x: 640, y: 100 };
  return { x: 640, y: 360 };
}

// Which door of the new room the player came through (for the minimap).
export function oppositeDir(dir) {
  return { n: 's', s: 'n', e: 'w', w: 'e' }[dir] || 'w';
}
