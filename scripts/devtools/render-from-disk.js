#!/usr/bin/env node
/**
 * Serve a v2 project straight from DISK against the working-tree runtime.
 *
 * Usage:
 *   node scripts/devtools/render-from-disk.js <project-dir> [--port 8593]
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
 *    NODE and must be lifted to component level, or a Repeater binds nothing
 *  - nodes must be NESTED (`children` as objects); only roots go top-level
 *  - design tokens are stamped in by the editor or the html-processor, never by
 *    the bundle — without them every `var()` resolves to nothing
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const VIEWER = path.join(REPO, 'packages/noodl-editor/src/external/viewer');
const TOKENS_SRC = path.join(REPO, 'packages/noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens.ts');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const PROJECT = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--port') || process.env.PROJECT;
const PORT = Number(flag('--port', process.env.PORT || 8593));
const BACKEND = { host: '127.0.0.1', port: Number(flag('--backend-port', process.env.BACKEND_PORT || 8581)) };
const EDITOR_PORT = Number(flag('--editor-port', 8574));

if (!PROJECT || !fs.existsSync(path.join(PROJECT, 'nodegx.project.json'))) {
  console.error('Usage: node scripts/devtools/render-from-disk.js <project-dir> [--port 8593]');
  console.error(PROJECT ? `Not a v2 project (no nodegx.project.json): ${PROJECT}` : 'No project directory given.');
  process.exit(2);
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

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
      roots: nodesFile.visualRoots || [],
      ports: [
        ...(nodesFile.ports || []),
        ...flat.flatMap((n) =>
          n.type === 'Component Inputs'
            ? (n.ports || []).map((p) => ({ ...p, plug: 'input' }))
            : n.type === 'Component Outputs'
              ? (n.ports || []).map((p) => ({ ...p, plug: 'output' }))
              : []
        )
      ],
      metadata: nodesFile.metadata || undefined
    });
  }

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
        pages.push({ component: c.name, path: p.urlPath, title: p.title });
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
 * The `:root` token block.
 *
 * Preferred from a running editor, because that reflects the project's own
 * overrides. Falls back to the shipped defaults parsed out of `DefaultTokens.ts`
 * — a page rendered with no tokens at all is not a smaller problem than a page
 * rendered with the wrong ones, it just fails less visibly.
 */
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
    const src = fs.readFileSync(TOKENS_SRC, 'utf8');
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
    done(
      `<style id="noodl-design-tokens">:root {\n${decls.join('\n')}\n}\n\nbody {\n  font-family: var(--font-sans);\n}</style>`,
      `${decls.length} shipped defaults`
    );
  };

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

const MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

tokenCss((tokens) => {
  const projectData = buildProjectData();

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${projectData.name}</title>
${tokens}
<link href="/noodl_modules/inter/styles.css" rel="stylesheet">
<link href="/noodl_modules/lucide-icons/styles.css" rel="stylesheet">
<style>html,body{margin:0;padding:0}</style>
</head><body><div id="root"></div>
<script src="/react19/react.production.min.js"></script>
<script src="/react19/react-dom.production.min.js"></script>
<script>window.__noodl_modules=[];window.Noodl={defineModule:function(m){window.__noodl_modules.push(m)},deployed:false,Env:{}};</script>
<script src="/noodl.viewer.js"></script>
<script>
window.projectData = ${JSON.stringify(projectData)};
document.addEventListener("DOMContentLoaded", function () {
  window.Noodl._viewerReact.renderDeployed(document.getElementById('root'), __noodl_modules, window.projectData);
});
</script>
</body></html>`;

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
        p.on('error', (e) => { res.writeHead(502); res.end(e.message); });
        req.pipe(p);
        return;
      }

      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(html);
      }

      // Viewer assets first, then the project's own (fonts, icon modules, images).
      for (const file of [path.join(VIEWER, url), path.join(PROJECT, url)]) {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
          return res.end(fs.readFileSync(file));
        }
      }
      res.writeHead(404);
      res.end('not found: ' + url);
    })
    .listen(PORT, '127.0.0.1', () => {
      if (!fs.existsSync(path.join(VIEWER, 'noodl.viewer.js'))) {
        console.error('[render] WARNING: no noodl.viewer.js — build packages/noodl-viewer-react first.');
      }
      console.error(`[render] http://127.0.0.1:${PORT}/`);
    });
});
