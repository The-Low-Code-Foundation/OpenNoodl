#!/usr/bin/env node
/**
 * POL-008 Part B, slice 1 — the re-judge.
 *
 * > *"Re-judge after POL-006. **Genuinely**: build the same Profile page again
 * > with a font present. If it is still bare, continue."*
 *
 * The re-judge is the first slice, not a formality, and it is the gate on
 * whether the rest of Part B is worth building. So this drives the surface
 * Richard used — the Build panel's single-component loop, against the **real
 * provider** — on the same brief, and captures what came out: the rendered
 * preview, the node count, and whether the text is laid out in the project font
 * rather than browser-default serif.
 *
 * ⚠️ **This spends provider money.** One authoring session, a handful of turns.
 * It is the only way to answer the question the task asks: everything cheaper
 * measures a recording of a model rather than a model.
 *
 * ## What it captures, and what it deliberately does not
 *
 * It records, it does not score. "Is this page still basic AF?" is a judgement
 * about a rendered picture and a human makes it — a pass/fail number here would
 * be measuring the harness's opinion of a model's taste. What the harness can
 * state without opinion is: the node count, the type/spacing/colour parameters
 * present anywhere in the candidate, and the computed `font-family` of the text
 * the preview actually painted. Those are the three things POL-008 Part B's
 * causes 1–3 predict will move.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol008b-rejudge.js --shots=<dir>
 *
 *     --brief=<text>   override the brief (default: Richard's profile page)
 *     --json           the full report
 *
 * ## Traps
 *
 * - Always a copy: the editor rewrites and autosaves any project it opens, and
 *   accepting a candidate writes to it.
 * - `document.fonts.check()` answers false for a webface nothing has rendered
 *   yet. `await document.fonts.load(...)` first, then check — and
 *   `getComputedStyle().fontFamily` returns the *declared* stack whether or not
 *   a byte was fetched, so only the pair of them is evidence. POL-006's lesson,
 *   applied here.
 * - The preview is a `<webview>`; navigate it, never close its CDP target.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PROJECT_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

/**
 * Richard's brief, as close to the reported one as it can be stated.
 *
 * > *"I did the AI builder thing to make a profile page."*
 *
 * The screenshot's change list names what it built — a Current User, a User
 * Name text and a User Email text — so the brief that produced it asked for a
 * profile page bound to the signed-in user. Nothing here asks for styling: the
 * whole question is what the agent does when it is *not* told to.
 */
const BRIEF = 'A profile page showing the signed-in member: their name, their email address and their avatar.';
// ⚠️ NOT `Pages/Profile`: the corpus already has one, so the panel switches to
// "Update it" and proposes a revision. Richard's report was a **create** — the
// question is what the agent builds from nothing, not what it changes.
const COMPONENT_PATH = 'Pages/Member Profile';

const PROBE = `(() => {
  if (!window.__pol008bwr) {
    window.webpackChunknoodl_editor.push([['pol008b'], {}, (r) => (window.__pol008bwr = r)]);
  }
  return typeof window.__pol008bwr === 'function';
})()`;

const REQ = (id) => `window.__pol008bwr(${JSON.stringify(id)})`;

const M = {
  project: './src/editor/src/models/projectmodel.ts',
  sidebar: './src/editor/src/models/sidebar/sidebarmodel.tsx',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  planStore: './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 60000, every = 500, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

async function clickButtonWithText(client, label, scope = 'body') {
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
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, onTop: Boolean(hit && (el === hit || el.contains(hit))) };
     })()`
  );
  if (!box) throw new Error(`no button reading "${label}"`);
  if (!box.onTop) throw new Error(`button "${label}" is not topmost at its own centre`);
  await dispatchClick(client, box);
}

/** React-safe value set: the native setter, then an `input` event. */
function setField(selector, value) {
  return `(() => {
     const el = document.querySelector(${JSON.stringify(selector)});
     if (!el) return false;
     const proto = el instanceof window.HTMLTextAreaElement
       ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
     Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
     el.dispatchEvent(new Event('input', { bubbles: true }));
     return true;
   })()`;
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
 * What the candidate is made of, read off the staged files rather than off the
 * screen.
 *
 * The three counts are Part B's three causes, made countable: how many nodes
 * (the "six nodes for a profile page" complaint), how many carry any *visual*
 * parameter at all, and which of them are spacing, type or colour. A page whose
 * nodes carry no `padding`, no `fontSize` and no `backgroundColor` is bare by
 * construction, whatever it looks like.
 */
const CANDIDATE = `(() => {
  // ⚠️ Read off the **project**, after accepting, not out of the panel's React
  // state. The single-component session lives in a ref inside
  // \`AiAuthoringPanel\` and is unreachable from outside it; accepting is the
  // path a user takes anyway, the project here is a throwaway copy, and what
  // lands in \`ProjectModel\` is by definition what the agent produced.
  const project = ${REQ(M.project)}.ProjectModel.instance;
  const component = project && project.getComponentWithName(${JSON.stringify('/' + 'Pages/Member Profile')});
  if (!component) {
    return { error: 'the candidate was not accepted into the project',
             components: project ? project.getComponents().map((c) => c.name).slice(-6) : null };
  }

  const SPACING = /^(padding|margin|gap)/i;
  const TYPE = /^(fontSize|fontFamily|font|textStyle|letterSpacing|lineHeight|textAlign|textStyleName)/i;
  const COLOUR = /^(color|backgroundColor|borderColor|textColor|colorStyle)/i;

  const nodes = [];
  component.graph.forEachNode((n) => nodes.push(n));
  const params = [];
  for (const node of nodes) for (const key of Object.keys(node.parameters || {})) params.push(key);

  return {
    nodeCount: nodes.length,
    types: nodes.map((n) => String(n.typename)),
    labels: nodes.map((n) => n.label || null),
    parameterCount: params.length,
    spacing: params.filter((p) => SPACING.test(p)),
    typography: params.filter((p) => TYPE.test(p)),
    colour: params.filter((p) => COLOUR.test(p)),
    allParameters: Array.from(new Set(params)).sort(),
    connections: component.graph.connections ? component.graph.connections.length : null
  };
})()`;

/** What the preview painted, including whether the font actually loaded. */
const RENDERED = `(async () => {
  const texts = Array.from(document.querySelectorAll('div, span, p'))
    .filter((el) => el.children.length === 0 && (el.innerText || '').trim())
    .slice(0, 8)
    .map((el) => {
      const s = getComputedStyle(el);
      return { text: (el.innerText || '').trim().slice(0, 40), fontFamily: s.fontFamily,
               fontSize: s.fontSize, color: s.color };
    });

  // ⚠️ POL-006: check() is false for a face nothing has rendered yet, so load
  // first. And the computed stack is what was *declared* whether or not a byte
  // arrived — only the pair is evidence.
  let interLoaded = false;
  try {
    await document.fonts.load('400 16px Inter');
    interLoaded = document.fonts.check('400 16px Inter');
  } catch (e) { /* no font API is an answer too */ }

  return {
    body: (document.body.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 300),
    bodyFont: getComputedStyle(document.body).fontFamily,
    texts,
    interLoaded
  };
})()`;

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : d;
  };
  const shots = arg('shots', null);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const brief = arg('brief', BRIEF);

  const projectDir = path.join(os.tmpdir(), `pol008b-${process.pid}`);
  fs.cpSync(CORPUS_PROJECT_DIR, projectDir, { recursive: true });
  fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });

  const client = await connect(await appTarget('editor'));
  const report = { projectDir, brief };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('webpack require probe failed');
    await openProject(client, projectDir);
    await sleep(4000);

    await evaluate(client, `(() => { ${REQ(M.sidebar)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
    await sleep(1500);
    await clickButtonWithText(client, 'This component', '[data-panel-id="ai-authoring"]');

    // The scope tab swaps the form, and React mounts it a tick later. Waiting
    // for the field beats sleeping at it: the failure mode of a short sleep is
    // "no component-name field in the Build panel", which reads like the panel
    // does not have one.
    await waitFor(
      client,
      `(() => {
         const p = document.querySelector('[data-panel-id="ai-authoring"]');
         return !!(p && p.querySelector('input') && p.querySelector('textarea'));
       })()`,
      { timeoutMs: 30000, what: "the Build panel's single-component form" }
    );

    if (!(await evaluate(client, setField('[data-panel-id="ai-authoring"] input', COMPONENT_PATH)))) {
      throw new Error('no component-name field in the Build panel');
    }
    if (!(await evaluate(client, setField('[data-panel-id="ai-authoring"] textarea', brief)))) {
      throw new Error('no description field in the Build panel');
    }
    await sleep(400);
    await clickButtonWithText(client, 'Build it', '[data-panel-id="ai-authoring"]');

    // ⚠️ **The end of the run is the Stop button going away, not a keyword in
    // the panel.** Matching prose fired while the session was still authoring —
    // the panel already contains words like "Discard" further down — and the
    // driver read a half-finished state and reported no candidate.
    const stopVisible = `(() => {
      const p = document.querySelector('[data-panel-id="ai-authoring"]');
      if (!p) return false;
      return Array.from(p.querySelectorAll('button, [role=button]'))
        .some((b) => (b.innerText || '').trim().toLowerCase() === 'stop');
    })()`;
    await waitFor(client, stopVisible, { timeoutMs: 60000, every: 500, what: 'the session to start' });
    // A real provider run. Generous, and it reports what it saw rather than
    // asserting a duration — an occluded Electron window throttles timers to
    // about one wake a minute, which reads exactly like a hang.
    await waitFor(client, `(() => !${stopVisible})()`, {
      timeoutMs: 600000,
      every: 3000,
      what: 'the authoring session to finish'
    });
    await sleep(4000);

    const panelState = `(() => {
      const p = document.querySelector('[data-panel-id="ai-authoring"]');
      if (!p) return null;
      return { text: (p.innerText || '').slice(0, 1500),
               buttons: Array.from(p.querySelectorAll('button, [role=button]'))
                 .map((b) => (b.innerText || '').trim()).filter(Boolean) };
    })()`;
    report.panelAfterBuild = await evaluate(client, panelState);

    if (shots) {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(shots, 'editor-after-build.png'), Buffer.from(data, 'base64'));
    }

    // The sandbox preview, captured **before** accepting: this is the picture
    // Richard was looking at when he said "basic AF", and accepting replaces it
    // with the project's own preview.
    const viewer = await appTarget('viewer').catch(() => null);
    if (viewer) {
      const v = await connect(viewer);
      try {
        report.rendered = await evaluate(v, RENDERED);
        if (shots) {
          const { data } = await v.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(shots, 'preview-after-build.png'), Buffer.from(data, 'base64'));
        }
      } finally {
        v.close?.();
      }
    }

    // Accept, so the counts can be read off the project rather than out of a
    // React ref. The project is a throwaway copy made at the top of this file.
    const acceptLabel = (report.panelAfterBuild?.buttons || []).find((b) => /^(accept|apply|add to project)/i.test(b));
    if (acceptLabel) {
      await clickButtonWithText(client, acceptLabel, '[data-panel-id="ai-authoring"]');
      await sleep(5000);
      report.accepted = acceptLabel;
    }
    report.candidate = await evaluate(client, CANDIDATE);
  } finally {
    client.close?.();
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(2);
});
