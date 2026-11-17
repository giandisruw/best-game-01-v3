// EMBERDEEP — configuration and definitions.
// One clear job: every number and name the game balances on — view size,
// player, enemies, bosses, relics, floors, feats — so world.js, rooms.js
// and render.js all read the same tuning from here and nowhere else.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const ROOM_W = 1280;
export const ROOM_H = 720;
// Playable bounds inside a room (walls are 46px thick, doors cut gaps).
export const WALL = 46;
export const DOOR_W = 150;

// --- Player ---
export const PLAYER = {
  r: 15,
  speed: 255,
  maxHearts: 3,
  boltDamage: 12,
  boltSpeed: 560,
  boltRange: 520,
  fireInterval: 0.24,
  critChance: 0.1,
  critMult: 2,
  dashCooldown: 2.2,
  dashTime: 0.18,
  dashSpeed: 780,
  pickupRadius: 70,
  lightRadius: 250,
};

// --- Abilities (keys 1 and 2) ---
export const ABILITIES = {
  burst: { name: 'Kindle Burst', key: '1', cooldown: 14, radius: 190, damage: 55, desc: 'A nova of lantern-fire that burns every foe nearby.' },
  ward: { name: 'Ember Ward', key: '2', cooldown: 18, duration: 6, desc: 'A shield of embers that blocks the next blow.' },
};

// --- Enemies ---
// kind: { hp, speed, r, damage, score, gold, xp, color, shape }
// damage is hearts lost on touch (always 1 except brutes hit harder via
// knockback + a second tick — kept at 1 heart everywhere for fairness).
export const ENEMIES = {
  mite: { hp: 18, speed: 78, r: 12, damage: 1, score: 40, gold: 2, xp: 1, color: '#ff9a3d', shape: 'mite', name: 'Embermite' },
  skitter: { hp: 14, speed: 165, r: 10, damage: 1, score: 60, gold: 3, xp: 1, color: '#ffd23d', shape: 'skitter', name: 'Skitter' },
  spitter: { hp: 22, speed: 62, r: 13, damage: 1, score: 80, gold: 3, xp: 2, color: '#7dff6a', shape: 'spitter', name: 'Spitter' },
  brute: { hp: 70, speed: 52, r: 22, damage: 1, score: 150, gold: 6, xp: 3, color: '#ff5a4d', shape: 'brute', name: 'Cinderbrute' },
  wisp: { hp: 26, speed: 120, r: 11, damage: 1, score: 100, gold: 4, xp: 2, color: '#b78cff', shape: 'wisp', name: 'Hollow Wisp' },
  shardling: { hp: 16, speed: 95, r: 11, damage: 1, score: 70, gold: 3, xp: 1, color: '#6ad8ff', shape: 'shardling', name: 'Shardling' },
  wraith: { hp: 40, speed: 110, r: 14, damage: 1, score: 140, gold: 5, xp: 3, color: '#e8e8ff', shape: 'wraith', name: 'Gravewraith' },
};

// Elites: bigger, tougher, crowned, drop a relic on death.
export const ELITE_MULT = { hp: 3.2, speed: 1.05, r: 1.45, score: 4, gold: 5, xp: 5 };

// --- Bosses (one per floor) ---
export const BOSSES = {
  maw: {
    name: 'CINDER MAW', title: 'Warden of the Warrens', hp: 380, speed: 66, r: 46,
    color: '#ff6a3d', score: 1500, gold: 45, xp: 22,
    desc: 'A furnace given teeth. It charges across the room — do not stand in its path.',
  },
  mother: {
    name: 'THE SPORE MOTHER', title: 'Queen of the Fungal Deep', hp: 560, speed: 40, r: 52,
    color: '#9dff6a', score: 2500, gold: 60, xp: 30,
    desc: 'She bursts in rings of spores and births shardlings from the dark.',
  },
  king: {
    name: 'THE HOLLOW KING', title: 'Last Light of the Throne', hp: 820, speed: 84, r: 48,
    color: '#c9b8ff', score: 4000, gold: 90, xp: 40,
    desc: 'He wears the dark like a crown. At half health his rage doubles his fire.',
  },
};

// --- Floors (realms). Each floor is 6 rooms: start, combat, combat,
// fork (elite | treasure), shop-or-altar, boss. ---
export const FLOORS = [
  {
    name: 'THE EMBER WARRENS', sub: 'Floor 1 · the old mine, still burning',
    palette: { floor: '#241812', floorAlt: '#2c1e15', wall: '#4a2c1a', wallTop: '#6b4226', door: '#8a5a30', accent: '#ff9a3d', glow: '#ffb35c' },
    enemies: ['mite', 'skitter', 'spitter'],
    boss: 'maw', midRoom: 'shop',
  },
  {
    name: 'THE FUNGAL DEEP', sub: 'Floor 2 · where the dark learned to grow',
    palette: { floor: '#12201a', floorAlt: '#16281f', wall: '#1f4a33', wallTop: '#2c6b47', door: '#3d8a5c', accent: '#7dff6a', glow: '#a5ff8a' },
    enemies: ['mite', 'skitter', 'spitter', 'brute', 'wisp', 'shardling'],
    boss: 'mother', midRoom: 'altar',
  },
  {
    name: 'THE HOLLOW THRONE', sub: 'Floor 3 · the king who swallowed the light',
    palette: { floor: '#1a1426', floorAlt: '#201a30', wall: '#3d2c5c', wallTop: '#54407a', door: '#6b52a0', accent: '#b78cff', glow: '#d0b3ff' },
    enemies: ['skitter', 'spitter', 'brute', 'wisp', 'shardling', 'wraith'],
    boss: 'king', midRoom: 'shop',
  },
];

// Room kinds in traversal order (index into the floor's room list).
export const ROOM_KINDS = ['start', 'combat', 'combat', 'fork', 'mid', 'boss'];

// --- Relics: the draft pool. rarity weights: common 60, rare 30, epic 10.
// unique: only ever offered once. stackable ones grow with each copy. ---
export const RELICS = [
  { id: 'heavy-wick', name: 'Heavy Wick', rarity: 'common', desc: '+25% bolt damage.', apply: 'damage', value: 0.25 },
  { id: 'quick-wick', name: 'Quick Wick', rarity: 'common', desc: '+20% fire rate.', apply: 'fireRate', value: 0.2 },
  { id: 'twin-wick', name: 'Twin Wick', rarity: 'common', desc: '+1 bolt per shot, -15% damage.', apply: 'multishot', value: 1, unique: true },
  { id: 'long-wick', name: 'Long Wick', rarity: 'common', desc: '+30% bolt speed and range.', apply: 'range', value: 0.3 },
  { id: 'lodestone', name: 'Lodestone', rarity: 'common', desc: '+80% pickup radius.', apply: 'magnet', value: 0.8 },
  { id: 'thick-wicker', name: 'Thick Wicker', rarity: 'common', desc: '+1 max heart, heal 1.', apply: 'maxHearts', value: 1 },
  { id: 'swift-boots', name: 'Swift Boots', rarity: 'common', desc: '+12% move speed.', apply: 'speed', value: 0.12 },
  { id: 'sharp-flint', name: 'Sharp Flint', rarity: 'common', desc: '+10% critical chance.', apply: 'crit', value: 0.1 },
  { id: 'kindled-dash', name: 'Kindled Dash', rarity: 'common', desc: 'Dash recharges 30% faster.', apply: 'dashCd', value: 0.3 },
  { id: 'ember-pouch', name: 'Ember Pouch', rarity: 'common', desc: '+30% gold from kills.', apply: 'gold', value: 0.3 },
  { id: 'piercing-light', name: 'Piercing Light', rarity: 'rare', desc: 'Bolts pierce +1 foe.', apply: 'pierce', value: 1 },
  { id: 'ricochet', name: 'Ricochet', rarity: 'rare', desc: 'Bolts bounce to a nearby foe once.', apply: 'bounce', value: 1, unique: true },
  { id: 'lantern-oil', name: 'Lantern Oil', rarity: 'rare', desc: '+45% light radius, +10% damage.', apply: 'oil', value: 0.1 },
  { id: 'blood-ember', name: 'Blood Ember', rarity: 'rare', desc: 'Heal 1 heart on every level-up.', apply: 'bloodEmber', value: 1, unique: true },
  { id: 'second-wind', name: 'Second Wind', rarity: 'rare', desc: 'Once per run, survive a fatal blow at 1 heart.', apply: 'secondWind', value: 1, unique: true },
  { id: 'midas-wick', name: 'Midas Wick', rarity: 'rare', desc: '+60% gold from kills.', apply: 'gold', value: 0.6 },
  { id: 'storm-wick', name: 'Storm Wick', rarity: 'rare', desc: 'Kills have a 20% chance to zap a nearby foe for 20 damage.', apply: 'storm', value: 0.2, unique: true },
  { id: 'tri-wick', name: 'Tri-Wick', rarity: 'epic', desc: '+2 bolts per shot, -10% damage.', apply: 'multishot', value: 2, unique: true },
  { id: 'nova-heart', name: 'Nova Heart', rarity: 'epic', desc: 'Kindle Burst: +70% radius, 25% faster recharge.', apply: 'nova', value: 1, unique: true },
  { id: 'aegis-ward', name: 'Aegis Ward', rarity: 'epic', desc: 'Ember Ward blocks 2 blows instead of 1.', apply: 'aegis', value: 1, unique: true },
];

export const RARITY_COLOR = { common: '#cfd6e4', rare: '#6ad8ff', epic: '#ffb35c' };
export const RARITY_WEIGHT = { common: 60, rare: 30, epic: 10 };

// --- Shop stock (gold) ---
export const SHOP_ITEMS = [
  { id: 'heal', name: 'Ember Salve', desc: 'Restore 1 heart.', price: 25 },
  { id: 'maxheart', name: 'Wicker Heart', desc: '+1 max heart, heal 1.', price: 60 },
  { id: 'oil', name: 'Weapon Oil', desc: '+15% bolt damage, this run.', price: 45 },
  { id: 'relic', name: 'Sealed Relic', desc: 'A random relic from the deep.', price: 50 },
];

// --- Feats (the 8-feat checklist on the title screen) ---
export const FEATS = [
  { id: 'first-blood', name: 'First Blood', desc: 'Slay your first foe.' },
  { id: 'combo8', name: 'Eightfold Flame', desc: 'Reach a x8 combo.' },
  { id: 'elite', name: 'Elite Slayer', desc: 'Slay an elite foe.' },
  { id: 'relic5', name: 'Well Equipped', desc: 'Own 5 relics at once.' },
  { id: 'floor1', name: 'Warrens Cleared', desc: 'Clear floor 1.' },
  { id: 'floor2', name: 'Deep Cleared', desc: 'Clear floor 2.' },
  { id: 'boss', name: 'Boss Slayer', desc: 'Slay any floor boss.' },
  { id: 'delve', name: 'The Hollow Is Lit', desc: 'Defeat the Hollow King and win.' },
];

// XP needed to go from level L to L+1. Tuned so the first draft lands
// before the floor-1 boss: floor 1 yields ~10 XP, so level 2 (9 XP)
// arrives mid-floor and the player faces Cinder Maw with a relic.
export function xpForLevel(level) {
  return 5 + level * 4;
}

export function gradeFor(score, heartsLeft, maxHearts, seconds) {
  const heartBonus = (heartsLeft / maxHearts) * 1500;
  const timeBonus = Math.max(0, 3600 - seconds) / 10;
  const total = score + heartBonus + timeBonus;
  if (total >= 14000) return 'S';
  if (total >= 10000) return 'A';
  if (total >= 6500) return 'B';
  return 'C';
}
