#!/usr/bin/env node
/**
 * PNL-005 panel-chrome gate + screenshot corpus.
 *
 * "Every panel wears the same header" is a claim you can only settle by looking
 * at every panel. This walks the rail in **both themes**, and for each panel it
 *
 *   1. screenshots it into `dev-docs/tasks/phase-25-side-panel/screenshots/pnl-005/`,
 *   2. measures its header and asserts the shared chrome actually applied.
 *
 * The assertions are the point — screenshots prove a human looked, measurements
 * prove the same rule produced all of them:
 *
 *   A. exactly **one** visible `[data-test="panel-header"]` in the active panel —
 *      not zero (a panel that never migrated) and not two (a panel that kept its
 *      own bar as well).
 *   B. the header is **44px** tall.
 *   C. the title is **13px / 650 / fg-highlight**, on one line.
 *   D. nothing in the header is pushed outside the panel's right edge.
 *   E. section headers inside the panel are **subordinate** — shorter than the
 *      panel header and set smaller than its title (acceptance item 4).
 *
 * Then it repeats B–D with the panel forced to **240px**, which is acceptance
 * item 3: the title must ellipsise rather than wrap or push the controls out.
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
 *
 * Exits non-zero if any panel fails an assertion.
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
const OUT = arg('--out', path.resolve(__dirname, '../../phase-25-side-panel/screenshots/pnl-005'));

const THEMES = ['dark', 'light'];

/** The contract this task defined. Change here, not in five places. */
const EXPECT = {
  headerHeight: 44,
  titleFontSize: 13,
  titleFontWeight: 650,
  tolerance: 1
};

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
 * Force the docked panel to a given width, or release it.
 *
 * Injected CSS rather than a synthesised divider drag: the drag is PNL-003's
 * gesture and is not what this gate is testing. Because the container query
 * PNL-004 declares is on the panel frame's `inline-size`, narrowing the frame
 * this way exercises the real query.
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
  await sleep(350);
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

  const item = Array.from(root.querySelectorAll('[class*="PanelItem"]'))
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
      out.title = {
        text: (t.textContent || '').trim(),
        fontSize: parseFloat(cs.fontSize),
        fontWeight: Number(cs.fontWeight),
        color: cs.color,
        whiteSpace: cs.whiteSpace,
        textOverflow: cs.textOverflow,
        // One line: the box is no taller than a single line box.
        lines: Math.round(tr.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)),
        // Ellipsis engaged (only meaningful when it actually overflows).
        isTruncated: t.scrollWidth > t.clientWidth + 1
      };
    }

    // Nothing in the header may sit outside the panel. This is the assertion
    // PNL-007 needed (a 73-char name pushed its action rail 362px past the edge)
    // and it is acceptance item 3's real content.
    for (const el of h.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      out.overflowRight = Math.max(out.overflowRight, Math.round(r.right - panelRect.right));
    }
  }

  // Acceptance 4: section headers must read as children of the panel header.
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

function assess(m, label) {
  const fails = [];
  const T = EXPECT.tolerance;

  if (m.headerCount === 0) fails.push('no panel header at all (panel never migrated to BasePanel)');
  else if (m.headerCount > 1) fails.push(`${m.headerCount} panel headers (a panel kept its own bar as well)`);

  if (m.headerCount === 1) {
    if (Math.abs(m.headerHeight - EXPECT.headerHeight) > T)
      fails.push(`header is ${m.headerHeight}px, expected ${EXPECT.headerHeight}px`);

    if (!m.title) fails.push('header has no title element');
    else {
      if (Math.abs(m.title.fontSize - EXPECT.titleFontSize) > 0.6)
        fails.push(`title is ${m.title.fontSize}px, expected ${EXPECT.titleFontSize}px`);
      if (m.title.fontWeight !== EXPECT.titleFontWeight)
        fails.push(`title weight is ${m.title.fontWeight}, expected ${EXPECT.titleFontWeight}`);
      if (m.title.whiteSpace !== 'nowrap') fails.push(`title white-space is ${m.title.whiteSpace}, expected nowrap`);
      if (m.title.textOverflow !== 'ellipsis')
        fails.push(`title text-overflow is ${m.title.textOverflow}, expected ellipsis`);
      if (m.title.lines > 1) fails.push(`title wrapped to ${m.title.lines} lines`);
    }

    if (m.overflowRight > 1) fails.push(`header content is ${m.overflowRight}px past the panel's right edge`);
  }

  // Subordination — only meaningful when the panel actually has sections.
  for (const s of m.sections) {
    if (s.height > EXPECT.headerHeight - 2)
      fails.push(`a section header is ${s.height}px — not visibly shorter than the ${EXPECT.headerHeight}px panel header`);
    if (m.title && s.fontSize != null && s.fontSize >= m.title.fontSize)
      fails.push(`a section title is ${s.fontSize}px — not smaller than the panel title's ${m.title.fontSize}px`);
  }

  return fails.map((f) => `${label}: ${f}`);
}

// ---- main -------------------------------------------------------------------
(async () => {
  console.log(`PNL-005 panel-chrome gate @ ${WIDTH}x${HEIGHT}, narrow ${NARROW}px`);
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
  console.log(`walking ${railButtons.length} rail panels\n`);

  const results = [];
  const failures = [];

  for (const theme of THEMES) {
    console.log(`[theme: ${theme}]`);
    await setTheme(cdp, theme);
    await injectDeterminism(cdp);

    for (const id of railButtons) {
      if (!(await clickSel(cdp, `[data-test="${id}"]`))) {
        console.log(`  ?  ${id} — not clickable, skipped`);
        continue;
      }
      const safe = id.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

      // --- wide ---
      await forcePanelWidth(cdp, null);
      const wide = await evalJS(cdp, MEASURE);
      if (wide.error) {
        failures.push(`${id} [${theme}]: ${wide.error}`);
        console.log(`  ✗  ${id} — ${wide.error}`);
        continue;
      }
      if (SHOTS) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        fs.writeFileSync(path.join(OUT, `${safe}--${theme}.png`), Buffer.from(data, 'base64'));
      }

      // --- narrow (acceptance item 3) ---
      await forcePanelWidth(cdp, NARROW);
      const narrow = await evalJS(cdp, MEASURE);
      if (SHOTS && !narrow.error) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        fs.writeFileSync(path.join(OUT, `${safe}--${theme}--narrow${NARROW}.png`), Buffer.from(data, 'base64'));
      }
      await forcePanelWidth(cdp, null);

      const f = [...assess(wide, 'wide'), ...(narrow.error ? [] : assess(narrow, `${NARROW}px`))];
      results.push({ panel: id, theme, title: wide.panelTitle, wide, narrow });

      if (f.length === 0) {
        console.log(`  ✓  ${id}  "${wide.panelTitle ?? ''}"`);
      } else {
        for (const line of f) {
          failures.push(`${id} [${theme}] ${line}`);
          console.log(`  ✗  ${id} — ${line}`);
        }
      }
    }
    console.log('');
  }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ width: WIDTH, height: HEIGHT, narrow: NARROW, results }, null, 2));
    console.log(`wrote ${JSON_OUT}`);
  }

  const checked = results.length;
  console.log(`${checked - new Set(failures.map((f) => f.split(' ')[0])).size}/${checked} panel×theme checks clean.`);
  if (failures.length) {
    console.log(`\n${failures.length} assertion failures:`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('panel-chrome failed:', err.message);
  process.exit(1);
});
