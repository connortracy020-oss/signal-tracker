/* Signal sync — a tiny Cloudflare Worker. One user, one secret key, one KV namespace (binding SIGNAL).
   POST /sync      body = full state → merged with the stored copy; returns the merged copy
   GET  /state     the stored copy
   GET  /do        ?cmd=wake|wake!|bed|stop|stopif|start&act=<id>   (silent iOS Shortcuts commands)
   GET  /gate      ?app=instagram   → "allow" while a pass is active, else "intercept"
   GET  /allow     ?app=instagram&min=10   → grants a pass
   GET  /summary   numbers for the home-screen widget
   GET  /ping
   Auth: "Authorization: Bearer <key>" or ?key=<key>. */
import '../core.js';
const C = globalThis.SignalCore;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
const text = (t, status = 200) => new Response(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...CORS } });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function load(kv) { return C.normalize(await kv.get('state', 'json')) || C.fresh(); }
/* Reads the stored copy in canonical form (merged with itself) so "nothing changed" compares equal. */
async function loadCanon(kv) {
  const S = C.normalize(await kv.get('state', 'json')) || C.fresh();
  const canon = C.merge(S, S);
  return { S: canon, before: JSON.stringify(canon) };
}
async function store(kv, S, before) {
  const body = JSON.stringify(S);
  if (body !== before) await kv.put('state', body);     // KV's free tier counts writes, so skip no-op ones
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const key = auth || url.searchParams.get('key') || '';
    const secret = (env.SYNC_KEY || '').replace(/^﻿/, '').trim();   // PowerShell pipes can add a BOM / CRLF
    if (!secret || !safeEqual(key, secret)) return json({ error: 'unauthorized' }, 401);
    const kv = env.SIGNAL, now = Date.now();
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/ping') return json({ ok: true, now });

      if (path === '/state') return json(await load(kv));

      if (path === '/sync' && req.method === 'POST') {
        const incoming = C.normalize(await req.json().catch(() => null));
        if (!incoming) return json({ error: 'bad state' }, 400);
        const { S, before } = await loadCanon(kv);
        const merged = C.merge(S, incoming);
        await store(kv, merged, before);
        return json(merged);
      }

      if (path === '/do') {
        const cmd = (url.searchParams.get('cmd') || '').toLowerCase(), act = url.searchParams.get('act') || '';
        const { S, before } = await loadCanon(kv);
        const r = C.applyCommand(S, cmd, act, now);
        if (r.changed) await store(kv, C.merge(S, S), before);
        return text(r.msg, r.msg === 'Unknown command' ? 400 : 200);
      }

      if (path === '/gate') {
        const app = (url.searchParams.get('app') || '').toLowerCase();
        const allow = (await kv.get('allow', 'json')) || {};
        return text((allow[app] || 0) > now ? 'allow' : 'intercept');
      }

      if (path === '/allow') {
        const app = (url.searchParams.get('app') || '').toLowerCase();
        const min = Math.min(120, Math.max(1, Number(url.searchParams.get('min')) || 10));
        if (!app) return text('missing app', 400);
        const allow = (await kv.get('allow', 'json')) || {};
        for (const k of Object.keys(allow)) if (allow[k] < now) delete allow[k];
        allow[app] = now + min * 60000;
        await kv.put('allow', JSON.stringify(allow));
        return text(`ok · ${app} for ${min} min`);
      }

      if (path === '/summary') return json(C.summary(await load(kv), now));

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server error' }, 500);
    }
  },
};
