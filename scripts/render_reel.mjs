// Render site/reel/reel.js to an MP4 (video + synthesized soundtrack), frame by frame.
//
//   NODE_PATH=$(npm root -g) FFMPEG=/path/to/ffmpeg node scripts/render_reel.mjs [--fps 60] [--stills 1,4.6,13.3] [--remux]
//
// Needs Playwright (Chromium) and ffmpeg. No external video or audio services are used.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(SITE, 'reel', 'market-pulse.mp4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = Number(arg('--fps', 60));
const STILLS = arg('--stills', null);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv' };
const server = createServer(async (req, res) => {
  try {
    const p = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(SITE)) throw new Error('outside');
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
// Fetch Google Fonts through curl, which trusts the system CA bundle (the bundled Chromium may not).
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const curl = url => new Promise((resolve, reject) => {
  const p = spawn('curl', ['-sS', '--fail', '-A', UA, url]); const chunks = [];
  p.stdout.on('data', c => chunks.push(c)); p.on('error', reject);
  p.on('close', c => (c === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('curl ' + c + ' ' + url))));
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, async route => {
  const url = route.request().url();
  try {
    const body = await curl(url);
    const type = url.includes('googleapis') ? 'text/css' : url.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
    await route.fulfill({ status: 200, body, headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
  } catch (e) { console.error(e.message); await route.abort(); }
});
page.on('pageerror', e => console.error('page error:', e.message));
page.on('requestfailed', r => console.error('request failed:', r.url(), r.failure().errorText));
const resp = await page.goto(`http://127.0.0.1:${port}/reel/render.html`);
console.log('page status', resp && resp.status());
console.log('ready:', await page.evaluate(() => window.ready));

const run = (cmd, args, input) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.on('error', reject); p.on('close', c => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  if (input) input(p.stdin);
});

if (STILLS) {
  const dir = path.join(ROOT, 'reel-stills'); await mkdir(dir, { recursive: true });
  for (const t of STILLS.split(',').map(Number)) {
    const url = await page.evaluate(t => window.renderAt(t, 0.9), t);
    await writeFile(path.join(dir, `t${t.toFixed(2)}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('stills written to', dir);
} else {
  const { wav, peak } = await page.evaluate(() => window.renderAudio());
  const wavPath = path.join(ROOT, 'reel-audio.wav');
  await writeFile(wavPath, Buffer.from(wav, 'base64'));
  console.log('audio peak', peak.toFixed(3));

  if (process.argv.includes('--remux')) {
    // keep the rendered frames, replace only the soundtrack
    const tmp = OUT.replace(/\.mp4$/, '.tmp.mp4');
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', OUT, '-i', wavPath, '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp]);
    await rename(tmp, OUT);
    console.log('remuxed audio into', OUT);
    await browser.close(); server.close(); process.exit(0);
  }
  const total = Math.round(15 * FPS);
  await run(FFMPEG, ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wavPath,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], async stdin => {
    for (let f = 0; f < total; f++) {
      const url = await page.evaluate(t => window.renderAt(t, 0.94), f / FPS);
      if (!stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => stdin.once('drain', r));
      if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${total}`);
    }
    stdin.end();
  });
  const poster = await page.evaluate(() => window.renderAt(14.45, 0.88));
  await writeFile(path.join(SITE, 'reel', 'poster.jpg'), Buffer.from(poster.split(',')[1], 'base64'));
  console.log('\nwrote', OUT, 'and poster.jpg');
}
await browser.close();
server.close();
