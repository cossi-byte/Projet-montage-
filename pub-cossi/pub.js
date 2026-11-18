// COSSI AGBOKOU — Community Manager
// Publicité 100 % motion design, 1080×1920, 30 s, 30 i/s.
// Chaque image est une fonction pure du temps : draw(t). Aucune image externe.
'use strict';

const W = 1080, H = 1920, FPS = 30, DUR = 30;
const BPM = 115, B = 60 / BPM;                     // un temps = 0,5217 s
const C = {
  bg: '#0B1A33', gold: '#D4A537', ivory: '#F5F0E6', red: '#C0392B',
  gray: '#56627A', grayD: '#24324D', card: '#10244A', deep: '#071328',
};
// Découpage calé sur les temps de la musique (115 BPM)
const T = { s2: 6 * B, s3: 14 * B, s4: 23 * B, s5: 40 * B, s6: 48 * B };
const SV = [23, 27, 30, 33, 36].map((b) => b * B);   // début de chaque service
const BURST = [...Array(8).keys()].map((k) => (6 + k) * B / 4); // pops en doubles-croches
const CLICK = 55 * B;

const cv = document.getElementById('c');
cv.width = W; cv.height = H;
let ctx = cv.getContext('2d');

// ------------------------------------------------------------------ outils
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eo4 = (x) => 1 - Math.pow(1 - x, 4);
const ei = (x) => x * x * x;
const back = (x, s = 1.4) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return `rgb(${p.map((v, i) => Math.round(lerp(v, q[i], clamp(t)))).join(',')})`; };
const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
const TAU = Math.PI * 2;

function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shadow(blur = 40, oy = 18, a = 0.45) { ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
const font = (s, w = 800) => `${w} ${s}px Montserrat`;
function fit(text, size, maxW, w = 800, ls = 0) {
  ctx.font = font(size, w); ctx.letterSpacing = ls + 'px';
  const m = ctx.measureText(text).width; ctx.letterSpacing = '0px';
  return m > maxW ? size * maxW / m : size;
}

// ---------------------------------------------------- typographie cinétique
// Ligne révélée mot à mot par un masque (glissement du bas vers le haut, léger rebond).
// '*mot*' = mot en or. t1 : début de la sortie (glissement vers le haut).
function kLine(str, y, size, t, t0, o = {}) {
  const w = o.w || 800, ls = o.ls || 0, st = o.stagger ?? 0.07, d = o.dur ?? 0.5;
  if (t < t0) return;
  const words = str.split(' ').map((s) => ({ s: s.replace(/\*/g, ''), acc: s.includes('*') }));
  ctx.font = font(size, w); ctx.letterSpacing = ls + 'px';
  const sp = ctx.measureText(' ').width;
  words.forEach((wd) => (wd.w = ctx.measureText(wd.s).width));
  const total = words.reduce((a, b) => a + b.w, 0) + sp * (words.length - 1);
  let x = (o.x ?? W / 2) - (o.align === 'left' ? 0 : total / 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y - size * 1.05, W, size * 1.42); ctx.clip();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  words.forEach((wd, i) => {
    const a = prog(t, t0 + i * st, t0 + i * st + d);
    let dy = (1 - back(a, 1.15)) * size * 1.2;
    if (o.t1 != null) dy -= eio(prog(t, o.t1 + i * st * 0.5, o.t1 + i * st * 0.5 + 0.38)) * size * 1.35;
    ctx.globalAlpha = (o.alpha ?? 1) * clamp(a * 2);
    ctx.fillStyle = wd.acc ? (o.acc || C.gold) : (o.color || C.ivory);
    ctx.fillText(wd.s, x, y + dy);
    x += wd.w + sp;
  });
  ctx.restore();
  ctx.letterSpacing = '0px';
}

// --------------------------------------------- motifs textiles (arrière-plan)
// Bandes tissées inspirées des pagnes d'Afrique de l'Ouest : chaînes de losanges,
// zigzags, damiers. Dessinées en or, affichées très discrètement.
function makeTile() {
  const c = document.createElement('canvas'); c.width = 240; c.height = 480;
  const g = c.getContext('2d');
  g.strokeStyle = C.gold; g.fillStyle = C.gold; g.lineWidth = 2;
  // bande 1 : chaîne de losanges
  for (let i = 0; i < 2; i++) {
    const cx = 60 + i * 120, cy = 60;
    g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx + 46, cy); g.lineTo(cx, cy + 46); g.lineTo(cx - 46, cy); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx + 22, cy); g.lineTo(cx, cy + 22); g.lineTo(cx - 22, cy); g.closePath(); g.stroke();
    g.fillRect(cx - 4, cy - 4, 8, 8);
  }
  g.fillRect(0, 124, 240, 2); g.fillRect(0, 132, 240, 2);
  // bande 2 : zigzag + points
  g.beginPath();
  for (let x = 0; x <= 240; x += 30) g.lineTo(x, (x / 30) % 2 ? 150 : 190);
  g.stroke();
  for (let x = 15; x < 240; x += 30) g.fillRect(x - 3, (x - 15) / 30 % 2 ? 183 : 153, 6, 6);
  g.fillRect(0, 206, 240, 2); g.fillRect(0, 214, 240, 2);
  // bande 3 : damier tissé
  for (let x = 0; x < 240; x += 24) for (let y = 228; y < 300; y += 24) if (((x + y) / 24) % 2 < 1) g.strokeRect(x + 5, y + 5, 14, 14);
  g.fillRect(0, 306, 240, 2);
  // bande 4 : triangles affrontés
  for (let x = 0; x < 240; x += 40) {
    g.beginPath(); g.moveTo(x, 320); g.lineTo(x + 20, 350); g.lineTo(x + 40, 320); g.stroke();
    g.beginPath(); g.moveTo(x, 390); g.lineTo(x + 20, 360); g.lineTo(x + 40, 390); g.stroke();
  }
  g.fillRect(0, 404, 240, 2);
  // bande 5 : losanges pleins
  for (let x = 30; x < 240; x += 60) { g.beginPath(); g.moveTo(x, 420); g.lineTo(x + 14, 442); g.lineTo(x, 464); g.lineTo(x - 14, 442); g.closePath(); g.fill(); }
  return c;
}
const tile = makeTile();
const pattern = ctx.createPattern(tile, 'repeat');
const lay = document.createElement('canvas'); lay.width = W; lay.height = H;
const lctx = lay.getContext('2d');
const lay2 = document.createElement('canvas'); lay2.width = W; lay2.height = H;
const l2 = lay2.getContext('2d');
// grain (anti-banding des dégradés)
const grain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = rnd(i * 0.37) > 0.5 ? 255 : 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = rnd(i * 1.13) * 9; }
  g.putImageData(im, 0, 0); return ctx.createPattern(c, 'repeat');
})();

// décalage de parallaxe : chaque changement de scène pousse le décor
function camShift(t) {
  let s = -t * 10;
  for (const ts of [T.s2, T.s3, T.s4, ...SV.slice(1), T.s5, T.s6]) s -= eio(prog(t, ts - 0.05, ts + 0.7)) * 70;
  return s;
}

function background(t, glow) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.46, H * 0.78);
  g.addColorStop(0, '#15305C'); g.addColorStop(0.55, '#0E2142'); g.addColorStop(1, C.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sh = camShift(t);
  // couche lointaine : treillis textile
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.translate(-30, sh * 0.5 % 480);
  ctx.fillStyle = pattern; ctx.fillRect(0, -480, W + 60, H + 960);
  ctx.restore();
  // couche proche : deux bandes « kente » sur les bords (parallaxe plus rapide)
  ctx.save();
  ctx.globalAlpha = 0.10;
  for (const x of [-170, W - 70]) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 240, H); ctx.clip();
    ctx.translate(x, sh * 1.3 % 480); ctx.fillStyle = pattern; ctx.fillRect(0, -480, 240, H + 960);
    ctx.restore();
  }
  ctx.restore();
  // illumination des motifs (révélation du nom)
  if (glow && glow.a > 0.001) {
    lctx.clearRect(0, 0, W, H);
    lctx.save(); lctx.globalCompositeOperation = 'source-over';
    lctx.translate(-30, sh * 0.5 % 480); lctx.fillStyle = pattern; lctx.fillRect(0, -480, W + 60, H + 960); lctx.restore();
    lctx.globalCompositeOperation = 'destination-in';
    const r = Math.max(1, glow.r);
    const rg = lctx.createRadialGradient(W / 2, glow.y, 0, W / 2, glow.y, r);
    rg.addColorStop(0, 'rgba(0,0,0,0.35)'); rg.addColorStop(0.72, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = rg; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = glow.a; ctx.drawImage(lay, 0, 0); ctx.restore();
  }
}
function vignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(3,8,18,0)'); g.addColorStop(1, 'rgba(3,8,18,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function film(t) {
  ctx.save(); ctx.globalAlpha = 1;
  ctx.fillStyle = grain; ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}

// ------------------------------------------------------- formes & morphing
const NP = 72;   // points par trait d'icône
function resample(pts, closed, n = NP) {
  const p = closed ? [...pts, pts[0]] : pts.slice();
  const L = [0];
  for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const tot = L[L.length - 1] || 1, out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = tot * k / (n - 1);
    while (j < p.length - 1 && L[j] < d) j++;
    const s = (d - L[j - 1]) / ((L[j] - L[j - 1]) || 1);
    out.push([lerp(p[j - 1][0], p[j][0], s), lerp(p[j - 1][1], p[j][1], s)]);
  }
  out.len = tot; return out;
}
const circ = (cx, cy, r, n = 48, a0 = -Math.PI / 2) => [...Array(n).keys()].map((i) => [cx + r * Math.cos(a0 + TAU * i / n), cy + r * Math.sin(a0 + TAU * i / n)]);
// rectangle arrondi, départ en haut au centre, sens horaire
function rrPts(cx, cy, w, h, r, n = 10) {
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2, p = [[cx, y0]];
  const arc = (ax, ay, a) => { for (let i = 0; i <= n; i++) p.push([ax + r * Math.cos(a + i / n * Math.PI / 2), ay + r * Math.sin(a + i / n * Math.PI / 2)]); };
  arc(x1 - r, y0 + r, -Math.PI / 2); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, Math.PI / 2); arc(x0 + r, y0 + r, Math.PI);
  return p;
}
const ngon = (k, r, rot = -Math.PI / 2) => [...Array(k).keys()].map((i) => [r * Math.cos(rot + TAU * i / k), r * Math.sin(rot + TAU * i / k)]);
const quad = (a, c, b, n = 24) => [...Array(n + 1).keys()].map((i) => { const s = i / n; return [(1 - s) * (1 - s) * a[0] + 2 * (1 - s) * s * c[0] + s * s * b[0], (1 - s) * (1 - s) * a[1] + 2 * (1 - s) * s * c[1] + s * s * b[1]]; });
const S = (pts, closed = false) => resample(pts, closed);
const rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// Icônes au trait (5 traits chacune, boîte ±100) — morphing point à point
const ICONS = [
  [ // calendrier
    S(rrPts(0, 12, 170, 150, 18), true), S([[-85, -25], [85, -25]]), S([[-40, -82], [-40, -42]]), S([[40, -82], [40, -42]]), S(rectP(12, 12, 52, 52), true)],
  [ // appareil photo
    S(rrPts(0, 15, 184, 124, 20), true), S(circ(0, 17, 42), true), S([[-36, -47], [-24, -72], [24, -72], [36, -47]]), S(circ(0, 17, 17), true), S(circ(62, -20, 7, 16), true)],
  [ // lecture + timeline de montage
    S(rrPts(0, -22, 184, 124, 16), true), S([[-18, -52], [30, -22], [-18, 8]], true), S([[-92, 76], [92, 76]]), S([[-30, 58], [-30, 94]]), S(circ(-30, 76, 9, 16), true)],
  [ // plume vectorielle (outil plume)
    S([[-34, -58], [-56, 8], [0, 84], [56, 8], [34, -58]], true), S([[0, 84], [0, 22]]), S(rectP(-36, -88, 36, -60), true), S(circ(0, 8, 11, 16), true), S(quad([-96, 96], [0, 30], [96, 96]))],
  [ // graphique en hausse
    S([[-86, -86], [-86, 82], [90, 82]]), S([[-62, 46], [-22, 8], [14, 28], [72, -48]]), S([[44, -50], [74, -50], [74, -20]]), S(rectP(-58, 58, -38, 82), true), S(rectP(26, 30, 46, 82), true)],
  [ // bobine de film (transition)
    S(circ(0, 0, 30), true), S(circ(67, -67, 25), true), S(circ(67, 67, 25), true), S(circ(-67, 67, 25), true), S(circ(-67, -67, 25), true)],
];
const NB = 160;   // contour des badges
const BADGES = [
  resample(circ(0, 0, 1, 96), true, NB),
  resample(rrPts(0, 0, 1.72, 1.72, 0.42), true, NB),
  resample(ngon(6, 1.04), true, NB),
  resample(ngon(4, 1.13), true, NB),
  resample(circ(0, 0, 1, 96), true, NB),
  resample(circ(0, 0, 1, 96), true, NB),
];
const lerpPts = (a, b, s) => a.map((p, i) => [lerp(p[0], b[i][0], s), lerp(p[1], b[i][1], s)]);
function pathPts(p, closed) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (closed) ctx.closePath(); }

// ---------------------------------------------------- petites icônes notifs
function heartPath(s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 0.95, -s * 0.25, -s * 0.5, -s * 0.95, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.5, -s * 0.95, s * 0.95, -s * 0.25, 0, s * 0.35);
  ctx.closePath();
}
function bubblePath(s) {
  rrect(-s * 0.55, -s * 0.45, s * 1.1, s * 0.75, s * 0.22);
  ctx.moveTo(-s * 0.2, s * 0.3); ctx.lineTo(-s * 0.38, s * 0.55); ctx.lineTo(s * 0.05, s * 0.3);
}
function shareGlyph(s, col) {
  const pts = [[s * 0.38, -s * 0.36], [-s * 0.38, 0], [s * 0.38, s * 0.36]];
  ctx.strokeStyle = col; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.stroke();
  ctx.fillStyle = col; for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], s * 0.15, 0, TAU); ctx.fill(); }
}
function notifIcon(type, s, gold, ivory, red, a = 1, g = 0) {
  if (type >= 10) { ctx.globalAlpha = a; socialIcon(type - 10, s * 1.05, g); return; }
  // badge sombre + icône dorée (profondeur : ombre douce)
  ctx.globalAlpha = a;
  if (type === 3) { // pastille de notification (touche rouge)
    shadow(24, 10, 0.4); rrect(-s * 0.95, -s * 0.42, s * 1.9, s * 0.84, s * 0.42); ctx.fillStyle = red; ctx.fill(); noShadow();
    ctx.save(); ctx.translate(-s * 0.48, 0); heartPath(s * 0.42); ctx.fillStyle = ivory; ctx.fill(); ctx.restore();
    ctx.fillStyle = ivory; ctx.font = font(Math.round(s * 0.42), 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('+1', -s * 0.12, s * 0.03); ctx.textBaseline = 'alphabetic';
    return;
  }
  shadow(28, 12, 0.45); ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fillStyle = C.card; ctx.fill(); noShadow();
  ctx.lineWidth = s * 0.05; ctx.strokeStyle = gold; ctx.globalAlpha = a * 0.7; ctx.stroke(); ctx.globalAlpha = a;
  if (type === 0) { ctx.save(); ctx.translate(0, s * 0.05); heartPath(s * 0.62); ctx.fillStyle = gold; ctx.fill(); ctx.restore(); }
  if (type === 1) { bubblePath(s * 0.75); ctx.strokeStyle = gold; ctx.lineWidth = s * 0.08; ctx.lineJoin = 'round'; ctx.stroke(); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(k * s * 0.15, -s * 0.06, s * 0.045, 0, TAU); ctx.fillStyle = gold; ctx.fill(); } }
  if (type === 2) shareGlyph(s * 0.75, gold);
  if (type === 4) { // étoile
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.18 : s * 0.4, an = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(r * Math.cos(an), r * Math.sin(an)); } ctx.closePath(); ctx.fillStyle = gold; ctx.fill();
  }
}


// ----------------------------------------------- icônes des réseaux sociaux
// Versions simplifiées dessinées au canvas. net : 0 Facebook, 1 TikTok, 2 Instagram, 3 LinkedIn.
// g : 0 = couleurs d'origine, 1 = gris (scène « le problème »).
function socialIcon(net, s, g = 0) {
  const gr = (c) => mix(c, '#4A5468', g), wh = mix('#FFFFFF', '#8C95A8', g);
  const h = s / 2, r = s * 0.23;
  shadow(26, 10, 0.45);
  if (net === 0) { ctx.beginPath(); ctx.arc(0, 0, h, 0, TAU); ctx.fillStyle = gr('#1877F2'); ctx.fill(); }
  else if (net === 2) {
    rrect(-h, -h, s, s, r);
    const ig = ctx.createRadialGradient(-h * 0.6, h * 1.1, 0, -h * 0.6, h * 1.1, s * 1.35);
    ig.addColorStop(0, gr('#FEDA75')); ig.addColorStop(0.25, gr('#FA7E1E')); ig.addColorStop(0.5, gr('#D62976')); ig.addColorStop(0.75, gr('#962FBF')); ig.addColorStop(1, gr('#4F5BD5'));
    ctx.fillStyle = ig; ctx.fill();
  } else { rrect(-h, -h, s, s, r); ctx.fillStyle = net === 1 ? gr('#010101') : gr('#0A66C2'); ctx.fill(); }
  noShadow();
  if (net === 1) { ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.gold, 0.5 * (1 - g)); ctx.stroke(); }
  ctx.fillStyle = wh; ctx.strokeStyle = wh;
  if (net === 0) { // « f »
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, h, 0, TAU); ctx.clip();
    const u = s / 100;
    ctx.beginPath();
    ctx.moveTo(4 * u, 54 * u); ctx.lineTo(4 * u, 8 * u); ctx.lineTo(-10 * u, 8 * u); ctx.lineTo(-10 * u, -8 * u); ctx.lineTo(4 * u, -8 * u);
    ctx.lineTo(4 * u, -18 * u); ctx.bezierCurveTo(4 * u, -34 * u, 12 * u, -40 * u, 26 * u, -40 * u); ctx.lineTo(30 * u, -40 * u); ctx.lineTo(30 * u, -26 * u); ctx.lineTo(25 * u, -26 * u);
    ctx.bezierCurveTo(20 * u, -26 * u, 19 * u, -23 * u, 19 * u, -18 * u); ctx.lineTo(19 * u, -8 * u); ctx.lineTo(30 * u, -8 * u); ctx.lineTo(28 * u, 8 * u); ctx.lineTo(19 * u, 8 * u); ctx.lineTo(19 * u, 54 * u); ctx.closePath();
    ctx.fill(); ctx.restore();
  }
  if (net === 1) { // note de musique décalée cyan / rouge / blanc
    const u = s / 100;
    const note = (dx, dy, col) => {
      ctx.save(); ctx.translate(dx, dy); ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(-9 * u, 14 * u, 12 * u, 0, TAU); ctx.lineWidth = 7 * u; ctx.stroke();
      ctx.fillRect(-1 * u, -30 * u, 8 * u, 44 * u);
      ctx.beginPath(); ctx.moveTo(7 * u, -30 * u); ctx.bezierCurveTo(9 * u, -20 * u, 16 * u, -14 * u, 24 * u, -13 * u); ctx.lineTo(24 * u, -5 * u); ctx.bezierCurveTo(16 * u, -5 * u, 10 * u, -9 * u, 7 * u, -13 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    note(-2.5 * u, -2 * u, gr('#25F4EE')); note(2.5 * u, 2 * u, gr('#FE2C55')); note(0, 0, wh);
  }
  if (net === 2) { // appareil stylisé
    ctx.lineWidth = s * 0.075; rrect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6, s * 0.17); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.17, -s * 0.17, s * 0.04, 0, TAU); ctx.fill();
  }
  if (net === 3) { // « in »
    const u = s / 100;
    ctx.fillRect(-28 * u, -8 * u, 13 * u, 40 * u);
    ctx.beginPath(); ctx.arc(-21.5 * u, -22 * u, 8 * u, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6 * u, 32 * u); ctx.lineTo(-6 * u, -8 * u); ctx.lineTo(6 * u, -8 * u); ctx.lineTo(6 * u, -2 * u);
    ctx.bezierCurveTo(10 * u, -8 * u, 16 * u, -10 * u, 22 * u, -10 * u); ctx.bezierCurveTo(32 * u, -10 * u, 34 * u, -2 * u, 34 * u, 8 * u); ctx.lineTo(34 * u, 32 * u);
    ctx.lineTo(21 * u, 32 * u); ctx.lineTo(21 * u, 10 * u); ctx.bezierCurveTo(21 * u, 4 * u, 19 * u, 1 * u, 14 * u, 1 * u); ctx.bezierCurveTo(9 * u, 1 * u, 7 * u, 5 * u, 7 * u, 10 * u); ctx.lineTo(7 * u, 32 * u); ctx.closePath(); ctx.fill();
  }
}

// ----------------------------------------------------------------- téléphone
const PW = 470, PH = 940, PR = 72, SW = 426, SH = 896;
function phone(cx, cy, s, alpha, screenFn) {
  if (alpha <= 0.001) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.scale(s, s);
  shadow(70, 34, 0.55); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.fillStyle = '#0F2244'; ctx.fill(); noShadow();
  ctx.lineWidth = 5; ctx.strokeStyle = C.gold; ctx.stroke();
  rrect(-SW / 2, -SH / 2, SW, SH, PR - 20); ctx.fillStyle = '#0A1730'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.translate(-SW / 2, -SH / 2); screenFn && screenFn(); ctx.restore();
  // encoche
  rrect(-62, -PH / 2 + 30, 124, 26, 13); ctx.fillStyle = '#0F2244'; ctx.fill();
  // reflet discret
  const g = ctx.createLinearGradient(-PW / 2, -PH / 2, PW / 2, PH / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
  rrect(-SW / 2, -SH / 2, SW, SH, PR - 20); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
function bar(x, y, w, h, col) { rrect(x, y, w, h, h / 2); ctx.fillStyle = col; ctx.fill(); }

// écran de la scène 1 : une publication qui « explose »
function screenPost(t) {
  const pulse = BURST.reduce((a, b) => a + Math.exp(-Math.max(0, t - b) * 9) * (t >= b ? 1 : 0), 0);
  ctx.fillStyle = '#0A1730'; ctx.fillRect(0, 0, SW, SH);
  bar(24, 70, 90, 10, rgba(C.ivory, 0.35)); bar(SW - 84, 70, 60, 10, rgba(C.ivory, 0.2));
  // en-tête
  ctx.beginPath(); ctx.arc(52, 132, 24, 0, TAU); ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = C.gold; ctx.font = font(18, 800); ctx.textAlign = 'center'; ctx.fillText('CA', 52, 139);
  bar(90, 118, 150, 12, rgba(C.ivory, 0.7)); bar(90, 140, 96, 10, rgba(C.ivory, 0.3));
  // visuel de la publication
  const iy = 176, ih = 380;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, '#1C3A6E'); g.addColorStop(1, '#10264C');
  ctx.fillStyle = g; ctx.fillRect(0, iy, SW, ih);
  ctx.beginPath(); ctx.arc(300, iy + 120, 46, 0, TAU); ctx.fillStyle = C.gold; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, iy + ih); ctx.lineTo(120, iy + 190); ctx.lineTo(220, iy + 300); ctx.lineTo(290, iy + 240); ctx.lineTo(SW, iy + ih); ctx.closePath(); ctx.fillStyle = '#0B1A33'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(120, iy + 190); ctx.lineTo(220, iy + 300); ctx.lineTo(290, iy + 240); ctx.strokeStyle = rgba(C.gold, 0.8); ctx.lineWidth = 4; ctx.stroke();
  // cœur central qui bat à chaque notification
  if (t > BURST[0]) {
    const s = 70 * (1 + 0.25 * Math.min(1.2, pulse)) * back(prog(t, BURST[0], BURST[0] + 0.3));
    ctx.save(); ctx.translate(SW / 2, iy + ih / 2); ctx.globalAlpha *= 0.95 * (1 - prog(t, 2.4, 3.0));
    heartPath(s); ctx.fillStyle = C.ivory; ctx.fill(); ctx.restore();
  }
  // barre d'actions
  const ay = iy + ih + 50;
  ctx.save(); ctx.translate(46, ay); heartPath(30); t > BURST[0] ? (ctx.fillStyle = C.red, ctx.fill()) : (ctx.strokeStyle = C.ivory, ctx.lineWidth = 3.5, ctx.stroke()); ctx.restore();
  ctx.save(); ctx.translate(108, ay - 3); bubblePath(34); ctx.strokeStyle = C.ivory; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(166, ay - 3); shareGlyph(30, C.ivory); ctx.restore();
  // compteur de mentions « j'aime »
  const n = Math.round(lerp(12, 2480, eo(prog(t, BURST[0], 2.6))));
  ctx.fillStyle = C.ivory; ctx.font = font(22, 700); ctx.textAlign = 'left';
  ctx.fillText(n.toLocaleString('fr-FR').replace(/ /g, ' ') + ' j’aime', 24, ay + 58);
  bar(24, ay + 82, 300, 10, rgba(C.ivory, 0.3)); bar(24, ay + 102, 220, 10, rgba(C.ivory, 0.2));
}
// écran de la scène 2 : fil d'actualité vide qui défile
function screenEmpty(t) {
  ctx.fillStyle = '#0A1730'; ctx.fillRect(0, 0, SW, SH);
  const off = ((t - T.s2) * 140) % 330;
  for (let k = -1; k < 4; k++) {
    const y = 100 + k * 330 - off;
    ctx.beginPath(); ctx.arc(46, y + 22, 20, 0, TAU); ctx.fillStyle = C.grayD; ctx.fill();
    bar(80, y + 10, 130, 11, C.grayD); bar(80, y + 30, 80, 9, '#1B2840');
    rrect(20, y + 60, SW - 40, 190, 14); ctx.fillStyle = '#16233B'; ctx.fill();
    bar(20, y + 268, 160, 10, '#1B2840'); bar(20, y + 288, 230, 10, '#18243A');
  }
}
// écran de la scène 6 : compteur d'abonnés
function counterValue(t) { return Math.round(lerp(1200, 48500, eo4(prog(t, T.s6 + 0.55, T.s6 + 1.85)))); }
function screenCounter(t) {
  ctx.fillStyle = '#0A1730'; ctx.fillRect(0, 0, SW, SH);
  ctx.textAlign = 'center';
  ctx.beginPath(); ctx.arc(SW / 2, 190, 66, 0, TAU); ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = C.gold; ctx.font = font(46, 800); ctx.fillText('CA', SW / 2, 207);
  bar(SW / 2 - 90, 282, 180, 12, rgba(C.ivory, 0.55));
  const v = counterValue(t);
  ctx.fillStyle = C.ivory; ctx.font = font(76, 800);
  ctx.fillText(v.toLocaleString('fr-FR').replace(/ /g, ' '), SW / 2, 420);
  ctx.fillStyle = C.gold; ctx.font = font(22, 700); ctx.letterSpacing = '6px'; ctx.fillText('ABONNÉS', SW / 2 + 3, 462); ctx.letterSpacing = '0px';
  // pastille rouge « + »
  const pb = back(prog(t, T.s6 + 0.7, T.s6 + 1.0));
  if (pb > 0) { ctx.save(); ctx.translate(SW / 2 + 58, 140); ctx.scale(pb, pb); ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fillStyle = C.red; ctx.fill(); ctx.fillStyle = C.ivory; ctx.font = font(30, 800); ctx.fillText('+', 0, 11); ctx.restore(); }
  // mini courbe qui grimpe
  const p = eo(prog(t, T.s6 + 0.55, T.s6 + 1.9));
  const pts = [[40, 760], [110, 735], [170, 745], [235, 690], [300, 650], [386, 560]];
  ctx.beginPath(); ctx.moveTo(40, 800);
  for (const q of pts) ctx.lineTo(q[0], lerp(800, q[1], p));
  ctx.lineTo(386, 800); ctx.closePath(); ctx.fillStyle = rgba(C.gold, 0.14); ctx.fill();
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], lerp(800, q[1], p)) : ctx.moveTo(q[0], lerp(800, q[1], p))));
  ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
  // petits cœurs qui montent
  for (let k = 0; k < 9; k++) {
    const t0 = T.s6 + 0.6 + k * 0.17, a = t - t0;
    if (a < 0 || a > 1.4) continue;
    ctx.save(); ctx.translate(60 + rnd(k + 40) * 300 + Math.sin(a * 5 + k) * 14, 860 - a * 380);
    ctx.globalAlpha *= Math.sin(Math.PI * a / 1.4); heartPath(18 + rnd(k) * 12); ctx.fillStyle = k % 4 ? C.gold : C.red; ctx.fill(); ctx.restore();
  }
}

// ======================================================= SCÈNES 1 et 2
function burstItems(t) {
  const n = 24;
  for (let i = 0; i < n; i++) {
    const t0 = BURST[i % 8] + Math.floor(i / 8) * 0.02;
    if (t < t0) continue;
    const ang = -Math.PI / 2 + (i * 0.618 * TAU) + (rnd(i) - 0.5) * 0.4;
    const rr = 340 + rnd(i + 9) * 230;
    const sx = 540, sy = 700;
    let tx = sx + Math.cos(ang) * rr * 0.95, ty = sy + Math.sin(ang) * rr * 1.18;
    tx = clamp(tx, 90, 990); ty = clamp(ty, 170, 1250);
    const f = back(prog(t, t0, t0 + 0.75), 1.25);
    let x = lerp(sx, tx, f), y = lerp(sy, ty, f) + Math.sin(t * 2.2 + i) * 7;
    let rot = Math.sin(t * 1.6 + i * 2) * 0.12, sc = back(prog(t, t0, t0 + 0.4), 1.8);
    const g = prog(t, T.s2, T.s2 + 0.35);
    const tf = T.s2 + 0.12 + rnd(i + 3) * 0.55;
    if (t > tf) { const d = t - tf; y += 0.5 * 2900 * d * d; rot += d * (rnd(i + 5) - 0.5) * 6; x += d * (rnd(i + 7) - 0.5) * 160; }
    if (y > H + 150) continue;
    const s = 66 + rnd(i + 11) * 44;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
    notifIcon([10, 0, 11, 3, 1, 12, 2, 13, 0, 3, 4, 1][i % 12], s, mix(C.gold, C.gray, g), mix(C.ivory, '#8C95A8', g), mix(C.red, '#4A5468', g), 1, g);
    ctx.restore();
  }
}
function burstParticles(t) {
  for (let i = 0; i < 110; i++) {
    const t0 = BURST[i % 8], d = t - t0;
    if (d < 0 || d > 1.6) continue;
    const ang = rnd(i * 3.1) * TAU, v = 700 + rnd(i * 5.7) * 1300, k = 2.8;
    const r = v * (1 - Math.exp(-k * d)) / k;
    const x = 540 + Math.cos(ang) * r, y = 700 + Math.sin(ang) * r * 1.1 + 260 * d * d;
    const a = 1 - prog(d, 0.45, 1.6), s = 3 + rnd(i * 7.3) * 7;
    ctx.globalAlpha = a; ctx.fillStyle = i % 9 === 0 ? C.ivory : C.gold;
    ctx.save(); ctx.translate(x, y); ctx.rotate(d * 4 + i);
    if (i % 2) ctx.fillRect(-s / 2, -s / 2, s, s); else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// carte « engagement » à la courbe plate (scène 2)
const CH = { x: 160, y: 1080, w: 760, h: 250, lx0: 210, lx1: 870, ly: 1272 };
function chartCard(t) {
  const a = eo(prog(t, T.s2 + 0.4, T.s2 + 0.85)) * (1 - prog(t, 13 * B, 13 * B + 0.35));
  if (a <= 0) return;
  const dy = (1 - a) * 60;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, dy);
  shadow(40, 16, 0.4); rrect(CH.x, CH.y, CH.w, CH.h, 28); ctx.fillStyle = '#0F203F'; ctx.fill(); noShadow();
  ctx.strokeStyle = rgba('#8C95A8', 0.25); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#8C95A8'; ctx.font = font(24, 700); ctx.letterSpacing = '6px'; ctx.textAlign = 'left'; ctx.fillText('ENGAGEMENT', CH.x + 40, CH.y + 58); ctx.letterSpacing = '0px';
  ctx.textAlign = 'right'; ctx.font = font(40, 800); ctx.fillText('0,0 %', CH.x + CH.w - 40, CH.y + 64);
  ctx.strokeStyle = rgba('#8C95A8', 0.15); ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(CH.lx0, CH.y + 110 + k * 50); ctx.lineTo(CH.lx1, CH.y + 110 + k * 50); ctx.stroke(); }
  ctx.restore();
}
// la courbe plate devient la ligne dorée qui écrit le nom
function flatLine(t, NM) {
  const pd = eio(prog(t, T.s2 + 0.7, T.s2 + 1.9));
  if (pd <= 0 || t > NM.tStart + 0.05) return;
  const lift = (1 - eo(prog(t, T.s2 + 0.4, T.s2 + 0.85))) * 60;
  let a = [CH.lx0, CH.ly + lift], b = [lerp(CH.lx0, CH.lx1, pd), CH.ly + lift];
  const m = eio(prog(t, 13 * B, T.s3));          // remonte et s'étire
  a = [lerp(a[0], 90, m), lerp(a[1], NM.ruleY, m)];
  b = [lerp(b[0], 990, m), lerp(b[1], NM.ruleY, m)];
  const r = prog(t, T.s3 + 0.02, NM.tStart);       // se rétracte en un point : la plume
  const P0 = NM.p0;
  a = [lerp(a[0], P0[0], eio(clamp(r * 1.25))), lerp(a[1], P0[1], eio(r))];
  b = [lerp(b[0], P0[0], eio(r)), lerp(b[1], P0[1], eio(r))];
  const gold = prog(t, T.s3 - 0.04, T.s3 + 0.08);
  const wpulse = 6 + 9 * Math.exp(-Math.max(0, t - T.s3) * 7) * (t > T.s3 ? 1 : 0);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = mix('#8C95A8', C.gold, gold); ctx.lineWidth = wpulse;
  // petite agitation plate
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const s = k / 40; ctx.lineTo(lerp(a[0], b[0], s), lerp(a[1], b[1], s) + Math.sin(s * 30 + t * 6) * 3 * (1 - m)); }
  ctx.stroke();
  ctx.restore();
}

// ======================================================= SCÈNE 3 : le nom
let NMc = null;
function nameLayout() {
  if (NMc) return NMc;
  const ls = 6;
  const size = Math.min(fit('AGBOKOU', 200, 900, 800, ls), fit('COSSI', 200, 900, 800, ls));
  const y1 = 840, y2 = y1 + size * 1.04, ruleY = y2 + 64, titleY = ruleY + 92;
  ctx.font = font(size, 800); ctx.letterSpacing = ls + 'px';
  const lines = ['COSSI', 'AGBOKOU'].map((s, li) => {
    const tw = ctx.measureText(s).width, x0 = W / 2 - tw / 2 + ls / 2;
    const glyphs = [...s].map((ch, i) => ({ ch, x: x0 + ctx.measureText(s.slice(0, i)).width, w: ctx.measureText(ch).width }));
    return { s, y: li ? y2 : y1, x0, x1: x0 + tw - ls, glyphs };
  });
  ctx.letterSpacing = '0px';
  const tStart = T.s3 + 0.42;
  const tL1 = [tStart, tStart + 0.82], tL2 = [tStart + 0.98, tStart + 1.92];
  lines[0].tw = tL1; lines[1].tw = tL2;
  NMc = { size, ls, y1, y2, ruleY, titleY, lines, tStart, p0: [lines[0].x0, y1 - size * 0.36] };
  return NMc;
}
// position de la plume pour une ligne
function penX(L, t) { return lerp(L.x0 - 10, L.x1 + 10, eio(prog(t, L.tw[0], L.tw[1]))); }
function drawName(t, NM, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = font(NM.size, 800); ctx.letterSpacing = NM.ls + 'px'; ctx.letterSpacing = '0px';
  ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let pen = null;
  for (const L of NM.lines) {
    if (t < L.tw[0]) continue;
    const px = penX(L, t);
    for (const g of L.glyphs) {
      const gp = clamp((px - g.x) / (g.w * 1.05));
      if (gp <= 0) continue;
      const tEnd = lerp(L.tw[0], L.tw[1], (g.x + g.w - L.x0) / (L.x1 - L.x0));
      const fa = eo(prog(t, tEnd + 0.12, tEnd + 0.55));
      if (fa > 0) { ctx.globalAlpha = alpha * fa; ctx.fillStyle = C.gold; ctx.fillText(g.ch, g.x, L.y); ctx.globalAlpha = alpha; }
      ctx.strokeStyle = C.gold; ctx.lineWidth = 4;
      ctx.setLineDash(gp < 1 ? [gp * 1300, 4000] : []);
      ctx.globalAlpha = alpha * (1 - 0.6 * fa);
      ctx.strokeText(g.ch, g.x, L.y);
      ctx.globalAlpha = alpha;
    }
    ctx.setLineDash([]);
    if (t <= L.tw[1] + 0.02) pen = [px, L.y - NM.size * 0.36];
  }
  // liaison entre les deux lignes (le trait ne se lève pas)
  const L1 = NM.lines[0], L2 = NM.lines[1];
  const tj = prog(t, L1.tw[1], L2.tw[0]);
  if (tj > 0 && tj < 1) {
    const a = [L1.x1 + 10, L1.y - NM.size * 0.36], b = [L2.x0 - 10, L2.y - NM.size * 0.36];
    const c = [W / 2 + 40, (a[1] + b[1]) / 2 + 30];
    const pts = quad(a, c, b, 30); const e = eio(tj);
    ctx.strokeStyle = rgba(C.gold, 0.8 * (1 - e * 0.6)); ctx.lineWidth = 3;
    ctx.beginPath(); pts.slice(Math.floor(e * 20), Math.floor(e * 30) + 1).forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke();
    pen = pts[Math.floor(e * 30)];
  }
  if (t >= NM.tStart && !pen && t < L1.tw[0]) pen = NM.p0;
  if (pen) {   // pointe de plume : petit éclat doré, sans excès
    const rg = ctx.createRadialGradient(pen[0], pen[1], 0, pen[0], pen[1], 34);
    rg.addColorStop(0, rgba('#FFE7A8', 0.9)); rg.addColorStop(0.3, rgba(C.gold, 0.45)); rg.addColorStop(1, rgba(C.gold, 0));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(pen[0], pen[1], 34, 0, TAU); ctx.fill();
    ctx.fillStyle = C.ivory; ctx.beginPath(); ctx.arc(pen[0], pen[1], 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function diamond(x, y, s, fill) {
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
  fill ? ctx.fill() : ctx.stroke();
}
function sceneName(t) {
  const NM = nameLayout();
  if (t < T.s3 - 0.6 || t > T.s4 + 0.4) return;
  const ex = eio(prog(t, 22.5 * B, T.s4 + 0.1));   // sortie : rétrécit vers le haut
  const cy = (NM.y1 + NM.titleY) / 2;
  ctx.save();
  ctx.translate(W / 2, lerp(cy, 230, ex)); ctx.scale(lerp(1, 0.25, ex), lerp(1, 0.25, ex)); ctx.translate(-W / 2, -cy);
  const al = 1 - prog(ex, 0.4, 1);
  drawName(t, NM, al);
  // filet doré (la ligne revient)
  const rp = eo(prog(t, NM.lines[1].tw[1] - 0.05, NM.lines[1].tw[1] + 0.5));
  if (rp > 0) { ctx.globalAlpha = al; ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2 - 320 * rp, NM.ruleY); ctx.lineTo(W / 2 + 320 * rp, NM.ruleY); ctx.stroke(); diamond(W / 2, NM.ruleY, 9 * rp, true); ctx.fillStyle = C.gold; diamond(W / 2, NM.ruleY, 9 * rp, true); }
  const tt0 = NM.lines[1].tw[1] + 0.2;
  kLine('COMMUNITY MANAGER', NM.titleY, 50, t, tt0, { w: 700, ls: 14, stagger: 0.12, dur: 0.55, alpha: al });
  // chaînes de losanges (motifs qui s'allument autour)
  const yT = NM.y1 - NM.size * 0.74 - 80, yB = NM.titleY + 82;
  ctx.fillStyle = C.gold; ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5;
  for (let k = -7; k <= 7; k++) {
    const d = Math.abs(k), s = back(prog(t, tt0 - 0.1 + d * 0.06, tt0 + 0.25 + d * 0.06), 2) * (k % 2 ? 7 : 10);
    if (s <= 0) continue;
    ctx.globalAlpha = al * (0.95 - d * 0.05);
    diamond(W / 2 + k * 58, yT, s, k % 2 === 0); diamond(W / 2 + k * 58, yB, s, k % 2 === 0);
  }
  ctx.restore();
}

// ======================================================= SCÈNE 4 : services
const SERV = [
  ['Stratégie', '*éditoriale*'], ['Photo', '*professionnelle*'], ['Montage', '*vidéo*'], ['Design', '*graphique*'], ['Croissance', '*&* *analyse*'],
];
function serviceIndex(t) { let k = 0; for (let i = 0; i < 5; i++) if (t >= SV[i]) k = i; return k; }
function badgeState(t) {
  // renvoie centre, rayon, forme et icône interpolées
  let cx = 540, cy = 830, R = 250, rot = 0;
  let k = serviceIndex(t), m = eio(prog(t, SV[k], SV[k] + 0.5));
  let from = Math.max(0, k - 1), to = k;
  if (k === 0) m = 1;
  if (t >= T.s5) { from = 4; to = 5; m = eio(prog(t, T.s5, T.s5 + 0.55)); }
  const mv = eio(prog(t, T.s5, T.s5 + 0.7));
  cx = lerp(540, 190, mv); cy = lerp(830, 330, mv); R = lerp(250, 120, mv);
  rot = t >= T.s5 ? -Math.max(0, t - T.s5) * 4.5 * (1 + prog(t, T.s5 + 0.4, T.s5 + 1.6) * 0) : 0;
  const shape = lerpPts(BADGES[from], BADGES[to], m);
  const icon = ICONS[from].map((s, i) => lerpPts(s, ICONS[to][i], m));
  // petit rebond d'échelle à chaque morph
  const bump = k > 0 && t < T.s5 ? Math.sin(Math.PI * prog(t, SV[k], SV[k] + 0.5)) * -0.07 + Math.exp(-Math.max(0, t - SV[k] - 0.5) * 8) * (t > SV[k] + 0.5 ? 0.04 : 0) : 0;
  return { cx, cy, R: R * (1 + bump), rot, shape, icon, k, m };
}
function sceneServices(t) {
  if (t < T.s4 - 0.1 || t > T.s5 + 2.0) return;
  const st = badgeState(t);
  const pop = back(prog(t, T.s4, T.s4 + 0.55), 1.6);
  const out = prog(t, T.s5 + 1.2, T.s5 + 1.7);       // la bobine s'efface quand la pellicule devient fil
  if (pop <= 0) return;
  const R = st.R * pop;
  ctx.save(); ctx.globalAlpha = 1 - eio(out);
  // anneau pointillé tournant + points en orbite (profondeur)
  if (t < T.s5 + 0.5) {
    const ra = 1 - prog(t, T.s5, T.s5 + 0.4);
    ctx.save(); ctx.translate(st.cx, st.cy + camShift(t) * 0.04);
    ctx.rotate(t * 0.35); ctx.setLineDash([4, 18]); ctx.strokeStyle = rgba(C.gold, 0.45 * ra); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R * 1.22, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.rotate(-t * 0.8);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = rgba(C.gold, 0.9 * ra); diamond(Math.cos(k * TAU / 4) * R * 1.36, Math.sin(k * TAU / 4) * R * 1.36, 8, true); }
    ctx.restore();
  }
  ctx.translate(st.cx, st.cy); ctx.rotate(st.rot);
  // badge (forme qui se transforme)
  shadow(60, 26, 0.5);
  pathPts(st.shape.map((p) => [p[0] * R, p[1] * R]), true); ctx.fillStyle = C.card; ctx.fill(); noShadow();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.stroke();
  pathPts(st.shape.map((p) => [p[0] * R * 0.9, p[1] * R * 0.9]), true); ctx.strokeStyle = rgba(C.gold, 0.25); ctx.lineWidth = 2; ctx.stroke();
  // icône
  const s = (R / 250) * 1.45;
  ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = C.gold; ctx.lineWidth = 9;
  const draw = prog(t, T.s4 + 0.1, T.s4 + 0.75);
  st.icon.forEach((p, i) => {
    if (st.k === 0 && t < SV[1] && draw < 1) { const len = ICONS[0][i].len; ctx.setLineDash([len * eio(clamp(draw * 1.4 - i * 0.1)), len + 10]); }
    pathPts(p, false); ctx.stroke(); ctx.setLineDash([]);
  });
  details(t, st);
  ctx.restore();
  // libellés
  if (t < T.s5 + 0.6) {
    for (let k = 0; k < 5; k++) {
      const t0 = SV[k] + (k ? 0.12 : 0.35), t1 = k < 4 ? SV[k + 1] - 0.05 : T.s5 - 0.05;
      if (t < t0 || t > t1 + 0.6) continue;
      const size = Math.min(112, fit(SERV[k][0], 112, 920), fit(SERV[k][1].replace(/\*/g, ''), 112, 920));
      kLine(String(k + 1).padStart(2, '0') + ' / 05', 1205, 34, t, t0 - 0.05, { w: 700, ls: 8, color: C.gold, t1, dur: 0.4 });
      kLine(SERV[k][0], 1330, size, t, t0, { t1, dur: 0.5 });
      kLine(SERV[k][1], 1330 + size * 1.08, size, t, t0 + 0.08, { t1: t1 + 0.04, dur: 0.5 });
    }
    // barre de progression en 5 segments
    const ap = prog(t, T.s4 + 0.3, T.s4 + 0.7) * (1 - prog(t, T.s5, T.s5 + 0.3));
    ctx.globalAlpha = ap;
    for (let k = 0; k < 5; k++) {
      const x = 179 + k * 148, y = 1600, f = prog(t, SV[k], k < 4 ? SV[k + 1] : T.s5);
      bar(x, y, 130, 8, rgba(C.ivory, 0.15));
      if (f > 0) bar(x, y, Math.max(8, 130 * eio(clamp(f * 3))), 8, C.gold);
    }
    ctx.globalAlpha = 1;
  }
}
// animations propres à chaque icône (dans le repère de l'icône)
function details(t, st) {
  const k = st.k, h = t - SV[k] - 0.5;
  if (t >= T.s5 || h < 0) return;
  ctx.save();
  if (k === 0) { const a = back(prog(h, 0, 0.35), 2); ctx.fillStyle = C.gold; ctx.globalAlpha = 0.9; ctx.fillRect(32 - 20 * a, 32 - 20 * a, 40 * a, 40 * a); }
  if (k === 1) { const f = Math.exp(-Math.max(0, h - 0.45) * 7) * (h > 0.45 ? 1 : 0); ctx.globalAlpha = f; ctx.fillStyle = C.ivory; ctx.beginPath(); ctx.arc(0, 17, 40, 0, TAU); ctx.fill();
    ctx.globalAlpha = f * 0.6; ctx.strokeStyle = C.ivory; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const an = i * TAU / 8, r0 = 58 + 20 * (1 - f), r1 = r0 + 18; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, 17 + Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, 17 + Math.sin(an) * r1); ctx.stroke(); } }
  if (k === 2) { ctx.globalAlpha = eo(prog(h, 0, 0.3)); ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-18, -52); ctx.lineTo(30, -22); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill();
    const x = lerp(-30, 80, eio(prog(h, 0.1, 1.0))); ctx.globalAlpha = 1; ctx.fillStyle = C.ivory; ctx.beginPath(); ctx.arc(x, 76, 9, 0, TAU); ctx.fill(); ctx.fillStyle = C.gold; ctx.fillRect(-92, 72, x + 92, 8); }
  if (k === 3) { const a = back(prog(h, 0, 0.3), 2); ctx.strokeStyle = C.ivory; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
    for (const [x, y] of [[-96, 96], [96, 96]]) { ctx.strokeRect(x - 9 * a, y - 9 * a, 18 * a, 18 * a); }
    ctx.globalAlpha = eo(prog(h, 0.2, 0.5)); ctx.beginPath(); ctx.moveTo(-96, 96); ctx.lineTo(-40, 50); ctx.moveTo(96, 96); ctx.lineTo(40, 50); ctx.stroke();
    for (const [x, y] of [[-40, 50], [40, 50]]) { ctx.beginPath(); ctx.arc(x, y, 6 * a, 0, TAU); ctx.fillStyle = C.ivory; ctx.fill(); } }
  if (k === 4) { const p = eo(prog(h, 0, 0.6)); ctx.fillStyle = C.gold; ctx.globalAlpha = 0.85;
    ctx.fillRect(-58, 82 - 24 * p, 20, 24 * p); ctx.fillRect(26, 82 - 52 * p, 20, 52 * p);
    const pr = Math.exp(-((h * 1.4) % 1) * 3); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(74, -50, 8 + 4 * pr, 0, TAU); ctx.fillStyle = C.ivory; ctx.fill(); }
  ctx.restore();
}
// en-tête discret pendant les services
function header(t) {
  const a = prog(t, T.s4 - 0.15, T.s4 + 0.35), o = prog(t, T.s5 - 0.1, T.s5 + 0.3);
  if (a <= 0 || o >= 1) return;
  kLine('COSSI AGBOKOU', 175, 40, t, T.s4 - 0.15, { color: C.gold, ls: 6, t1: T.s5 - 0.1, stagger: 0.08 });
  kLine('COMMUNITY MANAGER', 222, 22, t, T.s4, { w: 600, ls: 9, t1: T.s5 - 0.1, alpha: 0.8 });
}

// ======================================================= SCÈNE 5 : la différence
const REEL = { x: 190, y: 330 };
const FEED = (i, t) => ({ x: 540, y: 640 + i * 236 - Math.max(0, t - (T.s5 + 1.5)) * 70, w: 660, h: 206 });
function frameArt(x, y, w, h, i, a) {
  // mini-visuel d'une image de pellicule / vignette de publication
  ctx.save(); ctx.globalAlpha *= a; rrect(x, y, w, h, Math.min(w, h) * 0.08); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, ['#1D3B70', '#2A2350', '#173D5E', '#3A2A3E', '#1C3460'][i % 5]); g.addColorStop(1, '#0D2046');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (i % 3 === 1) { ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(x + w * 0.42, y + h * 0.32); ctx.lineTo(x + w * 0.62, y + h * 0.5); ctx.lineTo(x + w * 0.42, y + h * 0.68); ctx.closePath(); ctx.fill(); }
  else {
    ctx.beginPath(); ctx.arc(x + w * (0.68 + (i % 2) * 0.1), y + h * 0.32, h * 0.13, 0, TAU); ctx.fillStyle = C.gold; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.3, y + h * 0.48); ctx.lineTo(x + w * 0.55, y + h * 0.78); ctx.lineTo(x + w * 0.72, y + h * 0.6); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fillStyle = '#0A1730'; ctx.fill();
  }
  ctx.restore();
}
function sceneDiff(t) {
  if (t < T.s5 + 0.2 || t > T.s6 + 0.9) return;
  const unroll = eio(prog(t, T.s5 + 0.35, T.s5 + 1.3));
  const conv = (i) => eio(prog(t, T.s5 + 1.15 + i * 0.07, T.s5 + 1.75 + i * 0.07));
  const exit = eio(prog(t, T.s6 - 0.05, T.s6 + 0.55));      // le fil se resserre dans le téléphone
  const fs = lerp(1, 0.56, exit), fcy = 800;
  // calque du fil (masqué en fondu haut / bas une fois devenu fil)
  l2.clearRect(0, 0, W, H);
  const g = l2;
  g.save();
  g.translate(W / 2, fcy); g.scale(fs, fs); g.translate(-W / 2, -fcy);
  // bande de pellicule
  const sA = 1 - prog(t, T.s5 + 1.2, T.s5 + 1.6);
  const len = unroll * 1000, sy = REEL.y - 75;
  if (sA > 0 && len > 1) {
    g.globalAlpha = sA;
    g.fillStyle = C.deep; g.fillRect(REEL.x, sy, len, 150);
    g.fillStyle = rgba(C.gold, 0.9); g.fillRect(REEL.x, sy, len, 3); g.fillRect(REEL.x, sy + 147, len, 3);
    g.fillStyle = rgba(C.ivory, 0.55);
    const off = (t * 220) % 34;
    for (let x = REEL.x + 8 - off; x < REEL.x + len - 14; x += 34) { if (x < REEL.x) continue; g.beginPath(); g.roundRect(x, sy + 11, 16, 12, 3); g.roundRect(x, sy + 127, 16, 12, 3); g.fill(); }
    g.globalAlpha = 1;
  }
  g.restore();
  // images -> vignettes de publications (on dessine sur ctx via l'échange de contexte)
  drawOn(l2, () => {
    ctx.save(); ctx.translate(W / 2, fcy); ctx.scale(fs, fs); ctx.translate(-W / 2, -fcy);
    for (let i = 0; i < 6; i++) {
      const A = { x: REEL.x + 150 + i * 176, y: REEL.y - 52, w: 150, h: 104 };
      if (A.x - REEL.x + 150 > len + 60 && conv(i) <= 0) continue;
      const c = conv(i), F = FEED(i, t);
      const cardA = c;   // apparition de la carte autour de la vignette
      const cx0 = F.x - F.w / 2, cy0 = F.y - F.h / 2;
      if (cardA > 0) {
        ctx.globalAlpha = cardA; shadow(40, 16, 0.45);
        rrect(lerp(A.x, cx0, c), lerp(A.y, cy0, c), lerp(A.w, F.w, c), lerp(A.h, F.h, c), 24 * c); ctx.fillStyle = C.card; ctx.fill(); noShadow();
        ctx.strokeStyle = rgba(C.gold, 0.35); ctx.lineWidth = 2; ctx.stroke();
        const ax = cx0 + 250, ay = cy0 + 44;
        ctx.beginPath(); ctx.arc(ax + 20, ay + 4, 20, 0, TAU); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke();
        bar(ax + 54, ay - 8, 150, 11, rgba(C.ivory, 0.7)); bar(ax + 54, ay + 12, 90, 9, rgba(C.ivory, 0.3));
        bar(ax, ay + 56, 340, 10, rgba(C.ivory, 0.32)); bar(ax, ay + 78, 260, 10, rgba(C.ivory, 0.22));
        ctx.save(); ctx.translate(ax + 14, ay + 128); heartPath(26); ctx.fillStyle = i === 1 ? C.red : C.gold; ctx.fill(); ctx.restore();
        bar(ax + 40, ay + 120, 70, 10, rgba(C.ivory, 0.4));
        ctx.save(); ctx.translate(cx0 + F.w - 46, cy0 + F.h - 46); socialIcon(i % 4, 48); ctx.restore(); ctx.globalAlpha = cardA;
        if (i === 1) { const p = back(prog(t, T.s5 + 2.3, T.s5 + 2.6), 2); if (p > 0) { ctx.beginPath(); ctx.arc(cx0 + F.w - 26, cy0 + 26, 13 * p, 0, TAU); ctx.fillStyle = C.red; ctx.fill(); } }
        ctx.globalAlpha = 1;
      }
      const T2 = { x: cx0 + 18, y: cy0 + 18, w: 210, h: F.h - 36 };
      frameArt(lerp(A.x, T2.x, c), lerp(A.y, T2.y, c), lerp(A.w, T2.w, c), lerp(A.h, T2.h, c), i, 1);
    }
    ctx.restore();
  });
  // masque de fondu (seulement une fois en mode fil)
  const ms = prog(t, T.s5 + 1.3, T.s5 + 1.9) * (1 - exit);
  if (ms > 0) {
    l2.save(); l2.globalCompositeOperation = 'destination-in';
    const mg = l2.createLinearGradient(0, 0, 0, H);
    const at = (v) => `rgba(0,0,0,${lerp(1, v, ms)})`;
    mg.addColorStop(0, at(0)); mg.addColorStop(440 / H, at(0)); mg.addColorStop(540 / H, at(1)); mg.addColorStop(960 / H, at(1)); mg.addColorStop(1040 / H, at(0)); mg.addColorStop(1, at(0));
    l2.fillStyle = mg; l2.fillRect(0, 0, W, H); l2.restore();
  }
  ctx.save(); ctx.globalAlpha = 1 - prog(t, T.s6 + 0.12, T.s6 + 0.4); ctx.drawImage(lay2, 0, 0); ctx.restore();

  // texte
  const t1 = T.s6 - 0.12;
  const sz = Math.min(74, fit('au service de vos réseaux.', 74, 930), fit('L’œil d’un professionnel', 74, 930));
  kLine('L’œil d’un professionnel', 1115, sz, t, T.s5 + 0.55, { t1 });
  kLine('de l’*audiovisuel*', 1115 + sz * 1.18, sz, t, T.s5 + 0.75, { t1 });
  kLine('au service de vos réseaux.', 1115 + sz * 2.36, sz, t, T.s5 + 0.95, { t1 });
  mapCT(t);
}
// exécuter des fonctions qui dessinent sur « ctx » dans un autre contexte (calque)
function drawOn(target, fn) { const keep = ctx; ctx = target; try { fn(); } finally { ctx = keep; } }

// carte stylisée Lomé ⇄ Cotonou
function mapCT(t) {
  const a0 = T.s5 + 1.5, out = eio(prog(t, T.s6 - 0.1, T.s6 + 0.35));
  if (t < a0) return;
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, out * 80);
  const coastY = (x) => 1560 + Math.sin(x * 0.006) * 14 + Math.sin(x * 0.017 + 1) * 6;
  const cp = eio(prog(t, a0, a0 + 0.6));
  // océan : lignes de houle
  ctx.strokeStyle = rgba(C.gold, 0.13); ctx.lineWidth = 2;
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); for (let x = 80; x <= 80 + 920 * cp; x += 20) ctx.lineTo(x, coastY(x) + 30 * k + Math.sin(x * 0.03 + t * 2 + k) * 4); ctx.stroke(); }
  // trait de côte
  ctx.strokeStyle = rgba(C.gold, 0.7); ctx.lineWidth = 3; ctx.beginPath();
  for (let x = 80; x <= 80 + 920 * cp; x += 10) ctx.lineTo(x, coastY(x)); ctx.stroke();
  // terre : trame de points textile
  ctx.fillStyle = rgba(C.gold, 0.12);
  for (let x = 100; x < 80 + 920 * cp; x += 36) for (let y = 1440; y < coastY(x) - 14; y += 36) ctx.fillRect(x + ((y / 36) % 2) * 18, y, 4, 4);
  const L = [320, coastY(320)], Cn = [770, coastY(770)];
  const cities = [[L, 'LOMÉ', 'TOGO', a0 + 0.35], [Cn, 'COTONOU', 'BÉNIN', a0 + 0.55]];
  for (const [p, n1, n2, tc] of cities) {
    const s = back(prog(t, tc, tc + 0.35), 2); if (s <= 0) continue;
    const ring = ((t - tc) % 1.2) / 1.2;
    ctx.strokeStyle = rgba(C.gold, 0.6 * (1 - ring)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], 14 + ring * 40, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(p[0], p[1], 12 * s, 0, TAU); ctx.fillStyle = C.gold; ctx.fill();
    ctx.beginPath(); ctx.arc(p[0], p[1], 5 * s, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
    ctx.globalAlpha = (1 - out) * clamp(s);
    ctx.textAlign = 'center'; ctx.fillStyle = C.ivory; ctx.font = font(34, 800); ctx.letterSpacing = '5px'; ctx.fillText(n1, p[0] + 2, p[1] + 68);
    ctx.fillStyle = C.gold; ctx.font = font(20, 700); ctx.fillText(n2, p[0] + 2, p[1] + 98); ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1 - out;
  }
  // arc doré qui relie les deux villes, avec deux impulsions en sens opposés (⇄)
  const ap = eio(prog(t, a0 + 0.6, a0 + 1.2));
  if (ap > 0) {
    const c = [(L[0] + Cn[0]) / 2, 1395], pts = quad(L, c, Cn, 60);
    const n = Math.max(2, Math.floor(ap * 60) + 1);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); pts.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke();
    if (ap >= 1) {
      for (const dir of [0, 1]) {
        const u = ((t - a0 - 1.2) * 0.7 + dir * 0.5) % 1, idx = Math.floor((dir ? 1 - u : u) * 60);
        const p = pts[idx]; ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, TAU); ctx.fillStyle = dir ? C.ivory : C.gold; ctx.fill();
      }
      // flèches aux deux extrémités
      ctx.fillStyle = C.gold;
      for (const [p, q] of [[pts[3], pts[0]], [pts[57], pts[60]]]) {
        const an = Math.atan2(q[1] - p[1], q[0] - p[0]);
        ctx.save(); ctx.translate(q[0] + Math.cos(an) * -22, q[1] + Math.sin(an) * -22); ctx.rotate(an);
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }
  ctx.restore();
}

// ======================================================= SCÈNE 6 : appel à l'action
const MONO = { x: 540, y: 560, r: 175 };
const PHONE_PTS = resample(rrPts(0, 0, PW, PH, PR), true, NB);
const MONO_PTS = resample(circ(0, 0, 1, 96), true, NB);
function sceneCTA(t) {
  if (t < T.s6 - 0.05) return;
  const pin = eio(prog(t, T.s6, T.s6 + 0.55));
  const morph = eio(prog(t, 52 * B, 52 * B + 0.6));      // téléphone -> monogramme
  const P = { x: 540, y: 800, s: 0.9 };
  if (morph < 1) {
    const ps = lerp(1.55, P.s, pin);
    ctx.save(); ctx.globalAlpha = pin * (1 - prog(morph, 0, 0.25));
    phone(P.x, P.y, ps, 1, () => {
      const cf = prog(t, T.s6 + 0.35, T.s6 + 0.6);
      if (cf < 1) { // le fil continue dans l'écran
        ctx.save(); ctx.globalAlpha *= 1 - cf; ctx.fillStyle = '#0A1730'; ctx.fillRect(0, 0, SW, SH);
        for (let i = 0; i < 4; i++) { const y = 70 + i * 230 - (t - T.s6) * 60; rrect(14, y, SW - 28, 200, 18); ctx.fillStyle = C.card; ctx.fill(); frameArt(28, y + 14, 150, 172, i, 1); bar(196, y + 40, 150, 10, rgba(C.ivory, 0.6)); bar(196, y + 64, 100, 9, rgba(C.ivory, 0.3)); }
        ctx.restore();
      }
      if (cf > 0) { ctx.save(); ctx.globalAlpha *= cf; screenCounter(t); ctx.restore(); }
    });
    ctx.restore();
  }
  if (morph > 0) {
    // contour du téléphone qui se transforme en cercle du monogramme
    const sP = P.s, pts = PHONE_PTS.map((p, i) => [lerp(P.x + p[0] * sP, MONO.x + MONO_PTS[i][0] * MONO.r, morph), lerp(P.y + p[1] * sP, MONO.y + MONO_PTS[i][1] * MONO.r, morph)]);
    ctx.save();
    shadow(60, 26, 0.5); pathPts(pts, true); ctx.fillStyle = morph < 0.3 ? '#0F2244' : C.card; ctx.fill(); noShadow();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.stroke();
    const ma = eo(prog(morph, 0.6, 1));
    if (ma > 0) monogram(t, ma);
    ctx.restore();
  }
  // textes et coordonnées
  const tx = 52 * B + 0.35;
  const sz = Math.min(104, fit('Faisons parler', 104, 930), fit('votre marque.', 104, 930));
  kLine('Faisons parler', 905, sz, t, tx);
  kLine('votre *marque.*', 905 + sz * 1.1, sz, t, tx + 0.15);
  contact(t, 1205, 'mail', 'Cossiagbokou@gmail.com', tx + 0.5);
  contact(t, 1285, 'tel', '+229 01 63 40 67 90', tx + 0.62);
  socialRow(t, 1395, tx + 0.55);
  button(t);
  kLine('COTONOU  ·  LOMÉ', 1760, 26, t, tx + 1.3, { w: 700, ls: 10, color: C.gold, alpha: 0.85 });
}
function monogram(t, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(MONO.x, MONO.y);
  ctx.beginPath(); ctx.arc(0, 0, MONO.r * 0.86, 0, TAU); ctx.strokeStyle = rgba(C.gold, 0.35); ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.rotate(t * 0.25); ctx.setLineDash([3, 14]); ctx.beginPath(); ctx.arc(0, 0, MONO.r * 1.16, 0, TAU); ctx.strokeStyle = rgba(C.gold, 0.5); ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  ctx.fillStyle = C.gold; diamond(0, -MONO.r * 1.16, 11 * a, true); diamond(0, MONO.r * 1.16, 11 * a, true);
  const s = lerp(0.7, 1, back(a, 1.6));
  ctx.scale(s, s);
  ctx.font = font(150, 800); ctx.letterSpacing = '-14px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.gold; ctx.fillText('CA', -6, 10);
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function contact(t, y, kind, text, t0) {
  const a = eo(prog(t, t0, t0 + 0.45));
  if (a <= 0) return;
  ctx.font = font(44, 600); const tw = ctx.measureText(text).width, x0 = W / 2 - (tw + 70) / 2;
  ctx.save(); ctx.globalAlpha = a; ctx.translate((1 - a) * -40, 0);
  ctx.strokeStyle = C.gold; ctx.fillStyle = C.gold; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
  const ix = x0 + 22, iy = y - 15;
  if (kind === 'mail') { rrect(ix - 22, iy - 15, 44, 32, 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ix - 20, iy - 12); ctx.lineTo(ix, iy + 4); ctx.lineTo(ix + 20, iy - 12); ctx.stroke(); }
  else { rrect(ix - 13, iy - 22, 26, 44, 7); ctx.stroke(); ctx.fillRect(ix - 5, iy + 13, 10, 3); }
  ctx.fillStyle = C.ivory; ctx.textAlign = 'left'; ctx.fillText(text, x0 + 70, y);
  ctx.restore();
}
function socialRow(t, y, t0) {
  for (let k = 0; k < 4; k++) {
    const tk = t0 + k * B / 4, a = back(prog(t, tk, tk + 0.4), 2);
    if (a <= 0) continue;
    const bt = (t / B + k * 0.25) % 1, bob = t > tk + 0.4 ? Math.exp(-bt * 7) * 0.05 : 0;
    ctx.save(); ctx.translate(540 + (k - 1.5) * 140, y); ctx.scale(a * (1 + bob), a * (1 + bob));
    socialIcon(k, 92); ctx.restore();
  }
}
function button(t) {
  const t0 = 54 * B - 0.25;
  const a = back(prog(t, t0, t0 + 0.5), 1.8);
  if (a <= 0) return;
  const bw = 620, bh = 140, cx = 540, cy = 1565;
  // pulsation sur chaque temps
  const beat = (t / B) % 1, pulse = t > t0 + 0.5 ? Math.exp(-beat * 6) * 0.045 : 0;
  const press = t > CLICK ? Math.sin(Math.PI * prog(t, CLICK, CLICK + 0.18)) * -0.07 : 0;
  const s = a * (1 + pulse + press);
  // anneaux qui se propagent tous les deux temps
  if (t > t0 + 0.5) for (let k = 0; k < 2; k++) {
    const ph = (((t - t0) / (2 * B)) + k * 0.5) % 1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + ph * 0.25, 1 + ph * 0.6);
    rrect(-bw / 2, -bh / 2, bw, bh, bh / 2); ctx.strokeStyle = rgba(C.red, 0.55 * (1 - ph)); ctx.lineWidth = 4 / (1 + ph * 0.4); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  shadow(44, 20, 0.5);
  rrect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2); g.addColorStop(0, '#CF4535'); g.addColorStop(1, '#AE3022');
  ctx.fillStyle = g; ctx.fill(); noShadow();
  // onde du clic
  if (t > CLICK) {
    const r = prog(t, CLICK, CLICK + 0.6);
    ctx.save(); rrect(-bw / 2, -bh / 2, bw, bh, bh / 2); ctx.clip();
    ctx.beginPath(); ctx.arc(60, 10, 40 + r * 420, 0, TAU); ctx.fillStyle = rgba(C.ivory, 0.35 * (1 - r)); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = C.ivory; ctx.font = font(54, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Contactez-moi', -18, 3);
  // flèche
  ctx.strokeStyle = C.ivory; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(214, 3); ctx.lineTo(244, 3); ctx.moveTo(232, -10); ctx.lineTo(246, 3); ctx.lineTo(232, 16); ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ======================================================= assemblage
function sceneHook(t) {
  if (t > T.s3 + 0.1) return;
  // téléphone : apparaît (rebond), recule en scène 2, sort avant la révélation
  const ap = back(prog(t, 0.0, 0.6), 1.5);
  const m = eio(prog(t, T.s2, T.s2 + 0.65));
  const ex = ei(prog(t, 13 * B, T.s3));
  const x = 540, y = lerp(lerp(760, 650, m), 420, ex), s = lerp(0.95, 0.8, m) * ap * lerp(1, 0.75, ex);
  const ph = 1 - prog(t, T.s2 + 0.05, T.s2 + 0.45);
  phone(x, y, s, 1 - ex, () => {
    if (ph > 0) { ctx.save(); ctx.globalAlpha *= ph; screenPost(t); ctx.restore(); }
    if (ph < 1) { ctx.save(); ctx.globalAlpha *= 1 - ph; screenEmpty(t); ctx.restore(); }
  });
  burstParticles(t);
  burstItems(t);
  // textes
  const sz1 = Math.min(98, fit('Votre marque', 98, 920), fit('mérite d’être vue.', 98, 920));
  kLine('Votre marque', 1430, sz1, t, 1.0, { t1: T.s2 - 0.18 });
  kLine('mérite d’être *vue.*', 1430 + sz1 * 1.12, sz1, t, 1.18, { t1: T.s2 - 0.14 });
  chartCard(t);
  const sz2 = Math.min(112, fit('ne suffit plus.', 112, 920));
  kLine('Publier', 1500, sz2, t, T.s2 + 0.35, { t1: 13 * B });
  kLine('ne suffit plus.', 1500 + sz2 * 1.1, sz2, t, T.s2 + 0.5, { t1: 13 * B + 0.05 });
}

function draw(t) {
  const NM = nameLayout();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; noShadow(); ctx.setLineDash([]);
  // illumination des motifs pendant la révélation du nom
  const gr = eo(prog(t, NM.lines[1].tw[1] - 0.3, NM.lines[1].tw[1] + 1.4));
  const ga = (0.12 * gr) * (1 - prog(t, T.s4 - 0.3, T.s4 + 0.4));
  background(t, { a: ga, r: lerp(50, 1350, gr), y: (NM.y1 + NM.titleY) / 2 });
  // assombrissement / désaturation légère pendant « le problème »
  const dim = prog(t, T.s2, T.s2 + 0.4) * (1 - prog(t, T.s3 - 0.05, T.s3 + 0.1));
  if (dim > 0) { ctx.fillStyle = `rgba(6,12,24,${0.35 * dim})`; ctx.fillRect(0, 0, W, H); }
  sceneHook(t);
  flatLine(t, NM);
  sceneName(t);
  header(t);
  sceneServices(t);
  sceneDiff(t);
  sceneCTA(t);
  // flash très bref (non éblouissant) sur le drop
  const fl = Math.exp(-Math.max(0, t - T.s3) * 10) * (t >= T.s3 ? 1 : 0);
  if (fl > 0.01) { ctx.fillStyle = rgba(C.gold, 0.12 * fl); ctx.fillRect(0, 0, W, H); }
  vignette();
  film(t);
}

window.draw = draw;
window.capture = (frame, q = 0.95) => { draw(frame / FPS); return cv.toDataURL('image/jpeg', q); };
window.FPS = FPS; window.DUR = DUR;
(async () => {
  await Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px Montserrat`, 'AÉœ’')));
  await document.fonts.ready;
  window.ready = true;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) draw(+q.get('t'));
  else if (q.has('play')) { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
  else draw(1.8);
})();
