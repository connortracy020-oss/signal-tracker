# Signal 2.0

A phone-first web app (PWA) that tracks your signal-to-noise ratio, in the Humanizer design family
(Newsreader + Geist + Geist Mono, paper palette, terracotta accent, bundled fonts).

## How it counts

- Wake-up starts the day; **Good night** (in the wrap-up) closes it. A day runs 4 am to 4 am.
- Every activity is **Signal**, **Upkeep** or **Noise** (editable). `ratio = signal ÷ (awake − upkeep)`.
  Unlogged time counts as noise, so skipping the log never helps.
- Targets: weekdays **80%**, weekends their own setting (also 80% by default). Both live in Settings.

## What's in it

- **Today:** the day ring (outer = your day block by block, hatched = unlogged, dot = now; inner = ratio with the
  target notch), what you still need before bed, yesterday / 7-day / streak chips, one-tap tiles ranked by what you
  usually do at this hour, a "what was 1:41–2:11?" card that fills a gap in one tap, a swipeable timeline
  (swipe left → Edit / Delete), and a wrap-up screen at night that settles leftover gaps.
- **Now bar** on every tab while a block runs: timer, Stop, tap for course chips (ECE 201 / MTH 254 / ECE 200),
  note, backdating the start, Switch, Discard. Every change offers **Undo**.
- **History:** weekly average and change vs last week, 14-day bars with per-day target ticks, rule-based insights
  (best hours, noise peak, biggest leak, wake-time effect, unlogged share, weekday vs weekend), wake-time trend,
  where the time went, time per course, and every day with a mini ring.
- **Intro**, Add-to-Home-Screen guide (Safari only), ambient glow that follows the day, paper grain, spring motion,
  iOS 18 haptics, dark mode.

## Sync (optional, needed for Shortcuts, the pause screen and the widget)

iOS opens links in Safari, not in the installed app, and the two keep separate storage. So Shortcuts can't write
to the app directly. Sync fixes that: a tiny Cloudflare Worker (`worker/index.mjs`, free tier) holds a copy.
Copies merge per item (newest edit wins; deletions are tombstones).

1. `powershell -ExecutionPolicy Bypass -File tools\deploy-sync.ps1`: signs you in to Cloudflare (browser),
   creates the KV store, deploys, sets a random key, and prints the URL and key.
2. In Signal → Settings → Sync, paste them. **Copy setup link** connects Safari or another device.
3. Settings → "Let iOS log for you" lists ready-made Shortcuts automations with copyable links:
   alarm → wake-up, Sleep Focus → bedtime, Instagram opened → pause screen (gate + intercept),
   Instagram closed → stop, gym arrive/leave → workout, NFC desk tag → studying.

Worker API: `POST /sync`, `GET /state`, `GET /do?cmd=wake|wake!|bed|stop|stopif|start&act=<id>`,
`GET /gate?app=`, `GET /allow?app=&min=`, `GET /summary`, `GET /ping`. Auth: `Authorization: Bearer <key>` or `?key=`.

## Home-screen widget

`widget/signal-widget.js` is a Scriptable script. Settings → **Copy widget script** fills in your sync URL and key.

## Develop

- `node tools/dev-server.mjs`: app on http://localhost:8790, the real worker on :8791 with in-memory storage (key `dev-key`).
- `node tools/test.mjs`: 55 tests for time zones (incl. DST), stats, commands, merging and the worker endpoints.
- `python tools/make_icons.py` redraws the icons.

Files: `index.html` (shell), `styles.css`, `core.js` (data rules, shared with the worker), `app.js` (interface),
`sw.js` (offline), `manifest.webmanifest`, `fonts/`, `worker/`, `widget/`, `tools/`.

## Install on iPhone

Host the folder over HTTPS (for example GitHub Pages), open it in **Safari**, Share → **Add to Home Screen**.
