#!/usr/bin/env node
/**
 * DSG-003 — turn an example fragment into a project the renderer can open.
 *
 * Usage:
 *   node example-to-project.js <example-id|path>... --out <dir> [options]
 *
 *   --out <dir>        where to write the project      (required)
 *   --root <name>      component to host in App        (default: the first
 *                      component of the first example)
 *   --donor <dir>      project to copy `noodl_modules` from, so icon and font
 *                      modules resolve   (default: the first project under
 *                      `NodeGX test projects/` that has them)
 *   --tokens <dir>     also copy that donor's `metadata.designTokens`
 *                      (default: OFF — the project gets `DefaultTokens`, which
 *                      is what the doctrine teaches against)
 *   --no-modules       skip the module copy entirely
 *
 * Then:
 *   npm run render:report -- <dir> --viewports desktop,phone
 *
 * ## Why this exists
 *
 * DSG-003's first rule is **author a recipe from a measured build, never from
 * taste** — and its register records what happens otherwise: three shipped
 * recipes declared all 11 of their `Component Inputs` ports backwards and
 * `catalog:examples` stayed green for two days (F13/F23). A structural gate
 * cannot see that a fragment renders as one column; only a render can.
 *
 * Before this script there was no path from `docs/node-catalog/examples/*.json`
 * to a render at all. The example format and the on-disk v2 `nodes.json` format
 * are very nearly the same shape — `id`/`type`/`label`/`parameters`/`children`/
 * `ports` are identical — so the transform is small. What is *not* free is the
 * surround: a component alone renders nothing (a project with no `visualRoots`
 * draws an empty page and reports clean), so this synthesises the `App` root
 * that hosts it.
 *
 * ⚠️ The host is a **full-viewport Group**, not a bare instance. A recipe whose
 * root is `width: 100%` needs a parent with a width to be 100% *of*; dropped
 * straight in as the visual root it measures as a strip.
 *
 * ⚠️ **This does not validate.** Run `npm run catalog:examples` as well — this
 * script will happily render a fragment the corpus gate rejects.
 *
 * @module dev-docs/tasks/phase-54-design-groundwork/measurements/example-to-project
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXAMPLES_DIR = path.join(REPO_ROOT, 'docs/node-catalog/examples');
const TEST_PROJECTS = path.resolve(REPO_ROOT, '..', 'NodeGX test projects');

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--out', '--root', '--donor', '--tokens']);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));

/**
 * Ids have to be stable across runs: a re-render after an edit is only
 * comparable to the one before it if nothing incidental moved. So these are
 * derived from the name rather than minted, and `Math.random`/`Date.now` appear
 * nowhere in this file.
 */
function idFor(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(i) + i, 0x85ebca6b) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex((h1 ^ h2) >>> 0);
  const d = hex((Math.imul(h1, 31) + h2) >>> 0);
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-a${c.slice(0, 3)}-${c.slice(3)}${d.slice(0, 4)}`;
}

/** `/Components/EmptyState` (the legacyName, and an instance node's `type`). */
const legacyName = (name) => (name.startsWith('/') ? name : `/${name}`);
/** `Components/EmptyState` (the directory under `components/`). */
const dirName = (name) => legacyName(name).slice(1);

function readExample(idOrPath) {
  const candidates = [
    idOrPath,
    path.join(EXAMPLES_DIR, idOrPath),
    path.join(EXAMPLES_DIR, `${idOrPath}.json`)
  ];
  const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!found) {
    console.error(`No example "${idOrPath}" — looked in ${EXAMPLES_DIR} and as a path.`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(found, 'utf8'));
}

/** The first project under `NodeGX test projects/` carrying the icon+font modules. */
function findDonor() {
  if (!fs.existsSync(TEST_PROJECTS)) return null;
  for (const entry of fs.readdirSync(TEST_PROJECTS)) {
    const modules = path.join(TEST_PROJECTS, entry, 'noodl_modules');
    if (fs.existsSync(modules)) return path.join(TEST_PROJECTS, entry);
  }
  return null;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const outDir = flag('--out');
  if (!positional.length || !outDir) {
    console.error('usage: example-to-project.js <example-id>... --out <dir> [--root <component>]');
    process.exit(2);
  }

  const examples = positional.map(readExample);
  const components = examples.flatMap((e) => (e.components ?? []).map((c) => ({ ...c, exampleId: e.id })));
  if (!components.length) {
    console.error('Those examples declare no components.');
    process.exit(2);
  }

  const rootName = flag('--root', components[0].name);
  const hosted = components.find((c) => legacyName(c.name) === legacyName(rootName));
  if (!hosted) {
    console.error(`--root "${rootName}" is not one of: ${components.map((c) => c.name).join(', ')}`);
    process.exit(2);
  }

  const projectName = examples.map((e) => e.id).join(' + ');
  const modified = '2026-01-01T00:00:00.000Z'; // fixed, for the same reason ids are

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // --- the components, very nearly a copy ---------------------------------
  const registry = {};
  for (const c of components) {
    const componentId = idFor(`component:${c.name}`);
    const dir = path.join(outDir, 'components', dirName(c.name));
    writeJson(path.join(dir, 'component.json'), {
      $schema: 'https://opennoodl.dev/schemas/component-v2.json',
      id: componentId,
      name: legacyName(c.name).split('/').pop(),
      path: legacyName(c.name),
      type: 'visual',
      modified
    });

    // `parent` is derivable from `children` and half the corpus omits it; the
    // renderer wants both directions, so fill in what the fragment left out.
    const parentOf = new Map();
    for (const n of c.nodes ?? []) for (const child of n.children ?? []) parentOf.set(child, n.id);
    const roots = (c.nodes ?? []).filter((n) => !parentOf.has(n.id) && !n.parent);

    writeJson(path.join(dir, 'nodes.json'), {
      $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
      componentId,
      version: 1,
      nodes: (c.nodes ?? []).map((n, i) => ({
        ...n,
        x: n.x ?? (i % 6) * 200,
        y: n.y ?? Math.floor(i / 6) * 160,
        ...(parentOf.has(n.id) ? { parent: parentOf.get(n.id) } : {})
      })),
      // ⚠️ A component with no `visualRoots` renders NOTHING and reports clean.
      visualRoots: roots.map((n) => n.id)
    });

    writeJson(path.join(dir, 'connections.json'), {
      $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
      componentId,
      version: 1,
      connections: c.connections ?? []
    });

    registry[dirName(c.name)] = {
      path: dirName(c.name),
      type: 'visual',
      nodeCount: (c.nodes ?? []).length,
      connectionCount: (c.connections ?? []).length,
      modified
    };
  }

  // --- the App root that hosts it -----------------------------------------
  const appId = idFor('component:App');
  const hostId = idFor('node:app-host');
  const instanceId = idFor(`node:instance:${hosted.name}`);
  writeJson(path.join(outDir, 'components/App/component.json'), {
    $schema: 'https://opennoodl.dev/schemas/component-v2.json',
    id: appId,
    name: 'App',
    path: 'App',
    type: 'visual',
    modified
  });
  writeJson(path.join(outDir, 'components/App/nodes.json'), {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId: appId,
    version: 1,
    nodes: [
      {
        // ⚠️ A full-viewport Group, not a bare instance: a recipe root at
        // `width: 100%` needs a parent with a width to be 100% of.
        id: hostId,
        type: 'Group',
        label: 'Render host',
        x: 100,
        y: 100,
        parameters: {
          width: { value: 100, unit: '%' },
          sizeMode: 'contentHeight',
          flexDirection: 'column',
          alignItems: 'flex-start',
          backgroundColor: 'var(--background)'
        },
        children: [instanceId]
      },
      {
        id: instanceId,
        type: legacyName(hosted.name),
        label: `${hosted.exampleId} under test`,
        x: 100,
        y: 300,
        parent: hostId
      }
    ],
    visualRoots: [hostId]
  });
  writeJson(path.join(outDir, 'components/App/connections.json'), {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId: appId,
    version: 1,
    connections: []
  });
  registry.App = { path: 'App', type: 'visual', nodeCount: 2, connectionCount: 0, modified };

  writeJson(path.join(outDir, 'components/_registry.json'), {
    $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
    version: 1,
    lastUpdated: modified,
    components: registry
  });

  // --- the project file ----------------------------------------------------
  const metadata = {
    title: projectName,
    description: `DSG-003 render harness for ${projectName}. Generated; edit the example, not this.`
  };
  const tokenDonor = flag('--tokens');
  if (tokenDonor) {
    const donorJson = JSON.parse(fs.readFileSync(path.join(tokenDonor, 'nodegx.project.json'), 'utf8'));
    if (donorJson.metadata?.designTokens) metadata.designTokens = donorJson.metadata.designTokens;
  }
  writeJson(path.join(outDir, 'nodegx.project.json'), {
    $schema: 'https://opennoodl.dev/schemas/project-v2.json',
    name: projectName,
    version: '4',
    nodegxVersion: '1.1.0',
    modified,
    structure: { componentsDir: 'components', assetsDir: 'assets' },
    runtimeVersion: 'react19',
    rootNodeId: hostId,
    settings: { bodyScroll: true },
    metadata
  });

  // --- the modules the fragments assume ------------------------------------
  let modulesFrom = null;
  if (!argv.includes('--no-modules')) {
    const donor = flag('--donor', findDonor());
    if (donor && fs.existsSync(path.join(donor, 'noodl_modules'))) {
      copyDir(path.join(donor, 'noodl_modules'), path.join(outDir, 'noodl_modules'));
      modulesFrom = donor;
    }
  }

  console.log(`${projectName} → ${outDir}`);
  console.log(`  ${components.length} component(s), hosted: ${legacyName(hosted.name)}`);
  console.log(`  modules: ${modulesFrom ? path.basename(modulesFrom) : 'none (icons and fonts will not resolve)'}`);
  console.log(`  tokens:  ${metadata.designTokens ? `copied from ${path.basename(tokenDonor)}` : 'DefaultTokens'}`);
  console.log('');
  console.log(`  npm run render:report -- "${outDir}" --viewports desktop,phone`);
}

main();
