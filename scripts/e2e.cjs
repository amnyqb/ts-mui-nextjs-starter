/* Browser smoke + play test. Needs: `npm run build` first and `npm run preview` running on :4173.
   Uses real mouse/keyboard events against the real build. Run: node scripts/e2e.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || path.join(__dirname, '..', 'docs', 'screens');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, query = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL + query);
  await page.waitForFunction(() => window.__scrapline && window.__scrapline.scene.match, null, { timeout: 15000 });
  return { page, errors };
}
const S = (page, fn, arg) => page.evaluate(fn, arg);
const screenOf = (page, x, y) => page.evaluate(([x, y]) => window.__scrapline.screenOf(x, y), [x, y]);

async function dragBox(page, x0, y0, x1, y1) {
  const a = await screenOf(page, x0, y0);
  const b = await screenOf(page, x1, y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}
async function rightClickTile(page, x, y) {
  const p = await screenOf(page, x, y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  // ---------------------------------------------------------------- 1. controls
  {
    const { page, errors } = await open(browser, '?speed=2');
    check('game boots and exposes simulation', true);
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, '1-start.png') });

    // zoom out to see the whole map
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 100);
    await sleep(200);
    const zoom = await S(page, () => window.__scrapline.scene.cameras.main.zoom);
    check('mouse wheel zooms the camera', zoom < 0.8, `zoom ${zoom.toFixed(2)}`);

    // act as soon as the first robot exists
    await page.waitForFunction(() => window.__scrapline.scene.match.world.unitsOf(0).length >= 1, null, { timeout: 20000 });

    // drag-select everything near our base
    await dragBox(page, 1, 1, 24, 31);
    const selN = await S(page, () => window.__scrapline.scene.sel.size);
    const mineNow = await S(page, () => window.__scrapline.scene.match.world.unitsOf(0).length);
    check('drag-box selects own robots', selN > 0 && selN <= mineNow, `${selN} selected`);

    // right-click an unowned flag -> capture order (rifles)
    const flagOwnerBefore = await S(page, () => window.__scrapline.scene.match.world.territories[3].owner);
    await rightClickTile(page, 22.5, 16.5);
    await sleep(300);
    const orders = await S(page, () => {
      const w = window.__scrapline.scene.match.world;
      return [...window.__scrapline.scene.sel].map((id) => w.getEntity(id)).filter(Boolean).map((u) => u.order.kind);
    });
    check('right-click on a flag issues a capture order', orders.includes('capture'), orders.join(','));
    await page.waitForFunction(() => window.__scrapline.scene.match.world.territories[3].owner === 0, null, { timeout: 20000 }).catch(() => {});
    const flagOwnerAfter = await S(page, () => window.__scrapline.scene.match.world.territories[3].owner);
    check('capturing a flag changes ownership', flagOwnerBefore !== 0 && flagOwnerAfter === 0, `owner ${flagOwnerBefore} -> ${flagOwnerAfter}`);
    await page.screenshot({ path: path.join(OUT, '2-capture.png') });

    await page.waitForFunction(() => window.__scrapline.scene.match.world.tick >= 20 * 24, null, { timeout: 30000 });
    const mine = await S(page, () => window.__scrapline.scene.match.world.unitsOf(0).length);
    check('player factories keep producing robots', mine >= 4, `${mine} robots at 24s sim time`);

    // sound: engine unlocked by our clicks, effects started, mute key toggles
    const au = await S(page, () => ({ state: window.__scrapline.sfx.state, played: window.__scrapline.sfx.played }));
    check('sound engine runs and plays effects', au.state === 'running' && au.played > 0, `${au.state}, ${au.played} sounds`);
    await page.keyboard.press('m');
    const mutedOn = await S(page, () => window.__scrapline.sfx.muted);
    const label = await page.locator('#b-mute').innerText();
    await page.keyboard.press('m');
    const mutedOff = await S(page, () => window.__scrapline.sfx.muted);
    check('M key mutes and unmutes sound', mutedOn === true && mutedOff === false && /OFF/.test(label), label);

    // factory selection + production toggle through the HUD
    const barracks = await S(page, () => {
      const b = window.__scrapline.scene.match.world.buildings.find((q) => q.owner === 0 && q.bkind === 'barracks');
      return { x: b.x, y: b.y, id: b.id };
    });
    const bp = await screenOf(page, barracks.x, barracks.y);
    await page.mouse.click(bp.x, bp.y);
    const selB = await S(page, () => window.__scrapline.scene.selBuilding);
    check('clicking a factory selects it', selB === barracks.id);
    await page.click('#b-prod');
    const paused = await S(page, (id) => window.__scrapline.scene.match.world.getEntity(id).paused, barracks.id);
    check('factory panel toggles production', paused === true);
    await page.click('#b-prod');

    // minimap navigation (zoom back in first: when the whole map fits on screen there is nothing to scroll)
    await page.mouse.move(640, 300); // wheel events only reach the game when the pointer is over the map
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -100);
    await sleep(200);
    const before = await S(page, () => window.__scrapline.scene.cameras.main.worldView.x);
    const mm = await page.locator('#minimap').boundingBox();
    await page.mouse.click(mm.x + mm.width * 0.9, mm.y + mm.height * 0.5);
    await sleep(150);
    const after = await S(page, () => window.__scrapline.scene.cameras.main.worldView.x);
    check('minimap click moves the camera', after > before + 100, `${Math.round(before)} -> ${Math.round(after)}`);

    // keyboard: pause / resume
    await page.keyboard.press('p');
    const t1 = await S(page, () => window.__scrapline.scene.match.world.tick);
    await sleep(500);
    const t2 = await S(page, () => window.__scrapline.scene.match.world.tick);
    check('P pauses the simulation', t1 === t2, `tick ${t1}`);
    await page.keyboard.press('p');
    await sleep(400);
    const t3 = await S(page, () => window.__scrapline.scene.match.world.tick);
    check('P resumes the simulation', t3 > t2);

    // control groups
    await page.mouse.move(640, 300);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 100);
    await sleep(200);
    await dragBox(page, 1, 1, 24, 31);
    await page.keyboard.press('Control+1');
    await page.mouse.click(10, 10);
    await page.keyboard.press('1');
    check('control groups recall selection', (await S(page, () => window.__scrapline.scene.sel.size)) > 0);

    // beginner aids: E selects all, Ctrl+click commands without a right button, coach tips, difficulty button
    await page.mouse.click(10, 10);
    await page.keyboard.press('e');
    const allSel = await S(page, () => window.__scrapline.scene.sel.size === window.__scrapline.scene.match.world.unitsOf(0).length && window.__scrapline.scene.sel.size > 0);
    check('E selects all robots', allSel);
    const ground = await screenOf(page, 14.5, 17.5);
    await page.keyboard.down('Control');
    await page.mouse.click(ground.x, ground.y);
    await page.keyboard.up('Control');
    await sleep(200);
    const ctrlOrders = await S(page, () => { const w = window.__scrapline.scene.match.world; return [...window.__scrapline.scene.sel].map((id) => w.getEntity(id)).filter(Boolean).map((u) => u.order.kind); });
    check('Ctrl+click issues a move order (no right button needed)', ctrlOrders.includes('move'), ctrlOrders.join(','));
    const tip = await page.locator('#coach').innerText();
    check('coach shows a tip', tip.length > 10, tip.slice(0, 50));
    await page.click('#b-diff');
    const diffLabel = await page.locator('#b-diff').innerText();
    check('difficulty button cycles the AI level', diffLabel === 'AI: NORMAL', diffLabel);

    check('no console errors (controls session)', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }

  // ----------------------------------------------- 2. play a match to VICTORY (UI-driven)
  {
    const { page, errors } = await open(browser, '?speed=8');
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 100);
    const t0 = Date.now();
    let outcome = null;
    let lastShot = 0;
    let attacking = false;
    while (Date.now() - t0 < 150000 && !outcome) {
      // every second: grab every robot on the map, capture flags with the nearest ones, mass-attack the enemy HQ
      await dragBox(page, 0.5, 0.5, 55.5, 31.5);
      const info = await S(page, () => {
        const w = window.__scrapline.scene.match.world;
        const hq = w.hq(1);
        const flags = w.territories.filter((t) => t.owner !== 0).map((t) => ({ x: t.fx + 0.5, y: t.fy + 0.5 }));
        return { hq: { x: hq.x, y: hq.y }, flags, n: window.__scrapline.scene.sel.size };
      });
      if (info.n >= 12) attacking = true;
      if (info.n < 4) attacking = false;
      if (attacking) {
        // classic RTS: select the army, press A, click the target point (units fight whatever they meet on the way)
        await page.keyboard.press('a');
        const hp = await screenOf(page, info.hq.x, info.hq.y);
        await page.mouse.click(hp.x, hp.y);
      } else if (info.flags.length) {
        // send the closest unowned flag to the group
        const f = info.flags.sort((a, b) => a.x - b.x)[0];
        await rightClickTile(page, f.x, f.y);
      }
      if (Date.now() - lastShot > 20000) {
        lastShot = Date.now();
        await page.screenshot({ path: path.join(OUT, '3-battle.png') });
      }
      await sleep(1000);
      outcome = await S(page, () => window.__scrapline.scene.match.world.winner);
      if (outcome === null) outcome = null;
    }
    const w = await S(page, () => {
      const m = window.__scrapline.scene.match.world;
      return { winner: m.winner, secs: Math.round(m.tick / 20), terr: [m.ownedTerritories(0), m.ownedTerritories(1)] };
    });
    await sleep(300);
    const overlay = await page.locator('#end').isVisible();
    const title = overlay ? await page.locator('#end-title').innerText() : '';
    await page.screenshot({ path: path.join(OUT, '4-end.png') });
    check('a UI-driven match reaches a conclusion with an end screen', w.winner !== null && overlay, `winner=${w.winner} title=${title} sim=${w.secs}s flags ${w.terr}`);
    check('no console errors (match session)', errors.length === 0, errors.slice(0, 3).join(' | '));
    results.push({ name: 'match-1-result', ok: true, info: JSON.stringify(w) });
    await page.close();
  }

  // ------------------------------------------------ 3. passive player -> DEFEAT screen
  {
    const { page, errors } = await open(browser, '?speed=16');
    const t0 = Date.now();
    let winner = null;
    while (Date.now() - t0 < 120000 && winner === null) {
      await sleep(1000);
      winner = await S(page, () => window.__scrapline.scene.match.world.winner);
    }
    await sleep(300);
    const title = (await page.locator('#end').isVisible()) ? await page.locator('#end-title').innerText() : '';
    check('doing nothing ends in DEFEAT', winner === 1 && title === 'DEFEAT', `winner=${winner} title=${title}`);
    await page.screenshot({ path: path.join(OUT, '5-defeat.png') });
    // restart button starts a fresh match
    await page.click('#end-btn');
    await sleep(300);
    const tick = await S(page, () => window.__scrapline.scene.match.world.tick);
    check('restart begins a fresh match', tick < 400, `tick ${tick}`);
    check('no console errors (defeat session)', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(2);
});
