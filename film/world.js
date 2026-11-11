// Décor : la jungle magique (arbres géants, fleurs lumineuses, rivière scintillante) + effets.
import * as THREE from 'three';
import { ball, grp, mat, rng, lerp, clamp, hop } from './characters.js';

export const LOG_X = 30, RIVER = [57, 67], TREE_X = 100, NEST = new THREE.Vector3(100.4, 7.1, 0.3), DANCE_X = 112;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const starTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 60; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
  g.fill();
});
function sprite(parent, tex, color, size, additive = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
  s.scale.setScalar(size); parent.add(s); return s;
}

export function buildWorld(scene) {
  const R = rng(42), W = { };
  // ciel
  scene.background = canvasTex(8, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#39b8ff'); gr.addColorStop(0.55, '#9be4ff'); gr.addColorStop(0.85, '#fff4b8'); gr.addColorStop(1, '#ffe08a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0xb9f2dc, 28, 95);

  // lumière chaude et douce
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8fe39a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.75);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  W.focus = (x, y, z) => { sun.target.position.set(x, y, z); sun.position.set(x + 9, y + 20, z + 12); };

  // sol + chemin
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), mat(0x6fd66a, { roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  for (let i = 0; i < 90; i++) { // taches d'herbe plus claires / plus foncées
    const m = ball(scene, 1.5 + R() * 3, [0x86e070, 0x5cc85e, 0x9be87a][i % 3], -25 + R() * 160, 0, -12 + R() * 22, 1, 0.012, 0.7, { roughness: 0.9 });
    m.castShadow = false;
  }
  const path = (x0, x1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 3.2), mat(0xffe9a6, { roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.02, 0); m.receiveShadow = true; scene.add(m); };
  path(-30, RIVER[0] - 0.5); path(RIVER[1] + 0.5, 135);
  for (let i = 0; i < 70; i++) { const m = ball(scene, 0.12 + R() * 0.14, 0xfff6cf, -28 + R() * 160, 0.02, -1.4 + R() * 2.8, 1, 0.3, 1); m.castShadow = false; }

  // arbres géants
  const GREENS = [0x2fbf71, 0x1fa67a, 0x58d68d, 0x12b886, 0x7ed957, 0x3ccf8e], TRUNKS = [0x9b6a4a, 0x8a5a66, 0xa87850];
  const tree = (x, z, h, tr, cr) => {
    const g = grp(scene, x, 0, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.8, tr * 1.15, h, 14), mat(TRUNKS[Math.floor(R() * 3)], { roughness: 0.85 }));
    t.position.y = h / 2; t.castShadow = true; t.receiveShadow = true; g.add(t);
    for (let i = 0; i < 4; i++) ball(g, tr * 0.6, t.material.color.getHex(), Math.cos(i * 1.6) * tr, 0.1, Math.sin(i * 1.6) * tr, 1, 0.7, 1);
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28 + R(), rr = i === 0 ? 0 : cr * 0.75;
      ball(g, cr * (0.75 + R() * 0.4), GREENS[Math.floor(R() * GREENS.length)], Math.cos(a) * rr, h + (i === 0 ? cr * 0.5 : R() * cr * 0.4), Math.sin(a) * rr, 1, 0.8, 1, { roughness: 0.8 });
    }
    return g;
  };
  for (let i = 0; i < 64; i++) {
    const x = -28 + R() * 162, z = -7 - R() * 30;
    if (Math.abs(x - 62) < 7 || (Math.abs(x - TREE_X) < 7 && z > -12) || (Math.abs(x - LOG_X) < 4 && z > -9)) { R(); R(); continue; }
    tree(x, z, 8 + R() * 7, 0.6 + R() * 0.7, 2.6 + R() * 1.8);
  }
  // l'arbre du singe (avec sa grosse branche) et l'arbre géant du nid
  tree(LOG_X + 1.5, -4.2, 13, 1.1, 4.2);
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 6, 10), mat(0x9b6a4a)); br.rotation.x = Math.PI / 2; br.position.set(LOG_X, 10.6, -1.5); br.castShadow = true; scene.add(br);
  ball(scene, 1.6, 0x58d68d, LOG_X, 10.9, 1.6, 1, 0.7, 1);
  const big = tree(TREE_X + 0.5, -4, 17, 2.3, 7);
  const nb = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 6.5, 12), mat(0x9b6a4a)); nb.rotation.x = Math.PI / 2; nb.position.set(NEST.x, NEST.y - 0.75, -1.6); nb.castShadow = true; nb.receiveShadow = true; scene.add(nb);
  // nid
  const nest = grp(scene, NEST.x, NEST.y, NEST.z);
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.85 - i * 0.07, 0.2, 8, 24), mat([0xb98a4e, 0xa67838, 0xcfa060][i])); t.rotation.x = Math.PI / 2; t.position.y = -0.25 + i * 0.16; t.castShadow = true; t.receiveShadow = true; nest.add(t); }
  ball(nest, 0.8, 0xe6c57a, 0, -0.3, 0, 1, 0.3, 1);
  for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7), mat(0x8f6a35)); const a = i / 12 * 6.28; s.position.set(Math.cos(a) * 0.95, -0.05 + R() * 0.25, Math.sin(a) * 0.95); s.rotation.set(R() * 3, R() * 3, R() * 3); nest.add(s); }

  // buissons, champignons
  for (let i = 0; i < 70; i++) {
    const x = -28 + R() * 162, z = R() < 0.75 ? -3.2 - R() * 5 : 4.5 + R() * 3;
    if (x > RIVER[0] - 1.5 && x < RIVER[1] + 1.5) continue;
    const g = grp(scene, x, 0, z), c = GREENS[Math.floor(R() * GREENS.length)];
    for (let k = 0; k < 3; k++) ball(g, 0.45 + R() * 0.45, c, (k - 1) * 0.6, 0.3, R() * 0.4, 1, 0.85, 1, { roughness: 0.85 });
  }
  for (let i = 0; i < 34; i++) {
    const x = -28 + R() * 162, z = R() < 0.6 ? -2.2 - R() * 4 : 2.2 + R() * 4, s = 0.25 + R() * 0.3;
    if (x > RIVER[0] - 1 && x < RIVER[1] + 1) continue;
    const g = grp(scene, x, 0, z);
    ball(g, s * 0.45, 0xfff3dc, 0, s * 0.6, 0, 1, 1.5, 1);
    ball(g, s, [0xff5d73, 0xff9f45, 0xb388ff][i % 3], 0, s * 1.2, 0, 1, 0.6, 1);
    for (let k = 0; k < 5; k++) ball(g, s * 0.16, 0xffffff, Math.cos(k * 1.3) * s * 0.6, s * 1.55, Math.sin(k * 1.3) * s * 0.6, 1, 0.5, 1);
  }

  // fleurs lumineuses
  const FL = [0xff6ec7, 0x5ce1e6, 0xffe14d, 0xb388ff, 0xff9f45, 0xff5d8f], flowers = [];
  for (let i = 0; i < 150; i++) {
    const x = -28 + R() * 162, z = R() < 0.62 ? -1.9 - R() * 6.5 : 1.9 + R() * 4.2, h = 0.45 + R() * 0.9, c = FL[Math.floor(R() * FL.length)];
    if (x > RIVER[0] - 0.8 && x < RIVER[1] + 0.8) continue;
    if (Math.abs(x - LOG_X) < 1.6) continue;
    const g = grp(scene, x, 0, z);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 6), mat(0x2fa35a)); st.position.y = h / 2; g.add(st);
    ball(g, 0.12, 0x3fbf66, 0.12, h * 0.45, 0, 1.4, 0.3, 0.7);
    const f = grp(g, 0, h, 0);
    for (let k = 0; k < 5; k++) ball(f, 0.14, c, Math.cos(k * 1.257) * 0.17, 0.02, Math.sin(k * 1.257) * 0.17, 1, 0.55, 1, { emissive: c, emissiveIntensity: 0.55 }).castShadow = false;
    ball(f, 0.11, 0xfff7c2, 0, 0.06, 0, 1, 0.8, 1, { emissive: 0xffe680, emissiveIntensity: 0.9 }).castShadow = false;
    const gl = sprite(f, glowTex, c, 1.5); gl.position.y = 0.1;
    flowers.push({ f, gl, ph: R() * 6.28 });
  }
  // lucioles
  const flies = [];
  for (let i = 0; i < 80; i++) flies.push({ s: sprite(scene, glowTex, [0xfff59a, 0xbaffc9, 0xffd1f5][i % 3], 0.32), x: -28 + R() * 162, y: 1 + R() * 5, z: -7 + R() * 13, ph: R() * 6.28, sp: 0.4 + R() * 0.6 });

  // rivière scintillante
  const rw = RIVER[1] - RIVER[0], rx = (RIVER[0] + RIVER[1]) / 2;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(rw, 120), mat(0x2ec4f1, { roughness: 0.25, emissive: 0x1b8fd6, emissiveIntensity: 0.25 }));
  river.rotation.x = -Math.PI / 2; river.position.set(rx, 0.04, -20); river.receiveShadow = true; scene.add(river);
  for (const sx of [-1, 1]) for (let i = 0; i < 30; i++) ball(scene, 0.5 + R() * 0.5, 0xffe9a6, rx + sx * (rw / 2 + 0.1), 0, -55 + i * 2.2 + R(), 1, 0.25, 1.4, { roughness: 0.9 }).castShadow = false;
  const waves = [];
  for (let i = 0; i < 40; i++) { const m = ball(scene, 1, 0x9be9ff, 0, 0.06, 0, 0.5 + R() * 0.7, 0.01, 0.07, { emissive: 0x9be9ff, emissiveIntensity: 0.4 }); m.castShadow = false; waves.push({ m, x: RIVER[0] + 0.8 + R() * (rw - 1.6), z: R() * 60, sp: 0.6 + R() * 0.6 }); }
  const glints = [];
  for (let i = 0; i < 110; i++) glints.push({ s: sprite(scene, starTex, 0xffffff, 0.5), x: RIVER[0] + 0.4 + R() * (rw - 0.8), z: -40 + R() * 49, ph: R() * 6.28, sp: 1.5 + R() * 2.5 });
  for (let i = 0; i < 9; i++) { const g = grp(scene, RIVER[0] + 1 + R() * (rw - 2), 0.07, i < 5 ? -4 - R() * 14 : 4 + R() * 4); ball(g, 0.55, 0x3ccf6e, 0, 0, 0, 1, 0.04, 1).castShadow = false; ball(g, 0.16, 0xff8fc0, 0.1, 0.1, 0, 1, 0.7, 1, { emissive: 0xff8fc0, emissiveIntensity: 0.4 }); }

  // gros tronc en travers du chemin
  const log = grp(scene, LOG_X, 1.05, 0);
  const lg = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 8, 24), mat(0x9b6a43, { roughness: 0.85 })); lg.rotation.x = Math.PI / 2; lg.castShadow = true; lg.receiveShadow = true; log.add(lg);
  for (const s of [-1, 1]) { ball(log, 1.0, 0xe8c48a, 0, 0, s * 4, 1, 1, 0.06); ball(log, 0.6, 0xd6a96a, 0, 0, s * 4.03, 1, 1, 0.05); ball(log, 0.25, 0xc08f52, 0, 0, s * 4.06, 1, 1, 0.05); }
  for (let i = 0; i < 9; i++) ball(log, 0.35 + R() * 0.3, 0x58d68d, -0.3 + R() * 0.6, 0.85, -3.4 + i * 0.85, 1, 0.45, 1);
  ball(log, 0.3, 0x7a4e2d, -1.0, 0.2, 2.0, 0.25, 1, 0.7);

  // liane (chaîne de petites boules) — placée par le film
  const liana = []; for (let i = 0; i < 30; i++) liana.push(ball(scene, i === 29 ? 0.2 : 0.085, i === 29 ? 0x58d68d : 0x2fa35a));
  W.liana = (a, b) => liana.forEach((m, i) => { m.visible = !!a; if (a) m.position.lerpVectors(a, b, i / 29); });
  W.lianaTop = new THREE.Vector3(LOG_X, 10.5, 0.2);

  // ----------------------------------------------------------- effets
  const stars = []; for (let i = 0; i < 70; i++) stars.push(sprite(scene, starTex, 0xffffff, 0.4));
  const hearts = [];
  const hs = new THREE.Shape(); hs.moveTo(0, -0.5); hs.bezierCurveTo(-1.1, 0.3, -0.5, 1.0, 0, 0.45); hs.bezierCurveTo(0.5, 1.0, 1.1, 0.3, 0, -0.5);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4 }); hg.center();
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(hg, mat(0xff4f8b, { emissive: 0xff2f6d, emissiveIntensity: 0.45, roughness: 0.3 })); scene.add(m); hearts.push(m); }
  const conf = []; const CC = [0xff5d8f, 0xffd21f, 0x2fd6c9, 0xb388ff, 0xff9f45, 0x7ed957];
  for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ color: CC[i % 6], side: THREE.DoubleSide })); scene.add(m); conf.push(m); }
  const rings = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.rotation.x = Math.PI / 2; scene.add(m); rings.push(m); }
  const fish = []; for (let i = 0; i < 3; i++) { const g = grp(scene); ball(g, 0.3, 0xff8a3d, 0, 0, 0, 1.5, 0.9, 0.6); ball(g, 0.2, 0xffc93d, -0.5, 0, 0, 0.8, 1.2, 0.3); ball(g, 0.05, 0x1b1b2f, 0.28, 0.08, 0.14); ball(g, 0.05, 0x1b1b2f, 0.28, 0.08, -0.14); fish.push(g); }
  const feather = grp(scene); ball(feather, 0.3, 0xff5fa2, 0, 0, 0, 0.35, 1, 0.08); ball(feather, 0.2, 0x2fd6c9, 0, 0.25, 0, 0.3, 1, 0.08);
  let nS = 0, nH = 0, nC = 0, nR = 0, nF = 0;
  const h3 = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  W.fx = {
    reset() { nS = nH = nC = nR = nF = 0; for (const a of [stars, hearts, conf, rings, fish]) a.forEach((m) => { m.visible = false; }); feather.visible = false; W.liana(null); },
    // éclat d'étoiles : age en secondes depuis le déclenchement
    sparkle(p, age, n = 12, size = 1, dur = 1.1, col = 0xffffff) {
      if (age < 0 || age > dur) return; const u = age / dur;
      for (let i = 0; i < n && nS < stars.length; i++) {
        const s = stars[nS++], a = h3(i, nS) * 6.28, e = h3(i, 7) * 3.14 - 1.57, d = (0.4 + h3(i, 3)) * size * (1 - (1 - u) ** 2);
        s.visible = true; s.position.set(p.x + Math.cos(a) * Math.cos(e) * d, p.y + Math.sin(e) * d * 0.8 + 0.2 * u, p.z + Math.sin(a) * Math.cos(e) * d * 0.5 + 0.3);
        s.scale.setScalar(size * 0.55 * (1 - u) * (0.6 + 0.4 * Math.sin(age * 20 + i))); s.material.color.set(col);
      }
    },
    twinkle(p, t, n = 5, rad = 0.8) { // étoiles qui tournent (tête qui tourne, magie)
      for (let i = 0; i < n && nS < stars.length; i++) { const s = stars[nS++], a = t * 4 + i * 6.28 / n; s.visible = true; s.position.set(p.x + Math.cos(a) * rad, p.y + Math.sin(a * 2) * 0.08, p.z + Math.sin(a) * rad * 0.6); s.scale.setScalar(0.4); s.material.color.set(0xfff59a); }
    },
    hearts(p, age, n = 5, dur = 3) {
      for (let i = 0; i < n && nH < hearts.length; i++) {
        const a = age - i * 0.28; if (a < 0 || a > dur) continue; const m = hearts[nH++], u = a / dur;
        m.visible = true; m.position.set(p.x + (h3(i, 1) - 0.5) * 1.6 + Math.sin(a * 3 + i) * 0.15, p.y + a * 0.75, p.z + 0.3 + h3(i, 2) * 0.4);
        m.scale.setScalar(0.3 * Math.min(1, a * 5) * (1 - u * u)); m.rotation.set(0, Math.sin(a * 2 + i) * 0.5, Math.sin(a * 3 + i) * 0.2);
      }
    },
    confetti(p, age, n = 60, power = 1) {
      if (age < 0 || age > 3.5) return;
      for (let i = 0; i < n && nC < conf.length; i++) {
        const m = conf[nC++], a = h3(i, 5) * 6.28, v = (2 + h3(i, 6) * 4) * power, vy = (4 + h3(i, 8) * 5) * power, k = 1.2;
        const d = (1 - Math.exp(-k * age)) / k, y = p.y + vy * d - 1.3 * age * age * 0.6;
        m.visible = y > 0.02; m.position.set(p.x + Math.cos(a) * v * d, Math.max(0.03, y), p.z + Math.sin(a) * v * d * 0.6);
        m.rotation.set(age * 7 + i, age * 5 + i * 2, i);
      }
    },
    rain(cx, cz, t, n = 80, top = 9) { // pluie de confettis pour la fête
      for (let i = 0; i < n && nC < conf.length; i++) {
        const m = conf[nC++], sp = 1.2 + h3(i, 9) * 1.2, y = top - ((t * sp + h3(i, 4) * top) % top);
        m.visible = true; m.position.set(cx + (h3(i, 1) - 0.5) * 20 + Math.sin(t * 2 + i) * 0.3, y, cz + (h3(i, 2) - 0.5) * 7); m.rotation.set(t * 4 + i, t * 3 + i, i);
      }
    },
    ring(x, z, age, size = 2) { if (age < 0 || age > 1.6 || nR >= rings.length) return; const m = rings[nR++], u = age / 1.6; m.visible = true; m.position.set(x, 0.08, z); m.scale.setScalar(0.3 + u * size); m.material.opacity = 0.8 * (1 - u); },
    fish(x, z, age, dur = 0.8, dir = 1) { if (age < 0 || age > dur || nF >= fish.length) return; const g = fish[nF++], u = age / dur; g.visible = true; g.position.set(x + dir * (u - 0.5) * 2.2, -0.3 + hop(u) * 1.7, z); g.rotation.set(0, dir > 0 ? 0 : Math.PI, (0.5 - u) * 2.4); },
    feather(p, t) { feather.visible = true; feather.position.set(p.x + Math.sin(t * 2) * 0.6, p.y, p.z); feather.rotation.set(0, t, Math.sin(t * 2) * 0.7 + 1.2); },
  };

  W.update = (t) => {
    for (const f of flowers) { const k = 1 + 0.1 * Math.sin(t * 2.4 + f.ph); f.f.scale.setScalar(k); f.f.rotation.z = 0.12 * Math.sin(t * 1.3 + f.ph); f.gl.material.opacity = 0.42 + 0.22 * Math.sin(t * 2.4 + f.ph); }
    for (const f of flies) { f.s.position.set(f.x + Math.sin(t * f.sp + f.ph) * 1.5, f.y + Math.sin(t * f.sp * 1.7 + f.ph) * 0.6, f.z + Math.cos(t * f.sp * 0.8 + f.ph) * 1.2); f.s.material.opacity = 0.55 + 0.45 * Math.sin(t * 3 + f.ph); }
    for (const w of waves) w.m.position.set(w.x, 0.06, 8 - ((w.z + t * w.sp) % 60));
    for (const g of glints) { const k = Math.max(0, Math.sin(t * g.sp + g.ph)); g.s.position.set(g.x, 0.12, g.z); g.s.scale.setScalar(0.1 + 0.6 * k * k * k); }
  };
  return W;
}
