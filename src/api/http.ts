import { ApiError, type BetBody, type Info, type IslandApi, type LimitsBody, type PromoState, type State } from './types.ts';

/*
 * Client for FeedingFranzeeAPI's api/island (Engine `Island`, GameId `fortune-isle`, see IslandController).
 * Balance comes from api/wallet/balance like every game on that API.
 */

// Dev: relative URLs go through the Vite proxy. Production: VITE_API_BASE.
const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
/** Must match the "Games" entry in the game API config. */
const GAME_ID = 'fortune-isle';

// Production: the lobby launches the game as /?token=<jwt>.
// Dev/staging: the API's GET /api/dev-token mints a random player for this game.
let token: Promise<string> | null = null;

function getToken(): Promise<string> {
  token ??= fetchToken().catch((e: unknown) => {
    token = null;
    throw e;
  });
  return token;
}

async function fetchToken(): Promise<string> {
  const fromUrl = new URLSearchParams(window.location.search).get('token');
  if (fromUrl) return fromUrl;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/dev-token?gameId=${GAME_ID}`);
  } catch {
    throw new ApiError('Connection lost.');
  }
  if (!res.ok) throw new ApiError('No session token. Launch the game from the lobby, or run the API in Development mode.');
  return ((await res.json()) as { token: string }).token;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const auth = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Connection lost — check your network and try again.');
  }
  if (res.status === 429) throw new ApiError('Too many requests. Slow down a little.');
  if (res.status === 401) throw new ApiError('Your session has expired. Reopen the game from the lobby.', 'SESSION');
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error ?? `Request failed (${res.status})`, json?.code);
  return json as T;
}

export function createHttpApi(): IslandApi {
  return {
    demo: false,
    info: () => call<Info>('/api/island/info'),
    balance: async () => (await call<{ balance: number }>('/api/wallet/balance')).balance,
    state: () => call<State>('/api/island/state'),
    bet: (body: BetBody) => call<State>('/api/island/bet', body),
    action: (action, door) => call<State>('/api/island/action', { action, door }),
    watch: () => call<State>('/api/island/watch', {}),
    seed: (clientSeed) => call<State>('/api/island/seed', { clientSeed }),
    equip: (id) => call<State>('/api/island/equip', { id }),
    daily: () => call<State>('/api/island/daily', {}),
    chest: () => call<State>('/api/island/chest', {}),
    limits: (body: LimitsBody) => call<State>('/api/island/limits', body),
    // Promotions for this game (PromoEngine.StateForAsync): live promotions with the player's progress, free plays, awards.
    promotions: () => call<PromoState>('/api/promotions/state'),
  };
}
