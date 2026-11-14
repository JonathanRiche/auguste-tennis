import * as THREE from 'three';
import { CHARACTERS, buildCharacter, buildMachine, animateCharacter, startSwing, windUp, hop, mat, shadowDisc } from './models.js';
import { buildCourt, HALF_LEN, HALF_W, HALF_DW } from './court.js';
import { input, onAction, pollInput, bindTouch, clearInput, isHeld } from './input.js';
import * as audio from './audio.js';

const PLAYER_NAME = 'Auguste';
const STORE = 'auguste-tennis';

// ---------- levels ----------
// T is the ball's flight time to its bounce (in ball seconds): bigger is slower.
// spread is how far left and right of the player the balls go.
const MACHINE_LEVELS = [
  { name: 'Nice and slow', T: 1.65, spread: 0 },
  { name: 'A bit faster', T: 1.4, spread: 0.7 },
  { name: 'Left and right', T: 1.45, spread: 2.2, alternate: true },
  { name: 'Zoom zoom', T: 1.15, spread: 1.2 },
  { name: 'Super mix', T: [1.05, 1.65], spread: 2.4 },
];
const RALLY_LEVELS = [
  { name: 'Robot', friend: 6, T: 1.65, miss: 0.45, spread: 0 },
  { name: 'Bunny', friend: 5, T: 1.5, miss: 0.4, spread: 0.8 },
  { name: 'Puppy', friend: 1, T: 1.4, miss: 0.35, spread: 1.6 },
  { name: 'Bear', friend: 3, T: 1.3, miss: 0.3, spread: 2.0 },
  { name: 'Dino', friend: 4, T: 1.15, miss: 0.3, spread: 2.4 },
];
const MODES = [
  { id: 'machine', name: 'Ball Machine', icon: '🎾', levels: MACHINE_LEVELS, blurb: 'Practise your swing!' },
  { id: 'rally', name: 'Play a Friend', icon: '🤖', levels: RALLY_LEVELS, blurb: 'Hit it back and forth!' },
];

// ---------- settings (grown-ups area) ----------
const HIT = {
  veryeasy: { early: 1.7, front: 2.8, behind: 2.4, reach: 3.0 },
  easy: { early: 1.0, front: 2.1, behind: 1.8, reach: 2.4 },
  tricky: { early: 0.45, front: 1.5, behind: 1.2, reach: 1.9 },
  auto: { early: 0, front: 2.8, behind: 2.4, reach: 3.0 },
};
const OPTIONS = [
  { key: 'moving', label: 'Moving to the ball', values: ['auto', 'help', 'self'], show: (v) => ({ auto: 'By itself', help: 'With help', self: 'Stick only' }[v]) },
  { key: 'hitting', label: 'Hitting', values: ['veryeasy', 'easy', 'tricky', 'auto'], show: (v) => ({ veryeasy: 'Very easy', easy: 'Easy', tricky: 'Tricky', auto: 'Swings by itself' }[v]) },
  { key: 'speed', label: 'Ball speed', values: [0.7, 0.85, 1.0], show: (v) => ({ 0.7: 'Slow', 0.85: 'Medium', 1: 'Fast' }[v]) },
  { key: 'balls', label: 'Balls per game', values: [5, 10, 15], show: (v) => String(v) },
  { key: 'sound', label: 'Sound', values: [true, false], show: (v) => (v ? 'On' : 'Off') },
  { key: 'update', label: 'App updates', button: 'Check for update' },
];
const settings = { character: 0, mode: 0, level: 0, moving: 'auto', hitting: 'veryeasy', speed: 0.85, balls: 10, sound: true, stars: {} };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || '{}'));
} catch (e) { /* storage unavailable */ }
const clampI = (v, n) => Math.min(Math.max(v | 0, 0), n - 1);
settings.character = clampI(settings.character, CHARACTERS.length);
settings.mode = clampI(settings.mode, MODES.length);
settings.level = clampI(settings.level, MODES[settings.mode].levels.length);
for (const o of OPTIONS) if (o.values && !o.values.includes(settings[o.key])) settings[o.key] = o.values[0];
if (typeof settings.stars !== 'object' || !settings.stars) settings.stars = {};
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}
audio.setSound(settings.sound);

// ---------- renderer and scenes ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 600);

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a70, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-40, 100, 30);
  scene.add(sun);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ccbff);
scene.fog = new THREE.Fog(0x7ccbff, 120, 320);
lights(scene);
const court = buildCourt();
scene.add(court.group);

const showScene = new THREE.Scene();
showScene.background = new THREE.Color(0x58b7f5);
lights(showScene);
{
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.4, 40), mat(0xffd23f));
  disc.position.y = -0.2;
  showScene.add(disc);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 40).rotateX(-Math.PI / 2), mat(0x3f9ee0));
  floor.position.y = -0.4;
  showScene.add(floor);
}
const turntable = new THREE.Group();
showScene.add(turntable);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- ball physics ----------
const G = 9;            // gravity, a little floaty
const R = 0.17;         // ball radius (big, so it is easy to see)
const BOUNCE = 0.72;
const FRICT = 0.9;
const CONTACT = 1.2;    // comfortable hitting height
const PZ = HALF_LEN + 0.6;   // where the player hits the ball
const OZ = -PZ;              // where the friend hits the ball
const FENCE = HALF_LEN + 4.4;

const ballGeo = new THREE.SphereGeometry(R, 20, 14);
const ballMat = new THREE.MeshLambertMaterial({ color: 0xdcff3c, emissive: 0x4a5a00 });
const trailMat = new THREE.MeshBasicMaterial({ color: 0xf6ff9a, transparent: true, opacity: 0.35, depthWrite: false });
const balls = [];

function makeBall(x, y, z) {
  const mesh = new THREE.Mesh(ballGeo, ballMat);
  const shadow = shadowDisc(R * 1.3);
  const trail = [];
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(ballGeo, trailMat);
    t.scale.setScalar(0.9 - i * 0.14);
    scene.add(t);
    trail.push(t);
  }
  scene.add(mesh, shadow);
  const b = { mesh, shadow, trail, hist: [], p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), bounces: 0, side: 'none', age: 0, fade: 0 };
  balls.push(b);
  syncBall(b);
  return b;
}
function removeBall(b) {
  scene.remove(b.mesh, b.shadow, ...b.trail);
  b.shadow.geometry.dispose();
  b.shadow.material.dispose();
  balls.splice(balls.indexOf(b), 1);
}
function clearBalls() {
  while (balls.length) removeBall(balls[0]);
  cur = null;
}

// Velocity that bounces once and then reaches the hitter's line (zh) at about
// CONTACT height, crossing x = xh there. T is the flight time to the bounce.
// After a bounce vx and vz both shrink by FRICT, so this has a closed form.
function aimShot(b, xh, zh, T) {
  const p = b.p;
  const vy = (R - p.y + 0.5 * G * T * T) / T;
  const vyp = -(vy - G * T) * BOUNCE;
  const peak = R + (vyp * vyp) / (2 * G);
  const tc = peak > CONTACT ? (vyp + Math.sqrt(vyp * vyp - 2 * G * (CONTACT - R))) / G : vyp / G;
  const k = (FRICT * tc) / T;
  const zb = (zh + k * p.z) / (1 + k);
  b.v.set((xh - p.x) / (T + FRICT * tc), vy, (zb - p.z) / T);
  b.bounces = 0;
  b.age = 0;
  b.hist.length = 0;
}
// Ball path seen from above is a straight line, so where it crosses a line is easy.
function crossX(b, z) {
  if (Math.abs(b.v.z) < 0.01) return b.p.x;
  return b.p.x + ((z - b.p.z) * b.v.x) / b.v.z;
}

function stepBall(b, dt) {
  b.age += dt;
  b.p.x += b.v.x * dt;
  b.p.z += b.v.z * dt;
  b.p.y += b.v.y * dt - 0.5 * G * dt * dt;
  b.v.y -= G * dt;
  if (b.p.y < R && b.v.y < 0) {
    b.p.y = R;
    if (b.v.y < -1.2) {
      b.v.y = -b.v.y * BOUNCE;
      b.v.x *= FRICT;
      b.v.z *= FRICT;
      b.bounces++;
      audio.bounce(Math.min(1, -b.v.y / 5));
    } else {
      b.v.y = 0;
      b.v.x *= 1 - Math.min(1, dt * 1.5);
      b.v.z *= 1 - Math.min(1, dt * 1.5);
    }
  }
  // Fences and the machine stop runaway balls.
  if (Math.abs(b.p.z) > FENCE) { b.p.z = Math.sign(b.p.z) * FENCE; b.v.z *= -0.25; b.v.x *= 0.5; }
  if (Math.abs(b.p.x) > HALF_DW + 3) { b.p.x = Math.sign(b.p.x) * (HALF_DW + 3); b.v.x *= -0.3; }
  if (machine.group.visible && b.side !== 'toPlayer') {
    const m = machine.group.position;
    if (Math.abs(b.p.x - m.x) < 1.0 && Math.abs(b.p.z - m.z) < 0.9 && b.p.y < 2.2 && b.v.z < 0) {
      b.v.z = -b.v.z * 0.35;
      b.v.x *= 0.5;
      audio.bounce(0.8);
    }
  }
}

function syncBall(b) {
  b.mesh.position.copy(b.p);
  b.shadow.position.set(b.p.x, 0.035, b.p.z);
  b.shadow.scale.setScalar(1 + b.p.y * 0.25);
  b.shadow.material.opacity = 0.3 / (1 + b.p.y * 0.3);
  b.hist.unshift(b.p.clone());
  if (b.hist.length > 12) b.hist.pop();
  const fast = b.v.lengthSq() > 9;
  b.trail.forEach((t, i) => {
    const h = b.hist[(i + 1) * 2];
    t.visible = fast && !!h && b.fade === 0;
    if (h) t.position.copy(h);
  });
  const s = b.fade > 0 ? Math.max(0.001, 1 - b.fade) : 1;
  b.mesh.scale.setScalar(s);
  b.shadow.visible = s > 0.05;
}

// ---------- particles and pop-up words ----------
const partGeo = new THREE.OctahedronGeometry(0.12, 0);
const parts = [];
function burst(pos, colors, n = 18, speed = 5) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1;
    const r = Math.sqrt(1 - u * u);
    const sp = speed * (0.5 + Math.random() * 0.7);
    parts.push({ m, v: new THREE.Vector3(Math.cos(a) * r * sp, Math.abs(u) * sp + 2, Math.sin(a) * r * sp), life: 0.9 + Math.random() * 0.5 });
    scene.add(m);
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.v.y -= 9 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 8;
    p.m.rotation.y += dt * 6;
    p.m.scale.setScalar(Math.max(0.01, Math.min(1, p.life * 2)));
    if (p.life <= 0) {
      scene.remove(p.m);
      p.m.material.dispose();
      parts.splice(i, 1);
    }
  }
}
const ui = document.getElementById('ui');
function say(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'say ' + kind;
  el.textContent = text;
  ui.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ---------- the people and things on court ----------
let player = null, friend = null, friendIdx = -1;
const machine = buildMachine();
scene.add(machine.group);
machine.group.position.set(0, 0, OZ - 1.2);

const marker = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false }));
marker.position.y = 0.04;
marker.visible = false;
scene.add(marker);

// Balloons to pop on the far side in ball machine mode.
const BALLOON_COLORS = [0xff4f6d, 0xffb52e, 0x7a5cff, 0x2ec7ff, 0x3ccf6e];
const balloons = [];
const BALLOON_Y = 3.1;
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), mat(BALLOON_COLORS[i]));
  ball.scale.set(1, 1.18, 1);
  ball.position.y = BALLOON_Y;
  g.add(ball);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), ball.material);
  knot.position.y = BALLOON_Y - 0.85;
  g.add(knot);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, BALLOON_Y - 0.85, 4), mat(0xffffff));
  string.position.y = (BALLOON_Y - 0.85) / 2;
  g.add(string);
  // Up high and to the sides, so they do not hide the machine or the ball.
  g.position.set((i - 1) * 3.1, 0, -3.2);
  scene.add(g);
  balloons.push({ g, ball, alive: true, respawn: 0, grow: 1, color: i });
}

function setPlayerCharacter() {
  if (player) scene.remove(player.group);
  player = buildCharacter(settings.character);
  player.group.rotation.y = Math.PI;
  player.x = 0;
  player.group.position.set(0, 0, PZ + 0.35);
  scene.add(player.group);
}
let showChar = null, showSwing = 0;
function setShowChar() {
  if (showChar) turntable.remove(showChar.group);
  showChar = buildCharacter(settings.character, 1.6);
  turntable.add(showChar.group);
  showSwing = 1.2;
}

// The friend is always the one named on the level, even if the player picked
// the same character (Robot against Robot is fine).
function friendFor(levelIdx) {
  return RALLY_LEVELS[levelIdx].friend;
}
// Put the ball machine or the right friend on the far side.
function setupFarSide(modeIdx, levelIdx) {
  const rally = MODES[modeIdx].id === 'rally';
  machine.group.visible = !rally;
  for (const b of balloons) b.g.visible = !rally && b.alive;
  const want = rally ? friendFor(levelIdx) : -1;
  if (want !== friendIdx) {
    if (friend) scene.remove(friend.group);
    friend = null;
    friendIdx = want;
    if (want >= 0) {
      friend = buildCharacter(want);
      friend.x = 0;
      friend.group.position.set(0, 0, OZ - 0.35);
      scene.add(friend.group);
    }
  }
}

// ---------- game state ----------
let state = 'title';
let time = 0;
let modeSel = settings.mode, levelSel = settings.level;
let optRow = 0, pauseRow = 0, resultRow = 0;
let level = null, levelMode = 0, levelIdx = 0;
let cur = null;          // the ball in play
let served = 0, results = [], hits = 0, lastSide = 1;
let queuedAt = -10;      // when the swing button was last pressed
let nextAt = 0, nextFn = null;
let willMiss = false;
const RESULT_LOCK = 3.5; // seconds the stars screen ignores button mashing
let resultAt = 0, starsShown = 0, resultStars = 0;
let holdT = 0, touchHold = false;
let updateMsg = '';
const NATIVE = typeof window.Host !== 'undefined';
const VERSION = NATIVE && window.Host.version ? window.Host.version() : 'web';

function later(sec, fn) { nextAt = time + sec; nextFn = fn; }
function ts() { return settings.speed; }

function startLevel(m, l) {
  levelMode = m;
  levelIdx = l;
  level = MODES[m].levels[l];
  settings.mode = m;
  settings.level = l;
  save();
  setupFarSide(m, l);
  clearBalls();
  for (const b of balloons) { b.alive = true; b.grow = 1; b.g.visible = MODES[m].id === 'machine'; }
  served = 0; results = []; hits = 0; lastSide = 1; queuedAt = -10; willMiss = false;
  player.x = 0;
  if (friend) friend.x = 0;
  go('play');
  say('Ready? 🎾', 'big');
  later(1.8, serve);
}

function rally() { return MODES[levelMode].id === 'rally'; }

function targetX() {
  let s = level.spread;
  if (!s) return 0;
  if (level.alternate) { lastSide = -lastSide; return lastSide * s; }
  return (Math.random() * 2 - 1) * s;
}
function flightT() {
  const T = level.T;
  return Array.isArray(T) ? T[0] + Math.random() * (T[1] - T[0]) : T;
}

// A new ball comes towards the player, from the machine or the friend.
function serve() {
  if (served >= settings.balls) return finish();
  let b;
  if (rally()) {
    b = makeBall(friend.x - 0.9, 2.1, OZ + 0.2);
    startSwing(friend, 1);
    audio.pock(true);
  } else {
    const m = machine.group.position;
    b = makeBall(m.x, machine.muzzle.y, m.z + machine.muzzle.z);
    machine.kick = 1;
    audio.fwoomp();
    burst(b.p, [0xffffff, 0xeeeeee], 8, 2);
  }
  sendToPlayer(b);
}
function sendToPlayer(b) {
  aimShot(b, Math.max(-HALF_W + 0.4, Math.min(HALF_W - 0.4, targetX())), PZ, flightT());
  b.side = 'toPlayer';
  cur = b;
  served++;
  renderHud();
}

function hitZone(b) {
  const h = HIT[settings.hitting];
  const dx = b.p.x - player.x;
  return b.side === 'toPlayer' && b.v.z > 0 && b.p.z > PZ - h.front && b.p.z < PZ + h.behind
    && b.p.y < 3.6 && dx > -h.reach && dx < h.reach + 0.6;
}

function swingPressed() {
  if (player.swingT >= 0 && player.swingT < 0.25) return;
  const b = cur;
  if (b && hitZone(b)) return hitBall(b);
  if (b && b.side === 'toPlayer' && settings.hitting !== 'auto') {
    queuedAt = time;
    windUp(player, crossX(b, PZ) - player.x > -0.3 ? 1 : -1);
    return;
  }
  startSwing(player, 1);
  audio.swoosh();
}

function hitBall(b) {
  queuedAt = -10;
  const dir = b.p.x - player.x > -0.3 ? 1 : -1;
  startSwing(player, dir);
  audio.swoosh();
  audio.pock(false);
  hits++;
  results.push(true);
  // Aim with the stick, otherwise somewhere nice (a balloon if there is one).
  let x;
  if (Math.abs(input.move) > 0.3 && settings.moving !== 'self') x = input.move * 3;
  else if (!rally()) {
    const live = balloons.filter((l) => l.alive);
    x = live.length ? live[Math.floor(Math.random() * live.length)].g.position.x : (Math.random() * 2 - 1) * 2;
  } else x = (Math.random() * 2 - 1) * 1.8;
  b.p.y = Math.max(b.p.y, 0.5);
  aimShot(b, x, OZ, 1.2);
  b.side = 'toFar';
  burst(b.p, [0xffd23f, 0xffffff, 0xff8a3d], 16, 4);
  say(['Great! 🎾', 'Wow!', 'Super hit!', 'Yay!', 'Boom!', 'Nice one!'][Math.floor(Math.random() * 6)], 'good');
  audio.cheer();
  setTimeout(() => hop(player, 5), 350);
  court.crowd.forEach((c, i) => setTimeout(() => hop(c, 4 + Math.random() * 2), 100 + i * 60));
  renderHud();
  if (rally()) {
    willMiss = served >= settings.balls || Math.random() < level.miss;
  } else {
    later(2.0, serve);
  }
}

function missBall(b) {
  queuedAt = -10;
  player.windup = false;
  results.push(false);
  b.side = 'missed';
  cur = null;
  say('Oops! Next one!', 'soft');
  audio.oops();
  renderHud();
  later(1.4, serve);
}

function finish() {
  cur = null;
  marker.visible = false;
  const ratio = hits / settings.balls;
  resultStars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
  const key = MODES[levelMode].id + levelIdx;
  settings.stars[key] = Math.max(settings.stars[key] || 0, resultStars);
  save();
  resultAt = time;
  starsShown = 0;
  resultRow = levelIdx < MODES[levelMode].levels.length - 1 ? 2 : 1;
  audio.fanfare();
  snapNext = false;
  go('results');
}

// ---------- per-frame play ----------
function movePlayer(dt) {
  const b = cur;
  const coming = b && b.side === 'toPlayer';
  const want = coming ? crossX(b, PZ) - 0.85 : 0;
  let v = 0;
  const m = settings.moving;
  if (m === 'auto' || m === 'help') {
    const top = m === 'auto' ? 8 : 3.2;
    v = Math.max(-top, Math.min(top, (want - player.x) * 6));
  }
  if (m !== 'auto') v += input.move * 6.5;
  const lim = HALF_DW + 1.4;
  const nx = Math.max(-lim, Math.min(lim, player.x + v * dt));
  const moving = Math.abs(nx - player.x) > dt * 0.6;
  player.x = nx;
  player.group.position.x = player.x;
  marker.visible = coming;
  if (coming) {
    marker.position.set(crossX(b, PZ), 0.04, PZ);
    marker.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
  }
  return moving;
}

function moveFriend(dt) {
  if (!friend) return false;
  const b = cur;
  let want = 0;
  if (b && b.side === 'toFar') {
    const x = crossX(b, OZ);
    want = willMiss ? x + (x > 0 ? -2.8 : 2.8) : x + 0.9;
  }
  const v = Math.max(-6, Math.min(6, (want - friend.x) * 5));
  const nx = friend.x + v * dt;
  const moving = Math.abs(nx - friend.x) > dt * 0.6;
  friend.x = nx;
  friend.group.position.x = nx;
  return moving;
}

function updatePlay(dt) {
  const bdt = dt * ts();
  for (const b of balls.slice()) {
    stepBall(b, bdt);
    if (b !== cur) {
      b.age += dt;
      if (b.age > 2.5) b.fade = Math.min(1, b.fade + dt * 2);
      if (b.fade >= 1) removeBall(b);
    }
  }
  const b = cur;
  if (b && b.side === 'toPlayer') {
    const h = HIT[settings.hitting];
    const inZone = hitZone(b);
    if (inZone && settings.hitting === 'auto' && b.p.z > PZ - 0.7) hitBall(b);
    else if (inZone && time - queuedAt < Math.max(h.early, 0.5)) hitBall(b);
    else if (b.p.z > PZ + h.behind) missBall(b);
    // A swing that was pressed too early still goes through after a while.
    if (player.windup && time - queuedAt > h.early + 0.4) { player.windup = false; startSwing(player, player.swingDir); }
  } else if (b && b.side === 'toFar') {
    if (rally()) {
      if (!willMiss && b.v.z < 0 && b.bounces >= 1 && b.p.z < OZ + 0.9) {
        startSwing(friend, 1);
        audio.pock(true);
        b.p.y = Math.max(b.p.y, 0.6);
        sendToPlayer(b);
      } else if (willMiss && b.p.z < OZ - 0.6) {
        b.side = 'done';
        cur = null;
        friend.spin = 1;
        say('Point! 🎉', 'good');
        audio.cheer();
        court.crowd.forEach((c, i) => setTimeout(() => hop(c, 5), i * 50));
        later(1.6, serve);
      }
    } else {
      for (const l of balloons) {
        if (!l.alive) continue;
        const p = l.g.position;
        if (Math.abs(b.p.z - p.z) < 0.9 && Math.abs(b.p.x - p.x) < 1.15 && b.p.y < 4.5) popBalloon(l);
      }
      if (b.bounces >= 2 || b.p.z < OZ - 1.5) { b.side = 'done'; cur = null; }
    }
  }
  for (const x of balls) syncBall(x);

  const pm = movePlayer(dt);
  const fm = moveFriend(dt);
  animateCharacter(player, dt, time, pm);
  if (friend) animateCharacter(friend, dt, time, fm);

  if (nextFn && time >= nextAt) {
    const f = nextFn;
    nextFn = null;
    f();
  }
}

function popBalloon(l) {
  l.alive = false;
  l.respawn = 2.5;
  l.g.visible = false;
  const p = l.ball.getWorldPosition(new THREE.Vector3());
  burst(p, [BALLOON_COLORS[l.color], 0xffffff, 0xffd23f], 26, 6);
  audio.pop();
  say('Pop! 🎈', 'good');
}
function updateBalloons(dt) {
  for (const l of balloons) {
    if (!l.alive && state === 'play' && !rally()) {
      l.respawn -= dt;
      if (l.respawn <= 0) {
        l.alive = true;
        l.grow = 0;
        l.color = (l.color + 3) % BALLOON_COLORS.length;
        l.ball.material = mat(BALLOON_COLORS[l.color]);
        l.g.children[1].material = l.ball.material;
        l.g.visible = true;
      }
    }
    l.grow = Math.min(1, l.grow + dt * 2);
    l.g.scale.setScalar(l.grow);
    l.ball.position.y = BALLOON_Y + Math.sin(time * 1.6 + l.g.position.x) * 0.15;
  }
}

function updateMachine(dt) {
  machine.kick = Math.max(0, machine.kick - dt * 4);
  machine.body.position.z = -machine.kick * 0.25;
  machine.body.scale.set(1 + machine.kick * 0.08, 1 - machine.kick * 0.06, 1);
  machine.body.position.y = Math.abs(Math.sin(time * 2)) * 0.04;
}

// ---------- camera ----------
const camPos = new THREE.Vector3(0, 9, 24), camLook = new THREE.Vector3(0, 1, 0);
const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
let snapNext = true;
function updateCamera(dt) {
  if (state === 'player') {
    wantPos.set(0, 2.9, 7.2);
    wantLook.set(0, 1.6, 0);
  } else if (state === 'play' || state === 'paused') {
    const px = player.x;
    wantPos.set(px * 0.45, 4.4, PZ + 7.6);
    wantLook.set(px * 0.25, 0.6, -2);
  } else if (state === 'results') {
    const a = Math.sin((time - resultAt) * 0.4) * 0.6;
    // Keep the dancing player to one side so the stars do not cover them.
    wantPos.set(player.x + Math.sin(a) * 7, 2.4, player.group.position.z - Math.cos(a) * 7);
    wantLook.set(player.x + Math.cos(a) * 2.6, 1.9, player.group.position.z + Math.sin(a) * 2.6);
  } else {
    const a = time * 0.12;
    wantPos.set(Math.sin(a) * 21, 8.5, Math.cos(a) * 21);
    wantLook.set(0, 0.5, 0);
  }
  const k = snapNext ? 1 : 1 - Math.exp(-dt * 3.5);
  snapNext = false;
  camPos.lerp(wantPos, k);
  camLook.lerp(wantLook, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---------- screens ----------
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const dots = (n, cur) => `<div class="dots">${Array.from({ length: n }, (_, i) => `<i class="${i === cur ? 'on' : ''}"></i>`).join('')}</div>`;
const starRow = (n, cls = '') => `<span class="stars ${cls}">${[0, 1, 2].map((i) => `<b class="${i < n ? 'on' : ''}">★</b>`).join('')}</span>`;

function render() {
  let h = '';
  if (state === 'title') {
    h = `<div class="title"><h1>${PLAYER_NAME}<br>Tennis</h1></div>
      <div class="bottom"><button class="go big" data-act="ok">▶ PLAY</button></div>
      <button class="grownups" id="grownups"><i id="holdfill"></i><span>⚙ Grown-ups<small>hold</small></span></button>`;
  } else if (state === 'player') {
    h = `<div class="top">Who is playing?</div>
      <button class="arrow left" data-act="left">◀</button>
      <button class="arrow right" data-act="right">▶</button>
      <div class="bottom"><div class="name">${esc(CHARACTERS[settings.character].name)}</div>${dots(CHARACTERS.length, settings.character)}
      <div class="row"><button class="small" data-act="back">◀ Back</button><button class="go" data-act="ok">OK ✔</button></div></div>`;
  } else if (state === 'mode') {
    h = `<div class="top">What shall we play?</div>
      <div class="cards">${MODES.map((m, i) => `<button class="card mode ${i === modeSel ? 'sel' : ''}" data-pick="${i}">
        <span class="icon">${m.icon}</span><span class="cname">${m.name}</span><span class="blurb">${m.blurb}</span></button>`).join('')}</div>
      <div class="bottom"><div class="row"><button class="small" data-act="back">◀ Back</button><button class="go" data-act="ok">OK ✔</button></div></div>`;
  } else if (state === 'level') {
    const mode = MODES[modeSel];
    h = `<div class="top">${mode.icon} ${mode.name}</div>
      <div class="cards">${mode.levels.map((l, i) => `<button class="card level ${i === levelSel ? 'sel' : ''}" data-pick="${i}">
        <span class="num">${i + 1}</span><span class="lname">${esc(l.name)}</span>${starRow(settings.stars[mode.id + i] || 0)}</button>`).join('')}</div>
      <div class="bottom"><div class="row"><button class="small" data-act="back">◀ Back</button><button class="go" data-act="ok">GO! 🎾</button></div></div>`;
  } else if (state === 'options') {
    h = `<div class="panel"><h2>Grown-ups</h2>${OPTIONS.map((o, i) => `
      <div class="opt ${i === optRow ? 'sel' : ''}" data-row="${i}">
        <span>${o.label}</span>${o.button
          ? `<b><button class="upd" data-row="${i}" data-act="ok">${o.button}</button></b>`
          : `<b><button data-row="${i}" data-act="left">◀</button><em>${o.show(settings[o.key])}</em><button data-row="${i}" data-act="right">▶</button></b>`}</div>`).join('')}
      <div class="status">Version ${esc(VERSION)}<br><span id="updmsg">${esc(updateMsg)}</span></div>
      <button class="go" data-act="back">Done ✔</button></div>`;
  } else if (state === 'play') {
    h = `<div class="hud" id="hud"></div><button class="corner" data-act="pause">❚❚</button>`;
  } else if (state === 'paused') {
    const items = ['▶ Keep playing', '↺ Start again', '⌂ Levels'];
    h = `<div class="panel"><h2>Paused</h2>${items.map((t, i) =>
      `<button class="item ${i === pauseRow ? 'sel' : ''}" data-pick="${i}">${t}</button>`).join('')}</div>`;
  } else if (state === 'results') {
    const last = levelIdx >= MODES[levelMode].levels.length - 1;
    const btns = [['⌂ Levels', 0], ['↺ Again', 1]].concat(last ? [] : [['Next ▶', 2]]);
    h = `<div class="confetti">${Array.from({ length: 60 }, (_, i) =>
      `<i style="left:${(i * 37) % 100}%;background:hsl(${(i * 47) % 360} 90% 60%);animation-delay:${-((i * 0.37) % 3)}s;animation-duration:${2.2 + (i % 5) * 0.4}s"></i>`).join('')}</div>
      <div class="title"><h1 class="mid">Yay ${PLAYER_NAME}!</h1><div class="sub">You hit ${hits} ${hits === 1 ? 'ball' : 'balls'}!</div>
      <div class="bigstars" id="bigstars">${[0, 1, 2].map((i) => `<b class="${i < starsShown ? 'on' : ''}">★</b>`).join('')}</div></div>
      <div class="bottom"><div class="row">${btns.map(([t, i]) => `<button class="${i === 2 || (last && i === 1) ? 'go' : 'small'} ${i === resultRow ? 'sel' : ''}" data-res="${i}">${t}</button>`).join('')}</div></div>`;
  }
  ui.innerHTML = h;
  renderHud();
  bindHold();
}

function renderHud() {
  const el = document.getElementById('hud');
  if (!el) return;
  const n = settings.balls;
  el.innerHTML = `<div class="balls">${Array.from({ length: n }, (_, i) =>
    `<i class="${i < results.length ? (results[i] ? 'hit' : 'miss') : i === results.length && cur && cur.side === 'toPlayer' ? 'now' : ''}"></i>`).join('')}</div>
    <div class="score">🎾 ${hits}</div>`;
}

// The grown-ups button needs a long press so little hands do not open it by accident.
function bindHold() {
  const b = document.getElementById('grownups');
  if (!b) return;
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); touchHold = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { touchHold = false; });
}
function updateHold(dt) {
  if (state !== 'title') { holdT = 0; touchHold = false; return; }
  const holding = touchHold || isHeld('y');
  holdT = holding ? holdT + dt : Math.max(0, holdT - dt * 3);
  const fill = document.getElementById('holdfill');
  if (fill) fill.style.width = `${Math.min(100, (holdT / 1.2) * 100)}%`;
  if (holdT >= 1.2) {
    holdT = 0;
    touchHold = false;
    optRow = 0;
    audio.blip();
    go('options');
  }
}

function go(next) {
  // The character picker is a separate scene, so the camera jumps there and back.
  if (next === 'player' || state === 'player') snapNext = true;
  state = next;
  if (next !== 'play' && next !== 'paused') marker.visible = false;
  render();
}

function backToLevels() {
  clearBalls();
  nextFn = null;
  player.x = 0;
  player.group.position.x = 0;
  player.windup = false;
  if (friend) { friend.x = 0; friend.group.position.x = 0; }
  modeSel = levelMode;
  levelSel = levelIdx;
  go('level');
}

// ---------- actions (from buttons, keys, gamepad, touch) ----------
function act(a, row) {
  audio.initAudio();
  if (a === 'sysback') a = state === 'play' ? 'pause' : 'back';
  const dir = a === 'left' ? -1 : a === 'right' ? 1 : 0;
  switch (state) {
    case 'title':
      if (a === 'ok' || a === 'pause') { audio.blip(); setShowChar(); go('player'); }
      break;
    case 'player':
      if (dir) {
        settings.character = (settings.character + dir + CHARACTERS.length) % CHARACTERS.length;
        save(); audio.blip(); setShowChar(); render();
      } else if (a === 'ok') { audio.blip(); setPlayerCharacter(); setupFarSide(modeSel, levelSel); go('mode'); }
      else if (a === 'back') go('title');
      break;
    case 'mode':
      if (dir) { modeSel = (modeSel + dir + MODES.length) % MODES.length; levelSel = 0; audio.blip(); setupFarSide(modeSel, 0); render(); }
      else if (a === 'ok') { audio.blip(); levelSel = modeSel === settings.mode ? settings.level : 0; setupFarSide(modeSel, levelSel); go('level'); }
      else if (a === 'back') { setShowChar(); go('player'); }
      break;
    case 'level': {
      const n = MODES[modeSel].levels.length;
      if (dir) { levelSel = (levelSel + dir + n) % n; audio.blip(); setupFarSide(modeSel, levelSel); render(); }
      else if (a === 'ok' || a === 'pause') startLevel(modeSel, levelSel);
      else if (a === 'back') go('mode');
      break;
    }
    case 'options': {
      if (row !== undefined) optRow = row;
      const o = OPTIONS[optRow];
      if (a === 'up') optRow = (optRow + OPTIONS.length - 1) % OPTIONS.length;
      else if (a === 'down') optRow = (optRow + 1) % OPTIONS.length;
      else if (o.button && a === 'ok') { checkUpdate(); return; }
      else if ((dir || a === 'ok') && o.values) {
        const i = o.values.indexOf(settings[o.key]);
        settings[o.key] = o.values[(i + (dir || 1) + o.values.length) % o.values.length];
        save();
        audio.setSound(settings.sound);
        audio.blip();
      } else if (a === 'back' || a === 'pause') { go('title'); return; }
      render();
      break;
    }
    case 'play':
      if (a === 'pause') { pauseRow = 0; go('paused'); }
      else if (a === 'ok' || a === 'back' || a === 'swing' || a === 'opt' || a === 'tap') swingPressed();
      break;
    case 'paused':
      if (a === 'up') { pauseRow = (pauseRow + 2) % 3; render(); }
      else if (a === 'down') { pauseRow = (pauseRow + 1) % 3; render(); }
      else if (a === 'pause' || a === 'back') go('play');
      else if (a === 'ok') pick(pauseRow);
      break;
    case 'results': {
      if (time - resultAt < RESULT_LOCK) break; // let the stars land before anything is chosen
      const last = levelIdx >= MODES[levelMode].levels.length - 1;
      const n = last ? 2 : 3;
      if (dir) { resultRow = (resultRow + dir + n) % n; audio.blip(); render(); }
      else if (a === 'ok') resultPick(resultRow);
      else if (a === 'back' || a === 'pause') resultPick(0);
      break;
    }
  }
}
function pick(i) {
  if (i === 0) go('play');
  else if (i === 1) startLevel(levelMode, levelIdx);
  else backToLevels();
}
function resultPick(i) {
  audio.blip();
  if (i === 0) backToLevels();
  else if (i === 1) startLevel(levelMode, levelIdx);
  else startLevel(levelMode, levelIdx + 1);
}
onAction((a) => act(a));

ui.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-pick],[data-res]');
  if (!b) return;
  audio.initAudio();
  if (b.dataset.res !== undefined) {
    if (time - resultAt >= RESULT_LOCK) resultPick(+b.dataset.res);
    return;
  }
  if (b.dataset.pick !== undefined) {
    const i = +b.dataset.pick;
    if (state === 'paused') return pick(i);
    if (state === 'mode') { if (modeSel !== i) { modeSel = i; setupFarSide(i, 0); } return act('ok'); }
    if (state === 'level') { levelSel = i; return startLevel(modeSel, i); }
    return;
  }
  act(b.dataset.act, b.dataset.row !== undefined ? +b.dataset.row : undefined);
});
bindTouch(canvas);
canvas.addEventListener('pointerdown', () => audio.initAudio());

// ---------- app updates (Android shell does the work) ----------
function checkUpdate() {
  audio.blip();
  if (!NATIVE || !window.Host.checkUpdate) {
    window.updateStatus('Updates work in the Android app.');
    return;
  }
  window.updateStatus('Checking for a new version…');
  window.Host.checkUpdate();
}
window.updateStatus = (text) => {
  updateMsg = text;
  const el = document.getElementById('updmsg');
  if (el) el.textContent = text;
};

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (hidden) return;
  pollInput();
  updateHold(dt);

  if (state !== 'paused') {
    time += dt;
    if (state === 'player') {
      turntable.rotation.y += dt * 0.7;
      showSwing -= dt;
      if (showSwing <= 0) { showSwing = 2.4; startSwing(showChar, Math.random() < 0.5 ? 1 : -1); }
      animateCharacter(showChar, dt, time, false);
    } else if (state === 'play') {
      updatePlay(dt);
    } else {
      // Menus and results: everyone idles on court.
      for (const b of balls) { stepBall(b, dt * ts()); syncBall(b); }
      animateCharacter(player, dt, time, false);
      if (friend) animateCharacter(friend, dt, time, false);
      if (state === 'results') {
        const t = time - resultAt;
        while (starsShown < resultStars && t > 0.7 + starsShown * 0.5) {
          starsShown++;
          audio.star(starsShown - 1);
          const el = document.querySelector(`#bigstars b:nth-child(${starsShown})`);
          if (el) el.classList.add('on');
        }
        if (Math.floor(t / 1.6) !== Math.floor((t - dt) / 1.6)) { hop(player, 6); if (Math.random() < 0.5) player.spin = 1; }
      }
    }
    for (const c of court.crowd) animateCharacter(c, dt, time, false);
    updateBalloons(dt);
    updateMachine(dt);
    updateParts(dt);
    court.clouds.position.x = Math.sin(time * 0.02) * 30;
    updateCamera(dt);
  }
  renderer.render(state === 'player' ? showScene : scene, camera);
}

// The Android shell calls this when the app goes to the background.
let hidden = false;
window.appPause = (p) => {
  hidden = !!p;
  audio.pauseAudio(hidden);
  clearInput();
  touchHold = false;
  if (hidden && state === 'play') { pauseRow = 0; go('paused'); }
};
document.addEventListener('visibilitychange', () => window.appPause(document.hidden));

// Test hook.
window.__game = { act, settings, startLevel, get friend() { return friend && friend.def.id; }, get state() { return state; }, get ball() { return cur; }, get player() { return player; }, get hits() { return hits; }, get results() { return results; } };

setPlayerCharacter();
setupFarSide(modeSel, levelSel);
render();
requestAnimationFrame(frame);
