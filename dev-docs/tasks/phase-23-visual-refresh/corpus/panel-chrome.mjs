#!/usr/bin/env node
/**
 * PNL-005 panel-chrome gate + screenshot corpus.
 *
 * "Every panel wears the same header" is a claim you can only settle by looking
 * at every panel. This walks the rail in **both themes** and, per panel,
 *
 *   1. screenshots it into `dev-docs/tasks/phase-25-side-panel/screenshots/pnl-005/`,
 *   2. measures its header and asserts the shared chrome actually applied.
 *
 * The assertions are the point — screenshots prove a human looked, measurements
 * prove the same rule produced all of them:
 *
 *   A. exactly **one** visible `[data-test="panel-header"]` in the active panel —
 *      not zero (a panel that never migrated, or a state that renders no chrome)
 *      and not two (a panel that kept its own bar as well).
 *   B. the header is **44px** tall.
 *   C. the title is **13px / 650**, one line, `nowrap` + `ellipsis`.
 *   D. nothing in the header is pushed outside the panel's right edge.
 *   E. section headers are **subordinate** — shorter than the panel header and
 *      set smaller than its title.
 *   F. **at the panel's default width the title is not truncated to a stub.**
 *      See "Why F exists" below. It was written to be RED until the ⋯ overflow
 *      menu landed; PNL-009 landed it, so F is now an ordinary assertion and a
 *      red F means a real regression. Each failure prints the header's width
 *      budget (title / action slot / mode group) so it says *what* ate the bar.
 *
 * B–D are then repeated with the panel forced narrow: the title must ellipsise
 * rather than wrap or push the controls out.
 *
 * ---------------------------------------------------------------------------
 * WHY F EXISTS
 *
 * The first version of this gate asserted "single line + ellipsis engaged" and
 * passed the Components panel while it was rendering its title as **"Co…"** —
 * two characters. Ellipsised-and-single-line is exactly what C asserts, so C was
 * green about the wrong thing: the mock's stated goal was that the header drop
 * Float and Full into an overflow menu *rather than truncating the panel title
 * to "Compo…"*, and without that menu the four mode buttons plus the panel's own
 * action slot eat the bar and the title takes all of the squeeze.
 *
 * F measures how many characters actually fit (real text metrics, in the
 * renderer, in the header's own computed font) and fails when a title is cut
 * below a legible floor at the panel's *default* width. It will stay red for the
 * panels with the busiest action slots until `SidePanel.tsx` grows the `⋯` menu
 * and tags the demotable controls `data-panel-chrome="secondary"` — the hook
 * `PanelHeader.module.scss` already queries. A gate that is red for a known,
 * named reason is worth more than one that is green about the wrong thing.
 * ---------------------------------------------------------------------------
 *
 * ROBUSTNESS. An earlier revision wedged the renderer partway through the light
 * theme and took the editor down with it. Every panel is now isolated: a CDP
 * timeout skips that panel and is recorded, the JSON report is flushed after
 * every panel so a wedge on panel 9 cannot cost you panels 1–8, the width
 * override is applied **twice per theme** rather than twice per panel (see
 * `forcePanelWidth`), and the overrides are always released in a `finally`.
 *
 * Shares the harness shape of `capture.mjs` and `panel-geometry.mjs` beside it:
 * one raw CDP socket, zero dependencies, drives the real editor.
 *
 * Prerequisite — a dev editor on a CDP endpoint **with a project open** (the rail
 * does not exist at the launcher), launched from the PRIMARY checkout:
 *
 *   nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
 *   until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
 *
 * Usage:
 *   node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs
 *   node panel-chrome.mjs [--width 1400] [--height 900] [--narrow 240]
 *                         [--out DIR] [--json report.json] [--no-shots]
 *                         [--min-title-chars 12] [--timeout 8000]
 *                         [--skip-narrow]
 *
 * Exits non-zero if any panel fails an assertion. `--json` is written even on a
 * catastrophic failure, so a wedged run still tells you how far it got.
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
const NARROW = Number(arg('--narrow', 240));
const JSON_OUT = arg('--json', null);
const SHOTS = !has('--no-shots');
const SKIP_NARROW = has('--skip-narrow');
// Short enough that a wedged renderer is detected while the run can still
// recover, long enough that a slow panel mount is not a false positive.
const CALL_TIMEOUT = Number(arg('--timeout', 8000));
const OUT = arg('--out', path.resolve(__dirname, '../../phase-25-side-panel/screenshots/pnl-005'));

const THEMES = ['dark', 'light'];

/** The contract this task defined. Change here, not in five places. */
const EXPECT = {
  headerHeight: 44,
  titleFontSize: 13,
  titleFontWeight: 650,
  tolerance: 1,
  /**
   * Assertion F's floor. A panel title cut below this many characters at the
   * panel's default width is not a title any more. 12 clears every registered
   * panel name's first word ("Component X-Ray", "Version Control", "Execution
   * History") while still failing "Co…".
   */
  minTitleChars: Number(arg('--min-title-chars', 12))
};

/**
 * F's failure class.
 *
 * It was introduced as "expected red until the ⋯ overflow menu lands" — PNL-009
 * landed the menu, so **this is now an ordinary failure**. It keeps its own code
 * and its own section in the summary because the remedy is specific (the header
 * budget printed with it says whether the mode group or the panel's own action
 * slot is the thing eating the bar), not because it is tolerated.
 */
const EXPECTED_RED = 'title-truncated';

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

async function setTheme(cdp, theme) {
  // ThemeManager.apply()'s DOM contract, replicated directly — synchronous and
  // deterministic, unlike the EditorSettings round-trip. Same as capture.mjs.
  await evalJS(
    cdp,
    `(() => {
      document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
      window.dispatchEvent(new CustomEvent('nodegx:themechanged'));
      return true;
    })()`
  );
  await sleep(400);
}

async function injectDeterminism(cdp) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await evalJS(
    cdp,
    `(() => {
      let s = document.getElementById('__pnl005_determinism');
      if (!s) { s = document.createElement('style'); s.id = '__pnl005_determinism'; document.head.appendChild(s); }
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
      return true;
    })()`
  );
}

/**
 * Force the docked panel to a given width, or release it (`px = null`).
 *
 * Injected CSS rather than a synthesised divider drag: the drag is PNL-003's
 * gesture and is not what this gate tests. Because the container query PNL-004
 * declares is on the panel frame's `inline-size`, narrowing the frame this way
 * exercises the real query.
 *
 * ⚠️ This is the prime suspect for the renderer wedge an earlier revision hit.
 * Forcing `width !important` on the panel fights the editor's own layout: PNL-003
 * persists the width, `EditorPage` recomputes the divider on resize, and the
 * canvas repaints on every one — a plausible resize→restyle→resize feedback
 * loop, and it was being toggled *four times per panel* (44 relayouts of a
 * canvas-bearing app in one run). It is now toggled twice per theme: the walk
 * runs a whole wide pass, then a whole narrow pass. If a wedge is ever seen
 * again, run with `--skip-narrow` to take this out of the picture entirely and
 * confirm.
 */
async function forcePanelWidth(cdp, px) {
  await evalJS(
    cdp,
    `(() => {
      let s = document.getElementById('__pnl005_width');
      if (!s) { s = document.createElement('style'); s.id = '__pnl005_width'; document.head.appendChild(s); }
      s.textContent = ${JSON.stringify(
        px ? `[class*="SideNavigation-module__Panel"]{width:${px}px!important;flex:0 0 ${px}px!important;}` : ''
      )};
      return true;
    })()`
  );
  await sleep(500);
}

/**
 * Runs inside the renderer. Every panel stays mounted behind `display:none`, so
 * everything here is scoped to the one `.PanelItem` that has a box — measuring
 * the document at large would find a dozen ghost headers (that is F28, and it is
 * exactly why the header carries `data-panel-title`).
 */
const MEASURE = `(() => {
  const root = document.querySelector('[class*="SideNavigation-module__Panel"]');
  if (!root) return { error: 'no side-panel root — is a project open?' };

  // PNL-009 fix: \`[class*="PanelItem"]\` also matches \`PanelItems\`, the wrapper
  // PNL-009 added around the list — and \`querySelectorAll\` returns the ancestor
  // first, so this used to select the *container* and report \`panelId: null\`.
  // It only kept working because every measurement below re-filters on
  // visibility. Anchor on the attribute that actually identifies a panel.
  const item = Array.from(root.querySelectorAll('[data-panel-id]'))
    .find((el) => el.getBoundingClientRect().height > 0);
  if (!item) return { error: 'no visible panel item' };

  const panelRect = item.getBoundingClientRect();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.height > 0 && r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  const headers = Array.from(item.querySelectorAll('[data-test="panel-header"]')).filter(visible);

  const out = {
    panelId: item.getAttribute('data-panel-id'),
    panelWidth: Math.round(panelRect.width),
    panelTitle: null,
    headerCount: headers.length,
    headerHeight: null,
    title: null,
    overflowRight: 0,
    sections: []
  };

  if (headers.length === 1) {
    const h = headers[0];
    const hr = h.getBoundingClientRect();
    out.panelTitle = h.getAttribute('data-panel-title');
    out.headerHeight = Math.round(hr.height * 100) / 100;

    // The title is the header's first child; read what actually computed, not
    // what the stylesheet says, so a later override shows up as a failure.
    const t = h.firstElementChild;
    if (t) {
      const cs = getComputedStyle(t);
      const tr = t.getBoundingClientRect();
      const text = (t.textContent || '').trim();

      // --- assertion F's measurement -------------------------------------
      // How many characters actually FIT, using the element's own computed
      // font. \`scrollWidth > clientWidth\` only says "something was cut"; it
      // cannot tell "Components" from "Co…", and that distinction is the whole
      // point. Real text metrics, so the answer is the rendered truth.
      let visibleChars = text.length;
      try {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        const avail = t.clientWidth;
        if (ctx.measureText(text).width > avail) {
          // Longest prefix that fits, allowing for the ellipsis glyph.
          const ell = ctx.measureText('…').width;
          let lo = 0, hi = text.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (ctx.measureText(text.slice(0, mid)).width + ell <= avail) lo = mid;
            else hi = mid - 1;
          }
          visibleChars = lo;
        }
      } catch (e) {
        visibleChars = null; // metrics unavailable — assertion F will be skipped
      }

      out.title = {
        text,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: Number(cs.fontWeight),
        color: cs.color,
        whiteSpace: cs.whiteSpace,
        textOverflow: cs.textOverflow,
        clientWidth: t.clientWidth,
        visibleChars,
        // One line: the box is no taller than a single line box.
        lines: Math.round(tr.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)),
        isTruncated: t.scrollWidth > t.clientWidth + 1
      };
    }

    // Nothing in the header may sit outside the panel. This is the assertion
    // PNL-007 needed (a 73-char name pushed its action rail 362px past the edge).
    for (const el of h.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      out.overflowRight = Math.max(out.overflowRight, Math.round(r.right - panelRect.right));
    }

    // PNL-009: when F fails, "the title is 24px" does not say *what took the
    // other 300*. The header has exactly three consumers — the title, the
    // panel's own action slot, and the side panel's mode group — so report all
    // three and the next reader knows immediately whether the fix belongs in
    // SidePanel.tsx (mode group) or in the panel itself (action slot).
    const kids = h.children.length > 1 ? h.children[1] : null;
    const modeGroup = kids ? Array.from(kids.children).find((el) => /ModeGroup/.test(el.className || '')) : null;
    const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    out.budget = {
      header: Math.round(h.getBoundingClientRect().width),
      title: out.title ? out.title.clientWidth : 0,
      actions: w(kids) - w(modeGroup),
      modeGroup: w(modeGroup),
      // How many of the mode group's controls are actually showing. Under the
      // narrow band two of them are demoted into the ⋯; if this stays at four
      // in a narrow panel then the demotion is not applying.
      modeControls: modeGroup ? Array.from(modeGroup.querySelectorAll('button')).filter(visible).length : 0
    };
  }

  for (const sh of Array.from(item.querySelectorAll('[class*="CollapsableSection-module__Header"]')).filter(visible)) {
    const r = sh.getBoundingClientRect();
    const titleEl = sh.firstElementChild;
    out.sections.push({
      height: Math.round(r.height * 100) / 100,
      fontSize: titleEl ? parseFloat(getComputedStyle(titleEl).fontSize) : null,
      background: getComputedStyle(sh).backgroundColor
    });
  }

  return out;
})()`;

/** Which panels exist in the DOM at all, vs. which the rail can reach. */
const COVERAGE = `(() => {
  const root = document.querySelector('[class*="SideNavigation-module__Panel"]');
  const mounted = root
    ? Array.from(root.querySelectorAll('[data-panel-id]')).map((el) => el.getAttribute('data-panel-id'))
    : [];
  const rail = Array.from(document.querySelectorAll('[data-test]'))
    .filter((el) => el.offsetParent !== null && /-panel$/.test(el.getAttribute('data-test')))
    .map((el) => el.getAttribute('data-test').replace(/-panel$/, ''));
  return { mounted, rail };
})()`;

/** @returns {{code: string, msg: string}[]} */
function assess(m, label, { checkTitleWidth }) {
  const fails = [];
  const T = EXPECT.tolerance;
  const add = (code, msg) => fails.push({ code, msg: `${label}: ${msg}` });

  if (m.headerCount === 0) add('no-header', 'no panel header at all (panel or state never migrated to BasePanel)');
  else if (m.headerCount > 1) add('two-headers', `${m.headerCount} panel headers (a panel kept its own bar as well)`);

  if (m.headerCount === 1) {
    if (Math.abs(m.headerHeight - EXPECT.headerHeight) > T)
      add('height', `header is ${m.headerHeight}px, expected ${EXPECT.headerHeight}px`);

    if (!m.title) add('no-title', 'header has no title element');
    else {
      if (Math.abs(m.title.fontSize - EXPECT.titleFontSize) > 0.6)
        add('font-size', `title is ${m.title.fontSize}px, expected ${EXPECT.titleFontSize}px`);
      if (m.title.fontWeight !== EXPECT.titleFontWeight)
        add('font-weight', `title weight is ${m.title.fontWeight}, expected ${EXPECT.titleFontWeight}`);
      if (m.title.whiteSpace !== 'nowrap') add('wrap', `title white-space is ${m.title.whiteSpace}, expected nowrap`);
      if (m.title.textOverflow !== 'ellipsis')
        add('ellipsis', `title text-overflow is ${m.title.textOverflow}, expected ellipsis`);
      if (m.title.lines > 1) add('lines', `title wrapped to ${m.title.lines} lines`);

      // --- F: not truncated to a stub at the panel's default width ---------
      if (checkTitleWidth && m.title.visibleChars != null) {
        const floor = Math.min(EXPECT.minTitleChars, m.title.text.length);
        if (m.title.visibleChars < floor) {
          const b = m.budget || {};
          add(
            EXPECTED_RED,
            `title "${m.title.text}" renders only ${m.title.visibleChars} of ${m.title.text.length} characters ` +
              `(“${m.title.text.slice(0, m.title.visibleChars)}…”) in ${m.title.clientWidth}px at a ` +
              `${m.panelWidth}px panel — needs ${floor}. Header budget: title ${b.title}px, ` +
              `action slot ${b.actions}px, mode group ${b.modeGroup}px across ${b.modeControls} visible controls. ` +
              `If the mode group is the big number the ⋯ demotion is not applying; if the action slot is, ` +
              `the panel's own header controls are the thing to shrink.`
          );
        }
      }
    }

    if (m.overflowRight > 1) add('overflow', `header content is ${m.overflowRight}px past the panel's right edge`);
  }

  for (const s of m.sections) {
    if (s.height > EXPECT.headerHeight - 2)
      add('section-height', `a section header is ${s.height}px — not visibly shorter than the ${EXPECT.headerHeight}px panel header`);
    if (m.title && s.fontSize != null && s.fontSize >= m.title.fontSize)
      add('section-size', `a section title is ${s.fontSize}px — not smaller than the panel title's ${m.title.fontSize}px`);
  }

  return fails;
}

// ---- main -------------------------------------------------------------------
const report = { width: WIDTH, height: HEIGHT, narrow: NARROW, minTitleChars: EXPECT.minTitleChars, coverage: null, results: [] };

/** Flushed after every panel, so a wedge cannot cost the panels already walked. */
function flush() {
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
}

(async () => {
  console.log(`PNL-005 panel-chrome gate @ ${WIDTH}x${HEIGHT}${SKIP_NARROW ? '' : `, narrow ${NARROW}px`}`);
  if (SHOTS) {
    fs.mkdirSync(OUT, { recursive: true });
    console.log(`screenshots → ${OUT}`);
  }

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
  await injectDeterminism(cdp);

  const cov = await evalJS(cdp, COVERAGE);
  report.coverage = cov;
  const railButtons = cov.rail;

  if (!railButtons.length) {
    console.error('No rail panel buttons found. Open a project in the editor first.');
    process.exit(1);
  }

  /*
   * Coverage is reported, never assumed — a rail walk does NOT see every panel,
   * and a green run over half of them is how a gap survives.
   *
   * `router.setup.ts` registers 21 panels, but:
   *   - `transient: true` (PropertyEditor, PortEditor) are filtered out of
   *     `getVisibleItems()` entirely; they appear only on canvas selection.
   *   - `experimental: true` (10 of them) need `experimental.panel.<id>` set in
   *     EditorSettings.
   *   - three more sit behind `config.devMode`.
   * A default-settings editor therefore shows **8** rail buttons. Turn the
   * experimental panels on before running this if you want real coverage, and
   * check Properties and Ports by hand — they are in the live-QA checklist.
   */
  console.log(`rail reaches ${railButtons.length}: ${railButtons.join(', ')}`);
  const unreachable = (cov.mounted || []).filter((id) => !railButtons.includes(id));
  if (unreachable.length) console.log(`mounted but NOT rail-reachable (not covered): ${unreachable.join(', ')}`);
  const expectPanels = Number(arg('--expect-panels', 0));
  if (expectPanels && railButtons.length < expectPanels) {
    console.log(
      `⚠️  COVERAGE: ${railButtons.length} rail panels, expected at least ${expectPanels}. ` +
        `Enable the experimental panels or this run proves less than you think.`
    );
    report.coverageShortfall = { got: railButtons.length, expected: expectPanels };
  }
  console.log('');

  const failures = [];
  let timeouts = 0;
  // rail id -> the title its header is known by, learned on first sighting and
  // then held to. See the `stale-panel` check below.
  const titleByPanel = new Map();

  try {
    for (const theme of THEMES) {
      await setTheme(cdp, theme);
      await injectDeterminism(cdp);

      // Two passes per theme, not two width toggles per panel. See forcePanelWidth.
      const passes = SKIP_NARROW ? [null] : [null, NARROW];

      for (const px of passes) {
        const label = px === null ? 'wide' : `${px}px`;
        console.log(`[theme: ${theme}] [${label}]`);
        await forcePanelWidth(cdp, px);

        for (const id of railButtons) {
          // Per-panel isolation: a timeout or a thrown assertion skips this
          // panel and is recorded. It never aborts the run.
          try {
            if (!(await clickSel(cdp, `[data-test="${id}-panel"]`))) {
              console.log(`  ?  ${id} — not clickable, skipped`);
              continue;
            }
            const safe = id.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
            let m = await evalJS(cdp, MEASURE);

            if (m.error) {
              failures.push({ panel: id, theme, pass: label, code: 'measure', msg: m.error });
              console.log(`  ✗  ${id} — ${m.error}`);
              continue;
            }

            // The panel switch is not synchronous, and 700ms is not a promise.
            // One run in 36 measured `ai-authoring` while "Explain" was still on
            // screen and passed — because "Explain" is short enough to fit, so
            // every assertion was green about the wrong panel. That is F36's
            // lesson repeating one layer up. Remember the title each panel is
            // known by, and when a later read disagrees, wait and look again
            // before believing it.
            const seen = titleByPanel.get(id);
            if (seen !== undefined && m.panelTitle !== seen) {
              await sleep(800);
              m = await evalJS(cdp, MEASURE);
            }
            if (m.panelTitle) {
              if (seen === undefined) titleByPanel.set(id, m.panelTitle);
              else if (m.panelTitle !== seen) {
                failures.push({
                  panel: id,
                  theme,
                  pass: label,
                  code: 'stale-panel',
                  msg: `header reads "${m.panelTitle}" but this panel is known as "${seen}" — the measurement is of a panel that had not finished switching`
                });
                console.log(`  ✗  ${id} — measured "${m.panelTitle}", expected "${seen}"`);
                continue;
              }
            }

            // Capture BEFORE asserting: a screenshot of a failing panel is the
            // most useful artefact there is, and a wedge on the assert side
            // must not cost the image.
            if (SHOTS) {
              const suffix = px === null ? '' : `--narrow${px}`;
              const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 15000);
              fs.writeFileSync(path.join(OUT, `${safe}--${theme}${suffix}.png`), Buffer.from(data, 'base64'));
            }

            const f = assess(m, label, { checkTitleWidth: px === null });
            report.results.push({ panel: id, theme, pass: label, title: m.panelTitle, measured: m, failures: f });

            if (f.length === 0) {
              console.log(`  ✓  ${id}  "${m.panelTitle ?? ''}"`);
            } else {
              for (const { code, msg } of f) {
                failures.push({ panel: id, theme, pass: label, code, msg });
                console.log(`  ${code === EXPECTED_RED ? '▲' : '✗'}  ${id} — ${msg}`);
              }
            }
          } catch (err) {
            const isTimeout = /timeout|socket closed/i.test(err.message);
            if (isTimeout) timeouts++;
            failures.push({ panel: id, theme, pass: label, code: 'harness', msg: err.message });
            console.log(`  !  ${id} — skipped: ${err.message}`);
            // A wedged renderer will time out on every subsequent call; stop
            // rather than grind through 30 more 8-second waits.
            if (timeouts >= 3) throw new Error(`renderer appears wedged (${timeouts} consecutive CDP timeouts) — aborting cleanly`);
          } finally {
            flush();
          }
        }
        console.log('');
      }
    }
  } finally {
    // Always give the editor back. Leaving a `width !important` override or a
    // device-metrics override behind is how the previous run left it unusable.
    try {
      await forcePanelWidth(cdp, null);
      await cdp.send('Emulation.clearDeviceMetricsOverride', {}, 5000);
    } catch {
      console.log('(could not release overrides — restart the editor)');
    }
    flush();
    if (JSON_OUT) console.log(`wrote ${JSON_OUT}`);
  }

  const expected = failures.filter((f) => f.code === EXPECTED_RED);
  const real = failures.filter((f) => f.code !== EXPECTED_RED);

  console.log(`\n${report.results.length} panel×theme×width checks run.`);
  if (expected.length) {
    console.log(`\n✗ ${expected.length} truncated titles (assertion F). The ⋯ overflow menu exists (PNL-009), so`);
    console.log(`  this is a real failure, not a known one — the header budget in each line says where to look:`);
    for (const f of expected) console.log(`  - ${f.panel} [${f.theme}] ${f.msg}`);
  }
  if (real.length) {
    console.log(`\n✗ ${real.length} real failures:`);
    for (const f of real) console.log(`  - ${f.panel} [${f.theme}/${f.pass}] (${f.code}) ${f.msg}`);
  }
  if (!failures.length) console.log('\n✓ clean.');

  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('panel-chrome failed:', err.message);
  flush();
  process.exit(1);
});
