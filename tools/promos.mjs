// Promotions through the UI against the API: the gift button, the panel, a free play, roulette markers.
// node tools/promos.mjs [baseUrl] [outDir]   (seed promotions first — see the API's back office)
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
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const shot = (n) => page.screenshot({ path: `${out}/promo-${n}.png` });
const ev = (js) => page.evaluate(js);
const balance = () => page.locator('#balance-pill b').innerText();
const toasts = () => page.locator('.toast').allInnerTexts();

await page.goto(base + (process.env.Q ? `?${process.env.Q}` : ''));
await page.getByText('Tap to play').click({ timeout: 20000 });
await page.locator('.icon-btn.gift').waitFor({ timeout: 10000 });
await sleep(800);
await shot('00-gift');
console.log('gift badge:', await page.locator('.icon-btn.gift .badge').innerText().catch(() => '(none)'), '| balance', await balance());

await page.locator('.icon-btn.gift').click();
await sleep(600);
await shot('01-panel');
console.log('cards:', await page.locator('.promo-card h3').allInnerTexts());
await page.locator('.sheet-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
await sleep(300);
await shot('02-panel-bottom');
await ev(`window.__fi.useGame.getState().setPanel('board')`);
await sleep(500);
await shot('03-board');
await ev(`window.__fi.useGame.getState().setPanel(null)`);

// Cup Shuffle with a free play.
await ev(`window.__fi.useGame.getState().openGame('cup-shuffle')`);
await sleep(800);
await page.locator('.free-toggle').click();
await sleep(300);
await shot('04-cups-free-on');
const before = await balance();
await page.getByRole('button', { name: 'Shuffle' }).click();
await page.getByRole('button', { name: 'Pick a cup!' }).waitFor({ timeout: 15000 });
await page.locator('.cup').nth(1).click({ force: true });
await sleep(1800);
await shot('05-cups-free-result');
console.log('free cups:', await page.locator('.result').innerText(), '| balance', before, '→', await balance(), '| toasts', await toasts());
console.log('free plays left:', await ev(`window.__fi.useGame.getState().promos.freeBets.length`), '| toggle on:', await ev(`window.__fi.useGame.getState().useFree`));

// Real-money cups plays: the Boardwalk streak progress.
for (let i = 0; i < 4; i++) {
  if (await page.locator('.free-toggle.on').count()) await page.locator('.free-toggle').click();
  await page.getByRole('button', { name: /Shuffle|Play again/ }).first().click();
  await page.getByRole('button', { name: 'Pick a cup!' }).waitFor({ timeout: 15000 });
  await page.locator('.cup').nth(i % 3).click({ force: true });
  await sleep(1800);
}
await shot('06-cups-streak');
console.log('after 4 paid cups:', await toasts());
await ev(`window.__fi.useGame.getState().closeGame()`);
await sleep(300);

// Roulette: the lucky 17 marker (the table renders before level 2; betting needs the casino open).
await ev(`window.__fi.useGame.getState().openGame('roulette')`);
await sleep(900);
await shot('07-roulette-lucky');
console.log('lucky cells:', await page.locator('.rc.promo-lucky').allInnerTexts());
await ev(`window.__fi.useGame.getState().closeGame()`);

await ev(`window.__fi.useGame.getState().setPanel('promos')`);
await sleep(700);
await shot('08-panel-after');
console.log('streak bar:', await page.locator('.t-StreakMission .pbar span').innerText().catch(() => '?'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
