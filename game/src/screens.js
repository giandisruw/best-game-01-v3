// EMBERDEEP — menu and overlay screens.
// One clear job: every screen that is not the delve itself — title,
// how-to-play, level-up draft, shop, altar, floor-clear, victory,
// defeat and pause — plus the LAYOUT rectangles the input code clicks.

import { VIEW_W, VIEW_H, FEATS, RELICS, RARITY_COLOR, SHOP_ITEMS } from './config.js';
import { drawPanel, drawButton, drawHeart, inRect } from './render.js';

export { inRect };

export const LAYOUT = {
  title: {
    start: { x: 490, y: 470, w: 300, h: 56 },
    howto: { x: 490, y: 536, w: 300, h: 44 },
    delver: { x: 430, y: 410, w: 200, h: 44 },
    abyssal: { x: 650, y: 410, w: 200, h: 44 },
  },
  howto: { back: { x: 490, y: 600, w: 300, h: 48 } },
  draft: { cards: [
    { x: 190, y: 250, w: 270, h: 220 },
    { x: 505, y: 250, w: 270, h: 220 },
    { x: 820, y: 250, w: 270, h: 220 },
  ] },
  shop: { items: [
    { x: 190, y: 240, w: 210, h: 150 },
    { x: 420, y: 240, w: 210, h: 150 },
    { x: 650, y: 240, w: 210, h: 150 },
    { x: 880, y: 240, w: 210, h: 150 },
  ], leave: { x: 490, y: 470, w: 300, h: 52 } },
  altar: {
    take: { x: 380, y: 380, w: 220, h: 110 },
    leave: { x: 680, y: 380, w: 220, h: 110 },
  },
  floorclear: {
    cards: [
      { x: 190, y: 250, w: 270, h: 220 },
      { x: 505, y: 250, w: 270, h: 220 },
      { x: 820, y: 250, w: 270, h: 220 },
    ],
    continue: { x: 490, y: 520, w: 300, h: 52 },
  },
  win: {
    endless: { x: 340, y: 540, w: 280, h: 52 },
    replay: { x: 660, y: 540, w: 280, h: 52 },
    title: { x: 490, y: 604, w: 300, h: 44 },
  },
  lose: { restart: { x: 490, y: 520, w: 300, h: 52 } },
  pause: {
    resume: { x: 490, y: 300, w: 300, h: 52 },
    restart: { x: 490, y: 366, w: 300, h: 52 },
    quit: { x: 490, y: 432, w: 300, h: 52 },
  },
};

function titleText(ctx, text, y, size, color, italic) {
  ctx.font = `${italic ? 'italic ' : ''}bold ${size}px Georgia, serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, VIEW_W / 2, y);
}

function emberDrift(ctx, t) {
  // Slow embers rising behind the title, seeded by position only.
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 173) % 1280);
    const speed = 12 + (i % 5) * 6;
    const y = VIEW_H - ((t * speed + i * 97) % (VIEW_H + 40)) + 20;
    const a = 0.25 + ((i * 37) % 10) / 40;
    ctx.globalAlpha = a;
    ctx.fillStyle = i % 3 === 0 ? '#ffb35c' : '#ff9a3d';
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawTitle(ctx, world, meta, difficulty, t) {
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  emberDrift(ctx, t);
  // A dim delve behind the title so the screen is never empty.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#241812';
  ctx.fillRect(90, 120, 1100, 220);
  ctx.globalAlpha = 1;
  titleText(ctx, 'EMBERDEEP', 190, 84, '#ffb35c');
  titleText(ctx, 'Delve of the Hollow Lantern', 232, 26, '#c9b8a0', true);
  titleText(ctx, 'Three floors. Nine foes. Three wardens. One last lantern.', 272, 18, '#e8dcc8');
  titleText(ctx, 'Clear every room, draft relics, slay the Hollow King — and bring the light back.', 300, 16, '#9a8f80');

  // Difficulty
  titleText(ctx, 'CHOOSE YOUR DELVE', 392, 15, '#c9b8a0');
  drawButton(ctx, LAYOUT.title.delver, '1 · DELVER', 'The intended delve.', difficulty === 'delver');
  drawButton(ctx, LAYOUT.title.abyssal, '2 · ABYSSAL', 'Foes +35% HP · +25% gold & XP.', difficulty === 'abyssal');
  drawButton(ctx, LAYOUT.title.start, 'LIGHT THE LANTERN', 'WASD move · mouse aim · hold click to fire', true);
  drawButton(ctx, LAYOUT.title.howto, 'HOW TO PLAY  (H)', '', true);

  // Best score, recent runs, feats
  ctx.textAlign = 'left';
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  ctx.fillText(`Best score: ${meta.bestScore}`, 90, 640);
  if (meta.runs.length) {
    const r = meta.runs.map((run) => `${run.result === 'WIN' ? '★' : '✝'} F${run.floor} · ${run.score}`).join('    ');
    ctx.fillText(`Recent: ${r}`, 90, 664);
  }
  ctx.fillText(`Feats ${meta.feats.length}/8:`, 90, 692);
  FEATS.forEach((f, i) => {
    const done = meta.feats.includes(f.id);
    ctx.fillStyle = done ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.fillText(`${done ? '◆' : '◇'} ${f.name}`, 230 + (i % 4) * 260, 664 + Math.floor(i / 4) * 22);
  });
  if (meta.endlessUnlocked) {
    ctx.fillStyle = '#b78cff';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('ENDLESS DELVE UNLOCKED — win again to keep going past floor 3.', 90, 616);
  }
  ctx.textAlign = 'center';
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = '#777';
  ctx.fillText('An original game. No network, no files beyond this page. Sound: WebAudio synth (M to mute).', 640, 712);
}

export function drawHowTo(ctx) {
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  emberDrift(ctx, 3);
  titleText(ctx, 'HOW TO PLAY', 110, 44, '#ffb35c');
  const lines = [
    ['GOAL', 'Delve three floors, clear every room, and slay the Hollow King on floor 3.'],
    ['MOVE', 'WASD or arrow keys. Aim with the mouse. Hold left-click to fire lantern-bolts.'],
    ['DASH', 'Shift, Space or right-click: a quick dash with a blink of invulnerability.'],
    ['ABILITIES', '[1] Kindle Burst — a nova that burns everything nearby.  [2] Ember Ward — a shield that blocks the next blow.'],
    ['ROOMS', 'Clear a room to open its doors. Fork rooms offer a choice: north, the elite — south, the treasure.'],
    ['LEVEL UP', 'Foes drop ember shards. Fill the bar to draft 1 of 3 relics — 20 relics, from common wicks to the epic Tri-Wick.'],
    ['SHOP & ALTAR', 'Spend gold in shop rooms. Altars trade 1 max heart for an epic relic. Treasure chests hide gold and relics.'],
    ['BOSSES', 'Each floor ends in a warden with its own fight: the Cinder Maw charges, the Spore Mother bursts, the Hollow King blinks and rages.'],
    ['LIGHT', 'Your lantern is your sight: the dark presses in, and its radius grows with Lantern Oil.'],
    ['KEYS', 'P pause · M mute · R restart. Win to unlock Endless Delve.'],
  ];
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    const y = 168 + i * 42;
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillStyle = '#ffb35c';
    ctx.fillText(line[0], 150, y);
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = '#e8dcc8';
    ctx.fillText(line[1], 280, y);
  });
  drawButton(ctx, LAYOUT.howto.back, 'BACK  (H)', '', true);
}

function drawRelicCard(ctx, rect, relic, index, hover) {
  drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, hover ? 'rgba(40, 28, 16, 0.95)' : 'rgba(12, 12, 24, 0.92)', RARITY_COLOR[relic.rarity]);
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillStyle = RARITY_COLOR[relic.rarity];
  ctx.fillText(`${relic.rarity.toUpperCase()} RELIC  ·  press ${index + 1}`, rect.x + rect.w / 2, rect.y + 30);
  // Relic glyph: a diamond with its initial.
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + 84);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = RARITY_COLOR[relic.rarity];
  ctx.fillRect(-26, -26, 52, 52);
  ctx.restore();
  ctx.fillStyle = '#12081f';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(relic.name[0], rect.x + rect.w / 2, rect.y + 95);
  ctx.font = 'bold 21px Georgia, serif';
  ctx.fillStyle = '#ffe9c4';
  ctx.fillText(relic.name, rect.x + rect.w / 2, rect.y + 148);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  const words = relic.desc.split(' ');
  let line = '';
  let y = 176;
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 30) {
      ctx.fillText(line.trim(), rect.x + rect.w / 2, rect.y + y);
      line = w;
      y += 20;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), rect.x + rect.w / 2, rect.y + y);
}

export function drawDraft(ctx, world, meta, mouse) {
  ctx.fillStyle = 'rgba(4, 4, 10, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  titleText(ctx, 'LEVEL UP — CHOOSE A RELIC', 150, 40, '#ffb35c');
  titleText(ctx, `Level ${world.level} · ${world.relics.reduce((n, r) => n + r.count, 0)} relics owned · ${world.gold} gold`, 188, 17, '#c9b8a0');
  world.draftOptions.forEach((relic, i) => {
    const rect = LAYOUT.draft.cards[i];
    const hover = mouse ? inRect(mouse.x, mouse.y, rect) : false;
    drawRelicCard(ctx, rect, relic, i, hover);
  });
  titleText(ctx, 'Click a card or press 1 / 2 / 3.', 520, 16, '#9a8f80');
  // Owned relics strip
  ctx.textAlign = 'center';
  ctx.font = '14px Georgia, serif';
  ctx.fillStyle = '#c9b8a0';
  const ownedNames = world.relics.map((r) => {
    const def = RELICS.find((d) => d.id === r.id);
    return def ? def.name : r.id;
  });
  if (ownedNames.length) ctx.fillText(`Owned: ${ownedNames.join(' · ')}`, 640, 580);
}

export function drawShop(ctx, world, mouse) {
  ctx.fillStyle = 'rgba(4, 4, 10, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  titleText(ctx, 'THE DELVER’S SHOP', 130, 40, '#ffd23d');
  titleText(ctx, `You carry ${world.gold} gold · Hearts ${world.player.hp}/${world.player.maxHearts}`, 170, 17, '#c9b8a0');
  SHOP_ITEMS.forEach((item, i) => {
    const rect = LAYOUT.shop.items[i];
    const afford = world.gold >= item.price;
    const usable = !(item.id === 'heal' && world.player.hp >= world.player.maxHearts)
      && !(item.id === 'maxheart' && world.player.maxHearts >= 6);
    const hover = mouse ? inRect(mouse.x, mouse.y, rect) : false;
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, hover ? 'rgba(50, 38, 12, 0.95)' : 'rgba(12, 12, 24, 0.92)', afford && usable ? '#ffd23d' : '#555');
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillStyle = afford && usable ? '#ffe9c4' : '#888';
    ctx.fillText(item.name, rect.x + rect.w / 2, rect.y + 34);
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = '#c9b8a0';
    ctx.fillText(item.desc, rect.x + rect.w / 2, rect.y + 62);
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillStyle = afford ? '#ffd23d' : '#ff5a4d';
    ctx.fillText(`◈ ${item.price}`, rect.x + rect.w / 2, rect.y + 100);
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = '#9a8f80';
    ctx.fillText(`press ${i + 1}`, rect.x + rect.w / 2, rect.y + 128);
  });
  drawButton(ctx, LAYOUT.shop.leave, 'LEAVE THE SHOP  (E)', 'The doors open when you go.', true);
  titleText(ctx, 'Shop rooms never restock — spend while you are here.', 560, 15, '#9a8f80');
}

export function drawAltar(ctx, world, mouse) {
  ctx.fillStyle = 'rgba(10, 4, 16, 0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  titleText(ctx, 'THE HOLLOW ALTAR', 130, 40, '#b78cff');
  titleText(ctx, 'Something old sleeps here, and it trades in hearts.', 170, 17, '#c9b8a0', true);
  const offer = world.altarOffer;
  if (offer) {
    drawRelicCard(ctx, { x: 505, y: 210, w: 270, h: 150 }, offer, 0, false);
    ctx.textAlign = 'center';
    ctx.font = '15px Georgia, serif';
    ctx.fillStyle = '#c9b8a0';
    ctx.fillText(offer.desc, 640, 392 - 24);
  }
  const canTake = world.player.maxHearts > 1;
  drawButton(ctx, LAYOUT.altar.take, 'OFFER 1 MAX HEART', canTake ? 'Take the epic relic.' : 'You need 2+ max hearts.', canTake);
  drawButton(ctx, LAYOUT.altar.leave, 'WALK AWAY  (E)', 'Keep your hearts.', true);
}

export function drawFloorClear(ctx, world, meta, mouse) {
  ctx.fillStyle = 'rgba(4, 4, 10, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  titleText(ctx, `${world.floorData.floor.name} — CLEARED`, 130, 38, '#7dff6a');
  titleText(ctx, `Score ${world.score} · Kills ${world.kills} · The way down opens. Choose a relic, then descend.`, 172, 17, '#c9b8a0');
  world.draftOptions.forEach((relic, i) => {
    const rect = LAYOUT.floorclear.cards[i];
    const hover = mouse ? inRect(mouse.x, mouse.y, rect) : false;
    drawRelicCard(ctx, rect, relic, i, hover);
  });
  drawButton(ctx, LAYOUT.floorclear.continue, 'DESCEND TO THE NEXT FLOOR', world.draftPicked ? 'The dark below is waiting.' : 'Choose a relic first.', world.draftPicked);
}

export function drawWin(ctx, world, meta, isNewBest) {
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  emberDrift(ctx, 5);
  titleText(ctx, 'THE HOLLOW IS LIT', 150, 56, '#ffb35c');
  titleText(ctx, 'The Hollow King falls. Dawn creeps down the stairs, and the lantern burns on.', 196, 18, '#c9b8a0', true);
  if (isNewBest) {
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillStyle = '#ffd23d';
    ctx.textAlign = 'center';
    ctx.fillText('★ NEW BEST SCORE ★', 640, 236);
  }
  // Grade + stats
  drawPanel(ctx, 390, 260, 500, 220, 'rgba(8, 10, 22, 0.9)', '#ffb35c');
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillStyle = '#ffb35c';
  ctx.fillText(`GRADE ${world.grade || 'A'}`, 640, 340);
  const s = world.winStats || { score: world.score, kills: world.kills, time: 0, relics: 0, difficulty: world.difficulty };
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = '#e8dcc8';
  const rows = [
    `Score  ${s.score}`,
    `Foes slain  ${s.kills}   ·   Relics  ${s.relics}`,
    `Time  ${Math.floor(s.time / 60)}:${String(s.time % 60).padStart(2, '0')}   ·   ${s.difficulty === 'abyssal' ? 'ABYSSAL' : 'DELVER'}`,
    `Feats  ${meta.feats.length}/8`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, 640, 384 + i * 26));
  drawButton(ctx, LAYOUT.win.endless, 'ENDLESS DELVE', 'Floors 4+ · the dark grows hungrier.', true);
  drawButton(ctx, LAYOUT.win.replay, 'REPLAY THIS SEED', 'Same floors, same foes.', true);
  drawButton(ctx, LAYOUT.win.title, 'TITLE SCREEN', '', true);
}

export function drawLose(ctx, world, meta) {
  ctx.fillStyle = '#0a0508';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  emberDrift(ctx, 8);
  titleText(ctx, 'THE LIGHT GOES OUT', 170, 56, '#ff5a6a');
  titleText(ctx, `The dark takes the delve on floor ${world.floorIndex + 1}, ${world.room.kind} room.`, 214, 18, '#c9b8a0', true);
  ctx.textAlign = 'center';
  ctx.font = '19px Georgia, serif';
  ctx.fillStyle = '#e8dcc8';
  ctx.fillText(`Score ${world.score}  ·  Kills ${world.kills}  ·  Level ${world.level}  ·  Best ${meta.bestScore}`, 640, 280);
  ctx.fillText(`Relics ${world.relics.reduce((n, r) => n + r.count, 0)}  ·  ${world.floorData.floor.name}`, 640, 312);
  drawButton(ctx, LAYOUT.lose.restart, 'DELVE AGAIN  (R)', 'A new seed, a new delve.', true);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#9a8f80';
  ctx.fillText('Tip: draft relics that fit how you fight — Twin Wick loves crowds, Piercing Light loves lines.', 640, 600);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 4, 10, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  titleText(ctx, 'PAUSED', 220, 44, '#ffe9c4');
  drawButton(ctx, LAYOUT.pause.resume, 'RESUME  (P)', '', true);
  drawButton(ctx, LAYOUT.pause.restart, 'RESTART DELVE  (R)', '', true);
  drawButton(ctx, LAYOUT.pause.quit, 'QUIT TO TITLE', '', true);
}
