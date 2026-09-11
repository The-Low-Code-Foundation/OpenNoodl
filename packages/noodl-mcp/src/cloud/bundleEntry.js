/**
 * HLS-013 — builds one project's cloud-function bundle, in a child process.
 *
 * ## Why a child process
 *
 * The bundle has to be built by **the editor's own exporter**, or the headless
 * door and the Deploy button ship different graphs — which is SB-017, the defect
 * where two bundle builders disagreed and the one a person actually got was the
 * one nobody measured.
 *
 * But reaching that exporter means reaching `ProjectModel`, and its import chain
 * is not free. Measured, not guessed: importing it into the MCP server's own
 * TypeScript program produced **201 type errors** from editor files that
 * typecheck perfectly well in the editor's program (different `strictNullChecks`,
 * no global `TSFixme`), and pulled
 * `views/panels/propertyeditor/models/modelProxy.ts` — a renderer VIEW module —
 * into a server bundle.
 *
 * So it runs here instead, exactly the way `kitExtract/entry.js` runs a kit's
 * own code: bundled by `build.mjs` into `dist/cloud-bundle.cjs`, spawned, and
 * read back as one JSON document on stdout.
 *
 * ## A separate process is also the containment
 *
 * 🔴 Loading a project MUTATES process-wide singletons (`NodeLibrary.instance`,
 * `ProjectModel.instance`) and installs the **cloud** node library over whatever
 * was there. In-process that would decide what every later call in the same
 * server resolves against. Here it dies with the child.
 *
 * 🔴 It also schedules a WRITE. A model change queues an autosave whose
 * `doWriteProjectToDisk` calls `project.toDirectory(...)` — so reading a project
 * in order to deploy it would rewrite every component file on disk.
 * `prepareProjectForCloudExport` sets `_isReadOnly` to stop that; the child
 * boundary means a mistake there cannot outlive one spawn either.
 *
 * Usage: `node cloud-bundle.cjs <projectDir>` → JSON on stdout.
 */

// 🔴 FIRST, and not decorative: `projectmodel` reaches `bugtracker.ts`, which
// calls `filesystem.join(platform.getUserDataPath(), 'debug')` at MODULE SCOPE.
// Without a platform installed, merely importing the model throws
// `Cannot read properties of undefined (reading 'join')`.
require('@noodl/platform-node');

const fs = require('fs');
const path = require('path');

const { applyPatches } = require('../../../noodl-editor/src/editor/src/models/ProjectPatches/applypatches');
const { ProjectImporter } = require('../../../noodl-editor/src/editor/src/io/ProjectImporter');
const { ProjectModel } = require('../../../noodl-editor/src/editor/src/models/projectmodel');
const {
  prepareProjectForCloudExport
} = require('../../../noodl-editor/src/editor/src/utils/exporter/cloudDeployEnvironment');
const {
  buildCloudBundlePartsWithKits,
  cloudBundleName
} = require('../../../noodl-editor/src/editor/src/utils/exporter/cloudFunctions');

/**
 * The v2 directory as one legacy project, through **the editor's own reader**.
 *
 * `ProjectImporter` is pure — no `ProjectModel`, no `NodeLibrary`, no Electron —
 * which is what lets this call the same class the editor calls when it opens a
 * v2 project.
 */
function readAsLegacyProject(projectDir) {
  const read = (...parts) => JSON.parse(fs.readFileSync(path.join(projectDir, ...parts), 'utf-8'));

  const registry = read('components', '_registry.json');
  const components = {};
  for (const [key, row] of Object.entries(registry.components)) {
    components[key] = {
      component: read('components', row.path, 'component.json'),
      nodes: read('components', row.path, 'nodes.json'),
      connections: read('components', row.path, 'connections.json')
    };
  }

  const result = new ProjectImporter().import({ project: read('nodegx.project.json'), registry, components });
  if (result.warnings.length > 0) {
    throw new Error(`the importer could not reconstruct the project:\n  ${result.warnings.join('\n  ')}`);
  }
  return result.project;
}

async function main() {
  const projectDir = process.argv[2];
  if (!projectDir) throw new Error('usage: cloud-bundle.cjs <projectDir>');

  const legacy = readAsLegacyProject(projectDir);

  // 🔴 THE SEAM (DEF-007 / HLS-003). `ProjectModel.fromJSON` does NOT apply
  // patches — the editor calls `applyPatches` on the line before it, and a path
  // that skips it sees the file as written while the editor sees a graph the
  // run-on-value-change migration has rewritten.
  //
  // Without this, the headless deploy would ship cloud functions built from a
  // DIFFERENT graph than the editor's Deploy button ships for the same project:
  // one stored parameter per governed input the author never stated. That is
  // SB-017's shape exactly, and HLS-003 already measured what this seam costs on
  // the frontend export — two `Condition` nodes and four cascade nodes refused
  // over a parameter nobody chose.
  //
  // 🔴 Caught by `def007-project-load-seam.test.ts`, not by review: this file
  // was written without the call, and the register's scan is what said so.
  applyPatches(legacy);

  const project = ProjectModel.fromJSON(legacy);

  // `cloudBundleName` keys the bundle on the project DIRECTORY so that one
  // backend serving two projects cannot let them clobber each other's
  // functions. Without this the headless deploy would compute a different name
  // from the editor's for the same project — two bundles, one project, and the
  // stale one still being served.
  project._retainedProjectDirectory = projectDir;

  prepareProjectForCloudExport(project);

  const parts = await buildCloudBundlePartsWithKits(project);
  process.stdout.write(JSON.stringify({ bundleName: cloudBundleName(project), parts }));
}

main().then(
  () => process.exit(0),
  (e) => {
    process.stderr.write(String((e && e.stack) || e));
    process.exit(1);
  }
);
