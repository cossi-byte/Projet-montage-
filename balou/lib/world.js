// La Vallée des Baobabs : maison-baobab de Balou, jardin et barrière, lac, village, arc-en-ciel + effets.
import * as THREE from 'three';
import { ball, grp, mat, rng, lerp, clamp, hop } from './characters.js';

export const HOUSE = new THREE.Vector3(0, 0, -7), DOOR_Z = -3.94, FENCE_X = 3.6, POST = new THREE.Vector3(3.6, 1.1, 0),
  PETALS = new THREE.Vector3(0.7, 0, 1.4), LAKE = new THREE.Vector3(27, 0, -15), SHORE = new THREE.Vector3(21, 0, -0.5);

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
// texte en sprite (titre, chiffres)
export function textSprite(parent, text, { size = 140, fill = '#ffd23f', stroke = '#ffffff', w = 1024, h = 256, font = 'Inter Display, Carlito, sans-serif' } = {}) {
  const tex = canvasTex(w, h, (g) => {
    g.font = `800 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = size * 0.28; g.strokeStyle = '#7a5cc4'; g.strokeText(text, w / 2, h / 2 + 4);
    g.lineWidth = size * 0.16; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2);
    g.fillStyle = fill; g.fillText(text, w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  s.scale.set(w / h, 1, 1); s.renderOrder = 10; s.visible = false; parent.add(s); return s;
}

function baobab(scene, x, z, s = 1, door = 0x4fa3ff, ry = 0, R) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry; g.scale.setScalar(s);
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(3.0 - 0.9 * t + 0.35 * Math.sin(t * Math.PI), t * 6.5)); }
  const tr = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat(0xe0ad80, { roughness: 0.85 })); tr.castShadow = true; tr.receiveShadow = true; g.add(tr);
  for (let i = 0; i < 6; i++) { // branches + feuillage
    const a = i / 6 * Math.PI * 2 + 0.3, br = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 2.6, 10), mat(0xd29d70));
    br.position.set(Math.cos(a) * 1.3, 7.3, Math.sin(a) * 1.3); br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); br.castShadow = true; g.add(br);
    ball(g, 1.3 + R() * 0.4, [0x7ed957, 0x5cc96a, 0x9be36a][i % 3], Math.cos(a) * 2.5, 8.6 + R() * 0.5, Math.sin(a) * 2.5, 1, 0.65, 1, { roughness: 0.8 });
  }
  ball(g, 1.9, 0x6fd36a, 0, 8.9, 0, 1, 0.55, 1, { roughness: 0.8 });
  ball(g, 2.4, 0xe0ad80, 0, 6.5, 0, 1, 0.2, 1);
  // porte ronde + fenêtres rondes
  const front = 3.06, DR = 1.4;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(DR + 0.03, 0.14, 10, 40), mat(0xfff3dc)); frame.position.set(0, DR, front + 0.02); g.add(frame);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(DR, 40), mat(0x4a2f22, { roughness: 1 })); hole.position.set(0, DR, front); g.add(hole);
  const dg = grp(g, -DR, DR, front + 0.06);  // charnière à gauche
  const dm = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR, 0.1, 40), mat(door, { roughness: 0.5 })); dm.rotation.x = Math.PI / 2; dm.position.x = DR; dm.castShadow = true; dg.add(dm);
  ball(dg, 0.12, 0xffd23f, DR * 1.7, 0, 0.08, 1, 1, 0.6);
  for (let k = 0; k < 3; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2 - Math.abs(k - 1) * 0.7, 0.02), mat(0xffffff, { transparent: true, opacity: 0.25 })); pl.position.set(DR * 0.55 + k * DR * 0.45, 0, 0.06); dg.add(pl); }
  for (const [a, y] of [[0.6, 3.1], [-0.6, 3.1], [0, 4.6]]) {
    const r = 2.9 - 0.05 * y, wg = grp(g, Math.sin(a) * r, y, Math.cos(a) * r); wg.rotation.y = a;
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 28), mat(0xfff3dc)); wg.add(fr);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.48, 28), mat(0xfff2a8, { emissive: 0xffd970, emissiveIntensity: 0.35 })); gl.position.z = -0.02; wg.add(gl);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.03), mat(0xfff3dc)), c2 = c1.clone(); c2.rotation.z = Math.PI / 2; wg.add(c1, c2);
    ball(wg, 0.35, [0xff8fc0, 0xffb347, 0xb388ff][Math.floor(R() * 3)], 0, -0.55, 0.1, 1.3, 0.35, 0.5);
  }
  return { g, door: dg };
}

export function buildWorld(scene) {
  const R = rng(17), W = {};
  // ciel : dôme en dégradé (pastel le jour, rose-orangé au coucher du soleil)
  const skyU = { top: { value: new THREE.Color(0x8fd3ff) }, mid: { value: new THREE.Color(0xcdeeff) }, bot: { value: new THREE.Color(0xfff1c9) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y*2.2, -1.0, 1.0); vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0,1.0,h)) : mix(mid, bot, smoothstep(0.0,0.35,-h+0.1)); if (vP.y < 0.06) c = mix(bot, c, clamp(vP.y/0.06,0.0,1.0)); gl_FragColor = vec4(c,1.0); }' }));
  sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.Fog(0xd8f3ff, 45, 150);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xa8e6a0, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  W.focus = (x, y, z) => { sky.position.set(x, 0, z); sun.target.position.set(x, y, z); sun.position.set(x + 9, y + 20, z + 12); };
  const DAY = [0x8fd3ff, 0xcdeeff, 0xfff1c9, 0xd8f3ff, 0xfff0d0], DUSK = [0x7c8fe6, 0xffa8c8, 0xffc47a, 0xffd0b8, 0xffb27a];
  const sunGlow = sprite(scene, glowTex, 0xffc070, 30); sunGlow.position.set(24, 6, -90); sunGlow.visible = false;
  W.sunset = (k) => {
    const L = (i) => new THREE.Color(DAY[i]).lerp(new THREE.Color(DUSK[i]), k);
    skyU.top.value.copy(L(0)); skyU.mid.value.copy(L(1)); skyU.bot.value.copy(L(2)); scene.fog.color.copy(L(3)); sun.color.copy(L(4));
    hemi.intensity = lerp(1.25, 1.0, k); sunGlow.visible = k > 0.01; sunGlow.material.opacity = k;
  };

  // sol, collines, nuages
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 300), mat(0x9fe388, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  for (let i = 0; i < 70; i++) { const m = ball(scene, 1.5 + R() * 3, [0xb2ea8e, 0x8ddb7a, 0xc4f09a][i % 3], -40 + R() * 110, 0, -30 + R() * 40, 1, 0.012, 0.7, { roughness: 0.95 }); m.castShadow = false; }
  for (let i = 0; i < 14; i++) { const m = ball(scene, 18 + R() * 14, [0x8fd88a, 0xa6e39a, 0x7fcf86][i % 3], -90 + i * 15 + R() * 6, -6, -95 - R() * 25, 1.4, 0.55, 1, { roughness: 0.95 }); m.castShadow = false; m.receiveShadow = false; }
  for (let i = 0; i < 12; i++) {
    const g = grp(scene, -70 + i * 14 + R() * 6, 22 + R() * 10, -110 - R() * 30);
    for (let k = 0; k < 5; k++) { const m = ball(g, 3 + R() * 2.5, 0xffffff, (k - 2) * 3.2, R() * 1.5, R() * 2, 1, 0.75, 0.8, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35 }); m.castShadow = false; }
  }

  // maison de Balou + village
  const house = baobab(scene, HOUSE.x, HOUSE.z, 1, 0x4fa3ff, 0, R);
  W.door = (open) => { house.door.rotation.y = -open * 1.6; };
  const VIL = [[-13, -14, 0.75, 0xff8fc0, 0.5], [-24, -22, 0.7, 0xb388ff, 0.4], [12, -30, 0.7, 0x5ce1a6, 0], [44, -30, 0.75, 0xffb347, -0.3], [-34, -8, 0.8, 0x5ce1e6, 0.8], [52, -10, 0.7, 0xff8fc0, -0.7], [36, 4, 0.6, 0xb388ff, -1.3]];
  for (const [x, z, s, d, ry] of VIL) baobab(scene, x, z, s, d, ry, R);

  // chemin de sable jusqu'au lac
  for (let i = 0; i <= 40; i++) { const t = i / 40, x = lerp(1, 20, t), z = 1.2 + Math.sin(t * Math.PI) * 0.8; const m = ball(scene, 1.0, 0xffe9b8, x, 0.012, z, 1.25, 0.01, 0.95, { roughness: 0.95 }); m.castShadow = false; }
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI; const m = ball(scene, 1.0, 0xffe9b8, Math.cos(a) * 3.2, 0.011, -4.0 + Math.sin(a) * 2.2, 1, 0.01, 1); m.castShadow = false; }

  // jardin : barrière blanche, massifs de fleurs, tas de pétales
  for (let k = 0; k < 8; k++) {
    const z = -3.2 + k * 0.8, big = Math.abs(z) < 0.01;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.11 : 0.09, big ? 0.11 : 0.09, 1.0, 12), mat(0xffffff)); p.position.set(FENCE_X, 0.5, z); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    ball(scene, big ? 0.13 : 0.11, 0xffffff, FENCE_X, 1.0, z);
  }
  for (const y of [0.42, 0.78]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 5.8), mat(0xffffff)); r.position.set(FENCE_X, y, -0.4); r.castShadow = true; scene.add(r); }
  const FL = [0xff8fc0, 0xffe14d, 0xb388ff, 0xff9f45, 0xff6e8a, 0x5ce1e6, 0xffffff], flowers = [];
  const flower = (x, z, h, c) => {
    const g = grp(scene, x, 0, z);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 6), mat(0x4fb85a)); st.position.y = h / 2; g.add(st);
    ball(g, 0.1, 0x5cc96a, 0.1, h * 0.45, 0, 1.4, 0.3, 0.7);
    const f = grp(g, 0, h, 0);
    for (let k = 0; k < 5; k++) ball(f, 0.12, c, Math.cos(k * 1.257) * 0.14, 0.02, Math.sin(k * 1.257) * 0.14, 1, 0.5, 1).castShadow = false;
    ball(f, 0.09, 0xffe680, 0, 0.05, 0, 1, 0.8, 1).castShadow = false;
    flowers.push({ f, ph: R() * 6.28 });
  };
  for (let i = 0; i < 46; i++) { const a = -0.4 - R() * 2.3, r = 3.4 + R() * 1.4; flower(HOUSE.x + Math.cos(a) * r * 1.0, HOUSE.z - Math.sin(a) * r * 0.9 + 0.3, 0.35 + R() * 0.4, FL[i % FL.length]); }
  for (let i = 0; i < 110; i++) {
    const x = -30 + R() * 80, z = -14 + R() * 20;
    if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 3.6 || (x > -2 && x < 5 && z > -3.5 && z < 3.5) || (x > 8 && z < -3 && Math.hypot((x - LAKE.x) / 18, (z - LAKE.z) / 10) < 1)) continue;
    if (z > 0 && z < 2.6 && x > 0 && x < 22) continue;
    flower(x, z, 0.3 + R() * 0.5, FL[Math.floor(R() * FL.length)]);
  }
  const petals = grp(scene, PETALS.x, 0, PETALS.z);
  for (let i = 0; i < 70; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 0.85, h = (1 - r / 0.85) * 0.35; ball(petals, 0.12, [0xffb3cf, 0xff8fc0, 0xffd1e3][i % 3], Math.cos(a) * r, h + 0.03, Math.sin(a) * r * 0.8, 1, 0.3, 0.7).rotation.set(R(), R() * 3, R()); }
  // buissons et arbres ronds
  const GR = [0x6fd36a, 0x58c76e, 0x8fe06a, 0x4fbf7a];
  for (let i = 0; i < 38; i++) {
    const x = -38 + R() * 100, z = -26 + R() * 24;
    if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 5 || (x > -3 && x < 24 && z > -4) || Math.hypot((x - LAKE.x) / 19, (z - LAKE.z) / 11) < 1) continue;
    const g = grp(scene, x, 0, z), c = GR[Math.floor(R() * 4)];
    for (let k = 0; k < 3; k++) ball(g, 0.5 + R() * 0.5, c, (k - 1) * 0.65, 0.35, R() * 0.4, 1, 0.85, 1, { roughness: 0.85 });
  }
  for (const [x, z] of [[-6, 2.5], [-8, -2], [7.5, -4.5], [15, 3.5], [-4, 4.5]]) {
    const g = grp(scene, x, 0, z), c = GR[Math.floor(R() * 4)];
    for (let k = 0; k < 3; k++) ball(g, 0.55 + R() * 0.35, c, (k - 1) * 0.6, 0.35, R() * 0.3, 1, 0.85, 1, { roughness: 0.85 });
  }

  // le lac
  const lake = ball(scene, 1, 0x7fd4f7, LAKE.x, 0.03, LAKE.z, 18, 0.01, 10, { roughness: 0.2, emissive: 0x3fb0e8, emissiveIntensity: 0.25 }); lake.castShadow = false; lake.receiveShadow = true;
  const shore = ball(scene, 1, 0xffe7b0, LAKE.x, 0.02, LAKE.z, 18.9, 0.01, 10.8, { roughness: 0.95 }); shore.castShadow = false;
  for (let i = 0; i < 12; i++) { const a = R() * 6.28, r = 0.3 + R() * 0.6, g = grp(scene, LAKE.x + Math.cos(a) * 16 * r, 0.06, LAKE.z + Math.sin(a) * 8 * r); ball(g, 0.6, 0x5cc96a, 0, 0, 0, 1, 0.04, 1).castShadow = false; if (i % 3 === 0) ball(g, 0.17, 0xff9ec4, 0.15, 0.1, 0, 1, 0.7, 1); }
  const glints = [];
  for (let i = 0; i < 90; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 0.95; glints.push({ s: sprite(scene, starTex, 0xffffff, 0.5), x: LAKE.x + Math.cos(a) * 17 * r, z: LAKE.z + Math.sin(a) * 9 * r, ph: R() * 6.28, sp: 1.5 + R() * 2.5 }); }

  // arc-en-ciel du générique
  const rainbow = grp(scene, -6, 0, -2);
  [0xff8a8a, 0xffb36b, 0xffe36b, 0x8fe68a, 0x7fc8ff, 0xb79cff].forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(8.4 - i * 0.44, 0.24, 10, 80, Math.PI), mat(c, { emissive: c, emissiveIntensity: 0.3, roughness: 0.5 })); m.castShadow = false; rainbow.add(m); });
  for (const sx of [-1, 1]) { const g = grp(rainbow, sx * 7.3, 0.3, 0); for (let k = 0; k < 6; k++) ball(g, 0.9 + R() * 0.5, 0xffffff, (R() - 0.5) * 2.4, R() * 0.8, (R() - 0.5) * 1.2, 1, 0.8, 1, { emissive: 0xffffff, emissiveIntensity: 0.3 }).castShadow = false; }
  rainbow.visible = false;
  W.rainbow = (on) => { rainbow.visible = on; };
  W.rainbowPoint = (th, lift = 0.5) => new THREE.Vector3(-6 + Math.cos(th) * 7.6, Math.sin(th) * 7.6 + lift, -2);

  W.title = textSprite(scene, "Balou l'éléphant", { size: 150, w: 1600, h: 256 });
  W.five = textSprite(scene, '5', { size: 200, w: 256, h: 256, fill: '#ff8fc0' });

  // ----------------------------------------------------------- effets
  const stars = []; for (let i = 0; i < 70; i++) stars.push(sprite(scene, starTex, 0xffffff, 0.4));
  const hearts = [];
  const hs = new THREE.Shape(); hs.moveTo(0, -0.5); hs.bezierCurveTo(-1.1, 0.3, -0.5, 1.0, 0, 0.45); hs.bezierCurveTo(0.5, 1.0, 1.1, 0.3, 0, -0.5);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4 }); hg.center();
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(hg, mat(0xff6f9f, { emissive: 0xff2f6d, emissiveIntensity: 0.4, roughness: 0.3 })); scene.add(m); hearts.push(m); }
  const conf = []; const CC = [0xff5d8f, 0xffd21f, 0x2fd6c9, 0xb388ff, 0xff9f45, 0x7ed957];
  for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ color: CC[i % 6], side: THREE.DoubleSide })); scene.add(m); conf.push(m); }
  const pet = []; for (let i = 0; i < 50; i++) { const m = ball(scene, 0.11, [0xffb3cf, 0xff8fc0, 0xffd1e3][i % 3], 0, 0, 0, 1, 0.3, 0.7); m.castShadow = false; pet.push(m); }
  let nS = 0, nH = 0, nC = 0, nP = 0;
  const h3 = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  W.fx = {
    reset() { nS = nH = nC = nP = 0; for (const a of [stars, hearts, conf, pet]) a.forEach((m) => { m.visible = false; }); W.title.visible = false; W.five.visible = false; W.rainbow(false); W.sunset(0); },
    sparkle(p, age, n = 12, size = 1, dur = 1.1, col = 0xffffff) {
      if (age < 0 || age > dur) return; const u = age / dur;
      for (let i = 0; i < n && nS < stars.length; i++) {
        const s = stars[nS++], a = h3(i, nS) * 6.28, e = h3(i, 7) * 3.14 - 1.57, d = (0.4 + h3(i, 3)) * size * (1 - (1 - u) ** 2);
        s.visible = true; s.position.set(p.x + Math.cos(a) * Math.cos(e) * d, p.y + Math.sin(e) * d * 0.8 + 0.2 * u, p.z + Math.sin(a) * Math.cos(e) * d * 0.5 + 0.3);
        s.scale.setScalar(size * 0.55 * (1 - u) * (0.6 + 0.4 * Math.sin(age * 20 + i))); s.material.color.set(col);
      }
    },
    twinkle(p, t, n = 5, rad = 0.8) {
      for (let i = 0; i < n && nS < stars.length; i++) { const s = stars[nS++], a = t * 4 + i * 6.28 / n; s.visible = true; s.position.set(p.x + Math.cos(a) * rad, p.y + Math.sin(a * 2) * 0.08, p.z + Math.sin(a) * rad * 0.6); s.scale.setScalar(0.4); s.material.color.set(0xfff59a); }
    },
    hearts(p, age, n = 5, dur = 3) {
      for (let i = 0; i < n && nH < hearts.length; i++) {
        const a = age - i * 0.28; if (a < 0 || a > dur) continue; const m = hearts[nH++], u = a / dur;
        m.visible = true; m.position.set(p.x + (h3(i, 1) - 0.5) * 1.2 + Math.sin(a * 3 + i) * 0.12, p.y + a * 0.6, p.z + 0.3 + h3(i, 2) * 0.4);
        m.scale.setScalar(0.18 * Math.min(1, a * 5) * (1 - u * u)); m.rotation.set(0, Math.sin(a * 2 + i) * 0.5, Math.sin(a * 3 + i) * 0.2);
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
    petals(p, age, n = 40) { // pétales qui s'envolent puis retombent doucement
      if (age < 0 || age > 3.2) return;
      for (let i = 0; i < n && nP < pet.length; i++) {
        const m = pet[nP++], a = h3(i, 11) * 6.28, v = 0.8 + h3(i, 12) * 1.6, vy = 2.2 + h3(i, 13) * 2.4, k = 1.6;
        const d = (1 - Math.exp(-k * age)) / k, y = p.y + vy * d - 0.55 * age * age;
        m.visible = y > 0.04; m.position.set(p.x + Math.cos(a) * v * d + Math.sin(age * 3 + i) * 0.1, Math.max(0.04, y), p.z + Math.sin(a) * v * d * 0.7);
        m.rotation.set(age * 4 + i, age * 3 + i, i);
      }
    },
    rain(cx, cz, t, n = 80, top = 9, spread = 16) {
      for (let i = 0; i < n && nC < conf.length; i++) {
        const m = conf[nC++], sp = 1.2 + h3(i, 9) * 1.2, y = top - ((t * sp + h3(i, 4) * top) % top);
        m.visible = true; m.position.set(cx + (h3(i, 1) - 0.5) * spread + Math.sin(t * 2 + i) * 0.3, y, cz + (h3(i, 2) - 0.5) * 7); m.rotation.set(t * 4 + i, t * 3 + i, i);
      }
    },
  };

  W.update = (t) => {
    for (const f of flowers) { f.f.scale.setScalar(1 + 0.08 * Math.sin(t * 2.2 + f.ph)); f.f.rotation.z = 0.1 * Math.sin(t * 1.3 + f.ph); }
    for (const g of glints) { const k = Math.max(0, Math.sin(t * g.sp + g.ph)); g.s.position.set(g.x, 0.12, g.z); g.s.scale.setScalar(0.1 + 0.6 * k * k * k); }
  };
  return W;
}
