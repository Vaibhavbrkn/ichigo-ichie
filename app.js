"use strict";
/* ============================================================ basics */
const $ = (s, r = document) => r.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Q = location.search;
const MUTE = /[?&]mute\b/.test(Q);
const FAST = /[?&]fast\b/.test(Q);
const stage = $("#stage"), txt = $("#txt"), act = $("#act"), bgEl = $("#bg");
function el(tag, cls, html){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
const themeMeta = $('meta[name="theme-color"]');
const setTheme = (c) => { if (c && themeMeta.getAttribute("content") !== c) themeMeta.setAttribute("content", c); };
const SR = () => stage.getBoundingClientRect();
const imgCache = new Map();
function img(name){
  if (!imgCache.has(name)) imgCache.set(name, new Promise((res) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = i.onerror = () => res(i);
    i.src = `img/${name}.webp`;
  }));
  return imgCache.get(name);
}

/* ============================================================ in-app browsers → the real browser */
const UA = navigator.userAgent, ANDROID = /Android/i.test(UA);
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|Twitter/i.test(UA) && !/[?&]stay\b/.test(Q);
if (IN_APP){
  const here = location.host + location.pathname + Q, out = $("#eOut");
  out.href = ANDROID
    ? `intent://${here}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(`https://${here}${Q ? "&" : "?"}stay`)};end`
    : `x-safari-https://${here}`;
  out.textContent = ANDROID ? "Open in Chrome ›" : "Open in Safari ›";
  $("#eWhere").textContent = ANDROID ? "Chrome" : "Safari";
  $("#eIos").innerHTML = ANDROID
    ? "If nothing happens, tap <b>⋮</b> at the top right, then <b>Open in Chrome</b>."
    : "If nothing happens, tap <b>•••</b> at the top right, then <b>Open in external browser</b>.";
  $("#escape").hidden = false;
  $("#eStay").addEventListener("click", () => { $("#escape").hidden = true; quiet(); });
  setTimeout(() => out.click(), 250);
}

/* ============================================================ taps */
/* right after something opens or closes, ignore taps for a moment: the second half of a double-tap,
   or an impatient extra tap, would otherwise land on whatever just appeared under the finger */
let quietT = 0, tapT = -1e9;
const quiet = (ms = 450) => { quietT = Math.max(quietT, performance.now() + ms); };
document.addEventListener("click", (e) => {
  const t = performance.now();
  if (t < quietT || (e.isTrusted && t - tapT < 600)){ e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

/* A phone only makes a click if the finger barely moves and lifts quickly. A tap that slips a little,
   or a slow press, is silently dropped. So taps are read from the touches here, far more forgivingly,
   and the phone's own click is cancelled so nothing fires twice. */
const TAP = "button, [data-tap]";
const LAYER = ".layer, #stage";
const NEAR = [[0, -10], [0, 10], [-10, 0], [10, 0], [-9, -9], [9, -9], [-9, 9], [9, 9]];
const fingers = new Map();
function aim(x, y, n){
  if (n.closest(TAP)) return n;
  for (const [dx, dy] of NEAR){
    const m = document.elementFromPoint(x + dx, y + dy);
    if (m && m.closest(TAP)) return m;
  }
  return n;
}
document.addEventListener("touchstart", (e) => {
  if (e.touches.length === e.changedTouches.length) fingers.clear();
  for (const t of e.changedTouches){
    const n = t.target.closest ? t.target : t.target.parentElement;
    if (!n || n.closest("a[href]")) continue;
    const m = aim(t.clientX, t.clientY, n);
    fingers.set(t.identifier, { n: m, a: m.closest(TAP) || m, x: t.clientX, y: t.clientY, t0: performance.now(), far: false, long: false });
  }
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  for (const t of e.changedTouches){
    const f = fingers.get(t.identifier);
    if (f && Math.hypot(t.clientX - f.x, t.clientY - f.y) > 30) f.far = true;
  }
}, { passive: true });
document.addEventListener("touchend", (e) => {
  for (const t of e.changedTouches){
    const f = fingers.get(t.identifier);
    fingers.delete(t.identifier);
    if (!f || f.far || performance.now() - f.t0 > 2000) continue;
    if (e.cancelable) e.preventDefault();
    tap(f);
  }
}, { passive: false });
document.addEventListener("touchcancel", (e) => {
  for (const t of e.changedTouches){
    const f = fingers.get(t.identifier);
    fingers.delete(t.identifier);
    if (f && f.long && !f.far) tap(f);
  }
}, { passive: true });
/* a slow press turns into a long press: no menu, and it still counts as the tap she meant */
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  fingers.forEach((f) => (f.long = true));
});
function tap(f){
  tapT = performance.now();
  const a = f.a, n = f.n.isConnected ? f.n : a;
  if (!a.isConnected) return;
  const r = a.getBoundingClientRect();
  const x = Math.min(Math.max(f.x, r.left + 1), r.right - 1), y = Math.min(Math.max(f.y, r.top + 1), r.bottom - 1);
  const top = document.elementFromPoint(x, y);
  /* something that opened over it while the finger was down wasn't what she pressed */
  if (!top || !(a.contains(top) || (top.contains(a) && top.closest(LAYER) === a.closest(LAYER)))) return;
  n.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, detail: 1, clientX: x, clientY: y }));
}
/* a button that appears where the last one was waits a moment, so a double tap can't hit it */
function holdBack(b, ms = 800){
  if (!b) return b;
  b.classList.add("wait");
  setTimeout(() => b.classList.remove("wait"), ms);
  return b;
}

/* ============================================================ tap coach: one clear "tap here" at a time */
const coach = $("#coach"), cLbl = $("#coachLbl"), cHand = $("#coachHand");
let cueT = null, cueText = "", cueOpt = {}, cueRaf = 0, cueAt = 0;
function cue(t, text, opt = {}){
  if (!t) return uncue();
  if (t !== cueT) cueAt = performance.now() + (opt.delay || 0);
  cueT = t; cueText = text; cueOpt = opt;
  if (!cueRaf) cueRaf = requestAnimationFrame(coachLoop);
}
function uncue(){
  cueT = null;
  coach.classList.remove("on");
  cancelAnimationFrame(cueRaf); cueRaf = 0;
}
function targetRect(t){
  if (typeof t === "function") t = t();
  if (!t) return null;
  if (t.getBoundingClientRect){
    if (!t.isConnected || !t.getClientRects().length) return null;
    const cs = getComputedStyle(t);
    if (cs.visibility === "hidden" || +cs.opacity === 0 || t.classList.contains("wait")) return null;
    return t.getBoundingClientRect();
  }
  const s = SR(), x = s.left + t.x, y = s.top + t.y, h = t.r || 6;
  return { left: x - h, right: x + h, top: y - h, bottom: y + h, width: 2 * h, height: 2 * h };
}
function coachLoop(){
  cueRaf = requestAnimationFrame(coachLoop);
  const r = cueT && performance.now() >= cueAt ? targetRect(cueT) : null;
  if (!r){ coach.classList.remove("on"); return; }
  if (cLbl.textContent !== cueText) cLbl.textContent = cueText;
  const s = SR(), w = coach.offsetWidth, h = coach.offsetHeight;
  const cx = r.left + r.width / 2 - s.left;
  let place = cueOpt.place || "below";
  if (place === "below" && r.bottom - s.top + h + 6 > s.height - 8) place = "above";
  if (place === "above" && r.top - s.top - h - 6 < 8) place = "below";
  let y = place === "below" ? r.bottom - s.top + 4 : r.top - s.top - h - 4;
  y = clamp(y, 8, s.height - h - 8);
  const x = clamp(cx - w / 2, 8, s.width - w - 8);
  coach.classList.toggle("above", place === "above");
  cHand.textContent = place === "above" ? "👇" : "👆";
  coach.style.transform = `translate(${x}px, ${y}px)`;
  coach.classList.add("on");
}
/* the "tap to continue" cue sits low and centred, under the words */
const lowPt = () => { const s = SR(); return { x: s.width / 2, y: s.height - 30 }; };

let toastT = 0;
function toast(msg, ms = 2600){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms);
}

/* ============================================================ Android: back goes to the previous page */
let guard = 0, leaveT = 0;
document.addEventListener("click", () => {
  if (guard >= 2) return;
  try { history.pushState({ g: guard + 1 }, ""); guard++; } catch (e) {}
}, true);
addEventListener("popstate", () => {
  guard = Math.max(0, guard - 1);
  if (PAGE > 0){ quiet(); go(PAGE - 1); return; }
  if (performance.now() - leaveT < 2500) return history.go(-(guard + 1));
  leaveT = performance.now();
  toast("Press back again to leave", 2400);
});

/* ============================================================ sound */
let AC = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
function ac(){
  if (MUTE) return null;
  if (!AC){
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    AC = new C();
    master = AC.createGain(); master.gain.value = 1;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4;
    master.connect(comp); comp.connect(AC.destination);
    sfxBus = AC.createGain(); sfxBus.gain.value = .9; sfxBus.connect(master);
    musicBus = AC.createGain(); musicBus.gain.value = .75; musicBus.connect(master);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
const now = () => AC.currentTime;
function tone(f, t, dur, { type = "sine", vol = .1, att = .005, to = 0 } = {}){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + .05);
}
function noise(t, dur, { type = "bandpass", f = 1000, to = 0, q = 1, vol = .1, att = .01 } = {}){
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  fl.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + .05);
}
const bell = (f, t, vol = .05) => [[1, 1, 1.8], [2.76, .3, .7], [5.4, .12, .35]].forEach(([m, a, d]) => tone(f * m, t, d, { vol: vol * a, att: .004 }));
const sfx = {
  page(){ if (ac()) noise(now(), .45, { f: 2600, to: 900, q: .7, vol: .035, att: .08 }); },
  chime(){ if (!ac()) return; const t = now(); [880, 1108.7, 1318.5].forEach((f, k) => bell(f, t + k * .09, .028)); },
  amen(){
    if (!ac()) return; const t = now();
    [293.66, 369.99, 440, 587.33].forEach((f, k) => tone(f, t + k * .05, 3.2, { vol: .045, att: .5 }));
    [1174.7, 1480, 1760, 2349.3].forEach((f, k) => bell(f, t + .4 + k * .12, .022));
  },
  wind(s = 1){ if (!ac()) return; const t = now(); noise(t, 2.6 * s, { f: 260, to: 1500, q: .6, vol: .11 * s, att: .9 * s }); noise(t + .3, 2.2 * s, { type: "highpass", f: 3000, to: 6000, q: .3, vol: .025 * s, att: .8 }); },
  burst(){
    if (!ac()) return; const t = now();
    noise(t, 1.2, { type: "highpass", f: 4000, vol: .05, att: .01 });
    for (let k = 0; k < 9; k++) bell(rnd(1400, 3400), t + k * .06 + rnd(0, .03), .02);
    tone(220, t + .1, 3, { vol: .05, att: .6 }); tone(330, t + .1, 3, { vol: .035, att: .6 });
  },
  brush(){ if (ac()) noise(now(), .5, { type: "lowpass", f: 900, q: .4, vol: .06, att: .12 }); },
  twinkle(){ if (!ac()) return; const t = now(); [1568, 2093, 2637, 3136, 2637].forEach((f, k) => bell(f, t + k * .14, .016)); },
  leaf(){ if (ac()) bell(pick([1174.7, 1318.5, 1480, 1760, 1975.5, 2349.3]), now(), .012); },
};

/* the music: an original piano loop, rendered once in .thanks-build/music.py so a phone never has to build it */
const LOOP_S = 58.182;
const DEC = (() => {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  try { return C ? new C(1, 2, 24000) : null; } catch (e) { return null; }
})();
const songP = DEC && !MUTE
  ? fetch("music.m4a").then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => ab && new Promise((res, rej) => { const p = DEC.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }))
    .catch(() => null)
  : Promise.resolve(null);
const music = {
  on: !MUTE, src: null, gain: null,
  async play(fade = 3){
    if (!this.on || this.src || !ac()) return;
    const b = await songP;
    if (!b || !this.on || this.src) return;
    const src = AC.createBufferSource(), g = AC.createGain(), t = AC.currentTime;
    src.buffer = b; src.loop = true;
    if (b.duration > LOOP_S){ src.loopStart = 0; src.loopEnd = LOOP_S; }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade);
    src.connect(g); g.connect(musicBus); src.start(t + .02);
    this.src = src; this.gain = g;
  },
  stop(sec = .6){
    if (!this.src) return;
    const s = this.src, g = this.gain, t = AC.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + sec);
    try { s.stop(t + sec + .05); } catch (e) {}
    this.src = this.gain = null;
  },
  level(v, sec = 2){ if (musicBus) musicBus.gain.setTargetAtTime(v, AC.currentTime, sec / 3); },
  toggle(){
    this.on = !this.on;
    if (this.on) this.play(.8); else this.stop();
    $("#bMusic").classList.toggle("off", !this.on);
  },
};
$("#bMusic").addEventListener("click", () => { ac(); music.toggle(); toast(music.on ? "♪ Music on" : "Music off", 1400); });
document.addEventListener("visibilitychange", () => {
  if (!AC) return;
  if (document.hidden) AC.suspend(); else AC.resume();
});

/* ============================================================ drifting things: leaves, light, wind, rain, stars */
const fx = (() => {
  const cv = $("#fx"), c = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, last = 0, wind = 0;
  const want = { leaves: 0, motes: 0, wind: 0, rain: 0, stars: 0 };
  const L = [], M = [], S = [], R = [], ST = [], P = [];
  const LEAF = ["#e0892f", "#c4562a", "#e8b04a", "#a8402e", "#d9773a", "#8e3b4a"];
  function size(){
    const r = SR(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", size);
  const leaf = (top) => ({ x: rnd(-20, W + 20), y: top ? rnd(-H * .2, -10) : rnd(0, H), r: rnd(5, 9.5), rot: rnd(0, 6.3), vr: rnd(-1.5, 1.5),
    vy: rnd(16, 38), ph: rnd(0, 6.3), sw: rnd(10, 26), col: pick(LEAF), fl: rnd(0, 6.3) });
  const mote = (any) => ({ x: rnd(0, W), y: any ? rnd(0, H) : H + rnd(0, 30), r: rnd(.9, 2.6), vy: rnd(-24, -8), ph: rnd(0, 6.3), vx: rnd(-5, 5) });
  const streak = () => ({ x: rnd(-W * .7, -40), y: rnd(H * .05, H * .95), len: rnd(90, 240), sp: rnd(320, 720), amp: rnd(6, 18), ph: rnd(0, 6.3), w: rnd(.8, 2), a: rnd(.25, .55) });
  const drop = () => ({ x: rnd(-40, W + 40), y: rnd(-H, 0), len: rnd(12, 24), v: rnd(620, 900) });
  function set(o = {}){ Object.assign(want, { leaves: 0, motes: 0, wind: 0, rain: 0, stars: 0 }, o);
    if (want.stars && !ST.length) for (let i = 0; i < 46; i++) ST.push({ x: rnd(0, W), y: rnd(0, H * .55), r: rnd(.6, 1.7), ph: rnd(0, 6.3), sp: rnd(.8, 2.4) });
    if (!want.stars) ST.length = 0;
    while (L.length < want.leaves * .5) L.push(leaf(false));
    while (M.length < want.motes * .6) M.push(mote(true));
  }
  function burst(x, y, n = 60, cols = ["#fff3c4", "#ffd27a", "#ffb35c", "#ffffff"]){
    for (let i = 0; i < n; i++){
      const a = rnd(0, 6.3), v = rnd(60, 340);
      P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0, ttl: rnd(1, 2.2), r: rnd(1.2, 3.4), col: pick(cols) });
    }
  }
  function frame(t){
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    if (!W) size();
    wind += (want.wind - wind) * Math.min(1, dt * 1.6);
    c.clearRect(0, 0, W, H);
    /* leaves */
    if (L.length < want.leaves && Math.random() < dt * 3) L.push(leaf(true));
    for (let i = L.length - 1; i >= 0; i--){
      const p = L[i];
      p.ph += dt; p.fl += dt * 2.2; p.rot += p.vr * dt * (1 + wind * 3);
      p.x += (Math.sin(p.ph) * p.sw * .06 + wind * 330 * (p.r / 8)) * dt * 3 * (wind > .05 ? 1 : .33);
      p.y += p.vy * dt * (1 - wind * .4);
      if (p.y > H + 20 || p.x > W + 40){ if (L.length > want.leaves) L.splice(i, 1); else Object.assign(p, leaf(true), wind > .3 ? { x: rnd(-60, W * .4), y: rnd(-20, H * .7) } : {}); continue; }
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, .45 + .55 * Math.abs(Math.sin(p.fl)));
      c.globalAlpha = .85; c.fillStyle = p.col;
      c.beginPath(); c.moveTo(-p.r, 0); c.quadraticCurveTo(0, -p.r * .75, p.r, 0); c.quadraticCurveTo(0, p.r * .75, -p.r, 0); c.fill();
      c.globalAlpha = .35; c.strokeStyle = "#5a2a14"; c.lineWidth = .7; c.beginPath(); c.moveTo(-p.r, 0); c.lineTo(p.r, 0); c.stroke();
      c.restore();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "lighter";
    /* rising motes of light */
    if (M.length < want.motes && Math.random() < dt * 6) M.push(mote(false));
    for (let i = M.length - 1; i >= 0; i--){
      const p = M[i];
      p.ph += dt * 2; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.ph) * 6 + wind * 200) * dt;
      if (p.y < -10 || p.x > W + 10){ if (M.length > want.motes) M.splice(i, 1); else Object.assign(p, mote(false)); continue; }
      const a = .45 + .4 * Math.sin(p.ph * 1.3);
      c.fillStyle = `rgba(255,214,140,${a * .22})`; c.beginPath(); c.arc(p.x, p.y, p.r * 3.4, 0, 6.3); c.fill();
      c.fillStyle = `rgba(255,240,200,${a})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill();
    }
    /* wind made visible */
    const ns = Math.round(wind * 26);
    if (S.length < ns && Math.random() < dt * 14) S.push(streak());
    c.lineCap = "round";
    for (let i = S.length - 1; i >= 0; i--){
      const p = S[i];
      p.x += p.sp * dt * (.5 + wind); p.ph += dt * 3;
      if (p.x - p.len > W){ if (S.length > ns) S.splice(i, 1); else Object.assign(p, streak()); continue; }
      c.strokeStyle = `rgba(255,248,232,${p.a * Math.min(1, wind * 1.4)})`; c.lineWidth = p.w;
      c.beginPath();
      for (let k = 0; k <= 12; k++){
        const u = k / 12, x = p.x - p.len * u, y = p.y + Math.sin(p.ph + u * 4) * p.amp * u;
        k ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    /* stars */
    for (const s of ST){
      const a = .35 + .55 * Math.abs(Math.sin(t / 1000 * s.sp + s.ph));
      c.fillStyle = `rgba(255,236,190,${a})`; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.3); c.fill();
    }
    /* sparks from a burst */
    for (let i = P.length - 1; i >= 0; i--){
      const p = P[i];
      p.life += dt; if (p.life > p.ttl){ P.splice(i, 1); continue; }
      p.vx *= 1 - dt * .9; p.vy = p.vy * (1 - dt * .9) + 30 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      c.globalAlpha = 1 - p.life / p.ttl; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    /* rain */
    const nr = want.rain ? 70 : 0;
    if (R.length < nr) R.push(drop());
    c.strokeStyle = "rgba(225,232,255,.32)"; c.lineWidth = 1;
    for (let i = R.length - 1; i >= 0; i--){
      const p = R[i];
      p.y += p.v * dt; p.x += p.v * dt * .12;
      if (p.y > H + 30){ if (R.length > nr) R.splice(i, 1); else Object.assign(p, drop(), { y: rnd(-60, -10) }); continue; }
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.len * .12, p.y - p.len); c.stroke();
    }
  }
  requestAnimationFrame(frame);
  return { set, burst };
})();

/* ============================================================ pages: paintings, words and taps */
let GEN = 0, PAGE = -1, skipFn = null, anyTap = null;
const pend = new Set();
const ABORT = Symbol("page changed");
/* every wait on a page goes through here, so going back mid-page stops the old page cleanly */
function gate(setup){
  const g = GEN;
  return new Promise((res) => {
    let undo = null, fin = false;
    const done = (v) => { if (fin) return; fin = true; pend.delete(done); if (undo) undo(); res(v); };
    pend.add(done);
    undo = setup(done) || null;
    if (fin && undo) undo();
  }).then((v) => { if (g !== GEN) throw ABORT; return v; });
}
const pause = (ms) => gate((done) => { const t = setTimeout(done, FAST ? ms / 6 : ms); return () => clearTimeout(t); });
const readMs = (html) => clamp(1700 + html.replace(/<[^>]+>/g, "").length * 46, 2300, 6400);
/* a line stays for as long as it takes to read; a tap moves on sooner */
function hold(ms){
  return gate((done) => {
    const t0 = performance.now();
    const t = setTimeout(done, FAST ? ms / 6 : ms);
    const mine = () => { if (performance.now() - t0 > 500) done(); };
    skipFn = mine;
    return () => { clearTimeout(t); if (skipFn === mine) skipFn = null; };
  });
}
function waitTap(target, label, { anywhere = false, place, delay = 0, cueOn } = {}){
  return gate((done) => {
    const armT = performance.now() + delay;
    const go = (e) => { if (performance.now() >= armT) done(e); };
    if (target) target.addEventListener("click", go);
    if (anywhere) anyTap = go;
    if (label) cue(cueOn || target, label, { place, delay });
    return () => { if (target) target.removeEventListener("click", go); if (anyTap === go) anyTap = null; uncue(); };
  });
}
/* taps on the open page skip ahead, or do the one thing the page is waiting for */
stage.addEventListener("click", (e) => {
  if (e.target.closest("#start, #escape, #top")) return;
  if (anyTap) return anyTap(e);
  if (skipFn) skipFn();
});
const next = (label = "Tap to continue") => waitTap(null, label, { anywhere: true, cueOn: lowPt, place: "above", delay: 650 });

function put(html, cls = ""){ const p = el("p", `ln ${cls}`, html); txt.append(p); return p; }
const say = (html, cls = "", ms) => { put(html, cls); return hold(ms || readMs(html)); };
async function clear(){
  if (!txt.children.length) return;
  txt.classList.add("out");
  await pause(560);
  txt.replaceChildren(); txt.classList.remove("out");
}
function button(label, cls = ""){
  const b = el("button", `pbtn ${cls}`, label);
  b.type = "button";
  act.replaceChildren(b); stage.classList.add("hasAct");
  return holdBack(b, 900);
}
function dropButton(){ act.replaceChildren(); stage.classList.remove("hasAct"); }

let curBg = "", curPic = null;
function scene({ bg, theme = "dark", pos = "bottom", at = "50% 50%", tc } = {}){
  stage.classList.remove("dark", "ink", "pos-bottom", "pos-top", "pos-center");
  stage.classList.add(theme, `pos-${pos}`);
  setTheme(tc || (theme === "ink" ? "#efe2cf" : "#24121f"));
  if (bg && bg !== curBg) setBg(bg, at);
}
function setBg(name, at){
  curBg = name;
  const p = el("div", "pic");
  p.style.backgroundImage = `url(img/${name}.webp)`;
  p.style.backgroundPosition = at;
  p.dataset.at = at;
  curPic = p;
  img(name).then(() => {
    if (curPic !== p) return;
    bgEl.append(p);
    void p.offsetWidth;
    p.classList.add("on");
    setTimeout(() => { if (curPic === p) [...bgEl.children].forEach((c) => c !== p && c.remove()); }, 1800);
  });
  return p;
}
/* a point on the painting (0..1 of its width and height) in page pixels, through background-size: cover */
function onPic(u, v){
  const s = SR(), k = Math.max(s.width / 720, s.height / 1080), dw = 720 * k, dh = 1080 * k;
  const [ax, ay] = (curPic.dataset.at || "50% 50%").split(" ").map((x) => parseFloat(x) / 100);
  return { x: (s.width - dw) * ax + u * dw, y: (s.height - dh) * ay + v * dh };
}
function mark(cls, u, v){
  const { x, y } = onPic(u, v), m = el("i", cls);
  m.style.left = `${x}px`; m.style.top = `${y}px`;
  curPic.append(m);
  return m;
}
/* the same, but above the veils, following the painting's slow zoom */
function glowAt(cls, u, v){
  const s = SR(), p = onPic(u, v), k = new DOMMatrix(getComputedStyle(curPic).transform).a || 1;
  const m = el("i", `gl ${cls}`);
  m.style.left = `${s.width / 2 + (p.x - s.width / 2) * k}px`;
  m.style.top = `${s.height / 2 + (p.y - s.height / 2) * k}px`;
  stage.append(m);
  return m;
}

/* ---------- 1. before we begin ---------- */
async function pOpen(){
  scene({ bg: "w01-window", at: "40% 50%" });
  fx.set({ leaves: 7 });
  put("Before we begin", "kick");
  await say("I know Thanksgiving isn't really an Indian thing.");
  await say("No turkey. No parade. Nobody here has ever made pumpkin pie on purpose.");
  await next();
  await clear();
  await say("But it kicks off the winter holiday season,");
  await say("and that's the most important time of the year for you.");
  await next();
  await clear();
  await say("So it felt like the right day to say something I don't say enough.", "", 3800);
  await say("Thank you.", "big", 2600);
  await say("For being there. For being you. For being in my life.", "it");
  await next();
}

/* ---------- 2. a grace ---------- */
async function pGrace(){
  scene({ bg: "w02-grace" });
  fx.set({ motes: 26 });
  put("A grace", "kick");
  await say("Dear God,", "mid", 2200);
  await say("thank you for making her. You took your time, and it shows.");
  await say("Thank you for her kindness, and for a heart that's somehow bigger than her to-do list.");
  await next();
  await clear();
  await say("Thank you for letting our paths cross, out of all the paths in the world.");
  await say("She really is your own child. Your favourite, I'm fairly sure.");
  await say("Honestly, I don't blame you.", "it", 2600);
  const b = button("Amen 🙏", "gold");
  await waitTap(b, "Tap to say Amen", { anywhere: true, place: "below", delay: 500 });
  sfx.amen(); buzz(30);
  const r = b.getBoundingClientRect(), s = SR();
  fx.burst(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, 70);
  fx.set({ motes: 60 });
  dropButton();
  await clear();
  await say("Amen.", "big", 2600);
}

/* ---------- 3. kaun ho tum ---------- */
const KAUN = [
  ["Ek baar dekhne ke baad,<br>ek baar phir se dekhne ka mann kare", "The face I want to see again, the moment I've seen it. That's you."],
  ["Jiski ek muskaan se<br>poora din ban jaaye", "The one whose smile can make my whole day. That's you."],
  ["Jisse baat karte karte<br>waqt ka pata hi na chale", "The one I talk to and lose all track of time. That's you."],
  ["Bheed mein bhi<br>jo sabse alag dikhe", "The one who stands out, even in a crowd. That's you."],
  ["Jiske liye dua maangne ka mann kare,<br>apne liye nahi", "The one I'd rather pray for than pray for myself. That's you."],
];
async function pKaun(){
  scene({ bg: "w00-paper", theme: "ink", pos: "center" });
  fx.set({ leaves: 4 });
  await say("Kaun ho tum?", "big", 2400);
  for (const [hi, en] of KAUN){
    await clear();
    put(hi, "hi");
    await pause(1100);
    put("woh ho tum.", "re");
    await pause(700);
    await say(en, "en", 3400);
  }
  await next();
  await clear();
  await say("Woh ho tum, Jess.", "big", 2600);
}

/* ---------- 4. any shape ---------- */
async function pShape(){
  scene({ bg: "w00-paper", theme: "ink", pos: "center" });
  fx.set({});
  put("Any shape", "kick");
  await say("Here's something I know for sure.", "it", 2600);
  await say("I'd have liked you even if you were a man.");
  await clear();
  scene({ bg: "w03-tree", theme: "ink", pos: "top" });
  fx.set({ leaves: 8 });
  await say("I'd have liked you if you were a tree.", "", 3200);
  await clear();
  scene({ bg: "w04-wind" });
  fx.set({ leaves: 26, wind: 1 });
  sfx.wind(1.2);
  await say("And if you were the wind,", "", 2400);
  await say("I'd have been completely nuts about you.", "mid", 3600);
  await next();
  await clear();
  fx.set({});
  scene({ bg: "w00-paper", theme: "ink", pos: "bottom" });
  const f = el("button", "frame", "<b>Jess</b>");
  f.type = "button";
  stage.append(f);
  await pause(900);
  await say("But you're you.", "it", 2200);
  await say("And you're far too precious to be held in such a small frame, in such a small space.");
  await waitTap(f, "Tap the frame", { anywhere: true, place: "below", delay: 300 });
  f.classList.add("burst");
  sfx.burst(); buzz([20, 40, 20]);
  const r = f.getBoundingClientRect(), s = SR();
  fx.burst(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, 110);
  await clear();
  scene({ bg: "w00-paper", theme: "ink", pos: "center" });
  stage.classList.add("flood");
  fx.set({ leaves: 12 });
  await pause(1300);
  f.remove();
  await say("I want the whole world to be Jess.", "mid", 3200);
  await say("I want everyone to experience Jessness.", "it", 3400);
  await next();
}

/* ---------- 5. destiny ---------- */
const SEARCH = [
  ["w05-birds", "I'd look for you in the birds, so nonchalant up in the air.", {}],
  ["w06-waited", "I'd look for you in the places where I waited for you.", { motes: 10 }],
  ["w07-strangers", "In every stranger's smile that somehow reminds me of you.", { leaves: 5 }],
  ["w08-rain", "In the raindrops.", { rain: 1 }],
  ["w09-autumn", "In an autumn view.", { leaves: 12 }],
  ["w10-palace", "In palaces I've never been to, hoping they would lead me to you.", { motes: 14 }],
];
async function pDestiny(){
  scene({ bg: "w16-destiny", theme: "ink", pos: "top" });
  fx.set({ leaves: 5 });
  put("Destiny", "kick");
  await say("I think meeting you was written in destiny.");
  await say("Otherwise, I'd still be out there looking for you.");
  await say("There's no going back now.", "it", 2800);
  await next();
  await clear();
  await say("And if I had never found you…", "mid", 3000);
  for (const [bg, line, f] of SEARCH){
    await clear();
    scene({ bg, at: bg === "w07-strangers" ? "38% 50%" : "50% 50%" });
    fx.set(f);
    await pause(700);
    await say(line, "", readMs(line) + 900);
  }
  await clear();
  scene({ bg: "w11-world" });
  fx.set({ wind: .8, leaves: 18 });
  sfx.wind(1);
  await say("And if I couldn't find you anywhere,", "", 3000);
  await say("I'd become the wind itself, and search for you everywhere.", "mid", 4600);
  await next();
}

/* ---------- 6. ichigo ichie ---------- */
async function pIchigo(){
  scene({ bg: "w17-tea", theme: "ink", pos: "top", at: "30% 50%" });
  fx.set({});
  put("Ichigo ichie", "kick");
  await say("There's a phrase that comes from the Japanese tea ceremony.", "", 3400);
  await clear();
  put([..."一期一会"].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join(""), "kanji");
  for (let i = 0; i < 4; i++) setTimeout(() => sfx.brush(), (FAST ? 0 : i * 800) + 80);
  await pause(3600);
  await say("Ichigo ichie.", "big", 2400);
  await say("One time, one meeting.", "it", 2600);
  await say("A once-in-a-lifetime encounter. It never comes around the same way twice.");
  await next();
  [...txt.children].slice(1).forEach((n) => n.remove());
  await say("That's you.", "mid", 2400);
  await say("You're my ichigo ichie. My once-in-a-lifetime encounter.");
  await next();
}

/* ---------- 7. a secret ---------- */
async function pSecret(){
  scene({ bg: "w12-moon", at: "50% 40%" });
  fx.set({ stars: 1 });
  put("A secret", "kick");
  await say("Can I tell you a secret?", "mid", 2400);
  await say("I've never told anyone.", "it", 2200);
  const b = button("Tell me");
  await waitTap(b, "Tap to hear it", { anywhere: true, place: "below", delay: 400 });
  dropButton();
  await clear();
  await say("The person I am with you,", "", 2400);
  await say("nobody has ever met.", "", 2600);
  await say("Not even me.", "mid", 3000);
  await next();
  await clear();
  scene({ bg: "w12-moon", pos: "center" });
  const g = glowAt("wglow", .765, .735), d = mark("mdim", .285, .19);
  await say("And I think the moon envies the way you light up my sky.", "mid", 1200);
  g.classList.add("on"); d.classList.add("on");
  sfx.twinkle();
  await hold(4200);
  await next();
}

/* ---------- 8. never nonchalant ---------- */
async function pCare(){
  scene({ bg: "w14-care" });
  fx.set({ motes: 12 });
  put("Never nonchalant", "kick");
  await say("People think it's cool to be nonchalant.");
  await say("I think it's really cool to care a lot.", "mid", 3200);
  await next();
  await clear();
  for (const l of ["To send text after text.", "To want to meet again, and again, and again.", "To be a little obsessed.",
    "To send long messages.", "To remember the small things.", "To want to do things for them."]){
    await say(l, "list", 1900);
  }
  await say("(For me, “them” is only you.)", "it", 3000);
  await next();
  await clear();
  await say("So I'll never be nonchalant with you.", "mid", 3200);
  await say("I want to be honest, and I want you to know how much you mean to me,");
  await say("in this short time we get on planet Earth.", "", 3000);
  await say("Kal ho na ho.", "big", 3400);
  await next();
}

/* ---------- 9. the honest part: calm, no effects ---------- */
async function pHonest(){
  scene({ bg: "w15-bridge", tc: "#2b3240" });
  fx.set({});
  music.level(.42, 3);
  put("The honest part", "kick");
  await say("All that being said, I know you have your own life.", "plain");
  await say("And I know you might not feel the same way. Honestly, I think you don't.", "plain");
  await say("That's okay. I just wanted you to know how much you mean to me.", "plain");
  await next();
  await clear();
  await say("I like doing things for you. And the important part is this:", "plain");
  await say("I don't expect anything in return. Everything I do comes from the heart.", "plain");
  await next();
  await clear();
  await say("You once told me I have attachment issues.", "plain");
  await say("Funny thing is, my whole life I've been detached from everything. I've told you that before.", "plain");
  await say("With you, I'm attached.", "plain");
  await say("If that scares you, don't worry. I'll shake it off.", "plain");
  await next();
  await clear();
  await say("Here's what my detachment will look like:", "plain");
  await say("I won't expect anything. I'll just do what comes from my side, all of it.", "plain");
  await say("It's one-directional. You never have to reciprocate.", "plain");
  await say("I'll adore you from afar, from my delulu land, somewhere deep in my subconscious, far away from everything.", "plain");
  await next();
  await clear();
  await say("So whatever I send you or do for you, you don't owe me a reply, a plan, or a meeting.", "plain");
  await say("It's your life and your choices. I never want you to feel pressured. If you ever want to, you will.", "plain");
  await next();
  await clear();
  await say("I know we're a bit of a textbook anxious–avoidant pair.", "plain");
  await say("I overthink and hold on. You need your space. Neither of those is wrong.", "plain");
  await say("They say people like us should meet in the middle.", "plain");
  await say("I'll come all the way to your side instead. You'll never have to compromise because of me.", "plain");
  await next();
}

/* ---------- 10. about you: a bare tree fills with leaves, one line at a time ---------- */
const LEAVES = (() => {
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = [];
  while (out.length < 60){
    const a = r() * 6.283, d = Math.sqrt(.15 + .85 * r());
    const u = .5 + Math.cos(a) * d * .33, v = .36 + Math.sin(a) * d * .24;
    if (v < .58) out.push([u, v, r(), r()]);
  }
  return out;
})();
const LEAF_COL = [["#f0a548", "#c8612a"], ["#e8bf55", "#d0832f"], ["#d9653a", "#9e3a2a"], ["#e58a62", "#b44a3c"], ["#c97a8a", "#8e3b4a"], ["#f2c06a", "#e08a3a"]];
let leafI = 0;
function leaves(n, gap = 140){
  for (let k = 0; k < n && leafI < LEAVES.length; k++){
    const [u, v, a, b] = LEAVES[leafI++], [c1, c2] = LEAF_COL[Math.floor(b * LEAF_COL.length)];
    const m = mark("leaf", u, v);
    m.style.setProperty("--r", `${Math.round(a * 140 - 70)}deg`);
    m.style.setProperty("--s", (.8 + b * .6).toFixed(2));
    m.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    setTimeout(() => { m.classList.add("on"); sfx.leaf(); }, (FAST ? 20 : gap) * k + 60);
  }
}
async function pPraise(){
  scene({ bg: "w18-branch", theme: "ink", pos: "bottom" });
  fx.set({});
  curPic.querySelectorAll(".leaf").forEach((l) => l.remove());
  leafI = 0;
  const line = (html, n, cls = "sm", ms) => { leaves(n); return say(html, cls, ms); };
  put("About you", "kick");
  await pause(1200);
  await line("Before I go, a few things about you that you should hear more often.", 3);
  await line("You're beautiful. Honestly, that's the least interesting thing about you.", 4);
  await line("You're kind without ever making a show of it. People just feel lighter around you.", 4);
  await next();
  await clear();
  await line("A chartered accountant, a Bharatanatyam dancer, a black belt. And still the gentlest person in the room.", 5);
  await line("You carry a full plate and a new role, and you still make time for the people you love.", 4);
  await line("You love your family with your whole heart: Amma, Appa, your brother, and of course Brianna.", 5);
  await next();
  await clear();
  await line("You're brave, you're funny, and you make ordinary days feel like the holidays.", 5);
  await line("And you have no idea how rare you are.", 4, "it sm");
  await next();
  await clear();
  leaves(LEAVES.length, 70);
  fx.set({ leaves: 8 });
  await say("If I'm thankful for one thing this year, it's you.", "mid", 3600);
  await say("Thank you, God, for your favourite child.", "", 3200);
  await say("Happy Thanksgiving, Jess.", "big", 3000);
  await next();
}

/* ---------- 11. only her, and thank you ---------- */
async function pEnd(){
  stage.classList.add("white");
  fx.set({});
  await pause(1100);
  scene({ bg: "w13-jess", theme: "ink", pos: "top", at: "80% 50%", tc: "#f3d9b8" });
  music.level(.8, 4);
  await pause(1700);
  stage.classList.remove("white");
  fx.set({ leaves: 7 });
  sfx.chime();
  await pause(2000);
  put("Thank you,<br><em>Jess</em>", "huge");
  await pause(5000);
  const end = el("div", "endbox");
  end.append(el("div", "ps", "<b>P.S.</b> Completely unrelated: I've asked my manager if a transfer to Bangalore is possible."));
  stage.append(end);
  await pause(2400);
  const again = el("button", "pbtn ghost again", "Read it again ↺");
  again.type = "button";
  end.append(holdBack(again, 900));
  await waitTap(again, "", { delay: 900 });
  sfx.page();
  go(0);
}

const PAGES = [pOpen, pGrace, pKaun, pShape, pDestiny, pIchigo, pSecret, pCare, pHonest, pPraise, pEnd];
const dots = $("#dots");
PAGES.forEach(() => dots.append(el("i")));

function go(i){
  GEN++;
  for (const f of [...pend]) f();
  PAGE = i;
  skipFn = anyTap = null;
  uncue();
  txt.replaceChildren(); txt.classList.remove("out");
  dropButton();
  stage.querySelectorAll(".frame, .endbox, .gl").forEach((f) => f.remove());
  stage.classList.remove("flood", "white");
  if (PAGES[i] !== pHonest) music.level(.75, 2);
  [...dots.children].forEach((d, k) => { d.classList.toggle("on", k === i); d.classList.toggle("done", k < i); });
  quiet(500);
  if (i > 0) sfx.page();
  PAGES[i]().then(() => { if (PAGE === i && i + 1 < PAGES.length) go(i + 1); }, (e) => { if (e !== ABORT) console.error(e); });
}

/* ============================================================ start */
(function start(){
  const d = new Date(), y = d.getFullYear();
  const first = new Date(y, 10, 1), tday = 1 + ((4 - first.getDay() + 7) % 7) + 21;
  if (d.getMonth() === 10 && d.getDate() === tday) $("#sKick").textContent = "Happy Thanksgiving";
  scene({ bg: "w01-window", at: "40% 50%" });
  fx.set({ leaves: 5 });
  const open = $("#bOpen");
  const m = Q.match(/[?&]at=(\d+)/), at = m ? clamp(+m[1] - 1, 0, PAGES.length - 1) : 0;
  cue(open, "Tap to open", { place: "above", delay: 1400 });
  open.addEventListener("click", () => {
    uncue();
    ac(); music.play(3); buzz(15);
    $("#start").classList.add("gone");
    $("#top").classList.add("on");
    setTimeout(() => $("#start").remove(), 1100);
    go(at);
  }, { once: true });
  /* the rest of the paintings load quietly in order while she reads */
  ["w02-grace", "w00-paper", "w03-tree", "w04-wind", "w16-destiny", "w05-birds", "w06-waited", "w07-strangers", "w08-rain",
    "w09-autumn", "w10-palace", "w11-world", "w17-tea", "w12-moon", "w14-care", "w15-bridge", "w18-branch", "w13-jess"]
    .reduce((p, n) => p.then(() => img(n)), img("w01-window"));
})();
