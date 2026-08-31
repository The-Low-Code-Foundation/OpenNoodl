/**
 * VIB-006 — materialise `ui-landing-page` into a v2 project the Judge can serve.
 *
 * 🔴 **This one lifts NOTHING.** VIB-003's and VIB-004's builders had to assemble a page out of
 * band-shaped recipes, and both lost something in transit: VIB-003 lost a whole band to a guessed
 * `visualRoots`, VIB-004 put eight children on a page for six bands. That work existed only because
 * **no example was a page** — which is register V8, and it is the thing this task fixed. The example
 * already contains `/Pages/Home` with a `Page` node and eight section instances, so this script is a
 * transcription: every component of the example becomes a component of the project, verbatim, plus
 * an `App` with a `Router` that the example (correctly) does not carry.
 *
 * ⚠️ That is also the strongest available check on the claim. If the example needed lifting, it would
 * not be a page.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib006-landing.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'vib-006-landing');
const EXAMPLE = path.join(REPO, 'docs/node-catalog/examples/ui-landing-page.json');

const CATALOG = require(path.join(REPO, 'packages/noodl-types/src/node-catalog.json'));
const VISUAL = new Set(CATALOG.nodes.filter((n) => n.isVisual).map((n) => n.typeName));
const drawsSomething = (node) => VISUAL.has(node.type) || node.type.startsWith('/');

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const stamp = '2026-08-31T00:00:00.000Z';
const registry = {};

function writeComponent(compPath, nodes, visualRoots, connections) {
  const dir = path.join(OUT, 'components', compPath);
  fs.mkdirSync(dir, { recursive: true });
  const id = uuid(compPath);
  const conns = connections || [];
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
        modifiedBy: 'vib-006'
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'nodes.json'),
    JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/nodes-v2.json', componentId: id, version: 1, nodes, visualRoots }, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'connections.json'),
    JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/connections-v2.json', componentId: id, version: 1, connections: conns }, null, 2) + '\n'
  );
  registry[compPath] = { path: compPath, type: 'visual', nodeCount: nodes.length, connectionCount: conns.length, modified: stamp, created: stamp };
}

/**
 * A component's visual roots, DERIVED from the catalog's own `isVisual` — never a hard-coded id.
 * 🔴 VIB-003's builder guessed one and lost a band; VIB-004's treated a parentless `Static Data` as
 * a visual root and put two extra children on its page. Both were invisible to every gate.
 */
const visualRootsOf = (nodes) => nodes.filter((n) => !n.parent && drawsSomething(n)).map((n) => n.id);

const example = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
for (const c of example.components) {
  // "/Pages/Home" → "Pages/Home"; the project stores components under a directory path.
  writeComponent(c.name.replace(/^\//, ''), c.nodes, visualRootsOf(c.nodes), c.connections);
}

writeComponent(
  'App',
  [
    { id: 'app_root', type: 'Group', label: 'App', children: ['app_router'], parameters: { sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } }, x: 40, y: 40 },
    { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root', parameters: { name: 'Main', pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] } }, x: 100, y: 160 }
  ],
  ['app_root']
);

fs.writeFileSync(
  path.join(OUT, 'components', '_registry.json'),
  JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/registry-v2.json', version: 1, lastUpdated: stamp, components: registry }, null, 2) + '\n'
);
fs.writeFileSync(
  path.join(OUT, 'nodegx.project.json'),
  JSON.stringify(
    {
      $schema: 'https://opennoodl.dev/schemas/project-v2.json',
      name: 'VIB-006 — the worked page',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'Ashcombe Market Garden', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

const page = example.components.find((c) => c.name === '/Pages/Home');
// eslint-disable-next-line no-console
console.log(
  `wrote ${Object.keys(registry).length} components from ${EXAMPLE.split('/').pop()}; ` +
    `page graph = ${page.nodes.length} nodes, ${page.nodes.find((n) => n.type === 'Page').children.length} section instances`
);
