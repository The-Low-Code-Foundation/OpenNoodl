#!/usr/bin/env node
/**
 * PNL-008 settings-consolidation gate + screenshot corpus.
 *
 * "Three settings panels became one" and "the app title has one control" are
 * both claims about *state that outlives the panel* — a registration table, a
 * persisted panel id, and two fields in `project.json`. Looking at the panel
 * cannot settle any of them, so this gate does not primarily look at the panel.
 *
 * It runs in two halves, and the first half needs no editor at all.
 *
 * ── STATIC (always; `--no-live` to stop here) ─────────────────────────────────
 *
 *   S1. **Exactly one settings destination is registered.** `router.setup.ts`
 *       registers `settings` and neither `app-setup` nor `editor-settings`.
 *   S2. **No `switch()` call targets an unregistered id.** Acceptance item 7,
 *       as an assertion rather than as a grep someone remembers to run. Every
 *       string literal handed to `SidebarModel…switch()` anywhere under the
 *       editor's `src/` must appear as a registered `id:`. This is the check
 *       that would have caught `switch('cloud-functions')` in 2026-07, and it
 *       is the reason it is here rather than in the live half: it is cheap,
 *       deterministic, and it keeps working after this task is forgotten.
 *   S3. **Every retired id maps somewhere that exists.** The values of
 *       `RETIRED_PANEL_IDS` must be registered ids; its keys must not be.
 *   S4. **The settings glyph is a cog, not a sun.** The sun was a single circle
 *       with eight rays; the cog is two concentric circles with eight spokes.
 *       Asserted on the SVG source, because "it looks like a sun" is exactly the
 *       kind of thing that silently comes back when an icon set is regenerated.
 *
 * ── LIVE (CDP; needs a dev editor with a project open) ────────────────────────
 *
 *   L1. One rail button reaches a panel whose header says "Settings", and it
 *       carries exactly one `[data-test="panel-header"]` (the PNL-005 contract —
 *       three panels became one, not one panel wearing three headers).
 *   L2. Both tabs render, and switching between them swaps the section list.
 *   L3. Project holds every group the three panels used to: identity, SEO, PWA,
 *       variables, the legacy port groups, runtime, sitemap, deploy.
 *   L4. **The app title has exactly one control per field.** One row for
 *       `identity.appName`, one for `settings.htmlTitle`, and no third control
 *       labelled "Title" anywhere in the panel (the legacy Ports view's General
 *       group used to carry one).
 *   L5. **The round trip, against `project.json` on disk — not against the UI.**
 *       This is the assertion the task is really about:
 *         a. type an app name → both `metadata.appConfig.identity.appName` and
 *            `settings.htmlTitle` are that value (the follow, while they agree);
 *         b. type a different browser title → only `settings.htmlTitle` moves;
 *         c. type another app name → `htmlTitle` stays put (diverged on purpose).
 *       The originals are restored in a `finally`, through the same UI, so a
 *       failed run does not leave the corpus project renamed.
 *   L6. Editor holds appearance (with a working theme select), the experimental
 *       groups, and the AI provider section.
 *   L7. Screenshots of both tabs in both themes into `screenshots/pnl-008/`.
 *
 * ROBUSTNESS, inherited from `panel-chrome.mjs` beside this file: per-step CDP
 * timeouts that record and continue rather than abort, the JSON report flushed
 * after every step, screenshots taken *before* asserting, and **every injected
 * style released in a `finally`** — a leaked `!important` override from a
 * crashed run has wedged this editor before and cost a restart.
 *
 * Prerequisite for the live half — a dev editor on a CDP endpoint **with a
 * project open**, launched from the PRIMARY checkout (`lerna exec` resolves to
 * the main checkout, never to a worktree):
 *
 *   nohup setsid npm run dev:debug -- --quiet > /dev/null 2>&1 &
 *   until curl -s http://localhost:9222/json/list >/dev/null; do sleep 5; done
 *
 * Usage:
 *   node dev-docs/tasks/phase-23-visual-refresh/corpus/settings-consolidation.mjs
 *   node settings-consolidation.mjs [--no-live] [--cdp URL] [--project DIR]
 *                                   [--width 1400] [--height 900]
 *                                   [--out DIR] [--json report.json] [--no-shots]
 *                                   [--timeout 8000]
 *
 * `--project` is the open project's directory; without it the gate asks the
 * renderer (`window.__nodeGraphEditor`) and skips L5 if it cannot find one.
 *
 * Exits non-zero on any failure. `--json` is written even on a catastrophic
 * failure, so a wedged run still tells you how far it got.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../../..');
const EDITOR_SRC = path.join(REPO, 'packages/noodl-editor/src/editor/src');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const has = (name) => argv.includes(name);

const CDP = arg('--cdp', 'http://localhost:9222');
const LIVE = !has('--no-live');
const WIDTH = Number(arg('--width', 1400));
const HEIGHT = Number(arg('--height', 900));
const JSON_OUT = arg('--json', null);
const SHOTS = !has('--no-shots');
const CALL_TIMEOUT = Number(arg('--timeout', 8000));
const PROJECT_DIR_ARG = arg('--project', null);
const OUT = arg('--out', path.resolve(__dirname, '../../phase-25-side-panel/screenshots/pnl-008'));

const THEMES = ['dark', 'light'];
const SETTINGS_ID = 'settings';
/** How long to wait for `ProjectModel`'s 1s-debounced autosave to reach disk. */
const SAVE_SETTLE_MS = 3000;

const report = { static: [], live: [], skipped: [] };
const failures = [];

function flush() {
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
}
function fail(id, msg) {
  failures.push({ id, msg });
  console.log(`  ✗  ${id} — ${msg}`);
}
function pass(id, msg) {
  console.log(`  ✓  ${id}${msg ? ` — ${msg}` : ''}`);
}
function skip(id, msg) {
  report.skipped.push({ id, msg });
  console.log(`  –  ${id} — skipped: ${msg}`);
}

// =============================================================================
// STATIC
// =============================================================================

/** Every `.ts`/`.tsx` under the editor's src, once. */
function sourceFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  })(EDITOR_SRC);
  return out;
}

/**
 * Panel ids `router.setup.ts` registers.
 *
 * Two forms: a string literal (`id: 'components'`) and a constant imported from
 * the panel itself (`id: ExplainPanel_ID`). The second is resolved by finding
 * `export const <NAME> = '<id>'` anywhere in the editor's source, which is how
 * every one of them is actually declared. Commented-out registrations are
 * stripped first — three panels are registered-out but still in the file, and
 * counting them would make S2 green about ids nothing can reach.
 */
function registeredPanelIds(files) {
  const routerPath = path.join(EDITOR_SRC, 'router.setup.ts');
  const raw = fs.readFileSync(routerPath, 'utf8');
  const live = raw
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

  const constants = new Map();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/export const (\w*_ID)\s*=\s*['"]([^'"]+)['"]/g)) {
      constants.set(m[1], m[2]);
    }
  }

  const ids = new Set();
  for (const m of live.matchAll(/\bid:\s*(?:['"]([^'"]+)['"]|(\w+))/g)) {
    if (m[1]) ids.add(m[1]);
    else if (constants.has(m[2])) ids.add(constants.get(m[2]));
  }
  return { ids, constants, routerSource: live };
}

function runStatic() {
  console.log('STATIC');
  const files = sourceFiles();
  const { ids, routerSource } = registeredPanelIds(files);
  report.static.push({ registeredIds: [...ids].sort() });

  // --- S1 -------------------------------------------------------------------
  const retiredRegistrations = ['app-setup', 'editor-settings'].filter((id) => ids.has(id));
  if (!ids.has(SETTINGS_ID)) fail('S1', `no panel registered with id '${SETTINGS_ID}'`);
  else if (retiredRegistrations.length)
    fail('S1', `${retiredRegistrations.join(' and ')} still registered — three destinations, not one`);
  else pass('S1', `one settings destination ('${SETTINGS_ID}'), ${ids.size} panels registered in total`);

  // The registration must sit at the bottom of the rail, where the mock puts the
  // one gear and where Editor settings already was.
  if (ids.has(SETTINGS_ID) && !/placement:\s*'bottom'/.test(routerSource))
    fail('S1b', "no `placement: 'bottom'` registration — the gear is not in the rail's settings slot");
  else if (ids.has(SETTINGS_ID)) pass('S1b');

  // --- S2 -------------------------------------------------------------------
  const switchSites = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return; // a commented-out call is not a call
      for (const m of line.matchAll(/\.switch\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        switchSites.push({ file: path.relative(REPO, f), line: i + 1, id: m[1] });
      }
    });
  }
  report.static.push({ switchSites });
  const dead = switchSites.filter((s) => !ids.has(s.id));
  if (dead.length) {
    for (const d of dead) fail('S2', `${d.file}:${d.line} switches to '${d.id}', which is not registered`);
  } else {
    pass('S2', `${switchSites.length} literal switch() call sites, all registered`);
  }

  // --- S3 -------------------------------------------------------------------
  const routePath = path.join(EDITOR_SRC, 'views/panels/SettingsPanel/settingsPanelRoute.ts');
  if (!fs.existsSync(routePath)) {
    fail('S3', 'settingsPanelRoute.ts not found — where does the retired-id map live?');
  } else {
    const src = fs.readFileSync(routePath, 'utf8');
    const block = src.slice(src.indexOf('RETIRED_PANEL_IDS'));
    const entries = [...block.matchAll(/'([^']+)':\s*\{\s*id:\s*(?:SETTINGS_PANEL_ID|'([^']+)')/g)].map((m) => ({
      from: m[1],
      to: m[2] || SETTINGS_ID
    }));
    report.static.push({ retiredMap: entries });

    if (!entries.length) fail('S3', 'RETIRED_PANEL_IDS is empty — nothing maps the ids this task retired');
    const badTargets = entries.filter((e) => !ids.has(e.to));
    const stillLive = entries.filter((e) => ids.has(e.from));
    if (badTargets.length) fail('S3', `retired ids map to unregistered targets: ${badTargets.map((e) => `${e.from}→${e.to}`).join(', ')}`);
    if (stillLive.length) fail('S3', `${stillLive.map((e) => e.from).join(', ')} is mapped as retired but is still registered`);
    if (entries.length && !badTargets.length && !stillLive.length)
      pass('S3', entries.map((e) => `${e.from}→${e.to}`).join(', '));
  }

  // --- S4 -------------------------------------------------------------------
  const svgPath = path.join(REPO, 'packages/noodl-core-ui/src/assets/icons/icon-component/setting.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');
  const circles = (svg.match(/<circle/g) || []).length;
  if (circles < 2) {
    fail('S4', `setting.svg has ${circles} circle(s) — a cog has an outer ring and a hub; a sun has one disc and rays`);
  } else {
    pass('S4', 'setting.svg is a cog (two concentric circles + spokes)');
  }

  console.log('');
}

// =============================================================================
// LIVE — tiny CDP client (one socket, sequential), shared shape with panel-chrome
// =============================================================================
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
  await sleep(600);
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

const DETERMINISM_STYLE_ID = '__pnl008_determinism';

async function injectDeterminism(cdp) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await evalJS(
    cdp,
    `(() => {
      let s = document.getElementById(${JSON.stringify(DETERMINISM_STYLE_ID)});
      if (!s) { s = document.createElement('style'); s.id = ${JSON.stringify(DETERMINISM_STYLE_ID)}; document.head.appendChild(s); }
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
      return true;
    })()`
  );
}

/** Everything injected, removed. Called in a `finally`, always. */
async function releaseOverrides(cdp) {
  try {
    await evalJS(
      cdp,
      `(() => {
        const s = document.getElementById(${JSON.stringify(DETERMINISM_STYLE_ID)});
        if (s) s.remove();
        return true;
      })()`,
      5000
    );
    await cdp.send('Emulation.clearDeviceMetricsOverride', {}, 5000);
    await cdp.send('Emulation.setEmulatedMedia', { features: [] }, 5000);
  } catch {
    console.log('(could not release overrides — restart the editor)');
  }
}

/** The one visible panel item. Every panel stays mounted behind `display:none`. */
const ACTIVE_PANEL = `(() => {
  const root = document.querySelector('[class*="SideNavigation-module__Panel"]');
  if (!root) return null;
  return Array.from(root.querySelectorAll('[class*="PanelItem"]'))
    .find((el) => el.getBoundingClientRect().height > 0) || null;
})()`;

const INSPECT = `(() => {
  const item = ${ACTIVE_PANEL};
  if (!item) return { error: 'no visible panel item — is a project open?' };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.height > 0 && r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  const headers = Array.from(item.querySelectorAll('[data-test="panel-header"]')).filter(visible);
  const sections = Array.from(item.querySelectorAll('[class*="CollapsableSection-module__Title"], [class*="Section-module__Header"]'))
    .filter(visible)
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);

  // The legacy Ports view renders its own group headers rather than
  // CollapsableSections; pick them up too so L3 can see Navigation/Custom Code.
  const legacyGroups = Array.from(item.querySelectorAll('[class*="PropertyGroup"] [class*="itle"], [class*="property-group"] [class*="itle"]'))
    .filter(visible)
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);

  const rowLabels = Array.from(item.querySelectorAll('[class*="PanelRow-module__Label"]'))
    .filter(visible)
    .map((el) => (el.textContent || '').trim());

  const activeTab = Array.from(item.querySelectorAll('[role="tab"]'))
    .filter(visible)
    .map((el) => ({ label: (el.textContent || '').trim(), selected: el.getAttribute('aria-selected') === 'true' }));

  return {
    panelId: item.getAttribute('data-panel-id'),
    panelTitle: headers.length === 1 ? headers[0].getAttribute('data-panel-title') : null,
    headerCount: headers.length,
    tabs: activeTab,
    sections: sections.concat(legacyGroups),
    rowLabels
  };
})()`;

/** Reads a `PropertyPanelTextInput` inside the `PanelRow` with this test id. */
const readRow = (testId) => `(() => {
  const item = ${ACTIVE_PANEL};
  if (!item) return null;
  const row = item.querySelector('[data-test=' + JSON.stringify(${JSON.stringify(testId)}) + ']');
  if (!row) return null;
  const input = row.querySelector('input');
  return input ? input.value : null;
})()`;

/**
 * Types into a `PropertyPanelTextInput` the way a person does.
 *
 * It commits on blur or Enter, not on every keystroke, so the native value
 * setter (React tracks the previous value on the node and swallows an `input`
 * event that only changed `el.value`) is followed by a real Enter keydown.
 */
const typeRow = (testId, value) => `(() => {
  const item = ${ACTIVE_PANEL};
  if (!item) return 'no panel';
  const row = item.querySelector('[data-test=' + JSON.stringify(${JSON.stringify(testId)}) + ']');
  if (!row) return 'no row ' + ${JSON.stringify(testId)};
  const input = row.querySelector('input');
  if (!input) return 'no input in ' + ${JSON.stringify(testId)};

  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  input.focus();
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.blur();
  return 'ok';
})()`;

function readProjectJson(dir) {
  const p = path.join(dir, 'project.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function titlesOnDisk(dir) {
  const j = readProjectJson(dir);
  return {
    appName: j?.metadata?.appConfig?.identity?.appName ?? null,
    htmlTitle: j?.settings?.htmlTitle ?? null
  };
}

/**
 * Wait for the save to actually reach disk, rather than sleeping a guess.
 *
 * The project save is debounced, and a fixed `SAVE_SETTLE_MS` was not long
 * enough: every L5 read came back holding the *previous* step's value, so the
 * assertions failed lagging by exactly one — which reads like a persistence bug
 * and is a timing one. Lag-by-one is the signature; a race gives you the old
 * value, a real failure gives you a wrong one.
 *
 * Polling is also faster than the old sleep whenever the write is prompt.
 */
async function titlesOnDiskWhen(dir, predicate, timeoutMs = 15000) {
  const started = Date.now();
  let last = titlesOnDisk(dir);
  while (Date.now() - started < timeoutMs) {
    last = titlesOnDisk(dir);
    if (predicate(last)) return last;
    await sleep(250);
  }
  return last;
}

async function openSettings(cdp) {
  if (await clickSel(cdp, `[data-test="${SETTINGS_ID}-panel"]`)) return true;
  // The rail button may be in the bottom group with a different test id shape;
  // fall back to asking the model, which is what the button does anyway.
  await evalJS(cdp, `(() => { window.dispatchEvent(new CustomEvent('noop')); return true; })()`);
  return false;
}

async function selectTab(cdp, tab) {
  return clickSel(cdp, `[data-test="settings-tab-${tab}"]`);
}

async function shoot(cdp, name) {
  if (!SHOTS) return;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 15000);
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
}

async function runLive() {
  console.log('LIVE');
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

  try {
    await injectDeterminism(cdp);

    // --- L7 (registry, from the live model rather than the source) ----------
    const model = await evalJS(
      cdp,
      `(() => {
        const w = window;
        // The sidebar model is not on window; read the rail instead, which is
        // what the user can actually reach.
        const buttons = Array.from(document.querySelectorAll('[data-test]'))
          .filter((el) => el.offsetParent !== null && /-panel$/.test(el.getAttribute('data-test')))
          .map((el) => el.getAttribute('data-test').replace(/-panel$/, ''));
        return { rail: buttons };
      })()`
    );
    report.live.push({ rail: model.rail });
    const settingsButtons = model.rail.filter((id) => /^(settings|app-setup|editor-settings)$/.test(id));
    if (settingsButtons.length !== 1 || settingsButtons[0] !== SETTINGS_ID) {
      fail('L1a', `rail shows ${settingsButtons.length} settings destination(s): ${settingsButtons.join(', ') || 'none'}`);
    } else {
      pass('L1a', `rail reaches ${model.rail.length} panels, exactly one of them settings`);
    }

    if (!(await openSettings(cdp))) {
      fail('L1b', 'could not click the settings rail button');
      flush();
      return;
    }

    const inspect = await evalJS(cdp, INSPECT);
    report.live.push({ inspect });
    if (inspect.error) {
      fail('L1b', inspect.error);
      flush();
      return;
    }

    // --- L1: one panel, one header ------------------------------------------
    if (inspect.panelTitle !== 'Settings') fail('L1b', `panel header says "${inspect.panelTitle}", expected "Settings"`);
    else pass('L1b');
    if (inspect.headerCount !== 1) fail('L1c', `${inspect.headerCount} panel headers in the settings panel, expected 1`);
    else pass('L1c');

    // --- L2: both tabs -------------------------------------------------------
    const tabLabels = inspect.tabs.map((t) => t.label);
    if (!(tabLabels.includes('Project') && tabLabels.includes('Editor')))
      fail('L2', `tabs are [${tabLabels.join(', ')}], expected Project and Editor`);
    else pass('L2', tabLabels.join(' | '));

    // --- L3: the Project tab holds all eight groups --------------------------
    await selectTab(cdp, 'project');
    const project = await evalJS(cdp, INSPECT);
    report.live.push({ projectTab: project });
    // The two selectors INSPECT uses both match a group's header, so each group
    // is collected twice. Harmless for a substring search, but it makes the
    // failure message read as if the panel rendered everything twice — which is
    // the first thing anyone would go and investigate. Dedupe before reporting.
    const seenSections = [...new Set(project.sections)];
    const haystack = seenSections.join(' | ').toLowerCase();
    // Match on what the group is *called*, not on its id. "pwa" is the id; the
    // header reads "Progressive Web App" and contains no "pwa" anywhere, so the
    // gate reported a group as missing while printing it in the same sentence.
    const WANT = [
      { id: 'identity', re: /identity/ },
      { id: 'seo', re: /seo|metadata/ },
      { id: 'pwa', re: /pwa|progressive web app/ },
      { id: 'variables', re: /variable/ },
      { id: 'runtime', re: /runtime/ },
      { id: 'sitemap', re: /sitemap/ },
      { id: 'deploy', re: /deploy/ }
    ];
    const missing = WANT.filter((w) => !w.re.test(haystack)).map((w) => w.id);
    if (missing.length) fail('L3', `Project tab is missing group(s) matching: ${missing.join(', ')} — saw [${seenSections.join(', ')}]`);
    else pass('L3', `${seenSections.length} groups`);

    // --- L4: one control per title field ------------------------------------
    const labels = project.rowLabels;
    const appNameRows = labels.filter((l) => l === 'App name').length;
    const titleRows = labels.filter((l) => l === 'Browser tab title').length;
    const strayTitle = labels.filter((l) => /^title$/i.test(l)).length;
    if (appNameRows !== 1) fail('L4a', `${appNameRows} "App name" rows, expected 1`);
    else if (titleRows !== 1) fail('L4a', `${titleRows} "Browser tab title" rows, expected 1`);
    else if (strayTitle) fail('L4a', `${strayTitle} row(s) still labelled just "Title" — the legacy Ports control was not filtered out`);
    else pass('L4a', 'one control per title field, and no third one');

    // --- L5: the round trip, against disk ------------------------------------
    let projectDir = PROJECT_DIR_ARG;
    if (!projectDir) {
      projectDir = await evalJS(
        cdp,
        `(() => {
          const ed = window.__nodeGraphEditor;
          return ed?.activeComponent?.owner?._retainedProjectDirectory
            || ed?.model?.owner?.owner?._retainedProjectDirectory
            || null;
        })()`
      ).catch(() => null);
    }

    if (!projectDir || !fs.existsSync(path.join(projectDir, 'project.json'))) {
      skip('L5', `no project directory found (pass --project DIR). Got: ${projectDir ?? 'null'}`);
    } else {
      console.log(`  ·  project.json → ${projectDir}`);
      const before = titlesOnDisk(projectDir);
      report.live.push({ titlesBefore: before });
      const stamp = Date.now().toString(36);
      const nameA = `PNL008 A ${stamp}`;
      const titleB = `PNL008 B ${stamp}`;
      const nameC = `PNL008 C ${stamp}`;

      try {
        // (a) rename the app — the browser title follows, because they agreed
        await evalJS(cdp, typeRow('settings-app-name', nameA));
        const a = await titlesOnDiskWhen(projectDir, (t) => t.appName === nameA);
        report.live.push({ step: 'a', ...a });
        if (a.appName !== nameA) fail('L5a', `appName on disk is ${JSON.stringify(a.appName)}, expected ${JSON.stringify(nameA)}`);
        else if (a.htmlTitle !== nameA)
          fail('L5a', `htmlTitle on disk is ${JSON.stringify(a.htmlTitle)} — it should have followed the app name to ${JSON.stringify(nameA)}`);
        else pass('L5a', 'app name written, browser title followed');

        // (b) set a different browser title — only htmlTitle moves
        await evalJS(cdp, typeRow('settings-browser-title', titleB));
        const b = await titlesOnDiskWhen(projectDir, (t) => t.htmlTitle === titleB);
        report.live.push({ step: 'b', ...b });
        if (b.htmlTitle !== titleB) fail('L5b', `htmlTitle on disk is ${JSON.stringify(b.htmlTitle)}, expected ${JSON.stringify(titleB)}`);
        else if (b.appName !== nameA) fail('L5b', `appName changed to ${JSON.stringify(b.appName)} — the browser title control must not write it`);
        else pass('L5b', 'browser title written, app name untouched');

        // (c) rename again — the browser title is diverged now and stays put
        await evalJS(cdp, typeRow('settings-app-name', nameC));
        const c = await titlesOnDiskWhen(projectDir, (t) => t.appName === nameC);
        report.live.push({ step: 'c', ...c });
        if (c.appName !== nameC) fail('L5c', `appName on disk is ${JSON.stringify(c.appName)}, expected ${JSON.stringify(nameC)}`);
        else if (c.htmlTitle !== titleB)
          fail('L5c', `htmlTitle moved to ${JSON.stringify(c.htmlTitle)} — once set apart on purpose it must stop following`);
        else pass('L5c', 'diverged titles stay diverged');
      } finally {
        // Give the corpus project its names back, through the same UI, so a
        // failed run does not leave it called "PNL008 C 1a2b3c".
        await evalJS(cdp, typeRow('settings-app-name', before.appName ?? '')).catch(() => {});
        await sleep(400);
        await evalJS(cdp, typeRow('settings-browser-title', before.htmlTitle ?? '')).catch(() => {});
        const restored = await titlesOnDiskWhen(
          projectDir,
          (t) => t.appName === before.appName && t.htmlTitle === before.htmlTitle
        );
        report.live.push({ restored });
        if (restored.appName !== before.appName || restored.htmlTitle !== before.htmlTitle) {
          console.log(
            `  !  could NOT restore the project's titles — was ${JSON.stringify(before)}, now ${JSON.stringify(restored)}. Fix by hand.`
          );
        }
      }
    }

    // --- L6: the Editor tab --------------------------------------------------
    await selectTab(cdp, 'editor');
    const editor = await evalJS(cdp, INSPECT);
    report.live.push({ editorTab: editor });
    const eHay = editor.sections.join(' | ').toLowerCase();
    const eWant = ['appearance', 'experimental', 'ai'];
    const eMissing = eWant.filter((w) => !eHay.includes(w));
    if (eMissing.length) fail('L6', `Editor tab is missing group(s) matching: ${eMissing.join(', ')} — saw [${editor.sections.join(', ')}]`);
    else pass('L6', `${editor.sections.length} groups`);
    if (!editor.rowLabels.includes('Theme')) fail('L6b', 'no Theme row in the Editor tab');
    else pass('L6b');

    // --- L7: screenshots, both tabs, both themes -----------------------------
    for (const theme of THEMES) {
      await setTheme(cdp, theme);
      await injectDeterminism(cdp);
      for (const tab of ['project', 'editor']) {
        await selectTab(cdp, tab);
        await sleep(300);
        await shoot(cdp, `settings-${tab}--${theme}`);
      }
    }
    await setTheme(cdp, 'dark');
    pass('L7', `${THEMES.length * 2} screenshots`);
  } finally {
    await releaseOverrides(cdp);
    flush();
  }
}

// =============================================================================
(async () => {
  console.log(`PNL-008 settings-consolidation gate${LIVE ? ` @ ${WIDTH}x${HEIGHT}` : ' (static only)'}\n`);
  runStatic();
  if (LIVE) {
    try {
      await runLive();
    } catch (err) {
      fail('live', err.message);
    }
  } else {
    skip('live', '--no-live');
  }

  flush();
  if (JSON_OUT) console.log(`\nwrote ${JSON_OUT}`);
  if (failures.length) {
    console.log(`\n✗ ${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f.id}: ${f.msg}`);
  } else {
    console.log('\n✓ clean.');
  }
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('settings-consolidation failed:', err.message);
  flush();
  process.exit(1);
});
