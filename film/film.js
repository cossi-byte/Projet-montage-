// « Koko et le petit œuf » — mise en scène : 43 plans de 3 à 5 secondes.
// Tout est une fonction pure du temps : renderFrame(n) dessine l'image n, sans état caché.
import * as THREE from 'three';
import { makeKoko, makeMonkey, makeTurtle, makeGiraffe, makeBird, makeEgg, lerp, clamp, ss, hop } from './characters.js';
import { buildWorld, LOG_X, NEST, DANCE_X } from './world.js';

const q = new URLSearchParams(location.search);
const WIDTH = +(q.get('w') || 1920), HEIGHT = Math.round(WIDTH * 9 / 16), FPS = 24, DUR = 180;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 300);
const W = buildWorld(scene), fx = W.fx;
const koko = makeKoko(scene), monkey = makeMonkey(scene), turtle = makeTurtle(scene), giraffe = makeGiraffe(scene),
  mama = makeBird(scene, false), chick = makeBird(scene, true), egg = makeEgg(scene);
const actors = [koko, monkey, turtle, giraffe, mama, chick, egg];
const lips = await (await fetch('./lipsync.json')).json();

const R90 = Math.PI / 2, TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = (v, dx = 0, dy = 0, dz = 0) => ({ x: v.x + dx, y: v.y + dy, z: v.z + dz });
let T = 0, frame = 0;
const lip = (who) => (lips[who] ? lips[who][frame] || 0 : 0);
const choir = () => Math.max(lip('koko'), lip('narr') * (T > 46 && (T < 56 || (T > 84 && T < 94) || T > 149) ? 1 : 0));
const blinkAt = (seed) => ((T + seed * 1.37) % 3.4 < 0.13 ? 1 : 0);
const boing = (age, amp) => (age < 0 ? 0 : amp * Math.exp(-age * 6) * Math.cos(age * 20));
const beat = (ph = 0) => hop((T * 2 + ph) % 1);            // rebond sur chaque temps (120 bpm)
const sway = () => Math.sin(T * Math.PI);                    // balancement sur 2 temps
function cam(px, py, pz, tx, ty, tz, fov = 35) {
  camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); camera.fov = fov; camera.updateProjectionMatrix();
  W.focus(tx, 0, Math.min(tz, 2));
}
// raccourcis d'acteurs (clignement + synchro des lèvres automatiques)
const cl = (p) => { for (const k in p) if (p[k] === undefined) delete p[k]; return p; };
const K = (p) => { cl(p); const m = Math.max(lip('koko'), p.sing ? choir() : 0); koko.set({ blink: blinkAt(0), mouth: m, trunkUp: 0.2 + m * 0.45, ear: Math.sin(T * 3) * 0.06, ...p }); };
const M = (p) => monkey.set({ ...{},  blink: blinkAt(1), mouth: Math.max(lip('monkey'), p.sing ? choir() : 0), tail: 0.5 + 0.3 * Math.sin(T * 4), ...cl(p) });
const Tu = (p) => turtle.set({ blink: blinkAt(2), mouth: Math.max(lip('turtle'), p.sing ? choir() * 0.8 : 0), ...cl(p) });
const G = (p) => giraffe.set({ blink: blinkAt(3), mouth: Math.max(lip('giraffe'), p.sing ? choir() : 0), ...p });
const Ma = (p) => mama.set({ blink: blinkAt(4), mouth: Math.max(lip('mama'), p.sing ? choir() : 0), ...p });
const chirp = () => [128.9, 129.07, 129.5, 129.67, 139, 139.17, 163, 163.17, 163.5, 163.67, 164.5, 164.67].some((t) => T >= t && T < t + 0.13) ? 1 : 0;
const C = (p) => chick.set({ s: 0.42, blink: blinkAt(5), mouth: Math.max(lip('chick'), chirp(), p.sing ? choir() : 0), hat: true, ...p });
const E = (p) => egg.set(p);
const heldEgg = (extra = {}) => E({ ...P(koko.eggPos()), rz: Math.sin(T * 5) * 0.05, ...extra });

// ---------------------------------------------------------------- positions clés
const GX = 94.1, GZ = 1.3;                         // la girafe
const D_HI = 0.6, D_GROUND = 0.8, D_TOP = 0.2;      // positions du cou
const DN = DANCE_X;

// trajectoires partagées entre deux plans
const lianaTheta = (u) => (u < 1.6 ? lerp(0.15, -0.5, ss(0.3, 1.2, u)) : u < 3.2 ? lerp(-0.5, 0.5, ss(1.6, 3.2, u)) : 0.5 * Math.cos((u - 3.2) * 3) * Math.exp(-(u - 3.2)));
const lianaEnd = (th) => { const L = 5.3 + 3.53 * Math.min(1, (th / 0.5) ** 2); return V(W.lianaTop.x + L * Math.sin(th), W.lianaTop.y - L * Math.cos(th), W.lianaTop.z); };
const kokoAfterSwing = () => { const s = clamp((T - 42.2) / 1.0); return { x: lerp(33.43, 34.6, s), y: hop(s) * 1.1 }; };
const riverEgg = () => { const s = clamp((T - 60.5) / 2.7); return { x: lerp(56.9, 61.5, s), y: lerp(1.6, 1.36, s) + 6 * hop(s), z: 0, rz: -s * 14 }; };
const onGiraffe = (down, extra = {}) => { // Koko (et le singe) perchés sur la tête de la girafe
  G({ x: GX, z: GZ, ry: R90, down, ...extra.g });
  const h = giraffe.headTop();
  K({ ...P(h, 0, -0.32, 0), ry: 0.5, sit: 1, hold: 1, ...extra.k });
  M({ ...P(koko.headTop(), 0, -0.05, -0.1), ry: 0.4, aL: [3, 0.4 + Math.sin(T * 9) * 0.2], aR: [3, 0.4 - Math.sin(T * 9) * 0.2], ...extra.m });
  return h;
};
// la fête : tout le monde danse
function party(o = {}) {
  const b = beat(), s = sway(), sing = true;
  if (!o.noKoko) K({ x: DN + s * 0.4, y: b * 0.32, z: 0.5, rz: s * 0.1, ry: s * 0.3, aL: [0, 1.7 + s * 0.8], aR: [0, 1.7 - s * 0.8], trunkUp: 0.8 + 0.2 * Math.sin(T * TAU), ear: Math.sin(T * TAU) * 0.3, mouth: Math.max(choir(), 0.35), sing, ...o.k });
  if (!o.noChick) C({ ...P(koko.headTop(), 0, b * 0.25 - 0.08, 0), ry: s * 1.2, wing: 0.5 + 0.5 * Math.sin(T * TAU * 2), sing, ...o.c });
  M({ x: DN - 2.1 - s * 0.3, y: beat(0.5) * 0.6, z: 1.0, rz: -s * 0.15, ry: s * 0.6, aL: [3 + s * 0.4, 0.35], aR: [3 - s * 0.4, 0.35], sing, mouth: Math.max(choir(), 0.3), ...o.m });
  Tu({ x: DN - 4.4, y: b * 0.15, z: 0.7, ry: 0.35 + s * 0.3, rz: s * 0.08, headYaw: -s * 0.3, sing, mouth: Math.max(choir() * 0.8, 0.2), blush: 1.3, ...o.t });
  Ma({ x: DN + 2.5, y: beat(0.5) * 0.5, z: 0.8, ry: -0.25 + s * 0.4, wing: 0.5 + 0.5 * Math.sin(T * TAU), sing, mouth: choir() > 0.2 ? 1 : 0.2, ...o.ma });
  G({ x: DN, y: b * 0.12, z: -5.6, ry: 0, down: 0.3, sway: s * 2, sing, mouth: Math.max(choir(), 0.25), ...o.g });
  fx.rain(DN, 1, T);
}

// ------------------------------------------------------------------------ plans
const shots = [
  // ===== ACCROCHE : l'œuf tombe du ciel =====
  [0, 2.5, (u) => {
    const x = lerp(-3.2, 0, ss(0, 2.1, u)), st = ss(1.8, 2.3, u);
    K({ x, ry: lerp(R90, 0.5, st), walk: u < 2.1 ? u * 9 : null, headPitch: ss(1.2, 2.1, u) * 0.5, look: [0, ss(1.2, 2, u)], trunkSway: Math.sin(u * 6) * 2, trunkUp: 0.35 + 0.2 * Math.sin(u * 6), brow: ss(1.2, 2, u) });
    cam(lerp(-2.2, -0.6, u / 2.5), 2.3, lerp(11, 9.6, u / 2.5), x * 0.5 - 0.3, 1.7, 0, 36);
  }],
  [2.5, 6, (u) => {
    const h1 = u - 0.5, h2 = u - 1.6, ct = u - 2.7, air = u < 2.7;
    K({ x: 0, ry: lerp(0.5, 0.35, u / 3.5), sq: 1 - boing(h1, 0.3) - boing(h2, 0.22) - boing(ct, 0.12), eye: 1 + 0.38 * ss(0.5, 0.58, u) * (1 - 0.6 * ss(2.8, 3.3, u)),
      brow: 1, aL: [2.6 + Math.sin(u * 20) * 0.3, 0.5], aR: [2.6 - Math.sin(u * 20) * 0.3, 0.5], hold: ss(2.2, 2.7, u), look: [0, air ? 1 : -0.6], headPitch: air ? 0.25 : -0.1, ear: Math.sin(u * 14) * 0.25, mouth: air && u > 0.5 ? 0.7 : 0, blink: 0 });
    const top = koko.headTop().add(V(0, 0.36, 0)), an = koko.eggPos();
    if (u < 0.5) E({ ...P(top, 0, lerp(7, 0, (u / 0.5) ** 2), 0), rz: u * 8 });
    else if (u < 1.6) { const s = h1 / 1.1; E({ ...P(top, 0.25 * Math.sin(s * 3.14), 2.5 * hop(s), 0), rz: u * 7, sq: 1 - boing(h1, 0.25) }); }
    else if (u < 2.7) { const s = h2 / 1.1, p = top.clone().lerp(an, s); E({ ...P(p, 0, 1.9 * hop(s), 0), rz: u * 7 * (1 - s) }); }
    else heldEgg({ sq: 1 - boing(ct, 0.2) });
    cam(0.7, 2.6, lerp(7.6, 6.8, u / 3.5), 0, 2.55, 0, 36);
  }],
  [6, 10, (u) => {
    const cu = ss(1.8, 2.3, u);
    K({ x: 0, ry: 0.35, hold: 1, look: [0, lerp(-0.75, 0, cu)], eye: 1.2, brow: 0.7, ear: Math.sin(u * 8) * 0.15 * (1 - ss(1, 1.5, u)), headTilt: Math.sin(u * 1.5) * 0.07, headPitch: lerp(-0.18, 0, cu) });
    heldEgg({ rz: u > 0.9 && u < 1.6 ? Math.sin(u * 40) * 0.2 : 0 });
    fx.sparkle(koko.eggPos(), u - 1.0, 12, 1.2);
    cam(1.0, 2.0, lerp(4.8, 4.3, u / 4), 0.1, 1.6, 0.3, 30);
  }],
  [10, 14, (u) => {
    const a = lerp(-0.45, 0.45, u / 4), sad = ss(0.1, 0.5, u) * (1 - ss(2.2, 2.6, u));
    const yaw = u < 1 ? -0.7 * ss(0, 0.4, u) : u < 2.3 ? lerp(-0.7, 0.7, ss(1, 1.5, u)) : lerp(0.7, 0, ss(2.3, 2.7, u));
    K({ x: 0, y: hop((u - 3.0) / 0.6) * 0.5, ry: 0.2, hold: 1, headYaw: yaw, look: [yaw, sad ? 0.2 : -0.5], brow: lerp(0.7, -1, sad), ear: lerp(Math.sin(u * 12) * 0.25, -0.35, sad), smile: sad > 0.5 ? -1 : 1, eye: 1.1 });
    heldEgg({ rz: u > 1.4 && u < 2 ? Math.sin(u * 40) * 0.2 : 0 });
    cam(Math.sin(a) * 7, 2.3, Math.cos(a) * 7, 0, 1.6, 0, 35);
  }],
  [14, 18, (u) => {
    const x = lerp(4, 13, u / 4);
    K({ x, ry: R90, walk: T * TAU, hold: 1, ear: Math.sin(T * TAU) * 0.2, trunkUp: 0.55 + 0.2 * Math.sin(T * TAU), headTilt: sway() * 0.08, brow: 0.5 });
    heldEgg({ y: koko.eggPos().y + beat() * 0.1 });
    cam(x + 1.6, 2.4, 11.5, x + 1.2, 1.5, 0, 38);
  }],
  // ===== RENCONTRE 1 : le singe et le gros tronc =====
  [18, 22, (u) => {
    const x = lerp(24.2, 26.6, ss(0, 1.2, u));
    K({ x, ry: R90, walk: u < 1.2 ? u * 9 : null, hold: 1, headPitch: 0.35 * ss(0.8, 1.4, u), brow: -0.6 * ss(1, 1.5, u), look: [0, 0.6], trunkUp: 0.15 + 0.8 * hop((u - 2.35) / 0.5), eye: 1.1 });
    heldEgg();
    cam(lerp(23.2, 24.2, u / 4), 2.7, 10, 28, 1.9, 0, 38);
  }],
  [22, 26, (u) => {
    let p;
    if (u < 1.3) p = { x: lerp(26.6, 24.6, ss(0, 1.1, u)), sq: 1 - 0.16 * (hop((u - 0.1) / 0.4) + hop((u - 0.6) / 0.4) + hop((u - 1.0) / 0.3)), hold: 1, brow: 0.8 };
    else if (u < 2.0) p = { x: lerp(24.6, 28.0, ((u - 1.3) / 0.7) ** 1.5), y: ss(1.75, 2, u), walk: u * 24, hold: 1, brow: 0.8, ear: -0.3 };
    else if (u < 2.9) { const s = (u - 2) / 0.9; p = { x: lerp(28.0, 25.6, s), y: 1.0 * (1 - s) + 1.8 * hop(s) - 0.28 * s, rx: -s * TAU, sq: 1 - boing(u - 2, 0.3), aL: [2.5, 0.7], aR: [2.5, 0.7], eye: 1.35, brow: 1, mouth: 0.8 }; }
    else p = { x: 25.6, y: -0.28, rx: -0.12, sit: 1, sq: 1 - boing(u - 2.9, 0.25), look: [Math.cos(u * 9) * 0.8, Math.sin(u * 9) * 0.8], brow: 0.5, aL: [0.3, 0.6], aR: [0.3, 0.6], blink: 0 };
    K({ ry: u < 2.9 ? R90 : lerp(R90, 0.7, ss(2.9, 3.3, u)), ...p });
    if (u < 2.0) heldEgg();
    else if (u < 3.2) { const s = (u - 2) / 1.2, e = koko.headTop().add(V(0, 0.36, 0)); E({ x: lerp(28.3, e.x, s), y: lerp(2.2, e.y, s) + 3 * hop(s), z: lerp(0.6, e.z, s), rz: u * 9 }); }
    else { E({ ...P(koko.headTop(), 0, 0.36, 0), sq: 1 - boing(u - 3.2, 0.25) }); fx.twinkle(koko.headTop().add(V(0, 0.9, 0)), T, 4, 0.7); }
    cam(26.9, 2.3, 10.5, 27, 1.9, 0, 38);
  }],
  [26, 30, (u) => {
    const drop = ss(2.2, 2.6, u), th = 0.22 * Math.sin(u * 3) * (1 - drop), end = V(LOG_X + 5.4 * Math.sin(th), 10.5 - 5.4 * Math.cos(th), 0.5);
    W.liana(V(LOG_X, 10.5, 0.5), end);
    M({ x: lerp(end.x, LOG_X - 0.3, drop), y: lerp(end.y, 2.1, drop), z: 0.5, ry: 0.35, rz: (Math.PI + th) * (1 - drop), sq: 1 - boing(u - 2.6, 0.3), headTilt: Math.sin(u * 14) * 0.12 * (1 - drop),
      aL: drop < 1 ? [3, 0.3] : [2.8 + Math.sin(u * 12) * 0.3, 0.5], aR: drop < 1 ? [3, 0.3] : [0.2, 0.3], eye: 1.1 });
    cam(28.7, 2.6, 7.2, LOG_X, lerp(3.9, 2.9, drop), 0.4, 36);
  }],
  [30, 35, (u) => {
    const no = ss(2.4, 2.6, u) * (1 - ss(3.5, 3.8, u));
    K({ x: 26.6, ry: 1.15, hold: 1, holdUp: ss(0.2, 0.6, u) * (1 - ss(2.0, 2.6, u)) * 0.8, look: [0.3, 0.7], headPitch: 0.3, brow: 0.6, ear: Math.sin(u * 6) * 0.12 });
    heldEgg();
    M({ x: LOG_X - 0.3, y: 2.1, z: 0.5, ry: -1.1, headYaw: Math.sin(u * 14) * 0.5 * no, look: [0, -0.5], aL: [1.2 * no, 0.4 + Math.sin(u * 14) * 0.3 * no], aR: [1.2 * no, 0.4 - Math.sin(u * 14) * 0.3 * no], headPitch: -0.2 });
    cam(28, 2.4, 10, 28.2, 2.1, 0, 36);
  }],
  [35, 39, (u) => {
    const sad = 1 - ss(1.6, 2.1, u);
    K({ x: 26.6, y: hop((u - 2.2) / 0.5) * 0.3, ry: 0.9, hold: 1, brow: lerp(0.9, -1, sad), ear: lerp(0.25 * Math.sin(u * 9), -0.6, sad), headPitch: lerp(0.35, -0.25, sad),
      look: [lerp(0.5, 0, sad), lerp(0.7, -0.8, sad)], eye: lerp(1.28, 0.95, sad), trunkUp: lerp(0.75, 0, sad), smile: sad > 0.5 ? -1 : 1, mouth: sad > 0.5 ? 0 : 0.45 });
    heldEgg({ rz: lerp(0, -0.25, sad) });
    cam(28.0, 2.0, 4.8, 26.8, 1.72, 0.3, 30);
  }],
  [39, 43, (u) => {
    const th = lianaTheta(u), end = lianaEnd(th), on = u >= 1.2 && u < 3.2;
    W.liana(W.lianaTop, end);
    if (u < 1.2) K({ x: 24.97, ry: R90, hold: 1, trunkUp: ss(0.5, 1.1, u), look: [0, 0.8], headPitch: 0.3, brow: 0.7 });
    else if (on) K({ x: end.x - 0.78, y: end.y - 2.72, ry: R90, rx: -th * 0.5, hold: 1, trunkUp: 1, ear: -0.35 + Math.sin(u * 20) * 0.1, eye: 1.25, brow: 1, mouth: 0.8, walk: u * 5 });
    else K({ ...kokoAfterSwing(), ry: R90, hold: 1, trunkUp: 0.6, eye: 1.2, brow: 1, mouth: 0.6 });
    heldEgg();
    M({ x: LOG_X - 0.3, y: 2.1 + (u > 1.6 ? beat() * 0.35 : 0), z: 0.5, ry: lerp(-1.1, 1.1, ss(1.6, 3.2, u)), aL: u < 0.6 ? [2.2 * hop(u / 0.6), 0.3] : [3, 0.5], aR: u > 1.4 ? [3, 0.5] : [0, 0.2], mouth: u > 1.6 ? 0.6 : 0 });
    cam(29.8, 4.2, 13.5, 29.8, 4.3, 0, 40);
  }],
  [43, 47, (u) => {
    const five = ss(2.6, 3.0, u) * (1 - ss(3.3, 3.8, u));
    K({ ...(u < 0.2 ? kokoAfterSwing() : { x: 34.6 }), ry: lerp(R90, 0.4, ss(0.3, 0.9, u)), sq: 1 - boing(u - 0.2, 0.3), hold: 1, headYaw: 0.4 * ss(1, 1.4, u), look: [0.6, 0], brow: 0.6, ear: Math.sin(u * 8) * 0.15 });
    heldEgg();
    const s = clamp((u - 0.1) / 0.8);
    M({ x: lerp(LOG_X - 0.3, 36.4, s), y: lerp(2.1, 0, s) + 2.6 * hop(s) + hop((u - 2.7) / 0.6) * 0.9, z: 0.5, rz: -s * TAU, ry: -0.6, sq: 1 - boing(u - 0.9, 0.3), aR: [0, 0.3 + 2.4 * five], aL: [0, 0.3 + 2.4 * five], headYaw: -0.3, mouth: 0.4 });
    fx.sparkle(V(35.5, 2.4, 0.6), u - 3.0, 14, 1.6, 1.1, 0xfff59a);
    cam(35.4, 2.1, 9, 35.4, 1.6, 0, 35);
  }],
  // refrain n°1
  [47, 51, (u) => {
    const gx = lerp(38, 45, u / 4);
    K({ x: gx, ry: R90, walk: T * TAU, hold: 1, headTilt: sway() * 0.12, ear: Math.sin(T * TAU) * 0.22, trunkUp: 0.65 + 0.3 * Math.sin(T * TAU), sing: true, brow: 0.5 });
    heldEgg({ y: koko.eggPos().y + beat() * 0.14 });
    M({ x: gx - 1.9, y: beat(0.5) * 0.3, z: 0.6, ry: R90, walk: T * TAU + 1, sing: true });
    cam(gx + 0.3, 2.4, 11, gx - 0.3, 1.5, 0, 38);
  }],
  [51, 55, (u) => {
    const gx = lerp(45, 50, u / 4);
    K({ x: gx, ry: R90, walk: T * TAU, hold: 1, headTilt: sway() * 0.14, ear: Math.sin(T * TAU) * 0.25, trunkUp: 0.7 + 0.3 * Math.sin(T * TAU), sing: true, brow: 0.6 });
    heldEgg({ y: koko.eggPos().y + beat() * 0.16, rz: sway() * 0.2 });
    M({ x: gx - 1.7, y: beat(0.5) * 0.9, z: -0.9, ry: R90, aL: [3, 0.4], aR: [3, 0.4], sing: true });
    cam(gx + 6.6, 2.1, 2.6, gx, 1.72, 0, 32);
  }],
  // ===== RENCONTRE 2 : la tortue et la rivière =====
  [55, 59, (u) => {
    const gx = lerp(51, 54.3, ss(0, 2.2, u)), wow = ss(2, 2.5, u);
    K({ x: gx, ry: R90, walk: u < 2.2 ? u * 8 : null, hold: 1, eye: 1 + 0.25 * wow, brow: wow, trunkUp: 0.6 });
    heldEgg();
    M({ x: gx - 1.7, y: u > 2.4 ? beat() * 0.4 : 0, z: 0.7, ry: R90, walk: u < 2.2 ? u * 8 + 1 : null, aL: [3 * wow, 0.4], aR: [3 * wow, 0.4] });
    cam(lerp(49, 50.5, u / 4), lerp(3, 4.6, u / 4), 9, 60, 0.3, -1.5, 44);
  }],
  [59, 63, (u) => {
    const f = ss(1.1, 2.2, u), down = u > 1.1;
    K({ x: lerp(54.4, 56.1, ss(0, 1.1, u)) + f * 0.6, y: f * 0.5 + hop((u - 1.1) / 1.2) * 0.9, ry: R90, rx: -1.45 * f, walk: u < 1.1 ? u * 7 : u * 14, sq: 1 - boing(u - 2.3, 0.2),
      hold: down ? 0 : 1, aL: [2.4, 0.8], aR: [2.4, 0.8], eye: down ? 1.3 : 1.05, brow: down ? 1 : -0.4, mouth: down && u < 2.6 ? 0.8 : undefined, blink: 0 });
    if (u < 1.5) heldEgg(); else E(riverEgg());
    const peek = ss(2.8, 3.2, u);
    M({ x: 53.0, z: 0.7, ry: 1.0, aL: down ? [lerp(2.3, 0.3, peek), -0.5] : [0, 0.2], aR: down ? [lerp(2.3, 0.3, peek), -0.5] : [0, 0.2], eye: 1.1 });
    cam(55.6, 2.0, 8.5, 55.6, 1.5, 0, 36);
  }],
  [63, 67, (u) => {
    const rise = ss(1.2, 1.7, u);
    Tu({ x: 61.5, y: lerp(-0.5, -0.12, rise) + boing(u - 0.2, 0.08), ry: -1.05, neck: rise, look: [0, 0.9], headPitch: 0.45 * ss(1.7, 2.1, u), blink: lerp(1, 0.3, ss(1.7, 2.3, u)) });
    if (T < 63.2) E(riverEgg()); else E({ ...P(turtle.top(), 0, 0.34, 0), sq: 1 - boing(u - 0.2, 0.25), rz: boing(u - 3, 0.4) });
    fx.ring(61.5, 0, u - 0.2, 2); fx.ring(61.5, 0, u - 1.2, 3.2); fx.ring(61.5, 0, u - 1.55, 3.2);
    cam(60.2, 2.0, 8.2, 61.3, 0.9, 0, 32);
  }],
  [67, 72.5, (u) => {
    const sad = ss(4.3, 4.9, u);
    K({ x: 55.7, ry: 1.2, aR: u < 2 ? [1.5 + Math.sin(u * 8) * 0.1, 0.1] : [0, 0.15], brow: lerp(0.6, -1, sad), ear: lerp(0.1, -0.6, sad), smile: sad > 0.5 ? -1 : 1, headPitch: -0.2 * sad, look: [0.5, -0.3] });
    M({ x: 54.3, z: 0.8, ry: 1.2, headPitch: -0.2 * sad });
    Tu({ x: lerp(61.5, 59.4, ss(0, 1.5, u)), y: -0.12 + Math.sin(u * 3) * 0.03, ry: -R90, walk: u * 3, headYaw: Math.sin(u * 5.5) * 0.4 * ss(2.2, 2.5, u) * (1 - ss(3.6, 4.0, u)), look: [0, 0.3] });
    E(P(turtle.top(), 0, 0.34, 0));
    cam(57.6, 2.0, 9.8, 57.7, 1.2, 0, 36);
  }],
  [72.5, 76, (u) => {
    Tu({ x: 59.4, y: -0.12 + Math.sin(u * 3) * 0.03, ry: -R90 + 0.75, blink: hop((u - 2.2) / 0.5), headPitch: 0.1 - 0.25 * hop((u - 1.6) / 0.7), blush: 1.5, look: [-0.4, 0.3] });
    E(P(turtle.top(), 0, 0.34, 0));
    cam(57.2, 1.5, 4.0, 58.7, 0.85, 0.5, 30);
  }],
  [76, 81, (u) => {
    const tx = lerp(58.6, 65.2, u / 5);
    Tu({ x: tx, y: -0.15 + Math.sin(u * 3) * 0.04, ry: R90, walk: u * 4, blush: 1.2 });
    const tp = turtle.top();
    K({ ...P(tp, 0.15, -0.06, 0), ry: 0.9, rz: Math.sin(u * 3) * 0.06, hold: 1, eye: 1.15, brow: 0.8, ear: Math.sin(u * 9) * 0.2, trunkUp: 0.7 });
    heldEgg();
    M({ ...P(tp, -0.95, -0.2, 0), ry: 0.9, rz: Math.sin(u * 4) * 0.2, aL: [0, 1.5], aR: [0, 1.5], y: tp.y - 0.2 + beat() * 0.2 });
    fx.fish(tx + 1.6, 2.4, T - 78.0); fx.fish(tx + 0.4, 2.9, T - 78.6, 0.8, -1); fx.fish(tx + 2.0, 2.0, T - 79.6); fx.fish(tx + 1.0, 2.6, T - 80.3, 0.8, -1);
    fx.ring(tx - 1.6, 0, (u * 1.1) % 1.6, 1.6); fx.ring(58.6, 0, u - 0.3, 3);
    const cx = lerp(61, 63.2, u / 5); cam(cx, 3.4, 12.5, cx, 1.1, 0, 38);
  }],
  [81, 85, (u) => {
    Tu({ x: 68.2, ry: lerp(R90, 0.4, ss(0, 0.8, u)), blush: lerp(1, 1.7, ss(2.2, 2.8, u)), blink: u > 2.6 ? 1 : undefined, headYaw: 0.3 });
    const tp = turtle.top(), s = ss(0.2, 0.9, u), lean = ss(2.1, 2.6, u);
    K({ x: lerp(tp.x, 70.3, s), y: lerp(tp.y, 0, s) + hop(s) * 0.8, z: 0.4, ry: -1.0, sq: 1 - boing(u - 0.9, 0.2), hold: 1, trunkUp: 0.4 + lean * 0.5, headPitch: -0.2 * lean, rz: 0.1 * lean, brow: 0.6, look: [-0.5, -0.2] });
    heldEgg();
    M({ ...P(tp, 0, -0.12, -0.1), ry: 0.4, sit: 1, aL: [1.5, -0.3 + beat() * 0.5], aR: [1.5, -0.3 + beat() * 0.5] });
    fx.ring(67, 0, u - 0.1, 3); fx.sparkle(V(68.9, 1.6, 1.4), u - 3, 12, 1.4); fx.hearts(V(69, 1.7, 1), u - 2.8, 4, 1.4);
    cam(69.3, 1.9, 8.5, 69.2, 1.3, 0, 34);
  }],
  // refrain n°2
  [85, 89, (u) => {
    const gx = lerp(72, 77, u / 4);
    Tu({ x: gx - 2.6, y: beat() * 0.06, ry: R90, walk: T * Math.PI, sing: true });
    M({ ...P(turtle.top(), 0, beat(0.5) * 0.35, 0), ry: R90 * 0.6, aL: [3 + sway() * 0.4, 0.4], aR: [3 - sway() * 0.4, 0.4], sing: true });
    K({ x: gx + 0.6, ry: R90, walk: T * TAU, hold: 1, headTilt: sway() * 0.12, ear: Math.sin(T * TAU) * 0.22, trunkUp: 0.65 + 0.3 * Math.sin(T * TAU), sing: true, brow: 0.5 });
    heldEgg({ y: koko.eggPos().y + beat() * 0.14 });
    cam(gx - 0.6, 2.5, 12, gx - 0.9, 1.5, 0, 38);
  }],
  [89, 93, (u) => {
    const gx = lerp(77, 81, u / 4);
    Tu({ x: gx - 1.5, y: beat() * 0.06, z: -1.0, ry: R90, walk: T * Math.PI, sing: true, headYaw: sway() * 0.3 });
    M({ ...P(turtle.top(), 0, beat(0.5) * 0.4, 0), ry: R90, aL: [1.5, -0.3 + beat() * 0.6], aR: [1.5, -0.3 + beat() * 0.6], sing: true });
    K({ x: gx + 1.0, z: 0.9, ry: R90, walk: T * TAU, hold: 1, headTilt: sway() * 0.14, ear: Math.sin(T * TAU) * 0.25, trunkUp: 0.7 + 0.3 * Math.sin(T * TAU), sing: true, brow: 0.6 });
    heldEgg({ y: koko.eggPos().y + beat() * 0.16, rz: sway() * 0.2 });
    cam(gx + 7.5, 1.9, 2.4, gx - 0.2, 1.5, 0, 34);
  }],
  // ===== RENCONTRE 3 : la girafe et l'arbre géant =====
  [93, 97, (u) => {
    const x = lerp(92, 94, ss(0, 1.2, u)), up = ss(1, 1.8, u);
    K({ x, ry: R90, walk: u < 1.2 ? u * 8 : null, hold: 1, headPitch: 0.6 * up, look: [0, up], eye: 1 + 0.2 * up, brow: up });
    heldEgg();
    Tu({ x: x - 2.8, z: -0.6, ry: R90, walk: u < 1.2 ? u * 4 : null, headPitch: 0.6 * up, look: [0, up] });
    M({ ...P(turtle.top()), ry: R90, headPitch: 0.6 * up, aR: [2.6 * up, 0.2] });
    const k = ss(0.6, 2.6, u);
    fx.feather(V(97, lerp(7.5, 2.5, u / 4), 1.5), T); fx.sparkle(NEST, u - 1.7, 12, 2, 1.4, 0xfff59a);
    cam(lerp(87.5, 88.5, u / 4), 1.8, 13, lerp(94, 97.5, k), lerp(2, 5.6, k), 0, 50);
  }],
  [97, 102, (u) => {
    const TX = 97.6, fall = u >= 2.9;
    Tu({ x: TX, z: 0.2, ry: 0.25, neck: clamp(1 - ss(2.9, 3.2, u) + ss(4.5, 4.9, u)), look: [0, 0.8] });
    const tp = turtle.top(), w = ss(2.0, 2.9, u) * Math.sin(u * 9) * 0.18;
    if (u < 1.2) { const s = ss(0.5, 1.2, u); K({ x: lerp(95.6, tp.x, s), y: lerp(0, tp.y - 0.05, s) + hop(s) * 1.5, z: 0.2, ry: lerp(R90, 0.25, s), hold: 1 }); }
    else if (!fall) K({ ...P(tp, w * 0.3, -0.05, 0), ry: 0.25, rz: -w * 1.2, sq: 1 - boing(u - 1.2, 0.2), hold: 1, holdUp: ss(1.4, 2.2, u), headPitch: 0.4, look: [0, 1], brow: 0.8 });
    else { const s = clamp((u - 2.9) / 0.9); K({ x: lerp(tp.x, 101.8, s), y: lerp(tp.y, -0.28, s) + hop(s) * 0.7, z: lerp(0.2, 0.5, s), ry: 0.25, rz: -0.2 * (1 - s) - Math.sin(s * 3.14) * 0.5, sit: s, sq: 1 - boing(u - 3.8, 0.28), aL: [2.2 - s, 0.8], aR: [2.2 - s, 0.8], eye: 1.3, brow: 1, mouth: s < 1 ? 0.8 : undefined, look: s < 1 ? [0, 0] : [0.6, 0.5], blink: 0 }); }
    const kt = koko.headTop();
    let mp;
    if (u < 1.3) mp = { x: 99.6, z: 0.5, ry: -0.8, aL: [3, 0.4 + beat() * 0.3], aR: [3, 0.4 + beat() * 0.3] };
    else if (u < 2.0) { const s = (u - 1.3) / 0.7; mp = { x: lerp(99.6, kt.x, s), y: lerp(0, kt.y, s) + hop(s) * 1.2, z: lerp(0.5, kt.z, s), ry: 0.25 }; }
    else if (!fall) mp = { ...P(kt, 0, -0.05, 0), ry: 0.25, rz: -w * 2, sq: 1 - boing(u - 2, 0.25), aL: [3.05, 0.15], aR: [3.05, 0.15], headPitch: 0.5 };
    else { const s = clamp((u - 2.9) / 1.2); mp = { x: lerp(97.8, 103.0, s), y: lerp(3.9, 0, s) + hop(s) * 1.0, z: lerp(0.2, 1.0, s), ry: -0.3, rz: -s * TAU, sq: 1 - boing(u - 4.1, 0.3), aL: s >= 1 ? [3, 0.25] : [0, 1], aR: s >= 1 ? [3, 0.25] : [0, 1], eye: 1.2 }; }
    M(mp);
    if (!fall) heldEgg();
    else if (u < 4.4) { const s = (u - 2.9) / 1.5; E({ x: lerp(97.9, 103.0, s), y: lerp(4.0, 1.98, s) + 2.2 * hop(s), z: lerp(0.9, 1.0, s), rz: u * 8 }); }
    else E({ ...P(monkey.headTop(), 0, 0.33, 0), sq: 1 - boing(u - 4.4, 0.25) });
    cam(99.4, 3.4, 10.5, 99.6, 2.3, 0, 40);
  }],
  [102, 106, (u) => {
    const d = lerp(0.3, D_HI, ss(0.1, 1.0, u)), sur = ss(0.9, 1.2, u) * (1 - ss(1.8, 2.4, u));
    G({ x: GX, z: GZ, ry: R90, down: d, headYaw: -1.2, look: [0, -0.3], headPitch: -0.1 });
    Tu({ x: 97.6, z: 0.2, ry: 0.25, look: [0.5, 0.8] });
    K({ x: 101.8, y: -0.28, z: 0.5, ry: 0.1, sit: 1, look: [-0.5, 0.9], headPitch: 0.3, headYaw: -0.3, eye: 1 + 0.3 * sur, brow: lerp(0.6, 1, sur), mouth: sur > 0.5 ? 0.7 : undefined, aL: [0.3, 0.6], aR: [0.3, 0.6] });
    M({ x: 103.0, z: 1.0, ry: -0.5, aL: [3, 0.25], aR: [3, 0.25], headPitch: 0.3, eye: 1 + 0.3 * sur });
    E(P(monkey.headTop(), 0, 0.33, 0));
    cam(101, 2.2, 8.8, 101, 2.0, 0, 38);
  }],
  [106, 111, (u) => {
    const no = ss(2.1, 2.3, u) * (1 - ss(2.9, 3.2, u)), up = ss(3.0, 3.6, u);
    G({ x: GX, z: GZ, ry: R90, down: D_HI - up * 0.06, headYaw: -1.0 + Math.sin(u * 9) * 0.35 * no, headPitch: 0.35 * up, look: [0.4, up] });
    K({ x: 102.2, y: hop((u - 3.9) / 0.6) * 0.55, z: 0.6, ry: -0.9, hold: 1, holdUp: ss(0.2, 0.6, u) * (1 - ss(1.9, 2.4, u)) * 0.7, look: [-0.4, 0.5], headPitch: 0.25, eye: 1 + 0.25 * up, brow: 0.6 + 0.4 * up, ear: up * Math.sin(u * 14) * 0.3 });
    heldEgg();
    M({ x: 103.6, y: up * beat() * 0.6, z: 1.1, ry: -0.8, aL: [3 * up, 0.4], aR: [3 * up, 0.4], headPitch: 0.3 });
    Tu({ x: 97.6, z: 0.2, ry: 0.6, look: [0.5, 0.8] });
    cam(101.3, 2.4, 9, 101.2, 2.2, 0, 36);
  }],
  [111, 115, (u) => {
    const d = lerp(D_HI, D_GROUND, ss(1.6, 2.6, u));
    G({ x: GX, z: GZ, ry: R90, down: d, headYaw: -0.6 * (1 - ss(1.6, 2.6, u)), look: [0.4, 0] });
    const h = giraffe.headTop(), s = ss(2.6, 3.3, u);
    K({ x: lerp(102.2, h.x, s), y: lerp(0, h.y - 0.32, s) + hop(s) * 1.0, z: lerp(0.6, h.z, s), ry: lerp(-0.9, 0.5, s), sit: s, hold: 1, brow: 0.8, sq: 1 - boing(u - 3.3, 0.2) });
    heldEgg();
    const s2 = ss(3.3, 3.9, u), kt = koko.headTop();
    M({ x: lerp(103.6, kt.x, s2), y: lerp(0, kt.y - 0.05, s2) + hop(s2) * 1.2, z: lerp(1.1, kt.z - 0.1, s2), ry: lerp(-0.8, 0.4, s2), aL: [3 * s2, 0.4], aR: [3 * s2, 0.4] });
    Tu({ x: 97.6, z: 1.2, ry: 0.9, look: [0.6, 0.4] });
    cam(100.6, 1.9, 9.5, 100.2, 1.5, -0.2, 38);
  }],
  [115, 120, (u) => {
    const d = lerp(D_GROUND, D_TOP, ss(0.2, 4.3, u));
    const h = onGiraffe(d, { k: { eye: 1.25, brow: 1, ear: Math.sin(u * 16) * 0.3, trunkUp: 0.9, mouth: Math.max(lip('koko'), 0.4) } });
    heldEgg();
    Tu({ x: 97.6, z: 1.2, ry: 0.9, look: [0.3, 1], headPitch: 0.5 });
    cam(h.x + 1.6, h.y + 1.6, 8.5, h.x + 0.3, h.y + 1.0, -0.4, 40);
  }],
  [120, 124, (u) => {
    const put = ss(1.0, 2.2, u), free = ss(2.2, 2.7, u);
    onGiraffe(D_TOP, { k: { ry: 1.0, hold: 1 - free, rz: -0.12 * put * (1 - free), look: [0.6, -0.5], headYaw: 0.3, brow: 0.5, trunkUp: 0.3 + 0.5 * hop((u - 2.9) / 0.8) }, m: { aL: [0, 0.3], aR: [0, 0.3], headPitch: -0.3 } });
    const a = koko.eggPos(), n = V(NEST.x, NEST.y + 0.22, NEST.z);
    E({ ...P(a.lerp(n, put), 0, hop(put) * 0.35, 0) });
    fx.sparkle(n, u - 2.3, 10, 1.2);
    cam(NEST.x - 1.2, NEST.y + 2.4, 8.2, NEST.x - 0.9, NEST.y + 1.45, 0.2, 32);
  }],
  // ===== FIN HEUREUSE =====
  [124, 128, (u) => {
    onGiraffe(D_TOP, { k: { ry: 1.0, hold: 0, look: [0.8, -0.4], headYaw: 0.3, eye: 1.3, brow: 1, aL: [1.6, -0.5], aR: [1.6, -0.5], blink: 0 }, m: { aL: [1.8, -0.6], aR: [1.8, -0.6], eye: 1.3, headPitch: -0.3 } });
    const cr = (T > 125.6) + (T > 126.6) + (T > 127.3), k = Math.max(boing(T - 125.6, 1), boing(T - 126.6, 1), boing(T - 127.3, 1), 0);
    E({ x: NEST.x, y: NEST.y + 0.22 + Math.abs(k) * 0.08, z: NEST.z, rz: Math.sin(u * 22) * (0.03 + 0.04 * u) + k * 0.25, crack: cr / 3 });
    cam(NEST.x + 0.3, NEST.y + 1.0, lerp(4.6, 3.9, u / 4), NEST.x - 0.25, NEST.y + 0.4, NEST.z, 30);
  }],
  [128, 132, (u) => {
    onGiraffe(D_TOP, { k: { ry: 1.0, hold: 0, look: [0.8, -0.3], headYaw: 0.3, eye: 1.3, brow: 1, y: giraffe.headTop().y - 0.32, sq: 1 + 0.06 * beat(), ear: Math.sin(u * 12) * 0.3, aL: [2.6, 0.5], aR: [2.6, 0.5], trunkUp: 0.9, mouth: Math.max(lip('koko'), 0.35) }, m: { aL: [1.6, -0.3 + beat() * 0.6], aR: [1.6, -0.3 + beat() * 0.6], mouth: 0.5 } });
    E({ x: NEST.x, y: NEST.y + 0.22, z: NEST.z, broken: true, top: u < 1.2 ? [Math.sin(u * 3) * 0.3, 0.3 + 2.2 * hop(u / 1.2) * (1 - u / 2.4) + 0.5 * (u / 1.2), 0, u * 8] : null });
    C({ x: NEST.x, y: NEST.y + 0.12 + hop((u - 1.6) / 0.4) * 0.25 + hop((u - 2.2) / 0.4) * 0.25, z: NEST.z, s: 0.42 * ss(0, 0.12, u) * (1 + 0.35 * Math.exp(-u * 5) * Math.cos(u * 18)), hat: u >= 1.2, wing: 0.5 + 0.5 * Math.sin(u * 16), look: [Math.sin(u * 2.5) * 0.8, 0.2], eye: 1.1, ry: Math.sin(u * 2.5) * 0.5 });
    fx.confetti(V(NEST.x, NEST.y + 0.4, NEST.z), u, 60, 0.75); fx.sparkle(V(NEST.x, NEST.y + 0.6, NEST.z), u, 16, 2.2, 1.3, 0xfff59a);
    cam(NEST.x - 0.7, NEST.y + 2.3, 8.2, NEST.x - 0.7, NEST.y + 1.4, 0.2, 34);
  }],
  [132, 136, (u) => {
    onGiraffe(D_TOP, { k: { ry: 1.0, hold: 0, look: [0.8, 0.5], headYaw: 0.4, eye: 1.2, brow: 1, aL: [0, 0.3], aR: [0, 0.3], trunkUp: 0.7 }, m: { aL: [0, 0.3], aR: [0, 0.3] } });
    E({ x: NEST.x, y: NEST.y + 0.22, z: NEST.z, broken: true });
    C({ x: NEST.x, y: NEST.y + 0.12 + beat() * 0.3, z: NEST.z, ry: 0.3, wing: 0.5 + 0.5 * Math.sin(u * 18), look: [0.3, 0.8], eye: 1.15 });
    const s = ss(0, 1.0, u), fl = s < 1;
    Ma({ x: lerp(NEST.x + 8, NEST.x + 0.25, s), y: lerp(NEST.y + 4.5, NEST.y - 0.22, s) + hop(s) * 1.2, z: lerp(-3, NEST.z - 1.45, s), ry: lerp(-1.2, -0.1, s), wing: fl ? 0.5 + 0.6 * Math.sin(u * 26) : 0.75 + 0.1 * Math.sin(u * 8), sq: 1 - boing(u - 1, 0.2), eye: 1.15, look: [-0.2, -0.6] });
    cam(NEST.x - 0.3, NEST.y + 1.9, 9, NEST.x + 0.1, NEST.y + 1.0, 0, 38);
  }],
  [136, 141, (u) => {
    const j = ss(0.3, 0.9, u), hug = ss(0.8, 1.4, u), mp = V(NEST.x + 0.25, NEST.y - 0.22, NEST.z - 1.45), sw = Math.sin(u * 2) * 0.07 * hug;
    onGiraffe(D_TOP, { k: { ry: 1.0, hold: 0, look: [0.8, 0.2], headYaw: 0.4, aL: [0, 0.3], aR: [0, 0.3] }, m: { aL: [0, 0.3], aR: [0, 0.3] } });
    E({ x: NEST.x, y: NEST.y + 0.22, z: NEST.z, broken: true });
    Ma({ ...P(mp), ry: -0.1, rz: sw, hug, blink: hug > 0.9 ? 1 : 0, headPitch: 0, wing: 0.3 * (1 - hug), look: [0, -0.6] });
    C({ x: lerp(NEST.x, mp.x - 0.05, j), y: lerp(NEST.y + 0.12, mp.y + 0.28, j) + hop(j) * 0.6, z: lerp(NEST.z, mp.z + 0.78, j), ry: lerp(0.3, 0.6, j), rz: sw * 2, blink: hug > 0.9 ? 1 : 0, wing: hug < 0.5 ? 0.5 + 0.5 * Math.sin(u * 18) : 0.1, look: [0, 0.6] });
    fx.hearts(V(mp.x, mp.y + 1.5, mp.z), u - 1.6, 7, 3); fx.sparkle(V(mp.x, mp.y + 1.6, mp.z + 0.6), u - 1.8, 10, 1.6);
    cam(NEST.x + 0.6, NEST.y + 1.2, lerp(4.2, 3.6, u / 5), NEST.x + 0.2, NEST.y + 0.7, NEST.z - 0.9, 32);
  }],
  [141, 146, (u) => {
    const kiss = hop((u - 2.3) / 0.7), after = ss(2.6, 3.0, u), cj = ss(3.4, 4.0, u);
    onGiraffe(D_TOP, { k: { ry: 0.7, hold: 0, look: [0.6, 0.3], blush: 1 + 0.9 * after, blink: after > 0.5 ? 1 : 0, ear: after * Math.sin(u * 14) * 0.3, aL: [0, 0.3], aR: [0, 0.3], trunkUp: 0.5 + 0.4 * after, brow: 0.6 }, m: { aL: [0, 0.3], aR: [0, 0.3], blink: undefined } });
    const kh = koko.headTop(), s = ss(0.2, 1.0, u), mp = V(NEST.x + 0.25, NEST.y - 0.22, NEST.z - 1.45);
    Ma({ x: lerp(mp.x, kh.x + 1.35 - kiss * 0.4, s), y: lerp(mp.y, kh.y - 1.15, s) + Math.sin(u * 6) * 0.06, z: lerp(mp.z, kh.z + 0.35, s), ry: lerp(-0.1, -0.9, s), wing: 0.5 + 0.5 * Math.sin(u * 24), look: [-0.5, 0] });
    E({ x: NEST.x, y: NEST.y + 0.22, z: NEST.z, broken: true });
    const mh = monkey.headTop();
    C({ x: lerp(NEST.x, mh.x, cj), y: lerp(NEST.y + 0.12 + beat() * 0.25, mh.y - 0.05, cj) + hop(cj) * 0.9, z: lerp(NEST.z, mh.z, cj), ry: 0, wing: 0.5 + 0.5 * Math.sin(u * 18) });
    fx.hearts(V(kh.x + 0.4, kh.y, kh.z + 0.3), u - 2.7, 6, 2.2); fx.sparkle(V(kh.x + 0.6, kh.y - 0.4, kh.z + 0.6), u - 3.5, 10, 1.4);
    cam(NEST.x - 1.3, NEST.y + 1.9, 7.4, NEST.x - 1.0, NEST.y + 1.15, 0, 34);
  }],
  [146, 150, (u) => {
    const ent = (i) => { const t0 = 0.2 + i * 0.5, s = ss(t0, t0 + 0.45, u); return u < t0 ? null : { y: (1 - s) * 8, sq: 1 - boing(u - t0 - 0.45, 0.3) }; };
    let e;
    if ((e = ent(0))) Tu({ x: DN - 4.4, z: 0.7, ry: 0.35, blush: 1.3, ...e });
    if ((e = ent(1))) M({ x: DN - 2.1, z: 1.0, ry: 0.2, aL: [3, 0.4], aR: [3, 0.4], ...e });
    if ((e = ent(2))) { K({ x: DN, z: 0.5, aL: [0, 1.8], aR: [0, 1.8], trunkUp: 0.8, ...e }); C({ ...P(koko.headTop(), 0, -0.08, 0), wing: 0.5 + 0.5 * Math.sin(u * 16) }); }
    if ((e = ent(3))) Ma({ x: DN + 2.5, z: 0.8, ry: -0.25, wing: 0.6, ...e });
    if ((e = ent(4))) G({ x: DN, z: -5.6, ry: 0, down: 0.3, ...e, y: e.y * 0.5 });
    fx.sparkle(V(DN, 4.5, 1), T - 149.4, 30, 2.5, 1.2, 0xfff59a);
    cam(DN, lerp(7, 3, ss(0, 3.4, u)), 15.5, DN, 3.0, 0, 44);
  }],
  // refrain n°3 : tout le monde danse
  [150, 154, (u) => { party(); cam(DN, 3.0, lerp(15.5, 14, u / 4), DN, 3.1, 0, 44); }],
  [154, 158, (u) => { party(); const x = lerp(DN - 4.6, DN + 3, ss(0, 4, u)); cam(x + 0.9, 2.0, 6.6, x, 1.55, 0.5, 34); }],
  [158, 162, (u) => {
    const fallT = ss(1.6, 2.2, u), upT = ss(3.2, 3.8, u), down = fallT * (1 - upT), help = ss(2.7, 3.2, u) * (1 - ss(3.8, 4, u));
    party({ noKoko: true, noChick: true, m: { x: DN - 2.1 + help * 0.9, y: help ? 0 : beat(0.5) * 0.6, ry: lerp(0.3, 1.2, help), rz: 0, aL: [help ? 1.5 : 3, 0.3], aR: [help ? 0.2 : 3, 0.3], mouth: Math.max(lip('monkey'), 0.3) } });
    K({ x: DN, y: hop((u - 1.6) / 0.6) * 0.5 - 0.28 * down + hop((u - 3.2) / 0.6) * 0.4, z: 0.5, ry: TAU * 2 * ss(0, 1.6, u) + lerp(0, -0.5, down), rz: Math.sin(u * 12) * 0.16 * ss(0.6, 1.6, u) * (1 - fallT), sit: down, sq: 1 - boing(u - 2.2, 0.25),
      aL: [0, down ? 0.6 : 1.9], aR: [down ? 1.4 * help : 0, down ? 0.6 : 1.9], trunkUp: 0.7, look: down && u < 3 ? [Math.cos(u * 9) * 0.8, Math.sin(u * 9) * 0.8] : [0, 0], eye: u > 1.5 && u < 2.3 ? 1.3 : 1, brow: 0.7, mouth: Math.max(lip('koko'), 0.3), blink: 0 });
    const kh = koko.headTop(), fly = ss(0.3, 0.8, u) * (1 - ss(2.5, 3.1, u));
    C({ ...P(kh, 0, -0.08 + fly * (1.0 + Math.sin(u * 5) * 0.15), 0), wing: 0.5 + 0.5 * Math.sin(u * 22), ry: Math.sin(u * 3) * 0.6 });
    if (down > 0.9 && u < 3.1) fx.twinkle(kh.clone().add(V(0, 0.5, 0)), T, 5, 0.8);
    cam(DN - 0.5, 2.1, 8.6, DN - 0.5, 1.6, 0.4, 35);
  }],
  [162, 166, (u) => {
    const fl = ss(3.0, 3.7, u);
    party({ k: { x: DN, y: beat() * 0.12, rz: sway() * 0.05, ry: 0, look: [0, 1], eye: 1.1, aL: [0, 1.4 + sway() * 0.4], aR: [0, 1.4 - sway() * 0.4] }, noChick: true });
    C({ ...P(koko.headTop(), 0, -0.08 + beat() * 0.2 + hop(fl) * 0.8, 0), ry: sway() * 1.3, rx: fl * TAU, rz: sway() * 0.25, wing: 0.5 + 0.5 * Math.sin(T * TAU * 2), eye: 1.1, mouth: Math.max(chirp(), 0.15) });
    fx.sparkle(koko.headTop().add(V(0, 1.2, 0)), u - 3.1, 10, 1.2);
    cam(DN + 0.35, 3.05, 4.6, DN, 2.75, 0.5, 30);
  }],
  [166, 170, (u) => {
    party({ ma: { x: DN + Math.cos(u * 1.8) * 4.2, y: 6 + Math.sin(u * 3.6) * 0.6, z: Math.sin(u * 1.8) * 2, ry: -u * 1.8, wing: 0.5 + 0.6 * Math.sin(u * 22) } });
    fx.sparkle(V(DN, 5, 1), u - 2, 30, 2.5, 1.4, 0xfff59a);
    const a = lerp(-0.45, 0.45, u / 4); cam(DN + Math.sin(a) * 15.5, lerp(3, 6.5, u / 4), Math.cos(a) * 15.5, DN, 2.4, -1, 42);
  }],
  [170, 176, (u) => {
    const wv = Math.sin(T * 10) * 0.35, cj = ss(4.6, 5.3, u), hatOnKoko = u >= 4.6;
    K({ x: DN, y: hop((u - 3.6) / 0.6) * 0.5 + beat() * 0.06, z: 0.5, aR: [0, 2.5 + wv], aL: [0, 0.3], trunkUp: 0.85, ear: Math.sin(T * 6) * 0.15, sing: true, hat: hatOnKoko, brow: 0.6 });
    M({ x: DN - 2.1, y: beat(0.5) * 0.25, z: 1.0, aL: [0, 2.5 + wv], aR: [0, 2.5 - wv], sing: true });
    Tu({ x: DN - 4.4, z: 0.7, ry: 0.35, headYaw: Math.sin(T * 5) * 0.3, blush: 1.3, sing: true });
    Ma({ x: DN + 2.5, y: beat() * 0.15, z: 0.8, ry: -0.25, wing: 0.6 + 0.4 * Math.sin(T * 10), sing: true });
    G({ x: DN, z: -5.6, ry: 0, down: 0.32 + Math.sin(T * 4) * 0.03, sway: Math.sin(T * 4), sing: true });
    const a = koko.headTop(), b = V(DN + 2.5, 1.85 + beat() * 0.15, 0.8);
    C({ x: lerp(a.x, b.x, cj), y: lerp(a.y - 0.08, b.y, cj) + hop(cj) * 1.4, z: lerp(a.z, b.z, cj), hat: !hatOnKoko, wing: 0.5 + 0.5 * Math.sin(T * 14), sq: 1 - boing(u - 5.3, 0.25), sing: true });
    fx.rain(DN, 1, T); fx.sparkle(V(DN, 3.0, 0.8), u - 4.6, 10, 1.3);
    cam(DN, 2.9, lerp(15, 12.5, ss(0, 6, u)), DN, 3.0, 0, 44);
  }],
  [176, 180.1, (u) => {
    const wk = ss(0.5, 0.65, u) * (1 - ss(1.0, 1.2, u));
    K({ x: DN, z: 0.5, ry: 0.15, hat: true, wink: wk, blink: 0, trunkUp: 0.9, ear: Math.sin(u * 5) * 0.15, headTilt: 0.12 * ss(0.3, 0.8, u), aR: [0, 2.4 + Math.sin(u * 9) * 0.3 * (u > 1.4 ? 1 : 0)], brow: 0.7, mouth: 0.45, blush: 1.3 });
    M({ x: DN - 2.1, z: -0.6, aL: [0, 2.5], aR: [0, 0.3] }); Ma({ x: DN + 2.4, z: -0.6, ry: -0.25, wing: 0.5 }); C({ x: DN + 2.4, y: 1.85, z: -0.6, hat: false });
    fx.sparkle(V(DN + 0.75, 2.25, 1.6), u - 0.5, 8, 1.0, 0.9); fx.sparkle(V(DN, 3.2, 1), u - 1.0, 24, 1.6, 1.5, 0xfff59a); fx.rain(DN, -1, T, 60);
    cam(DN + 0.6, 2.25, lerp(5.6, 4.9, u / 4), DN, 1.95, 0.4, 30);
  }],
];

window.FILM = { FPS, DUR, frames: FPS * DUR, shots: shots.map((s) => [s[0], s[1]]) };
window.renderFrame = (f) => {
  frame = f; T = f / FPS;
  for (const a of actors) a.root.visible = false;
  fx.reset(); W.update(T);
  const s = shots.find((x) => T >= x[0] && T < x[1]) || shots[shots.length - 1];
  s[2](T - s[0]);
  renderer.render(scene, camera);
};
window.capture = (f, quality = 0.93) => { window.renderFrame(f); return canvas.toDataURL('image/jpeg', quality); };

// aperçu en direct dans le navigateur (avec ?play=1)
if (q.get('play')) { const t0 = performance.now(); const loop = () => { window.renderFrame(Math.floor(((performance.now() - t0) / 1000 * FPS) % (FPS * DUR))); requestAnimationFrame(loop); }; loop(); }
else window.renderFrame(+(q.get('f') || 0));
window.ready = true;
