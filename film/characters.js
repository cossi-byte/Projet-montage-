// Personnages de « Koko et le petit œuf » — tout est construit en formes rondes.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
export const hop = (u) => (u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u));
export function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const SPH = new THREE.SphereGeometry(1, 32, 24);
const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o }));
  return matCache.get(key);
}
export function ball(parent, r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o) {
  const m = new THREE.Mesh(SPH, mat(color, o));
  m.scale.set(r * sx, r * sy, r * sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
// membre : pivot en haut, capsule qui pend vers le bas
function limb(parent, r, len, color, x, y, z) {
  const g = grp(parent, x, y, z);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat(color));
  m.position.y = -len / 2; m.castShadow = true; m.receiveShadow = true; g.add(m); return g;
}
function eye(parent, r, x, y, z) {
  const g = grp(parent, x, y, z);
  const open = grp(g);
  ball(open, r, 0xffffff, 0, 0, 0, 1, 1, 0.6, { roughness: 0.25 });
  const p = grp(open);
  ball(p, r * 0.64, 0x1b1b2f, 0, 0, r * 0.4, 1, 1, 0.45, { roughness: 0.15 });
  ball(p, r * 0.22, 0xffffff, r * 0.2, r * 0.24, r * 0.68, 1, 1, 0.5, { emissive: 0xffffff, emissiveIntensity: 1 });
  ball(p, r * 0.11, 0xffffff, -r * 0.2, -r * 0.16, r * 0.68, 1, 1, 0.5, { emissive: 0xffffff, emissiveIntensity: 1 });
  const closed = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.1, 6, 14, Math.PI), mat(0x1b1b2f));
  closed.position.set(0, -r * 0.25, r * 0.5); g.add(closed);
  return { g, open, p, closed, r };
}
function setEye(e, blink, lx, ly, sc) {
  const shut = blink > 0.6;
  e.closed.visible = shut; e.open.visible = !shut;
  e.g.scale.setScalar(sc);
  e.open.scale.y = lerp(1, 0.25, clamp(blink / 0.6));
  e.p.position.set(lx * e.r * 0.32, ly * e.r * 0.32, 0);
}
function mouth(parent, w, x, y, z) {
  const g = grp(parent, x, y, z);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(w, w * 0.16, 6, 16, Math.PI), mat(0x4a2233));
  smile.rotation.z = Math.PI; g.add(smile);
  const open = grp(g);
  ball(open, 1, 0x7a1f3d, 0, 0, 0, 1, 1, 0.5);
  ball(open, 0.6, 0xff7fa0, 0, -0.45, 0.15, 1, 0.6, 0.5);
  return { g, smile, open, w };
}
function setMouth(m, o, smile = 1) {
  m.open.visible = o > 0.1; m.smile.visible = !m.open.visible;
  m.open.scale.set(m.w * (0.75 + 0.25 * o), m.w * (0.25 + 0.75 * o), m.w * 0.4);
  m.open.position.y = -m.w * 0.4;
  m.smile.rotation.z = smile >= 0 ? Math.PI : 0;
  m.smile.position.y = smile >= 0 ? 0 : -m.w * 0.7;
}
function base(scene) {
  const root = grp(scene); const body = grp(root);
  return { root, body };
}
function place(c, d) {
  c.root.visible = true;
  c.root.position.set(d.x, d.y, d.z);
  c.root.rotation.set(d.rx, d.ry, d.rz, 'YXZ');
  c.root.scale.setScalar(d.s);
  const q = 1 / Math.sqrt(d.sq);
  c.body.scale.set(q, d.sq, q);
}
const BASE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sq: 1, blink: 0, look: [0, 0], mouth: 0, smile: 1, eye: 1, brow: 0 };
const wp = (o) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };

// ------------------------------------------------------------------ KOKO
export function makeKoko(scene) {
  const BLUE = 0x3fa2f7, LIGHT = 0xa9dcff, PINK = 0xff9ec4, YEL = 0xffd21f;
  const c = base(scene), b = c.body;
  ball(b, 0.62, BLUE, 0, 0.9, 0, 1, 1.02, 0.95);
  ball(b, 0.46, LIGHT, 0, 0.84, 0.2, 1, 1, 0.9);
  const legL = limb(b, 0.23, 0.22, BLUE, 0.3, 0.5, 0), legR = limb(b, 0.23, 0.22, BLUE, -0.3, 0.5, 0);
  for (const l of [legL, legR]) for (const dx of [-0.11, 0, 0.11]) ball(l, 0.055, 0xffffff, dx, -0.4, 0.2);
  const armL = limb(b, 0.17, 0.36, BLUE, 0.56, 1.22, 0.05), armR = limb(b, 0.17, 0.36, BLUE, -0.56, 1.22, 0.05);
  ball(b, 0.07, BLUE, 0, 0.6, -0.6); ball(b, 0.09, 0x2b7fd6, 0, 0.5, -0.7);
  // sac à dos jaune
  const pack = grp(b, 0, 1.0, -0.62);
  ball(pack, 0.42, YEL, 0, 0, 0, 1, 1.1, 0.75);
  ball(pack, 0.3, 0xf5b800, 0, 0.2, -0.12, 1.1, 0.7, 0.7);
  ball(pack, 0.07, 0xff6b3d, 0, 0.02, -0.33);
  for (const sx of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 24), mat(0xf5b800));
    st.position.set(sx * 0.36, 1.02, -0.05); st.rotation.y = Math.PI / 2 + sx * 0.25; st.scale.set(1.25, 1, 1);
    st.castShadow = true; b.add(st);
  }
  // tête
  const head = grp(b, 0, 1.85, 0.05);
  ball(head, 0.74, BLUE, 0, 0, 0, 1.05, 0.95, 1);
  const earL = grp(head, 0.6, 0.15, -0.05), earR = grp(head, -0.6, 0.15, -0.05);
  for (const [e, sx] of [[earL, 1], [earR, -1]]) {
    ball(e, 0.58, BLUE, sx * 0.5, 0, 0, 1, 1.05, 0.16);
    ball(e, 0.42, PINK, sx * 0.52, -0.02, 0.07, 1, 1.05, 0.1);
  }
  const eL = eye(head, 0.21, 0.29, 0.14, 0.62), eR = eye(head, 0.21, -0.29, 0.14, 0.62);
  const brL = ball(head, 0.1, 0x1f6fc9, 0.3, 0.44, 0.6, 1.4, 0.32, 0.5), brR = ball(head, 0.1, 0x1f6fc9, -0.3, 0.44, 0.6, 1.4, 0.32, 0.5);
  const chL = ball(head, 0.13, PINK, 0.5, -0.14, 0.52, 1, 0.65, 0.4), chR = ball(head, 0.13, PINK, -0.5, -0.14, 0.52, 1, 0.65, 0.4);
  const mo = mouth(head, 0.16, 0, -0.42, 0.56);
  const trunk = []; for (let i = 0; i < 9; i++) trunk.push(ball(head, lerp(0.2, 0.11, i / 8), i === 8 ? 0x2b7fd6 : BLUE));
  const tuft = ball(head, 0.09, 0x2b7fd6, 0, 0.72, 0.05, 0.7, 1.5, 0.7);
  const hat = grp(head, 0, 0.66, 0); hat.add(shellHalf(0.4, true)); hat.visible = false;
  const eggA = grp(b), topA = grp(head, 0, 0.72, 0), handA = grp(armL, 0, -0.55, 0);

  const DEF = { ...BASE, aL: [0, 0.15], aR: [0, 0.15], walk: null, trunkUp: 0.1, trunkSway: 0, ear: 0, headYaw: 0, headPitch: 0,
    headTilt: 0, hold: 0, holdUp: 0, blush: 1, wink: 0, sit: 0, hat: false };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let lL = 0, lR = 0, aL = [...d.aL], aR = [...d.aR];
    if (d.walk !== null) {
      lL = Math.sin(d.walk) * 0.7; lR = -lL;
      if (!d.hold) { aL = [-lL * 0.8, 0.2]; aR = [-lR * 0.8, 0.2]; }
      c.root.position.y += Math.abs(Math.sin(d.walk)) * 0.07;
    }
    if (d.sit) { lL = lR = 1.35 * d.sit; }
    if (d.hold) {
      const f = 1.05 + d.holdUp * 1.3;
      aL = [lerp(aL[0], f, d.hold), lerp(aL[1], -0.35, d.hold)]; aR = [lerp(aR[0], f, d.hold), lerp(aR[1], -0.35, d.hold)];
    }
    legL.rotation.x = -lL; legR.rotation.x = -lR;
    armL.rotation.set(-aL[0], 0, aL[1]); armR.rotation.set(-aR[0], 0, -aR[1]);
    eggA.position.set(0, 0.98 + d.holdUp * 1.55, 0.86 - d.holdUp * 0.25);
    head.rotation.set(-d.headPitch, d.headYaw, d.headTilt, 'YXZ');
    earL.rotation.y = -0.25 - d.ear; earR.rotation.y = 0.25 + d.ear;
    earL.rotation.z = Math.min(0, d.ear) * 0.8; earR.rotation.z = -Math.min(0, d.ear) * 0.8;
    setEye(eL, Math.max(d.blink, d.wink), d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    for (const [br, sx] of [[brL, 1], [brR, -1]]) { br.position.y = 0.44 + Math.max(0, d.brow) * 0.1 + (d.eye - 1) * 0.2; br.rotation.z = sx * -d.brow * 0.45; }
    chL.scale.setScalar(0.13 * d.blush); chL.scale.y *= 0.65; chL.scale.z *= 0.4; chR.scale.copy(chL.scale);
    setMouth(mo, d.mouth, d.smile);
    // trompe : chaîne de boules, se recourbe vers le haut quand Koko est content
    let a = lerp(-1.15, 0.35, d.trunkUp), cu = lerp(-0.05, 0.27, d.trunkUp), y = -0.1, z = 0.7, x = 0;
    for (let i = 0; i < 9; i++) { trunk[i].position.set(x, y, z); a += cu; y += 0.15 * Math.sin(a); z += 0.15 * Math.cos(a); x += d.trunkSway * 0.02 * i; }
    hat.visible = d.hat; tuft.visible = !d.hat;
  };
  c.eggPos = () => wp(eggA); c.headTop = () => wp(topA); c.hand = () => wp(handA);
  return c;
}

// ----------------------------------------------------------------- SINGE
export function makeMonkey(scene) {
  const BR = 0xa8633a, BE = 0xffd9a8;
  const c = base(scene), b = c.body;
  ball(b, 0.33, BR, 0, 0.62, 0, 1, 1.1, 0.9); ball(b, 0.23, BE, 0, 0.6, 0.14, 1, 1.1, 0.8);
  const legL = limb(b, 0.09, 0.3, BR, 0.17, 0.4, 0), legR = limb(b, 0.09, 0.3, BR, -0.17, 0.4, 0);
  ball(legL, 0.11, BE, 0, -0.4, 0.06, 1, 0.6, 1.4); ball(legR, 0.11, BE, 0, -0.4, 0.06, 1, 0.6, 1.4);
  const armL = limb(b, 0.08, 0.48, BR, 0.33, 0.85, 0), armR = limb(b, 0.08, 0.48, BR, -0.33, 0.85, 0);
  ball(armL, 0.11, BE, 0, -0.6, 0); ball(armR, 0.11, BE, 0, -0.6, 0);
  const tail = []; for (let i = 0; i < 10; i++) tail.push(ball(b, 0.06, BR));
  const head = grp(b, 0, 1.25, 0.02);
  ball(head, 0.4, BR, 0, 0, 0, 1.05, 0.95, 1);
  ball(head, 0.3, BE, 0, -0.06, 0.2, 1.05, 0.9, 0.7);
  for (const sx of [-1, 1]) { ball(head, 0.17, BR, sx * 0.42, 0.02, 0, 0.5, 1, 1); ball(head, 0.11, BE, sx * 0.45, 0.02, 0.03, 0.5, 1, 1); }
  const eL = eye(head, 0.11, 0.14, 0.05, 0.36), eR = eye(head, 0.11, -0.14, 0.05, 0.36);
  ball(head, 0.035, 0x5a3320, 0, -0.1, 0.42);
  const mo = mouth(head, 0.1, 0, -0.18, 0.38);
  ball(head, 0.07, BR, 0, 0.4, 0, 0.8, 1.3, 0.8);
  const topA = grp(head, 0, 0.42, 0);
  const DEF = { ...BASE, aL: [0, 0.2], aR: [0, 0.2], walk: null, headYaw: 0, headPitch: 0, headTilt: 0, tail: 0.5, sit: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let lL = 0, aL = d.aL, aR = d.aR;
    if (d.walk !== null) { lL = Math.sin(d.walk) * 0.8; aL = [-lL, 0.25]; aR = [lL, 0.25]; c.root.position.y += Math.abs(Math.sin(d.walk)) * 0.08; }
    legL.rotation.x = -lL - d.sit * 1.4; legR.rotation.x = lL - d.sit * 1.4;
    armL.rotation.set(-aL[0], 0, aL[1]); armR.rotation.set(-aR[0], 0, -aR[1]);
    head.rotation.set(-d.headPitch, d.headYaw, d.headTilt, 'YXZ');
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    setMouth(mo, d.mouth, d.smile);
    let a = -0.3, y = 0.42, z = -0.28;
    for (let i = 0; i < 10; i++) { tail[i].position.set(0, y, z); a += 0.25 + d.tail * 0.35; y += 0.1 * Math.sin(a); z -= 0.1 * Math.cos(a); }
  };
  c.headTop = () => wp(topA);
  return c;
}

// ---------------------------------------------------------------- TORTUE
export function makeTurtle(scene) {
  const G = 0x8ee06b, SH = 0x2e9e55, SP = 0x6fd17a;
  const c = base(scene), b = c.body, r = rng(5);
  ball(b, 1, SH, 0, 0.75, 0, 1.15, 0.72, 1.3);
  ball(b, 1, 0xffe9a8, 0, 0.55, 0, 1.2, 0.3, 1.35);
  for (let i = 0; i < 9; i++) {
    const a = i === 0 ? 0 : (i / 8) * Math.PI * 2, rad = i === 0 ? 0 : 0.62;
    const x = Math.sin(a) * rad * 1.05, z = Math.cos(a) * rad * 1.2, h = Math.sqrt(Math.max(0, 1 - (x / 1.15) ** 2 - (z / 1.3) ** 2)) * 0.72;
    ball(b, i === 0 ? 0.34 : 0.26, SP, x, 0.75 + h - 0.05, z, 1, 0.3, 1);
  }
  const legs = [[0.85, 0.9], [-0.85, 0.9], [0.85, -0.9], [-0.85, -0.9]].map(([x, z]) => {
    const g = grp(b, x, 0.45, z); ball(g, 0.3, G, 0, -0.2, 0, 1, 1.1, 1.2); return g; });
  ball(b, 0.14, G, 0, 0.45, -1.35, 0.7, 0.7, 1.5);
  const neck = grp(b, 0, 0.7, 1.0);
  ball(neck, 0.26, G, 0, 0.1, 0.25, 1, 1, 1.6);
  const head = grp(neck, 0, 0.32, 0.6);
  ball(head, 0.46, G, 0, 0, 0, 1, 0.92, 1.05);
  const eL = eye(head, 0.14, 0.2, 0.12, 0.36), eR = eye(head, 0.14, -0.2, 0.12, 0.36);
  const chL = ball(head, 0.09, 0xff9ec4, 0.33, -0.08, 0.3, 1, 0.6, 0.4), chR = ball(head, 0.09, 0xff9ec4, -0.33, -0.08, 0.3, 1, 0.6, 0.4);
  const mo = mouth(head, 0.13, 0, -0.14, 0.43);
  const topA = grp(b, 0, 1.44, 0);
  const DEF = { ...BASE, neck: 1, walk: null, headYaw: 0, headPitch: 0, blush: 1 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    neck.scale.setScalar(Math.max(0.001, d.neck)); neck.position.z = lerp(0.3, 1.0, d.neck);
    head.rotation.set(-d.headPitch, d.headYaw, 0, 'YXZ');
    legs.forEach((g, i) => { g.rotation.x = d.walk === null ? 0 : Math.sin(d.walk + (i % 3 ? Math.PI : 0)) * 0.5; g.scale.setScalar(lerp(0.3, 1, d.neck)); });
    setEye(eL, Math.max(0.3, d.blink), d.look[0], d.look[1], d.eye); setEye(eR, Math.max(0.3, d.blink), d.look[0], d.look[1], d.eye);
    setMouth(mo, d.mouth, d.smile);
    chL.scale.set(0.09 * d.blush, 0.055 * d.blush, 0.036 * d.blush); chR.scale.copy(chL.scale);
  };
  c.top = () => wp(topA);
  return c;
}

// ---------------------------------------------------------------- GIRAFE
export function makeGiraffe(scene) {
  const Y = 0xffd75e, O = 0xf08a3c, r = rng(11);
  const c = base(scene), b = c.body;
  ball(b, 1, Y, 0, 2.5, 0, 0.8, 0.8, 1.35);
  for (let i = 0; i < 14; i++) {
    const a = r() * 6.28, h = r() * 1.6 - 0.8;
    const x = Math.cos(a) * Math.sqrt(1 - h * h), y = Math.sin(a) * Math.sqrt(1 - h * h);
    if (y < -0.3) continue;
    ball(b, 0.2 + r() * 0.1, O, x * 0.78, 2.5 + y * 0.78, h * 1.3, 1, 1, 0.3).lookAt(0, 2.5, h * 1.3);
  }
  const legs = [[0.45, 0.85], [-0.45, 0.85], [0.45, -0.85], [-0.45, -0.85]].map(([x, z]) => {
    const g = limb(b, 0.15, 1.75, Y, x, 2.2, z); ball(g, 0.2, 0x8a5a3c, 0, -1.98, 0, 1, 0.8, 1.1); return g; });
  const tl = limb(b, 0.05, 0.9, Y, 0, 2.9, -1.3); ball(tl, 0.13, 0x8a5a3c, 0, -1.1, 0); tl.rotation.x = 0.4;
  const neck = []; for (let i = 0; i < 11; i++) { const g = grp(b); ball(g, lerp(0.42, 0.3, i / 10), Y); if (i % 2) ball(g, 0.16, O, (i % 4 === 1 ? 1 : -1) * 0.24, 0, 0.1, 0.5, 1, 1); neck.push(g); }
  const head = grp(b);
  ball(head, 0.62, Y, 0, 0, 0, 0.95, 0.9, 1.1);
  ball(head, 0.45, 0xffe9a8, 0, -0.14, 0.52, 1, 0.8, 1);
  for (const sx of [-1, 1]) {
    ball(head, 0.035, 0x8a5a3c, sx * 0.14, -0.08, 0.93);
    const os = limb(head, 0.06, 0.3, Y, sx * 0.24, 0.9, -0.15); ball(os, 0.11, 0x8a5a3c, 0, 0.02, 0);
    ball(head, 0.2, Y, sx * 0.66, 0.3, -0.25, 1.3, 0.6, 0.35); ball(head, 0.12, 0xff9ec4, sx * 0.68, 0.3, -0.2, 1.3, 0.6, 0.35);
    ball(head, 0.12, 0xff9ec4, sx * 0.48, -0.16, 0.5, 1, 0.6, 0.4);
  }
  const eL = eye(head, 0.19, 0.31, 0.2, 0.42), eR = eye(head, 0.19, -0.31, 0.2, 0.42);
  const mo = mouth(head, 0.17, 0, -0.32, 0.86);
  const topA = grp(head, 0, 0.5, 0);
  const DEF = { ...BASE, down: 0, headPitch: 0, headYaw: 0, walk: null, sway: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let a = lerp(0.18, 1.2, d.down), bend = lerp(0.0, 0.22, d.down), y = 2.95, z = 1.0;
    for (let i = 0; i < 11; i++) { neck[i].position.set(Math.sin(i * 0.3) * d.sway * i * 0.04, y, z); a += bend; y += 0.5 * Math.cos(a); z += 0.5 * Math.sin(a); }
    head.position.set(d.sway * 0.45, y - 0.1, z + 0.1);
    head.rotation.set(-d.headPitch + d.down * 0.25, d.headYaw, d.sway * 0.2, 'YXZ');
    legs.forEach((g, i) => { g.rotation.x = d.walk === null ? 0 : Math.sin(d.walk + (i % 3 ? Math.PI : 0)) * 0.35; });
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    setMouth(mo, d.mouth, d.smile);
  };
  c.headTop = () => wp(topA); c.headPos = () => wp(head);
  return c;
}

// --------------------------------------------------------------- OISEAUX
export function makeBird(scene, baby) {
  const P = baby ? 0xff8fc0 : 0xff5fa2, T = 0x2fd6c9, OR = 0xff9a2e;
  const c = base(scene), b = c.body;
  ball(b, 0.8, P, 0, 0.95, 0, 1, 1.05, 0.95);
  ball(b, 0.55, 0xffe680, 0, 0.72, 0.3, 1, 1, 0.8);
  const wL = grp(b, 0.72, 1.05, 0), wR = grp(b, -0.72, 1.05, 0);
  ball(wL, 0.5, T, 0.12, -0.3, 0, 0.3, 1.1, 0.8); ball(wR, 0.5, T, -0.12, -0.3, 0, 0.3, 1.1, 0.8);
  for (let i = -1; i <= 1; i++) ball(b, 0.2, i ? T : 0xffe14d, i * 0.2, 0.6, -0.85, 0.6, 0.35, 2).rotation.x = 0.5;
  for (let i = -1; i <= 1; i++) ball(b, 0.13, i ? T : 0xffe14d, i * 0.14, 1.85 - Math.abs(i) * 0.06, -0.05, 0.6, 1.6, 0.6).rotation.z = -i * 0.35;
  const er = baby ? 0.24 : 0.2;
  const eL = eye(b, er, 0.3, 1.22, 0.62), eR = eye(b, er, -0.3, 1.22, 0.62);
  ball(b, 0.11, 0xffb3d1, 0.5, 0.98, 0.56, 1, 0.6, 0.4); ball(b, 0.11, 0xffb3d1, -0.5, 0.98, 0.56, 1, 0.6, 0.4);
  const bk = new THREE.ConeGeometry(0.17, 0.3, 16); bk.rotateX(Math.PI / 2);
  const up = new THREE.Mesh(bk, mat(OR)), lo = new THREE.Mesh(bk, mat(0xf07a1a));
  up.position.set(0, 1.02, 0.86); lo.position.set(0, 0.97, 0.84); lo.scale.set(0.85, 0.6, 0.85); up.scale.y = 0.7; b.add(up, lo); up.castShadow = lo.castShadow = true;
  for (const sx of [-1, 1]) { const l = limb(b, 0.045, 0.2, OR, sx * 0.25, 0.22, 0); ball(l, 0.12, OR, 0, -0.27, 0.07, 1, 0.4, 1.5); }
  const hat = grp(b, 0, 1.6, 0); hat.add(shellHalf(0.62, true)); hat.visible = false;
  const DEF = { ...BASE, wing: 0, hug: 0, hat: false };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    wL.rotation.set(0, -d.hug * 1.3, d.wing * 1.6 + 0.1); wR.rotation.set(0, d.hug * 1.3, -d.wing * 1.6 - 0.1);
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    lo.rotation.x = d.mouth * 0.6; up.rotation.x = -d.mouth * 0.15;
    hat.visible = d.hat;
  };
  return c;
}

// ------------------------------------------------------------------- ŒUF
const SHELL = 0xfff3dc;
function spots(g, r, top, bottom) {
  const rr = rng(3), cols = [0xff7fb5, 0x2fd6c9, 0xffc93d];
  for (let i = 0; i < 16; i++) {
    const a = rr() * 6.28, h = rr() * 1.7 - 0.85, rad = Math.sqrt(1 - h * h), sr = 0.12 + rr() * 0.1;
    if ((h > 0.12 && !top) || (h < -0.12 && !bottom) || Math.abs(h) <= 0.12) continue;
    const m = ball(g, r * sr, cols[i % 3], Math.cos(a) * rad * r * 0.8, h * r, Math.sin(a) * rad * r * 0.8, 1, 1, 0.25);
    m.lookAt(g.localToWorld(new THREE.Vector3(Math.cos(a) * rad * r * 3, h * r * 3 * 0.7, Math.sin(a) * rad * r * 3)));
  }
}
function shellHalf(r, top) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.5, side: THREE.DoubleSide }));
  m.scale.set(r * 0.8, r, r * 0.8); m.castShadow = true; g.add(m);
  // bord en zigzag
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * 6.28, t = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, r * 0.3, 4), mat(SHELL));
    t.position.set(Math.cos(a) * r * 0.74, (top ? -1 : 1) * r * 0.1, Math.sin(a) * r * 0.74); if (top) t.rotation.x = Math.PI; g.add(t);
  }
  spots(g, r, top, !top);
  return g;
}
export function makeEgg(scene) {
  const R = 0.42, root = grp(scene), whole = grp(root);
  ball(whole, R, SHELL, 0, 0, 0, 0.8, 1, 0.8, { roughness: 0.45 });
  spots(whole, R, true, true);
  const cracks = [];
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * 0.2, m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.02), mat(0x5b4636));
    m.position.set(Math.sin(a) * R * 0.8, (i % 2 ? 0.035 : -0.035), Math.cos(a) * R * 0.8 + 0.005); m.rotation.set(0, a, i % 2 ? 0.7 : -0.7); whole.add(m); cracks.push(m);
  }
  const bottom = shellHalf(R, false), top = shellHalf(R, true); root.add(bottom, top);
  const c = { root };
  c.set = (p) => {
    const d = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sq: 1, crack: 0, broken: false, top: null, ...p };
    root.visible = true; root.position.set(d.x, d.y, d.z); root.rotation.set(d.rx, d.ry, d.rz);
    const q = 1 / Math.sqrt(d.sq); root.scale.set(d.s * q, d.s * d.sq, d.s * q);
    whole.visible = !d.broken; bottom.visible = d.broken; top.visible = d.broken && !!d.top;
    cracks.forEach((m, i) => { m.visible = Math.abs(i - 4) < d.crack * 5; });
    if (d.top) { top.position.set(d.top[0], d.top[1], d.top[2]); top.rotation.z = d.top[3] || 0; }
  };
  return c;
}
