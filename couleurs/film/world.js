// Décors : la cour d'école (x = 0) et la salle de classe (x = CLASS_X), sous un grand ciel bleu.
import * as THREE from 'three';
import { ball, box, cyl, grp, mat, mesh, rng, lerp, clamp } from './kids.js';

export const CLASS_X = 200;
export const SIX = [0xf5222d, 0xff8a00, 0xffd60a, 0x22b83c, 0x1e7bf2, 0x8e3fe0];   // ordre de l'arc-en-ciel

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const flat = (parent, w, h, color, x, y, z, o) => { const m = mesh(parent, new THREE.PlaneGeometry(w, h), color, x, y, z, o); m.castShadow = false; return m; };
const floorPlane = (parent, w, d, color, x, y, z, o) => { const m = flat(parent, w, d, color, x, y, z, { roughness: 0.9, ...o }); m.rotation.x = -Math.PI / 2; return m; };

export function buildWorld(scene) {
  const R = rng(42), W = {};
  scene.background = canvasTex(8, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1d8dff'); gr.addColorStop(0.5, '#56b9ff'); gr.addColorStop(1, '#c6ecff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  // lumière chaude et douce
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd9a8, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 5;
  const fill = new THREE.DirectionalLight(0xffe2c8, 0.5);
  scene.add(sun, sun.target, fill, fill.target);
  W.focus = (x, y, z) => { sun.target.position.set(x, y, z); sun.position.set(x - 8, y + 20, z + 13); fill.target.position.set(x, y, z); fill.position.set(x + 10, y + 4, z + 14); };

  // ------------------------------------------------------------ le ciel
  const sky = grp(scene);
  const clouds = [];
  for (let i = 0; i < 11; i++) {
    const g = grp(sky, -70 + i * 14 + R() * 6, 15 + R() * 12, -55 - R() * 25), s = 1.6 + R() * 1.6;
    for (let k = 0; k < 5; k++) ball(g, s * (0.8 + R() * 0.6), 0xffffff, (k - 2) * s * 0.95, R() * s * 0.4, R(), 1, 0.72, 0.8, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 }).castShadow = false;
    clouds.push([g, g.position.x, 0.25 + R() * 0.3]);
  }
  ball(sky, 3.2, 0xfff2a8, -40, 34, -85, 1, 1, 1, { emissive: 0xffe98a, emissiveIntensity: 1.4 }).castShadow = false;

  // ------------------------------------------------------------ la cour
  const yard = grp(scene);
  floorPlane(yard, 240, 160, 0x8ed85a, 0, -0.02, -30);                       // herbe au loin
  floorPlane(yard, 44, 30, 0xf6d9a4, 0, 0, -1);                             // sol clair de la cour
  for (let i = 0; i < 40; i++) ball(yard, 1 + R() * 2, [0xf9e2b6, 0xf0cf95][i % 2], -20 + R() * 40, 0, -14 + R() * 26, 1, 0.006, 0.7, { roughness: 1 }).castShadow = false;
  // marelle peinte + ronds de jeu
  for (let i = 0; i < 6; i++) floorPlane(yard, 1.1, 1.1, SIX[i], -9.5 + (i % 2) * 1.2, 0.012, 3.2 - Math.floor(i / 2) * 1.2 - (i % 2) * 0.6, { roughness: 0.7 });
  for (let i = 0; i < 3; i++) { const t = mesh(yard, new THREE.RingGeometry(1.5 - i * 0.45, 1.75 - i * 0.45, 48), 0xffffff, 9.5, 0.012, 2.2, { roughness: 0.8 }); t.rotation.x = -Math.PI / 2; t.castShadow = false; }

  // l'école
  const sch = grp(yard, 0, 0, -13.5);
  box(sch, 26, 6.2, 5, 0xffe9ae, 0, 3.1, 0, { roughness: 0.85 });
  box(sch, 26.2, 0.9, 5.2, 0xffc978, 0, 0.45, 0, { roughness: 0.85 });
  const prism = (w, h, len) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); return g; };
  const roof = mesh(sch, prism(6.4, 2.3, 27.4), 0xf2643c, 0, 6.2, 0, { roughness: 0.7 }); roof.rotation.y = Math.PI / 2;
  box(sch, 5.4, 7.6, 5.6, 0xfff3cf, 0, 3.8, 0.2, { roughness: 0.85 });         // porche central
  mesh(sch, prism(6.6, 2.6, 6.4), 0xf2643c, 0, 7.6, 0.2, { roughness: 0.7 });
  cyl(sch, 1.25, 1.25, 0.3, 0x29c4c9, 0, 3.3, 2.95, 40).rotation.x = Math.PI / 2;                          // porte arrondie
  box(sch, 2.5, 3.3, 0.3, 0x29c4c9, 0, 1.65, 2.95); box(sch, 0.07, 3.6, 0.34, 0xffffff, 0, 1.8, 2.96);
  for (const sx of [1, -1]) ball(sch, 0.11, 0xffffff, sx * 0.3, 1.7, 3.15);
  cyl(sch, 0.8, 0.8, 0.2, 0xffffff, 0, 6.0, 3.02, 40).rotation.x = Math.PI / 2; cyl(sch, 0.66, 0.66, 0.24, 0xbfeaff, 0, 6.0, 3.02, 40, { emissive: 0x9ddcff, emissiveIntensity: 0.3 }).rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) box(sch, 4.2 + i * 0.7, 0.22, 1.2 + i * 0.5, 0xffd9a0, 0, 0.55 - i * 0.2, 3.2 + i * 0.25);
  [-10.2, -6.4, 6.4, 10.2].forEach((x, i) => {
    box(sch, 2.5, 2.7, 0.2, 0xffffff, x, 3.5, 2.5); box(sch, 2.15, 2.35, 0.24, 0xbfeaff, x, 3.5, 2.5, { roughness: 0.2, emissive: 0x9ddcff, emissiveIntensity: 0.3 });
    box(sch, 0.09, 2.35, 0.28, 0xffffff, x, 3.5, 2.5); box(sch, 2.15, 0.09, 0.28, 0xffffff, x, 3.5, 2.5);
    const c = [SIX[0], SIX[2], SIX[4], SIX[5]][i];
    for (const sx of [1, -1]) box(sch, 0.75, 2.6, 0.14, c, x + sx * 1.65, 3.5, 2.58);
    box(sch, 2.8, 0.4, 0.6, c, x, 1.95, 2.7); for (let k = 0; k < 5; k++) ball(sch, 0.2, [0xff7eb6, 0xffffff, 0xffd60a][k % 3], x - 1 + k * 0.5, 2.3, 2.75);
  });
  // guirlande de fanions entre deux mâts
  const flags = [];
  for (const sx of [1, -1]) { cyl(yard, 0.09, 0.11, 6.6, 0xffffff, sx * 12.5, 3.3, -9.2); ball(yard, 0.22, 0xffd60a, sx * 12.5, 6.7, -9.2); }
  for (let i = 0; i < 25; i++) {
    const u = i / 24, x = lerp(-12.5, 12.5, u), y = 6.5 - Math.sin(u * Math.PI) * 1.5;
    const f = mesh(yard, new THREE.ConeGeometry(0.42, 0.85, 3), SIX[i % 6], x, y - 0.45, -9.2, { roughness: 0.6 }); f.rotation.x = Math.PI; f.scale.z = 0.12; flags.push(f);
    if (i < 24) { const x2 = lerp(-12.5, 12.5, (i + 1) / 24), y2 = 6.5 - Math.sin((i + 1) / 24 * Math.PI) * 1.5, s = cyl(yard, 0.02, 0.02, Math.hypot(x2 - x, y2 - y), 0xffffff, (x + x2) / 2, (y + y2) / 2, -9.2, 5); s.rotation.z = Math.atan2(y2 - y, x2 - x) + Math.PI / 2; }
  }
  // barrière en bois clair
  for (let i = 0; i < 2; i++) for (const sx of [1, -1]) {
    for (let k = 0; k < 13; k++) { const z = -10 + k * 1.15; box(yard, 0.16, 1.25, 0.36, 0xfff6e0, sx * 20, 0.62, z); ball(yard, 0.18, 0xfff6e0, sx * 20, 1.25, z, 0.5, 1, 1); }
    box(yard, 0.1, 0.16, 14.5, 0xffe2b0, sx * 20, 0.45 + i * 0.5, -3.2);
  }
  // arbres, buissons, fleurs du jardin
  const GREENS = [0x35c46a, 0x22b05e, 0x5fd67a, 0x41cf83];
  const tree = (x, z, h, cr) => {
    const g = grp(yard, x, 0, z);
    cyl(g, 0.32, 0.45, h, 0xa9744d, 0, h / 2, 0, 14, { roughness: 0.9 });
    for (let i = 0; i < 6; i++) { const a = i / 5 * 6.28, rr = i === 0 ? 0 : cr * 0.7; ball(g, cr * (0.8 + R() * 0.3), GREENS[i % 4], Math.cos(a) * rr, h + (i === 0 ? cr * 0.6 : R() * cr * 0.3), Math.sin(a) * rr, 1, 0.85, 1, { roughness: 0.85 }); }
  };
  tree(-16.5, -7.5, 4.2, 2.3); tree(16.8, -7, 4.6, 2.5); tree(-24, -15, 5.5, 3); tree(24.5, -16, 5.2, 3); tree(-31, -6, 5, 2.8); tree(31, -5, 5.4, 2.9);
  for (let i = 0; i < 14; i++) tree(-70 + i * 11 + R() * 5, -34 - R() * 14, 4.5 + R() * 2.5, 2.6 + R() * 1.2);
  for (let i = 0; i < 12; i++) { const sx = i % 2 ? 1 : -1, g = grp(yard, sx * (15 + R() * 4), 0, -9.5 + R() * 9); for (let k = 0; k < 3; k++) ball(g, 0.5 + R() * 0.35, GREENS[(i + k) % 4], (k - 1) * 0.6, 0.35, R() * 0.4, 1, 0.85, 1, { roughness: 0.85 }); }
  const bed = (x, z, n, cols) => { for (let i = 0; i < n; i++) { const g = grp(yard, x + (R() - 0.5) * 3.4, 0, z + (R() - 0.5) * 1.2), h = 0.35 + R() * 0.35, c = cols[i % cols.length];
    cyl(g, 0.025, 0.03, h, 0x2fa84f, 0, h / 2, 0, 6); for (let k = 0; k < 5; k++) ball(g, 0.1, c, Math.cos(k * 1.257) * 0.12, h + 0.02, Math.sin(k * 1.257) * 0.12, 1, 0.55, 1).castShadow = false; ball(g, 0.075, 0xfff3c4, 0, h + 0.05, 0).castShadow = false; } };
  bed(-13, 4.2, 16, [0xff7eb6, 0xffffff, SIX[2]]); bed(13, 4.4, 16, [0xffffff, 0xff7eb6, SIX[1]]);
  // toboggan + banc
  const sl = grp(yard, -13.5, 0, -4.5); sl.rotation.y = 0.5;
  for (const sx of [1, -1]) for (const sz of [1, -1]) cyl(sl, 0.1, 0.1, 2.6, SIX[4], sx * 0.7, 1.3, sz * 0.7);
  box(sl, 1.7, 0.16, 1.7, SIX[2], 0, 2.6, 0); const ramp = box(sl, 1.3, 0.14, 4.2, SIX[0], 0, 1.3, 2.6); ramp.rotation.x = 0.68;
  for (let i = 0; i < 5; i++) box(sl, 1.2, 0.1, 0.12, 0xffffff, 0, 0.45 + i * 0.45, -0.85);
  for (const sx of [1, -1]) { const r = box(sl, 0.1, 0.4, 4.2, SIX[2], sx * 0.68, 1.5, 2.6); r.rotation.x = 0.68; }
  const bench = grp(yard, 13.5, 0, -6.5); bench.rotation.y = -0.4;
  box(bench, 3, 0.16, 0.9, 0x29c4c9, 0, 0.75, 0); box(bench, 3, 0.9, 0.14, 0x29c4c9, 0, 1.4, -0.42); for (const sx of [1, -1]) box(bench, 0.16, 0.75, 0.8, 0xffffff, sx * 1.2, 0.37, 0);

  // l'arc-en-ciel (se dessine avec W.rainbow(p))
  const bows = SIX.map((c, i) => {
    const r = 17.5 - i * 0.95, pts = []; for (let k = 0; k <= 96; k++) { const a = Math.PI * (k / 96); pts.push(new THREE.Vector3(-Math.cos(a) * r, Math.sin(a) * r, 0)); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.5, 8, false);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c })); m.position.set(0, 5.5, -34); m.scale.z = 0.3; yard.add(m); return m;
  });
  W.rainbow = (p) => bows.forEach((m, i) => { const q = clamp(p * 1.25 - i * 0.05); m.visible = q > 0; m.geometry.setDrawRange(0, Math.floor(q * 96) * 8 * 6); });

  // confettis des six couleurs
  const NC = 420, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.24), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), NC), cd = [], dummy = new THREE.Object3D();
  for (let i = 0; i < NC; i++) { conf.setColorAt(i, new THREE.Color(SIX[i % 6])); cd.push([R(), R(), R(), R()]); }
  conf.frustumCulled = false; scene.add(conf);
  W.confetti = (cx, t, amount = 1) => {
    conf.visible = amount > 0; if (!conf.visible) return;
    for (let i = 0; i < NC; i++) {
      const [a, b, c, d] = cd[i], on = i / NC < amount, y = 11 - ((t * (1.4 + c * 1.2) + d * 11) % 11.5);
      dummy.position.set(cx + (a - 0.5) * 24 + Math.sin(t * 2 + i) * 0.4, on ? y : -50, -5 + b * 9);
      dummy.rotation.set(t * (2 + c * 3) + i, t * (1 + d * 2), i); dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
    }
    conf.instanceMatrix.needsUpdate = true;
  };

  // ------------------------------------------------------------ la classe
  const cls = grp(scene, CLASS_X, 0, 0);
  floorPlane(cls, 26, 16, 0xf7cf95, 0, 0, 1); for (let i = 0; i < 13; i++) floorPlane(cls, 0.05, 16, 0xeab97a, -12 + i * 2, 0.01, 1);
  for (let i = 0; i < 4; i++) { const t = mesh(cls, new THREE.CircleGeometry(4.2 - i * 0.95, 56), [0xff9fc6, 0xfff6e0, 0x7fe0d8, 0xfff6e0][i], 0, 0.02 + i * 0.004, 0.6, { roughness: 0.95 }); t.rotation.x = -Math.PI / 2; t.castShadow = false; }
  const wall = (w, h, color, x, y, z, ry) => { const m = flat(cls, w, h, color, x, y, z, { roughness: 0.95 }); m.rotation.y = ry; m.receiveShadow = true; return m; };
  wall(26, 10, 0xfff0c2, 0, 5, -5.5, 0); wall(26, 1.4, 0x7fe0d8, 0, 0.7, -5.48, 0); wall(26, 0.14, 0xffffff, 0, 1.45, -5.47, 0);
  wall(16, 10, 0xffe3b8, -13, 5, 1, Math.PI / 2); wall(16, 10, 0xffe3b8, 13, 5, 1, -Math.PI / 2);
  wall(16, 1.4, 0x7fe0d8, -12.98, 0.7, 1, Math.PI / 2); wall(16, 1.4, 0x7fe0d8, 12.98, 0.7, 1, -Math.PI / 2);
  // tableau avec dessins à la craie (pas de texte)
  box(cls, 7.4, 3.3, 0.16, 0xc98a4b, 0, 3.75, -5.4);
  const chalk = canvasTex(1024, 440, (g, w, h) => {
    g.fillStyle = '#2f9c6c'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.arc(170, 150, 62, 0, 6.3); g.stroke(); for (let i = 0; i < 10; i++) { const a = i * 0.628; g.beginPath(); g.moveTo(170 + Math.cos(a) * 82, 150 + Math.sin(a) * 82); g.lineTo(170 + Math.cos(a) * 112, 150 + Math.sin(a) * 112); g.stroke(); }
    g.beginPath(); g.moveTo(420, 330); g.lineTo(420, 190); g.lineTo(510, 110); g.lineTo(600, 190); g.lineTo(600, 330); g.closePath(); g.stroke(); g.strokeRect(480, 250, 55, 80);
    g.beginPath(); g.moveTo(820, 120); for (let i = 1; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 40 : 95; g.lineTo(820 + Math.cos(a) * r, 215 + Math.sin(a) * r); } g.closePath(); g.stroke();
    g.beginPath(); for (let x = 60; x < 980; x += 6) g.lineTo(x, 385 + Math.sin(x / 40) * 10); g.stroke();
  });
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.9), new THREE.MeshStandardMaterial({ map: chalk, roughness: 0.9 })); bd.position.set(0, 3.75, -5.3); cls.add(bd);
  box(cls, 7.2, 0.12, 0.3, 0xc98a4b, 0, 2.2, -5.25); for (let i = 0; i < 4; i++) box(cls, 0.3, 0.09, 0.09, [0xffffff, 0xff7eb6, 0xffffff, 0x7fe0d8][i], -1 + i * 0.6, 2.3, -5.2);
  // fenêtres sur le ciel bleu
  const pane = canvasTex(256, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2f9bff'); gr.addColorStop(1, '#bfe8ff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff'; for (const [x, y, r] of [[80, 150, 34], [120, 135, 44], [165, 152, 32]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); } g.fillRect(70, 150, 110, 30); });
  for (const sx of [1, -1]) {
    box(cls, 3.5, 3.5, 0.14, 0xffffff, sx * 8.2, 4.0, -5.42);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1), new THREE.MeshBasicMaterial({ map: pane })); p.position.set(sx * 8.2, 4.0, -5.33); cls.add(p);
    box(cls, 0.1, 3.1, 0.18, 0xffffff, sx * 8.2, 4.0, -5.36); box(cls, 3.1, 0.1, 0.18, 0xffffff, sx * 8.2, 4.0, -5.36);
    for (const s2 of [1, -1]) { const cu = flat(cls, 0.8, 3.7, 0xff9fc6, sx * 8.2 + s2 * 2.05, 4.1, -5.3); cu.receiveShadow = true; }
  }
  // affiches de formes, guirlande, étagères, tables
  const poster = (x, y, bg, fg, shape) => { const t = canvasTex(160, 200, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 160, 200); g.fillStyle = fg; g.beginPath();
    if (shape === 0) g.arc(80, 100, 52, 0, 6.3); if (shape === 1) { g.moveTo(80, 40); g.lineTo(140, 150); g.lineTo(20, 150); } if (shape === 2) g.rect(32, 52, 96, 96);
    if (shape === 3) { g.moveTo(80, 160); g.bezierCurveTo(-10, 90, 50, 20, 80, 70); g.bezierCurveTo(110, 20, 170, 90, 80, 160); } g.fill(); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.38), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })); m.position.set(x, y, -5.38); cls.add(m); };
  poster(-5.1, 6.9, '#fff', '#f5222d', 0); poster(-3.4, 6.9, '#fff', '#1e7bf2', 1); poster(3.4, 6.9, '#fff', '#ffd60a', 2); poster(5.1, 6.9, '#fff', '#8e3fe0', 3);
  poster(-1.7, 6.9, '#fff', '#22b83c', 2); poster(0, 6.9, '#fff', '#ff8a00', 0); poster(1.7, 6.9, '#fff', '#ff7eb6', 3);
  for (let i = 0; i < 27; i++) { const u = i / 26, x = lerp(-12.6, 12.6, u), y = 8.9 - Math.sin(((u * 3) % 1) * Math.PI) * 0.55; const f = mesh(cls, new THREE.ConeGeometry(0.34, 0.7, 3), SIX[i % 6], x, y - 0.4, -5.3, { roughness: 0.6 }); f.rotation.x = Math.PI; f.scale.z = 0.1; }
  for (const sx of [1, -1]) {
    const sh = grp(cls, sx * 10.6, 0, -4.6);
    box(sh, 3.4, 2.6, 1.1, 0xfff6e0, 0, 1.3, 0); for (let k = 0; k < 2; k++) box(sh, 3.1, 0.95, 0.2, 0xf3d9ae, 0, 0.75 + k * 1.15, 0.5);
    for (let k = 0; k < 6; k++) box(sh, 0.42, 0.42, 0.42, SIX[(k + (sx > 0 ? 3 : 0)) % 6], -1.25 + k * 0.5, 0.52 + (k % 2) * 1.15, 0.72, { roughness: 0.4 }).rotation.y = R();
    for (let k = 0; k < 5; k++) box(sh, 0.16, 0.7 + R() * 0.15, 0.5, SIX[(k * 2 + 1) % 6], -1.2 + k * 0.2 + (sx > 0 ? 1.4 : 0), 1.95 + (0), 0.7 - 1.0 + 1.0, { roughness: 0.6 }).position.y = 2.95;
    ball(sh, 0.42, 0x7fe0d8, sx * -1.0, 3.15, 0.1, 1, 1, 1, { roughness: 0.3 }); cyl(sh, 0.2, 0.28, 0.2, 0xc98a4b, sx * -1.0, 2.7, 0.1);
  }
  const table = (x, z, c) => { const g = grp(cls, x, 0, z); cyl(g, 1.25, 1.25, 0.14, c, 0, 1.0, 0, 40, { roughness: 0.5 }); cyl(g, 0.14, 0.22, 1.0, 0xffffff, 0, 0.5, 0);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.6, s = grp(g, Math.cos(a) * 1.75, 0, Math.sin(a) * 1.3 - 0.2); cyl(s, 0.36, 0.36, 0.12, 0xfff6e0, 0, 0.56, 0, 24); cyl(s, 0.07, 0.1, 0.56, 0xffffff, 0, 0.28, 0); } return g; };
  const t1 = table(-7.3, -1.6, 0xff9fc6), t2 = table(7.3, -1.6, 0x7fe0d8);
  cyl(t1, 0.28, 0.2, 0.36, 0xffffff, 0.3, 1.25, 0.2); for (let k = 0; k < 6; k++) { const pc = cyl(t1, 0.035, 0.035, 0.5, SIX[k], 0.3 + Math.cos(k) * 0.12, 1.55, 0.2 + Math.sin(k) * 0.12, 6); pc.rotation.z = Math.cos(k) * 0.25; pc.rotation.x = Math.sin(k) * 0.25; }
  for (let k = 0; k < 3; k++) box(t2, 0.6, 0.05, 0.8, [0xffffff, 0xfff6e0, 0xffffff][k], -0.3 + k * 0.25, 1.1 + k * 0.05, 0.1).rotation.y = k * 0.4;
  // chevalet pour dessiner (couplet vert) : le pré apparaît avec W.drawing(p)
  const ea = grp(cls, 3.7, 0, -0.6); ea.rotation.y = -0.22; W.easel = ea;
  for (const sx of [1, -1]) { const l = cyl(ea, 0.06, 0.06, 3.3, 0xc98a4b, sx * 0.75, 1.6, -0.25); l.rotation.z = sx * 0.12; } const bl = cyl(ea, 0.06, 0.06, 3.2, 0xc98a4b, 0, 1.55, -0.75); bl.rotation.x = -0.3;
  box(ea, 2.3, 1.75, 0.08, 0xffffff, 0, 2.1, -0.12, { roughness: 0.8 }); box(ea, 2.5, 0.1, 0.3, 0xc98a4b, 0, 1.18, -0.02);
  const dr = grp(ea, 0, 2.1, -0.07), strokes = [];
  const hill = (x, r, c) => { const m = mesh(dr, new THREE.CircleGeometry(r, 40, 0, Math.PI), c, x, -0.78, 0.002 + strokes.length * 0.001, { roughness: 0.8 }); m.castShadow = false; strokes.push(m); };
  hill(-0.45, 0.75, 0x22b83c); hill(0.55, 0.62, 0x35c94f); hill(0.05, 0.42, 0x1ca336);
  for (let i = 0; i < 16; i++) { const m = flat(dr, 0.05, 0.3 + R() * 0.2, 0x22b83c, -1 + i * 0.133, -0.55 + R() * 0.75, 0.012, { roughness: 0.8 }); m.rotation.z = (R() - 0.5) * 0.7; strokes.push(m); }
  W.drawing = (p) => strokes.forEach((m, i) => { const q = clamp(p * (strokes.length + 2) - i); m.visible = q > 0; m.scale.set(i < 3 ? q : 1, q, 1); });
  W.penAt = (p) => { const i = Math.min(strokes.length - 1, Math.floor(p * (strokes.length + 2))), m = strokes[i]; m.updateWorldMatrix(true, false); const v = new THREE.Vector3(0, i < 3 ? 0.4 : 0.15, 0.05).applyMatrix4(m.matrixWorld); return v; };

  W.show = (where) => { yard.visible = where === 'yard'; cls.visible = where === 'class'; };
  W.update = (t) => { clouds.forEach(([g, x0, v]) => { g.position.x = x0 + t * v; }); flags.forEach((f, i) => { f.rotation.z = Math.sin(t * 3 + i * 0.7) * 0.12; }); W.rainbow(0); W.confetti(0, 0, 0); W.drawing(0); };
  return W;
}
