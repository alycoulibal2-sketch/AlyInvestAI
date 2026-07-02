// Assembles the final MP4:
//   frames/f*.png (24fps)  ->  H.264 video
//   audio/<scene>.mp3      ->  VO track, each clip placed at its scene's voStart
//   synthesized pad        ->  subtle dark ambient bed under the narration
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const FF = require('ffmpeg-static');
const PROMO = path.join(__dirname, '..');
const FRAMES = path.join(PROMO, 'frames');
const AUDIO = path.join(PROMO, 'audio');
const OUT = path.join(PROMO, 'AlyInvest-Intro.mp4');

const timeline = JSON.parse(fs.readFileSync(path.join(PROMO, 'timeline.json'), 'utf8'));
const total = timeline.total;

function run(args, label) {
  console.log('[ffmpeg]', label);
  execFileSync(FF, ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

// ── 1. Video from frames ────────────────────────────────
run([
  '-framerate', '24', '-i', path.join(FRAMES, 'f%05d.png'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  path.join(PROMO, '_video.mp4'),
], 'frames -> h264');

// ── 2. Voiceover track (each scene's clip delayed to its voStart) ──
const inputs = [];
const delays = [];
timeline.scenes.forEach((s, i) => {
  inputs.push('-i', path.join(AUDIO, s.id + '.mp3'));
  delays.push(`[${i}:a]aresample=44100,adelay=${Math.round(s.voStart * 1000)}:all=1[d${i}]`);
});
const voFilter =
  delays.join(';') + ';' +
  timeline.scenes.map((_, i) => `[d${i}]`).join('') +
  `amix=inputs=${timeline.scenes.length}:duration=longest:normalize=0,` +
  `apad=whole_dur=${total},atrim=0:${total}[vo]`;
run([
  ...inputs,
  '-filter_complex', voFilter, '-map', '[vo]',
  '-c:a', 'pcm_s16le', path.join(PROMO, '_vo.wav'),
], 'voiceover placement');

// ── 3. Ambient pad: three soft detuned tones, slow tremolo, dark lowpass ──
run([
  '-f', 'lavfi', '-i', `sine=frequency=55:sample_rate=44100:duration=${total}`,
  '-f', 'lavfi', '-i', `sine=frequency=110.5:sample_rate=44100:duration=${total}`,
  '-f', 'lavfi', '-i', `sine=frequency=164.8:sample_rate=44100:duration=${total}`,
  '-filter_complex',
  '[0:a]volume=0.5[a0];[1:a]volume=0.34[a1];[2:a]volume=0.22[a2];' +
  '[a0][a1][a2]amix=inputs=3:normalize=0,' +
  'tremolo=f=0.13:d=0.55,lowpass=f=520,' +
  `afade=t=in:d=2.5,afade=t=out:st=${(total - 3.5).toFixed(2)}:d=3.5,volume=0.05[pad]`,
  '-map', '[pad]', '-c:a', 'pcm_s16le', path.join(PROMO, '_pad.wav'),
], 'ambient pad');

// ── 4. Final mux ────────────────────────────────────────
run([
  '-i', path.join(PROMO, '_video.mp4'),
  '-i', path.join(PROMO, '_vo.wav'),
  '-i', path.join(PROMO, '_pad.wav'),
  '-filter_complex',
  '[1:a][2:a]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', OUT,
], 'final mux');

['_video.mp4', '_vo.wav', '_pad.wav'].forEach(f => fs.rmSync(path.join(PROMO, f), { force: true }));

const stat = fs.statSync(OUT);
console.log(`\nDONE: ${OUT} (${(stat.size / 1024 / 1024).toFixed(1)} MB, ${total.toFixed(1)}s)`);
