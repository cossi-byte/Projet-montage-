#!/usr/bin/env node
// Rendu du film : chaque image est dessinée par three.js dans Chromium (sans écran),
// envoyée à ffmpeg, puis assemblée avec la bande-son.
//   node balou/tools/render.mjs --ep 01      -> out/balou-ep01.mp4 (1080p)
//   node tools/render.mjs --stills 3,12.5    -> images tests + planche contact dans build/stills
//   node tools/render.mjs --serve            -> aperçu : http://localhost:8123/balou/ep01/index.html?play=1&w=960
import { createRequire } from 'module';
import { execSync, spawn } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(8123);
if (arg('serve')) { console.log('http://localhost:8123/balou/ep01/index.html?play=1&w=960'); await new Promise(() => {}); }

const W = +arg('w', 1920), FPS = 24, EP = String(arg('ep', '01')).padStart(2, '0'), PAGE = `/balou/ep${EP}/index.html`;
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
async function openPage(w) {
  const b = await chromium.launch({ args: GL });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', (e) => console.error('ERREUR PAGE', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await p.goto(`http://localhost:8123${PAGE}?w=${w}`);
  await p.waitForFunction('window.ready', null, { timeout: 120000 });
  return [b, p];
}
const jpg = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

if (arg('stills')) {
  const dir = path.join(ROOT, 'build', `balou-ep${EP}`, 'stills'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const [b, p] = await openPage(+arg('w', 640));
  const ts = String(arg('stills')).split(',').map(Number);
  for (const [i, t] of ts.entries()) fs.writeFileSync(path.join(dir, `${String(i).padStart(3, '0')}_${t.toFixed(2)}.jpg`), jpg(await p.evaluate((f) => window.capture(f), Math.round(t * FPS))));
  await b.close(); server.close();
  if (ts.length > 1) execSync(`ffmpeg -y -loglevel error -pattern_type glob -i '${dir}/*.jpg' -vf "tile=${arg('cols', 4)}x${Math.ceil(ts.length / arg('cols', 4))}" -q:v 3 ${dir}/sheet.jpg`);
  console.log('images :', dir); process.exit(0);
}

// ---- rendu complet, réparti sur plusieurs navigateurs
const DUR = await (async () => { const [b, p] = await openPage(320); const d = await p.evaluate(() => window.FILM.DUR); await b.close(); return d; })();
const total = Math.round(FPS * DUR), from = +arg('from', 0), to = +arg('to', total), NW = +arg('workers', 4);
const build = path.join(ROOT, 'build', `balou-ep${EP}`), out = path.join(ROOT, 'out'); fs.mkdirSync(build, { recursive: true }); fs.mkdirSync(out, { recursive: true });
const t0 = Date.now(); let done = 0;
const parts = await Promise.all([...Array(NW).keys()].map(async (i) => {
  const a = from + Math.floor((to - from) * i / NW), z = from + Math.floor((to - from) * (i + 1) / NW), file = path.join(build, `part_${i}.mp4`);
  const [b, p] = await openPage(W);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < z; f++) {
    const buf = jpg(await p.evaluate((n) => window.capture(n, 0.95), f));
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 100 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${to - from} images — ${(el / 60).toFixed(1)} min, reste ~${((to - from - done) * el / done / 60).toFixed(1)} min`); }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  return file;
}));
server.close();
fs.writeFileSync(path.join(build, 'parts.txt'), parts.map((f) => `file '${f}'`).join('\n'));
const final = path.join(out, `balou-ep${EP}.mp4`), full = from === 0 && to === total;
const audio = full ? `-i ${build}/audio.wav` : `-ss ${from / FPS} -t ${(to - from) / FPS} -i ${build}/audio.wav`;
const fade = full ? `-vf "fade=t=in:st=0:d=0.5,fade=t=out:st=${DUR - 1.6}:d=1.5"` : '';
execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${build}/parts.txt ${audio} ${fade} -c:v libx264 -preset slow -crf ${arg('crf', 21)} -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart ${full ? final : path.join(build, 'extrait.mp4')}`, { stdio: 'inherit' });
console.log('Terminé en', ((Date.now() - t0) / 60000).toFixed(1), 'min ->', full ? final : path.join(build, 'extrait.mp4'));
