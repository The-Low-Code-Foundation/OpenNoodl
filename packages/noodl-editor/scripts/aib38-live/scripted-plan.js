#!/usr/bin/env node
/**
 * Phase 38 — the scripted, no-provider **plan** run.
 *
 * `scripts/aix15-live/scripted-session.js` does this for the single-component
 * loop. Phase 38's two headline tasks are about the *plan* loop — AIB-002 (the
 * run is legible while it runs) and AIB-004 (reviewing one operation shows a
 * rendered page, in one vocabulary) — and neither can be checked without a plan
 * actually running in the editor, with more than one operation, slowly enough to
 * look at while it is still going.
 *
 * Same seam and only that seam: `AiClient` is a plain object literal, so
 * `chatStream` and `isConfigured` are replaced at runtime. The reply is routed
 * by the tool the caller offered —
 *
 *   - `submit_plan`      → `PlanningSession` gets the fixture plan;
 *   - `submit_component` → the operation is identified by the component path in
 *                          its opening user message, exactly as the jest
 *                          `planChatScript` does, and gets that target's nodes;
 *   - anything else      → prose, which every session treats as a decline.
 *
 * Everything downstream — `PlanRun`, the SUB-006 gate, `ProjectAuthoringView`,
 * `ChangeReviewDocument`, `SandboxPreview`, `AppRegistry` — is the app's own
 * code, untouched.
 *
 * **The fixture is a plan whose second page instantiates its first.** That is
 * not decoration: AIB-004 criterion 3 is that a preview renders a candidate
 * which instantiates another candidate from the same plan, and until this phase
 * `buildSandboxExport` spliced exactly one. A fixture of three independent pages
 * would pass while that was still broken.
 *
 * ## The cost readout is deliberately non-zero
 *
 * `scripted-session.js` reports `costUsd: 0` and says a measurement tool must not
 * claim a cost it did not incur. That still holds — and AIB-002 criterion 3 is
 * *that the header renders a cost at all*, which a zero cannot distinguish from
 * a missing one. So each scripted turn reports a distinctive synthetic
 * `COST_PER_TURN`, and the check is that the header shows exactly the sum of the
 * turns that ran. Nothing was spent; the number is this script's, and it says so.
 *
 * Usage (editor must be running via `npm run dev:debug`):
 *
 *   node packages/noodl-editor/scripts/aib38-live/scripted-plan.js --copy-corpus [--json]
 *
 * `--delay=<ms>` is the per-turn pause that makes the run observable mid-flight
 * (default 7000). `--copy-corpus` copies the tracked corpus fixture somewhere the
 * editor may safely rewrite — always use it; the editor minifies and rewrites any
 * project it opens.
 *
 * ## Timers, and why a run can appear to hang
 *
 * Chromium throttles `setTimeout` in an occluded window to roughly one wake a
 * minute. A turn whose scripted work is seven seconds measured **200 seconds**
 * with the editor behind another window — indistinguishable, from the panel,
 * from the run hanging. Nothing in this script asserts a duration for that
 * reason, and the scripted reply now uses exactly one timer per turn. If a run
 * here looks stuck, check `window.__aib38.timings` before suspecting the editor.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, elementCentre, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

/** Synthetic. See the header — nothing is spent, and the header must show it. */
const COST_PER_TURN = 0.0125;

/* -------------------------------------------------------------------------- */
/* The fixture                                                                */
/* -------------------------------------------------------------------------- */

const PLAN_REQUEST = 'Add a checkout flow: a checkout page, a cart that opens it, and a link from the article page.';

const PLAN_OPERATIONS = [
  { kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page: a heading and a confirm button.' },
  {
    kind: 'create',
    target: 'Pages/Cart',
    intent: 'The cart page. It instantiates /Pages/Checkout so the two are reviewed together.'
  },
  { kind: 'update', target: 'Pages/Article', intent: 'Link the article page through to the cart.' }
];

/**
 * One submission per target. `Pages/Cart` instantiates `/Pages/Checkout`, which
 * exists nowhere but in the first operation's staged candidate — so this fixture
 * exercises both halves of the plan's cross-operation visibility: the gate has to
 * accept the reference (AIX-011) and the preview has to render it (AIB-004).
 */
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
  'Pages/Cart': {
    nodes: [
      { id: 'ca_root', type: 'Group', label: 'Cart' },
      { id: 'ca_title', type: 'Text', parent: 'ca_root', parameters: { text: 'Your cart' } },
      { id: 'ca_checkout', type: '/Pages/Checkout', parent: 'ca_root' }
    ],
    visual_roots: ['ca_root'],
    description: 'The cart page, showing the checkout page inside it.'
  },
  'Pages/Article': {
    nodes: [
      { id: 'ar_root', type: 'Group', label: 'Article' },
      { id: 'ar_body', type: 'Text', parent: 'ar_root', parameters: { text: 'An article.' } },
      { id: 'ar_to_cart', type: 'Button', parent: 'ar_root', parameters: { label: 'Go to cart' } }
    ],
    visual_roots: ['ar_root'],
    description: 'The article page, with a link to the cart.'
  }
};

/* -------------------------------------------------------------------------- */
/* Renderer-side helpers                                                      */
/* -------------------------------------------------------------------------- */

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-plan'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;

const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;

const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';
const PLAN_STORE_MODULE = './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts';

function installScript(delayMs) {
  return `(async () => {
    const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };

    const PLAN = ${JSON.stringify({ operations: PLAN_OPERATIONS })};
    const SUBMISSIONS = ${JSON.stringify(SUBMISSIONS)};
    const DELAY = ${delayMs};
    const COST = ${COST_PER_TURN};

    window.__aib38 = { turns: [], cost: 0, timings: [] };
    if (!window.__aib38original) {
      window.__aib38original = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }

    const usage = () => ({
      promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: COST
    });
    const reply = (name, args) => {
      const toolCall = { id: 'aib38-' + window.__aib38.turns.length, name, arguments: args };
      return { text: '', toolCalls: [toolCall], usage: usage(), model: 'scripted-replay', stopReason: 'tool_calls' };
    };

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      const enteredAt = performance.now();
      window.__aib38.timings.push({ at: enteredAt, event: 'enter' });
      const tools = (request.tools || []).map((t) => t.name);
      const opening = (request.messages || []).filter((m) => m.role === 'user').map((m) => m.content).join('\\n');

      // The pause is what makes the run observable while it is still running —
      // a replay that answers instantly finishes before anything can look at it.
      if (DELAY > 0) await new Promise((r) => setTimeout(r, DELAY));
      window.__aib38.cost += COST;

      if (tools.includes('submit_plan')) {
        window.__aib38.turns.push('plan');
        return reply('submit_plan', PLAN);
      }

      if (tools.includes('submit_component')) {
        const target = Object.keys(SUBMISSIONS).find((t) => opening.includes('"' + t + '"'));
        window.__aib38.turns.push(target || 'unknown-component');
        if (!target) return reply('submit_component', { nodes: [{ id: 'x', type: 'NoSuchType' }] });
        const args = SUBMISSIONS[target];
        const argsText = JSON.stringify(args);
        // Stream the arguments the way a provider does, so the panel's live node
        // count climbs and PartialPayloadScanner runs its real path.
        //
        // Back to back, with NO sleep between them. Chromium throttles timers in
        // an occluded window down to roughly one wake a minute, and this loop
        // originally slept 120ms four times — which measured 200s and 265s for
        // turns whose own work is seven seconds, and read exactly like the editor
        // hanging mid-run. Every timer here is one more chance to be throttled,
        // so there is now exactly one per turn, and even that only stretches the
        // wait (no assertion in this script depends on a duration).
        for (let i = 1; i <= 4; i++) {
          callbacks.onToolCallPartial?.({
            index: 0, name: 'submit_component', argsText: argsText.slice(0, Math.floor((argsText.length * i) / 4))
          });
        }
        const response = reply('submit_component', args);
        callbacks.onToolCall?.(response.toolCalls[0]);
        callbacks.onEnd?.();
        window.__aib38.timings.push({ at: performance.now(), event: 'return:' + target, ms: performance.now() - enteredAt });
        return response;
      }

      window.__aib38.turns.push('declined:' + tools.join(','));
      callbacks.onEnd?.();
      return { text: 'Nothing to do.', toolCalls: [], usage: usage(), model: 'scripted-replay', stopReason: 'stop' };
    };
    return { ok: true, operations: PLAN.operations.length };
  })()`;
}

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
 * Click the first button whose visible text matches, resolving and clicking in
 * ONE eval — a React re-render between two CDP calls drops a tag, and a hidden
 * panel's elements have a zero-sized box that reports a successful click landing
 * somewhere else entirely.
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
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height, label: (el.innerText || '').trim() };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  if (!box.width || !box.height) throw new Error(`button "${text}" has a zero-sized box — is its panel hidden?`);
  await dispatchClick(client, box);
  return box.label;
}

/** Every button label currently on screen — the cheapest evidence of vocabulary. */
async function buttonLabels(client, scope = 'body') {
  return evaluate(
    client,
    `(() => {
       const root = document.querySelector(${JSON.stringify(scope)});
       if (!root) return [];
       return Array.from(root.querySelectorAll('button, [role=button]'))
         .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
         .map((b) => (b.innerText || '').trim())
         .filter(Boolean);
     })()`
  );
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
async function openBuildPanel(client) {
  return evaluate(
    client,
    `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`
  );
}

/** Throw away any session this project already has, so a re-run starts clean. */
async function discardSession(client) {
  return evaluate(
    client,
    `(() => {
       const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
       const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
       store.discard(project && project.id);
       return true;
     })()`
  );
}

async function fillDescription(client, text) {
  return evaluate(
    client,
    `(() => {
       const area = Array.from(document.querySelectorAll('textarea'))
         .find((el) => /checkout page|What should change|Wire the Checkout/i.test((el.placeholder || '') + (el.getAttribute('aria-label') || '')))
         || document.querySelector('textarea');
       if (!area) return false;
       const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
       setter.call(area, ${JSON.stringify(text)});
       area.dispatchEvent(new Event('input', { bubbles: true }));
       return true;
     })()`
  );
}

/* -------------------------------------------------------------------------- */
/* The run                                                                    */
/* -------------------------------------------------------------------------- */

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  // Long enough that reviewing operation 1 — opening the document, toggling
  // views, excluding a row — still happens while operations 2 and 3 are running,
  // which is the whole claim of AIB-002 criterion 1.
  const delay = args.delay === undefined ? 7000 : Number(args.delay);
  const projectDir = args['copy-corpus']
    ? (() => {
        const dest = path.join(os.tmpdir(), `aib38-corpus-${process.pid}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })()
    : args.project
      ? path.resolve(String(args.project))
      : null;

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { delay, costPerTurn: COST_PER_TURN, steps };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');
    if (projectDir) report.project = await openProject(client, projectDir);

    const installed = await evaluate(client, installScript(delay));
    if (!installed.ok) throw new Error(installed.error);

    await openBuildPanel(client);
    await sleep(600);
    await discardSession(client);
    await sleep(400);

    // ── Plan ────────────────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Project', { exact: true });
    await sleep(400);
    if (!(await fillDescription(client, PLAN_REQUEST))) throw new Error('no description field in the Build panel');
    await sleep(200);
    await clickButtonWithText(client, 'Plan it');
    await waitFor(client, `(() => /Author plan \\(3\\)/.test(document.body.innerText || ''))()`, {
      what: 'the plan to arrive'
    });

    const planLabels = await buttonLabels(client);
    check(
      steps,
      'AIB-004 §1: the pre-authoring panel says "Discard plan", not "Reject"',
      planLabels.includes('Discard plan') && !planLabels.includes('Reject'),
      planLabels.join(' | ')
    );

    // ── Author ──────────────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Author plan (3)');

    // AIB-002 criterion 1: reviewable the moment it stages, with more running.
    const midRun = await waitFor(
      client,
      `(() => {
         const text = document.body.innerText || '';
         const staged = /Pages\\/Checkout — \\d+ nodes/.test(text);
         const running = /^Building \\d+ of 3/m.test(text);
         const reviewable = Array.from(document.querySelectorAll('button'))
           .some((b) => (b.innerText || '').trim() === 'Review');
         return staged && running && reviewable
           ? { header: (text.match(/^Building \\d+ of 3.*$/m) || [''])[0], reviewable: true }
           : null;
       })()`,
      { timeoutMs: 90000, what: 'operation 1 to stage while the run is still going' }
    );
    check(steps, 'AIB-002 §1: an operation is reviewable while the rest still run', midRun.reviewable, midRun.header);
    check(
      steps,
      'AIB-002 §3: the header reads position · elapsed · cost, live',
      /^Building \d+ of 3 · \d+m? ?\d*s · \$\d/.test(midRun.header),
      midRun.header
    );

    const rowLabels = await buttonLabels(client);
    check(
      steps,
      'AIB-004 §1: the operation row says "Drop from plan", not "Exclude"',
      rowLabels.includes('Drop from plan') && !rowLabels.includes('Exclude'),
      rowLabels.filter((l) => /plan|Exclude|Review/.test(l)).join(' | ')
    );

    // ── Review operation 1, mid-run ─────────────────────────────────────────
    // `--no-review` runs the plan without opening anything, as the baseline for
    // "does reviewing mid-run cost the run anything".
    if (args['no-review']) {
      await waitFor(client, `(() => /of 3 built ·/.test(document.body.innerText || ''))()`, {
        timeoutMs: 180000,
        what: 'the run to finish (no-review baseline)'
      });
      report.baseline = await evaluate(
        client,
        `(() => ((document.body.innerText || '').match(/^\\d+ of 3 built ·.*$/m) || [''])[0])()`
      );
      throw new Error('--no-review: baseline only');
    }
    await clickButtonWithText(client, 'Review');
    await waitFor(client, `(() => /Operation \\d+ of 3 · nothing applied yet/.test(document.body.innerText || ''))()`, {
      what: 'the review document to open'
    });

    // Whether the rest of the plan is STILL running while this review is open —
    // asserted from the run itself, not from the screen, because "reviewable the
    // moment it stages" is only a claim if the other operations are unfinished.
    const stillBusy = await evaluate(
      client,
      `(() => {
         const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         const run = store.get(project && project.id).run;
         return run ? { busy: run.state.busy, statuses: run.state.operations.map((o) => o.status) } : null;
       })()`
    );
    check(
      steps,
      'AIB-002 §1 (live): the review is open while the rest of the plan is still authoring',
      Boolean(stillBusy && stillBusy.busy && stillBusy.statuses.some((s) => s === 'pending' || s === 'authoring')),
      JSON.stringify(stillBusy)
    );

    // Every visible button, sidebar included: the complaint was four buttons in
    // ONE viewport, so scoping this to the document would measure the wrong thing.
    //
    // Filtered to the commit/discard *verbs*, though, which is what criterion 1
    // is about. A first pass tested every label for "project" and failed on the
    // "Project" scope tab and the review banner's "Not for this project" — two
    // controls that commit and discard nothing, and whose presence was never the
    // complaint. Widening a check until it fails is not the same as it finding
    // something.
    const reviewLabels = await buttonLabels(client);
    const verbs = reviewLabels.filter((l) => /^(keep|drop|apply|discard|abandon|reject|accept)\b/i.test(l));
    check(
      steps,
      'AIB-004 §1: every commit/discard verb on screen names its level, and none names the project',
      verbs.some((l) => /^Keep all in plan$/.test(l)) &&
        verbs.includes('Drop from plan') &&
        verbs.every((l) => /\bin plan$|\bfrom plan$|\bplan$/.test(l)) &&
        !verbs.some((l) => /project/i.test(l)),
      verbs.join(' | ')
    );

    const view = await evaluate(
      client,
      `(() => {
         const text = document.body.innerText || '';
         const webview = document.querySelector('webview');
         const r = webview && webview.getBoundingClientRect();
         return {
           hasPreviewTab: /\\bPreview\\b/.test(text),
           previewVisible: Boolean(r && r.width > 0 && r.height > 0),
           chip: (text.match(/Operation \\d+ of 3 · nothing applied yet/) || [''])[0]
         };
       })()`
    );
    check(
      steps,
      'AIB-004 §2: reviewing a create opens on a rendered preview',
      view.hasPreviewTab && view.previewVisible,
      JSON.stringify(view)
    );

    // Criterion 4: the keep/drop selection survives Preview ↔ Changes.
    await clickButtonWithText(client, 'Changes', { exact: true });
    await sleep(500);
    const excluded = await evaluate(
      client,
      `(() => {
         const btn = Array.from(document.querySelectorAll('button'))
           .find((b) => (b.getAttribute('aria-label') || '') === 'Exclude this change');
         if (!btn) return null;
         const r = btn.getBoundingClientRect();
         return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
       })()`
    );
    if (excluded && excluded.width) {
      await dispatchClick(client, excluded);
      await sleep(400);
      const before = await buttonLabels(client);
      await clickButtonWithText(client, 'Preview', { exact: true });
      await sleep(400);
      await clickButtonWithText(client, 'Changes', { exact: true });
      await sleep(400);
      const after = await buttonLabels(client);
      const kept = (labels) => labels.find((l) => /^Keep \d+ of \d+ in plan$/.test(l));
      check(
        steps,
        'AIB-004 §4: switching Preview↔Changes preserves the keep/drop selection',
        Boolean(kept(before)) && kept(before) === kept(after),
        `${kept(before)} → ${kept(after)}`
      );
      // Put it all back, so the plan applies whole.
      //
      // One click does NOT undo one exclusion. Exclusion closes *forward* over
      // dependents (dropping the Group drops the Text and the Button inside it —
      // hence "Keep 0 of 3" from a single click) while restore closes *back*
      // over prerequisites only, returning one row. That asymmetry is deliberate
      // (AIX-003) and it means the way back is a loop, not a click.
      for (let i = 0; i < 12; i++) {
        const restore = await evaluate(
          client,
          `(() => {
             const btn = Array.from(document.querySelectorAll('button'))
               .find((b) => (b.getAttribute('aria-label') || '') === 'Include this change again');
             if (!btn) return null;
             const r = btn.getBoundingClientRect();
             return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
           })()`
        );
        if (!restore || !restore.width) break;
        await dispatchClick(client, restore);
        await sleep(250);
      }
      const restored = await buttonLabels(client);
      check(
        steps,
        'AIX-003 asymmetry holds: restoring every excluded row returns the whole candidate',
        restored.includes('Keep all in plan'),
        restored.find((l) => /^Keep .*in plan$/.test(l)) ?? 'no keep button'
      );
    } else {
      check(steps, 'AIB-004 §4: switching Preview↔Changes preserves the keep/drop selection', false, 'no excludable row found');
    }

    // Prefix match: if a row is still excluded this reads "Keep N of M in plan",
    // which is the same button and the same code path.
    await clickButtonWithText(client, 'Keep');
    await sleep(800);

    // ── Wait for the run to finish ──────────────────────────────────────────
    await openBuildPanel(client);
    // Generous: an occluded editor window has its timers throttled, so the
    // scripted turns take minutes rather than seconds. See the streaming loop.
    await waitFor(client, `(() => /of 3 built ·/.test(document.body.innerText || ''))()`, {
      timeoutMs: 300000,
      what: 'the run to finish'
    });

    const doneText = await evaluate(
      client,
      `(() => ((document.body.innerText || '').match(/^\\d+ of 3 built ·.*$/m) || [''])[0])()`
    );
    // The planning turn's cost belongs to `PlanningSession`, which is not part
    // of the run — `PlanRun.costUsd` accumulates only the sessions it started.
    // Counting all four turns here would have failed a correct header.
    const authoringTurns = await evaluate(
      client,
      `(() => window.__aib38.turns.filter((t) => t !== 'plan').length)()`
    );
    const expectedCost = authoringTurns * COST_PER_TURN;
    check(
      steps,
      'AIB-002 §3: the finished header carries the total cost the authoring turns reported',
      doneText.includes(`$${expectedCost.toFixed(2)}`),
      `${doneText} (${authoringTurns} authoring turns × $${COST_PER_TURN} = $${expectedCost.toFixed(4)})`
    );

    const doneLabels = await buttonLabels(client);
    const doneVerbs = doneLabels.filter((l) => /^(keep|drop|apply|discard|abandon|reject|accept)\b/i.test(l));
    check(
      steps,
      'AIB-004 §1: exactly one commit/discard verb names the project, and it is the one that writes',
      doneVerbs.filter((l) => /project/i.test(l)).length === 1 &&
        doneVerbs.some((l) => /^Apply to project \(3\)$/.test(l)) &&
        doneVerbs.every((l) => /\bin plan$|\bfrom plan$|\bplan$|to project \(\d+\)$/.test(l)),
      doneVerbs.join(' | ')
    );
    // The two other labels carrying the word are the "Project" scope tab and the
    // review banner's "Not for this project" dismissal. Neither commits nor
    // discards anything, so neither is the ambiguity criterion 1 is about — but
    // the banner's is discard-shaped and sits two rows above "Discard plan", so
    // it is recorded rather than filtered away silently.
    report.otherProjectLabels = doneLabels.filter((l) => /project/i.test(l) && !doneVerbs.includes(l));

    // ── AIB-004 §3: the sibling splice, on the operation that needs it ──────
    report.turns = await evaluate(client, `(() => window.__aib38.turns)()`);
    report.siblingExport = await evaluate(
      client,
      `(() => {
         const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         const run = store.get(project && project.id).run;
         if (!run) return { error: 'no run in the session' };
         const cart = run.plan.operations.find((op) => op.target === 'Pages/Cart');
         const files = run.filesFor(cart.id);
         const siblings = run.stagedSiblings(cart.id);
         const sandbox = ${REQ('./src/editor/src/models/AiAssistant/authoring/sandboxExport.ts')};
         const withSiblings = sandbox.buildSandboxExport({ project, files, siblings });
         const alone = sandbox.buildSandboxExport({ project, files });
         const names = (r) => (r.json ? r.json.components.map((c) => c.name) : []);
         return {
           siblingCount: siblings.length,
           withSiblings: names(withSiblings).includes('/Pages/Checkout'),
           alone: names(alone).includes('/Pages/Checkout')
         };
       })()`
    );
    check(
      steps,
      'AIB-004 §3: the preview splices a candidate that another operation authored',
      report.siblingExport.withSiblings === true && report.siblingExport.alone === false,
      JSON.stringify(report.siblingExport)
    );
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    report.timings = await evaluate(client, `(() => window.__aib38 && window.__aib38.timings)()`).catch(() => undefined);
    // Put the real client back — but NOT while a run is still authoring against
    // it. An earlier version restored unconditionally in this block, so a step
    // that timed out handed the *next* operation to a provider that is not
    // configured, and everything measured after that was measuring the restore.
    await evaluate(
      client,
      `(async () => {
         const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
         const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         const run = store.get(project && project.id).run;
         for (let i = 0; i < 120 && run && run.state.busy; i++) {
           await new Promise((r) => setTimeout(r, 1000));
         }
         if (window.__aib38original) {
           AiClient.chatStream = window.__aib38original.chatStream;
           AiClient.isConfigured = window.__aib38original.isConfigured;
         }
         return run ? run.state.busy : false;
       })()`
    ).catch(() => undefined);
    client.close?.();
  }

  const failed = steps.filter((s) => !s.ok);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.project) console.log(`project: ${report.project.dir}`);
    if (report.turns) console.log(`turns:   ${report.turns.join(' → ')}`);
    for (const step of steps) console.log(`${step.ok ? '  ok  ' : ' FAIL '} ${step.name}\n         ${step.detail}`);
    if (report.error) console.log(`\nerror: ${report.error}`);
  }
  process.exit(report.error || failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
