#!/usr/bin/env node
/**
 * POL-010 — the provenance walk says what it can and cannot answer.
 *
 * The defect is not in the walk engine; it was measured at four hops on real
 * runtime ids in the session that diagnosed this. The defect is that the panel
 * renders **four different situations identically** — one row, and a summary
 * line that reads as a result:
 *
 *   A. no viewer has answered, so the topology is empty;
 *   B. the topology is present but the queried NODE is not in it, because the
 *      preview never instantiated the component it lives in;
 *   C. the node is there and the queried PORT has no incoming wire;
 *   D. the node and the wire are both there, and the walk is a real answer.
 *
 * (B) is the one Richard hit: `filterCollection.items` on the chat project,
 * while the preview sits on `/Pages/Signup` and has mounted nothing else.
 *
 * ## Why this file measures rather than asserts on prose
 *
 * Written and run against `HEAD` **before** the fix, per POL-007's lesson. On
 * `HEAD` it is expected to report all four states collapsing onto the same
 * sentence; that is the mechanism, stated as a measurement. Afterwards the same
 * run must separate them. A check that only ever ran against the fixed build
 * proves the check compiles, not that it catches anything.
 *
 * Each state is reached for real:
 *
 *   - (B) and (D) are the *same walk on the same node*, differing only in which
 *     page the preview mounted. Two copies of the chat project, identical but
 *     for `Router.startPage`, is the whole apparatus — no stubbing, no faked
 *     topology. If the two runs agree, the panel is not reading the topology.
 *   - (A) closes the preview's CDP target and waits for the relay client to
 *     disconnect, which is what happens when a detached preview window is closed
 *     or the preview crashes. Nothing in the editor is patched. The session is
 *     still holding the topology at that moment, deliberately: an archived graph
 *     under a live-looking walk is slice 2b's lie one scope smaller.
 *   - (C) walks `titleText.text`, a Text node on the mounted Chat page whose
 *     `text` is set as a parameter and wired from nothing.
 *
 * ## Slice 2b, which is a correctness bug in its own right
 *
 * `TraceSession` is a singleton with no reset path: `hasTopology` is set true
 * once and never back, and `topology` is only replaced when a *new* dictionary
 * arrives. So after a project switch it serves the previous project's graph and
 * claims it is current. The run switches projects and reads the session before
 * anything asks for a refresh — the only window in which the stale graph is
 * observable, and exactly the window a user is in when they open a project and
 * ask their first question.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol010-walk.js
 *
 *     --source=<dir>   the chat project to copy (default: the committed
 *                      pol010-chat copy if present, else --source is required)
 *     --shots=<dir>    write a PNG of the panel per state
 *     --capture=<file> write state (D)'s topology out verbatim, as the fixture
 *                      slice 4's jest test is built from
 *     --json           the full report rather than the summary
 *
 * ## Traps
 *
 * - Always run against copies. The editor rewrites (and minifies) any project it
 *   opens, and it autosaves.
 * - HMR does not re-apply a change to a mounted panel. Restart the stack between
 *   iterations rather than trusting a hot update.
 * - `filesystem.openDialog` returns the directory STRING, not `{ filePaths }`.
 * - The preview is a separate CDP target and only exists while it is running.
 *   Its absence is a state this file deliberately visits, so nothing here may
 *   assume the target is there.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, httpJson, dispatchClick } = require('../../../../scripts/devtools/cdp');

/* -------------------------------------------------------------------------- */
/* Modules                                                                    */
/* -------------------------------------------------------------------------- */

const PROBE = `(() => {
  if (!window.__pol010wr) {
    window.webpackChunknoodl_editor.push([['pol010'], {}, (r) => (window.__pol010wr = r)]);
  }
  return typeof window.__pol010wr === 'function';
})()`;

const REQ = (id) => `window.__pol010wr(${JSON.stringify(id)})`;

const M = {
  request: './src/editor/src/utils/provenance/provenanceRequest.ts',
  session: './src/editor/src/utils/provenance/TraceSession.ts',
  engine: './src/editor/src/utils/provenance/walkEngine.ts',
  project: './src/editor/src/models/projectmodel.ts',
  sidebar: './src/editor/src/models/sidebar/sidebarmodel.tsx',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  importer: './src/editor/src/models/nodelibrary/NodeLibraryImporter.ts'
};

/* -------------------------------------------------------------------------- */
/* Renderer-side measurement                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What the panel is showing, and what the session it reads from actually holds.
 *
 * The two halves matter together. The panel's sentence is the deliverable; the
 * session's node count is what makes a wrong sentence diagnosable rather than
 * merely wrong.
 *
 * Rows are counted as `div[role=button]` inside the `.Rows` container — the
 * Reveal affordance is also `role=button` but is a `span`, and the detail block
 * and the truncation notes are neither.
 */
const MEASURE = (target) => `(() => {
  const session = ${REQ(M.session)}.TraceSession.instance;
  const topology = session.topology || { nodes: {}, edges: [] };
  const nodeIds = Object.keys(topology.nodes);
  const target = ${JSON.stringify(target)};

  const panel = document.querySelector('[data-panel-id="provenance"]');
  const text = (el) => (el && el.innerText ? el.innerText.trim().replace(/\\s+/g, ' ') : '');

  let summary = null, rows = [], detail = null, empty = null;
  if (panel) {
    const summaries = Array.from(panel.querySelectorAll('[class*="Summary"]'));
    // The status line ("Reading 12 ports…") uses the same class while a load is
    // in flight, so the LAST one is the walk's own summary.
    summary = summaries.length ? text(summaries[summaries.length - 1]) : null;

    const rowsBox = panel.querySelector('[class*="Rows"]');
    if (rowsBox) {
      rows = Array.from(rowsBox.querySelectorAll('div[role="button"]')).map((r) => ({
        text: text(r),
        indent: Math.round(parseFloat(getComputedStyle(r).paddingLeft) || 0)
      }));
    }

    const emptyBox = panel.querySelector('[class*="Empty"]');
    if (emptyBox) empty = text(emptyBox);

    // The detail block, if a row is expanded. Its Node/Node id pair is the
    // visible signature of state (B): they print the same string only when the
    // dictionary has no entry to read a name from.
    const detailBox = panel.querySelector('[class*="Detail"]');
    if (detailBox) {
      const pairs = {};
      Array.from(detailBox.querySelectorAll('[class*="DetailRow"]')).forEach((r) => {
        const k = r.querySelector('[class*="DetailKey"]');
        const v = r.querySelector('[class*="DetailValue"]');
        if (k && v) pairs[text(k)] = text(v);
      });
      detail = pairs;
    }
  }

  return {
    panel: Boolean(panel),
    summary,
    empty,
    rowCount: rows.length,
    rows: rows.slice(0, 12),
    detail,
    session: {
      isPreviewRunning: session.isPreviewRunning,
      hasTopology: session.hasTopology,
      recording: session.recording,
      nodes: nodeIds.length,
      edges: (topology.edges || []).length,
      components: Array.from(new Set(nodeIds.map((id) => topology.nodes[id].component))).slice(0, 6),
      sampleIds: nodeIds.slice(0, 8)
    },
    targetInTopology: Boolean(topology.nodes[target.node]),
    incomingEdges: (topology.edges || []).filter(
      (e) => e.to.node === target.node && e.to.port === target.port
    ).length,
    project: (() => {
      const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
      return p ? { name: p.name, dir: p._retainedProjectDirectory || '' } : null;
    })()
  };
})()`;

/** The engine's own answer for the same target, so panel and engine can be compared. */
const ENGINE = (target) => `(() => {
  const W = ${REQ(M.engine)};
  const session = ${REQ(M.session)}.TraceSession.instance;
  const index = W.buildIndex(session.topology, session.traceEvents, session.portValues, {
    recording: session.recording
  });
  const walk = W.backwardWalk(index, ${JSON.stringify(target)});
  const labels = [];
  W.forEachRow(walk.root, (r) => labels.push(W.labelFor(index, r.ref)));
  return { rowCount: walk.rowCount, mode: walk.mode, labels, foundation: walk.foundation || null };
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
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

async function clickButtonWithText(client, label, { scope = 'body' } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const root = document.querySelector(${JSON.stringify(scope)});
       if (!root) return null;
       const want = ${JSON.stringify(label)}.toLowerCase();
       const buttons = Array.from(root.querySelectorAll('button, [role=button]'));
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || buttons.find((b) => (b.innerText || '').trim().toLowerCase().startsWith(want));
       if (!el) return null;
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, width: r.width, height: r.height,
                onTop: Boolean(hit && (el === hit || el.contains(hit))) };
     })()`
  );
  if (!box) throw new Error(`no button reading "${label}"`);
  if (!box.width || !box.height) throw new Error(`button "${label}" has a zero-sized box`);
  if (!box.onTop) throw new Error(`button "${label}" is not topmost at its own centre`);
  await dispatchClick(client, box);
}

async function openProject(client, dir) {
  // A previous run leaves the editor inside a project, and "Open project" is a
  // launcher button. Leaving first makes the script re-runnable without a
  // restart, which matters because it is meant to be run against HEAD and then
  // against the fix.
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

/** The editor's own exit path — the same notification the rail's brand button sends. */
async function leaveProject(client) {
  await evaluate(client, `(() => { ${REQ(M.app)}.App.instance.exitProject(); return true; })()`);
  await waitFor(client, `(() => !document.querySelector('[data-panel-id]'))()`, {
    timeoutMs: 30000,
    what: 'the editor to return to the launcher'
  });
  await sleep(1500);
}

/**
 * Ask the panel the question, the way the canvas context menu asks it, and wait
 * until the load it starts has finished.
 *
 * The wait is on the status line clearing rather than on a fixed sleep: every
 * pull has a 2s deadline and two of them run per walk, so a fixed sleep either
 * races or wastes ten seconds a state.
 */
async function walk(client, target) {
  await evaluate(
    client,
    `(() => { ${REQ(M.request)}.requestProvenanceWalk(${JSON.stringify(target)}); return true; })()`
  );
  await waitFor(client, `(() => !!document.querySelector('[data-panel-id="provenance"]'))()`, {
    timeoutMs: 20000,
    what: 'the Provenance panel to mount'
  });
  // The status line is a Summary block whose text ends in an ellipsis.
  await waitFor(
    client,
    `(() => {
       const p = document.querySelector('[data-panel-id="provenance"]');
       if (!p) return false;
       const s = Array.from(p.querySelectorAll('[class*="Summary"]'))
         .map((e) => (e.innerText || '').trim());
       return !s.some((t) => t.endsWith('\\u2026'));
     })()`,
    { timeoutMs: 30000, what: 'the walk to finish loading' }
  );
  await sleep(400);
}

/** Expand the first row, so the Node / Node id pair can be read. */
async function expandFirstRow(client) {
  const ok = await evaluate(
    client,
    `(() => {
       const p = document.querySelector('[data-panel-id="provenance"]');
       if (!p) return false;
       const box = p.querySelector('[class*="Rows"]');
       if (!box) return false;
       const row = box.querySelector('div[role="button"]');
       if (!row) return false;
       const r = row.getBoundingClientRect();
       return { x: r.left + 30, y: r.top + r.height / 2, width: r.width, height: r.height };
     })()`
  );
  if (!ok || !ok.width) return false;
  await dispatchClick(client, ok);
  await sleep(300);
  return true;
}

/**
 * The preview, if it is up.
 *
 * ⚠️ The in-editor preview is a `<webview>`, not a window, so it is a `webview`
 * CDP target rather than a `page`. `appTarget('viewer')` already knows that;
 * filtering `/json/list` for pages misses it entirely.
 */
async function viewerTarget() {
  return appTarget('viewer').catch(() => null);
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
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

/**
 * The one difference between the two copies.
 *
 * A Router's `startPage` decides which page the preview mounts, and therefore
 * which nodes exist in the runtime at all. Everything else — every node, every
 * wire, every id — is byte-identical, which is what makes (B) and (D) a
 * controlled pair rather than two anecdotes.
 */
function setStartPage(projectDir, startPage) {
  const file = path.join(projectDir, 'components/App/nodes.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const router = doc.nodes.find((n) => n.type === 'Router');
  if (!router) throw new Error(`no Router in ${file}`);
  router.parameters.pages.startPage = startPage;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  return startPage;
}

function renameProject(projectDir, name) {
  const file = path.join(projectDir, 'nodegx.project.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  doc.name = name;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

/* -------------------------------------------------------------------------- */
/* The run                                                                    */
/* -------------------------------------------------------------------------- */

const CHAT_TARGET = { node: 'filterCollection', port: 'items' };
const UNWIRED_TARGET = { node: 'titleText', port: 'text' };

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

async function shoot(client, dir, name) {
  if (!dir) return null;
  const box = await evaluate(
    client,
    `(() => {
       const p = document.querySelector('[data-panel-id="provenance"]');
       if (!p) return null;
       const r = p.getBoundingClientRect();
       return { x: Math.round(r.left), y: Math.round(r.top),
                width: Math.round(r.width), height: Math.round(r.height) };
     })()`
  );
  const params = { format: 'png', captureBeyondViewport: false };
  if (box && box.width) params.clip = { ...box, scale: 1 };
  const { data } = await client.send('Page.captureScreenshot', params);
  const file = path.join(dir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : d;
  };

  const DEFAULT_SOURCE =
    '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/' +
    'e48712c9-6b72-4642-b15f-ffda2e7e3bcc/scratchpad/pol010-chat';
  const source = arg('source', DEFAULT_SOURCE);
  const shots = arg('shots', null);
  const capture = arg('capture', null);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  if (!fs.existsSync(path.join(source, 'nodegx.project.json'))) {
    throw new Error(`--source must be a NodeGX project directory (no nodegx.project.json in ${source})`);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pol010-'));
  const signupCopy = path.join(work, 'chat-on-signup');
  const chatCopy = path.join(work, 'chat-on-chat');
  copyTree(source, signupCopy);
  copyTree(source, chatCopy);
  setStartPage(signupCopy, '/Pages/Signup');
  setStartPage(chatCopy, '/Pages/Chat');
  renameProject(signupCopy, 'POL010 On Signup');
  renameProject(chatCopy, 'POL010 On Chat');

  const target = await appTarget('editor');
  const client = await connect(target);
  const steps = [];
  const report = { work, states: {} };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('webpack require probe failed');

    /* -------- open the project whose preview lands on /Pages/Signup -------- */
    await openProject(client, signupCopy);

    await sleep(8000); // the viewer boots and answers with a dictionary

    /* ---------------- state B — the node is not in the topology ------------ */
    await walk(client, CHAT_TARGET);
    await expandFirstRow(client);
    const B = await evaluate(client, MEASURE(CHAT_TARGET));
    B.engine = await evaluate(client, ENGINE(CHAT_TARGET));
    report.states.B = B;
    await shoot(client, shots, 'state-b-node-absent');

    check(
      steps,
      'B: the preview really has not instantiated the node',
      B.session.isPreviewRunning && B.session.hasTopology && !B.targetInTopology,
      `previewRunning=${B.session.isPreviewRunning} hasTopology=${B.session.hasTopology} ` +
        `nodes=${B.session.nodes} components=${JSON.stringify(B.session.components)} ` +
        `targetInTopology=${B.targetInTopology}`
    );
    check(
      steps,
      'B: the panel says the node is not in the running preview, and names it',
      /is not running in the preview/i.test(B.summary || '') &&
        /Filter Messages By Conversation/.test(B.summary || ''),
      `summary = ${JSON.stringify(B.summary)}`
    );
    check(
      steps,
      'B: the panel does not render a row as though it were a result',
      B.rowCount === 0,
      `${B.rowCount} row(s): ${JSON.stringify(B.rows.map((r) => r.text))}`
    );
    check(
      steps,
      'B: Node and Node id no longer print the same string unexplained',
      !B.detail || B.detail['Node'] !== B.detail['Node id'],
      B.detail ? `Node=${JSON.stringify(B.detail['Node'])} Node id=${JSON.stringify(B.detail['Node id'])}` : 'no detail block'
    );

    /* ---------------- state A — no live graph ------------------------------ */
    // The preview is destroyed for real: its CDP target is closed, the relay
    // client disconnects, and `clientsWithRuntime` empties. That is what happens
    // when a detached preview window is closed or the preview crashes — nothing
    // in the editor is patched, and the check below proves the disconnect landed
    // before it reads a word of the panel.
    //
    // ⚠️ The session still HOLDS the topology at this point, and that is the
    // point: an archived graph under a live-looking walk is the same lie as
    // slice 2b, one scope smaller. State A must fire on the missing viewer, not
    // merely on an empty dictionary.
    const viewer = await viewerTarget();
    report.viewerTarget = viewer ? viewer.url : null;
    let closed = false;
    if (viewer) {
      // ⚠️ **Not `/json/close` on the viewer target.** The in-editor preview is a
      // `<webview>`, a guest of the editor's own window, and destroying it takes
      // the host down with it: `Invalid guestInstanceId` from
      // `GUEST_VIEW_MANAGER_CALL`, an uncaught throw inside React, and a
      // white-screened editor. That is not a state any user can produce, so it
      // is not a state worth measuring against.
      //
      // Navigating the preview away *is*: the relay client disconnects exactly
      // as it does when a preview crashes on boot or a detached preview window
      // is closed, and the editor is untouched.
      const viewerClient = await connect(viewer);
      await evaluate(viewerClient, `(() => { location.replace('about:blank'); return true; })()`).catch(
        () => undefined
      );
      viewerClient.close?.();
      closed = await waitFor(
        client,
        `(() => !${REQ(M.session)}.TraceSession.instance.isPreviewRunning)()`,
        { timeoutMs: 30000, every: 500, what: 'the preview client to disconnect' }
      ).then(
        () => true,
        () => false
      );
    }
    check(steps, 'A: the preview really went away', closed, `viewer target = ${report.viewerTarget}`);

    if (closed) {
      await walk(client, CHAT_TARGET);
      const A = await evaluate(client, MEASURE(CHAT_TARGET));
      A.engine = await evaluate(client, ENGINE(CHAT_TARGET));
      report.states.A = A;
      await shoot(client, shots, 'state-a-no-live-graph');

      check(
        steps,
        'A: the held topology is still there — the state fires on the viewer, not the dictionary',
        A.session.isPreviewRunning === false && A.session.nodes > 0,
        `previewRunning=${A.session.isPreviewRunning} heldNodes=${A.session.nodes}`
      );
      check(
        steps,
        'A: the panel says there is no live graph to walk',
        /no preview is running|no live graph|nothing to walk/i.test(A.summary || ''),
        `summary = ${JSON.stringify(A.summary)}`
      );
      check(steps, 'A: no rows are rendered', A.rowCount === 0, `${A.rowCount} row(s)`);
    }

    /* ---------------- slice 2b — the session survives a project switch ----- */
    // The session still holds the topology the /Pages/Signup preview reported.
    // Switching projects must not leave that graph in place, claiming currency.
    const beforeSwitch = await evaluate(client, MEASURE(CHAT_TARGET));
    await leaveProject(client);
    await openProject(client, chatCopy);
    // Read BEFORE anything asks for a refresh. This is the only window in which
    // the stale graph is observable, and it is the window a user is in.
    const staleWindow = await evaluate(
      client,
      `(() => {
         const s = ${REQ(M.session)}.TraceSession.instance;
         const ids = Object.keys(s.topology.nodes);
         return { hasTopology: s.hasTopology, nodes: ids.length, sampleIds: ids.slice(0, 8),
                  components: Array.from(new Set(ids.map((i) => s.topology.nodes[i].component))) };
       })()`
    );
    report.afterSwitch = { beforeSwitch: beforeSwitch.session, staleWindow };
    // Without this the 2b check passes vacuously: an empty topology before the
    // switch is trivially not carried across it.
    check(
      steps,
      '2b: precondition — the session held a real graph before the switch',
      beforeSwitch.session.hasTopology && beforeSwitch.session.nodes > 0,
      `hasTopology=${beforeSwitch.session.hasTopology} nodes=${beforeSwitch.session.nodes} ` +
        `components=${JSON.stringify(beforeSwitch.session.components)}`
    );
    check(
      steps,
      '2b: after a project switch the session does not still claim the old graph',
      staleWindow.hasTopology === false && staleWindow.nodes === 0,
      `hasTopology=${staleWindow.hasTopology} nodes=${staleWindow.nodes} ` +
        `components=${JSON.stringify(staleWindow.components)}`
    );

    await sleep(6000); // the new preview boots and answers

    /* ---------------- state D — the same walk, page mounted ---------------- */
    await walk(client, CHAT_TARGET);
    const D = await evaluate(client, MEASURE(CHAT_TARGET));
    D.engine = await evaluate(client, ENGINE(CHAT_TARGET));
    report.states.D = D;
    await shoot(client, shots, 'state-d-walkable');

    // Slice 4's fixture, produced by the run that verifies the fix rather than typed out
    // afterwards. A hand-written topology has ids that match by construction, which is exactly
    // the property production does not have — the point of the test is that the engine works on
    // the runtime's own ids for a real project, so those are the ids it has to be given.
    if (capture) {
      const topology = await evaluate(
        client,
        `(() => JSON.parse(JSON.stringify(${REQ(M.session)}.TraceSession.instance.topology)))()`
      );
      fs.mkdirSync(path.dirname(path.resolve(capture)), { recursive: true });
      fs.writeFileSync(capture, JSON.stringify(topology, null, 2) + '\n');
      report.capturedTo = capture;
    }

    check(
      steps,
      'D: the preview mounted the Chat page, so the node is in the topology',
      D.targetInTopology && D.incomingEdges > 0,
      `nodes=${D.session.nodes} components=${JSON.stringify(D.session.components)} ` +
        `targetInTopology=${D.targetInTopology} incomingEdges=${D.incomingEdges}`
    );
    check(
      steps,
      'D: the walk reaches Query Messages — more than one hop',
      D.rowCount >= 2 && /messagesQuery|Query Messages/i.test(JSON.stringify(D.engine.labels)),
      `${D.rowCount} panel row(s); engine labels = ${JSON.stringify(D.engine.labels)}`
    );

    /* ---------------- state C — the port has no incoming wire -------------- */
    await walk(client, UNWIRED_TARGET);
    const C = await evaluate(client, MEASURE(UNWIRED_TARGET));
    C.engine = await evaluate(client, ENGINE(UNWIRED_TARGET));
    report.states.C = C;
    await shoot(client, shots, 'state-c-port-unwired');

    check(
      steps,
      'C: the node is in the topology and the port has no incoming wire',
      C.targetInTopology && C.incomingEdges === 0,
      `targetInTopology=${C.targetInTopology} incomingEdges=${C.incomingEdges}`
    );
    check(
      steps,
      'C: the panel says the port has no incoming connection',
      /no incoming connection|nothing (is )?(wired|connected)|nothing feeds it/i.test(C.summary || ''),
      `summary = ${JSON.stringify(C.summary)}`
    );

    /* ---------------- criterion 3 — all four are distinguishable ----------- */
    const sentences = ['A', 'B', 'C', 'D']
      .map((k) => (report.states[k] ? report.states[k].summary : null))
      .filter((s) => s !== null && s !== undefined);
    const distinct = new Set(sentences).size;
    check(
      steps,
      'criterion 3: the four states produce four different sentences',
      sentences.length === 4 && distinct === 4,
      `${distinct} distinct of ${sentences.length} measured:\n    ` +
        sentences.map((s, i) => `${['A', 'B', 'C', 'D'][i]}: ${JSON.stringify(s)}`).join('\n    ')
    );
  } finally {
    client.close?.();
  }

  const failed = steps.filter((s) => !s.ok);
  const out = argv.includes('--json') ? { steps, report } : { steps };
  console.log(JSON.stringify(out, null, 2));
  console.log(`\n${steps.length - failed.length}/${steps.length} checks passed. Copies in ${work}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(2);
});
