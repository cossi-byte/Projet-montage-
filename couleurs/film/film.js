// « La chanson des couleurs » — mise en scène. Tout est une fonction pure du temps :
// renderFrame(n) dessine l'image n. Les plans s'enchaînent par fondus (jamais de coupe sèche).
import * as THREE from 'three';
import { makeKid, makeProp, lerp, clamp, ss, hop, pop } from './kids.js';
import { buildWorld, CLASS_X } from './world.js';

const q = new URLSearchParams(location.search);
const WIDTH = +(q.get('w') || 1920), HEIGHT = Math.round(WIDTH * 9 / 16), FPS = 24, DUR = 180;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT, false); renderer.autoClear = false;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 400);
const W = buildWorld(scene);
const song = await (await fetch('../song.json')).json(), audio = await (await fetch('./audio.json')).json();
await document.fonts.load('700 100px Fredoka');
const B = 60 / song.bpm, BAR = 4 * B, TAU = Math.PI * 2, R90 = Math.PI / 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- les quatre enfants
// Tenues volontairement roses, turquoise, blanches et beiges : aucune des six couleurs de la chanson.
const kids = [
  makeKid(scene, { skin: 0x8b5636, style: 'puffs', top: 0xff7eb6, bottom: 0xff7eb6, dress: true, accent: 0xffffff, shoes: 0xffffff, h: 1.0 }),
  makeKid(scene, { skin: 0x6e4328, style: 'short', top: 0x19c3c9, bottom: 0xc9a074, shoes: 0xffffff, h: 1.04 }),
  makeKid(scene, { skin: 0x7c4b2c, style: 'braids', top: 0xfff6e0, bottom: 0xfff6e0, dress: true, band: 0xff7eb6, accent: 0xff7eb6, shoes: 0xff7eb6, h: 0.97 }),
  makeKid(scene, { skin: 0x9a643f, style: 'afro', top: 0xffffff, bottom: 0x5d6470, band: 0x19c3c9, shoes: 0x19c3c9, h: 1.02 }),
];
const LX = [-2.4, -0.8, 0.8, 2.4];
const HEX = (n) => parseInt(song.colors[n].hex.slice(1), 16);
const NAMES = ['rouge', 'bleu', 'jaune', 'vert', 'orange', 'violet'];
const VERSES = song.form.filter((s) => s.kind === 'verse').map((s, i) => ({
  name: s.color, hex: HEX(s.color), bar: s.bar, t0: s.bar * BAR, lead: [0, 1, 2, 3, 1, 2][i], loc: [0, 0, 1, 1, 0, 0][i] ? 'class' : 'yard',
  kind: ['ball', 'kite', 'banana', 'pencil', 'orange', 'flower'][i],
  extras: [['flower', 'pencil', 'apple'], ['ball', 'pencil', 'flower'], ['flower', 'ball', 'pencil'], ['apple', 'ball', 'kite'], ['ball', 'flower', 'pencil'], ['ball', 'grapes', 'pencil']][i],
}));
for (const v of VERSES) { v.prop = makeProp(scene, v.kind, v.hex); v.xp = v.extras.map((k) => makeProp(scene, k, v.hex)); v.ox = v.loc === 'class' ? CLASS_X : 0; }
const allProps = VERSES.flatMap((v) => [v.prop, ...v.xp]);
const REFRAINS = song.form.filter((s) => s.kind === 'refrain').map((s, i) => ({ t0: s.bar * BAR, loc: VERSES[i].loc, ox: VERSES[i].ox, n: i }));
const TF = song.form.find((s) => s.kind === 'final').bar * BAR;

// petits effets : halo et étoiles
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 10 : 62; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill(); return new THREE.CanvasTexture(c); })();
const sprites = [...Array(14)].map((_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i ? starTex : glowTex, transparent: true, depthWrite: false })); scene.add(s); return s; });
function glow(p, size, color, alpha = 0.8) { const s = sprites[0]; s.visible = true; s.position.copy(p); s.scale.setScalar(size); s.material.color.set(color); s.material.opacity = alpha; }
function stars(p, t, color, n = 8, rad = 0.8) { for (let i = 1; i <= n; i++) { const s = sprites[i], a = i * 2.4 + t * 0.6, tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
  s.visible = true; s.position.set(p.x + Math.cos(a) * rad * (0.7 + 0.3 * Math.sin(i * 5)), p.y + Math.sin(a) * rad * 0.8, p.z + 0.1); s.scale.setScalar(0.1 + 0.2 * tw); s.material.color.set(color); s.material.opacity = 0.95; } }

// ---------------------------------------------------------------- le temps et le rythme
let T = 0, frame = 0;
const lip = () => audio.choir[frame] || 0;
const blinkAt = (i) => ((T + i * 1.37) % 3.4 < 0.13 ? 1 : 0);
const bnc = (ph = 0) => hop((((T / B + ph) % 1) + 1) % 1);        // rebond sur chaque temps (110 BPM)
const sway = () => Math.sin(T / B * Math.PI);                      // balancement sur deux temps
const clapC = () => { let c = 0; for (const tc of audio.claps) { const dt = T - tc; if (dt > -0.3 && dt < 0.3) c = Math.max(c, ss(-0.2, -0.03, dt) * (1 - ss(0.07, 0.26, dt))); } return c; };
function cam(px, py, pz, tx, ty, tz, fov = 35) { camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); camera.fov = fov; camera.updateProjectionMatrix(); W.focus(tx, 0, Math.min(tz, 1)); }
const kid = (i, p) => kids[i].set({ blink: blinkAt(i), mouth: clamp(lip() * (0.85 + 0.15 * Math.sin(T * 9 + i * 2))), swing: sway(), ...p });
// le bras i de l'enfant k vise un point (après une première pose)
function reach(k, hand, target, p) { kid(k, p); const a = kids[k].aim(hand, target); kid(k, { ...p, [hand ? 'aR' : 'aL']: a }); }

// poses de danse
const groove = (i, a = 1) => ({ y: bnc() * 0.13 * a, rz: sway() * 0.06 * a, aL: [0.45 + 0.35 * sway(), 0.5], aR: [0.45 - 0.35 * sway(), 0.5], headTilt: sway() * 0.1, lL: Math.max(0, sway()) * 0.25, lR: Math.max(0, -sway()) * 0.25 });
const clapping = () => { const c = clapC(); return { y: bnc() * 0.12, rz: sway() * 0.05, aL: [1.25, lerp(0.3, -0.5, c)], aR: [1.25, lerp(0.3, -0.5, c)], headTilt: sway() * 0.1 }; };
const armsUp = (i, w = 0.3) => ({ aL: [0.1, 2.3 + w * Math.sin(T * 9 + i)], aR: [0.1, 2.3 - w * Math.sin(T * 9 + i)] });
const OFF = { ball: [0.05, 0.42, 0.05], apple: [0.03, 0.34, 0.05], orange: [0.03, 0.35, 0.05], grapes: [0.02, 0.42, 0.05], banana: [0, 0.22, 0.05], pencil: [0.02, 0.5, 0.04], flower: [0, -0.2, 0.08], kite: [0.25, 0.85, 0.05] };
// tient un objet au bout de la main (l'objet reste droit)
function hold(prop, k, hand = 0, s = 1, extra = {}) { const h = kids[k].hand(hand), o = OFF[prop.kind], sx = hand ? -1 : 1; prop.set({ x: h.x + o[0] * sx * s, y: h.y + o[1] * s, z: h.z + o[2], s, ...extra }); }
const RAISE = [0.35, 1.95];

// ---------------------------------------------------------------- les plans
const shots = [];
const S = (a, b, loc, fn) => shots.push([a, b, loc, fn]);

// ===== INTRO : les enfants arrivent en dansant, le titre apparaît =====
const ARR = 3.7 * BAR, entry = () => 14 * (1 - ss(0.2, ARR, T));
function arriving() {
  const gx = entry(), turn = ss(ARR - 1.0, ARR - 0.1, T), mv = 1 - ss(ARR - 0.6, ARR, T);
  for (let i = 0; i < 4; i++) {
    const c = clapC(), p = { x: LX[i] + gx, y: bnc(i * 0.5) * 0.3 * mv + bnc() * 0.13 * (1 - mv), z: 0.4 + Math.sin(i * 2.1) * 0.3 * mv, ry: lerp(-R90, 0, turn), headYaw: lerp(0.75, 0, turn), headTilt: sway() * 0.1,
      lL: Math.sin(T / B * Math.PI + i) * 0.7 * mv, lR: -Math.sin(T / B * Math.PI + i) * 0.7 * mv,
      aL: [lerp(0.2, 1.25, c), lerp(1.6 + 0.5 * Math.sin(T / B * TAU + i), -0.5, c)], aR: [lerp(0.2, 1.25, c), lerp(1.6 - 0.5 * Math.sin(T / B * TAU + i), -0.5, c)], mouth: 0.35 + 0.2 * Math.sin(T * 5 + i) };
    kid(i, p);
  }
  return gx;
}
S(0, 2 * BAR, 'yard', (u, d) => { arriving(); const k = u / d; cam(3, lerp(8.5, 5, k), lerp(25, 19, k), 3, lerp(3.2, 2.2, k), -4, 38); });
S(2 * BAR, 4 * BAR, 'yard', (u, d) => { const gx = arriving(), k = u / d; cam(gx + lerp(2.5, 0, k), 1.9, lerp(8.2, 9.5, k), gx * 0.9, 1.6, 0, 34); });
S(4 * BAR, 7 * BAR, 'yard', (u, d) => {
  const k = u / d, ub = (T - 5 * BAR) / B, cnt = (T - 6 * BAR) / B;
  for (let i = 0; i < 4; i++) {
    const wave = ss(0, 0.5, ub) * (1 - ss(3.5, 4, ub)), j = hop(cnt - i) * (cnt >= 0 ? 1 : 0);
    kid(i, { ...groove(i), x: LX[i], z: 0.4, y: bnc() * 0.13 + j * 0.75, ...(wave > 0.5 ? { aL: [0.2, 2.2 + 0.35 * Math.sin(T * 10 + i)] } : {}), ...(j > 0.05 ? armsUp(i, 0.1) : {}), eye: 1 + j * 0.15 });
  }
  cam(0, 2.35, lerp(11.8, 10.4, k), 0, 2.45, 0, 36);
});

// ===== COUPLETS =====
function backRow(v, others) { others.forEach((i, n) => kid(i, { ...groove(i, 0.8), x: v.ox + [-2.3, 0, 2.3][n] * 1.05, z: -0.9, ry: [0.35, 0, -0.35][n], headYaw: [0.2, 0, -0.2][n], look: [[0.5, -0.2], [0, -0.3], [-0.5, -0.2]][n] })); }
function present(v, x, z, lift = 0) {   // l'enfant vedette montre son objet à la caméra
  const L = v.lead, up = bnc() * 0.12;
  if (v.kind === 'ball' || v.kind === 'orange') {
    kid(L, { x, y: up, z, aL: [0.95 + lift * 0.25, -0.3], aR: [0.95 + lift * 0.25, -0.3], headTilt: sway() * 0.08, eye: 1.08 });
    const a = kids[L].hand(0), b = kids[L].hand(1), r = v.kind === 'ball' ? 0.3 : 0.24; v.prop.set({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + r * 0.2, z: a.z + r * 0.8, ry: T * 0.8 });
  } else {
    kid(L, { x, y: up, z, aL: [RAISE[0], RAISE[1] + lift * 0.3], aR: [0.2, 0.9], headTilt: 0.08 + sway() * 0.06, headYaw: 0.12, look: [0.5, 0.3], eye: 1.08 });
    hold(v.prop, L, 0, v.kind === 'kite' ? 0.8 : 1.25, { rz: sway() * 0.08, wave: T * 5 });
  }
}
function action(v, u, d) {   // gros plan : ce que fait l'objet
  const L = v.lead, ox = v.ox, k = u / d;
  if (v.kind === 'ball') {      // « il saute, il bouge »
    const ph = (((T / B) % 1) + 1) % 1, by = 0.3 + 1.25 * hop(ph), bx = ox + 0.75 + Math.sin(T / B * Math.PI * 0.5) * 0.25;
    v.prop.set({ x: bx, y: by, z: 1.9, ry: T * 3, rz: T * 2, s: 1 }); v.prop.root.scale.set(1 + 0.2 * (1 - hop(Math.min(1, ph * 4))) * (ph < 0.25 ? 1 : 0), 1 - 0.25 * (ph < 0.12 ? 1 - ph / 0.12 : 0), 1);
    kid(L, { x: ox - 0.35, y: bnc() * 0.16, z: 1.6, ry: 0.35, aL: [0.9 + 0.5 * hop(ph), 0.5], aR: [0.3, 0.8], headYaw: 0.25, headPitch: -0.1 + 0.25 * hop(ph), look: [0.6, hop(ph) - 0.5], eye: 1.1 });
    cam(ox + lerp(0.9, 0.3, k), 1.5, lerp(7.2, 6.2, k), ox + 0.2, 1.3, 1.6, 32);
  } else if (v.kind === 'kite') {   // « il vole dans les cieux »
    const kp = V3(ox + 1.7 + Math.sin(T * 0.9) * 0.6, 4.7 + Math.sin(T * 1.7) * 0.3, 0.2);
    reach(L, 0, kp, { x: ox - 1.4, y: bnc() * 0.08, z: 1.6, ry: 0.3, headPitch: 0.22, headYaw: 0.25, look: [0.6, 0.9], aR: [0.3, 1.4 + 0.2 * Math.sin(T * 4)], eye: 1.12 });
    v.prop.set({ x: kp.x, y: kp.y, z: kp.z, s: 1.9, rz: -0.35 + Math.sin(T * 1.3) * 0.18, wave: T * 6, to: kids[L].hand(0) });
    cam(ox + lerp(-2.6, -2.0, k), 1.0, 7.4, ox + 0.2, lerp(2.9, 3.2, k), 0, 42);
  } else if (v.kind === 'banana') {   // « comme le soleil, elle brille »
    kid(L, { x: ox, y: bnc() * 0.08, z: 1.6, aL: [0.5, 2.0], aR: [0.2, 0.9], headYaw: 0.3, headTilt: 0.1, look: [0.8, 0.5], eye: 1.15 });
    hold(v.prop, L, 0, 1.45, { rz: sway() * 0.1 });
    const p = v.prop.root.position.clone().add(V3(0, 0.1, -0.2)); glow(p, 2.6 + 0.5 * Math.sin(T * 4), 0xfff08a, 0.75 * ss(0.2, 1.2, u)); stars(p, T, 0xffffff, 8, 0.9);
    cam(ox + lerp(0.1, 0.5, k), 1.75, lerp(5.6, 4.8, k), ox + 0.35, 1.7, 1.6, 30);
  } else if (v.kind === 'pencil') {   // « je dessine un pré »
    const pr = clamp(u / (d - 0.4)); W.drawing(pr);
    const pen = W.penAt(pr).add(V3(Math.sin(T * 14) * 0.05, Math.cos(T * 11) * 0.05, 0)), dir = V3(-0.6, 0.3, 0.74).normalize(), S_ = 1.5;
    v.prop.set({ x: pen.x + dir.x * 0.57 * S_, y: pen.y + dir.y * 0.57 * S_, z: pen.z + dir.z * 0.57 * S_, s: S_ }); v.prop.root.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
    reach(L, 0, pen.clone().addScaledVector(dir, 0.85), { x: ox + 1.75, y: bnc() * 0.05, z: 0.75, ry: 0.85, headYaw: -0.5, headTilt: 0.06, look: [-0.2, 0.2], aR: [0.2, 0.6], eye: 1.05 });
    cam(ox + lerp(2.6, 3.0, k), 2.0, lerp(6.4, 5.7, k), ox + 3.1, 1.9, -0.6, 30);
  } else if (v.kind === 'orange') {   // « je la mange, miam, miam »
    const eat = ss(0.3, 1.2, u) * (1 - ss(d - 1.3, d - 0.7, u)), mm = ss(d - 2.2, d - 1.7, u);
    kid(L, { x: ox, y: bnc() * 0.07, z: 1.6, headTilt: 0.1 + sway() * 0.08, headYaw: 0.2, blink: eat > 0.8 ? 1 : 0, aL: [0.5, 2.0], aR: [0.75, -0.4 + 0.14 * Math.sin(T * 12) * mm], eye: 1.05, mouth: Math.max(lip(), 0.5 * eat) });
    hold(v.prop, L, 0, 1.35, { ry: T });
    stars(v.prop.root.position.clone().add(V3(0, 0.1, 0.2)), T, 0xffffff, 6, 0.6);
    cam(ox + lerp(-0.4, 0.2, k), 1.7, lerp(5.6, 4.8, k), ox, 1.55, 1.6, 30);
  } else {   // la fleur : « elle sent bon »
    const sm = ss(0.4, 1.4, u) * (1 - ss(d - 1.0, d - 0.4, u)), P0 = { x: ox, z: 1.6 };
    kid(L, P0); const hp = kids[L].headPos();
    const fp = V3(hp.x + lerp(0.95, 0.72, sm), hp.y - lerp(1.05, 0.98, sm), hp.z + lerp(0.4, 0.5, sm));
    reach(L, 0, fp.clone().add(V3(0, 0.3, 0)), { ...P0, y: bnc() * 0.06, headTilt: -0.16 * sm + sway() * 0.05, headYaw: 0.3 * sm, blink: sm > 0.75 ? 1 : 0, aR: [0.2, 0.7], eye: 1.05 });
    v.prop.set({ x: fp.x, y: fp.y, z: fp.z, s: 1.0, rz: 0.2 * sm + sway() * 0.05 });
    stars(V3(fp.x - 0.1, fp.y + 0.8, fp.z), T, 0xffffff, 6, 0.5);
    cam(ox + lerp(0.7, 0.3, k), 1.7, lerp(5.8, 5.0, k), ox + 0.15, 1.5, 1.6, 30);
  }
}
for (const v of VERSES) {
  const others = [0, 1, 2, 3].filter((i) => i !== v.lead), t0 = v.t0, ox = v.ox;
  // 1) plan moyen : l'enfant vedette montre l'objet, les amis chantent derrière
  S(t0, t0 + 2 * BAR, v.loc, (u, d) => {
    const k = u / d, lift = hop((u / B) % 1) * (u < 3 * B ? 1 : 0.3);
    backRow(v, others); present(v, ox, 1.5, lift);
    if (v.kind === 'pencil') W.drawing(0);
    cam(ox + lerp(-0.7, 0.4, k), 2.0, lerp(9.4, 7.6, k), ox + 0.15, 1.6, 0.7, 34);
  });
  // 2) gros plan : l'objet en action
  S(t0 + 2 * BAR, t0 + 4 * BAR, v.loc, (u, d) => { backRow(v, others); action(v, u, d); });
  // 3) travelling : les trois amis montrent chacun autre chose de la même couleur
  S(t0 + 4 * BAR, t0 + 6 * BAR, v.loc, (u, d) => {
    const k = u / d, nod = Math.sin((u - 4 * B) / B * Math.PI) * 0.18 * ss(4 * B, 4.3 * B, u);
    others.forEach((i, n) => {
      const age = u - n * B * 0.5 - 0.15, a = pop(age, 0.4);
      kid(i, { x: ox + (n - 1) * 1.75, y: bnc(n * 0.5) * 0.14, z: 1.0, aL: [RAISE[0], lerp(0.3, RAISE[1], ss(-0.3, 0.2, age)) + 0.1 * bnc()], aR: [0.2, 0.7], headPitch: -nod, headTilt: sway() * 0.08, headYaw: 0.1, look: [0.4, 0.2], eye: 1.06 });
      if (a > 0) hold(v.xp[n], i, 0, (v.xp[n].kind === 'kite' ? 0.62 : 1.15) * a, { rz: sway() * 0.1, wave: T * 5 });
    });
    present(v, ox + 3.6, 1.0); if (v.kind === 'pencil') W.drawing(1);
    const x = ox + lerp(-1.75, 1.75, ss(-0.1, 1.1, k)); cam(x + 0.5, 1.8, 5.6, x + 0.25, 1.6, 0.9, 32);
  });
  // 4) plan large : tout le monde saute en criant le nom de la couleur
  S(t0 + 6 * BAR, t0 + 7 * BAR, v.loc, (u, d) => {
    const k = u / d, j = hop(u / (2 * B)), c = clapC();
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const p = { x: ox + LX[i], y: j * 0.9 + bnc() * 0.1 * (u > 2 * B ? 1 : 0), z: 0.6, eye: 1.1 + 0.1 * j, mouth: Math.max(lip(), u < 2 * B ? 0.8 : 0) };
      if (i === v.lead) { present(v, ox + LX[i], 0.6, j); kid(i, { ...p, ...(v.kind === 'ball' || v.kind === 'orange' ? { aL: [0.95 + j * 0.3, -0.3], aR: [0.95 + j * 0.3, -0.3] } : { aL: [RAISE[0], RAISE[1] + 0.3 * j], aR: [0.2, 0.9 + j] }) }); if (v.kind === 'ball' || v.kind === 'orange') { const a = kids[i].hand(0), b = kids[i].hand(1); v.prop.set({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.06, z: a.z + 0.24 }); } else hold(v.prop, i, 0, v.kind === 'kite' ? 0.8 : 1.25, { wave: T * 5 }); }
      else { kid(i, { ...p, aL: [RAISE[0], RAISE[1] + 0.3 * j + 0.25 * c], aR: [0.2, 0.9 + j * 1.2 + c * 0.8] }); hold(v.xp[n], i, 0, v.xp[n].kind === 'kite' ? 0.62 : 1.15, { wave: T * 5 }); n++; }
    }
    if (v.kind === 'pencil') W.drawing(1);
    cam(ox, 2.2, lerp(10.2, 9.5, k), ox, 2.55, 0, 36);
  });
}

// ===== REFRAINS : on danse et on tape des mains =====
function refrainDance(r, u) {
  const bar = u / BAR, pair = ss(1.9, 2.1, bar) * (1 - ss(2.9, 3.05, bar)), tw = ss(3.0, 3.75, bar), up = ss(3.05, 3.2, bar);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? -1 : 1;
    kid(i, { ...clapping(), x: r.ox + LX[i] + sway() * 0.22 * (1 - pair), z: 0.5, ry: side * 0.75 * pair + tw * TAU * side, y: bnc() * 0.14 + hop((bar - 3.5) * 2) * 0.5,
      ...(up > 0.5 && clapC() < 0.3 ? armsUp(i) : {}), headYaw: -side * 0.35 * pair, lL: Math.max(0, sway()) * 0.3, lR: Math.max(0, -sway()) * 0.3 });
  }
}
for (const r of REFRAINS) {
  S(r.t0, r.t0 + 2 * BAR, r.loc, (u, d) => { refrainDance(r, u); const k = u / d, a = lerp(-0.22, 0.22, k) * (r.n % 2 ? -1 : 1); cam(r.ox + Math.sin(a) * 11, 2.4, Math.cos(a) * 11, r.ox, 1.75, 0.2, 36); });
  S(r.t0 + 2 * BAR, r.t0 + 4 * BAR, r.loc, (u, d) => {
    refrainDance(r, u + 2 * BAR); const k = u / d, m = r.n % 3;
    if (m === 0) { const x = r.ox + lerp(-2.5, 2.5, k); cam(x * 1 + 0.3, 1.8, 5.0, x, 1.7, 0.5, 30); }
    else if (m === 1) cam(r.ox + lerp(-4.8, -3.6, k), 1.15, 6.4, r.ox + 0.3, 1.85, 0.3, 36);
    else cam(r.ox + lerp(3.6, 2.4, k), lerp(5.6, 4.2, k), 9.6, r.ox, 1.4, 0.2, 36);
  });
}

// ===== FINAL : l'arc-en-ciel, le récapitulatif, le salut =====
const WORD_T = [0, 1, 2, 4, 5, 6].map((b) => b * B);                 // rouge bleu jaune | vert orange violet
const bowP = () => ss(TF, TF + 2 * BAR, T);
function recapObjects() {      // les six objets s'allument au-dessus des enfants (2e récapitulatif)
  VERSES.forEach((v, i) => {
    const age = T - (TF + 4 * BAR + WORD_T[i]), out = 1 - ss(TF + 8 * BAR - 0.4, TF + 8 * BAR, T), a = pop(age, 0.4) * out;
    if (a <= 0.01) return;
    const s = { ball: 1, kite: 0.6, banana: 1.3, pencil: 1.1, orange: 1.15, flower: 1.0 }[v.kind];
    v.prop.set({ x: (i - 2.5) * 1.25, y: 3.75 + Math.sin(T * 2.2 + i) * 0.14 + (v.kind === 'flower' ? -0.6 : 0) + (v.kind === 'kite' ? 0.25 : 0), z: 0.5, s: s * a, rz: Math.sin(T * 1.6 + i) * 0.15, wave: T * 5 });
  });
}
function finalKids(mode, u) {
  for (let i = 0; i < 4; i++) {
    let p = { ...groove(i), x: LX[i], z: 0.5 };
    if (mode === 'words') { let j = 0; WORD_T.forEach((t, w) => { if (w % 4 === i) j = Math.max(j, hop((u - t) / B)); }); p = { ...p, y: p.y + j * 0.6, ...(j > 0.05 ? armsUp(i, 0.1) : {}) }; }
    if (mode === 'look') p = { ...p, ry: Math.PI - 0.55 + i * 0.12, headPitch: 0.4, headYaw: -0.25, aR: [2.3, 0.35 + 0.08 * Math.sin(T * 6 + i)], aL: [0.2, 0.6], look: [0, 0.6] };
    if (mode === 'recap') { let j = 0; WORD_T.forEach((t) => { j = Math.max(j, hop((T - TF - 4 * BAR - t) / B)); }); p = { ...p, headPitch: 0.3, look: [0, 0.8], y: p.y + j * 0.25, ...armsUp(i, 0.15), eye: 1.1 }; }
    if (mode === 'dance') { const bar = u / BAR; p = { ...p, ...clapping(), ry: ss(1.0, 1.8, bar) * TAU * (i % 2 ? -1 : 1), ...(clapC() < 0.2 && bar > 1 ? armsUp(i) : {}) }; }
    if (mode === 'bravo') { const fast = 0.5 + 0.5 * Math.sin(T / B * TAU * 2), c = u < 4 * B ? fast : clapC(); p = { ...p, y: bnc() * 0.12, aL: [1.25, lerp(0.3, -0.5, c)], aR: [1.25, lerp(0.3, -0.5, c)], eye: 1.08 }; }
    if (mode === 'bye') {
      const ub = (T - TF - 11 * BAR) / B, bow = ss(0.2, 1.1, ub) * (1 - ss(3.0, 4.0, ub)), wv = 1 - bow;
      p = { x: LX[i], z: 0.5, y: bnc() * 0.1 * wv, bow: bow * 0.95, headTilt: sway() * 0.08 * wv, blink: bow > 0.6 ? 1 : blinkAt(i),
        aL: [0.1, lerp(0.3, 2.25 + 0.4 * Math.sin(T * 9 + i), wv)], aR: [0.1, lerp(0.3, ub > 4 ? 2.25 - 0.4 * Math.sin(T * 9 + i) : 0.5, wv)], mouth: Math.max(lip(), 0.25 * wv) };
    }
    kid(i, p);
  }
}
const conf = () => W.confetti(0, T, ss(TF + 6 * BAR - 0.3, TF + 7 * BAR, T));
S(TF, TF + 2 * BAR, 'yard', (u, d) => { W.rainbow(bowP()); finalKids('words', u); const k = u / d; cam(0, 1.7, lerp(12.6, 11.6, k), 0, 3.9, 0, 42); });
S(TF + 2 * BAR, TF + 4 * BAR, 'yard', (u, d) => { W.rainbow(1); finalKids('look', u); const k = u / d; cam(lerp(-4.8, -3.6, k), 1.4, 7.6, 2, lerp(4.2, 4.8, k), -8, 42); });
S(TF + 4 * BAR, TF + 6 * BAR, 'yard', (u, d) => { W.rainbow(1); finalKids('recap', u); recapObjects(); const k = u / d; cam(lerp(-0.8, 0.8, k), 2.2, 9.2, lerp(-0.4, 0.4, k), 2.75, 0, 36); });
S(TF + 6 * BAR, TF + 8 * BAR, 'yard', (u, d) => { W.rainbow(1); conf(); finalKids('dance', u); recapObjects(); const k = u / d, a = lerp(-0.45, 0.45, k); cam(Math.sin(a) * 12.5, lerp(2.4, 3.4, k), Math.cos(a) * 12.5, 0, 2.6, 0, 40); });
S(TF + 8 * BAR, TF + 10 * BAR, 'yard', (u, d) => { W.rainbow(1); conf(); finalKids('bravo', u); const k = u / d, x = lerp(-2.4, 2.4, k); cam(x + 0.3, 1.8, 5.2, x, 1.7, 0.5, 30); });
S(TF + 10 * BAR, DUR + 0.5, 'yard', (u, d) => { W.rainbow(1); conf(); finalKids('bye', u); const k = ss(0, d, u); cam(0, lerp(2.0, 2.6, k), lerp(9.6, 13.2, k), 0, lerp(2.1, 3.9, k), 0, 40); });
shots.sort((a, b) => a[0] - b[0]);

// ---------------------------------------------------------------- lettrage et teinte de l'écran (calque 2D)
const hud = new THREE.Scene(), hcam = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, -10, 10);
const UNIT = new THREE.PlaneGeometry(1, 1);
const hmesh = (map, color = 0xffffff) => { const m = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ map, color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); hud.add(m); return m; };
const rt = [0, 1].map(() => { const t = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { samples: 4 }); t.texture.colorSpace = THREE.SRGBColorSpace; return t; });
const layer = rt.map((t, i) => { const m = hmesh(t.texture); m.scale.set(16, 9, 1); m.renderOrder = i; return m; });
const tint = hmesh(null); tint.scale.set(16, 9, 1); tint.renderOrder = 5;
const vig = hmesh((() => { const c = document.createElement('canvas'); c.width = 512; c.height = 288; const g = c.getContext('2d'), gr = g.createRadialGradient(256, 144, 120, 256, 144, 310);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 288); return new THREE.CanvasTexture(c); })());
vig.scale.set(16, 9, 1); vig.renderOrder = 6;
const glyphs = new Map();
function glyph(ch, color) {
  const key = ch + color; if (glyphs.has(key)) return glyphs.get(key);
  const F = '700 190px Fredoka', c = document.createElement('canvas'); let g = c.getContext('2d'); g.font = F;
  const adv = g.measureText(ch).width, pad = 44; c.width = Math.ceil(adv + pad * 2); c.height = 300; g = c.getContext('2d');
  g.font = F; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(40,20,60,0.28)'; g.lineWidth = 44; g.strokeText(ch, pad, 222);
  g.strokeStyle = '#ffffff'; g.lineWidth = 34; g.strokeText(ch, pad, 210);
  g.fillStyle = color; g.fillText(ch, pad, 210);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const o = { tex, adv: adv / 190, w: c.width / 190, h: 300 / 190 }; glyphs.set(key, o); return o;
}
// un mot = une rangée de lettres indépendantes (chacune peut rebondir)
function makeWord(text, colors) {
  const L = []; let x = 0, n = 0;
  for (const ch of text) { if (ch === ' ') { x += 0.3; continue; } const g = glyph(ch, colors[n % colors.length]); const m = hmesh(g.tex); m.renderOrder = 10; L.push({ m, g, x: x + g.adv / 2, n }); x += g.adv; n++; }
  return { L, width: x };
}
function drawWord(w, cx, cy, h, age, o = {}) {
  const { alpha = 1, stagger = 0.045, bob = 0.05, pulse = 0 } = o;
  for (const l of w.L) {
    const a = pop(age - l.n * stagger, 0.38); if (a <= 0 || alpha <= 0) continue;
    const s = h * a * (1 + pulse);
    l.m.visible = true; l.m.material.opacity = alpha;
    l.m.position.set(cx + (l.x - w.width / 2) * h * (1 + pulse * 0.5), cy + Math.sin(T / B * Math.PI + l.n * 0.8) * bob * h + (0.32 - 0.5) * 0 * h, 0);
    l.m.scale.set(l.g.w * s, l.g.h * s, 1); l.m.rotation.z = Math.sin(T / B * Math.PI + l.n * 1.3) * 0.04;
  }
}
const CSS = NAMES.map((n) => song.colors[n].hex);
const titleA = makeWord('La chanson', CSS), titleB = makeWord('des couleurs', [...CSS.slice(3), ...CSS.slice(0, 3)]);
const bigWords = Object.fromEntries(NAMES.map((n) => [n, makeWord(n.toUpperCase(), [song.colors[n].hex])]));
const chipWords = NAMES.map((n) => makeWord(n.toUpperCase(), [song.colors[n].hex]));
const pulseAt = (times) => times.reduce((a, t) => Math.max(a, Math.exp(-(((T - t) / 0.13) ** 2))), 0);

function drawHud() {
  for (const m of hud.children) if (m.renderOrder >= 5) m.visible = false;
  // titre (intro)
  { const u = T - 4 * BAR, al = 1 - ss(6.55 * BAR, 6.95 * BAR, T); if (u > 0 && al > 0) { drawWord(titleA, 0, 3.05, 1.5, u, { alpha: al }); drawWord(titleB, 0, 1.55, 1.5, u - 0.45, { alpha: al }); } }
  // couplets : l'écran se teinte, le nom de la couleur s'affiche en grosses lettres
  for (const v of VERSES) {
    const u = T - v.t0, end = 7 * BAR; if (u < -0.3 || u > end + 0.3) continue;
    const on = ss(-0.25, 0.25, u) * (1 - ss(end - 0.3, end + 0.2, u)), shout = u - 6 * BAR;
    tint.visible = vig.visible = true; tint.material.color.set(v.hex); vig.material.color.set(v.hex);
    tint.material.opacity = on * (0.05 + 0.42 * Math.exp(-Math.max(0, u) / 0.45) + (shout > 0 ? 0.3 * Math.exp(-shout / 0.5) : 0));
    vig.material.opacity = on * 0.78;
    const big = ss(-0.15, 0.25, shout), sungAt = [0, 1, 2].map((b) => v.t0 + b * B * (v.name.length > 5 ? 1 : 1)).concat([v.t0 + 6 * BAR]);
    drawWord(bigWords[v.name], 0, lerp(3.15, 2.85, big), lerp(1.75, 2.9, big), u - 0.05, { alpha: 1 - ss(end - 0.3, end, u), pulse: 0.14 * pulseAt(sungAt), bob: 0.04 });
  }
  // final : les six noms s'allument un par un, deux fois
  for (const base of [TF, TF + 4 * BAR]) {
    const stay = base === TF ? 4 * BAR : 4 * BAR; if (T < base - 0.1 || T > base + stay + 0.3) continue;
    const raw = chipWords.reduce((a, w) => a + w.width, 0), H = (15.2 - 5 * 0.36) / raw, total = 15.2; let x = -total / 2;
    chipWords.forEach((w, i) => { const wd = w.width * H; drawWord(w, x + wd / 2, -3.8, H, T - base - WORD_T[i], { alpha: 1 - ss(base + stay - 0.3, base + stay, T), pulse: 0.3 * pulseAt([base + WORD_T[i] + 0.1]), bob: 0.03 }); x += wd + 0.36; });
  }
}

// ---------------------------------------------------------------- rendu d'une image
const XF = 0.5;   // durée des fondus enchaînés
function drawShot(s, target) {
  for (const k of kids) k.root.visible = false; for (const p of allProps) p.hide(); for (const sp of sprites) sp.visible = false;
  W.show(s[2]); W.update(T); s[3](T - s[0], s[1] - s[0]);
  renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
}
window.FILM = { FPS, DUR, frames: FPS * DUR, shots: shots.map((s) => [s[0], s[1]]) };
window.renderFrame = (f) => {
  frame = f; T = f / FPS;
  let i = shots.findIndex((x) => T >= x[0] && T < x[1]); if (i < 0) i = shots.length - 1;
  let a = i, b = -1, mix = 0;
  if (i > 0 && T - shots[i][0] < XF / 2) { a = i - 1; b = i; mix = ss(-XF / 2, XF / 2, T - shots[i][0]); }
  else if (i < shots.length - 1 && shots[i][1] - T < XF / 2) { b = i + 1; mix = ss(-XF / 2, XF / 2, T - shots[i][1]); }
  drawShot(shots[a], rt[0]); if (b >= 0) drawShot(shots[b], rt[1]);
  layer[1].visible = b >= 0; layer[1].material.opacity = mix;
  drawHud();
  renderer.setRenderTarget(null); renderer.clear(); renderer.render(hud, hcam);
};
window.capture = (f, quality = 0.93) => { window.renderFrame(f); return canvas.toDataURL('image/jpeg', quality); };
if (q.get('play')) { const t0 = performance.now(); const loop = () => { window.renderFrame(Math.floor(((performance.now() - t0) / 1000 * FPS) % (FPS * DUR))); requestAnimationFrame(loop); }; loop(); }
else window.renderFrame(+(q.get('f') || 0));
window.ready = true;
