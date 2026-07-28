#!/usr/bin/env node
/**
 * PNL-009 panel-modes gate.
 *
 * The mode system's acceptance is almost entirely *behaviour* — a card that
 * moves, a key that returns you, focus that is not trapped, a menu that appears
 * beside the button that opened it. None of that is a stylesheet, so none of it
 * can be settled by reading the diff, and a checklist line saying "verified" is
 * worth exactly as much as the person who wrote it. This makes them assertions.
 *
 * What it checks, in order (each one isolated — a failure or a CDP timeout
 * records and moves on rather than aborting the run):
 *
 *   1. full: the panel is `position: fixed`, fills the editor area right of the
 *      52px rail, and **the rail is still hit-testable** — the thing the seven
 *      `LocalBackendCard` overlays got wrong by construction.
 *   2. full: switching panels from the rail stays in full mode.
 *   3. full: `Escape` returns to docked.
 *   4. floating: the panel is a fixed card; dragging its bar moves it; the
 *      constraint keeps it off the rail however far you drag.
 *   5. **focus is not trapped** (acceptance item 6, never verified until now):
 *      from an element inside a floating panel, `Tab` must reach something
 *      outside the panel within a bounded number of presses.
 *   6. **⌘B still hides a floating panel** (the other half of item 6), and — F41,
 *      asserted since batch C rather than merely recorded — **the floating mode
 *      survives the hide → show round trip** instead of silently returning docked.
 *   7. **the `⋯` overflow menu exists and is anchored to its button** — the
 *      popup-position check the executor notes asked for. A floating panel is
 *      the case that would expose a positioning bug, because it is the one place
 *      the panel is not where popups assume it is.
 *   8. **PNL-002's dismissal still behaves from a floating panel**: a gesture
 *      that starts *inside* the popup and ends on the canvas must NOT dismiss
 *      (that is a drag, not an outside click), while one that starts and ends
 *      outside must.
 *
 * ROBUSTNESS, inherited from `panel-chrome.mjs` beside this file and for the
 * same reason — a leaked `width: !important` from a crashed run wedged the
 * editor for a previous agent and cost a restart:
 *
 *   - every injected style is released in a `finally`, including on a throw,
 *   - the panel is put back to docked in the same `finally`,
 *   - the JSON report is flushed after every check,
 *   - screenshots are taken BEFORE asserting, so a failing state is the one you
 *     get to look at,
 *   - three consecutive CDP timeouts abort cleanly rather than grinding through
 *     the rest of the run.
 *
 * Prerequisite — a dev editor on a CDP endpoint **with a project open**,
 * launched from the PRIMARY checkout (`lerna exec` resolves there, not to a
 * worktree):
 *
 *   nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
 *   until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
 *
 * Usage:
 *   node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-modes.mjs
 *   node panel-modes.mjs [--cdp URL] [--width 1400] [--height 900]
 *                        [--out DIR] [--json report.json] [--no-shots]
 *                        [--timeout 8000] [--tab-budget 25]
 *
 * Exits non-zero if any check fails. `--json` is written even on a catastrophic
 * failure, so a wedged run still tells you how far it got.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const has = (name) => argv.includes(name);

const CDP = arg('--cdp', 'http://localhost:9222');
const WIDTH = Number(arg('--width', 1400));
const HEIGHT = Number(arg('--height', 900));
const JSON_OUT = arg('--json', null);
const SHOTS = !has('--no-shots');
const CALL_TIMEOUT = Number(arg('--timeout', 8000));
/** How many Tab presses count as "focus can leave". Generous; a trap is infinite. */
const TAB_BUDGET = Number(arg('--tab-budget', 25));
const OUT = arg('--out', path.resolve(__dirname, '../../phase-25-side-panel/screenshots/pnl-009'));

/** The icon rail. Fixed by the phase; restated here only to assert against it. */
const RAIL_WIDTH = 52;
/** Geometry tolerance, px. Borders and sub-pixel layout, not slack. */
const TOL = 3;

// ---- tiny CDP client (one socket, sequential) ------------------------------
class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.dead = false;
    ws.addEventListener('close', () => (this.dead = true));
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}, timeout = CALL_TIMEOUT) {
    if (this.dead) return Promise.reject(new Error('CDP socket closed'));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (e) {
        this.pending.delete(id);
        return reject(e);
      }
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout after ${timeout}ms: ${method}`));
        }
      }, timeout);
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The editor's own document, matched SPECIFICALLY.
//
// `/index\.html/` is not specific enough: `frames/viewer-frame/index.html` and
// `about-window/about.html` are also `file:` page targets, and both sort AHEAD
// of the editor in `/json/list`. Attaching to one of them looks like a broken
// app rather than a wrong window — this gate reported "No rail panel buttons
// found. Open a project in the editor first." with a project plainly open,
// purely because a preview was running.
const EDITOR_PAGE = /noodl-editor\/src\/editor\/index\.html/;

async function connect() {
  const list = await (await fetch(`${CDP}/json`)).json();
  const page = list.find((t) => t.type === 'page' && EDITOR_PAGE.test(t.url));
  if (!page) throw new Error('No editor CDP page target found — is dev:debug running?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return new CdpSession(ws);
}

async function evalJS(cdp, expression, timeout) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 120));
  return r.result.value;
}

/**
 * The visible instance of a selector.
 *
 * F28: before PNL-009 every mounted panel rendered its own copy of the mode
 * buttons, so these ids matched a dozen elements and only one had a box. The
 * provider is per panel now and the ids are unique — but a gate that assumes
 * that is a gate that stops noticing when it stops being true, so this still
 * filters on the box and *reports the count*.
 */
const VISIBLE_BOX = (sel) => `(() => {
  const all = Array.from(document.querySelectorAll(${JSON.stringify(sel)}));
  const boxed = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!boxed.length) return { total: all.length, visible: 0 };
  const r = boxed[0].getBoundingClientRect();
  return { total: all.length, visible: boxed.length,
           x: r.x + r.width / 2, y: r.y + r.height / 2, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
})()`;

async function box(cdp, selector) {
  return evalJS(cdp, VISIBLE_BOX(selector));
}

async function clickSel(cdp, selector, settleMs = 600) {
  const b = await box(cdp, selector);
  if (!b || !b.visible) return false;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', clickCount: 1 });
  }
  await sleep(settleMs);
  return true;
}

/** A real pointer drag: press, several moves (one move is not a drag), release. */
async function drag(cdp, from, to, steps = 8) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
      button: 'left',
      buttons: 1
    });
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
  await sleep(400);
}

async function pressKey(cdp, { key, code, vk, modifiers = 0, text }) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: text ? 'keyDown' : 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers,
    text
  });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
  await sleep(250);
}

async function injectDeterminism(cdp) {
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evalJS(
    cdp,
    `(() => {
      let s = document.getElementById('__pnl009_determinism');
      if (!s) { s = document.createElement('style'); s.id = '__pnl009_determinism'; document.head.appendChild(s); }
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
      return true;
    })()`
  );
}

/**
 * Release every override this script can leave behind. Called in a `finally`
 * *and* tolerated to fail — the point is that the editor is usable afterwards.
 */
async function releaseAll(cdp) {
  try {
    await evalJS(
      cdp,
      `(() => {
        for (const id of ['__pnl009_determinism', '__pnl009_width']) {
          const s = document.getElementById(id);
          if (s) s.remove();
        }
        return true;
      })()`,
      5000
    );
  } catch {
    /* reported by the caller */
  }
}

// ---- measurements ----------------------------------------------------------

const PANEL_STATE = `(() => {
  const panel = document.querySelector('[class*="SideNavigation-module__Panel"]');
  const rail = document.querySelector('[class*="SideNavigation-module__Toolbar"]');
  if (!panel) return { error: 'no side panel — is a project open?' };
  const cs = getComputedStyle(panel);
  const r = panel.getBoundingClientRect();
  const railRect = rail ? rail.getBoundingClientRect() : null;

  // Is the rail actually clickable, or is something painted over it? This is
  // the failure the seven fixed overlays had by construction (z-index 9999 over
  // a 52px rail), so it is asserted rather than assumed.
  let railHitTakesRail = null;
  if (railRect && railRect.width > 0) {
    const hit = document.elementFromPoint(railRect.x + railRect.width / 2, railRect.y + 80);
    railHitTakesRail = Boolean(hit && rail.contains(hit));
  }

  return {
    position: cs.position,
    zIndex: cs.zIndex,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    railRect: railRect ? { x: Math.round(railRect.x), w: Math.round(railRect.width) } : null,
    railHitTakesRail,
    hasDetachedBar: Boolean(document.querySelector('[data-test="side-panel-detached-bar"]')),
    activePanelId: (() => {
      const items = Array.from(panel.querySelectorAll('[data-panel-id]'));
      const shown = items.find((el) => el.getBoundingClientRect().height > 0);
      return shown ? shown.getAttribute('data-panel-id') : null;
    })(),
    viewport: { w: window.innerWidth, h: window.innerHeight }
  };
})()`;

/**
 * Where the open menu actually is.
 *
 * NOT `.popup-layer-popout`. That element is the popup layer's handle: it holds
 * the container the menu was rendered into, but `MenuDialog` portals *out* of it
 * into `.dialog-layer-portal-target`, so the popout measures 0×0 and a gate
 * filtering on a non-zero box finds nothing at all. This is PNL-002's finding F24
 * — "the popup layer's inside/outside test was blind to it" — showing up a second
 * time, in the instrument rather than the app. Reading the popout was why this
 * gate reported "no popout opened" against a menu that was on screen.
 *
 * `BaseDialog` also renders a measuring copy of its children, and that copy lives
 * *inside* `VisibleDialog` — scoping to `VisibleDialog` is not enough to avoid it.
 * The measuring copy sits at the origin until the dialog has been positioned, so
 * reading it reports a menu at (1, 1) no matter where the real one went. That is
 * what made this check fail identically across two unrelated fixes: the number it
 * printed never came from the menu on screen.
 */
const POPOUT_RECT = `(() => {
  const visible = Array.from(
    document.querySelectorAll('[class*="BaseDialog-module__VisibleDialog"] [class*="MenuDialog-module__Root"]')
  ).filter((el) => !el.closest('[class*="BaseDialog-module__MeasuringContainer"]'))
   .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const candidates = visible.length
    ? visible
    : Array.from(document.querySelectorAll('.popup-layer-popout'))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!candidates.length) return null;
  const r = candidates[0].getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
})()`;

// ---- preconditions ---------------------------------------------------------

/**
 * Put the panel back in the state every check below assumes: docked, visible,
 * and wide enough that Float and Full are buttons rather than `⋯` items.
 *
 * Both halves were learned the hard way on the first live run.
 *
 * **Docked.** The gate inherited whatever the previous gate left on screen. Run
 * one started with the panel already in a mode, so clicking Full toggled it
 * *off*, and 11 of 12 checks failed reporting a docked panel — a full red board
 * describing a feature that works. A gate that depends on the last gate's
 * leftovers is not measuring the app.
 *
 * **Wide enough.** PNL-009's own band rule collapses Float and Full into the `⋯`
 * below a 357px panel. The "switching panels stays in full mode" check switches
 * to whichever rail button comes to hand, that panel restores its own remembered
 * width (Components: 274px), and the floating phase then reports "float toggle
 * not clickable" — which is the band working exactly as designed. Widen with the
 * app's own wide toggle rather than a style override: an injected width would be
 * testing CSS we wrote into the page instead of the panel the user gets.
 */
async function preflight(cdp) {
  const s = await evalJS(cdp, PANEL_STATE);
  if (s && s.position === 'fixed') {
    await pressKey(cdp, { key: 'Escape', code: 'Escape', vk: 27 });
    await sleep(400);
  }
  const panel = await box(cdp, '[class*="SideNavigation-module__Panel"]');
  if (!panel || !panel.visible) {
    // ⌘B hidden from an earlier run; the hide toggle is the way back.
    await clickSel(cdp, '[data-test="side-panel-hide-toggle"]');
  }
  await exposeModeButtons(cdp);
}

/**
 * If the mode group has collapsed into `⋯`, widen the panel until it has not.
 * Returns whether the buttons are exposed, so a caller can say so rather than
 * fail with a misleading "not clickable".
 */
async function exposeModeButtons(cdp) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const float = await box(cdp, '[data-test="side-panel-float-toggle"]');
    if (float && float.visible) return true;
    if (!(await clickSel(cdp, '[data-test="side-panel-wide-toggle"]', 500))) return false;
  }
  const float = await box(cdp, '[data-test="side-panel-float-toggle"]');
  return Boolean(float && float.visible);
}

/** Put the panel into floating mode from whatever state it is in now. */
async function ensureFloating(cdp) {
  const s = await evalJS(cdp, PANEL_STATE);
  if (s && s.position === 'fixed' && s.hasDetachedBar) return true;
  const panel = await box(cdp, '[class*="SideNavigation-module__Panel"]');
  if (!panel || !panel.visible) await clickSel(cdp, '[data-test="side-panel-hide-toggle"]');
  if (!(await exposeModeButtons(cdp))) return false;
  if (!(await clickSel(cdp, '[data-test="side-panel-float-toggle"]'))) return false;
  const after = await evalJS(cdp, PANEL_STATE);
  return after.position === 'fixed';
}

// ---- report ----------------------------------------------------------------

const report = { width: WIDTH, height: HEIGHT, checks: [] };
const failures = [];
let timeouts = 0;

function flush() {
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
}

function record(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
  console.log(`  ${ok ? '✓' : '✗'}  ${name}${detail ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  flush();
}

/** Every check runs through here: isolated, timed out, recorded, never fatal. */
async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    const isTimeout = /timeout|socket closed/i.test(err.message);
    if (isTimeout) timeouts++;
    else timeouts = 0;
    record(name, false, `harness: ${err.message}`);
    if (timeouts >= 3) throw new Error(`renderer appears wedged (${timeouts} consecutive CDP timeouts) — aborting cleanly`);
  } finally {
    flush();
  }
}

async function shot(cdp, name) {
  if (!SHOTS) return;
  try {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 15000);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  } catch (e) {
    console.log(`  (screenshot ${name} failed: ${e.message})`);
  }
}

// ---- main ------------------------------------------------------------------

(async () => {
  console.log(`PNL-009 panel-modes gate @ ${WIDTH}x${HEIGHT}`);
  if (SHOTS) {
    fs.mkdirSync(OUT, { recursive: true });
    console.log(`screenshots → ${OUT}`);
  }

  const cdp = await connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await sleep(800);
  await injectDeterminism(cdp);

  const initial = await evalJS(cdp, PANEL_STATE);
  if (initial.error) {
    console.error(initial.error);
    process.exit(1);
  }
  report.initial = initial;

  // Never inherit the last run's leftovers. See preflight().
  await preflight(cdp);
  report.afterPreflight = await evalJS(cdp, PANEL_STATE);

  try {
    // ---------------------------------------------------------------- full ---
    await check('full: the panel is fixed and fills the editor area right of the rail', async () => {
      if (!(await clickSel(cdp, '[data-test="side-panel-full-toggle"]'))) throw new Error('full toggle not clickable');
      const s = await evalJS(cdp, PANEL_STATE);
      await shot(cdp, 'gate--full');
      const expectedLeft = (s.railRect ? s.railRect.x : 0) + RAIL_WIDTH;
      const ok =
        s.position === 'fixed' &&
        Math.abs(s.rect.x - expectedLeft) <= TOL &&
        s.rect.w >= s.viewport.w - expectedLeft - TOL - 2;
      record('full: the panel is fixed and fills the editor area right of the rail', ok, s.rect);
    });

    await check('full: the rail is still live under the panel', async () => {
      const s = await evalJS(cdp, PANEL_STATE);
      record('full: the rail is still live under the panel', s.railHitTakesRail === true, {
        railHitTakesRail: s.railHitTakesRail,
        railWidth: s.railRect && s.railRect.w
      });
    });

    await check('full: switching panels from the rail stays in full mode', async () => {
      const before = await evalJS(cdp, PANEL_STATE);
      // Any rail button that is not the one already active.
      const target = await evalJS(
        cdp,
        `(() => {
          const btns = Array.from(document.querySelectorAll('[data-test$="-panel"]'))
            .filter((el) => el.getBoundingClientRect().width > 0);
          const other = btns.find((el) => el.getAttribute('data-test') !== ${JSON.stringify(
            `${before.activePanelId}-panel`
          )});
          return other ? other.getAttribute('data-test') : null;
        })()`
      );
      if (!target) throw new Error('no second rail button to switch to');
      await clickSel(cdp, `[data-test="${target}"]`);
      const after = await evalJS(cdp, PANEL_STATE);
      record('full: switching panels from the rail stays in full mode', after.position === 'fixed' && after.hasDetachedBar, {
        from: before.activePanelId,
        to: after.activePanelId,
        position: after.position
      });
    });

    await check('full: Escape returns to docked', async () => {
      await pressKey(cdp, { key: 'Escape', code: 'Escape', vk: 27 });
      const s = await evalJS(cdp, PANEL_STATE);
      record('full: Escape returns to docked', s.position !== 'fixed' && !s.hasDetachedBar, { position: s.position });
    });

    // ------------------------------------------------------------ floating ---
    // The full phase above switches panels, and the panel it lands on restores
    // its own width — which may be under the band that collapses Float into `⋯`.
    await check('floating: the panel is a fixed card over the canvas', async () => {
      if (!(await exposeModeButtons(cdp)))
        throw new Error('could not expose the mode buttons — the panel would not widen past the ⋯ band');
      if (!(await clickSel(cdp, '[data-test="side-panel-float-toggle"]'))) throw new Error('float toggle not clickable');
      const s = await evalJS(cdp, PANEL_STATE);
      await shot(cdp, 'gate--floating');
      const ok = s.position === 'fixed' && s.rect.w > 0 && s.rect.w < s.viewport.w - RAIL_WIDTH;
      record('floating: the panel is a fixed card over the canvas', ok, s.rect);
    });

    await check('floating: dragging the bar moves the card, and the constraint keeps it off the rail', async () => {
      const before = await evalJS(cdp, PANEL_STATE);
      const bar = await box(cdp, '[data-test="side-panel-detached-bar"]');
      if (!bar || !bar.visible) throw new Error('no detached bar to grab');
      // Park the card somewhere unambiguous first. Floating position persists per
      // panel, so a re-run inherits the previous run's card — already pinned at
      // the constraint corner. Dragging it into the corner again then moves it by
      // zero pixels and the check fails claiming the drag does not work, when in
      // fact the constraint had already done its job.
      await drag(cdp, { x: bar.x, y: bar.y }, { x: bar.x + 260, y: bar.y + 180 });
      const parked = await evalJS(cdp, PANEL_STATE);
      const bar2 = await box(cdp, '[data-test="side-panel-detached-bar"]');
      if (!bar2 || !bar2.visible) throw new Error('lost the detached bar while parking the card');
      // Now drag far past the rail and past the top of the window: the assertion
      // is that the card *stops*, not that it follows.
      await drag(cdp, { x: bar2.x, y: bar2.y }, { x: 4, y: 4 });
      const after = await evalJS(cdp, PANEL_STATE);
      before.rect = parked.rect;
      await shot(cdp, 'gate--floating-dragged');
      const moved = after.rect.x !== before.rect.x || after.rect.y !== before.rect.y;
      const offRail = after.rect.x >= (after.railRect ? after.railRect.x : 0) + RAIL_WIDTH - TOL;
      record('floating: dragging the bar moves the card, and the constraint keeps it off the rail', moved && offRail, {
        before: before.rect,
        after: after.rect
      });
    });

    // --------------------------------------------------- item 6: focus -------
    await check('floating: a floating panel does not trap focus', async () => {
      // Start from something focusable inside the panel, then Tab out.
      const seeded = await evalJS(
        cdp,
        `(() => {
          const panel = document.querySelector('[class*="SideNavigation-module__Panel"]');
          if (!panel) return false;
          const f = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (!f) return false;
          f.focus();
          return document.activeElement === f || panel.contains(document.activeElement);
        })()`
      );
      if (!seeded) throw new Error('nothing focusable inside the floating panel to start from');

      let escaped = false;
      let presses = 0;
      const trail = [];
      for (; presses < TAB_BUDGET && !escaped; presses++) {
        await pressKey(cdp, { key: 'Tab', code: 'Tab', vk: 9 });
        const where = await evalJS(
          cdp,
          `(() => {
            const panel = document.querySelector('[class*="SideNavigation-module__Panel"]');
            const a = document.activeElement;
            return {
              inPanel: Boolean(panel && a && panel.contains(a)),
              tag: a ? a.tagName : null,
              test: a ? a.getAttribute('data-test') : null
            };
          })()`
        );
        trail.push(where.test || where.tag);
        if (!where.inPanel) escaped = true;
      }
      record('floating: a floating panel does not trap focus', escaped, {
        presses,
        budget: TAB_BUDGET,
        trail: trail.slice(-6)
      });
    });

    await check('floating: ⌘B still hides the panel', async () => {
      // 4 = Meta on macOS in CDP's modifier bitmask (1 Alt, 2 Ctrl, 4 Meta, 8 Shift).
      await pressKey(cdp, { key: 'b', code: 'KeyB', vk: 66, modifiers: 4 });
      const hidden = await evalJS(
        cdp,
        `(() => {
          const panel = document.querySelector('[class*="SideNavigation-module__Panel"]');
          if (!panel) return true;
          const r = panel.getBoundingClientRect();
          return r.width < 8;
        })()`
      );
      record('floating: ⌘B still hides the panel', hidden === true, { hidden });
      // Bring it back however the previous line left it.
      if (hidden) await pressKey(cdp, { key: 'b', code: 'KeyB', vk: 66, modifiers: 4 });
      await sleep(300);
      // F41, now asserted rather than merely observed. This used to record
      // `ok: null` with the note "returns docked; floating is not restored":
      // `SidePanelMode` is one enum, so hiding overwrote 'floating' and un-hiding
      // hardcoded 'docked'. `useSidePanelLayout` now carries the mode the panel
      // was hidden *from* (`hideTransition`/`revealTransition`), so the round trip
      // preserves it — still CSS-only, nothing re-parented.
      const back = await evalJS(cdp, PANEL_STATE);
      record('floating: the mode survives a ⌘B hide → ⌘B show round trip (F41)', back.position === 'fixed', {
        position: back.position,
        hasDetachedBar: back.hasDetachedBar,
        expected: 'fixed (still floating)'
      });
      flush();
    });

    // ------------------------------------- the ⋯ menu, and where it lands ----
    await check('floating: the ⋯ overflow menu appears when the card is narrow', async () => {
      // The demotion band is a container query on the panel *frame*, so the card
      // has to actually be narrow. Drag the grip rather than injecting a width:
      // in floating mode the width is an inline style from React state and an
      // `!important` override would fight it.
      // Re-enter floating rather than assuming the previous check left us in it.
      // Since F41 the ⌘B round trip above *does* leave us floating, so this is
      // now idempotent insurance rather than a workaround — `ensureFloating` is a
      // no-op when the panel is already floating, and these four checks should
      // not depend on the previous one's exit state either way.
      if (!(await ensureFloating(cdp))) throw new Error('could not re-enter floating mode');
      const s = await evalJS(cdp, PANEL_STATE);
      const grip = await box(cdp, '[data-test="side-panel-resize-grip"]');
      if (!grip || !grip.visible) throw new Error('no resize grip');
      await drag(cdp, { x: grip.x, y: grip.y }, { x: s.rect.x + 300, y: s.rect.y + 520 });
      await sleep(300);
      const more = await box(cdp, '[data-test="side-panel-mode-overflow"]');
      const float = await box(cdp, '[data-test="side-panel-float-toggle"]');
      await shot(cdp, 'gate--floating-narrow-overflow');
      record('floating: the ⋯ overflow menu appears when the card is narrow', more.visible === 1 && float.visible === 0, {
        overflowVisible: more.visible,
        overflowTotalInDom: more.total,
        floatVisible: float.visible,
        // F28: `total` should now be 1, not one per mounted panel.
        floatTotalInDom: float.total
      });
    });

    await check('floating: the ⋯ menu is anchored to its button, not to the mouse', async () => {
      const more = await box(cdp, '[data-test="side-panel-mode-overflow"]');
      if (!more.visible) throw new Error('no ⋯ button — the previous check explains why');
      if (!(await clickSel(cdp, '[data-test="side-panel-mode-overflow"]', 800))) throw new Error('⋯ not clickable');
      const popout = await evalJS(cdp, POPOUT_RECT);
      await shot(cdp, 'gate--floating-overflow-menu');
      if (!popout) {
        record('floating: the ⋯ menu is anchored to its button, not to the mouse', false, 'no popout opened');
        return;
      }
      const b = more.rect;
      // Anchored 'bottom': the menu sits under the button and overlaps it
      // horizontally. Generous vertically (the layer flips the menu when it
      // would leave the window) but it must be *near* the button either way.
      const horizontalOverlap = Math.min(popout.x + popout.w, b.x + b.w) - Math.max(popout.x, b.x);
      const verticalGap = Math.min(Math.abs(popout.y - (b.y + b.h)), Math.abs(b.y - (popout.y + popout.h)));
      record('floating: the ⋯ menu is anchored to its button, not to the mouse', horizontalOverlap > 0 && verticalGap <= 40, {
        button: b,
        popout,
        horizontalOverlap: Math.round(horizontalOverlap),
        verticalGap: Math.round(verticalGap)
      });
    });

    await check('floating: a drag out of the popup is not an outside click (PNL-002)', async () => {
      let popout = await evalJS(cdp, POPOUT_RECT);
      if (!popout) {
        // Re-open; the previous check may have dismissed it.
        await clickSel(cdp, '[data-test="side-panel-mode-overflow"]', 800);
        popout = await evalJS(cdp, POPOUT_RECT);
      }
      if (!popout) throw new Error('could not open the ⋯ menu to test dismissal');

      // Start inside the popup, end on the canvas. Both ends must be outside for
      // PNL-002 to call it a dismissal, so this one must NOT close.
      await drag(
        cdp,
        { x: popout.x + popout.w / 2, y: popout.y + popout.h / 2 },
        { x: WIDTH - 120, y: HEIGHT - 120 }
      );
      const stillOpen = await evalJS(cdp, POPOUT_RECT);
      record('floating: a drag out of the popup is not an outside click (PNL-002)', Boolean(stillOpen), {
        stillOpen: Boolean(stillOpen)
      });
    });

    await check('floating: a click on the canvas does dismiss the menu', async () => {
      let popout = await evalJS(cdp, POPOUT_RECT);
      if (!popout) {
        await clickSel(cdp, '[data-test="side-panel-mode-overflow"]', 800);
        popout = await evalJS(cdp, POPOUT_RECT);
      }
      if (!popout) throw new Error('could not open the ⋯ menu to test dismissal');
      const pt = { x: WIDTH - 140, y: HEIGHT - 140 };
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await sleep(500);
      const after = await evalJS(cdp, POPOUT_RECT);
      record('floating: a click on the canvas does dismiss the menu', after === null, { after });
    });
  } finally {
    // Always give the editor back: docked, no overrides, no device metrics.
    try {
      await pressKey(cdp, { key: 'Escape', code: 'Escape', vk: 27 });
    } catch {
      /* below */
    }
    await releaseAll(cdp);
    try {
      await cdp.send('Emulation.clearDeviceMetricsOverride', {}, 5000);
    } catch {
      console.log('(could not clear device metrics — restart the editor)');
    }
    flush();
    if (JSON_OUT) console.log(`wrote ${JSON_OUT}`);
  }

  console.log(`\n${report.checks.length} checks run.`);
  if (failures.length) {
    console.log(`\n✗ ${failures.length} failures:`);
    for (const f of failures) console.log(`  - ${f.name}: ${typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)}`);
  } else {
    console.log('\n✓ clean.');
  }
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('panel-modes failed:', err.message);
  flush();
  process.exit(1);
});
