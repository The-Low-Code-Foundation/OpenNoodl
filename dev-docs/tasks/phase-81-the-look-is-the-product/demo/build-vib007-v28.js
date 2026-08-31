/**
 * VIB-007 / register **V28** — the render that rules the *silent* half of the row.
 *
 * V28 makes two claims. The first is checkable by reading the corpus (30 raw pixel numbers where a
 * `--space` token belongs). The second is a **runtime** claim — *"a `var()` in a units-typed port,
 * which is dropped silently"* — and this phase has now twice been handed a number by a document
 * that turned out to have come from the wrong instrument. So it gets a render.
 *
 * 🔴 **Four arms, and two of them exist only to make the answer legible.** Every arm is a 64px-tall
 * box in a column; only `width` differs.
 *
 *  - **A** — `width: { value: 200, unit: "px" }`. The known-firing signal: an explicit width is
 *    honoured at all. Without it, a wrong reading on B cannot be told from a broken harness.
 *  - **B** — `width: "var(--space-16)"`, the token whose value is exactly `64px`. **The subject.**
 *    If the token resolves, B is 64px wide. If the value is dropped, B falls back to the runtime's
 *    own default, which register V1 says is 100% — and 100% of the shell is neither 64 nor 200, so
 *    the two outcomes cannot be confused.
 *  - **C** — `width` never written. The *default* control: whatever the runtime does with no width
 *    at all. B equalling C IS the "dropped silently" verdict, stated as a measurement rather than
 *    as an inference about what a fallback looks like.
 *  - **D** — `paddingLeft: "var(--space-16)"` on a full-width box, the CSS **pass-through** port
 *    the same token is known to work on. It is the reason this is a ruling about the PORT rather
 *    than about tokens: if D insets by 64px while B is not 64px wide, the token resolved and the
 *    units-typed port is what ate it.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib007-v28.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, 'vib-007-v28');
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
        modifiedBy: 'vib-007'
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

/** One arm: a labelled box whose ONLY distinguishing parameter is `extra`. */
function arm(prefix, word, extra) {
  return [
    {
      id: `${prefix}_band`,
      type: 'Group',
      label: word,
      parameters: {
        width: { value: 100, unit: '%' },
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        rowGap: 'var(--space-2)',
        paddingTop: 'var(--space-4)',
        paddingBottom: 'var(--space-4)',
        paddingLeft: 'var(--space-6)',
        paddingRight: 'var(--space-6)'
      },
      children: [`${prefix}_label`, `${prefix}_box`]
    },
    { id: `${prefix}_label`, type: 'Text', label: 'label', parent: `${prefix}_band`, parameters: { text: word, textStyle: 'body', color: 'var(--text-1)' } },
    {
      id: `${prefix}_box`,
      type: 'Group',
      label: 'box',
      parent: `${prefix}_band`,
      parameters: {
        sizeMode: 'explicit',
        height: { value: 64, unit: 'px' },
        backgroundColor: 'var(--primary)',
        borderRadius: 'var(--radius-md)',
        ...extra
      },
      children: [`${prefix}_inner`]
    },
    // An inner marker so a padding inset is measurable as a POSITION, not only as a width.
    {
      id: `${prefix}_inner`,
      type: 'Group',
      label: 'inner',
      parent: `${prefix}_box`,
      parameters: { sizeMode: 'explicit', width: { value: 8, unit: 'px' }, height: { value: 8, unit: 'px' }, backgroundColor: 'var(--primary-foreground)' },
      children: []
    }
  ];
}

const ARMS = [
  arm('a', 'ARM-A-EXPLICIT-200PX', { width: { value: 200, unit: 'px' } }),
  arm('b', 'ARM-B-TOKEN-IN-WIDTH', { width: 'var(--space-16)' }),
  arm('c', 'ARM-C-NO-WIDTH-AT-ALL', {}),
  arm('d', 'ARM-D-TOKEN-IN-PADDING', { width: { value: 200, unit: 'px' }, paddingLeft: 'var(--space-16)' })
];

writeComponent(
  'Pages/Home',
  [
    { id: 'page', type: 'Page', label: 'V28', parameters: { title: 'V28 — a token in a units-typed port', urlPath: 'home' }, children: ['shell'] },
    {
      id: 'shell',
      type: 'Group',
      label: 'Shell',
      parent: 'page',
      parameters: { width: { value: 100, unit: '%' }, sizeMode: 'contentHeight', flexDirection: 'column', scrollEnabled: true, backgroundColor: 'var(--surface-1)' },
      children: ['a_band', 'b_band', 'c_band', 'd_band']
    },
    ...ARMS.flat().map((n) => (n.id.endsWith('_band') ? { ...n, parent: 'shell' } : n))
  ],
  []
);

writeComponent(
  'App',
  [
    { id: 'app_root', type: 'Group', label: 'App', children: ['app_router'], parameters: { sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } }, x: 40, y: 40 },
    { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root', parameters: { name: 'Main', pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] } }, x: 100, y: 160 }
  ],
  []
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
      name: 'VIB-007 — V28, a token in a units-typed port',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'V28', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// eslint-disable-next-line no-console
console.log(`wrote ${Object.keys(registry).length} components to ${OUT}`);
