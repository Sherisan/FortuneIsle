/* Synthesised sound: no audio files to download. Ambience is soft surf (filtered noise) with the odd gull cry. */

type Sfx =
  | 'tick' | 'chip' | 'open' | 'close' | 'error' | 'win' | 'smallwin' | 'bigwin' | 'lose' | 'level' | 'squawk'
  | 'whoosh' | 'thud' | 'horn' | 'pop' | 'spin' | 'ding' | 'bell' | 'scratch' | 'door' | 'trap' | 'rumble' | 'erupt' | 'step' | 'coin';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let ambienceNodes: { stop(): void } | null = null;
let ambienceWanted = false;
type Ambience = 'island' | 'casino' | 'vip' | 'tavern';
let ambienceKind: Ambience = 'island';

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slide?: number; attack?: number } = {}) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
  const v = opts.vol ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, opts: { vol?: number; at?: number; freq?: number; q?: number; type?: BiquadFilterType } = {}) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.vol ?? 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const arp = (notes: number[], step: number, type: OscillatorType = 'triangle', vol = 0.18) =>
  notes.forEach((n, i) => tone(n, step * 2.2, { type, vol, at: i * step }));

export const sound = {
  unlock() {
    const c = ac();
    if (c?.state === 'suspended') void c.resume();
  },
  setMuted(m: boolean) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
    if (m) {
      ambienceNodes?.stop();
      ambienceNodes = null;
    } else if (ambienceWanted) this.ambience(true, ambienceKind);
  },
  /** Surf and gulls on the island; crowd murmur, chips and a lounge chord in the casino and the VIP Salon; a crackling
   *  hearth, clinking tankards and a sea-shanty squeezebox in the Rusty Anchor. */
  ambience(on: boolean, kind: Ambience = ambienceKind) {
    ambienceWanted = on;
    if (kind !== ambienceKind) {
      ambienceKind = kind;
      ambienceNodes?.stop();
      ambienceNodes = null;
    }
    if (!on || muted) {
      ambienceNodes?.stop();
      ambienceNodes = null;
      return;
    }
    const c = ac();
    if (!c || !master || ambienceNodes) return;
    if (kind === 'tavern') {
      // Hearth: brown noise through a lowpass, with random crackles.
      const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
        d[i] = last * 5 + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 1.6 : 0);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = c.createGain();
      g.gain.value = 0.07;
      src.connect(f).connect(g).connect(master);
      src.start();
      // A slow shanty in D minor on a reedy squeezebox, a clink now and then.
      const tune = [[294, 349, 440], [262, 330, 392], [233, 294, 349], [220, 277, 330]];
      let k = 0;
      const timer = window.setInterval(() => {
        const r = Math.random();
        if (r < 0.55) tune[k++ % tune.length].forEach((n, i) => tone(n, 1.4, { type: 'sawtooth', vol: 0.008, at: i * 0.04, attack: 0.12 }));
        else if (r < 0.75) {
          tone(2600 + Math.random() * 500, 0.08, { type: 'triangle', vol: 0.025 });
          tone(3100 + Math.random() * 400, 0.07, { type: 'triangle', vol: 0.018, at: 0.06 });
        }
      }, 1600);
      ambienceNodes = {
        stop() {
          try { src.stop(); } catch { /* already stopped */ }
          window.clearInterval(timer);
        },
      };
      return;
    }
    if (kind === 'casino' || kind === 'vip') {
      const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 450;
      f.Q.value = 0.6;
      const g = c.createGain();
      g.gain.value = 0.05;
      src.connect(f).connect(g).connect(master);
      src.start();
      const chords = [[262, 330, 392, 494], [220, 277, 330, 415], [294, 349, 440, 523]];
      let k = 0;
      const timer = window.setInterval(() => {
        const r = Math.random();
        if (r < 0.45) {
          tone(1900 + Math.random() * 600, 0.06, { type: 'triangle', vol: 0.025 });
          tone(2400 + Math.random() * 400, 0.05, { type: 'triangle', vol: 0.02, at: 0.05 });
        } else if (r < 0.6) {
          chords[k++ % chords.length].forEach((n, i) => tone(n, 1.6, { type: 'sine', vol: 0.025, at: i * 0.07, attack: 0.05 }));
        } else if (r < 0.66) {
          [784, 988, 1175].forEach((n, i) => tone(n, 0.12, { type: 'square', vol: 0.012, at: i * 0.09 }));
        }
      }, 1700);
      ambienceNodes = {
        stop() {
          try { src.stop(); } catch { /* already stopped */ }
          window.clearInterval(timer);
        },
      };
      return;
    }
    const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = last * 6;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.08;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.12;
    lg.gain.value = 0.05;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(master);
    src.start();
    lfo.start();
    const gull = window.setInterval(() => {
      if (Math.random() < 0.35) {
        tone(1500, 0.25, { type: 'sine', vol: 0.03, slide: 0.7 });
        tone(1400, 0.3, { type: 'sine', vol: 0.025, slide: 0.65, at: 0.3 });
      }
    }, 9000);
    ambienceNodes = {
      stop() {
        try {
          src.stop();
          lfo.stop();
        } catch {
          /* already stopped */
        }
        window.clearInterval(gull);
      },
    };
  },
  play(s: Sfx) {
    switch (s) {
      case 'tick': return tone(900, 0.05, { type: 'square', vol: 0.05 });
      case 'chip': tone(1800, 0.06, { type: 'triangle', vol: 0.12 }); return tone(2400, 0.06, { type: 'triangle', vol: 0.1, at: 0.04 });
      case 'open': return tone(520, 0.18, { type: 'sine', vol: 0.15, slide: 1.8 });
      case 'close': return tone(700, 0.15, { type: 'sine', vol: 0.12, slide: 0.55 });
      case 'error': tone(220, 0.15, { type: 'square', vol: 0.08 }); return tone(180, 0.2, { type: 'square', vol: 0.08, at: 0.12 });
      case 'smallwin': return arp([660, 880], 0.08);
      case 'win': return arp([523, 659, 784, 1047], 0.08);
      case 'bigwin':
        arp([523, 659, 784, 1047, 1319, 1568], 0.09, 'square', 0.12);
        return arp([262, 330, 392, 523], 0.18, 'triangle', 0.15);
      case 'lose': return tone(330, 0.35, { type: 'triangle', vol: 0.12, slide: 0.5 });
      case 'level': return arp([784, 988, 1175, 1568], 0.1, 'triangle', 0.16);
      case 'squawk': tone(1300, 0.08, { type: 'sawtooth', vol: 0.04, slide: 1.4 }); return tone(1100, 0.1, { type: 'sawtooth', vol: 0.04, slide: 0.7, at: 0.09 });
      case 'whoosh': return noise(0.35, { vol: 0.15, freq: 900, q: 0.7 });
      case 'thud': tone(110, 0.2, { type: 'sine', vol: 0.3, slide: 0.5 }); return noise(0.12, { vol: 0.1, freq: 300 });
      case 'pop': return tone(600, 0.08, { type: 'sine', vol: 0.18, slide: 2.5 });
      case 'spin': return noise(0.05, { vol: 0.08, freq: 3000, q: 3 });
      case 'ding': return tone(1568, 0.5, { type: 'sine', vol: 0.15 });
      case 'bell': tone(1046, 1.2, { type: 'sine', vol: 0.2 }); return tone(2093, 1, { type: 'sine', vol: 0.08 });
      case 'scratch': return noise(0.06, { vol: 0.05, freq: 4000, q: 0.5, type: 'highpass' });
      case 'door': return noise(0.5, { vol: 0.15, freq: 200, q: 2 });
      case 'trap': tone(160, 0.5, { type: 'sawtooth', vol: 0.15, slide: 0.4 }); return noise(0.4, { vol: 0.2, freq: 500 });
      case 'rumble': return noise(1.2, { vol: 0.18, freq: 80, q: 1, type: 'lowpass' });
      case 'erupt': noise(1.6, { vol: 0.35, freq: 120, type: 'lowpass' }); return tone(90, 1.2, { type: 'sawtooth', vol: 0.15, slide: 0.4 });
      case 'horn': tone(147, 0.9, { type: 'sawtooth', vol: 0.09, attack: 0.08 }); return tone(220, 0.9, { type: 'sawtooth', vol: 0.06, attack: 0.08 });
      case 'step': return noise(0.04, { vol: 0.03, freq: 800 });
      case 'coin': return tone(1975, 0.12, { type: 'square', vol: 0.05 });
    }
  },
};
