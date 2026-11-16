'use strict';
/* Signal — the interface. Data rules live in core.js, shared with the sync worker. */
const C = window.SignalCore;
const { MIN, HOUR } = C;
const VERSION = '2.0';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const TYPES = { signal: 'Signal', upkeep: 'Upkeep', noise: 'Noise' };
const KEY = 'signal.v2', OLD_KEY = 'signal.v1', LKEY = 'signal.local';
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tz = () => S.settings.tz;
const clock = ts => C.clock(ts, tz());
const dur = C.dur;
const stopwatch = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${C.pad(Math.floor(s / 60) % 60)}:${C.pad(s % 60)}`; };
const fmtHour = h => { h = ((h % 24) + 24) % 24; return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };
const fmtMinOfDay = m => { const h = Math.floor(m / 60) % 24, mi = Math.round(m % 60); return `${h % 12 || 12}:${C.pad(mi)} ${h < 12 ? 'AM' : 'PM'}`; };
const dayLabel = (key, opts) => { const [y, m, d] = C.parseKey(key); return new Date(y, m - 1, d).toLocaleDateString([], opts || { weekday: 'short', month: 'short', day: 'numeric' }); };

/* ---------- icons (24px line icons, Humanizer's stroke style) ---------- */
const ICONS = {
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  grad: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  utensils: '<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>',
  car: '<path d="M5 17H3a1 1 0 0 1-1-1v-4a2 2 0 0 1 .3-1l1.7-3a2 2 0 0 1 1.7-1h9.2a2 2 0 0 1 1.6.8L20 11l1.2.4A2 2 0 0 1 22 13.3V16a1 1 0 0 1-1 1h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  gamepad: '<path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.4l-1.4 8.4A2.5 2.5 0 0 0 4.9 20c.7 0 1.3-.3 1.8-.8L9 17h6l2.3 2.2c.5.5 1.1.8 1.8.8a2.5 2.5 0 0 0 2.5-3.2l-1.4-8.4A4 4 0 0 0 17.3 5z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6M19 3l3 3"/>',
  leak: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
  sunrise: '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  gap: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  download: '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 21h14"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  nfc: '<path d="M6 8.5a6 6 0 0 1 0 7"/><path d="M9.5 6a10 10 0 0 1 0 12"/><path d="M13 3.5a14 14 0 0 1 0 17"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  widget: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  edit: '<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
};
const ACT_ICONS = ['layers', 'clipboard', 'grad', 'pencil', 'code', 'wrench', 'bolt', 'book', 'dumbbell', 'sun', 'utensils', 'car', 'home', 'bag', 'users', 'phone', 'play', 'gamepad', 'chat', 'tv', 'moon', 'cloud', 'target', 'spark', 'music', 'heart', 'briefcase', 'pin', 'flag', 'alarm', 'leak', 'dots'];
const ico = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.dots}</svg>`;
const shareIcon = `<span class="share-ic">${ico('share', 16)}</span>`;

/* ---------- state ---------- */
function loadState() {
  try { const n = C.normalize(JSON.parse(localStorage.getItem(KEY))); if (n) return n; } catch (e) { /* none yet */ }
  try { const o = C.normalize(JSON.parse(localStorage.getItem(OLD_KEY))); if (o) return o; } catch (e) { /* none */ }
  return C.fresh();
}
let S = loadState();
let L = { sync: null, onboarded: false, installDismissed: false, hits: {}, lastSync: 0, lastBackup: 0, ignoreGaps: {}, recipeApp: 'instagram' };
try { Object.assign(L, JSON.parse(localStorage.getItem(LKEY)) || {}); } catch (e) { /* defaults */ }
if (S.settings.tz !== C.DEVICE_TZ) { S.settings = { ...S.settings, tz: C.DEVICE_TZ, u: Date.now() }; }
let rev = 0;
function save({ sync = true } = {}) {
  rev++;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked: keep going in memory */ }
  if (sync) scheduleSync();
}
function saveL() { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (e) { /* ignore */ } }

/* Stats for past days don't change with the clock, so cache them until the data changes. */
const statCache = new Map(); let statRev = -1;
function statsFor(key, now = Date.now()) {
  if (key === C.dayKey(now, tz())) return C.dayStats(S, key, now);
  if (statRev !== rev) { statCache.clear(); statRev = rev; }
  if (!statCache.has(key)) statCache.set(key, C.dayStats(S, key, now));
  return statCache.get(key);
}

/* Every change goes through here: it saves, redraws, syncs, and offers Undo.
   Undo writes fresh edits (newer timestamps) instead of rewinding, so it also wins on other devices. */
function mutate(fn, opts = {}) {
  const beforeLogs = S.logs.map(l => ({ ...l })), beforeCur = S.current ? { ...S.current } : null, beforeDays = JSON.parse(JSON.stringify(S.days));
  const r = fn() || {};
  save(); render();
  const msg = opts.msg || r.msg;
  if (msg && !opts.silent) toast(msg, opts.undo === false ? null : () => revert(beforeLogs, beforeCur, beforeDays));
  return r;
}
function revert(beforeLogs, beforeCur, beforeDays) {
  const now = Date.now(), prev = new Map(beforeLogs.map(l => [l.id, l]));
  for (const l of [...S.logs]) if (!prev.has(l.id)) C.deleteLog(S, l.id, now);
  for (const [id, l] of prev) {
    const cur = S.logs.find(x => x.id === id);
    if (!cur || JSON.stringify(cur) !== JSON.stringify(l)) { S.logs = S.logs.filter(x => x.id !== id); S.logs.push({ ...l, u: now }); delete S.tomb.logs[id]; }
  }
  if (JSON.stringify(S.current) !== JSON.stringify(beforeCur)) { S.current = beforeCur ? { ...beforeCur, u: now } : null; S.currentU = now; }
  for (const k of new Set([...Object.keys(beforeDays), ...Object.keys(S.days)])) {
    if (JSON.stringify(beforeDays[k]) !== JSON.stringify(S.days[k])) S.days[k] = { ...(beforeDays[k] || {}), u: now };
  }
  save(); render(); toast('Undone');
}

/* ---------- feedback: haptics, toast ---------- */
const haptic = (() => {
  let lab;
  return () => {
    try {
      if (navigator.vibrate) { navigator.vibrate(10); return; }
      if (!lab) {   // iOS 18+: toggling a native switch gives a light tap, the only haptic a web app can trigger
        lab = document.createElement('label'); lab.setAttribute('aria-hidden', 'true');
        lab.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
        lab.appendChild(i); document.body.appendChild(lab);
      }
      lab.click();
    } catch (e) { /* no haptics */ }
  };
})();
let toastT, undoFn = null;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">Undo</button>' : ''}`;
  undoFn = undo || null;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.classList.remove('show'); undoFn = null; }, undo ? 5200 : 2600);
}
async function copyText(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(label); } catch (er) { toast('Copy failed'); }
    ta.remove();
  }
}

/* ---------- bottom sheet + full-screen overlay ---------- */
let modalOpen = false, modalCtx = {}, pendingRender = false;
function openModal(title, body, foot = '', ctx = {}) {
  modalCtx = ctx;
  const m = $('#modal');
  m.innerHTML = `<span class="grab"></span><div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-act="close" aria-label="Close">${ico('x', 17)}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}`;
  m.style.transform = ''; m.style.transition = '';
  const sc = $('#scrim'); sc.classList.remove('out'); sc.hidden = false;
  modalOpen = true; document.body.style.overflow = 'hidden';
}
function closeModal() {
  if (!modalOpen) return;
  modalOpen = false; modalCtx = {};
  const sc = $('#scrim'); sc.classList.add('out');
  if (!ovOpen) document.body.style.overflow = '';
  setTimeout(() => { if (!modalOpen) { sc.hidden = true; sc.classList.remove('out'); $('#modal').innerHTML = ''; } }, 220);
  if (pendingRender) { pendingRender = false; render(); }
}
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeModal(); });

let ovOpen = null, ovRender = null;
function openOverlay(name, html, rerender) {
  const o = $('#ov'), keep = ovOpen === name ? o.scrollTop : 0;
  o.classList.remove('out');
  o.innerHTML = `<div class="ambient"></div>${html}`;
  o.hidden = false; o.scrollTop = keep;
  ovOpen = name; ovRender = rerender || null;
  document.body.style.overflow = 'hidden';
}
function closeOverlay() {
  if (!ovOpen) return;
  ovOpen = null; ovRender = null;
  const o = $('#ov'); o.classList.add('out');
  document.body.style.overflow = '';
  setTimeout(() => { if (!ovOpen) { o.hidden = true; o.innerHTML = ''; } }, 300);
  render();
}
function softRender() { if (modalOpen) pendingRender = true; else if (ovOpen && ovRender) ovRender(); else render(); }

/* ---------- smart suggestions: what you usually do around this time ---------- */
const FALLBACK = ['homebase', 'canvas', 'study', 'class', 'coding', 'workout', 'ready', 'meals', 'scrolling', 'youtube', 'project', 'reading'];
function suggest(n, { at = Date.now(), types = null, exclude = [] } = {}) {
  const h = C.hourOf(at, tz()), now = Date.now(), score = {};
  for (const l of S.logs) {
    const ageD = (now - l.start) / 864e5;
    if (ageD > 28 || ageD < 0) continue;
    let dh = Math.abs(C.hourOf(l.start, tz()) - h); dh = Math.min(dh, 24 - dh);
    score[l.act] = (score[l.act] || 0) + Math.exp(-ageD / 10) * (0.35 + Math.exp(-(dh * dh) / 4.5)) * Math.min(3, (l.end - l.start) / HOUR + 0.5);
  }
  const rank = id => { const i = FALLBACK.indexOf(id); return i < 0 ? 99 : i; };
  return S.activities.filter(a => (!types || types.includes(a.type)) && !exclude.includes(a.id))
    .sort((x, y) => (score[y.id] || 0) - (score[x.id] || 0) || rank(x.id) - rank(y.id)).slice(0, n);
}

/* ---------- the day ring ---------- */
function arcPath(r, f0, f1) {   // fractions of a turn, clockwise from 12 o'clock
  if (f1 - f0 >= 0.9995) return arcPath(r, f0, f0 + 0.5) + arcPath(r, f0 + 0.5, f0 + 0.9995);
  const a0 = (f0 * 360 - 90) * Math.PI / 180, a1 = (f1 * 360 - 90) * Math.PI / 180;
  return `M${(150 + r * Math.cos(a0)).toFixed(2)} ${(150 + r * Math.sin(a0)).toFixed(2)}A${r} ${r} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${(150 + r * Math.cos(a1)).toFixed(2)} ${(150 + r * Math.sin(a1)).toFixed(2)}`;
}
const polar = (r, f) => { const a = (f * 360 - 90) * Math.PI / 180; return [150 + r * Math.cos(a), 150 + r * Math.sin(a)]; };
function ringSVG(st, o = {}) {
  const now = o.now || Date.now(), R1 = 134, W1 = 15, R2 = 110, W2 = 10;
  const span = Math.max(st.plannedBed, st.end) - st.wake;
  const fr = t => span > 0 ? Math.max(0, Math.min(1, (t - st.wake) / span)) : 0;
  let s = `<svg class="ring${o.sweep ? ' sweep' : ''}${o.flash ? ' flash' : ''}" viewBox="0 0 300 300" aria-hidden="true">`;
  s += `<circle class="r-track" cx="150" cy="150" r="${R1}" stroke-width="${W1}"/>`;
  if (span > 0 && span < 30 * HOUR && o.ticks !== false) {
    const p = C.parts(st.wake, tz());
    for (let t = st.wake - (st.wake % MIN) + (60 - p.mi) * MIN; t < st.wake + span; t += HOUR) {
      const f = fr(t), major = C.parts(t, tz()).h % 6 === 0, r0 = R1 + W1 / 2 + 4, r1 = r0 + (major ? 7 : 4);
      const [x0, y0] = polar(r0, f), [x1, y1] = polar(r1, f);
      s += `<line class="r-tick${major ? ' major' : ''}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
    }
  }
  if (!o.empty) st.gaps.forEach(g => { const f0 = fr(g.s), f1 = fr(g.e); if (f1 - f0 > 0.004) s += `<path class="r-gap" d="${arcPath(R1, f0, f1)}" stroke-width="${W1 - 3}"/>`; });
  st.segs.forEach((g, i) => {
    const f0 = fr(g.s), f1 = fr(g.e); if (f1 - f0 < 0.002) return;
    const pad = f1 - f0 > 0.012 ? 0.0016 : 0;
    s += `<path class="r-seg t-${g.type}" d="${arcPath(R1, f0 + pad, f1 - pad)}" stroke-width="${W1}" pathLength="1" style="--i:${i}"/>`;
  });
  if (st.today && !st.closed && span > 0 && o.nowDot !== false && !o.empty) {
    const [x, y] = polar(R1, fr(now));
    s += `<circle class="r-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/><circle class="r-now" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5"/>`;
  }
  s += `<circle class="r-track" cx="150" cy="150" r="${R2}" stroke-width="${W2}"/>`;
  const rr = Math.min(1, st.ratio);
  if (rr > 0.004) s += `<path class="r-ratio" d="${arcPath(R2, 0, rr)}" stroke-width="${W2}" pathLength="1"/>`;
  const [tx0, ty0] = polar(R2 - 10, st.target / 100), [tx1, ty1] = polar(R2 + 10, st.target / 100);
  s += `<line class="r-target" x1="${tx0.toFixed(1)}" y1="${ty0.toFixed(1)}" x2="${tx1.toFixed(1)}" y2="${ty1.toFixed(1)}"/>`;
  return s + '</svg>';
}
function miniRing(ratio, target) {
  const rr = Math.min(1, ratio), hit = ratio * 100 >= target;
  const [x0, y0] = polar(88, target / 100), [x1, y1] = polar(150, target / 100);
  return `<svg class="mini" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="118" fill="none" stroke="var(--track)" stroke-width="46"/>${rr > 0.004 ? `<path d="${arcPath(118, 0, rr)}" fill="none" stroke="${hit ? 'var(--ok)' : 'color-mix(in srgb, var(--ok) 62%, var(--track))'}" stroke-width="46"/>` : ''}<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="var(--ink)" stroke-width="14" stroke-linecap="round"/></svg>`;
}
function tweenNumber(el, to, from) {
  if (!el) return;
  const start = from != null ? from : Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (start === to || reduced) { el.textContent = `${to}%`; return; }
  const t0 = performance.now(), d = 900;
  const step = t => {
    const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3);
    if (Number(el.dataset.v) !== to) return;
    el.textContent = `${Math.round(start + (to - start) * e)}%`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- Today ---------- */
let tab = 'today', sweepNext = true, lastDayKey = '';
const lastHtml = {};
const expanded = new Set();
function sec(id, html) { lastHtml[id] = html; return `<div id="${id}">${html}</div>`; }
function patch(id, html) {
  if (lastHtml[id] === html) return false;
  lastHtml[id] = html;
  const el = document.getElementById(id);
  if (el) { el.classList.add('noanim'); el.innerHTML = html; }
  return true;
}
const todayKey = (now = Date.now()) => C.dayKey(now, tz());
const started = key => !!(S.days[key] && S.days[key].wake) || C.hasData(S, key);

function headHtml(st, now) {
  const h = C.hourOf(now, tz());
  const g = h < 4 ? ['Still', 'up?'] : h < 12 ? ['Good', 'morning.'] : h < 17 ? ['Good', 'afternoon.'] : h < 22 ? ['Good', 'evening.'] : ['Late', 'night.'];
  return `<div class="head"><p class="eyebrow">${esc(dayLabel(st.key, { weekday: 'long', month: 'short', day: 'numeric' }))} · ${C.isWeekend(st.key) ? 'weekend' : 'weekday'} target ${st.target}%</p><h1 class="greet">${g[0]} <em>${g[1]}</em></h1></div>`;
}
function installHtml() {
  if (!isIOS || standalone || L.installDismissed) return '';
  return `<section class="install"><button class="x" data-act="dismissinstall" aria-label="Dismiss">${ico('x', 16)}</button>
    <h3>Put Signal on your Home Screen</h3><p>It opens full-screen and works offline.</p>
    <ol><li>Tap ${shareIcon} <b>Share</b> in Safari’s toolbar</li><li>Choose <b>Add to Home Screen</b></li><li>Open Signal from the new icon from now on</li></ol>
    <p style="margin-top:8px;font-size:12.5px">Safari and the installed app keep separate data, so log in one place.${L.sync ? '' : ' Sync (in Settings) joins them.'}</p></section>`;
}
function wakeHtml(st) {
  if (st.rec.wake) return '';
  return `<section class="sheet wakecard"><div class="sheet-body"><p class="eyebrow muted">Morning</p><h3 class="serif">When did you get up?</h3>
    <div class="wake-grid"><button class="btn btn-ink" data-act="wake" data-ago="0">${ico('sunrise', 19)}Just now</button>
    <button class="btn" data-act="wake" data-ago="15">15 min ago</button><button class="btn" data-act="wake" data-ago="30">30 min ago</button>
    <button class="btn" data-act="wake" data-ago="60">1 hour ago</button><button class="btn" data-act="waketime">Other time…</button></div>
    <p class="note">${C.hasData(S, st.key) ? `Until you log it, your day starts at an estimated ${clock(st.wake)}.` : `Everything after wake-up counts toward today. Your usual: ${fmtMinOfDay(Number(S.settings.wake.slice(0, 2)) * 60 + Number(S.settings.wake.slice(3)))}.`}</p></div></section>`;
}
function capHtml(st, now) {
  const pr = C.projection(S, st, now), t = st.target;
  let main;
  if (!started(st.key)) main = 'Log your wake-up and the ring starts filling.';
  else if (st.closed) main = `Day closed at <b>${Math.round(st.ratio * 100)}%</b>${st.ratio * 100 >= t ? '. Target hit.' : `, ${t - Math.round(st.ratio * 100)} short of ${t}.`}`;
  else if (pr.state === 'late') main = 'Past your usual bedtime. <b>Wrap up</b> to close the day.';
  else if (st.denom < 10 * MIN) main = `Aim for <b>${dur(pr.target * (st.denom + (pr.remaining || 0)))}</b> of signal before bed to finish at ${t}%.`;
  else if (pr.state === 'ahead') main = `You’ve banked enough for <b>${t}%</b> even if the rest is noise. Keep stacking.`;
  else if (pr.state === 'out') main = `${t}% is out of reach today. Best possible: <b>${Math.round(pr.best * 100)}%</b>. Bank what you can.`;
  else main = `Need <b>${dur(pr.need)}</b> more signal by <b>${clock(st.plannedBed)}</b> to end at ${t}%.`;
  const sub = started(st.key) ? `${st.rec.wake ? 'up' : 'est. up'} ${clock(st.wake)} · ${st.closed ? 'bed ' + clock(st.rec.bed) : 'bed ~' + clock(st.plannedBed)}` : '';
  return `<p class="cap">${main}</p>${sub ? `<p class="cap-sub">${sub}</p>` : ''}`;
}
function deltasHtml(key) {
  const out = [];
  const y = C.shiftKey(key, -1);
  if (C.hasData(S, y)) { const ys = statsFor(y); out.push(`<span class="chip${ys.ratio * 100 >= ys.target ? ' ok' : ''}">Yesterday <b>${Math.round(ys.ratio * 100)}%</b></span>`); }
  const prev = Array.from({ length: 7 }, (_, i) => C.shiftKey(key, -1 - i)).filter(k => C.hasData(S, k));
  if (prev.length >= 2) out.push(`<span class="chip">7-day <b>${Math.round(prev.reduce((a, k) => a + statsFor(k).ratio, 0) / prev.length * 100)}%</b></span>`);
  let streak = 0;
  for (let k = y; C.hasData(S, k) && statsFor(k).ratio * 100 >= statsFor(k).target; k = C.shiftKey(k, -1)) streak++;
  if (streak >= 2) out.push(`<span class="chip ok">${streak}-day streak</span>`);
  const legend = S.logs.length < 25 ? `<div class="legend"><span class="t-signal"><i></i>Signal</span><span class="t-noise"><i></i>Noise</span><span class="t-upkeep"><i></i>Upkeep</span><span><i class="gap"></i>Unlogged</span></div>` : '';
  return (out.length ? `<div class="chips center" style="margin-bottom:12px">${out.join('')}</div>` : '') + legend;
}
function gapHtml(st) {
  if (!started(st.key) || st.closed) return '';
  const g = [...st.gaps].reverse().find(x => x.e - x.s >= 10 * MIN && !L.ignoreGaps[x.s]);
  if (!g) return '';
  const sug = suggest(3, { at: (g.s + g.e) / 2 });
  const q = g.open ? `Since ${clock(g.s)}, what have you been doing?` : `What was ${clock(g.s)} to ${clock(g.e)}?`;
  return `<section class="gapcard"><div class="q"><span>${q}</span><span class="mono">${dur(g.e - g.s)}</span>${g.open ? '' : `<button class="gap-x" data-act="gapignore" data-s="${g.s}" aria-label="Leave it unlogged">${ico('x', 15)}</button>`}</div>
    <div class="chips">${sug.map(a => `<button class="chip t-${a.type}" data-act="gapfill" data-id="${a.id}" data-s="${g.s}" data-e="${g.e}" data-open="${g.open ? 1 : ''}"><span class="ic">${ico(a.icon, 14)}</span>${esc(a.name)}</button>`).join('')}
    <button class="chip ghost" data-act="gapother" data-s="${g.s}" data-e="${g.e}" data-open="${g.open ? 1 : ''}">Other…</button>
    ${g.open ? '' : `<button class="chip ghost" data-act="gapsplit" data-s="${g.s}" data-e="${g.e}">Split…</button>`}</div></section>`;
}
function quickHtml() {
  const cur = S.current && S.current.act;
  const list = suggest(6);
  return `<div class="label-row"><span class="sheet-title">${cur ? 'Switch in one tap' : 'Start in one tap'}</span><button class="link-btn" data-act="start">All activities</button></div>
    <div class="quick">${list.map((a, i) => `<button class="tile t-${a.type}${a.id === cur ? ' cur' : ''}" data-act="${a.id === cur ? 'runsheet' : 'quick'}" data-id="${a.id}" style="animation-delay:${i * 35}ms"><span class="ic">${ico(a.icon, 18)}</span>${esc(a.name)}</button>`).join('')}</div>`;
}
function rowHtml(g, now) {
  const l = g.log, a = g.act;
  const inner = `<span class="when">${clock(g.s)}<br>${l.running ? 'now' : clock(g.e)}</span>
    <span class="what"><span class="ic">${ico(a.icon, 15)}</span><span><span class="nm">${l.running ? '<i class="live"></i>' : ''}${esc(a.name)}</span>${l.tag || l.note ? `<small>${esc([l.tag, l.note].filter(Boolean).join(' · '))}</small>` : ''}</span></span>
    <span class="dur">${dur(g.e - g.s)}</span>`;
  if (l.running) return `<li class="sw"><button class="item t-${a.type}" data-act="runsheet">${inner}</button></li>`;
  return `<li class="sw"><div class="sw-act"><button class="e" data-act="editblock" data-id="${l.id}">${ico('edit', 17)}Edit</button><button class="del" data-act="delblock" data-id="${l.id}">${ico('trash', 17)}Delete</button></div><button class="item sw-front t-${a.type}" data-act="editblock" data-id="${l.id}">${inner}</button></li>`;
}
function gapRowHtml(s, e, open) {
  return `<li class="gaprow"><button class="item gap" data-act="gapother" data-s="${s}" data-e="${e}" data-open="${open ? 1 : ''}"><span class="when">${clock(s)}<br>${open ? 'now' : clock(e)}</span><span class="what"><span class="ic">${ico('gap', 15)}</span><span>Unlogged <span class="fill">· fill</span></span></span><span class="dur">${dur(e - s)}</span></button></li>`;
}
function timelineRows(st, now) {
  const rows = []; let gi = 0;
  const gaps = st.gaps.filter(g => g.e - g.s >= 5 * MIN);
  for (const g of st.segs) {
    while (gi < gaps.length && gaps[gi].s < g.s) { const x = gaps[gi++]; rows.push(gapRowHtml(x.s, x.e, x.open)); }
    rows.push(rowHtml(g, now));
  }
  while (gi < gaps.length) { const x = gaps[gi++]; rows.push(gapRowHtml(x.s, x.e, x.open)); }
  return rows;
}
function listHtml(st, now) {
  if (!started(st.key)) return '';
  const rows = timelineRows(st, now);
  const logged = st.mins.signal + st.mins.noise + st.mins.upkeep;
  return `<section class="sheet"><div class="sheet-head"><span class="sheet-title">Today’s blocks</span><span class="sheet-meta">${st.segs.length} · ${dur(logged)} logged</span></div>
    ${rows.length ? `<ul class="list">${rows.join('')}</ul>` : '<div class="empty-note">No blocks yet. Tap one above to start.</div>'}</section>`;
}
function bedHtml(st) {
  if (!started(st.key)) return '';
  if (st.closed) return `<div class="chips center"><button class="chip" data-act="bedtime">${ico('moon', 14)}Bed <b>${clock(st.rec.bed)}</b></button><button class="chip" data-act="wrapup">See wrap-up</button></div>`;
  return `<button class="btn btn-block btn-go" data-act="wrapup" style="margin-top:2px">${ico('moon', 17)}Wrap up the day</button>`;
}
function renderToday() {
  const now = Date.now(), key = todayKey(now), st = C.dayStats(S, key, now);
  const pct = Math.round(st.ratio * 100), sweep = sweepNext && !reduced; sweepNext = false;
  lastDayKey = key;
  $('#view').innerHTML = sec('s-head', headHtml(st, now)) + `<div class="stack">`
    + sec('s-install', installHtml()) + sec('s-wake', wakeHtml(st))
    + `<section class="ring-sec"><div class="ring-wrap"><div class="ring-svg" id="ringsvg">${ringSVG(st, { now, sweep, empty: !started(key) })}</div>
        <div class="ring-center"><span class="pct${pct >= st.target ? ' hit' : ''}" id="pct" data-v="${pct}">${started(key) ? (sweep ? '0%' : pct + '%') : '—'}</span><span class="pct-label">signal ${st.closed ? 'today' : 'so far'}</span><span class="pct-target">TARGET ${st.target}</span></div></div>`
    + sec('s-cap', capHtml(st, now)) + sec('s-deltas', deltasHtml(key)) + `</section>`
    + sec('s-gap', gapHtml(st)) + sec('s-quick', quickHtml()) + sec('s-list', listHtml(st, now)) + sec('s-bed', bedHtml(st))
    + `</div><footer>Signal ${VERSION} · ${L.sync ? 'synced to your worker' : 'stored on this device'}</footer>`;
  lastHtml.ringsvg = null;
  if (started(key) && sweep) tweenNumber($('#pct'), pct, 0);
  setMood(st); checkHit(st);
}
function liveToday(now) {
  const key = todayKey(now);
  if (key !== lastDayKey) { sweepNext = true; render(); return; }
  const st = C.dayStats(S, key, now), pct = Math.round(st.ratio * 100);
  patch('ringsvg', ringSVG(st, { now, empty: !started(key) }));
  const p = $('#pct');
  if (p && started(key)) { if (Number(p.dataset.v) !== pct) tweenNumber(p, pct); p.classList.toggle('hit', pct >= st.target); }
  patch('s-cap', capHtml(st, now));
  patch('s-gap', gapHtml(st));
  const typing = document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (!typing && !openSw) { patch('s-list', listHtml(st, now)); patch('s-wake', wakeHtml(st)); }
  setMood(st); checkHit(st);
}
function setMood(st) { document.body.dataset.mood = !started(st.key) ? 'idle' : st.ratio * 100 >= st.target ? 'hit' : 'behind'; }
function checkHit(st) {
  if (!st.today || st.closed || st.denom < 2 * HOUR || st.ratio * 100 < st.target || L.hits[st.key]) return;
  L.hits[st.key] = 1;
  for (const k of Object.keys(L.hits)) if (k < C.shiftKey(st.key, -40)) delete L.hits[k];
  saveL();
  const svg = $('#ringsvg svg');
  if (svg) { svg.classList.remove('flash'); void svg.getBBox; svg.classList.add('flash'); }
  haptic(); toast(`${st.target}% reached. Hold the line.`);
}

/* ---------- Now bar (on every tab) ---------- */
let nowbarSig = '';
function renderNowbar(now = Date.now()) {
  const nb = $('#nowbar'), c = S.current;
  document.body.classList.toggle('has-now', !!c);
  if (!c) { nb.hidden = true; nowbarSig = ''; return; }
  const a = C.actOf(S, c), sig = `${c.start}|${c.act}|${c.tag}|${a.name}|${a.icon}`;
  if (sig !== nowbarSig || nb.hidden) {
    nowbarSig = sig;
    nb.className = `nowbar glass t-${a.type}`;
    nb.dataset.act = 'runsheet';
    nb.innerHTML = `<span class="ic">${ico(a.icon, 19)}</span><span style="min-width:0"><span class="nm" style="display:block">${esc(a.name)}</span><span class="sub" style="display:block">${c.tag ? esc(c.tag) + ' · ' : ''}since ${clock(c.start)}</span></span><span class="tm" id="nb-tm">${stopwatch(now - c.start)}</span><button class="btn btn-ink stop" data-act="stop" aria-label="Stop">${ico('stop', 15)}Stop</button>`;
    nb.hidden = false;
  } else { const tm = $('#nb-tm'); if (tm) tm.textContent = stopwatch(now - c.start); }
}

/* ---------- actions ---------- */
function startNow(id, ts) {
  const now = Date.now();
  if (S.current && S.current.act === id && ts == null) { runningSheet(); return; }
  haptic();
  mutate(() => C.startBlock(S, id, ts || now, now));
}
function fillGap(s, e, id) {
  const a = C.findAct(S, id), now = Date.now();
  if (!a) return;
  haptic();
  mutate(() => {
    S.logs.push({ id: uid(), start: s, end: e, act: id, name: a.name, type: a.type, icon: a.icon, note: '', tag: a.tags && a.tags.length ? C.lastTag(S, id) : '', u: now });
    return { msg: `${a.name} · ${dur(e - s)} logged` };
  });
}
function stopNow() {
  if (!S.current) return;
  haptic();
  mutate(() => C.stopBlock(S, Date.now()));
}

/* ---------- modals ---------- */
function pickerModal(mode, ctx = {}) {
  const cur = S.current && S.current.act;
  const at = ctx.s ? (ctx.s + Math.min(ctx.e, Date.now())) / 2 : Date.now();
  const btn = a => `<button class="t-${a.type}${a.id === cur && (mode === 'start' || mode === 'switch') ? ' cur' : ''}" data-act="pick" data-id="${esc(a.id)}" data-name="${esc(a.name.toLowerCase())}"><span class="ic">${ico(a.icon, 16)}</span>${esc(a.name)}</button>`;
  const titles = { start: S.current ? 'Switch to…' : 'What are you doing?', switch: 'Switch to…', log: 'Log a past block', fill: ctx.s ? `What was ${clock(ctx.s)}–${clock(ctx.e)}?` : '', fillopen: ctx.s ? `Since ${clock(ctx.s)}…` : '' };
  const hint = { signal: ' · counts toward your ratio', upkeep: ' · not held against you', noise: '' };
  openModal(titles[mode], `<div class="search">${ico('search', 16)}<input type="search" id="pk-q" placeholder="Search activities" autocomplete="off" enterkeyhint="search"></div>
    <div class="pick-group" id="pk-sug"><h4>${ctx.s ? 'Likely' : 'Suggested now'}</h4><div class="pick">${suggest(6, { at }).map(btn).join('')}</div></div>
    ${['signal', 'upkeep', 'noise'].map(t => `<div class="pick-group t-${t}"><h4><i></i>${TYPES[t]}${hint[t]}</h4><div class="pick">${S.activities.filter(a => a.type === t).map(btn).join('')}</div></div>`).join('')}
    <button class="btn btn-block" data-act="newact">${ico('plus', 15)}New activity</button>`, '', { kind: 'picker', mode, ...ctx });
}
function tagField(a, sel, id = 'f-tag') {
  if (!a || !a.tags || !a.tags.length) return '';
  return `<label class="field"><span>Course</span><select id="${id}"><option value="">None</option>${a.tags.map(t => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}
function actSelect(selected) {
  return `<select id="f-act">${['signal', 'upkeep', 'noise'].map(t => `<optgroup label="${TYPES[t]}">${S.activities.filter(a => a.type === t).map(a => `<option value="${esc(a.id)}"${a.id === selected ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}
function blockModal(logId, ctx = {}) {
  const log = logId ? S.logs.find(l => l.id === logId) : null;
  const now = Date.now();
  const end = log ? log.end : ctx.e || Math.floor(now / MIN) * MIN, start = log ? log.start : ctx.s || end - 30 * MIN;
  const actId = log ? log.act : ctx.act || 'study', a = C.findAct(S, actId);
  openModal(log ? 'Edit block' : ctx.s ? 'Split this gap' : 'Log a past block', `<div class="form">
    <label class="field"><span>Activity</span>${actSelect(actId)}</label>
    <div id="f-tagwrap">${tagField(a, log ? log.tag : C.lastTag(S, actId))}</div>
    <div class="row2"><label class="field"><span>Start</span><input type="time" id="f-start" value="${C.hhmm(start, tz())}"></label>
    <label class="field"><span>End</span><input type="time" id="f-end" value="${C.hhmm(end, tz())}"></label></div>
    <div class="dur-preview" id="f-dur">${dur(end - start)}</div>
    <label class="field"><span>Note (optional)</span><input type="text" id="f-note" placeholder="Problem set 4" value="${esc(log ? log.note || '' : '')}" maxlength="120"></label>
    ${log ? `<p class="note" style="margin:0">${esc(dayLabel(C.dayKey(log.start, tz()), { weekday: 'long', month: 'short', day: 'numeric' }))}</p>` : ''}
  </div>`, `${log ? `<button class="btn btn-danger" data-act="delblock" data-id="${log.id}" aria-label="Delete block">${ico('trash', 16)}</button>` : ''}<button class="btn btn-ink btn-go" data-act="saveblock">Save</button>`,
  { kind: 'block', logId: log ? log.id : '', base: start, fromGap: !!ctx.s });
}
function readBlockTimes() {
  const sv = $('#f-start').value, ev = $('#f-end').value;
  if (!sv || !ev) return null;
  const [sh, sm] = sv.split(':').map(Number), [eh, em] = ev.split(':').map(Number);
  const p = C.parts(Number(modalCtx.base), tz());
  let s = C.fromLocal(p.y, p.m, p.d, sh, sm, tz()), e = C.fromLocal(p.y, p.m, p.d, eh, em, tz());
  if (e <= s) e += 24 * HOUR;
  if (!modalCtx.logId && !modalCtx.fromGap && e > Date.now() + MIN) { s -= 24 * HOUR; e -= 24 * HOUR; }
  return { s, e };
}
function saveBlock() {
  const t = readBlockTimes();
  if (!t) return toast('Set a start and end time');
  if (t.e > Date.now() + MIN) return toast('That block ends in the future');
  const a = C.findAct(S, $('#f-act').value), note = $('#f-note').value.trim(), tag = $('#f-tag') ? $('#f-tag').value : '', now = Date.now();
  const id = modalCtx.logId;
  closeModal();
  mutate(() => {
    const rec = { start: t.s, end: t.e, act: a.id, name: a.name, type: a.type, icon: a.icon, note, tag, u: now };
    if (id) { const i = S.logs.findIndex(x => x.id === id); if (i >= 0) S.logs[i] = { ...S.logs[i], ...rec }; }
    else S.logs.push({ id: uid(), ...rec });
    return { msg: `${a.name} · ${dur(t.e - t.s)} saved` };
  });
}
function runningSheet() {
  const c = S.current; if (!c) return;
  const a = C.actOf(S, c), tags = a.tags || [];
  openModal(`<span style="color:var(--c)" class="t-${a.type}">●</span> ${esc(a.name)}`, `
    <div class="big-timer" id="rs-timer">${stopwatch(Date.now() - c.start)}</div>
    <div class="big-sub">${TYPES[a.type]} · since ${clock(c.start)}</div>
    ${tags.length ? `<div class="field" style="margin-bottom:16px"><span>Course</span><div class="chips">${tags.map(t => `<button class="chip t-${a.type}${c.tag === t ? ' on' : ''}" data-act="settag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}${c.tag ? '<button class="chip ghost" data-act="settag" data-tag="">None</button>' : ''}</div></div>` : ''}
    <div class="form"><label class="field"><span>Note</span><input type="text" id="run-note" placeholder="What exactly?" maxlength="120" value="${esc(c.note || '')}"></label>
    <label class="field"><span>Started at</span><input type="time" id="run-start" value="${C.hhmm(c.start, tz())}"></label></div>`,
  `<button class="btn" data-act="discard" aria-label="Discard block">${ico('trash', 16)}</button><button class="btn" data-act="switch">${ico('swap', 15)}Switch</button><button class="btn btn-ink btn-go" data-act="stop">${ico('stop', 16)}Stop</button>`, { kind: 'running' });
}
function timeModal(kind) {
  const key = todayKey(), rec = S.days[key] || {}, cur = kind === 'wake' ? rec.wake : rec.bed;
  openModal(kind === 'wake' ? 'When did you get up?' : 'When did you go to bed?',
    `<div class="form"><label class="field"><span>${kind === 'wake' ? 'Wake time' : 'Bed time'}</span><input type="time" id="f-time" value="${C.hhmm(cur || Date.now(), tz())}"></label></div>`,
    `${cur ? `<button class="btn btn-danger" data-act="cleartime" data-kind="${kind}" aria-label="Clear">${ico('trash', 16)}</button>` : ''}<button class="btn btn-ink btn-go" data-act="savetime" data-kind="${kind}">Save</button>`, { kind: 'time' });
}
function saveTime(kind) {
  const v = $('#f-time').value;
  if (!v) return toast('Pick a time');
  const now = Date.now();
  let ts = C.atTime(todayKey(now), v, tz());
  if (ts > now + MIN) ts -= 24 * HOUR;
  closeModal();
  if (kind === 'wake') { sweepNext = true; mutate(() => { C.setWake(S, ts, now); return { msg: `Wake time ${clock(ts)}` }; }); }
  else { mutate(() => { C.setBed(S, ts, now); return { msg: `Bed time ${clock(ts)}` }; }); if (ovOpen === 'wrap') closeOverlay(); }
}
function activityModal(id, after) {
  const a = id ? C.findAct(S, id) : { id: '', name: '', type: 'signal', icon: 'target', tags: [] };
  const running = S.current && S.current.act === id;
  openModal(id ? 'Edit activity' : 'New activity', `<div class="form">
    <label class="field"><span>Name</span><input type="text" id="a-name" placeholder="Piano" maxlength="28" value="${esc(a.name)}"></label>
    <div class="field"><span>Counts as</span><div class="seg3">${['signal', 'upkeep', 'noise'].map(t => `<button class="t-${t}" data-act="acttype" data-type="${t}" aria-pressed="${a.type === t}"><i></i>${TYPES[t]}</button>`).join('')}</div></div>
    <div class="field"><span>Icon</span><div class="icons">${ACT_ICONS.map(n => `<button data-act="acticon" data-icon="${n}" aria-pressed="${a.icon === n}" aria-label="${n}">${ico(n, 17)}</button>`).join('')}</div></div>
    <label class="field"><span>Courses or tags (optional)</span><input type="text" id="a-tags" placeholder="ECE 201, MTH 254" value="${esc((a.tags || []).join(', '))}"></label>
    <p class="note" style="margin:-4px 0 0">Tags show up as one-tap chips while the block runs, and History adds up time per tag.</p></div>`,
  `${id ? `<button class="btn btn-danger" data-act="delact" ${running ? 'disabled' : ''} aria-label="Delete activity">${ico('trash', 16)}</button>` : ''}<button class="btn btn-ink btn-go" data-act="saveact">${id ? 'Save' : 'Add'}</button>`,
  { kind: 'act', id, type: a.type, icon: a.icon, after });
}
function saveActivity() {
  const name = $('#a-name').value.trim();
  if (!name) return toast('Give it a name');
  const tags = $('#a-tags').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  const { id, type, icon, after } = modalCtx, now = Date.now();
  let newId = id;
  closeModal();
  mutate(() => {
    if (id) { const i = S.activities.findIndex(x => x.id === id); S.activities[i] = { ...S.activities[i], name, type, icon, tags, u: now }; }
    else {
      newId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';
      while (S.activities.some(x => x.id === newId) || S.tomb.acts[newId]) newId += '-' + Math.random().toString(36).slice(2, 4);
      S.activities.push({ id: newId, name, type, icon, tags, u: now });
    }
    return { msg: id ? 'Activity saved' : `${name} added` };
  }, { undo: false });
  if (after && (after.mode === 'start' || after.mode === 'switch')) startNow(newId);
  else if (after && after.mode) pickerModal(after.mode, after);
}

/* ---------- wrap-up ---------- */
function wrapUp() {
  const now = Date.now(), key = todayKey(now), st = C.dayStats(S, key, now);
  const pct = Math.round(st.ratio * 100), t = st.target, hit = pct >= t;
  const sig = st.segs.filter(g => g.type === 'signal').sort((a, b) => (b.e - b.s) - (a.e - a.s))[0];
  const noiseActs = Object.entries(st.byAct).map(([id, ms]) => ({ a: C.findAct(S, id), ms })).filter(x => x.a && x.a.type === 'noise').sort((a, b) => b.ms - a.ms);
  const leak = noiseActs[0] && noiseActs[0].ms >= st.unlogged ? { name: noiseActs[0].a.name, ms: noiseActs[0].ms } : st.unlogged > 0 ? { name: 'Unlogged time', ms: st.unlogged } : null;
  let verdict;
  if (hit) verdict = pct >= t + 10 ? `<em>${pct}%.</em> Well past ${t}. That’s a real day.` : `<em>${pct}%.</em> Target hit. Do it again tomorrow.`;
  else if (t - pct <= 10) verdict = `<em>${pct}%.</em> ${t - pct} points short. One more block would have done it.`;
  else verdict = `<em>${pct}%.</em> ${leak ? `Most of the gap went to ${esc(leak.name.toLowerCase())}.` : 'Tomorrow, start a block early.'}`;
  if (st.denom > 0 && st.unlogged / st.denom > 0.3) verdict += ` <span style="color:var(--ink-3)">A lot went unlogged, so settle the gaps for an honest score.</span>`;
  const gaps = st.gaps.filter(g => g.e - g.s >= 10 * MIN).slice(-6);
  const settle = gaps.map(g => {
    const e = g.open ? now : g.e, sug = suggest(3, { at: (g.s + e) / 2 });
    return `<div class="settle-row"><div class="q"><span>${clock(g.s)} – ${g.open ? 'now' : clock(e)}</span><span class="mono">${dur(e - g.s)}</span></div><div class="chips">${sug.map(a => `<button class="chip t-${a.type}" data-act="gapfill" data-id="${a.id}" data-s="${g.s}" data-e="${e}"><span class="ic">${ico(a.icon, 14)}</span>${esc(a.name)}</button>`).join('')}<button class="chip ghost" data-act="gapother" data-s="${g.s}" data-e="${e}">Other…</button></div></div>`;
  }).join('');
  openOverlay('wrap', `<div class="wrap ov-in"><button class="icon-btn ov-x" data-act="closeov" aria-label="Close">${ico('x', 17)}</button>
    <p class="eyebrow">Wrap-up · ${esc(dayLabel(key, { weekday: 'long' }))}</p><h1>The day, <em>honestly.</em></h1>
    <div class="ring-wrap" style="width:min(270px,72vw)"><div class="ring-svg">${ringSVG(st, { now, sweep: !reduced, nowDot: false })}</div>
      <div class="ring-center"><span class="pct${hit ? ' hit' : ''}" id="wr-pct">${pct}%</span><span class="pct-label">signal</span><span class="pct-target">TARGET ${t}</span></div></div>
    <p class="verdict">${verdict}</p>
    <div class="chips center" style="margin-bottom:18px"><span class="chip ok"><b>${dur(st.mins.signal)}</b> signal</span><span class="chip t-noise"><i class="d"></i><b>${dur(st.mins.noise)}</b> noise</span><span class="chip warn"><b>${dur(st.unlogged)}</b> unlogged</span><span class="chip t-upkeep"><i class="d"></i><b>${dur(st.mins.upkeep)}</b> upkeep</span></div>
    <div class="two"><div class="mini-card"><small>Best block</small>${sig ? `<b>${esc(sig.act.name)}${sig.log.tag ? ' · ' + esc(sig.log.tag) : ''}</b><span>${dur(sig.e - sig.s)} · ${clock(sig.s)}</span>` : '<b>None yet</b><span>Start with one tomorrow</span>'}</div>
      <div class="mini-card"><small>Biggest leak</small>${leak ? `<b>${esc(leak.name)}</b><span>${dur(leak.ms)}</span>` : '<b>Nothing</b><span>Clean day</span>'}</div></div>
    ${settle ? `<h2 style="font-size:22px;margin:24px 0 10px">Settle the gaps</h2><div class="settle">${settle}</div>` : ''}
    <div style="display:grid;gap:10px;margin-top:26px"><button class="btn btn-ink btn-go btn-block" data-act="goodnight">${ico('moon', 17)}Good night</button>
      <div class="row2"><button class="btn" data-act="bedtime">Went to bed earlier…</button><button class="btn" data-act="closeov">Not yet</button></div></div></div>`, wrapUp);
  if (!reduced) tweenNumber($('#wr-pct'), pct, 0);
}

/* ---------- intercept (opened by an iOS Shortcut when a noise app opens) ---------- */
const APPS = { instagram: ['Instagram', 'instagram://', 'scrolling'], tiktok: ['TikTok', 'snssdk1233://', 'scrolling'], youtube: ['YouTube', 'youtube://', 'youtube'], reddit: ['Reddit', 'reddit://', 'scrolling'], x: ['X', 'twitter://', 'scrolling'], snapchat: ['Snapchat', 'snapchat://', 'texting'] };
function intercept(app, actId) {
  const info = APPS[app] || [app.charAt(0).toUpperCase() + app.slice(1), '', 'scrolling'];
  const act = C.findAct(S, actId) || C.findAct(S, info[2]) || C.findAct(S, 'scrolling');
  const now = Date.now(), st = C.dayStats(S, todayKey(now), now);
  const alt = suggest(1, { types: ['signal'] })[0];
  openOverlay('icept', `<div class="wrap ov-in"><div class="icept">
    <p class="eyebrow">A breath first</p>
    <div class="breath"><span id="br-text">Breathe in</span></div>
    <h1 style="font-size:40px">Open <em>${esc(info[0])}</em>?</h1>
    <p class="lede" style="max-width:340px">Today so far: <b>${dur(st.mins.noise + st.unlogged)}</b> of noise. Signal is at <b>${Math.round(st.ratio * 100)}%</b>, with a target of ${st.target}%.</p>
    <div class="icept-actions" id="icept-actions">
      ${alt ? `<button class="btn btn-ink btn-go" data-act="icept-alt" data-id="${alt.id}">${ico(alt.icon, 17)}Start ${esc(alt.name)} instead</button>` : ''}
      ${L.sync && act ? `<button class="btn btn-go" data-act="icept-allow" data-app="${esc(app)}" data-id="${act.id}">Open ${esc(info[0])} for 10 min</button>` : ''}
      <button class="btn btn-ghost" data-act="closeov">Never mind</button>
      ${L.sync ? '' : '<p class="note" style="text-align:center">Connect sync in Settings so Signal can let you through for 10 minutes without asking again.</p>'}
    </div></div></div>`);
  let n = 0;
  const iv = setInterval(() => { const el = $('#br-text'); if (!el || ovOpen !== 'icept') { clearInterval(iv); return; } el.textContent = ++n % 2 ? 'Breathe out' : 'Breathe in'; }, 2200);
  setTimeout(() => { const el = $('#icept-actions'); if (el) el.classList.add('ready'); }, reduced ? 0 : 3600);
}

/* ---------- onboarding ---------- */
let obStep = 0;
function demoStats() {
  const now = Date.now(), w = now - 9 * HOUR, m = x => w + x * MIN;
  const seg = (s, e, type) => ({ s: m(s), e: m(e), type });
  return { key: todayKey(now), wake: w, end: now, plannedBed: w + 16 * HOUR, today: true, closed: false, ratio: 0.72, target: 80,
    segs: [seg(0, 30, 'upkeep'), seg(35, 180, 'signal'), seg(180, 215, 'noise'), seg(250, 290, 'upkeep'), seg(290, 450, 'signal'), seg(470, 520, 'noise'), seg(520, 540, 'signal')],
    gaps: [{ s: m(215), e: m(250) }, { s: m(450), e: m(470) }], rec: {} };
}
function onboarding(step = 0) {
  obStep = step;
  const dots = `<div class="dots">${[0, 1, 2].map(i => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body;
  if (step === 0) body = `<p class="eyebrow">Welcome to Signal</p><h1>See how much of your day is <em>signal.</em></h1>
    <div class="ob-art"><div class="ring-wrap" style="width:100%;margin:0">${ringSVG(demoStats(), { sweep: !reduced, ticks: false })}<div class="ring-center"><span class="pct">72%</span><span class="pct-label">signal</span></div></div></div>
    <div class="ob-rows"><div class="ob-row t-signal"><i></i><span><b>Signal</b> · Homebase, Canvas, class, coding, working out</span></div>
    <div class="ob-row t-upkeep"><i></i><span><b>Upkeep</b> · getting ready, meals, commute. Not held against you.</span></div>
    <div class="ob-row t-noise"><i></i><span><b>Noise</b> · scrolling, YouTube, games, and any time you don’t log</span></div></div>`;
  else if (step === 1) body = `<p class="eyebrow">The target</p><h1>Weekdays aim for <em>${S.settings.target}%.</em></h1>
    <p class="lede">Your ratio is signal divided by your awake time, minus upkeep. Unlogged time counts as noise, so the number stays honest.</p>
    <div class="sheet" style="margin-top:22px"><div class="sheet-body"><p class="eyebrow muted">Weekend target</p><div class="chips">${[80, 70, 60, 50].map(v => `<button class="chip${S.settings.weekendTarget === v ? ' on' : ''}" data-act="obweekend" data-v="${v}" style="--c:var(--ok)">${v}%</button>`).join('')}</div>
    <p class="note">Weekdays stay at ${S.settings.target}%. You can change either in Settings.</p></div></div>`;
  else body = `<p class="eyebrow">How it works</p><h1>Two taps a day, <em>minimum.</em></h1>
    <div class="ob-rows" style="margin-top:6px"><div class="ob-row t-upkeep"><i></i><span><b>Wake up</b> · tap when you’re up. The ring starts.</span></div>
    <div class="ob-row t-signal"><i></i><span><b>Switch</b> · one tap on a tile whenever you change what you’re doing.</span></div>
    <div class="ob-row t-noise"><i></i><span><b>Fill</b> · forgot? Signal asks about the gap and you answer with one tap.</span></div></div>
    ${isIOS && !standalone ? `<div class="install" style="margin-top:8px"><h3>First, add it to your Home Screen</h3><ol><li>Tap ${shareIcon} <b>Share</b></li><li><b>Add to Home Screen</b></li><li>Open Signal from the icon</li></ol></div>` : `<p class="note">Later, in Settings: connect sync so iOS Shortcuts can log your wake-up, your gym and your noise apps for you.</p>`}`;
  openOverlay('onboard', `<div class="wrap ov-in"><div class="ob-step" key="${step}">${body}</div>
    <div class="ob-foot">${dots}<span class="spacer"></span>${step ? '<button class="btn btn-ghost" data-act="obback">Back</button>' : ''}<button class="btn btn-ink btn-go" data-act="${step < 2 ? 'obnext' : 'obdone'}">${step < 2 ? 'Next' : 'Let’s go'}</button></div></div>`);
}

/* ---------- History ---------- */
function insights(days) {
  const sig = new Array(24).fill(0), noi = new Array(24).fill(0);
  const add = (arr, s, e) => {
    for (let t = s; t < e;) { const p = C.parts(t, tz()); const next = Math.min(e, t - (t % MIN) + (60 - p.mi) * MIN); arr[p.h] += next - t; t = next; }
  };
  for (const d of days) {
    for (const g of d.st.segs) if (g.type === 'signal') add(sig, g.s, g.e); else if (g.type === 'noise') add(noi, g.s, g.e);
    for (const g of d.st.gaps) add(noi, g.s, g.e);
  }
  const n = days.length, out = [];
  const best2 = arr => { let bi = 0, bv = -1; for (let h = 0; h < 24; h++) { const v = arr[h] + arr[(h + 1) % 24]; if (v > bv) { bv = v; bi = h; } } return [bi, bv]; };
  const [sh, sv] = best2(sig), [nh, nv] = best2(noi);
  if (sv > 20 * MIN * n) out.push({ c: 'var(--ok)', i: 'trend', t: `Your strongest signal is <b>${fmtHour(sh)}–${fmtHour(sh + 2)}</b>, about <b>${dur(sv / n)}</b> a day. Guard those hours.` });
  if (nv > 20 * MIN * n) out.push({ c: 'var(--accent)', i: 'leak', t: `Noise peaks <b>${fmtHour(nh)}–${fmtHour(nh + 2)}</b>, about <b>${dur(nv / n)}</b> a day. Plan a block that starts right before it.` });
  const noiseBy = {};
  for (const d of days) for (const [id, ms] of Object.entries(d.st.byAct)) { const a = C.findAct(S, id); if (a && a.type === 'noise') noiseBy[id] = (noiseBy[id] || 0) + ms; }
  const topNoise = Object.entries(noiseBy).sort((a, b) => b[1] - a[1])[0];
  if (topNoise && topNoise[1] > 15 * MIN * n) out.push({ c: 'var(--accent)', i: C.findAct(S, topNoise[0]).icon, t: `<b>${esc(C.findAct(S, topNoise[0]).name)}</b> costs you about <b>${dur(topNoise[1] / n)}</b> a day.` });
  const withWake = days.filter(d => d.st.rec.wake);
  if (withWake.length >= 4) {
    const mins = withWake.map(d => { const p = C.parts(d.st.rec.wake, tz()); return p.h * 60 + p.mi; }).sort((a, b) => a - b);
    const med = mins[Math.floor(mins.length / 2)];
    const early = withWake.filter(d => { const p = C.parts(d.st.rec.wake, tz()); return p.h * 60 + p.mi < med; }), late = withWake.filter(d => !early.includes(d));
    if (early.length && late.length) {
      const ea = early.reduce((a, d) => a + d.st.ratio, 0) / early.length, la = late.reduce((a, d) => a + d.st.ratio, 0) / late.length;
      if (Math.abs(ea - la) >= 0.05) out.push({ c: 'var(--warn)', i: 'sunrise', t: `On days you’re up before <b>${fmtMinOfDay(med)}</b> you average <b>${Math.round(ea * 100)}%</b>, versus <b>${Math.round(la * 100)}%</b> on later days.` });
    }
  }
  const den = days.reduce((a, d) => a + d.st.denom, 0), unl = days.reduce((a, d) => a + d.st.unlogged, 0);
  if (den > 0 && unl / den > 0.15) out.push({ c: 'var(--ink-3)', i: 'gap', t: `<b>${Math.round(unl / den * 100)}%</b> of your awake time went unlogged. Filling gaps makes the score honest, and it’s one tap.` });
  const wk = days.filter(d => !C.isWeekend(d.k)), we = days.filter(d => C.isWeekend(d.k));
  if (wk.length >= 2 && we.length >= 1) {
    const a = wk.reduce((x, d) => x + d.st.ratio, 0) / wk.length, b = we.reduce((x, d) => x + d.st.ratio, 0) / we.length;
    out.push({ c: 'var(--ok)', i: 'flag', t: `Weekdays average <b>${Math.round(a * 100)}%</b>, weekends <b>${Math.round(b * 100)}%</b>.` });
  }
  return out;
}
function renderHistory() {
  const now = Date.now(), tk = todayKey(now);
  const keys = Array.from({ length: 14 }, (_, i) => C.shiftKey(tk, i - 13));
  const all = keys.map(k => ({ k, has: C.hasData(S, k), st: statsFor(k, now) }));
  const logged = all.filter(d => d.has);
  if (!logged.length) {
    $('#view').innerHTML = `<div class="head"><p class="eyebrow">History</p><h1>Your trends <em>start here.</em></h1><p class="lede">Log a wake-up and a few blocks today. After a couple of days you’ll see your ratio over time, your best hours, where the noise comes from, and how wake-up time changes your day.</p></div>`;
    return;
  }
  const last7 = all.slice(7).filter(d => d.has && !d.st.today), prev7 = all.slice(0, 7).filter(d => d.has);
  const avg = a => a.length ? a.reduce((x, d) => x + d.st.ratio, 0) / a.length : 0;
  const a7 = Math.round(avg(last7) * 100), ap = Math.round(avg(prev7) * 100), delta = a7 - ap;
  const past = logged.filter(d => !d.st.today);
  const hits7 = last7.filter(d => d.st.ratio * 100 >= d.st.target).length;
  const wakes7 = last7.filter(d => d.st.rec.wake).map(d => { const p = C.parts(d.st.rec.wake, tz()); return p.h * 60 + p.mi; });

  const W = 560, H = 170, padB = 26, top = 14, bw = W / 14;
  const bars = all.map((d, i) => {
    const x = i * bw + bw * .2, w = bw * .6, h = d.has ? Math.max(3, Math.min(1, d.st.ratio) * (H - padB - top)) : 0, y = H - padB - h;
    const ty = H - padB - d.st.target / 100 * (H - padB - top);
    const lab = dayLabel(d.k, { weekday: 'narrow' });
    return `${d.has ? `<rect class="bar${d.st.today ? ' today' : d.st.ratio * 100 >= d.st.target ? '' : ' miss'}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4"/>` : ''}<line class="tgt" x1="${(x - 2).toFixed(1)}" x2="${(x + w + 2).toFixed(1)}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" opacity="${d.has ? 1 : .25}"/><text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${lab}</text>`;
  }).join('');
  const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Signal ratio for the last 14 days"><line class="grid" x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}"/>${bars}</svg>`;

  let wakeChart = '';
  const wp = all.map((d, i) => d.st.rec.wake ? { i, m: (() => { const p = C.parts(d.st.rec.wake, tz()); return p.h * 60 + p.mi; })() } : null).filter(Boolean);
  if (wp.length >= 2) {
    const lo = Math.floor((Math.min(...wp.map(p => p.m)) - 30) / 60) * 60, hi = Math.ceil((Math.max(...wp.map(p => p.m)) + 30) / 60) * 60;
    const H2 = 130, t2 = 14, b2 = 30, gut = 84, bw2 = (W - gut) / 14;
    const y = m => t2 + (m - lo) / Math.max(60, hi - lo) * (H2 - t2 - b2), x = i => i * bw2 + bw2 / 2;
    wakeChart = `<svg class="chart" viewBox="0 0 ${W} ${H2}" role="img" aria-label="Wake time for the last 14 days"><line class="grid" x1="0" x2="${W - gut + 6}" y1="${y(lo)}" y2="${y(lo)}"/><line class="grid" x1="0" x2="${W - gut + 6}" y1="${y(hi)}" y2="${y(hi)}"/><text x="${W}" y="${y(lo) + 5}" text-anchor="end">${fmtMinOfDay(lo)}</text><text x="${W}" y="${y(hi) + 5}" text-anchor="end">${fmtMinOfDay(hi)}</text><polyline class="line" points="${wp.map(p => `${x(p.i).toFixed(1)},${y(p.m).toFixed(1)}`).join(' ')}"/>${wp.map(p => `<circle class="pt" cx="${x(p.i).toFixed(1)}" cy="${y(p.m).toFixed(1)}" r="5"/>`).join('')}${all.map((d, i) => `<text x="${x(i).toFixed(1)}" y="${H2 - 6}" text-anchor="middle">${dayLabel(d.k, { weekday: 'narrow' })}</text>`).join('')}</svg>`;
  }

  const week = all.slice(7).filter(d => d.has);
  const tot = { signal: 0, noise: 0, upkeep: 0, gap: 0 }, byAct = {}, byTag = {};
  for (const d of week) {
    tot.signal += d.st.mins.signal; tot.noise += d.st.mins.noise; tot.upkeep += d.st.mins.upkeep; tot.gap += d.st.unlogged;
    for (const [id, ms] of Object.entries(d.st.byAct)) byAct[id] = (byAct[id] || 0) + ms;
    for (const [tg, ms] of Object.entries(d.st.byTag)) byTag[tg] = (byTag[tg] || 0) + ms;
  }
  const totalAll = tot.signal + tot.noise + tot.upkeep + tot.gap || 1;
  const typebar = `<div class="typebar"><i class="t-signal" style="width:${tot.signal / totalAll * 100}%"></i><i class="t-noise" style="width:${tot.noise / totalAll * 100}%"></i><i class="gap" style="width:${tot.gap / totalAll * 100}%"></i><i class="t-upkeep" style="width:${tot.upkeep / totalAll * 100}%"></i></div>
    <div class="legend" style="justify-content:flex-start;margin-bottom:16px"><span class="t-signal"><i></i>Signal ${dur(tot.signal)}</span><span class="t-noise"><i></i>Noise ${dur(tot.noise)}</span><span><i class="gap"></i>Unlogged ${dur(tot.gap)}</span><span class="t-upkeep"><i></i>Upkeep ${dur(tot.upkeep)}</span></div>`;
  const rows = Object.entries(byAct).map(([id, ms]) => ({ a: C.findAct(S, id) || { name: 'Deleted', type: 'noise' }, ms })).sort((a, b) => b.ms - a.ms);
  const mx = Math.max(1, ...rows.map(r => r.ms));
  const where = rows.map(r => `<div class="where-row t-${r.a.type}"><span class="nm"><i></i>${esc(r.a.name)}</span><span class="mn">${dur(r.ms)}</span><span class="bar"><i style="width:${r.ms / mx * 100}%"></i></span></div>`).join('');
  const tags = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
  const tagMx = Math.max(1, ...tags.map(t => t[1]));
  const ins = insights(past.length >= 2 ? past : logged);

  const cards = [...logged].reverse().map(d => {
    const st = d.st, p = Math.round(st.ratio * 100), open = expanded.has(d.k);
    return `<div class="h-card"><button class="h-top" data-act="toggleday" data-key="${d.k}" aria-expanded="${open}">${miniRing(st.ratio, st.target)}
      <span><time>${esc(dayLabel(d.k))}${st.today ? ' · today' : ''}</time><p>${st.rec.wake ? 'Up ' + clock(st.rec.wake) : 'Wake not logged'} · ${dur(st.mins.signal)} signal · ${st.segs.length} block${st.segs.length === 1 ? '' : 's'}</p></span>
      <span class="h-pct${p >= st.target ? ' hit' : ''}">${p}%</span></button>
      ${open ? `<div class="h-body">${timelineRows(st, now).length ? `<ul class="list">${timelineRows(st, now).join('')}</ul>` : '<div class="empty-note">No blocks logged.</div>'}</div>` : ''}</div>`;
  }).join('');

  $('#view').innerHTML = `<div class="head"><p class="eyebrow">Last 7 days</p><h1><em>${last7.length ? a7 : Math.round(avg(logged) * 100)}%</em> average signal.</h1>
    <p class="lede">${prev7.length && last7.length ? `${delta >= 0 ? '<b>+' + delta + '</b> points' : '<b>' + delta + '</b> points'} versus the week before. ` : ''}${last7.length ? `Target hit on <b>${hits7} of ${last7.length}</b> days.` : 'Your first full day lands here tomorrow.'}${wakes7.length ? ` Average wake-up <b>${fmtMinOfDay(wakes7.reduce((a, b) => a + b, 0) / wakes7.length)}</b>.` : ''}</p></div>
    <div class="stack" style="margin-top:14px">
      <div class="stat-grid"><div class="stat"><small>This week</small><b>${last7.length ? a7 + '%' : '—'}</b></div><div class="stat"><small>Vs last week</small><b class="${delta >= 0 ? 'up' : 'down'}">${prev7.length && last7.length ? (delta >= 0 ? '+' : '') + delta : '—'}</b></div><div class="stat"><small>At target</small><b>${hits7}/${last7.length || 0}</b></div></div>
      <section class="sheet"><div class="sheet-head"><span class="sheet-title">Signal ratio · 14 days</span><span class="sheet-meta">tick = target</span></div><div class="sheet-body">${chart}</div></section>
      ${ins.length ? `<section class="sheet"><div class="sheet-head"><span class="sheet-title">What the data says</span></div>${ins.map(x => `<div class="insight" style="--c:${x.c}"><span class="ic">${ico(x.i, 17)}</span><p>${x.t}</p></div>`).join('')}</section>` : `<section class="sheet"><div class="sheet-body"><p class="note" style="margin:0">Insights about your best hours and biggest leaks show up after two or three days of logging.</p></div></section>`}
      ${wakeChart ? `<section class="sheet"><div class="sheet-head"><span class="sheet-title">Wake time · 14 days</span></div><div class="sheet-body">${wakeChart}</div></section>` : ''}
      <section class="sheet"><div class="sheet-head"><span class="sheet-title">Where the time went · 7 days</span></div><div class="sheet-body">${typebar}<div class="where">${where || '<p class="note">No blocks yet.</p>'}</div></div></section>
      ${tags.length ? `<section class="sheet"><div class="sheet-head"><span class="sheet-title">By course · 7 days</span></div><div class="sheet-body"><div class="where">${tags.map(([t, ms]) => `<div class="where-row t-signal"><span class="nm"><i></i>${esc(t)}</span><span class="mn">${dur(ms)}</span><span class="bar"><i style="width:${ms / tagMx * 100}%"></i></span></div>`).join('')}</div></div></section>` : ''}
    </div>
    <section class="section"><h2>Days</h2><div class="history">${cards}</div></section>`;
}

/* ---------- Settings ---------- */
const appUrl = () => location.origin + location.pathname;
const syncBase = () => L.sync ? L.sync.url.replace(/\/+$/, '') : '';
const doUrl = (cmd, act) => `${syncBase()}/do?cmd=${cmd}${act ? '&act=' + encodeURIComponent(act) : ''}&key=${encodeURIComponent(L.sync ? L.sync.key : '')}`;
function urlBox(label, url) { return `<div class="urlbox"><div><small>${label}</small><code>${esc(url)}</code></div><button class="icon-btn" data-act="copy" data-text="${esc(url)}" aria-label="Copy ${label}">${ico('copy', 15)}</button></div>`; }
function recipesHtml() {
  if (!L.sync) return `<div class="sheet-body"><p style="margin:0;color:var(--ink-2);font-size:14.5px">With sync connected, iOS Shortcuts can log for you without opening the app: your alarm logs wake-up, arriving at the gym starts a workout, opening Instagram shows a pause screen first. Connect sync above to see the recipes.</p></div>`;
  const app = L.recipeApp in APPS ? L.recipeApp : 'instagram', info = APPS[app];
  const R = [
    { i: 'alarm', t: 'Wake-up logs itself', s: 'Trigger: Alarm → your morning alarm → Is Stopped', u: [['Get Contents of URL', doUrl('wake')]] },
    { i: 'moon', t: 'Bedtime closes the day', s: 'Trigger: Sleep Focus → Is Turned On (or Charger → Is Connected, between 9 PM and 3 AM)', u: [['Get Contents of URL', doUrl('bed')]] },
    { i: 'shield', t: `Pause before ${info[0]}`, s: `Trigger: App → ${info[0]} → Is Opened. Action 1: Get Contents of URL (the gate). Action 2: If Contents of URL is “intercept” → Open URLs (the pause screen).`, u: [['1 · Gate', `${syncBase()}/gate?app=${app}&key=${encodeURIComponent(L.sync.key)}`], ['2 · Pause screen', `${appUrl()}#intercept=${app}&act=${info[2]}`]], pick: true },
    { i: 'stop', t: `Stop when you close ${info[0]}`, s: `Trigger: App → ${info[0]} → Is Closed`, u: [['Get Contents of URL', doUrl('stopif', info[2])]] },
    { i: 'pin', t: 'The gym starts Working out', s: 'Trigger: Arrive → your gym. A second automation on Leave → same place stops it.', u: [['Arrive', doUrl('start', 'workout')], ['Leave', doUrl('stopif', 'workout')]] },
    { i: 'nfc', t: 'Tap your desk to study', s: 'Stick a cheap NFC tag on your desk. Trigger: NFC → scan it.', u: [['Get Contents of URL', doUrl('start', 'study')]] },
  ];
  return `<div class="sheet-body" style="padding-bottom:4px"><p style="margin:0;color:var(--ink-2);font-size:14px">In the Shortcuts app: <b>Automation → New → pick the trigger → Run Immediately</b>, add the action with the link, and turn off <b>Notify When Run</b>. The “Get Contents of URL” ones run silently.</p></div>
    ${R.map(r => `<div class="recipe"><div class="recipe-head"><span class="ic">${ico(r.i, 17)}</span><span><b>${r.t}</b><small>${r.s}</small></span></div>
      ${r.pick ? `<label class="field" style="margin:8px 0 4px"><span>App</span><select id="rc-app">${Object.entries(APPS).map(([k, v]) => `<option value="${k}"${k === app ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label>` : ''}
      ${r.u.map(([l, u]) => urlBox(l, u)).join('')}</div>`).join('')}`;
}
function renderSettings() {
  const grouped = ['signal', 'upkeep', 'noise'].map(t => `<div class="group-label t-${t}"><i></i>${TYPES[t]}</div>` + S.activities.filter(a => a.type === t).map(a =>
    `<button class="act-row t-${t}" data-act="editact" data-id="${esc(a.id)}"><span class="ic">${ico(a.icon, 16)}</span><span class="nm">${esc(a.name)}${a.tags && a.tags.length ? `<small class="tag">${esc(a.tags.join(' · '))}</small>` : ''}</span><span class="chev">${ico('chev', 16)}</span></button>`).join('')).join('');
  const lastB = L.lastBackup ? `Last backup ${dur(Date.now() - L.lastBackup)} ago.` : 'No backup yet.';
  const syncInfo = L.sync
    ? `<div class="sheet-body"><div class="status-line"><i class="${syncState === 'ok' ? 'ok' : syncState === 'error' || syncState === 'offline' ? 'err' : ''}"></i>${syncState === 'ok' ? `Synced${L.lastSync ? ' ' + dur(Date.now() - L.lastSync) + ' ago' : ''}` : syncState === 'busy' ? 'Syncing…' : syncState === 'offline' ? 'Offline. It will catch up.' : 'Can’t reach your worker right now.'}</div>
        <p class="note" style="word-break:break-all">${esc(syncBase())}</p></div>
       <div class="sheet-foot"><button class="btn" data-act="syncnow">Sync now</button><button class="btn" data-act="setuplink">${ico('link', 15)}Copy setup link</button><span class="spacer"></span><button class="btn btn-danger" data-act="unsync">Disconnect</button></div>
       <div class="sheet-body" style="padding-top:0"><p class="note" style="margin:0">The setup link connects another browser, like Safari on this phone, to the same data. Open it there once.</p></div>`
    : `<div class="sheet-body"><p style="margin:0 0 12px;color:var(--ink-2);font-size:14.5px">Sync keeps a copy of your data in your own free Cloudflare Worker. It backs everything up, joins Safari and the installed app, and lets iOS Shortcuts and the widget work.</p>
        <div class="form"><label class="field"><span>Worker URL</span><input type="url" id="sy-url" placeholder="https://signal-sync.you.workers.dev" autocomplete="off" autocapitalize="off"></label>
        <label class="field"><span>Key</span><input type="password" id="sy-key" placeholder="The key from the deploy script" autocomplete="off" autocapitalize="off"></label></div></div>
       <div class="sheet-foot"><span class="note" style="margin:0">Set up in a minute with the deploy script.</span><span class="spacer"></span><button class="btn btn-ink" data-act="connect">Connect</button></div>`;
  $('#view').innerHTML = `<div class="head"><p class="eyebrow">Settings</p><h1>Make it <em>yours.</em></h1></div>
  <div class="stack" style="margin-top:12px">
    <section class="sheet"><div class="sheet-head"><span class="sheet-title">Targets</span></div>
      <div class="set-row"><div><b>Weekdays</b><small>Signal as a share of awake time, minus upkeep.</small></div><select id="s-target">${[90, 85, 80, 75, 70, 65, 60, 50].map(v => `<option value="${v}"${v === S.settings.target ? ' selected' : ''}>${v}%</option>`).join('')}</select></div>
      <div class="set-row"><div><b>Weekends</b><small>Saturday and Sunday.</small></div><select id="s-wtarget">${[90, 85, 80, 75, 70, 65, 60, 50, 40].map(v => `<option value="${v}"${v === S.settings.weekendTarget ? ' selected' : ''}>${v}%</option>`).join('')}</select></div>
      <div class="set-row"><div><b>Usual wake time</b><small>Estimates a day you forgot to log.</small></div><input type="time" id="s-wake" value="${S.settings.wake}"></div>
      <div class="set-row"><div><b>Usual bedtime</b><small>Sets how much you still need today.</small></div><input type="time" id="s-bed" value="${S.settings.bed}"></div></section>
    <section class="sheet"><div class="sheet-head"><span class="sheet-title">Activities</span><span class="sheet-meta">${S.activities.length}</span></div>${grouped}
      <div class="sheet-foot"><button class="btn btn-block" data-act="newact">${ico('plus', 15)}New activity</button></div></section>
    <section class="sheet" id="sync"><div class="sheet-head"><span class="sheet-title">Sync</span><span class="sheet-meta">${L.sync ? 'on' : 'off'}</span></div>${syncInfo}</section>
    <section class="sheet"><div class="sheet-head"><span class="sheet-title">Let iOS log for you</span></div>${recipesHtml()}</section>
    <section class="sheet"><div class="sheet-head"><span class="sheet-title">Home-screen widget</span></div>
      <div class="sheet-body"><ol class="steps-num"><li>Install <b>Scriptable</b> from the App Store (free).</li><li>Tap <b>Copy widget script</b>, open Scriptable, tap <b>+</b>, paste, and name it Signal.</li><li>Long-press your Home Screen → <b>+</b> → Scriptable → add a small or medium widget → tap it → Script: <b>Signal</b>.</li></ol>
      ${L.sync ? '' : '<p class="note">Needs sync, since that’s where the widget reads your numbers.</p>'}</div>
      <div class="sheet-foot"><button class="btn btn-ink" data-act="copywidget" ${L.sync ? '' : 'disabled'}>${ico('widget', 15)}Copy widget script</button></div></section>
    <section class="sheet"><div class="sheet-head"><span class="sheet-title">Your data</span></div>
      <div class="sheet-body"><p style="margin:0;color:var(--ink-2);font-size:14.5px">${L.sync ? 'Your worker keeps a live copy. ' : 'Everything lives on this phone only. '}${lastB}</p></div>
      <div class="sheet-foot"><button class="btn" data-act="export">${ico('share', 15)}Back up</button><button class="btn" data-act="import">Restore…</button><span class="spacer"></span><button class="btn btn-danger" data-act="wipe">Erase</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden></section>
    <section class="sheet"><div class="sheet-head"><span class="sheet-title">About</span></div>
      <div class="sheet-foot"><button class="btn" data-act="replay">Replay the intro</button><span class="spacer"></span><span class="note" style="margin:0">Signal ${VERSION} · ${standalone ? 'installed' : 'in the browser'}</span></div></section>
  </div>`;
}

/* ---------- render ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach((b, i) => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); if (on) $('#tab-ind').style.transform = `translateX(${i * 100}%)`; });
  if (tab === 'today') renderToday();
  else { if (tab === 'history') renderHistory(); else renderSettings(); const st = C.dayStats(S, todayKey(), Date.now()); setMood(st); }
  renderNowbar();
  const b = $('#syncbtn'); if (b) b.dataset.sync = L.sync ? syncState : 'off';
}
function goTab(t) {
  if (t === tab) { scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
  tab = t; if (t === 'today') sweepNext = true;
  closeSwipe(true);
  scrollTo(0, 0); render();
  const v = $('#view'); v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in');
}

/* ---------- sync client ---------- */
let syncState = 'off', syncing = false, syncAgain = false, syncTimer = null;
function setSync(st) { syncState = st; const b = $('#syncbtn'); if (b) b.dataset.sync = L.sync ? st : 'off'; }
function scheduleSync(ms = 1200) { if (!L.sync) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms); }
const signature = s => JSON.stringify([s.logs.map(l => l.id + ':' + l.u).sort(), s.currentU, s.current && s.current.u, Object.entries(s.days).map(([k, d]) => k + ':' + d.u).sort(), s.activities.map(a => a.id + ':' + a.u), s.settings.u, Object.keys(s.tomb.logs).length, Object.keys(s.tomb.acts).length]);
async function syncNow() {
  if (!L.sync) { setSync('off'); return false; }
  if (syncing) { syncAgain = true; return false; }
  syncing = true; setSync('busy');
  try {
    const res = await fetch(syncBase() + '/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + L.sync.key }, body: JSON.stringify(S) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const remote = C.normalize(await res.json());
    if (!remote) throw new Error('bad data');
    const before = signature(S);
    S = C.merge(S, remote);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    L.lastSync = Date.now(); saveL(); setSync('ok');
    if (signature(S) !== before) { rev++; softRender(); }
    return true;
  } catch (e) {
    setSync(navigator.onLine === false ? 'offline' : 'error');
    return false;
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(300); }
  }
}
async function connectSync(url, key) {
  url = (url || '').replace(/\s+/g, '').replace(/\/+$/, ''); key = (key || '').replace(/\s+/g, '');   // copy-paste on a phone can add spaces
  if (!/^https?:\/\//.test(url) || !key) { toast('Enter the worker URL and key'); return false; }
  try {
    const r = await fetch(url + '/ping', { headers: { authorization: 'Bearer ' + key } });
    if (r.status === 401) { toast('That key doesn’t match the worker'); return false; }
    if (!r.ok) throw new Error();
  } catch (e) { toast('Can’t reach that URL'); return false; }
  L.sync = { url, key }; saveL();
  await syncNow();
  render(); toast('Sync connected');
  return true;
}

/* ---------- backup ---------- */
async function backup() {
  const name = `signal-backup-${todayKey()}.json`, data = JSON.stringify(S, null, 1);
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Signal backup' });
      L.lastBackup = Date.now(); saveL(); toast('Backup shared'); return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  L.lastBackup = Date.now(); saveL(); toast('Backup saved');
}

/* ---------- swipe rows + drag-to-close sheets ---------- */
const SW_W = 152;
let sw = null, openSw = null, suppressClick = false, drag = null;
function closeSwipe(instant) { if (!openSw) return; if (instant) openSw.style.transition = 'none'; openSw.style.transform = ''; const el = openSw; openSw = null; if (instant) setTimeout(() => { el.style.transition = ''; }, 20); }
document.addEventListener('touchstart', e => {
  const head = e.target.closest('#modal .modal-head, #modal .grab');
  if (head && !e.target.closest('button')) { drag = { y0: e.touches[0].clientY, dy: 0, t0: performance.now() }; return; }
  const f = e.target.closest('.sw-front');
  if (openSw && f !== openSw) closeSwipe();
  if (!f) return;
  sw = { el: f, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, base: f === openSw ? -SW_W : 0, mode: null };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (drag) {
    drag.dy = Math.max(0, e.touches[0].clientY - drag.y0);
    const m = $('#modal'); m.style.transition = 'none'; m.style.transform = `translateY(${drag.dy}px)`;
    e.preventDefault(); return;
  }
  if (!sw) return;
  const x = e.touches[0].clientX - sw.x0, y = e.touches[0].clientY - sw.y0;
  if (!sw.mode) { if (Math.abs(x) > 8 && Math.abs(x) > Math.abs(y)) sw.mode = 'h'; else if (Math.abs(y) > 8) sw.mode = 'v'; }
  if (sw.mode !== 'h') return;
  e.preventDefault();
  sw.dx = Math.min(0, Math.max(-SW_W - 40, sw.base + x));
  sw.el.style.transition = 'none'; sw.el.style.transform = `translateX(${sw.dx}px)`;
}, { passive: false });
document.addEventListener('touchend', () => {
  if (drag) {
    const d = drag, m = $('#modal'); drag = null;
    const v = d.dy / Math.max(1, performance.now() - d.t0);
    m.style.transition = 'transform .3s cubic-bezier(.2,.8,.2,1)';
    if (d.dy > 110 || (d.dy > 40 && v > 0.6)) { m.style.transform = 'translateY(110%)'; setTimeout(closeModal, 160); }
    else m.style.transform = '';
    return;
  }
  if (!sw) return;
  const s = sw; sw = null;
  if (s.mode !== 'h') return;
  s.el.style.transition = '';
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
  if (s.dx < -SW_W / 2) { s.el.style.transform = `translateX(${-SW_W}px)`; openSw = s.el; haptic(); }
  else { s.el.style.transform = ''; if (openSw === s.el) openSw = null; }
});

/* ---------- clicks ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-tab]');
  if (!t) return;
  if (suppressClick) { e.preventDefault(); return; }
  if (t.dataset.tab) { goTab(t.dataset.tab); return; }
  const a = t.dataset.act, d = t.dataset, now = Date.now();
  if (openSw && t.classList.contains('sw-front')) { closeSwipe(); return; }
  switch (a) {
    case 'close': closeModal(); break;
    case 'closeov': closeOverlay(); break;
    case 'undo': if (undoFn) { const f = undoFn; undoFn = null; $('#toast').classList.remove('show'); f(); } break;
    case 'quick': startNow(d.id); break;
    case 'start': pickerModal('start'); break;
    case 'switch': pickerModal('switch'); break;
    case 'runsheet': if (!e.target.closest('[data-act="stop"]')) runningSheet(); break;
    case 'stop': e.stopPropagation(); closeModal(); stopNow(); break;
    case 'discard': closeModal(); mutate(() => { S.current = null; S.currentU = now; return { msg: 'Block discarded' }; }); break;
    case 'settag': if (S.current) { S.current = { ...S.current, tag: d.tag, u: now }; S.currentU = now; save(); renderNowbar(); runningSheet(); haptic(); } break;
    case 'pick': {
      const m = modalCtx, id = d.id; closeModal();
      if (m.mode === 'start' || m.mode === 'switch') startNow(id);
      else if (m.mode === 'log') blockModal(null, { act: id });
      else if (m.mode === 'fill') fillGap(m.s, m.e, id);
      else if (m.mode === 'fillopen') startNow(id, m.s);
      break;
    }
    case 'newact': { const after = modalCtx.kind === 'picker' ? { ...modalCtx } : null; closeModal(); setTimeout(() => activityModal(null, after), modalOpen ? 0 : 230); break; }
    case 'editact': activityModal(d.id); break;
    case 'acttype': modalCtx.type = d.type; t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); break;
    case 'acticon': modalCtx.icon = d.icon; t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); break;
    case 'saveact': saveActivity(); break;
    case 'delact': {
      const id = modalCtx.id, x = C.findAct(S, id);
      if (!x || (S.current && S.current.act === id)) break;
      if (!confirm(`Delete “${x.name}”? Past blocks keep their time.`)) break;
      closeModal();
      mutate(() => { S.activities = S.activities.filter(q => q.id !== id); S.tomb.acts[id] = now; return { msg: `${x.name} deleted` }; }, { undo: false });
      break;
    }
    case 'wake': { const ts = now - Number(d.ago || 0) * MIN; sweepNext = true; haptic(); mutate(() => { C.setWake(S, ts, now); return { msg: `Good morning · up at ${clock(ts)}` }; }); break; }
    case 'waketime': timeModal('wake'); break;
    case 'bedtime': timeModal('bed'); break;
    case 'savetime': saveTime(d.kind); break;
    case 'cleartime': closeModal(); mutate(() => { const k = todayKey(), r = { ...(S.days[k] || {}) }; delete r[d.kind === 'wake' ? 'wake' : 'bed']; r.u = now; S.days[k] = r; return { msg: d.kind === 'wake' ? 'Wake time cleared' : 'Bed time cleared' }; }); break;
    case 'wrapup': wrapUp(); break;
    case 'goodnight': haptic(); closeOverlay(); mutate(() => { C.setBed(S, now, now); return { msg: 'Day closed. Sleep well.' }; }); break;
    case 'gapfill': if (d.open) startNow(d.id, Number(d.s)); else fillGap(Number(d.s), Number(d.e), d.id); break;
    case 'gapother': closeModal(); pickerModal(d.open ? 'fillopen' : 'fill', { s: Number(d.s), e: d.open ? now : Number(d.e) }); break;
    case 'gapsplit': blockModal(null, { s: Number(d.s), e: Number(d.e), act: suggest(1, { at: (Number(d.s) + Number(d.e)) / 2 })[0].id }); break;
    case 'gapignore': L.ignoreGaps[d.s] = 1; saveL(); render(); toast('Left as unlogged'); break;
    case 'logpast': pickerModal('log'); break;
    case 'editblock': if (!suppressClick) blockModal(d.id); break;
    case 'saveblock': saveBlock(); break;
    case 'delblock': { closeModal(); closeSwipe(true); const l = S.logs.find(x => x.id === d.id); haptic(); mutate(() => { C.deleteLog(S, d.id, now); return { msg: `${l ? C.actOf(S, l).name : 'Block'} deleted` }; }); break; }
    case 'toggleday': expanded.has(d.key) ? expanded.delete(d.key) : expanded.add(d.key); render(); break;
    case 'dismissinstall': L.installDismissed = true; saveL(); render(); break;
    case 'syncbtn': if (!L.sync) { goTab('settings'); setTimeout(() => { const el = $('#sync'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); } else { const ok = await syncNow(); toast(ok ? 'Synced' : 'Sync failed. It will retry.'); if (tab === 'settings') render(); } break;
    case 'connect': connectSync($('#sy-url').value, $('#sy-key').value); break;
    case 'syncnow': { const ok = await syncNow(); toast(ok ? 'Synced' : 'Sync failed'); render(); break; }
    case 'unsync': if (confirm('Disconnect sync on this device? Your data stays here and on the worker.')) { L.sync = null; saveL(); setSync('off'); render(); } break;
    case 'setuplink': copyText(`${appUrl()}#setup=${btoa(JSON.stringify(L.sync))}`, 'Setup link copied. Open it in the other browser.'); break;
    case 'copy': copyText(d.text, 'Link copied'); break;
    case 'copywidget': {
      try {
        const src = await (await fetch('widget/signal-widget.js', { cache: 'no-store' })).text();
        copyText(src.replace('__SYNC_URL__', syncBase()).replace('__SYNC_KEY__', L.sync.key).replace('__APP_URL__', appUrl()), 'Widget script copied. Paste it into Scriptable.');
      } catch (er) { toast('Couldn’t load the widget script'); }
      break;
    }
    case 'export': backup(); break;
    case 'import': $('#import-file').click(); break;
    case 'wipe': if (confirm('Erase every block, wake time and setting on this device? This can’t be undone.')) { const keepTz = S.settings.tz; S = C.fresh(); S.settings.tz = keepTz; S.settings.u = now; S.currentU = now; save({ sync: false }); render(); toast('Erased on this device'); } break;
    case 'replay': onboarding(0); break;
    case 'obnext': onboarding(obStep + 1); break;
    case 'obback': onboarding(obStep - 1); break;
    case 'obweekend': S.settings = { ...S.settings, weekendTarget: Number(d.v), u: now }; save(); onboarding(1); break;
    case 'obdone': L.onboarded = true; saveL(); sweepNext = true; closeOverlay(); break;
    case 'icept-alt': closeOverlay(); startNow(d.id); toast('Good call.'); break;
    case 'icept-allow': {
      const app = d.app, info = APPS[app];
      try { await fetch(`${syncBase()}/allow?app=${encodeURIComponent(app)}&min=10`, { headers: { authorization: 'Bearer ' + L.sync.key } }); } catch (er) { /* let it through anyway */ }
      ovOpen = null; $('#ov').hidden = true; document.body.style.overflow = '';
      mutate(() => C.startBlock(S, d.id, Date.now()), { silent: true });
      await Promise.race([syncNow(), new Promise(r => setTimeout(r, 1500))]);
      if (info && info[1]) location.href = info[1]; else toast(`Switch back to ${info ? info[0] : app}`);
      break;
    }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'run-note' && S.current) { S.current.note = t.value; clearTimeout(window.__nt); window.__nt = setTimeout(() => { if (S.current) { S.current.u = Date.now(); S.currentU = S.current.u; save(); } }, 600); }
  else if (t.id === 'pk-q') {
    const q = t.value.trim().toLowerCase();
    $('#pk-sug').hidden = !!q;
    document.querySelectorAll('#modal .pick-group:not(#pk-sug)').forEach(g => {
      let any = false;
      g.querySelectorAll('button[data-name]').forEach(b => { const hit = !q || b.dataset.name.includes(q); b.classList.toggle('hide', !hit); any = any || hit; });
      g.hidden = !any;
    });
  }
  else if ((t.id === 'f-start' || t.id === 'f-end') && $('#f-dur')) { const r = readBlockTimes(); $('#f-dur').textContent = r ? dur(r.e - r.s) : ''; }
});
document.addEventListener('change', e => {
  const t = e.target, now = Date.now();
  if (t.id === 's-target') { S.settings = { ...S.settings, target: Number(t.value), u: now }; save(); toast(`Weekdays: ${t.value}%`); }
  else if (t.id === 's-wtarget') { S.settings = { ...S.settings, weekendTarget: Number(t.value), u: now }; save(); toast(`Weekends: ${t.value}%`); }
  else if (t.id === 's-wake' && t.value) { S.settings = { ...S.settings, wake: t.value, u: now }; save(); }
  else if (t.id === 's-bed' && t.value) { S.settings = { ...S.settings, bed: t.value, u: now }; save(); }
  else if (t.id === 'rc-app') { L.recipeApp = t.value; saveL(); render(); }
  else if (t.id === 'f-act') { const a = C.findAct(S, t.value); $('#f-tagwrap').innerHTML = tagField(a, C.lastTag(S, t.value)); }
  else if (t.id === 'run-start' && S.current && t.value) {
    let ts = C.atTime(todayKey(now), t.value, tz());
    if (ts > now) ts -= 24 * HOUR;
    if (now - ts > 20 * HOUR) { toast('That’s too far back'); return; }
    S.current = { ...S.current, start: ts, u: now }; S.currentU = now; save(); render(); runningSheet(); toast(`Started at ${clock(ts)}`);
  }
  else if (t.id === 'import-file' && t.files[0]) {
    t.files[0].text().then(txt => {
      const j = C.normalize(JSON.parse(txt));
      if (!j) throw new Error('bad');
      if (confirm(`Merge this backup (${j.logs.length} blocks) into what’s here?`)) { S = C.merge(S, j); save(); render(); toast('Backup restored'); }
    }).catch(() => toast('That file isn’t a Signal backup')).finally(() => { t.value = ''; });
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (modalOpen) closeModal(); else if (ovOpen && ovOpen !== 'onboard') closeOverlay(); }
  if (e.key === 'Enter' && (e.target.id === 'run-note' || e.target.id === 'pk-q')) e.target.blur();
});
addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 6), { passive: true });

/* theme: follows the system until you toggle it */
function applyThemeColor() { const c = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(); document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', c)); }
try { const th = localStorage.getItem('signal.theme'); if (th) { document.documentElement.dataset.theme = th; applyThemeColor(); } } catch (e) { /* ignore */ }
$('#theme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; applyThemeColor();
  try { localStorage.setItem('signal.theme', next); } catch (e) { /* ignore */ }
});

/* ---------- live clock ---------- */
let lastLive = 0, lastPull = Date.now();
setInterval(() => {
  if (document.hidden) return;
  const now = Date.now();
  renderNowbar(now);
  const rt = $('#rs-timer'); if (rt && S.current) rt.textContent = stopwatch(now - S.current.start);
  if (now - lastLive >= 5000) { lastLive = now; if (tab === 'today' && !modalOpen && !ovOpen && !sw && !drag) liveToday(now); }
  if (L.sync && now - lastPull >= 30000) { lastPull = now; syncNow(); }
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (L.sync) { lastPull = Date.now(); syncNow(); }
  if (!modalOpen && !ovOpen) { sweepNext = tab === 'today' && todayKey() !== lastDayKey; render(); }
});
addEventListener('online', () => { if (L.sync) syncNow(); });

/* ---------- links: #wake #bed #stop #stopif=<id> #start=<id> #intercept=<app>&act=<id> #setup=<code> ---------- */
function handleHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  history.replaceState(null, '', location.pathname + location.search);
  const params = new URLSearchParams(h.replace(/^([^=&]+)(?=&|$)/, '$1='));
  const [cmd] = h.split(/[=&]/), arg = params.get(cmd) || '';
  if (cmd === 'setup') {
    try { const cfg = JSON.parse(atob(arg)); if (!cfg.url || !cfg.key) throw 0; L.sync = { url: cfg.url, key: cfg.key }; L.onboarded = true; saveL(); toast('Sync connected on this browser'); syncNow().then(render); }
    catch (e) { toast('That setup link is broken'); }
    return true;
  }
  if (cmd === 'intercept') { intercept(arg.toLowerCase(), params.get('act') || ''); return true; }
  tab = 'today';
  const r = C.applyCommand(S, cmd, arg, Date.now());
  if (r.msg === 'Unknown command') { render(); return false; }
  if (r.changed) { if (cmd.startsWith('wake')) sweepNext = true; save(); }
  render(); toast(r.msg);
  return true;
}
addEventListener('hashchange', handleHash);

/* ---------- boot ---------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
document.addEventListener('pointerdown', () => { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignore */ } }, { once: true });
save({ sync: false });
render();
const handled = handleHash();
if (!L.onboarded && !handled) onboarding(0);
if (L.sync) syncNow();
