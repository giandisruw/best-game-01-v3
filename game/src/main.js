// EMBERDEEP — main loop and screens.
// One clear job: own the canvas, the screen state machine, the meta layer
// (best score, run history, feats, endless unlock, same-seed replay) and
// the wiring between input, world, render, screens and audio. Rules live
// in world.js.

import { VIEW_W, VIEW_H, FEATS } from './config.js';
import { createWorld, update, applyDraft, buyShop, altarChoice, leaveShop, startNextFloor, useAbility } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawField, drawHud, inRect } from './render.js';
import {
  LAYOUT, drawTitle, drawHowTo, drawDraft, drawShop, drawAltar,
  drawFloorClear, drawWin, drawLose, drawPause,
} from './screens.js';
import { buildShotScene } from './shots.js';

const META_KEY = 'emberdeep-meta-v1';
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const input = createInput(canvas);
const audio = createAudio();

function loadMeta() {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return { bestScore: 0, runs: [], feats: [], endlessUnlocked: false, lastSeed: 7 };
    const m = JSON.parse(raw);
    return {
      bestScore: m.bestScore || 0,
      runs: Array.isArray(m.runs) ? m.runs : [],
      feats: Array.isArray(m.feats) ? m.feats : [],
      endlessUnlocked: !!m.endlessUnlocked,
      lastSeed: m.lastSeed || 7,
    };
  } catch {
    return { bestScore: 0, runs: [], feats: [], endlessUnlocked: false, lastSeed: 7 };
  }
}

function saveMeta(meta) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Private mode or blocked storage: the game still plays.
  }
}

const meta = loadMeta();

function newSeed() {
  return (Math.random() * 2147483646 + 1) | 0;
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const shotMode = !!shotName;

let screen = 'title';
let difficulty = 'delver';
let world = null;
let isNewBest = false;
let statusText = '';
let lastStatusAt = 0;

function setStatus(s) {
  statusText = s;
  statusEl.textContent = s;
}

function startRun(seed, diff, endless) {
  world = createWorld(seed, diff, endless);
  screen = 'play';
  isNewBest = false;
  setStatus(`Floor 1, ${world.floorData.floor.name}. Clear the room, then take a door.`);
  audio.unlock();
}

function backToTitle() {
  world = createWorld(meta.lastSeed, difficulty);
  screen = 'title';
  setStatus('Emberdeep title screen. Choose a difficulty and light the lantern.');
}

function recordRun(result) {
  const run = { floor: world.floorIndex + 1, score: world.score, result, difficulty: world.difficulty };
  meta.runs.unshift(run);
  meta.runs = meta.runs.slice(0, 3);
  for (const f of world.feats) {
    if (!meta.feats.includes(f)) meta.feats.push(f);
  }
  if (result === 'WIN') {
    meta.endlessUnlocked = true;
    if (world.score > meta.bestScore) {
      meta.bestScore = world.score;
      isNewBest = true;
    }
  } else if (world.score > meta.bestScore) {
    meta.bestScore = world.score;
  }
  meta.lastSeed = world.seed;
  saveMeta(meta);
}

function handleWorldEvents() {
  if (!world) return;
  for (const ev of world.events) {
    if (ev === 'shoot') audio.shoot();
    else if (ev === 'kill') audio.kill();
    else if (ev === 'hit') audio.hit();
    else if (ev === 'dash') audio.dash();
    else if (ev === 'pickup') audio.pickup();
    else if (ev === 'coin') audio.coin();
    else if (ev === 'levelup') audio.levelup();
    else if (ev === 'draft') audio.draft();
    else if (ev === 'burst') audio.burst();
    else if (ev === 'ward') audio.ward();
    else if (ev === 'door') audio.door();
    else if (ev === 'chest') audio.chest();
    else if (ev === 'altar') audio.altar();
    else if (ev === 'boss') audio.boss();
    else if (ev === 'floorClear') audio.floorClear();
    else if (ev === 'win') audio.win();
    else if (ev === 'lose') audio.lose();
    else if (ev === 'denied') audio.denied();
    else if (ev.startsWith('feat:')) {
      const feat = FEATS.find((f) => f.id === ev.slice(5));
      if (feat) setStatus(`Feat unlocked: ${feat.name} — ${feat.desc}`);
    }
  }
  world.events.length = 0;
  if (world.phase === 'won' && screen === 'play') {
    recordRun('WIN');
    screen = 'win';
    setStatus(`The Hollow is lit. Grade ${world.grade}. Score ${world.score}.`);
  } else if (world.phase === 'lost' && screen === 'play') {
    recordRun('LOST');
    screen = 'lose';
    setStatus(`The light goes out on floor ${world.floorIndex + 1}. Score ${world.score}.`);
  } else if (world.phase === 'draft' && screen === 'play') {
    screen = 'draft';
    setStatus(`Level ${world.level}. Choose a relic.`);
  } else if (world.phase === 'shop' && screen === 'play') {
    screen = 'shop';
    setStatus('The delver’s shop. Spend gold, then leave.');
  } else if (world.phase === 'altar' && screen === 'play') {
    screen = 'altar';
    setStatus('The Hollow Altar offers an epic relic — for one max heart.');
  } else if (world.phase === 'floorclear' && screen === 'play') {
    screen = 'floorclear';
    setStatus(`Floor ${world.floorIndex + 1} cleared. Choose a relic, then descend.`);
  }
}

function clickIn(rect, clicks) {
  return clicks.find((c) => inRect(c.x, c.y, rect));
}

// --- Screen handlers (one per screen, called once per frame) ---

function titleFrame(clicks) {
  if (input.wasPressed('h')) { screen = 'howto'; return; }
  if (input.wasPressed('1')) difficulty = 'delver';
  if (input.wasPressed('2')) difficulty = 'abyssal';
  if (clickIn(LAYOUT.title.delver, clicks)) difficulty = 'delver';
  if (clickIn(LAYOUT.title.abyssal, clicks)) difficulty = 'abyssal';
  if (clickIn(LAYOUT.title.howto, clicks)) { screen = 'howto'; return; }
  if (clickIn(LAYOUT.title.start, clicks) || input.wasPressed(' ', 'enter')) {
    startRun(newSeed(), difficulty, false);
  }
}

function howtoFrame(clicks) {
  if (clickIn(LAYOUT.howto.back, clicks) || input.wasPressed('h', 'escape')) screen = 'title';
}

function playFrame(clicks, dt) {
  if (input.wasPressed('p', 'escape')) { screen = 'pause'; return; }
  if (input.wasPressed('m')) {
    const muted = audio.toggleMute();
    setStatus(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (input.wasPressed('r')) { startRun(newSeed(), difficulty, false); return; }
  update(world, input, dt);
  handleWorldEvents();
  const now = performance.now();
  if (now - lastStatusAt > 5000 && screen === 'play') {
    lastStatusAt = now;
    setStatus(`Floor ${world.floorIndex + 1}, ${world.room.kind} room. ${world.player.hp} hearts, level ${world.level}, ${world.gold} gold, score ${world.score}.`);
  }
}

function draftFrame(clicks) {
  if (input.wasPressed('1') && world.draftOptions[0]) applyDraft(world, world.draftOptions[0].id);
  else if (input.wasPressed('2') && world.draftOptions[1]) applyDraft(world, world.draftOptions[1].id);
  else if (input.wasPressed('3') && world.draftOptions[2]) applyDraft(world, world.draftOptions[2].id);
  else {
    for (const c of clicks) {
      world.draftOptions.forEach((card, i) => {
        if (inRect(c.x, c.y, LAYOUT.draft.cards[i])) applyDraft(world, card.id);
      });
    }
  }
  handleWorldEvents();
  if (world.phase === 'fight') {
    screen = 'play';
    setStatus(`Level ${world.level}. The delve continues.`);
  }
}

function shopFrame(clicks) {
  if (input.wasPressed('1')) buyShop(world, 'heal');
  else if (input.wasPressed('2')) buyShop(world, 'maxheart');
  else if (input.wasPressed('3')) buyShop(world, 'oil');
  else if (input.wasPressed('4')) buyShop(world, 'relic');
  else if (input.wasPressed('e', 'escape')) { leaveShop(world); screen = 'play'; return; }
  else {
    for (const c of clicks) {
      const ids = ['heal', 'maxheart', 'oil', 'relic'];
      ids.forEach((id, i) => {
        if (inRect(c.x, c.y, LAYOUT.shop.items[i])) buyShop(world, id);
      });
      if (inRect(c.x, c.y, LAYOUT.shop.leave)) { leaveShop(world); screen = 'play'; return; }
    }
  }
  handleWorldEvents();
}

function altarFrame(clicks) {
  if (input.wasPressed('1')) { altarChoice(world, true); screen = 'play'; return; }
  if (input.wasPressed('e', 'escape', '2')) { altarChoice(world, false); screen = 'play'; return; }
  for (const c of clicks) {
    if (inRect(c.x, c.y, LAYOUT.altar.take)) { altarChoice(world, true); screen = 'play'; return; }
    if (inRect(c.x, c.y, LAYOUT.altar.leave)) { altarChoice(world, false); screen = 'play'; return; }
  }
  handleWorldEvents();
}

function floorclearFrame(clicks) {
  if (input.wasPressed('1') && world.draftOptions[0]) applyDraft(world, world.draftOptions[0].id);
  else if (input.wasPressed('2') && world.draftOptions[1]) applyDraft(world, world.draftOptions[1].id);
  else if (input.wasPressed('3') && world.draftOptions[2]) applyDraft(world, world.draftOptions[2].id);
  else {
    for (const c of clicks) {
      world.draftOptions.forEach((card, i) => {
        if (inRect(c.x, c.y, LAYOUT.floorclear.cards[i])) applyDraft(world, card.id);
      });
      if (inRect(c.x, c.y, LAYOUT.floorclear.continue) && world.draftPicked) {
        startNextFloor(world);
        screen = 'play';
        setStatus(`Floor ${world.floorIndex + 1}, ${world.floorData.floor.name}.`);
        return;
      }
    }
  }
  handleWorldEvents();
}

function pauseFrame(clicks) {
  if (input.wasPressed('p', 'escape')) { screen = 'play'; return; }
  if (input.wasPressed('r')) { startRun(newSeed(), difficulty, false); return; }
  if (clickIn(LAYOUT.pause.resume, clicks)) screen = 'play';
  else if (clickIn(LAYOUT.pause.restart, clicks)) startRun(newSeed(), difficulty, false);
  else if (clickIn(LAYOUT.pause.quit, clicks)) backToTitle();
}

function winFrame(clicks) {
  if (input.wasPressed('r', ' ')) { startRun(newSeed(), difficulty, false); return; }
  for (const c of clicks) {
    if (inRect(c.x, c.y, LAYOUT.win.endless)) {
      world.endless = true;
      startNextFloor(world);
      screen = 'play';
      setStatus('Endless delve. The dark grows hungrier.');
      return;
    }
    if (inRect(c.x, c.y, LAYOUT.win.replay)) { startRun(world.seed, difficulty, false); return; }
    if (inRect(c.x, c.y, LAYOUT.win.title)) { backToTitle(); return; }
  }
}

function loseFrame(clicks) {
  if (input.wasPressed('r', ' ')) { startRun(newSeed(), difficulty, false); return; }
  if (clickIn(LAYOUT.lose.restart, clicks)) startRun(newSeed(), difficulty, false);
}

// --- Setup ---

if (shotMode) {
  const scene = buildShotScene(shotName, Number.isFinite(seedParam) ? seedParam : 7);
  world = scene.world;
  screen = scene.screen;
  if (screen === 'win') {
    isNewBest = true;
    meta.bestScore = Math.max(meta.bestScore, world.score);
    for (const f of world.feats) {
      if (!meta.feats.includes(f)) meta.feats.push(f);
    }
  }
} else {
  backToTitle();
}
setStatus('Emberdeep. Delve three floors and bring the light back.');

window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('mousedown', () => audio.unlock(), { once: true });

// Exposed for the playtest harness and the shot scenes.
window.__emberdeep = {
  get screen() { return screen; },
  get world() { return world; },
  get meta() { return meta; },
  get difficulty() { return difficulty; },
};

let lastT = performance.now();
let frames = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  const clicks = input.takeClicks();

  ctx.save();
  if (world && world.shake > 0 && screen === 'play') {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  if (screen === 'title') drawTitle(ctx, world, meta, difficulty, now / 1000);
  else if (screen === 'howto') drawHowTo(ctx);
  else if (screen === 'play') {
    drawField(ctx, world, now / 1000, input.mouse);
    drawHud(ctx, world, meta);
  } else if (screen === 'draft') {
    drawField(ctx, world, now / 1000, input.mouse);
    drawDraft(ctx, world, meta, input.mouse);
  } else if (screen === 'shop') {
    drawField(ctx, world, now / 1000, input.mouse);
    drawShop(ctx, world, input.mouse);
  } else if (screen === 'altar') {
    drawField(ctx, world, now / 1000, input.mouse);
    drawAltar(ctx, world, input.mouse);
  } else if (screen === 'floorclear') {
    drawField(ctx, world, now / 1000, input.mouse);
    drawFloorClear(ctx, world, meta, input.mouse);
  } else if (screen === 'pause') {
    drawField(ctx, world, now / 1000, input.mouse);
    drawHud(ctx, world, meta);
    drawPause(ctx);
  } else if (screen === 'win') drawWin(ctx, world, meta, isNewBest);
  else if (screen === 'lose') drawLose(ctx, world, meta);
  ctx.restore();

  if (!shotMode) {
    if (screen === 'title') titleFrame(clicks);
    else if (screen === 'howto') howtoFrame(clicks);
    else if (screen === 'play') playFrame(clicks, dt);
    else if (screen === 'draft') draftFrame(clicks);
    else if (screen === 'shop') shopFrame(clicks);
    else if (screen === 'altar') altarFrame(clicks);
    else if (screen === 'floorclear') floorclearFrame(clicks);
    else if (screen === 'pause') pauseFrame(clicks);
    else if (screen === 'win') winFrame(clicks);
    else if (screen === 'lose') loseFrame(clicks);
  } else {
    // Shot scenes are staged, not played: one rendered frame is the shot.
    frames += 1;
    if (frames >= 2) window.__shotReady = true;
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
