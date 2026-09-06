#!/usr/bin/env node
/**
 * Serve a v2 project straight from DISK against the working-tree runtime.
 *
 * Usage:
 *   node scripts/devtools/render-from-disk.js <project-dir> [--port 8593]
 *   node scripts/devtools/render-from-disk.js <project-dir> --print-project
 *   node scripts/devtools/render-from-disk.js <project-dir> --print-html
 *
 * `--print-project` skips the server entirely and writes the reconstructed
 * `projectData` to stdout, which is the only way to test the export-contract
 * reconstruction below without a browser. `--print-html` does the same for the
 * page itself — the only way to assert on what is *emitted* rather than on what
 * a browser made of it. `scripts/devtools/render-report.js` drives the server
 * half.
 *
 * Then point a browser — or headless Chrome over CDP — at the printed URL and
 * read computed styles. That last part is the point: three of the layout
 * defects this tool was built to chase were found by *measuring the DOM*, not
 * by reading the graph. `scrollWidth > clientWidth` found a padded container
 * overflowing its parent; `offsetWidth === 170` found a `width: 100%` that a
 * `sizeMode` default had quietly voided; `getComputedStyle().fontWeight === 400`
 * on every node found a whole missing port. A graph is a claim, a render is
 * evidence, and an agent authoring blind can produce neither.
 *
 * ## Why not just use the editor
 *
 * The editor holds its project in memory and pushes *that* to the viewer over a
 * WebSocket — there is no JSON endpoint. So a write to disk (from the MCP
 * server, or from your own hand) is invisible to a running editor until the
 * project is reloaded, and quitting the editor can flush its stale copy back
 * over your changes. This bypasses the editor completely: nothing is installed,
 * nothing of the user's is touched, and the runtime under test is whatever
 * `packages/noodl-viewer-react` last built.
 *
 * Rebuild that first, or you are testing the last build and not your change:
 *   cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js
 *
 * ## The export contract, which the on-disk format does not give you
 *
 * `renderDeployed(root, modules, projectData)` wants the shape the *exporter*
 * produces, and every one of these had to be reverse-engineered:
 *
 *  - `componentIndex: {}` — the Viewer calls `Object.keys()` on it unconditionally
 *  - `rootComponent` — a component NAME; the project file records only `rootNodeId`
 *  - `routerIndex: { routers: [{name, pages}], pages: [{component, path, title}] }`
 *  - connections are `sourceId/sourcePort/targetId/targetPort`, **not** the
 *    file's `fromId/fromProperty/toId/toProperty`
 *  - a component's interface lives on its `Component Inputs`/`Component Outputs`
 *    NODE and must be lifted to component level, **inverting the plug** — see
 *    `liftInterface` below; getting this wrong is how this harness spent two
 *    phases certifying a page the editor cannot render
 *  - nodes must be NESTED (`children` as objects); only roots go top-level
 *  - design tokens are stamped in by the editor or the html-processor, never by
 *    the bundle — without them every `var()` resolves to nothing
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

/**
 * CN-001 (phase 69) — the eyes must see kits.
 *
 * The `<head>` below used to be a template literal carrying two hardcoded
 * module stylesheets and nothing else. A project whose page uses a custom node
 * — a `noodl_modules` kit — therefore rendered **without that node**, and the
 * report on top of this server called it *"Rendered clean"*, zero findings. Not
 * a blank: a page missing its work, actively exonerated. Every other HTML path
 * in the product (the preview web-server, the deploy HtmlProcessor, headless
 * noodl-preview, ViewerConnection) injected correctly; the verification tool
 * was the only blind one, which is the worst place for it.
 *
 * ⚠️ Resolved **through the workspace**, never a relative `require` into
 * `packages/` — this file's siblings record that a relative path works in a
 * checkout and breaks everywhere else. `@nodegx/module-inject` is a no-build
 * package for exactly this: it is the same code the editor runs, so a tag that
 * appears here appears in the product, and the harness stays evidence about
 * the product rather than about itself.
 */
const { buildInjectionTags, scanProjectModules } = require('@nodegx/module-inject');

/**
 * UNI-012 — resolved for both layouts (checkout, packaged `app.asar`) rather than
 * off a `REPO` that only exists in the first. See `harness-paths.js`.
 */
const HARNESS_PATHS = require('./harness-paths');

const VIEWER = HARNESS_PATHS.VIEWER_DIR.path;
const TOKENS_SRC = HARNESS_PATHS.TOKENS_SRC.path;

const argv = process.argv.slice(2);
/** Flags that consume the following argument, so it is never mistaken for the project dir. */
const VALUE_FLAGS = new Set(['--port', '--backend-port', '--editor-port']);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const PROJECT =
  argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1])) || process.env.PROJECT;
const PORT = Number(flag('--port', process.env.PORT || 8593));
const BACKEND = { host: '127.0.0.1', port: Number(flag('--backend-port', process.env.BACKEND_PORT || 8581)) };
const PRINT_PROJECT = argv.includes('--print-project');
/**
 * Print the served HTML and exit, the same way `--print-project` prints the
 * reconstructed project. CN-001's regression test asserts on the **emitted
 * tag**, deliberately not on "the render is non-blank" — a blank has too many
 * causes and the blank rule is already subtle. Asserting on the tag needs the
 * HTML without needing a browser, a port, or a built viewer bundle, which is
 * what makes that test cheap enough to live in the plain-Node suite.
 */
const PRINT_HTML = argv.includes('--print-html');
/**
 * The running editor's `:root` block, only when asked for.
 *
 * This used to be probed unconditionally, and that is an active source of wrong
 * measurements rather than a nicety: the editor serves the tokens of whatever
 * project **it** has open, so rendering project B while the editor holds project
 * A stamps A's palette onto B. The phase-55 audit's own `haiku-full.png` is a
 * casualty — the replay project carries no `metadata` at all, yet that shot is
 * in `ecommerce-example`'s terracotta. A project's real tokens are its
 * `metadata.designTokens` over the shipped defaults, which is what the fallback
 * builds and what the editor would itself show for that project. Opt in with
 * `--editor-tokens` when you deliberately want to mirror a running editor.
 */
const EDITOR_PORT = argv.includes('--editor-tokens') ? Number(flag('--editor-port', 8574)) : 0;

if (!PROJECT || !fs.existsSync(path.join(PROJECT, 'nodegx.project.json'))) {
  console.error('Usage: node scripts/devtools/render-from-disk.js <project-dir> [--port 8593]');
  console.error(PROJECT ? `Not a v2 project (no nodegx.project.json): ${PROJECT}` : 'No project directory given.');
  process.exit(2);
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** The only two node types carrying `haveComponentPorts`, so the only two with an interface. */
const COMPONENT_PORT_TYPES = new Set(['Component Inputs', 'Component Outputs']);

/**
 * Lift one interface node's ports to component level — **inverting the plug**.
 *
 * This harness used to force every `Component Inputs` port to `plug: 'input'`
 * and every `Component Outputs` port to `plug: 'output'`, ignoring what the
 * project actually declared. That is not what the product does, and the gap was
 * not cosmetic: `ecommerce-example` — phase 54's reference build — declares all
 * eleven of its `ProductCard` ports `plug: "input"`, and rendered here only
 * because this file rewrote them. In the editor it has never worked.
 *
 * `componentmodel.getPorts()` is the authority
 * ([componentmodel.ts:91](../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L91)).
 * It walks the nodes carrying `haveComponentPorts`, reads `node.getPorts(dir)`
 * — which selects on `p.plug.indexOf(dir) !== -1` — and republishes:
 *
 *     node port plugged "output"  ->  component port plug "input"   (an INPUT)
 *     node port plugged "input"   ->  component port plug "output"  (an OUTPUT)
 *
 * so a component input is a port whose own plug says `output`: values flow *out
 * of* the `Component Inputs` node into the graph. A plugless port is returned by
 * neither filter and joins the interface at all — `PortWithoutPlug` owns that.
 *
 * The node's *type* does not enter into it; both types are walked identically.
 * A port plugged `"input,output"` therefore publishes both directions, which is
 * why this is a flatMap and not a ternary.
 * `validation/componentInterface.ts` derives the same fact for the gate, and the
 * two must not drift.
 */
function liftInterface(node) {
  if (!COMPONENT_PORT_TYPES.has(node.type) || !Array.isArray(node.ports)) return [];
  return node.ports.flatMap((p) => {
    if (!p || typeof p.plug !== 'string') return [];
    const lifted = [];
    if (p.plug.includes('output')) lifted.push({ ...p, plug: 'input' });
    if (p.plug.includes('input')) lifted.push({ ...p, plug: 'output' });
    return lifted;
  });
}

function buildProjectData() {
  const project = readJSON(path.join(PROJECT, 'nodegx.project.json'));
  const componentsDir = path.join(PROJECT, project.structure?.componentsDir || 'components');
  const registry = readJSON(path.join(componentsDir, '_registry.json'));

  const components = [];
  for (const key of Object.keys(registry.components)) {
    const dir = path.join(componentsDir, registry.components[key].path);
    const meta = readJSON(path.join(dir, 'component.json'));
    const nodesFile = readJSON(path.join(dir, 'nodes.json'));
    const connFile = fs.existsSync(path.join(dir, 'connections.json'))
      ? readJSON(path.join(dir, 'connections.json'))
      : { connections: [] };

    const flat = nodesFile.nodes || [];
    const byId = new Map(flat.map((n) => [n.id, n]));
    const childIds = new Set();
    flat.forEach((n) => (n.children || []).forEach((c) => childIds.add(c)));

    const nest = (node) => {
      const { parent, children, ...rest } = node;
      const kids = (children || []).map((id) => byId.get(id)).filter(Boolean).map(nest);
      return kids.length ? { ...rest, children: kids } : { ...rest };
    };

    components.push({
      name: meta.path || '/' + key,
      nodes: flat.filter((n) => !childIds.has(n.id)).map(nest),
      connections: (connFile.connections || []).map((c) => ({
        sourceId: c.sourceId ?? c.fromId,
        sourcePort: c.sourcePort ?? c.fromProperty,
        targetId: c.targetId ?? c.toId,
        targetPort: c.targetPort ?? c.toProperty
      })),
      // AWP-001 §3 — `visualRoots` absent is not `visualRoots` empty. This read
      // was `nodesFile.visualRoots || []`, which rendered an agent-authored
      // component as nothing at all and disagreed with `ProjectImporter`, whose
      // roots come from the node tree. Two readers, one file, two answers — F43.
      // `undefined` here means "derive below"; `[]` means a writer said empty.
      roots: nodesFile.visualRoots,
      ports: [...(nodesFile.ports || []), ...flat.flatMap(liftInterface)],
      metadata: nodesFile.metadata || undefined
    });
  }

  // ── AWP-001 §3: derive `visualRoots` for any component that declared none ────
  // The predicate is READ from the catalog, not restated here — this file's own
  // header records that paraphrasing the export contract cost two phases of
  // certifying a page the editor cannot render, and this is that same contract.
  const visualTypeNames = (() => {
    try {
      const catalog = require(HARNESS_PATHS.ENRICHED_CATALOG_JSON.path);
      return new Set((catalog.nodes || []).filter((n) => n.isVisual === true).map((n) => n.typeName));
    } catch {
      // No catalog resolved for either layout — leave declared roots alone.
      // `render-report.js` names the absence as a prerequisite before it gets
      // here, so this abstention is the standalone-server case.
      return null;
    }
  })();
  if (visualTypeNames) {
    const byComponentName = new Map(components.map((c) => [c.name, c]));
    const memo = new Map();
    const inFlight = new Set();
    const drawsAnything = (name) => {
      if (memo.has(name)) return memo.get(name);
      if (inFlight.has(name)) return false; // cyclic instantiation is already invalid
      const c = byComponentName.get(name);
      if (!c) return false;
      inFlight.add(name);
      const draws = c.nodes.some((n) => isVisualType(n.type));
      inFlight.delete(name);
      memo.set(name, draws);
      return draws;
    };
    // A node is either a catalog type, or an instance of a project component —
    // and an instance draws exactly when the component it points at does.
    const isVisualType = (type) =>
      visualTypeNames.has(type) ? true : byComponentName.has(type) ? drawsAnything(type) : false;

    for (const c of components) {
      if (c.roots === undefined) c.roots = c.nodes.filter((n) => isVisualType(n.type)).map((n) => n.id);
    }
  }
  for (const c of components) if (c.roots === undefined) c.roots = [];

  let rootComponent;
  for (const c of components) {
    const stack = [...c.nodes];
    while (stack.length) {
      const n = stack.pop();
      if (n.id === project.rootNodeId) { rootComponent = c.name; stack.length = 0; break; }
      (n.children || []).forEach((k) => stack.push(k));
    }
    if (rootComponent) break;
  }
  if (!rootComponent) rootComponent = (components.find((c) => /(^|\/)App$/.test(c.name)) || components[0]).name;

  const routers = [];
  const pages = [];
  for (const c of components) {
    const stack = [...c.nodes];
    while (stack.length) {
      const n = stack.pop();
      if (n.type === 'Router') routers.push({ name: (n.parameters || {}).name, pages: (n.parameters || {}).pages });
      if (n.type === 'Page') {
        const p = n.parameters || {};
        /**
         * DEF-003 (c). `title` falls back to the component's own last path segment, because the
         * exporter does (`editor/src/utils/exporter/router.ts`, `_getPageInfo`) and this file's
         * whole job is to reproduce the export contract.
         *
         * 🔴 Without it, a page that sets no `title` reached the Router with `title: undefined`,
         * the Router handed that to `Noodl.SEO.setTitle`, and the browser's title became the
         * literal string `"undefined"` — a title the product itself can never produce. Anything
         * measuring `document.title` through this harness (`render_report`, the site drives) was
         * therefore reading a defect belonging to the harness. It cost this session an hour of
         * chasing a phantom before the exporter was read.
         */
        const titleParts = String(c.name).split('/');
        pages.push({
          component: c.name,
          path: p.urlPath,
          title: p.title === undefined ? titleParts[titleParts.length - 1] : p.title
        });
      }
      (n.children || []).forEach((k) => stack.push(k));
    }
  }

  const metadata = JSON.parse(JSON.stringify(project.metadata || {}));
  // Same-origin backend, so no CORS applies to it.
  if (metadata.cloudservices) metadata.cloudservices.endpoint = `http://127.0.0.1:${PORT}/__backend`;

  console.error(`[render] rootComponent=${rootComponent}  ${components.length} components, ${routers.length} router(s), ${pages.length} page(s)`);

  return {
    name: project.name,
    version: project.version,
    settings: project.settings || {},
    rootNodeId: project.rootNodeId,
    metadata,
    components,
    componentIndex: {},
    rootComponent,
    routerIndex: { routers, pages }
  };
}

/**
 * This project's own token overrides, from `metadata.designTokens` — the block
 * `set_project_tokens` writes and the editor reads back verbatim.
 *
 * Without these the fallback renders a bespoke palette in the SHIPPED colours,
 * which is the worst of the three outcomes: it looks deliberate, so you measure
 * it, believe it, and go fixing things that were never wrong. Appended after the
 * defaults so the later declaration wins — the same order the editor produces.
 */
function projectOverrideDecls() {
  try {
    const project = readJSON(path.join(PROJECT, 'nodegx.project.json'));
    const stored = project.metadata?.designTokens;
    const custom = stored?.customTokens || [];
    return custom.filter((t) => t && t.name && t.value).map((t) => `  ${t.name}: ${t.value};`);
  } catch {
    return [];
  }
}

function tokenCss(cb) {
  const overrides = projectOverrideDecls();
  const done = (css, source) => {
    if (overrides.length) {
      css = css.replace(/<\/style>$/, `\n:root {\n${overrides.join('\n')}\n}\n</style>`);
      source += ` + ${overrides.length} project override(s)`;
    }
    console.error(`[render] design tokens: ${source}`);
    cb(css);
  };
  const fallback = () => {
    const src = TOKENS_SRC ? fs.readFileSync(TOKENS_SRC, 'utf8') : '';
    // Both quote styles. A single-quote-only pattern silently dropped every
    // token whose value CONTAINS an apostrophe — which is exactly the font
    // stacks: `--font-sans` is "Inter, …, 'Apple Color Emoji', …". So
    // `body { font-family: var(--font-sans) }` resolved to nothing and the whole
    // page fell back to Times. The tell was `--font-sans` reading empty at
    // :root, not anything about fonts.
    const decls = [...src.matchAll(/name:\s*'(--[\w-]+)',\s*value:\s*(?:'([^']*)'|"([^"]*)")/g)].map(
      ([, n, sq, dq]) => `  ${n}: ${sq !== undefined ? sq : dq};`
    );
    // ⚠️ Mirrors `TokenResolver.generateCss` — which emits the `:root` block AND
    // a `body { font-family: var(--font-sans) }` floor. Reconstructing only the
    // first half made every page render in the browser's default SERIF, and a
    // serif single column is the exact signature of "the styling was discarded".
    // The harness looked like it had found the product's biggest defect; the
    // product was fine and the harness was lying. Keep these two in step.
    //
    // 🔴 Stepped 2026-08-29: the floor gained `color: var(--foreground)` (P78 D19 —
    // it applied a font and no colour, so `--foreground` had no reader and every
    // element that did not set its own rendered the browser's black). Without
    // mirroring it here the harness renders the PREVIOUS product: labels in #000
    // while the real viewer shows the token. That is the same lying-harness this
    // comment already warns about, pointing the other way — it would hide a fix
    // rather than invent a defect.
    done(
      `<style id="noodl-design-tokens">:root {\n${decls.join('\n')}\n}\n\nbody {\n  font-family: var(--font-sans);\n  color: var(--foreground);\n}</style>`,
      `${decls.length} shipped defaults`
    );
  };

  // `--editor-tokens` off (the default): the project's own tokens, nobody else's.
  if (!EDITOR_PORT) return fallback();

  const req = http.get({ host: '127.0.0.1', port: EDITOR_PORT, path: '/' }, (r) => {
    let d = '';
    r.on('data', (c) => (d += c));
    r.on('end', () => {
      const m = d.match(/<style id="noodl-design-tokens">[\s\S]*?<\/style>/);
      m ? done(m[0], `from the editor on :${EDITOR_PORT}`) : fallback();
    });
  });
  req.on('error', fallback);
  req.setTimeout(3000, () => { req.destroy(); fallback(); });
}

/**
 * REL-002a — the product's own host stylesheet, verbatim.
 *
 * 🔴 **This harness used to emit `html,body{margin:0;padding:0}` and nothing else, and that one
 * omission made it blind to a whole class of defect.** Both product hosts
 * (`noodl-viewer-react/static/viewer/index.html` and `.../static/deploy/index.html`, identical on
 * every rule that matters) pin `#root` to the viewport:
 *
 * ```
 *   #root { display:flex; width:100%; height:100%; overflow:clip; position:fixed }
 *   .body-scroll > #root { height:auto; min-height:100vh; overflow:initial; position:initial }
 * ```
 *
 * The viewer adds `.body-scroll` to `<body>` only when `settings.bodyScroll` is true
 * (`viewer.jsx`), and wraps the app in its own `overflow: clip` div when it is not. So on a
 * project that has not set it, **everything below the fold is unreachable** — `clip` creates no
 * scroll container, so neither the user nor the browser can scroll to it.
 *
 * Measured 2026-09-01 on `templates/members-area` at 988x313, the editor preview's own default:
 * `/setup` clipped **539px**, putting six of its seven fields and its submit button out of reach.
 * On this harness's old host page the same render read **fully scrollable and every control
 * reachable** — the defect was invisible to the instrument, not absent from the product.
 *
 * ✅ Read from the product file rather than restated here, so the two cannot drift. `VIEWER_DIR`
 * is gitignored build output; the tracked `static/` copy is the fallback for a worktree that has
 * not built. If neither is readable the harness says so loudly rather than quietly measuring a
 * page the product never serves.
 */
function productHostStyle() {
  const candidates = [
    path.join(VIEWER, 'index.html'),
    path.join(HARNESS_PATHS.CHECKOUT_ROOT, 'packages/noodl-viewer-react/static/deploy/index.html')
  ];
  for (const file of candidates) {
    try {
      const m = /<style>([\s\S]*?)<\/style>/.exec(fs.readFileSync(file, 'utf8'));
      if (m) return `<style>${m[1]}</style>`;
    } catch {
      /* try the next candidate */
    }
  }
  console.error(
    '[render] WARNING: no product host stylesheet found (probed ' +
      candidates.join(', ') +
      '). Falling back to a bare reset — this page does NOT clip at the viewport the way the ' +
      'product does, so any reading about the fold taken here is void.'
  );
  return '<style>html,body{margin:0;padding:0}</style>';
}

const MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

/**
 * Build the page, with the project's modules injected.
 *
 * The tag ORDER is copied from the product's own template
 * (`packages/noodl-editor/src/external/viewer/index.html`) and is load-bearing,
 * not cosmetic: dependencies, then the `Noodl.defineModule` shim, then each
 * module's `main`, then the viewer. A kit's `index.js` calls `defineModule`, so
 * it has to run *after* the shim exists and *before* `renderDeployed` reads
 * `__noodl_modules`. Emitting the tag in the wrong place is indistinguishable
 * from not emitting it at all, which is the failure this task exists to end —
 * so this harness places it where the product does rather than somewhere that
 * merely looks tidy.
 *
 * 🔴 **The shim's `__noodl_module_name` adoption is load-bearing and was missing
 * (found by CN-012's measurement pass).** The injector writes a marker tag
 * naming the kit before each module script — that is CN-003's fix for the editor
 * saying `'Unknown Module'` for every kit — and `defineModule` is where the name
 * is adopted, because a module that does not name itself has no other chance to
 * learn it. All three product bootstraps do it (`static/deploy/index.js`,
 * `static/ssr/runtime-globals.js`, the editor's viewer `index.html`); this was
 * the fourth copy of the shim and the only one without it, so in the harness
 * `registerModule` stamped **`Unknown Module`** on every kit node while the page
 * had the right name sitting in a global one tag away. Measured on both a logic
 * kit and a visual one, so it was never about the node type.
 *
 * ⚠️ Nothing in `render-report.js` reads the stamp *today*, which is why this
 * went unnoticed — but the whole worth of this harness is that it is evidence
 * about the product, and an instrument that disagrees with the product about the
 * one fact CN-003 exists to fix is not evidence.
 */
function buildHtml(cb) {
  tokenCss((tokens) => {
    const projectData = buildProjectData();

    scanProjectModules(PROJECT, (modules) => {
      const { dependencies, modulesMain } = buildInjectionTags(modules, '/');
      const moduleCount = modules ? modules.length : 0;
      const mainCount = (modulesMain.match(/<script/g) || []).length;
      console.error(`[render] noodl_modules: ${moduleCount} scanned, ${mainCount} module script(s) injected`);

      cb(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${projectData.name}</title>
${tokens}
${productHostStyle()}
</head><body><div id="root"></div>
<script src="/react19/react.production.min.js"></script>
<script src="/react19/react-dom.production.min.js"></script>
${dependencies}
<script>window.__noodl_modules=[];window.Noodl={defineModule:function(m){if(m&&!m.name&&window.__noodl_module_name)m.name=window.__noodl_module_name;window.__noodl_modules.push(m)},deployed:false,Env:{}};</script>
${modulesMain}
<script src="/noodl.viewer.js"></script>
<script>
window.projectData = ${JSON.stringify(projectData)};
document.addEventListener("DOMContentLoaded", function () {
  window.Noodl._viewerReact.renderDeployed(document.getElementById('root'), __noodl_modules, window.projectData);
});
</script>
</body></html>`);
    });
  });
}

if (PRINT_PROJECT) {
  process.stdout.write(JSON.stringify(buildProjectData(), null, 2) + '\n');
} else if (PRINT_HTML) {
  buildHtml((html) => process.stdout.write(html + '\n'));
} else
  buildHtml((html) => {

  http
    .createServer((req, res) => {
      const url = req.url.split('?')[0];

      if (url.startsWith('/__backend')) {
        const p = http.request(
          {
            ...BACKEND,
            path: req.url.replace('/__backend', '') || '/',
            method: req.method,
            headers: { ...req.headers, host: `127.0.0.1:${BACKEND.port}` }
          },
          (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); }
        );
        /**
         * D45 — a client that goes away must take its UPSTREAM with it.
         *
         * `up.pipe(res)` does not destroy the source when the destination
         * closes, so a proxied `GET /realtime` outlived the browser that opened
         * it: the SSE response upstream stayed writable, `RealtimeHub` never saw
         * the `close` it reaps a connection on, and the entry sat in its map
         * forever. Measured on this server before the fix — three subscriptions
         * closed, `connectionCount` unchanged after ten seconds — which is
         * SBR-011's "fifteen streams for three subscriptions" exactly: every
         * confirmation timeout retried, and every abandoned attempt was billed
         * to `rateLimit.realtimeMaxConnections` and never refunded.
         *
         * 🔴 This is the LEAK half of D45 and not the DELAY half. Timed in one
         * run against a direct client, the hello frame through this proxy is
         * 8ms to direct's 9ms, so nothing here was ever holding a frame.
         */
        res.on('close', () => p.destroy());
        p.on('error', (e) => {
          // `p.destroy()` above lands here as ECONNRESET on a response already
          // sent or already gone; writing a 502 into it would throw.
          if (res.headersSent || res.writableEnded) return res.destroy();
          res.writeHead(502);
          res.end(e.message);
        });
        req.pipe(p);
        return;
      }

      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(html);
      }

      // Viewer assets first, then the project's own (fonts, icon modules, images).
      // VIEWER is null only when neither layout resolved; `render-report.js`
      // refuses before spawning this server, so that is the standalone case.
      for (const file of [VIEWER && path.join(VIEWER, url), path.join(PROJECT, url)].filter(Boolean)) {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
          return res.end(fs.readFileSync(file));
        }
      }
      // UNI-010 §8.2 — a named route is the app, not a missing file.
      //
      // Until 2026-08-20 this 404'd every path but `/`, so the harness could not
      // reach ANY route the router serves — including the start page's own
      // `urlPath`. Measured before the fix on a five-route project: `/` 200,
      // `/landing` `/thank-you` `/home` all 404. Anything driven by `urlPath`
      // was therefore unmeasurable by this instrument on every page.
      //
      // 🔴 The fallback is deliberately restricted to EXTENSION-LESS paths. A
      // blanket "serve index.html for anything unresolved" would hand back HTML
      // for a missing `.png` or `.js`, and the report counts broken images — so
      // the obvious version of this fix would have quietly disabled a check that
      // works, which is the failure class this harness exists to catch.
      if (!path.extname(url)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(html);
      }

      res.writeHead(404);
      res.end('not found: ' + url);
    })
    .listen(PORT, '127.0.0.1', () => {
      if (!VIEWER || !fs.existsSync(path.join(VIEWER, 'noodl.viewer.js'))) {
        console.error(
          '[render] WARNING: no noodl.viewer.js — build packages/noodl-viewer-react first. Probed: ' +
            HARNESS_PATHS.VIEWER_DIR.probed.join(', ')
        );
      }
      console.error(`[render] http://127.0.0.1:${PORT}/`);
    });
});
