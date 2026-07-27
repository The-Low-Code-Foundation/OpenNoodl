#!/usr/bin/env node
/**
 * UIX-009 screenshot-corpus harness.
 *
 * Drives the *real* editor over raw CDP (one WebSocket session — the
 * choreography-over-one-session rule from RUN-003's traps) and captures a named
 * set of surfaces in BOTH themes into a dated folder. No dependencies: Node ≥ 21's
 * native WebSocket + the CDP HTTP discovery endpoint. This is the phase's
 * verification instrument — "did we regress the UI" becomes a diffable question.
 *
 * Determinism (so a diff means something):
 *   - fixed device-metrics size (Emulation.setDeviceMetricsOverride)
 *   - every animation/transition/caret killed via an injected stylesheet
 *   - prefers-reduced-motion forced
 *   - theme driven declaratively (data-theme attr + the nodegx:themechanged event
 *     the canvas repaints on) rather than through the async settings round-trip
 *
 * Prerequisite: a dev editor with a CDP endpoint is already up —
 *   nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
 *   until grep -q "launching Electron" .logs/dev.log; do sleep 15; done ; sleep 30
 * Editor captures need a project open; launcher captures need the launcher shown.
 * The harness captures whatever state each target is in and skips what is absent,
 * so it never hard-fails on a missing surface — it reports what it got.
 *
 *   node capture.mjs [--out DIR] [--cdp http://localhost:9222] [--label NAME]
 *
 * See ./run.sh for the one-command wrapper and ./README.md for the recipe.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const CDP = arg('--cdp', 'http://localhost:9222');
// Default is the phase-23 reference size. PNL-001 needs a *short* window — the
// side-panel scroll defects only reproduce when content is taller than the
// panel — so the size is overridable rather than baked in.
const WIDTH = Number(arg('--width', 1600));
const HEIGHT = Number(arg('--height', 1000));
// One dated folder per run, so before/after live side by side under corpus/.
const stamp = arg('--label', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
const OUT = arg('--out', path.join(__dirname, 'captures', stamp));
const THEMES = ['dark', 'light'];

fs.mkdirSync(OUT, { recursive: true });
const manifest = []; // {surface, theme, file}

// ---- tiny CDP client (one socket, sequential) ------------------------------
class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`${CDP}/json`)).json();
  // The editor renderer: a page whose URL is the editor index (not devtools, not
  // the preview webview). Prefer a title carrying the product name.
  const page =
    list.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/devtools/.test(t.url)) ||
    list.find((t) => t.type === 'page' && !/devtools/.test(t.url));
  if (!page) throw new Error('No editor CDP page target found — is dev:debug running?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return new CdpSession(ws);
}

// ---- helpers ----------------------------------------------------------------
async function evalJS(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 80));
  return r.result.value;
}

async function setTheme(cdp, theme) {
  // Replicate ThemeManager.apply()'s DOM contract directly: stamp the attribute
  // and fire the canvas-repaint event. Bypasses the async EditorSettings round-trip
  // so the capture is synchronous and deterministic.
  await evalJS(
    cdp,
    `(() => {
      document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
      window.dispatchEvent(new CustomEvent('nodegx:themechanged'));
      return document.documentElement.getAttribute('data-theme');
    })()`
  );
  await sleep(400); // let the canvas repaint + CSS vars settle
}

async function shot(cdp, surface, theme) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = `${surface}--${theme}.png`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(data, 'base64'));
  manifest.push({ surface, theme, file });
  console.log(`  captured ${file}`);
}

async function exists(cdp, selector) {
  return evalJS(cdp, `!!document.querySelector(${JSON.stringify(selector)})`);
}

async function clickSel(cdp, selector) {
  // Trusted click via Input dispatch (React handlers + :active behave as real).
  const box = await evalJS(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    })()`
  );
  if (!box || box.w === 0) return false;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', {
      type,
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: 1
    });
  }
  await sleep(600);
  return true;
}

async function injectDeterminism(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await evalJS(
    cdp,
    `(() => {
      let s = document.getElementById('__uix009_determinism');
      if (!s) { s = document.createElement('style'); s.id = '__uix009_determinism'; document.head.appendChild(s); }
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
      return true;
    })()`
  );
}

// ---- surface recipes --------------------------------------------------------
// Each recipe knows how to reach a surface and returns true if it captured.
// They are best-effort: a surface that isn't reachable in the current editor
// state is skipped, not fatal.

async function captureLauncher(cdp, theme) {
  // The launcher is its own window/state. Heuristic: a projects grid / launcher root.
  const isLauncher = await evalJS(
    cdp,
    `!!(document.querySelector('[class*="Launcher"],[class*="launcher"],[class*="ProjectsView"],[class*="ProjectGrid"]'))`
  );
  if (!isLauncher) return false;
  await shot(cdp, 'launcher', theme);
  return true;
}

async function captureEditorAndPanels(cdp, theme) {
  // Is a project open? The node-graph editor canvas / the rail is the tell.
  const inEditor = await evalJS(
    cdp,
    `!!(document.querySelector('canvas') && document.querySelector('[data-test]'))`
  );
  if (!inEditor) return false;

  await shot(cdp, 'editor', theme);

  // Self-discover every rail panel button and walk them all (the menu-walk).
  const railButtons = await evalJS(
    cdp,
    `Array.from(document.querySelectorAll('[data-test]'))
      .filter(el => el.offsetParent !== null && /nav|sidebar|panel|rail|toolbar/i.test(el.className + ' ' + (el.closest('[class]')?.className||'')))
      .map(el => el.getAttribute('data-test'))
      .filter((v,i,a)=>v && a.indexOf(v)===i)`
  );

  for (const testId of railButtons) {
    const sel = `[data-test="${testId}"]`;
    const clicked = await clickSel(cdp, sel);
    if (!clicked) continue;
    const safe = testId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    await shot(cdp, `panel-${safe}`, theme);
  }
  return true;
}

// ---- main -------------------------------------------------------------------
(async () => {
  console.log(`UIX-009 corpus → ${OUT}`);
  const cdp = await connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await injectDeterminism(cdp);

  let anyEditor = false;
  let anyLauncher = false;
  for (const theme of THEMES) {
    console.log(`\n[theme: ${theme}]`);
    await setTheme(cdp, theme);
    // reinject determinism CSS (a panel remount can drop the injected <style>)
    await injectDeterminism(cdp);
    anyLauncher = (await captureLauncher(cdp, theme)) || anyLauncher;
    anyEditor = (await captureEditorAndPanels(cdp, theme)) || anyEditor;
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ stamp, width: WIDTH, height: HEIGHT, manifest }, null, 2));
  console.log(`\nDone. ${manifest.length} captures.`);
  if (!anyLauncher && !anyEditor) {
    console.log('WARNING: neither launcher nor an open editor project was found — nothing meaningful captured.');
  }
  process.exit(0);
})().catch((err) => {
  console.error('capture failed:', err.message);
  process.exit(1);
});
