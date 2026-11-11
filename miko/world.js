// Décor de « Miko Miko Bam » : la savane (clairière de terre orange, baobab, acacias, mare) + effets.
import * as THREE from 'three';
import { ball, grp, mat, rng, lerp, clamp, hop } from '../film/characters.js';

export const POND = new THREE.Vector3(-9.5, 0, -5.5), BAOBAB = new THREE.Vector3(6.5, 0, -7);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sky = (stops) => canvasTex(8, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); stops.forEach(([p, col]) => gr.addColorStop(p, col));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const glowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

export function buildWorld(scene) {
  const R = rng(7), W = {};
  const DAY = sky([[0, '#2fa8ff'], [0.5, '#8fdcff'], [0.8, '#ffeeb0'], [1, '#ffd978']]);
  const DUSK = sky([[0, '#7a5cff'], [0.35, '#ff7fb0'], [0.7, '#ffb054'], [1, '#ffe07a']]);
  scene.fog = new THREE.Fog(0xffe2a8, 40, 130);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffc98a, 1.25);
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.75);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(hemi, sun, sun.target);
  let low = 0;
  W.focus = (x, y, z) => { sun.target.position.set(x, y, z); sun.position.set(x + 9 + low * 8, y + 20 - low * 9, z + 12); };
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2a0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  scene.add(glow);
  W.dusk = (d) => {
    low = d; scene.background = d ? DUSK : DAY;
    scene.fog.color.set(d ? 0xffb98a : 0xffe2a8);
    hemi.color.set(d ? 0xffd9c9 : 0xffffff); sun.color.set(d ? 0xffb070 : 0xfff0cc); sun.intensity = d ? 1.9 : 1.75;
    glow.position.set(d ? -30 : -45, d ? 7 : 42, -110); glow.scale.setScalar(d ? 60 : 45); glow.material.color.set(d ? 0xffc35c : 0xfff2a0);
  };

  // sol : herbe dorée + clairière de terre orange
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 400), mat(0xf2c95c, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const flat = (r, col, x, z, sx = 1, sz = 1, y = 0.01) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat(col, { roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
  flat(8.5, 0xf29a4a, 0, -0.5, 1.25, 0.8, 0.02); flat(6.5, 0xf7ab5e, 0.3, -0.3, 1.2, 0.75, 0.03);
  for (let i = 0; i < 70; i++) flat(1.5 + R() * 3.5, [0xf7d774, 0xe8b94a, 0xfbe08a][i % 3], -60 + R() * 120, -70 + R() * 80, 1.4, 0.6, 0.012 + i * 0.0001);
  for (let i = 0; i < 26; i++) ball(scene, 0.1 + R() * 0.12, 0xe0843a, -8 + R() * 16, 0.02, -5 + R() * 9, 1, 0.35, 1).castShadow = false;

  // collines au loin
  for (let i = 0; i < 9; i++) ball(scene, 22 + R() * 16, [0xe9b65a, 0xdca24e, 0xf0c468][i % 3], -110 + i * 28 + R() * 8, -6, -95 - R() * 25, 1.6, 0.42, 0.6, { roughness: 1 }).castShadow = false;

  // touffes d'herbe dorée
  const blade = new THREE.ConeGeometry(0.09, 1, 5); blade.translate(0, 0.5, 0);
  const tuft = (x, z, s) => { const g = grp(scene, x, 0, z); const col = [0xffe27a, 0xf2b84a, 0xffd25a, 0xd9c14e][Math.floor(R() * 4)];
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(blade, mat(col, { roughness: 0.9 })); m.scale.set(s, s * (0.7 + R() * 0.8), s); m.position.set((R() - 0.5) * 0.5 * s, 0, (R() - 0.5) * 0.5 * s); m.rotation.set((R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 0.6); m.castShadow = true; g.add(m); } };
  for (let i = 0; i < 420; i++) {
    const x = -45 + R() * 90, z = -45 + R() * 54, s = 0.8 + R() * 1.1;
    if ((x / 10.5) ** 2 + ((z + 0.5) / 6.8) ** 2 < 1) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < 5.6) continue;
    if (z > 3 && Math.abs(x) < 9) continue;
    tuft(x, z, s);
  }

  // acacias (tronc fin, grand parasol plat)
  const acacia = (x, z, h, cr) => {
    const g = grp(scene, x, 0, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, h, 10), mat(0x8a5a3c, { roughness: 0.9 })); t.position.y = h / 2; t.castShadow = true; g.add(t);
    for (const sx of [-1, 1]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, cr * 0.9, 8), mat(0x8a5a3c)); br.position.set(sx * cr * 0.3, h + 0.1, 0); br.rotation.z = -sx * 1.0; br.castShadow = true; g.add(br); }
    for (let i = 0; i < 5; i++) ball(g, cr * (0.55 + R() * 0.3), [0x5fbf4a, 0x79cf52, 0x4fae48][i % 3], (i - 2) * cr * 0.42, h + 0.75 + R() * 0.3, (R() - 0.5) * cr * 0.5, 1.25, 0.3, 1, { roughness: 0.85 });
  };
  [[-5.5, -11, 6, 3.2], [14, -13, 7, 3.6], [-19, -16, 6.5, 3.4], [24, -24, 8, 4], [-30, -30, 8, 4.2], [3, -27, 7, 3.6], [-14, -36, 9, 4.5], [36, -38, 9, 4.5]].forEach((a) => acacia(...a));

  // le baobab
  const bb = grp(scene, BAOBAB.x, 0, BAOBAB.z);
  ball(bb, 1.9, 0xb98a6a, 0, 2.3, 0, 1, 1.75, 1, { roughness: 0.9 }); ball(bb, 2.1, 0xb98a6a, 0, 0.5, 0, 1, 0.6, 1, { roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.28, br = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 2.6, 8), mat(0xb98a6a));
    br.position.set(Math.cos(a) * 1.5, 6.1, Math.sin(a) * 1.5); br.rotation.set(Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75); br.castShadow = true; bb.add(br);
    ball(bb, 1.0 + R() * 0.4, [0x5fbf4a, 0x79cf52, 0x8ad95e][i % 3], Math.cos(a) * 2.5, 7.3 + R() * 0.5, Math.sin(a) * 2.5, 1.2, 0.6, 1.2, { roughness: 0.85 });
  }
  ball(bb, 1.3, 0x79cf52, 0, 7.9, 0, 1.3, 0.6, 1.3);

  // la mare
  const pond = flat(4.6, 0x2ec4f1, POND.x, POND.z, 1.15, 0.85, 0.05);
  pond.material = mat(0x2ec4f1, { roughness: 0.2, emissive: 0x1b8fd6, emissiveIntensity: 0.3 });
  flat(5.2, 0xd98a4a, POND.x, POND.z, 1.15, 0.85, 0.04);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; ball(scene, 0.35 + R() * 0.3, [0xc9a27a, 0xb59270][i % 2], POND.x + Math.cos(a) * 5.6, 0.05, POND.z + Math.sin(a) * 4.2, 1, 0.5, 1); }
  for (let i = 0; i < 5; i++) { const a = 0.6 + i * 1.3; ball(scene, 0.5, 0x3ccf6e, POND.x + Math.cos(a) * 3.4, 0.07, POND.z + Math.sin(a) * 2.6, 1, 0.05, 1).castShadow = false; }
  const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 40), mat(0xd9f6ff, { emissive: 0xd9f6ff, emissiveIntensity: 0.5 })); m.rotation.x = Math.PI / 2; scene.add(m); return m; });

  // nuages
  const clouds = []; for (let i = 0; i < 7; i++) { const g = grp(scene, -70 + i * 24 + R() * 8, 24 + R() * 10, -85 - R() * 20);
    for (let k = 0; k < 4; k++) ball(g, 3 + R() * 2.5, 0xffffff, (k - 1.5) * 4, R() * 1.2, 0, 1.3, 0.7, 0.8, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25, fog: false }).castShadow = false; clouds.push(g); }
  // papillons
  const flies = []; for (let i = 0; i < 14; i++) { const g = grp(scene); const col = [0xff6ec7, 0x5ce1e6, 0xffe14d, 0xb388ff, 0xff9f45][i % 5];
    const a = ball(g, 0.14, col, 0.1, 0, 0, 1, 0.12, 0.8, { emissive: col, emissiveIntensity: 0.35 }), b = ball(g, 0.14, col, -0.1, 0, 0, 1, 0.12, 0.8, { emissive: col, emissiveIntensity: 0.35 });
    a.castShadow = b.castShadow = false; flies.push({ g, a, b, x: -9 + R() * 18, z: -6 + R() * 7, y: 1.2 + R() * 2.5, ph: R() * 6.28 }); }

  // ----------------------------------------------------------- effets
  const DUST = [], CONF = [], dm = [0xffd9a8, 0xf7c48a, 0xffe6c2];
  for (let i = 0; i < 90; i++) { const m = ball(scene, 1, dm[i % 3], 0, 0, 0, 1, 1, 1, { roughness: 1 }); m.castShadow = false; DUST.push(m); }
  const cc = [0xff5d73, 0xffd21f, 0x5ce1e6, 0xb388ff, 0x7ed957, 0xff9f45];
  for (let i = 0; i < 160; i++) { const m = ball(scene, 0.09, cc[i % 6], 0, 0, 0, 1, 0.35, 1, { emissive: cc[i % 6], emissiveIntensity: 0.3 }); m.castShadow = false; CONF.push({ m, x: R(), z: R(), ph: R(), sp: 0.7 + R() * 0.6 }); }
  let di = 0;
  W.fx = {
    reset() { di = 0; for (const m of DUST) m.visible = false; for (const c of CONF) c.m.visible = false; for (const r of rings) r.visible = false; },
    // nuage de poussière qui s'écarte du point d'impact
    dust(p, age, n = 9, size = 1, dur = 0.7) {
      if (age < 0 || age > dur) return; const u = age / dur;
      for (let i = 0; i < n && di < DUST.length; i++) { const m = DUST[di++], a = i / n * 6.28 + p.x, r = (0.25 + 0.95 * Math.sqrt(u)) * size;
        m.visible = true; m.position.set(p.x + Math.cos(a) * r, 0.12 + u * 0.55 * size * (0.6 + (i % 3) * 0.3), p.z + Math.sin(a) * r * 0.8);
        m.scale.setScalar(size * 0.3 * (0.4 + u) * (1 - u * u) + 0.001); }
    },
    ripple(age) { rings.forEach((r, i) => { const a = age - i * 0.35; r.visible = a > 0 && a < 1.6; if (r.visible) { r.position.set(POND.x, 0.09, POND.z); const s = 1.4 + a * 2.0; r.scale.set(s * 1.15, s * 0.85, 1 - a / 1.6 + 0.01); } }); },
    confetti(T, amt = 1) { CONF.forEach((c, i) => { if (i >= CONF.length * amt) return; const y = 9 - ((T * c.sp * 2.2 + c.ph * 9) % 9.5);
      c.m.visible = y > 0.05; c.m.position.set(-7 + c.x * 14 + Math.sin(T * 2 + i) * 0.3, y, -4 + c.z * 7); c.m.rotation.set(T * 5 + i, T * 3, i); }); },
  };
  W.update = (T) => {
    clouds.forEach((g, i) => { g.position.x = -70 + ((i * 24 + T * 0.5) % 170); });
    for (const f of flies) { f.g.position.set(f.x + Math.sin(T * 0.7 + f.ph) * 2.2, f.y + Math.sin(T * 2.3 + f.ph) * 0.4, f.z + Math.cos(T * 0.5 + f.ph) * 1.5); f.g.rotation.y = T * 0.7 + f.ph;
      const w = Math.sin(T * 18 + f.ph) * 0.9; f.a.rotation.z = w; f.b.rotation.z = -w; }
  };
  W.dusk(0);
  return W;
}
