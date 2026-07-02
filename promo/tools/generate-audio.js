// Synthesizes the voiceover (Microsoft Jenny neural voice) per scene,
// measures real durations, and derives the master timeline.js from them —
// so scene lengths always fit the narration exactly.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const ffprobe = require('ffprobe-static').path;

const PROMO = path.join(__dirname, '..');
const AUDIO = path.join(PROMO, 'audio');

const SCENES = [
  { id: 'hook', template: 'hook', image: '', imageStyle: 'none',
    headline: 'Who watches your portfolio?',
    sub: "Most investors are on their own. You don't have to be.",
    voiceover: 'What if a personal wealth advisor watched your portfolio around the clock?' },
  { id: 'meet', template: 'showcase', image: 'welcome.png', imageStyle: 'wide',
    kicker: 'Introducing',
    headline: 'Meet Corvexsa',
    sub: 'Your personal AI investment advisor',
    voiceover: 'Meet Corvexsa — your personal AI investment advisor.' },
  { id: 'connect', template: 'showcase', image: 'connect.png', imageStyle: 'phone',
    kicker: 'Your money stays yours',
    headline: 'Read-only. Always.',
    sub: 'Never holds funds. Never executes trades. Only advises.',
    voiceover: 'Connect your broker in seconds. Read-only, always — Corvexsa never touches your money.' },
  { id: 'analysis', template: 'showcase', image: 'conversation.png', imageStyle: 'wide',
    kicker: 'Every 24 hours',
    headline: 'A deep review, daily',
    sub: 'Clear buy, hold, or trim calls — with the reasoning behind them',
    voiceover: 'Every twenty-four hours, a deep review: clear buy, hold, or trim calls, with exact quantities and the reasoning.' },
  { id: 'alerts', template: 'showcase', image: 'analysis.png', imageStyle: 'phone',
    kicker: 'Always watching',
    headline: 'Vigilance, delivered',
    sub: 'Opportunities surfaced. Risks flagged early.',
    voiceover: 'It scans the market, and alerts your phone the moment something material changes.' },
  { id: 'conversation', template: 'showcase', image: 'advisor-intro.png', imageStyle: 'phone',
    kicker: 'No dashboards to decode',
    headline: 'One conversation',
    sub: 'An advisor that remembers you, your goals, your preferences',
    voiceover: 'No dashboards. Just one conversation, with an advisor who remembers you.' },
  { id: 'cta', template: 'cta', image: '', imageStyle: 'none',
    headline: 'Corvexsa',
    sub: 'Smarter investing starts with a conversation.',
    voiceover: 'Smarter investing starts with a conversation. Start yours at Corvexsa dot com.',
    disclaimer: 'Corvexsa provides analysis only. It never executes trades or holds funds. Investing involves risk, including possible loss of principal. Not financial advice.' },
];

const LEAD_IN = 0.45;   // scene visible before narration starts
const TAIL = 0.5;      // breathing room after narration ends
const OVERLAP = 0.45;   // crossfade between consecutive scenes
const CTA_HOLD = 1.8;  // extra hold on the closing card

function probeDuration(file) {
  const out = execFileSync(ffprobe, ['-v', 'quiet', '-print_format', 'json', '-show_format', file], { encoding: 'utf8' });
  return parseFloat(JSON.parse(out).format.duration);
}

(async () => {
  fs.mkdirSync(AUDIO, { recursive: true });
  const durations = [];

  for (const scene of SCENES) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-US-JennyNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const dir = path.join(AUDIO, scene.id);
    fs.mkdirSync(dir, { recursive: true });
    const { audioFilePath } = await tts.toFile(dir, scene.voiceover, { rate: '+5%' });
    const finalPath = path.join(AUDIO, scene.id + '.mp3');
    fs.copyFileSync(audioFilePath, finalPath);
    fs.rmSync(dir, { recursive: true, force: true });
    const d = probeDuration(finalPath);
    durations.push(d);
    console.log(`${scene.id.padEnd(13)} ${d.toFixed(2)}s  "${scene.voiceover.slice(0, 50)}..."`);
  }

  // Derive scene windows from narration lengths.
  let t = 0;
  const timelineScenes = SCENES.map((scene, i) => {
    const start = t;
    const voStart = start + LEAD_IN;
    const end = voStart + durations[i] + TAIL + (i === SCENES.length - 1 ? CTA_HOLD : 0);
    t = end - OVERLAP;
    return { ...scene, start: +start.toFixed(3), end: +end.toFixed(3), voStart: +voStart.toFixed(3) };
  });
  const total = timelineScenes[timelineScenes.length - 1].end;

  const timeline = { width: 1280, height: 720, total: +total.toFixed(3), scenes: timelineScenes };
  fs.writeFileSync(path.join(PROMO, 'timeline.js'), 'window.TIMELINE = ' + JSON.stringify(timeline, null, 2) + ';\n');
  fs.writeFileSync(path.join(PROMO, 'timeline.json'), JSON.stringify(timeline, null, 2));
  console.log(`\ntotal video length: ${total.toFixed(2)}s — timeline.js written`);
})().catch(e => { console.error(e); process.exit(1); });
