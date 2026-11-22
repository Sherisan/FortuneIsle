/*
 * The isles' secrets (easter eggs). Finding one is purely for fun — no money, XP or odds involved — and is remembered on
 * this device only (localStorage). The world reports them through WorldCallbacks.onSecret; the store keeps the list.
 */

export interface Secret {
  id: string;
  icon: string;
  name: string;
  where: string;
  /** Shown while it's still hidden. */
  hint: string;
  /** What Polly says when it's found. */
  line: string;
}

export const SECRETS: Secret[] = [
  { id: 'bottle', icon: '🍾', name: 'Message in a Bottle', where: 'Fortune Isle', hint: 'Something glints on a quiet beach.', line: '' },
  { id: 'kraken', icon: '🐙', name: 'The Kraken', where: 'Fortune Isle', hint: 'Something big sleeps in the open sea. Knock, knock, knock, knock, knock…', line: 'K-K-KRAKEN! Don’t worry, it only wanted to wave. Squawk!' },
  { id: 'polly', icon: '🦜', name: 'Polly’s Jokes', where: 'Anywhere', hint: 'Polly loves attention. Give her a few taps.', line: '' },
  { id: 'konami', icon: '🎮', name: 'Rainbow Polly', where: 'Anywhere, on a keyboard', hint: 'Up, up, down, down… an old gamer’s spell.', line: 'Look at me! I’m FABULOUS! Rainbow Polly!' },
  { id: 'ghost-ship', icon: '👻', name: 'The Ghost Captain', where: 'Coral Lagoon', hint: 'An old wreck lies in the shallows off the lagoon.', line: 'A GHOST! Polly’s feathers are standing on end!' },
  { id: 'clam', icon: '🦪', name: 'The Giant Clam', where: 'Coral Lagoon', hint: 'A big shell sits on the beach. Knock three times.', line: 'A pearl as big as my head! It’s for looking at, not pocketing, matey.' },
  { id: 'penguins', icon: '🐧', name: 'Penguin Parade', where: 'Frost Isle', hint: 'Three penguins live by the frozen lake. Get them all sliding.', line: 'Wheee! A penguin parade! Polly wants to join in.' },
  { id: 'yeti', icon: '👣', name: 'The Yeti', where: 'Frost Isle', hint: 'Big footprints lead behind one of the pines. Knock three times.', line: 'A YETI! He says hello — and would like his privacy back.' },
  { id: 'ufo', icon: '🛸', name: 'Close Encounter', where: 'Sky Kingdom', hint: 'The moon looks very tappable. Five times tappable.', line: 'Was that a flying saucer?! Nobody will ever believe Polly.' },
  { id: 'rainbow', icon: '🌈', name: 'End of the Rainbow', where: 'Sky Kingdom', hint: 'Every rainbow ends somewhere. Follow one.', line: 'The end of the rainbow! That pot’s glued down, matey — it’s scenery.' },
];

/** What the note in the bottle says (every time you read it). */
export const BOTTLE_NOTE =
  '📜 “I hid my secrets all over these isles: something big under the sea, a ghost in the lagoon, a shy yeti, a moon that wants poking… and the parrot knows a code.” — Captain Coral';

export const POLLY_JOKES = [
  'Why don’t pirates shower before walking the plank? They’ll wash up on shore later!',
  'What’s a pirate’s favourite letter? You’d think it’s R, but it’s the C!',
  'How much did the pirate pay for his earrings? A buccaneer!',
  'Why did the parrot wear a raincoat? To be Polly-unsaturated!',
  'What do you call a pirate who skips school? Captain Hooky!',
];

const KEY = 'fortune-isle:secrets';

export function loadSecrets(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => SECRETS.some((s) => s.id === x)) : [];
  } catch {
    return [];
  }
}

export function saveSecrets(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode: they're still found for this visit */
  }
}
