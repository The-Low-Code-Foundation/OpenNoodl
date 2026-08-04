#!/usr/bin/env node
/**
 * POL-008 Part A — "I clicked 'sample data' and nothing came up".
 *
 * The diagnosis is in the spec and is not re-derived here: the export always
 * shipped a complete signed-in user *with a session token*, `installSandbox`
 * intercepts the network and only the network, and `UserService` issues the one
 * request that would have served that user — `GET /users/me` — **only if a
 * session already exists**. Nothing ever wrote one. So the preview rendered
 * every bound Text as its design-time parameter, under a toolbar reading
 * "Sample data — signed in as a sample user".
 *
 * ## What this measures, and why it is the real thing
 *
 * Not `buildSandboxExport`'s return value — the previous session already proved
 * that is complete, and proving it again would prove nothing. What was never
 * checked is the **rendered pixel**: does a Text bound to `User.email` show the
 * sample address, or its placeholder?
 *
 * So this drives the whole path end to end:
 *
 *   1. builds a candidate through `buildCandidate` — a Group, a Text whose
 *      `text` parameter is the literal string "Email placeholder", and a
 *      `net.noodl.user.User` wired `email → text`. That is Richard's reported
 *      graph, and the placeholder is deliberately the string from his
 *      screenshot: if the fix does not land, the driver reads back the exact
 *      words he reported;
 *   2. registers the export on `ViewerConnection` under a sandbox client id,
 *      exactly as `SandboxPreview` does;
 *   3. points the running preview window at the sandbox URL, so a **real**
 *      viewer boots with the real network shim, the real `UserService` and the
 *      real `User` node;
 *   4. reads the text the viewer actually rendered.
 *
 * Nothing is stubbed. A fake would be the defect with a nicer face, which this
 * task's own traps list says out loud.
 *
 * The signed-out half is measured the same way and matters as much: Richard's
 * decision was "signed in by default, **with a toggle**", and a toggle that
 * cannot go back is not one. The strip's sentence is read in both states,
 * because a preview whose `authenticated` is false under a strip saying "signed
 * in as a sample user" is the reported defect one layer down.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol008-sandbox-session.js
 *
 *     --shots=<dir>   a PNG of the rendered sandbox per state
 *     --json          the full report
 *
 * ## Traps
 *
 * - Run against a copy. The editor rewrites and autosaves any project it opens.
 * - The viewer is a `<webview>`; it is navigated, never closed. Destroying its
 *   CDP target takes the editor down with it (`Invalid guestInstanceId`).
 * - Restart the stack between iterations. HMR does not re-apply a change to a
 *   module the running viewer already loaded, and the viewer is a second
 *   bundle: an edit to `noodl-viewer-react` needs its own webpack pass to land.
 * - Setting `webview.src` *starts* a navigation; the previous document keeps
 *   answering CDP until it lands. Wait on `location.href`, never on a sleep —
 *   the two auth states are one query parameter apart and their DOM is
 *   identical until the session differs, so a stale read is indistinguishable
 *   from a failed fix. It cost one wrong conclusion here.
 * - This drives the **editor's own preview webview**, which is in the ordinary
 *   preview partition rather than `persist:nodegx-authoring-sandbox`. So its
 *   storage jar holds real sessions from other projects, and every assertion
 *   about clearing is scoped to the sandbox's own user rather than to an empty
 *   jar. The behaviour under test does not depend on which partition it is in;
 *   reaching the real `SandboxPreview` would mean driving a whole authoring
 *   session for no extra evidence.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

/* -------------------------------------------------------------------------- */
/* Modules                                                                    */
/* -------------------------------------------------------------------------- */

const PROBE = `(() => {
  if (!window.__pol008wr) {
    window.webpackChunknoodl_editor.push([['pol008'], {}, (r) => (window.__pol008wr = r)]);
  }
  return typeof window.__pol008wr === 'function';
})()`;

const REQ = (id) => `window.__pol008wr(${JSON.stringify(id)})`;

const M = {
  candidate: './src/editor/src/models/AiAssistant/authoring/candidate.ts',
  sandboxExport: './src/editor/src/models/AiAssistant/authoring/sandboxExport.ts',
  project: './src/editor/src/models/projectmodel.ts',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  viewerConnection: './src/editor/src/ViewerConnection.ts'
};

/* -------------------------------------------------------------------------- */
/* The candidate                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Richard's graph, minimally.
 *
 * The `text` parameters are the two strings from his screenshot on purpose.
 * A driver whose placeholder is "lorem" cannot tell you it reproduced the
 * report; this one reads back either the sample address or the exact words he
 * saw.
 */
const PAYLOAD = {
  nodes: [
    { id: 'root', type: 'Group' },
    { id: 'user', type: 'net.noodl.user.User' },
    { id: 'nameText', type: 'Text', parent: 'root', parameters: { text: 'Text' } },
    { id: 'emailText', type: 'Text', parent: 'root', parameters: { text: 'Email placeholder' } }
  ],
  connections: [
    { fromId: 'user', fromProperty: 'username', toId: 'nameText', toProperty: 'text' },
    { fromId: 'user', fromProperty: 'email', toId: 'emailText', toProperty: 'text' }
  ],
  visualRoots: ['root']
};

const REQUEST = { description: 'A profile card showing the signed-in member.', componentPath: 'Pages/Profile' };

const SANDBOX_SESSION_ID = 'pol008';
const SANDBOX_CLIENT_ID = `sandbox-${SANDBOX_SESSION_ID}`;

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
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

async function clickButtonWithText(client, label) {
  const box = await evaluate(
    client,
    `(() => {
       const want = ${JSON.stringify(label)}.toLowerCase();
       const buttons = Array.from(document.querySelectorAll('button, [role=button]'));
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || buttons.find((b) => (b.innerText || '').trim().toLowerCase().startsWith(want));
       if (!el) return null;
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, width: r.width, height: r.height,
                onTop: Boolean(hit && (el === hit || el.contains(hit))) };
     })()`
  );
  if (!box) throw new Error(`no button reading "${label}"`);
  if (!box.onTop) throw new Error(`button "${label}" is not topmost at its own centre`);
  const { dispatchClick } = require('../../../../scripts/devtools/cdp');
  await dispatchClick(client, box);
}

async function leaveProject(client) {
  await evaluate(client, `(() => { ${REQ(M.app)}.App.instance.exitProject(); return true; })()`);
  await waitFor(client, `(() => !document.querySelector('[data-panel-id]'))()`, {
    timeoutMs: 30000,
    what: 'the launcher'
  });
  await sleep(1500);
}

async function openProject(client, dir) {
  const open = await evaluate(
    client,
    `(() => {
       const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
       return p ? (p._retainedProjectDirectory || 'unknown') : '';
     })()`
  );
  if (open) await leaveProject(client);

  await evaluate(
    client,
    `(() => { ${REQ(M.platform)}.filesystem.openDialog = async () => ${JSON.stringify(dir)}; return true; })()`
  );
  await clickButtonWithText(client, 'Open project');
  await waitFor(
    client,
    `(() => {
       const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
       return !!(p && p._retainedProjectDirectory);
     })()`,
    { timeoutMs: 90000, what: `the project at ${dir} to open` }
  );
}

/** Build the candidate and register its export, exactly as `SandboxPreview` does. */
function stageExport(signedIn) {
  return `(() => {
    const built = ${REQ(M.candidate)}.buildCandidate(${JSON.stringify(REQUEST)}, ${JSON.stringify(PAYLOAD)});
    if (built.errors && built.errors.length) return { error: JSON.stringify(built.errors) };

    const result = ${REQ(M.sandboxExport)}.buildSandboxExport({
      project: ${REQ(M.project)}.ProjectModel.instance,
      files: built.files,
      signedIn: ${signedIn}
    });
    if (!result.json) return { error: result.unrenderable || 'no export' };

    window.__pol008export = result;
    const vc = ${REQ(M.viewerConnection)}.ViewerConnection.instance;
    vc.unregisterSandboxExport(${JSON.stringify(SANDBOX_CLIENT_ID)});
    vc.registerSandboxExport(${JSON.stringify(SANDBOX_CLIENT_ID)}, () => window.__pol008export.json);

    const dataset = result.json.metadata && result.json.metadata.sandbox;
    return {
      summary: result.summary,
      notice: result.notice || null,
      datasetUser: dataset ? { username: dataset.user.username, email: dataset.user.email,
                               sessionToken: dataset.user.sessionToken } : null
    };
  })()`;
}

/**
 * Point the running preview at the sandbox URL.
 *
 * The webview is navigated rather than replaced: it is a guest of the editor's
 * window, and destroying it throws `Invalid guestInstanceId` out of
 * `GUEST_VIEW_MANAGER_CALL` and white-screens the editor. Found the hard way in
 * POL-010's driver.
 */
function sandboxUrl(signedIn) {
  return (
    `http://localhost:8574/?noodl-sandbox=${SANDBOX_SESSION_ID}` +
    `&noodl-sandbox-data=sample&noodl-sandbox-auth=${signedIn ? 'in' : 'out'}`
  );
}

function navigateSandbox(signedIn) {
  return `(() => {
    const wv = document.querySelector('webview');
    if (!wv) return false;
    // Blank first, so the two auth states are always a real navigation apart.
    // Assigning a URL that differs only in a query parameter still navigates,
    // but going via about:blank makes "has it landed?" answerable without
    // trusting a string compare against a URL the page may not have committed.
    wv.src = 'about:blank';
    setTimeout(() => { wv.src = ${JSON.stringify(sandboxUrl(signedIn))}; }, 250);
    return true;
  })()`;
}

/**
 * Whether the preview has actually committed the navigation, asked from the
 * **editor** side.
 *
 * ⚠️ Not by connecting to the viewer and reading `location.href`. A CDP session
 * attached to a document that is being replaced simply stops answering, and
 * `evaluate` has no deadline — the driver hung indefinitely rather than failing.
 * `webview.getURL()` is on the host element and survives its guest reloading.
 */
function previewSettledAt(signedIn) {
  return `(() => {
    const wv = document.querySelector('webview');
    if (!wv || typeof wv.getURL !== 'function') return false;
    return wv.getURL().indexOf('auth=${signedIn ? 'in' : 'out'}') !== -1 && !wv.isLoading();
  })()`;
}

/** What the sandbox viewer actually put on screen. */
const RENDERED = `(() => ({
  text: (document.body.innerText || '').trim().replace(/\\s+/g, ' '),
  session: Object.keys(localStorage).filter((k) => /currentUser$/.test(k)).map((k) => {
    try { return { key: k, email: JSON.parse(localStorage[k]).email }; }
    catch (e) { return { key: k, email: null }; }
  })
}))()`;

/* -------------------------------------------------------------------------- */
/* The run                                                                    */
/* -------------------------------------------------------------------------- */

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

async function shoot(viewer, dir, name) {
  if (!dir) return null;
  const { data } = await viewer.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(dir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

/**
 * One state, end to end: stage the export, navigate the preview, read the pixel.
 *
 * The viewer target is re-resolved on every state because the navigation
 * replaces the page, and a client held across it answers about the old one.
 */
async function runState(client, signedIn, shots) {
  const staged = await evaluate(client, stageExport(signedIn));
  if (staged.error) throw new Error(`could not stage the export: ${staged.error}`);

  if (!(await evaluate(client, navigateSandbox(signedIn)))) throw new Error('no preview webview to navigate');

  // ⚠️ **Wait for the navigation from the editor side, before connecting.**
  // Setting `webview.src` starts a navigation and returns; the previous document
  // keeps answering CDP until it lands, so a fixed sleep read the *signed-in*
  // page while asking about the signed-out one and reported the fix as broken.
  // The two states are one query parameter apart and their DOM is identical
  // until the session differs, so a stale read is indistinguishable from a
  // failure to clear.
  await waitFor(client, previewSettledAt(signedIn), {
    timeoutMs: 60000,
    every: 400,
    what: `the preview to land on auth=${signedIn ? 'in' : 'out'}`
  });

  const target = await appTarget('viewer');
  const viewer = await connect(target);
  try {
    // The export arrives over the relay *after* the window boots, so an
    // immediate read catches an empty document and reports it as a missing value.
    await waitFor(viewer, `(() => (document.body.innerText || '').trim().length > 0)()`, {
      timeoutMs: 30000,
      what: 'the sandbox preview to render'
    });
    await sleep(1200);
    const rendered = await evaluate(viewer, RENDERED);
    await shoot(viewer, shots, signedIn ? 'signed-in' : 'signed-out');
    return { staged, rendered };
  } finally {
    viewer.close?.();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : d;
  };
  const shots = arg('shots', null);
  if (shots) fs.mkdirSync(shots, { recursive: true });

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pol008-'));
  const projectDir = path.join(work, 'corpus');
  copyTree(CORPUS_PROJECT_DIR, projectDir);

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { work, states: {} };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('webpack require probe failed');
    await openProject(client, projectDir);
    await sleep(4000);

    /* ---------------- signed in — the default, and the report -------------- */
    const inState = await runState(client, true, shots);
    report.states.signedIn = inState;

    check(
      steps,
      'the dataset ships a complete signed-in user (unchanged, and the premise)',
      inState.staged.datasetUser &&
        inState.staged.datasetUser.email === 'sample.user@example.com' &&
        Boolean(inState.staged.datasetUser.sessionToken),
      JSON.stringify(inState.staged.datasetUser)
    );
    check(
      steps,
      'a session is written where UserService reads one',
      inState.rendered.session.some((s) => s.email === 'sample.user@example.com'),
      JSON.stringify(inState.rendered.session)
    );
    check(
      steps,
      'the no-backend key is one of them — the case an AI-authored preview actually uses',
      inState.rendered.session.some(
        (s) => s.key === 'Parse/undefined/currentUser' && s.email === 'sample.user@example.com'
      ),
      JSON.stringify(inState.rendered.session.map((s) => s.key))
    );
    check(
      steps,
      'the bound Text renders the sample email, not its placeholder',
      inState.rendered.text.includes('sample.user@example.com') &&
        !inState.rendered.text.includes('Email placeholder'),
      `rendered = ${JSON.stringify(inState.rendered.text.slice(0, 160))}`
    );
    check(
      steps,
      'the strip says it is signed in',
      /signed in as a sample user/i.test(inState.staged.summary || ''),
      `summary = ${JSON.stringify(inState.staged.summary)}`
    );

    /* ---------------- signed out — the toggle has to go back --------------- */
    const outState = await runState(client, false, shots);
    report.states.signedOut = outState;

    // ⚠️ Scoped to the sandbox's *own* user, not to "no sessions at all". This
    // driver navigates the editor's preview webview, which lives in the ordinary
    // preview partition — so it shares storage with every project previewed on
    // this machine, and that jar has real sessions in it from other work. The
    // real `SandboxPreview` uses `persist:nodegx-authoring-sandbox` and would
    // see none of them. Asserting an empty jar here would fail for a reason that
    // has nothing to do with POL-008.
    check(
      steps,
      'signing out clears the sandbox session rather than leaving a stale one',
      !outState.rendered.session.some((s) => s.email === 'sample.user@example.com'),
      JSON.stringify(outState.rendered.session)
    );
    check(
      steps,
      'the signed-out branch is reachable — the preview shows the unbound state',
      !outState.rendered.text.includes('sample.user@example.com'),
      `rendered = ${JSON.stringify(outState.rendered.text.slice(0, 160))}`
    );
    check(
      steps,
      'the strip says it is signed OUT — it does not keep promising a user',
      /signed out/i.test(outState.staged.summary || '') &&
        !/signed in/i.test(outState.staged.summary || ''),
      `summary = ${JSON.stringify(outState.staged.summary)}`
    );

    /* ---------------- and back again --------------------------------------- */
    const backState = await runState(client, true, null);
    report.states.backIn = backState;
    check(
      steps,
      'the toggle goes back: signing in again re-renders the sample user',
      backState.rendered.text.includes('sample.user@example.com'),
      `rendered = ${JSON.stringify(backState.rendered.text.slice(0, 160))}`
    );
  } finally {
    await evaluate(
      client,
      `(() => { ${REQ(M.viewerConnection)}.ViewerConnection.instance
                 .unregisterSandboxExport(${JSON.stringify(SANDBOX_CLIENT_ID)}); return true; })()`
    ).catch(() => undefined);
    client.close?.();
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(JSON.stringify(argv.includes('--json') ? { steps, report } : { steps }, null, 2));
  console.log(`\n${steps.length - failed.length}/${steps.length} checks passed. Copy in ${work}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(2);
});
