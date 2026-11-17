# EMBERDEEP — build notes (best-game-01 round 3)

## Concept
Original roguelite dungeon crawler. You are the delver who carries the last
lantern into the sunken hollow. Three floors (Ember Warrens, Fungal Deep,
Hollow Throne), six rooms a floor: start, two combats, a fork (north: elite,
south: treasure), a shop or altar, and a warden boss. Slay the Hollow King
on floor 3 to win (THE HOLLOW IS LIT screen, letter grade, run stats).
3 hearts; lose them all and the light goes out (game-over screen).

- Enemies: mites (drift), skitters (fast zigzag), spitters (ranged globs),
  brutes (slow, multi-hit), wisps (sine drift), shardlings (split in two on
  death), wraiths (teleport + lunge), elites (crowned, 3.2x HP, drop a
  relic), and 3 bosses with their own fights: Cinder Maw (telegraphed
  charges + mite summons), Spore Mother (radial spore rings + shardling
  summons), Hollow King (aimed volleys, blinks, enrages at 50%).
- Depth: XP shards → level-up pick-1-of-3 draft from 20 relics
  (Common/Rare/Epic, synergy notes, 4 unique), gold embers → shop rooms
  (heal, max heart, weapon oil, sealed relic), altar rooms (trade 1 max
  heart for an epic relic), treasure chests (gold + relic), combo multiplier
  up to x8, lantern light radius (darkness presses in; Lantern Oil grows
  it), dash with i-frames, 2 abilities (Kindle Burst nova, Ember Ward
  shield), 2 difficulties (Delver / Abyssal: +35% foe HP, +25% gold & XP),
  best score, last-3-run history, 8-feat checklist, same-seed replay,
  Endless Delve after winning (floors 4+ keep coming, dark grows hungrier).
- Feel: particles on every kill/hit, floating damage numbers, screen shake,
  hit invulnerability blink, dash trail, room banners, minimap (room graph),
  pause, mute (M), synthesised WebAudio effects + a soft music loop (no
  audio files, no network).

## Controls
- Move: WASD / arrow keys. Aim: mouse. Fire: hold left-click.
- Dash: Shift, Space or right-click. Abilities: 1 Kindle Burst, 2 Ember Ward.
- Pause: P. Mute: M. Restart: R, or Space/click on the title / win /
  game-over screens. Draft/shop/altar: click or keys 1-4, E to leave.

## Layout (repo root ~/workspace/makefun-best-game-01/entry-v3/)
- `game/index.html` + `game/src/`: config (all tuning + defs), random
  (seeded), input, audio (WebAudio synth), rooms (floor/room graph gen),
  enemies (per-kind AI + boss fights), world (rules, no DOM), render
  (canvas field + HUD + minimap + lantern light), screens (title, how-to,
  draft, shop, altar, floor-clear, win, lose, pause), shots (deterministic
  `?shot=` scenes with an autopilot), main (loop + screens + meta).
- `main.ts` (Node 22, stdlib only): copies game/ + screenshots/ to /output
  and writes dossier.json via `vendor/makefun-game.ts` (kit copy, unchanged).
- `serve.ts`: static server for local play (`node serve.ts` → :8080).
- `screenshots/`: 1-start (title), 2-play (floor-2 boss fight, Spore Mother
  at 62% + adds + x5 combo), 3-draft (level-up pick-1-of-3), 4-win (GRADE S
  + run stats + NEW BEST) — 1280x720 JPEG, real renders, seed 7.
- `LICENSE` (MIT), `README.md`, `.makefun/owner.json`, `shots.json`.

## How to run / test
- Play: `node serve.ts --port 8080`, open http://127.0.0.1:8080.
- Shot scenes: `?shot=start|play|draft|win&seed=7` (sets `window.__shotReady`).
- Build: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Test evidence (2026-11-17 ~19:00 WIB, this machine)
- `node --version`: v24.22.1. Headless Chromium: Playwright Chromium 1255
  (`~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`, via a
  locally installed playwright-core in /tmp/ed-pw).
- CDP playtest (`/tmp/ed-pw/ed-test.mjs`, kept outside the repo):
  - Title → start → walk east into combat room 1 (3 foes, floor-1 gentle
    count) → 12s kite-fight: 3 kills, 0 damage taken, room cleared,
    score 380. Dash + burst work. Pause/resume work.
  - Draft: injected shard pickup → level 2, draft screen with 3 cards →
    picked middle card → back to play with 1 relic.
  - Boss: entered boss room (Cinder Maw 420/420) → wounded to 5 HP →
    killed → floor-clear screen → picked card → descended to floor 2
    (Fungal Deep, relics 2).
  - Altar (floor 2 mid room): offered 1 max heart → epic relic, maxHearts
    3→2, relics 3. Shop (floor 1 mid room): opened, left cleanly.
  - Restart (R) works. `CONSOLE ERRORS: []`. `EXTERNAL REQUESTS: []`.
  - All 4 shot scenes: `ready=true`, 1280x720, non-blank, JPEG
    40,594–56,295 bytes. Screenshots visually inspected: title reads
    (difficulty select, best, feats), play shows the Spore Mother boss
    fight with boss bar, x5 combo, HUD, minimap and relics, draft shows
    3 relic cards incl. an epic, win shows GRADE S + stats + NEW BEST.
- Bugs found and fixed during testing:
  1. Standing still in combat room 1 died in ~6s (4-6 foes, 3 hits) →
     floor-1 combat count cut to 3-4, hit invulnerability 1.0s → 1.2s.
  2. Boss bar overlapped the room banner text → bar moved below the
     banner (name y=178, bar y=186).
  3. Boss rendered blank white while being hit (hitFlash) → flash now
     lightens the body colour instead of whitening it.
  4. The play shot was too dark and empty → darkness lightened, player
     given a lantern-light pool + brighter cloak/lantern, shot staging
     tops the field up to 4+ foes, boss moved clear of the banner, banner
     hidden for the shot.
  5. Shop/altar rooms re-opened on every revisit → now open once; later
     visits walk through.
  6. Win screen showed "Feats 1/8" (meta not merged in shot mode) →
     shot setup merges world feats into meta.
- `main.ts` run: dossier.json 381,222 bytes (< 1.5 MiB cap).
- Sizes: game/ 113,828 bytes source (11 files) + index.html; each
  screenshot ≤ 256 KiB, 1280x720.
- All 11 game .js files parse as ES modules (`node --check`).

## Known limitations
- The play shot's extra foes are staged after the autopilot sim (the sim
  itself plays the boss fight for real; staging only guarantees the frame
  is busy and readable).
- Music starts only after the first gesture (browser autoplay policy);
  the M key toggles mute.
- Balance is tuned for fun in short sessions, not exhaustively playtested
  to floor 3 by a human — the win path is proven by the staged win scene
  and the boss-kill → floor-clear → descend loop, verified live in the
  playtest for floors 1→2.
