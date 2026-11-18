#!/usr/bin/env node
// Rendu de la pub COSSI AGBOKOU : chaque image est dessinée dans Chromium (canvas 2D),
// envoyée à ffmpeg, puis assemblée avec la bande-son.
//   node pub-cossi/render.mjs                 -> out/cossi-agbokou-community-manager.mp4
//   node pub-cossi/render.mjs --stills 1,5,9  -> images tests + planche contact (build/cossi/stills)
//   node pub-cossi/render.mjs --serve         -> aperçu : http://localhost:8124/index.html?play=1
import { createRequire } from 'module';
import { execSync, spawn } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const f = path.join(HERE, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(8124);
if (arg('serve')) { console.log('http://localhost:8124/index.html?play=1'); await new Promise(() => {}); }

const FPS = 30, DUR = 30;
async function openPage() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  p.on('pageerror', (e) => console.error('ERREUR PAGE', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await p.goto('http://localhost:8124/index.html');
  await p.waitForFunction('window.ready', null, { timeout: 60000 });
  return [b, p];
}
const jpg = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const build = path.join(ROOT, 'build', 'cossi'); fs.mkdirSync(build, { recursive: true });

if (arg('stills')) {
  const dir = path.join(build, 'stills'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const [b, p] = await openPage();
  const ts = String(arg('stills')).split(',').map(Number);
  for (const [i, t] of ts.entries()) fs.writeFileSync(path.join(dir, `${String(i).padStart(3, '0')}_${t.toFixed(2)}.jpg`), jpg(await p.evaluate((f) => window.capture(f, 0.9), Math.round(t * FPS))));
  await b.close(); server.close();
  const cols = +arg('cols', 6);
  if (ts.length > 1) execSync(`ffmpeg -y -loglevel error -pattern_type glob -i '${dir}/*.jpg' -vf "scale=360:-1,tile=${cols}x${Math.ceil(ts.length / cols)}:padding=6:color=white" -q:v 3 ${dir}/sheet.jpg`);
  console.log('images :', dir); process.exit(0);
}

// ---- rendu complet, réparti sur plusieurs navigateurs
const total = FPS * DUR, NW = +arg('workers', 4);
const out = path.join(ROOT, 'out'); fs.mkdirSync(out, { recursive: true });
const t0 = Date.now(); let done = 0;
const parts = await Promise.all([...Array(NW).keys()].map(async (i) => {
  const a = Math.floor(total * i / NW), z = Math.floor(total * (i + 1) / NW), file = path.join(build, `part_${i}.mp4`);
  const [b, p] = await openPage();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < z; f++) {
    const buf = jpg(await p.evaluate((n) => window.capture(n, 0.96), f));
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 90 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${total} images — ${el.toFixed(0)} s, reste ~${((total - done) * el / done).toFixed(0)} s`); }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  return file;
}));
server.close();
fs.writeFileSync(path.join(build, 'parts.txt'), parts.map((f) => `file '${f}'`).join('\n'));
const final = path.join(out, 'cossi-agbokou-community-manager.mp4');
execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${build}/parts.txt -i ${build}/audio.wav -c:v libx264 -preset slow -crf ${arg('crf', 20)} -profile:v high -pix_fmt yuv420p -r 30 -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 -t 30 -movflags +faststart ${final}`, { stdio: 'inherit' });
console.log('Terminé en', ((Date.now() - t0) / 1000).toFixed(0), 's ->', final);
