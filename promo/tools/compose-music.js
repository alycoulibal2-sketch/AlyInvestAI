// Synthesizes the background music bed as a stereo 16-bit WAV — no samples,
// no downloads, fully rights-free. A minimal dark-electronic progression:
// warm detuned pads (Am–F–C–G), a soft sub bass, four-on-the-floor kick and
// offbeat hats. Drums enter with scene 2 and drop out at the CTA so the
// closing card breathes. Ducking under the voiceover happens later in ffmpeg.
const fs = require('fs');
const path = require('path');

const PROMO = path.join(__dirname, '..');
const timeline = JSON.parse(fs.readFileSync(path.join(PROMO, 'timeline.json'), 'utf8'));

const SR = 44100;
const TOTAL = timeline.total;
const N = Math.ceil(TOTAL * SR);
const BPM = 100;
const BEAT = 60 / BPM;          // 0.6s
const BAR = BEAT * 4;           // 2.4s

const drumsIn = timeline.scenes[1].start;                       // "meet"
const drumsOut = timeline.scenes[timeline.scenes.length - 1].start; // CTA

// chord = { bass, pad: [freqs] } — Am, F, C, G
const PROG = [
  { bass: 110.00, pad: [220.00, 261.63, 329.63] },
  { bass: 87.31,  pad: [174.61, 220.00, 261.63] },
  { bass: 130.81, pad: [261.63, 329.63, 392.00] },
  { bass: 98.00,  pad: [196.00, 246.94, 293.66] },
];

const L = new Float64Array(N);
const R = new Float64Array(N);
const TAU = Math.PI * 2;

function addTone(buf, freq, t0, dur, gain, attack, release, detune) {
  const s0 = Math.max(0, Math.floor(t0 * SR));
  const s1 = Math.min(N, Math.ceil((t0 + dur) * SR));
  const f2 = freq * (detune || 1.0);
  for (let s = s0; s < s1; s++) {
    const t = s / SR - t0;
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > dur - release) env = Math.max(0, (dur - t) / release);
    const ph = s / SR;
    buf[s] += gain * env * (Math.sin(TAU * freq * ph) + 0.4 * Math.sin(TAU * f2 * ph) + 0.18 * Math.sin(TAU * freq * 2 * ph));
  }
}

function addKick(t0, gain) {
  const s0 = Math.floor(t0 * SR);
  const dur = 0.16;
  const s1 = Math.min(N, Math.ceil((t0 + dur) * SR));
  for (let s = s0; s < s1; s++) {
    const t = s / SR - t0;
    const freq = 42 + 78 * Math.exp(-t * 38);      // pitch sweep 120 -> 42 Hz
    const env = Math.exp(-t * 26);
    const v = gain * env * Math.sin(TAU * freq * t);
    L[s] += v; R[s] += v;
  }
}

let hatSeed = 1;
function rand() { hatSeed = (hatSeed * 1103515245 + 12345) & 0x7fffffff; return hatSeed / 0x7fffffff - 0.5; }
function addHat(t0, gain) {
  const s0 = Math.floor(t0 * SR);
  const dur = 0.05;
  const s1 = Math.min(N, Math.ceil((t0 + dur) * SR));
  let prev = 0;
  for (let s = s0; s < s1; s++) {
    const t = s / SR - t0;
    const white = rand();
    const hp = white - prev; prev = white;          // crude one-pole highpass
    const env = Math.exp(-t * 90);
    const v = gain * env * hp * 2;
    L[s] += v * 0.8; R[s] += v * 1.2;               // hats sit slightly right
  }
}

// ── pads + bass, bar by bar ─────────────────────────────
const nBars = Math.ceil(TOTAL / BAR);
for (let bar = 0; bar < nBars; bar++) {
  const t0 = bar * BAR;
  const ch = PROG[bar % PROG.length];
  // pad triad: root/left, fifth/left, third/right for width
  addTone(L, ch.pad[0], t0, BAR + 0.4, 0.055, 0.5, 0.7, 1.004);
  addTone(L, ch.pad[2], t0, BAR + 0.4, 0.042, 0.6, 0.7, 0.997);
  addTone(R, ch.pad[1], t0, BAR + 0.4, 0.055, 0.5, 0.7, 1.003);
  addTone(R, ch.pad[0] * 2, t0, BAR + 0.4, 0.020, 0.9, 0.8, 1.005);
  // sub bass, both channels, gentle pulse on each beat
  for (let b = 0; b < 4; b++) {
    addTone(L, ch.bass, t0 + b * BEAT, BEAT * 0.96, 0.075, 0.02, 0.12, 1.0);
    addTone(R, ch.bass, t0 + b * BEAT, BEAT * 0.96, 0.075, 0.02, 0.12, 1.0);
  }
}

// ── drums, only between drumsIn and drumsOut ────────────
for (let t = Math.ceil(drumsIn / BEAT) * BEAT; t < Math.min(drumsOut, TOTAL); t += BEAT) {
  addKick(t, 0.34);
  addHat(t + BEAT / 2, 0.055);
}

// ── global envelope: fade in, ease drum entry, fade out ──
for (let s = 0; s < N; s++) {
  const t = s / SR;
  let g = 1;
  if (t < 1.2) g *= t / 1.2;
  if (t > TOTAL - 3.0) g *= Math.max(0, (TOTAL - t) / 3.0);
  L[s] *= g; R[s] *= g;
}

// ── soft-clip safety + write WAV ─────────────────────────
const pcm = Buffer.alloc(N * 4);
for (let s = 0; s < N; s++) {
  const l = Math.tanh(L[s] * 1.1);
  const r = Math.tanh(R[s] * 1.1);
  pcm.writeInt16LE(Math.round(l * 32767 * 0.9), s * 4);
  pcm.writeInt16LE(Math.round(r * 32767 * 0.9), s * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(path.join(PROMO, 'music.wav'), Buffer.concat([header, pcm]));
console.log(`music.wav written: ${TOTAL.toFixed(1)}s, drums ${drumsIn.toFixed(1)}s -> ${drumsOut.toFixed(1)}s`);
