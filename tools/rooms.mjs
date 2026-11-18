// Walk-in rooms and the new games: the Rusty Anchor (Pirate Dice), the casino floor (Island Reels, Dragon Tiger), the
// stairs up to the VIP Salon and back down. node tools/rooms.mjs [baseUrl] [outDir]   (demo mode, no API needed)
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
const shot = (n) => page.screenshot({ path: `${out}/rooms-${n}.png` });
const ev = (js) => page.evaluate(js);
const state = () => ev(`(() => { const s = window.__fi.useGame.getState(); return { scene: s.scene, doorway: s.doorway, game: s.game, balance: s.balance }; })()`);
const fail = [];
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fail.push(what); };

/** Put the player 2 tiles from a spot and walk to it; doorways fire by themselves, others are used on arrival. */
async function walkTo(id, scene) {
  await ev(`(() => { const e = window.__fi.world.engine; if (e.scene !== '${scene}') e.enterScene('${scene}'); const d = e.spot('${id}'); const exit = d.kind === 'exit'; e.enterScene('${scene}', { gx: d.ax + (exit ? 0 : d.ax > 24 ? -2 : 2), gy: d.ay + (exit ? -3 : 2) }); e.walkTo(d.ax, d.ay); })()`);
}
async function waitFor(fn, ms = 30000) {
  await page.waitForFunction(fn, null, { timeout: ms }).catch(() => {});
}
async function play(id, scene, button, n) {
  await walkTo(id, scene);
  await waitFor(`window.__fi.world.near?.id === '${id}'`);
  await ev(`window.__fi.world.engine.interactNear()`);
  await sleep(900);
  const s = await state();
  check(s.game != null, `${id}: opened ${s.game}`);
  await shot(`${n}-open`);
  const before = s.balance;
  await page.getByRole('button', { name: button }).first().click();
  await waitFor(`(() => { const r = window.__fi.useGame.getState().state?.round; return r && r.status !== 'live' && !window.__fi.useGame.getState().busy; })()`);
  await sleep(2600);
  const r = await ev(`window.__fi.useGame.getState().state.round`);
  check(r && r.game === s.game, `${id}: round ${r?.status} ×${r?.multiplier} outcome ${JSON.stringify(r?.outcome)}`);
  console.log('     balance', before, '→', (await state()).balance);
  await shot(`${n}-result`);
  await ev(`window.__fi.useGame.getState().closeGame()`);
  await sleep(400);
}

await page.goto(`${base}?demo&unlock`);
await page.getByText('Tap to play').click({ timeout: 60000 });
await sleep(1500);

// ── The Rusty Anchor ──
const tav = await ev(`(() => { const e = window.__fi.world.engine; const b = e.map.props.find((p) => p.kind === 'tavern'); const d = e.spot('tavern-door'); return { b: b && [b.gx, b.gy], d: d && [d.gx, d.gy, d.ax, d.ay] }; })()`);
check(tav.b && tav.d, `tavern building ${JSON.stringify(tav.b)} door ${JSON.stringify(tav.d)}`);
await ev(`(() => { const e = window.__fi.world.engine; const d = e.spot('tavern-door'); e.enterScene('island', { gx: d.ax + 2, gy: d.ay + 3 }); })()`);
await sleep(1500);
await shot('1-tavern-outside');
await walkTo('tavern-door', 'island');
await waitFor(`window.__fi.useGame.getState().doorway?.kind === 'enter'`);
await sleep(700);
check((await state()).doorway?.to === 'tavern', 'tavern doorway opens by walking up');
await shot('2-tavern-entrance');
await page.getByRole('button', { name: 'Push the door' }).click();
await waitFor(`window.__fi.useGame.getState().doorway === null`, 20000);
await sleep(1500);
check((await state()).scene === 'tavern', 'inside the tavern');
await shot('3-tavern-inside');
await play('pirate-dice', 'tavern', /^Roll on/, '4-dice');

// Walk out: back on the island at the tavern door.
await walkTo('tavern-exit', 'tavern');
await waitFor(`window.__fi.useGame.getState().doorway?.kind === 'exit'`);
await waitFor(`window.__fi.useGame.getState().doorway === null`, 20000);
await sleep(1200);
const outside = await ev(`(() => { const e = window.__fi.world.engine; const d = e.spot('tavern-door'); return { scene: e.scene, near: Math.hypot(e.player.gx - d.ax, e.player.gy - d.ay) < 0.6 }; })()`);
check(outside.scene === 'island' && outside.near, `back on the island at the tavern door (${JSON.stringify(outside)})`);

// ── The casino floor ──
await ev(`window.__fi.world.engine.enterScene('casino', { gx: 22, gy: 19 })`);
await sleep(1500);
await shot('5-casino-slots');
await play('island-reels', 'casino', /^Spin$/, '6-reels');
await ev(`window.__fi.world.engine.enterScene('casino', { gx: 27, gy: 26 })`);
await sleep(1200);
await shot('7-casino-tables');
await play('dragon-tiger', 'casino', /^Deal/, '8-dragon');

// ── Up to the VIP Salon and back down ──
await ev(`window.__fi.world.engine.enterScene('casino', { gx: 30, gy: 21 })`);
await sleep(1200);
await shot('9-vip-stairs');
await walkTo('vip-stairs', 'casino');
await waitFor(`window.__fi.useGame.getState().doorway?.kind === 'enter'`);
await sleep(600);
check((await state()).doorway?.to === 'vip', 'stairs open the VIP doorway');
await shot('10-vip-entrance');
await page.getByRole('button', { name: 'Climb the stairs' }).click();
await waitFor(`window.__fi.useGame.getState().doorway === null`, 20000);
await sleep(1500);
check((await state()).scene === 'vip', 'inside the VIP Salon');
await shot('11-vip-inside');
await ev(`window.__fi.world.engine.enterScene('vip', { gx: 22, gy: 20 })`);
await sleep(1200);
await shot('12-vip-window');
await play('vip-reels', 'vip', /^Spin$/, '13-vip-reels');
await walkTo('vip-exit', 'vip');
await waitFor(`window.__fi.useGame.getState().doorway?.kind === 'exit'`);
await waitFor(`window.__fi.useGame.getState().doorway === null`, 20000);
await sleep(1200);
const down = await ev(`(() => { const e = window.__fi.world.engine; const d = e.spot('vip-stairs'); return { scene: e.scene, near: !!d && Math.hypot(e.player.gx - d.ax, e.player.gy - d.ay) < 0.6 }; })()`);
check(down.scene === 'casino' && down.near, `back on the casino floor at the stairs (${JSON.stringify(down)})`);

// Fast travel straight to the VIP Salon, then the board and paytables.
await ev(`window.__fi.world.engine.travel('vip')`);
await sleep(800);
check((await state()).scene === 'vip', 'fast travel to the VIP Salon');
await ev(`window.__fi.useGame.getState().setPanel('board')`);
await sleep(800);
await shot('14-board');
await ev(`window.__fi.useGame.getState().setPanel(null)`);
for (const g of ['island-reels', 'dragon-tiger', 'pirate-dice']) {
  await ev(`window.__fi.useGame.getState().openGame('${g}')`);
  await sleep(500);
  await page.getByRole('button', { name: /Rules/ }).click();
  await sleep(400);
  await shot(`15-paytable-${g}`);
  await ev(`window.__fi.useGame.getState().closeGame()`);
  await sleep(300);
}

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
console.log(fail.length ? `${fail.length} FAILED` : 'ALL OK');
