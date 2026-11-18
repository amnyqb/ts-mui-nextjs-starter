# WW5

*Humans stopped at World War 3. The robots did not.*

An original territory-control robot RTS for the browser. Capture flags, take over factories, outproduce the opponent.
Built with TypeScript, Vite and Phaser 3. The simulation is headless and deterministic; Phaser only draws it.

**Status: Stage 1 (Foundation) complete.** See `docs/stage1-report.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 24 headless simulation tests
npm run batch 100  # 100 AI-vs-AI matches, prints win rates
npm run build && npm run preview &   # production build on :4173
node scripts/e2e.cjs                 # browser play test (needs Playwright + the preview server)
```

Add `?speed=4` to the URL to run the simulation faster.

## Deploy (GitHub Pages / any static host)

`npm run build` writes `dist/`, which uses relative paths (`base: './'`). Upload the contents of `dist/` to any static host.

## Controls

| Input | Action |
|---|---|
| Left-click / drag | Select robot / box-select |
| Click a factory | Select it, then pause or resume its production |
| Right-click | Move, attack an enemy or HQ, or capture a flag (by what is under the cursor) |
| A, then click | Attack-move |
| S | Stop |
| Ctrl+1-9 / 1-9 | Save / recall a control group |
| WASD, arrows, middle-drag | Scroll |
| Mouse wheel | Zoom |
| Minimap click or drag | Jump the camera |
| P / R | Pause / restart |
| M | Mute / unmute sound (all sounds are synthesised in the browser, no audio files) |

## How it works (Stage 1)

- **Territories:** each has a flag. A rifle robot touching an enemy or neutral flag captures it, and every factory in it changes owner and resets progress. Headquarters never change hands; destroy them to win.
- **Production:** owned factories build for free. Each extra owned territory speeds every factory up by 15% (`productionRate` in `src/data/units.ts`).
- **Units:** Rifle Robot (captures, weak to tanks) and Light Tank (cannot capture, strong vs vehicles and buildings). Damage uses armour-class multipliers.
- **Win/lose:** destroy the enemy HQ, or leave the enemy with no units and no factories.
- **Determinism:** one seeded PRNG, 20 ticks/s fixed step, no wall-clock use in `src/sim`. Same seed plus same command log gives the same state hash.

## Layout

```
src/sim      world, pathfinding (A* + string-pulling), spatial hash, PRNG
src/ai       Stage-1 commander (replaced by the full hierarchy in Stage 2)
src/data     unit stats, map
src/render   Phaser scene, HUD, minimap
tests        Vitest simulation tests
scripts      batch runner, browser test
```
