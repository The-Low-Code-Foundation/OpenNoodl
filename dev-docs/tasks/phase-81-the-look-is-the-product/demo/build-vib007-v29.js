/**
 * VIB-007 / register **V29** — materialise every corpus example that carries a `maxWidth` on a
 * `Text`, so the row's predicate can be measured on rendered pages before it is written.
 *
 * 🔴 **Why every example and not just the accused one.** V29's row names one defect
 * (`ui-image-scrim-band`, measured 374 left / 766 right at 1900) but the same *static* shape — a
 * `Text` carrying a `maxWidth` narrower than its shell — appears **13** times across **7** examples,
 * and **three of those are on `ui-landing-page`**, the page Richard ruled *"it looks fucking pro"*.
 * §9.3 is the cautionary tale: V23's tabled predicate would have condemned five glyphs on that same
 * page. So the population is rendered whole, and the predicate is derived from what separates the
 * ruled defect from the ruled-beautiful page — not from the row's sentence.
 *
 * This lifts nothing that carries a `Page`. `ui-split-hero` is a bare `/Components/Hero` with no
 * page component in the example, so it gets a minimal wrapper page whose only child is the
 * component instance; that wrapper is the one thing here a reader should not treat as shipped
 * authoring.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib007-v29.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs/node-catalog/examples');

const CATALOG = require(path.join(REPO, 'packages/noodl-types/src/node-catalog.json'));
const VISUAL = new Set(CATALOG.nodes.filter((n) => n.isVisual).map((n) => n.typeName));
const drawsSomething = (node) => VISUAL.has(node.type) || node.type.startsWith('/');

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const stamp = '2026-08-31T00:00:00.000Z';

/** Derived from the catalog's own `isVisual` — never a hard-coded id (VIB-006's builder note). */
const visualRootsOf = (nodes) => nodes.filter((n) => !n.parent && drawsSomething(n)).map((n) => n.id);

function materialise(exampleId, outDir) {
  const example = JSON.parse(fs.readFileSync(path.join(EXAMPLES, exampleId + '.json'), 'utf8'));
  fs.rmSync(outDir, { recursive: true, force: true });
  const registry = {};

  function writeComponent(compPath, nodes, visualRoots, connections) {
    const dir = path.join(outDir, 'components', compPath);
    fs.mkdirSync(dir, { recursive: true });
    const id = uuid(exampleId + '/' + compPath);
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
          modifiedBy: 'vib-007-v29'
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

  for (const c of example.components) {
    writeComponent(c.name.replace(/^\//, ''), c.nodes, visualRootsOf(c.nodes), c.connections);
  }

  // The page to route at. If the example carries one, use it verbatim; otherwise wrap the first
  // visual component in a minimal page so the fragment can be rendered at all.
  let pagePath = null;
  for (const c of example.components) {
    if (c.nodes.some((n) => n.type === 'Page')) {
      pagePath = c.name.replace(/^\//, '');
      break;
    }
  }
  let wrapped = false;
  if (!pagePath) {
    const first = example.components[0];
    pagePath = 'Pages/Wrapper';
    wrapped = true;
    writeComponent(
      pagePath,
      [
        { id: 'wrap_page', type: 'Page', label: 'Wrapper', parameters: { title: exampleId, urlPath: '' }, children: ['wrap_inst'] },
        { id: 'wrap_inst', type: first.name, label: 'subject', parent: 'wrap_page', parameters: {}, x: 60, y: 160 }
      ],
      ['wrap_page']
    );
  }

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
        parameters: { name: 'Main', pages: { startPage: '/' + pagePath, routes: ['/' + pagePath] } },
        x: 100,
        y: 160
      }
    ],
    ['app_root']
  );

  fs.writeFileSync(
    path.join(outDir, 'components', '_registry.json'),
    JSON.stringify(
      { $schema: 'https://opennoodl.dev/schemas/registry-v2.json', version: 1, lastUpdated: stamp, components: registry },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(outDir, 'nodegx.project.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/project-v2.json',
        name: 'VIB-007 V29 — ' + exampleId,
        version: '4',
        nodegxVersion: '1.1.0',
        settings: { htmlTitle: exampleId, navigationPathType: 'path' },
        structure: { componentsDir: 'components', assetsDir: 'assets' },
        rootNodeId: 'app_root'
      },
      null,
      2
    ) + '\n'
  );
  return { components: Object.keys(registry).length, pagePath, wrapped };
}

// Every example carrying a `Text` with a `maxWidth`, derived rather than listed: the sweep is the
// reason this file exists, so it is re-run here rather than restated as a constant.
const SUBJECTS = fs
  .readdirSync(EXAMPLES)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(EXAMPLES, f), 'utf8'));
    return (d.components || []).some((c) =>
      (c.nodes || []).some((n) => n.type === 'Text' && n.parameters && 'maxWidth' in n.parameters)
    );
  })
  .map((f) => f.replace(/\.json$/, ''));

for (const id of SUBJECTS) {
  const out = path.join(__dirname, 'vib-007-v29', id);
  const r = materialise(id, out);
  // eslint-disable-next-line no-console
  console.log(`${id.padEnd(24)} ${String(r.components).padStart(2)} components  page=${r.pagePath}${r.wrapped ? '  (WRAPPED)' : ''}`);
}
// eslint-disable-next-line no-console
console.log(`\n${SUBJECTS.length} examples carry a Text.maxWidth`);
