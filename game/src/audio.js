// All sounds are synthesised, so there are no audio files to ship.
let ctx = null, master = null, noiseBuf = null;
let soundOn = true, paused = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended' && !paused) ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch (e) {
    return;
  }
  master = ctx.createGain();
  master.gain.value = soundOn ? 0.8 : 0;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function pauseAudio(p) {
  paused = p;
  if (!ctx) return;
  if (p) ctx.suspend();
  else ctx.resume();
}

export function setSound(on) {
  soundOn = on;
  if (master) master.gain.value = on ? 0.8 : 0;
}

function tone(freq, start, dur, type = 'square', vol = 0.15, slideTo = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  const t = ctx.currentTime + start;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.setValueAtTime(vol, t + Math.max(0.013, dur - 0.04));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start, dur, vol, type, freq, freqTo = 0, q = 1) {
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime + start;
  f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

export function blip() {
  tone(660, 0, 0.07, 'triangle', 0.2);
}
// Racket on ball.
export function pock(big) {
  tone(big ? 520 : 700, 0, 0.09, 'sine', 0.45, 160);
  noise(0, 0.06, 0.35, 'bandpass', 2200, 0, 2);
}
export function bounce(vol = 1) {
  tone(180, 0, 0.08, 'sine', 0.3 * vol, 90);
}
export function swoosh() {
  noise(0, 0.22, 0.12, 'bandpass', 600, 2600, 3);
}
// The ball machine shooting.
export function fwoomp() {
  noise(0, 0.3, 0.3, 'lowpass', 1800, 200, 1);
  tone(140, 0, 0.18, 'sine', 0.3, 60);
}
export function cheer() {
  noise(0, 1.1, 0.12, 'bandpass', 1400, 900, 0.7);
  const notes = [659, 784, 1047];
  notes.forEach((n, i) => tone(n, i * 0.08, 0.14, 'triangle', 0.16));
}
export function pop() {
  noise(0, 0.15, 0.5, 'highpass', 900, 0, 1);
  tone(900, 0, 0.12, 'square', 0.12, 1800);
}
export function oops() {
  tone(520, 0, 0.18, 'triangle', 0.18, 300);
  tone(420, 0.2, 0.3, 'triangle', 0.18, 520);
}
export function star(i) {
  tone([784, 988, 1319][i] || 1319, 0, 0.35, 'triangle', 0.25);
  tone(([784, 988, 1319][i] || 1319) * 2, 0.05, 0.3, 'sine', 0.08);
}
export function fanfare() {
  const notes = [523, 659, 784, 1047, 784, 1047];
  const times = [0, 0.15, 0.3, 0.45, 0.7, 0.85];
  notes.forEach((n, i) => tone(n, times[i], i === 5 ? 0.6 : 0.16, 'triangle', 0.25));
}
