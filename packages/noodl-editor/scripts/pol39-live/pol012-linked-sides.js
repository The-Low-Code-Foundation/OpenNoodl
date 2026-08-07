#!/usr/bin/env node
/**
 * POL-012 — set all four sides at once.
 *
 * > *"Where there's the option to add padding or margins, can you add an option
 * > to set all values at once? Instead of having to click in and out of each
 * > bottom, top, left, right field individually and type the same number."*
 *
 * The layout half of this is only provable in a laid-out browser and the undo
 * half is only provable against the real `UndoQueue`, so both are driven here
 * rather than asserted in a unit test. Everything is measured on a **real node
 * in a real project**: the toggle is clicked with a trusted click, the value is
 * typed into the real edit box, and the four parameters are read back off
 * `NodeGraphNode.parameters` — which is what gets written to disk.
 *
 * ## The four things that are easy to get quietly wrong
 *
 *  1. **Turning the lock on writes something.** Criterion 4. Measured by
 *     snapshotting all four parameters across the toggle and comparing.
 *  2. **Four undo entries for one gesture.** The reported defect's other half.
 *     Measured against `UndoQueue.instance` depth, and then by pressing undo
 *     *once* and checking all four came back — a queue that grew by one but
 *     restores one side would pass a depth check and fail a user.
 *  3. **The unit does not follow.** Set up deliberately: one side is put on `%`
 *     before the linked write, so the run proves the mixed-unit case rather
 *     than a uniform one.
 *  4. **The lock leaks into the project.** It is how you are typing, not what
 *     the project is. Measured by exporting the node's parameters and looking
 *     for anything lock-shaped.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol012-linked-sides.js
 *
 *     --theme=dark|light   criterion 7 wants both; run it twice
 *     --shots=<dir>        a PNG of the widget per state
 *     --json               the full report
 *
 * ## Traps
 *
 * - Run against a copy. The editor autosaves.
 * - `MarginPaddingType` re-renders through `createRoot` on a `setTimeout(…, 0)`
 *   in places, so a read taken in the same tick as a click can predate the
 *   render. Every read here waits for the value it expects rather than sleeping.
 * - Restart the stack between iterations; HMR does not re-apply to a mounted
 *   property editor.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROBE = `(() => {
  if (!window.__pol012wr) {
    window.webpackChunknoodl_editor.push([['pol012'], {}, (r) => (window.__pol012wr = r)]);
  }
  return typeof window.__pol012wr === 'function';
})()`;

const REQ = (id) => `window.__pol012wr(${JSON.stringify(id)})`;

const M = {
  project: './src/editor/src/models/projectmodel.ts',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  undo: './src/editor/src/models/undo-queue-model.ts',
  theme: './src/editor/src/models/ThemeManager.ts'
};

/** The four port names behind each group, as the node declares them. */
const PORTS = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 30000, every = 250, what = 'condition' } = {}) {
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
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, onTop: Boolean(hit && (el === hit || el.contains(hit))) };
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

/**
 * Find a node that actually has all eight ports and select it, which is what
 * opens the property editor.
 *
 * By port rather than by type: "a Group" is an assumption about the corpus, and
 * "a node whose parameters include paddingTop" is the thing under test.
 */
const SELECT_NODE = `(() => {
  const project = ${REQ(M.project)}.ProjectModel.instance;
  let found = null;
  for (const component of project.getComponents()) {
    component.graph.forEachNode((node) => {
      if (found) return;
      const names = node.getPorts().map((p) => p.name);
      const hasAll = ['paddingTop','paddingRight','paddingBottom','paddingLeft',
                      'marginTop','marginRight','marginBottom','marginLeft']
        .every((n) => names.indexOf(n) !== -1);
      if (hasAll) found = { node, component };
    });
    if (found) break;
  }
  if (!found) return { error: 'no node in this project has all eight margin/padding ports' };

  const editor = window.__nodeGraphEditor;
  if (!editor) return { error: 'no node graph editor' };
  editor.switchToComponent(found.component, { node: found.node });
  window.__pol012node = found.node;
  return { id: found.node.id, type: String(found.node.typename), component: found.component.name };
})()`;

/**
 * Select it, which is what opens the property editor.
 *
 * ⚠️ `selectNode` wants the **canvas** node, not the graph model node. Handing
 * it the model throws inside `getNodePanelName` reading `.type` of undefined —
 * a stack trace three files deep from a mistake made here. And the canvas node
 * only exists once `switchToComponent` has rendered, which is why this is a
 * second step with a wait between.
 */
const SELECT_ON_CANVAS = `(() => {
  const editor = window.__nodeGraphEditor;
  const node = editor && editor.findNodeWithId(window.__pol012node.id);
  if (!node) return false;
  editor.selectNode(node);
  return true;
})()`;

/** The four parameters of one group, straight off the model. */
const READ = (side) => `(() => {
  const node = window.__pol012node;
  if (!node) return { error: 'no node' };
  const out = {};
  for (const name of ${JSON.stringify(PORTS[side])}) out[name] = node.parameters[name] ?? null;
  return out;
})()`;

// `getHistoryLocation()`, not `getHistory().length`: the pointer is what an
// undo press moves, and a queue that was truncated by a later push would make
// the length lie about how many steps a gesture cost.
const UNDO_DEPTH = `(() => ${REQ(M.undo)}.UndoQueue.instance.getHistoryLocation())()`;

const UNDO_LABELS = `(() => ${REQ(M.undo)}.UndoQueue.instance.getHistory().slice(-4).map((g) => g.label))()`;

/* -------------------------------------------------------------------------- */

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function shoot(client, dir, name) {
  if (!dir) return null;
  const box = await evaluate(
    client,
    `(() => {
       const el = document.querySelector('.marginpadding-outer');
       if (!el) return null;
       const r = el.parentElement.getBoundingClientRect();
       return { x: Math.round(r.left) - 6, y: Math.round(r.top) - 6,
                width: Math.round(r.width) + 12, height: Math.round(r.height) + 12 };
     })()`
  );
  const params = { format: 'png', captureBeyondViewport: false };
  if (box && box.width > 0) params.clip = { ...box, scale: 2 };
  const { data } = await client.send('Page.captureScreenshot', params);
  const file = path.join(dir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

/** Type a value into one side through the widget's own edit box. */
async function typeInto(client, comp, text) {
  await clickSelector(client, `[data-comp="${comp}"]`, `the ${comp} label`);
  await waitFor(client, `(() => !!document.querySelector('.marginpadding-editbox input'))()`, {
    what: 'the edit box'
  });
  await evaluate(
    client,
    `(() => {
       const el = document.querySelector('.marginpadding-editbox input');
       Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
         .call(el, ${JSON.stringify(text)});
       el.dispatchEvent(new Event('input', { bubbles: true }));
       return true;
     })()`
  );
  await sleep(200);
}

async function commitEdit(client) {
  await evaluate(
    client,
    `(() => {
       const el = document.querySelector('.marginpadding-editbox input');
       if (!el) return false;
       el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
       return true;
     })()`
  );
  await sleep(500);
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

  const projectDir = path.join(os.tmpdir(), `pol012-${process.pid}`);
  fs.cpSync(CORPUS_PROJECT_DIR, projectDir, { recursive: true });
  fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { theme, projectDir };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('webpack require probe failed');
    await openProject(client, projectDir);
    await sleep(4000);
    await evaluate(client, `(() => { ${REQ(M.theme)}.ThemeManager.setMode(${JSON.stringify(theme)}); return true; })()`);
    await sleep(600);

    report.node = await evaluate(client, SELECT_NODE);
    if (report.node.error) throw new Error(report.node.error);
    await sleep(1500);
    await waitFor(client, SELECT_ON_CANVAS, { timeoutMs: 30000, what: 'the node to appear on the canvas' });
    await waitFor(client, `(() => !!document.querySelector('.marginpadding-outer'))()`, {
      timeoutMs: 30000,
      what: 'the margin/padding widget'
    });

    /* ---------------- criterion 1 — both toggles, independently ------------ */
    const toggles = await evaluate(
      client,
      `(() => ['margin','padding'].map((side) => {
         const el = document.querySelector('[data-test="marginpadding-link-' + side + '"]');
         if (!el) return { side, present: false };
         const r = el.getBoundingClientRect();
         return { side, present: true, pressed: el.getAttribute('aria-pressed'),
                  width: Math.round(r.width), height: Math.round(r.height),
                  label: el.getAttribute('aria-label') };
       }))()`
    );
    report.toggles = toggles;
    check(
      steps,
      '§1: a link toggle on the padding group and on the margin group',
      toggles.length === 2 && toggles.every((t) => t.present && t.width > 0 && t.height > 0),
      JSON.stringify(toggles)
    );
    // ⚠️ **A toggle that works and sits on top of something is not done.** The
    // first placement put each one beside its group's tag and it covered the
    // tag's last letters — "MARGIN⛓", "PADDIN⛓" — and, for padding, the
    // padding-top field as well. `11/11` said nothing about it; only a
    // screenshot did. So the overlap is a measurement now.
    const overlaps = await evaluate(
      client,
      `(() => {
         const hits = [];
         const others = Array.from(document.querySelectorAll('.marginpadding-tag, .marginpadding-label'));
         for (const side of ['margin', 'padding']) {
           const el = document.querySelector('[data-test="marginpadding-link-' + side + '"]');
           if (!el) continue;
           const a = el.getBoundingClientRect();
           for (const other of others) {
             const b = other.getBoundingClientRect();
             if (a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) continue;
             hits.push({ side, over: (other.innerText || '').trim() || other.className,
                         comp: other.getAttribute('data-comp') });
           }
         }
         return hits;
       })()`
    );
    report.overlaps = overlaps;
    check(
      steps,
      '§1: neither toggle sits on top of a tag or a value field',
      overlaps.length === 0,
      overlaps.length ? JSON.stringify(overlaps) : 'no overlap with any tag or label'
    );

    // ⚠️ Both start ON, and that is the rule rather than an accident: a node
    // whose four sides are all untouched has four sides that *agree*, which is
    // exactly the condition the spec says may switch linking on by itself. The
    // rule it forbids is flattening four values that differ, and that is the
    // case measured below.
    check(
      steps,
      '§4: linking starts on where the four sides already agree — an untouched node',
      toggles.every((t) => t.pressed === 'true'),
      toggles.map((t) => `${t.side}=${t.pressed}`).join(' ')
    );
    await shoot(client, shots, `${theme}-1-initial`);

    /* ---------------- criterion 5's setup — a genuinely mixed group -------- */
    // One side put on `%` while the other three are unset. The linked write
    // below therefore has to *resolve* a mixed group, which is the case the
    // criterion names; a uniform group would prove nothing about units.
    await evaluate(
      client,
      `(() => { window.__pol012node.setParameter('paddingTop', { value: 7, unit: '%' }); return true; })()`
    );
    await sleep(400);
    report.beforeToggle = await evaluate(client, READ('padding'));

    /* ---------------- criterion 4 — the toggle itself writes nothing ------- */
    // Off and on again, so both directions are covered and the group ends up
    // linked for the write that follows.
    const depthBeforeToggle = await evaluate(client, UNDO_DEPTH);
    await clickSelector(client, '[data-test="marginpadding-link-padding"]', 'the padding link toggle');
    await sleep(400);
    const offState = await evaluate(
      client,
      `(() => document.querySelector('[data-test="marginpadding-link-padding"]').getAttribute('aria-pressed'))()`
    );
    await clickSelector(client, '[data-test="marginpadding-link-padding"]', 'the padding link toggle');
    await sleep(400);
    const afterToggle = await evaluate(client, READ('padding'));
    const depthAfterToggle = await evaluate(client, UNDO_DEPTH);
    report.afterToggle = afterToggle;

    check(
      steps,
      '§4: toggling the lock off and on changes no value and records no undo step',
      same(report.beforeToggle, afterToggle) && depthAfterToggle === depthBeforeToggle,
      `before=${JSON.stringify(report.beforeToggle)} after=${JSON.stringify(afterToggle)} ` +
        `undo ${depthBeforeToggle}→${depthAfterToggle}`
    );
    check(
      steps,
      '§1: the toggle reports its own state, both ways',
      offState === 'false' &&
        (await evaluate(
          client,
          `(() => document.querySelector('[data-test="marginpadding-link-padding"]').getAttribute('aria-pressed'))()`
        )) === 'true',
      `off→${offState}, then on again`
    );

    // Independence: unlock margin and check padding is unaffected.
    await clickSelector(client, '[data-test="marginpadding-link-margin"]', 'the margin link toggle');
    await sleep(400);
    const independent = await evaluate(
      client,
      `(() => ({
         margin: document.querySelector('[data-test="marginpadding-link-margin"]').getAttribute('aria-pressed'),
         padding: document.querySelector('[data-test="marginpadding-link-padding"]').getAttribute('aria-pressed')
       }))()`
    );
    check(
      steps,
      '§1: the two groups lock independently',
      independent.margin === 'false' && independent.padding === 'true',
      JSON.stringify(independent)
    );
    await shoot(client, shots, `${theme}-2-padding-linked`);

    /* ---------------- criterion 2, 3, 5 — one gesture sets four ------------ */
    const depthBeforeWrite = await evaluate(client, UNDO_DEPTH);
    await typeInto(client, 'padding-left', '16');

    // Criterion 2's "live": the siblings preview the typed value before commit.
    const previewed = await evaluate(
      client,
      `(() => Array.from(document.querySelectorAll('[data-comp^="padding-"]'))
                .map((el) => ({ comp: el.getAttribute('data-comp'), text: (el.innerText || '').trim() })))()`
    );
    report.previewed = previewed;
    check(
      steps,
      '§2: all four fields show the typed value before it is committed',
      previewed.length === 4 && previewed.every((p) => p.text === '16'),
      JSON.stringify(previewed)
    );
    await shoot(client, shots, `${theme}-3-typing`);

    await commitEdit(client);
    const written = await evaluate(client, READ('padding'));
    const depthAfterWrite = await evaluate(client, UNDO_DEPTH);
    report.written = written;

    check(
      steps,
      '§2: one typed value reaches all four parameters',
      PORTS.padding.every((n) => written[n] && written[n].value === 16),
      JSON.stringify(written)
    );
    check(
      steps,
      '§5: the unit follows too, resolving the mixed-unit group',
      PORTS.padding.every((n) => written[n] && written[n].unit === 'px'),
      `paddingTop started on % — now ${JSON.stringify(written.paddingTop)}`
    );
    check(
      steps,
      '§3: that gesture is ONE undo step, not four',
      depthAfterWrite - depthBeforeWrite === 1,
      `undo depth ${depthBeforeWrite}→${depthAfterWrite}; ` +
        `labels ${JSON.stringify(await evaluate(client, UNDO_LABELS))}`
    );

    /* ---------------- criterion 3, properly — one undo restores four ------- */
    await evaluate(client, `(() => { ${REQ(M.undo)}.UndoQueue.instance.undo(); return true; })()`);
    await sleep(600);
    const undone = await evaluate(client, READ('padding'));
    report.undone = undone;
    check(
      steps,
      '§3: pressing undo ONCE restores all four sides',
      same(undone, report.beforeToggle),
      `after undo ${JSON.stringify(undone)} — expected ${JSON.stringify(report.beforeToggle)}`
    );

    /* ---------------- criterion 6 — nothing lock-shaped on the model ------- */
    const exported = await evaluate(
      client,
      `(() => JSON.stringify(window.__pol012node.parameters))()`
    );
    report.parameters = exported;
    check(
      steps,
      '§6: the lock is not written to the project',
      !/link|lock/i.test(exported),
      exported.slice(0, 300)
    );

    await shoot(client, shots, `${theme}-4-after-undo`);
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
