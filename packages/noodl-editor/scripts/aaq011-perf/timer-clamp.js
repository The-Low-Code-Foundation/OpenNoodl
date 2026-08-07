/**
 * AAQ-011 F6 — what `setTimeout` costs in a window that is not on screen.
 *
 * The load-bearing measurement behind F6's closure, and the one the editor's own
 * renderer cannot give you cheaply: a driver has to occlude the editor to
 * measure it, and occluding the editor is what the CDP drivers do anyway. So
 * this asks the question of a bare `BrowserWindow` built with **the editor's own
 * webPreferences** — which means `backgroundThrottling` left at Electron's
 * default, exactly as `src/main/main.js:311` leaves it.
 *
 * Three samples, because Chromium throttles hidden pages in two tiers:
 *
 *   on-screen     the baseline
 *   hidden 2s     the 1-second clamp every hidden page gets
 *   hidden 5m30s  the "intensive" tier, which a page hidden for five minutes
 *                 gets, and where a single wait can run many seconds
 *
 * A `MessagePort` round trip is measured beside each one. It is a macrotask like
 * a timer — it yields to the event loop, so a panel still renders between
 * fragments — and it is not a timer, so none of this reaches it. That is why
 * `aaq40-live/wizard-replay.js` paces with one.
 *
 * Run it (the whole thing takes about six minutes, nearly all of it waiting):
 *
 *   node_modules/.bin/electron packages/noodl-editor/scripts/aaq011-perf/timer-clamp.js
 *   node_modules/.bin/electron packages/noodl-editor/scripts/aaq011-perf/timer-clamp.js --quick
 *
 * `--quick` skips the five-minute wait. Results land on stdout and in
 * `<repo>/.logs/aaq011-timer-clamp.json`, because `app.exit` does not flush
 * stdout reliably.
 *
 * ⚠️ It will not start while several other Electron instances from this same
 * bundle are running — the child process fails its Mach port rendezvous. Run it
 * when the editor suite is not running.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const QUICK = process.argv.includes('--quick');
const OUT_DIR = path.join(__dirname, '..', '..', '..', '..', '.logs');
const OUT = path.join(OUT_DIR, 'aaq011-timer-clamp.json');

const results = { stage: 'start', quick: QUICK };
function record() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Eight `setTimeout(10)` and eight `MessagePort` round trips, in the renderer. */
const PROBE = `(async () => {
  const timeouts = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 10));
    timeouts.push(Math.round(performance.now() - t0));
  }
  const ports = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    await new Promise((r) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => r();
      channel.port2.postMessage(0);
    });
    ports.push(Math.round((performance.now() - t0) * 100) / 100);
  }
  return {
    visibility: document.visibilityState,
    setTimeoutMs: timeouts,
    setTimeoutTotalMs: timeouts.reduce((a, b) => a + b, 0),
    messagePortTotalMs: Math.round(ports.reduce((a, b) => a + b, 0) * 100) / 100
  };
})()`;

record();

app
  .whenReady()
  .then(async () => {
    // Shown first and hidden afterwards, deliberately: `executeJavaScript` on a
    // window that has never been shown does not resolve, so a `show: false`
    // window measures nothing at all rather than measuring the hidden case.
    const win = new BrowserWindow({
      width: 700,
      height: 500,
      show: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    // Electron rejects an `about:blank` load that it also completes; the page is
    // there either way, which is all this needs.
    win.loadURL('about:blank').catch(() => undefined);
    await sleep(1500);

    results.stage = 'on-screen';
    record();
    results.onScreen = await win.webContents.executeJavaScript(PROBE);
    record();

    win.hide();
    await sleep(2000);
    results.stage = 'hidden-2s';
    record();
    results.hidden2s = await win.webContents.executeJavaScript(PROBE);
    record();

    if (!QUICK) {
      results.stage = 'waiting-5m30s-hidden';
      record();
      await sleep(330_000);
      results.stage = 'hidden-5m30s';
      record();
      results.hidden5m30s = await win.webContents.executeJavaScript(PROBE);
    }

    results.stage = 'done';
    record();
    process.stdout.write(JSON.stringify(results, null, 1) + '\n');
    setTimeout(() => app.exit(0), 200);
  })
  .catch((error) => {
    results.stage = `failed: ${error && error.message}`;
    record();
    app.exit(1);
  });
