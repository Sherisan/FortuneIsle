// Scripted visual check: node tools/shots.mjs [baseUrl] [outDir]
// Needs a Playwright install; PLAYWRIGHT points at its package (default: the copy in ../TruckCrash).
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:5197/';
const out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });
const pw = process.env.PLAYWRIGHT ?? 'C:/Users/sherisan/source/TruckCrash/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(pw).href);

// CHROME: a browser binary when Playwright's own download doesn't match its version.
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? 'C:/Users/sherisan/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(name, viewport, steps) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto(base + (base.includes('?') ? '&' : '?') + (process.env.Q ?? ''));
  await page.getByText('Tap to play').click({ timeout: 20000 });
  await sleep(1500);
  await steps(page, async (n) => page.screenshot({ path: `${out}/${name}-${n}.png` }));
  await page.close();
}

const store = (page, fn) => page.evaluate(fn);

await session('desktop', { width: 1280, height: 800 }, async (page, shot) => {
  await shot('harbour');
  // Walk up the path to the boardwalk with the keyboard.
  await page.keyboard.down('d');
  await sleep(1600);
  await page.keyboard.up('d');
  await sleep(500);
  await shot('walk');
  for (const g of ['coconut-shy', 'cup-shuffle', 'scratch-kiosk', 'prize-wheel', 'duck-pond', 'high-striker']) {
    await store(page, `window.__fi.useGame.getState().openGame('${g}')`);
    await sleep(900);
    await shot(`open-${g}`);
    await store(page, `window.__fi.useGame.getState().closeGame()`);
    await sleep(300);
  }
});

await session('mobile', { width: 390, height: 844 }, async (page, shot) => {
  await shot('harbour');
  await store(page, `window.__fi.useGame.getState().setPanel('menu')`);
  await sleep(600);
  await shot('menu');
  await store(page, `window.__fi.useGame.getState().setPanel(null)`);
  await store(page, `window.__fi.useGame.getState().openGame('coconut-shy')`);
  await sleep(900);
  await shot('coconut');
});

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
