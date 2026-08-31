/**
 * VIB-007 / register **V32** — the render that rules the corpus repair the gate demands.
 *
 * Switching `raw-color-literal` on in `catalog:examples` costs exactly **one** repair, measured
 * before anything was written: `var-avatar-picker-responsive.json`'s `Color` node carries
 * `"value": "#3366ff"` and fans it out over connections to a `Text.color` and a Button's
 * `backgroundColor`. The repair is `var(--primary)` — and the repair is only correct if a token
 * **survives a `Color` variable node**, which is a runtime question. `Color`'s `cast` is
 * `(value) => value`, i.e. it appears to pass anything through; that is a reading of one file, and
 * the phase's rule is that a reading is not a ruling.
 *
 * 🔴 **Three arms, because two would not separate the failure modes.**
 *
 *  - **A — the known-firing signal.** A `Color` node holding a plain hex, wired to a `Text.color`.
 *    Without it, "arm B is not blue" cannot be told from "the connection never delivered", "the
 *    `Color` node did not initialise", or "the harness served the wrong page".
 *  - **B — the subject.** The same wiring, `value: "var(--primary)"`. This is the repaired corpus
 *    shape exactly.
 *  - **C — the token control.** A `Text` whose `color` PARAMETER is `var(--primary)`, set directly
 *    with no node in between. This is the sanctioned path the whole corpus already uses, so it is
 *    what B has to equal. Comparing B against a hard-coded `rgb(37, 99, 235)` instead would make
 *    the test a second copy of `DefaultTokens.ts` and would red on a palette change that broke
 *    nothing.
 *
 * Every arm also paints a Group background from the same source, because the avatar example wires
 * its colour to a `backgroundColor` as well as to a `color` and the two are different setters.
 *
 * ⚠️ Each Text carries a distinct word, so a screenshot reads as a ruling rather than as three
 * indistinguishable blue lines.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib007-v32.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, 'vib-007-v32');
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
 * One arm: a labelled band, a swatch Group and a line of text.
 *
 * `source` is `undefined` for arm C — the arm with no `Color` node, whose colour is written
 * straight into the parameters.
 */
function arm(prefix, heading, word, colourValue, viaColorNode, y) {
  const painted = viaColorNode ? {} : { color: colourValue };
  const swatch = viaColorNode ? {} : { backgroundColor: colourValue };
  const nodes = [
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
      children: [`${prefix}_heading`, `${prefix}_swatch`, `${prefix}_line`]
    },
    {
      id: `${prefix}_heading`,
      type: 'Text',
      label: 'heading',
      parent: `${prefix}_band`,
      parameters: { text: heading, textStyle: 'h3', color: 'var(--text-1)' }
    },
    {
      id: `${prefix}_swatch`,
      type: 'Group',
      label: 'swatch',
      parent: `${prefix}_band`,
      parameters: {
        sizeMode: 'explicit',
        width: { value: 160, unit: 'px' },
        height: { value: 48, unit: 'px' },
        borderRadius: 'var(--radius-md)',
        ...swatch
      },
      children: []
    },
    {
      id: `${prefix}_line`,
      type: 'Text',
      label: 'line',
      parent: `${prefix}_band`,
      // 🔴 The discriminator. If the colour never arrives, the Text falls back to the runtime's
      // own default and this word is BLACK — a legible failure rather than an absent one.
      parameters: { text: word, textStyle: 'h2', ...painted }
    }
  ];
  const connections = [];
  if (viaColorNode) {
    nodes.push({
      id: `${prefix}_colour`,
      type: 'Color',
      label: 'accent',
      x: 700,
      y,
      parameters: { value: colourValue }
    });
    connections.push(
      { fromId: `${prefix}_colour`, fromProperty: 'savedValue', toId: `${prefix}_line`, toProperty: 'color' },
      { fromId: `${prefix}_colour`, fromProperty: 'savedValue', toId: `${prefix}_swatch`, toProperty: 'backgroundColor' }
    );
  }
  return { nodes, connections };
}

const A = arm('a', 'ARM A — Color node holding a HEX (the corpus shape being repaired)', 'HEX-THROUGH-NODE', '#3366ff', true, 60);
const B = arm('b', 'ARM B — Color node holding a TOKEN (the repair)', 'TOKEN-THROUGH-NODE', 'var(--primary)', true, 260);
const C = arm('c', 'ARM C — token written straight into the parameter (the sanctioned path)', 'TOKEN-IN-PARAMETER', 'var(--primary)', false, 0);

writeComponent(
  'Pages/Home',
  [
    {
      id: 'page',
      type: 'Page',
      label: 'V32',
      parameters: { title: 'V32 — does a token survive a Color node?', urlPath: 'home' },
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
      children: ['a_band', 'b_band', 'c_band']
    },
    ...[A, B, C].flatMap((a) => a.nodes.map((n) => (n.id.endsWith('_band') ? { ...n, parent: 'shell' } : n)))
  ],
  [...A.connections, ...B.connections, ...C.connections]
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
      name: 'VIB-007 — V32, does a design token survive a Color node?',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'V32', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// eslint-disable-next-line no-console
console.log(`wrote ${Object.keys(registry).length} components to ${OUT}`);
