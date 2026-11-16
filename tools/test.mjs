/* node tools/test.mjs — tests for core.js (time zones, merge, commands, stats) and the sync worker. */
import '../core.js';
import worker from '../worker/index.mjs';
const C = globalThis.SignalCore;
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const M = 60000, H = 3600000;
const TZ = 'America/Los_Angeles';

/* ---- time zones: the worker runs in UTC but must agree with a phone in Oregon ---- */
const t = Date.UTC(2026, 10, 16, 9, 30);           // 1:30 am PST on Nov 16 → still Nov 15's day
ok(C.dayKey(t, TZ) === '2026-11-15', 'late night belongs to previous day', C.dayKey(t, TZ));
ok(C.dayKey(Date.UTC(2026, 10, 16, 13, 0), TZ) === '2026-11-16', '5 am PST starts new day');
ok(C.clock(Date.UTC(2026, 10, 15, 15, 42), TZ) === '7:42 AM', 'clock in tz', C.clock(Date.UTC(2026, 10, 15, 15, 42), TZ));
ok(C.atTime('2026-11-15', '08:00', TZ) === Date.UTC(2026, 10, 15, 16, 0), 'atTime PST');
ok(C.atTime('2026-11-15', '00:30', TZ) === Date.UTC(2026, 10, 16, 8, 30), 'atTime after midnight is next calendar day');
ok(C.atTime('2026-07-15', '08:00', TZ) === Date.UTC(2026, 6, 15, 15, 0), 'atTime PDT (summer)');
ok(C.atTime('2026-03-08', '08:00', TZ) === Date.UTC(2026, 2, 8, 15, 0), 'atTime on DST change day');
ok(C.isWeekend('2026-11-15') && !C.isWeekend('2026-11-16'), 'weekend detection (Sun yes, Mon no)');

/* ---- stats ---- */
function mkState() { const S = C.fresh(); S.settings.tz = TZ; return S; }
function log(S, act, s, e, extra = {}) { const a = C.findAct(S, act); const l = { id: 'l' + Math.random().toString(36).slice(2), start: s, end: e, act, name: a.name, type: a.type, icon: a.icon, note: '', tag: '', u: 1, ...extra }; S.logs.push(l); return l; }
{
  const S = mkState(), wake = Date.UTC(2026, 10, 16, 16, 0); // Mon 8 am
  C.setWake(S, wake);
  log(S, 'ready', wake, wake + 30 * M);
  log(S, 'homebase', wake + 30 * M, wake + 150 * M, { tag: 'ECE 201' });
  log(S, 'scrolling', wake + 150 * M, wake + 180 * M);
  log(S, 'canvas', wake + 210 * M, wake + 270 * M);
  const now = wake + 300 * M, st = C.dayStats(S, '2026-11-16', now);
  ok(st.mins.signal === 180 * M && st.mins.noise === 30 * M && st.mins.upkeep === 30 * M, 'minutes by type');
  ok(Math.round(st.unlogged / M) === 60 && Math.abs(st.ratio - 180 / 270) < 1e-9, 'ratio + unlogged', { r: st.ratio, u: st.unlogged / M });
  ok(st.gaps.length === 2 && st.gaps[1].open, 'gaps found, last one open', st.gaps);
  ok(st.byTag['ECE 201'] === 120 * M, 'per-course time');
  ok(st.target === 80, 'weekday target 80');
  const pr = C.projection(S, st, now);
  ok(pr.state === 'need' && pr.need > 0, 'projection says need more', pr);
  const sum = C.summary(S, now);
  ok(sum.pct === 67 && sum.ring.segs.length === 4 && sum.needMin === Math.round(pr.need / M), 'summary for widget', sum);
}
{ // overlapping blocks never double count; weekend target applies on Sunday
  const S = mkState(); S.settings.weekendTarget = 60;
  const w = Date.UTC(2026, 10, 15, 17, 0); C.setWake(S, w);
  log(S, 'study', w, w + 120 * M); log(S, 'canvas', w + 60 * M, w + 180 * M);
  const st = C.dayStats(S, '2026-11-15', w + 240 * M);
  ok(st.mins.signal === 180 * M, 'overlap not double counted', st.mins.signal / M);
  ok(st.target === 60, 'weekend target used on Sunday');
}

/* ---- actions + commands ---- */
{
  const S = mkState(), t0 = Date.UTC(2026, 10, 16, 17, 0);
  let r = C.applyCommand(S, 'wake', '', t0);
  ok(r.changed && S.days['2026-11-16'].wake === t0, 'wake command');
  r = C.applyCommand(S, 'wake', '', t0 + 5 * M);
  ok(!r.changed && /Already up/.test(r.msg), 'second wake ignored', r.msg);
  C.applyCommand(S, 'start', 'scrolling', t0 + 10 * M);
  r = C.applyCommand(S, 'start', 'scrolling', t0 + 11 * M);
  ok(!r.changed && S.current.start === t0 + 10 * M, 'starting the running activity is a no-op');
  r = C.applyCommand(S, 'stopif', 'youtube', t0 + 20 * M);
  ok(!r.changed && S.current, 'stopif for another app leaves block running');
  r = C.applyCommand(S, 'stopif', 'scrolling', t0 + 25 * M);
  ok(r.changed && !S.current && S.logs.length === 1 && S.logs[0].end - S.logs[0].start === 15 * M, 'stopif stops matching block');
  C.applyCommand(S, 'start', 'homebase', t0 + 30 * M);
  C.applyCommand(S, 'start', 'canvas', t0 + 90 * M);
  ok(S.logs.length === 2 && S.current.act === 'canvas', 'start switches and saves previous');
  C.applyCommand(S, 'bed', '', t0 + 600 * M);
  ok(!S.current && S.days['2026-11-16'].bed === t0 + 600 * M && S.logs.length === 3, 'bed closes day and stops block');
  C.startBlock(S, 'reading', t0 + 610 * M);
  ok(!S.days['2026-11-16'].bed, 'starting after bed reopens the day');
  const n = S.logs.length; C.applyCommand(S, 'start', 'nope', t0 + 620 * M);
  ok(S.logs.length === n && S.current.act === 'reading', 'unknown activity ignored');
  // tags remembered per activity
  const S2 = mkState(); log(S2, 'homebase', 1000, 2000, { tag: 'MTH 254' });
  C.startBlock(S2, 'homebase', 5000);
  ok(S2.current.tag === 'MTH 254', 'last course tag reused');
}

/* ---- merge ---- */
{
  const base = mkState(); base.settings.u = 1;
  const A = C.normalize(JSON.parse(JSON.stringify(base))), B = C.normalize(JSON.parse(JSON.stringify(base)));
  const la = log(A, 'study', 1e12, 1e12 + H, { u: 10 });
  const lb = log(B, 'canvas', 1e12 + 2 * H, 1e12 + 3 * H, { u: 11 });
  let m = C.merge(A, B);
  ok(m.logs.length === 2, 'union of logs');
  // edit on B wins over older A
  const B2 = C.normalize(JSON.parse(JSON.stringify(m))); B2.logs.find(l => l.id === la.id).note = 'edited'; B2.logs.find(l => l.id === la.id).u = 20;
  m = C.merge(m, B2);
  ok(m.logs.find(l => l.id === la.id).note === 'edited', 'newer edit wins');
  // delete on A survives a stale B
  const A2 = C.normalize(JSON.parse(JSON.stringify(m))); C.deleteLog(A2, lb.id, 30);
  m = C.merge(B2, A2);
  ok(!m.logs.find(l => l.id === lb.id), 'tombstone beats stale copy');
  ok(!C.merge(m, B2).logs.find(l => l.id === lb.id), 'and stays deleted on re-merge');
  // settings newest wins
  const A3 = C.normalize(JSON.parse(JSON.stringify(m))); A3.settings.weekendTarget = 70; A3.settings.u = 40;
  ok(C.merge(m, A3).settings.weekendTarget === 70 && C.merge(A3, m).settings.weekendTarget === 70, 'settings LWW both directions');
  // commutative-ish: same result both orders
  const x = C.merge(A, B), y = C.merge(B, A);
  ok(JSON.stringify(x.logs.map(l => l.id).sort()) === JSON.stringify(y.logs.map(l => l.id).sort()), 'merge order independent (logs)');
  // concurrent running blocks: loser becomes a log ending where winner started
  const P = mkState(), Q = mkState();
  C.startBlock(P, 'homebase', 1e12, 1e12);          // phone started Homebase
  C.startBlock(Q, 'scrolling', 1e12 + 20 * M, 1e12 + 20 * M);  // shortcut started Scrolling later
  m = C.merge(P, Q);
  ok(m.current.act === 'scrolling' && m.logs.length === 1 && m.logs[0].act === 'homebase' && m.logs[0].end === 1e12 + 20 * M, 'concurrent blocks: earlier one saved', m.logs);
  ok(C.merge(m, P).logs.length === 1 && C.merge(m, P).current.act === 'scrolling', 'idempotent after merging again');
  // a stopped block on one side and the same block still running on stale side → stays stopped, one log
  const R = C.normalize(JSON.parse(JSON.stringify(P))); C.stopBlock(R, 1e12 + 50 * M, 1e12 + 50 * M);
  m = C.merge(P, R);
  ok(!m.current && m.logs.length === 1 && m.logs[0].end === 1e12 + 50 * M, 'stop wins over stale running copy', m.logs);
  // v1 data migrates
  const v1 = { v: 1, settings: { target: 75, wake: '07:00', bed: '23:30' }, activities: [{ id: 'homebase', name: 'Homebase', type: 'signal', icon: 'layers' }], days: { '2026-11-15': { wake: 5 } }, logs: [{ id: 'a', start: 1, end: 2, act: 'homebase' }], current: null };
  const mig = C.normalize(v1);
  ok(mig && mig.v === 2 && mig.settings.target === 75 && mig.settings.weekendTarget === 80 && mig.activities[0].tags.length === 3 && mig.logs[0].u === 1, 'v1 migrates to v2', mig && mig.settings);
  ok(C.normalize({ v: 3 }) === null && C.normalize('x') === null, 'junk rejected');
}

/* ---- worker ---- */
const mem = new Map();
const env = { SYNC_KEY: 'k3y-secret', SIGNAL: { async get(k, ty) { const v = mem.get(k); return v == null ? null : ty === 'json' ? JSON.parse(v) : v; }, async put(k, v) { mem.set(k, v); puts++; } } };
let puts = 0;
const call = (p, opts = {}) => worker.fetch(new Request('https://w.test' + p, opts), env);
{
  ok((await call('/ping')).status === 401, 'no key → 401');
  ok((await call('/ping?key=wrong')).status === 401, 'wrong key → 401');
  ok((await call('/ping', { headers: { authorization: 'Bearer k3y-secret' } })).status === 200, 'bearer key ok');
  ok((await call('/ping', { method: 'OPTIONS' })).status === 204, 'CORS preflight');
  const S = mkState(); C.setWake(S, Date.now() - 2 * H); log(S, 'study', Date.now() - 90 * M, Date.now() - 30 * M, { u: Date.now() });
  let r = await call('/sync?key=k3y-secret', { method: 'POST', body: JSON.stringify(S) });
  const merged = await r.json();
  ok(r.status === 200 && merged.logs.length === 1, 'sync stores and returns state');
  const before = puts;
  await call('/sync?key=k3y-secret', { method: 'POST', body: JSON.stringify(merged) });
  ok(puts === before, 'no-op sync does not write KV');
  r = await call('/do?key=k3y-secret&cmd=start&act=scrolling');
  ok((await r.text()) === 'Scrolling started', 'do start');
  r = await call('/do?key=k3y-secret&cmd=start&act=scrolling');
  ok(/already running/.test(await r.text()), 'do start again is a no-op');
  const st = await (await call('/state?key=k3y-secret')).json();
  ok(st.current && st.current.act === 'scrolling', 'server state has running block');
  // phone syncs its stale copy: running block from the shortcut must survive
  const back = await (await call('/sync?key=k3y-secret', { method: 'POST', body: JSON.stringify(merged) })).json();
  ok(back.current && back.current.act === 'scrolling', 'stale phone copy does not erase shortcut block');
  ok((await (await call('/gate?key=k3y-secret&app=instagram')).text()) === 'intercept', 'gate intercepts by default');
  await call('/allow?key=k3y-secret&app=instagram&min=10');
  ok((await (await call('/gate?key=k3y-secret&app=instagram')).text()) === 'allow', 'gate allows after pass');
  ok((await (await call('/gate?key=k3y-secret&app=youtube')).text()) === 'intercept', 'pass is per app');
  const sum = await (await call('/summary?key=k3y-secret')).json();
  ok(typeof sum.pct === 'number' && sum.current && sum.current.name === 'Scrolling', 'summary', sum);
  ok((await call('/sync?key=k3y-secret', { method: 'POST', body: '{"v":9}' })).status === 400, 'bad state rejected');
  ok((await call('/do?key=k3y-secret&cmd=zzz')).status === 400, 'bad command → 400');
  ok((await call('/nope?key=k3y-secret')).status === 404, 'unknown path → 404');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
