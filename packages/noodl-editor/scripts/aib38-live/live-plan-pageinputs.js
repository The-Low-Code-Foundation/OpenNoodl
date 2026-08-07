#!/usr/bin/env node
/**
 * AIB-001 criterion 6 — Richard's session, replayed against a **real provider**.
 *
 * Every other driver in this directory patches `AiClient` and scripts the
 * replies, which is the right tool for everything about the *panel*: it is
 * deterministic, it costs nothing, and it can hold a turn open on a promise so
 * "navigate away mid-run" is a step rather than a race.
 *
 * It cannot answer this criterion. The defect that opened phase 38 was a model
 * writing `pathParams` as a JSON **array** where `PageInputsAdapter` called
 * `.split(',')` on it — and a fixture that hard-codes the value the fix expects
 * is a test of the fixture. What has to be shown here is that a model, given a
 * request shaped like Richard's, produces something the editor can apply. So
 * nothing is stubbed: this drives the real Build panel with the user's own
 * configured provider, and it spends real money.
 *
 * ## What it asserts
 *
 * 1. A three-page plan comes back, one of whose pages takes a path parameter.
 * 2. It authors without the run collapsing.
 * 3. **Apply succeeds** — the headline. A rollback here is the original defect.
 * 4. The applied project holds a `PageInputs` node whose `pathParams` is the
 *    wire format the runtime consumes (a comma-separated string, not an array),
 *    read out of `ProjectModel` after the apply rather than out of the candidate.
 *
 * (4) is separate from (3) on purpose. AIB-001's gate could reject a bad value
 * and the retry could fix it, and the apply would then be clean while the stored
 * parameter was still wrong — the two failures look identical from the panel.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/aib38-live/live-plan-pageinputs.js [--json]
 *
 * `--project=<dir>` reuses a project instead of copying the corpus. Editor must
 * be up via `npm run dev:debug`.
 *
 * `--from-saved` skips planning and authoring and applies the build AIB-003
 * slice 4 restored from `.nodegx/plan/session.json`. That mode exists because of
 * how this criterion was actually met: the first run authored all four
 * operations against the real provider, and then an edit to a source file
 * hot-swapped `PlanSessionStore` and emptied it — the trap AIB-003's own doc
 * lists, sprung for real rather than on purpose. The staged candidates were on
 * disk, so nothing was lost, and the criterion was then met by reopening the
 * project and applying what came back. That is a stronger demonstration than the
 * one planned: the same model output, through the recovery path, applied clean.
 * Run it with `--project=<the dir the authoring run printed>`.
 *
 * Timeouts are in *minutes*, not seconds: three authored components plus a doc
 * pass against a real model is a ten-minute run on a good day, and the occluded
 * window throttling documented in `scripted-plan.js` applies to the panel's own
 * clock, not to this script's.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PLAN_STORE_MODULE = './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';

/**
 * Richard's app, in the words a user would actually use.
 *
 * The path parameter is asked for explicitly because the criterion is about that
 * node — but it is asked for the way a person asks ("the URL"), not by naming
 * `PageInputs` or `pathParams`. Naming the node would be telling the model the
 * answer to the question being asked.
 */
const REQUEST =
  'Build three pages for a chat app: a Sign Up page with email and password fields and a sign-up button; ' +
  'a Chats page that lists the conversations; and a Chat page that reads a chat id from the URL and shows ' +
  'that conversation. Each row on the Chats page should open the Chat page for its conversation.';

const MINUTE = 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-live'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;

async function waitFor(client, expression, { timeoutMs = 2 * MINUTE, every = 2000, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} after ${Math.round(timeoutMs / MINUTE)}m (last: ${JSON.stringify(last)})`);
}

/** Resolve and click in one eval — a re-render between two CDP calls drops the tag. */
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
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height, label: (el.innerText || '').trim() };
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
    timeoutMs: MINUTE,
    what: 'the project to open'
  });
  return { opened: true, dir };
}

async function fillDescription(client, text) {
  return evaluate(
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
}

/** The run's own state, which is the truth the panel is only a rendering of. */
const RUN_STATE_EXPR = `(() => {
  const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
  const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
  const session = store.get(project && project.id);
  const run = session.run;
  return {
    plan: session.plan ? session.plan.operations.map((o) => ({ id: o.id, kind: o.kind, target: o.target })) : null,
    applied: session.applied || null,
    applyFailure: session.applyFailure || null,
    note: session.note ? session.note.text : null,
    run: run ? {
      phase: run.state.phase,
      busy: run.state.busy,
      costUsd: run.state.costUsd,
      operations: run.state.operations.map((o) => ({ target: o.operation.target, status: o.status, error: o.error }))
    } : null
  };
})()`;

async function runState(client) {
  return evaluate(client, RUN_STATE_EXPR);
}

/**
 * Every `PageInputs` node in the applied project, read out of `ProjectModel`.
 *
 * The candidate is not consulted: what matters is the value that survived
 * staging, the adapters, and the parameter write — which is where the original
 * `.split` lived.
 */
async function pageInputNodes(client) {
  return evaluate(
    client,
    `(() => {
       const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
       if (!project) return null;
       const found = [];
       for (const component of project.getComponents()) {
         // Two things bit here, and both make the probe report an empty project
         // against a project that has three of these. forEachNode walks the
         // ROOTS only — a node authored under a Group is invisible to it. And in
         // the live model node.type is the resolved node-type OBJECT; it is only
         // a string in project.json, which is where the name PageInputs was read
         // from in the first place. (No backticks in here: this whole function
         // body is a template literal, and one closes it.)
         component.forEachNodeRecursive((node) => {
           const typeName = node.type && (node.type.name || node.type);
           if (typeName !== 'PageInputs') return;
           found.push({
             component: component.name,
             pathParams: node.parameters.pathParams === undefined ? null : node.parameters.pathParams,
             pathParamsType: Object.prototype.toString.call(node.parameters.pathParams),
             queryParams: node.parameters.queryParams === undefined ? null : node.parameters.queryParams,
             ports: node.getPorts ? node.getPorts('output').map((p) => p.name) : []
           });
         });
       }
       return found;
     })()`
  );
}

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

  const projectDir = args.project
    ? path.resolve(String(args.project))
    : (() => {
        const dest = path.join(os.tmpdir(), `aib001-live-${Date.now()}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })();

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { projectDir, request: REQUEST, steps };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');
    report.project = await openProject(client, projectDir);

    await evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
    await sleep(800);
    await clickButtonWithText(client, 'Project', { exact: true });
    await sleep(400);

    if (args['from-saved']) {
      // ── Restored, not authored ────────────────────────────────────────────
      report.authored = await waitFor(
        client,
        `(() => { const s = ${RUN_STATE_EXPR}; return s.plan && s.run ? s : null; })()`,
        { timeoutMs: MINUTE, what: 'the saved build to be restored into the panel' }
      );
      check(
        steps,
        'exit §7: the build survives the editor closing — plan and staged candidates both back',
        report.authored.run.operations.every((o) => o.status === 'staged'),
        report.authored.run.operations.map((o) => `${o.target}:${o.status}`).join(' | ')
      );
      check(
        steps,
        'exit §7: the panel says what it restored',
        /Restored the build you left unapplied/.test(report.authored.note || ''),
        report.authored.note
      );
      report.costUsd = report.authored.run.costUsd;
    } else {
      // ── Plan ──────────────────────────────────────────────────────────────
      if (!(await fillDescription(client, REQUEST))) throw new Error('no description field in the Build panel');
      await sleep(200);
      await clickButtonWithText(client, 'Plan it');

      const planned = await waitFor(
        client,
        `(() => {
           const m = (document.body.innerText || '').match(/Author plan \\((\\d+)\\)/);
           return m ? Number(m[1]) : null;
         })()`,
        { timeoutMs: 4 * MINUTE, what: 'the model to return a plan' }
      );
      report.planned = await runState(client);
      check(
        steps,
        'AIB-001 §6: the model plans three pages from the request',
        (report.planned.plan || []).filter((o) => o.kind !== 'doc').length >= 3,
        (report.planned.plan || []).map((o) => `${o.kind} ${o.target}`).join(' | ')
      );

      // ── Author ────────────────────────────────────────────────────────────
      await clickButtonWithText(client, `Author plan (${planned})`);
      await waitFor(
        client,
        `(() => {
           const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
           const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
           const run = store.get(project && project.id).run;
           return run && !run.state.busy ? run.state.phase : null;
         })()`,
        { timeoutMs: 25 * MINUTE, what: 'the plan to finish authoring' }
      );
      report.authored = await runState(client);
      check(
        steps,
        'AIB-001 §6: every component operation stages — the gate passed real model output',
        report.authored.run.operations.filter((o) => o.status === 'failed').length === 0,
        report.authored.run.operations.map((o) => `${o.target}:${o.status}${o.error ? ` (${o.error})` : ''}`).join(' | ')
      );
      report.costUsd = report.authored.run.costUsd;
    }

    // ── Apply — the criterion ───────────────────────────────────────────────
    await clickButtonWithText(client, 'Apply');
    // The confirmation dialog, when there is one. Not fatal if the build does
    // not ask: what is being measured is the outcome, not the number of clicks.
    await sleep(1200);
    await clickButtonWithText(client, 'Apply to project').catch(() => undefined);

    const outcome = await waitFor(
      client,
      `(() => {
         const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         const session = store.get(project && project.id);
         if (session.applied) return { applied: true };
         if (session.applyFailure) return { applied: false, failure: session.applyFailure };
         return null;
       })()`,
      { timeoutMs: 5 * MINUTE, what: 'the apply to land' }
    );
    report.outcome = outcome;
    report.afterApply = await runState(client);

    check(
      steps,
      'AIB-001 §6: the plan applies clean — no rollback, no ".split is not a function"',
      outcome.applied === true,
      outcome.applied ? `${report.afterApply.applied.count} components` : JSON.stringify(outcome.failure)
    );

    // ── The stored parameter, not the candidate ─────────────────────────────
    const pageInputs = await pageInputNodes(client);
    report.pageInputs = pageInputs;
    check(
      steps,
      'AIB-001 §6: the plan authored a Page Inputs node',
      Array.isArray(pageInputs) && pageInputs.length > 0,
      JSON.stringify(pageInputs)
    );
    const withPath = (pageInputs || []).filter((n) => n.pathParams !== null && n.pathParams !== '');
    check(
      steps,
      'AIB-001 §6: pathParams is stored as a comma-separated string, not an array',
      withPath.length > 0 && withPath.every((n) => n.pathParamsType === '[object String]'),
      JSON.stringify(withPath)
    );
    check(
      steps,
      'AIB-001 §6: the node exposes an output port per path parameter',
      withPath.length > 0 && withPath.every((n) => n.ports.length > 0),
      JSON.stringify(withPath.map((n) => ({ params: n.pathParams, ports: n.ports })))
    );
  } catch (error) {
    report.error = error.message;
    report.stateAtFailure = await runState(client).catch(() => null);
  } finally {
    client.close();
  }

  report.ok = steps.length > 0 && steps.every((s) => s.ok) && !report.error;
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`project: ${report.projectDir}`);
    if (report.costUsd != null) console.log(`cost:    $${report.costUsd}`);
    for (const step of steps) {
      console.log(`${step.ok ? 'PASS' : 'FAIL'}  ${step.name}`);
      if (!step.ok) console.log(`      ${step.detail}`);
    }
    if (report.error) console.log(`ERROR ${report.error}`);
    console.log(report.ok ? '\nAIB-001 criterion 6: PASS' : '\nAIB-001 criterion 6: FAIL');
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
