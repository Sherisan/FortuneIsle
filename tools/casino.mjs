// Grand Casino walkthrough: walk to the door, the entrance overlay, step inside, the interior, roulette, exit.
// node tools/casino.mjs [baseUrl] [outDir]   (demo mode, no API needed)
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
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `${out}/casino-${n}.png` });
const ev = (js) => page.evaluate(js);
const doorway = () => ev(`window.__fi.useGame.getState().doorway?.kind ?? null`);

await page.goto(`${base}?demo&unlock`);
await page.getByText('Tap to play').click({ timeout: 60000 });
await sleep(1000);

// Stand 3 tiles from the door and walk to it: the doorway must open by itself.
await ev(`(() => { const e = window.__fi.world.engine; const d = e.spot('casino-door'); e.enterScene('island', { gx: d.ax + 2, gy: d.ay + 2 }); e.walkTo(d.ax, d.ay); })()`);
await page.waitForFunction(() => window.__fi.useGame.getState().doorway?.kind === 'enter', null, { timeout: 30000 }).catch(() => {});
await sleep(600);
console.log('doorway after walking up:', await doorway());
await shot('1-entrance');
await page.getByRole('button', { name: 'Step inside' }).click();
await sleep(500);
await shot('2-doors-open');
await page.waitForFunction(() => window.__fi.useGame.getState().doorway === null, null, { timeout: 20000 }).catch(() => {});
await sleep(800);
console.log('scene:', await ev(`window.__fi.useGame.getState().scene`), '| doorway:', await doorway());
await shot('3-inside');

for (const [n, gx, gy] of [['bar', 19, 22], ['slots', 22, 18], ['vip', 27, 21]]) {
  await ev(`window.__fi.world.engine.enterScene('casino', { gx: ${gx}, gy: ${gy} })`);
  await sleep(900);
  await shot(`4-${n}`);
}

// Roulette inside
await ev(`(() => { const e = window.__fi.world.engine; e.enterScene('casino', { gx: 21, gy: 24 }); e.walkTo(20, 21); })()`);
await page.waitForFunction(() => window.__fi.world.near?.id === 'roulette', null, { timeout: 30000 }).catch(() => {});
await ev(`window.__fi.world.engine.interactNear()`);
await sleep(1000);
console.log('game:', await ev(`window.__fi.useGame.getState().game`));
await shot('5-roulette');
await ev(`window.__fi.useGame.getState().closeGame()`);
await sleep(400);

// Walk out through the exit arch.
await ev(`(() => { const e = window.__fi.world.engine; e.enterScene('casino', { gx: 24, gy: 28 }); e.walkTo(24, 32); })()`);
await page.waitForFunction(() => window.__fi.useGame.getState().doorway?.kind === 'exit', null, { timeout: 30000 }).catch(() => {});
console.log('doorway at exit:', await doorway());
await page.waitForFunction(() => window.__fi.useGame.getState().doorway === null, null, { timeout: 20000 }).catch(() => {});
await sleep(1500);
console.log('scene after exit:', await ev(`window.__fi.useGame.getState().scene`), '| doorway:', await doorway());
await shot('6-back-outside');

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
