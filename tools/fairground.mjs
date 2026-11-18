// Fairground QA checks (demo mode, dev server; needs window.__fi): the Coconut Shy ball lands on the coconut you tap,
// the High Striker hammer head comes down on the red pad and the puck drops back after each result, the Prize Wheel never overflows the stage or moves while it
// spins, and the Duck Pond tags show in full and are put away before the ducks swim on.
// node tools/fairground.mjs [baseUrl] [outDir]   (W=360 H=740 for phone size)
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:5197/';
const out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });
const pw = process.env.PLAYWRIGHT ?? 'C:/Users/sherisan/source/TruckCrash/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(pw).href);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? 'C:/Users/sherisan/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fail.push(what); };
const open = async (g) => { await page.evaluate((g) => window.__fi.useGame.getState().openGame(g), g); await sleep(900); await page.evaluate(() => Promise.all(document.querySelector('.game-card').getAnimations().map((a) => a.finished))); };
const close = async () => { await page.evaluate(() => window.__fi.useGame.getState().closeGame()); await sleep(400); };

await page.goto(`${base}?demo&unlock`);
await page.getByText('Tap to play').click({ timeout: 60000 });
await sleep(1500);

// ── Coconut Shy: the ball ends on the coconut you tapped ──
await open('coconut-shy');
for (const i of [0, 4, 1]) {
  await page.locator('.shy-slot').nth(i).click();
  await page.waitForSelector('.ball', { timeout: 5000 });
  const r = await page.evaluate((i) => {
    const ball = document.querySelector('.ball');
    for (const a of ball.getAnimations()) { a.pause(); a.currentTime = 649; }
    const b = ball.getBoundingClientRect();
    const c = document.querySelectorAll('.shy-slot .coconut')[i].getBoundingClientRect();
    return { dx: Math.round(b.x + b.width / 2 - (c.x + c.width / 2)), dy: Math.round(b.y + b.height / 2 - (c.y + c.height / 2)) };
  }, i);
  if (i === 4) await page.screenshot({ path: `${out}/fair-shy-throw-right.png` });
  await page.evaluate(() => document.querySelector('.ball')?.getAnimations().forEach((a) => a.play()));
  check(Math.abs(r.dx) <= 8 && Math.abs(r.dy) <= 14, `coconut ${i + 1}: ball lands ${JSON.stringify(r)} px from its centre`);
  await page.waitForFunction(() => !window.__fi.useGame.getState().busy && !document.querySelector('.ball'), null, { timeout: 20000 });
  await sleep(900);
}
await close();

// ── High Striker: the hammer head comes down on the red pad ──
await open('high-striker');
await page.evaluate(() => {
  const g = window.__fi.useGame;
  const real = g.getState().bet;
  g.setState({ bet: (b) => new Promise((res) => { window.__release = () => { g.setState({ bet: real }); res(real(b)); }; }) });
});
await sleep(300);
await page.getByRole('button', { name: /Swing/ }).click();
await page.waitForSelector('.hammer.swing', { timeout: 5000 });
await page.evaluate(() => Promise.all(document.querySelector('.hammer').getAnimations().map((a) => a.finished)));
const hs = await page.evaluate(() => {
  const h = document.querySelector('.hammer');
  // Rotated flat, the handle's box runs from the grip to the head's end; the head is the last 24px, ±23px across it.
  const b = h.getBoundingClientRect();
  const p = document.querySelector('.pad').getBoundingClientRect();
  return { headX: Math.round(b.right - 12 - (p.x + p.width / 2)), headBottomToPadTop: Math.round(b.y + b.height / 2 + 23 - p.y), pad: getComputedStyle(document.querySelector('.pad')).backgroundImage.slice(0, 40) };
});
await page.screenshot({ path: `${out}/fair-striker-hit.png` });
await page.evaluate(() => window.__release());
check(Math.abs(hs.headX) <= 6 && Math.abs(hs.headBottomToPadTop) <= 3, `hammer head over the pad ${JSON.stringify(hs)}`);
// The puck reaches the lit tier, then drops back to the base by itself (the tier stays lit with the result).
const puckAt = () => {
  const puck = document.querySelector('.puck'), tower = document.querySelector('.tower'), lit = document.querySelector('.tier.lit');
  return { puck: +((parseFloat(getComputedStyle(puck).bottom) / tower.clientHeight) * 100).toFixed(1), lit: lit ? parseFloat(lit.style.bottom) : null, fall: puck.classList.contains('fall') };
};
await page.addScriptTag({ content: `window.__puckAt = ${puckAt.toString()};` });
const reached = await (await page.waitForFunction(() => !window.__fi.useGame.getState().busy && document.querySelector('.tier.lit') && window.__puckAt(), null, { timeout: 30000 })).jsonValue();
check(reached.lit != null && Math.abs(reached.puck - reached.lit) < 1.5 && !reached.fall, `puck reaches the lit tier ${JSON.stringify(reached)}`);
const settle = async () => {
  await page.waitForSelector('.puck.fall', { timeout: 15000 });
  await page.evaluate(() => Promise.all(document.querySelector('.puck').getAnimations().map((a) => a.finished)));
  return page.evaluate(() => window.__puckAt());
};
const down = await settle();
check(Math.abs(down.puck - 2) < 0.6 && down.lit != null, `then drops back to the base, tier still lit ${JSON.stringify(down)}`);
await page.screenshot({ path: `${out}/fair-striker-done.png` });
// Swing again the moment a result shows: that swing's drop timer must not fire during the next one.
await page.getByRole('button', { name: /Swing/ }).click();
await page.waitForSelector('.hammer.swing', { timeout: 5000 });
const puckWasDown = await page.evaluate(() => new Promise((done) => {
  const t = setInterval(() => {
    if (!document.querySelector('.tier.lit')) return;
    clearInterval(t);
    const g = window.__fi.useGame;
    const real = g.getState().bet;
    g.setState({ bet: (b) => new Promise((res) => { window.__release = () => { g.setState({ bet: real }); res(real(b)); }; }) });
    setTimeout(() => {
      const down = document.querySelector('.puck').classList.contains('fall');
      [...document.querySelectorAll('button')].find((b) => /Swing/.test(b.textContent)).click();
      done(down);
    }, 50);
  }, 10);
}));
await sleep(1800);
const race = await page.evaluate(() => ({ fall: !!document.querySelector('.puck.fall'), swinging: !!document.querySelector('.hammer.swing') }));
// puckWasDown false: the new swing began before the old drop was due, so the guard was really exercised.
check(puckWasDown === false && !race.fall && race.swinging, `swinging straight after a result: the old drop doesn't fire mid-swing ${JSON.stringify({ puckWasDown, ...race })}`);
await page.evaluate(() => window.__release());
await page.waitForFunction(() => !window.__fi.useGame.getState().busy && document.querySelector('.tier.lit'), null, { timeout: 30000 });
const down2 = await settle();
check(Math.abs(down2.puck - 2) < 0.6, `and that swing's puck drops back too ${JSON.stringify(down2)}`);
await close();

// ── Prize Wheel: no scrollbar and no shift while it spins ──
await open('prize-wheel');
const at = () => page.evaluate(() => {
  const st = document.querySelector('.stage');
  const w = document.querySelector('.wheel-wrap').getBoundingClientRect();
  return { sw: st.scrollWidth, sh: st.scrollHeight, cw: st.clientWidth, x: Math.round(w.x), y: Math.round(w.y), w: Math.round(w.width) };
});
const before = await at();
await page.getByRole('button', { name: /^Spin/ }).click();
const samples = [];
for (let k = 0; k < 16; k++) { samples.push(await at()); await sleep(250); }
await page.screenshot({ path: `${out}/fair-wheel-spinning.png` });
const moved = samples.filter((s) => s.x !== before.x || s.y !== before.y || s.w !== before.w);
const wide = [before, ...samples].filter((s) => s.sw > s.cw + 1 || s.cw !== before.cw);
check(wide.length === 0, `no sideways overflow and no scrollbar change while spinning (${wide.length} bad samples${wide.length ? ' e.g. ' + JSON.stringify(wide[0]) : ''}; before ${JSON.stringify(before)})`);
check(moved.length === 0, `wheel box stays put while spinning ${JSON.stringify(before)} ${moved.length ? JSON.stringify(moved[0]) : ''}`);
await page.waitForFunction(() => !window.__fi.useGame.getState().busy && document.querySelector('.result:not(.idle)'), null, { timeout: 30000 });
await sleep(800);
await close();

// ── Duck Pond: tags in full at the reveal, gone before the ducks swim on ──
await open('duck-pond');
await sleep(800);
// Hook the duck nearest the back of the pond (the highest one).
const back = await page.evaluate(() => { const d = [...document.querySelectorAll('.duck')]; let bi = 0; d.forEach((el, i) => { if (el.getBoundingClientRect().y < d[bi].getBoundingClientRect().y) bi = i; }); return bi; });
await page.evaluate((i) => document.querySelectorAll('.duck')[i].click(), back);
await page.waitForSelector('.duck-tag', { timeout: 15000 });
await page.evaluate(() => {
  window.__log = [];
  const pos = () => document.querySelector('.duck').style.left;
  let last = pos();
  const t0 = performance.now();
  window.__logDone = (async () => {
    while (performance.now() - t0 < 12000) {
      await new Promise((r) => setTimeout(r, 30));
      const p = pos();
      window.__log.push({ moved: p !== last, tags: document.querySelectorAll('.duck-tag').length });
      last = p;
    }
  })();
});
const tags = await page.evaluate(() => {
  const pond = document.querySelector('.pond').getBoundingClientRect();
  const stage = document.querySelector('.stage').getBoundingClientRect();
  const t = [...document.querySelectorAll('.duck-tag')].map((e) => e.getBoundingClientRect());
  return { n: t.length, topmost: Math.round(Math.min(...t.map((r) => r.y))), pondTop: Math.round(pond.y), stageTop: Math.round(stage.y) };
});
await page.screenshot({ path: `${out}/fair-duck-reveal.png` });
check(tags.n === 12 && tags.topmost >= tags.stageTop && tags.topmost >= tags.pondTop, `12 tags, all inside the pond and stage ${JSON.stringify(tags)}`);
// Watch until the ducks have been swimming a while: whenever a duck has moved, no tag may be showing.
const log = await page.evaluate(async () => { await window.__logDone; return window.__log; });
const firstMove = log.findIndex((r) => r.moved);
const lastTag = log.map((r) => r.tags > 0).lastIndexOf(true);
check(log[0]?.tags === 12 && !log[0].moved, `log starts at the reveal: ducks still, 12 tags (${JSON.stringify(log[0])})`);
check(firstMove > lastTag && lastTag >= 0, `tags go (last seen at sample ${lastTag}) before the ducks move (first move at sample ${firstMove})`);
check(log.every((r) => !r.moved || r.tags === 0), `no tag shows while any duck is moving (${log.filter((r) => r.moved && r.tags).length} bad samples)`);
await page.screenshot({ path: `${out}/fair-duck-swimming.png` });
const res = await page.evaluate(() => document.querySelector('.result')?.textContent);
console.log('     result line while swimming:', res);
await close();

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
console.log(fail.length ? `${fail.length} FAILED` : 'ALL OK');
