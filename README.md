# Fortune Isle

An open-world, single-player casino island. The player walks a cartoon avatar around a 2D isometric island and plays
nine real-money mini games at stalls. Every outcome is decided on the server (FeedingFranzeeAPI, Engine `Island`), at a
fixed 96% RTP (roulette 97.3%). The client only animates results.

- **Frontend:** Vite + React 18 + TypeScript + Zustand, PixiJS 8 for the world. All art is drawn in code, with no image downloads.
- **Backend:** FeedingFranzeeAPI `api/island`: `Domain/Island/Island.cs` (rules + provably-fair draws),
  `Application/Island/IslandService.cs`, `Presentation/Controllers/IslandController.cs`.

## Run

```bash
npm install
npm run dev            # http://localhost:5197, /api proxied to http://localhost:5003
API_PROXY=http://localhost:5013 npm run dev   # point the proxy at another API port
```

- `?demo` (or `VITE_DEMO=1`) plays offline against an in-browser engine that uses the same rules with fun money.
  `?demo&unlock` starts at level 6 with every zone open.
- To test the API without touching the shared database, run it in memory:
  `dotnet run --launch-profile http -- --urls http://localhost:5003 --ConnectionStrings:DefaultConnection=`.
- In production the lobby launches `/?token=<jwt>`. `.env.production` points at `https://demogameapi.easygamesdemo.co.za`.

## The island

| Zone | Opens at | Games and things |
| --- | --- | --- |
| Harbour (spawn) | 1 | Daily chest (+20 XP, +1 key), Wardrobe, Notice board, Cashier (history), lighthouse, pier |
| Boardwalk | 1 | Coconut Shy, Cup Shuffle, Scratch Kiosk |
| Fairground | 1 | Prize Wheel, Duck Pond, High Striker, ferris wheel |
| Grand Casino | 2 | Walk up the red carpet: an entrance overlay, then the casino's own interior map with two roulette tables (European, single zero), the bar, a slot lounge (decor), the VIP lounge and an exit arch back out |
| Jungle Ruins | 3 | Temple Doors, hidden treasure chest (1 key → a cosmetic) |
| Volcano Summit | 4 | Lava Crash |

- **XP:** 10 per round, flat whatever the stake. Level L needs 25·L·(L−1) XP.
- **Keys:** one per level-up, plus one from the daily chest.
- **Cosmetics:** unlocked by level, or found in the chest. They never change the odds.
- **Movement:** tap to walk (A* pathfinding), or WASD / arrow keys. The camera follows the player; pinch or scroll to
  zoom. Walk up to a stall and tap the button (or press E).
- **Fast travel:** use any zone's signpost (from inside the casino too).
- **Maps:** the island (`src/world/map.ts`) and the casino interior (`src/world/interior.ts`, art in `casinoArt.ts`).
  Doorways (spots of kind `enter` / `exit`) fire when you walk up to them. They stay quiet after you step back or
  arrive next to one, until you walk away.
- **Locked zones:** fogged and fenced off.
- **Landmark shows** (free, cosmetic, no money involved): walk up to or tap the Ferris wheel (ride a full turn with a
  zoomed-out view of the island and fireworks at the top), the lighthouse (dusk falls and the beam sweeps), the volcano
  (an eruption with lava bombs) or the temple (a light beam and fireflies). Tap a palm for a falling coconut, balloons to
  let them go, or a boat for a horn blast and a lap. Gulls fly over and fish jump. Effects live in `src/world/fun.ts`.

## Maths (server-side, `IslandRules`)

| Game | How it pays | RTP |
| --- | --- | --- |
| Coconut Shy | Classic: 1 of 5 coconuts hides ×4.8. Golden: the picked coconut wins ×3.5 (16%) or ×20 (2%) | 96% |
| Cup Shuffle | 1 of 3 cups, ×2.88. The ball is placed after the pick; the shuffle is cosmetic | 96% |
| Prize Wheel | 20 equal segments: 9×0, 5×1, 4×1.5, 1×3, 1×5.2 | 96% |
| Duck Pond | Weighted table up to ×20; the duck you pick is cosmetic | 96% |
| High Striker | Weighted tiers up to the ×50 bell; tap timing is cosmetic | 96% |
| Scratch Kiosk | Prize tier drawn first, then a 3×3 card that shows exactly it; up to ×100 | 96% |
| Temple Doors | 8 levels × 3 doors, 1 trap each; level n pays 0.96 × 1.5ⁿ (floored to 2 dp) | 96% at any cash-out (95.96–95.99% from level 6) |
| Lava Crash | P(crash ≥ x) = 0.96 / x, 4% erupt at once, capped at ×500 (reaching it cashes out); multiplier e^(0.2 t) | 96% at any target |
| Roulette | European single zero: straight, column, dozen, even-money | 97.3% |

Proof: `FeedingFranzeeAPI/tools/IslandSim` plays 10M rounds per line through the live draws:
`dotnet run -c Release -- 10000000`. It passed every game, every Temple Doors cash-out level, nine Lava Crash targets
and two roulette bets within 3σ, and checked that every scratch card shows exactly its drawn prize. `npm run rtp` here
checks the mirrored tables in `src/api/rules.ts`. Keep `rules.ts` and `IslandRules` in lockstep.

**Provably fair:**

- Each round uses a committed server seed: its SHA-256 is shown before the bet, and the seed is revealed after.
- Draw k is HMAC-SHA256(serverSeed, "clientSeed:nonce:k").
- `Pick(n)` = (top 52 bits × n) >> 52.
- The player can change the client seed under Menu → Provably fair.

## API (`api/island`, Bearer session token)

| Method | Path | What |
| --- | --- | --- |
| GET | `info` | Limits, chips, zones, cosmetics, every paytable + RTP |
| GET | `state` | Open/last round (disconnect recovery), progress, session, limits, history |
| POST | `bet` | `{ game, stake, choice?, mode?, auto?, bets? }` |
| POST | `action` | `{ action: pick \| cashout, door? }` (Temple Doors, Lava Crash) |
| POST | `watch` | Lava Crash long-poll: returns when the round ends (≤ 40 s); the crash point is never sent early |
| POST | `seed` / `equip` / `daily` / `chest` / `limits` | Client seed, cosmetics, daily reward, treasure chest, RG limits |

The balance comes from `api/wallet/balance`. Money moves through the shared `WalletService` (`{round}-bet` debit,
`{round}-win` credit), so the wallet ledger is the money record. Open rounds live in memory: Temple Doors
auto-cashes after 10 idle minutes, and a Lava Crash eruption settles server-side even if nobody is watching.

## Responsible gambling

- The shield button is always one tap away. It shows the session timer and net result.
- Loss limit and session-time limit: lowering one applies now, raising it waits 24 h.
- Reality checks every N minutes (default 30).
- Self-exclusion pointer and the SARGF helpline.
- 18+ on the splash screen. Stake, balance and the RTP/info button are in every game.
- Returns at or below the stake (×0.5, ×1) are shown as "back", never celebrated as wins.

## Checks

```bash
npm run build          # type-check + bundle (≈180 KB gzip)
npm run rtp            # paytable maths
node tools/play.mjs http://localhost:5197/ shots     # plays every game through the UI, screenshots (needs the API)
node tools/thumbnail.mjs                             # public/thumbnail.png for the lobby (demo mode)
node tools/casino.mjs                                # walk into the Grand Casino and back out, screenshots (demo mode)
node tools/fun.mjs                                   # every landmark show and tap toy, screenshots (demo mode)
```

## Not built yet (from the spec)

- Free-bet tokens: FeedingFranzeeAPI has no bonus wallet yet.
- Golden Hour promos.
- VIP rooms.
- SQL persistence of progress and rounds: progression lives in API memory, like the other engines' seats.
- The `SignalRSync` multiplayer layer: the world already treats the player as one entity among others.
- Atlas lazy-loading: the art is procedural, so there is nothing to download per zone.
