#!/usr/bin/env node
/**
 * PNL-001 panel-geometry gate.
 *
 * The regression instrument for the side panel's scroll and box model. It walks
 * every registered rail panel at a **short** window height — the condition the
 * defects need — and asserts two things per panel:
 *
 *   1. Every scroll container reaches its own last pixel. After
 *      `scrollTo(0, scrollHeight)`, `scrollHeight - scrollTop - clientHeight <= 1`.
 *   2. **No descendant clips content it cannot scroll.** Any element whose
 *      `scrollHeight` exceeds its `clientHeight` while its computed `overflow-y`
 *      is `hidden`/`clip` is content the user can never reach. This is the
 *      assertion that catches the flex-squeeze defect, and it is the one worth
 *      having: the panel looks fine, the sentence just ends.
 *
 * Lives beside the phase-23 screenshot corpus because it shares its harness
 * shape — one raw CDP socket, no dependencies, drives the real editor.
 *
 * Prerequisite: a dev editor with a CDP endpoint, **with a project open** (the
 * rail does not exist at the launcher):
 *   nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
 *   until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
 *
 * Usage:
 *   node panel-geometry.mjs [--width 1280] [--height 720] [--json out.json]
 *
 * Exits non-zero if any panel has unreachable content.
 */

import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const CDP = arg('--cdp', 'http://localhost:9222');
// 1280x720 is deliberately shorter than the 13-inch laptop the defects were
// reported on. A tall window hides all of this.
const WIDTH = Number(arg('--width', 1280));
const HEIGHT = Number(arg('--height', 720));
const JSON_OUT = arg('--json', null);

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
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/devtools/.test(t.url));
  if (!page) throw new Error('No editor CDP page target found — is dev:debug running?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return new CdpSession(ws);
}

async function evalJS(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 100));
  return r.result.value;
}

async function clickSel(cdp, selector) {
  const box = await evalJS(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
    })()`
  );
  if (!box || box.w === 0) return false;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(700);
  return true;
}

/**
 * Runs inside the renderer. Measures the *visible* panel only — every panel
 * stays mounted, so the DOM holds a dozen zero-height ghosts.
 *
 * Two exemptions, both deliberate:
 *   - `clientHeight === 0` — a deliberately collapsed box (the Collapsible a
 *     closed section animates) is not clipped content.
 *   - `visibility: hidden` / `opacity: 0` — measuring nodes (e.g. TextInput's
 *     autosize sizer) carry real overflow that nobody can see.
 *   - overflow smaller than one line box — nothing can be *hidden* by less than
 *     a line. This is what keeps single-line form controls out of the report:
 *     TextInput's wrapper deliberately clips a few sub-line pixels to avoid a
 *     vestigial scrollbar. The defect this gate exists for overflows by tens to
 *     hundreds of pixels.
 */
const MEASURE = `(() => {
  const root = document.querySelector('[class*="SideNavigation-module__Panel"]');
  if (!root) return { error: 'no side-panel root — is a project open?' };
  const items = Array.from(root.querySelectorAll('[class*="PanelItem"]'));
  if (!items.some((el) => el.getBoundingClientRect().height > 0)) return { error: 'no visible panel item' };
  // Measure from the panel *slot* down, not from the visible item: the slot is
  // where a panel that is taller than the space it was given shows up (the
  // box-model defect). Panels that are not active have zero-height boxes and
  // are skipped by the clientHeight rule below.
  const panel = root;

  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };

  const clipped = [];
  const unreachable = [];

  for (const el of [panel, ...panel.querySelectorAll('*')]) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    if (el.clientHeight === 0) continue;

    const overBy = el.scrollHeight - el.clientHeight;
    if (overBy <= 1) continue;

    const oy = cs.overflowY;
    if (oy === 'hidden' || oy === 'clip') {
      const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 16;
      if (overBy < Math.max(2, line)) continue;
      clipped.push({ el: name(el), overBy, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight });
      continue;
    }
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
      // Can it actually reach its end?
      el.scrollTop = el.scrollHeight;
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      el.scrollTop = 0;
      if (remaining > 1) {
        unreachable.push({ el: name(el), remaining });
      }
    }
  }

  return { clipped, unreachable };
})()`;

// ---- main -------------------------------------------------------------------
(async () => {
  console.log(`PNL-001 panel-geometry gate @ ${WIDTH}x${HEIGHT}`);
  const cdp = await connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(800);

  // Self-discover the rail, the same way the screenshot corpus does. A panel
  // added later is covered automatically; the `-panel` suffix is the register()
  // convention and keeps canvas chrome (zoom cluster, deploy button) out.
  const railButtons = await evalJS(
    cdp,
    `Array.from(document.querySelectorAll('[data-test]'))
      .filter((el) => el.offsetParent !== null && /-panel$/.test(el.getAttribute('data-test')))
      .map((el) => el.getAttribute('data-test'))
      .filter((v, i, a) => a.indexOf(v) === i)`
  );

  if (!railButtons.length) {
    console.error('No rail panel buttons found. Open a project in the editor first.');
    process.exit(1);
  }

  const results = [];
  let failures = 0;

  for (const id of railButtons) {
    if (!(await clickSel(cdp, `[data-test="${id}"]`))) {
      console.log(`  ?  ${id} — not clickable, skipped`);
      continue;
    }
    const m = await evalJS(cdp, MEASURE);
    if (m.error) {
      console.error(`  ✗  ${id} — ${m.error}`);
      failures++;
      continue;
    }
    const bad = m.clipped.length + m.unreachable.length;
    results.push({ panel: id, ...m });
    if (bad === 0) {
      console.log(`  ✓  ${id}`);
    } else {
      failures++;
      console.log(`  ✗  ${id}`);
      for (const c of m.clipped) {
        console.log(`       clips ${c.overBy}px it cannot scroll: ${c.el} (client ${c.clientHeight}, scroll ${c.scrollHeight})`);
      }
      for (const u of m.unreachable) {
        console.log(`       scroll container cannot reach its end by ${u.remaining}px: ${u.el}`);
      }
    }
  }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ width: WIDTH, height: HEIGHT, results }, null, 2));
    console.log(`\nwrote ${JSON_OUT}`);
  }

  console.log(`\n${results.length - failures}/${results.length} panels clean.`);
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('panel-geometry failed:', err.message);
  process.exit(1);
});
