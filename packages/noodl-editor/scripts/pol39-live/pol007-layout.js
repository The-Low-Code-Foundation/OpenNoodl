#!/usr/bin/env node
/**
 * POL-007 — the Build panel fits inside the Build panel.
 *
 * A layout defect is only ever proved in a laid-out browser, and the Build
 * panel's interesting states all require a *run*: a plan proposed, operations
 * authoring, one staged and reviewable, one failed with a Retry, the whole
 * thing applied. So this reuses `aib38-live/scripted-plan.js`'s seam — `AiClient`
 * is a plain object literal, so `chatStream` and `isConfigured` are replaced at
 * runtime — and then measures rather than asserting on prose.
 *
 * Nothing is spent: no provider is contacted, and the replies are this file's.
 *
 * ## What it measures
 *
 * At every state, for the docked panel:
 *
 *   - `scrollWidth > clientWidth` anywhere in the panel — the horizontal
 *     scrollbar itself (criterion 1);
 *   - every descendant whose box crosses the panel's own left or right edge
 *     (criterion 1, and the mechanism behind it);
 *   - the run headline's rect against the panel's (criterion 2);
 *   - each operation row: that its head line fits, and that a target too long
 *     for the row is ELLIPSISED rather than pushing the row wider — an element
 *     whose `scrollWidth > clientWidth` while its own box stays inside the panel
 *     is exactly what a working ellipsis looks like (criterion 3).
 *
 * The fixture deliberately includes one operation with a long, unbroken target
 * (`Pages/CheckoutConfirmationAndReceiptDetails`), because a path has no spaces
 * to wrap at and so its min-content width is the whole string. A fixture of
 * short names would pass over a broken layout.
 *
 * One operation is authored as an invalid component every time, so the run
 * finishes with a real failure and a real Retry button — driven through the
 * SUB-006 gate and the session's own repair loop, not faked into the state.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol007-layout.js --copy-corpus
 *
 *   --theme=dark|light   which theme to drive (default dark). Criterion 6 wants
 *                        both; run it twice.
 *   --shots=<dir>        write a PNG of the panel per state (criterion 4).
 *   --delay=<ms>         per-turn pause (default 1200). The states here are all
 *                        stable ones, so this does not need scripted-plan's 7s.
 *   --json               the full report rather than the summary.
 *
 * ## Traps
 *
 * - HMR does not re-apply a changed effect to a mounted panel. Restart the stack
 *   between layout iterations rather than trusting a hot update.
 * - Chromium throttles `setTimeout` in an occluded window to about one wake a
 *   minute, which reads exactly like a hung run. Nothing here asserts a
 *   duration, and the waits are generous for that reason.
 * - Always `--copy-corpus`. The editor rewrites (and minifies) any project it
 *   opens.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const COST_PER_TURN = 0.0125;

/* -------------------------------------------------------------------------- */
/* The fixture                                                                */
/* -------------------------------------------------------------------------- */

const PLAN_REQUEST = 'Add a checkout flow: a checkout page, a confirmation page, and a link from the article page.';

/**
 * Four operations. The second has the longest target in the plan on purpose —
 * criterion 3 is about what a row does when its target does not fit, and only a
 * long unbroken path asks that question. The fourth never produces a valid
 * component, so the run ends `failed` with a Retry.
 */
const PLAN_OPERATIONS = [
  { kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page: a heading and a confirm button.' },
  {
    kind: 'create',
    target: 'Pages/CheckoutConfirmationAndReceiptDetails',
    intent: 'The confirmation page, with the receipt details on it.'
  },
  { kind: 'update', target: 'Pages/Article', intent: 'Link the article page through to the checkout.' },
  { kind: 'create', target: 'Pages/Broken', intent: 'The one that will not author — a real failure, not a faked one.' }
];

const SUBMISSIONS = {
  'Pages/Checkout': {
    nodes: [
      { id: 'co_root', type: 'Group', label: 'Checkout' },
      { id: 'co_title', type: 'Text', parent: 'co_root', parameters: { text: 'Checkout' } },
      { id: 'co_confirm', type: 'Button', parent: 'co_root', parameters: { label: 'Confirm order' } }
    ],
    visual_roots: ['co_root'],
    description: 'The checkout page.'
  },
  'Pages/CheckoutConfirmationAndReceiptDetails': {
    nodes: [
      { id: 'cc_root', type: 'Group', label: 'Confirmation' },
      { id: 'cc_title', type: 'Text', parent: 'cc_root', parameters: { text: 'Thank you' } },
      { id: 'cc_receipt', type: 'Text', parent: 'cc_root', parameters: { text: 'Your receipt is on its way.' } }
    ],
    visual_roots: ['cc_root'],
    description: 'The confirmation page.'
  },
  'Pages/Article': {
    nodes: [
      { id: 'ar_root', type: 'Group', label: 'Article' },
      { id: 'ar_body', type: 'Text', parent: 'ar_root', parameters: { text: 'An article.' } },
      { id: 'ar_to_checkout', type: 'Button', parent: 'ar_root', parameters: { label: 'Go to checkout' } }
    ],
    visual_roots: ['ar_root'],
    description: 'The article page, with a link to the checkout.'
  }
};

/* -------------------------------------------------------------------------- */
/* Renderer-side helpers                                                      */
/* -------------------------------------------------------------------------- */

const PROBE = `(() => {
  if (!window.__pol007wr) {
    window.webpackChunknoodl_editor.push([['pol007'], {}, (r) => (window.__pol007wr = r)]);
  }
  return typeof window.__pol007wr === 'function';
})()`;

const REQ = (id) => `window.__pol007wr(${JSON.stringify(id)})`;

const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';
const PLAN_STORE_MODULE = './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts';
const THEME_MODULE = './src/editor/src/models/ThemeManager.ts';

function installScript(delayMs) {
  return `(async () => {
    const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };

    const PLAN = ${JSON.stringify({ operations: PLAN_OPERATIONS })};
    const SUBMISSIONS = ${JSON.stringify(SUBMISSIONS)};
    const DELAY = ${delayMs};
    const COST = ${COST_PER_TURN};

    window.__pol007 = { turns: [], cost: 0 };
    if (!window.__pol007original) {
      window.__pol007original = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }

    const usage = () => ({
      promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: COST
    });
    const reply = (name, args) => ({
      text: '',
      toolCalls: [{ id: 'pol007-' + window.__pol007.turns.length, name, arguments: args }],
      usage: usage(),
      model: 'scripted-replay',
      stopReason: 'tool_calls'
    });

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      const tools = (request.tools || []).map((t) => t.name);
      const opening = (request.messages || []).filter((m) => m.role === 'user').map((m) => m.content).join('\\n');

      // Exactly one timer per turn: every additional one is another chance to be
      // caught by an occluded window's throttling, which reads as a hang.
      if (DELAY > 0) await new Promise((r) => setTimeout(r, DELAY));
      window.__pol007.cost += COST;

      if (tools.includes('submit_plan')) {
        window.__pol007.turns.push('plan');
        return reply('submit_plan', PLAN);
      }

      if (tools.includes('submit_component')) {
        const target = Object.keys(SUBMISSIONS).find((t) => opening.includes('"' + t + '"'));
        window.__pol007.turns.push(target || 'invalid');
        // No match means Pages/Broken (or an unrecognised target): an unknown
        // node type, which the SUB-006 gate rejects on every repair attempt, so
        // the operation genuinely fails rather than being marked failed.
        const args = target
          ? SUBMISSIONS[target]
          : { nodes: [{ id: 'x', type: 'NoSuchTypeAtAll' }], visual_roots: ['x'], description: 'Nope.' };
        const response = reply('submit_component', args);
        callbacks.onToolCall?.(response.toolCalls[0]);
        callbacks.onEnd?.();
        return response;
      }

      window.__pol007.turns.push('declined:' + tools.join(','));
      callbacks.onEnd?.();
      return { text: 'Nothing to do.', toolCalls: [], usage: usage(), model: 'scripted-replay', stopReason: 'stop' };
    };
    return { ok: true, operations: PLAN.operations.length };
  })()`;
}

/* -------------------------------------------------------------------------- */
/* The measurement                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The Build panel's own root, and everything about its width.
 *
 * `overflowing` is the criterion-1 sweep: any descendant whose box crosses the
 * panel's left or right edge by more than a pixel. Scoped to the panel subtree
 * because tooltips and dialogs portal out of it and are not this panel's layout.
 *
 * `scrollers` is the scrollbar itself — an element that can be scrolled
 * sideways. `text-overflow: ellipsis` also produces `scrollWidth > clientWidth`,
 * which is the point of it, so an element is only reported here when it is also
 * `overflow-x: auto | scroll`.
 */
const MEASURE = `(() => {
  const panel = document.querySelector('[data-panel-id="ai-authoring"]')
    || document.querySelector('[data-testid="side-panel"]')
    || null;
  if (!panel) return { error: 'no Build panel in the DOM' };
  const pr = panel.getBoundingClientRect();
  const all = Array.from(panel.querySelectorAll('*'));

  const describe = (el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
      text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
      left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)
    };
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const overflowing = all
    .filter(visible)
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > pr.right + 1 || r.left < pr.left - 1;
    })
    .map(describe);

  const scrollers = all
    .filter(visible)
    .filter((el) => {
      if (el.scrollWidth <= el.clientWidth + 1) return false;
      const ox = getComputedStyle(el).overflowX;
      return ox === 'auto' || ox === 'scroll';
    })
    .map((el) => ({ ...describe(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));

  // Criterion 2: the run headline, whole, inside the panel. The '·' is what
  // distinguishes it from "1 of 4 operations failed." further down the panel.
  const headline = all.find((el) => el.tagName === 'P'
    && /^(Building \\d+ of \\d+|\\d+ of \\d+ built) ·/.test((el.innerText || '').trim()));
  const hr = headline && headline.getBoundingClientRect();

  // Criterion 3: the operation rows. Found by class rather than by shape — the
  // stylesheet names them, so a rename that breaks this is a rename that should.
  const heads = Array.from(panel.querySelectorAll('[class*="OperationHead"]')).map((row) => {
    const rr = row.getBoundingClientRect();
    const target = row.querySelector('[class*="OperationTarget"]');
    const tr = target && target.getBoundingClientRect();
    return {
      text: (row.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
      fits: rr.right <= pr.right + 1 && rr.left >= pr.left - 1,
      right: Math.round(rr.right),
      target: target
        ? {
            ellipsised: target.scrollWidth > target.clientWidth + 1,
            fits: tr.right <= pr.right + 1,
            clientWidth: target.clientWidth,
            scrollWidth: target.scrollWidth
          }
        : null
    };
  });

  const actions = Array.from(panel.querySelectorAll('[class*="OperationActions"]')).map((row) => {
    const rr = row.getBoundingClientRect();
    return {
      labels: Array.from(row.querySelectorAll('button')).map((b) => (b.innerText || '').trim()),
      fits: rr.right <= pr.right + 1,
      lines: new Set(Array.from(row.querySelectorAll('button')).map((b) => Math.round(b.getBoundingClientRect().top))).size
    };
  });

  // Slice 3: the scope tabs. A label that wrapped onto a second line made its
  // button twice the height of its neighbours, which is the cheapest thing to
  // measure and the thing that was actually wrong.
  const scope = Array.from(panel.querySelectorAll('[class*="ScopeTabs"] button')).map((b) => {
    const r = b.getBoundingClientRect();
    return { label: (b.innerText || '').trim(), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
  });

  return {
    panel: { left: Math.round(pr.left), right: Math.round(pr.right), width: Math.round(pr.width) },
    scope,
    overflowing,
    scrollers,
    headline: headline
      ? { text: (headline.innerText || '').trim(), fits: hr.right <= pr.right + 1 && hr.left >= pr.left - 1 }
      : null,
    heads,
    actions,
    buttons: Array.from(panel.querySelectorAll('button'))
      .filter(visible)
      .map((b) => (b.innerText || '').trim())
      .filter(Boolean)
  };
})()`;

/* -------------------------------------------------------------------------- */
/* Driving                                                                    */
/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 60000, every = 300, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last value: ${JSON.stringify(last)})`);
}

/**
 * Resolve and click in ONE eval — a React re-render between two CDP calls drops
 * the tag. And never click a box that is not the topmost element at that point:
 * a widget can report a real viewport coordinate that belongs to another panel,
 * where the click lands on something else and reports success.
 */
async function clickButtonWithText(client, text, { scope = 'body', exact = false } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const root = document.querySelector(${JSON.stringify(scope)});
       if (!root) return null;
       const want = ${JSON.stringify(text)}.toLowerCase();
       const buttons = Array.from(root.querySelectorAll('button, [role=button]'));
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || (${exact ? 'null' : 'buttons.find((b) => (b.innerText || "").trim().toLowerCase().startsWith(want))'});
       if (!el) return null;
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return {
         x, y, width: r.width, height: r.height,
         label: (el.innerText || '').trim(),
         onTop: Boolean(hit && (el === hit || el.contains(hit)))
       };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  if (!box.width || !box.height) throw new Error(`button "${text}" has a zero-sized box — is its panel hidden?`);
  if (!box.onTop) throw new Error(`button "${text}" is not the topmost element at its own centre — refusing to click blind`);
  await dispatchClick(client, box);
  return box.label;
}

async function openProject(client, dir) {
  const already = await evaluate(
    client,
    `(() => {
       const p = ${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
       return p ? (p._retainedProjectDirectory || '') : '';
     })()`
  );
  if (already && path.resolve(already) === path.resolve(dir)) return { opened: false, dir: already };
  if (already) throw new Error(`a different project is already open (${already}) — close it first`);

  // `filesystem.openDialog` returns the directory STRING, not { filePaths: [] }.
  await evaluate(
    client,
    `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(dir)}; return true; })()`
  );
  await clickButtonWithText(client, 'Open project');
  await waitFor(
    client,
    `(() => !!(${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance))()`,
    { timeoutMs: 60000, what: 'the project to open' }
  );
  return { opened: true, dir };
}

/** Never by rail index — index 0 is BrandExit and leaves the project. */
const openBuildPanel = (client) =>
  evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);

const setTheme = (client, mode) =>
  evaluate(client, `(() => { ${REQ(THEME_MODULE)}.ThemeManager.setMode(${JSON.stringify(mode)}); return true; })()`);

const discardSession = (client) =>
  evaluate(
    client,
    `(() => {
       const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
       const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
       store.discard(project && project.id);
       return true;
     })()`
  );

const fillDescription = (client, text) =>
  evaluate(
    client,
    `(() => {
       const area = document.querySelector('textarea');
       if (!area) return false;
       const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
       setter.call(area, ${JSON.stringify(text)});
       area.dispatchEvent(new Event('input', { bubbles: true }));
       return true;
     })()`
  );

/* -------------------------------------------------------------------------- */
/* The run                                                                    */
/* -------------------------------------------------------------------------- */

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

/** Every state is measured the same way, and the same three things are asserted. */
function assertClean(steps, label, m) {
  if (m.error) return check(steps, `${label}: measurable`, false, m.error);
  check(
    steps,
    `${label} §1: nothing in the panel scrolls sideways`,
    m.scrollers.length === 0,
    m.scrollers.map((s) => `${s.tag}.${s.cls} ${s.scrollWidth}>${s.clientWidth}`).join(' | ') || 'no horizontal scroller'
  );
  check(
    steps,
    `${label} §1: nothing crosses the panel's edges`,
    m.overflowing.length === 0,
    m.overflowing.map((o) => `${o.tag}.${o.cls} [${o.left}..${o.right}] "${o.text}"`).join(' | ') ||
      `panel ${m.panel.left}..${m.panel.right} (${m.panel.width}px)`
  );
  const badHead = m.heads.find((h) => !h.fits || (h.target && !h.target.fits));
  check(
    steps,
    `${label} §3: every operation row fits, target ellipsised rather than pushing`,
    m.heads.length === 0 || !badHead,
    badHead ? JSON.stringify(badHead) : `${m.heads.length} rows, ${m.heads.filter((h) => h.target?.ellipsised).length} ellipsised`
  );
  return m;
}

async function shoot(client, dir, name) {
  if (!dir) return null;
  const box = await evaluate(
    client,
    `(() => {
       const p = document.querySelector('[data-panel-id="ai-authoring"]') || document.querySelector('[data-testid="side-panel"]');
       if (!p) return null;
       const r = p.getBoundingClientRect();
       return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
     })()`
  );
  const params = { format: 'png', captureBeyondViewport: false };
  if (box && box.width) params.clip = { ...box, scale: 1 };
  const { data } = await client.send('Page.captureScreenshot', params);
  const file = path.join(dir, `${name}.png`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  const delay = args.delay === undefined ? 1200 : Number(args.delay);
  const theme = args.theme === undefined ? 'dark' : String(args.theme);
  const shots = args.shots ? path.resolve(String(args.shots)) : null;
  const projectDir = args['copy-corpus']
    ? (() => {
        const dest = path.join(os.tmpdir(), `pol007-corpus-${process.pid}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })()
    : args.project
      ? path.resolve(String(args.project))
      : null;

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { theme, delay, states: {}, steps };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');
    if (projectDir) report.project = await openProject(client, projectDir);

    await setTheme(client, theme);
    await sleep(600);

    const installed = await evaluate(client, installScript(delay));
    if (!installed.ok) throw new Error(installed.error);

    await openBuildPanel(client);
    await sleep(700);
    await discardSession(client);
    await sleep(400);
    await clickButtonWithText(client, 'Project', { exact: true });
    await sleep(500);

    // The panel's declared default. If a previous drag was remembered for this
    // project the whole measurement is against the wrong width, so it is
    // asserted rather than assumed.
    const empty = assertClean(steps, 'empty', await evaluate(client, MEASURE));
    report.states.empty = empty;
    // 398, not 400. `defaultWidth: 400` sizes the rail+panel split; the panel a
    // component actually lays out in is that minus the rail's 1px right border
    // and the panel's own 1px left border. Measured, not assumed — an earlier
    // version of this check asserted 400 and failed a correct layout.
    check(
      steps,
      'the panel is at its declared default (400 less its two 1px borders)',
      empty.panel && empty.panel.width === 398,
      `${empty.panel?.width}px`
    );
    // Slice 3: all three scope tabs on one row, each on one line. Equal heights
    // and one distinct `top` is exactly that, and it is what the equal-thirds
    // split broke.
    const tabHeights = new Set((empty.scope || []).map((t) => t.height));
    const tabRows = new Set((empty.scope || []).map((t) => t.top));
    check(
      steps,
      'empty §3: the scope tabs are one row of single-line labels',
      empty.scope.length === 3 && tabHeights.size === 1 && tabRows.size === 1,
      (empty.scope || []).map((t) => `${t.label} ${t.width}x${t.height}`).join(' | ')
    );
    report.shots = {};
    report.shots.empty = await shoot(client, shots, `${theme}-1-empty`);

    // ── Plan proposed ───────────────────────────────────────────────────────
    if (!(await fillDescription(client, PLAN_REQUEST))) throw new Error('no description field in the Build panel');
    await sleep(200);
    await clickButtonWithText(client, 'Plan it');
    await waitFor(client, `(() => /Author plan \\(4\\)/.test(document.body.innerText || ''))()`, {
      timeoutMs: 90000,
      what: 'the plan to arrive'
    });
    await sleep(400);
    report.states.planned = assertClean(steps, 'plan proposed', await evaluate(client, MEASURE));
    report.shots.planned = await shoot(client, shots, `${theme}-2-plan-proposed`);

    // ── Running, with one staged and reviewable ─────────────────────────────
    await clickButtonWithText(client, 'Author plan (4)');
    await waitFor(
      client,
      `(() => {
         const text = document.body.innerText || '';
         return /^Building \\d+ of 4/m.test(text)
           && Array.from(document.querySelectorAll('button')).some((b) => (b.innerText || '').trim() === 'Review');
       })()`,
      { timeoutMs: 120000, what: 'an operation to stage while the run is still going' }
    );
    await sleep(300);
    report.states.running = assertClean(steps, 'running, one staged', await evaluate(client, MEASURE));
    check(
      steps,
      'running §2: the run headline is whole, inside the panel',
      report.states.running.headline?.fits === true,
      JSON.stringify(report.states.running.headline)
    );
    report.shots.running = await shoot(client, shots, `${theme}-3-running-staged-with-review`);

    // ── Finished, with a real failure ───────────────────────────────────────
    await waitFor(client, `(() => /of 4 built ·/.test(document.body.innerText || ''))()`, {
      timeoutMs: 300000,
      what: 'the run to finish'
    });
    await sleep(600);
    const done = assertClean(steps, 'finished, one failed', await evaluate(client, MEASURE));
    report.states.done = done;
    check(
      steps,
      'finished §2: the run headline is whole, inside the panel',
      done.headline?.fits === true,
      JSON.stringify(done.headline)
    );
    check(
      steps,
      'the failure is real: the run offers a Retry',
      done.buttons.includes('Retry'),
      done.buttons.join(' | ')
    );
    check(
      steps,
      'the long target is ellipsised, not overflowing',
      done.heads.some((h) => h.target?.ellipsised && h.target.fits),
      done.heads.map((h) => `${h.text} [${h.target?.clientWidth}/${h.target?.scrollWidth}]`).join(' | ')
    );
    report.shots.done = await shoot(client, shots, `${theme}-4-failed-with-retry`);

    // ── Criterion 5: wide, and full ─────────────────────────────────────────
    await evaluate(
      client,
      `(() => { const b = document.querySelector('[data-test="side-panel-wide-toggle"], [data-testid="side-panel-wide-toggle"]'); if (b) { b.click(); return true; } return false; })()`
    );
    await sleep(700);
    const wide = assertClean(steps, 'wide', await evaluate(client, MEASURE));
    report.states.wide = wide;
    check(steps, 'wide §5: the panel really is wider than 400', wide.panel && wide.panel.width > 500, `${wide.panel?.width}px`);
    report.shots.wide = await shoot(client, shots, `${theme}-5-wide`);

    await evaluate(
      client,
      `(() => { const b = document.querySelector('[data-test="side-panel-full-toggle"], [data-testid="side-panel-full-toggle"]'); if (b) { b.click(); return true; } return false; })()`
    );
    await sleep(800);
    const full = assertClean(steps, 'full', await evaluate(client, MEASURE));
    report.states.full = full;
    report.shots.full = await shoot(client, shots, `${theme}-6-full`);

    // Back to docked before applying, so the applied state is measured at 400.
    await evaluate(
      client,
      `(() => { const b = document.querySelector('[data-test="side-panel-full-toggle"], [data-testid="side-panel-full-toggle"]'); if (b) { b.click(); return true; } return false; })()`
    );
    await sleep(800);

    // ── Applied ─────────────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Apply');
    await waitFor(client, `(() => /Applied the plan —/.test(document.body.innerText || ''))()`, {
      timeoutMs: 120000,
      what: 'the plan to apply'
    });
    await sleep(600);
    report.states.applied = assertClean(steps, 'applied', await evaluate(client, MEASURE));
    report.shots.applied = await shoot(client, shots, `${theme}-7-applied`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    // Never restore the real client while a run is still authoring against the
    // scripted one — the next operation would go to a provider that is not
    // configured, and everything after that would be measuring the restore.
    await evaluate(
      client,
      `(async () => {
         const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
         const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         const run = store.get(project && project.id).run;
         for (let i = 0; i < 120 && run && run.state.busy; i++) await new Promise((r) => setTimeout(r, 1000));
         if (window.__pol007original) {
           AiClient.chatStream = window.__pol007original.chatStream;
           AiClient.isConfigured = window.__pol007original.isConfigured;
         }
         return true;
       })()`
    ).catch(() => undefined);
    client.close?.();
  }

  const failed = steps.filter((s) => !s.ok);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.project) console.log(`project: ${report.project.dir}`);
    console.log(`theme:   ${theme}`);
    for (const step of steps) console.log(`${step.ok ? '  ok  ' : ' FAIL '} ${step.name}\n         ${step.detail}`);
    if (shots) console.log(`\nshots:   ${shots}`);
    if (report.error) console.log(`\nerror: ${report.error}`);
  }
  // A CDP script that never exits is a connect() that was never closed.
  process.exit(report.error || failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
