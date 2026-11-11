// Personnages de « Miko Miko Bam » : Malou le petit éléphant et l'hippopotame.
// (la girafe et le singe viennent de film/characters.js)
import * as THREE from 'three';
import { ball, grp, mat, lerp, limb, eye, setEye, mouth, setMouth, base, place, BASE, wp } from '../film/characters.js';

// ------------------------------------------------------------------ MALOU
// Bébé éléphant bleu lavande, grandes oreilles pêche, salopette jaune à gros bouton rouge,
// bracelet rayé rouge et blanc à la cheville droite, trois petits poils sur la tête.
export function makeMalou(scene) {
  const LAV = 0x9d9cf2, LIGHT = 0xd8dbff, PEACH = 0xffb7a6, PINK = 0xff9ec4, YEL = 0xffcf1f, RED = 0xf23b3b, DARK = 0x6f6bd6;
  const c = base(scene), b = c.body;
  ball(b, 0.62, LAV, 0, 0.9, 0, 1, 1.02, 0.95);
  ball(b, 0.46, LIGHT, 0, 0.98, 0.2, 1, 0.9, 0.9);
  // salopette
  ball(b, 0.66, YEL, 0, 0.74, 0, 1, 0.7, 0.97, { roughness: 0.75 });
  ball(b, 0.42, YEL, 0, 1.02, 0.36, 1, 1.05, 0.55, { roughness: 0.75 });
  ball(b, 0.1, RED, 0, 1.08, 0.6, 1, 1, 0.6, { roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), mat(YEL, { roughness: 0.75 }));
    st.position.set(sx * 0.3, 1.0, 0); st.rotation.y = Math.PI / 2 + sx * 0.2; st.scale.set(1.22, 1.02, 1);
    st.castShadow = true; b.add(st);
  }
  const legL = limb(b, 0.23, 0.22, LAV, 0.3, 0.5, 0), legR = limb(b, 0.23, 0.22, LAV, -0.3, 0.5, 0);
  for (const l of [legL, legR]) {
    for (const dx of [-0.11, 0, 0.11]) ball(l, 0.055, 0xffffff, dx, -0.4, 0.2);
    ball(l, 0.26, YEL, 0, -0.02, 0, 1, 0.6, 1, { roughness: 0.75 });
  }
  [RED, 0xffffff, RED].forEach((col, i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.04, 8, 24), mat(col, { roughness: 0.4 }));
    r.rotation.x = Math.PI / 2; r.position.y = -0.2 - i * 0.065; r.castShadow = true; legR.add(r);
  });
  const footA = grp(legR, 0, -0.5, 0.1);
  const armL = limb(b, 0.17, 0.36, LAV, 0.56, 1.22, 0.05), armR = limb(b, 0.17, 0.36, LAV, -0.56, 1.22, 0.05);
  ball(b, 0.07, LAV, 0, 0.6, -0.62); ball(b, 0.09, DARK, 0, 0.5, -0.72);
  // tête
  const head = grp(b, 0, 1.85, 0.05);
  ball(head, 0.74, LAV, 0, 0, 0, 1.05, 0.95, 1);
  const earL = grp(head, 0.6, 0.15, -0.05), earR = grp(head, -0.6, 0.15, -0.05);
  for (const [e, sx] of [[earL, 1], [earR, -1]]) {
    ball(e, 0.66, LAV, sx * 0.56, 0, 0, 1, 1.05, 0.15);
    ball(e, 0.5, PEACH, sx * 0.58, -0.02, 0.07, 1, 1.05, 0.09);
  }
  const eL = eye(head, 0.22, 0.29, 0.14, 0.62), eR = eye(head, 0.22, -0.29, 0.14, 0.62);
  for (const e of [eL, eR]) ball(e.p, e.r * 0.7, 0x7a4a26, 0, 0, e.r * 0.36, 1, 1, 0.45, { roughness: 0.2 });   // iris marron
  const brL = ball(head, 0.1, DARK, 0.3, 0.46, 0.6, 1.4, 0.3, 0.5), brR = ball(head, 0.1, DARK, -0.3, 0.46, 0.6, 1.4, 0.3, 0.5);
  const chL = ball(head, 0.14, PINK, 0.5, -0.14, 0.52, 1, 0.65, 0.4), chR = ball(head, 0.14, PINK, -0.5, -0.14, 0.52, 1, 0.65, 0.4);
  const mo = mouth(head, 0.16, 0, -0.42, 0.56);
  const trunk = []; for (let i = 0; i < 8; i++) trunk.push(ball(head, lerp(0.2, 0.12, i / 7), i === 7 ? DARK : LAV));
  for (const a of [-0.35, 0, 0.35]) {   // les trois petits poils
    const h = limb(head, 0.022, 0.22, DARK, 0, 0.68, 0.02); h.rotation.set(Math.PI - 0.15, 0, a);
  }
  const topA = grp(head, 0, 0.72, 0);

  const DEF = { ...BASE, aL: [0, 0.15], aR: [0, 0.15], walk: null, trunkUp: 0.6, trunkSway: 0, ear: 0, headYaw: 0, headPitch: 0,
    headTilt: 0, blush: 1, wink: 0, kL: 0, kR: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    let lL = 0, lR = 0, aL = d.aL, aR = d.aR;
    if (d.walk !== null) {
      lL = Math.sin(d.walk) * 0.7; lR = -lL; aL = [-lL * 0.8, 0.2]; aR = [-lR * 0.8, 0.2];
      c.root.position.y += Math.abs(Math.sin(d.walk)) * 0.07;
    }
    legL.rotation.x = -lL - d.kL * 1.35; legR.rotation.x = -lR - d.kR * 1.35;
    armL.rotation.set(-aL[0], 0, aL[1]); armR.rotation.set(-aR[0], 0, -aR[1]);
    head.rotation.set(-d.headPitch, d.headYaw, d.headTilt, 'YXZ');
    earL.rotation.y = -0.25 - d.ear; earR.rotation.y = 0.25 + d.ear;
    setEye(eL, Math.max(d.blink, d.wink), d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
    for (const [br, sx] of [[brL, 1], [brR, -1]]) { br.position.y = 0.46 + Math.max(0, d.brow) * 0.1 + (d.eye - 1) * 0.2; br.rotation.z = sx * -d.brow * 0.45; }
    chL.scale.set(0.14 * d.blush, 0.09 * d.blush, 0.056 * d.blush); chR.scale.copy(chL.scale);
    setMouth(mo, d.mouth, d.smile);
    // petite trompe qui remonte comme un sourire
    let a = lerp(-1.15, 0.35, d.trunkUp), cu = lerp(-0.05, 0.3, d.trunkUp), y = -0.1, z = 0.7, x = 0;
    for (let i = 0; i < 8; i++) { trunk[i].position.set(x, y, z); a += cu; y += 0.15 * Math.sin(a); z += 0.15 * Math.cos(a); x += d.trunkSway * 0.03 * i; }
  };
  c.headTop = () => wp(topA); c.foot = () => wp(footA); c.headPos = () => wp(head);
  return c;
}

// ----------------------------------------------------------- HIPPOPOTAME
export function makeHippo(scene) {
  const H = 0x9a8fc4, D = 0x7d72ad, PINK = 0xff9ec4;
  const c = base(scene), b = c.body;
  ball(b, 1.5, H, 0, 0.9, -0.6, 1.05, 0.8, 1.3);
  const head = grp(b, 0, 1.15, 1.0);
  ball(head, 0.95, H, 0, 0.1, -0.1, 1, 0.85, 1);
  const up = grp(head, 0, 0, 0.2);
  ball(up, 0.85, H, 0, 0.05, 0.65, 1.15, 0.6, 1);
  for (const sx of [-1, 1]) { ball(up, 0.1, D, sx * 0.4, 0.42, 1.2, 1, 0.6, 1); ball(up, 0.09, 0xffffff, sx * 0.45, -0.3, 1.2, 0.8, 1.4, 0.8); }
  const jaw = grp(head, 0, -0.25, 0.2);
  ball(jaw, 0.8, D, 0, -0.1, 0.6, 1.12, 0.45, 1);
  ball(jaw, 0.62, 0xff7fa0, 0, 0.04, 0.6, 1.1, 0.25, 1);
  for (const sx of [-1, 1]) {
    ball(head, 0.2, H, sx * 0.62, 0.78, -0.3, 0.8, 1, 0.5); ball(head, 0.11, PINK, sx * 0.62, 0.78, -0.22, 0.8, 1, 0.5);
    ball(head, 0.16, PINK, sx * 0.72, 0.05, 0.6, 0.5, 0.7, 1);
  }
  const eL = eye(head, 0.2, 0.36, 0.62, 0.48), eR = eye(head, 0.2, -0.36, 0.62, 0.48);
  const DEF = { ...BASE, headPitch: 0, headYaw: 0 };
  c.set = (p) => {
    const d = { ...DEF, ...p }; place(c, d);
    head.rotation.set(-d.headPitch, d.headYaw, 0, 'YXZ');
    up.rotation.x = -d.mouth * 0.55; jaw.rotation.x = d.mouth * 0.5;
    setEye(eL, d.blink, d.look[0], d.look[1], d.eye); setEye(eR, d.blink, d.look[0], d.look[1], d.eye);
  };
  return c;
}
