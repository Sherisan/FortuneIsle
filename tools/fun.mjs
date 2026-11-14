// Landmark shows: ride the Ferris wheel, light the lighthouse, poke the volcano, touch the temple gem, and the tap toys
// (palm coconut, boat lap, balloons). node tools/fun.mjs [baseUrl] [outDir]   (demo mode, no API needed)
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `${out}/fun-${n}.png` });
const ev = (js) => page.evaluate(js);
const state = (k) => ev(`window.__fi.useGame.getState().${k}`);

await page.goto(`${base}?demo&unlock`);
await page.getByText('Tap to play').click({ timeout: 60000 });
await sleep(1000);

/** Walk to a landmark's spot and use it, the way a player would. */
async function use(id) {
  await ev(`(() => { const e = window.__fi.world.engine; const s = e.spot('${id}'); e.enterScene('island', { gx: s.ax + 1, gy: s.ay + 1 }); e.walkTo(s.ax, s.ay); })()`);
  await page.waitForFunction((id) => window.__fi.world.near?.id === id, id, { timeout: 30000 }).catch(() => console.log('never got near', id));
  await ev(`window.__fi.world.engine.interactNear()`);
}

// Ferris wheel ride: until the caption clears.
await use('fun-ferris');
await sleep(800);
console.log('ride caption:', await state('cinematic'));
await shot('1-ferris-board');
await sleep(4500);
await shot('2-ferris-top');
await page.waitForFunction(() => window.__fi.useGame.getState().cinematic === null, null, { timeout: 60000 }).catch(() => console.log('ride never ended'));
console.log('after ride caption:', await state('cinematic'));
await shot('3-ferris-off');

// Lighthouse night
await use('fun-lighthouse');
await sleep(3000);
await shot('4-lighthouse-night');

// Volcano eruption
await use('fun-volcano');
await sleep(1300);
await shot('5-volcano-erupt');
await sleep(1200);
await shot('6-volcano-bombs');
await page.waitForFunction(() => window.__fi.useGame.getState().cinematic === null, null, { timeout: 30000 }).catch(() => {});

// Temple gem
await use('fun-temple');
await sleep(1600);
await shot('7-temple');

// Tap toys at the harbour: boat lap, palm coconut, balloons.
await ev(`window.__fi.world.engine.travel('harbour')`);
await sleep(600);
console.log('pokes:', await ev(`(() => {
  const e = window.__fi.world.engine;
  const at = (p) => ({ x: (p.gx - p.gy) * 48, y: (p.gx + p.gy) * 24 });
  const r = {};
  for (const kind of ['boat', 'palm']) {
    const q = e.pokeables.find((q) => q.prop.kind === kind);
    if (!q) continue;
    const s = at(q.prop);
    const pt = kind === 'palm' ? { x: s.x + q.thing.top.x, y: s.y + q.thing.top.y } : { x: s.x, y: s.y - 40 };
    r[kind] = e.pokeAt(pt);
  }
  return JSON.stringify(r);
})()`));
await sleep(900);
await shot('8-harbour-pokes');

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
