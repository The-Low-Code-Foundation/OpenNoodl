/**
 * Headless `deployToFolder` — the editor's REAL deploy path, without an editor.
 *
 * `scripts/devtools/render-from-disk.js` reconstructs the export contract by
 * hand. That is the right tool for a layout question and the wrong one for a
 * deploy question: the artefact it serves never went through
 * `Exporter.exportToJSON`, so it cannot answer "does the thing a person
 * deploys work". This does. It composes exactly what
 * `compilation.deployToFolderWithContext` composes — `ProjectModel`, a
 * populated `NodeLibrary`, `utils/exporter`, `build/deployer` — in Node.
 *
 * ## 🔴 The health pass is not optional, and a missing one is a SILENT PASS
 *
 * `exportComponent` (`utils/exporter/util.ts:61`) drops every connection
 * `getConnectionHealth` calls unhealthy. That predicate reads no ports: it asks
 * `WarningsModel` whether a `con-no-target-port` warning is *currently
 * recorded*, and returns `healthy: true` when none is — including when none has
 * ever been evaluated (SBR-008 §5.4). In a fresh headless process nothing has
 * evaluated anything, so an export taken here keeps EVERY connection
 * unconditionally.
 *
 * That green is worthless. "The filter ran and found nothing wrong" and "the
 * filter never ran" produce byte-identical bundles. So this forces
 * `graph.evaluateHealth()` on every component before exporting, and reports a
 * census of what the filter dropped so the caller can see it was alive.
 *
 * Pair that census with `--sabotage`, which wires a connection to a port that
 * does not exist. If the sabotaged wire is NOT dropped, the health pass did not
 * take and every other reading in the run is void.
 *
 * Usage:
 *   deploy-from-disk <project-dir> --out <dir> [--base-url /] [--endpoint URL]
 *                    [--sabotage] [--json]
 */
import * as fs from 'fs';
import * as path from 'path';

// Must be first: binds @noodl/platform and populates NodeLibrary before any
// editor module is touched. See noodl-preview/src/headless.ts.
import { bootstrapNodeLibrary } from '../../packages/noodl-preview/src/headless';

import { ProjectImporter, type ImportInput } from '../../packages/noodl-editor/src/editor/src/io/ProjectImporter';
import type { LegacyProject } from '../../packages/noodl-editor/src/editor/src/io/ProjectExporter';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File
} from '../../packages/noodl-editor/src/editor/src/schemas';
import { ProjectModel } from '@noodl-models/projectmodel';
import { deployToFolder } from '@noodl-utils/compilation/build/deployer';

type Json = Record<string, any>;

const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;

/** The predicate `deployToFolder` excludes by (`isCloudFunctionComponent`). */
const isCloudName = (name: string) => name.startsWith('/#__cloud__/');

/** Same reader `noodl-preview/src/loader.ts` uses; kept in step with it by hand. */
function readV2(dir: string): { project: LegacyProject; warnings: string[] } {
  const registry = readJson<RegistryV2File>(path.join(dir, 'components', '_registry.json'));
  const componentsDir = path.join(dir, 'components');

  const components: ImportInput['components'] = {};
  for (const [key, entry] of Object.entries((registry as any).components ?? {})) {
    const compDir = path.join(componentsDir, (entry as any).path);
    const maybe = <T,>(name: string, fallback: T): T =>
      fs.existsSync(path.join(compDir, name)) ? readJson<T>(path.join(compDir, name)) : fallback;
    components[key] = {
      component: maybe('component.json', {} as ComponentV2File),
      nodes: maybe('nodes.json', { nodes: [] } as unknown as NodesV2File),
      connections: maybe('connections.json', { connections: [] } as unknown as ConnectionsV2File)
    };
  }

  const optional = <T,>(name: string): T | undefined =>
    fs.existsSync(path.join(dir, name)) ? readJson<T>(path.join(dir, name)) : undefined;

  const result = new ProjectImporter().import({
    project: readJson<ProjectV2File>(path.join(dir, 'nodegx.project.json')),
    registry,
    routes: optional<RoutesV2File>('nodegx.routes.json'),
    styles: optional<StylesV2File>('nodegx.styles.json'),
    components
  });
  return { project: result.project as LegacyProject, warnings: result.warnings };
}

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(name);

async function main() {
  const target = process.argv[2];
  if (!target || target.startsWith('--')) {
    process.stderr.write('usage: deploy-from-disk <project-dir> --out <dir> [--endpoint URL] [--sabotage]\n');
    process.exit(2);
  }
  const projectDir = path.resolve(target);
  const outDir = path.resolve(flag('--out', path.join(projectDir, '..', 'deploy-out'))!);

  const nodeTypes = bootstrapNodeLibrary();

  const { project: legacy, warnings } = readV2(projectDir);
  const project = ProjectModel.fromJSON(legacy as any);
  project._retainedProjectDirectory = projectDir;

  // ── the sabotage arm: a wire to a port that cannot resolve ────────────────
  // Placed BEFORE the health pass so the pass has a chance to see it. If this
  // survives the export, the health pass did not run and nothing else here is
  // evidence.
  let sabotaged: Json | null = null;
  if (has('--sabotage')) {
    for (const comp of project.getComponents()) {
      // 🔴 It must land on a component the DEPLOY KEEPS. `deployToFolder`
      // drops every `/#__cloud__/` component wholesale, so a wire sabotaged
      // there is absent from the bundle whether the health filter works or
      // not — the first version of this arm did exactly that and reported a
      // confident `false`.
      if (isCloudName(comp.name)) continue;
      const conns = (comp.graph as any).connections ?? [];
      if (!conns.length) continue;
      const src = conns[0];
      const bogus = {
        fromId: src.fromId,
        fromProperty: src.fromProperty,
        toId: src.toId,
        toProperty: 'thisPortDoesNotExist_SBR007'
      };
      conns.push(bogus);
      sabotaged = { component: comp.name, ...bogus };
      break;
    }
    if (!sabotaged) throw new Error('sabotage arm found no component with a connection to copy');
  }

  // ── 🔴 force the health pass; see the header ──────────────────────────────
  // `evaluateHealth()` has four early returns and takes all of them SILENTLY.
  // Counting calls is not counting evaluations, so each guard is read here and
  // the caller is told which one fired.
  const { NodeLibrary } = require('@noodl-models/nodelibrary') as any;
  const { WarningsModel } = require('@noodl-models/warningsmodel') as any;
  // 🔴 The editor registers the open project as a node-library module; nothing
  // headless does, and `evaluateHealth()` bails on exactly that guard —
  // silently, for every component. Without this line the health filter is
  // inert and the export keeps every wire no matter how broken.
  if (!NodeLibrary.instance.isModuleRegistered(project)) NodeLibrary.instance.registerModule(project);

  const guards: Record<string, number> = {};
  const bump = (k: string) => (guards[k] = (guards[k] ?? 0) + 1);
  let evaluated = 0;
  for (const comp of project.getComponents()) {
    const graph = comp.graph as any;
    if (!NodeLibrary.instance.isLoaded()) bump('nodeLibraryNotLoaded');
    else if (!graph.owner) bump('graphHasNoComponent');
    else if (!graph.owner.owner) bump('componentHasNoProject');
    else if (!NodeLibrary.instance.isModuleRegistered(graph.owner.owner)) bump('moduleNotRegistered');
    else {
      bump('ok');
      evaluated++;
    }
    graph.evaluateHealth();
  }
  const warningsAfterPass = (() => {
    try {
      const all = (WarningsModel.instance as any).warnings ?? {};
      return Object.keys(all).length;
    } catch {
      return null;
    }
  })();

  // Census input: what the graphs hold, per component, before the filter.
  const onGraph: Record<string, number> = {};
  for (const comp of project.getComponents()) {
    onGraph[comp.name] = ((comp.graph as any).connections ?? []).length;
  }

  // `--endpoint` deploys the project to a DIFFERENT ENVIRONMENT rather than
  // patching the artefact afterwards: `json.ts:121` replaces the whole
  // `cloudservices` block from this object, so `appId`/`type` must be carried
  // across or the deployed app authenticates against nothing. They are taken
  // from the project's own metadata, so the only thing that varies is the URL —
  // which is the point of an environment.
  const endpoint = flag('--endpoint');
  const existing = ((project as any).metadata ?? {}).cloudservices ?? {};
  const environment = endpoint
    ? ({
        id: flag('--instance-id', existing.instanceId),
        name: 'headless drive',
        url: endpoint,
        appId: flag('--app-id', existing.appId),
        type: flag('--backend-type', existing.type || 'nodegx')
      } as any)
    : undefined;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const result = await deployToFolder({
    project,
    direntry: outDir,
    environment,
    baseUrl: flag('--base-url', '/')!,
    runtimeType: 'deploy'
  });

  // Census output: what landed in the deployed bundle, per component.
  // `useBundleHashes` names it index-<hash>.js, so find it rather than assume.
  const indexName = fs.readdirSync(outDir).find((f) => /^index(-[0-9a-f]+)?\.js$/.test(f));
  if (!indexName) throw new Error(`no index js in ${outDir} — the deploy did not write its export`);
  const indexJs = fs.readFileSync(path.join(outDir, indexName), 'utf8');
  const m = indexJs.match(/window\.projectData\s*=\s*(\{[\s\S]*\});\s*$/);
  if (!m) throw new Error(`could not read window.projectData out of ${indexName}`);
  const exported: Json = JSON.parse(m[1]);

  const inDeployed: Record<string, number> = {};
  const walk = (comps: any[]) => {
    for (const c of comps ?? []) inDeployed[c.name] = (c.connections ?? []).length;
  };
  walk(exported.components);
  // A bundle file is a bare ARRAY of components; the root export nests them
  // under `components`. Reading only one shape is how this census first
  // reported "0 connections deployed" on a deploy that carried 360.
  const bundleDir = path.join(outDir, 'noodl_bundles');
  for (const f of fs.readdirSync(bundleDir).filter((f) => f.endsWith('.json'))) {
    const b = readJson<any>(path.join(bundleDir, f));
    walk(Array.isArray(b) ? b : b.components);
  }

  // Three populations, kept apart on purpose. A raw on-graph-minus-deployed
  // total conflates the health filter with the cloud-component exclusion, and
  // the exclusion is much the larger term.
  const dropped: Json[] = [];
  let cloudExcluded = 0;
  let absentNotCloud = 0;
  for (const [name, before] of Object.entries(onGraph)) {
    if (isCloudName(name)) {
      cloudExcluded += before;
      continue;
    }
    const after = inDeployed[name];
    if (after === undefined) {
      absentNotCloud += before;
      continue;
    }
    if (after !== before) dropped.push({ component: name, onGraph: before, inDeployed: after, dropped: before - after });
  }
  const sabotageComponent = sabotaged ? (sabotaged.component as string) : null;

  const report = {
    projectDir,
    outDir,
    nodeTypes,
    componentsEvaluated: evaluated,
    healthGuards: guards,
    warningKeysAfterPass: warningsAfterPass,
    importWarnings: warnings,
    endpoint: endpoint ?? null,
    sabotaged,
    sabotageComponent,
    // Reported as the pair of raw counts, not a verdict: the caller compares
    // this component's deployed count against the un-sabotaged arm's.
    sabotageCounts: sabotageComponent
      ? { onGraph: onGraph[sabotageComponent], inDeployed: inDeployed[sabotageComponent] ?? null }
      : null,
    droppedByComponent: dropped,
    totalOnGraph: Object.values(onGraph).reduce((a, b) => a + b, 0),
    totalInDeployed: Object.values(inDeployed).reduce((a, b) => a + b, 0),
    cloudExcluded,
    absentNotCloud,
    droppedByHealthFilter: dropped.reduce((a, d) => a + (d.dropped as number), 0),
    copyReport: (result as any).copyReport?.summary ?? null,
    filesWritten: fs.readdirSync(outDir).length
  };

  if (has('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    process.stdout.write(`node types           ${report.nodeTypes}\n`);
    process.stdout.write(`components evaluated ${report.componentsEvaluated} guards=${JSON.stringify(report.healthGuards)}\n`);
    process.stdout.write(`warning keys after   ${report.warningKeysAfterPass}\n`);
    process.stdout.write(`connections on graph ${report.totalOnGraph}\n`);
    process.stdout.write(`connections deployed ${report.totalInDeployed}\n`);
    process.stdout.write(`cloud excluded       ${report.cloudExcluded}\n`);
    process.stdout.write(`absent, not cloud    ${report.absentNotCloud}\n`);
    process.stdout.write(`dropped by filter    ${report.droppedByHealthFilter}\n`);
    process.stdout.write(`sabotage             ${JSON.stringify(report.sabotageCounts)} on ${report.sabotageComponent}\n`);
    process.stdout.write(`dropped by component ${JSON.stringify(report.droppedByComponent)}\n`);
    process.stdout.write(`out                  ${outDir} (${report.filesWritten} entries)\n`);
  }
}

main().catch((err) => {
  process.stderr.write((err && err.stack) || String(err));
  process.stderr.write('\n');
  process.exit(1);
});
