// npm run rtp — exact RTP of every paytable in src/api/rules.ts (the mirror of the server's IslandRules), plus a
// Monte Carlo pass over the Lava Crash crash-point formula. The server's own proof is FeedingFranzeeAPI tools/IslandSim
// (10M rounds per game through IslandFair).
import * as R from '../src/api/rules.ts';

// [name, rtp, target, tolerance]: exact tables to 0.1% (Temple Doors' 2 dp floor costs < 0.05%), Monte Carlo to 3σ.
const rows: [string, number, number, number][] = [];
const add = (name: string, rtp: number, target = R.RTP, tol = 0.001) => rows.push([name, rtp, target, tol]);

add('Coconut Shy (classic)', R.COCONUT_CLASSIC / R.COCONUTS);
add('Coconut Shy (golden)', R.expected(R.COCONUT_GOLDEN));
add('Cup Shuffle', R.CUP_PAYS / R.CUPS);
add('Prize Wheel', R.WHEEL.reduce((s, m) => s + m, 0) / R.WHEEL.length);
add('Duck Pond', R.expected(R.DUCK_TABLE));
add('High Striker', R.expected(R.STRIKER_TABLE));
add('Scratch Kiosk', R.expected(R.SCRATCH_TABLE));
for (let n = 1; n <= R.TEMPLE_LEVELS; n++) add(`Temple Doors, out at ${n}`, (2 / 3) ** n * R.templeMultiplier(n));
add('Roulette (any bet)', 36 / 37, 36 / 37);

const N = 2_000_000;
for (const x of [1.01, 2, 10, 100]) {
  let wins = 0;
  for (let i = 0; i < N; i++) if (R.lavaCrashPoint(Math.random()) >= x) wins++;
  const p = R.RTP / x;
  add(`Lava Crash, out at ×${x} (MC ${N / 1e6}M)`, (wins / N) * x, R.RTP, 3 * x * Math.sqrt((p * (1 - p)) / N));
}

let failed = false;
console.log('game'.padEnd(36), 'RTP'.padStart(9), '  target    ±');
for (const [name, rtp, target, tol] of rows) {
  const exact = !name.includes('MC');
  const ok = Math.abs(rtp - target) <= tol && (!exact || rtp <= target + 1e-9);
  failed ||= !ok;
  console.log(name.padEnd(36), `${(rtp * 100).toFixed(3)}%`.padStart(9), ` ${(target * 100).toFixed(1)}%`, `${(tol * 100).toFixed(2)}%`.padStart(6), ok ? 'ok' : 'FAIL');
}
console.log(failed ? 'FAIL' : 'PASS');
process.exit(failed ? 1 : 0);
