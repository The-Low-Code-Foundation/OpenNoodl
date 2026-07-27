#!/usr/bin/env node
/**
 * Panel-geometry gate — PNL-001 (vertical) + PNL-004 (horizontal).
 *
 * The regression instrument for the side panel's box model. It walks every
 * registered rail panel and asserts, per panel:
 *
 * **Vertically** (PNL-001), at a deliberately short window:
 *   1. Every scroll container reaches its own last pixel. After
 *      `scrollTo(0, scrollHeight)`, `scrollHeight - scrollTop - clientHeight <= 1`.
 *   2. **No descendant clips content it cannot scroll.** Any element whose
 *      `scrollHeight` exceeds its `clientHeight` while its computed `overflow-y`
 *      is `hidden`/`clip` is content the user can never reach. This is the
 *      assertion that catches the flex-squeeze defect, and it is the one worth
 *      having: the panel looks fine, the sentence just ends.
 *
 * **Horizontally** (PNL-004), at each of five panel widths — 240, 300, 380,
 * 560, 760:
 *   3. **Nothing sticks out of the panel.** No element's border box extends
 *      past the panel body's right edge. This is the direct statement of the
 *      reported defect and the one a human would make looking at it.
 *   4. **Nothing is clipped sideways.** An element whose `overflow-x` is
 *      `hidden`/`clip` and whose `scrollWidth` exceeds its `clientWidth` is
 *      content nobody can reach.
 *   5. **Nothing scrolls sideways.** A horizontal scrollbar inside a panel is
 *      always a layout failure here; the panel is a column.
 *   6. **No control truncates a value you cannot then read.** A form control
 *      whose value overflows is normally fine — the caret reaches the end. It
 *      is a failure only when the control is `user-select: none` or `readOnly`,
 *      i.e. a `<select>` dressed as an `<input>`, where the value simply ends.
 *
 * ### Why (3)–(6) are not the one-liner the spec proposed
 *
 * PNL-004's acceptance asks for "no element has `scrollWidth > clientWidth + 1`".
 * Applied literally that flags the *fix*: an endpoint URL that ellipsises has
 * `scrollWidth` 400 and `clientWidth` 200 by design, and so does every truncated
 * name in the editor. Three exemptions keep the assertion pointed at defects:
 *
 *   - **Deliberate single-line truncation.** `text-overflow: ellipsis` with
 *     `white-space: nowrap` is a decision, not an overflow. Skipped for (4).
 *   - **Visually-hidden labels.** `PanelRow`'s sr-only label is a 1px box with
 *     `overflow: hidden` and `nowrap`; every one would otherwise report.
 *     `clientWidth <= 2` is skipped.
 *   - **`visibility: hidden` / `opacity: 0`.** Measuring nodes (TextInput's
 *     autosize sizer) carry real overflow nobody can see.
 *   - **Form controls scrolling their own value.** Added after the first live
 *     run, which reported every text field in the editor holding a long value.
 *     See the `MEASURE_X` note; they move to bucket (6) rather than vanishing.
 *
 * ### How the width is set
 *
 * The panel's width is forced with an `!important` inline width on the
 * `SideNavigation` root, then restored. That is a *measurement* override: it
 * exercises the real container queries and the real flex chain, but it does not
 * exercise the divider, the clamps or the persistence — those are PNL-003's,
 * and it deliberately reaches widths the clamps would refuse so the layout is
 * tested rather than the clamp.
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
 *                           [--panel-widths 240,300,380,560,760] [--skip-horizontal]
 *
 * Exits non-zero if any panel has unreachable or overflowing content.
 */

import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const has = (name) => argv.includes(name);
const CDP = arg('--cdp', 'http://localhost:9222');
// 1280x720 is deliberately shorter than the 13-inch laptop the defects were
// reported on. A tall window hides all of this.
const WIDTH = Number(arg('--width', 1280));
const HEIGHT = Number(arg('--height', 720));
const JSON_OUT = arg('--json', null);
// PNL-004's five widths. 240 is `MIN_PANEL_WIDTH`; 760 is `WIDE_MAX_WIDTH`.
const PANEL_WIDTHS = arg('--panel-widths', '240,300,380,560,760')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);
const SKIP_HORIZONTAL = has('--skip-horizontal');

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

/**
 * PNL-004's horizontal measurement. Runs inside the renderer.
 *
 * Four buckets. The first three fail; they are separated because the fix
 * differs. `sticksOut` wants `min-width: 0` on a flex child or `flex-wrap` on
 * its parent; `clippedX` wants the same one level up; `scrollsX` almost always
 * means a fixed width somewhere that should have been a basis.
 *
 * The fourth, `truncatedControl`, is the correction the first live run forced.
 * A single-line `<input>` whose *value* is longer than its box has
 * `scrollWidth > clientWidth` and a UA-computed `overflow-x: clip` — so the
 * original `clippedX` rule reported every text field in the editor holding a
 * long value. That is not hidden content: the UA gives form controls their own
 * scrolling, and the caret reaches the end.
 *
 * The exception is a control you cannot caret-scroll, which in this codebase
 * means `PropertyPanelSelectInput` — a `<select>` dressed as an `<input>`,
 * `user-select: none`, whose click opens a dropdown instead of placing a
 * caret. There the value simply ends and nothing will show you the rest. So
 * form controls are bucketed separately and **fail only when
 * `user-select: none`**; editable fields are reported as information.
 *
 * Every entry carries `text` and `path` because the first live run produced
 * `p.Text-module__Root--Gaf4_`, which names a component used several hundred
 * times and located nothing.
 */
const MEASURE_X = `(() => {
  const panel = document.querySelector('[class*="SideNavigation-module__Panel"]');
  if (!panel) return { error: 'no side-panel root — is a project open?' };

  // Strip css-loader's hash so a name survives a rebuild, and keep the module
  // prefix, which is the part that says which file to open.
  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls.replace(/--[A-Za-z0-9_-]+$/, '') : '');
  };

  // Enough ancestry to find the thing in the source.
  const pathOf = (el) => {
    const parts = [];
    let cur = el.parentElement;
    while (cur && cur !== panel && parts.length < 4) {
      parts.unshift(name(cur));
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };

  const textOf = (el) => (el.value || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

  const describe = (el) => ({ el: name(el), path: pathOf(el), text: textOf(el) });

  // The right edge nothing may cross. The panel's own content box: its padding
  // box minus any scrollbar gutter, which is what the user sees.
  const panelRect = panel.getBoundingClientRect();
  const panelRight = panelRect.left + panel.clientWidth +
    (panel.clientLeft || 0);

  const sticksOut = [];
  const clippedX = [];
  const scrollsX = [];
  const truncatedControl = [];

  for (const el of panel.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    if (cs.display === 'none') continue;
    // A collapsed box, and the 1px sr-only label box PanelRow renders.
    if (el.clientWidth <= 2 || el.clientHeight === 0) continue;
    // Anything that has escaped the panel's flow is not the panel's geometry.
    if (cs.position === 'fixed') continue;

    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;

    // (3) sticks out of the panel.
    const past = r.right - panelRight;
    if (past > 1) {
      sticksOut.push({ ...describe(el), past: Math.round(past), width: Math.round(r.width) });
    }

    const overBy = el.scrollWidth - el.clientWidth;
    if (overBy <= 1) continue;

    const ox = cs.overflowX;
    const tag = el.tagName;

    // Sub-character overflow is rounding, not hidden content.
    const ch = parseFloat(cs.fontSize) || 12;
    if (overBy < Math.max(2, ch / 2)) continue;

    // (6) a form control scrolling its own value — see the header note.
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      const unreadable = cs.userSelect === 'none' || el.readOnly === true;
      truncatedControl.push({
        ...describe(el),
        overBy,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        unreadable
      });
      continue;
    }

    // Deliberate single-line truncation is a decision, not an overflow.
    const isEllipsised = cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap';

    if (ox === 'hidden' || ox === 'clip') {
      if (isEllipsised) continue;
      clippedX.push({ ...describe(el), overBy, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth });
      continue;
    }

    if (ox === 'auto' || ox === 'scroll' || ox === 'overlay') {
      scrollsX.push({ ...describe(el), overBy, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth });
    }
  }

  return { sticksOut, clippedX, scrollsX, truncatedControl, panelWidth: Math.round(panel.clientWidth) };
})()`;

/**
 * Force the panel to a given width, or restore. See the header note: this is a
 * measurement override, not a test of the divider.
 */
const setPanelWidth = (w) => `(() => {
  const panel = document.querySelector('[class*="SideNavigation-module__Panel"]');
  if (!panel) return null;
  const root = panel.parentElement;
  const RAIL = 52;
  const props = ['width', 'min-width', 'max-width', 'flex'];
  if (${w} === 0) {
    for (const p of props) { root.style.removeProperty(p); panel.style.removeProperty(p); }
    return { restored: true };
  }
  // The rail is a sibling inside the same root and the panel carries a 52px
  // left margin for it, so the root must be the panel width plus the rail.
  root.style.setProperty('width', (${w} + RAIL) + 'px', 'important');
  root.style.setProperty('min-width', (${w} + RAIL) + 'px', 'important');
  root.style.setProperty('max-width', (${w} + RAIL) + 'px', 'important');
  root.style.setProperty('flex', '0 0 ' + (${w} + RAIL) + 'px', 'important');
  // Belt and braces: if the root override does not reach the panel (a mode
  // where the panel is positioned rather than flowed), pin the panel too.
  const got = Math.round(panel.getBoundingClientRect().width);
  if (Math.abs(got - ${w}) > 1) {
    panel.style.setProperty('width', ${w} + 'px', 'important');
    panel.style.setProperty('min-width', ${w} + 'px', 'important');
    panel.style.setProperty('max-width', ${w} + 'px', 'important');
    panel.style.setProperty('flex', '0 0 ' + ${w} + 'px', 'important');
  }
  return { applied: Math.round(panel.getBoundingClientRect().width) };
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
  let vFailures = 0;

  for (const id of railButtons) {
    if (!(await clickSel(cdp, `[data-test="${id}"]`))) {
      console.log(`  ?  ${id} — not clickable, skipped`);
      continue;
    }
    const m = await evalJS(cdp, MEASURE);
    if (m.error) {
      console.error(`  ✗  ${id} — ${m.error}`);
      failures++;
      vFailures++;
      continue;
    }
    const bad = m.clipped.length + m.unreachable.length;
    results.push({ panel: id, ...m });
    if (bad === 0) {
      console.log(`  ✓  ${id}`);
    } else {
      failures++;
      vFailures++;
      console.log(`  ✗  ${id}`);
      for (const c of m.clipped) {
        console.log(`       clips ${c.overBy}px it cannot scroll: ${c.el} (client ${c.clientHeight}, scroll ${c.scrollHeight})`);
      }
      for (const u of m.unreachable) {
        console.log(`       scroll container cannot reach its end by ${u.remaining}px: ${u.el}`);
      }
    }
  }

  // ---- PNL-004: the horizontal axis, at five panel widths -------------------
  const xResults = [];

  if (!SKIP_HORIZONTAL) {
    console.log(`\nPNL-004 horizontal overflow @ panel widths ${PANEL_WIDTHS.join(', ')}`);

    for (const pw of PANEL_WIDTHS) {
      const applied = await evalJS(cdp, setPanelWidth(pw));
      await sleep(250);
      if (!applied) {
        console.error(`  ✗  could not set panel width — no panel element`);
        failures++;
        break;
      }
      if (applied.applied && Math.abs(applied.applied - pw) > 1) {
        console.log(`  !  asked for ${pw}px, got ${applied.applied}px — measuring that instead`);
      }

      let widthFailures = 0;
      for (const id of railButtons) {
        if (!(await clickSel(cdp, `[data-test="${id}"]`))) continue;
        const m = await evalJS(cdp, MEASURE_X);
        if (m.error) {
          console.error(`  ✗  ${pw}px ${id} — ${m.error}`);
          failures++;
          widthFailures++;
          continue;
        }
        // A form control that *can* be caret-scrolled is information, not a
        // failure. One that cannot is content nobody can read.
        const unreadable = m.truncatedControl.filter((c) => c.unreadable);
        const bad = m.sticksOut.length + m.clippedX.length + m.scrollsX.length + unreadable.length;
        xResults.push({ panelWidth: pw, panel: id, ...m });
        if (bad === 0) continue;

        failures++;
        widthFailures++;
        console.log(`  ✗  ${pw}px  ${id}`);
        const where = (x) => `${x.el}${x.path ? `  [${x.path}]` : ''}${x.text ? `  "${x.text}"` : ''}`;
        for (const s of m.sticksOut.slice(0, 5)) {
          console.log(`       sticks ${s.past}px past the panel's right edge (w ${s.width}): ${where(s)}`);
        }
        if (m.sticksOut.length > 5) console.log(`       …and ${m.sticksOut.length - 5} more sticking out`);
        for (const c of m.clippedX.slice(0, 5)) {
          console.log(`       clips ${c.overBy}px sideways it cannot scroll (client ${c.clientWidth}, scroll ${c.scrollWidth}): ${where(c)}`);
        }
        for (const s of m.scrollsX.slice(0, 5)) {
          console.log(`       scrolls sideways by ${s.overBy}px: ${where(s)}`);
        }
        for (const c of unreadable.slice(0, 5)) {
          console.log(`       control truncates its value with no way to read it (client ${c.clientWidth}, scroll ${c.scrollWidth}): ${where(c)}`);
        }
      }

      if (widthFailures === 0) console.log(`  ✓  ${pw}px — all ${railButtons.length} panels clean`);
    }

    // Always hand the width back, pass or fail; a wedged override would make
    // every later session in this editor lie.
    await evalJS(cdp, setPanelWidth(0));
  }

  if (JSON_OUT) {
    fs.writeFileSync(
      JSON_OUT,
      JSON.stringify({ width: WIDTH, height: HEIGHT, panelWidths: PANEL_WIDTHS, results, horizontal: xResults }, null, 2)
    );
    console.log(`\nwrote ${JSON_OUT}`);
  }

  console.log(`\n${results.length - vFailures}/${results.length} panels clean vertically.`);
  if (!SKIP_HORIZONTAL) {
    const badness = (r) =>
      r.sticksOut.length + r.clippedX.length + r.scrollsX.length + r.truncatedControl.filter((c) => c.unreadable).length;
    const xBad = xResults.filter((r) => badness(r) > 0).length;
    console.log(`${xResults.length - xBad}/${xResults.length} panel×width combinations clean horizontally.`);
    // Editable fields scrolling their own value: reported so the number is
    // visible, never a failure. A spike here usually means a field got narrower.
    const scrollable = xResults.reduce((n, r) => n + r.truncatedControl.filter((c) => !c.unreadable).length, 0);
    if (scrollable) {
      console.log(`${scrollable} editable field(s) scroll their own value — the caret reaches the end, not a failure.`);
    }
  }
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('panel-geometry failed:', err.message);
  process.exit(1);
});
