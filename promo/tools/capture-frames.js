// Renders the video deterministically: loads renderer.html, calls
// window.seek(t) for every frame time, and screenshots each frame as PNG.
// Usage:
//   node capture-frames.js --preview   -> 8 spot-check frames only
//   node capture-frames.js             -> all frames at 24fps
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(
  'C:/Users/User/AppData/Local/Temp/claude/C--Users-User/d18cd551-be7d-4a63-a234-b70053f1a8d0/scratchpad/aly/node_modules/puppeteer-core'
));

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROMO = path.join(__dirname, '..');
const FRAMES = path.join(PROMO, 'frames');
const FPS = 24;
const PREVIEW = process.argv.includes('--preview');

(async () => {
  const timeline = JSON.parse(fs.readFileSync(path.join(PROMO, 'timeline.json'), 'utf8'));
  const total = timeline.total;

  fs.mkdirSync(FRAMES, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file:///' + path.join(PROMO, 'renderer.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  const ready = await page.evaluate(() => ({
    hasSeek: typeof window.seek === 'function',
    total: window.TOTAL || (window.TIMELINE && window.TIMELINE.total),
    scenes: window.TIMELINE ? window.TIMELINE.scenes.length : 0,
  }));
  console.log('renderer ready:', JSON.stringify(ready));
  if (!ready.hasSeek || ready.scenes !== timeline.scenes.length) {
    console.error('renderer/timeline mismatch'); process.exit(1);
  }

  if (PREVIEW) {
    // Middle of each scene + one crossfade moment.
    const times = timeline.scenes.map(s => (s.start + s.end) / 2);
    times.push(timeline.scenes[1].start + 0.25); // mid-crossfade
    for (const t of times.sort((a, b) => a - b)) {
      await page.evaluate(tt => window.seek(tt), t);
      await new Promise(r => setTimeout(r, 120)); // allow image decode
      await page.screenshot({ path: path.join(FRAMES, `preview-${t.toFixed(2)}s.png`) });
      console.log('preview frame @', t.toFixed(2) + 's');
    }
  } else {
    const nFrames = Math.ceil(total * FPS);
    console.log(`capturing ${nFrames} frames at ${FPS}fps...`);
    const t0 = Date.now();
    for (let i = 0; i < nFrames; i++) {
      const t = i / FPS;
      await page.evaluate(tt => window.seek(tt), t);
      if (i === 0) await new Promise(r => setTimeout(r, 400)); // first-frame image decode
      await page.screenshot({ path: path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`) });
      if (i % 120 === 0) {
        const rate = (i + 1) / ((Date.now() - t0) / 1000);
        console.log(`  ${i}/${nFrames} (${rate.toFixed(1)} fps capture)`);
      }
    }
    console.log(`done: ${nFrames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }

  if (errs.length) { console.log('PAGE ERRORS:'); errs.slice(0, 5).forEach(e => console.log('  !', e)); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
