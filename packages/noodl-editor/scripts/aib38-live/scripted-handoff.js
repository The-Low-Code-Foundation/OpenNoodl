#!/usr/bin/env node
/**
 * AIB-005 live check — the launcher → editor handoff, without a provider.
 *
 * Criterion 6 is "wizard → editor, without touching the sidebar, and the plan is
 * discoverable". Running the actual wizard means a real scoping conversation and
 * real money, and it would prove the *conversation* works rather than the
 * *handoff*. So this drives the seam the wizard hands to, and nothing else:
 * `setPendingScopePlan` is exactly what the wizard's own confirm path calls.
 *
 * The one thing that has to be real is the mount. `peekPendingScopePlan` is read
 * in `EditorPage`'s mount effect, so the project has to be opened *after* the
 * plan is set — which is why this opens the project once to learn its id (ids
 * are assigned by `LocalProjectsModel` on first open, not stored in
 * project.json), returns to the launcher, sets the plan against that id, and
 * opens it again.
 *
 * Usage (editor must be running via `npm run dev:debug`, at the launcher):
 *
 *   node packages/noodl-editor/scripts/aib38-live/scripted-handoff.js --copy-corpus
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-handoff'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;
const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';
const PENDING_MODULE = './src/editor/src/models/AiAssistant/scoping/pendingPlan.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';

const PLAN = {
  request: 'A chat app with signup, a chat list and chat pages.',
  operations: [
    { id: 'op-1', kind: 'create', target: 'Pages/Signup', intent: 'Sign up and sign in.' },
    { id: 'op-2', kind: 'create', target: 'Pages/Chats', intent: 'The list of chats.' },
    { id: 'op-3', kind: 'create', target: 'Pages/Chat', intent: 'One conversation.' }
  ]
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 60000, every = 400, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

async function clickButtonWithText(client, text) {
  const box = await evaluate(
    client,
    `(() => {
       const want = ${JSON.stringify(text)}.toLowerCase();
       const el = Array.from(document.querySelectorAll('button, [role=button]'))
         .find((b) => (b.innerText || '').trim().toLowerCase().startsWith(want));
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
     })()`
  );
  if (!box || !box.width) throw new Error(`no clickable button reading "${text}"`);
  await dispatchClick(client, box);
}

async function openProject(client, dir) {
  await evaluate(
    client,
    `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(dir)}; return true; })()`
  );
  await clickButtonWithText(client, 'Open project');
  return waitFor(
    client,
    `(() => { const p = ${REQ(PROJECT_MODULE)}.ProjectModel.instance; return p ? (p.id || 'no-id') : null; })()`,
    { what: 'the project to open' }
  );
}

/** The real exit control. `App.instance.exitProject()` from an eval blanks the editor. */
async function backToProjects(client) {
  const box = await evaluate(
    client,
    `(() => {
       const el = document.querySelector('[class*=BrandExit]');
       if (!el) return null;
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
     })()`
  );
  if (!box) throw new Error('no BrandExit control');
  await dispatchClick(client, box);
  await waitFor(client, `(() => !${REQ(PROJECT_MODULE)}.ProjectModel.instance)()`, { what: 'the launcher' });
}

async function main() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  const dir = args['copy-corpus']
    ? (() => {
        const dest = path.join(os.tmpdir(), `aib38-handoff-${process.pid}`);
        fs.cpSync(CORPUS_PROJECT_DIR, dest, { recursive: true });
        fs.rmSync(path.join(dest, '.git'), { recursive: true, force: true });
        return dest;
      })()
    : path.resolve(String(args.project));

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const check = (name, ok, detail) => steps.push({ name, ok: Boolean(ok), detail });

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require');

    // First open: learn the id LocalProjectsModel assigns. Nothing is asserted here.
    const projectId = await openProject(client, dir);
    await backToProjects(client);

    // Criterion 4/5 first, while no plan is pending: none of this must appear.
    await evaluate(client, `(() => { ${REQ(PENDING_MODULE)}.setPendingScopePlan(null); return true; })()`);
    await openProject(client, dir);
    await sleep(2500);
    const quiet = await evaluate(
      client,
      `(() => {
         const t = document.body.innerText || '';
         return {
           strip: /Your plan is ready/.test(t),
           panel: ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.getCurrent()?.id
         };
       })()`
    );
    check('AIB-005 §4: a project with no pending plan shows none of this', !quiet.strip, JSON.stringify(quiet));
    const quietPanel = quiet.panel;
    await backToProjects(client);

    // Criterion 5: a plan for a DIFFERENT project must not announce, and must
    // not be consumed by that project being opened.
    await evaluate(
      client,
      `(() => {
         ${REQ(PENDING_MODULE)}.setPendingScopePlan({
           projectId: 'some-other-project', plan: ${JSON.stringify(PLAN)}, recordPath: 'docs/decisions/000-initial-scope.md'
         });
         return true;
       })()`
    );
    await openProject(client, dir);
    await sleep(2500);
    const foreign = await evaluate(
      client,
      `(() => ({
         strip: /Your plan is ready/.test(document.body.innerText || ''),
         survived: !!${REQ(PENDING_MODULE)}.peekPendingScopePlan('some-other-project')
       }))()`
    );
    check(
      'AIB-005 §5: another project’s plan neither announces nor is consumed',
      !foreign.strip && foreign.survived,
      JSON.stringify(foreign)
    );
    await backToProjects(client);

    // Criteria 1–3: the real thing.
    await evaluate(
      client,
      `(() => {
         ${REQ(PENDING_MODULE)}.setPendingScopePlan({
           projectId: ${JSON.stringify(projectId)}, plan: ${JSON.stringify(PLAN)},
           recordPath: 'docs/decisions/000-initial-scope.md'
         });
         return true;
       })()`
    );
    await openProject(client, dir);
    await sleep(3000);

    const arrived = await evaluate(
      client,
      `(() => {
         const t = document.body.innerText || '';
         return {
           panel: ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.getCurrent()?.id,
           strip: (t.match(/Your plan is ready — \\d+ operations? to build\\./) || [''])[0],
           planRows: /Pages\\/Signup/.test(t) && /Pages\\/Chats/.test(t) && /Pages\\/Chat\\b/.test(t),
           authorButton: (t.match(/Author plan \\(3\\)/) || [''])[0],
           builtAnything: /built ·|Building \\d+ of/.test(t)
         };
       })()`
    );
    check(
      'AIB-005 §1: the editor opens on the Build panel with the plan visible and nothing built',
      arrived.panel === 'ai-authoring' && arrived.planRows && arrived.authorButton === 'Author plan (3)' && !arrived.builtAnything,
      `${JSON.stringify(arrived)} (a project with no plan opened on "${quietPanel}")`
    );
    check('AIB-005 §2: a canvas-level announcement names the plan and its size', Boolean(arrived.strip), arrived.strip);

    // Criterion 3: dismissing it keeps the plan.
    await clickButtonWithText(client, 'Not now');
    await sleep(800);
    const dismissed = await evaluate(
      client,
      `(() => {
         const t = document.body.innerText || '';
         const store = ${REQ('./src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts')}.PlanSessionStore.instance;
         const session = store.get(${REQ(PROJECT_MODULE)}.ProjectModel.instance.id);
         return { strip: /Your plan is ready/.test(t), operations: session.plan ? session.plan.operations.length : 0 };
       })()`
    );
    check(
      'AIB-005 §3: dismissing the announcement does not discard the plan',
      !dismissed.strip && dismissed.operations === 3,
      JSON.stringify(dismissed)
    );
  } catch (error) {
    steps.push({ name: 'run', ok: false, detail: error instanceof Error ? error.message : String(error) });
  } finally {
    await evaluate(client, `(() => { ${REQ(PENDING_MODULE)}.setPendingScopePlan(null); return true; })()`).catch(
      () => undefined
    );
    client.close?.();
  }

  for (const s of steps) console.log(`${s.ok ? '  ok  ' : ' FAIL '} ${s.name}\n         ${s.detail}`);
  process.exit(steps.some((s) => !s.ok) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
