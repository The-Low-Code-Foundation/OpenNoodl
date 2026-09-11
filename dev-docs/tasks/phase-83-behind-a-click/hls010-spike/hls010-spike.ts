/**
 * HLS-010 spike entry — TEMPORARY, delete after the verdict is written.
 *
 * Runs the editor's REAL `deployToFolder` in a plain Node process, bundled
 * exactly the way `nodegx serve` is. Nothing here asserts success: a stack
 * trace is the answer the spike is after.
 */

import '../../../../packages/noodl-preview/src/headless';
import * as fs from 'fs';
import * as path from 'path';

import { bootstrapNodeLibrary } from '../../../../packages/noodl-preview/src/headless';
import { ProjectImporter, type ImportInput } from '../../../../packages/noodl-editor/src/editor/src/io/ProjectImporter';
import type { LegacyProject } from '../../../../packages/noodl-editor/src/editor/src/io/ProjectExporter';
import { ProjectModel } from '@noodl-models/projectmodel';
import { deployToFolder } from '@noodl-utils/compilation/build/deployer';

const PROJECT_DIR = process.argv[2];
const OUT_DIR = process.argv[3];

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;

function readV2(dir: string): LegacyProject {
  const registry = readJson<any>(path.join(dir, 'components', '_registry.json'));
  const componentsDir = path.join(dir, 'components');
  const components: ImportInput['components'] = {};
  for (const [key, entry] of Object.entries<any>(registry.components ?? {})) {
    const compDir = path.join(componentsDir, entry.path);
    const maybe = <T>(name: string, fallback: T): T =>
      fs.existsSync(path.join(compDir, name)) ? readJson<T>(path.join(compDir, name)) : fallback;
    components[key] = {
      component: maybe('component.json', {} as any),
      nodes: maybe('nodes.json', { nodes: [] } as any),
      connections: maybe('connections.json', { connections: [] } as any)
    };
  }
  const optional = <T>(name: string): T | undefined =>
    fs.existsSync(path.join(dir, name)) ? readJson<T>(path.join(dir, name)) : undefined;

  return new ProjectImporter().import({
    project: readJson<any>(path.join(dir, 'nodegx.project.json')),
    registry,
    routes: optional<any>('nodegx.routes.json'),
    styles: optional<any>('nodegx.styles.json'),
    components
  }).project;
}

/** Connections the project holds ON DISK — the third thing both paths get measured against. */
function connectionsOnDisk(dir: string): number {
  const registry = readJson<any>(path.join(dir, 'components', '_registry.json'));
  let total = 0;
  for (const entry of Object.values<any>(registry.components ?? {})) {
    const f = path.join(dir, 'components', entry.path, 'connections.json');
    if (fs.existsSync(f)) total += (readJson<any>(f).connections ?? []).length;
  }
  return total;
}

async function main() {
  // NEGATIVE CONTROL: with SKIP_LIB=1 the node library is never populated, which is
  // exactly HLS-013 §4's trap. If the connection count does NOT collapse here, the
  // count is not measuring what it claims to.
  const skip = process.env.SKIP_LIB === '1';
  const types = skip ? 0 : bootstrapNodeLibrary();
  console.log(`[spike] node library types : ${types}${skip ? '  (SKIPPED — negative control)' : ''}`);
  console.log(`[spike] connections on disk: ${connectionsOnDisk(PROJECT_DIR)}`);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { platform } = require('@noodl/platform');
  console.log(`[spike] platform.name      : ${platform.name}`);
  console.log(`[spike] platform.getAppPath: ${platform.getAppPath()}`);
  console.log(`[spike] process.cwd()      : ${process.cwd()}`);

  const legacy = readV2(PROJECT_DIR);
  const project = ProjectModel.fromJSON(legacy);
  project._retainedProjectDirectory = PROJECT_DIR;
  console.log(`[spike] components loaded  : ${project.getComponents().length}`);
  console.log(`[spike] root node          : ${project.getRootNode() ? 'yes' : 'NO'}`);

  let outcome = 'resolved';
  try {
    const result = await deployToFolder({
      project,
      direntry: OUT_DIR,
      environment: undefined,
      baseUrl: '/'
    });
    console.log(`[spike] deployToFolder RESOLVED — copied ${result?.copyReport?.copiedCount} project file(s)`);
  } catch (err: any) {
    outcome = 'REJECTED';
    console.log('[spike] deployToFolder REJECTED -----------------------------');
    console.log(`[spike] name   : ${err?.name}`);
    console.log(`[spike] message: ${err?.message ?? JSON.stringify(err)}`);
    console.log(`[spike] stack  :\n${err?.stack ?? '(no stack — plain object rejection)'}`);
    console.log('[spike] --------------------------------------------------');
  }
  console.log(`[spike] OUTCOME: ${outcome}`);

  if (fs.existsSync(OUT_DIR)) {
    const listing = fs.readdirSync(OUT_DIR);
    console.log(`[spike] output dir: ${listing.length} entries -> ${listing.slice(0, 40).join(', ')}`);
  }
}

main().catch((e) => {
  console.log('[spike] TOP-LEVEL THROW (not a deployToFolder rejection):');
  console.log(e?.stack ?? String(e));
  process.exit(1);
});
