// Signal — home-screen widget for Scriptable (https://scriptable.app).
// Paste into a new Scriptable script named "Signal", then add a Scriptable widget and pick this script.
// Settings → Copy widget script in Signal fills in the three values below for you.
const SYNC_URL = '__SYNC_URL__';
const SYNC_KEY = '__SYNC_KEY__';
const APP_URL = '__APP_URL__';

const DARK = Device.isUsingDarkAppearance();
const P = DARK
  ? { bg: new Color('#1A1816'), ink: new Color('#EFE9DF'), ink3: new Color('#8F877D'), track: new Color('#2A2724'), signal: new Color('#8CC49A'), noise: new Color('#E0895F'), upkeep: new Color('#5E574E'), accent: new Color('#E0895F') }
  : { bg: new Color('#F4EFE6'), ink: new Color('#1C1A17'), ink3: new Color('#807870'), track: new Color('#E6DED1'), signal: new Color('#3F7A4E'), noise: new Color('#B4532A'), upkeep: new Color('#B3A898'), accent: new Color('#B4532A') };

const fmt = m => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`);

async function load() {
  const r = new Request(`${SYNC_URL.replace(/\/+$/, '')}/summary`);
  r.headers = { Authorization: `Bearer ${SYNC_KEY}` };
  r.timeoutInterval = 12;
  return await r.loadJSON();
}

// Scriptable's Path has no arc, so arcs are drawn as short straight segments.
function arcPoints(c, r, f0, f1) {
  const pts = [], steps = Math.max(2, Math.ceil((f1 - f0) * 200));
  for (let i = 0; i <= steps; i++) {
    const f = f0 + (f1 - f0) * i / steps, a = (f * 360 - 90) * Math.PI / 180;
    pts.push(new Point(c + r * Math.cos(a), c + r * Math.sin(a)));
  }
  return pts;
}
function strokeArc(ctx, c, r, f0, f1, color, width) {
  const p = new Path();
  p.addLines(arcPoints(c, r, f0, f1));
  ctx.addPath(p); ctx.setStrokeColor(color); ctx.setLineWidth(width); ctx.strokePath();
}
function serif(size) { const f = new Font('Georgia-Italic', size); return f || Font.italicSystemFont(size); }

function drawRing(d, size) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size); ctx.opaque = false; ctx.respectScreenScale = true;
  const c = size / 2, R1 = size * 0.44, W1 = size * 0.075, R2 = size * 0.35, W2 = size * 0.05;
  strokeArc(ctx, c, R1, 0, 1, P.track, W1);
  for (const [f0, f1, type] of d.ring.segs) if (f1 - f0 > 0.003) strokeArc(ctx, c, R1, f0 + 0.002, f1 - 0.002, P[type] || P.ink3, W1);
  strokeArc(ctx, c, R2, 0, 1, P.track, W2);
  if (d.pct > 0) strokeArc(ctx, c, R2, 0, Math.min(1, d.pct / 100), P.signal, W2);
  const a = (d.target / 100 * 360 - 90) * Math.PI / 180, tick = new Path();
  tick.move(new Point(c + (R2 - W2) * Math.cos(a), c + (R2 - W2) * Math.sin(a)));
  tick.addLine(new Point(c + (R2 + W2) * Math.cos(a), c + (R2 + W2) * Math.sin(a)));
  ctx.addPath(tick); ctx.setStrokeColor(P.ink); ctx.setLineWidth(size * 0.014); ctx.strokePath();
  if (d.ring.now < 1 && d.started) {
    const an = (d.ring.now * 360 - 90) * Math.PI / 180, x = c + R1 * Math.cos(an), y = c + R1 * Math.sin(an), rd = size * 0.03;
    ctx.setFillColor(P.ink); ctx.fillEllipse(new Rect(x - rd, y - rd, rd * 2, rd * 2));
  }
  ctx.setTextAlignedCenter();
  ctx.setFont(serif(size * 0.21)); ctx.setTextColor(d.hit ? P.signal : P.accent);
  ctx.drawTextInRect(d.started ? `${d.pct}%` : '—', new Rect(0, c - size * 0.14, size, size * 0.26));
  ctx.setFont(Font.mediumMonospacedSystemFont(size * 0.05)); ctx.setTextColor(P.ink3);
  ctx.drawTextInRect(`TARGET ${d.target}`, new Rect(0, c + size * 0.1, size, size * 0.08));
  return ctx.getImage();
}

async function build() {
  const w = new ListWidget();
  w.backgroundColor = P.bg; w.url = APP_URL; w.setPadding(12, 12, 12, 12);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  let d;
  try { d = await load(); } catch (e) {
    const t = w.addText('Signal can’t reach your sync worker.'); t.font = Font.systemFont(12); t.textColor = P.ink3;
    return w;
  }
  if (config.widgetFamily === 'small') {
    const img = w.addImage(drawRing(d, 320)); img.centerAlignImage();
    return w;
  }
  const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent();
  const img = row.addImage(drawRing(d, 320)); img.imageSize = new Size(128, 128);
  row.addSpacer(14);
  const col = row.addStack(); col.layoutVertically();
  const add = (txt, font, color) => { const t = col.addText(txt); t.font = font; t.textColor = color; t.lineLimit = 2; t.minimumScaleFactor = 0.8; return t; };
  add('SIGNAL TODAY', Font.mediumMonospacedSystemFont(10), P.accent);
  col.addSpacer(5);
  if (d.current) {
    add(`${d.current.name}${d.current.tag ? ' · ' + d.current.tag : ''}`, Font.semiboldSystemFont(15), P[d.current.type] || P.ink);
    add(`running since ${d.current.sinceText}`, Font.systemFont(11), P.ink3);
  } else {
    add(d.started ? 'Nothing running' : 'Log your wake-up', Font.semiboldSystemFont(15), P.ink);
  }
  col.addSpacer(6);
  const msg = { need: `Need ${fmt(d.needMin)} more signal`, ahead: `Banked enough for ${d.target}%`, out: `${d.target}% is out of reach`, late: 'Time to wrap up', hit: 'Target hit', final: `Closed at ${d.pct}%` }[d.state] || `${d.pct}% so far`;
  add(msg, Font.systemFont(12.5), P.ink);
  add(`${fmt(d.signalMin)} signal · ${fmt(d.noiseMin + d.unloggedMin)} noise`, Font.systemFont(11), P.ink3);
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
