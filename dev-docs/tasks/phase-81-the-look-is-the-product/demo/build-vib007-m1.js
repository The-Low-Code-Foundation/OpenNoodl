/**
 * VIB-007 M1 (AC1) — the deliberately poor page the door refuses to call done.
 *
 * AC1 says: *"a visual page cannot be reported done without a render whose findings are clean.
 * Demonstrated on a deliberately poor page: the door refuses, names why, and accepts after the
 * fix."* This writes the page. `packages/noodl-mcp/tests/vib007-m1.door.ts` drives the real door
 * over it with a real Chrome, and applies the fix through `update_component`.
 *
 * 🔴 **Poor is not a taste judgement here.** The page is built to trip two of the five findings
 * `nodegx-render-measure` itself grades `error`:
 *
 *   - `dead-placeholder-text` — three `Text` nodes still rendering the node type's own default word.
 *   - `broken-image` — an `Image` pointing at a file that is not in the project.
 *
 * Everything else about it is ordinary and even tidy: tokens for every colour and space, a real
 * heading, a scrolling page spine. **That is the point.** A page can be structurally clean, pass
 * `validate_project`, pass `catalog:examples`-grade checks, and still be three empty words and a
 * grey rectangle — which is exactly the state nine of the VIB-001 baseline screenshots were in.
 *
 * The fixed arm is not written here. It is applied *through the door* by the driver, because AC1's
 * claim is about the door accepting after a fix, and a fix that arrived by any other route would
 * prove something else.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib007-m1.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, 'vib-007-m1');
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const CATALOG = require(path.join(REPO, 'packages/noodl-types/src/node-catalog.json'));
const VISUAL = new Set(CATALOG.nodes.filter((n) => n.isVisual).map((n) => n.typeName));
const drawsSomething = (node) => VISUAL.has(node.type) || node.type.startsWith('/');

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const stamp = '2026-08-31T00:00:00.000Z';
const registry = {};

function writeComponent(compPath, nodes, connections) {
  const dir = path.join(OUT, 'components', compPath);
  fs.mkdirSync(dir, { recursive: true });
  const id = uuid(compPath);
  const conns = connections || [];
  const visualRoots = nodes.filter((n) => !n.parent && drawsSomething(n)).map((n) => n.id);
  fs.writeFileSync(
    path.join(dir, 'component.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/component-v2.json',
        id,
        name: compPath.split('/').pop(),
        path: '/' + compPath,
        type: 'visual',
        created: stamp,
        modified: stamp,
        modifiedBy: 'vib-007-m1'
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'nodes.json'),
    JSON.stringify(
      { $schema: 'https://opennoodl.dev/schemas/nodes-v2.json', componentId: id, version: 1, nodes, visualRoots },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'connections.json'),
    JSON.stringify(
      { $schema: 'https://opennoodl.dev/schemas/connections-v2.json', componentId: id, version: 1, connections: conns },
      null,
      2
    ) + '\n'
  );
  registry[compPath] = {
    path: compPath,
    type: 'visual',
    nodeCount: nodes.length,
    connectionCount: conns.length,
    modified: stamp,
    created: stamp
  };
}

const band = (id, children) => ({
  id,
  type: 'Group',
  label: id,
  parameters: {
    width: { value: 100, unit: '%' },
    sizeMode: 'contentHeight',
    flexDirection: 'column',
    rowGap: 'var(--space-4)',
    paddingTop: 'var(--space-8)',
    paddingBottom: 'var(--space-8)',
    paddingLeft: 'var(--space-6)',
    paddingRight: 'var(--space-6)',
    backgroundColor: 'var(--surface-1)'
  },
  children
});

writeComponent(
  'Pages/Home',
  [
    {
      id: 'page',
      type: 'Page',
      label: 'Home',
      parameters: { title: 'VIB-007 M1 — the page nobody looked at', urlPath: 'home' },
      children: ['shell']
    },
    {
      id: 'shell',
      type: 'Group',
      label: 'Shell',
      parent: 'page',
      parameters: {
        width: { value: 100, unit: '%' },
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        scrollEnabled: true,
        backgroundColor: 'var(--surface-1)'
      },
      children: ['hero', 'features']
    },
    { ...band('hero', ['hero_heading', 'hero_sub', 'hero_photo']), parent: 'shell' },
    {
      id: 'hero_heading',
      type: 'Text',
      label: 'heading',
      parent: 'hero',
      // The one thing on this page that was actually written.
      parameters: { text: 'Riverside Pottery', textStyle: 'h1', color: 'var(--text-1)' }
    },
    {
      // 🔴 DEFECT 1 of 2 — the node-type default, shipped. No `text` parameter at all, which is how
      // it happens in the wild: the node draws the word "Text" and every structural check passes.
      id: 'hero_sub',
      type: 'Text',
      label: 'subheading',
      parent: 'hero',
      parameters: { textStyle: 'body', color: 'var(--text-2)' }
    },
    {
      // 🔴 DEFECT 2 of 2 — a picture that is not in the project. The graph is valid; the page has a
      // grey rectangle where the photograph is.
      id: 'hero_photo',
      type: 'Image',
      label: 'Hero photo',
      parent: 'hero',
      parameters: {
        src: 'noodl_modules/starter-imagery/work-potter.webp',
        sizeMode: 'explicit',
        objectFit: 'cover',
        width: { value: 100, unit: '%' },
        height: { value: 320, unit: 'px' },
        borderRadius: 'var(--radius-lg)'
      }
    },
    { ...band('features', ['feat_one', 'feat_two']), parent: 'shell' },
    { id: 'feat_one', type: 'Text', label: 'feature one', parent: 'features', parameters: { textStyle: 'body' } },
    { id: 'feat_two', type: 'Text', label: 'feature two', parent: 'features', parameters: { textStyle: 'body' } }
  ],
  []
);

writeComponent(
  'App',
  [
    {
      id: 'app_root',
      type: 'Group',
      label: 'App',
      children: ['app_router'],
      parameters: { sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } },
      x: 40,
      y: 40
    },
    {
      id: 'app_router',
      type: 'Router',
      label: 'Main router',
      parent: 'app_root',
      parameters: { name: 'Main', pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] } },
      x: 100,
      y: 160
    }
  ],
  []
);

fs.writeFileSync(
  path.join(OUT, 'components', '_registry.json'),
  JSON.stringify(
    { $schema: 'https://opennoodl.dev/schemas/registry-v2.json', version: 1, lastUpdated: stamp, components: registry },
    null,
    2
  ) + '\n'
);
fs.writeFileSync(
  path.join(OUT, 'nodegx.project.json'),
  JSON.stringify(
    {
      $schema: 'https://opennoodl.dev/schemas/project-v2.json',
      name: 'VIB-007 M1 — the page nobody looked at',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'VIB-007 M1', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// eslint-disable-next-line no-console
console.log(`wrote ${Object.keys(registry).length} components to ${OUT}`);
