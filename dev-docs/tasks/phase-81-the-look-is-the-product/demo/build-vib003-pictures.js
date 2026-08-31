/**
 * VIB-003 — the demonstration project, assembled from the shipped recipes.
 *
 * 🔴 **The page is copied out of `docs/node-catalog/examples/`, not written here**, and that is the
 * whole argument. A hand-written page would prove that *a person* can put a glyph and a picture on
 * a screen, which nobody doubts. What has to be proved is that the **sanctioned corpus** does — so
 * the picture must be of the recipes an authoring model is actually handed.
 *
 * Four bands, four recipes:
 *
 * | band | recipe | what it is evidence for |
 * |---|---|---|
 * | 1 | `ui-split-hero` | an `Image` with a real `src`, from a starter asset |
 * | 2 | `ui-icon-feature-strip` | three `Icon` nodes drawing three Lucide glyphs |
 * | 3 | `vis-columns-media-cards` | a card with a cover picture AND an icon in its own row |
 * | 4 | `ui-empty-state` | an icon carrying the whole message of a state |
 *
 * 🔴 **`DEMO_OVERRIDES` is empty, and that is the result.** VIB-002's builder needed one — a
 * photograph, because no shipped example had one (register V7). This one needs none: the hero's
 * `src` and every glyph on the page come out of the corpus unchanged, and the three card covers are
 * ordinary instance parameters on a component that declares `coverUrl` as an input, which is what
 * the recipe is for. The constant is kept rather than deleted because an empty override list is a
 * *measurement* — the next session to add one has to say why in the same place.
 *
 * The only words this script writes are the copy in bands 1 and 3, so the page says what it is
 * evidence of rather than reading "Title" four times.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib003-pictures.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'vib-003-pictures');
const EXAMPLES = path.join(REPO, 'docs/node-catalog/examples');
const STARTER = path.join(
  REPO,
  'packages/noodl-editor/src/assets/starter-project/noodl_modules'
);

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** Every component of a recipe, keyed by its name — several of these are multi-component. */
function recipeComponents(id) {
  const file = JSON.parse(fs.readFileSync(path.join(EXAMPLES, id + '.json'), 'utf8'));
  const byName = {};
  for (const c of file.components) byName[c.name] = c;
  return byName;
}

/**
 * What the demo sets that a recipe cannot, and why — one entry per reason. **Currently none.**
 *
 * 🔴 Not "what looked better". A demo that quietly improved the recipes would photograph something
 * an authoring model is not handed, which is the failure this phase was opened over. Empty means
 * every parameter in the picture came from the shipped corpus.
 */
const DEMO_OVERRIDES = {};

const stamp = '2026-08-31T00:00:00.000Z';
const registry = {};

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
        modifiedBy: 'vib-003'
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

/**
 * Copy one recipe component's nodes under a prefix, dropping any `Page` wrapper.
 *
 * Every id, parent, child and connection endpoint is rewritten with the prefix, so the same recipe
 * can appear on the page more than once without two nodes claiming one id.
 */
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
    for (const n of nodes) if (!n.parent) roots.push(n.id);
  }
  return { nodes, roots };
}

/** Rewrite a recipe component's own connections onto the prefixed ids. */
function liftConnections(component, prefix) {
  return (component.connections || []).map((c) => ({
    ...c,
    fromId: prefix + c.fromId,
    toId: prefix + c.toId
  }));
}

/**
 * A component's visual roots, DERIVED — the parentless nodes that are not the interface.
 *
 * 🔴 Hard-coded first, and it cost a whole band. `'card'` was a guess at `/Media Card`'s root id;
 * the node is called `card_root`, so `visualRoots` named nothing, the three instances rendered as
 * nothing, and the page went to the Judge with a section heading over an empty space. Every gate
 * passed: the project parsed, the look file's own assertions passed, `unreachablePx` was 0 and
 * `textChars` was 591 because the *heading* still had its words. **Only the picture said so** —
 * which is the phase's method catching this script rather than the product, twice in one session.
 */
function visualRootsOf(component) {
  return component.nodes.filter((n) => !n.parent && n.type !== 'Component Inputs').map((n) => n.id);
}

const words = (map) => (n) => {
  if (map[n.id] !== undefined) n.parameters.text = map[n.id];
};

// ── The two sub-components, written as components ────────────────────────────
// 🔴 NOT flattened onto the page, and the first draft of this script got it wrong in a way worth
// recording. Lifting `/Media Card`'s nodes inline carried its `Component Inputs` node and the
// connection `card_inputs.coverUrl -> cover_image.src` with them — so the demo's cover parameter
// would have been overridden by a wire with nothing behind it, and three cards would have rendered
// blank while `DEMO_OVERRIDES` said otherwise. A component interface is not decoration; a port fed
// by a connection ignores the parameter beside it.
const trustItem = recipeComponents('ui-icon-feature-strip')['/Components/TrustItem'];
writeComponent(
  'Components/TrustItem',
  trustItem.nodes.map((n, i) => ({ ...n, x: 60 + (i % 2) * 220, y: 60 + i * 90 })),
  visualRootsOf(trustItem),
  trustItem.connections
);

const mediaCard = recipeComponents('vis-columns-media-cards')['/Media Card'];
writeComponent(
  'Media Card',
  mediaCard.nodes.map((n, i) => ({ ...n, x: 60 + (i % 2) * 220, y: 60 + i * 90 })),
  visualRootsOf(mediaCard),
  mediaCard.connections
);

// ── Band 1: the split hero, now carrying the picture its name promises ───────
const splitHero = recipeComponents('ui-split-hero');
const b1 = lift(splitHero['/Components/Hero'], 'b1_', words({
  b1_eyebrow: 'Shipped with every project',
  b1_headline: 'A page that has a picture in it.',
  b1_lead:
    'Nothing here was downloaded. The picture is a starter asset, the glyphs below are Lucide, and both arrive in every project this editor makes — offline, with nothing to approve.'
}));
const b1c = liftConnections(splitHero['/Components/Hero'], 'b1_');

// ── Band 2: the icon feature strip — one component, three placements, three glyphs ──
const b2 = lift(recipeComponents('ui-icon-feature-strip')['/Components/TrustStrip'], 'b2_');
const b2c = liftConnections(recipeComponents('ui-icon-feature-strip')['/Components/TrustStrip'], 'b2_');

// ── Band 4: the empty state, where an icon carries the message ───────────────
const emptyState = recipeComponents('ui-empty-state')['/Components/EmptyState'];
const b4 = lift(emptyState, 'b4_');
const b4c = liftConnections(emptyState, 'b4_');

// ── Band 3: three media-card INSTANCES, each with its own cover and title ────
// Three different tiles, deliberately: three identical pictures would teach the repetition the
// rubric calls a WordPress tell, whatever the copy said.
const CARDS = [
  { id: 'b3a', cover: 'noodl_modules/starter-imagery/tile-1.svg', title: 'Three pictures, not one', status: 'var(--primary)' },
  { id: 'b3b', cover: 'noodl_modules/starter-imagery/tile-2.svg', title: 'A glyph inside the card', status: 'var(--accent-foreground)' },
  { id: 'b3c', cover: 'noodl_modules/starter-imagery/tile-3.svg', title: 'Different by construction', status: 'var(--muted-foreground)' }
];

const cardBand = [
  {
    id: 'b3_band',
    type: 'Group',
    label: 'Cards band',
    parameters: {
      sizeMode: 'contentHeight',
      width: { value: 100, unit: '%' },
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'var(--background)',
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
      sizeMode: 'contentHeight',
      width: { value: 100, unit: '%' },
      maxWidth: { value: 1200, unit: 'px' },
      flexDirection: 'column',
      rowGap: 'var(--space-8)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['b3_heading', 'b3_cols']
  },
  {
    id: 'b3_heading',
    type: 'Text',
    label: 'Section heading',
    parent: 'b3_shell',
    parameters: {
      text: 'Every card has its own picture.',
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'b3_cols',
    type: 'net.noodl.visual.columns',
    label: 'Three up, collapsing',
    parent: 'b3_shell',
    parameters: {
      layoutString: '1 1 1',
      marginX: { value: 24, unit: 'px' },
      smallBreakpoint: { value: 800, unit: 'px' },
      smallLayout: '1'
    },
    children: CARDS.map((c) => c.id)
  },
  ...CARDS.map((c) => ({
    id: c.id,
    type: '/Media Card',
    label: c.title,
    parent: 'b3_cols',
    parameters: { coverUrl: c.cover, title: c.title, statusColor: c.status }
  }))
];

const pageChildren = [...b1.roots, ...b2.roots, 'b3_band', ...b4.roots];
const bodyNodes = [...b1.nodes, ...b2.nodes, ...cardBand, ...b4.nodes];

const nodes = [
  {
    id: 'page',
    type: 'Page',
    label: 'The pictures',
    parameters: { title: 'The pictures', urlPath: '' },
    children: pageChildren,
    x: 40,
    y: 40
  },
  ...bodyNodes.map((n, i) => ({ ...n, parent: n.parent || 'page', x: 60 + (i % 3) * 60, y: 160 + i * 90 }))
];

writeComponent('Pages/Pictures', nodes, ['page'], [...b1c, ...b2c, ...b4c]);
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
      parameters: { name: 'Main', pages: { startPage: '/Pages/Pictures', routes: ['/Pages/Pictures'] } },
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
      name: 'VIB-003 — the pictures',
      version: '4',
      nodegxVersion: '1.1.0',
      settings: { htmlTitle: 'VIB-003 — the pictures', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// ⚠️ The demo does NOT copy the starter modules in. `judge()` installs them, from the same
// `STARTER_ASSETS` list the editor installs from — so if this script placed its own copies, the
// picture would prove that THIS SCRIPT can put an icon set somewhere, which is not the claim.
// A missing module here is a failing Judge run, which is the correct outcome.
if (!fs.existsSync(path.join(STARTER, 'starter-imagery', 'tile-1.svg'))) {
  console.warn('[vib-003] starter imagery is not generated — run scripts/library/make-starter-imagery.js');
}

console.log('wrote', OUT);
