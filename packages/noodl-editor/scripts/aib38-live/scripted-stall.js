#!/usr/bin/env node
/**
 * AIB-009 F11 live — a provider that accepts the request and never answers.
 *
 * The unit specs pin the deadline; this pins the **screen**, which is where the
 * finding came from. During AIB-002's live QA the panel read
 * `Writing — 3 nodes so far` and nothing else, indefinitely, and there was no
 * way from inside the editor to tell a slow model from a dead one. What has to
 * be true now is that the run *ends*, that it says why, and that the operation
 * offers the retry AIB-009 F1 built.
 *
 * Deliberately slow. `TURN_STALL_MS` is three minutes and the panel does not
 * expose an override — a shorter one would be testing a different constant than
 * the one that ships. Expect this to take four to five minutes, and note that an
 * occluded editor window throttles the deadline's own timer, so it fires late
 * rather than early.
 *
 * Usage (editor must be running via `npm run dev:debug`):
 *
 *   node packages/noodl-editor/scripts/aib38-live/scripted-stall.js --copy-corpus
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-stall'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;
const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;
const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';
const PLAN_STORE_MODULE = './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 60000, every = 2000, what = 'condition' } = {}) {
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

const RUN_STATE = `(() => {
  const store = ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance;
  const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
  const run = store.get(project && project.id).run;
  if (!run) return null;
  const s = run.state;
  return {
    phase: s.phase, busy: s.busy,
    operations: s.operations.map((o) => ({ target: o.operation.target, status: o.status, error: o.error }))
  };
})()`;

function installScript() {
  return `(() => {
    const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };
    if (!window.__aib38stallOriginal) {
      window.__aib38stallOriginal = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }
    window.__aib38stall = { turns: [] };
    const usage = { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request) => {
      const tools = (request.tools || []).map((t) => t.name);
      if (tools.includes('submit_plan')) {
        window.__aib38stall.turns.push('plan');
        return {
          text: '',
          toolCalls: [{ id: 'stall-plan', name: 'submit_plan', arguments: { operations: [
            { kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page.' }
          ] } }],
          usage, model: 'scripted-replay', stopReason: 'tool_calls'
        };
      }
      // The whole point: the request is accepted and nothing ever comes back.
      // No abort listener either — a provider that has stopped answering does
      // not honour one.
      window.__aib38stall.turns.push('accepted-and-silent');
      return new Promise(() => undefined);
    };
    return { ok: true };
  })()`;
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
  const projectDir = args['copy-corpus']
    ? (() => {
        const dest = path.join(os.tmpdir(), `aib38-stall-${process.pid}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })()
    : null;

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { steps, projectDir };
  const startedAt = Date.now();

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');

    const already = await evaluate(
      client,
      `(() => { const p = ${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
                return p ? (p._retainedProjectDirectory || '') : ''; })()`
    );
    if (!already && projectDir) {
      await evaluate(
        client,
        `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(projectDir)}; return true; })()`
      );
      await clickButtonWithText(client, 'Open project');
      await waitFor(client, `(() => !!(${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance))()`, {
        every: 500, what: 'the project to open'
      });
    }

    const installed = await evaluate(client, installScript());
    if (!installed.ok) throw new Error(installed.error);

    await evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
    await sleep(800);
    await evaluate(
      client,
      `(() => { ${REQ(PLAN_STORE_MODULE)}.PlanSessionStore.instance.discard(${REQ(PROJECT_MODULE)}.ProjectModel.instance.id); return true; })()`
    );
    await sleep(400);
    await clickButtonWithText(client, 'Project', { exact: true });
    await sleep(300);
    await evaluate(
      client,
      `(() => {
         const area = document.querySelector('textarea');
         if (!area) return false;
         const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
         setter.call(area, 'Add a checkout page.');
         area.dispatchEvent(new Event('input', { bubbles: true }));
         return true;
       })()`
    );
    await sleep(200);
    await clickButtonWithText(client, 'Plan it');
    await waitFor(client, `(() => /Author plan \\(1\\)/.test(document.body.innerText || ''))()`, {
      every: 500, what: 'the plan to arrive'
    });
    await clickButtonWithText(client, 'Author plan (1)');

    // The deadline is three minutes of silence; a throttled timer makes it late,
    // never early, so this waits well past it.
    const finished = await waitFor(client, `(() => { const s = ${RUN_STATE}; return s && !s.busy ? s : null; })()`, {
      timeoutMs: 420000,
      every: 5000,
      what: 'the stalled turn to end on its own'
    });
    report.elapsedMs = Date.now() - startedAt;
    report.finished = finished;

    const op = finished.operations[0];
    check(
      steps,
      'AIB-009 F11: a turn that never returns ends the operation instead of hanging the run',
      finished.busy === false && op.status === 'failed',
      `${finished.phase} / ${op.status} after ${Math.round(report.elapsedMs / 1000)}s`
    );
    check(
      steps,
      'AIB-009 F11: the failure says the provider stopped answering, not that the user cancelled',
      /stopped responding/.test(op.error || '') && !/cancel/i.test(op.error || ''),
      op.error || '(no error recorded)'
    );

    const screen = await evaluate(
      client,
      `(() => {
         const text = document.body.innerText || '';
         return {
           says: (text.match(/stopped responding[^\\n]*/) || [''])[0],
           retry: Array.from(document.querySelectorAll('button'))
             .map((b) => (b.innerText || '').trim())
             .find((l) => /^Retry/.test(l)) || null
         };
       })()`
    );
    report.screen = screen;
    check(
      steps,
      'AIB-009 F11: the panel shows the reason and offers to re-author that operation',
      Boolean(screen.says) && Boolean(screen.retry),
      `${screen.retry} — ${screen.says}`
    );
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await evaluate(
      client,
      `(() => {
         const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
         if (window.__aib38stallOriginal) {
           AiClient.chatStream = window.__aib38stallOriginal.chatStream;
           AiClient.isConfigured = window.__aib38stallOriginal.isConfigured;
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
    for (const step of steps) console.log(`${step.ok ? '  ok  ' : ' FAIL '} ${step.name}\n         ${step.detail}`);
    if (report.error) console.log(`\nerror: ${report.error}`);
  }
  process.exit(report.error || failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
