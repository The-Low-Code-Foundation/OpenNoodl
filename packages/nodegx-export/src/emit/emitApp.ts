/**
 * Whole-app emission: the scaffold, then the visual generator's component/page files replacing
 * the scaffold's placeholders, then the app-state modules (stores/events — step 5) and the
 * typed api stubs the pages consume. The dependency list stays computed from the output
 * (TARGET-OUTPUT §3): @nodegx/core joins package.json exactly when a generated file imports it.
 */

import { Catalog, CatalogIndex } from '../catalog';
import { planProject, ProjectPlan, QueryPlan } from '../analyze/plan';
import { ExportIR } from '../ir/types';
import { emitComponent } from './component';
import { emitScaffold } from './scaffold';
import { emitStateModules } from './state';

const GENERATED_TS = '// @nodegx:generated (api stub — provenance markers complete in EXP-007)\n';

export interface EmittedApp {
  /** Path → content, sorted by path (D-rules). */
  files: Record<string, string>;
  /** EXP-004's feed: everything analysis or emission dropped or deferred, per component. */
  notes: string[];
}

export function emitApp(ir: ExportIR, catalog: Catalog): EmittedApp {
  const index = new CatalogIndex(catalog);
  const project = planProject(ir, index);
  const files = emitScaffold(ir);
  const notes: string[] = [];

  if (ir.project.cloudComponents.length > 0) {
    notes.push(
      `${ir.project.cloudComponents.length} cloud function component(s) skipped — they run on the backend's interpreter, not in the frontend export: ${ir.project.cloudComponents.join(', ')}`
    );
  }

  for (const plan of project.plans) {
    if (plan.skipReason) {
      if (plan.rootId === null && !plan.file) notes.push(`${plan.path}: ${plan.skipReason}`);
      continue;
    }
    const emitted = emitComponent(plan, project, ir, index);
    if (!emitted) continue;
    Object.assign(files, emitted.files);
    notes.push(...emitted.notes);
    notes.push(...plan.notes.map((note) => `${plan.path}: ${note}`));
  }

  for (const [path, content] of apiStubs(ir, project)) {
    files[path] = content;
  }
  Object.assign(files, emitStateModules(project));

  // Dependencies are computed from the output (TARGET-OUTPUT §3): the library is earned by an
  // import, never declared up front.
  const usesCore = Object.entries(files).some(
    ([path, content]) => path !== 'package.json' && content.includes("from '@nodegx/core")
  );
  if (usesCore) {
    files['package.json'] = withCoreDependency(files['package.json']);
  }

  return {
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    notes
  };
}

function withCoreDependency(packageJson: string): string {
  const parsed = JSON.parse(packageJson);
  parsed.dependencies = Object.fromEntries(
    [['@nodegx/core', '^0.1.0'], ...Object.entries(parsed.dependencies ?? {})].sort(([a], [b]) =>
      a < b ? -1 : 1
    )
  );
  return JSON.stringify(parsed, null, 2) + '\n';
}

/**
 * One typed stub module per collection the generated pages consume. The type comes from the
 * project's collection schema; the stub returns an empty array so the export builds and runs
 * before the inheritor wires a backend, and every stub is a line item in the report.
 */
function apiStubs(ir: ExportIR, project: ProjectPlan): Array<[string, string]> {
  type Site = { componentPath: string; nodeId: string };
  type Module = {
    typeName: string;
    moduleBase: string;
    fetchName?: string;
    querySites: Site[];
    /** Mutation function name → its call sites, first-use order (RECORD-VERBS-TARGET §4d). */
    mutations: Map<string, { verb: 'create' | 'update' | 'delete'; sites: Site[] }>;
  };
  const byCollection = new Map<string, Module>();
  const moduleFor = (collectionName: string, typeName: string, moduleBase: string): Module => {
    let entry = byCollection.get(collectionName);
    if (entry === undefined) {
      byCollection.set(collectionName, (entry = { typeName, moduleBase, querySites: [], mutations: new Map() }));
    }
    return entry;
  };
  for (const plan of project.plans) {
    for (const query of plan.queries) {
      const entry = moduleFor(query.collectionName, query.typeName, query.moduleBase);
      entry.fetchName = query.fetchName;
      entry.querySites.push({ componentPath: plan.path, nodeId: query.nodeId });
    }
    for (const mutation of plan.mutations) {
      const entry = moduleFor(mutation.collectionName, mutation.typeName, mutation.moduleBase);
      let fn = entry.mutations.get(mutation.fnName);
      if (fn === undefined) entry.mutations.set(mutation.fnName, (fn = { verb: mutation.verb, sites: [] }));
      fn.sites.push({ componentPath: plan.path, nodeId: mutation.nodeId });
    }
  }

  const nodeLabel = (site: Site): string => {
    const node = ir.components.find((c) => c.path === site.componentPath)?.nodes.find((n) => n.id === site.nodeId);
    return node?.authoredLabel ? `"${node.authoredLabel}" ` : '';
  };
  const siteLine = (site: Site, type: string): string =>
    ` * TODO(export): ${nodeLabel(site)}(${type} \`${site.nodeId}\` on /${site.componentPath})`;

  const stubs: Array<[string, string]> = [];
  for (const [collectionName, module] of byCollection) {
    const schema = ir.project.collections.find((c) => c.name === collectionName);
    const { typeName, moduleBase, fetchName, querySites, mutations } = module;

    const fields = (schema?.columns ?? []).map((col) => `  ${col.name}?: ${tsColumnType(col.type)};`);
    const parts: string[] = [
      `export interface ${typeName} {\n  id: string;\n${fields.join('\n')}${fields.length > 0 ? '\n' : ''}}\n`
    ];

    if (fetchName !== undefined) {
      parts.push(
        `/**\n${querySites.map((s) => siteLine(s, 'DbCollection2')).join('\n')}\n` +
          ` * fetched the \`${collectionName}\` collection from the project's NodeGX backend. Connect this to your\n` +
          ` * own data source; the export report lists every call site.\n */\n` +
          `export async function ${fetchName}(): Promise<${typeName}[]> {\n  return [];\n}\n`
      );
    }

    // A read stub answers empty so the export builds and runs; a **write** stub throws
    // (RECORD-VERBS-TARGET §4d). An empty list is a plausible state of a real collection; a
    // fabricated successful write is a plausible state of nothing, and reporting success for a
    // record that was never stored is the one failure this whole slice exists to make visible.
    for (const [fnName, { verb, sites }] of mutations) {
      const nodeType =
        verb === 'create' ? 'NewDbModelProperties' : verb === 'update' ? 'SetDbModelProperties' : 'DeleteDbModelProperties';
      const past = verb === 'create' ? 'created a record in' : verb === 'update' ? 'updated a record in' : 'deleted a record from';
      const signature =
        verb === 'create'
          ? `(data: Partial<${typeName}>): Promise<${typeName}>`
          : verb === 'update'
            ? `(id: string, data: Partial<${typeName}>): Promise<${typeName}>`
            : `(id: string): Promise<void>`;
      parts.push(
        `/**\n${sites.map((s) => siteLine(s, nodeType)).join('\n')}\n` +
          ` * ${past} the \`${collectionName}\` collection in the project's NodeGX backend. Connect this to your\n` +
          ` * own data source; until you do it throws, which is what the graph's Failure path already handles.\n */\n` +
          `export async function ${fnName}${signature} {\n` +
          `  throw new Error('${fnName} is not connected to a backend yet');\n}\n`
      );
    }

    stubs.push([`src/api/${moduleBase}.ts`, GENERATED_TS + parts.join('\n')]);
  }
  return stubs;
}

function tsColumnType(columnType: string): string {
  switch (columnType) {
    case 'Boolean':
      return 'boolean';
    case 'Number':
      return 'number';
    default:
      return 'string';
  }
}
