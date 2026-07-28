#!/usr/bin/env node
/**
 * PNL-006 components-tree gate + screenshot corpus.
 *
 * The complaint this task answers — *"the component panel is still a bit messy
 * and hard to see in light mode"* — has a numeric cause, so it gets a numeric
 * gate rather than an opinion. In **both themes** this walks the Components
 * panel and asserts:
 *
 *   A. THE LIGHT-MODE FIX. The selected row's label measures **≥ 4.5:1** (WCAG
 *      AA) against the background that is *actually rendered* behind it. The
 *      selection fill is translucent, so the comparison composites it over its
 *      ancestors exactly as the compositor does — comparing against the declared
 *      `rgba()` would flatter it. Before this task the light theme measured
 *      3.70:1 (azure ink on a 12% azure tint), which is the whole bug.
 *   B. INDENT GUIDES AT FOUR LEVELS. Each row carries exactly `level` guides,
 *      drawn as a repeating gradient clipped to `level × indent` — so the
 *      assertion is that the painted background box is the width the depth
 *      implies. A row at depth 4 that draws three guides fails.
 *   C. ELLIPSIS AND THE WARNING DOT AT 240px. Long names ellipsise rather than
 *      wrap or push, the dot keeps its width, and nothing in a row crosses the
 *      panel's right edge.
 *   D. THE WARNING DOT'S CONTRACT — 6px, round, amber — read from the
 *      stylesheet, so it is checked even on a project that happens to be clean,
 *      plus the rendered geometry of any real dots.
 *   E. NO SECOND NODE-COLOUR SOURCE. Every kind glyph's *computed* colour is
 *      compared against the `--theme-color-node-category-*` custom property that
 *      `CanvasTheme` resolves the canvas from. If the tree ever grows its own
 *      palette, or drifts from the canvas by a single level, this goes red.
 *      This is the assertion that makes "the tree matches the graph" a fact
 *      rather than a claim.
 *
 * Screenshots land in `dev-docs/tasks/phase-25-side-panel/screenshots/pnl-006/`.
 *
 * ---------------------------------------------------------------------------
 * ROBUSTNESS — inherited wholesale from `panel-chrome.mjs`, which was hardened
 * after an earlier revision wedged the renderer and took the editor down with
 * it. The rules that survived a real run:
 *
 *   - every phase is wrapped: a CDP timeout SKIPS and is recorded, never aborts;
 *   - screenshots are captured BEFORE anything is asserted, because the image of
 *     a failing panel is the most useful artefact in the run;
 *   - the JSON report is flushed after every phase, so a wedge on the last one
 *     cannot cost you the earlier ones;
 *   - every injected style is released in a `finally`. A leaked `!important`
 *     width override is exactly how the previous agent's editor got wedged.
 *
 * SKIPS ARE NOT PASSES. Anything this run could not prove — no project open, a
 * tree shallower than four levels, a project with no warnings — is reported by
 * name at the end and recorded in the JSON. A green run with three skips is
 * three things you still have to check by hand.
 * ---------------------------------------------------------------------------
 *
 * Prerequisite — a dev editor on a CDP endpoint **with a project open** (the
 * rail does not exist at the launcher), launched from the PRIMARY checkout:
 *
 *   nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
 *   until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
 *
 * Usage:
 *   node dev-docs/tasks/phase-23-visual-refresh/corpus/components-tree.mjs
 *   node components-tree.mjs [--width 1400] [--height 900] [--narrow 240]
 *                            [--out DIR] [--json report.json] [--no-shots]
 *                            [--min-contrast 4.5] [--min-depth 4]
 *                            [--timeout 8000] [--skip-narrow]
 *
 * Exits non-zero if any assertion fails. `--json` is written even on a
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
const CALL_TIMEOUT = Number(arg('--timeout', 8000));
const OUT = arg('--out', path.resolve(__dirname, '../../phase-25-side-panel/screenshots/pnl-006'));

const THEMES = ['dark', 'light'];

/** The contract PNL-006 defined. Change here, not in five places. */
const EXPECT = {
  /** WCAG AA for body text. Assertion A. */
  minContrast: Number(arg('--min-contrast', 4.5)),
  /** Acceptance item 2 asks for four levels to be readable. Assertion B. */
  minDepth: Number(arg('--min-depth', 4)),
  /** The stylesheet's indent step. Assertion B derives guide counts from it. */
  indent: 12,
  /** The warning dot. Assertion D. */
  dotSize: 6,
  /** A glyph is a non-text UI element: WCAG's 3:1, not 4.5:1. */
  minGlyphContrast: 3.0
};

/**
 * Recorded exemptions from `minGlyphContrast` — Richard's call, 2026-07-28.
 *
 * An exemption is NOT a skip. A skip means "this run could not prove it"; these
 * are measured every pass, reported every pass, and accepted. They are also not
 * a blank cheque: each carries a `floor`, and dropping below it FAILS. So the
 * exemption records a decision without turning the assertion off.
 *
 * Do not add one without the same three fields, and do not add one for a glyph
 * that carries meaning on its own.
 */
const GLYPH_CONTRAST_EXEMPT = {
  default: {
    floor: 2.9,
    why:
      '`.Cat-default` is deliberately `var(--theme-color-fg-muted)` because CanvasTheme’s ' +
      '`categoryDefault` is the same token — an uncategorised component is meant to look ' +
      'identical in the tree and on the canvas, and editing one side breaks that silently. ' +
      'The miss is 2.97 against 3.0 (1%) on a DECORATIVE glyph: the row is identified by its ' +
      'label, which measures 13.72:1, so the glyph is redundant information rather than the ' +
      'thing carrying meaning, and WCAG 1.4.11 scopes the 3:1 bar to elements required to ' +
      'understand content. Fixing it means lifting `fg-muted` globally (UIX-005/UIX-012 ' +
      'territory, and it moves the canvas too) or accepting a deliberate tree/canvas ' +
      'divergence. Neither is worth 0.03 on a decoration. DO NOT "fix" this by editing one side.'
  }
};

/** The tree's kind→category expectation, mirroring `componentKind.ts`. */
const CATEGORY_TOKEN = {
  visual: '--theme-color-node-category-visual',
  data: '--theme-color-node-category-data',
  // CanvasTheme maps the `javascript` category onto the *function* token.
  javascript: '--theme-color-node-category-function',
  component: '--theme-color-node-category-component',
  default: '--theme-color-fg-muted'
};

// ---- tiny CDP client (one socket, sequential) -------------------------------
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

async function clickSel(cdp, selector, index = 0) {
  const box = await evalJS(
    cdp,
    `(() => {
      const els = document.querySelectorAll(${JSON.stringify(selector)});
      const el = els[${index}];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return { x: r.x + Math.min(r.width / 2, 60), y: r.y + r.height / 2 };
    })()`
  );
  if (!box) return false;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(450);
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
      let s = document.getElementById('__pnl006_determinism');
      if (!s) { s = document.createElement('style'); s.id = '__pnl006_determinism'; document.head.appendChild(s); }
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
      return true;
    })()`
  );
}

/**
 * Force the docked panel to a given width, or release it (`px = null`).
 *
 * The element is *resolved at runtime* — walk up from `[data-panel-id]` to the
 * ancestor that actually carries the panel column's width — rather than named by
 * a hashed CSS-module class. `panel-chrome.mjs` targets
 * `[class*="SideNavigation-module__Panel"]`, which is correct today but is a
 * class this gate has no business knowing: PNL-009 is reworking `SidePanel.tsx`
 * and its panel chrome, and a gate that silently stops narrowing anything is a
 * gate that silently stops testing assertion C. `data-panel-id` is a contract;
 * a hash is not.
 *
 * ⚠️ See `panel-chrome.mjs` for why this is the prime suspect whenever the
 * renderer wedges: forcing `width !important` fights the editor's own layout,
 * and a resize→restyle→resize loop through a canvas-bearing app is plausible.
 * It is toggled twice per theme here, never per row, and always released in the
 * `finally` at the bottom. `--skip-narrow` takes it out of the picture entirely.
 */
async function forcePanelWidth(cdp, px) {
  const ok = await evalJS(
    cdp,
    `(() => {
      const item = document.querySelector('[data-panel-id]');
      if (!item) return false;
      // The panel column is the nearest ancestor materially wider than the
      // panel body is tall-and-narrow — in practice, the first ancestor whose
      // width differs from the viewport's. Walk up until the width stops
      // tracking the item's, then take that element.
      let el = item;
      const target = (() => {
        let n = item;
        while (n && n.parentElement && n.parentElement !== document.body) {
          n = n.parentElement;
          const w = n.getBoundingClientRect().width;
          // Stop before we reach the full editor width (rail + panel + canvas).
          if (w > window.innerWidth * 0.7) break;
          el = n;
        }
        return el;
      })();
      if (!target) return false;
      window.__pnl006_widthEl = target;
      const px = ${px === null ? 'null' : px};
      if (px === null) {
        // Put back what was there, do not just delete the declaration.
        //
        // The panel's docked width is driven from outside this element (the
        // FrameDivider's custom properties, via PNL-003's layout state), and
        // removing an inline width the harness did not necessarily author leaves
        // the panel with nothing sizing it — it collapses to about 4px and
        // neither the rail nor the hide toggle brings it back, because as far as
        // the app is concerned nothing changed. That wedges the editor for every
        // gate that runs afterwards, which is F35's lesson (a gate must not leave
        // the app worse than it found it) with the sign flipped: it is not only
        // injected styles that have to be undone, it is removed ones too.
        const saved = window.__pnl006_savedWidth;
        if (saved && saved.el === target) {
          if (saved.width) target.style.setProperty('width', saved.width, saved.widthPriority || '');
          else target.style.removeProperty('width');
          if (saved.flex) target.style.setProperty('flex', saved.flex, saved.flexPriority || '');
          else target.style.removeProperty('flex');
          window.__pnl006_savedWidth = null;
        }
        // Nothing saved means this harness never set a width, so there is nothing
        // of ours to undo — and removing the declaration anyway is what collapsed
        // the panel. The passes run [wide, narrow], so the very first call is this
        // one: the gate was destroying the width before it measured anything.
      } else {
        if (!window.__pnl006_savedWidth) {
          window.__pnl006_savedWidth = {
            el: target,
            width: target.style.getPropertyValue('width'),
            widthPriority: target.style.getPropertyPriority('width'),
            flex: target.style.getPropertyValue('flex'),
            flexPriority: target.style.getPropertyPriority('flex')
          };
        }
        target.style.setProperty('width', px + 'px', 'important');
        target.style.setProperty('flex', '0 0 ' + px + 'px', 'important');
      }
      return true;
    })()`
  );
  if (!ok) console.log('  (could not resolve the panel column — width override skipped)');
  await sleep(500);
}

/* ---------------------------------------------------------------------------
 * The measurement, run inside the renderer.
 *
 * Everything is scoped to the visible panel: every panel stays mounted behind
 * `display:none`, so measuring the document at large finds ghost rows.
 * ------------------------------------------------------------------------- */
const MEASURE = `(() => {
  // --- colour maths, in the renderer so it sees computed values -------------
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,/\\s]+([\\d.]+))?/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /**
   * The colour a translucent stack ACTUALLY renders as. Walks up collecting
   * background layers until an opaque one, then composites back-to-front — the
   * same thing the compositor does. Comparing a label against the declared
   * \`rgba(…, .09)\` instead of this would flatter the result by a wide margin,
   * and flattering the result is how the 3.70:1 bug survived review.
   */
  const effectiveBg = (el) => {
    const layers = [];
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    let out = { r: 255, g: 255, b: 255 };
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      out = { r: out.r + (l.r - out.r) * l.a, g: out.g + (l.g - out.g) * l.a, b: out.b + (l.b - out.b) * l.a };
    }
    return out;
  };
  const rgbStr = (c) => 'rgb(' + [c.r, c.g, c.b].map((v) => Math.round(v)).join(',') + ')';

  // Located by data attributes, never by a hashed CSS-module class — see
  // forcePanelWidth. Every panel stays mounted behind \`display:none\`, so the
  // visible-box filter is what keeps this off the ghost trees.
  const tree = Array.from(document.querySelectorAll('[data-test="component-tree"]'))
    .find((el) => el.getBoundingClientRect().height > 0);
  if (!tree) return { error: 'components tree not visible — is a project open and the Components panel active?' };

  const panelItem = tree.closest('[data-panel-id]') || tree.parentElement;
  const panelRect = (panelItem || tree).getBoundingClientRect();

  const rows = Array.from(tree.querySelectorAll('[data-test="component-tree-item"]'))
    .filter((el) => el.getBoundingClientRect().height > 0);

  const cs = getComputedStyle(document.documentElement);
  const token = (name) => cs.getPropertyValue(name).trim();

  const out = {
    panelWidth: Math.round(panelRect.width),
    rowCount: rows.length,
    maxLevel: -1,
    rowHeight: null,
    selected: null,
    levels: {},      // level -> { count, guideWidth, expectedGuideWidth }
    glyphs: [],      // one per distinct category present
    ellipsised: 0,
    overflowRight: 0,
    dots: [],
    dotRule: null,
    kinds: {}
  };

  // --- row geometry, depth, guides ----------------------------------------
  for (const row of rows) {
    const level = Number(row.getAttribute('data-level') || 0);
    const kind = row.getAttribute('data-kind') || '?';
    out.kinds[kind] = (out.kinds[kind] || 0) + 1;
    if (level > out.maxLevel) out.maxLevel = level;

    const rs = getComputedStyle(row);
    if (out.rowHeight === null) out.rowHeight = Math.round(row.getBoundingClientRect().height * 100) / 100;

    if (!out.levels[level]) {
      // \`background-size\` is "<w> <h>"; the width is the guide box, and it is
      // \`level * indent\` by construction. This is the assertion: the painted
      // box must agree with the depth the row claims.
      const size = rs.backgroundSize.split(' ')[0];
      out.levels[level] = {
        count: 0,
        guideWidth: parseFloat(size),
        hasGradient: /repeating-linear-gradient/.test(rs.backgroundImage),
        backgroundPositionX: rs.backgroundPositionX
      };
    }
    out.levels[level].count++;

    // Nothing in a row may cross the panel's right edge.
    for (const el of row.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      out.overflowRight = Math.max(out.overflowRight, Math.round(r.right - panelRect.right));
    }

    const label = row.querySelector('[class*="ComponentsPanel-module__Label"]');
    if (label && label.scrollWidth > label.clientWidth + 1) out.ellipsised++;
  }

  // --- A: the selected row -------------------------------------------------
  const sel = rows.find((r) => /Selected/.test(r.className));
  if (sel) {
    const label = sel.querySelector('[class*="ComponentsPanel-module__Label"]');
    const bg = effectiveBg(sel);
    const fg = parse(getComputedStyle(label || sel).color);
    out.selected = {
      kind: sel.getAttribute('data-kind'),
      text: (label && label.textContent) || '',
      background: rgbStr(bg),
      declaredBackground: getComputedStyle(sel).backgroundColor,
      color: getComputedStyle(label || sel).color,
      contrast: fg ? Math.round(contrast(fg, bg) * 100) / 100 : null,
      // The 2px accent bar that carries selection now that the label does not.
      boxShadow: getComputedStyle(sel).boxShadow
    };
  }

  // --- E: glyph colour vs. the canvas's own token ---------------------------
  const seen = new Set();
  for (const row of rows) {
    const glyph = row.querySelector('[class*="ComponentsPanel-module__Icon"]');
    if (!glyph) continue;
    const cls = glyph.className || '';
    const m = /ComponentsPanel-module__Cat-([a-z]+)/.exec(cls);
    const isHome = /ComponentsPanel-module__Kind-home/.test(cls);
    const key = isHome ? 'home' : m ? m[1] : 'none';
    if (seen.has(key)) continue;
    seen.add(key);

    const actual = parse(getComputedStyle(glyph).color);
    const bg = effectiveBg(glyph);
    out.glyphs.push({
      key,
      kind: row.getAttribute('data-kind'),
      actual: getComputedStyle(glyph).color,
      // Home is brand coral — the one sanctioned non-danger use of it.
      expectedToken: isHome ? '--theme-color-brand' : null,
      contrast: actual ? Math.round(contrast(actual, bg) * 100) / 100 : null
    });
  }
  // Resolve every token this run cares about, so the comparison happens outside.
  out.tokens = {};
  for (const n of [
    '--theme-color-node-category-visual',
    '--theme-color-node-category-data',
    '--theme-color-node-category-function',
    '--theme-color-node-category-component',
    '--theme-color-fg-muted',
    '--theme-color-brand',
    '--theme-color-warning'
  ]) out.tokens[n] = token(n);

  // --- D: the warning dot ---------------------------------------------------
  for (const dot of tree.querySelectorAll('[data-test="component-tree-warning"]')) {
    const r = dot.getBoundingClientRect();
    const ds = getComputedStyle(dot);
    out.dots.push({
      count: Number(dot.getAttribute('data-count') || 0),
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      right: Math.round(r.right - panelRect.right),
      background: ds.backgroundColor,
      visible: r.width > 0 && ds.visibility !== 'hidden' && ds.display !== 'none'
    });
  }
  // The dot's *rule*, read from the stylesheet, so its contract is checked even
  // on a project that happens to have no warnings at all.
  //
  // A rule's style.* gives back what the author wrote, not what it resolves to —
  // so a perfectly round dot declared as "border-radius: var(--radius-full)"
  // reads as the literal string "var(--radius-full)" and fails a check looking
  // for 9999px or 50%. Resolve single-token var() references against the
  // document's own custom properties before asserting, and say when a token does
  // not exist rather than reporting the reference as if it were a value.
  // (No backticks in this block: it lives inside a template literal.)
  const resolveVar = (value) => {
    if (typeof value !== 'string') return value;
    const m = value.trim().match(/^var\\(\\s*(--[A-Za-z0-9_-]+)\\s*(?:,\\s*([^)]*))?\\)$/);
    if (!m) return value;
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
    if (resolved) return resolved;
    return m[2] ? m[2].trim() : value + ' (token undefined)';
  };
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin
      for (const rule of Array.from(rules || [])) {
        if (rule.selectorText && /ComponentsPanel-module__Warning/.test(rule.selectorText)) {
          out.dotRule = {
            selector: rule.selectorText,
            width: resolveVar(rule.style.width),
            height: resolveVar(rule.style.height),
            borderRadius: resolveVar(rule.style.borderRadius),
            // Geometry is asserted on the resolved value; colour is asserted on
            // the *authored* one, because the assertion there is "this came from
            // the warning token", which resolving would erase. Both are kept.
            background: rule.style.backgroundColor,
            backgroundResolved: resolveVar(rule.style.backgroundColor),
            cursor: rule.style.cursor
          };
        }
      }
    }
  } catch (e) { /* stylesheet enumeration is best-effort */ }

  return out;
})()`;

/* ---------------------------------------------------------------------------
 * Scroll cost.
 *
 * The spec asks whether a ~200-component project scrolls acceptably and says to
 * MEASURE it rather than assume. Rows are the hot path, so this drives the real
 * scroller for a second and records real frame durations — no synthetic
 * benchmark, no reasoning from the size of the diff.
 *
 * It reports rather than fails: the threshold below is the 60fps budget, and a
 * project that misses it is a finding to file, not a reason to block a restyle.
 * ------------------------------------------------------------------------- */
const SCROLL_PERF = `(async () => {
  const tree = Array.from(document.querySelectorAll('[data-test="component-tree"]'))
    .find((el) => el.getBoundingClientRect().height > 0);
  if (!tree) return { error: 'no visible tree' };

  const rows = tree.querySelectorAll('[data-test="component-tree-item"]').length;
  const range = tree.scrollHeight - tree.clientHeight;
  if (range <= 0) return { rows, scrollable: false };

  const frames = [];
  await new Promise((resolve) => {
    let i = 0;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      frames.push(now - last);
      last = now;
      // Sawtooth over the full range so rows enter and leave the viewport.
      tree.scrollTop = (Math.sin(i / 12) * 0.5 + 0.5) * range;
      if (++i >= 90) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  tree.scrollTop = 0;

  // Drop the first frame — it carries the cost of starting the loop.
  const f = frames.slice(1).sort((a, b) => a - b);
  const at = (p) => Math.round(f[Math.min(f.length - 1, Math.floor(f.length * p))] * 100) / 100;
  return {
    rows,
    scrollable: true,
    scrollHeight: tree.scrollHeight,
    frames: f.length,
    medianMs: at(0.5),
    p95Ms: at(0.95),
    maxMs: Math.round(f[f.length - 1] * 100) / 100
  };
})()`;

/** Normalise a colour string to comparable integer channels. */
function chans(c) {
  const s = String(c).trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const x = h.length === 3 ? [...h].map((d) => d + d) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
    return x.map((v) => parseInt(v, 16));
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])] : null;
}

function sameColor(a, b) {
  const x = chans(a);
  const y = chans(b);
  if (!x || !y) return false;
  // Exact: both sides come from the same custom property, so any difference at
  // all means a second source has crept in.
  return x[0] === y[0] && x[1] === y[1] && x[2] === y[2];
}

/** @returns {{code, msg, skip?}[]} */
function assess(m, label, { checkNarrow }) {
  const out = [];
  const fail = (code, msg) => out.push({ code, msg: `${label}: ${msg}` });
  const skip = (code, msg) => out.push({ code, msg: `${label}: ${msg}`, skip: true });
  /** Measured, below the bar, and accepted on the record. Not a pass, not a skip. */
  const exempt = (code, msg, key) => out.push({ code, msg: `${label}: ${msg}`, exempt: true, exemptKey: key });

  // --- A: the light-mode fix ------------------------------------------------
  if (!m.selected) {
    skip('no-selection', 'no row is selected — assertion A (selected-row contrast) NOT PROVEN this pass');
  } else if (m.selected.contrast == null) {
    skip('no-contrast', 'could not read the selected row’s colours — assertion A NOT PROVEN');
  } else if (m.selected.contrast < EXPECT.minContrast) {
    fail(
      'contrast',
      `selected row "${m.selected.text}" measures ${m.selected.contrast}:1 — ` +
        `${m.selected.color} on ${m.selected.background} (declared ${m.selected.declaredBackground}). ` +
        `AA needs ${EXPECT.minContrast}:1. This is the reported bug.`
    );
  }
  if (m.selected && !/inset/.test(m.selected.boxShadow || '')) {
    fail('no-accent-bar', 'the selected row has no inset accent bar — selection is carried by fill alone');
  }

  // --- B: indent guides -----------------------------------------------------
  if (m.maxLevel + 1 < EXPECT.minDepth) {
    skip(
      'shallow-tree',
      `deepest visible row is level ${m.maxLevel} (${m.maxLevel + 1} levels) — assertion B wanted ` +
        `${EXPECT.minDepth}. Expand the tree, or run against a project with four levels of nesting. NOT PROVEN.`
    );
  }
  for (const [lvl, info] of Object.entries(m.levels)) {
    const level = Number(lvl);
    const expected = level * EXPECT.indent;
    if (!info.hasGradient) {
      fail('no-guides', `level ${level} rows draw no indent-guide gradient at all`);
      continue;
    }
    if (Math.abs((info.guideWidth || 0) - expected) > 0.6) {
      fail(
        'guide-width',
        `level ${level} rows paint a ${info.guideWidth}px guide box, expected ${expected}px ` +
          `(${level} × ${EXPECT.indent}px) — the guides do not match the depth`
      );
    }
  }

  // --- C: narrow behaviour --------------------------------------------------
  if (m.overflowRight > 1) {
    fail('overflow', `a row's content is ${m.overflowRight}px past the panel's right edge`);
  }
  if (checkNarrow) {
    if (m.ellipsised === 0) {
      skip(
        'no-ellipsis',
        `at ${m.panelWidth}px no label was long enough to ellipsise — assertion C's ellipsis half NOT PROVEN ` +
          `(needs a component with a long name)`
      );
    }
    for (const d of m.dots) {
      if (!d.visible || d.width < EXPECT.dotSize - 1) {
        fail('dot-hidden', `a warning dot is ${d.width}px / visible=${d.visible} at ${m.panelWidth}px — it must survive the squeeze`);
      }
      if (d.right > 0) fail('dot-overflow', `a warning dot sits ${d.right}px past the panel's right edge`);
    }
  }

  // --- D: the dot's contract ------------------------------------------------
  if (!m.dotRule) {
    skip('no-dot-rule', 'could not read the .Warning rule from the stylesheet — assertion D NOT PROVEN');
  } else {
    if (parseFloat(m.dotRule.width) !== EXPECT.dotSize || parseFloat(m.dotRule.height) !== EXPECT.dotSize) {
      fail('dot-size', `.Warning is ${m.dotRule.width}×${m.dotRule.height}, expected ${EXPECT.dotSize}px square`);
    }
    if (!/9999px|50%/.test(m.dotRule.borderRadius || '')) {
      fail('dot-shape', `.Warning border-radius is "${m.dotRule.borderRadius}" — the dot is not round`);
    }
    if (!/warning/.test(m.dotRule.background || '')) {
      fail('dot-colour', `.Warning background is "${m.dotRule.background}" (resolves to ${m.dotRule.backgroundResolved}) — expected the warning token (amber)`);
    }
  }
  if (m.dots.length === 0) {
    skip(
      'no-warnings',
      'no component in this project carries a warning — the dot’s rendered behaviour is NOT PROVEN. ' +
        'Run against a project with an unresolved node type (e.g. a Markdown node) to cover it.'
    );
  }

  // --- E: no second node-colour source --------------------------------------
  for (const g of m.glyphs) {
    if (g.key === 'none') continue;
    const tokenName = g.key === 'home' ? '--theme-color-brand' : CATEGORY_TOKEN[g.key];
    if (!tokenName) continue;
    const expected = m.tokens[tokenName];
    if (!expected) {
      skip('no-token', `token ${tokenName} did not resolve — glyph colour for "${g.key}" NOT PROVEN`);
      continue;
    }
    if (!sameColor(g.actual, expected)) {
      fail(
        'palette-drift',
        `the "${g.key}" glyph computes ${g.actual} but ${tokenName} is ${expected} — ` +
          `the tree has grown a second node-colour source and will drift from the canvas`
      );
    }
    if (g.contrast != null && g.contrast < EXPECT.minGlyphContrast) {
      const ex = GLYPH_CONTRAST_EXEMPT[g.key];
      if (ex && g.contrast >= ex.floor) {
        // Measured, below the bar, and accepted — see GLYPH_CONTRAST_EXEMPT.
        // The reason is deliberately NOT repeated per pass: it is a paragraph,
        // and printing it once per theme×width buried the rest of the report.
        // The run prints it once, at the end, keyed by glyph.
        exempt(
          'glyph-contrast',
          `the "${g.key}" glyph measures ${g.contrast}:1, below ${EXPECT.minGlyphContrast}:1 — ` +
            `recorded exemption (floor ${ex.floor})`,
          g.key
        );
      } else if (ex) {
        fail(
          'glyph-contrast',
          `the "${g.key}" glyph measures ${g.contrast}:1 — below its recorded exemption floor of ` +
            `${ex.floor}, so this is a regression beyond what was accepted, not the known miss`
        );
      } else {
        fail('glyph-contrast', `the "${g.key}" glyph measures ${g.contrast}:1 against its ground, below ${EXPECT.minGlyphContrast}:1`);
      }
    }
  }

  return out;
}

// ---- main -------------------------------------------------------------------
const report = { width: WIDTH, height: HEIGHT, narrow: NARROW, expect: EXPECT, results: [] };

/** Flushed after every phase, so a wedge cannot cost what was already walked. */
function flush() {
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
}

(async () => {
  console.log(`PNL-006 components-tree gate @ ${WIDTH}x${HEIGHT}${SKIP_NARROW ? '' : `, narrow ${NARROW}px`}`);
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

  const failures = [];
  const skips = [];
  const exemptions = [];
  let timeouts = 0;

  try {
    // Open the Components panel once; it stays active for the whole run.
    if (!(await clickSel(cdp, '[data-test="components-panel"]'))) {
      console.error('Could not reach the Components rail button. Open a project in the editor first.');
      process.exit(1);
    }

    // The panel has to actually be open before anything below means anything.
    //
    // The "wide" pass does not set a width — it removes the override and takes
    // whatever the panel already is. Run this straight after `panel-modes.mjs`,
    // which leaves the panel hidden, and "wide" is **3px**: every row then reads
    // as 75px past the panel's right edge and the glyph contrast is sampled
    // against a sliver. The first live run reported exactly that, as eight
    // separate failures, none of them about the Components panel.
    //
    // A precondition that is assumed is a precondition that eventually isn't
    // true. Reveal it if it is collapsed, and refuse to report derived numbers
    // measured against a panel nobody can see.
    for (let attempt = 0; attempt < 2; attempt++) {
      const w = await evalJS(
        cdp,
        `(() => {
          const p = document.querySelector('[class*="SideNavigation-module__Panel"]');
          return p ? Math.round(p.getBoundingClientRect().width) : 0;
        })()`
      );
      if (w >= 200) break;
      if (attempt === 0) {
        // ⌘B-hidden from an earlier gate; the hide toggle is the way back.
        await clickSel(cdp, '[data-test="side-panel-hide-toggle"]');
        await sleep(400);
        continue;
      }
      console.error(
        `The Components panel is ${w}px wide. Every measurement below would be about a collapsed panel, ` +
          `so this run is refusing rather than reporting nonsense. Reveal the panel (⌘B) and re-run.`
      );
      process.exit(1);
    }

    // Expand everything reachable, so assertion B has four levels to look at.
    // Clicking carets rather than reaching into React state: the gate should
    // exercise the same path a person does.
    for (let pass = 0; pass < 6; pass++) {
      const opened = await evalJS(
        cdp,
        `(() => {
          const tree = Array.from(document.querySelectorAll('[data-test="component-tree"]'))
            .find((el) => el.getBoundingClientRect().height > 0);
          if (!tree) return 0;
          const shut = Array.from(tree.querySelectorAll('[data-test="component-tree-caret"]'))
            .filter((c) => !/Expanded/.test(c.className));
          shut.forEach((c) => c.click());
          return shut.length;
        })()`
      );
      if (!opened) break;
      await sleep(250);
    }

    // Select a component row, so assertion A has something to measure. Clicking
    // a row opens that component — the real gesture, and harmless.
    const selected = await clickSel(cdp, '[data-test="component-tree-item"]:not([data-kind="folder"])');
    if (!selected) {
      skips.push({ code: 'no-selectable-row', msg: 'no component row could be clicked — assertion A NOT PROVEN' });
    }
    await sleep(300);

    // --- scroll cost, measured once (it does not depend on the theme) --------
    try {
      const perf = await evalJS(cdp, SCROLL_PERF, 20000);
      report.scroll = perf;
      if (perf.error || perf.scrollable === false) {
        skips.push({
          code: 'not-scrollable',
          msg:
            `the tree does not overflow its viewport (${perf.rows ?? '?'} rows) — scroll cost NOT MEASURED. ` +
            `Run against a project with enough components to scroll.`
        });
      } else {
        const verdict = perf.p95Ms <= 16.7 ? 'within the 60fps budget' : 'OVER the 60fps budget';
        console.log(
          `scroll: ${perf.rows} rows, median ${perf.medianMs}ms, p95 ${perf.p95Ms}ms, max ${perf.maxMs}ms — ${verdict}\n`
        );
        if (perf.p95Ms > 16.7) {
          skips.push({
            code: 'scroll-budget',
            msg:
              `p95 frame ${perf.p95Ms}ms over ${perf.rows} rows exceeds the 16.7ms 60fps budget. ` +
              `Reported, not failed — file it (virtualising the tree is explicitly out of scope for PNL-006).`
          });
        }
      }
    } catch (err) {
      skips.push({ code: 'scroll-harness', msg: `scroll measurement failed: ${err.message}` });
    }
    flush();

    for (const theme of THEMES) {
      await setTheme(cdp, theme);
      await injectDeterminism(cdp);

      // Two passes per theme, never two width toggles per row. See forcePanelWidth.
      const passes = SKIP_NARROW ? [null] : [null, NARROW];

      for (const px of passes) {
        const label = px === null ? 'wide' : `${px}px`;
        console.log(`[theme: ${theme}] [${label}]`);
        try {
          await forcePanelWidth(cdp, px);
          const m = await evalJS(cdp, MEASURE);

          // Capture BEFORE asserting — the image of a failing tree is the most
          // useful artefact in the run, and an assert-side wedge must not cost it.
          if (SHOTS) {
            const suffix = px === null ? '' : `--narrow${px}`;
            const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 15000);
            fs.writeFileSync(path.join(OUT, `components-tree--${theme}${suffix}.png`), Buffer.from(data, 'base64'));
          }

          if (m.error) {
            failures.push({ theme, pass: label, code: 'measure', msg: m.error });
            console.log(`  ✗  ${m.error}`);
            continue;
          }

          const f = assess(m, label, { checkNarrow: px !== null });
          report.results.push({ theme, pass: label, measured: m, findings: f });

          const real = f.filter((x) => !x.skip && !x.exempt);
          const sk = f.filter((x) => x.skip);
          const ex = f.filter((x) => x.exempt);
          for (const x of real) {
            failures.push({ theme, pass: label, ...x });
            console.log(`  ✗  ${x.msg}`);
          }
          for (const x of sk) {
            skips.push({ theme, pass: label, ...x });
            console.log(`  –  SKIP ${x.msg}`);
          }
          for (const x of ex) {
            exemptions.push({ theme, pass: label, ...x });
            console.log(`  ~  EXEMPT ${x.msg}`);
          }
          if (!real.length) {
            const c = m.selected ? `selected contrast ${m.selected.contrast}:1` : 'no selection';
            console.log(`  ✓  ${m.rowCount} rows, depth ${m.maxLevel + 1}, ${c}`);
          }
        } catch (err) {
          const isTimeout = /timeout|socket closed/i.test(err.message);
          if (isTimeout) timeouts++;
          failures.push({ theme, pass: label, code: 'harness', msg: err.message });
          console.log(`  !  skipped: ${err.message}`);
          if (timeouts >= 3) throw new Error(`renderer appears wedged (${timeouts} CDP timeouts) — aborting cleanly`);
        } finally {
          flush();
        }
        console.log('');
      }
    }
  } finally {
    // Always give the editor back. A leaked `width !important` override is how
    // the previous run left the editor unusable.
    try {
      await forcePanelWidth(cdp, null);
      await setTheme(cdp, 'dark');
      await cdp.send('Emulation.clearDeviceMetricsOverride', {}, 5000);
    } catch {
      console.log('(could not release overrides — restart the editor)');
    }
    flush();
    if (JSON_OUT) console.log(`wrote ${JSON_OUT}`);
  }

  report.skips = skips;
  report.exemptions = exemptions;
  flush();

  console.log(`\n${report.results.length} theme×width passes run.`);
  if (exemptions.length) {
    console.log(
      `\n~ ${exemptions.length} EXEMPTIONS — measured, below the bar, and accepted on the record. ` +
        `Not passes:`
    );
    for (const e of exemptions) console.log(`  - [${e.theme ?? '-'}/${e.pass ?? '-'}] (${e.code}) ${e.msg}`);
    // The rationale once per distinct glyph, not once per theme×width pass.
    for (const key of [...new Set(exemptions.map((e) => e.exemptKey).filter(Boolean))]) {
      console.log(`\n  why "${key}" stands:\n    ${GLYPH_CONTRAST_EXEMPT[key].why.replace(/\s+/g, ' ')}`);
    }
  }
  if (skips.length) {
    console.log(`\n– ${skips.length} SKIPS — these are NOT passes, they are things this run could not prove:`);
    for (const s of skips) console.log(`  - [${s.theme ?? '-'}/${s.pass ?? '-'}] (${s.code}) ${s.msg}`);
  }
  if (failures.length) {
    console.log(`\n✗ ${failures.length} failures:`);
    for (const f of failures) console.log(`  - [${f.theme}/${f.pass}] (${f.code}) ${f.msg}`);
  } else {
    console.log('\n✓ no failures.');
  }

  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('components-tree failed:', err.message);
  flush();
  process.exit(1);
});
