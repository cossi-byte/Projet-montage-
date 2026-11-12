// Personnages et objets de « La chanson des couleurs » : quatre enfants, tout en formes rondes.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
export const hop = (u) => (u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u));
export const pop = (age, d = 0.35) => (age <= 0 ? 0 : age >= d ? 1 : 1 + 0.35 * Math.sin((age / d) * Math.PI) * (1 - age / d) - (1 - age / d) ** 3);
export function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const SPH = new THREE.SphereGeometry(1, 40, 28);
const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o }));
  return matCache.get(key);
}
export function ball(parent, r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o) {
  const m = new THREE.Mesh(SPH, mat(color, o));
  m.scale.set(r * sx, r * sy, r * sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
export function mesh(parent, geo, color, x = 0, y = 0, z = 0, o) {
  const m = new THREE.Mesh(geo, mat(color, o)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const cyl = (parent, rt, rb, h, color, x, y, z, seg = 20, o) => mesh(parent, new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, o);
export const box = (parent, w, h, d, color, x, y, z, o) => mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z, o);
const wp = (o) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };

function limb(parent, r, len, color, x, y, z) {
  const g = grp(parent, x, y, z);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat(color));
  m.position.y = -len / 2; m.castShadow = true; m.receiveShadow = true; g.add(m); return g;
}
function eye(parent, r, x, y, z, skin) {
  const g = grp(parent, x, y, z), open = grp(g);
  ball(open, r, 0xffffff, 0, 0, 0, 1, 1.08, 0.5, { roughness: 0.2 });
  const p = grp(open);
  ball(p, r * 0.82, 0x6b3a1a, 0, 0, r * 0.24, 1, 1, 0.45, { roughness: 0.2 });
  ball(p, r * 0.5, 0x120a08, 0, 0, r * 0.42, 1, 1, 0.4, { roughness: 0.1 });
  ball(p, r * 0.24, 0xffffff, r * 0.24, r * 0.28, r * 0.6, 1, 1, 0.5, { emissive: 0xffffff, emissiveIntensity: 1 });
  ball(p, r * 0.1, 0xffffff, -r * 0.2, -r * 0.18, r * 0.62, 1, 1, 0.5, { emissive: 0xffffff, emissiveIntensity: 1 });
  const closed = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.1, 6, 14, Math.PI), mat(0x1a0f0c));
  closed.position.set(0, -r * 0.25, r * 0.5); g.add(closed);
  return { g, open, p, closed, r };
}
function setEye(e, blink, lx, ly, sc) {
  const shut = blink > 0.6;
  e.closed.visible = shut; e.open.visible = !shut;
  e.g.scale.setScalar(sc);
  e.open.scale.y = lerp(1, 0.25, clamp(blink / 0.6));
  e.p.position.set(lx * e.r * 0.16, ly * e.r * 0.16, 0);
}

const HAIR = 0x1b1211;
// o : { skin, style: 'puffs' | 'short' | 'braids' | 'afro', top, bottom, dress, accent, shoes, h }
export function makeKid(scene, o) {
  const root = grp(scene), body = grp(root);
  const skin = o.skin, dark = new THREE.Color(skin).multiplyScalar(0.8).getHex();
  // jambes + chaussures
  const legs = [1, -1].map((sx) => {
    const l = limb(body, 0.1, 0.34, skin, sx * 0.16, 0.62, 0);
    ball(l, 0.13, o.shoes, 0, -0.54, 0.06, 1, 0.62, 1.5); ball(l, 0.1, 0xffffff, 0, -0.44, 0, 1.05, 0.45, 1.05);
    if (!o.dress) cyl(l, 0.135, 0.145, 0.2, o.bottom, 0, -0.1, 0, 20);
    return l;
  });
  ball(body, 0.3, o.bottom, 0, 0.68, 0, 1, 0.72, 0.85);
  const upper = grp(body, 0, 0.68, 0);   // tout le haut du corps pivote ici (pour saluer)
  ball(upper, 0.3, o.top, 0, 0.3, 0, 1, 1.15, 0.82);
  if (o.dress) cyl(body, 0.24, 0.5, 0.56, o.top, 0, 0.6, 0, 28);
  if (o.band) { const t = mesh(upper, new THREE.TorusGeometry(0.285, 0.05, 10, 32), o.band, 0, 0.3, 0); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.82, 1); }
  const arms = [1, -1].map((sx) => {
    const a = limb(upper, 0.075, 0.42, skin, sx * 0.3, 0.52, 0);
    ball(a, 0.125, o.top, 0, -0.02, 0, 1, 1, 1); ball(a, 0.1, skin, 0, -0.56, 0);
    a.hand = grp(a, 0, -0.58, 0.02);
    return a;
  });
  // tête
  const head = grp(upper, 0, 0.94, 0.02);
  ball(head, 0.5, skin, 0, 0, 0, 1, 0.96, 0.96);
  for (const sx of [1, -1]) { ball(head, 0.1, skin, sx * 0.48, -0.03, 0, 0.6, 1, 0.8); ball(head, 0.055, dark, sx * 0.5, -0.03, 0.02, 0.5, 0.9, 0.7); }
  const eL = eye(head, 0.15, 0.2, 0.03, 0.415, skin), eR = eye(head, 0.15, -0.2, 0.03, 0.415, skin);
  const brows = [1, -1].map((sx) => ball(head, 0.07, HAIR, sx * 0.2, 0.28, 0.42, 1.35, 0.3, 0.45));
  ball(head, 0.055, dark, 0, -0.1, 0.49, 1.1, 0.8, 0.7);
  for (const sx of [1, -1]) ball(head, 0.085, 0xd9604a, sx * 0.33, -0.17, 0.355, 1, 0.6, 0.3, { transparent: true, opacity: 0.32 }).castShadow = false;
  // bouche : sourire fermé ou bouche ouverte (dents + langue)
  const mo = grp(head, 0, -0.25, 0.425), W = 0.15;
  const smile = mesh(mo, new THREE.TorusGeometry(W, W * 0.16, 8, 20, Math.PI), 0x3a1418); smile.rotation.z = Math.PI; smile.castShadow = false;
  const open = grp(mo, 0, 0, 0.035);   // demi-lune : toujours un sourire, même en chantant
  const flatm = (geo, color, x, y, z) => { const m = mesh(open, geo, color, x, y, z, { roughness: 0.6 }); m.castShadow = false; m.receiveShadow = false; return m; };
  flatm(new THREE.CircleGeometry(1, 28, Math.PI, Math.PI), 0x5a0f22, 0, 0, 0);
  flatm(new THREE.PlaneGeometry(1.55, 0.3), 0xffffff, 0, -0.15, 0.004);
  flatm(new THREE.CircleGeometry(0.5, 20), 0xff7f96, 0, -0.74, 0.004).scale.y = 0.5;
  // cheveux
  ball(head, 0.52, HAIR, 0, 0.09, -0.08, 1.02, 1, 1, { roughness: 0.95 });
  const hr = { roughness: 0.95 };
  if (o.style === 'puffs') for (const sx of [1, -1]) { ball(head, 0.25, HAIR, sx * 0.43, 0.43, -0.08, 1, 1, 1, hr); ball(head, 0.085, o.accent, sx * 0.3, 0.33, -0.05); }
  if (o.style === 'short') { const R = rng(5); for (let i = 0; i < 22; i++) { const a = R() * 6.28, b = R() * 1.1; ball(head, 0.1, HAIR, Math.sin(b) * Math.cos(a) * 0.5, 0.1 + Math.cos(b) * 0.47, -0.08 + Math.sin(b) * Math.sin(a) * 0.5, 1, 1, 1, hr); } }
  if (o.style === 'afro') { ball(head, 0.6, HAIR, 0, 0.3, -0.18, 1.05, 0.95, 1, hr); const R = rng(9); for (let i = 0; i < 26; i++) { const a = R() * 6.28, b = R() * 1.9; ball(head, 0.15, HAIR, Math.sin(b) * Math.cos(a) * 0.58, 0.3 + Math.cos(b) * 0.53, -0.18 + Math.sin(b) * Math.sin(a) * 0.55, 1, 1, 1, hr); } }
  const braids = [];
  if (o.style === 'braids') {
    for (let i = 0; i < 9; i++) {
      const a = -0.25 + (i / 8) * (Math.PI + 0.5), g = grp(head, Math.cos(a) * 0.5, 0.12, -0.1 - Math.sin(a) * 0.42);
      for (let k = 0; k < 5; k++) ball(g, 0.06, HAIR, 0, -k * 0.1, 0, 1, 1.1, 1, hr);
      ball(g, 0.07, k2(i, o.accent), 0, -0.52, 0); braids.push(g);
    }
    for (let i = 0; i < 7; i++) ball(head, 0.07, HAIR, -0.33 + i * 0.11, 0.5 - Math.abs(i - 3) * 0.035, 0.12, 1, 1, 1, hr);
  }
  function k2(i, c) { return i % 2 ? 0xffffff : c; }

  const DEF = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sq: 1, aL: [0, 0.18], aR: [0, 0.18], lL: 0, lR: 0, walk: null, bow: 0,
    headYaw: 0, headPitch: 0, headTilt: 0, blink: 0, look: [0, 0], mouth: 0, eye: 1, brow: 0.2, swing: 0 };
  const c = { root, o };
  c.set = (p) => {
    const d = { ...DEF, ...p };
    root.visible = true; root.position.set(d.x, d.y, d.z); root.rotation.set(d.rx, d.ry, d.rz, 'YXZ'); root.scale.setScalar(d.s * (o.h || 1));
    const q = 1 / Math.sqrt(d.sq); body.scale.set(q, d.sq, q);
    let lL = d.lL, lR = d.lR, aL = d.aL, aR = d.aR;
    if (d.walk !== null) { lL = Math.sin(d.walk) * 0.65; lR = -lL; if (!p.aL) aL = [-lL * 0.9, 0.25]; if (!p.aR) aR = [-lR * 0.9, 0.25]; root.position.y += Math.abs(Math.sin(d.walk)) * 0.1; }
    legs[0].rotation.x = -lL; legs[1].rotation.x = -lR;
    upper.rotation.x = d.bow;
    arms[0].rotation.set(-aL[0], 0, aL[1]); arms[1].rotation.set(-aR[0], 0, -aR[1]);
    head.rotation.set(-d.headPitch, d.headYaw, d.headTilt, 'YXZ');
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    brows.forEach((b, i) => { b.position.y = 0.275 + d.brow * 0.05 + (d.eye - 1) * 0.15; b.rotation.z = (i ? -1 : 1) * 0.06; });
    const m = d.mouth; open.visible = m > 0.1; smile.visible = !open.visible;
    open.scale.set(W * (1.0 + 0.12 * m), W * (0.5 + 0.75 * m), 1); open.position.y = W * 0.12;
    braids.forEach((b, i) => { b.rotation.z = d.swing * 0.25 + Math.sin(i) * 0.03; b.rotation.x = -d.headPitch * 0.5; });
  };
  // angles du bras i pour que la main vise un point du monde
  c.aim = (i, target) => { upper.updateWorldMatrix(true, false); const d = upper.worldToLocal(target.clone()).sub(arms[i].position).normalize(); return [Math.atan2(d.z, -d.y), Math.asin(clamp(i ? -d.x : d.x, -1, 1))]; };
  c.hand = (i) => wp(arms[i].hand);          // 0 = main gauche de l'enfant (à droite de l'image)
  c.headPos = () => wp(head);
  root.visible = false;
  return c;
}

// ------------------------------------------------------------------ objets
// Chaque objet est d'une seule couleur franche (c'est elle qu'on apprend).
export function makeProp(scene, kind, color) {
  const root = grp(scene), g = grp(root), C = color, gloss = { roughness: 0.3 };
  const p = { root, kind };
  if (kind === 'ball') { ball(g, 0.3, C, 0, 0, 0, 1, 1, 1, gloss); const t = mesh(g, new THREE.TorusGeometry(0.298, 0.022, 8, 40), 0xffffff, 0, 0, 0, gloss); t.rotation.x = 1.2; }
  if (kind === 'orange') { ball(g, 0.25, C, 0, 0, 0, 1, 0.94, 1, { roughness: 0.45 }); ball(g, 0.035, 0x7a4a1e, 0, 0.225, 0, 1, 0.6, 1); }
  if (kind === 'apple') { ball(g, 0.24, C, 0, 0, 0, 1, 0.9, 1, gloss); cyl(g, 0.018, 0.018, 0.14, 0x7a4a1e, 0, 0.25, 0, 8); }
  if (kind === 'grapes') { const R = rng(3); for (let r = 0; r < 4; r++) for (let i = 0; i < (4 - r) * 2; i++) { const a = i / ((4 - r) * 2) * 6.28 + r; ball(g, 0.085, C, Math.cos(a) * (0.16 - r * 0.04) + R() * 0.02, 0.12 - r * 0.12, Math.sin(a) * (0.16 - r * 0.04), 1, 1, 1, gloss); } cyl(g, 0.018, 0.018, 0.16, 0x7a4a1e, 0, 0.26, 0, 8); }
  if (kind === 'banana') {   // un tube lisse, courbé, aux bouts effilés
    const N = 40, curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.4, 0.16, 0), new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.4, 0.16, 0));
    const geo = new THREE.TubeGeometry(curve, N, 0.1, 16, false), pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= N; i++) { const u = i / N, f = 0.35 + 0.65 * Math.sin(u * Math.PI) ** 0.5; curve.getPointAt(u, c);
      for (let j = 0; j <= 16; j++) { const k = i * 17 + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(f).add(c); pos.setXYZ(k, v.x, v.y, v.z); } }
    geo.computeVertexNormals(); mesh(g, geo, C, 0, 0.1, 0, { roughness: 0.4 });
    ball(g, 0.04, 0x6b4a1e, -0.4, 0.27, 0, 1, 1.3, 1); ball(g, 0.035, 0x6b4a1e, 0.4, 0.26, 0);
  }
  if (kind === 'pencil') {
    const b = cyl(g, 0.075, 0.075, 0.8, C, 0, 0, 0, 6, { roughness: 0.4 }), tip = cyl(g, 0.075, 0.012, 0.2, 0xf6cf9a, 0, -0.5, 0, 6), pt = cyl(g, 0.03, 0.004, 0.08, C, 0, -0.565, 0, 6);
    cyl(g, 0.08, 0.08, 0.07, 0xffffff, 0, 0.4, 0, 16); ball(g, 0.075, C, 0, 0.46, 0, 1, 0.7, 1);
  }
  if (kind === 'flower') {
    cyl(g, 0.03, 0.035, 0.7, 0x2fa84f, 0, 0.35, 0, 8); ball(g, 0.11, 0x2fa84f, 0.12, 0.3, 0, 1.3, 0.25, 0.6); ball(g, 0.11, 0x2fa84f, -0.12, 0.42, 0, 1.3, 0.25, 0.6);
    const f = grp(g, 0, 0.76, 0.02); p.head = f;
    for (let k = 0; k < 6; k++) ball(f, 0.14, C, Math.cos(k * 1.047) * 0.2, Math.sin(k * 1.047) * 0.2, 0, 1, 1, 0.45, { roughness: 0.4 });
    ball(f, 0.12, 0xfff3c4, 0, 0, 0.05, 1, 1, 0.6);
  }
  if (kind === 'kite') {
    const sh = new THREE.Shape(); sh.moveTo(0, 0.75); sh.lineTo(0.5, 0.15); sh.lineTo(0, -0.75); sh.lineTo(-0.5, 0.15); sh.closePath();
    const k = mesh(g, new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 }), C, 0, 0, -0.02, { roughness: 0.45, side: THREE.DoubleSide });
    box(g, 0.035, 1.5, 0.03, 0xffffff, 0, 0, 0.05); box(g, 1.0, 0.035, 0.03, 0xffffff, 0, 0.15, 0.05);
    p.tail = []; for (let i = 0; i < 6; i++) { const t = grp(g); ball(t, 0.07, i % 2 ? 0xffffff : C, 0.08, 0, 0, 1.3, 0.8, 0.4); ball(t, 0.07, i % 2 ? 0xffffff : C, -0.08, 0, 0, 1.3, 0.8, 0.4); p.tail.push(t); }
    p.string = mesh(scene, new THREE.CylinderGeometry(0.008, 0.008, 1, 5), 0xffffff, 0, 0, 0); p.string.castShadow = false; p.string.visible = false;
  }
  // d : { x, y, z, s, rx, ry, rz, wave (queue du cerf-volant), to (Vector3 : bout de la ficelle) }
  p.set = (d) => {
    root.visible = true; root.position.set(d.x, d.y, d.z); root.scale.setScalar(d.s ?? 1); root.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0);
    if (p.tail) p.tail.forEach((t, i) => t.position.set(Math.sin((d.wave || 0) - i * 0.9) * 0.1 * (i + 1) * 0.5, -0.9 - i * 0.22, 0));
    if (p.string) {
      p.string.visible = !!d.to;
      if (d.to) { const a = new THREE.Vector3(d.x, d.y - 0.1 * (d.s ?? 1), d.z), v = d.to.clone().sub(a); p.string.position.copy(a).addScaledVector(v, 0.5); p.string.scale.set(1, v.length(), 1); p.string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); }
    }
  };
  p.hide = () => { root.visible = false; if (p.string) p.string.visible = false; };
  p.hide();
  return p;
}
