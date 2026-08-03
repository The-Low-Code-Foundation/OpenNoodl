#!/usr/bin/env node
/**
 * AIB-003 slice 4 / phase 38 exit criterion 7 — **quit mid-build and come back.**
 *
 * > *Quit the editor and reopen the project. The plan and its authored output
 * > are still recoverable.*
 *
 * This is the one exit criterion no in-process driver can check, because the
 * thing under test is the process ending. It runs in two phases with an editor
 * kill between them:
 *
 *   node …/scripted-restart.js --stage    # author until op 1 stages, op 2 is in flight
 *   npm run dev:stop && npm run dev:debug # the restart
 *   node …/scripted-restart.js --verify   # reopen the project, read the panel
 *
 * `--project=<dir>` is required for `--verify`; `--stage` prints the directory
 * it created.
 *
 * ## Why the second operation is left in flight
 *
 * A restart with everything already staged proves the easy half. The interesting
 * state is the one a crash actually produces: one operation staged, one
 * mid-authoring, one never reached — and slice 4's whole claim is that this comes
 * back as the state a *Stop* leaves, so the staged candidate survives, the
 * interrupted one is retryable, and the unreached doc is writable. The turn is
 * held on a promise this script never resolves, so "the editor died while
 * authoring" is a step rather than a race (the same reason `scripted-stop.js`
 * gives, and the same reason it does not use timers: an occluded window throttles
 * `setTimeout` to about one wake a minute).
 *
 * ## Why the provider is scripted here and real elsewhere
 *
 * `live-plan-pageinputs.js` uses the real provider because its question is *what
 * a model writes*. This one's question is *what the editor keeps*, and a real
 * turn cannot be held open at a chosen instant. Nothing about persistence
 * depends on where the candidate came from — it is `ComponentFiles` either way.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PLAN_STORE_MODULE = './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';

const PLAN_REQUEST = 'Add a checkout flow: a checkout page and a cart page, and record the decision.';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-restart'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;

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

async function clickButtonWithText(client, text, { exact = false } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const want = ${JSON.stringify(text)}.toLowerCase();
       const buttons = Array.from(document.querySelectorAll('button, [role=button]'))
         .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || (${exact ? 'null' : 'buttons.find((b) => (b.innerText || "").trim().toLowerCase().startsWith(want))'});
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: (el.innerText || '').trim() };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  await dispatchClick(client, box);
  return box.label;
}

async function openProject(client, dir) {
  const already = await evaluate(
    client,
    `(() => { const p = ${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
              return p ? (p._retainedProjectDirectory || '') : ''; })()`
  );
  if (already && path.resolve(already) === path.resolve(dir)) return { opened: false, dir: already };
  if (already) throw new Error(`a different project is already open (${already}) — close it first`);

  await evaluate(
    client,
    `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(dir)}; return true; })()`
  );
  await clickButtonWithText(client, 'Open project');
  await waitFor(client, `(() => !!(${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance))()`, {
    what: 'the project to open'
  });
  return { opened: true, dir };
}

function installScript() {
  return `(() => {
    const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };
    const state = { turns: [], held: null, release: null };
    window.__aib38restart = state;

    const PLAN = ${JSON.stringify({ operations: PLAN_OPERATIONS })};
    const SUBMISSIONS = ${JSON.stringify(SUBMISSIONS)};
    const usage = { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 };
    const reply = (name, args) => ({
      text: '', toolCalls: [{ id: 'aib38restart-' + state.turns.length, name, arguments: args }],
      usage, model: 'scripted-replay', stopReason: 'tool_calls'
    });
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
        // Operation 1 returns immediately so it reaches 'staged'; operation 2
        // hangs here forever, which is the state the kill has to interrupt.
        if (target === 'Pages/Checkout') {
          const response = reply('submit_component', SUBMISSIONS[target]);
          callbacks.onToolCall?.(response.toolCalls[0]);
          callbacks.onEnd?.();
          return response;
        }
        await hold(target || 'unknown-component');
        return reply('submit_component', SUBMISSIONS[target] || { nodes: [] });
      }
      if (tools.includes('submit_doc')) {
        state.turns.push('doc');
        await hold('doc');
        return reply('submit_doc', { content: '# Architecture\\n', summary: 'Recorded' });
      }
      state.turns.push('declined:' + tools.join(','));
      return { text: 'Nothing to do.', toolCalls: [], usage, model: 'scripted-replay', stopReason: 'stop' };
    };
    return { ok: true };
  })()`;
}

/** The session as the store holds it — the truth the panel only renders. */
const SESSION_STATE = `(() => {
  const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
  const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
  const session = store.get(project && project.id);
  const run = session.run;
  return {
    projectId: project && project.id,
    directory: project && project._retainedProjectDirectory,
    description: session.description,
    plan: session.plan ? session.plan.operations.map((o) => ({ id: o.id, kind: o.kind, target: o.target })) : null,
    note: session.note ? session.note.text : null,
    origin: session.origin,
    announcementDismissed: session.announcementDismissed,
    run: run ? {
      phase: run.state.phase,
      busy: run.state.busy,
      costUsd: run.state.costUsd,
      operations: run.state.operations.map((o) => ({
        target: o.operation.target,
        kind: o.operation.kind,
        status: o.status,
        error: o.error,
        skippedByCancel: o.skippedByCancel,
        staged: o.staged
      })),
      // Read through the public accessor, so this asserts what the review UI
      // would actually get rather than what a private Map happens to hold.
      files: run.state.operations
        .map((o) => o.operation.id)
        .filter((id) => Boolean(run.filesFor(id)))
        .map((id) => ({ id, nodes: run.filesFor(id).nodes.nodes.length }))
    } : null
  };
})()`;

async function buttonLabels(client) {
  return evaluate(
    client,
    `(() => Array.from(document.querySelectorAll('button, [role=button]'))
        .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .map((b) => (b.innerText || '').trim()).filter(Boolean))()`
  );
}

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

function sidecarPath(dir) {
  return path.join(dir, '.nodegx', 'plan', 'session.json');
}

/* -------------------------------------------------------------------------- */
/* Phase 1 — author until one is staged and one is in flight, then stop        */
/* -------------------------------------------------------------------------- */

async function stage(client, args, report) {
  const projectDir = args.project
    ? path.resolve(String(args.project))
    : (() => {
        const dest = path.join(os.tmpdir(), `aib003-restart-${Date.now()}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })();
  report.projectDir = projectDir;

  report.project = await openProject(client, projectDir);
  const installed = await evaluate(client, installScript());
  if (!installed.ok) throw new Error(installed.error);

  await evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
  await sleep(800);
  await clickButtonWithText(client, 'Project', { exact: true });
  await sleep(400);
  await evaluate(
    client,
    `(() => { const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
              const p = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
              store.discard(p && p.id); return true; })()`
  );
  await sleep(400);

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
  await clickButtonWithText(client, 'Plan it');
  await waitFor(client, `(() => /Author plan \\(3\\)/.test(document.body.innerText || ''))()`, {
    what: 'the plan to arrive'
  });
  await clickButtonWithText(client, 'Author plan (3)');

  // Operation 1 stages on its own; operation 2 blocks in `hold` and stays there.
  await waitFor(client, `(() => Boolean(window.__aib38restart && window.__aib38restart.held === 'Pages/Cart'))()`, {
    timeoutMs: 90000,
    what: 'operation 2 to be in flight with operation 1 staged'
  });
  const before = await evaluate(client, SESSION_STATE);
  report.before = before;

  check(
    steps(report),
    'setup: operation 1 staged and operation 2 authoring at the moment of the kill',
    before.run &&
      before.run.operations[0].status === 'staged' &&
      before.run.operations[1].status === 'authoring' &&
      before.run.files.length === 1,
    JSON.stringify(before.run && before.run.operations.map((o) => `${o.target}:${o.status}`))
  );

  // The sidecar is debounced (750ms) and queued; give the last publish a beat to
  // land, then read the file from *outside* the editor — the point of the whole
  // slice is that this exists without the process.
  await sleep(2500);
  const file = sidecarPath(projectDir);
  const exists = fs.existsSync(file);
  report.sidecar = exists ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  check(steps(report), 'AIB-003 §4: the build is on disk before the editor dies', exists, file);
  if (exists) {
    check(
      steps(report),
      'AIB-003 §4: the file carries the staged candidate, not just the plan',
      Object.keys(report.sidecar.run.files).length === 1 &&
        report.sidecar.run.operations.some((o) => o.status === 'staged'),
      `files=${Object.keys(report.sidecar.run.files).join(',')} statuses=${report.sidecar.run.operations
        .map((o) => o.status)
        .join(',')}`
    );
    const gitignore = path.join(projectDir, '.gitignore');
    check(
      steps(report),
      'AIB-003 §4: .nodegx/ is gitignored, so the scratch cannot be committed',
      fs.existsSync(gitignore) && /^\.nodegx\/?$/m.test(fs.readFileSync(gitignore, 'utf8')),
      fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8').trim() : 'no .gitignore'
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 2 — a fresh editor, the same project                                 */
/* -------------------------------------------------------------------------- */

async function verify(client, args, report) {
  const projectDir = path.resolve(String(args.project || ''));
  if (!projectDir || !fs.existsSync(projectDir)) throw new Error('--verify needs --project=<dir> from the --stage run');
  report.projectDir = projectDir;

  report.project = await openProject(client, projectDir);
  await evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
  await sleep(800);
  await clickButtonWithText(client, 'Project', { exact: true });

  // Nothing is patched this time: the restore must happen against the editor's
  // own code, with no AI client involved at all.
  const after = await waitFor(client, `(() => { const s = ${SESSION_STATE}; return s.plan ? s : null; })()`, {
    timeoutMs: 30000,
    what: 'the saved build to be restored into the panel'
  });
  report.after = after;

  check(
    steps(report),
    'exit §7: the plan is back after a restart, unprompted',
    after.plan && after.plan.length === 3,
    JSON.stringify(after.plan && after.plan.map((o) => o.target))
  );
  check(
    steps(report),
    'exit §7: the staged candidate survived the process — its nodes are still there',
    after.run && after.run.files.length === 1 && after.run.files[0].nodes === 2,
    JSON.stringify(after.run && after.run.files)
  );
  check(
    steps(report),
    'AIB-003 §4: the operation that was in flight comes back retryable, not "authoring"',
    after.run &&
      after.run.operations[1].status === 'failed' &&
      /editor closed/i.test(after.run.operations[1].error || ''),
    JSON.stringify(after.run && after.run.operations.map((o) => `${o.target}:${o.status}`))
  );
  check(
    steps(report),
    'AIB-003 §4: the unreached doc comes back as a stopped one, so the doc pass is offered',
    after.run && after.run.operations[2].status === 'skipped' && after.run.operations[2].skippedByCancel === true,
    JSON.stringify(after.run && after.run.operations[2])
  );
  check(
    steps(report),
    'AIB-003 §4: the run is not busy — nothing is authoring against a dead session',
    after.run && after.run.busy === false && after.run.phase === 'cancelled',
    JSON.stringify(after.run && { busy: after.run.busy, phase: after.run.phase })
  );
  check(
    steps(report),
    'AIB-003 §4: the panel says what came back, and when',
    typeof after.note === 'string' && /Restored the build you left unapplied/.test(after.note),
    after.note
  );

  const labels = await buttonLabels(client);
  report.labels = labels;
  check(
    steps(report),
    'AIB-003 §4: a Retry is on screen for the interrupted operation',
    labels.some((l) => /^Retry/i.test(l)),
    labels.join(' | ')
  );
  check(
    steps(report),
    'AIB-003 §4: Apply is offered — the recovered build is applicable, not just readable',
    labels.some((l) => /^Apply/i.test(l)),
    labels.join(' | ')
  );

  // The other half of the rule: the user saying so IS allowed to destroy it.
  await clickButtonWithText(client, 'Abandon').catch(() => undefined);
  await sleep(1500);
  check(
    steps(report),
    'AIB-003 §4: Abandon deletes the file — the user can still throw it away',
    !fs.existsSync(sidecarPath(projectDir)),
    sidecarPath(projectDir)
  );
}

function steps(report) {
  return report.steps;
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  if (!args.stage && !args.verify) throw new Error('pass --stage or --verify');

  const client = await connect(await appTarget('editor'));
  const report = { phase: args.stage ? 'stage' : 'verify', steps: [] };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');
    if (args.stage) await stage(client, args, report);
    else await verify(client, args, report);
  } catch (error) {
    report.error = error.message;
  } finally {
    client.close();
  }

  report.ok = report.steps.length > 0 && report.steps.every((s) => s.ok) && !report.error;
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`project: ${report.projectDir}`);
    for (const step of report.steps) {
      console.log(`${step.ok ? 'PASS' : 'FAIL'}  ${step.name}`);
      if (!step.ok) console.log(`      ${step.detail}`);
    }
    if (report.error) console.log(`ERROR ${report.error}`);
  }
  // `--stage` deliberately leaves the editor with a turn held open: the next
  // step is a kill, not a clean exit.
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
