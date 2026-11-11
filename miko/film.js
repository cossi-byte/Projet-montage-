// « Miko Miko Bam » — comptine à gestes. Tout est une fonction pure du temps :
// renderFrame(n) dessine l'image n. Les gestes suivent miko/timing.json (frappes de mains, coups de pied).
// La chanson est jouée en 3 tours de plus en plus rapides : le temps vidéo est converti en temps « chanson ».
import * as THREE from 'three';
import { makeGiraffe, makeMonkey, lerp, clamp, ss, hop } from '../film/characters.js';
import { makeMalou, makeHippo } from './characters.js';
import { buildWorld, POND, BAOBAB } from './world.js';

const q = new URLSearchParams(location.search);
const WIDTH = +(q.get('w') || 1920), HEIGHT = Math.round(WIDTH * 9 / 16), FPS = 24;
const TM = await (await fetch('./timing.json')).json();
// tours : [début dans la chanson, vitesse] — mêmes valeurs que tools/miko_audio.sh
const TOURS = [[0, 0.88], [67.5, 1], [109.9, 1.15]], SONG = 146.42;
const vStart = []; { let v = 0; TOURS.forEach(([s, k], i) => { vStart.push(v); v += ((TOURS[i + 1] ? TOURS[i + 1][0] : SONG) - s) / k; }); vStart.push(v); }
const DUR = vStart[TOURS.length];
const songTime = (v) => { let i = TOURS.length - 1; while (i > 0 && v < vStart[i]) i--; return TOURS[i][0] + (v - vStart[i]) * TOURS[i][1]; };

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT, false); renderer.autoClear = false;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 400);
const W = buildWorld(scene), fx = W.fx;
const malou = makeMalou(scene), giraffe = makeGiraffe(scene), monkey = makeMonkey(scene), hippo = makeHippo(scene);
const actors = [malou, giraffe, monkey, hippo];

// ---- sous-titres (calque 2D par-dessus l'image)
const hud = new THREE.Scene(), hudCam = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0, 10);
const capCv = document.createElement('canvas'); capCv.width = 1920; capCv.height = 260;
const capTex = new THREE.CanvasTexture(capCv); capTex.colorSpace = THREE.SRGBColorSpace;
const capMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16 * 260 / 1920), new THREE.MeshBasicMaterial({ map: capTex, transparent: true, depthTest: false }));
capMesh.position.set(0, -3.3, -1); hud.add(capMesh);
let capShown = null;
function caption(text, big) {
  const key = text + big; if (key === capShown) return; capShown = key;
  const g = capCv.getContext('2d'); g.clearRect(0, 0, 1920, 260); if (!text) { capTex.needsUpdate = true; return; }
  let px = big ? 150 : 92; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  do { g.font = `bold ${px}px "DejaVu Sans", "Liberation Sans", sans-serif`; px -= 4; } while (g.measureText(text).width > 1780);
  g.lineWidth = px * 0.28; g.strokeStyle = '#5b2aa8'; g.strokeText(text, 960, 134);
  g.lineWidth = px * 0.12; g.strokeStyle = '#ffffff'; g.strokeText(text, 960, 134);
  g.fillStyle = big ? '#ff4d6d' : '#ffcf1f'; g.fillText(text, 960, 130);
  capTex.needsUpdate = true;
}

const R90 = Math.PI / 2, TAU = Math.PI * 2, B = TM.B;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let T = 0;                                                     // temps dans la chanson
const bt = () => (T - TM.T0) / B;                              // temps musicaux
const fr = (x) => x - Math.floor(x);
const beat = (ph = 0) => hop(fr(bt() + ph));                   // rebond sur chaque temps
const sway = () => Math.sin(bt() * Math.PI);                   // balancement sur 2 temps
const blinkAt = (seed) => ((T + seed * 1.37) % 3.4 < 0.13 ? 1 : 0);
const boing = (age, amp) => (age < 0 ? 0 : amp * Math.exp(-age * 6) * Math.cos(age * 20));
// mains : 1 quand elles se touchent (juste sur la frappe)
const clap = () => { let c = 0; for (const t of TM.claps) { const d = T - t; if (d > -0.2 && d < 0.22) c = Math.max(c, d < 0 ? ss(-0.2, 0, d) : 1 - ss(0.04, 0.22, d)); } return c; };
// pied : lift = jambe levée avant le coup, age = temps depuis le dernier coup
const stomp = () => { let lift = 0, age = 99; for (const t of TM.stomps) { const d = T - t; if (d < 0 && d > -0.36) lift = Math.max(lift, ss(-0.36, -0.1, d)); if (d >= 0 && d < age) age = d; } return { lift, age }; };
let shake = 0;
function cam(px, py, pz, tx, ty, tz, fov = 35) {
  const s = boing(stomp().age, 0.09) * shake;
  camera.position.set(px, py + s, pz); camera.lookAt(tx, ty + s * 0.6, tz); camera.fov = fov; camera.updateProjectionMatrix();
  W.focus(tx, 0, Math.min(tz, 2));
}

// ---------------------------------------------------------------- les danseurs
const GP = { x: 4.4, z: -3.6, s: 0.6 }, MP = { x: -2.9, z: 0.2, s: 1.35 }, HP = { x: POND.x + 0.5, z: POND.z + 0.6 };
const Ma = (p) => malou.set({ blink: blinkAt(0), ear: Math.sin(T * 3) * 0.06, ...p });
// Malou fait la danse : mi-ko = mains, bam = pied droit
function dance(o = {}) {
  const c = clap(), st = stomp(), s = sway(), k = o.energy ?? 1;
  const arm = [lerp(0.95, 1.3, c), lerp(0.75, -0.62, c)];
  Ma({ y: beat() * 0.1 * k, rz: s * 0.05 * k, ry: s * 0.12 * k, sq: 1 - boing(st.age, 0.16), aL: arm, aR: arm, kR: st.lift,
    trunkUp: 0.7 + 0.25 * c, ear: Math.sin(bt() * Math.PI) * 0.22 * k + boing(st.age, 0.5), mouth: Math.max(0.25, c * 0.7, st.age < 0.3 ? 0.9 : 0),
    headTilt: s * 0.08, brow: 0.4, ...o.m });
  fx.dust(malou.foot(), st.age, 9, o.dust ?? 1);
}
// les amis imitent Malou
function friends(o = {}) {
  const c = clap(), st = stomp(), s = sway(), j = hop(st.age / 0.38);
  giraffe.set({ ...GP, ry: -0.35, y: beat() * 0.1 + j * 0.25, down: 0.28 + c * 0.07, sway: s * 1.8, blink: blinkAt(3), mouth: 0.25 + c * 0.5, ...o.g });
  monkey.set({ ...MP, ry: 0.3, y: beat(0.5) * 0.12 + j * 0.7, rz: -s * 0.1, aL: [lerp(2.2, 2.9, c), lerp(0.7, -0.25, c)], aR: [lerp(2.2, 2.9, c), lerp(0.7, -0.25, c)],
    tail: 0.5 + 0.3 * Math.sin(T * 4), blink: blinkAt(1), mouth: 0.3 + c * 0.5, ...o.mk });
  fx.dust(V(MP.x, 0, MP.z), st.age - 0.36, 6, 0.6, 0.5);
  if (o.hippo !== false) hippoIn({ y: -0.75 + beat() * 0.12 + j * 0.3, mouth: 0.15 + c * 0.5, ...o.h });
}
const hippoIn = (p) => hippo.set({ ...HP, y: -0.75, ry: 0.75, blink: blinkAt(4), ...p });
// tout le monde par terre, les pattes en l'air
function fallen(f, laugh = 1) {
  const kick = Math.sin(T * 14), w = Math.sin(T * 11);
  Ma({ rx: -1.5 * f, y: 0.6 * f + hop(f) * 0.9, kL: f * (0.55 + kick * 0.35), kR: f * (0.55 - kick * 0.35), aL: [0.4, 1.3 + w * 0.3], aR: [0.4, 1.3 - w * 0.3],
    mouth: 0.5 + 0.4 * Math.abs(Math.sin(T * 9)) * laugh, blink: f > 0.5 ? 1 : 0, trunkUp: 1, ear: w * 0.2, blush: 1.4 });
  giraffe.set({ ...GP, ry: -0.35, rz: -1.45 * f, y: 0.5 * f + hop(f) * 0.7, x: GP.x + f * 1.2, down: 0.5, sway: w * f, blink: f > 0.5 ? 1 : 0, mouth: 0.6 * laugh });
  monkey.set({ ...MP, ry: 0.5, rx: -1.5 * f, y: 0.45 * f + hop(f) * 1.1, aL: [2.6, 0.9 + w * 0.3], aR: [2.6, 0.9 - w * 0.3], sit: f * (0.7 + kick * 0.2), blink: f > 0.5 ? 1 : 0, mouth: 0.6 * laugh, tail: 0.8 });
  hippoIn({ y: -0.75 - 0.5 * f + Math.abs(w) * 0.1 * f, mouth: 0.9 * f, blink: f > 0.5 ? 1 : 0, headPitch: 0.3 * f });
}

// ------------------------------------------------------------------------ plans
// [début, fin (temps de la chanson), fonction(u = temps depuis le début du plan)]
const C1 = TM.chorus, BAM = TM.BAM, ENC = TM.ENCORE, END = TM.END;
const shots = [
  // --- intro : Malou sort de derrière le baobab et fait coucou
  [0, 6.6, (u) => {
    const out = ss(1.2, 2.4, u), wv = Math.sin(T * 9) * 0.35 * ss(2.2, 2.8, u);
    Ma({ x: lerp(BAOBAB.x - 0.4, BAOBAB.x - 3.3, out), z: BAOBAB.z + 1.3, y: hop((u - 1.2) / 1.2) * 0.5, ry: -0.35, headTilt: 0.25 * (1 - out) + wv * 0.15, aR: [0, lerp(0.15, 2.5, ss(2, 2.6, u)) + wv], aL: [0, 0.3],
      mouth: u > 2 ? 0.25 + 0.3 * Math.abs(Math.sin(T * 7)) : 0, eye: 1.1, brow: 0.5, trunkUp: 0.8 });
    cam(lerp(-3, 2.2, ss(0, 6.6, u)), lerp(4.2, 2.4, ss(0, 5, u)), lerp(17, 4.6, ss(0, 6, u)), BAOBAB.x - 3, lerp(3.4, 1.7, ss(0, 4, u)), BAOBAB.z + 1, 36);
  }],
  [6.6, 11.9, (u) => {
    const go = ss(2.9, 5.1, u);
    Ma({ x: lerp(BAOBAB.x - 3.3, 0, go), z: lerp(BAOBAB.z + 1.3, 0, go), y: hop(fr(go * 4)) * 0.35 * (go < 1 ? 1 : 0), ry: lerp(-0.35, -1.1, ss(2.6, 3.1, u)) * (1 - ss(4.7, 5.2, u)),
      aL: go > 0 ? [0, 1.2] : [1.25, -0.35], aR: go > 0 ? [0, 1.2] : [1.25 * ss(1.6, 2.1, u), -0.35], headTilt: Math.sin(u * 3) * 0.12, eye: 1.15, mouth: 0.25 + 0.3 * Math.abs(Math.sin(T * 7)), brow: 0.6, trunkUp: 0.85 });
    const a = ss(2.6, 5.2, u);
    cam(lerp(2.6, 0, a), lerp(2.3, 2.3, a), lerp(4.4, 11.5, a), lerp(BAOBAB.x - 3.3, 0, a), lerp(1.75, 1.5, a), lerp(BAOBAB.z + 1.3, 0, a), 36);
  }],
  // --- tour 1, refrain x2 : plan fixe de face
  [11.9, C1[1] - 0.1, () => { shake = 1; dance(); cam(0, 2.3, 11.5, 0, 1.5, 0, 36); }],
  [C1[1] - 0.1, 26.3, (u) => { shake = 1; dance(); const a = lerp(0.5, -0.35, u / 7.3); cam(Math.sin(a) * 8.5, 1.9, Math.cos(a) * 8.5, 0, 1.45, 0, 34); }],
  // --- couplet 1 : les amis arrivent
  [26.3, 34.05, (u) => {
    const s = sway(), arr = ss(0.3, 3.2, u), c = clap(), up = ss(5.4, 5.9, u), wv = Math.sin(T * 9) * 0.3 * (1 - ss(1.6, 1.9, u));
    Ma({ y: beat() * 0.08, rz: s * 0.12 * ss(1.6, 2, u), ry: s * 0.2, aL: up ? [0, 2.6] : u > 3.4 ? [lerp(0.95, 1.3, c), lerp(0.75, -0.62, c)] : [0, 0.5 + wv * 2 + 1.6 * (1 - ss(1.6, 1.9, u))],
      aR: up ? [0, 2.6] : u > 3.4 ? [lerp(0.95, 1.3, c), lerp(0.75, -0.62, c)] : [0, 0.5 - wv * 2 + 1.6 * (1 - ss(1.6, 1.9, u))], mouth: 0.3 + 0.3 * Math.abs(Math.sin(T * 7)), trunkUp: 0.8, brow: 0.5 });
    giraffe.set({ ...GP, x: lerp(13, GP.x, arr), ry: lerp(-R90, -0.35, ss(2.6, 3.4, u)), walk: arr < 1 ? u * 7 : null, down: 0.28, sway: s, blink: blinkAt(3), mouth: 0.2 });
    monkey.set({ ...MP, x: lerp(-11, MP.x, arr), y: hop(fr(arr * 5)) * 0.8 * (arr < 1 ? 1 : 0) + beat(0.5) * 0.1, ry: lerp(R90, 0.3, ss(2.6, 3.4, u)), aL: [2.6, 0.5], aR: [2.6, 0.5], blink: blinkAt(1), mouth: 0.4, tail: 0.6 });
    hippoIn({ blink: 1 });
    cam(lerp(-2.5, 2, ss(0, 7.7, u)), 2.6, 13, lerp(-1, 1, ss(0, 7.7, u)), 1.9, -1, 38);
  }],
  // --- refrain x2 avec les amis
  [34.05, C1[3] - 0.1, () => { shake = 1; dance(); friends({ h: { blink: 1, y: -0.75, mouth: 0 } }); cam(0.6, 2.6, 13.5, 0.6, 2.0, -1, 38); }],
  [C1[3] - 0.1, 48.2, (u) => { shake = 1; dance(); friends({ h: { blink: 1, y: -0.75, mouth: 0 } }); cam(lerp(-3.5, -1.5, u / 7), 0.9, lerp(7.5, 6.5, u / 7), 0.3, 1.9, -0.8, 40); }],
  // --- couplet 2 : le pied tout là-haut… BAM ! … et l'hippopotame se réveille
  [48.2, 55.25, (u) => {
    const k = ss(0.2, 1.4, u) * (1 - ss(3.3, 3.7, u)), big = ss(3.6, 4.3, u);
    Ma({ kR: k * 1.25, y: beat() * 0.04, rz: k * 0.12, aL: [0, lerp(1.2, 1.5, big)], aR: [0, lerp(1.2, 1.5, big)], sq: 1 - big * 0.14, s: 1 + big * 0.12, headPitch: k * 0.3, look: [0, -k * 0.8], mouth: 0.3 + 0.3 * Math.abs(Math.sin(T * 7)), blush: 1 + big * 0.5, trunkUp: 0.7 });
    friends({ hippo: false, g: { y: 0, mouth: 0.2 }, mk: { y: 0, aL: [0, 0.3], aR: [0, 0.3], headTilt: 0.2, mouth: 0.2 } }); hippoIn({ blink: 1 });
    const a = ss(3.3, 4.2, u);
    cam(lerp(-3, 0, a), lerp(1.0, 2.2, a), lerp(7, 9.5, a), lerp(-0.1, 0, a), lerp(1.45, 1.6, a), 0, 36);
  }],
  [55.25, 58.0, (u) => {
    shake = 1.6; const st = stomp();
    Ma({ kR: Math.max(st.lift, ss(0, 1.2, u) * (st.age > 5 ? 1.1 : 0)), sq: 1 - boing(st.age, 0.22), aL: [0, 1.4], aR: [0, 1.4], ear: boing(st.age, 0.7), mouth: st.age < 0.6 ? 1 : 0.35, brow: 0.7, trunkUp: 0.9 });
    fx.dust(malou.foot(), st.age, 12, 1.3, 0.9);
    cam(-3, 0.9, 7, -0.1, 1.4, 0, 36);
  }],
  [58.0, 61.9, (u) => {
    fx.ripple(u); const wake = ss(0.5, 1.1, u), yawn = ss(1.3, 2.0, u) * (1 - ss(3.2, 3.8, u));
    hippoIn({ y: -0.75 + wake * 0.35 + boing(u, 0.15), blink: wake < 0.5 ? 1 : wake < 1 ? 0.5 : yawn > 0.5 ? 0.7 : 0, mouth: yawn, headPitch: yawn * 0.45, eye: 1 + 0.15 * wake });
    cam(HP.x + 4.6, 1.5, HP.z + lerp(8.2, 7.2, u / 4), HP.x + 0.4, 0.8, HP.z + 0.6, 32);
  }],
  // --- annonce : plus vite !
  [61.9, 67.55, (u) => {
    const j = [4.08, 4.58, 5.08].reduce((m, t) => Math.max(m, hop((u - t) / 0.42)), 0);
    Ma({ y: j * 0.55, sq: 1 + j * 0.08, aL: u < 2.8 ? [1.0, -0.5] : [0, 2.3], aR: u < 2.8 ? [1.0, -0.5] : [0, 2.3], headPitch: -0.1, eye: 1.25, brow: 0.9, mouth: 0.35 + 0.4 * Math.abs(Math.sin(T * 8)), ear: Math.sin(T * 10) * 0.2, trunkUp: 0.95, blush: 1.3 });
    friends({ g: { y: j * 0.3 }, mk: { y: j * 0.6, aL: [2.8, 0.4], aR: [2.8, 0.4] }, h: { blink: 0, y: -0.45 } });
    cam(lerp(1.2, 0.3, ss(0, 2.5, u)), 2.2, lerp(9, 4.4, ss(0, 2.2, u)) + ss(3.6, 4.2, u) * 3.5, 0, lerp(1.6, 1.9, ss(0, 2.2, u)) - ss(3.6, 4.2, u) * 0.3, 0, 34);
  }],
  // --- tour 2, refrain x2 : la caméra tourne autour des danseurs
  [67.55, 81.75, (u) => { shake = 1; dance(); friends(); const a = lerp(-0.75, 0.75, u / 14.2); cam(0.5 + Math.sin(a) * 13, lerp(2.2, 3.6, hop(u / 14.2)), -1 + Math.cos(a) * 13, 0.5, 1.9, -1, 38); }],
  // --- couplet 3 : la trompe avec le bras, puis on tourne
  [81.75, 88.85, (u) => {
    const up = ss(0.1, 0.9, u), sw = u > 3.5 ? Math.sin((u - 3.5) * TAU / (4 * B)) : 0;
    Ma({ y: beat() * 0.06, rz: sw * 0.14, aR: [lerp(0, 1.75, up) + sw * 0.25, -0.5 * up + sw * 0.5], aL: [0, 0.35], trunkSway: sw * 4, trunkUp: 0.5, headTilt: sw * 0.12, mouth: 0.3 + 0.3 * Math.abs(Math.sin(T * 7)), brow: 0.5 });
    friends({ g: { y: beat() * 0.08, sway: sw * 2.5 }, mk: { y: beat(0.5) * 0.1, aR: [1.75 + sw * 0.3, -0.3], aL: [0, 0.3] }, h: { y: -0.5 } });
    cam(lerp(1.8, 0.8, u / 7), 1.3, lerp(6.2, 5.4, u / 7), 0, 1.75, 0, 36);
  }],
  [88.85, 95.85, (u) => {
    const turn = ss(0.1, 3.3, u), rdy = ss(3.5, 4, u), pat = Math.abs(Math.sin(bt() * Math.PI));
    Ma({ ry: turn * TAU * 2, y: beat() * 0.1 + hop(turn) * 0.2, aL: rdy ? [0.5 + pat * 0.5, 0.1] : [0, 1.5], aR: rdy ? [0.5 + pat * 0.5, 0.1] : [0, 1.5], ear: 0.5 * hop(turn), sq: 1 - rdy * 0.08 * pat, mouth: 0.4, trunkUp: 0.9, brow: 0.6 });
    friends({ g: { ry: -0.35 + turn * TAU }, mk: { ry: 0.3 - turn * TAU * 2, aL: [0, 1.5], aR: [0, 1.5] }, h: { ry: 0.75 + turn * TAU, y: -0.5 } });
    cam(Math.sin(-turn * 0.6) * 12, 3.2, Math.cos(-turn * 0.6) * 12, 0.5, 1.7, -1, 38);
  }],
  // --- refrain
  [95.85, 102.3, () => { shake = 1; dance(); friends(); cam(0.6, 2.6, 13.5, 0.6, 2.0, -1, 38); }],
  // --- annonce : très, très vite !
  [102.3, 109.95, (u) => {
    const ears = ss(2.9, 3.5, u), go = hop((u - 5.4) / 0.7), sh = Math.sin(T * 30) * (u < 2.8 ? 0.25 : 0);
    Ma({ y: go * 0.9 - ears * 0.08 * (1 - ss(5.2, 5.4, u)), sq: 1 - ears * 0.12 * (1 - ss(5.2, 5.4, u)) + go * 0.1, aL: ears ? [lerp(0, 0.2, ears), lerp(1.2, 2.75, ears)] : [1.1, 0.5 + sh], aR: ears ? [lerp(0, 0.2, ears), lerp(1.2, 2.75, ears)] : [1.1, 0.5 - sh],
      ear: ears ? -0.3 : Math.sin(T * 12) * 0.25, eye: 1.25, brow: 0.9, mouth: 0.35 + 0.4 * Math.abs(Math.sin(T * 8)), trunkUp: 0.95, blush: 1.3 });
    friends({ g: { y: go * 0.4, down: 0.35 }, mk: { y: go * 0.9, aL: [2.9, 0.6 + sh], aR: [2.9, 0.6 - sh] }, h: { y: -0.45 } });
    cam(lerp(-1.5, 0, ss(0, 3, u)), 2.1, lerp(8, 4.6, ss(0, 3, u)) + ss(5, 5.6, u) * 5, 0, 1.85, 0, 34);
  }],
  // --- tour 3, refrain x2 au coucher du soleil : plans courts
  [109.95, 124.2, (u) => {
    shake = 1.4; W.dusk(1); dance({ dust: 1.3 }); friends(); fx.confetti(T, 0.5);
    const k = Math.floor(u / (8 * B)) % 4, w = fr(u / (8 * B));
    if (k === 0) cam(0.6, 2.6, 13.5 - w, 0.6, 2.0, -1, 38);
    else if (k === 1) cam(-2.6, 0.7, 6, -0.1, 1.3, 0, 38);
    else if (k === 2) cam(lerp(-6, -4.5, w), 1.6, 5.5, -0.8, 1.8, -0.5, 36);
    else cam(lerp(2.5, 1.5, w), 2.0, 5.2, 0, 1.9, 0, 34);
  }],
  // --- « miko… miko… » : tout doucement
  [124.2, BAM, (u) => {
    W.dusk(1); shake = 2.5; const st = stomp(), n = BAM - 124.2, up = ss(0.2, n - 0.25, u);
    Ma({ kR: Math.max(up * 1.2, st.lift), rz: up * 0.14, sq: 1 - 0.06 * up, aL: [0, 0.9 + up * 0.9], aR: [0, 0.9 + up * 0.9], eye: 1.3, brow: 1, mouth: 0.15, look: [0.6 * Math.sin(u * 3), 0], headYaw: 0.25 * Math.sin(u * 3), ear: 0.2, trunkUp: 1 });
    friends({ g: { y: 0, down: 0.45, sway: 0, mouth: 0.1 }, mk: { y: 0, rz: 0, aL: [1.4, -0.3], aR: [1.4, -0.3], mouth: 0.1 }, h: { y: -0.6, mouth: 0 } });
    cam(lerp(1.5, 0.4, u / n), lerp(1.9, 1.2, u / n), lerp(9.5, 5.6, u / n), 0, lerp(1.6, 1.3, u / n), 0, 36);
  }],
  // --- BAM ! tout le monde tombe
  [BAM, BAM + 2.3, (u) => {
    W.dusk(1); shake = 3; fallen(ss(0.05, 0.75, u));
    fx.dust(V(-0.3, 0, 0.3), u, 16, 1.7, 1.1); fx.dust(V(GP.x, 0, GP.z), u - 0.3, 10, 1.3, 0.9); fx.dust(V(MP.x, 0, MP.z), u - 0.25, 8, 1.2, 0.9); fx.ripple(u - 0.2);
    cam(0.6, lerp(2.4, 3.2, ss(0, 2.3, u)), 14, 0.6, 1.6, -1, 40);
  }],
  [BAM + 2.3, ENC - 2.2, (u) => { W.dusk(1); fallen(1); const a = u * 0.12; cam(0.5 + Math.sin(a) * 2.5, lerp(15, 12.5, ss(0, 2.5, u)), 3.2 + Math.cos(a), 0.5, 0, -1.4, 40); }],
  // --- « Encore ? » : Malou relève la tête… et c'est reparti
  [ENC - 2.2, ENC, (u) => {
    W.dusk(1); const f = 1 - ss(0.9, 1.9, u), peek = ss(0.1, 0.6, u) * f;
    fallen(f, f);
    Ma({ rx: -1.5 * f, y: 0.6 * f + hop(1 - f) * 0.6, headPitch: -peek * 1.1, kL: f * 0.5, kR: f * 0.5, aL: [0, lerp(2.4, 1.2, f)], aR: [0, lerp(2.4, 1.2, f)], eye: 1.2, brow: 0.9, mouth: 0.5, trunkUp: 1, blush: 1.4 });
    cam(lerp(0.8, 0.5, u / 2.2), lerp(2.0, 2.4, ss(0.8, 2.2, u)), lerp(7.5, 12, ss(0.8, 2.2, u)), 0.3, lerp(0.9, 1.9, ss(0.8, 2.2, u)), lerp(0, -1, ss(0.8, 2.2, u)), 38);
  }],
  [ENC, END, (u) => { W.dusk(1); shake = 1.4; dance({ dust: 1.3 }); friends(); fx.confetti(T); const a = lerp(0.6, -0.6, u / (END - ENC)); cam(0.5 + Math.sin(a) * 12.5, 2.8, -1 + Math.cos(a) * 12.5, 0.5, 1.9, -1, 38); }],
  // --- pose finale
  [END, 999, (u) => {
    W.dusk(1); shake = 2; const j = hop(u / 0.5), wk = ss(0.7, 0.85, u) * (1 - ss(1.15, 1.3, u));
    Ma({ y: j * 0.5, sq: 1 - boing(u - 0.5, 0.12), aL: [0, 2.5], aR: [0, 2.5], kR: 0, wink: wk, blink: 0, trunkUp: 1, mouth: 0.6, brow: 0.8, blush: 1.4, headTilt: 0.12 });
    friends({ g: { y: j * 0.3, down: 0.3, sway: 0 }, mk: { y: j * 0.6, rz: 0, aL: [2.9, 0.5], aR: [2.9, 0.5] }, h: { y: -0.4, mouth: 0.8 } });
    fx.dust(malou.foot(), u, 12, 1.6, 0.9); fx.confetti(T);
    cam(0.4, 2.3, lerp(10, 8.6, ss(0, 1.6, u)), 0.3, 1.85, -0.6, 36);
  }],
];

window.FILM = { FPS, DUR, frames: Math.round(FPS * DUR), shots: shots.map((s) => [s[0], s[1]]) };
window.renderFrame = (f) => {
  T = songTime(f / FPS);
  for (const a of actors) a.root.visible = false;
  fx.reset(); W.dusk(0); W.update(T); shake = 0;
  const s = shots.find((x) => T >= x[0] && T < x[1]) || shots[shots.length - 1];
  s[2](T - s[0]);
  const cp = TM.caps.filter((c) => T >= c[0] && T < c[1]).pop();
  caption(cp ? cp[2] : '', !!cp && (cp[2] === 'BAM !' || cp[2] === 'Miko Miko Bam'));
  renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); renderer.render(hud, hudCam);
};
window.capture = (f, quality = 0.93) => { window.renderFrame(f); return canvas.toDataURL('image/jpeg', quality); };
window.songToVideo = (s) => { let i = TOURS.length - 1; while (i > 0 && s < TOURS[i][0]) i--; return vStart[i] + (s - TOURS[i][0]) / TOURS[i][1]; };

if (q.get('play')) { const t0 = performance.now(); const loop = () => { window.renderFrame(Math.floor(((performance.now() - t0) / 1000 * FPS) % (FPS * DUR))); requestAnimationFrame(loop); }; loop(); }
else window.renderFrame(+(q.get('f') || 0));
window.ready = true;
