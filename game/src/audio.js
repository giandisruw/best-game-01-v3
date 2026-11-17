// EMBERDEEP — synthesised sound.
// One clear job: every sound the game makes, built from WebAudio
// oscillators and noise — no audio files, no network — plus a soft
// looping music bed that starts after the first gesture.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
  }

  // A slow minor-key lantern theme: A2, C3, E3, G2 walk, one note a beat.
  const MELODY = [110, 130.81, 164.81, 98, 110, 146.83, 164.81, 196, 164.81, 146.83, 130.81, 110];
  function startMusic() {
    if (musicTimer || muted) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const f = MELODY[musicStep % MELODY.length];
      musicStep += 1;
      tone(f, 0.9, 'sine', 0.035);
      tone(f / 2, 1.4, 'triangle', 0.02);
      if (musicStep % 4 === 0) tone(f * 2, 0.5, 'sine', 0.012);
    }, 620);
  }

  return {
    unlock() {
      ensure();
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      if (!muted) startMusic();
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() { tone(720, 0.08, 'square', 0.03, 420); },
    kill() { tone(340, 0.16, 'sawtooth', 0.05, 90); noise(0.12, 0.05, 900); },
    hit() { tone(160, 0.25, 'sawtooth', 0.09, 60); noise(0.2, 0.08, 500); },
    dash() { noise(0.14, 0.05, 2400); },
    pickup() { tone(880, 0.09, 'sine', 0.04, 1320); },
    coin() { tone(1046, 0.07, 'sine', 0.035); tone(1568, 0.1, 'sine', 0.03); },
    levelup() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.06), i * 70)); },
    draft() { tone(660, 0.12, 'triangle', 0.05, 990); },
    burst() { tone(220, 0.4, 'sawtooth', 0.08, 880); noise(0.35, 0.07, 1200); },
    ward() { tone(440, 0.3, 'sine', 0.06, 660); },
    door() { tone(196, 0.2, 'triangle', 0.05, 294); },
    chest() { [392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'triangle', 0.05), i * 60)); },
    altar() { tone(98, 0.6, 'sine', 0.07, 65); },
    boss() { tone(82, 0.7, 'sawtooth', 0.09, 55); noise(0.5, 0.06, 300); },
    floorClear() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.055), i * 90)); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.06), i * 110)); },
    lose() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sine', 0.06), i * 160)); },
    denied() { tone(140, 0.12, 'square', 0.05, 110); },
  };
}
