// Personnages de « Balou l'éléphant » — tout est construit en formes rondes (three.js).
// Balou, Maman Éléphant, Pico, Zazou la girafe, Monsieur Hippo.
import * as THREE from 'three';
import { clamp, lerp, ss, hop, rng, mat, ball, grp } from '../../film/characters.js';
export { clamp, lerp, ss, hop, rng, mat, ball, grp };

function limb(parent, r, len, color, x, y, z) {
  const g = grp(parent, x, y, z);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat(color));
  m.position.y = -len / 2; m.castShadow = true; m.receiveShadow = true; g.add(m); return g;
}
function eye(parent, r, x, y, z, iris = 0x7a4a26) {
  const g = grp(parent, x, y, z), open = grp(g);
  ball(open, r, 0xffffff, 0, 0, 0, 1, 1, 0.6, { roughness: 0.25 });
  const p = grp(open);
  ball(p, r * 0.66, iris, 0, 0, r * 0.36, 1, 1, 0.45, { roughness: 0.2 });
  ball(p, r * 0.36, 0x221208, 0, 0, r * 0.56, 1, 1, 0.4, { roughness: 0.15 });
  ball(p, r * 0.22, 0xffffff, r * 0.2, r * 0.24, r * 0.7, 1, 1, 0.5, { emissive: 0xffffff, emissiveIntensity: 1 });
  ball(p, r * 0.11, 0xffffff, -r * 0.2, -r * 0.16, r * 0.7, 1, 1, 0.5, { emissive: 0xffffff, emissiveIntensity: 1 });
  const closed = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.1, 6, 14, Math.PI), mat(0x3a2a2a));
  closed.position.set(0, -r * 0.25, r * 0.5); g.add(closed);
  return { g, open, p, closed, r };
}
function setEye(e, blink, lx, ly, sc) {
  const shut = blink > 0.6;
  e.closed.visible = shut; e.open.visible = !shut;
  e.g.scale.setScalar(sc);
  e.open.scale.y = lerp(1, 0.25, clamp(blink / 0.6));
  e.p.position.set(lx * e.r * 0.3, ly * e.r * 0.3, 0);
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
function base(scene) { const root = grp(scene); const body = grp(root); return { root, body }; }
function place(c, d) {
  c.root.visible = true;
  c.root.position.set(d.x, d.y, d.z);
  c.root.rotation.set(d.rx, d.ry, d.rz, 'YXZ');
  c.root.scale.setScalar(d.s);
  const q = 1 / Math.sqrt(d.sq); c.body.scale.set(q, d.sq, q);
}
const BASE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sq: 1, blink: 0, look: [0, 0], mouth: 0, smile: 1, eye: 1, brow: 0 };
export const wp = (o) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };

function starGeo(r, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: r * 0.12, bevelThickness: r * 0.12, bevelSegments: 3 }); g.center(); return g;
}

// ------------------------------------------------- ÉLÉPHANTS (Balou, Maman)
export function makeElephant(scene, kind = 'balou') {
  const BALOU = kind === 'balou';
  const SKIN = 0xb3c4d6, DARK = 0x8fa3b8, PINK = 0xffa8c5, YEL = 0xffd23f, RED = 0xff4b4b;
  const c = base(scene), b = c.body;
  ball(b, 0.62, SKIN, 0, 0.9, 0, 1, 1.02, 0.95);
  if (BALOU) { // salopette jaune soleil + bouton étoile
    ball(b, 0.648, YEL, 0, 0.8, 0, 1, 0.82, 0.97);
    ball(b, 0.3, YEL, 0, 1.12, 0.5, 1.1, 0.95, 0.35);
    for (const sx of [-1, 1]) {
      const st = ball(b, 0.09, YEL, sx * 0.25, 1.36, 0.43, 0.8, 1.9, 0.6); st.rotation.x = -0.65;
      ball(b, 0.045, 0xffffff, sx * 0.24, 1.25, 0.56);
    }
    const star = new THREE.Mesh(starGeo(0.11, 0.04), mat(0xff7a2f, { roughness: 0.4 }));
    star.position.set(0, 1.12, 0.62); star.castShadow = true; b.add(star);
  } else { // Maman : ventre clair
    ball(b, 0.46, 0xc9d6e4, 0, 0.84, 0.2, 1, 1, 0.9);
  }
  const legL = limb(b, 0.22, 0.2, SKIN, 0.3, 0.5, 0), legR = limb(b, 0.22, 0.2, SKIN, -0.3, 0.5, 0);
  for (const l of [legL, legR]) {
    if (BALOU) { // baskets rouges
      ball(l, 0.2, RED, 0, -0.36, 0.08, 1.05, 0.72, 1.45);
      ball(l, 0.2, 0xffffff, 0, -0.45, 0.08, 1.1, 0.25, 1.5);
      ball(l, 0.05, 0xffffff, 0, -0.27, 0.27);
    } else for (const dx of [-0.1, 0, 0.1]) ball(l, 0.05, 0xffffff, dx, -0.4, 0.19);
  }
  const armL = limb(b, 0.16, 0.34, SKIN, 0.56, 1.22, 0.05), armR = limb(b, 0.16, 0.34, SKIN, -0.56, 1.22, 0.05);
  ball(armL, 0.17, SKIN, 0, -0.55, 0); ball(armR, 0.17, SKIN, 0, -0.55, 0);
  const handA = grp(armL, 0, -0.62, 0), handB = grp(armR, 0, -0.62, 0);
  ball(b, 0.07, SKIN, 0, 0.6, -0.6); ball(b, 0.09, DARK, 0, 0.5, -0.68);
  // arrosoir (Maman)
  const can = grp(armL, 0, -0.72, 0.1);
  { const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.4, 20), mat(0x7fd3ff, { roughness: 0.35 })); body.position.y = -0.18; body.castShadow = true; can.add(body);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 10), mat(0x7fd3ff)); sp.position.set(0, -0.12, 0.33); sp.rotation.x = 1.0; can.add(sp);
    ball(can, 0.08, 0x5ab8ea, 0, 0.05, 0.53, 1, 0.6, 1);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 16, Math.PI), mat(0x5ab8ea)); hd.position.set(0, 0.02, -0.05); hd.rotation.y = Math.PI / 2; can.add(hd);
    ball(can, 0.06, 0xff8fc0, 0.2, -0.1, 0.12, 0.4, 1, 1); }
  // tête
  const head = grp(b, 0, 1.85, 0.05);
  ball(head, 0.74, SKIN, 0, 0, 0, 1.05, 0.95, 1);
  const earL = grp(head, 0.6, 0.15, -0.05), earR = grp(head, -0.6, 0.15, -0.05);
  for (const [e, sx] of [[earL, 1], [earR, -1]]) {
    ball(e, 0.64, SKIN, sx * 0.54, 0, 0, 1, 1.02, 0.16);
    ball(e, 0.47, PINK, sx * 0.56, -0.02, 0.07, 1, 1.02, 0.1);
  }
  const er = BALOU ? 0.22 : 0.19;
  const eL = eye(head, er, 0.28, 0.14, 0.62), eR = eye(head, er, -0.28, 0.14, 0.62);
  const brL = ball(head, 0.1, DARK, 0.3, 0.45, 0.6, 1.4, 0.32, 0.5), brR = ball(head, 0.1, DARK, -0.3, 0.45, 0.6, 1.4, 0.32, 0.5);
  const chL = ball(head, 0.13, PINK, 0.5, -0.14, 0.52, 1, 0.65, 0.4), chR = ball(head, 0.13, PINK, -0.5, -0.14, 0.52, 1, 0.65, 0.4);
  if (!BALOU) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { // cils
    const l = ball(head, 0.03, 0x3a2a2a, sx * (0.38 + i * 0.05), 0.3 + i * 0.01 - (i === 2 ? 0.03 : 0), 0.56, 0.5, 1.6, 0.5); l.rotation.z = sx * (-0.5 - i * 0.35); }
  const mo = mouth(head, 0.15, 0, -0.42, 0.57);
  // trompe : courte, avec un petit tortillon au bout
  const NT = BALOU ? 8 : 10;
  const trunkG = grp(head, 0, -0.1, 0.68), trunk = [];
  for (let i = 0; i < NT; i++) trunk.push(ball(trunkG, lerp(0.19, 0.1, i / (NT - 1)), i === NT - 1 ? DARK : SKIN));
  if (BALOU) { ball(head, 0.07, 0x7d8ea3, 0, 0.76, 0.05, 0.7, 1.7, 0.7); ball(head, 0.06, 0x7d8ea3, 0.08, 0.72, 0.02, 0.7, 1.5, 0.7).rotation.z = -0.5; ball(head, 0.06, 0x7d8ea3, -0.08, 0.72, 0.02, 0.7, 1.5, 0.7).rotation.z = 0.5; }
  else { // foulard vert à fleurs blanches
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(0x3fbf6f, { roughness: 0.7 }));
    sc.scale.set(1.05, 0.95, 1); sc.position.set(0, 0.06, -0.05); sc.rotation.x = -0.35; sc.castShadow = true; head.add(sc);
    const r = rng(9);
    for (let i = 0; i < 16; i++) {
      const th = 0.12 + r() * Math.PI * 0.27, ph = r() * Math.PI * 2, R = 0.81;
      const v = new THREE.Vector3(Math.sin(th) * Math.cos(ph) * R * 1.05, Math.cos(th) * R * 0.95, Math.sin(th) * Math.sin(ph) * R);
      v.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.35).add(new THREE.Vector3(0, 0.06, -0.05));
      const fl = grp(head, v.x, v.y, v.z); fl.lookAt(head.localToWorld(v.clone().multiplyScalar(2)));
      for (let k = 0; k < 5; k++) ball(fl, 0.035, 0xffffff, Math.cos(k * 1.257) * 0.04, Math.sin(k * 1.257) * 0.04, 0, 1, 1, 0.4);
      ball(fl, 0.025, 0xffe14d, 0, 0, 0.01, 1, 1, 0.4);
    }
    const knot = grp(head, 0, -0.3, -0.72); ball(knot, 0.12, 0x3fbf6f); ball(knot, 0.1, 0x3fbf6f, 0.12, -0.15, -0.05, 0.6, 1.4, 0.6).rotation.z = 0.4; ball(knot, 0.1, 0x3fbf6f, -0.1, -0.17, -0.05, 0.6, 1.4, 0.6).rotation.z = -0.3;
  }
  const topA = grp(head, 0, 0.74, 0), tipA = grp(trunkG);

  const DEF = { ...BASE, aL: [0, 0.15], aR: [0, 0.15], walk: null, trunkUp: 0.15, trunkSway: 0, trunkSpin: 0, trunkCover: 0, ear: 0,
    headYaw: 0, headPitch: 0, headTilt: 0, blush: 1, wink: 0, sit: 0, can: false };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let lL = 0, lR = 0, aL = [...d.aL], aR = [...d.aR];
    if (d.walk !== null) {
      lL = Math.sin(d.walk) * 0.7; lR = -lL;
      if (!p.aL) aL = [-lL * 0.8, 0.2];
      if (!p.aR) aR = [-lR * 0.8, 0.2];
      c.root.position.y += Math.abs(Math.sin(d.walk)) * 0.07 * d.s;
    }
    if (d.sit) { lL = lR = 1.35 * d.sit; }
    legL.rotation.x = -lL; legR.rotation.x = -lR;
    armL.rotation.set(-aL[0], 0, aL[1]); armR.rotation.set(-aR[0], 0, -aR[1]);
    head.rotation.set(-d.headPitch, d.headYaw, d.headTilt, 'YXZ');
    earL.rotation.y = -0.25 - d.ear; earR.rotation.y = 0.25 + d.ear;
    earL.rotation.z = Math.min(0, d.ear) * 0.8; earR.rotation.z = -Math.min(0, d.ear) * 0.8;
    setEye(eL, Math.max(d.blink, d.wink), d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    for (const [br, sx] of [[brL, 1], [brR, -1]]) { br.position.y = 0.45 + Math.max(0, d.brow) * 0.1 + (d.eye - 1) * 0.2; br.rotation.z = sx * -d.brow * 0.45; }
    chL.scale.set(0.13 * d.blush, 0.085 * d.blush, 0.052 * d.blush); chR.scale.copy(chL.scale);
    setMouth(mo, d.mouth, d.smile);
    // trompe : chaîne de boules ; le bout s'enroule (tortillon)
    let a = lerp(-1.15, 0.45, d.trunkUp), cu = lerp(-0.02, 0.2, d.trunkUp), y = 0, z = 0, x = 0;
    const step = BALOU ? 0.14 : 0.15;
    for (let i = 0; i < NT; i++) {
      const pos = new THREE.Vector3(x, y, z);
      if (d.trunkCover > 0) { // la trompe vient se poser devant la bouche
        const u = i / (NT - 1), tgt = new THREE.Vector3(0.0, -0.2 - 0.28 * Math.sin(u * Math.PI * 0.9), 0.12 + 0.22 * Math.sin(u * Math.PI) - 0.1 * u);
        pos.lerp(tgt, d.trunkCover);
      }
      trunk[i].position.copy(pos);
      const curl = i >= NT - 3 ? 0.75 : 0;
      a += cu + curl; y += step * Math.sin(a); z += step * Math.cos(a); x += d.trunkSway * 0.02 * i;
    }
    tipA.position.copy(trunk[NT - 1].position);
    trunkG.rotation.z = d.trunkSpin;
    can.visible = d.can;
  };
  c.headTop = () => wp(topA); c.hand = () => wp(handA); c.handR = () => wp(handB); c.trunkTip = () => wp(tipA); c.headPos = () => wp(head);
  return c;
}

// -------------------------------------------------------------------- PICO
export function makePico(scene) {
  const Y = 0xffd93b, LY = 0xfff0a0, OR = 0xff9a2e;
  const c = base(scene), b = c.body;
  ball(b, 0.32, Y, 0, 0.36, 0, 1, 0.98, 0.95);
  ball(b, 0.22, LY, 0, 0.3, 0.14, 1, 1, 0.75);
  const wL = grp(b, 0.28, 0.4, 0), wR = grp(b, -0.28, 0.4, 0);
  ball(wL, 0.15, 0xffc81f, 0.05, -0.08, 0, 0.35, 1.1, 0.8); ball(wR, 0.15, 0xffc81f, -0.05, -0.08, 0, 0.35, 1.1, 0.8);
  for (let i = -1; i <= 1; i++) ball(b, 0.06, 0xffc81f, i * 0.05, 0.69 - Math.abs(i) * 0.02, 0.0, 0.6, 1.6, 0.6).rotation.z = -i * 0.4;
  for (let i = -1; i <= 1; i++) ball(b, 0.07, 0xffc81f, i * 0.07, 0.28, -0.32, 0.6, 0.35, 1.6).rotation.x = 0.5;
  const eL = eye(b, 0.1, 0.12, 0.44, 0.24, 0x3a2a1a), eR = eye(b, 0.1, -0.12, 0.44, 0.24, 0x3a2a1a);
  ball(b, 0.05, 0xffa0b8, 0.21, 0.33, 0.23, 1, 0.6, 0.4); ball(b, 0.05, 0xffa0b8, -0.21, 0.33, 0.23, 1, 0.6, 0.4);
  const bk = new THREE.ConeGeometry(0.06, 0.12, 12); bk.rotateX(Math.PI / 2);
  const up = new THREE.Mesh(bk, mat(OR)), lo = new THREE.Mesh(bk, mat(0xf07a1a));
  up.position.set(0, 0.36, 0.33); lo.position.set(0, 0.33, 0.32); lo.scale.set(0.85, 0.6, 0.85); up.scale.y = 0.7; b.add(up, lo);
  for (const sx of [-1, 1]) { ball(b, 0.035, OR, sx * 0.1, 0.06, 0.02, 1, 2, 1); ball(b, 0.05, OR, sx * 0.1, 0.01, 0.06, 1, 0.4, 1.6); }
  // petite valise-feuille
  const bag = grp(b, -0.36, 0.12, 0.05);
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.26), mat(0x7ed957)); m.castShadow = true; bag.add(m);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.02, 0.22), mat(0x4fb83a)); bag.add(v);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12, Math.PI), mat(0x8a5a3c)); h.position.y = 0.1; h.rotation.y = Math.PI / 2; bag.add(h); }
  const DEF = { ...BASE, wing: 0, bag: false, headTilt: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    wL.rotation.set(0, 0, d.wing * 1.8 + 0.1); wR.rotation.set(0, 0, -d.wing * 1.8 - 0.1);
    c.body.rotation.z = d.headTilt;
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    lo.rotation.x = d.mouth * 0.7; up.rotation.x = -d.mouth * 0.15;
    bag.visible = d.bag;
  };
  return c;
}

// ---------------------------------------------------------------- ZAZOU
export function makeZazou(scene) {
  const Y = 0xffd75e, O = 0xf0a04c, r = rng(11);
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
  // écharpe bleue
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 10, 24), mat(0x4f9dff, { roughness: 0.7 })); scarf.rotation.x = Math.PI / 2 - 0.3; scarf.castShadow = true; neck[2].add(scarf);
  ball(neck[2], 0.12, 0x4f9dff, 0.18, -0.35, 0.4, 0.9, 1.8, 0.5); ball(neck[2], 0.1, 0x3a86e8, 0.22, -0.65, 0.42, 0.9, 1.4, 0.5);
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.03, 6, 24), mat(0xffffff)); s.rotation.x = Math.PI / 2 - 0.3; s.position.y = -0.06 + i * 0.06; neck[2].add(s); }
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
  // lunettes rondes
  for (const sx of [-1, 1]) { const g = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 28), mat(0x5b3f8f, { roughness: 0.3 })); g.position.set(sx * 0.31, 0.2, 0.58); g.rotation.y = sx * 0.25; head.add(g); }
  { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8), mat(0x5b3f8f)); br.rotation.z = Math.PI / 2; br.position.set(0, 0.24, 0.66); head.add(br); }
  const mo = mouth(head, 0.17, 0, -0.32, 0.86);
  const topA = grp(head, 0, 0.5, 0);
  const DEF = { ...BASE, down: 0, headPitch: 0, headYaw: 0, walk: null, sway: 0, wave: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let a = lerp(0.18, 1.2, d.down), bend = lerp(0.0, 0.22, d.down), y = 2.95, z = 1.0;
    for (let i = 0; i < 11; i++) { neck[i].position.set(Math.sin(i * 0.3) * d.sway * i * 0.04, y, z); a += bend; y += 0.5 * Math.cos(a); z += 0.5 * Math.sin(a); }
    head.position.set(d.sway * 0.45, y - 0.1, z + 0.1);
    head.rotation.set(-d.headPitch + d.down * 0.25, d.headYaw, d.sway * 0.2, 'YXZ');
    legs.forEach((g, i) => { g.rotation.x = d.walk === null ? 0 : Math.sin(d.walk + (i % 3 ? Math.PI : 0)) * 0.35; });
    // salut : la patte avant se lève (d.wave = angle, animé par le film)
    legs[0].rotation.z = d.wave ? 0.2 : 0; if (d.wave) legs[0].rotation.x = -d.wave;
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    setMouth(mo, d.mouth, d.smile);
  };
  c.headTop = () => wp(topA); c.headPos = () => wp(head);
  return c;
}

// --------------------------------------------------------- MONSIEUR HIPPO
function stripeTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16; const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff5a5f'; g.fillRect(i * 32, 0, 32, 16); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeHippo(scene) {
  const P = 0xb08cf0, L = 0xd2bcff;
  const c = base(scene), b = c.body;
  ball(b, 0.95, P, 0, 1.05, 0, 1.05, 0.95, 1.0);
  // tablier rayé rouge et blanc
  const ap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, Math.PI / 2 - 0.85, 1.7, 0.95, 1.45),
    new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.7, side: THREE.DoubleSide }));
  ap.scale.set(0.95 * 1.05 * 1.03, 0.95 * 0.95 * 1.03, 0.95 * 1.04); ap.position.set(0, 1.05, 0); ap.castShadow = true; b.add(ap);
  const pk = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.04), mat(0xff5a5f)); pk.position.set(0, 0.78, 0.93); pk.rotation.x = 0.25; b.add(pk);
  const legL = limb(b, 0.27, 0.12, P, 0.42, 0.42, 0), legR = limb(b, 0.27, 0.12, P, -0.42, 0.42, 0);
  for (const l of [legL, legR]) for (const dx of [-0.1, 0, 0.1]) ball(l, 0.05, 0xffffff, dx, -0.42, 0.22);
  const armL = limb(b, 0.19, 0.45, P, 0.95, 1.5, 0.05), armR = limb(b, 0.19, 0.45, P, -0.95, 1.5, 0.05);
  ball(armL, 0.21, P, 0, -0.68, 0); ball(armR, 0.21, P, 0, -0.68, 0);
  const head = grp(b, 0, 2.15, 0.15);
  ball(head, 0.6, P, 0, 0.1, 0, 1.1, 0.9, 1);
  ball(head, 0.62, L, 0, -0.18, 0.42, 1.2, 0.8, 0.85);
  for (const sx of [-1, 1]) {
    ball(head, 0.06, 0x6a4a9a, sx * 0.2, -0.02, 0.92, 1, 0.7, 0.6);
    ball(head, 0.13, P, sx * 0.42, 0.58, -0.05, 1, 1, 0.6); ball(head, 0.08, 0xff9ec4, sx * 0.42, 0.58, 0.0, 1, 1, 0.5);
    ball(head, 0.1, 0xff9ec4, sx * 0.55, -0.15, 0.62, 1, 0.6, 0.4);
  }
  const eL = eye(head, 0.15, 0.25, 0.42, 0.38), eR = eye(head, 0.15, -0.25, 0.42, 0.38);
  const mo = mouth(head, 0.22, 0, -0.38, 0.9);
  const DEF = { ...BASE, aL: [0, 0.2], aR: [0, 0.2], walk: null, headYaw: 0, headPitch: 0, headTilt: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let lL = 0, aL = d.aL, aR = d.aR;
    if (d.walk !== null) { lL = Math.sin(d.walk) * 0.6; c.root.position.y += Math.abs(Math.sin(d.walk)) * 0.06; }
    legL.rotation.x = -lL; legR.rotation.x = lL;
    armL.rotation.set(-aL[0], 0, aL[1]); armR.rotation.set(-aR[0], 0, -aR[1]);
    head.rotation.set(-d.headPitch, d.headYaw, d.headTilt, 'YXZ');
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    setMouth(mo, d.mouth, d.smile);
  };
  return c;
}
