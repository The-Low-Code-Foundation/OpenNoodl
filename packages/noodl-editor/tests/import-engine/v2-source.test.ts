/**
 * LIB-004 — Import Engine v2: v2-format source handling.
 *
 * `analyze` routes source loading through `projectFromDirectory`, which (for a
 * decomposed project) reconstructs a legacy-shaped `content` object via the
 * STRUCT-003 `io/ProjectImporter` before `buildInventory` runs. This spec pins
 * the format-agnostic guarantee headlessly, without a live editor: the v2
 * fixture (`tests/testfs/import_proj_v2/`, a decomposition of `import_proj1`)
 * reconstructs to a project whose importable inventory is IDENTICAL to the
 * legacy single-file project's. If the v2 loader ever drops a node, dependency,
 * or style, the two inventories diverge here.
 *
 * The Electron leg — `projectFromDirectory` actually detecting v2 and loading it
 * behind the `formatV2.enabled` flag — is exercised by the live-editor flows and
 * left as a residual (see PROGRESS.md); this spec pins the reconstruction the
 * loader delegates to.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ProjectImporter, type ImportInput } from '../../src/editor/src/io/ProjectImporter';
import { buildInventory, catalogPortType } from '../../src/editor/src/utils/import-engine/inventory';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';

const TESTFS = path.join(process.cwd(), 'tests/testfs');

function readJSON(...p: string[]) {
  return JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));
}

/** Read the decomposed v2 fixture from disk into the io importer's ImportInput. */
function readV2Fixture(dir: string): ImportInput {
  const project = readJSON(dir, 'nodegx.project.json');
  const registry = readJSON(dir, 'components', '_registry.json');
  const routesPath = path.join(dir, 'nodegx.routes.json');
  const stylesPath = path.join(dir, 'nodegx.styles.json');

  const components: ImportInput['components'] = {};
  for (const registryPath of Object.keys(registry.components)) {
    const cdir = path.join(dir, 'components', registryPath);
    components[registryPath] = {
      component: readJSON(cdir, 'component.json'),
      nodes: readJSON(cdir, 'nodes.json'),
      connections: readJSON(cdir, 'connections.json')
    };
  }

  return {
    project,
    registry,
    routes: fs.existsSync(routesPath) ? readJSON(routesPath) : undefined,
    styles: fs.existsSync(stylesPath) ? readJSON(stylesPath) : undefined,
    components
  };
}

function inventoryOf(project: unknown) {
  return buildInventory({
    sourceDir: '/does-not-matter',
    project: project as never,
    // Resources/modules are physical files, format-agnostic; the decomposition
    // only affects components/styles/variants, which is what this pins.
    resources: [],
    modules: [],
    portType: catalogPortType(loadDefaultCatalog())
  });
}

describe('LIB-004 import engine — v2-format source', () => {
  it('reconstructs a v2 project to the same importable inventory as its legacy twin', () => {
    const legacyProject = readJSON(TESTFS, 'import_proj1', 'project.json');

    const { project: v2Reconstructed, warnings } = new ProjectImporter().import(readV2Fixture(path.join(TESTFS, 'import_proj_v2')));
    expect(warnings).toEqual([]);

    const legacyInv = inventoryOf(legacyProject);
    const v2Inv = inventoryOf(v2Reconstructed);

    const shape = (inv: ReturnType<typeof inventoryOf>) => ({
      components: inv.components.map((c) => ({
        name: c.name,
        dependencies: c.dependencies,
        fileDependencies: c.fileDependencies,
        styleDependencies: c.styleDependencies,
        variantDependencies: c.variantDependencies
      })),
      styles: inv.styles,
      variants: inv.variants
    });

    expect(shape(v2Inv)).toEqual(shape(legacyInv));
    // Guard: the fixture is non-trivial (the loader actually reconstructed nodes).
    expect(v2Inv.components.map((c) => c.name).sort()).toEqual(['/Main', '/comp1', '/comp2']);
    expect(v2Inv.components.find((c) => c.name === '/Main')?.dependencies).toEqual(['/comp1']);
  });
});
