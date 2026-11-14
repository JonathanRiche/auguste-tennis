// One input state fed by: the Android shell (gamepad), the browser Gamepad
// API, the keyboard and touch. Menus and swings listen for actions; moving
// reads the stick state.
const NATIVE = /[?&]native=1/.test(location.search);

export const input = { move: 0 };

let handler = () => {};
export function onAction(fn) { handler = fn; }
function fire(name) { handler(name); }

const held = new Set();       // named buttons currently down (any source)
const pad = { x: 0, y: 0, hx: 0, hy: 0, lt: 0, rt: 0 };
const nav = { left: false, right: false, up: false, down: false, lt: false, rt: false };
const touch = new Map();      // pointerId -> -1 | 1

// Button name -> action fired when it goes down. Every face and shoulder
// button swings the racket during play.
const ACTIONS = {
  a: 'ok', b: 'back', x: 'swing', y: 'opt', start: 'pause', select: 'pause', back: 'sysback',
  l1: 'swing', r1: 'swing', l2: 'swing', r2: 'swing', l3: 'swing', r3: 'swing',
};

export function isHeld(name) { return held.has(name); }

function button(name, down) {
  if (down) {
    if (held.has(name)) return;
    held.add(name);
    if (ACTIONS[name]) fire(ACTIONS[name]);
  } else {
    held.delete(name);
  }
}

// Stick or d-pad pushed far enough counts as a menu press, once per push.
// Analog triggers pulled in count as a swing.
function updateNav() {
  const x = Math.abs(pad.x) > Math.abs(pad.hx) ? pad.x : pad.hx;
  const y = Math.abs(pad.y) > Math.abs(pad.hy) ? pad.y : pad.hy;
  const now = {
    left: x < -0.6 || held.has('left'), right: x > 0.6 || held.has('right'),
    up: y < -0.6 || held.has('up'), down: y > 0.6 || held.has('down'),
    lt: pad.lt > 0.5, rt: pad.rt > 0.5,
  };
  for (const k in now) {
    if (now[k] && !nav[k]) fire(k === 'lt' || k === 'rt' ? 'swing' : k);
    nav[k] = now[k];
  }
}

// Called by the Android shell.
window.padAxes = (x, y, hx, hy, rt, lt) => {
  pad.x = x; pad.y = y; pad.hx = hx; pad.hy = hy; pad.rt = rt; pad.lt = lt;
  updateNav();
};
window.padKey = (name, down) => {
  button(name, !!down);
  updateNav();
};

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  Enter: 'a', ' ': 'x', Escape: 'start', Backspace: 'b', o: 'y', p: 'start',
};
addEventListener('keydown', (e) => {
  const n = KEYMAP[e.key];
  if (!n) return;
  e.preventDefault();
  button(n, true);
  updateNav();
});
addEventListener('keyup', (e) => {
  const n = KEYMAP[e.key];
  if (!n) return;
  button(n, false);
  updateNav();
});

const STD = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right'];
const webHeld = new Set();
function pollWebGamepad() {
  if (NATIVE || !navigator.getGamepads) return;
  let gp = null;
  for (const g of navigator.getGamepads()) if (g && g.connected) { gp = g; break; }
  if (!gp) return;
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
  pad.x = dz(gp.axes[0] || 0);
  pad.y = dz(gp.axes[1] || 0);
  STD.forEach((name, i) => {
    if (!gp.buttons[i]) return;
    const down = gp.buttons[i].pressed;
    if (down !== webHeld.has(name)) {
      if (down) webHeld.add(name); else webHeld.delete(name);
      button(name, down);
    }
  });
  updateNav();
}

// Touch on the court: a tap swings; holding a side of the screen moves
// (only matters when the player moves on their own).
export function bindTouch(el) {
  const set = (e) => touch.set(e.pointerId, e.clientX < innerWidth / 2 ? -1 : 1);
  el.addEventListener('pointerdown', (e) => { set(e); fire('tap'); });
  el.addEventListener('pointermove', (e) => { if (touch.has(e.pointerId)) set(e); });
  const end = (e) => touch.delete(e.pointerId);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
}

export function clearInput() {
  held.clear(); touch.clear(); webHeld.clear();
  pad.x = pad.y = pad.hx = pad.hy = pad.lt = pad.rt = 0;
  for (const k in nav) nav[k] = false;
}

export function pollInput() {
  pollWebGamepad();
  let s = pad.x + pad.hx;
  if (held.has('left')) s -= 1;
  if (held.has('right')) s += 1;
  let t = 0;
  for (const v of touch.values()) t += v;
  s += Math.max(-1, Math.min(1, t));
  input.move = Math.max(-1, Math.min(1, s));
}
