# Stage 1 Report: Foundation

Date: 2026-11-18. Gate: *a human can win and lose a match; the determinism test passes.* **Gate passed.**

## What works

- Headless, deterministic simulation (20 ticks/s, seeded PRNG, state hash).
- One map ("Broken Bridge", 56x32): two bases, 8 territories, a river with three crossings, rocks.
- Two unit types (Rifle Robot, Light Tank), three building types (HQ, Barracks, Vehicle Works).
- Flag capture with factory transfer, free automatic production, unit cap of 60 per side, win/lose/draw.
- A* pathfinding with line-of-sight smoothing, spatial hash for target acquisition, steering separation.
- Simple opponent AI (capture nearest flags, mass 6 units, attack-move on the HQ).
- Phaser renderer: procedural art, animated robots, turrets, tracers, explosions, capture rings, minimap, HUD, end screen.
- Desktop controls: select, box-select, context right-click, attack-move, stop, groups, camera, pause, restart.

## Validation

**Round 1: headless.**

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`, strict) | Pass |
| Vitest | 24 / 24 pass |
| 100 AI-vs-AI matches (seeds 1-100) | West 48, East 52, 0 draws, 0 stalemates; median 129 s, max 276 s of game time; 18 s wall-clock for all 100 |

Tests cover: PRNG, spatial hash, pathfinding (bridges, rocks, blocked goal, unreachable), territory capture and building transfer, HQ ownership, production timing and pausing, armour-class damage, autonomous target acquisition, HQ destruction, orders, AI behaviour, defeat and victory, determinism and command-log replay.

**Round 2: real browser** (Chromium via Playwright, real mouse and keyboard, `scripts/e2e.cjs`): **19 / 19 checks pass**, including box-select, right-click capture of a flag, factory selection and pause, minimap navigation, pause and resume, control groups, a UI-driven match ending in an end screen, and a passive player ending in DEFEAT. A UI-driven VICTORY was observed in two of three runs; the scripted player is timing-dependent, so the third run ended in defeat. No console errors in any session. Screenshots are in `docs/screens/`.

## Defects found by testing, and fixed

| Defect | Found by | Fix |
|---|---|---|
| West side won 62-71% of AI-vs-AI matches | 100-match batch | Root cause was A* tie-breaking producing different routes for each direction. Added line-of-sight path smoothing; result now 48/52. Also fixed building mirror coordinates and made damage simultaneous. |
| Factory panel button impossible to click | Browser test | The panel HTML was rebuilt every 100 ms. It now re-renders only when its structure changes. |
| Dragging a box and releasing over a HUD panel lost the selection | Browser test | Handle Phaser's `pointerupoutside`. |
| Stray black rectangle in the top-left | Screenshot review | Removed the minimap canvas CSS background (compositor painted it in the wrong place). |

## Measured

- Simulation throughput is not yet benchmarked at 100/500/1000 agents (Stage 5). Only the 100-match batch time above is recorded.

## Known limitations (Stage 1)

- Only 2 of 9 units; one map; one opponent difficulty.
- Opponent AI is deliberately simple (no squads, no retreat, no production choices); it is replaced in Stage 2.
- No fog of war, terrain speed effects, line-of-sight blocking for shots, or destructible objects yet.
- No sound, correspondent, personalities, campaign, touch controls, or save/load.
- Production choice is limited to pause/resume per factory.
- Paths are computed immediately when ordered (no per-tick path budget yet).
- Bundle is 1.5 MB (Phaser, 351 KB gzipped).
- The browser test needs Playwright and a running preview server.

## Next: Stage 2 (Autonomy)

Unit state machines with personality traits, squads, utility-scored strategic commander, AI-vs-AI observer mode. Gate: 20 headless matches finish without stalemate or stuck units.
