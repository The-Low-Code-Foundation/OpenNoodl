/**
 * VIB-007 — the render that RULES register V22.
 *
 * The question, stated so it can only have one answer: **when a `For Each` draws a component whose
 * `Component Inputs` node declares no ports, does the item's property reach the port anyway?**
 *
 * 14 shipped examples are built on the assumption that it does. `catalog:examples` runs them 67/67
 * strict. If the answer is no, they are 14 broken examples in the corpus this phase's whole premise
 * says a model imitates.
 *
 * 🔴 **Two arms on one page, differing in ONE field.** `/Rows/Declared` and `/Rows/Undeclared` are
 * byte-identical but for the `ports` array on their `Component Inputs` node. Same repeater, same
 * `Static Data` shape, same connection, same `Text` node with the same placeholder parameter. A
 * one-armed render could not tell "the port did not deliver" from "the harness did not run the
 * repeater at all" — the declared arm is the known-firing signal the absence is read beside.
 *
 * ⚠️ Each row's `Text` carries its own placeholder as a PARAMETER (`NOT-DELIVERED-A/B`). An empty
 * string would make the two failure modes — value discarded, and value delivered as empty — the
 * same picture. The placeholder is what makes the screenshot legible as a ruling.
 *
 * The item property is deliberately named `label`, copying `/Product Row` in
 * `data-static-array-filter-repeater.json`, which is one of the 14.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib007-v22.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, 'vib-007-v22');
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

/**
 * One row component. `ports` is the ONLY difference between the two arms — passed as
 * `undefined` for the undeclared arm, which is exactly what the 14 corpus examples ship.
 */
function rowComponent(compPath, arm, ports) {
  const inputs = { id: 'row_inputs', type: 'Component Inputs', label: 'Item in', x: 420, y: 40 };
  if (ports) inputs.ports = ports;
  writeComponent(
    compPath,
    [
      {
        id: 'row',
        type: 'Group',
        label: 'Row',
        x: 40,
        y: 40,
        parameters: {
          width: { value: 100, unit: '%' },
          sizeMode: 'contentHeight',
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 'var(--space-3)',
          paddingBottom: 'var(--space-3)',
          paddingLeft: 'var(--space-4)',
          paddingRight: 'var(--space-4)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-lg)'
        },
        children: ['label_text']
      },
      {
        id: 'label_text',
        type: 'Text',
        label: 'label',
        parent: 'row',
        x: 40,
        y: 200,
        // 🔴 The discriminator. If the item property never arrives, THIS is what the screenshot
        // shows — the component's own placeholder words, which is the failure V22 describes.
        parameters: { text: `NOT-DELIVERED-${arm}`, textStyle: 'body', color: 'var(--text-1)' }
      },
      inputs
    ],
    [{ fromId: 'row_inputs', fromProperty: 'label', toId: 'label_text', toProperty: 'text' }]
  );
}

rowComponent('Rows/Declared', 'A', [{ name: 'label', plug: 'output', type: '*' }]);
rowComponent('Rows/Undeclared', 'B', undefined);

/** One band: a heading, a repeater, and the static rows it repeats over. */
function band(prefix, heading, template, items) {
  return [
    {
      id: `${prefix}_band`,
      type: 'Group',
      label: heading,
      parameters: {
        width: { value: 100, unit: '%' },
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        rowGap: 'var(--space-3)',
        paddingTop: 'var(--space-6)',
        paddingBottom: 'var(--space-6)',
        paddingLeft: 'var(--space-6)',
        paddingRight: 'var(--space-6)'
      },
      children: [`${prefix}_heading`, `${prefix}_list`]
    },
    {
      id: `${prefix}_heading`,
      type: 'Text',
      label: 'heading',
      parent: `${prefix}_band`,
      parameters: { text: heading, textStyle: 'h3', color: 'var(--text-1)' }
    },
    {
      id: `${prefix}_list`,
      type: 'Group',
      label: 'list',
      parent: `${prefix}_band`,
      parameters: { width: { value: 100, unit: '%' }, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-2)' },
      children: [`${prefix}_repeater`]
    },
    { id: `${prefix}_repeater`, type: 'For Each', label: 'rows', parent: `${prefix}_list`, parameters: { template } },
    {
      id: `${prefix}_data`,
      type: 'Static Data',
      label: 'items',
      x: 700,
      y: prefix === 'a' ? 60 : 360,
      parameters: { type: 'json', json: JSON.stringify(items) }
    }
  ];
}

const A_ITEMS = [{ label: 'DELIVERED-A one' }, { label: 'DELIVERED-A two' }, { label: 'DELIVERED-A three' }];
const B_ITEMS = [{ label: 'DELIVERED-B one' }, { label: 'DELIVERED-B two' }, { label: 'DELIVERED-B three' }];

writeComponent(
  'Pages/Home',
  [
    {
      id: 'page',
      type: 'Page',
      label: 'V22',
      parameters: { title: 'V22 — declared vs undeclared', urlPath: 'home' },
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
      children: ['a_band', 'b_band']
    },
    ...band('a', 'ARM A — Component Inputs DECLARES the port', '/Rows/Declared', A_ITEMS).map((n) =>
      n.id === 'a_band' ? { ...n, parent: 'shell' } : n
    ),
    ...band('b', 'ARM B — Component Inputs declares NOTHING (the corpus shape)', '/Rows/Undeclared', B_ITEMS).map((n) =>
      n.id === 'b_band' ? { ...n, parent: 'shell' } : n
    )
  ],
  [
    { fromId: 'a_data', fromProperty: 'items', toId: 'a_repeater', toProperty: 'items' },
    { fromId: 'b_data', fromProperty: 'items', toId: 'b_repeater', toProperty: 'items' }
  ]
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
  JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/registry-v2.json', version: 1, lastUpdated: stamp, components: registry }, null, 2) + '\n'
);
fs.writeFileSync(
  path.join(OUT, 'nodegx.project.json'),
  JSON.stringify(
    {
      $schema: 'https://opennoodl.dev/schemas/project-v2.json',
      name: 'VIB-007 — V22, declared vs undeclared component ports',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'V22', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// eslint-disable-next-line no-console
console.log(`wrote ${Object.keys(registry).length} components to ${OUT}`);
