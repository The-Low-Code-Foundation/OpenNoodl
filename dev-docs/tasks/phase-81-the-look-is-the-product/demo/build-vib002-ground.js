#!/usr/bin/env node
/**
 * VIB-002 — build the demonstration project the Judge photographs.
 *
 * 🔴 **The page is ASSEMBLED FROM THE SHIPPED RECIPES, not hand-written here.**
 * `docs/node-catalog/examples/ui-gradient-hero.json` and `ui-image-scrim-band.json`
 * are the corpus entries VIB-002 added and `npm run catalog:examples` gates; this
 * script copies their nodes verbatim and re-parents them onto one Page. That is
 * the whole point: if the demonstration were written by hand it would prove that
 * a person can express a gradient ground, which nobody doubted. What has to be
 * proved is that the *sanctioned vocabulary* can — so the picture must be of the
 * recipes an authoring model is handed.
 *
 * The only things this script adds beyond the recipes are listed in DEMO_OVERRIDES
 * below, and each says why.
 *
 * Regenerate:  node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib002-ground.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'vib-002-ground');
const EXAMPLES = path.join(REPO, 'docs/node-catalog/examples');

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const recipe = (id) => JSON.parse(fs.readFileSync(path.join(EXAMPLES, id + '.json'), 'utf8')).components[0].nodes;

/**
 * What the demo sets that the recipe cannot.
 *
 * ⚠️ `backgroundImage` is `""` in every shipped example (register V7 — the whole
 * corpus ships empty images, owner VIB-003). A recipe therefore cannot carry the
 * picture, and a verdict about an image ground has to come from a project that
 * has one. `/assets/hero.jpg` is served by `render-from-disk.js` straight out of
 * the project directory, which is the same path a real project's asset takes.
 */
const DEMO_OVERRIDES = {
  'r1_band': { backgroundImage: '/assets/hero.jpg' }
};

const stamp = '2026-08-31T00:00:00.000Z';
const registry = {};

function writeComponent(compPath, nodes, visualRoots) {
  const dir = path.join(OUT, 'components', compPath);
  fs.mkdirSync(dir, { recursive: true });
  const id = uuid(compPath);
  const name = compPath.split('/').pop();
  fs.writeFileSync(
    path.join(dir, 'component.json'),
    JSON.stringify(
      { $schema: 'https://opennoodl.dev/schemas/component-v2.json', id, name, path: '/' + compPath,
        type: 'visual', created: stamp, modified: stamp, modifiedBy: 'vib-002' }, null, 2) + '\n');
  fs.writeFileSync(
    path.join(dir, 'nodes.json'),
    JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/nodes-v2.json', componentId: id, version: 1, nodes, visualRoots }, null, 2) + '\n');
  fs.writeFileSync(
    path.join(dir, 'connections.json'),
    JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/connections-v2.json', componentId: id, version: 1, connections: [] }, null, 2) + '\n');
  registry[compPath] = { path: compPath, type: 'visual', nodeCount: nodes.length, connectionCount: 0, modified: stamp, created: stamp };
}

/** Copy one recipe's nodes under a prefix, dropping its own Page wrapper. */
function band(recipeId, index, mutate) {
  const prefix = `r${index}_`;
  const nodes = [];
  const roots = [];
  for (const n of recipe(recipeId)) {
    if (n.type === 'Page') { roots.push(...(n.children || []).map((c) => prefix + c)); continue; }
    const copy = JSON.parse(JSON.stringify(n));
    copy.id = prefix + copy.id;
    if (copy.parent) copy.parent = prefix + copy.parent;
    if (copy.children) copy.children = copy.children.map((c) => prefix + c);
    if (DEMO_OVERRIDES[copy.id]) Object.assign(copy.parameters, DEMO_OVERRIDES[copy.id]);
    if (mutate) mutate(copy);
    nodes.push(copy);
  }
  return { nodes, roots };
}

const hero = band('ui-gradient-hero', 0);
const image = band('ui-image-scrim-band', 1);

// The third ground: the SAME hero recipe wearing a different gradient token and
// its own words. Nothing about the layout changes — which is the argument for
// putting the ground in a token rather than in a composition per mood.
const cta = band('ui-gradient-hero', 2, (n) => {
  if (n.parameters && n.parameters.backgroundGradient) n.parameters.backgroundGradient = 'var(--gradient-brand)';
  if (n.parameters && n.parameters.paddingTop === 'var(--space-24)') {
    n.parameters.paddingTop = 'var(--space-20)';
    n.parameters.paddingBottom = 'var(--space-20)';
  }
});
const CTA_WORDS = {
  r2_eyebrow: 'The same band, one token apart',
  r2_headline: 'Change the mood without touching the layout.',
  r2_lead: 'This band is the hero recipe with var(--gradient-brand) instead of var(--gradient-spotlight). Nothing else moved.',
  r2_stat_a: 'Same nodes',
  r2_stat_b: 'Different ground'
};
for (const n of cta.nodes) if (CTA_WORDS[n.id]) n.parameters.text = CTA_WORDS[n.id];

const pageChildren = [...hero.roots, ...image.roots, ...cta.roots];
const nodes = [
  { id: 'page', type: 'Page', label: 'The ground', parameters: { title: 'The ground', urlPath: '' }, children: pageChildren, x: 40, y: 40 },
  ...[...hero.nodes, ...image.nodes, ...cta.nodes].map((n, i) => ({
    ...n, parent: n.parent || 'page', x: 60 + (i % 3) * 60, y: 160 + i * 110
  }))
];
writeComponent('Pages/Ground', nodes, ['page']);
writeComponent('App', [
  { id: 'app_root', type: 'Group', label: 'App', children: ['app_router'],
    parameters: { sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } }, x: 40, y: 40 },
  { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root',
    parameters: { name: 'Main', pages: { startPage: '/Pages/Ground', routes: ['/Pages/Ground'] } }, x: 100, y: 160 }
], ['app_root']);

fs.writeFileSync(path.join(OUT, 'components', '_registry.json'),
  JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/registry-v2.json', version: 1, lastUpdated: stamp, components: registry }, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'nodegx.project.json'), JSON.stringify({
  $schema: 'https://opennoodl.dev/schemas/project-v2.json',
  name: 'VIB-002 — the ground',
  version: '4', nodegxVersion: '1.1.0',
  settings: { htmlTitle: 'VIB-002 — the ground', navigationPathType: 'path' },
  structure: { componentsDir: 'components', assetsDir: 'assets' },
  rootNodeId: 'app_root'
}, null, 2) + '\n');
console.log('wrote', OUT);
