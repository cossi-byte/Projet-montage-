// « Balou l'éléphant » — épisode 1 : « Bonjour, je suis Balou ! »
// Générique (10 s) + 14 plans d'histoire + 6 plans de chanson. renderFrame(n) est une fonction pure du temps.
import * as THREE from 'three';
import { makeElephant, makePico, makeZazou, makeHippo, lerp, clamp, ss, hop } from '../lib/characters.js';
import { buildWorld, HOUSE, DOOR_Z, POST, PETALS, SHORE } from '../lib/world.js';

const q = new URLSearchParams(location.search);
const WIDTH = +(q.get('w') || 1920), HEIGHT = Math.round(WIDTH * 9 / 16), FPS = 24, DUR = 173;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 600);
const W = buildWorld(scene), fx = W.fx;
const balou = makeElephant(scene, 'balou'), maman = makeElephant(scene, 'maman'), pico = makePico(scene), zazou = makeZazou(scene), hippo = makeHippo(scene);
const actors = [balou, maman, pico, zazou, hippo];
let lips = {}; try { lips = await (await fetch('./lipsync.json')).json(); } catch (e) { /* pas encore de bande-son */ }

const R90 = Math.PI / 2, TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = (v, dx = 0, dy = 0, dz = 0) => ({ x: v.x + dx, y: v.y + dy, z: v.z + dz });
let T = 0, frame = 0;
const lip = (who) => (lips[who] ? lips[who][frame] || 0 : 0);
const blinkAt = (seed) => ((T + seed * 1.37) % 3.6 < 0.13 ? 1 : 0);
const boing = (age, amp) => (age < 0 ? 0 : amp * Math.exp(-age * 6) * Math.cos(age * 20));
const SONG = 103, BEAT = 0.6;
const frac = (x) => ((x % 1) + 1) % 1;
const beat = (ph = 0) => hop(frac((T - SONG) / BEAT + ph));       // rebond sur chaque temps (100 bpm)
const sway = () => Math.sin((T - SONG) / BEAT * Math.PI);          // balancement sur 2 temps
const wave = (sp = 10, a = 0.35) => Math.sin(T * sp) * a;
const choir = () => Math.max(lip('balou'), lip('kid1'));
function cam(px, py, pz, tx, ty, tz, fov = 35) {
  camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); camera.fov = fov; camera.updateProjectionMatrix();
  W.focus(tx, 0, Math.min(tz, 2));
}
const cl = (p) => { for (const k in p) if (p[k] === undefined) delete p[k]; return p; };
const B = (p) => { cl(p); const m = Math.max(lip('balou'), p.sing ? choir() * 0.6 : 0); balou.set({ blink: blinkAt(0), mouth: m, trunkUp: 0.25 + m * 0.35, ear: Math.sin(T * 3) * 0.06, ...p }); };
const Ma = (p) => { cl(p); const m = lip('maman'); maman.set({ s: 1.3, blink: blinkAt(1), mouth: m, trunkUp: 0.2 + m * 0.2, ear: Math.sin(T * 2) * 0.05, ...p }); };
const Pi = (p) => { cl(p); pico.set({ blink: blinkAt(2), mouth: Math.max(lip('pico'), p.sing ? choir() : 0), wing: 0.15 + 0.1 * Math.sin(T * 3), ...p }); };
const Z = (p) => { cl(p); zazou.set({ s: 0.72, blink: blinkAt(3), mouth: Math.max(lip('zazou'), p.sing ? choir() * 0.7 : 0), ...p }); };
const H = (p) => { cl(p); hippo.set({ blink: blinkAt(4), mouth: Math.max(lip('hippo'), p.sing ? choir() * 0.7 : 0), ...p }); };
const flap = (sp = 30) => 0.5 + 0.5 * Math.sin(T * sp);
const onHead = (extra = {}) => Pi({ ...P(balou.headTop(), 0, -0.06 + beat() * 0.12, 0), ry: 0, wing: flap(18), sing: true, ...extra });

const BX = 1.6, BZ = 0.2;            // Balou dans le jardin, face à la barrière
const MX = -0.8, MZ = 1.2;           // Maman dans le jardin
const picoPost = (extra = {}) => Pi({ ...P(POST, 0, 0.02, 0), ry: -1.2, bag: true, ...extra });

const shots = [
  // ===== GÉNÉRIQUE : Balou glisse sur l'arc-en-ciel =====
  [0, 10, (u) => {
    W.rainbow(true);
    const th = lerp(0.56 * Math.PI, 0.1, ss(1.4, 5.5, u));
    if (u < 5.5) {
      const r = W.rainbowPoint(th, 0.42), slope = clamp(R90 - th, -0.4, 1.4);
      B({ ...P(r, 0, -0.28, 0.25), ry: R90, rx: slope * 0.55, sit: 1, aL: [0, 1.9 + (u < 1.4 ? wave(9, 0.4) : 0.3)], aR: [0, 1.9 + (u < 1.4 ? -wave(9, 0.4) : 0.3)], trunkUp: 0.9, eye: 1.15, brow: 0.8, mouth: u > 1.4 ? 0.6 : 0, ear: -0.3 + Math.sin(u * 14) * 0.1 });
      if (u > 1.4) fx.sparkle(balou.headTop(), (u - 1.4) % 0.6, 6, 0.8, 0.6, 0xfff59a);
    } else {
      const s = ss(5.5, 6.0, u), a = W.rainbowPoint(0.1, 0.42);
      const land = u >= 6.0, turn = ss(6.1, 6.6, u);
      B({ x: lerp(a.x, 2.6, s), y: land ? 0 : lerp(a.y - 0.28, 0, s) + hop(s) * 1.2, z: lerp(-1.75, 1.0, s), ry: lerp(R90, 0.15, turn), sq: 1 - boing(u - 6.0, 0.3),
        aR: u > 6.6 ? [0.2, 2.5 + wave(10, 0.35)] : [0, 1.2], aL: [0, 0.3], trunkUp: 0.8, eye: 1.1, brow: 0.6, mouth: land && u < 6.5 ? 0.5 : undefined });
    }
    if (u > 6.1) { const k = ss(6.1, 6.6, u), sc = 2.4 * (k + 0.25 * Math.sin(k * Math.PI)); W.title.visible = true; W.title.position.set(-2.5, 10.4 + Math.sin(u * 2) * 0.1, 0); W.title.scale.set(sc * 6.25, sc, 1); }
    fx.sparkle(V(-2.5, 10.4, 0.5), u - 6.2, 20, 3, 1.3, 0xfff59a);
    const k = ss(6.5, 10, u);
    cam(lerp(-2.5, -1.0, k), lerp(5.2, 4.6, k), lerp(23, 19, k), lerp(-2.5, -1.2, k), lerp(5.4, 5.0, k), -1, 42);
  }],
  // ===== 1. La porte s'ouvre : « Pouêt-pouêt, c'est parti ! » =====
  [10, 17, (u) => {
    W.door(ss(0.2, 0.8, u));
    const s = ss(0.6, 1.6, u), joy = ss(1.9, 2.3, u);
    if (u > 0.45) B({ x: 0, y: hop(s) * 0.9, z: lerp(DOOR_Z - 0.4, -1.2, s), ry: 0, sq: 1 - boing(u - 1.6, 0.3), aL: [0, lerp(0.3, 2.6, joy) + wave(8, 0.2) * joy], aR: [0, lerp(0.3, 2.6, joy) - wave(8, 0.2) * joy],
      trunkUp: lerp(0.4, 1, joy), eye: 1.12, brow: 0.7 + 0.3 * joy, ear: Math.sin(u * 9) * 0.2 * joy });
    fx.sparkle(V(0, 3.4, -1), u - 2.4, 14, 1.5, 1.2, 0xfff59a);
    cam(1.2, 2.6, lerp(9.2, 8.4, u / 7), 0, 2.2, -3.0, 40);
  }],
  // ===== 2. « Bonjour les copains ! Je suis Balou ! » =====
  [17, 23, (u) => {
    B({ x: 0, z: -1.2, ry: 0.05, aR: [0.3, 2.4 + wave(10, 0.35)], aL: [0, 0.25], headTilt: 0.08 * Math.sin(u * 2), eye: 1.08, brow: 0.6, ear: Math.sin(u * 6) * 0.12, blush: 1.2 });
    fx.sparkle(V(-0.9, 2.7, -1.0), u - 0.3, 10, 1.0);
    cam(0.25, 2.05, lerp(3.2, 2.9, u / 6), 0, 1.95, -1.2, 30);
  }],
  // ===== 3. « Et toi, comment tu t'appelles ? » (pause pour l'enfant) =====
  [23, 30, (u) => {
    const lean = ss(0.1, 0.7, u);
    B({ x: 0, z: -1.2, ry: 0, rx: 0.16 * lean, aR: [0.3, lerp(0.3, 2.65, lean)], aL: [0, 0.25], headTilt: -0.2 * lean, look: [0, 0.1], eye: 1.1, brow: 0.8 * lean, ear: lerp(0, 0.25, lean) + Math.sin(u * 5) * 0.05 });
    cam(0.3, 1.9, lerp(4.7, 4.0, u / 7), 0, 1.75, -1.2, 32);
  }],
  // ===== 4. Pico arrive sur la barrière : « Oh ! Un nouveau voisin ! » =====
  [30, 36, (u) => {
    const s = ss(0, 2.2, u), turn = ss(1.4, 2.0, u);
    B({ x: 1.0, z: BZ, ry: lerp(0.35, 1.1, turn), headPitch: 0.15 * turn, look: [0.3 * turn, 0.3 * turn], eye: 1 + 0.25 * ss(2.0, 2.4, u), brow: turn, trunkUp: 0.3 + 0.5 * ss(2.4, 2.8, u) });
    const fly = V(lerp(7.5, POST.x, s), lerp(4.6, POST.y + 0.02, s) + Math.sin(s * Math.PI) * 0.8, lerp(-1.5, 0, s));
    Pi({ ...P(fly), ry: lerp(-0.8, -1.2, s), bag: true, wing: s < 1 ? flap(34) : 0.15, sq: 1 - boing(u - 2.2, 0.25), rz: s < 1 ? Math.sin(u * 6) * 0.15 : 0 });
    cam(2.4, 2.3, 8.8, 2.3, 1.3, 0, 38);
  }],
  // ===== 5. Balou est timide =====
  [36, 42, (u) => {
    picoPost();
    B({ x: 1.0, z: BZ, ry: 0.6, aL: [1.1, -0.45], aR: [1.1, -0.45], blush: 1.9, ear: Math.sin(u * 14) * 0.22, headTilt: 0.15 * Math.sin(u * 1.6), look: [0.6, -0.35], brow: -0.3, trunkUp: 0.15, trunkSway: Math.sin(u * 3) * 1.5 });
    cam(2.2, 2.0, 3.6, 1.0, 1.9, BZ, 30);
  }],
  // ===== 6. Essai raté n°1 : la trompe-hélice =====
  [42, 49, (u) => {
    const on = ss(0.6, 1.0, u) * (1 - ss(4.4, 4.8, u)), ang = 24 * (clamp(u, 0.6, 4.8) - 0.6) - 4 * Math.max(0, u - 4.6) ** 2;
    B({ x: BX, z: BZ, ry: R90 * 0.85, trunkUp: lerp(0.3, 0.55, on), trunkSpin: on > 0 ? ang : 0, rz: Math.sin(u * 30) * 0.03 * on + Math.sin(u * 5) * 0.08 * ss(4.6, 5, u), eye: 1.15, brow: 0.8, ear: Math.sin(u * 25) * 0.3 * on });
    picoPost({ eye: 1 + 0.3 * on, sq: 1 + 0.06 * Math.sin(u * 20) * on, rz: Math.sin(u * 22) * 0.12 * on, wing: 0.15 + 0.6 * on, look: [0.4, 0.2] });
    cam(2.5, 1.8, 6.2, 2.5, 1.45, 0, 34);
  }],
  // ===== 7. Balou tourne comme une toupie et tombe dans les pétales =====
  [49, 56, (u) => {
    const s = ss(0.1, 1.5, u), down = u >= 1.5;
    if (!down) B({ x: lerp(BX, PETALS.x, s), y: hop(s) * 0.7, z: lerp(BZ, PETALS.z, s), ry: R90 * 0.85 + TAU * 2 * s, aL: [0, 1.4], aR: [0, 1.4], eye: 1.2, brow: 1, mouth: 0.6 });
    else {
      const happy = ss(4.6, 5.2, u);
      B({ x: PETALS.x, y: -0.28, z: PETALS.z, ry: lerp(0.4, 0.9, happy), sit: 1, sq: 1 - boing(u - 1.5, 0.3), aL: [0.3, 0.6], aR: [0.3, 0.6], blink: 0,
        look: happy < 0.5 ? [Math.cos(u * 9) * 0.8, Math.sin(u * 9) * 0.8] : [0.6, 0.3], eye: 1.1, brow: 0.5, mouth: happy > 0.5 ? 0.4 : undefined, blush: 1.5 });
      if (u < 4.6) fx.twinkle(balou.headTop().add(V(0, 0.45, 0)), T, 5, 0.75);
    }
    fx.petals(V(PETALS.x, 0.4, PETALS.z), u - 1.5, 40);
    picoPost({ y: POST.y + 0.02 + (u > 2 ? beat() * 0.25 : 0), wing: u > 2 ? flap(20) : 0.15, ry: -0.8, headTilt: Math.sin(u * 8) * 0.1, look: [0.5, -0.4] });
    cam(2.0, 2.4, 9.2, 1.9, 1.0, 0.4, 38);
  }],
  // ===== 8. Essai raté n°2 : « Au revoir ! » =====
  [56, 62, (u) => {
    const bow = ss(1.2, 1.6, u) * (1 - ss(2.6, 3.0, u));
    B({ x: BX, z: BZ, ry: R90, rx: 0.5 * bow, aR: [1.2 * bow, -0.5 * bow + 0.15], aL: [0.4 * bow, 0.15], eye: 1.05, brow: 0.4, look: [0, -0.3 * bow] });
    const puzzled = ss(2.8, 3.2, u);
    picoPost({ headTilt: 0.35 * puzzled, blink: (u > 3.3 && u < 3.45) || (u > 3.7 && u < 3.85) ? 1 : 0, eye: 1 + 0.15 * puzzled, look: [0.3, 0.2] });
    cam(2.6, 1.7, 5.8, 2.6, 1.3, 0, 34);
  }],
  // ===== 9. « Oups ! Ça, c'est pour partir ! » =====
  [62, 68, (u) => {
    const cov = ss(0.15, 0.45, u) * (1 - ss(1.3, 1.7, u)), shy = ss(1.6, 2.2, u);
    B({ x: BX, z: BZ, ry: 0.5, trunkCover: cov, eye: lerp(1.35, 1.0, shy), brow: lerp(1, 0.3, shy), ear: 0.3 * (1 - shy) + Math.sin(u * 10) * 0.08, blush: lerp(1.2, 1.9, shy), headTilt: 0.15 * shy, smile: 1, look: [0.2, 0] });
    cam(2.7, 2.0, 3.4, BX, 1.9, BZ, 30);
  }],
  // ===== 10. Maman arrive : « Mon Balou, j'ai une idée. » =====
  [68, 75, (u) => {
    const s = ss(0, 2.6, u), turnM = ss(2.5, 3.1, u), turnB = ss(1.0, 1.6, u);
    Ma({ x: lerp(-5.5, MX, s), z: MZ, ry: lerp(R90, 0.95, turnM), walk: u < 2.6 ? u * 6 : null, can: true, look: [0.3, 0] });
    B({ x: BX, z: BZ, ry: lerp(R90, -1.25, turnB), eye: 1.1, brow: 0.6, look: [-0.2, 0.3] });
    picoPost({ ry: -0.6 });
    cam(0.4, 2.6, 10.5, 0.3, 1.7, 0.5, 38);
  }],
  // ===== 11. « Un sourire, un petit coucou, et bonjour ! » =====
  [75, 82, (u) => {
    const w = ss(1.5, 1.9, u);
    Ma({ x: MX, z: MZ, ry: 0.75, can: true, aR: [0.3, lerp(0.2, 2.1, w) + wave(6, 0.25) * w], headTilt: 0.1 * Math.sin(u * 1.5), eye: 1.05, brow: 0.4, blush: 1.2 });
    fx.sparkle(V(MX + 0.2, 3.1, MZ + 0.6), u - 4.9, 10, 1.0);
    cam(1.0, 2.75, 6.6, MX, 2.45, MZ, 30);
  }],
  // ===== 12. Essai réussi : « Bonjour ! Je m'appelle Balou. J'ai cinq ans. » =====
  [82, 89, (u) => {
    const w = ss(0.5, 0.9, u);
    B({ x: BX, z: BZ, ry: 1.05, aR: [0.3, lerp(0.2, 2.2, w) + wave(6, 0.25) * w], eye: 1.08, brow: 0.5, blush: 1.3, trunkUp: 0.45, headTilt: 0.06 * Math.sin(u * 2) });
    picoPost({ look: [0.3, 0.2], eye: 1 + 0.15 * ss(1, 1.5, u), wing: 0.15 + 0.4 * ss(4.4, 4.8, u) });
    fx.sparkle(V(POST.x - 0.2, 1.6, 0.2), u - 4.6, 14, 1.4, 1.2, 0xfff59a);
    cam(2.6, 1.8, 6.0, 2.6, 1.35, 0, 34);
  }],
  // ===== 13. « Bonjour Balou ! Moi, c'est Pico ! Je parle beaucoup ! » =====
  [89, 96, (u) => {
    const s = ss(0, 0.8, u);
    Pi({ x: lerp(POST.x, 3.0, s), y: lerp(POST.y + 0.02, 1.95, s) + Math.sin(u * 4) * 0.1 * s, z: lerp(0, 0.35, s), ry: -1.0, bag: s < 0.5, wing: s > 0 ? flap(30) : 0.15, eye: 1.12 });
    B({ x: BX, z: BZ, ry: 1.05, eye: 1.15, brow: 0.6, blush: 1.4, trunkUp: 0.5, headPitch: 0.15, look: [0, 0.3] });
    fx.hearts(V(3.0, 2.3, 0.35), u - 1.0, 5, 3);
    cam(2.3, 2.0, 5.2, 2.4, 1.75, 0.2, 34);
  }],
  // ===== 14. Tope-là ! « Youpi ! On chante la chanson du bonjour ? » =====
  [96, 103, (u) => {
    const up = ss(0.8, 1.35, u), turn = ss(1.9, 2.4, u);
    Pi({ x: 2.55, y: 2.25 + Math.sin(u * 4) * 0.08, z: 0.25, ry: -1.2, wing: u > 1.2 && u < 1.8 ? 1 : flap(30), eye: 1.1 });
    B({ x: BX, z: BZ, ry: lerp(R90, 0.3, turn), trunkUp: lerp(0.4, 1.0, up * (1 - turn * 0.4)), aL: [0, lerp(0.2, 2.2, turn)], aR: [0, lerp(0.2, 2.2, turn)], eye: 1.15, brow: 0.8, ear: Math.sin(u * 10) * 0.2 * turn });
    Ma({ x: MX, z: MZ, ry: 0.9, can: false, aL: [1.3, -0.15 - 0.35 * (0.5 + 0.5 * Math.sin(T * 12))], aR: [1.3, -0.15 - 0.35 * (0.5 + 0.5 * Math.sin(T * 12))], eye: 1.05 });
    fx.sparkle(V(2.4, 2.35, 0.3), u - 1.35, 16, 1.4, 1.2, 0xfff59a);
    cam(0.9, 2.5, 10.2, 0.9, 1.6, 0.5, 38);
  }],
  // ===== CHANSON — 15. Refrain 1 : Balou et Pico dansent =====
  [103, 115, (u) => {
    const b = beat(), s = sway();
    B({ x: 0.8, y: b * 0.25, z: 0.9, rz: s * 0.1, ry: s * 0.3, aL: [0, 1.7 + s * 0.8], aR: [0, 1.7 - s * 0.8], trunkUp: 0.8 + 0.2 * Math.sin(T * 5), ear: Math.sin(T * 5) * 0.3, sing: true });
    Pi({ x: 2.5, y: beat(0.5) * 0.55, z: 0.9, ry: -0.4 + s * 0.4, wing: flap(20), sing: true });
    Ma({ x: -2.4, z: -1.0, ry: 0.5, aL: [1.3, -0.15 - 0.35 * beat()], aR: [1.3, -0.15 - 0.35 * beat()], y: beat(0.5) * 0.08 });
    const k = u / 12; cam(lerp(0.4, 1.2, k), 2.4, lerp(9.6, 8.6, k), lerp(0.3, 0.8, k), 1.5, 0, 38);
  }],
  // ===== 16. Couplet 1 : « Je m'appelle Balou, j'ai cinq ans » =====
  [115, 127, (u) => {
    const t = T, five = ss(118.5, 118.8, t) * (1 - ss(121.4, 121.7, t)), proud = ss(119.8, 120.1, t) * (1 - ss(122.0, 122.3, t)), trunk = ss(122.8, 123.4, t) * (1 - ss(124.6, 125.0, t)), hi = ss(124.6, 124.9, t);
    let aL = [0, 0.5 + 0.8 * beat()], aR = [0, 0.5 + 0.8 * beat(0.5)];
    if (five) aR = [0.3, lerp(0.5, 2.7, five)];
    if (proud) { aL = [0.9, -0.4]; aR = [0.9, -0.4]; }
    if (hi) { aL = [0, 2.4 + wave(10, 0.3)]; aR = [0, 2.4 - wave(10, 0.3)]; }
    B({ x: 0.8, y: beat() * 0.06, z: 0.9, ry: 0.15, aL, aR, trunkUp: lerp(0.45, 1.0, trunk), sq: 1 + 0.05 * proud, eye: 1.08, brow: 0.6, blush: 1.2 + 0.4 * proud, headTilt: sway() * 0.08, sing: true });
    if (five) { const h = balou.handR(); W.five.visible = true; W.five.position.set(h.x, h.y + 0.55, h.z + 0.1); W.five.scale.setScalar(0.6 * five); }
    if (t > 124) fx.sparkle(balou.trunkTip(), t - 124.2, 12, 1.0, 1.0, 0xfff59a);
    cam(1.2, 2.0, 5.6, 0.8, 1.75, 0.9, 32);
  }],
  // ===== 17. Refrain 2 : Balou sautille jusqu'au lac =====
  [127, 139, (u) => {
    const x = lerp(3, 14, u / 12), z = 1.2 + Math.sin((x - 1) / 19 * Math.PI) * 0.8;
    B({ x, y: beat() * 0.35, z, ry: R90, walk: T * 2 * Math.PI / (BEAT * 2), headYaw: -0.85, aR: [0.3, 2.4 + wave(10, 0.35)], trunkUp: 0.7, ear: Math.sin(T * 5) * 0.25, sing: true });
    onHead();
    cam(x + 0.4, 2.2, z + 8.4, x, 1.4, z, 38);
  }],
  // ===== 18. Couplet 2 : bonjour Zazou, bonjour Monsieur Hippo =====
  [139, 151, (u) => {
    const t = T, toCam = ss(146.0, 146.5, t), zw = ss(143.8, 144.1, t) * (1 - ss(146.0, 146.4, t)), hw = ss(144.9, 145.2, t) * (1 - ss(146.6, 147.0, t)), all = ss(148.5, 148.8, t);
    let aR = [0.3, 2.3 + wave(10, 0.3)];
    if (toCam && !all) aR = [0.3, 2.65];
    B({ x: 18.6, y: beat() * 0.08, z: 0.8, ry: lerp(0.9, 0.1, toCam), headPitch: t < 143.8 ? 0.3 : 0, headTilt: toCam && !all ? -0.2 : 0, aR, aL: all ? [0, 2.3 - wave(10, 0.3)] : [0, 0.3], eye: 1.08, brow: 0.6, sing: true });
    onHead({ ry: lerp(0.9, 0.1, toCam), wing: t < 143.8 ? 1 : flap(18) });
    Z({ x: 22.2, z: -2.6, ry: -0.6, down: 0.38, wave: zw > 0 ? 0.9 + 0.3 * Math.sin(T * 8) : 0, sway: Math.sin(T * 3) * 0.6 * Math.max(zw, all), y: all ? beat() * 0.1 : 0, look: [0.3, 0] });
    H({ x: 24.4, z: -0.6, ry: -0.9, aR: [0.3, lerp(0.2, 2.4, Math.max(hw, all)) + wave(9, 0.3) * Math.max(hw, all)], aL: all ? [0, 2.3] : [0, 0.2], y: all ? beat(0.5) * 0.12 : 0, look: [0.2, 0] });
    cam(21.2, 3.4, 12.6, 21.4, 2.4, -1.0, 42);
  }],
  // ===== 19. Refrain 3 : la ronde au bord du lac =====
  [151, 163, (u) => {
    const a0 = 0.3 * u, cx = SHORE.x, cz = 0.4;
    const pos = (k) => { const a = a0 + k * TAU / 3; return { x: cx + Math.sin(a) * 2.7, z: cz + Math.cos(a) * 1.3, ry: Math.sin(a) * 0.5 }; };
    const b = beat(), s = sway();
    B({ ...pos(0), y: b * 0.25, rz: s * 0.08, aL: [0, 1.8 + s * 0.6], aR: [0, 1.8 - s * 0.6], trunkUp: 0.85, ear: Math.sin(T * 5) * 0.3, sing: true });
    Ma({ ...pos(1), y: beat(0.5) * 0.18, rz: -s * 0.06, aL: [0, 1.6 - s * 0.5], aR: [0, 1.6 + s * 0.5], trunkUp: 0.6, mouth: lip('maman') });
    H({ ...pos(2), y: b * 0.15, rz: s * 0.06, aL: [0, 2.0 + s * 0.5], aR: [0, 2.0 - s * 0.5], sing: true });
    Z({ x: cx, z: -3.6, ry: 0, down: 0.32, sway: s * 2, y: b * 0.1, sing: true });
    Pi({ x: cx + Math.cos(u * 1.2) * 1.6, y: 3.2 + Math.sin(u * 2.4) * 0.3, z: cz + Math.sin(u * 1.2) * 0.8, ry: -u * 1.2, wing: flap(30), sing: true });
    fx.rain(cx, 0, T, 90, 8, 18);
    cam(cx, 4.0, 13.6, cx, 2.0, -0.6, 44);
  }],
  // ===== 20. Coucher de soleil : « À bientôt les copains, pouêt ! » =====
  [163, 173.1, (u) => {
    W.sunset(lerp(0.55, 1, ss(0, 4, u)));
    const toot = ss(5.4, 5.7, u) * (1 - ss(6.6, 7.0, u)), wk = ss(7.2, 7.35, u) * (1 - ss(7.7, 7.9, u));
    B({ x: SHORE.x, z: 0.6, ry: -0.1, aR: [0.3, 2.4 + wave(8, 0.35)], aL: [0, 0.3], trunkUp: lerp(0.45, 1.0, toot), wink: wk, eye: 1.08, brow: 0.6, blush: 1.4, headTilt: 0.08 * Math.sin(u * 1.5), ear: Math.sin(u * 4) * 0.12 });
    onHead({ wing: 0.5 + 0.5 * Math.sin(T * 14), mouth: 0 });
    fx.sparkle(balou.trunkTip(), u - 5.6, 14, 1.2, 1.2, 0xfff59a);
    cam(SHORE.x + 0.25, 2.15, lerp(6.4, 5.7, u / 10), SHORE.x, 2.05, 0.6, 32);
  }],
];

window.FILM = { FPS, DUR, frames: FPS * DUR, shots: shots.map((s) => [s[0], s[1]]) };
window.renderFrame = (f) => {
  frame = f; T = f / FPS;
  for (const a of actors) a.root.visible = false;
  fx.reset(); W.door(0); W.update(T);
  const s = shots.find((x) => T >= x[0] && T < x[1]) || shots[shots.length - 1];
  s[2](T - s[0]);
  renderer.render(scene, camera);
};
window.capture = (f, quality = 0.93) => { window.renderFrame(f); return canvas.toDataURL('image/jpeg', quality); };
if (q.get('play')) { const t0 = performance.now(); const loop = () => { window.renderFrame(Math.floor(((performance.now() - t0) / 1000 * FPS) % (FPS * DUR))); requestAnimationFrame(loop); }; loop(); }
else window.renderFrame(+(q.get('f') || 0));
window.ready = true;
