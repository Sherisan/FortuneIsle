// Quick look at the notice board's promotions strip and the roulette markers: node tools/promos-board.mjs [baseUrl] [outDir]
import { pathToFileURL } from 'node:url';
const base = process.argv[2] ?? 'http://localhost:5197/';
const out = process.argv[3] ?? 'shots';
const pw = process.env.PLAYWRIGHT ?? 'C:/Users/sherisan/source/TruckCrash/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(pw).href);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? 'C:/Users/sherisan/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(base);
await page.getByText('Tap to play').click({ timeout: 20000 });
await page.locator('.icon-btn.gift').waitFor({ timeout: 10000 });
await page.evaluate(`window.__fi.useGame.getState().setPanel('promos')`);
await sleep(400);
await page.locator('.sheet-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
await page.evaluate(`window.__fi.useGame.getState().setPanel('board')`);
await sleep(600);
await page.screenshot({ path: `${out}/promo-10-board-top.png` });
await page.evaluate(`window.__fi.useGame.getState().setPanel(null)`);
await page.evaluate(`window.__fi.useGame.getState().openGame('roulette')`);
await sleep(900);
await page.locator('.rc.promo-lucky').screenshot({ path: `${out}/promo-11-lucky-cell.png` });
await browser.close();
