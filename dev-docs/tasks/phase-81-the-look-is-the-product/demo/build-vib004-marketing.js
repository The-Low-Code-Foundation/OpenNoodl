/**
 * VIB-004 — the marketing kit, assembled into one page.
 *
 * 🔴 **Every band is copied out of `docs/node-catalog/examples/`, and `DEMO_OVERRIDES` is empty.**
 * Same argument as VIB-003's builder: a hand-written page would prove that a person can lay out a
 * landing page, which nobody doubts. What has to be proved is that the **sanctioned corpus** can —
 * so every parameter in the picture must be one an authoring model is actually handed.
 *
 * Six bands, six recipes, four grounds:
 *
 * | band | recipe | composition it is evidence for | ground |
 * |---|---|---|---|
 * | 1 | `ui-split-hero` | the existing hero + `actionRow` shape | page background |
 * | 2 | `ui-icon-feature-strip` | `featureItem` — a glyph beside words, with a gap | page background |
 * | 3 | `ui-stat-tile-row` | `statTile` | `bandSurface` |
 * | 4 | `ui-testimonial-row` | `testimonialCard` — depth, a designed object | `--gradient-surface` |
 * | 5 | `ui-cta-band` | `ctaBand`, `badge`, `actionRow` | `--gradient-brand` |
 * | 6 | `ui-footer-columns` | `footerBand` | `--muted` |
 *
 * 🔴 **Bands 4 and 5 are recipes this task WROTE**, because they were the only two of V6's seven
 * arrangements with nothing in the corpus to source a composition from. The other five were already
 * there — measured at the door before any of this was written, and it is the finding that shaped the
 * task: V6 said "zero marketing compositions of 26" and the true reading is that the *recipes* were
 * mostly present and none of them was a **named set** an agent could be handed.
 *
 * ⚠️ Band 3 needs a wrapper and bands 4/5/6 do not. `ui-stat-tile-row`'s `/Components/StatRow` is a
 * bare `Columns` — inside its own recipe it lives in a page that supplies the band and the shell.
 * Lifted onto a page it would span the window while its neighbours stop at 1200. That is exactly the
 * bug VIB-003's builder hit with the empty state, one recipe along, and the fix is the same: give it
 * back the two compositions every other band here wears.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib004-marketing.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'vib-004-marketing');
const EXAMPLES = path.join(REPO, 'docs/node-catalog/examples');

/**
 * Which node types actually draw, read from the catalog rather than listed here.
 *
 * 🔴 The first run of this script put **8** children on the `Page` for six bands. `lift` treated
 * every parentless node as a visual root, and two of the recipes carry a parentless `Static Data`
 * node beside their band — the footer's link data and the testimonial row's quotes. A logic node in
 * `visualRoots` is not a rendering error you would see; it is a silent extra child of the page. The
 * predicate is `isVisual` in `node-catalog.json`, and deriving it is the same discipline as
 * `visualRootsOf`: never hard-code what the catalog already states.
 */
const CATALOG = require(path.join(REPO, 'packages/noodl-types/src/node-catalog.json'));
const VISUAL = new Set(CATALOG.nodes.filter((n) => n.isVisual).map((n) => n.typeName));
const drawsSomething = (node) => VISUAL.has(node.type) || node.type.startsWith('/');

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/**
 * What the demo sets that a recipe cannot, and why — one entry per reason. **Currently none.**
 *
 * Kept rather than deleted because an empty override list is a *measurement*: the next session to
 * add one has to say why in the same place. VIB-002's builder needed one (a photograph, because
 * nothing shipped carried a picture); VIB-003's and this one need none.
 */
const DEMO_OVERRIDES = {};

const stamp = '2026-08-31T00:00:00.000Z';
const registry = {};

function recipeComponents(id) {
  const file = JSON.parse(fs.readFileSync(path.join(EXAMPLES, id + '.json'), 'utf8'));
  const byName = {};
  for (const c of file.components) byName[c.name] = c;
  return byName;
}

function writeComponent(compPath, nodes, visualRoots, connections) {
  const dir = path.join(OUT, 'components', compPath);
  fs.mkdirSync(dir, { recursive: true });
  const id = uuid(compPath);
  const name = compPath.split('/').pop();
  const conns = connections || [];
  fs.writeFileSync(
    path.join(dir, 'component.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/component-v2.json',
        id,
        name,
        path: '/' + compPath,
        type: 'visual',
        created: stamp,
        modified: stamp,
        modifiedBy: 'vib-004'
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

/** Copy one recipe component's nodes under a prefix, dropping any `Page` wrapper. */
function lift(component, prefix, mutate) {
  const nodes = [];
  const roots = [];
  for (const n of component.nodes) {
    if (n.type === 'Page') {
      roots.push(...(n.children || []).map((c) => prefix + c));
      continue;
    }
    const copy = JSON.parse(JSON.stringify(n));
    copy.id = prefix + copy.id;
    if (copy.parent) copy.parent = prefix + copy.parent;
    if (copy.children) copy.children = copy.children.map((c) => prefix + c);
    copy.parameters = copy.parameters || {};
    if (DEMO_OVERRIDES[copy.id]) Object.assign(copy.parameters, DEMO_OVERRIDES[copy.id]);
    if (mutate) mutate(copy);
    nodes.push(copy);
  }
  if (roots.length === 0) {
    for (const n of nodes) if (!n.parent && drawsSomething(n)) roots.push(n.id);
  }
  return { nodes, roots };
}

function liftConnections(component, prefix) {
  return (component.connections || []).map((c) => ({
    ...c,
    fromId: prefix + c.fromId,
    toId: prefix + c.toId
  }));
}

/**
 * A component's visual roots, DERIVED — never a hard-coded id.
 *
 * 🔴 VIB-003's builder guessed one and lost a whole band: `visualRoots` named nothing, three cards
 * rendered as nothing, and every gate stayed green because the section HEADING still had its words.
 * Only the picture said so.
 */
function visualRootsOf(component) {
  return component.nodes.filter((n) => !n.parent && drawsSomething(n)).map((n) => n.id);
}

const words = (map) => (n) => {
  if (map[n.id] !== undefined) n.parameters.text = map[n.id];
};

// ── The item components, written as components rather than flattened ─────────
// 🔴 Flattening carries a `Component Inputs` node and its wires onto the page, where a port fed by
// a connection ignores the parameter beside it — VIB-003's builder proved that one too.
const trustItem = recipeComponents('ui-icon-feature-strip')['/Components/TrustItem'];
writeComponent('Components/TrustItem', trustItem.nodes, visualRootsOf(trustItem), trustItem.connections);

const statTile = recipeComponents('ui-stat-tile-row')['/Components/StatTile'];
writeComponent('Components/StatTile', statTile.nodes, visualRootsOf(statTile), statTile.connections);

const quoteCard = recipeComponents('ui-testimonial-row')['/Components/QuoteCard'];
writeComponent('Components/QuoteCard', quoteCard.nodes, visualRootsOf(quoteCard), quoteCard.connections);

const footerColumn = recipeComponents('ui-footer-columns')['/Components/FooterColumn'];
writeComponent('Components/FooterColumn', footerColumn.nodes, visualRootsOf(footerColumn), footerColumn.connections);

const footerLink = recipeComponents('ui-footer-columns')['/Components/FooterLink'];
writeComponent('Components/FooterLink', footerLink.nodes, visualRootsOf(footerLink), footerLink.connections);

// ── Band 1: the split hero ───────────────────────────────────────────────────
// The only words this script writes are the ones that say what the page is evidence OF, so it does
// not read "Title" six times. Every parameter is the recipe's.
const splitHero = recipeComponents('ui-split-hero');
const b1 = lift(splitHero['/Components/Hero'], 'b1_', words({
  b1_eyebrow: 'The marketing kit',
  b1_headline: 'Sections that were already possible, finally named.',
  b1_lead:
    'Five of the seven arrangements this page is built from already shipped as recipes and none of them was a named parameter set. An agent reading the vocabulary saw a card, a shell and a field, and had no evidence a stat tile was a thing this system has an opinion about.'
}));
const b1c = liftConnections(splitHero['/Components/Hero'], 'b1_');

// ── Band 2: the icon feature strip — `featureItem` ───────────────────────────
const strip = recipeComponents('ui-icon-feature-strip')['/Components/TrustStrip'];
const b2 = lift(strip, 'b2_');
const b2c = liftConnections(strip, 'b2_');

// ── Band 3: the stat tiles, given back the band and shell they live in ───────
const statRow = recipeComponents('ui-stat-tile-row')['/Components/StatRow'];
const b3 = lift(statRow, 'b3_');
const b3Band = [
  {
    id: 'b3_band',
    type: 'Group',
    label: 'Stats band',
    parameters: {
      // `bandSurface`, verbatim.
      width: { value: 100, unit: '%' },
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'var(--surface)',
      borderTopStyle: 'solid',
      borderTopWidth: 'var(--border-1)',
      borderTopColor: 'var(--border)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)',
      paddingTop: 'var(--space-20)',
      paddingBottom: 'var(--space-20)'
    },
    children: ['b3_shell']
  },
  {
    id: 'b3_shell',
    type: 'Group',
    label: 'Shell',
    parent: 'b3_band',
    parameters: {
      // `shell`, verbatim, plus the `sizeMode` register V17 says a shell in a band needs.
      width: { value: 100, unit: '%' },
      maxWidth: { value: 1200, unit: 'px' },
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      rowGap: 'var(--space-8)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['b3_head', ...b3.roots]
  },
  {
    id: 'b3_head',
    type: 'Text',
    label: 'Section heading',
    parent: 'b3_shell',
    parameters: {
      // `sectionHeading`, verbatim.
      text: 'What the kit costs, measured.',
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      color: 'var(--foreground)'
    }
  }
];

// ── Band 4: the testimonials — `testimonialCard`, a NEW recipe ───────────────
const testimonials = recipeComponents('ui-testimonial-row')['/Components/TestimonialRow'];
const b4 = lift(testimonials, 'b4_');
const b4c = liftConnections(testimonials, 'b4_');

// ── Band 5: the closing CTA — `ctaBand` + `badge` + `actionRow`, a NEW recipe ─
const cta = recipeComponents('ui-cta-band')['/Components/CtaBand'];
const b5 = lift(cta, 'b5_');
const b5c = liftConnections(cta, 'b5_');

// ── Band 6: the footer — `footerBand` ────────────────────────────────────────
const footer = recipeComponents('ui-footer-columns')['/Components/SiteFooter'];
const b6 = lift(footer, 'b6_');
const b6c = liftConnections(footer, 'b6_');

const pageChildren = [...b1.roots, ...b2.roots, 'b3_band', ...b4.roots, ...b5.roots, ...b6.roots];
const bodyNodes = [
  ...b1.nodes,
  ...b2.nodes,
  ...b3Band,
  ...b3.nodes.map((n) => (b3.roots.includes(n.id) ? { ...n, parent: 'b3_shell' } : n)),
  ...b4.nodes,
  ...b5.nodes,
  ...b6.nodes
];

const nodes = [
  {
    id: 'page',
    type: 'Page',
    label: 'The marketing kit',
    parameters: { title: 'The marketing kit', urlPath: '' },
    children: pageChildren,
    x: 40,
    y: 40
  },
  ...bodyNodes.map((n, i) => ({ ...n, parent: n.parent || 'page', x: 60 + (i % 3) * 60, y: 160 + i * 90 }))
];

writeComponent('Pages/Marketing', nodes, ['page'], [...b1c, ...b2c, ...b4c, ...b5c, ...b6c]);
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
      parameters: { name: 'Main', pages: { startPage: '/Pages/Marketing', routes: ['/Pages/Marketing'] } },
      x: 100,
      y: 160
    }
  ],
  ['app_root']
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
      name: 'VIB-004 — the marketing kit',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'VIB-004 — the marketing kit', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// eslint-disable-next-line no-console
console.log(
  'wrote ' + Object.keys(registry).length + ' components; page children: ' + pageChildren.length + ' bands'
);
