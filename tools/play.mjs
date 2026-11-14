// Plays every game through the UI against the API and screenshots key moments: node tools/play.mjs [baseUrl] [outDir]
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
const shot = (n) => page.screenshot({ path: `${out}/play-${n}.png` });
const ev = (js) => page.evaluate(js);
const open = async (g) => { await ev(`window.__fi.useGame.getState().openGame('${g}')`); await sleep(800); };
const close = async () => { await ev(`window.__fi.useGame.getState().closeGame()`); await sleep(300); };
const result = () => page.locator('.result').innerText().catch(() => '?');
const balance = () => page.locator('#balance-pill b').innerText();

await page.goto(base + (process.env.Q ? `?${process.env.Q}` : ''));
await page.getByText('Tap to play').click({ timeout: 20000 });
await sleep(1200);
await shot('00-spawn');
console.log('start balance', await balance());

// Coconut Shy
await open('coconut-shy');
await page.locator('.shy-slot').nth(1).click();
await sleep(350);
await shot('01-coconut-throw');
await sleep(1600);
await shot('02-coconut-result');
console.log('coconut:', await result(), '| balance', await balance());
await close();

// Cup Shuffle
await open('cup-shuffle');
await page.getByRole('button', { name: 'Shuffle' }).click();
await sleep(1800);
await shot('03-cups-shuffle');
await page.getByRole('button', { name: 'Pick a cup!' }).waitFor({ timeout: 10000 });
await page.locator('.cup').nth(0).click({ force: true });
await sleep(1500);
await shot('04-cups-result');
console.log('cups:', await result());
await close();

// Prize Wheel
await open('prize-wheel');
await page.getByRole('button', { name: 'Spin!' }).click();
await sleep(1500);
await shot('05-wheel-spin');
await sleep(3600);
await shot('06-wheel-result');
console.log('wheel:', await result());
await close();

// Duck Pond
await open('duck-pond');
await page.locator('.duck').nth(4).click({ force: true });
await sleep(1500);
await shot('07-duck-result');
console.log('duck:', await result());
await sleep(1500);
await close();

// High Striker
await open('high-striker');
await page.getByRole('button', { name: /Swing/ }).click();
await sleep(900);
await shot('08-striker-rise');
await sleep(1200);
await shot('09-striker-result');
console.log('striker:', await result());
await close();

// Scratch Kiosk
await open('scratch-kiosk');
await page.getByRole('button', { name: 'Buy a card' }).click();
await sleep(600);
const foil = await page.locator('.foil').boundingBox();
if (foil) {
  await page.mouse.move(foil.x + 20, foil.y + 30);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(foil.x + 20 + (i % 2 ? foil.width - 40 : 0), foil.y + 30 + i * 8, { steps: 6 });
  await page.mouse.up();
}
await sleep(300);
await shot('10-scratch-partial');
const reveal = page.getByRole('button', { name: 'Reveal all' });
if (await reveal.isVisible()) await reveal.click();
await sleep(1200);
await shot('11-scratch-result');
console.log('scratch:', await result());
await close();

// Level up: 30 quick R1 spins straight through the API (10 XP each → level 4).
await ev(`(async () => { const g = window.__fi.useGame.getState(); for (let i = 0; i < 30; i++) await g.api.bet({ game: 'prize-wheel', stake: 1 }); await g.run((api) => api.state()); })()`);
await sleep(800);
console.log('level', await page.locator('.level-badge').innerText(), '| balance', await balance());
await ev(`window.__fi.useGame.getState().setPanel('travel')`);
await sleep(600);
await shot('12-travel');
await ev(`window.__fi.useGame.getState().setPanel(null)`);
for (const z of ['casino', 'jungle', 'volcano', 'fairground']) {
  await ev(`window.__fi.world.engine.travel('${z}')`);
  await sleep(1300);
  await shot(`13-zone-${z}`);
}

// Roulette
await ev(`window.__fi.world.engine.travel('casino')`);
await open('roulette');
await page.locator('.rc.red').first().click();
await page.locator('.rc.out.red').click();
await page.locator('.rdozens .rc').nth(1).click();
await sleep(300);
await shot('14-roulette-bets');
await page.getByRole('button', { name: /^Spin/ }).click();
await sleep(1800);
await shot('15-roulette-spin');
await sleep(3000);
await shot('16-roulette-result');
console.log('roulette:', await result());
await close();

// Temple Doors
await open('temple-doors');
await page.getByRole('button', { name: 'Enter the temple' }).click();
await sleep(600);
await shot('17-temple-level1');
for (let i = 0; i < 3; i++) {
  if (!(await page.locator('.door:not([disabled])').first().isVisible().catch(() => false))) break;
  await page.locator('.door').nth(i % 3).click({ force: true });
  await sleep(350);
  await shot(`18-temple-pick${i}`);
  await sleep(900);
}
await page.getByRole('button', { name: /^Cash out/ }).click({ timeout: 1500 }).catch(() => {});
await sleep(900);
await shot('19-temple-end');
console.log('temple:', await result());
await close();

// Lava Crash: a manual cash-out at ~1.5 s, then an auto cash-out at ×1.2
await open('lava-crash');
await page.getByRole('button', { name: /Start the climb/ }).click();
await sleep(1500);
await shot('20-lava-climb');
// The climb may already have erupted (4% at once, ~33% before ×1.35): then there is no button to press.
await page.getByRole('button', { name: /^Cash out/ }).click({ timeout: 1500 }).catch(() => console.log('lava: erupted before the cash-out'));
await sleep(1200);
await shot('21-lava-end');
console.log('lava manual:', await result());
await page.locator('.auto input[type=checkbox]').check();
await page.locator('.auto-x').fill('1.2');
await page.getByRole('button', { name: /Start the climb/ }).click();
await sleep(2500);
await shot('22-lava-auto');
console.log('lava auto 1.2:', await result());
await close();

// Panels + a big-win celebration
for (const p of ['wardrobe', 'rg', 'history', 'board', 'paytables']) {
  await ev(`window.__fi.useGame.getState().setPanel('${p}')`);
  await sleep(700);
  await shot(`23-panel-${p}`);
}
await ev(`window.__fi.useGame.getState().setPanel(null)`);
await ev(`window.__fi.useGame.setState({ celebration: { id: 999, effect: 'fx-confetti', multiplier: 24.6, payout: 246, big: true }, shake: 99 })`);
await sleep(500);
await shot('24-bigwin');

console.log('end balance', await balance());
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
