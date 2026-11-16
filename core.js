/* Signal core — shared by the app (browser) and the sync worker (Cloudflare). No DOM in here.
   Every record carries `u` (last-updated ms) so two copies can always be merged: newest edit wins, per item. */
(function (root) {
  'use strict';
  const MIN = 60000, HOUR = 3600000, DAY_START_H = 4;
  const DEVICE_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
  const pad = n => String(n).padStart(2, '0');

  /* ---------- time (time-zone aware, so the worker running in UTC agrees with the phone) ---------- */
  const fmtCache = {};
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function parts(ts, tz) {
    if (!tz || tz === DEVICE_TZ) {
      const d = new Date(ts);
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), dow: d.getDay() };
    }
    let f = fmtCache[tz];
    if (!f) f = fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
    const o = {};
    for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, dow: DOW[o.weekday] };
  }
  function fromLocal(y, m, d, h, mi, tz) {
    if (!tz || tz === DEVICE_TZ) return new Date(y, m - 1, d, h, mi).getTime();
    const want = Date.UTC(y, m - 1, d, h, mi);
    let ts = want;
    for (let i = 0; i < 3; i++) { const p = parts(ts, tz); ts -= Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - want; }
    return ts;
  }
  /* A "day" runs 4:00 am to 4:00 am, so a late night belongs to the day it ended. */
  const dayKey = (ts, tz) => { const p = parts(ts - DAY_START_H * HOUR, tz); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
  const parseKey = k => k.split('-').map(Number);
  const shiftKey = (k, n) => { const [y, m, d] = parseKey(k); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
  const keyDow = k => { const [y, m, d] = parseKey(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const isWeekend = k => { const w = keyDow(k); return w === 0 || w === 6; };
  function atTime(k, hhmm, tz) {
    const [y, m, d] = parseKey(k), [h, mi] = hhmm.split(':').map(Number);
    return fromLocal(y, m, d + (h < DAY_START_H ? 1 : 0), h, mi, tz);
  }
  const hhmm = (ts, tz) => { const p = parts(ts, tz); return `${pad(p.h)}:${pad(p.mi)}`; };
  const hourOf = (ts, tz) => { const p = parts(ts, tz); return p.h + p.mi / 60; };
  function clock(ts, tz) {
    const p = parts(ts, tz), h = p.h % 12 || 12;
    return `${h}:${pad(p.mi)} ${p.h < 12 ? 'AM' : 'PM'}`;
  }
  function dur(ms) {
    const m = Math.round(ms / MIN);
    if (m < 1) return ms > 0 ? '<1m' : '0m';
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h}h ${pad(r)}m` : `${m}m`;
  }

  /* ---------- defaults ---------- */
  const COURSES = ['ECE 201', 'MTH 254', 'ECE 200'];
  const DEFAULT_ACTS = [
    ['homebase', 'Homebase', 'signal', 'layers', COURSES], ['canvas', 'Canvas', 'signal', 'clipboard', COURSES],
    ['class', 'Class / lecture', 'signal', 'grad', COURSES], ['study', 'Studying', 'signal', 'pencil', COURSES],
    ['coding', 'Coding', 'signal', 'code'], ['project', 'Project build', 'signal', 'wrench'],
    ['club', 'Club', 'signal', 'bolt'], ['reading', 'Reading', 'signal', 'book'],
    ['workout', 'Working out', 'signal', 'dumbbell'],
    ['ready', 'Getting ready', 'upkeep', 'sun'], ['meals', 'Meals', 'upkeep', 'utensils'],
    ['commute', 'Commute', 'upkeep', 'car'], ['chores', 'Chores', 'upkeep', 'home'],
    ['errands', 'Errands', 'upkeep', 'bag'], ['people', 'With people', 'upkeep', 'users'],
    ['scrolling', 'Scrolling', 'noise', 'phone'], ['youtube', 'YouTube', 'noise', 'play'],
    ['gaming', 'Gaming', 'noise', 'gamepad'], ['texting', 'Texting', 'noise', 'chat'],
    ['tv', 'TV / movies', 'noise', 'tv'], ['zoning', 'Zoning out', 'noise', 'cloud'],
    ['nap', 'Napping', 'noise', 'moon'], ['other', 'Other', 'noise', 'dots'],
  ].map(([id, name, type, icon, tags]) => ({ id, name, type, icon, tags: tags ? [...tags] : [] }));
  const TYPE_ICON = { signal: 'target', upkeep: 'home', noise: 'cloud' };

  function fresh() {
    return {
      v: 2,
      settings: { target: 80, weekendTarget: 80, wake: '08:00', bed: '23:00', tz: DEVICE_TZ, u: 0 },
      activities: DEFAULT_ACTS.map(a => ({ ...a, tags: [...a.tags], u: 0 })),
      days: {}, logs: [], current: null, currentU: 0, tomb: { logs: {}, acts: {} },
    };
  }

  /* Accepts v1 (first build) or v2 data, from storage, a backup file or the server. Returns v2 or null. */
  function normalize(j) {
    if (!j || typeof j !== 'object') return null;
    if (j.v === 1 && Array.isArray(j.logs) && j.days && Array.isArray(j.activities)) {
      const u = 1, defTags = Object.fromEntries(DEFAULT_ACTS.map(a => [a.id, a.tags]));
      j = {
        v: 2, settings: { ...(j.settings || {}), u },
        activities: j.activities.map(a => ({ tags: [...(defTags[a.id] || [])], ...a, u })),
        days: Object.fromEntries(Object.entries(j.days).map(([k, d]) => [k, { ...d, u }])),
        logs: j.logs.map(l => ({ ...l, u })), current: j.current ? { ...j.current, u } : null, currentU: u, tomb: { logs: {}, acts: {} },
      };
    }
    if (j.v !== 2 || !Array.isArray(j.logs) || !Array.isArray(j.activities) || !j.days || typeof j.days !== 'object') return null;
    const base = fresh();
    return {
      v: 2,
      settings: { ...base.settings, ...(j.settings || {}) },
      activities: j.activities.filter(a => a && a.id && a.name).map(a => ({ tags: [], ...a })),
      days: { ...j.days },
      logs: j.logs.filter(l => l && l.id && l.end > l.start),
      current: j.current && j.current.act && j.current.start ? j.current : null,
      currentU: j.currentU || 0,
      tomb: { logs: { ...((j.tomb && j.tomb.logs) || {}) }, acts: { ...((j.tomb && j.tomb.acts) || {}) } },
    };
  }

  const blockId = c => 'b' + Math.round(c.start).toString(36) + '-' + c.act;
  const findAct = (S, id) => S.activities.find(a => a.id === id);

  /* Merge two copies. Newest `u` wins for each log, day, activity, the settings and the running block.
     Deletions are kept as tombstones so a stale copy can't bring a deleted block back. */
  function merge(a, b) {
    if (!a) return b; if (!b) return a;
    const tomb = { logs: { ...a.tomb.logs }, acts: { ...a.tomb.acts } };
    for (const k of ['logs', 'acts']) for (const [id, u] of Object.entries(b.tomb[k] || {})) if (!(tomb[k][id] >= u)) tomb[k][id] = u;

    const logs = new Map();
    for (const l of [...a.logs, ...b.logs]) { const c = logs.get(l.id); if (!c || (l.u || 0) > (c.u || 0)) logs.set(l.id, l); }
    for (const [id, l] of logs) if (tomb.logs[id] >= (l.u || 0)) logs.delete(id);

    const acts = new Map(), order = [];
    for (const x of [...a.activities, ...b.activities]) { const c = acts.get(x.id); if (!c) order.push(x.id); if (!c || (x.u || 0) > (c.u || 0)) acts.set(x.id, x); }
    const activities = order.filter(id => !(tomb.acts[id] >= (acts.get(id).u || 0))).map(id => acts.get(id));

    const days = { ...a.days };
    for (const [k, d] of Object.entries(b.days)) if (!days[k] || (d.u || 0) > (days[k].u || 0)) days[k] = d;

    const settings = (b.settings.u || 0) > (a.settings.u || 0) ? { ...b.settings } : { ...a.settings };

    let current, currentU, loser;
    if ((b.currentU || 0) > (a.currentU || 0)) { current = b.current; currentU = b.currentU; loser = a.current; }
    else { current = a.current; currentU = a.currentU || 0; loser = b.current; }
    // A block the other copy never heard about isn't thrown away: it ends where the winner took over.
    if (loser && !(current && current.start === loser.start && current.act === loser.act)) {
      const end = current ? current.start : currentU, id = blockId(loser);
      if (end - loser.start >= 30000 && !logs.has(id) && !(tomb.logs[id])) {
        const act = activities.find(x => x.id === loser.act) || {};
        logs.set(id, { id, start: loser.start, end, act: loser.act, name: act.name, type: act.type, icon: act.icon, note: loser.note || '', tag: loser.tag || '', u: currentU });
      }
    }
    return { v: 2, settings, activities, days, logs: [...logs.values()].sort((x, y) => x.start - y.start), current: current || null, currentU, tomb };
  }

  /* ---------- stats ---------- */
  const actOf = (S, l) => findAct(S, l.act) || { id: l.act, name: l.name || 'Deleted activity', type: l.type || 'noise', icon: l.icon || 'dots', tags: [] };
  const logsForDay = (S, key) => S.logs.filter(l => dayKey(l.start, S.settings.tz) === key).sort((a, b) => a.start - b.start);
  const targetFor = (S, key) => isWeekend(key) ? S.settings.weekendTarget : S.settings.target;
  function hasData(S, key) {
    const tz = S.settings.tz;
    return !!(S.days[key] && S.days[key].wake) || S.logs.some(l => dayKey(l.start, tz) === key) || !!(S.current && dayKey(S.current.start, tz) === key);
  }

  function dayStats(S, key, now = Date.now()) {
    const tz = S.settings.tz, rec = S.days[key] || {};
    const today = key === dayKey(now, tz);
    const logs = logsForDay(S, key).map(l => ({ ...l }));
    if (S.current && dayKey(S.current.start, tz) === key) logs.push({ id: 'running', start: S.current.start, end: now, act: S.current.act, note: S.current.note, tag: S.current.tag, running: true });
    logs.sort((a, b) => a.start - b.start);
    const fallbackWake = atTime(key, S.settings.wake, tz);
    let wake = rec.wake, wakeEst = false;
    if (wake == null) { wake = logs.length ? Math.min(fallbackWake, logs[0].start) : fallbackWake; wakeEst = true; }
    let plannedBed = atTime(key, S.settings.bed, tz);
    if (plannedBed <= wake) plannedBed = wake + 16 * HOUR;
    let end;
    if (rec.bed) end = rec.bed;
    else if (today) end = Math.max(now, wake);
    else end = Math.max(plannedBed, logs.length ? logs[logs.length - 1].end : 0, wake);
    let cursor = wake;
    const segs = [], gaps = [], mins = { signal: 0, upkeep: 0, noise: 0 }, byAct = {}, byTag = {};
    for (const l of logs) {
      const s = Math.max(l.start, cursor), e = Math.min(l.end, end);
      if (e <= s) continue;
      if (s - cursor >= MIN) gaps.push({ s: cursor, e: s });
      const a = actOf(S, l);
      mins[a.type] += e - s;
      byAct[a.id] = (byAct[a.id] || 0) + (e - s);
      if (l.tag) byTag[l.tag] = (byTag[l.tag] || 0) + (e - s);
      segs.push({ s, e, type: a.type, log: l, act: a });
      cursor = e;
    }
    if (end - cursor >= MIN) gaps.push({ s: cursor, e: end, open: today && !rec.bed });
    const awake = Math.max(0, end - wake);
    const denom = Math.max(0, awake - mins.upkeep);                 // upkeep isn't held against you
    const ratio = denom > 0 ? mins.signal / denom : 0;
    const unlogged = Math.max(0, denom - mins.signal - mins.noise);  // unlogged time counts as noise
    return { key, rec, today, wake, wakeEst, end, awake, mins, byAct, byTag, denom, ratio, unlogged, segs, gaps, closed: !!rec.bed, plannedBed, target: targetFor(S, key) };
  }

  function projection(S, st, now = Date.now()) {
    const target = st.target / 100;
    if (st.closed || !st.today) return { state: st.ratio >= target ? 'hit' : 'final', target };
    const remaining = st.plannedBed - now;
    if (remaining <= 0) return { state: 'late', target };
    const D = st.denom + remaining, need = target * D - st.mins.signal;
    if (st.ratio >= target && need <= 0) return { state: 'ahead', target, remaining };
    if (need <= 0) return { state: 'ahead', target, remaining };
    if (need > remaining) return { state: 'out', target, remaining, best: (st.mins.signal + remaining) / D };
    return { state: 'need', target, remaining, need };
  }

  /* ---------- actions (pure state changes; the app and the worker both use these) ---------- */
  function dayRec(S, key) { return (S.days[key] = { ...(S.days[key] || {}) }); }
  function setWake(S, ts, now = ts) { const r = dayRec(S, dayKey(ts, S.settings.tz)); r.wake = ts; r.u = now; }
  function setBed(S, ts, now = ts) {
    if (S.current) stopBlock(S, Math.min(ts, now), now);
    const r = dayRec(S, dayKey(Math.min(ts, now), S.settings.tz)); r.bed = ts; r.u = now;
  }
  function lastTag(S, actId) {
    for (let i = S.logs.length - 1; i >= 0; i--) if (S.logs[i].act === actId && S.logs[i].tag) return S.logs[i].tag;
    return '';
  }
  function startBlock(S, actId, ts, now = ts) {
    const a = findAct(S, actId);
    if (!a) return { ok: false, msg: 'Unknown activity' };
    if (S.current && S.current.act === actId) return { ok: true, already: true, msg: `${a.name} is already running` };
    let stopped = null;
    if (S.current) stopped = stopBlock(S, ts, now);
    const key = dayKey(ts, S.settings.tz);
    if (S.days[key] && S.days[key].bed && S.days[key].bed < ts) { const r = dayRec(S, key); delete r.bed; r.u = now; }   // still up: reopen the day
    S.current = { start: ts, act: actId, note: '', tag: a.tags && a.tags.length ? lastTag(S, actId) : '', u: now };
    S.currentU = now;
    return { ok: true, stopped, msg: `${a.name} started` };
  }
  function stopBlock(S, ts, now = ts) {
    const c = S.current;
    if (!c) return { ok: false, msg: 'Nothing is running' };
    S.current = null; S.currentU = now;
    if (ts - c.start < 30000) return { ok: true, discarded: true, msg: 'Under 30 seconds, so it wasn’t saved' };
    const a = findAct(S, c.act) || {};
    const log = { id: blockId(c), start: c.start, end: ts, act: c.act, name: a.name, type: a.type, icon: a.icon, note: (c.note || '').trim(), tag: c.tag || '', u: now };
    S.logs = S.logs.filter(l => l.id !== log.id); S.logs.push(log);
    return { ok: true, log, msg: `Saved · ${a.name || 'Block'} · ${dur(ts - c.start)}` };
  }
  function deleteLog(S, id, now) { S.logs = S.logs.filter(l => l.id !== id); S.tomb.logs[id] = now; }

  /* Commands from links and iOS Shortcuts: wake, wake!, bed, stop, stopif=<id>, start=<id> */
  function applyCommand(S, cmd, arg, now = Date.now()) {
    const tz = S.settings.tz, key = dayKey(now, tz), rec = S.days[key] || {};
    switch (cmd) {
      case 'wake':
        if (rec.wake) return { changed: false, msg: `Already up since ${clock(rec.wake, tz)}` };
      // falls through
      case 'wake!': setWake(S, now); return { changed: true, msg: `Good morning · up at ${clock(now, tz)}` };
      case 'bed': setBed(S, now); return { changed: true, msg: 'Day closed. Sleep well.' };
      case 'stop': { const r = stopBlock(S, now); return { changed: r.ok, msg: r.msg }; }
      case 'stopif': {
        if (!S.current || S.current.act !== arg) return { changed: false, msg: 'Nothing to stop' };
        const r = stopBlock(S, now); return { changed: true, msg: r.msg };
      }
      case 'start': { const r = startBlock(S, arg, now); return { changed: r.ok && !r.already, msg: r.msg }; }
      default: return { changed: false, msg: 'Unknown command' };
    }
  }

  /* Compact numbers for the home-screen widget. */
  function summary(S, now = Date.now()) {
    const tz = S.settings.tz, key = dayKey(now, tz), st = dayStats(S, key, now), pr = projection(S, st, now);
    const span = Math.max(st.plannedBed, st.end) - st.wake;
    const frac = t => span > 0 ? Math.max(0, Math.min(1, (t - st.wake) / span)) : 0;
    const cur = S.current ? actOf(S, S.current) : null;
    return {
      day: key, pct: Math.round(st.ratio * 100), target: st.target, hit: st.ratio * 100 >= st.target, started: hasData(S, key),
      signalMin: Math.round(st.mins.signal / MIN), noiseMin: Math.round(st.mins.noise / MIN), unloggedMin: Math.round(st.unlogged / MIN), upkeepMin: Math.round(st.mins.upkeep / MIN),
      state: pr.state, needMin: pr.need ? Math.round(pr.need / MIN) : 0, remainingMin: pr.remaining ? Math.round(pr.remaining / MIN) : 0,
      current: cur ? { name: cur.name, type: cur.type, since: S.current.start, sinceText: clock(S.current.start, tz), tag: S.current.tag || '' } : null,
      ring: { now: st.today && !st.closed ? frac(now) : 1, segs: st.segs.map(g => [+frac(g.s).toFixed(4), +frac(g.e).toFixed(4), g.type]) },
      wakeText: st.rec.wake ? clock(st.rec.wake, tz) : '', generatedAt: now,
    };
  }

  const api = {
    MIN, HOUR, DAY_START_H, DEVICE_TZ, COURSES, DEFAULT_ACTS, TYPE_ICON,
    pad, parts, fromLocal, dayKey, parseKey, shiftKey, keyDow, isWeekend, atTime, hhmm, hourOf, clock, dur,
    fresh, normalize, merge, blockId, findAct, actOf, logsForDay, targetFor, hasData, dayStats, projection,
    setWake, setBed, startBlock, stopBlock, deleteLog, lastTag, applyCommand, summary,
  };
  root.SignalCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
