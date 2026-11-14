// Characters, rackets and the ball machine, all built from simple shapes.
// A character faces +Z; its right hand (holding the racket) is on -X.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
    matCache.set(key, m);
  }
  return m;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphGeo = new THREE.SphereGeometry(1, 20, 14);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 18);
const coneGeo = new THREE.ConeGeometry(1, 1, 14);

export function box(parent, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(boxGeo, mat(color, opts));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function sph(parent, r, color, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(sphGeo, mat(color));
  m.scale.set(r * sx, r * sy, r * sz);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function cyl(parent, r, h, color, x, y, z) {
  const m = new THREE.Mesh(cylGeo, mat(color));
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function cone(parent, r, h, color, x, y, z) {
  const m = new THREE.Mesh(coneGeo, mat(color));
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function shadowDisc(r) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
  );
  m.position.y = 0.03;
  return m;
}

// ---------- heads (centred on the head, radius 0.5) ----------
function eyes(g, y, z, dx = 0.19) {
  sph(g, 0.075, 0x1a1a1a, -dx, y, z);
  sph(g, 0.075, 0x1a1a1a, dx, y, z);
}
function smile(g, y, z) {
  box(g, 0.2, 0.04, 0.04, 0x1a1a1a, 0, y, z);
}
function kidHead(g) {
  sph(g, 0.5, 0xf2c79b, 0, 0, 0);
  // Cap with a peak.
  sph(g, 0.52, 0xe53935, 0, 0.1, -0.02, 1, 0.75, 1);
  box(g, 0.62, 0.06, 0.4, 0xe53935, 0, 0.17, 0.52);
  sph(g, 0.1, 0xf2c79b, -0.5, -0.02, 0);
  sph(g, 0.1, 0xf2c79b, 0.5, -0.02, 0);
  eyes(g, 0.0, 0.45);
  smile(g, -0.2, 0.46);
}
function puppyHead(g) {
  sph(g, 0.5, 0xd9a066, 0, 0, 0);
  sph(g, 0.24, 0x8b5a2b, -0.5, -0.05, 0, 0.55, 1.4, 0.8);
  sph(g, 0.24, 0x8b5a2b, 0.5, -0.05, 0, 0.55, 1.4, 0.8);
  sph(g, 0.22, 0xf3d9b0, 0, -0.11, 0.42);
  sph(g, 0.085, 0x1a1a1a, 0, -0.03, 0.63);
  eyes(g, 0.13, 0.43);
}
function kittyHead(g) {
  sph(g, 0.5, 0xf79b3c, 0, 0, 0);
  cone(g, 0.19, 0.38, 0xf79b3c, -0.29, 0.5, 0);
  cone(g, 0.19, 0.38, 0xf79b3c, 0.29, 0.5, 0);
  sph(g, 0.16, 0xffffff, 0, -0.11, 0.43);
  sph(g, 0.06, 0xff7aa8, 0, -0.05, 0.58);
  eyes(g, 0.11, 0.44);
}
function bearHead(g) {
  sph(g, 0.5, 0x8b5a2b, 0, 0, 0);
  sph(g, 0.19, 0x8b5a2b, -0.37, 0.41, 0);
  sph(g, 0.19, 0x8b5a2b, 0.37, 0.41, 0);
  sph(g, 0.21, 0xe2b98a, 0, -0.11, 0.42);
  sph(g, 0.08, 0x1a1a1a, 0, -0.03, 0.62);
  eyes(g, 0.13, 0.43);
}
function dinoHead(g) {
  sph(g, 0.5, 0x4caf50, 0, 0, 0);
  box(g, 0.52, 0.36, 0.55, 0x4caf50, 0, -0.11, 0.5);
  sph(g, 0.05, 0x1a1a1a, -0.12, 0.03, 0.78);
  sph(g, 0.05, 0x1a1a1a, 0.12, 0.03, 0.78);
  cone(g, 0.12, 0.3, 0xff8a3d, 0, 0.57, 0.05);
  cone(g, 0.12, 0.3, 0xff8a3d, 0, 0.47, -0.28);
  cone(g, 0.12, 0.3, 0xff8a3d, 0, 0.25, -0.5);
  eyes(g, 0.17, 0.4, 0.24);
}
function bunnyHead(g) {
  sph(g, 0.5, 0xf5f5f5, 0, 0, 0);
  sph(g, 0.2, 0xf5f5f5, -0.2, 0.7, 0, 0.55, 2.1, 0.5);
  sph(g, 0.2, 0xf5f5f5, 0.2, 0.7, 0, 0.55, 2.1, 0.5);
  sph(g, 0.13, 0xffc1d9, -0.2, 0.72, 0.06, 0.4, 1.6, 0.3);
  sph(g, 0.13, 0xffc1d9, 0.2, 0.72, 0.06, 0.4, 1.6, 0.3);
  sph(g, 0.06, 0xff7aa8, 0, -0.05, 0.5);
  eyes(g, 0.11, 0.44);
}
function robotHead(g) {
  box(g, 0.9, 0.8, 0.8, 0xb8c4d6, 0, 0, 0);
  box(g, 0.7, 0.4, 0.05, 0x22324a, 0, 0.02, 0.41);
  sph(g, 0.09, 0x6fe3ff, -0.17, 0.04, 0.44);
  sph(g, 0.09, 0x6fe3ff, 0.17, 0.04, 0.44);
  cyl(g, 0.03, 0.3, 0x8090a8, 0, 0.55, 0);
  sph(g, 0.08, 0xff4f4f, 0, 0.72, 0);
  sph(g, 0.12, 0x8090a8, -0.5, 0, 0);
  sph(g, 0.12, 0x8090a8, 0.5, 0, 0);
}

export const CHARACTERS = [
  { id: 'kid', name: 'Tennis Kid', head: kidHead, skin: 0xf2c79b, shirt: 0x2b6fd6, shorts: 0xffffff },
  { id: 'puppy', name: 'Puppy', head: puppyHead, skin: 0xd9a066, shirt: 0xe53935, shorts: 0x2b2d36 },
  { id: 'kitty', name: 'Kitty', head: kittyHead, skin: 0xf79b3c, shirt: 0x8e44ad, shorts: 0xffffff },
  { id: 'bear', name: 'Bear', head: bearHead, skin: 0x8b5a2b, shirt: 0x29b6f6, shorts: 0x1e3a8a },
  { id: 'dino', name: 'Dino', head: dinoHead, skin: 0x4caf50, shirt: 0xffc400, shorts: 0x2b6fd6 },
  { id: 'bunny', name: 'Bunny', head: bunnyHead, skin: 0xf5f5f5, shirt: 0xff7aa8, shorts: 0xffffff },
  { id: 'robot', name: 'Robot', head: robotHead, skin: 0x8090a8, shirt: 0xb8c4d6, shorts: 0x5a6a82 },
];

function racket(parent, frame) {
  const r = new THREE.Group();
  // Handle along -X from the hand, head beyond it. Face normal is +Z.
  const handle = cyl(r, 0.05, 0.42, 0x2b2d36, -0.21, 0, 0);
  handle.rotation.z = Math.PI / 2;
  const neck = cyl(r, 0.035, 0.2, frame, -0.5, 0, 0);
  neck.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 28), mat(frame));
  rim.scale.set(1.15, 1, 1);
  rim.position.set(-0.92, 0, 0);
  r.add(rim);
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.29, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  strings.scale.set(1.15, 1, 1);
  strings.position.set(-0.92, 0, 0);
  r.add(strings);
  parent.add(r);
  return r;
}

// A character standing on the ground at the origin. Returns handles for animation.
export function buildCharacter(idx, scale = 1.25) {
  const def = CHARACTERS[idx];
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(scale);
  group.add(body);
  const shadow = shadowDisc(0.75 * scale);
  group.add(shadow);

  const legs = [];
  for (const x of [-0.17, 0.17]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.55, 0);
    cyl(leg, 0.12, 0.45, def.skin, 0, -0.25, 0);
    box(leg, 0.22, 0.14, 0.34, 0xffffff, 0, -0.48, 0.06);
    body.add(leg);
    legs.push(leg);
  }
  const torso = new THREE.Group();
  torso.position.y = 0.55;
  body.add(torso);
  sph(torso, 0.3, def.shorts, 0, 0.05, 0, 1.15, 0.6, 1);
  sph(torso, 0.36, def.shirt, 0, 0.35, 0, 1, 1.05, 0.9);
  const head = new THREE.Group();
  head.position.y = 1.0;
  torso.add(head);
  def.head(head);

  // Left arm hangs by the side.
  const lArm = new THREE.Group();
  lArm.position.set(0.36, 0.55, 0);
  sph(lArm, 0.11, def.skin, 0.12, -0.18, 0, 1, 1.6, 1);
  torso.add(lArm);
  // Right arm holds the racket; it swings around the shoulder.
  const arm = new THREE.Group();
  arm.position.set(-0.36, 0.5, 0);
  torso.add(arm);
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.35; // racket a little lower than the shoulder
  arm.add(tilt);
  const upper = cyl(tilt, 0.1, 0.38, def.shirt, -0.19, 0, 0);
  upper.rotation.z = Math.PI / 2;
  sph(tilt, 0.12, def.skin, -0.42, 0, 0);
  const rk = new THREE.Group();
  rk.position.set(-0.45, 0, 0);
  tilt.add(rk);
  racket(rk, def.id === 'robot' ? 0xff8a3d : 0xffd23f);

  const c = { def, group, body, torso, head, legs, arm, lArm, shadow, scale, swingT: -1, swingDir: 1, windup: false, walk: 0, jump: 0, vy: 0, spin: 0 };
  setArm(c, -0.4);
  return c;
}

export function setArm(c, a) {
  c.arm.rotation.y = a;
}

// Racket head position in world space (for effects).
const tmp = new THREE.Vector3();
export function racketTip(c, out) {
  return c.arm.localToWorld(out.copy(tmp.set(-1.3, -0.45, 0)));
}

// Poses: forehand swings from behind (-1.4) through to across the body (2.2).
// Backhand swings from the far side (3.7) back through the front (0.7).
const FORE = [-1.5, 2.3], BACK = [3.8, 0.8];
export function animateCharacter(c, dt, time, moving) {
  // Swing.
  if (c.windup) {
    const [from] = c.swingDir > 0 ? FORE : BACK;
    c.arm.rotation.y += (from - c.arm.rotation.y) * Math.min(1, dt * 14);
  } else if (c.swingT >= 0) {
    c.swingT += dt;
    const [from, to] = c.swingDir > 0 ? FORE : BACK;
    const D = 0.28;
    if (c.swingT < D) {
      const k = c.swingT / D;
      c.arm.rotation.y = from + (to - from) * (1 - (1 - k) * (1 - k));
    } else if (c.swingT < D + 0.4) {
      const k = (c.swingT - D) / 0.4;
      c.arm.rotation.y = to + (-0.4 - to) * k * k * (3 - 2 * k);
    } else {
      c.swingT = -1;
      c.arm.rotation.y = -0.4;
    }
  }
  c.torso.rotation.y = c.swingT >= 0 && c.swingT < 0.5 ? Math.sin(Math.min(1, c.swingT / 0.3) * Math.PI) * 0.35 * c.swingDir : c.torso.rotation.y * 0.8;

  // Walk or idle bob.
  if (moving) c.walk += dt * 14;
  const sw = moving ? Math.sin(c.walk) * 0.6 : 0;
  c.legs[0].rotation.x += (sw - c.legs[0].rotation.x) * Math.min(1, dt * 12);
  c.legs[1].rotation.x += (-sw - c.legs[1].rotation.x) * Math.min(1, dt * 12);
  c.lArm.rotation.x = -sw * 0.6;
  const bob = moving ? Math.abs(Math.sin(c.walk)) * 0.06 : Math.sin(time * 3) * 0.02;
  c.torso.position.y = 0.55 + bob;

  // Hop.
  if (c.jump > 0 || c.vy > 0) {
    c.vy -= 22 * dt;
    c.jump += c.vy * dt;
    if (c.jump <= 0) { c.jump = 0; c.vy = 0; }
  }
  c.body.position.y = c.jump;
  c.shadow.scale.setScalar(1 / (1 + c.jump * 0.4));
  // Happy spin.
  if (c.spin > 0) {
    c.spin = Math.max(0, c.spin - dt * 2.2);
    c.body.rotation.y = (1 - c.spin) * Math.PI * 2;
    if (c.spin === 0) c.body.rotation.y = 0;
  }
}

export function startSwing(c, dir) {
  c.windup = false;
  c.swingDir = dir;
  c.swingT = 0;
}
export function windUp(c, dir) {
  c.windup = true;
  c.swingDir = dir;
  c.swingT = -1;
}
export function hop(c, v = 6) {
  if (c.jump === 0) c.vy = v;
}

// ---------- ball machine (faces +Z) ----------
export function buildMachine() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  group.add(shadowDisc(1.3));
  box(body, 1.7, 1.2, 1.5, 0xff6f3c, 0, 0.95, 0);
  box(body, 1.72, 0.18, 1.52, 0xffd23f, 0, 0.5, 0);
  // Hopper full of balls.
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 0.7, 20, 1, true), mat(0x2b6fd6, { side: THREE.DoubleSide }));
  hopper.position.y = 1.9;
  body.add(hopper);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 0.42;
    sph(body, 0.17, 0xd8f53c, Math.cos(a) * r, 2.12 + (i % 3) * 0.05, Math.sin(a) * r);
  }
  // Barrel.
  const barrel = new THREE.Group();
  barrel.position.set(0, 1.0, 0.7);
  body.add(barrel);
  const tube = cyl(barrel, 0.26, 0.6, 0x2b2d36, 0, 0, 0.25);
  tube.rotation.x = Math.PI / 2;
  const lip = cyl(barrel, 0.31, 0.12, 0xffd23f, 0, 0, 0.55);
  lip.rotation.x = Math.PI / 2;
  // Friendly face.
  for (const x of [-0.45, 0.45]) {
    sph(body, 0.17, 0xffffff, x, 1.3, 0.75);
    sph(body, 0.08, 0x1a1a1a, x, 1.3, 0.88);
  }
  box(body, 0.3, 0.06, 0.04, 0x1a1a1a, 0, 0.62, 0.76);
  // Wheels.
  for (const x of [-0.9, 0.9]) for (const z of [-0.5, 0.5]) {
    const w = cyl(body, 0.28, 0.2, 0x22232a, x, 0.28, z);
    w.rotation.z = Math.PI / 2;
  }
  return { group, body, barrel, muzzle: new THREE.Vector3(0, 1.0, 1.35), kick: 0 };
}
