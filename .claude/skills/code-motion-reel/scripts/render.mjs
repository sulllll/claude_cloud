// Render a code-only reel (a page exposing window.ready / renderAt / renderAudio) to MP4.
//
//   NODE_PATH=$(npm root -g) node render.mjs --root site --page reel/render.html --out site/reel/reel.mp4
//        [--fps 60] [--crf 25] [--stills 1,4.6,13.3 --stills-dir reel-stills] [--remux] [--poster 14.4]
//
// Needs Playwright (Chromium) and ffmpeg (FFMPEG env var, else `ffmpeg`, else python imageio-ffmpeg).
// No external video or audio services are used: frames come from the canvas, audio from an
// OfflineAudioContext running the same Web Audio graph the live page uses.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes(k);
const ROOT = path.resolve(arg('--root', '.'));
const PAGE = arg('--page', 'render.html');
const OUT = path.resolve(arg('--out', 'reel.mp4'));
const FPS = Number(arg('--fps', 60));
const CRF = arg('--crf', '25');
const STILLS = arg('--stills', null);
const STILLS_DIR = path.resolve(arg('--stills-dir', 'reel-stills'));
const POSTER = arg('--poster', null);

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch {}
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); } catch {}
  throw new Error('ffmpeg not found: install it, set FFMPEG, or `pip install imageio-ffmpeg`');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(p); // read before writing headers so a 404 stays a 404
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

// No browser proxy: local pages are served on loopback, and web fonts are fetched with curl below,
// because a sandbox's TLS-intercepting proxy CA is usually trusted by curl but not by bundled Chromium.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('page error:', e.message));
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const curl = url => new Promise((resolve, reject) => {
  const p = spawn('curl', ['-sS', '--fail', '-A', UA, url]); const chunks = [];
  p.stdout.on('data', c => chunks.push(c)); p.on('error', reject);
  p.on('close', c => (c === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`curl ${c} ${url}`))));
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, async route => {
  const url = route.request().url();
  try {
    const body = await curl(url);
    const type = url.includes('googleapis') ? 'text/css' : url.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
    await route.fulfill({ status: 200, body, headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
  } catch (e) { console.error(e.message); await route.abort(); }
});
const resp = await page.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`);
if (!resp || resp.status() !== 200) throw new Error(`render page returned ${resp && resp.status()}`);
const info = await page.evaluate(() => window.ready);
console.log('ready:', JSON.stringify(info));
const duration = await page.evaluate(() => window.Reel.DURATION);

const run = (cmd, args, feed) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: [feed ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.on('error', reject); p.on('close', c => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  if (feed) feed(p.stdin);
});
const jpeg = async (t, q) => Buffer.from((await page.evaluate(([t, q]) => window.renderAt(t, q), [t, q])).split(',')[1], 'base64');

if (STILLS) {
  await mkdir(STILLS_DIR, { recursive: true });
  for (const t of STILLS.split(',').map(Number)) await writeFile(path.join(STILLS_DIR, `t${t.toFixed(2).padStart(5, '0')}.jpg`), await jpeg(t, 0.9));
  console.log('stills ->', STILLS_DIR);
} else {
  const FF = findFfmpeg();
  const { wav, peak } = await page.evaluate(() => window.renderAudio());
  const wavPath = OUT.replace(/\.mp4$/, '') + '.wav';
  await writeFile(wavPath, Buffer.from(wav, 'base64'));
  console.log('audio raw peak', peak.toFixed(3), peak > 1 ? '(clips live! trim gain after the compressor)' : '');
  if (has('--remux')) {
    const tmp = OUT.replace(/\.mp4$/, '.tmp.mp4');
    await run(FF, ['-y', '-loglevel', 'error', '-i', OUT, '-i', wavPath, '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp]);
    await rename(tmp, OUT);
    console.log('remuxed audio ->', OUT);
  } else {
    const total = Math.round(duration * FPS);
    await run(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', wavPath, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], async stdin => {
      for (let f = 0; f < total; f++) {
        if (!stdin.write(await jpeg(f / FPS, 0.94))) await new Promise(r => stdin.once('drain', r));
        if (f % FPS === 0) process.stdout.write(`\rframe ${f}/${total}`);
      }
      stdin.end();
    });
    console.log('\nvideo ->', OUT);
  }
  if (POSTER) {
    const pp = OUT.replace(/\.mp4$/, '-poster.jpg');
    await writeFile(pp, await jpeg(Number(POSTER), 0.88));
    console.log('poster ->', pp);
  }
}
await browser.close();
server.close();
