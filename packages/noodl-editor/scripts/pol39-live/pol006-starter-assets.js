#!/usr/bin/env node
/**
 * POL-006 — a new project ships a font and an icon set, and both actually render.
 *
 * Creates a project through `LocalProjectsModel.newProject` — the one method the manual wizard and
 * the AI scoping wizard both reach the project through, which is why criterion 7 needs no separate
 * pass — then opens it and checks each criterion where it can only be checked: on disk, in the
 * running preview, in the icon picker, and in a real deploy build.
 *
 * ## The check that matters, and the one that would have lied
 *
 * `getComputedStyle(el).fontFamily` returns the *declared* stack. It says `Inter, ui-sans-serif, …`
 * whether or not a single byte of Inter was ever fetched, so on its own it proves nothing — it
 * would have passed before this task started. `document.fonts.check('16px Inter')` is the question
 * worth asking: has a face for that family actually loaded in this document. Both are recorded;
 * only the second is evidence.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol006-starter-assets.js [--keep] [--json]
 *
 * The project is created in a temp directory and removed afterwards unless `--keep`.
 * The editor must be running via `npm run dev:debug`, on the launcher with no project open.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const PROBE = `(() => {
  if (!window.__pol006wr) {
    window.webpackChunknoodl_editor.push([['pol006'], {}, (r) => (window.__pol006wr = r)]);
  }
  return typeof window.__pol006wr === 'function';
})()`;
const REQ = (id) => `window.__pol006wr(${JSON.stringify(id)})`;

const LOCAL_PROJECTS_MODULE = './src/editor/src/utils/LocalProjectsModel.ts';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const TOKEN_CSS_MODULE = './src/editor/src/models/StyleTokensModel/ProjectTokenCss.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';

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

/** Resolve and click in one eval, and never click a box that is not the topmost element at it. */
async function clickButtonWithText(client, text) {
  const box = await evaluate(
    client,
    `(() => {
       const want = ${JSON.stringify(text)}.toLowerCase();
       const el = Array.from(document.querySelectorAll('button, [role=button]'))
         .find((b) => (b.innerText || '').trim().toLowerCase().startsWith(want));
       if (!el) return null;
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, width: r.width, height: r.height, onTop: Boolean(hit && (el === hit || el.contains(hit))) };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  if (!box.width || !box.height) throw new Error(`button "${text}" has a zero-sized box`);
  if (!box.onTop) throw new Error(`button "${text}" is not topmost at its own centre — refusing to click blind`);
  await dispatchClick(client, box);
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

  const dir = path.join(os.tmpdir(), `pol006-qa-${process.pid}`);
  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { dir, steps };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');

    const open = await evaluate(
      client,
      `(() => { const p = ${REQ(PROJECT_MODULE)}.ProjectModel.instance; return p ? p._retainedProjectDirectory : ''; })()`
    );
    if (open) throw new Error(`a project is already open (${open}) — this needs the launcher`);

    // ── Criterion 1 + 7: the one creation path both wizards take ────────────
    const made = await evaluate(
      client,
      `(async () => {
         const { LocalProjectsModel } = ${REQ(LOCAL_PROJECTS_MODULE)};
         return await new Promise((resolve) => {
           LocalProjectsModel.instance.newProject(
             (project) => resolve(project ? { ok: true, dir: project._retainedProjectDirectory } : { ok: false }),
             { name: 'Pol006Qa', path: ${JSON.stringify(dir)} }
           );
         });
       })()`
    );
    if (!made.ok) throw new Error('newProject returned no project');

    const files = [];
    const walk = (base, rel = '') => {
      for (const entry of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
        const next = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(base, next);
        else files.push(next);
      }
    };
    walk(made.dir);
    report.files = files;

    const wants = [
      'noodl_modules/inter/manifest.json',
      'noodl_modules/inter/styles.css',
      'noodl_modules/inter/Inter-Regular.ttf',
      'noodl_modules/inter/Inter-Medium.ttf',
      'noodl_modules/inter/Inter-SemiBold.ttf',
      'noodl_modules/inter/Inter-Bold.ttf',
      'noodl_modules/inter/LICENSE.txt',
      'noodl_modules/lucide-icons/manifest.json',
      'noodl_modules/lucide-icons/styles.css',
      'noodl_modules/lucide-icons/lucide.woff2'
    ];
    const absent = wants.filter((w) => !files.includes(w));
    check(steps, '§1: a new project contains the font files and the Lucide icon set', absent.length === 0,
      absent.length ? `missing: ${absent.join(', ')}` : `${files.length} files, ${wants.length} of them starter assets`);

    // ── Criterion 6: nothing points at a CDN ────────────────────────────────
    const remote = [];
    for (const file of files.filter((f) => /\.(css|json)$/.test(f))) {
      const text = fs.readFileSync(path.join(made.dir, file), 'utf8');
      for (const m of text.matchAll(/https?:\/\/[^"')\s]+/g)) {
        // A licence URL in a comment is a reference, not a request. Only `src:`/`url()`/`href`
        // reach the network.
        if (/url\(\s*['"]?$|src\s*:\s*$|href=["']$/.test(text.slice(Math.max(0, m.index - 12), m.index))) {
          remote.push(`${file}: ${m[0]}`);
        }
      }
    }
    check(steps, '§6: no starter asset fetches anything over the network', remote.length === 0,
      remote.length ? remote.join(' | ') : 'every url() and src: is project-relative');

    // ── Criterion 5: the token names Inter, in the shared generator ─────────
    const tokenLine = await evaluate(
      client,
      `(() => {
         const css = ${REQ(TOKEN_CSS_MODULE)}.generateProjectTokenCss({ getMetaData: () => undefined });
         return (css.split('\\n').find((l) => l.includes('--font-sans')) || '').trim();
       })()`
    );
    check(steps, '§5: --font-sans names Inter and still has a fallback stack',
      /^--font-sans:\s*Inter,/.test(tokenLine) && /sans-serif/.test(tokenLine), tokenLine);

    // ── Open it, and run the preview ────────────────────────────────────────
    // Through the launcher's own button, not `openProjectFromFolder`. That method loads the model
    // but does not route the editor to it, so `ProjectModel.instance` stays null and everything
    // after this would be measuring the launcher. `filesystem.openDialog` returns the directory
    // STRING, not `{ filePaths: [...] }`.
    await evaluate(
      client,
      `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(made.dir)}; return true; })()`
    );
    await clickButtonWithText(client, 'Open project');
    await waitFor(client, `(() => !!${REQ(PROJECT_MODULE)}.ProjectModel.instance)()`, { what: 'the project to open' });
    await sleep(5000);

    // ── Criterion 3: the picker sees the set ────────────────────────────────
    const sets = await evaluate(
      client,
      `(async () => {
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         return await new Promise((resolve) => project.listIconSets(resolve));
       })()`
    );
    report.iconSets = sets;
    const lucide = (sets || []).find((s) => s.moduleName === 'lucide-icons');
    check(steps, '§3: the Lucide set is installed, as a font set with a curated list',
      Boolean(lucide) && lucide.kind === 'font' && lucide.icons.length > 100 && lucide.icons.length < 400,
      lucide ? `${lucide.name}: ${lucide.icons.length} glyphs, kind=${lucide.kind}, warnings=${lucide.warnings.length}` : 'no lucide-icons set');
    check(steps, '§3: the set loaded without warnings', Boolean(lucide) && lucide.warnings.length === 0,
      lucide ? lucide.warnings.join(' | ') || 'none' : 'n/a');

    // ── Criterion 2: Inter actually loads in the preview ────────────────────
    let viewer;
    try {
      viewer = await connect(await appTarget('viewer'));
    } catch (error) {
      throw new Error(`no viewer target — is the preview running? (${error.message})`);
    }
    try {
      const font = await waitFor(
        viewer,
        `(async () => {
           await document.fonts.ready;
           const link = Array.from(document.querySelectorAll('link[rel=stylesheet]'))
             .map((l) => l.getAttribute('href')).filter((h) => /inter|lucide/.test(h || ''));
           const el = Array.from(document.querySelectorAll('div,span,p'))
             .find((n) => (n.textContent || '').trim().length > 0 && n.children.length === 0);
           const declared = el ? getComputedStyle(el).fontFamily : '';
           // NOTE: document.fonts.check() alone is NOT the question. A webface that nothing has
           // rendered yet sits at status 'unloaded', and check() answers false for it — which is
           // what this reported for four perfectly good Inter faces. Call load() first, then
           // check; that distinguishes "the file is not there" from "nothing has needed it yet".
           await document.fonts.load('400 16px Inter');
           await document.fonts.load('400 16px lucide');
           const loaded = document.fonts.check('400 16px Inter');
           const loadedLucide = document.fonts.check('400 16px lucide');
           const registered = [];
           document.fonts.forEach((f) => registered.push(f.family + ' ' + f.weight));
           if (!link.length) return null;
           return { links: link, declared, loaded, loadedLucide, registered,
                    sample: el ? (el.textContent||'').trim().slice(0,40) : null };
         })()`,
        { timeoutMs: 45000, what: 'the preview to inject the module stylesheets' }
      );
      report.preview = font;
      check(steps, '§2 (preview): the Inter and Lucide stylesheets are injected into the app document',
        font.links.some((l) => /inter/.test(l)) && font.links.some((l) => /lucide/.test(l)), font.links.join(' | '));
      check(steps, '§2 (preview): a face for Inter LOADS, not merely resolves', font.loaded === true,
        `loaded=${font.loaded}; registered: ${font.registered.join(', ')}`);
      // The one that caught the real defect. The token was right, the module was right, the faces
      // were right — and the element reached the DOM with no font-family and rendered in Times.
      check(steps, '§2 (preview): a Text node RENDERS in Inter with no author action',
        /^Inter\b/.test(font.declared), `${font.sample ? `"${font.sample}" → ` : ''}${font.declared}`);
      check(steps, '§4 (preview): the Lucide webfont loads too', font.loadedLucide === true,
        `loaded=${font.loadedLucide}`);
    } finally {
      viewer.close?.();
    }

    // ── Criterion 4 + 5 + 6: a real deploy build ────────────────────────────
    const buildDir = path.join(os.tmpdir(), `pol006-deploy-${process.pid}`);
    const built = await evaluate(
      client,
      `(async () => {
         const project = ${REQ(PROJECT_MODULE)}.ProjectModel.instance;
         const { createEditorCompilation } = ${REQ('./src/editor/src/utils/compilation/compilation.editor.ts')};
         const compilation = createEditorCompilation(project);
         const result = await compilation.deployToFolder(${JSON.stringify(buildDir)}, { environment: undefined });
         return { ok: true, result: result && typeof result === 'object' ? Object.keys(result) : String(result) };
       })()`
    ).catch((error) => ({ error: error.message }));

    if (built && built.error) {
      check(steps, '§4: a deploy build carries the modules', false, `deploy failed: ${built.error}`);
    } else {
      const html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
      const deployFiles = [];
      walkInto(buildDir, '', deployFiles);
      report.deploy = { html: html.length, files: deployFiles.filter((f) => f.includes('noodl_modules')) };
      check(steps, '§4: the deploy HTML links both module stylesheets',
        /noodl_modules\/inter\/styles\.css/.test(html) && /noodl_modules\/lucide-icons\/styles\.css/.test(html),
        (html.match(/<link[^>]*noodl_modules[^>]*>/g) || []).join(' ') || 'no module links in index.html');
      check(steps, '§4: the deploy carries the font files themselves',
        deployFiles.includes('noodl_modules/inter/Inter-Regular.ttf') &&
          deployFiles.includes('noodl_modules/lucide-icons/lucide.woff2'),
        report.deploy.files.join(', ') || 'no noodl_modules in the build');
      check(steps, '§5: the deploy stamps --font-sans naming Inter',
        /--font-sans:\s*Inter,/.test(html), (html.match(/--font-sans:[^;]*/) || ['absent'])[0]);
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    client.close?.();
    if (!args.keep) fs.rmSync(dir, { recursive: true, force: true });
  }

  const failed = steps.filter((s) => !s.ok);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`project: ${report.dir}${args.keep ? '' : ' (removed)'}`);
    for (const step of steps) console.log(`${step.ok ? '  ok  ' : ' FAIL '} ${step.name}\n         ${step.detail}`);
    if (report.error) console.log(`\nerror: ${report.error}`);
  }
  process.exit(report.error || failed.length > 0 ? 1 : 0);
}

function walkInto(base, rel, out) {
  for (const entry of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkInto(base, next, out);
    else out.push(next);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
