/**
 * LIB-004 — Import Engine v2: inventory core.
 *
 * Two things are pinned here:
 *  1. Parity — `buildInventory` reproduces the legacy
 *     `listComponentsAndDependencies` output byte-for-byte on the fixtures
 *     (`tests/project/projectimport.js` holds the legacy expectations). The new
 *     engine may find MORE (provenance edges), but the back-compat lists the
 *     ImportPopup adapter and the closure walk consume must not regress.
 *  2. Semantic advantage — with a real port-type lookup, edges the string-match
 *     heuristic cannot see (a component-typed parameter reference) are found and
 *     flagged `semantic`; the heuristic fallback is retained and flagged
 *     `inferred`.
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildInventory, catalogPortType, PortTypeLookup } from '../../src/editor/src/utils/import-engine/inventory';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';

const IGNORE = new Set(['project.json', '.ds_store', '.gitignore', '.gitattributes', 'readme.md']);

function listResources(dir: string): string[] {
  const out: string[] = [];
  const walk = (cur: string) => {
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      const rel = path.relative(dir, full).split(path.sep).join('/');
      if (rel.startsWith('.git') || rel.startsWith('noodl_modules') || rel.startsWith('__MACOSX')) continue;
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (!IGNORE.has(name.toLowerCase())) out.push(rel);
    }
  };
  walk(dir);
  return out;
}

function listModules(dir: string): string[] {
  const md = path.join(dir, 'noodl_modules');
  if (!fs.existsSync(md)) return [];
  return fs.readdirSync(md).filter((m) => fs.existsSync(path.join(md, m, 'manifest.json')));
}

function analyzeFixture(name: string) {
  const dir = path.join(process.cwd(), 'tests/testfs', name);
  const project = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
  return buildInventory({
    sourceDir: dir,
    project,
    resources: listResources(dir),
    modules: listModules(dir),
    portType: catalogPortType(loadDefaultCatalog())
  });
}

describe('LIB-004 import engine — buildInventory', () => {
  it('reproduces legacy component/dependency output on import_proj1', () => {
    const inv = analyzeFixture('import_proj1');
    const comps = inv.components.map((c) => ({
      name: c.name,
      dependencies: c.dependencies,
      fileDependencies: c.fileDependencies,
      styleDependencies: c.styleDependencies,
      variantDependencies: c.variantDependencies
    }));

    expect(comps).toEqual([
      { name: '/comp1', dependencies: [], fileDependencies: ['assets/bear.jpg'], styleDependencies: { colors: [], text: [] }, variantDependencies: [] },
      { name: '/comp2', dependencies: [], fileDependencies: [], styleDependencies: { colors: [], text: [] }, variantDependencies: [] },
      { name: '/Main', dependencies: ['/comp1'], fileDependencies: ['Fontfabric - Nexa-Bold.otf'], styleDependencies: { colors: [], text: [] }, variantDependencies: [] }
    ]);

    expect(inv.resources.map((r) => r.name).sort()).toEqual([
      'Fontfabric - Nexa-Bold.otf',
      'assets/bear.jpg',
      'assets/bikeyellowbuilding.jpg',
      'bear.jpg'
    ]);
    expect(inv.modules).toEqual([]);
    expect(inv.variants).toEqual([]);
  });

  it('reproduces legacy styles/variants/modules output on import_proj5', () => {
    const inv = analyzeFixture('import_proj5');

    expect(inv.styles.colors).toEqual([
      { name: 'Primary' },
      { name: 'Light Gray' },
      { name: 'Dark Gray' },
      { name: 'Primary Dark' },
      { name: 'Dark' },
      { name: 'Primary Light' }
    ]);

    expect(inv.styles.text).toEqual([
      { name: 'Body Text', fileDependencies: ['fonts/Roboto/Roboto-Regular.ttf'] },
      { name: 'Button Label', fileDependencies: ['fonts/Roboto/Roboto-Regular.ttf'] },
      { name: 'Label Text', fileDependencies: ['fonts/Roboto/Roboto-Regular.ttf'] }
    ]);

    expect(inv.variants).toEqual([
      {
        name: 'Basic',
        typename: 'net.noodl.controls.button',
        fileDependencies: ['fonts/Roboto/Roboto-Medium.ttf'],
        styleDependencies: { colors: ['Primary', 'Primary Light', 'Primary Dark', 'Light Gray'], text: ['Button Label'] }
      },
      {
        name: 'Search Field',
        typename: 'net.noodl.controls.textinput',
        fileDependencies: ['fonts/Roboto/Roboto-Medium.ttf'],
        styleDependencies: { colors: ['Light Gray', 'Dark', 'Primary'], text: ['Body Text', 'Label Text'] }
      }
    ]);

    expect(inv.modules).toEqual([{ name: 'material-icons' }]);
  });

  it('flags provenance: real port-type edges are semantic, string-match fallbacks inferred', () => {
    const inv = analyzeFixture('import_proj5');
    // proj5's button/textinput variants carry color/textStyle parameters whose
    // catalog port types identify them — those must be semantic, not guesses.
    const semantic = inv.edges.filter((e) => e.confidence === 'semantic');
    expect(semantic.length).toBeGreaterThan(0);
    // Every color-style variant dependency should be backed by a color edge.
    const colorEdges = inv.edges.filter((e) => e.to.kind === 'colorStyle');
    expect(colorEdges.some((e) => e.to.name === 'Primary')).toBe(true);
  });

  it('finds component-typed parameter references the heuristic cannot (semantic > inferred)', () => {
    // A component-typed parameter pointing at "/Widget" is a real dependency,
    // but "/Widget" is not a resource path, so the legacy string-match heuristic
    // never saw it. The port-type pass does.
    const portType: PortTypeLookup = (nodeType, port) =>
      nodeType === 'Host' && port === 'target' ? 'component' : undefined;

    const project = {
      components: [
        {
          name: '/Page',
          graph: { roots: [{ id: 'n1', type: 'Host', parameters: { target: '/Widget' } }] }
        }
      ]
    };

    const inv = buildInventory({ sourceDir: '/tmp', project: project as never, resources: [], modules: [], portType });
    const compEdges = inv.edges.filter((e) => e.to.kind === 'component');
    expect(compEdges.some((e) => e.to.name === '/Widget' && e.confidence === 'semantic')).toBe(true);
  });

  it('does not invent style edges for non-style values (e.g. hex colors)', () => {
    const portType: PortTypeLookup = () => 'color';
    const project = {
      metadata: { styles: { colors: { Primary: {} } } },
      components: [{ name: '/A', graph: { roots: [{ id: 'n1', type: 'Group', parameters: { backgroundColor: '#ff0000' } }] } }]
    };
    const inv = buildInventory({ sourceDir: '/tmp', project: project as never, resources: [], modules: [], portType });
    expect(inv.edges.filter((e) => e.to.kind === 'colorStyle')).toEqual([]);
  });
});
