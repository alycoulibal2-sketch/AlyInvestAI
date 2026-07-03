const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const OUT = 'C:/Users/User/Documents/AlyInvestAI/voice-samples';
const LINE = "Good morning. Your portfolio held steady overnight. Technology is still your largest position, but nothing today needs your attention — I'd hold for now.";

// Curated candidates: mix of classic + newer conversational neural voices,
// male and female. We try each and report which the free edge endpoint serves.
const VOICES = [
  ['en-US-JennyNeural',            'Jenny — warm female (promo narrator)'],
  ['en-US-AriaNeural',             'Aria — female, natural'],
  ['en-US-MichelleNeural',         'Michelle — female, gentle'],
  ['en-US-AvaMultilingualNeural',  'Ava — female, newest/most natural'],
  ['en-US-EmmaMultilingualNeural', 'Emma — female, friendly'],
  ['en-US-GuyNeural',              'Guy — warm male'],
  ['en-US-EricNeural',             'Eric — male, calm/steady'],
  ['en-US-RogerNeural',            'Roger — male, measured'],
  ['en-US-AndrewMultilingualNeural','Andrew — male, newest/most natural'],
  ['en-US-BrianMultilingualNeural','Brian — male, relaxed'],
];

function synth(voice, text) {
  return new Promise(async (resolve, reject) => {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate: '+3%' });
      const chunks = [];
      const timer = setTimeout(() => reject(new Error('timeout')), 20000);
      audioStream.on('data', c => chunks.push(c));
      audioStream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
      audioStream.on('error', e => { clearTimeout(timer); reject(e); });
    } catch (e) { reject(e); }
  });
}

(async () => {
  const ok = [];
  for (const [voice, label] of VOICES) {
    try {
      const buf = await synth(voice, LINE);
      if (!buf || buf.length < 1000) throw new Error('empty (' + (buf ? buf.length : 0) + ' bytes)');
      const file = voice + '.mp3';
      fs.writeFileSync(path.join(OUT, file), buf);
      ok.push([voice, label, file, buf.length]);
      console.log('OK  ', voice.padEnd(34), (buf.length/1024).toFixed(0) + 'KB');
    } catch (e) {
      console.log('FAIL', voice.padEnd(34), e.message);
    }
  }
  // Build an audition page.
  const rows = ok.map(([v,l,f]) => `
    <div class="v">
      <div class="meta"><div class="lbl">${l}</div><div class="id">${v}</div></div>
      <audio controls preload="none" src="${f}"></audio>
    </div>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>Corvexsa — Choose the advisor voice</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d12;color:#e7e9ee;margin:0;padding:40px 20px}
  .wrap{max-width:720px;margin:0 auto}
  h1{font-size:22px;font-weight:700;letter-spacing:-.3px;margin:0 0 6px}
  p.sub{color:#9aa1ad;margin:0 0 28px;font-size:14px}
  .v{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;border:1px solid #232733;border-radius:14px;margin-bottom:12px;background:#12151c}
  .lbl{font-weight:600;font-size:15px}
  .id{color:#7d8590;font-size:12px;font-family:ui-monospace,monospace;margin-top:3px}
  audio{height:38px}
  .line{color:#c7a867;font-size:13px;font-style:italic;margin:22px 0 30px;padding-left:14px;border-left:2px solid #c7a867}
</style>
<div class="wrap">
  <h1>Choose your advisor's voice</h1>
  <p class="sub">Same line, spoken by each candidate. Play them and tell me which you want as the default.</p>
  <div class="line">"${LINE}"</div>
  ${rows}
</div>`;
  fs.writeFileSync(path.join(OUT, 'audition.html'), html);
  console.log('\nWrote', ok.length, 'samples + audition.html to', OUT);
})();
