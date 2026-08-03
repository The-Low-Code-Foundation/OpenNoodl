#!/usr/bin/env node
/**
 * AIB-008 criteria 3 and 7 — the flow Richard asked for, end to end, in one panel.
 *
 * > *7. Live: init a local project, commit, connect a remote, push — all from
 * > the one panel.*
 * > *3. Ahead/behind is visible without changing section.*
 *
 * These two were the only things AIB-008 left owed, and they were owed for the
 * same reason: the ahead/behind figure is `0 · 0` until there is a remote to be
 * ahead of, and getting a remote means a real GitHub account. Everything else
 * about the merge — one panel, the rail entry gone, the connect view inside the
 * section that shows the history — was checked when the task shipped.
 *
 * ## This creates a repository on a real account
 *
 * There is no way to check "connect a remote and push" without one. The repo is
 * **private**, named `nodegx-aib008-livecheck-<timestamp>` so it is obviously
 * disposable, and this script prints the URL at the end so it can be deleted.
 * `--repo=<name>` overrides the name; `--keep-local` leaves the scratch project
 * on disk.
 *
 * ## What it does not do
 *
 * It does not test the OAuth flow. If the editor has no GitHub token this stops
 * with "Connect GitHub Account" on screen and says so, rather than driving a
 * browser sign-in — that is a human's credential to hand over, not a driver's.
 *
 * Usage (editor up via `npm run dev:debug`):
 *
 *   node packages/noodl-editor/scripts/aib38-live/live-github-connect.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-gh'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;

async function waitFor(client, expression, { timeoutMs = 60000, every = 500, what = 'condition' } = {}) {
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

/** The panel's own text, which is what criterion 3 is actually about. */
async function panelText(client) {
  return evaluate(
    client,
    `(() => {
       const panel = document.querySelector('[class*=BasePanel], [class*=SidePanel]');
       return (panel ? panel.innerText : document.body.innerText) || '';
     })()`
  );
}

async function setInputValue(client, selector, value) {
  return evaluate(
    client,
    `(() => {
       const el = document.querySelector(${JSON.stringify(selector)});
       if (!el) return false;
       const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement;
       const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
       setter.call(el, ${JSON.stringify(value)});
       el.dispatchEvent(new Event('input', { bubbles: true }));
       return true;
     })()`
  );
}

async function openProject(client, dir) {
  const already = await evaluate(
    client,
    `(() => { const p = ${REQ(PROJECT_MODULE)}.ProjectModel && ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
              return p ? (p._retainedProjectDirectory || '') : ''; })()`
  );
  if (already && path.resolve(already) === path.resolve(dir)) return { opened: false, dir: already };
  if (already) throw new Error(`a different project is already open (${already}) — restart the editor`);

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

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
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

  const repoName = String(args.repo || `nodegx-aib008-livecheck-${Date.now()}`);
  const projectDir = path.join(os.tmpdir(), `aib008-live-${Date.now()}`);
  fs.cpSync(CORPUS_PROJECT_DIR, projectDir, { recursive: true });
  // Criterion 7 starts from "a local project" — no git at all.
  fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { projectDir, repoName, steps };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');
    report.project = await openProject(client, projectDir);

    await evaluate(client, `(() => { ${REQ(SIDEBAR_MODULE)}.SidebarModel.instance.switch('versioncontrol'); return true; })()`);
    await sleep(1200);

    // ── The honest empty state (criterion 5, re-checked as the starting point) ─
    const empty = await panelText(client);
    check(
      steps,
      'AIB-008 §5: a project with no git says so, with one action',
      /missing a git setup/i.test(empty) && /Initialize Version Control/i.test(empty),
      empty.slice(0, 160)
    );

    // ── Init ────────────────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Initialize Version Control (git)');
    await waitFor(client, `(() => /Local Changes|No remote/i.test(${'((document.body.innerText)||"")'}))()`, {
      timeoutMs: 60000,
      what: 'the panel to come up on the initialised repo'
    });
    check(steps, 'AIB-008 §7: git is initialised from the panel', fs.existsSync(path.join(projectDir, '.git')), projectDir);
    report.initialCommit = git(projectDir, 'log', '--oneline', '-1');

    const beforeRemote = await panelText(client);
    check(
      steps,
      'AIB-008 §7: the Repository section is on screen and says there is no remote',
      /No remote/i.test(beforeRemote),
      beforeRemote.split('\n').slice(0, 6).join(' | ')
    );
    check(
      steps,
      'AIB-008 §4: Connect to GitHub is offered from the panel that shows the history',
      /Connect to GitHub/i.test(beforeRemote),
      beforeRemote.split('\n').slice(0, 8).join(' | ')
    );

    // ── A commit of the user's own, so ahead/behind has something to count ───
    fs.writeFileSync(path.join(projectDir, 'AIB-008-LIVE.md'), `Live check ${new Date().toISOString()}\n`);
    await sleep(1500);
    await setInputValue(client, 'textarea', 'AIB-008 live check');
    await sleep(300);
    await clickButtonWithText(client, 'Commit local changes').catch(async () => clickButtonWithText(client, 'Commit'));
    await sleep(3000);
    report.commits = git(projectDir, 'log', '--oneline').split('\n');
    check(
      steps,
      'AIB-008 §7: a commit is made from the panel',
      report.commits.length >= 2,
      report.commits.join(' | ')
    );

    // ── Connect a remote ────────────────────────────────────────────────────
    await clickButtonWithText(client, 'Connect to GitHub');
    await sleep(1200);
    const connectText = await panelText(client);
    if (/Connect GitHub Account/i.test(connectText)) {
      throw new Error('the editor has no GitHub token — sign in once by hand, then re-run');
    }

    await clickButtonWithText(client, 'Create New Repository');
    await waitFor(client, `(() => Boolean(document.querySelector('#name')))()`, { what: 'the create-repo modal' });
    await setInputValue(client, '#name', repoName);
    await sleep(300);
    // Private: this is somebody's real account, and a live check does not belong
    // on their public profile.
    await evaluate(
      client,
      `(() => {
         const radios = Array.from(document.querySelectorAll('input[type=radio]'));
         const priv = radios.find((r) => /private/i.test(r.value || '') || /private/i.test((r.closest('label') || {}).innerText || ''));
         if (!priv) return false;
         priv.click();
         return true;
       })()`
    );
    await sleep(300);
    await clickButtonWithText(client, 'Create');

    // ── Criterion 3, and the push ───────────────────────────────────────────
    const connected = await waitFor(
      client,
      `(() => {
         const text = (document.body.innerText || '');
         const m = text.match(/([\\w.-]+\\/${repoName.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')})/);
         return m ? m[1] : null;
       })()`,
      { timeoutMs: 3 * 60000, what: 'the repository to be created and connected' }
    );
    report.remote = connected;
    check(steps, 'AIB-008 §7: the remote is connected, from the same panel', Boolean(connected), connected);

    const afterText = await panelText(client);
    report.panelAfter = afterText.split('\n').slice(0, 10);
    check(
      steps,
      'AIB-008 §3: ahead/behind is on screen beside the branch, without changing section',
      /Up to date|\d+ ahead|\d+ behind/.test(afterText),
      report.panelAfter.join(' | ')
    );

    // The remote is the authority on whether a push happened — the panel is not.
    report.remoteUrl = git(projectDir, 'remote', '-v').split('\n')[0];
    const lsRemote = execFileSync('git', ['-C', projectDir, 'ls-remote', 'origin'], { encoding: 'utf8' }).trim();
    report.lsRemote = lsRemote.split('\n');
    const localHead = git(projectDir, 'rev-parse', 'HEAD');
    check(
      steps,
      'AIB-008 §7: the commits are actually on the remote — the push happened',
      lsRemote.includes(localHead),
      `local HEAD ${localHead.slice(0, 8)} | remote ${report.lsRemote.join(' ; ').slice(0, 200)}`
    );
  } catch (error) {
    report.error = error.message;
  } finally {
    client.close();
  }

  report.ok = steps.length > 0 && steps.every((s) => s.ok) && !report.error;
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`project: ${report.projectDir}`);
    if (report.remote) console.log(`repo:    https://github.com/${report.remote}  ← private, delete when done`);
    for (const step of steps) {
      console.log(`${step.ok ? 'PASS' : 'FAIL'}  ${step.name}`);
      if (!step.ok) console.log(`      ${step.detail}`);
    }
    if (report.error) console.log(`ERROR ${report.error}`);
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
