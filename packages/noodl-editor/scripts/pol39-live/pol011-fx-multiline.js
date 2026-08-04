#!/usr/bin/env node
/**
 * POL-011 — `fx` on the Text node's `text` field.
 *
 * > *"Can you add the 'fx' option to the text node's 'text' field? Lots of the
 * > nodes have an fx option, for example the Button node 'label' field."*
 *
 * The mechanism was never in doubt: a `string` port marked `multiline: true`
 * routes to `TextAreaType`, which had no expression support, while a plain
 * `string` routes to `BasicType`, which does. What is worth measuring is
 * everything *downstream* of the toggle appearing, because a row that shows an
 * `fx` badge and does not evaluate is worse than no `fx` at all.
 *
 * So this drives the whole path on a real Text node on a mounted page:
 *
 *   1. the row offers `fx` at all;
 *   2. clicking it converts the parameter, keeping the literal as the fallback;
 *   3. an expression naming a Noodl Variable **renders that variable's value in
 *      the running preview** — the criterion the panel cannot answer;
 *   4. switching back restores the literal;
 *   5. each direction is one undo step;
 *   6. a save/reload round-trips the expression parameter.
 *
 * ⚠️ (3) is the one that matters and the one a panel screenshot cannot give
 * you. This task's own traps list says it: *a declared `default` never runs its
 * setter, and this area has been bitten by it twice — check the rendered result
 * in the preview, not the property panel's display.*
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol011-fx-multiline.js
 *
 *     --theme=dark|light   criterion 1 wants both
 *     --source=<dir>       the project to copy (default: the pol010 chat copy)
 *     --shots=<dir>        a PNG of the property row per state
 *     --json               the full report
 *
 * ## Traps
 *
 * - Rows render through `Ports.renderParams` and **HMR lies about it**. Restart
 *   the stack between iterations.
 * - Run against a copy; the editor autosaves.
 * - `selectNode` wants the canvas node, not the graph model node.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const DEFAULT_SOURCE =
  '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/' +
  'e48712c9-6b72-4642-b15f-ffda2e7e3bcc/scratchpad/pol010-chat';

/** A Text node on the Chat page whose `text` is a literal and is wired from nothing. */
const NODE_ID = 'titleText';
const PORT = 'text';
const VARIABLE = 'pol011Greeting';
const VARIABLE_VALUE = 'Hello from a variable';

const PROBE = `(() => {
  if (!window.__pol011wr) {
    window.webpackChunknoodl_editor.push([['pol011'], {}, (r) => (window.__pol011wr = r)]);
  }
  return typeof window.__pol011wr === 'function';
})()`;

const REQ = (id) => `window.__pol011wr(${JSON.stringify(id)})`;

const M = {
  project: './src/editor/src/models/projectmodel.ts',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  undo: './src/editor/src/models/undo-queue-model.ts',
  theme: './src/editor/src/models/ThemeManager.ts',
  exprParam: './src/editor/src/models/ExpressionParameter.ts'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 30000, every = 300, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

async function clickSelector(client, selector, what = selector) {
  const box = await evaluate(
    client,
    `(() => {
       const el = document.querySelector(${JSON.stringify(selector)});
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, width: r.width, height: r.height,
                onTop: Boolean(hit && (el === hit || el.contains(hit))) };
     })()`
  );
  if (!box) throw new Error(`no element for ${what}`);
  if (!box.width || !box.height) throw new Error(`${what} has a zero-sized box`);
  if (!box.onTop) throw new Error(`${what} is not the topmost element at its own centre`);
  await dispatchClick(client, box);
  return box;
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
       return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
     })()`
  );
  if (!box) throw new Error(`no button reading "${label}"`);
  await dispatchClick(client, box);
}

async function openProject(client, dir) {
  const open = await evaluate(
    client,
    `(() => {
       const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
       return p ? (p._retainedProjectDirectory || 'unknown') : '';
     })()`
  );
  if (open) {
    await evaluate(client, `(() => { ${REQ(M.app)}.App.instance.exitProject(); return true; })()`);
    await waitFor(client, `(() => !document.querySelector('[data-panel-id]'))()`, { what: 'the launcher' });
    await sleep(1500);
  }
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
    { timeoutMs: 90000, what: 'the project to open' }
  );
}

const SELECT_NODE = `(() => {
  const project = ${REQ(M.project)}.ProjectModel.instance;
  let found = null;
  for (const component of project.getComponents()) {
    component.graph.forEachNode((node) => {
      if (!found && node.id === ${JSON.stringify(NODE_ID)}) found = { node, component };
    });
    if (found) break;
  }
  if (!found) return { error: 'no node with id ${NODE_ID} in this project' };
  window.__nodeGraphEditor.switchToComponent(found.component, { node: found.node });
  window.__pol011node = found.node;
  return { id: found.node.id, type: String(found.node.typename), component: found.component.name };
})()`;

const SELECT_ON_CANVAS = `(() => {
  const editor = window.__nodeGraphEditor;
  const node = editor && editor.findNodeWithId(window.__pol011node.id);
  if (!node) return false;
  editor.selectNode(node);
  return true;
})()`;

/**
 * The parameter, both ways.
 *
 * ⚠️ **`node.parameters[name]` and `getParameter(name)` are different questions**
 * and the difference cost this driver three false failures. The first is what
 * is stored — `null` when the port is at its declared default. The second
 * resolves the default, and it is what `expressionProps` reads when it captures
 * the fallback. So a port sitting at its default converts to an expression
 * whose fallback is the *default's* text, and a check comparing that to the
 * stored `null` reports a correct conversion as broken.
 */
const READ_PARAM = `(() => {
  const node = window.__pol011node;
  const stored = node.parameters[${JSON.stringify(PORT)}];
  return {
    raw: stored === undefined ? null : stored,
    resolved: node.getParameter(${JSON.stringify(PORT)}) ?? null,
    isExpression: ${REQ(M.exprParam)}.isExpressionParameter(stored)
  };
})()`;

/**
 * The fx toggle **of the row under test**.
 *
 * ⚠️ Not the first `ExpressionToggle` in the panel. The property editor renders
 * one per string row — six of them on this node — and clicking by class alone
 * is the "a click can land outside the panel that owns the button" trap with
 * the panel right. `data-property` names the row and survives the mode switch,
 * which `data-identifier` does not.
 */
const FX_TOGGLE = `[data-property="${PORT}"] [class*="ExpressionToggle"]`;

const UNDO_DEPTH = `(() => ${REQ(M.undo)}.UndoQueue.instance.getHistoryLocation())()`;

/** The property row for the port under test, and whether it offers `fx`. */
/**
 * The row under test, and only it.
 *
 * ⚠️ Scoped to `[data-property]`. A panel-wide query reported
 * `hasExpressionInput: true` while this row was still a plain textarea, because
 * a *different* row on the same node was in expression mode holding `1 + 1`.
 * That is a check that passes for a reason it is not measuring.
 */
const ROW = `(() => {
  const row = document.querySelector('[data-property=${JSON.stringify(PORT)}]');
  if (!row) return { error: 'no row for ${PORT}' };
  const input = row.querySelector('[data-identifier=${JSON.stringify(PORT)}]');
  const expr = row.querySelector('[class*="ExpressionInput"] input, [class*="ExpressionInput"] textarea');
  return {
    hasTextArea: Boolean(input && input.tagName === 'TEXTAREA'),
    textAreaValue: input && input.tagName === 'TEXTAREA' ? input.value : null,
    fxToggles: row.querySelectorAll('[class*="ExpressionToggle"]').length,
    panelToggles: document.querySelectorAll('[class*="ExpressionToggle"]').length,
    hasExpressionInput: Boolean(expr),
    expressionValue: expr ? expr.value : null
  };
})()`;

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function setStartPage(projectDir, startPage) {
  const file = path.join(projectDir, 'components/App/nodes.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const router = doc.nodes.find((n) => n.type === 'Router');
  router.parameters.pages.startPage = startPage;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

async function shoot(client, dir, name) {
  if (!dir) return null;
  const box = await evaluate(
    client,
    `(() => {
       const panel = document.querySelector('[data-panel-id="PropertyEditor"]');
       if (!panel) return null;
       const r = panel.getBoundingClientRect();
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

/** What the preview painted for this node, asked of the viewer itself. */
async function renderedText() {
  const target = await appTarget('viewer').catch(() => null);
  if (!target) return { error: 'no viewer' };
  const viewer = await connect(target);
  try {
    return await evaluate(viewer, `(() => (document.body.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 200))()`);
  } finally {
    viewer.close?.();
  }
}

async function setVariable() {
  const target = await appTarget('viewer').catch(() => null);
  if (!target) return false;
  const viewer = await connect(target);
  try {
    // The runtime's own API — the same thing a Script node calls.
    return await evaluate(
      viewer,
      `(() => { if (!window.Noodl || !Noodl.Variables) return false;
                Noodl.Variables[${JSON.stringify(VARIABLE)}] = ${JSON.stringify(VARIABLE_VALUE)};
                return true; })()`
    );
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
  const theme = arg('theme', 'dark');
  const shots = arg('shots', null);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const source = arg('source', DEFAULT_SOURCE);

  const projectDir = path.join(os.tmpdir(), `pol011-${process.pid}`);
  copyTree(source, projectDir);
  setStartPage(projectDir, '/Pages/Chat');

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { theme, projectDir };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('webpack require probe failed');
    await openProject(client, projectDir);
    await sleep(6000);
    await evaluate(client, `(() => { ${REQ(M.theme)}.ThemeManager.setMode(${JSON.stringify(theme)}); return true; })()`);
    await sleep(600);

    report.node = await evaluate(client, SELECT_NODE);
    if (report.node.error) throw new Error(report.node.error);
    await sleep(1500);
    await waitFor(client, SELECT_ON_CANVAS, { what: 'the node on the canvas' });
    await waitFor(client, `(() => !!document.querySelector('[data-identifier=${JSON.stringify(PORT)}]'))()`, {
      what: `the ${PORT} property row`
    });

    /* ---------------- criterion 1 — the row offers fx ---------------------- */
    const fixedRow = await evaluate(client, ROW);
    report.fixedRow = fixedRow;
    check(
      steps,
      "§1: the multiline row renders a textarea AND offers `fx`",
      fixedRow.hasTextArea && fixedRow.fxToggles > 0,
      JSON.stringify(fixedRow)
    );
    await shoot(client, shots, `${theme}-1-fixed`);

    // The RESOLVED value, which is what the conversion captures as the fallback.
    const literal = (await evaluate(client, READ_PARAM)).resolved;
    report.literal = literal;

    /* ---------------- criterion 2/3 — switch to expression ----------------- */
    const depthBefore = await evaluate(client, UNDO_DEPTH);
    await clickSelector(client, FX_TOGGLE, 'the fx toggle for this row');
    await sleep(800);
    const asExpression = await evaluate(client, READ_PARAM);
    report.asExpression = asExpression;

    check(
      steps,
      '§2: clicking `fx` converts the parameter, keeping the literal as the fallback',
      asExpression.isExpression && asExpression.raw && asExpression.raw.fallback === literal,
      JSON.stringify(asExpression.raw)
    );
    check(
      steps,
      '§3: enabling the expression is one undo step',
      (await evaluate(client, UNDO_DEPTH)) - depthBefore === 1,
      `undo depth ${depthBefore}→${await evaluate(client, UNDO_DEPTH)}`
    );

    // The row is now an expression input, not a textarea — an expression is one
    // line of code and the multiline affordance is about the literal.
    const exprRow = await evaluate(client, ROW);
    report.exprRow = exprRow;
    check(
      steps,
      '§2: in expression mode the row shows the expression input, not the textarea',
      exprRow.hasExpressionInput && !exprRow.hasTextArea,
      JSON.stringify(exprRow)
    );
    await shoot(client, shots, `${theme}-2-expression`);

    /* ---------------- criterion 2's real half — it evaluates --------------- */
    await evaluate(
      client,
      `(() => {
         const node = window.__pol011node;
         const current = node.parameters[${JSON.stringify(PORT)}];
         node.setParameter(${JSON.stringify(PORT)},
           { ...current, expression: 'Noodl.Variables.${VARIABLE}' },
           { undo: true, label: 'set expression' });
         return true;
       })()`
    );
    await sleep(2500);
    report.variableSet = await setVariable();
    await sleep(2500);
    report.renderedWithVariable = await renderedText();

    check(
      steps,
      '§2: the expression EVALUATES in the running preview, not just in the panel',
      typeof report.renderedWithVariable === 'string' &&
        report.renderedWithVariable.includes(VARIABLE_VALUE),
      `variableSet=${report.variableSet} rendered=${JSON.stringify(report.renderedWithVariable)}`
    );

    /* ---------------- criterion 4 — the saved project round-trips ---------- */
    // The editor autosaves a second after a change; `toDirectory` is the same
    // write, asked for rather than waited on, so the read below cannot race it.
    await evaluate(
      client,
      `(() => new Promise((resolve) => {
         const p = ${REQ(M.project)}.ProjectModel.instance;
         p.toDirectory(p._retainedProjectDirectory, (r) => resolve(r && r.result));
       }))()`
    );
    await sleep(1500);
    const readOnDisk = () => {
      const file = path.join(projectDir, 'components/Pages/Chat/nodes.json');
      if (!fs.existsSync(file)) return { error: 'nodes.json not found', file };
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      const node = (doc.nodes || []).find((n) => n.id === NODE_ID);
      return node ? node.parameters[PORT] : { error: 'node not in the saved file' };
    };
    const onDisk = readOnDisk();
    report.onDisk = onDisk;
    check(
      steps,
      '§4: the expression parameter survives a save, expression and fallback both',
      onDisk && onDisk.expression === `Noodl.Variables.${VARIABLE}` && onDisk.fallback === literal,
      JSON.stringify(onDisk)
    );

    /* ---------------- criterion 3 — back to fixed -------------------------- */
    const depthBeforeBack = await evaluate(client, UNDO_DEPTH);
    await clickSelector(client, FX_TOGGLE, 'the fx toggle for this row (off)');
    await sleep(800);
    const backToFixed = await evaluate(client, READ_PARAM);
    report.backToFixed = backToFixed;

    check(
      steps,
      '§3: switching back restores the literal',
      !backToFixed.isExpression && backToFixed.raw === literal,
      JSON.stringify(backToFixed)
    );
    check(
      steps,
      '§3: disabling the expression is also one undo step',
      (await evaluate(client, UNDO_DEPTH)) - depthBeforeBack === 1,
      `undo depth ${depthBeforeBack}→${await evaluate(client, UNDO_DEPTH)}`
    );
    await shoot(client, shots, `${theme}-3-back-to-fixed`);
  } finally {
    client.close?.();
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(JSON.stringify(argv.includes('--json') ? { steps, report } : { steps }, null, 2));
  console.log(`\n${steps.length - failed.length}/${steps.length} checks passed (${theme}). Copy in ${projectDir}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(2);
});
