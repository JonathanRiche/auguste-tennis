// The tennis court and the park around it.
import * as THREE from 'three';
import { mat, box, sph, cyl, cone, buildCharacter, CHARACTERS } from './models.js';

// The court is a little shorter than a real one so the far side stays big on a phone.
export const HALF_LEN = 9;      // baseline distance from the net
export const HALF_W = 3.8;      // singles sideline
export const HALF_DW = 4.8;     // doubles sideline
export const NET_H = 0.9;
export const SERVICE = 5.2;     // service line distance from the net

export function buildCourt() {
  const group = new THREE.Group();

  // Grass and a path.
  const grass = new THREE.Mesh(new THREE.CircleGeometry(160, 48).rotateX(-Math.PI / 2), mat(0x6ecb4f));
  grass.position.y = -0.02;
  group.add(grass);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(HALF_DW * 2 + 6, HALF_LEN * 2 + 9).rotateX(-Math.PI / 2), mat(0x3f9a5a));
  apron.position.y = 0;
  group.add(apron);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(HALF_DW * 2, HALF_LEN * 2).rotateX(-Math.PI / 2), mat(0x2f6fc4));
  inner.position.y = 0.01;
  group.add(inner);

  // White lines.
  const W = 0xffffff, t = 0.1, y = 0.02;
  const line = (w, d, x, z) => box(group, w, 0.01, d, W, x, y, z);
  for (const s of [-1, 1]) {
    line(HALF_DW * 2 + t, t, 0, s * HALF_LEN);                    // baselines
    line(HALF_W * 2, t, 0, s * SERVICE);                           // service lines
    line(t, HALF_LEN * 2, s * HALF_W, 0);                          // singles sidelines
    line(t, HALF_LEN * 2, s * HALF_DW, 0);                         // doubles sidelines
    line(t, 0.4, 0, s * (HALF_LEN - 0.2));                         // centre marks
  }
  line(t, SERVICE * 2, 0, 0);                                      // centre service line

  // Net.
  for (const s of [-1, 1]) cyl(group, 0.07, NET_H + 0.15, 0x2b2d36, s * (HALF_DW + 0.5), (NET_H + 0.15) / 2, 0);
  const netMat = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(HALF_DW * 2 + 1, NET_H - 0.08), netMat);
  net.position.set(0, (NET_H - 0.08) / 2, 0);
  group.add(net);
  box(group, HALF_DW * 2 + 1, 0.1, 0.05, 0xffffff, 0, NET_H - 0.04, 0);

  // Low fences behind each baseline and along the sides.
  const fence = mat(0x1f6f4a, { transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(HALF_DW * 2 + 6, 1.4, 0.06), fence);
    f.position.set(0, 0.7, s * (HALF_LEN + 4.5));
    group.add(f);
    for (let i = -3; i <= 3; i++) cyl(group, 0.05, 1.5, 0x2b2d36, i * ((HALF_DW + 3) / 3), 0.75, s * (HALF_LEN + 4.5));
  }

  // Trees and bushes around the park.
  const rnd = mulberry(7);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.1;
    const r = 24 + rnd() * 30;
    const x = Math.cos(a) * r * 0.9, z = Math.sin(a) * r;
    if (z > 12 && Math.abs(x) < 14) continue; // keep the view behind the player clear
    const s = 0.8 + rnd() * 0.9;
    cyl(group, 0.3 * s, 2.4 * s, 0x8b5a2b, x, 1.2 * s, z);
    if (rnd() < 0.5) cone(group, 2.0 * s, 4.5 * s, 0x2e8b3e, x, 4.4 * s, z);
    else sph(group, 2.0 * s, rnd() < 0.5 ? 0x3fa34d : 0x58b947, x, 3.6 * s, z);
  }
  for (let i = 0; i < 18; i++) {
    const x = (rnd() - 0.5) * 60, z = -18 - rnd() * 8;
    sph(group, 0.8 + rnd() * 0.6, [0x3fa34d, 0x58b947, 0xff7aa8, 0xffd23f][i % 4], x, 0.4, z);
  }

  // Sky dressing: sun and clouds.
  const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false }));
  sun.position.set(-60, 70, -150);
  group.add(sun);
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloudMat);
      p.scale.setScalar(3 + rnd() * 3);
      p.position.set(k * 4 - 6, rnd() * 2, rnd() * 2);
      c.add(p);
    }
    c.position.set((rnd() - 0.5) * 220, 32 + rnd() * 25, -90 - rnd() * 80);
    clouds.add(c);
  }
  group.add(clouds);

  // Friends watching from benches on both sides; they jump when you hit the ball.
  const crowd = [];
  for (const s of [-1, 1]) {
    box(group, 1.2, 0.45, 14, 0xff8a3d, s * (HALF_DW + 3.6), 0.22, 0);
    box(group, 1.2, 0.1, 14, 0xffd23f, s * (HALF_DW + 3.6), 0.47, 0);
    for (let i = 0; i < 4; i++) {
      const idx = (i * 2 + (s > 0 ? 1 : 0)) % CHARACTERS.length;
      const c = buildCharacter(idx, 0.95);
      c.group.position.set(s * (HALF_DW + 3.6), 0.5, -5 + i * 3.4);
      c.group.rotation.y = -s * Math.PI / 2;
      c.legs.forEach((l) => { l.rotation.x = -1.3; });
      c.shadow.visible = false;
      c.arm.visible = false;
      group.add(c.group);
      crowd.push(c);
    }
  }

  return { group, crowd, clouds };
}

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,34,0.35)';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
