// Lobby thumbnail (1280x720): the island at the Fairground with the Fortune Isle logo. node tools/thumbnail.mjs [baseUrl]
// Runs against the dev server in demo mode, so no API is needed: npm run dev, then this.
import { pathToFileURL } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:5197/';
const pw = process.env.PLAYWRIGHT ?? 'C:/Users/sherisan/source/TruckCrash/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(pw).href);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? 'C:/Users/sherisan/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(`${base}?demo&unlock`);
await page.getByText('Tap to play').click({ timeout: 30000 });
await sleep(800);
await page.evaluate(() => {
  const fi = window.__fi;
  fi.world.engine.travel('fairground');
  fi.useGame.setState({ polly: null });
});
await sleep(2500);
await page.addStyleTag({
  content: `.topbar, .polly, .prompt, .zone-banner, .toasts { display: none !important; }
  .thumb-logo { position: fixed; left: 0; right: 0; bottom: 56px; display: flex; flex-direction: column; align-items: center; transform: rotate(-3deg); font-family: Fredoka; font-weight: 700; line-height: .85; pointer-events: none; }
  .thumb-logo span { -webkit-text-stroke: 4px #2c1d3f; text-shadow: 0 8px 0 #2c1d3f; }
  .thumb-logo .a { font-size: 132px; color: #ffd23f; } .thumb-logo .b { font-size: 104px; color: #fff; }`,
});
await page.evaluate(() => {
  const d = document.createElement('div');
  d.className = 'thumb-logo';
  d.innerHTML = '<span class="a">Fortune</span><span class="b">Isle</span>';
  document.body.appendChild(d);
});
await sleep(400);
await page.screenshot({ path: 'public/thumbnail.png' });
await browser.close();
console.log('wrote public/thumbnail.png');
