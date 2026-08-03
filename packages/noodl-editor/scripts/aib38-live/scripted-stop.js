#!/usr/bin/env node
/**
 * Phase 38 — stopping a run, and what survives it.
 *
 * Two claims, both about a mount and neither reachable from a suite:
 *
 *  - **AIB-009 F4** — a stopped run keeps the components it built and skips the
 *    documents that would have recorded them. The panel now says that *before*
 *    the click, and offers to write them afterwards without re-authoring
 *    anything. `PlanRun.runDocPass` is the mechanism; this is the screen.
 *  - **AIB-003 criterion 6** — the navigation Richard performed, with staged
 *    candidates in flight: scope tab away and back, close the Build panel and
 *    reopen it, while a run is still going.
 *
 * Same seam as `scripted-plan.js`: `AiClient.chatStream` is replaced, everything
 * downstream is the app's own code.
 *
 * ## Held turns, not timed ones
 *
 * `scripted-plan.js` paces with `--delay`, which an occluded window throttles to
 * roughly one wake a minute. Every turn here instead **blocks on a promise this
 * script resolves over CDP**, so the run advances exactly when the driver says
 * so — which is what makes "navigate away mid-run" a repeatable step rather
 * than a race, and what keeps the whole check under a minute.
 *
 * Usage (editor must be running via `npm run dev:debug`):
 *
 *   node packages/noodl-editor/scripts/aib38-live/scripted-stop.js --copy-corpus [--json]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-stop'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;
const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;
const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';
const PLAN_STORE_MODULE = './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts';

const PLAN_REQUEST = 'Add a checkout flow and record it in the architecture doc.';

/** Two components and the document that records them — the doc pass runs last. */
const PLAN_OPERATIONS = [
  { kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page.' },
  { kind: 'create', target: 'Pages/Cart', intent: 'The cart page.' },
  { kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Record the checkout flow.' }
];

const SUBMISSIONS = {
  'Pages/Checkout': {
    nodes: [
      { id: 'co_root', type: 'Group', label: 'Checkout' },
      { id: 'co_title', type: 'Text', parent: 'co_root', parameters: { text: 'Checkout' } }
    ],
    visual_roots: ['co_root'],
    description: 'The checkout page.'
  },
  'Pages/Cart': {
    nodes: [
      { id: 'ca_root', type: 'Group', label: 'Cart' },
      { id: 'ca_title', type: 'Text', parent: 'ca_root', parameters: { text: 'Your cart' } }
    ],
    visual_roots: ['ca_root'],
    description: 'The cart page.'
  }
};

const DOC_BODY =
  '# Architecture\n\n## Checkout\n\nCheckout is a page rather than a modal so the browser back button behaves.\n';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 60000, every = 250, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last value: ${JSON.stringify(last)})`);
}

async function clickButtonWithText(client, text, { exact = false } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const want = ${JSON.stringify(text)}.toLowerCase();
       const buttons = Array.from(document.querySelectorAll('button, [role=button]'));
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || (${exact ? 'null' : 'buttons.find((b) => (b.innerText || "").trim().toLowerCase().startsWith(want))'});
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height,
                label: (el.innerText || '').trim() };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  if (!box.width || !box.height) throw new Error(`button "${text}" has a zero-sized box — is its panel hidden?`);
  await dispatchClick(client, box);
  return box.label;
}

function installScript() {
  return `(() => {
    const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };
    if (!window.__aib38stopOriginal) {
      window.__aib38stopOriginal = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }
    const state = { turns: [], held: null, release: null };
    window.__aib38stop = state;

    const PLAN = ${JSON.stringify({ operations: PLAN_OPERATIONS })};
    const SUBMISSIONS = ${JSON.stringify(SUBMISSIONS)};
    const DOC_BODY = ${JSON.stringify(DOC_BODY)};
    const usage = { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 };
    const reply = (name, args) => ({
      text: '', toolCalls: [{ id: 'aib38stop-' + state.turns.length, name, arguments: args }],
      usage, model: 'scripted-replay', stopReason: 'tool_calls'
    });
    // No timers: the turn stays in flight until the driver releases it.
    const hold = (label) => new Promise((resolve) => { state.release = resolve; state.held = label; });

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      const tools = (request.tools || []).map((t) => t.name);
      const opening = (request.messages || []).filter((m) => m.role === 'user').map((m) => m.content).join('\\n');

      if (tools.includes('submit_plan')) {
        state.turns.push('plan');
        return reply('submit_plan', PLAN);
      }

      if (tools.includes('submit_component')) {
        const target = Object.keys(SUBMISSIONS).find((t) => opening.includes('"' + t + '"'));
        state.turns.push(target || 'unknown-component');
        await hold(target || 'unknown-component');
        // Faithful to the Anthropic adapter: an aborted request resolves with
        // whatever arrived and says so, rather than rejecting. Without this a
        // scripted cancel would still stage the component it was cancelling.
        if (request.abortController && request.abortController.signal.aborted) {
          return { text: '', toolCalls: [], usage, model: 'scripted-replay', stopReason: 'aborted' };
        }
        if (!target) return reply('submit_component', { nodes: [{ id: 'x', type: 'NoSuchType' }] });
        const response = reply('submit_component', SUBMISSIONS[target]);
        callbacks.onToolCall?.(response.toolCalls[0]);
        callbacks.onEnd?.();
        return response;
      }

      if (tools.includes('submit_doc')) {
        state.turns.push('doc');
        await hold('doc');
        return reply('submit_doc', { content: DOC_BODY, summary: 'Recorded the checkout flow' });
      }

      state.turns.push('declined:' + tools.join(','));
      return { text: 'Nothing to do.', toolCalls: [], usage, model: 'scripted-replay', stopReason: 'stop' };
    };
    return { ok: true };
  })()`;
}

async function releaseHold(client, expected) {
  await waitFor(client, `(() => Boolean(window.__aib38stop && window.__aib38stop.held))()`, {
    what: `a held turn${expected ? ` (${expected})` : ''}`
  });
  return evaluate(
    client,
    `(() => { const s = window.__aib38stop; const was = s.held; s.held = null;
              const r = s.release; s.release = null; r && r(); return was; })()`
  );
}

/** The run's own state, read from the store rather than from the screen. */
const RUN_STATE = `(() => {
  const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
  const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
  const session = store.get(project && project.id);
  const run = session.run;
  if (!run) return null;
  const s = run.state;
  return {
    phase: s.phase,
    busy: s.busy,
    operations: s.operations.map((o) => ({
      target: o.operation.target, kind: o.operation.kind, status: o.status, skippedByCancel: Boolean(o.skippedByCancel)
    })),
    staged: s.operations.filter((o) => o.status === 'staged').length,
    hasPlan: Boolean(session.plan)
  };
})()`;

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

async function openBuildPanel(client) {
  return evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  const projectDir = args['copy-corpus']
    ? (() => {
        const dest = path.join(os.tmpdir(), `aib38-stop-${process.pid}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })()
    : args.project
      ? path.resolve(String(args.project))
      : null;

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { steps, projectDir };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');

    if (projectDir) {
      const already = await evaluate(
        client,
        `(() => { const p = ${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
                  return p ? (p._retainedProjectDirectory || '') : ''; })()`
      );
      if (!already) {
        await evaluate(
          client,
          `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(projectDir)}; return true; })()`
        );
        await clickButtonWithText(client, 'Open project');
        await waitFor(client, `(() => !!(${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance))()`, {
          what: 'the project to open'
        });
      } else {
        report.reusedProject = already;
      }
    }

    const installed = await evaluate(client, installScript());
    if (!installed.ok) throw new Error(installed.error);

    await openBuildPanel(client);
    await sleep(600);
    await evaluate(
      client,
      `(() => { ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance.discard(${REQ(PROJECT_MODULE)}.ProjectModel.instance.id); return true; })()`
    );
    await sleep(400);

    // ── Plan ────────────────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Project', { exact: true });
    await sleep(300);
    await evaluate(
      client,
      `(() => {
         const area = document.querySelector('textarea');
         if (!area) return false;
         const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
         setter.call(area, ${JSON.stringify(PLAN_REQUEST)});
         area.dispatchEvent(new Event('input', { bubbles: true }));
         return true;
       })()`
    );
    await sleep(200);
    await clickButtonWithText(client, 'Plan it');
    await waitFor(client, `(() => /Author plan \\(3\\)/.test(document.body.innerText || ''))()`, {
      what: 'the plan to arrive'
    });
    await clickButtonWithText(client, 'Author plan (3)');

    // ── Operation 1: let it finish. Operation 2: hold it there. ─────────────
    await releaseHold(client, 'Pages/Checkout');
    await waitFor(client, `(() => Boolean(window.__aib38stop && window.__aib38stop.held === 'Pages/Cart'))()`, {
      what: 'operation 2 to start'
    });
    await sleep(600);

    const midRun = await evaluate(client, RUN_STATE);
    report.midRun = midRun;
    check(
      steps,
      'the run is mid-flight with operation 1 staged',
      midRun.busy && midRun.operations[0].status === 'staged',
      JSON.stringify(midRun.operations)
    );

    // AIB-009 F4, the half that has to be said BEFORE the click.
    const stopHint = await evaluate(
      client,
      `(() => ((document.body.innerText || '').match(/Stopping keeps everything built so far[^\\n]*/) || [''])[0])()`
    );
    check(
      steps,
      'AIB-009 F4: the panel says what stopping costs while stopping is still a choice',
      /document/i.test(stopHint) && /skipped/i.test(stopHint),
      stopHint || '(no hint under Stop)'
    );

    // ── AIB-003 criterion 6: the navigation, with candidates in flight ──────
    await clickButtonWithText(client, 'This component', { exact: true });
    await sleep(500);
    await clickButtonWithText(client, 'Project', { exact: true });
    await sleep(500);
    const afterTabs = await evaluate(client, RUN_STATE);
    check(
      steps,
      'AIB-003 §6: switching scope tabs mid-run keeps the plan, the run and the staged candidate',
      Boolean(afterTabs && afterTabs.hasPlan && afterTabs.busy && afterTabs.operations[0].status === 'staged'),
      JSON.stringify(afterTabs && afterTabs.operations)
    );

    await evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('project-docs'); return true; })()`);
    await sleep(600);
    await openBuildPanel(client);
    await sleep(800);
    const afterPanel = await evaluate(client, RUN_STATE);
    const screenAfterPanel = await evaluate(
      client,
      `(() => ((document.body.innerText || '').match(/^Building \\d+ of 3.*$/m) || [''])[0])()`
    );
    check(
      steps,
      'AIB-003 §6: closing the Build panel and reopening it mid-run shows the same run',
      Boolean(afterPanel && afterPanel.busy && afterPanel.operations[0].status === 'staged') &&
        /Building \d+ of 3/.test(screenAfterPanel),
      `${screenAfterPanel} | ${JSON.stringify(afterPanel && afterPanel.operations)}`
    );

    // ── Stop ────────────────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Stop', { exact: true });
    await sleep(300);
    await releaseHold(client, 'Pages/Cart');
    await waitFor(client, `(() => { const s = ${RUN_STATE}; return s && !s.busy; })()`, {
      what: 'the run to stop'
    });
    await sleep(600);

    const stopped = await evaluate(client, RUN_STATE);
    report.stopped = stopped;
    const doc = stopped.operations.find((o) => o.kind === 'doc');
    check(
      steps,
      'AIB-009 F4: a stop keeps the component it built and skips the document, marked as a stop',
      stopped.phase === 'cancelled' &&
        stopped.operations[0].status === 'staged' &&
        doc.status === 'skipped' &&
        doc.skippedByCancel === true,
      JSON.stringify(stopped.operations)
    );

    const offer = await evaluate(
      client,
      `(() => {
         const text = document.body.innerText || '';
         const buttons = Array.from(document.querySelectorAll('button'))
           .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
           .map((b) => (b.innerText || '').trim());
         return {
           sentence: (text.match(/Stopping skipped [^\\n]*/) || [''])[0],
           button: buttons.find((l) => /^Write the documentation/.test(l)) || null,
           buttons
         };
       })()`
    );
    report.offer = offer;
    check(
      steps,
      'AIB-009 F4: the panel offers the way back, and says what it is offering',
      Boolean(offer.button) && /still staged/.test(offer.sentence),
      `${offer.button} — ${offer.sentence}`
    );

    // ── The doc pass, on its own ────────────────────────────────────────────
    await clickButtonWithText(client, 'Write the documentation');
    await releaseHold(client, 'doc');
    await waitFor(client, `(() => { const s = ${RUN_STATE}; return s && !s.busy && s.phase === 'done'; })()`, {
      what: 'the doc pass to finish'
    });
    await sleep(600);

    const afterDocs = await evaluate(client, RUN_STATE);
    report.afterDocs = afterDocs;
    const docAfter = afterDocs.operations.find((o) => o.kind === 'doc');
    check(
      steps,
      'AIB-009 F4: the doc pass runs alone and stages the body — nothing re-authored',
      docAfter.status === 'staged' &&
        afterDocs.operations[0].status === 'staged' &&
        afterDocs.operations[1].status === 'skipped',
      JSON.stringify(afterDocs.operations)
    );
    const turns = await evaluate(client, `(() => window.__aib38stop.turns)()`);
    report.turns = turns;
    check(
      steps,
      'AIB-009 F4: the doc pass costs one turn, not a re-run',
      turns.filter((t) => t === 'Pages/Checkout').length === 1 && turns.filter((t) => t === 'doc').length === 1,
      turns.join(' → ')
    );

    const applyLabel = await evaluate(
      client,
      `(() => (Array.from(document.querySelectorAll('button')).map((b) => (b.innerText || '').trim())
               .find((l) => /^Apply /.test(l)) || null))()`
    );
    report.applyLabel = applyLabel;
    check(
      steps,
      'the document joins what Apply would write',
      /Apply 2 of 3 to project/.test(applyLabel || ''),
      applyLabel || '(no apply button)'
    );
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await evaluate(
      client,
      `(() => {
         const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
         if (window.__aib38stopOriginal) {
           AiClient.chatStream = window.__aib38stopOriginal.chatStream;
           AiClient.isConfigured = window.__aib38stopOriginal.isConfigured;
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
    if (report.turns) console.log(`turns: ${report.turns.join(' → ')}`);
    for (const step of steps) console.log(`${step.ok ? '  ok  ' : ' FAIL '} ${step.name}\n         ${step.detail}`);
    if (report.error) console.log(`\nerror: ${report.error}`);
  }
  process.exit(report.error || failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
