import { useEffect, useRef } from 'react';
import type { ZoneKey } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import type { Spot } from './map.ts';
import { WorldEngine } from './WorldEngine.ts';

/** The engine instance, for UI that needs to steer the world (fast travel, the interact button). */
export const world: { engine: WorldEngine | null; near: Spot | null; listeners: Set<() => void> } = {
  engine: null,
  near: null,
  listeners: new Set(),
};

export function handleInteract(spot: Spot) {
  const g = useGame.getState();
  if (g.game || g.panel || g.doorway) return;
  switch (spot.kind) {
    case 'enter':
      useGame.setState({ doorway: 'enter' });
      break;
    case 'exit':
      useGame.setState({ doorway: 'exit' });
      break;
    case 'fun': {
      const started = world.engine?.fun(spot.id);
      const lines: Record<string, string> = {
        'fun-ferris': 'All aboard! Hold on to your hat — what a view from up there!',
        'fun-lighthouse': 'Lights on! The whole island glows at dusk. Squawk!',
        'fun-volcano': 'You poked the volcano?! Duck!',
        'fun-temple': 'The gem awakens… ooh, fireflies!',
      };
      g.say(started ? lines[spot.id] ?? 'Squawk!' : 'Give it a moment to recover, matey.');
      break;
    }
    case 'game':
      g.openGame(spot.game!);
      break;
    case 'travel':
      g.setPanel('travel');
      break;
    case 'wardrobe':
      g.setPanel('wardrobe');
      break;
    case 'board':
      g.setPanel('board');
      break;
    case 'cashier':
      g.setPanel('history');
      break;
    case 'daily':
      if (!g.state?.player.dailyReady) {
        g.say('You’ve had today’s chest, matey! Come back tomorrow.');
        return;
      }
      void g.run((api) => api.daily()).then((s) => {
        if (s) {
          g.toast(`Daily chest: +${g.info?.xp.xpDaily ?? 20} XP and a key!`, 'level');
          g.say('A key! Use it on the treasure chest hidden in the Jungle Ruins.');
        }
      });
      break;
    case 'chest': {
      const before = new Set(g.state?.player.owned ?? []);
      void g.run((api) => api.chest()).then((s) => {
        if (!s) return;
        const found = s.player.owned.find((id) => !before.has(id));
        const item = g.info?.cosmetics.find((c) => c.id === found);
        g.toast(item ? `Treasure! You found: ${item.name}` : 'The chest held 50 XP — you own every treasure!', 'level');
        if (item) g.say(`Ooh, the ${item.name}! Try it on at the Harbour Wardrobe — or from the menu.`);
      });
      break;
    }
  }
}

export function WorldView() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let engine: WorldEngine | null = null;
    let alive = true;
    void WorldEngine.create(host.current!, {
      onZone: (z: ZoneKey) => useGame.getState().setZone(z),
      onNear: (s) => {
        world.near = s;
        world.listeners.forEach((l) => l());
      },
      onInteract: handleInteract,
      onLocked: (z) => {
        const g = useGame.getState();
        const zone = g.info?.zones.find((x) => x.key === z);
        if (zone) g.say(`The ${zone.name} opens at level ${zone.level}. Keep playing to earn XP!`);
      },
      onScene: (scene) => useGame.getState().setScene(scene),
      onCinematic: (caption) => useGame.setState({ cinematic: caption }),
    }).then((e) => {
      if (!alive) return e.destroy();
      engine = e;
      world.engine = e;
      sync();
    });

    const sync = () => {
      const e = engine;
      const s = useGame.getState();
      if (!e || !s.state) return;
      e.setOpenZones(s.state.player.zones);
      const eq = s.state.player.equipped;
      e.setLook({ hat: eq.hat, outfit: eq.outfit, pet: eq.pet });
      const paused = s.game != null || s.panel != null || s.doorway != null || s.phase !== 'play';
      e.setPaused(paused);
      // Focus on the table the player walked up to (the casino has two roulette tables); else the game's own spot.
      e.focusOn(s.game ? (e.lastSpot?.game === s.game ? e.lastSpot : e.spot(s.game)) : null);
    };
    let last = { zones: '', look: '', paused: '', game: '' };
    const unsub = useGame.subscribe((s) => {
      if (!engine || !s.state) return;
      const now = {
        zones: s.state.player.zones.join(),
        look: JSON.stringify(s.state.player.equipped),
        paused: String(s.game != null || s.panel != null || s.doorway != null || s.phase !== 'play'),
        game: s.game ?? '',
      };
      if (now.zones !== last.zones || now.look !== last.look || now.paused !== last.paused || now.game !== last.game) {
        last = now;
        sync();
      }
    });

    return () => {
      alive = false;
      unsub();
      engine?.destroy();
      world.engine = null;
    };
  }, []);

  return <div ref={host} className="world" />;
}
